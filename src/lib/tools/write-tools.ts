// Write operation LangChain tools — each wraps a function from github.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  createIssue,
  commentOnIssue,
  commentOnPR,
  updateIssue,
  mergePR,
  closePR,
  getGitHubToken,
} from "../github";

export const createIssueTool = tool(
  async ({ repo, title, body, labels }) => {
    const token = await getGitHubToken();
    const result = await createIssue(token, repo, title, body || undefined, labels || undefined);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "create_issue",
    description: "在指定仓库创建一个新的 Issue。需要提供仓库、标题，可选描述和标签。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      title: z.string().describe("Issue 标题"),
      body: z.string().optional().describe("Issue 详细描述（支持 Markdown）"),
      labels: z.array(z.string()).optional().describe("Issue 标签列表，如 ['bug', 'enhancement']"),
    }),
  }
);

export const commentOnIssueTool = tool(
  async ({ repo, issueNumber, body }) => {
    const token = await getGitHubToken();
    const result = await commentOnIssue(token, repo, issueNumber, body);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "comment_on_issue",
    description: "在指定 Issue 下发表评论。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      issueNumber: z.number().describe("Issue 编号"),
      body: z.string().describe("评论内容（支持 Markdown）"),
    }),
  }
);

export const commentOnPRTool = tool(
  async ({ repo, prNumber, body }) => {
    const token = await getGitHubToken();
    const result = await commentOnPR(token, repo, prNumber, body);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "comment_on_pr",
    description: "在指定 PR 下发表评论。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
      body: z.string().describe("评论内容（支持 Markdown）"),
    }),
  }
);

export const updateIssueTool = tool(
  async ({ repo, issueNumber, state, labels, assignees }) => {
    const token = await getGitHubToken();
    const result = await updateIssue(token, repo, issueNumber, state, labels, assignees);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "update_issue",
    description: "更新 Issue 的状态、标签或指派人。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      issueNumber: z.number().describe("Issue 编号"),
      state: z.enum(["open", "closed"]).optional().describe("Issue 状态"),
      labels: z.array(z.string()).optional().describe("新的标签列表"),
      assignees: z.array(z.string()).optional().describe("指派人 GitHub 用户名列表"),
    }),
  }
);

export const mergePRTool = tool(
  async ({ repo, prNumber, mergeMethod }) => {
    const token = await getGitHubToken();
    const result = await mergePR(token, repo, prNumber, mergeMethod);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "merge_pr",
    description: "合并指定的 Pull Request。破坏性操作，需用户确认。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
      mergeMethod: z.enum(["merge", "squash", "rebase"]).default("merge").describe("合并方式"),
    }),
  }
);

export const closePRTool = tool(
  async ({ repo, prNumber }) => {
    const token = await getGitHubToken();
    const result = await closePR(token, repo, prNumber);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "close_pr",
    description: "关闭指定的 Pull Request（不合并）。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
    }),
  }
);

export const allWriteTools = [
  createIssueTool,
  commentOnIssueTool,
  commentOnPRTool,
  updateIssueTool,
  mergePRTool,
  closePRTool,
];
