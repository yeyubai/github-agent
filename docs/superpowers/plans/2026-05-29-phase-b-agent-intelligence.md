# Phase B: Agent Intelligence — Multi-Step Planning, Context Awareness, Auto-Loop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Agent from a single-turn tool caller to a multi-step planner that can auto-execute sequences, remember context, and work autonomously.

**Architecture:** Add a planner module that parses complex user requests into multi-step plans. Add context awareness by tracking which repo/PR/Issue the user is currently viewing. Replace manual confirm-each-tool with a batch-confirm mode for safe read operations. Store conversation context in Supabase.

**Tech Stack:** Next.js 16 (App Router), Supabase, LangChain, TypeScript, shadcn/ui

---

## File Map

### Files to CREATE:
- `src/lib/planner.ts` — Intent parser + multi-step plan generator
- `src/lib/context-store.ts` — Context awareness (current repo, PR, preferences)
- `src/app/api/chat/execute/route.ts` — Batch tool execution endpoint
- `src/components/chat/plan-viewer.tsx` — UI for displaying multi-step plans

### Files to MODIFY:
- `src/lib/db.ts` — Add context table CRUD
- `supabase/migrations/002_context.sql` — Context awareness schema
- `src/app/api/chat/route.ts` — Integrate planner for complex requests
- `src/components/chat/chat-panel.tsx` — Add plan display + batch confirm UI
- `src/lib/prompt-config.ts` — Update default prompt with planning instructions
- `src/lib/tools/github-tools.ts` — Expand `run_gh` allowlist with write-safe commands

---

### Task 1: Context Awareness Schema

**Files:**
- Create: `supabase/migrations/002_context.sql`

- [ ] **Step 1: Write the SQL migration**

```sql
-- Phase B: Context awareness schema

-- User context (current repo, preferences, etc.)
CREATE TABLE IF NOT EXISTS user_context (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_repo TEXT,              -- e.g., "owner/repo" user is viewing
  current_pr_number INTEGER,       -- PR number if viewing a PR
  current_issue_number INTEGER,    -- Issue number if viewing an issue
  preferences JSONB DEFAULT '{}',  -- user preferences (e.g., default_limit, preferred_merge_method)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log (for analytics and "what did I do today" features)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,            -- e.g., "viewed_repo", "created_issue", "merged_pr"
  details JSONB,                   -- action-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

-- Enable RLS
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own context" ON user_context
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "Users can view own activity" ON activity_log
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));
```

- [ ] **Step 2: Verify the migration in Supabase SQL Editor**

Expected: tables created, indexes built, RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_context.sql
git commit -m "feat: add context awareness schema (user_context + activity_log)"
```

---

### Task 2: Context Store Module

**Files:**
- Create: `src/lib/context-store.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add context CRUD to db.ts**

Add to the END of `src/lib/db.ts`:

```typescript
// ===== Context operations =====

export interface UserContext {
  currentRepo: string | null;
  currentPrNumber: number | null;
  currentIssueNumber: number | null;
  preferences: Record<string, unknown>;
}

export async function getUserContext(userId: string): Promise<UserContext> {
  const { data } = await getSupabaseServer()
    .from("user_context")
    .select("current_repo, current_pr_number, current_issue_number, preferences")
    .eq("user_id", userId)
    .single();

  if (!data) {
    return { currentRepo: null, currentPrNumber: null, currentIssueNumber: null, preferences: {} };
  }

  return {
    currentRepo: data.current_repo ?? null,
    currentPrNumber: data.current_pr_number ?? null,
    currentIssueNumber: data.current_issue_number ?? null,
    preferences: (data.preferences as Record<string, unknown>) ?? {},
  };
}

export async function setUserContext(userId: string, context: Partial<UserContext>): Promise<void> {
  const existing = await getUserContext(userId);
  const merged = { ...existing, ...context };

  await getSupabaseServer()
    .from("user_context")
    .upsert(
      {
        user_id: userId,
        current_repo: merged.currentRepo,
        current_pr_number: merged.currentPrNumber,
        current_issue_number: merged.currentIssueNumber,
        preferences: merged.preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
}

export async function logActivity(userId: string, action: string, details?: Record<string, unknown>): Promise<void> {
  await getSupabaseServer()
    .from("activity_log")
    .insert({
      user_id: userId,
      action,
      details: details ?? {},
    });
}

export async function getRecentActivity(userId: string, limit = 20): Promise<{ action: string; details: Record<string, unknown>; created_at: string }[]> {
  const { data, error } = await getSupabaseServer()
    .from("activity_log")
    .select("action, details, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load activity: ${error.message}`);
  return (data || []) as { action: string; details: Record<string, unknown>; created_at: string }[];
}
```

- [ ] **Step 2: Create the context store module**

```typescript
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
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts src/lib/context-store.ts
git commit -m "feat: add context awareness module (current repo/PR/Issue tracking + activity log)"
```

---

### Task 3: Planner Module — Intent Parser + Multi-Step Plans

**Files:**
- Create: `src/lib/planner.ts`

- [ ] **Step 1: Create the planner module**

```typescript
// src/lib/planner.ts
// Intent parser and multi-step plan generator for complex user requests
import { allTools } from "./tools/github-tools";
import { model } from "./langchain-model";
import { z } from "zod";

const PlanStep = z.object({
  toolName: z.string().describe("Tool to execute"),
  toolArgs: z.record(z.unknown()).describe("Arguments for the tool"),
  description: z.string().describe("Human-readable description of this step"),
  dependsOn: z.array(z.number()).default([]).describe("Step indices this step depends on (0-based)"),
});

const MultiStepPlan = z.object({
  summary: z.string().describe("Brief summary of what the plan accomplishes"),
  steps: z.array(PlanStep).describe("Ordered list of steps to execute"),
  autoExecute: z.boolean().describe("Whether this plan is safe to auto-execute (all read-only steps)"),
});

export type PlanStepType = z.infer<typeof PlanStep>;
export type MultiStepPlanType = z.infer<typeof MultiStepPlan>;

/**
 * Parse a user request into a multi-step plan using the LLM
 * Returns a structured plan or null if the request is simple enough for direct tool calling
 */
export async function parseIntent(userMessage: string): Promise<MultiStepPlanType | null> {
  // Simple heuristic: if the message is short and direct, skip planning
  if (userMessage.length < 30 && !userMessage.includes("和") && !userMessage.includes("然后") && !userMessage.includes("再")) {
    return null;
  }

  const toolDescriptions = allTools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const systemPrompt = `你是一个 GitHub 操作计划生成器。用户的请求可能涉及多个步骤。你的任务是：

1. 分析用户请求，判断是否需要多个工具调用来完成
2. 如果需要，生成一个有序的多步执行计划
3. 标记该计划是否可以安全地自动执行（所有步骤都是只读操作 = 可以自动执行）

可用工具：
${toolDescriptions}

重要规则：
- 如果用户请求只需要一个工具，返回 null（让系统直接调用）
- 如果请求涉及多个步骤，按依赖关系排序
- 写操作（create_issue, comment_on_*, update_issue, merge_pr, close_pr）标记 autoExecute=false
- 读操作（list_*, search_*, view_*, get_*）标记 autoExecute=true
- 混合操作（先读后写）标记 autoExecute=false
- 每个步骤必须明确指定 toolName 和 toolArgs`;

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: `用户请求：${userMessage}\n\n请生成执行计划（JSON 格式），如果不需要多步计划则返回 null。` },
  ]);

  const content = typeof response.content === "string" ? response.content : "";

  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const result = MultiStepPlan.safeParse(parsed);
    if (!result.success || !result.data.steps.length) return null;
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Execute a multi-step plan sequentially, collecting results
 */
export async function executePlan(
  plan: MultiStepPlanType,
  executeTool: (toolName: string, args: Record<string, unknown>) => Promise<string>
): Promise<{ stepIndex: number; result: string; success: boolean }[]> {
  const results: { stepIndex: number; result: string; success: boolean }[] = [];
  const stepOutputs = new Map<number, string>();

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];

    // Check dependencies
    const depsMet = step.dependsOn.every((depIdx) => stepOutputs.has(depIdx));
    if (!depsMet) {
      results.push({ stepIndex: i, result: "依赖的步骤尚未完成，跳过", success: false });
      continue;
    }

    try {
      const result = await executeTool(step.toolName, step.toolArgs);
      stepOutputs.set(i, result);
      results.push({ stepIndex: i, result, success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "执行失败";
      results.push({ stepIndex: i, result: message, success: false });
      // Stop execution on failure
      break;
    }
  }

  return results;
}

/**
 * Check if a plan contains only read-only (safe) tools
 */
export function isPlanReadOnly(plan: MultiStepPlanType): boolean {
  const readOnlyTools = new Set([
    "list_repos", "search_repos", "list_prs", "list_issues",
    "view_repo", "view_pr", "view_issue", "search_code", "run_gh",
  ]);
  return plan.steps.every((step) => readOnlyTools.has(step.toolName));
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/planner.ts
git commit -m "feat: add planner module for multi-step intent parsing and execution"
```

---

### Task 4: Batch Execute API Endpoint

**Files:**
- Create: `src/app/api/chat/execute/route.ts`

- [ ] **Step 1: Create the execute endpoint**

```typescript
// src/app/api/chat/execute/route.ts
// Batch tool execution for multi-step plans
import { NextRequest } from "next/server";
import { ToolMessage, HumanMessage } from "@langchain/core/messages";
import { model } from "@/lib/langchain-model";
import { getOrCreateSessionState, appendSessionMessage, updateSessionConfig, getOrCreateSession } from "@/lib/message-history";
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
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/execute/route.ts
git commit -m "feat: add batch tool execution API endpoint for multi-step plans"
```

---

### Task 5: Plan Viewer UI Component

**Files:**
- Create: `src/components/chat/plan-viewer.tsx`
- Modify: `src/components/chat/chat-panel.tsx`

- [ ] **Step 1: Create the plan viewer component**

```typescript
// src/components/chat/plan-viewer.tsx
// Displays a multi-step plan with approve/reject controls
"use client";

import { Check, X, ChevronDown, ChevronUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MultiStepPlanType } from "@/lib/planner";

interface PlanViewerProps {
  plan: MultiStepPlanType;
  onApprove: () => void;
  onReject: () => void;
  status: "pending" | "approved" | "rejected";
}

export function PlanViewer({ plan, onApprove, onReject, status }: PlanViewerProps) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
         执行计划 ({plan.steps.length} 步)
        {!plan.autoExecute && (
          <span className="ml-2 text-orange-500">⚠ 包含写操作</span>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded">
        {plan.summary}
      </div>

      <div className="space-y-1">
        {plan.steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 text-xs px-2 py-1.5 rounded font-mono",
              "bg-background/30 border-l-2",
              step.toolName.includes("create") || step.toolName.includes("merge") || step.toolName.includes("close") || step.toolName.includes("comment") || step.toolName.includes("update")
                ? "border-orange-400"
                : "border-green-400"
            )}
          >
            <span className="text-muted-foreground shrink-0">{i + 1}.</span>
            <div className="min-w-0">
              <div className="text-muted-foreground">{step.toolName}</div>
              <div className="text-foreground">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      {status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs" onClick={onApprove}>
            <Play className="h-3 w-3 mr-1" />
            执行计划
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReject}>
            <X className="h-3 w-3 mr-1" />
            取消
          </Button>
        </div>
      )}

      {status === "approved" && (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <Check className="h-3 w-3" />
          计划已批准，正在执行...
        </div>
      )}

      {status === "rejected" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground line-through opacity-60">
          <X className="h-3 w-3" />
          计划已取消
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update chat-panel.tsx to handle plans**

In `src/components/chat/chat-panel.tsx`, add plan handling:

1. Add PlanViewer import:
```typescript
import { PlanViewer } from "./plan-viewer";
```

2. Extend the Message interface:
```typescript
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDone?: boolean;
  toolCall?: ToolCall;
  commandStatus?: "pending" | "executing" | "done" | "cancelled";
  plan?: MultiStepPlanType;        // NEW
  planStatus?: "pending" | "approved" | "rejected";  // NEW
}
```

3. In the `processStream` function, add plan detection:
```typescript
// In processStream, after parsing tool_call, also check for plan:
if (parsed.plan) {
  assistantPlan = parsed.plan;
}
```

4. In the message rendering section, add plan display after tool call section:
```typescript
{/* 多步计划展示 */}
{msg.plan && (
  <PlanViewer
    plan={msg.plan}
    onApprove={() => handleApprovePlan(msg.id)}
    onReject={() => handleRejectPlan(msg.id)}
    status={msg.planStatus || "pending"}
  />
)}
```

5. Add plan handlers:
```typescript
const handleApprovePlan = async (msgId: string) => {
  const msg = messages.find((m) => m.id === msgId);
  if (!msg?.plan) return;

  setMessages((prev) =>
    prev.map((m) =>
      m.id === msgId ? { ...m, planStatus: "approved" as const } : m
    )
  );

  setLoading(true);
  try {
    const promptConfig = getSavedPromptConfig();
    const res = await fetch("/api/chat/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        plan: msg.plan,
        promptConfig,
      }),
    });

    if (!res.ok) throw new Error("请求失败");

    const resultAssistantId = (Date.now() + 3).toString();
    setMessages((prev) => [
      ...prev,
      { id: resultAssistantId, role: "assistant", content: "" },
    ]);

    // Reuse processStream to display the model's analysis
    await processStream(res, resultAssistantId);
  } catch {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, content: "计划执行失败，请重试。", planStatus: "rejected" as const }
          : m
      )
    );
  } finally {
    setLoading(false);
  }
};

const handleRejectPlan = (msgId: string) => {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === msgId
        ? { ...m, content: "已取消执行。", planStatus: "rejected" as const }
        : m
    )
  );
};
```

- [ ] **Step 3: Update /api/chat/route.ts to integrate planner**

At the top of `src/app/api/chat/route.ts`, add:
```typescript
import { parseIntent } from "@/lib/planner";
```

In the POST handler, before streaming the model response, add:
```typescript
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
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/plan-viewer.tsx src/components/chat/chat-panel.tsx src/app/api/chat/route.ts
git commit -m "feat: add multi-step plan UI with approve/reject flow"
```

---

### Task 6: Context-Aware System Prompt

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/prompt-config.ts`

- [ ] **Step 1: Inject context hint into the chat route**

In `src/app/api/chat/route.ts`, modify the `getOrCreateSessionState` call:

```typescript
import { getContextHint } from "@/lib/context-store";

// Inside POST handler, before calling streamModelResponse:
const contextHint = await getContextHint();
if (contextHint) {
  // Append context hint to the user's message
  const enhancedMessage = new HumanMessage(message + contextHint);
  await appendSessionMessage(sessionId, enhancedMessage);
} else {
  await appendSessionMessage(sessionId, userMessage);
}
```

- [ ] **Step 2: Update the default prompt with planning instructions**

In `src/lib/prompt-config.ts`, update `DEFAULT_PROMPT.workflow`:

```typescript
workflow: `当用户提出需求时：
1. 分析用户意图
2. 对于简单请求（单个操作），直接调用合适的工具
3. 对于复杂请求（多个操作），系统会自动生成多步执行计划，等待用户确认
4. 等待工具执行结果后，分析并回复用户
5. 注意当前用户的上下文（正在查看的仓库/PR/Issue），优先使用相关信息
6. 执行写操作前确保用户已确认`,
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts src/lib/prompt-config.ts
git commit -m "feat: add context-aware system prompt injection"
```

---

### Task 7: Auto-Track Context from Page Navigation

**Files:**
- Modify: `src/app/repos/[...slug]/page.tsx`
- Modify: `src/app/prs/page.tsx` (if PR detail exists)
- Modify: `src/app/issues/page.tsx` (if Issue detail exists)

- [ ] **Step 1: Add context tracking to repo detail page**

In `src/app/repos/[...slug]/page.tsx`, add a useEffect to update context:

```typescript
import { useEffect } from "react";

// Inside the component, after params parsing:
const fullName = slug.join("/");

useEffect(() => {
  fetch("/api/chat/context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentRepo: fullName }),
  }).catch(() => {});
}, [fullName]);
```

- [ ] **Step 2: Create the context API endpoint**

```typescript
// src/app/api/chat/context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, setUserContext, getUserContext, logActivity } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = await getOrCreateUser();

    const updates: Record<string, unknown> = {};
    if (body.currentRepo !== undefined) updates.current_repo = body.currentRepo;
    if (body.currentPrNumber !== undefined) updates.current_pr_number = body.currentPrNumber;
    if (body.currentIssueNumber !== undefined) updates.current_issue_number = body.currentIssueNumber;

    if (Object.keys(updates).length > 0) {
      await setUserContext(userId, updates as any);
      await logActivity(userId, "context_update", updates);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const userId = await getOrCreateUser();
    const context = await getUserContext(userId);
    return NextResponse.json(context);
  } catch {
    return NextResponse.json({ currentRepo: null, currentPrNumber: null, currentIssueNumber: null, preferences: {} });
  }
}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/context/route.ts src/app/repos/\[...slug\]/page.tsx
git commit -m "feat: auto-track context from page navigation"
```

---

### Task 8: Integration Verification

**Files:** All modified files

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: Phase B integration verification — all checks pass"
```

---

## Summary of Changes

| Task | Files Created | Files Modified |
|------|--------------|----------------|
| 1. Context Schema | `supabase/migrations/002_context.sql` | — |
| 2. Context Store | `src/lib/context-store.ts` | `src/lib/db.ts` |
| 3. Planner Module | `src/lib/planner.ts` | — |
| 4. Execute Endpoint | `src/app/api/chat/execute/route.ts` | — |
| 5. Plan UI | `src/components/chat/plan-viewer.tsx` | `src/components/chat/chat-panel.tsx`, `src/app/api/chat/route.ts` |
| 6. Context Prompt | — | `src/app/api/chat/route.ts`, `src/lib/prompt-config.ts` |
| 7. Context Tracking | `src/app/api/chat/context/route.ts` | `src/app/repos/[...slug]/page.tsx` |
| 8. Verification | — | (all) |

**Total: 6 new files, 6 modified files**
