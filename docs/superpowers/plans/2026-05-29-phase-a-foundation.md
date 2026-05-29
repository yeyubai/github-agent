# Phase A: Foundation — Supabase Integration, Architecture Cleanup, Write Tools

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform GitHub Agent from a read-only, ephemeral prototype into a persistent, write-capable application with clean architecture.

**Architecture:** Replace in-memory session Map with Supabase PostgreSQL for persistent conversation history. Remove dead LangGraph code. Unify token storage to Supabase (primary) + cookie (server-side API access). Fix Message type usage (ToolMessage instead of HumanMessage for tool results). Add write operation tools (create_issue, comment, merge_pr, etc.) so the Agent can actually do things.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL + JS client), LangChain, TypeScript, shadcn/ui

---

## File Map

### Files to CREATE:
- `src/lib/db.ts` — Supabase client (server + browser instances)
- `src/lib/tools/write-tools.ts` — 6 write operation LangChain tools
- `.env.example` — Document all required environment variables
- `supabase/migrations/001_schema.sql` — Initial database schema

### Files to MODIFY:
- `package.json` — Add `@supabase/supabase-js` dependency
- `src/lib/message-history.ts` — Rewrite: Map → Supabase CRUD
- `src/lib/agent.ts` — DELETE entirely (dead code)
- `src/app/api/chat/route.ts` — Import from new message-history, use ToolMessage
- `src/app/api/chat/confirm/route.ts` — Import from new message-history, use ToolMessage
- `src/app/api/github/token/route.ts` — Sync token to Supabase on save/delete
- `src/hooks/use-github-token.ts` — Remove localStorage token storage; keep client_id only
- `src/app/settings/page.tsx` — Update token flow to reflect new storage
- `src/lib/tools/github-tools.ts` — Add write tool imports to `allTools` array

---

### Task 1: Supabase Schema & Migration

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Write the SQL migration**

```sql
-- Phase A: Foundation schema
-- Run this in your Supabase SQL Editor

-- Users table (one per GitHub account)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (one per browser session)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Messages table (LangChain conversation messages)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'human', 'ai', 'tool')),
  content TEXT NOT NULL,
  tool_call_id TEXT,
  tool_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User configs (customizable system prompt)
CREATE TABLE IF NOT EXISTS user_configs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT '你是 GitHub Agent，一个帮助用户管理 GitHub 仓库、PR、Issue 的助手。',
  tool_description TEXT NOT NULL,
  workflow TEXT NOT NULL,
  reply_style TEXT NOT NULL DEFAULT '回复风格：简洁、专业、有帮助性。用中文回复。涉及代码时使用 Markdown 代码块。',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "Users can manage own sessions" ON sessions
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "Users can manage own messages" ON messages
  FOR ALL USING (session_id IN (SELECT id FROM sessions WHERE user_id = (SELECT id FROM users LIMIT 1)));

CREATE POLICY "Users can manage own configs" ON user_configs
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));
```

- [ ] **Step 2: Verify the migration compiles**

Run this in your Supabase SQL Editor. Expected: all tables created, indexes built, RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat: add Supabase schema for sessions, messages, users, configs"
```

---

### Task 2: Supabase Client Library

**Files:**
- Create: `src/lib/db.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Supabase dependency**

Run: `npm install @supabase/supabase-js`

Expected: package.json updated, node_modules installed.

- [ ] **Step 2: Create the Supabase client module**

```typescript
// src/lib/db.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

// Server-side client (uses service role key for full access)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: { persistSession: false },
});

// Browser-side client (uses anon key, respects RLS)
export const supabaseClient = typeof window !== "undefined"
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ===== User operations =====

export async function getOrCreateUser(): Promise<string> {
  // For now, single-user mode: return the first user or create one
  const { data: existing } = await supabaseServer
    .from("users")
    .select("id")
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: newUser, error } = await supabaseServer
    .from("users")
    .insert({})
    .select("id")
    .single();

  if (error || !newUser) throw new Error(`Failed to create user: ${error?.message}`);
  return newUser.id;
}

export async function setGitHubToken(userId: string, token: string): Promise<void> {
  await supabaseServer
    .from("users")
    .update({ github_token: token, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function removeGitHubToken(userId: string): Promise<void> {
  await supabaseServer
    .from("users")
    .update({ github_token: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

export async function getGitHubToken(userId: string): Promise<string | null> {
  const { data } = await supabaseServer
    .from("users")
    .select("github_token")
    .eq("id", userId)
    .single();
  return data?.github_token ?? null;
}

// ===== Session operations =====

export async function getOrCreateSession(clientId: string): Promise<{ id: string; userId: string }> {
  const userId = await getOrCreateUser();

  const { data: existing } = await supabaseServer
    .from("sessions")
    .select("id")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .single();

  if (existing) return { id: existing.id, userId };

  const { data: newSession, error } = await supabaseServer
    .from("sessions")
    .insert({ client_id: clientId, user_id: userId })
    .select("id")
    .single();

  if (error || !newSession) throw new Error(`Failed to create session: ${error?.message}`);
  return { id: newSession.id, userId };
}

// ===== Message operations =====

export interface DbMessage {
  role: "system" | "human" | "ai" | "tool";
  content: string;
  tool_call_id?: string;
  tool_name?: string;
}

export async function getMessages(sessionId: string): Promise<DbMessage[]> {
  const { data, error } = await supabaseServer
    .from("messages")
    .select("role, content, tool_call_id, tool_name")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data || []) as DbMessage[];
}

export async function appendMessage(sessionId: string, msg: DbMessage): Promise<void> {
  await supabaseServer
    .from("messages")
    .insert({
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      tool_call_id: msg.tool_call_id ?? null,
      tool_name: msg.tool_name ?? null,
    });
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  await supabaseServer
    .from("messages")
    .delete()
    .eq("session_id", sessionId);
}

// ===== Config operations =====

export interface UserConfig {
  role: string;
  toolDescription: string;
  workflow: string;
  replyStyle: string;
}

export async function getUserConfig(userId: string): Promise<UserConfig | null> {
  const { data } = await supabaseServer
    .from("user_configs")
    .select("role, tool_description, workflow, reply_style")
    .eq("user_id", userId)
    .single();

  if (!data) return null;
  return {
    role: data.role,
    toolDescription: data.tool_description,
    workflow: data.workflow,
    replyStyle: data.reply_style,
  };
}

export async function setUserConfig(userId: string, config: UserConfig): Promise<void> {
  await supabaseServer
    .from("user_configs")
    .upsert(
      {
        user_id: userId,
        role: config.role,
        tool_description: config.toolDescription,
        workflow: config.workflow,
        reply_style: config.replyStyle,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
}
```

- [ ] **Step 3: Add .env.example**

```bash
# .env.example
# DeepSeek AI (required for Agent chat)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Supabase (required for session persistence)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts package.json package-lock.json .env.example
git commit -m "feat: add Supabase client library and environment template"
```

---

### Task 3: Rewrite Message History to Use Supabase

**Files:**
- Modify: `src/lib/message-history.ts`
- Test: Verify by running `npx tsc --noEmit`

- [ ] **Step 1: Replace the entire file content**

```typescript
// src/lib/message-history.ts
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
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors related to message-history.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/message-history.ts
git commit -m "refactor: replace in-memory session Map with Supabase persistence"
```

---

### Task 4: Update Chat Routes to Use New Message History + Fix ToolMessage

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/chat/confirm/route.ts`

- [ ] **Step 1: Rewrite /api/chat/route.ts**

```typescript
// src/app/api/chat/route.ts
import { NextRequest } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { model } from "@/lib/langchain-model";
import { getOrCreateSessionState, appendSessionMessage, updateSessionConfig } from "@/lib/message-history";
import { allTools } from "@/lib/tools/github-tools";
import type { AgentPromptConfig } from "@/lib/prompt-config";

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

async function streamModelResponse(
  messages: unknown[],
  onChunk: (data: { content?: string; reasoning?: string }) => void
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
```

- [ ] **Step 2: Rewrite /api/chat/confirm/route.ts — key fix: use ToolMessage instead of HumanMessage**

```typescript
// src/app/api/chat/confirm/route.ts
import { NextRequest } from "next/server";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { model } from "@/lib/langchain-model";
import { getOrCreateSessionState, appendSessionMessage, updateSessionConfig } from "@/lib/message-history";
import { allTools } from "@/lib/tools/github-tools";
import type { AgentPromptConfig } from "@/lib/prompt-config";

interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

async function streamModelResponse(
  messages: unknown[],
  onChunk: (data: { content?: string; reasoning?: string }) => void
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
```

- [ ] **Step 3: Extract shared streamModelResponse to avoid duplication**

The two files above have identical `streamModelResponse` functions. After writing both, refactor by:

```typescript
// Add to src/lib/chat-stream.ts (NEW FILE)
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
```

Then update both route files to import from `@/lib/chat-stream` instead of defining locally.

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts src/app/api/chat/confirm/route.ts src/lib/chat-stream.ts
git commit -m "refactor: update chat routes for Supabase sessions + fix ToolMessage usage + extract shared stream helper"
```

---

### Task 5: Unify Token Management (Cookie + Supabase)

**Files:**
- Modify: `src/app/api/github/token/route.ts`
- Modify: `src/hooks/use-github-token.ts`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Update token API route to sync with Supabase**

```typescript
// src/app/api/github/token/route.ts
import { NextResponse } from "next/server";
import { getOrCreateUser, setGitHubToken, removeGitHubToken } from "@/lib/db";

const TOKEN_COOKIE = "gh_token";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token: string };
    if (!token?.trim()) {
      return NextResponse.json({ error: "Token 不能为空" }, { status: 400 });
    }

    // Save to Supabase
    const userId = await getOrCreateUser();
    await setGitHubToken(userId, token.trim());

    // Also set cookie for server-side API calls
    const response = NextResponse.json({ ok: true });
    response.cookies.set(TOKEN_COOKIE, token.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = await getOrCreateUser();
    await removeGitHubToken(userId);

    const response = NextResponse.json({ ok: true });
    response.cookies.delete(TOKEN_COOKIE);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const userId = await getOrCreateUser();
    const token = await getGitHubToken(userId);
    return NextResponse.json({ hasToken: !!token });
  } catch {
    return NextResponse.json({ hasToken: false });
  }
}
```

- [ ] **Step 2: Simplify the useGitHubToken hook — remove localStorage token storage**

```typescript
// src/hooks/use-github-token.ts
"use client";

import { useCallback, useEffect, useState } from "react";

const CLIENT_ID_KEY = "github-agent-client-id";

function generateClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useGitHubToken() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    let cid = localStorage.getItem(CLIENT_ID_KEY);
    if (!cid) {
      cid = generateClientId();
      localStorage.setItem(CLIENT_ID_KEY, cid);
    }
    setClientId(cid);
    setIsLoaded(true);
  }, []);

  const resetClientId = useCallback(() => {
    const newCid = generateClientId();
    localStorage.setItem(CLIENT_ID_KEY, newCid);
    setClientId(newCid);
  }, []);

  return { clientId, resetClientId, isLoaded };
}
```

- [ ] **Step 3: Update Settings page to use new hook**

Modify `src/app/settings/page.tsx`:
- Replace `useGitHubToken` import: `const { clientId, resetClientId, isLoaded } = useGitHubToken();`
- Remove `savedToken` references (token is now opaque — we just know if it exists)
- The token input flow stays the same (user pastes token, clicks save, it goes to Supabase + cookie)
- Replace the "Token 已保存" display: check `GET /api/github/token` to know if a token exists

Key change in the settings page token section — the `useEffect` that echoes back the masked token should be replaced with a simple `hasToken` state:

```typescript
// In SettingsPage, replace lines 75-87 with:
const [hasToken, setHasToken] = useState(false);

useEffect(() => {
  fetch("/api/github/token")
    .then((r) => r.json())
    .then((data) => setHasToken(data.hasToken ?? false))
    .catch(() => setHasToken(false));
}, []);
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/github/token/route.ts src/hooks/use-github-token.ts src/app/settings/page.tsx
git commit -m "refactor: unify token management to Supabase + cookie, remove localStorage duplication"
```

---

### Task 6: Delete LangGraph Dead Code

**Files:**
- Modify: `src/lib/agent.ts` (DELETE)
- Modify: `package.json`

- [ ] **Step 1: Delete the file**

Run: `rm src/lib/agent.ts`

- [ ] **Step 2: Remove @langchain/langgraph dependency**

Run: `npm uninstall @langchain/langgraph`

Expected: package.json updated, dependency removed.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors (no remaining references to agent.ts)

- [ ] **Step 4: Commit**

```bash
git add src/lib/agent.ts package.json package-lock.json
git commit -m "chore: remove unused LangGraph agent dead code and dependency"
```

---

### Task 7: Add Write Operation Tools

**Files:**
- Create: `src/lib/tools/write-tools.ts`
- Modify: `src/lib/github.ts`
- Modify: `src/lib/tools/github-tools.ts`
- Modify: `src/lib/prompt-config.ts`

- [ ] **Step 1: Add write functions to github.ts**

Add these functions to the END of `src/lib/github.ts` (before the last export):

```typescript
// ==================== Write Operations ====================

/** Create an Issue — REST API only (no gh CLI fallback needed) */
export async function createIssue(token: string | null, repo: string, title: string, body?: string, labels?: string[]): Promise<{ number: number; url: string }> {
  if (!hasToken(token)) throw new Error("GitHub token required for creating issues");
  const [owner, name] = repo.split("/");
  const payload: Record<string, unknown> = { title };
  if (body) payload.body = body;
  if (labels?.length) payload.labels = labels;

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${name}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}

/** Comment on an Issue */
export async function commentOnIssue(token: string | null, repo: string, issueNumber: number, body: string): Promise<{ url: string }> {
  if (!hasToken(token)) throw new Error("GitHub token required for commenting");
  const [owner, name] = repo.split("/");

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${name}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { html_url: string };
  return { url: data.html_url };
}

/** Comment on a PR (same GitHub API endpoint as issue comments) */
export async function commentOnPR(token: string | null, repo: string, prNumber: number, body: string): Promise<{ url: string }> {
  return commentOnIssue(token, repo, prNumber, body);
}

/** Update Issue state/labels */
export async function updateIssue(token: string | null, repo: string, issueNumber: number, state?: "open" | "closed", labels?: string[], assignees?: string[]): Promise<{ url: string }> {
  if (!hasToken(token)) throw new Error("GitHub token required for updating issues");
  const [owner, name] = repo.split("/");
  const payload: Record<string, unknown> = {};
  if (state) payload.state = state;
  if (labels) payload.labels = labels;
  if (assignees) payload.assignees = assignees;

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${name}/issues/${issueNumber}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { html_url: string };
  return { url: data.html_url };
}

/** Merge a PR */
export async function mergePR(token: string | null, repo: string, prNumber: number, mergeMethod: "merge" | "squash" | "rebase" = "merge"): Promise<{ sha: string }> {
  if (!hasToken(token)) throw new Error("GitHub token required for merging PRs");
  const [owner, name] = repo.split("/");

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${name}/pulls/${prNumber}/merge`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ merge_method: mergeMethod }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { sha: string };
  return { sha: data.sha };
}

/** Close a PR (same as update issue with state=closed) */
export async function closePR(token: string | null, repo: string, prNumber: number): Promise<{ url: string }> {
  return updateIssue(token, repo, prNumber, "closed");
}
```

- [ ] **Step 2: Create write-tools.ts**

```typescript
// src/lib/tools/write-tools.ts
// Write operation LangChain tools — each wraps a function from github.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  createIssue,
  commentOnIssue,
  commentOnPR,
  updateIssue,
  mergePR,
  closePR,
  getGitHubToken,
} from "../github";

export const createIssueTool = tool(
  async ({ repo, title, body, labels }) => {
    const token = await getGitHubToken();
    const result = await createIssue(token, repo, title, body || undefined, labels || undefined);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "create_issue",
    description: "在指定仓库创建一个新的 Issue。需要提供仓库、标题，可选描述和标签。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      title: z.string().describe("Issue 标题"),
      body: z.string().optional().describe("Issue 详细描述（支持 Markdown）"),
      labels: z.array(z.string()).optional().describe("Issue 标签列表，如 ['bug', 'enhancement']"),
    }),
  }
);

export const commentOnIssueTool = tool(
  async ({ repo, issueNumber, body }) => {
    const token = await getGitHubToken();
    const result = await commentOnIssue(token, repo, issueNumber, body);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "comment_on_issue",
    description: "在指定 Issue 下发表评论。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      issueNumber: z.number().describe("Issue 编号"),
      body: z.string().describe("评论内容（支持 Markdown）"),
    }),
  }
);

export const commentOnPRTool = tool(
  async ({ repo, prNumber, body }) => {
    const token = await getGitHubToken();
    const result = await commentOnPR(token, repo, prNumber, body);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "comment_on_pr",
    description: "在指定 PR 下发表评论。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
      body: z.string().describe("评论内容（支持 Markdown）"),
    }),
  }
);

export const updateIssueTool = tool(
  async ({ repo, issueNumber, state, labels, assignees }) => {
    const token = await getGitHubToken();
    const result = await updateIssue(token, repo, issueNumber, state, labels, assignees);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "update_issue",
    description: "更新 Issue 的状态、标签或指派人。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      issueNumber: z.number().describe("Issue 编号"),
      state: z.enum(["open", "closed"]).optional().describe("Issue 状态"),
      labels: z.array(z.string()).optional().describe("新的标签列表"),
      assignees: z.array(z.string()).optional().describe("指派人 GitHub 用户名列表"),
    }),
  }
);

export const mergePRTool = tool(
  async ({ repo, prNumber, mergeMethod }) => {
    const token = await getGitHubToken();
    const result = await mergePR(token, repo, prNumber, mergeMethod);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "merge_pr",
    description: "合并指定的 Pull Request。破坏性操作，需用户确认。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
      mergeMethod: z.enum(["merge", "squash", "rebase"]).default("merge").describe("合并方式"),
    }),
  }
);

export const closePRTool = tool(
  async ({ repo, prNumber }) => {
    const token = await getGitHubToken();
    const result = await closePR(token, repo, prNumber);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "close_pr",
    description: "关闭指定的 Pull Request（不合并）。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
    }),
  }
);

export const allWriteTools = [
  createIssueTool,
  commentOnIssueTool,
  commentOnPRTool,
  updateIssueTool,
  mergePRTool,
  closePRTool,
];
```

- [ ] **Step 3: Update github-tools.ts to include write tools**

Modify the `allTools` array at the bottom of `src/lib/tools/github-tools.ts`:

```typescript
// Replace the existing allTools export:
import { allWriteTools } from "./write-tools";

export const allTools = [
  listReposTool,
  searchReposTool,
  listPRsTool,
  listIssuesTool,
  viewRepoTool,
  viewPRTool,
  viewIssueTool,
  searchCodeTool,
  runGhTool,
  ...allWriteTools,
];
```

- [ ] **Step 4: Update prompt-config.ts to include write tools in default description**

Modify `DEFAULT_PROMPT.toolDescription` in `src/lib/prompt-config.ts` to add:

```
- create_issue: 在指定仓库创建 Issue
- comment_on_issue: 在 Issue 下评论
- comment_on_pr: 在 PR 下评论
- update_issue: 更新 Issue 状态/标签/指派人
- merge_pr: 合并 PR (merge/squash/rebase)
- close_pr: 关闭 PR (不合并)
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/github.ts src/lib/tools/write-tools.ts src/lib/tools/github-tools.ts src/lib/prompt-config.ts
git commit -m "feat: add 6 write operation tools (create_issue, comment, update, merge, close)"
```

---

### Task 8: run_gh Whitelist (Security Fix)

**Files:**
- Modify: `src/lib/tools/github-tools.ts`

- [ ] **Step 1: Add allowlist to runGhTool**

```typescript
// In src/lib/tools/github-tools.ts, modify the runGhTool definition:

// Allowed gh command prefixes (read-safe + controlled write)
const ALLOWED_GH_PREFIXES = [
  "repo view",
  "repo list",
  "pr view",
  "pr list",
  "pr diff",
  "pr checks",
  "pr status",
  "issue view",
  "issue list",
  "issue labels",
  "search",
  "api repos",
  "api users",
  "api orgs",
  "api repos",
  "api search",
];

const DANGEROUS_PATTERNS = ["repo delete", "repo rename", "auth", "alias set", "config set"];

function isGhCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();

  // Block dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (trimmed.startsWith(pattern)) {
      return { allowed: false, reason: `命令 "${pattern}" 不在允许范围内` };
    }
  }

  // Check allowlist
  for (const prefix of ALLOWED_GH_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: `命令不在允许列表中。可用命令: ${ALLOWED_GH_PREFIXES.join(", ")}` };
}

export const runGhTool = tool(
  async ({ command }) => {
    const check = isGhCommandAllowed(command);
    if (!check.allowed) {
      return `命令被拒绝: ${check.reason}`;
    }
    const result = await runGhRaw(command);
    return result;
  },
  {
    name: "run_gh",
    description: "执行 gh CLI 命令（仅限安全命令）。当其他专用工具无法满足需求时使用。",
    schema: z.object({
      command: z.string().describe("完整的 gh 命令（不包含 gh 前缀），如 repo view owner/repo"),
    }),
  }
);
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/tools/github-tools.ts
git commit -m "security: add allowlist validation to run_gh tool"
```

---

### Task 9: Integration Verification

**Files:** All modified files

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Dev server smoke test**

Run: `npm run dev` (in background)
- Open http://localhost:3000
- Verify homepage loads
- Verify Settings page loads
- Verify chat panel is visible
- Stop dev server

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: Phase A integration verification — all checks pass"
```

---

## Summary of Changes

| Task | Files Created | Files Modified | Files Deleted |
|------|--------------|----------------|---------------|
| 1. Supabase Schema | `supabase/migrations/001_schema.sql` | — | — |
| 2. Supabase Client | `src/lib/db.ts`, `.env.example` | `package.json` | — |
| 3. Message History | — | `src/lib/message-history.ts` | — |
| 4. Chat Routes | `src/lib/chat-stream.ts` | `src/app/api/chat/route.ts`, `src/app/api/chat/confirm/route.ts` | — |
| 5. Token Unification | — | `src/app/api/github/token/route.ts`, `src/hooks/use-github-token.ts`, `src/app/settings/page.tsx` | — |
| 6. Dead Code | — | `package.json` | `src/lib/agent.ts` |
| 7. Write Tools | `src/lib/tools/write-tools.ts` | `src/lib/github.ts`, `src/lib/tools/github-tools.ts`, `src/lib/prompt-config.ts` | — |
| 8. run_gh Whitelist | — | `src/lib/tools/github-tools.ts` | — |
| 9. Verification | — | (all) | — |

**Total: 4 new files, 8 modified files, 1 deleted file**
