"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GitBranch,
  GitPullRequest,
  CircleDot,
  BarChart3,
  MessageSquareCode,
  Settings,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { label: "概览", href: "/", icon: Home },
  { label: "仓库", href: "/repos", icon: GitBranch },
  { label: "PR", href: "/prs", icon: GitPullRequest },
  { label: "Issue", href: "/issues", icon: CircleDot },
  { label: "洞察", href: "/insights", icon: BarChart3 },
  { label: "设置", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 border-r bg-sidebar flex flex-col h-full">
      <div className="p-4 flex items-center gap-2 border-b">
        <MessageSquareCode className="h-5 w-5 text-sidebar-primary" />
        <span className="font-semibold text-sidebar-foreground">GH Agent</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t">
        <ThemeToggle />
      </div>
    </aside>
  );
}