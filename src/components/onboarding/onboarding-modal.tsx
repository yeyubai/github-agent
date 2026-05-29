// First-time user onboarding modal
"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  useEffect(() => {
    if (!open) return;

    fetch("/api/github/repos?limit=1")
      .then(() => setSupabaseStatus("ok"))
      .catch(() => setSupabaseStatus("error"));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/github/token")
      .then((r) => r.json())
      .then((data) => setTokenStatus(data.hasToken ? "ok" : "pending"))
      .catch(() => setTokenStatus("error"));
  }, [open]);

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
    },
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
    },
    {
      id: "deepseek",
      title: "AI 模型连接",
      description: deepseekStatus === "ok"
        ? "DeepSeek API 连接正常"
        : deepseekStatus === "error"
        ? "DeepSeek API 连接失败，请检查 .env.local 中的 DEEPSEEK_API_KEY"
        : "正在检查连接...",
      status: deepseekStatus,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">欢迎使用 GitHub Agent</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            首次使用需要完成以下配置。配置完成后即可开始使用 Agent 对话。
          </p>

          <SetupSteps steps={steps} allComplete={allComplete} />

          {tokenStatus !== "ok" && (
            <div className="space-y-2">
              <Input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx..."
              />
            </div>
          )}
        </div>

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
