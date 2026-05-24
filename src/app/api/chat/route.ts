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

/**
 * 流式调用模型（带工具绑定），收集 content + reasoning + tool_calls
 */
async function streamModelResponse(
  messages: any[],
  onChunk: (data: { content?: string; reasoning?: string }) => void
): Promise<ToolCallInfo[]> {
  const streamResult = await model.bindTools(allTools).stream(messages);

  let fullContent = "";
  let fullReasoning = "";
  const toolCallsMap = new Map<string, ToolCallInfo>();

  for await (const chunk of streamResult) {
    // 收集 content
    if (typeof chunk.content === "string" && chunk.content) {
      fullContent += chunk.content;
      onChunk({ content: chunk.content });
    }
    // 收集 reasoning_content
    const reasoning = (chunk as any).additional_kwargs?.reasoning_content;
    if (reasoning) {
      fullReasoning += reasoning;
      onChunk({ reasoning });
    }
    // 收集 tool_calls
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
    const { message, sessionId, promptConfig }: { message: string; sessionId: string; promptConfig?: AgentPromptConfig } = body;

    if (!message || !sessionId) {
      return new Response("缺少 message 或 sessionId 参数", { status: 400 });
    }

    const session = getOrCreateSession(sessionId, promptConfig);
    const userMessage = new HumanMessage(message);
    session.messages.push(userMessage);

    // 如果传入了 promptConfig，更新已有的 session
    if (promptConfig) {
      updateSession(sessionId, {}, promptConfig);
    }

    const encoder = new TextEncoder();
    const toolCalls: ToolCallInfo[] = [];

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

          // 如果有 tool_call，发给前端确认
          if (found.length > 0) {
            for (const tc of found) {
              toolCalls.push(tc);
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
