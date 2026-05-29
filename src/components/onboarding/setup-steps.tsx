// Step-by-step configuration guide for first-time users
"use client";

import { Check, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type SetupStatus = "pending" | "checking" | "ok" | "error";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  status: SetupStatus;
  action?: { label: string; onClick: () => void };
  link?: { label: string; url: string };
}

interface SetupStepsProps {
  steps: SetupStep[];
  allComplete: boolean;
}

export function SetupSteps({ steps, allComplete }: SetupStepsProps) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {step.status === "ok" ? (
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
            ) : step.status === "checking" ? (
              <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
              </div>
            ) : step.status === "error" ? (
              <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center">
                <AlertCircle className="h-3.5 w-3.5 text-white" />
              </div>
            ) : (
              <div className={cn("h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium")}>
                {i + 1}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{step.title}</span>
              {step.status === "ok" && (
                <Badge className="bg-green-500 h-4 px-1 text-[10px]">已完成</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>

            {step.link && (
              <a
                href={step.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
              >
                {step.link.label}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}

            {step.action && step.status !== "ok" && (
              <Button
                size="sm"
                className="h-7 text-xs mt-2"
                onClick={step.action.onClick}
                disabled={step.status === "checking"}
              >
                {step.status === "checking" ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                {step.action.label}
              </Button>
            )}
          </div>
        </div>
      ))}

      {allComplete && (
        <div className="text-center py-2 text-sm text-green-600 font-medium">
          所有配置已完成，可以开始使用！
        </div>
      )}
    </div>
  );
}
