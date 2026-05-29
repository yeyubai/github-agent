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
import { useRouter } from "next/navigation";

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
    description: "基于今天 GitHub 活动生成日报",
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
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ repos: 0, prs: 0, issues: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      .catch(() => setError("请确保已配置 GitHub Token"))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = (prompt: string) => {
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
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => router.push("/repos")}>
              仓库列表
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => router.push("/prs")}>
              我的 PR
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => router.push("/issues")}>
              我的 Issue
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => router.push("/insights")}>
              数据看板
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => router.push("/settings")}>
              设置
            </Badge>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
