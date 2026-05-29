// src/lib/tools/aggregation-tools.ts
// Cross-repo aggregation LangChain tools
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getAllOpenPRs,
  getAssignedIssues,
  getReviewRequests,
  getUserActivity,
  getGitHubToken,
} from "../github";

export const getAllPRsTool = tool(
  async ({ limit }) => {
    const token = await getGitHubToken();
    const result = await getAllOpenPRs(token);
    const limited = result.slice(0, limit || result.length);
    return JSON.stringify(limited, null, 2);
  },
  {
    name: "get_all_prs",
    description: "获取所有仓库中开放的 Pull Request（跨仓库聚合）。",
    schema: z.object({
      limit: z.number().default(30).describe("返回的 PR 数量上限"),
    }),
  }
);

export const getMyTodosTool = tool(
  async () => {
    const token = await getGitHubToken();
    const [assignedIssues, reviewRequests] = await Promise.all([
      getAssignedIssues(token),
      getReviewRequests(token),
    ]);

    const todos = {
      assignedIssues: assignedIssues.map(i => ({
        type: "issue" as const,
        repo: i.repo,
        number: i.number,
        title: i.title,
        labels: i.labels.map(l => l.name),
        url: i.url,
      })),
      reviewRequests: reviewRequests.map(r => ({
        type: "review" as const,
        repo: r.repo,
        number: r.number,
        title: r.title,
        author: r.author,
        url: r.url,
      })),
    };

    return JSON.stringify(todos, null, 2);
  },
  {
    name: "get_my_todos",
    description: "获取当前用户的所有待办事项：被指派的 Issue + 需要 Review 的 PR。",
    schema: z.object({}),
  }
);

export const getUserActivityTool = tool(
  async ({ since, until }) => {
    const token = await getGitHubToken();
    const result = await getUserActivity(token, since, until);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "get_user_activity",
    description: "获取用户在指定日期范围内的活动（commits、PR、Issues）。用于生成日报/周报。",
    schema: z.object({
      since: z.string().describe("开始日期，ISO 8601 格式，如 2026-05-23T00:00:00Z"),
      until: z.string().describe("结束日期，ISO 8601 格式，如 2026-05-30T23:59:59Z"),
    }),
  }
);

export const allAggregationTools = [
  getAllPRsTool,
  getMyTodosTool,
  getUserActivityTool,
];
