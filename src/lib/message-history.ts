// Session message history backed by Supabase (replaces in-memory Map)
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { buildSystemPrompt, AgentPromptConfig } from "./prompt-config";
import { getOrCreateSession, getMessages, appendMessage, clearSessionMessages, getUserConfig, setUserConfig, type DbMessage } from "./db";

export interface SessionState {
  messages: BaseMessage[];
  sessionId: string;  // Supabase session ID
  userId: string;
}

// In-memory cache for the current session (warm reads, periodic flush)
const cache = new Map<string, SessionState>();

async function dbToLangChain(msg: DbMessage): Promise<BaseMessage> {
  switch (msg.role) {
    case "system":
      return new SystemMessage(msg.content);
    case "human":
      return new HumanMessage(msg.content);
    case "ai":
      return new AIMessage(msg.content);
    case "tool":
      return new ToolMessage({
        content: msg.content,
        tool_call_id: msg.tool_call_id || "",
        name: msg.tool_name || "",
      });
    default:
      return new HumanMessage(msg.content);
  }
}

function langChainToDb(msg: BaseMessage): DbMessage {
  if (msg instanceof SystemMessage) {
    return { role: "system", content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) };
  }
  if (msg instanceof HumanMessage) {
    return { role: "human", content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) };
  }
  if (msg instanceof AIMessage) {
    return { role: "ai", content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) };
  }
  if (msg instanceof ToolMessage) {
    return {
      role: "tool",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      tool_call_id: (msg as any).tool_call_id,
      tool_name: (msg as any).name,
    };
  }
  return { role: "human", content: JSON.stringify(msg) };
}

export async function getOrCreateSessionState(
  clientId: string,
  promptConfig?: AgentPromptConfig
): Promise<SessionState> {
  // Check cache first
  if (cache.has(clientId)) {
    return cache.get(clientId)!;
  }

  const { id: sessionId, userId } = await getOrCreateSession(clientId);

  // Load messages from DB
  const dbMessages = await getMessages(sessionId);
  const messages = await Promise.all(dbMessages.map(dbToLangChain));

  // If no messages exist, seed with system message
  if (messages.length === 0) {
    const config = promptConfig || await getUserConfig(userId) || undefined;
    const systemMsg = new SystemMessage(buildSystemPrompt(config));
    messages.push(systemMsg);
    await appendMessage(sessionId, langChainToDb(systemMsg));
  }

  // Update system message if promptConfig changed
  if (promptConfig && messages[0] instanceof SystemMessage) {
    messages[0] = new SystemMessage(buildSystemPrompt(promptConfig));
    // Update first message in DB
    const allDb = await getMessages(sessionId);
    if (allDb.length > 0) {
      // Delete old system message and re-insert
      // For simplicity, clear and re-seed (system msg is always first)
    }
  }

  const state: SessionState = { messages, sessionId, userId };
  cache.set(clientId, state);
  return state;
}

export async function appendSessionMessage(clientId: string, msg: BaseMessage): Promise<void> {
  const state = cache.get(clientId);
  if (!state) return;

  state.messages.push(msg);
  await appendMessage(state.sessionId, langChainToDb(msg));
}

export async function clearClientSession(clientId: string): Promise<void> {
  const state = cache.get(clientId);
  if (!state) return;

  await clearSessionMessages(state.sessionId);
  cache.delete(clientId);
}

export async function updateSessionConfig(clientId: string, promptConfig: AgentPromptConfig): Promise<void> {
  const state = cache.get(clientId);
  if (!state) return;

  await setUserConfig(state.userId, {
    role: promptConfig.role,
    toolDescription: promptConfig.toolDescription,
    workflow: promptConfig.workflow,
    replyStyle: promptConfig.replyStyle,
  });

  // Update system message in cache
  if (state.messages[0] instanceof SystemMessage) {
    state.messages[0] = new SystemMessage(buildSystemPrompt(promptConfig));
  }
}
