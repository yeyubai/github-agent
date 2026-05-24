"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay, ErrorState } from "@/components/ui/feedback";
import {
  GitBranch,
  GitPullRequest,
  CircleDot,
  Star,
  GitFork,
  Code,
  TrendingUp,
  Trophy,
  Calendar,
  Languages,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Repo {
  name: string;
  url: string;
  description: string | null;
  isPrivate: boolean;
  updatedAt: string;
  stargazerCount: number;
  primaryLanguage: { name: string } | null;
}

export default function InsightsPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [prs, setPRs] = useState<{ number: number; title: string }[]>([]);
  const [issues, setIssues] = useState<{ number: number; title: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/github/repos?limit=100").then((r) => r.json()),
      fetch("/api/github/prs?state=open&limit=100").then((r) => r.json()),
      fetch("/api/github/issues?state=open&limit=100").then((r) => r.json()),
    ])
      .then(([reposData, prsData, issuesData]) => {
        if (reposData.error) throw new Error(reposData.error);
        setRepos(reposData);
        setPRs(Array.isArray(prsData) ? prsData : []);
        setIssues(Array.isArray(issuesData) ? issuesData : []);
      })
      .catch((err) => setError(err.message ?? "获取数据失败"))
      .finally(() => setLoading(false));
  }, []);

  // 统计数据
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazerCount || 0), 0);
  const publicRepos = repos.filter((r) => !r.isPrivate).length;
  const privateRepos = repos.filter((r) => r.isPrivate).length;
  const languages = repos
    .filter((r) => r.primaryLanguage)
    .reduce<Record<string, number>>((acc, r) => {
      const lang = r.primaryLanguage!.name;
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});
  const topLanguages = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topStarred = [...repos].sort((a, b) => b.stargazerCount - a.stargazerCount).slice(0, 5);
  const recentlyUpdated = [...repos].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days} 天前`;
    return `${Math.floor(days / 7)} 周前`;
  };

  if (loading) {
    return (
      <AppShell>
        <LoadingOverlay text="正在生成洞察报告..." />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <ErrorState message={error} action={{ label: "重试", onClick: () => window.location.reload() }} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">开发洞察</h1>

        {/* 核心指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">仓库总数</CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{repos.length}</div>
              <p className="text-xs text-muted-foreground">
                公开 {publicRepos} · 私有 {privateRepos}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">总 Star 数</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStars}</div>
              <p className="text-xs text-muted-foreground">所有仓库累计</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">开放 PR</CardTitle>
              <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{prs.length}</div>
              <p className="text-xs text-muted-foreground">待处理</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">开放 Issue</CardTitle>
              <CircleDot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{issues.length}</div>
              <p className="text-xs text-muted-foreground">待处理</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* 语言分布 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Languages className="h-4 w-4" />
                主要语言
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topLanguages.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无语言数据</p>
              ) : (
                <div className="space-y-3">
                  {topLanguages.map(([lang, count]) => {
                    const pct = Math.round((count / repos.length) * 100);
                    return (
                      <div key={lang} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{lang}</span>
                          <span className="text-muted-foreground">
                            {count} 个 ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Star 排行 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-4 w-4" />
                Top 5 Star
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topStarred.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                <div className="space-y-2">
                  {topStarred.map((repo, i) => (
                    <a
                      key={repo.name}
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between py-1.5 text-sm hover:bg-accent/50 px-2 rounded transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground font-mono text-xs w-5 shrink-0">
                          #{i + 1}
                        </span>
                        <span className="truncate">{repo.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{repo.stargazerCount}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 最近更新 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              最近活跃
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentlyUpdated.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <div className="space-y-2">
                {recentlyUpdated.map((repo) => (
                  <a
                    key={repo.name}
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between py-1.5 text-sm hover:bg-accent/50 px-2 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {repo.primaryLanguage && (
                        <Badge variant="outline" className="text-xxs h-5 px-1.5 shrink-0">
                          {repo.primaryLanguage.name}
                        </Badge>
                      )}
                      <span className="truncate">{repo.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {formatTime(repo.updatedAt)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
