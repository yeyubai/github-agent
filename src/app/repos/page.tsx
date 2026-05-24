"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay, ErrorState, EmptyState } from "@/components/ui/feedback";
import {
  Search,
  Star,
  GitFork,
  Eye,
  ExternalLink,
  Languages,
  Clock,
  Lock,
  EyeOff,
  ChevronDown,
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

type SortKey = "stars" | "updated" | "name";

const LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C",
  "C++",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Shell",
];

export default function ReposPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 筛选/排序
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [visibility, setVisibility] = useState<"all" | "public" | "private">("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/github/repos?limit=100")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setRepos(data);
        }
      })
      .catch(() => setError("获取仓库失败，请检查 gh CLI 状态"))
      .finally(() => setLoading(false));
  }, []);

  // 前端过滤 + 排序
  const filtered = repos
    .filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    })
    .filter((r) => {
      if (language && r.primaryLanguage) {
        return r.primaryLanguage.name === language;
      }
      return true;
    })
    .filter((r) => {
      if (visibility === "public") return !r.isPrivate;
      if (visibility === "private") return r.isPrivate;
      return true;
    })
    .toSorted((a, b) => {
      const mult = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "stars") return (a.stargazerCount - b.stargazerCount) * mult;
      if (sortKey === "updated") return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * mult;
      return a.name.localeCompare(b.name) * mult;
    });

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 周前`;
    if (days < 365) return `${Math.floor(days / 30)} 个月前`;
    return `${Math.floor(days / 365)} 年前`;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">仓库列表</h1>
          <Badge variant="outline" className="text-xs">
            {filtered.length} / {repos.length}
          </Badge>
        </div>

        {error && (
          <ErrorState
            message={error}
            action={{ label: "重试", onClick: () => window.location.reload() }}
          />
        )}

        {/* 筛选栏 */}
        {repos.length > 0 && (
          <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* 搜索 */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索仓库名称或描述..."
                  className="pl-9"
                />
              </div>

              {/* 语言过滤 */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm bg-background h-9 min-w-[120px]"
              >
                <option value="">全部语言</option>
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>

              {/* 可见性 */}
              <div className="flex gap-1">
                {(["all", "public", "private"] as const).map((v) => (
                  <Button
                    key={v}
                    variant={visibility === v ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setVisibility(v)}
                  >
                    {v === "all" && "全部"}
                    {v === "public" && (
                      <>
                        <Eye className="h-3 w-3 mr-1" /> 公开
                      </>
                    )}
                    {v === "private" && (
                      <>
                        <EyeOff className="h-3 w-3 mr-1" /> 私有
                      </>
                    )}
                  </Button>
                ))}
              </div>

              {/* 排序 */}
              <div className="flex items-center gap-1">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="border rounded-md px-2 py-1.5 text-sm bg-background h-8"
                >
                  <option value="updated">更新时间</option>
                  <option value="stars">Star 数</option>
                  <option value="name">名称</option>
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`}
                  />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* 仓库列表 */}
        {loading ? (
          <LoadingOverlay text="正在获取仓库列表..." />
        ) : repos.length === 0 && !error ? (
          <EmptyState
            title="暂无仓库"
            description="当前 GitHub 账号下没有仓库数据"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="没有匹配的结果"
            description="尝试调整搜索词、语言或可见性筛选条件"
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((repo) => (
              <a
                key={repo.name}
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{repo.name}</span>
                      {repo.isPrivate && (
                        <Badge variant="secondary" className="text-xxs h-5 px-1.5">
                          <Lock className="h-2.5 w-2.5 mr-0.5" />
                          私有
                        </Badge>
                      )}
                      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {repo.primaryLanguage && (
                        <span className="flex items-center gap-1">
                          <Languages className="h-3 w-3" />
                          {repo.primaryLanguage.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repo.stargazerCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="h-3 w-3" />
                        —
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(repo.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
