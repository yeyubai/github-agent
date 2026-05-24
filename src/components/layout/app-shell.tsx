"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { useState, useCallback } from "react";
import { MessageSquareCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_CHAT_WIDTH = 320;
const MIN_CHAT_WIDTH = 260;
const MAX_CHAT_WIDTH = 600;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = chatWidth;

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      setChatWidth(Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, startWidth + delta)));
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [chatWidth]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b">
          <div />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setChatOpen(!chatOpen)}
          >
            {chatOpen ? <X className="h-4 w-4" /> : <MessageSquareCode className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-auto p-6">{children}</div>
          {chatOpen && (
            <>
              <div
                className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors shrink-0"
                onMouseDown={startResize}
                role="separator"
                aria-orientation="vertical"
                title="拖拽调整宽度"
              />
              <div style={{ width: chatWidth }} className="flex flex-col border-l overflow-hidden shrink-0">
                <ChatPanel />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
