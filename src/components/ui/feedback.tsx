import { Loader2 } from "lucide-react";

/** 加载中覆盖层 — 用于全屏加载状态 */
export function LoadingOverlay({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

/** 错误提示卡片 */
export function ErrorState({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-destructive font-medium text-sm">
          {title ?? "出错了"}
        </span>
      </div>
      <p className="text-sm text-destructive/80">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm text-destructive underline underline-offset-2 hover:no-underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** 空状态 */
export function EmptyState({ title, description }: { title?: string; description: string }) {
  return (
    <div className="rounded-lg border p-8 text-center space-y-2">
      <p className="font-medium text-muted-foreground">{title ?? "暂无数据"}</p>
      <p className="text-sm text-muted-foreground/70">{description}</p>
    </div>
  );
}
