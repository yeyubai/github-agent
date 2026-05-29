"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingOverlay, ErrorState, EmptyState } from "@/components/ui/feedback";
import {
  ArrowLeft,
  Star,
  GitFork,
  Eye,
  Code,
  CircleDot,
  GitPullRequest,
  Shield,
  Calendar,
  Languages,
  Users,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  ExternalLink,
  Lock,
  BookOpen,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

// ---- Types ----
interface RepoDetail {
  name: string;
  fullName: string;
  description: string;
  stargazerCount: number;
  forkCount: number;
  primaryLanguage: { name: string } | null;
  updatedAt: string;
  url: string;
  isPrivate: boolean;
  defaultBranchRef: { name: string } | null;
  issues: { totalCount: number } | null;
  pullRequests: { totalCount: number } | null;
  watchers: { totalCount: number } | null;
  licenseInfo: { name: string } | null;
}

interface TreeNode {
  path: string;
  type: "tree" | "blob";
  mode: string;
  size?: number;
}

interface Commit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  author: { login: string } | null;
}

interface FileContent {
  name: string;
  path: string;
  content: string;
  encoding: string;
  size: number;
  download_url: string;
}

interface Contributor {
  login: string;
  contributions: number;
  avatar_url: string;
  html_url: string;
}

// ---- Helpers ----
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Shell: "#89e051",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  "Go Template": "#00ADD8",
};

const getLangColor = (lang: string) => LANG_COLORS[lang] || "#8b949e";

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

// ---- Main Page ----
export default function RepoDetailPage() {
  const router = useRouter();
  const params = useParams<{ slug: string[] }>();
  const [owner, repo] = params?.slug ?? ["", ""];
  const fullName = `${owner}/${repo}`;
  const defaultBranch = "main";

  const [activeTab, setActiveTab] = useState("overview");

  // Detail data
  const [detail, setDetail] = useState<RepoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState("");

  // File browser
  const [treePath, setTreePath] = useState<string[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Record<string, TreeNode[]>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState("");

  // Commits
  const [commits, setCommits] = useState<Commit[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(true);
  const [commitsError, setCommitsError] = useState("");

  // Insights
  const [languages, setLanguages] = useState<Record<string, number>>({});
  const [languagesLoading, setLanguagesLoading] = useState(true);
  const [languagesError, setLanguagesError] = useState("");
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [contributorsLoading, setContributorsLoading] = useState(true);
  const [contributorsError, setContributorsError] = useState("");

  // ---- Fetch functions ----
  const fetchDetail = useCallback(async () => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/detail`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDetail(data);
    } catch (e: any) {
      setDetailError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }, [owner, repo]);

  const fetchTree = useCallback(async (path = "") => {
    setTreeLoading(true);
    setTreeError("");
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/tree?path=${encodeURIComponent(path)}&ref=${defaultBranch}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTreeData(data);
      setSelectedFile(null);
      setFileContent(null);
    } catch (e: any) {
      setTreeError(e.message);
    } finally {
      setTreeLoading(false);
    }
  }, [owner, repo, defaultBranch]);

  const fetchFile = useCallback(async (filePath: string) => {
    setFileLoading(true);
    setFileError("");
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/file?path=${encodeURIComponent(filePath)}&ref=${defaultBranch}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFileContent(data);
    } catch (e: any) {
      setFileError(e.message);
    } finally {
      setFileLoading(false);
    }
  }, [owner, repo, defaultBranch]);

  const fetchCommits = useCallback(async () => {
    setCommitsLoading(true);
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/commits?limit=20`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCommits(data);
    } catch (e: any) {
      setCommitsError(e.message);
    } finally {
      setCommitsLoading(false);
    }
  }, [owner, repo]);

  const fetchLanguages = useCallback(async () => {
    setLanguagesLoading(true);
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/languages`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLanguages(data);
    } catch (e: any) {
      setLanguagesError(e.message);
    } finally {
      setLanguagesLoading(false);
    }
  }, [owner, repo]);

  const fetchContributors = useCallback(async () => {
    setContributorsLoading(true);
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/contributors?limit=10`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setContributors(data);
    } catch (e: any) {
      setContributorsError(e.message);
    } finally {
      setContributorsLoading(false);
    }
  }, [owner, repo]);

  // ---- Effects ----
  useEffect(() => {
    if (!owner || !repo) return;
    fetchDetail();
    fetchTree();
    fetchCommits();
    fetchLanguages();
    fetchContributors();
  }, [owner, repo, fetchDetail, fetchTree, fetchCommits, fetchLanguages, fetchContributors]);

  // ---- File browser navigation ----
  const navigateToDir = (dirPath: string) => {
    setTreePath(dirPath ? dirPath.split("/") : []);
    fetchTree(dirPath);
  };

  const toggleExpandDir = async (node: TreeNode) => {
    if (expandedDirs[node.path]) {
      const next = { ...expandedDirs };
      delete next[node.path];
      setExpandedDirs(next);
      return;
    }
    try {
      const res = await fetch(`/api/github/repos/${owner}/${repo}/tree?path=${encodeURIComponent(node.path)}&ref=${defaultBranch}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExpandedDirs(prev => ({ ...prev, [node.path]: data }));
    } catch {
      // silently fail
    }
  };

  const handleFileClick = (filePath: string) => {
    setSelectedFile(filePath);
    fetchFile(filePath);
  };

  const breadcrumb = () => (
    <div className="flex items-center gap-1 text-sm mb-3 flex-wrap">
      <button onClick={() => navigateToDir("")} className="text-muted-foreground hover:text-foreground flex items-center gap-1">
        <Folder className="h-3.5 w-3.5" /> {repo}
      </button>
      {treePath.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <button
            onClick={() => navigateToDir(treePath.slice(0, i + 1).join("/"))}
            className="text-muted-foreground hover:text-foreground"
          >
            {seg}
          </button>
        </span>
      ))}
    </div>
  );

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isDir = node.type === "tree";
    const isExpanded = expandedDirs[node.path];
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm hover:bg-accent/50 transition-colors ${isSelected ? "bg-accent" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => isDir ? toggleExpandDir(node) : handleFileClick(node.path)}
        >
          {isDir ? (
            <>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <Folder className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="truncate">{node.path.split("/").pop()}</span>
            </>
          ) : (
            <>
              <span className="w-3.5 shrink-0" />
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{node.path.split("/").pop()}</span>
              {node.size !== undefined && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {node.size < 1024 ? `${node.size} B` : `${(node.size / 1024).toFixed(1)} KB`}
                </span>
              )}
            </>
          )}
        </div>
        {isDir && isExpanded && (
          <div>
            {isExpanded.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const getFileExtension = (filename: string) => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  };

  const decodedContent = fileContent?.encoding === "base64"
    ? (() => { try { return atob(fileContent.content); } catch { return fileContent.content; } })()
    : fileContent?.content || "";

  const showFilePreview = selectedFile && fileContent && decodedContent.split("\n").length <= 300;

  // ---- Loading state ----
  if (detailLoading && !detail) {
    return <AppShell><LoadingOverlay text="正在加载仓库详情..." /></AppShell>;
  }

  if (detailError && !detail) {
    return <AppShell><ErrorState message={detailError} action={{ label: "重试", onClick: fetchDetail }} /></AppShell>;
  }

  if (!detail) {
    return <AppShell><EmptyState description="找不到该仓库" /></AppShell>;
  }

  // ---- Pie chart data ----
  const langData = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));
  const totalBytes = langData.reduce((s, d) => s + d.value, 0);

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/repos">
              <Button variant="ghost" size="sm" className="gap-1">
                <ArrowLeft className="h-4 w-4" /> 返回
              </Button>
            </Link>
          </div>

          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-xl font-bold">{fullName}</h1>
            {detail.isPrivate && (
              <Badge variant="secondary" className="text-xs">
                <Lock className="h-3 w-3 mr-1" /> 私有
              </Badge>
            )}
            <a href={detail.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {detail.description && (
            <p className="text-sm text-muted-foreground">{detail.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{formatNumber(detail.stargazerCount)}</span>
            <span className="flex items-center gap-1"><GitFork className="h-3.5 w-3.5" />{formatNumber(detail.forkCount)}</span>
            {detail.watchers?.totalCount != null && (
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatNumber(detail.watchers.totalCount)}</span>
            )}
            {detail.issues?.totalCount != null && (
              <span className="flex items-center gap-1"><CircleDot className="h-3.5 w-3.5" />{formatNumber(detail.issues.totalCount)} issues</span>
            )}
            {detail.pullRequests?.totalCount != null && (
              <span className="flex items-center gap-1"><GitPullRequest className="h-3.5 w-3.5" />{formatNumber(detail.pullRequests.totalCount)} PRs</span>
            )}
            {detail.primaryLanguage && (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getLangColor(detail.primaryLanguage.name) }} />
                {detail.primaryLanguage.name}
              </span>
            )}
            {detail.defaultBranchRef && (
              <span className="flex items-center gap-1"><Code className="h-3.5 w-3.5" />{detail.defaultBranchRef.name}</span>
            )}
            {detail.licenseInfo && (
              <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" />{detail.licenseInfo.name}</span>
            )}
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />更新于 {formatTime(detail.updatedAt)}</span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="w-fit">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="files">文件</TabsTrigger>
            <TabsTrigger value="commits">提交</TabsTrigger>
            <TabsTrigger value="insights">洞察</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="mt-4">
              {detailLoading ? (
                <LoadingOverlay />
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {/* README */}
                  <div className="md:col-span-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <BookOpen className="h-4 w-4" /> README
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ReadmeSection owner={owner} repo={repo} />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Stats */}
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">快速信息</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">仓库类型</span><span>{detail.isPrivate ? "私有" : "公开"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">默认分支</span><span>{detail.defaultBranchRef?.name || "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">许可证</span><span>{detail.licenseInfo?.name || "无"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">主语言</span><span>{detail.primaryLanguage?.name || "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">最近更新</span><span>{formatTime(detail.updatedAt)}</span></div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">统计</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3 text-center">
                        <div>
                          <div className="text-xl font-bold">{formatNumber(detail.stargazerCount)}</div>
                          <div className="text-xs text-muted-foreground">Stars</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold">{formatNumber(detail.forkCount)}</div>
                          <div className="text-xs text-muted-foreground">Forks</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold">{formatNumber(detail.watchers?.totalCount ?? 0)}</div>
                          <div className="text-xs text-muted-foreground">Watchers</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold">{formatNumber(detail.issues?.totalCount ?? 0)}</div>
                          <div className="text-xs text-muted-foreground">Issues</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files">
            <div className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {breadcrumb()}
                  {treeError && <ErrorState message={treeError} action={{ label: "重试", onClick: () => fetchTree(treePath.join("/")) }} />}
                  {treeLoading ? (
                    <LoadingOverlay />
                  ) : treeData.length === 0 ? (
                    <EmptyState description="该目录为空" />
                  ) : (
                    <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
                      {treeData
                        .filter(n => n.type === "tree")
                        .sort((a, b) => a.path.localeCompare(b.path))
                        .map(node => renderTreeNode(node))}
                      {treeData
                        .filter(n => n.type === "blob")
                        .sort((a, b) => a.path.localeCompare(b.path))
                        .map(node => renderTreeNode(node))}
                    </div>
                  )}

                  {/* File preview */}
                  {selectedFile && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {selectedFile.split("/").pop()}
                          <span className="text-xs text-muted-foreground">
                            {fileContent?.size ? `${(fileContent.size / 1024).toFixed(1)} KB` : ""}
                          </span>
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedFile(null); setFileContent(null); }}>
                          关闭
                        </Button>
                      </div>
                      {fileLoading ? (
                        <LoadingOverlay />
                      ) : fileError ? (
                        <ErrorState message={fileError} action={{ label: "重试", onClick: () => fetchFile(selectedFile) }} />
                      ) : fileContent ? (
                        showFilePreview ? (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="bg-muted px-3 py-1 text-xs text-muted-foreground border-b">
                              {getFileExtension(selectedFile) || "text"}
                            </div>
                            <pre className="p-4 text-xs overflow-x-auto max-h-[400px]">
                              <code className={`language-${getFileExtension(selectedFile) || "text"}`}>{decodedContent}</code>
                            </pre>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                            文件过大，无法预览。
                            <a href={fileContent.download_url} target="_blank" rel="noopener noreferrer" className="text-primary underline ml-1">在 GitHub 查看</a>
                          </div>
                        )
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Commits Tab */}
          <TabsContent value="commits">
            <div className="mt-4">
              {commitsLoading ? (
                <LoadingOverlay text="正在加载提交记录..." />
              ) : commitsError ? (
                <ErrorState message={commitsError} action={{ label: "重试", onClick: fetchCommits }} />
              ) : commits.length === 0 ? (
                <EmptyState description="暂无提交记录" />
              ) : (
                <Card>
                  <CardContent className="p-0 divide-y">
                    {commits.map((commit) => (
                      <div key={commit.sha} className="px-4 py-3 flex items-start gap-3 hover:bg-accent/50 transition-colors">
                        <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 mt-0.5">
                          {commit.sha.slice(0, 7)}
                        </code>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{commit.commit.message.split("\n")[0]}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {commit.author?.login || commit.commit.author.name} · {formatTime(commit.commit.author.date)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights">
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {/* Language distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Languages className="h-4 w-4" /> 语言分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {languagesLoading ? (
                    <LoadingOverlay />
                  ) : languagesError ? (
                    <ErrorState message={languagesError} action={{ label: "重试", onClick: fetchLanguages }} />
                  ) : langData.length === 0 ? (
                    <EmptyState description="暂无语言数据" />
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-48 h-48 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={langData}
                              cx="50%" cy="50%"
                              innerRadius={40} outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {langData.map((entry, i) => (
                                <Cell key={i} fill={getLangColor(entry.name)} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value) => value != null ? `${((Number(value) / totalBytes) * 100).toFixed(1)}%` : "0%"} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 flex-1">
                        {langData.map(({ name, value }) => (
                          <div key={name} className="flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getLangColor(name) }} />
                            <span className="flex-1 truncate">{name}</span>
                            <span className="text-muted-foreground">{((value / totalBytes) * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contributors */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" /> 贡献者 Top 10
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contributorsLoading ? (
                    <LoadingOverlay />
                  ) : contributorsError ? (
                    <ErrorState message={contributorsError} action={{ label: "重试", onClick: fetchContributors }} />
                  ) : contributors.length === 0 ? (
                    <EmptyState description="暂无贡献者数据" />
                  ) : (
                    <div className="space-y-2">
                      {contributors.map((c, i) => (
                        <a
                          key={c.login}
                          href={c.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors"
                        >
                          <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">#{i + 1}</span>
                          <img src={c.avatar_url} alt={c.login} className="w-6 h-6 rounded-full" />
                          <span className="flex-1 text-sm truncate">{c.login}</span>
                          <span className="text-xs text-muted-foreground">{c.contributions} 次</span>
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ---- README component (separate to avoid re-rendering the whole page) ----
function ReadmeSection({ owner, repo }: { owner: string; repo: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/github/repos/${owner}/${repo}/file?path=README.md&ref=main`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        if (data.encoding === "base64") {
          try { setContent(atob(data.content)); } catch { setContent(data.content); }
        } else {
          setContent(data.content);
        }
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [owner, repo]);

  if (loading) return <LoadingOverlay text="加载 README..." />;
  if (error || !content) return <p className="text-sm text-muted-foreground">暂无 README</p>;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
