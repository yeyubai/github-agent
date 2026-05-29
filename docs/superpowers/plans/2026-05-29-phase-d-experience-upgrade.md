# Phase D: Experience Upgrade — Rich Cards, Onboarding, PRD Alignment, Homepage Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the user experience so the product feels complete and professional: fix dead homepage buttons, add onboarding flow for first-time users, replace text-only tool results with rich interactive cards, and update PRD to match reality.

**Architecture:** Add a rich card renderer in the chat panel that converts structured data (PR, Issue, Repo objects) into clickable UI components. Create an onboarding modal that detects missing config (no Supabase, no token) and guides users step by step. Redesign the homepage to highlight killer features instead of basic stats.

**Tech Stack:** Next.js 16 (App Router), TypeScript, shadcn/ui, Tailwind CSS v4

---

## File Map

### Files to CREATE:
- `src/components/chat/rich-cards.tsx` — Rich card components for PR/Issue/Repo display
- `src/components/onboarding/onboarding-modal.tsx` — First-time user setup wizard
- `src/components/onboarding/setup-steps.tsx` — Step-by-step config guide

### Files to MODIFY:
- `src/components/chat/chat-panel.tsx` — Integrate rich card rendering
- `src/app/page.tsx` — Complete homepage redesign
- `src/app/layout.tsx` — Add onboarding modal trigger
- `src/lib/prompt-config.ts` — Add rich card instructions to system prompt
- `docs/PRD.md` — Update to reflect all implemented features
- `src/app/settings/page.tsx` — Fix DeepSeek API key input (add actual input field)

---

### Task 1: Rich Card Components

**Files:**
- Create: `src/components/chat/rich-cards.tsx`

- [ ] **Step 1: Create the rich cards component**

```typescript
// src/components/chat/rich-cards.tsx
// Rich interactive cards for displaying PR, Issue, Repo data in chat
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, GitPullRequest, CircleDot, GitBranch, Star, Languages, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ===== PR Card =====

interface PRCardProps {
  repo: string;
  number: number;
  title: string;
  state?: string;
  author?: string;
  url?: string;
  labels?: { name: string }[];
}

export function PRCard({ repo, number, title, state, author, url, labels }: PRCardProps) {
  return (
    <Card className="my-2 border-l-4 border-l-purple-400">
      <CardHeader className="py-2 px-3">
        <div className="flex items-start gap-2">
          <GitPullRequest className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">
              {title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{repo} #{number}</span>
              {author && <span>by {author}</span>}
              {state && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[10px]",
                    state === "open" ? "text-green-600 border-green-300" :
                    state === "closed" ? "text-red-600 border-red-300" :
                    "text-purple-600 border-purple-300"
                  )}
                >
                  {state}
                </Badge>
              )}
            </div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </CardHeader>
      {labels && labels.length > 0 && (
        <CardContent className="py-1 px-3 flex flex-wrap gap-1">
          {labels.map((l) => (
            <Badge key={l.name} variant="secondary" className="h-4 px-1.5 text-[10px]">
              {l.name}
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ===== Issue Card =====

interface IssueCardProps {
  repo: string;
  number: number;
  title: string;
  state?: string;
  labels?: { name: string; color?: string }[];
  url?: string;
}

export function IssueCard({ repo, number, title, state, labels, url }: IssueCardProps) {
  return (
    <Card className="my-2 border-l-4 border-l-orange-400">
      <CardHeader className="py-2 px-3">
        <div className="flex items-start gap-2">
          <CircleDot className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">
              {title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{repo} #{number}</span>
              {state && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[10px]",
                    state === "open" ? "text-green-600 border-green-300" : "text-red-600 border-red-300"
                  )}
                >
                  {state}
                </Badge>
              )}
            </div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </CardHeader>
      {labels && labels.length > 0 && (
        <CardContent className="py-1 px-3 flex flex-wrap gap-1">
          {labels.map((l) => (
            <Badge key={l.name} variant="secondary" className="h-4 px-1.5 text-[10px]">
              {l.name}
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ===== Repo Card =====

interface RepoCardProps {
  fullName: string;
  description?: string | null;
  stargazerCount?: number;
  primaryLanguage?: { name: string } | null;
  updatedAt?: string;
  isPrivate?: boolean;
  url?: string;
}

export function RepoCard({ fullName, description, stargazerCount, primaryLanguage, updatedAt, isPrivate, url }: RepoCardProps) {
  const [owner, name] = fullName.split("/");

  return (
    <Card className="my-2 border-l-4 border-l-blue-400">
      <CardHeader className="py-2 px-3">
        <div className="flex items-start gap-2">
          <GitBranch className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">
              <Link href={`/repos/${fullName}`} className="hover:underline">
                {name}
              </Link>
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5">{owner}</div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </CardHeader>
      {(description || stargazerCount || primaryLanguage || isPrivate) && (
        <CardContent className="py-1 px-3 space-y-1">
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {primaryLanguage && (
              <span className="flex items-center gap-1">
                <Languages className="h-3 w-3" />
                {primaryLanguage.name}
              </span>
            )}
            {stargazerCount !== undefined && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {stargazerCount}
              </span>
            )}
            {isPrivate && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                <Lock className="h-2.5 w-2.5 mr-0.5" />
                私有
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ===== Todo Item =====

interface TodoItemProps {
  type: "issue" | "review";
  repo: string;
  number: number;
  title: string;
  labels?: string[];
  author?: string;
  url?: string;
}

export function TodoItem({ type, repo, number, title, labels, author, url }: TodoItemProps) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-accent/50 text-sm">
      {type === "issue" ? (
        <CircleDot className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
      ) : (
        <GitPullRequest className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{title}</span>
          <span className="text-xs text-muted-foreground shrink-0">{repo} #{number}</span>
        </div>
        {labels && labels.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {labels.map((l) => (
              <span key={l} className="text-[10px] bg-muted px-1 rounded">{l}</span>
            ))}
          </div>
        )}
        {author && type === "review" && (
          <div className="text-xs text-muted-foreground mt-0.5">by {author}</div>
        )}
      </div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </a>
      )}
    </div>
  );
}

// ===== Action Button Card =====

interface ActionCardProps {
  label: string;
  description: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function ActionCard({ label, description, onClick, icon }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon && <span className="shrink-0">{icon}</span>}
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/rich-cards.tsx
git commit -m "feat: add rich card components (PR, Issue, Repo, Todo, Action)"
```

---

### Task 2: Integrate Rich Cards into Chat Panel

**Files:**
- Modify: `src/components/chat/chat-panel.tsx`
- Modify: `src/lib/prompt-config.ts`

- [ ] **Step 1: Add rich card imports to chat-panel.tsx**

At the top of `src/components/chat/chat-panel.tsx`, add:
```typescript
import { PRCard, IssueCard, RepoCard, TodoItem, ActionCard } from "./rich-cards";
```

- [ ] **Step 2: Add card data detection in processStream**

In the `processStream` function, after the existing `if (parsed.tool_call)` block, add:
```typescript
// Detect rich card data from model response
if (parsed.card) {
  assistantCards = [...(assistantCards || []), parsed.card];
}
```

Also add `let assistantCards: unknown[] = [];` to the variable declarations at the top of processStream.

- [ ] **Step 3: Add card rendering in message display**

In the message rendering section (inside the `.map((msg)` block), add after the tool call section:

```typescript
{/* 富卡片展示 */}
{msg.cards && msg.cards.length > 0 && (
  <div className="mt-2 space-y-2">
    {msg.cards.map((card: any, i: number) => {
      if (card.type === "pr") {
        return <PRCard key={i} {...card.data} />;
      }
      if (card.type === "issue") {
        return <IssueCard key={i} {...card.data} />;
      }
      if (card.type === "repo") {
        return <RepoCard key={i} {...card.data} />;
      }
      if (card.type === "todo") {
        return <TodoItem key={i} {...card.data} />;
      }
      if (card.type === "action") {
        return <ActionCard key={i} {...card.data} onClick={() => handleSend(card.data.prompt)} />;
      }
      return null;
    })}
  </div>
)}
```

- [ ] **Step 4: Update prompt config to instruct model to use cards**

In `src/lib/prompt-config.ts`, add to `DEFAULT_PROMPT.replyStyle`:

```typescript
replyStyle: `回复风格：简洁、专业、有帮助性。用中文回复。涉及代码时使用 Markdown 代码块。
重要：当返回 PR、Issue、仓库列表或待办事项时，请使用 JSON 格式的卡片数据结构，让前端渲染为交互式卡片。格式：{"card": {"type": "pr"|"issue"|"repo"|"todo"|"action", "data": {...}}}。`,
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/chat-panel.tsx src/lib/prompt-config.ts
git commit -m "feat: integrate rich cards into chat panel with card detection and rendering"
```

---

### Task 3: Onboarding Modal

**Files:**
- Create: `src/components/onboarding/onboarding-modal.tsx`
- Create: `src/components/onboarding/setup-steps.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the setup steps component**

```typescript
// src/components/onboarding/setup-steps.tsx
// Step-by-step configuration guide for first-time users
"use client";

import { Check, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SetupStatus = "pending" | "checking" | "ok" | "error";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: SetupStatus;
  action?: { label: string; onClick: () => void };
  link?: { label: string; url: string };
}

interface SetupStepsProps {
  steps: SetupStep[];
  allComplete: boolean;
}

export function SetupSteps({ steps, allComplete }: SetupStepsProps) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start gap-3">
          {/* Step number / status icon */}
          <div className="shrink-0 mt-0.5">
            {step.status === "ok" ? (
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            ) : step.status === "checking" ? (
              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
              </div>
            ) : step.status === "error" ? (
              <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
                <AlertCircle className="h-3.5 w-3.5 text-white" />
              </div>
            ) : (
              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium">
                {i + 1}
              </div>
            )}
          </div>

          {/* Step content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{step.title}</span>
              {step.status === "ok" && (
                <Badge className="bg-green-500 h-4 px-1 text-[10px]">已完成</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>

            {step.link && (
              <a
                href={step.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
              >
                {step.link.label}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}

            {step.action && step.status !== "ok" && (
              <Button
                size="sm"
                className="h-7 text-xs mt-2"
                onClick={step.action.onClick}
                disabled={step.status === "checking"}
              >
                {step.status === "checking" ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {step.action.label}
              </Button>
            )}
          </div>
        </div>
      ))}

      {allComplete && (
        <div className="text-center py-2 text-sm text-green-600 font-medium">
          所有配置已完成，可以开始使用！
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the onboarding modal component**

```typescript
// src/components/onboarding/onboarding-modal.tsx
// First-time user onboarding modal
"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupSteps, type SetupStatus } from "./setup-steps";
import { useState, useEffect } from "react";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [supabaseStatus, setSupabaseStatus] = useState<SetupStatus>("checking");
  const [tokenStatus, setTokenStatus] = useState<SetupStatus>("pending");
  const [deepseekStatus, setDeepseekStatus] = useState<SetupStatus>("pending");
  const [tokenInput, setTokenInput] = useState("");

  // Check Supabase connection on mount
  useEffect(() => {
    if (!open) return;

    // Check if Supabase env vars are configured by trying a simple API call
    fetch("/api/github/repos?limit=1")
      .then(() => setSupabaseStatus("ok"))
      .catch(() => setSupabaseStatus("error"));
  }, [open]);

  // Check token status
  useEffect(() => {
    if (!open) return;
    fetch("/api/github/token")
      .then((r) => r.json())
      .then((data) => setTokenStatus(data.hasToken ? "ok" : "pending"))
      .catch(() => setTokenStatus("error"));
  }, [open]);

  // Check DeepSeek connection
  useEffect(() => {
    if (!open) return;
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi", sessionId: "onboard-check" }),
    })
      .then((r) => setDeepseekStatus(r.ok ? "ok" : "error"))
      .catch(() => setDeepseekStatus("error"));
  }, [open]);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    setTokenStatus("checking");

    try {
      const res = await fetch("/api/github/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });

      if (res.ok) {
        setTokenStatus("ok");
        setTokenInput("");
      } else {
        setTokenStatus("error");
      }
    } catch {
      setTokenStatus("error");
    }
  };

  if (!open) return null;

  const allComplete = supabaseStatus === "ok" && tokenStatus === "ok" && deepseekStatus === "ok";

  const steps = [
    {
      id: "supabase",
      title: "数据库连接",
      description: supabaseStatus === "error"
        ? "Supabase 未正确配置，请检查 .env.local 中的 Supabase 环境变量"
        : "已连接到 Supabase 数据库",
      status: supabaseStatus,
      link: supabaseStatus === "error" ? {
        label: "查看 .env.example 获取配置模板",
        url: "#",
      } : undefined,
    } as const,
    {
      id: "token",
      title: "GitHub Token",
      description: tokenStatus === "ok"
        ? "已配置 GitHub Personal Access Token"
        : "需要配置 GitHub Token 以访问你的仓库数据",
      status: tokenStatus,
      link: {
        label: "获取 GitHub Token",
        url: "https://github.com/settings/tokens",
      },
      action: tokenStatus !== "ok" ? {
        label: "保存 Token",
        onClick: handleSaveToken,
      } : undefined,
    } as const,
    {
      id: "deepseek",
      title: "AI 模型连接",
      description: deepseekStatus === "ok"
        ? "DeepSeek API 连接正常"
        : deepseekStatus === "error"
        ? "DeepSeek API 连接失败，请检查 .env.local 中的 DEEPSEEK_API_KEY"
        : "正在检查连接...",
      status: deepseekStatus,
    } as const,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">欢迎使用 GitHub Agent</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            首次使用需要完成以下配置。配置完成后即可开始使用 Agent 对话。
          </p>

          <SetupSteps steps={steps as any} allComplete={allComplete} />

          {/* Token input (shown when token is not configured) */}
          {tokenStatus !== "ok" && (
            <div className="space-y-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx..."
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            也可以稍后在「设置」页面完成配置
          </p>
          <Button onClick={onClose}>
            {allComplete ? "开始使用" : "稍后设置"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integrate onboarding into layout.tsx**

In `src/app/layout.tsx`, add the onboarding modal:

```typescript
"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { useState, useEffect } from "react";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const ONBOARDING_KEY = "github-agent-onboarding-dismissed";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_KEY);
    if (!dismissed) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <OnboardingModal open={showOnboarding} onClose={() => {
            localStorage.setItem(ONBOARDING_KEY, "true");
            setShowOnboarding(false);
          }} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Note: The original layout.tsx may be a server component. If so, we need to create a client wrapper component. Let me check the original first.

Read `src/app/layout.tsx` first, then adapt accordingly. If it's a server component:

```typescript
// src/app/layout.tsx (server component - keep as is)
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <OnboardingShell>
            {children}
          </OnboardingShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

And create the shell component:

```typescript
// src/components/onboarding/onboarding-shell.tsx
"use client";

import { OnboardingModal } from "./onboarding-modal";
import { useState, useEffect } from "react";

const ONBOARDING_KEY = "github-agent-onboarding-dismissed";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_KEY);
    if (!dismissed) {
      setShowOnboarding(true);
    }
  }, []);

  return (
    <>
      <OnboardingModal open={showOnboarding} onClose={() => {
        localStorage.setItem(ONBOARDING_KEY, "true");
        setShowOnboarding(false);
      }} />
      {children}
    </>
  );
}
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/onboarding-modal.tsx src/components/onboarding/setup-steps.tsx src/components/onboarding/onboarding-shell.tsx src/app/layout.tsx
git commit -m "feat: add onboarding modal with step-by-step setup guide"
```

---

### Task 4: Homepage Redesign

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Redesign the homepage to highlight killer features**

Replace `src/app/page.tsx` with:

```typescript
// src/app/page.tsx
"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay, ErrorState } from "@/components/ui/feedback";
import {
  FileText, Calendar, ClipboardList, Search, GitCommit,
  GitBranch, GitPullRequest, CircleDot, Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Stats {
  repos: number;
  prs: number;
  issues: number;
}

const KILLER_FEATURES = [
  {
    id: "weekly",
    title: "生成周报",
    description: "自动汇总本周的 commits、PR、Issue 活动",
    prompt: "帮我生成本周的周报",
    icon: Calendar,
  },
  {
    id: "daily",
    title: "生成日报",
    description: "基于今天的 GitHub 活动生成日报",
    prompt: "帮我生成今天的日报",
    icon: FileText,
  },
  {
    id: "todos",
    title: "我的待办",
    description: "查看所有被指派的 Issue 和需要 Review 的 PR",
    prompt: "我现在有哪些待办事项？",
    icon: ClipboardList,
  },
  {
    id: "health",
    title: "项目健康度",
    description: "分析所有仓库的状态和活跃度",
    prompt: "帮我分析所有仓库的项目健康度",
    icon: Search,
  },
  {
    id: "summary",
    title: "代码变更摘要",
    description: "分析 PR diff，生成人类可读的变更说明",
    prompt: "帮我总结一下最近的代码变更",
    icon: GitCommit,
  },
];

export default function Home() {
  const [stats, setStats] = useState<Stats>({ repos: 0, prs: 0, issues: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onChat, setOnChat] = useState<((prompt: string) => void) | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/github/repos").then((r) => r.json()),
      fetch("/api/github/prs").then((r) => r.json()),
      fetch("/api/github/issues").then((r) => r.json()),
    ])
      .then(([repos, prs, issues]) => {
        setStats({
          repos: repos.length || 0,
          prs: prs.length || 0,
          issues: issues.length || 0,
        });
      })
      .catch(() => setError("请确保已安装 gh CLI 并登录"))
      .finally(() => setLoading(false));

    // Listen for chat panel ready event
    const handler = (e: CustomEvent) => setOnChat(() => e.detail.send);
    window.addEventListener("chat-ready", handler as EventListener);
    return () => window.removeEventListener("chat-ready", handler as EventListener);
  }, []);

  const handleAction = (prompt: string) => {
    // Emit event to chat panel
    window.dispatchEvent(new CustomEvent("chat-action", { detail: { prompt } }));
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-container-md">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            GitHub Agent
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            用自然语言管理你的 GitHub 仓库、PR 和 Issue
          </p>
        </div>

        {/* Stats */}
        {error ? (
          <ErrorState message={error} action={{ label: "重试", onClick: () => window.location.reload() }} />
        ) : loading ? (
          <LoadingOverlay text="正在获取 GitHub 数据..." />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">仓库</CardTitle>
                <GitBranch className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.repos}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">PR</CardTitle>
                <GitPullRequest className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.prs}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Issues</CardTitle>
                <CircleDot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.issues}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Killer Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              快捷操作
            </CardTitle>
            <CardDescription>一键触发 Agent 的高频场景</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {KILLER_FEATURES.map(({ id, title, description, prompt, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleAction(prompt)}
                  className="text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                    <span className="text-sm font-medium">{title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>快速导航</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = "/repos"}>
              仓库列表
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = "/prs"}>
              我的 PR
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = "/issues"}>
              我的 Issue
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = "/insights"}>
              数据看板
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => window.location.href = "/settings"}>
              设置
            </Badge>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Wire up chat panel to receive action events**

In `src/components/chat/chat-panel.tsx`, add to the useEffect that handles initialization:

```typescript
// Listen for action events from homepage
useEffect(() => {
  const handler = (e: CustomEvent) => {
    if (e.detail?.prompt) {
      handleSend(e.detail.prompt);
    }
  };
  window.addEventListener("chat-action", handler as EventListener);
  return () => window.removeEventListener("chat-action", handler as EventListener);
}, []);
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/chat/chat-panel.tsx
git commit -m "feat: redesign homepage with killer features grid and quick navigation"
```

---

### Task 5: Fix DeepSeek API Key Input in Settings

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Add API key input field**

In `src/app/settings/page.tsx`, in the "AI 模型配置" Card, replace the current content (the "测试连接" button only section) with:

```typescript
<CardContent className="space-y-4">
  <div className="space-y-2">
    <label className="text-sm font-medium">DeepSeek API Key</label>
    <Input
      type="password"
      value={deepseekKey}
      onChange={(e) => {
        setDeepseekKey(e.target.value);
        setTestResult(null);
      }}
      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
      disabled={testing}
    />
  </div>

  <div className="flex items-center gap-2">
    <Button onClick={handleTestKey} disabled={testing || !deepseekKey.trim()}>
      {testing ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : null}
      测试连接
    </Button>
    {testResult === "success" && (
      <Badge className="bg-green-500">连接成功</Badge>
    )}
    {testResult === "error" && (
      <Badge variant="destructive">连接失败</Badge>
    )}
  </div>

  <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
    <p className="flex items-center gap-1.5">
      <AlertTriangle className="h-3 w-3" />
      提示
    </p>
    <p>
      API Key 也可以通过服务器的 <code className="bg-background px-1 rounded">.env.local</code> 文件设置 <code className="bg-background px-1 rounded">DEEPSEEK_API_KEY</code> 环境变量。
    </p>
    <p>
      获取地址：<a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="underline">DeepSeek API Keys</a>
    </p>
  </div>
</CardContent>
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "fix: add DeepSeek API key input field to settings page"
```

---

### Task 6: Update PRD

**Files:**
- Modify: `docs/PRD.md`

- [ ] **Step 1: Update the PRD feature table**

Replace the feature status table in `docs/PRD.md` section 2.1 with:

```markdown
| 优先级 | 模块 | 功能 | 状态 |
|--------|------|------|------|
| P0 | 仪表盘 | GitHub 概览统计 | ✅ 已实现 |
| P0 | Agent 对话 | 自然语言 → 工具调用 → 结果展示 | ✅ 已实现 |
| P0 | Agent 对话 | 多步自动规划 + 用户确认 | ✅ 已实现 |
| P0 | Agent 对话 | 对话历史持久化 (Supabase) | ✅ 已实现 |
| P0 | Agent 对话 | 上下文感知 (当前仓库/PR) | ✅ 已实现 |
| P0 | Agent 对话 | 富卡片展示 (PR/Issue/Repo) | ✅ 已实现 |
| P1 | 仓库管理 | 仓库列表（搜索/排序/过滤） | ✅ 已实现 |
| P1 | 仓库管理 | 仓库详情（README/语言/Star 趋势） | ✅ 已实现 |
| P1 | 写操作 | 创建 Issue / 评论 / 合并 PR | ✅ 已实现 |
| P1 | 写操作 | 关闭 PR / 更新 Issue | ✅ 已实现 |
| P2 | PR 管理 | PR 列表与状态筛选 | ✅ 已实现 |
| P2 | 跨仓库 | 全局 PR / Issue 聚合查询 | ✅ 已实现 |
| P2 | 跨仓库 | 待办提取 (指派 + Review 请求) | ✅ 已实现 |
| P3 | 效率工具 | 日报/周报自动生成 | ✅ 已实现 |
| P3 | 效率工具 | 代码变更摘要 | ✅ 已实现 |
| P3 | 安全 | gh 命令白名单校验 | ✅ 已实现 |
| P3 | 体验 | 首次使用引导 (Onboarding) | ✅ 已实现 |
| P3 | 体验 | 快捷操作按钮 | ✅ 已实现 |
| P4 | 体验 | 主题切换（深色/浅色） | ✅ 已实现 |
```

- [ ] **Step 2: Update the product roadmap**

Replace section 4 with:

```markdown
## 4. 产品路线图

### Phase 1: 基础能力 (已完成)
- [x] Supabase 持久化
- [x] 写操作工具 (create_issue, comment, merge_pr 等)
- [x] 会话历史持久化
- [x] 命令执行确认机制
- [x] 仓库列表/详情页
- [x] 错误处理与加载状态

### Phase 2: Agent 智能化 (已完成)
- [x] 多步自动规划
- [x] 上下文感知
- [x] 批量工具执行
- [x] 活动日志

### Phase 3: 杀手场景 (已完成)
- [x] 日报/周报自动生成
- [x] 代码变更摘要
- [x] 待办事项追踪
- [x] 跨仓库聚合查询

### Phase 4: 体验升级 (已完成)
- [x] 富卡片交互
- [x] 快捷指令
- [x] Onboarding 流程
- [x] PRD 文档对齐

### Phase 5: 未来规划
- [ ] GitHub Webhook 集成（实时通知）
- [ ] Supabase Realtime（主动推送）
- [ ] 向量搜索 (pgvector)
- [ ] 多模型支持
- [ ] 多用户/SaaS 模式
```

- [ ] **Step 3: Commit**

```bash
git add docs/PRD.md
git commit -m "docs: update PRD to reflect all implemented features"
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

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: Phase D integration verification — all checks pass"
```

---

## Summary of Changes

| Task | Files Created | Files Modified |
|------|--------------|----------------|
| 1. Rich Cards | `src/components/chat/rich-cards.tsx` | — |
| 2. Card Integration | — | `src/components/chat/chat-panel.tsx`, `src/lib/prompt-config.ts` |
| 3. Onboarding | `src/components/onboarding/onboarding-modal.tsx`, `src/components/onboarding/setup-steps.tsx`, `src/components/onboarding/onboarding-shell.tsx` | `src/app/layout.tsx` |
| 4. Homepage | — | `src/app/page.tsx`, `src/components/chat/chat-panel.tsx` |
| 5. Settings Fix | — | `src/app/settings/page.tsx` |
| 6. PRD Update | — | `docs/PRD.md` |
| 7. Verification | — | (all) |

**Total: 4 new files, 6 modified files**

## Final Tool Inventory

| Category | Tools | Count |
|----------|-------|-------|
| Read | list_repos, search_repos, list_prs, list_issues, view_repo, view_pr, view_issue, search_code | 8 |
| Aggregation | get_all_prs, get_my_todos, get_user_activity | 3 |
| Write | create_issue, comment_on_issue, comment_on_pr, update_issue, merge_pr, close_pr | 6 |
| Reports | generate_daily_report, generate_weekly_report, generate_code_summary | 3 |
| Generic | run_gh (allowlisted) | 1 |
| **Total** | | **21** |
