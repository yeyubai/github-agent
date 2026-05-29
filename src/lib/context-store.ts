// src/lib/context-store.ts
// Context awareness: tracks which repo/PR/Issue the user is viewing
// and stores user preferences for smarter Agent behavior
import { getOrCreateUser, getUserContext, setUserContext, logActivity, getRecentActivity } from "./db";

export interface AgentContext {
  currentRepo: string | null;
  currentPrNumber: number | null;
  currentIssueNumber: number | null;
  preferences: Record<string, unknown>;
}

/** Get the current user's context */
export async function getContext(): Promise<AgentContext> {
  const userId = await getOrCreateUser();
  return getUserContext(userId);
}

/** Update context (e.g., user navigated to a new repo) */
export async function setContext(partial: Partial<AgentContext>): Promise<void> {
  const userId = await getOrCreateUser();
  await setUserContext(userId, partial);
}

/** Log an action for activity tracking */
export async function logAction(action: string, details?: Record<string, unknown>): Promise<void> {
  const userId = await getOrCreateUser();
  await logActivity(userId, action, details);
}

/** Get recent activity for "what did I do today" features */
export async function getRecentActions(limit = 20): Promise<{ action: string; details: Record<string, unknown>; created_at: string }[]> {
  const userId = await getOrCreateUser();
  return getRecentActivity(userId, limit);
}

/** Build a context hint for the system prompt */
export async function getContextHint(): Promise<string> {
  const ctx = await getContext();
  const hints: string[] = [];

  if (ctx.currentRepo) {
    hints.push(`当前用户在查看仓库: ${ctx.currentRepo}`);
  }
  if (ctx.currentPrNumber) {
    hints.push(`当前用户在查看 PR #${ctx.currentPrNumber}`);
  }
  if (ctx.currentIssueNumber) {
    hints.push(`当前用户在查看 Issue #${ctx.currentIssueNumber}`);
  }

  if (hints.length === 0) return "";
  return `\n\n[上下文提示]\n${hints.join("\n")}\n请优先考虑当前上下相关的仓库和项目。`;
}
