"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Key,
  Terminal,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Copy,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useState, useEffect } from "react";
import { DEFAULT_PROMPT, buildSystemPrompt } from "@/lib/prompt-config";

const PROMPT_KEY = "github-agent-prompt";

export default function SettingsPage() {
  const [deepseekKey, setDeepseekKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  // Prompt 编辑器状态
  const [role, setRole] = useState(DEFAULT_PROMPT.role);
  const [toolDesc, setToolDesc] = useState(DEFAULT_PROMPT.toolDescription);
  const [workflow, setWorkflow] = useState(DEFAULT_PROMPT.workflow);
  const [replyStyle, setReplyStyle] = useState(DEFAULT_PROMPT.replyStyle);
  const [saved, setSaved] = useState(false);

  // 加载已保存的 prompt
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROMPT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setRole(parsed.role ?? DEFAULT_PROMPT.role);
        setToolDesc(parsed.toolDescription ?? DEFAULT_PROMPT.toolDescription);
        setWorkflow(parsed.workflow ?? DEFAULT_PROMPT.workflow);
        setReplyStyle(parsed.replyStyle ?? DEFAULT_PROMPT.replyStyle);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSavePrompt = () => {
    const config = { role, toolDescription: toolDesc, workflow, replyStyle };
    localStorage.setItem(PROMPT_KEY, JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetPrompt = () => {
    setRole(DEFAULT_PROMPT.role);
    setToolDesc(DEFAULT_PROMPT.toolDescription);
    setWorkflow(DEFAULT_PROMPT.workflow);
    setReplyStyle(DEFAULT_PROMPT.replyStyle);
    localStorage.removeItem(PROMPT_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const previewPrompt = buildSystemPrompt({ role, toolDescription: toolDesc, workflow, replyStyle });

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "你好", sessionId: "test" }),
      });

      if (res.ok) {
        setTestResult("success");
      } else {
        setTestResult("error");
      }
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-container-md">
        <h1 className="text-2xl font-bold">设置</h1>

        {/* AI Prompt 模板 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              Agent Prompt 模板
            </CardTitle>
            <CardDescription>自定义 Agent 的角色、工具说明和工作流程</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">角色定义</label>
              <textarea
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[60px]"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">工具说明</label>
              <textarea
                value={toolDesc}
                onChange={(e) => setToolDesc(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[120px] font-mono text-xs"
                rows={6}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">工作流程</label>
              <textarea
                value={workflow}
                onChange={(e) => setWorkflow(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-y min-h-[60px]"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">回复风格</label>
              <Input
                value={replyStyle}
                onChange={(e) => setReplyStyle(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleSavePrompt}>保存</Button>
              <Button variant="outline" onClick={handleResetPrompt}>
                <RotateCcw className="h-4 w-4 mr-1" />
                恢复默认
              </Button>
              {saved && (
                <Badge className="bg-green-500">已保存</Badge>
              )}
            </div>

            {/* 预览 */}
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs font-medium mb-2 text-muted-foreground">预览（组合后的 System Prompt）：</p>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                {previewPrompt}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* AI 配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4" />
              AI 模型配置
            </CardTitle>
            <CardDescription>配置 DeepSeek API Key</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button onClick={handleTestKey} disabled={testing}>
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
                API Key 存储在服务器的 <code className="bg-background px-1 rounded">.env.local</code> 文件中。
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* GitHub 配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" />
              GitHub CLI 状态
            </CardTitle>
            <CardDescription>gh CLI 用于执行所有 GitHub 操作</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">安装/登录 gh CLI：</p>
              <code className="block bg-background px-2 py-1 rounded font-mono mt-1">
                gh auth login
              </code>
              <p className="mt-2">按提示选择 GitHub.com → HTTPS → 浏览器登录</p>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* 关于 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">关于</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">版本</span>
                <p className="font-medium">0.1.0</p>
              </div>
              <div>
                <span className="text-muted-foreground">框架</span>
                <p className="font-medium">Next.js 16</p>
              </div>
              <div>
                <span className="text-muted-foreground">AI 引擎</span>
                <p className="font-medium">DeepSeek Chat</p>
              </div>
              <div>
                <span className="text-muted-foreground">GitHub 集成</span>
                <p className="font-medium">GitHub CLI</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
