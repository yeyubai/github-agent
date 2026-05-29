// Rich interactive cards for displaying PR, Issue, Repo data in chat
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, GitPullRequest, CircleDot, GitBranch, Star, Languages, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ===== PR Card =====

interface PRCardProps {
  repo: string;
  number: number;
  title: string;
  state?: string;
  author?: string;
  url?: string;
  labels?: { name: string }[];
}

export function PRCard({ repo, number, title, state, author, url, labels }: PRCardProps) {
  return (
    <Card className="my-2 border-l-4 border-l-purple-400">
      <CardHeader className="py-2 px-3">
        <div className="flex items-start gap-2">
          <GitPullRequest className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">
              {title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{repo} #{number}</span>
              {author && <span>by {author}</span>}
              {state && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[10px]",
                    state === "open" ? "text-green-600 border-green-300" :
                    state === "closed" ? "text-red-600 border-red-300" :
                    "text-purple-600 border-purple-300"
                  )}
                >
                  {state}
                </Badge>
              )}
            </div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </CardHeader>
      {labels && labels.length > 0 && (
        <CardContent className="py-1 px-3 flex flex-wrap gap-1">
          {labels.map((l) => (
            <Badge key={l.name} variant="secondary" className="h-4 px-1.5 text-[10px]">
              {l.name}
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ===== Issue Card =====

interface IssueCardProps {
  repo: string;
  number: number;
  title: string;
  state?: string;
  labels?: { name: string; color?: string }[];
  url?: string;
}

export function IssueCard({ repo, number, title, state, labels, url }: IssueCardProps) {
  return (
    <Card className="my-2 border-l-4 border-l-orange-400">
      <CardHeader className="py-2 px-3">
        <div className="flex items-start gap-2">
          <CircleDot className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">
              {title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{repo} #{number}</span>
              {state && (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[10px]",
                    state === "open" ? "text-green-600 border-green-300" : "text-red-600 border-red-300"
                  )}
                >
                  {state}
                </Badge>
              )}
            </div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </CardHeader>
      {labels && labels.length > 0 && (
        <CardContent className="py-1 px-3 flex flex-wrap gap-1">
          {labels.map((l) => (
            <Badge key={l.name} variant="secondary" className="h-4 px-1.5 text-[10px]">
              {l.name}
            </Badge>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ===== Repo Card =====

interface RepoCardProps {
  fullName: string;
  description?: string | null;
  stargazerCount?: number;
  primaryLanguage?: { name: string } | null;
  updatedAt?: string;
  isPrivate?: boolean;
  url?: string;
}

export function RepoCard({ fullName, description, stargazerCount, primaryLanguage, updatedAt, isPrivate, url }: RepoCardProps) {
  const [owner, name] = fullName.split("/");

  return (
    <Card className="my-2 border-l-4 border-l-blue-400">
      <CardHeader className="py-2 px-3">
        <div className="flex items-start gap-2">
          <GitBranch className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium leading-snug">
              <Link href={`/repos/${fullName}`} className="hover:underline">
                {name}
              </Link>
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-0.5">{owner}</div>
          </div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </CardHeader>
      {(description || stargazerCount || primaryLanguage || isPrivate) && (
        <CardContent className="py-1 px-3 space-y-1">
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {primaryLanguage && (
              <span className="flex items-center gap-1">
                <Languages className="h-3 w-3" />
                {primaryLanguage.name}
              </span>
            )}
            {stargazerCount !== undefined && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {stargazerCount}
              </span>
            )}
            {isPrivate && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                <Lock className="h-2.5 w-2.5 mr-0.5" />
                私有
              </Badge>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ===== Todo Item =====

interface TodoItemProps {
  type: "issue" | "review";
  repo: string;
  number: number;
  title: string;
  labels?: string[];
  author?: string;
  url?: string;
}

export function TodoItem({ type, repo, number, title, labels, author, url }: TodoItemProps) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-accent/50 text-sm">
      {type === "issue" ? (
        <CircleDot className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
      ) : (
        <GitPullRequest className="h-3.5 w-3.5 text-purple-500 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{title}</span>
          <span className="text-xs text-muted-foreground shrink-0">{repo} #{number}</span>
        </div>
        {labels && labels.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {labels.map((l) => (
              <span key={l} className="text-[10px] bg-muted px-1 rounded">{l}</span>
            ))}
          </div>
        )}
        {author && type === "review" && (
          <div className="text-xs text-muted-foreground mt-0.5">by {author}</div>
        )}
      </div>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </a>
      )}
    </div>
  );
}

// ===== Action Button Card =====

interface ActionCardProps {
  label: string;
  description: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

export function ActionCard({ label, description, onClick, icon }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 border rounded-lg hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {icon && <span className="shrink-0">{icon}</span>}
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
    </button>
  );
}
