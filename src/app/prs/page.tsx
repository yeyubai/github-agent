"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay, ErrorState, EmptyState } from "@/components/ui/feedback";
import {
  Search,
  ExternalLink,
  GitPullRequest,
  MessageSquare,
  User,
  Clock,
  GitMerge,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

interface PR {
  number: number;
  title: string;
  state: string;
  isDraft?: boolean;
  author: { login: string };
  createdAt: string;
  url: string;
  labels: { name: string }[];
}

export default function PRsPage() {
  const [prs, setPRs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [state, setState] = useState<"open" | "closed" | "merged">("open");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    fetch(`/api/github/prs?state=${state}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPRs(data);
      })
      .catch(() => setError("获取 PR 失败，请检查 gh CLI 状态"))
      .finally(() => setLoading(false));
  }, [state]);

  const filtered = prs.filter((pr) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        pr.title.toLowerCase().includes(q) ||
        pr.author?.login?.toLowerCase().includes(q) ||
        String(pr.number).includes(q)
      );
    }
    return true;
  }).filter((pr) => {
    if (author) return pr.author?.login?.toLowerCase().includes(author.toLowerCase());
    return true;
  });

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 周前`;
    return `${Math.floor(days / 30)} 个月前`;
  };

  const stateIcon = (pr: PR) => {
    if (pr.state === "MERGED") return <GitMerge className="h-4 w-4 text-purple-500" />;
    if (pr.state === "CLOSED") return <AlertCircle className="h-4 w-4 text-red-500" />;
    if (pr.isDraft) return <Clock className="h-4 w-4 text-yellow-500" />;
    return <GitPullRequest className="h-4 w-4 text-green-500" />;
  };

  const stateLabel = (pr: PR) => {
    if (pr.state === "MERGED") return <Badge className="bg-purple-500 text-white">已合并</Badge>;
    if (pr.state === "CLOSED") return <Badge variant="destructive">已关闭</Badge>;
    if (pr.isDraft) return <Badge variant="outline" className="text-yellow-600">草稿</Badge>;
    return <Badge className="bg-green-500 text-white">开放中</Badge>;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pull Requests</h1>
          <Badge variant="outline" className="text-xs">
            {filtered.length} 条
          </Badge>
        </div>

        {error && <ErrorState message={error} action={{ label: "重试", onClick: () => window.location.reload() }} />}

        {/* 筛选栏 */}
        {!loading && prs.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索标题、作者或编号..."
                    className="pl-9"
                  />
                </div>

                <div className="flex gap-1">
                  {(["open", "closed", "merged"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={state === s ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setState(s)}
                    >
                      {s === "open" && "开放"}
                      {s === "closed" && "已关闭"}
                      {s === "merged" && "已合并"}
                    </Button>
                  ))}
                </div>

                <Input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="按作者筛选..."
                  className="w-40 h-8 text-sm"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* PR 列表 */}
        {loading ? (
          <LoadingOverlay text="正在获取 PR 列表..." />
        ) : prs.length === 0 && !error ? (
          <EmptyState title="暂无 PR" description="当前没有符合条件的 Pull Request" />
        ) : filtered.length === 0 ? (
          <EmptyState title="没有匹配的结果" description="尝试调整搜索词或筛选条件" />
        ) : (
          <div className="space-y-2">
            {filtered.map((pr) => (
              <a
                key={`${pr.number}-${pr.title}`}
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{stateIcon(pr)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{pr.title}</span>
                      {stateLabel(pr)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>#{pr.number}</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {pr.author?.login ?? "未知"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(pr.createdAt)}
                      </span>
                      {pr.labels?.length > 0 && (
                        <div className="flex gap-1">
                          {pr.labels.slice(0, 3).map((l) => (
                            <Badge key={l.name} variant="outline" className="text-xxs h-5 px-1">
                              {l.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
