// 命令确认 API — 用户确认后执行工具并让 Agent 分析结果
import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { model } from "@/lib/langchain-model";
import { getOrCreateSession, updateSession } from "@/lib/message-history";
import { allTools } from "@/lib/tools/github-tools";
import type { AgentPromptConfig } from "@/lib/prompt-config";

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, any>;
}

async function streamModelResponse(
  messages: any[],
  onChunk: (data: { content?: string; reasoning?: string }) => void
): Promise<ToolCallInfo[]> {
  const streamResult = await model.bindTools(allTools).stream(messages);

  const toolCallsMap = new Map<string, ToolCallInfo>();

  for await (const chunk of streamResult) {
    if (typeof chunk.content === "string" && chunk.content) {
      onChunk({ content: chunk.content });
    }
    const reasoning = (chunk as any).additional_kwargs?.reasoning_content;
    if (reasoning) {
      onChunk({ reasoning });
    }
    if (chunk.tool_calls?.length) {
      for (const tc of chunk.tool_calls as any[]) {
        if (tc.id) {
          const existing = toolCallsMap.get(tc.id);
          if (existing) {
            existing.args = { ...existing.args, ...(tc.args || {}) };
          } else {
            toolCallsMap.set(tc.id, {
              id: tc.id,
              name: tc.name || "",
              args: tc.args || {},
            });
          }
        }
      }
    }
  }

  return Array.from(toolCallsMap.values());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, confirmed, toolName, toolArgs, promptConfig }: {
      sessionId: string;
      confirmed: boolean;
      toolName: string;
      toolArgs: Record<string, any>;
      promptConfig?: AgentPromptConfig;
    } = body;

    if (!sessionId) {
      return new Response("缺少 sessionId 参数", { status: 400 });
    }

    const session = getOrCreateSession(sessionId, promptConfig);

    if (!confirmed) {
      session.messages.push(new HumanMessage("用户取消了该操作。"));
      if (promptConfig) updateSession(sessionId, {}, promptConfig);
      return new Response(
        JSON.stringify({ content: "已取消执行。" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 执行工具
    const tool = allTools.find((t) => t.name === toolName);
    if (!tool) {
      return new Response(JSON.stringify({ error: `未找到工具: ${toolName}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const toolResult = await (tool as any).invoke(toolArgs);

    // 将工具结果加入会话
    session.messages.push(
      new HumanMessage(`工具 ${toolName} 执行结果：\n${toolResult}\n请分析并回复用户。`)
    );

    if (promptConfig) updateSession(sessionId, {}, promptConfig);

    // 让模型分析结果
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const found = await streamModelResponse(
            session.messages,
            (data) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              );
            }
          );

          // 如果模型又触发了新的 tool_call，发给前端确认
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
        } catch (e: any) {
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
