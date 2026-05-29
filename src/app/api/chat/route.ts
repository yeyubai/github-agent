import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { getOrCreateSessionState, appendSessionMessage, updateSessionConfig } from "@/lib/message-history";
import { streamModelResponse } from "@/lib/chat-stream";
import { parseIntent } from "@/lib/planner";
import type { AgentPromptConfig } from "@/lib/prompt-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, promptConfig }: { message: string; sessionId: string; promptConfig?: AgentPromptConfig } = body;

    if (!message || !sessionId) {
      return new Response("缺少 message 或 sessionId 参数", { status: 400 });
    }

    const state = await getOrCreateSessionState(sessionId, promptConfig);
    const userMessage = new HumanMessage(message);
    await appendSessionMessage(sessionId, userMessage);

    if (promptConfig) {
      await updateSessionConfig(sessionId, promptConfig);
    }

    // Check if this is a complex request that needs multi-step planning
    const plan = await parseIntent(message);
    if (plan) {
      // Send the plan to the frontend for approval
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ plan })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const found = await streamModelResponse(
            state.messages as unknown[],
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
