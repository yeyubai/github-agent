// src/components/chat/quick-actions.tsx
// One-click action buttons for killer features
"use client";

import { Button } from "@/components/ui/button";
import { FileText, Calendar, ClipboardList, Search, GitCommit, Sparkles } from "lucide-react";

interface QuickActionsProps {
  onAction: (action: string) => void;
  disabled: boolean;
}

const ACTIONS = [
  { id: "daily", label: "生成日报", icon: FileText, prompt: "帮我生成今天的日报" },
  { id: "weekly", label: "生成周报", icon: Calendar, prompt: "帮我生成本周的周报" },
  { id: "todos", label: "我的待办", icon: ClipboardList, prompt: "我现在有哪些待办事项？" },
  { id: "health", label: "项目健康度", icon: Search, prompt: "帮我分析所有仓库的项目健康度" },
  { id: "summary", label: "代码摘要", icon: GitCommit, prompt: "帮我总结一下最近的代码变更" },
];

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="px-3 py-2 border-b bg-muted/30">
      <div className="flex items-center gap-1 mb-2">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">快捷操作</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map(({ id, label, icon: Icon, prompt }) => (
          <Button
            key={id}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            disabled={disabled}
            onClick={() => onAction(prompt)}
          >
            <Icon className="h-3 w-3 mr-1" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
