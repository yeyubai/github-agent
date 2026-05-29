import { NextRequest } from "next/server";
import { ToolMessage } from "@langchain/core/messages";
import { getOrCreateSessionState, appendSessionMessage, updateSessionConfig } from "@/lib/message-history";
import { streamModelResponse } from "@/lib/chat-stream";
import { allTools } from "@/lib/tools/github-tools";
import type { AgentPromptConfig } from "@/lib/prompt-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, confirmed, toolName, toolArgs, toolCallId, promptConfig }: {
      sessionId: string;
      confirmed: boolean;
      toolName: string;
      toolArgs: Record<string, unknown>;
      toolCallId?: string;
      promptConfig?: AgentPromptConfig;
    } = body;

    if (!sessionId) {
      return new Response("缺少 sessionId 参数", { status: 400 });
    }

    const state = await getOrCreateSessionState(sessionId);

    if (!confirmed) {
      const cancelMsg = new ToolMessage({
        content: "用户取消了该操作。",
        tool_call_id: toolCallId || "",
        name: toolName,
      });
      await appendSessionMessage(sessionId, cancelMsg);
      if (promptConfig) await updateSessionConfig(sessionId, promptConfig);
      return new Response(JSON.stringify({ content: "已取消执行。" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const tool = allTools.find((t) => t.name === toolName);
    if (!tool) {
      return new Response(JSON.stringify({ error: `未找到工具: ${toolName}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const toolResult = await (tool as any).invoke(toolArgs);

    // FIX: Use ToolMessage instead of HumanMessage for tool results
    const resultMsg = new ToolMessage({
      content: `工具 ${toolName} 执行结果：\n${toolResult}`,
      tool_call_id: toolCallId || "",
      name: toolName,
    });
    await appendSessionMessage(sessionId, resultMsg);

    if (promptConfig) await updateSessionConfig(sessionId, promptConfig);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const found = await streamModelResponse(
            state.messages as any,
            (data) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              );
            }
          );

          if (found.length > 0) {
            for (const tc of found) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ tool_call: tc })}\n\n`
                )
              );
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
