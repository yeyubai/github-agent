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
  CircleDot,
  MessageSquare,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Issue {
  number: number;
  title: string;
  state: string;
  author: { login: string };
  createdAt: string;
  url: string;
  labels: { name: string; color: string }[];
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [state, setState] = useState<"open" | "closed">("open");
  const [author, setAuthor] = useState("");

  useEffect(() => {
    fetch(`/api/github/issues?state=${state}&limit=100`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setIssues(data);
      })
      .catch(() => setError("获取 Issue 失败，请检查 gh CLI 状态"))
      .finally(() => setLoading(false));
  }, [state]);

  const filtered = issues.filter((issue) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        issue.title.toLowerCase().includes(q) ||
        issue.author?.login?.toLowerCase().includes(q) ||
        String(issue.number).includes(q)
      );
    }
    return true;
  }).filter((issue) => {
    if (author) return issue.author?.login?.toLowerCase().includes(author.toLowerCase());
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

  const stateIcon = (issue: Issue) => {
    if (issue.state === "CLOSED") return <AlertCircle className="h-4 w-4 text-red-500" />;
    return <CircleDot className="h-4 w-4 text-green-500" />;
  };

  const stateLabel = (issue: Issue) => {
    if (issue.state === "CLOSED") return <Badge variant="destructive">已关闭</Badge>;
    return <Badge className="bg-green-500 text-white">开放中</Badge>;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Issues</h1>
          <Badge variant="outline" className="text-xs">
            {filtered.length} 条
          </Badge>
        </div>

        {error && <ErrorState message={error} action={{ label: "重试", onClick: () => window.location.reload() }} />}

        {/* 筛选栏 */}
        {!loading && issues.length > 0 && (
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
                  {(["open", "closed"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={state === s ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setState(s)}
                    >
                      {s === "open" && "开放"}
                      {s === "closed" && "已关闭"}
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

        {/* Issue 列表 */}
        {loading ? (
          <LoadingOverlay text="正在获取 Issue 列表..." />
        ) : issues.length === 0 && !error ? (
          <EmptyState title="暂无 Issue" description="当前没有符合条件的 Issue" />
        ) : filtered.length === 0 ? (
          <EmptyState title="没有匹配的结果" description="尝试调整搜索词或筛选条件" />
        ) : (
          <div className="space-y-2">
            {filtered.map((issue) => (
              <a
                key={`${issue.number}-${issue.title}`}
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{stateIcon(issue)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{issue.title}</span>
                      {stateLabel(issue)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>#{issue.number}</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {issue.author?.login ?? "未知"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(issue.createdAt)}
                      </span>
                      {issue.labels?.length > 0 && (
                        <div className="flex gap-1">
                          {issue.labels.slice(0, 3).map((l) => (
                            <Badge
                              key={l.name}
                              variant="outline"
                              className="text-xxs h-5 px-1"
                              style={{ borderColor: l.color ? `#${l.color}` : undefined }}
                            >
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
