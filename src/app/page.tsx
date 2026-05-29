"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingOverlay, ErrorState, EmptyState } from "@/components/ui/feedback";
import { LanguageSelect } from "@/components/ui/language-select";
import { GitBranch, GitPullRequest, CircleDot, Search, Loader2, Star, GitFork, ExternalLink, Languages } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Stats {
  repos: number;
  prs: number;
  issues: number;
}

interface RepoResult {
  fullName: string;
  description: string | null;
  stargazerCount: number;
  forksCount: number;
  primaryLanguage: { name: string } | null;
  updatedAt: string;
  url: string;
}

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ repos: 0, prs: 0, issues: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 搜索状态
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [language, setLanguage] = useState("");
  const [results, setResults] = useState<RepoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const pageLimit = 20;

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
  }, []);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;

    setSearching(true);
    setSearchError("");
    setResults([]);
    setHasMore(true);

    const params = new URLSearchParams({ q: searchInput.trim() });
    if (language) params.set("lang", language);
    params.set("limit", String(pageLimit));

    try {
      const res = await fetch(`/api/github/repos/search?${params}`);
      const data = await res.json();

      if (data.error) {
        setSearchError(data.error);
      } else {
        setResults(data);
        setHasMore(data.length >= pageLimit);
        setQuery(searchInput.trim());
      }
    } catch {
      setSearchError("搜索失败，请检查 gh CLI 状态");
    } finally {
      setSearching(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const skip = results.length;
    const params = new URLSearchParams({ q: query });
    if (language) params.set("lang", language);
    params.set("limit", String(pageLimit));
    params.set("offset", String(skip));

    try {
      const res = await fetch(`/api/github/repos/search?${params}`);
      const data = await res.json();
      if (data.error) {
        setSearchError(data.error);
      } else {
        setResults(prev => [...prev, ...data]);
        setHasMore(data.length >= pageLimit);
      }
    } catch {
      setSearchError("加载更多失败");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">概览</h1>

        {error ? (
          <ErrorState
            message={error}
            action={{ label: "重试", onClick: () => window.location.reload() }}
          />
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
                <p className="text-xs text-muted-foreground">我的仓库总数</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pull Requests</CardTitle>
                <GitPullRequest className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.prs}</div>
                <p className="text-xs text-muted-foreground">开放的 PR</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Issues</CardTitle>
                <CircleDot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.issues}</div>
                <p className="text-xs text-muted-foreground">开放的 Issue</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 项目搜索 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              搜索项目
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="搜索关键词，如 react、machine learning、nextjs..."
                className="flex-1"
                disabled={searching}
              />
              <LanguageSelect
                value={language}
                onChange={setLanguage}
                disabled={searching}
              />
              <Button onClick={handleSearch} disabled={searching || !searchInput.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "搜索"}
              </Button>
            </div>

            {searchError && (
              <ErrorState message={searchError} />
            )}

            {results.length > 0 && (
              <div className="text-sm text-muted-foreground">
                找到 {results.length} 个项目，关键词：{query}
                {language ? `，语言：${language}` : ""}
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((repo) => (
                  <a
                    key={repo.fullName}
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm truncate">
                            {repo.fullName}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        </div>
                        {repo.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {repo.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {repo.primaryLanguage && (
                        <span className="flex items-center gap-1">
                          <Languages className="h-3 w-3" />
                          {repo.primaryLanguage.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repo.stargazerCount.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        {repo.forksCount.toLocaleString()}
                      </span>
                    </div>
                  </a>
                ))}
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      加载更多 ({results.length} 已加载)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => {
                setSearchInput("");
                document.querySelector<HTMLInputElement>('input[placeholder*="搜索关键词"]')?.focus();
              }}
            >
              搜索项目
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-accent"
              onClick={() => router.push("/repos")}
            >
              查看仓库列表
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              检查我的 PR
            </Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              浏览开放 Issue
            </Badge>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}