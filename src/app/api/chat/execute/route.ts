// src/app/api/chat/execute/route.ts
// Batch tool execution for multi-step plans
import { NextRequest } from "next/server";
import { ToolMessage, HumanMessage } from "@langchain/core/messages";
import { model } from "@/lib/langchain-model";
import { getOrCreateSessionState, appendSessionMessage, updateSessionConfig } from "@/lib/message-history";
import { allTools } from "@/lib/tools/github-tools";
import { executePlan } from "@/lib/planner";
import type { AgentPromptConfig } from "@/lib/prompt-config";
import type { MultiStepPlanType } from "@/lib/planner";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, plan, promptConfig }: {
      sessionId: string;
      plan: MultiStepPlanType;
      promptConfig?: AgentPromptConfig;
    } = body;

    if (!sessionId || !plan) {
      return new Response("缺少 sessionId 或 plan 参数", { status: 400 });
    }

    const state = await getOrCreateSessionState(sessionId);

    if (promptConfig) {
      await updateSessionConfig(sessionId, promptConfig);
    }

    // Tool executor function
    const executeTool = async (toolName: string, args: Record<string, unknown>): Promise<string> => {
      const tool = allTools.find((t) => t.name === toolName);
      if (!tool) throw new Error(`未找到工具: ${toolName}`);
      const result = await (tool as any).invoke(args);
      return result;
    };

    // Execute the plan
    const results = await executePlan(plan, executeTool);

    // Append all tool results as ToolMessages
    for (let i = 0; i < plan.steps.length; i++) {
      if (i < results.length) {
        const step = plan.steps[i];
        const result = results[i];
        const toolMsg = new ToolMessage({
          content: result.success
            ? `步骤 ${i + 1} (${step.description}) 执行成功：\n${result.result}`
            : `步骤 ${i + 1} (${step.description}) 执行失败：\n${result.result}`,
          tool_call_id: `plan-step-${i}`,
          name: step.toolName,
        });
        await appendSessionMessage(sessionId, toolMsg);
      }
    }

    // Now let the model analyze all results and produce a summary
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First send plan execution results
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ plan_results: results })}\n\n`)
          );

          // Then stream the model's analysis
          const streamResult = await model.bindTools(allTools).stream(state.messages as any);

          for await (const chunk of streamResult) {
            if (typeof chunk.content === "string" && chunk.content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`));
            }
            const reasoning = (chunk as any).additional_kwargs?.reasoning_content;
            if (reasoning) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ reasoning })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e: unknown) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
