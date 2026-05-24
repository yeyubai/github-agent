// 会话消息历史管理
import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { buildSystemPrompt, AgentPromptConfig } from "./prompt-config";

export interface SessionState {
  messages: BaseMessage[];
  pendingToolCalls?: Array<{ id: string; name: string; args: any }>;
}

const sessions = new Map<string, SessionState>();

export function getOrCreateSession(
  sessionId: string,
  promptConfig?: AgentPromptConfig
): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [new SystemMessage(buildSystemPrompt(promptConfig))],
    });
  }
  return sessions.get(sessionId)!;
}

export function clearSession(sessionId: string) {
  sessions.delete(sessionId);
}

export function updateSession(
  sessionId: string,
  state: Partial<SessionState>,
  promptConfig?: AgentPromptConfig
) {
  const existing = sessions.get(sessionId);
  if (existing) {
    Object.assign(existing, state);
    // 如果传入了新 prompt，更新 SystemMessage
    if (promptConfig && existing.messages.length > 0) {
      existing.messages[0] = new SystemMessage(buildSystemPrompt(promptConfig));
    }
  }
}
