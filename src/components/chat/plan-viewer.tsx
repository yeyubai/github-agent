// src/components/chat/plan-viewer.tsx
// Displays a multi-step plan with approve/reject controls
"use client";

import { Check, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MultiStepPlanType } from "@/lib/planner";

interface PlanViewerProps {
  plan: MultiStepPlanType;
  onApprove: () => void;
  onReject: () => void;
  status: "pending" | "approved" | "rejected";
}

export function PlanViewer({ plan, onApprove, onReject, status }: PlanViewerProps) {
  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
         执行计划 ({plan.steps.length} 步)
        {!plan.autoExecute && (
          <span className="ml-2 text-orange-500">⚠ 包含写操作</span>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded">
        {plan.summary}
      </div>

      <div className="space-y-1">
        {plan.steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 text-xs px-2 py-1.5 rounded font-mono",
              "bg-background/30 border-l-2",
              step.toolName.includes("create") || step.toolName.includes("merge") || step.toolName.includes("close") || step.toolName.includes("comment") || step.toolName.includes("update")
                ? "border-orange-400"
                : "border-green-400"
            )}
          >
            <span className="text-muted-foreground shrink-0">{i + 1}.</span>
            <div className="min-w-0">
              <div className="text-muted-foreground">{step.toolName}</div>
              <div className="text-foreground">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      {status === "pending" && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs" onClick={onApprove}>
            <Play className="h-3 w-3 mr-1" />
            执行计划
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onReject}>
            <X className="h-3 w-3 mr-1" />
            取消
          </Button>
        </div>
      )}

      {status === "approved" && (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <Check className="h-3 w-3" />
          计划已批准，正在执行...
        </div>
      )}

      {status === "rejected" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground line-through opacity-60">
          <X className="h-3 w-3" />
          计划已取消
        </div>
      )}
    </div>
  );
}
