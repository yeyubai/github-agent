# Phase C: Killer Features — Weekly Reports, Code Summaries, Todo Extraction, Cross-Repo Aggregation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four killer features that give users a reason to use this product over GitHub.com: auto-generated weekly/daily reports, intelligent code change summaries, automatic todo extraction from issues/PRs, and cross-repo global views.

**Architecture:** Create specialized aggregation tools that combine data from multiple GitHub API endpoints, then feed the aggregated data to the LLM for intelligent summarization. Add a "quick actions" UI for one-click access to these features. Store generated reports in Supabase for history.

**Tech Stack:** Next.js 16 (App Router), Supabase, LangChain, TypeScript, shadcn/ui

---

## File Map

### Files to CREATE:
- `src/lib/tools/aggregation-tools.ts` — Cross-repo aggregation LangChain tools
- `src/lib/tools/report-tools.ts` — Report generation LangChain tools
- `src/components/chat/quick-actions.tsx` — One-click action buttons
- `src/app/api/github/activity/route.ts` — Unified activity API endpoint
- `supabase/migrations/003_reports.sql` — Reports storage schema

### Files to MODIFY:
- `src/lib/github.ts` — Add cross-repo aggregation functions
- `src/lib/tools/github-tools.ts` — Import aggregation + report tools into `allTools`
- `src/components/chat/chat-panel.tsx` — Add quick actions bar
- `src/components/layout/app-shell.tsx` — Integrate quick actions into chat panel
- `src/lib/db.ts` — Add reports table CRUD
- `src/app/page.tsx` — Add quick action buttons to homepage

---

### Task 1: Reports Storage Schema

**Files:**
- Create: `supabase/migrations/003_reports.sql`

- [ ] **Step 1: Write the SQL migration**

```sql
-- Phase C: Reports and generated content storage

-- Generated reports (weekly/daily reports, summaries)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'code_summary', 'todo')),
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',  -- date range, repos covered, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_type ON reports(user_id, type);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reports" ON reports
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));
```

- [ ] **Step 2: Verify in Supabase SQL Editor**

Expected: table created, indexes built, RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_reports.sql
git commit -m "feat: add reports storage schema"
```

---

### Task 2: Cross-Repo Aggregation Functions

**Files:**
- Modify: `src/lib/github.ts`
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Add cross-repo aggregation functions to github.ts**

Add to the END of `src/lib/github.ts`:

```typescript
// ==================== Cross-Repo Aggregation ====================

/** Get all open PRs across all user's repos */
export async function getAllOpenPRs(token: string | null): Promise<{
  repo: string;
  number: number;
  title: string;
  state: string;
  author: { login: string };
  createdAt: string;
  url: string;
  labels: { name: string }[];
}[]> {
  if (!hasToken(token)) {
    // Fallback: use gh CLI to list all repos, then query each
    const reposRaw = await ghCommand("repo list --limit 100 --json nameWithOwner");
    const repos = JSON.parse(reposRaw) as { nameWithOwner: string }[];

    const allPRs: any[] = [];
    for (const repo of repos.slice(0, 20)) {  // Limit to 20 repos for performance
      try {
        const prs = await listPRs(token, repo.nameWithOwner, "open", 10);
        allPRs.push(...prs.map((p: any) => ({ ...p, repo: repo.nameWithOwner })));
      } catch {
        // Skip repos we can't access
      }
    }
    return allPRs;
  }

  // REST API: search for all open PRs by the user
  const raw = await githubFetch(
    `/search/issues?q=author:@me+type:pr+state:open&per_page=100`,
    token
  ) as { items: {
    repository_url: string;
    number: number;
    title: string;
    state: string;
    user: { login: string };
    created_at: string;
    html_url: string;
    labels: { name: string }[];
  }[] };

  return raw.items.map(r => ({
    repo: r.repository_url.split("/").slice(-2).join("/"),
    number: r.number,
    title: r.title,
    state: r.state,
    author: { login: r.user.login },
    createdAt: r.created_at,
    url: r.html_url,
    labels: r.labels || [],
  }));
}

/** Get all open Issues assigned to the user across all repos */
export async function getAssignedIssues(token: string | null): Promise<{
  repo: string;
  number: number;
  title: string;
  state: string;
  createdAt: string;
  url: string;
  labels: { name: string; color: string }[];
}[]> {
  if (!hasToken(token)) throw new Error("GitHub token required");

  const raw = await githubFetch(
    `/search/issues?q=assignee:@me+type:issue+state:open&per_page=100`,
    token
  ) as { items: {
    repository_url: string;
    number: number;
    title: string;
    state: string;
    created_at: string;
    html_url: string;
    labels: { name: string; color: string }[];
  }[] };

  return raw.items.map(r => ({
    repo: r.repository_url.split("/").slice(-2).join("/"),
    number: r.number,
    title: r.title,
    state: r.state,
    createdAt: r.created_at,
    url: r.html_url,
    labels: r.labels || [],
  }));
}

/** Get PRs that need the user's review */
export async function getReviewRequests(token: string | null): Promise<{
  repo: string;
  number: number;
  title: string;
  author: string;
  createdAt: string;
  url: string;
}[]> {
  if (!hasToken(token)) throw new Error("GitHub token required");

  const raw = await githubFetch(
    `/search/issues?q=review-requested:@me+type:pr+state:open&per_page=50`,
    token
  ) as { items: {
    repository_url: string;
    number: number;
    title: string;
    user: { login: string };
    created_at: string;
    html_url: string;
  }[] };

  return raw.items.map(r => ({
    repo: r.repository_url.split("/").slice(-2).join("/"),
    number: r.number,
    title: r.title,
    author: r.user.login,
    createdAt: r.created_at,
    url: r.html_url,
  }));
}

/** Get user's activity in a date range (commits, PRs, Issues) */
export async function getUserActivity(token: string | null, since: string, until: string): Promise<{
  commits: { repo: string; message: string; date: string; sha: string }[];
  prs: { repo: string; number: number; title: string; state: string; url: string }[];
  issues: { repo: string; number: number; title: string; state: string; url: string }[];
}> {
  if (!hasToken(token)) throw new Error("GitHub token required");

  // Get commits: search for user's commits in date range
  const reposRaw = await githubFetch(`/user/repos?per_page=100&type=owner`, token) as { full_name: string }[];
  const repoNames = reposRaw.map(r => r.full_name);

  const commits: { repo: string; message: string; date: string; sha: string }[] = [];

  // Query commits from each repo (limit to top 10 by activity)
  for (const repo of repoNames.slice(0, 10)) {
    try {
      const raw = await githubFetch(
        `/repos/${repo}/commits?since=${since}&until=${until}&per_page=30`,
        token
      ) as { sha: string; commit: { message: string; author: { date: string } }; author: { login: string } | null }[];

      commits.push(
        ...raw
          .filter(c => c.author?.login === (await getGitHubLogin(token!)))
          .map(c => ({
            repo,
            message: c.commit.message.split("\n")[0],  // First line only
            date: c.commit.author.date,
            sha: c.sha,
          }))
      );
    } catch {
      // Skip repos we can't access
    }
  }

  // Get PRs created in date range
  const prsRaw = await githubFetch(
    `/search/issues?q=author:@me+type:pr+created:${since}..${until}&per_page=50`,
    token
  ) as { items: {
    repository_url: string;
    number: number;
    title: string;
    state: string;
    html_url: string;
  }[] };

  const prs = prsRaw.items.map(r => ({
    repo: r.repository_url.split("/").slice(-2).join("/"),
    number: r.number,
    title: r.title,
    state: r.state,
    url: r.html_url,
  }));

  // Get Issues created in date range
  const issuesRaw = await githubFetch(
    `/search/issues?q=author:@me+type:issue+created:${since}..${until}&per_page=50`,
    token
  ) as { items: {
    repository_url: string;
    number: number;
    title: string;
    state: string;
    html_url: string;
  }[] };

  const issues = issuesRaw.items.map(r => ({
    repo: r.repository_url.split("/").slice(-2).join("/"),
    number: r.number,
    title: r.title,
    state: r.state,
    url: r.html_url,
  }));

  return { commits, prs, issues };
}

/** Helper: get current GitHub login */
async function getGitHubLogin(token: string): Promise<string> {
  const raw = await githubFetch("/user", token) as { login: string };
  return raw.login;
}
```

- [ ] **Step 2: Add reports CRUD to db.ts**

Add to the END of `src/lib/db.ts`:

```typescript
// ===== Reports operations =====

export async function saveReport(userId: string, type: string, content: string, title?: string, metadata?: Record<string, unknown>): Promise<string> {
  const { data, error } = await getSupabaseServer()
    .from("reports")
    .insert({
      user_id: userId,
      type,
      content,
      title: title ?? null,
      metadata: metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to save report: ${error?.message}`);
  return data.id;
}

export async function getReports(userId: string, type?: string, limit = 10): Promise<{ id: string; type: string; title: string | null; content: string; metadata: Record<string, unknown>; created_at: string }[]> {
  let query = getSupabaseServer()
    .from("reports")
    .select("id, type, title, content, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load reports: ${error.message}`);
  return (data || []) as { id: string; type: string; title: string | null; content: string; metadata: Record<string, unknown>; created_at: string }[];
}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/github.ts src/lib/db.ts
git commit -m "feat: add cross-repo aggregation functions and reports CRUD"
```

---

### Task 3: Aggregation LangChain Tools

**Files:**
- Create: `src/lib/tools/aggregation-tools.ts`
- Modify: `src/lib/tools/github-tools.ts`

- [ ] **Step 1: Create aggregation tools**

```typescript
// src/lib/tools/aggregation-tools.ts
// Cross-repo aggregation LangChain tools
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getAllOpenPRs,
  getAssignedIssues,
  getReviewRequests,
  getUserActivity,
  getGitHubToken,
} from "../github";

export const getAllPRsTool = tool(
  async ({ limit }) => {
    const token = await getGitHubToken();
    const result = await getAllOpenPRs(token);
    const limited = result.slice(0, limit || result.length);
    return JSON.stringify(limited, null, 2);
  },
  {
    name: "get_all_prs",
    description: "获取所有仓库中开放的 Pull Request（跨仓库聚合）。",
    schema: z.object({
      limit: z.number().default(30).describe("返回的 PR 数量上限"),
    }),
  }
);

export const getMyTodosTool = tool(
  async () => {
    const token = await getGitHubToken();
    const [assignedIssues, reviewRequests] = await Promise.all([
      getAssignedIssues(token),
      getReviewRequests(token),
    ]);

    const todos = {
      assignedIssues: assignedIssues.map(i => ({
        type: "issue" as const,
        repo: i.repo,
        number: i.number,
        title: i.title,
        labels: i.labels.map(l => l.name),
        url: i.url,
      })),
      reviewRequests: reviewRequests.map(r => ({
        type: "review" as const,
        repo: r.repo,
        number: r.number,
        title: r.title,
        author: r.author,
        url: r.url,
      })),
    };

    return JSON.stringify(todos, null, 2);
  },
  {
    name: "get_my_todos",
    description: "获取当前用户的所有待办事项：被指派的 Issue + 需要 Review 的 PR。",
    schema: z.object({}),
  }
);

export const getUserActivityTool = tool(
  async ({ since, until }) => {
    const token = await getGitHubToken();
    const result = await getUserActivity(token, since, until);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "get_user_activity",
    description: "获取用户在指定日期范围内的活动（commits、PR、Issues）。用于生成日报/周报。",
    schema: z.object({
      since: z.string().describe("开始日期，ISO 8601 格式，如 2026-05-23T00:00:00Z"),
      until: z.string().describe("结束日期，ISO 8601 格式，如 2026-05-30T23:59:59Z"),
    }),
  }
);

export const allAggregationTools = [
  getAllPRsTool,
  getMyTodosTool,
  getUserActivityTool,
];
```

- [ ] **Step 2: Update github-tools.ts to include aggregation tools**

Modify the `allTools` array in `src/lib/tools/github-tools.ts`:

```typescript
import { allWriteTools } from "./write-tools";
import { allAggregationTools } from "./aggregation-tools";

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
  ...allAggregationTools,
];
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/tools/aggregation-tools.ts src/lib/tools/github-tools.ts
git commit -m "feat: add 3 aggregation tools (get_all_prs, get_my_todos, get_user_activity)"
```

---

### Task 4: Report Generation Tools

**Files:**
- Create: `src/lib/tools/report-tools.ts`
- Modify: `src/lib/tools/github-tools.ts`

- [ ] **Step 1: Create report generation tools**

```typescript
// src/lib/tools/report-tools.ts
// Report generation LangChain tools — aggregate data + LLM summarization
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getUserActivity, getAssignedIssues, getReviewRequests, getGitHubToken } from "../github";
import { model } from "../langchain-model";
import { getOrCreateUser, saveReport } from "../db";

/** Generate a daily report */
export const generateDailyReportTool = tool(
  async ({ date }) => {
    const token = await getGitHubToken();
    const targetDate = date || new Date().toISOString().split("T")[0];
    const since = `${targetDate}T00:00:00Z`;
    const until = `${targetDate}T23:59:59Z`;

    const [activity, todos] = await Promise.all([
      getUserActivity(token, since, until),
      getAssignedIssues(token).then(issues => ({ issues })),
    ]);

    const context = JSON.stringify({ activity, todos }, null, 2);

    const response = await model.invoke([
      {
        role: "system",
        content: `你是一个专业的开发者日报生成助手。根据提供的 GitHub 活动数据，生成一份结构化的日报。

格式要求：
## 今日概览
简要总结今天的工作量和重点

## 完成的工作
- 列出完成的 PR、关闭的 Issue、有意义的 commit
- 每个项目附带仓库名和链接

## 进行中的工作
- 列出 open 的 PR 和未关闭的 Issue
- 标注是否有 review 请求

## 明日计划
- 基于当前进行中的工作，建议下一步行动

注意事项：
- 用中文回复
- 简洁明了，每个要点不超过两行
- 如果某天没有任何活动，诚实说明
- 不要编造数据`,
      },
      {
        role: "user",
        content: `请根据以下 GitHub 活动数据生成 ${targetDate} 的日报：\n\n${context}`,
      },
    ]);

    const content = typeof response.content === "string" ? response.content : "";

    // Save to database
    try {
      const userId = await getOrCreateUser();
      await saveReport(userId, "daily", content, `${targetDate} 日报`, { date: targetDate });
    } catch {
      // Non-fatal: report is still returned even if save fails
    }

    return content;
  },
  {
    name: "generate_daily_report",
    description: "生成指定日期的个人日报。基于当天的 commits、PR、Issue 活动自动生成。",
    schema: z.object({
      date: z.string().optional().describe("日期（YYYY-MM-DD），默认为今天"),
    }),
  }
);

/** Generate a weekly report */
export const generateWeeklyReportTool = tool(
  async ({ weekStart }) => {
    const token = await getGitHubToken();

    // Calculate date range
    let startDate: Date;
    if (weekStart) {
      startDate = new Date(weekStart);
    } else {
      // Default to this week's Monday
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + mondayOffset);
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const since = startDate.toISOString();
    const until = endDate.toISOString();

    const [activity, assignedIssues, reviewRequests] = await Promise.all([
      getUserActivity(token, since, until),
      getAssignedIssues(token),
      getReviewRequests(token),
    ]);

    const context = JSON.stringify({
      dateRange: `${startDate.toISOString().split("T")[0]} 至 ${endDate.toISOString().split("T")[0]}`,
      activity,
      assignedIssues,
      reviewRequests,
    }, null, 2);

    const response = await model.invoke([
      {
        role: "system",
        content: `你是一个专业的开发者周报生成助手。根据提供的 GitHub 活动数据，生成一份结构化的周报。

格式要求：
## 本周概览
一句话总结本周的工作重点和成果

## 完成事项
### 代码提交
- 按仓库分组，列出主要 commit 和变更

### Pull Requests
- 已合并的 PR（含仓库名和链接）
- 关闭的 PR

### Issues
- 已关闭的 Issue（含仓库名和链接）

## 进行中的工作
- 未合并的 PR
- 未关闭的 Issue
- 待 Review 的 PR

## 遇到的问题
- 记录本周遇到的技术问题和解决过程（如有）

## 下周计划
- 基于当前进行中的工作，建议下周的重点

注意事项：
- 用中文回复
- 重点突出，详略得当
- 不要编造数据，没有内容就说"无"
- 每个要点不超过三行`,
      },
      {
        role: "user",
        content: `请根据以下 GitHub 活动数据生成周报：\n\n${context}`,
      },
    ]);

    const content = typeof response.content === "string" ? response.content : "";

    // Save to database
    try {
      const userId = await getOrCreateUser();
      await saveReport(userId, "weekly", content, `${startDate.toISOString().split("T")[0]} 周报`, {
        weekStart: startDate.toISOString(),
        weekEnd: endDate.toISOString(),
      });
    } catch {
      // Non-fatal
    }

    return content;
  },
  {
    name: "generate_weekly_report",
    description: "生成本周的个人周报。自动汇总本周的 commits、PR、Issue 活动。",
    schema: z.object({
      weekStart: z.string().optional().describe("周起始日期（YYYY-MM-DD），默认为本周一"),
    }),
  }
);

/** Generate code change summary for a PR */
export const generateCodeSummaryTool = tool(
  async ({ repo, prNumber }) => {
    const token = await getGitHubToken();
    if (!token) throw new Error("GitHub token required");

    const [owner, name] = repo.split("/");

    // Get PR details
    const prData = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    }).then(r => r.json()) as { title: string; body: string | null; additions: number; deletions: number; changed_files: number; user: { login: string } };

    // Get PR diff (simplified: just the file list and stats)
    const filesData = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/files?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    }).then(r => r.json()) as { filename: string; status: string; additions: number; deletions: number; patch?: string }[];

    const context = JSON.stringify({
      title: prData.title,
      description: prData.body,
      author: prData.user.login,
      stats: {
        totalAdditions: prData.additions,
        totalDeletions: prData.deletions,
        changedFiles: prData.changed_files,
      },
      files: filesData.slice(0, 30).map(f => ({
        path: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
    }, null, 2);

    const response = await model.invoke([
      {
        role: "system",
        content: `你是一个代码审查助手。根据 PR 的变更数据，生成一份人类可读的代码变更摘要。

格式要求：
## 变更概览
- 一句话总结这个 PR 的目的
- 统计：+X -Y，Z 个文件

## 主要变更
按功能模块分组，每个模块说明：
- 改了什么文件
- 为什么改（从代码变更推断意图）
- 关键变更点

## 潜在风险
- 标注可能的风险点（如：删除了重要逻辑、修改了公共 API 等）
- 如果没有明显风险，说明"无明显风险"

注意事项：
- 用中文回复
- 不要逐行列举变更，要归纳总结
- 从代码变更推断意图，不要编造`,
      },
      {
        role: "user",
        content: `请分析以下 PR 的代码变更：\n\n${context}`,
      },
    ]);

    const content = typeof response.content === "string" ? response.content : "";

    // Save to database
    try {
      const userId = await getOrCreateUser();
      await saveReport(userId, "code_summary", content, `${repo} #${prNumber} 变更摘要`, {
        repo,
        prNumber,
      });
    } catch {
      // Non-fatal
    }

    return content;
  },
  {
    name: "generate_code_summary",
    description: "生成指定 PR 的代码变更摘要。自动分析 diff，归纳变更意图。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
    }),
  }
);

export const allReportTools = [
  generateDailyReportTool,
  generateWeeklyReportTool,
  generateCodeSummaryTool,
];
```

- [ ] **Step 2: Update github-tools.ts to include report tools**

```typescript
import { allWriteTools } from "./write-tools";
import { allAggregationTools } from "./aggregation-tools";
import { allReportTools } from "./report-tools";

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
  ...allAggregationTools,
  ...allReportTools,
];
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/tools/report-tools.ts src/lib/tools/github-tools.ts
git commit -m "feat: add 3 report tools (daily report, weekly report, code summary)"
```

---

### Task 5: Quick Actions UI

**Files:**
- Create: `src/components/chat/quick-actions.tsx`
- Modify: `src/components/chat/chat-panel.tsx`

- [ ] **Step 1: Create the quick actions component**

```typescript
// src/components/chat/quick-actions.tsx
// One-click action buttons for killer features
"use client";

import { Button } from "@/components/ui/button";
import { FileText, Calendar, ClipboardList, Search, GitCommit, Sparkles } from "lucide-react";

interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled: boolean;
}

const ACTIONS = [
  { id: "daily", label: "生成日报", icon: FileText, prompt: "帮我生成今天的日报" },
  { id: "weekly", label: "生成周报", icon: Calendar, prompt: "帮我生成本周的周报" },
  { id: "todos", label: "我的待办", icon: ClipboardList, prompt: "我现在有哪些待办事项？" },
  { id: "health", label: "项目健康度", icon: Search, prompt: "帮我分析所有仓库的项目健康度" },
  { id: "summary", label: "代码摘要", icon: GitCommit, prompt: "帮我总结一下最近的代码变更" },
];

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="px-3 py-2 border-b bg-muted/30">
      <div className="flex items-center gap-1 mb-2">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">快捷操作</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map(({ id, label, icon: Icon, prompt }) => (
          <Button
            key={id}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            disabled={disabled}
            onClick={() => onAction(prompt)}
          >
            <Icon className="h-3 w-3 mr-1" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into chat-panel.tsx**

In `src/components/chat/chat-panel.tsx`, add the QuickActions bar below the header:

```typescript
import { QuickActions } from "./quick-actions";

// Inside the ChatPanel return JSX, after the header div and before the messages div:
<QuickActions onAction={(prompt) => handleSend(prompt)} disabled={loading} />
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/quick-actions.tsx src/components/chat/chat-panel.tsx
git commit -m "feat: add quick actions bar for one-click killer features"
```

---

### Task 6: Update Prompt Configuration for New Tools

**Files:**
- Modify: `src/lib/prompt-config.ts`

- [ ] **Step 1: Update the default tool descriptions**

In `src/lib/prompt-config.ts`, update `DEFAULT_PROMPT.toolDescription` to include all new tools:

```typescript
toolDescription: `你可以通过调用以下工具来帮助用户完成操作：

【查询工具】
- list_repos: 列出当前用户自己的 GitHub 仓库
- search_repos: 在 GitHub 上搜索公开的仓库项目
- list_prs: 列出指定仓库的 Pull Request
- list_issues: 列出指定仓库的 Issue
- view_repo: 查看指定仓库的详细信息
- view_pr: 查看指定 PR 的详细信息
- view_issue: 查看指定 Issue 的详细信息
- search_code: 在 GitHub 上搜索代码
- get_all_prs: 获取所有仓库中开放的 PR（跨仓库聚合）
- get_my_todos: 获取当前用户的所有待办事项（被指派的 Issue + 需要 Review 的 PR）
- get_user_activity: 获取用户在指定日期范围内的活动

【写操作工具】
- create_issue: 在指定仓库创建 Issue
- comment_on_issue: 在 Issue 下评论
- comment_on_pr: 在 PR 下评论
- update_issue: 更新 Issue 状态/标签/指派人
- merge_pr: 合并 PR (merge/squash/rebase)
- close_pr: 关闭 PR (不合并)

【报告工具】
- generate_daily_report: 生成指定日期的个人日报
- generate_weekly_report: 生成本周的个人周报
- generate_code_summary: 生成指定 PR 的代码变更摘要

【通用工具】
- run_gh: 执行 gh CLI 命令（仅限安全命令）`,
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/prompt-config.ts
git commit -m "feat: update prompt config with all new tool descriptions"
```

---

### Task 7: Integration Verification

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

- [ ] **Step 4: Dev server smoke test**

Run: `npm run dev` (in background)
- Open http://localhost:3000
- Verify quick actions bar is visible in chat panel
- Click "生成日报" — verify it sends the prompt to the agent
- Stop dev server

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: Phase C integration verification — all checks pass"
```

---

## Summary of Changes

| Task | Files Created | Files Modified |
|------|--------------|----------------|
| 1. Reports Schema | `supabase/migrations/003_reports.sql` | — |
| 2. Aggregation Functions | — | `src/lib/github.ts`, `src/lib/db.ts` |
| 3. Aggregation Tools | `src/lib/tools/aggregation-tools.ts` | `src/lib/tools/github-tools.ts` |
| 4. Report Tools | `src/lib/tools/report-tools.ts` | `src/lib/tools/github-tools.ts` |
| 5. Quick Actions UI | `src/components/chat/quick-actions.tsx` | `src/components/chat/chat-panel.tsx` |
| 6. Prompt Update | — | `src/lib/prompt-config.ts` |
| 7. Verification | — | (all) |

**Total: 4 new files, 5 modified files**

## Tool Inventory After Phase C

| Category | Tools | Count |
|----------|-------|-------|
| Read (original) | list_repos, search_repos, list_prs, list_issues, view_repo, view_pr, view_issue, search_code | 8 |
| Read (aggregation) | get_all_prs, get_my_todos, get_user_activity | 3 |
| Write | create_issue, comment_on_issue, comment_on_pr, update_issue, merge_pr, close_pr | 6 |
| Reports | generate_daily_report, generate_weekly_report, generate_code_summary | 3 |
| Generic | run_gh (allowlisted) | 1 |
| **Total** | | **21** |
