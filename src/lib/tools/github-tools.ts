// GitHub CLI 工具 — LangChain Tool 封装
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { runGhRaw, listRepos, listPRs, listIssues, searchRepos, searchCode } from "../github";

export const listReposTool = tool(
  async ({ limit }) => {
    const result = await listRepos(undefined, limit);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "list_repos",
    description: "列出当前用户自己的 GitHub 仓库。返回仓库名称、URL、描述、Star 数、主要语言等信息。",
    schema: z.object({
      limit: z.number().default(30).describe("返回的仓库数量上限"),
    }),
  }
);

export const searchReposTool = tool(
  async ({ query, language, stars, sort, order, limit }) => {
    const result = await searchRepos({
      query, language, stars, sort: sort as any, order: order as any, limit,
    });
    return JSON.stringify(result, null, 2);
  },
  {
    name: "search_repos",
    description: "在 GitHub 上搜索公开的仓库项目。支持按关键词、语言、Star 数搜索。",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
      language: z.string().optional().describe("编程语言过滤，如 typescript, python"),
      stars: z.string().optional().describe("Star 数范围，如 >1000 或 100..5000"),
      sort: z.enum(["stars", "forks", "updated"]).default("stars").describe("排序字段"),
      order: z.enum(["asc", "desc"]).default("desc").describe("排序方向"),
      limit: z.number().default(20).describe("返回结果数量上限"),
    }),
  }
);

export const listPRsTool = tool(
  async ({ repo, state, limit }) => {
    const result = await listPRs(repo || undefined, state, limit);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "list_prs",
    description: "列出指定仓库的 Pull Request。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo，如 vuejs/core"),
      state: z.enum(["open", "closed", "merged", "all"]).default("open").describe("PR 状态"),
      limit: z.number().default(30).describe("返回的 PR 数量上限"),
    }),
  }
);

export const listIssuesTool = tool(
  async ({ repo, state, limit }) => {
    const result = await listIssues(repo || undefined, state, limit);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "list_issues",
    description: "列出指定仓库的 Issue。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      state: z.enum(["open", "closed", "all"]).default("open").describe("Issue 状态"),
      limit: z.number().default(30).describe("返回的 Issue 数量上限"),
    }),
  }
);

export const viewRepoTool = tool(
  async ({ repo }) => {
    const result = await runGhRaw(`repo view ${repo} --json name,fullName,description,stargazerCount,forkCount,primaryLanguage,updatedAt,url`);
    return result;
  },
  {
    name: "view_repo",
    description: "查看指定仓库的详细信息，包括 Star 数、Fork 数、主要语言等。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
    }),
  }
);

export const viewPRTool = tool(
  async ({ repo, number }) => {
    const result = await runGhRaw(`pr view ${number} -R ${repo} --json title,body,author,additions,deletions,changedFiles,state,createdAt,url`);
    return result;
  },
  {
    name: "view_pr",
    description: "查看指定 PR 的详细信息，包括标题、内容、代码变更等。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      number: z.number().describe("PR 编号"),
    }),
  }
);

export const viewIssueTool = tool(
  async ({ repo, number }) => {
    const result = await runGhRaw(`issue view ${number} -R ${repo} --json title,body,author,labels,comments,state,createdAt,url`);
    return result;
  },
  {
    name: "view_issue",
    description: "查看指定 Issue 的详细信息，包括标题、内容、标签、评论等。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      number: z.number().describe("Issue 编号"),
    }),
  }
);

export const searchCodeTool = tool(
  async ({ query, repo }) => {
    const result = await searchCode(query, repo || undefined);
    return JSON.stringify(result, null, 2);
  },
  {
    name: "search_code",
    description: "在 GitHub 上搜索代码，查找包含特定关键词的文件和代码片段。",
    schema: z.object({
      query: z.string().describe("搜索关键词"),
      repo: z.string().optional().describe("可选：限定在某个仓库内搜索，格式为 owner/repo"),
    }),
  }
);

export const runGhTool = tool(
  async ({ command }) => {
    const result = await runGhRaw(command);
    return result;
  },
  {
    name: "run_gh",
    description: "执行任意 gh CLI 命令。当其他专用工具无法满足需求时使用。",
    schema: z.object({
      command: z.string().describe("完整的 gh 命令（不包含 gh 前缀），如 repo list --limit 10"),
    }),
  }
);

export const allTools = [
  listReposTool,
  searchReposTool,
  listPRsTool,
  listIssuesTool,
  viewRepoTool,
  viewPRTool,
  viewIssueTool,
  searchCodeTool,
  runGhTool,
];
