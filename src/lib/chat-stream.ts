import { model } from "@/lib/langchain-model";
import { allTools } from "@/lib/tools/github-tools";

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface StreamChunk {
  content?: string;
  reasoning?: string;
}

export async function streamModelResponse(
  messages: unknown[],
  onChunk: (data: StreamChunk) => void
): Promise<ToolCallInfo[]> {
  const streamResult = await model.bindTools(allTools).stream(messages as any);

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
