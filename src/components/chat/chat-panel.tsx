"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Bot, User, Loader2, Trash2, ChevronDown, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PlanViewer } from "./plan-viewer";
import { QuickActions } from "./quick-actions";
import type { AgentPromptConfig } from "@/lib/prompt-config";
import type { MultiStepPlanType } from "@/lib/planner";

const STORAGE_KEY = "github-agent-chat-history";
const SESSION_KEY = "github-agent-session-id";
const PROMPT_KEY = "github-agent-prompt";
const SCROLL_THRESHOLD = 80;

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  reasoningDone?: boolean;
  toolCall?: ToolCall;
  commandStatus?: "pending" | "executing" | "done" | "cancelled";
  plan?: MultiStepPlanType;
  planStatus?: "pending" | "approved" | "rejected";
}

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ");
}

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSavedPromptConfig(): AgentPromptConfig | undefined {
  try {
    const saved = localStorage.getItem(PROMPT_KEY);
    return saved ? JSON.parse(saved) : undefined;
  } catch {
    return undefined;
  }
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body prose prose-sm max-w-none dark:prose-invert [&_*:first-child]:mt-0 [&_*:last-child]:mb-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:text-xs prose-a:text-blue-500 prose-a:no-underline prose-headings:mt-3 prose-headings:mb-2 prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-hr:my-3 prose-blockquote:my-2 prose-table:my-2 prose-thead:bg-muted/50">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className;
            return isInline ? (
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs" {...props}>
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const isUserNearBottom = useRef(true);
  const queueRef = useRef<{ message: string; toolCall?: ToolCall }[]>([]);

  // 初始化 sessionId
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = generateSessionId();
      localStorage.setItem(SESSION_KEY, sid);
    }
    setSessionId(sid);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isUserNearBottom.current = distanceFromBottom < SCROLL_THRESHOLD;
      setShowScrollBtn(!isUserNearBottom.current && messages.length > 0);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [messages.length]);

  useEffect(() => {
    if (!isUserNearBottom.current || !scrollContainerRef.current) return;

    const el = scrollContainerRef.current;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [messages]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } else if (messages.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [messages]);

  const handleClear = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    // 重置 sessionId
    const newSid = generateSessionId();
    localStorage.setItem(SESSION_KEY, newSid);
    setSessionId(newSid);
  }, []);

  const processStream = async (
    res: Response,
    assistantId: string,
    onDone?: (content: string) => void
  ) => {
    let assistantContent = "";
    let assistantReasoning = "";
    let assistantToolCall: ToolCall | undefined;
    let assistantPlan: MultiStepPlanType | undefined;
    let lastUpdate = 0;
    const THROTTLE_MS = 32;

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) assistantContent += parsed.content;
            if (parsed.reasoning) assistantReasoning += parsed.reasoning;
            // 提取 tool_call — 新格式: { tool_call: { id, name, args } }
            if (parsed.tool_call && !assistantToolCall) {
              const tc = parsed.tool_call;
              assistantToolCall = {
                id: tc.id || "",
                name: tc.name || "",
                args: tc.args || {},
              };
            }
            // 提取 multi-step plan
            if (parsed.plan) {
              assistantPlan = parsed.plan;
            }
          } catch {
            assistantContent += data;
          }
        }
      }

      // 节流更新
      const now = performance.now();
      if (now - lastUpdate >= THROTTLE_MS) {
        lastUpdate = now;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: assistantContent,
                  reasoning: assistantReasoning,
                  toolCall: assistantToolCall,
                  plan: assistantPlan,
                  planStatus: assistantPlan ? "pending" as const : undefined,
                  commandStatus: assistantToolCall ? "pending" as const : "done" as const,
                }
              : m
          )
        );
      }
    }

    // 最终更新
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? {
              ...m,
              content: assistantContent,
              reasoning: assistantReasoning,
              reasoningDone: true,
              toolCall: assistantToolCall,
              plan: assistantPlan,
              planStatus: assistantPlan ? "pending" as const : undefined,
              commandStatus: assistantToolCall ? "pending" as const : "done" as const,
            }
          : m
      )
    );

    return { content: assistantContent, toolCall: assistantToolCall };
  };

  const handleSend = async (userMessage?: string, toolCall?: ToolCall) => {
    const msg = userMessage ?? input.trim();
    if (!msg && !toolCall) return;

    if (loading) {
      queueRef.current.push({ message: msg, toolCall });
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: msg },
      ]);
      setInput("");
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    });

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const promptConfig = getSavedPromptConfig();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, sessionId, promptConfig }),
      });

      if (!res.ok) throw new Error("请求失败");

      const result = await processStream(res, assistantId);

      // 如果检测到新的 tool_call，自动排队执行
      if (result?.toolCall) {
        // 这是 Agent 在回复中又触发了新的工具调用，需要用户确认
        // 不自动执行，等待用户手动确认
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: "请求失败，请检查 DeepSeek API 配置。",
          commandStatus: "done",
        },
      ]);
    } finally {
      setLoading(false);
      const next = queueRef.current.shift();
      if (next) {
        setLoading(true);
        requestAnimationFrame(() => {
          handleSend(next.message, next.toolCall);
        });
      }
    }
  };

  const handleConfirmCommand = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg?.toolCall) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, commandStatus: "executing" as const } : m
      )
    );

    setLoading(true);
    try {
      const promptConfig = getSavedPromptConfig();
      const res = await fetch("/api/chat/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          confirmed: true,
          toolName: msg.toolCall.name,
          toolArgs: msg.toolCall.args,
          toolCallId: msg.toolCall.id,
          promptConfig,
        }),
      });

      if (!res.ok) throw new Error("请求失败");

      // 确认 API 返回流式结果，需要创建新的 assistant 消息来展示
      const resultAssistantId = (Date.now() + 3).toString();
      setMessages((prev) => [
        ...prev,
        { id: resultAssistantId, role: "assistant", content: "" },
      ]);

      await processStream(res, resultAssistantId);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                content: "命令执行失败，请重试。",
                commandStatus: "done" as const,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCommand = (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg?.toolCall) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, content: "已取消执行。", commandStatus: "done" as const }
          : m
      )
    );
  };

  const handleApprovePlan = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg?.plan) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, planStatus: "approved" as const } : m
      )
    );

    setLoading(true);
    try {
      const promptConfig = getSavedPromptConfig();
      const res = await fetch("/api/chat/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          plan: msg.plan,
          promptConfig,
        }),
      });

      if (!res.ok) throw new Error("请求失败");

      const resultAssistantId = (Date.now() + 3).toString();
      setMessages((prev) => [
        ...prev,
        { id: resultAssistantId, role: "assistant", content: "" },
      ]);

      // Reuse processStream to display the model's analysis
      await processStream(res, resultAssistantId);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, content: "计划执行失败，请重试。", planStatus: "rejected" as const }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectPlan = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? { ...m, content: "已取消执行。", planStatus: "rejected" as const }
          : m
      )
    );
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <Card className="flex flex-col h-full border-0 rounded-none">
      <div className="p-3 border-b font-medium flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Agent 对话
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClear}
            title="清空对话"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <QuickActions onAction={(prompt) => handleSend(prompt)} disabled={loading} />

      <div className="flex-1 overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto p-4 space-y-4"
        >
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              输入指令与 Agent 对话，如 "查看我的仓库列表"
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <Bot className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
              )}
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {/* 思考过程 - 默认展开，流式展示 */}
                {msg.reasoning && msg.role === "assistant" && (
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {!msg.reasoningDone ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-400" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      )}
                      思考过程
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pl-5 border-l-2 border-purple-400/30">
                      {msg.reasoning}
                    </div>
                  </div>
                )}

                {/* 最终回复 */}
                {msg.content && (
                  msg.role === "assistant" ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )
                )}

                {/* 工具调用确认 */}
                {msg.toolCall && msg.commandStatus === "pending" && (
                  <div className="mt-3 space-y-2">
                    <div className="bg-background/50 px-2 py-1.5 rounded text-xs font-mono break-all">
                      <div className="text-muted-foreground mb-1">🔧 调用: {msg.toolCall.name}</div>
                      <code className="text-xs">
                        {JSON.stringify(msg.toolCall.args, null, 2)}
                      </code>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleConfirmCommand(msg.id)}
                      >
                        确认执行
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleCancelCommand(msg.id)}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
                {msg.toolCall && msg.commandStatus === "executing" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    执行命令中...
                  </div>
                )}
                {msg.toolCall && msg.commandStatus === "done" && (
                  <code className="mt-2 block bg-background/50 px-2 py-1.5 rounded text-xs font-mono text-muted-foreground line-through opacity-60">
                    {msg.toolCall.name}
                  </code>
                )}

                {/* 多步计划展示 */}
                {msg.plan && (
                  <PlanViewer
                    plan={msg.plan}
                    onApprove={() => handleApprovePlan(msg.id)}
                    onReject={() => handleRejectPlan(msg.id)}
                    status={msg.planStatus || "pending"}
                  />
                )}
              </div>
              {msg.role === "user" && (
                <User className="h-4 w-4 mt-1 text-primary-foreground shrink-0" />
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">思考中...</span>
            </div>
          )}
        </div>

        {showScrollBtn && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute bottom-4 right-4 h-8 w-8 rounded-full shadow-md"
            onClick={scrollToBottom}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入指令..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={loading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
