// src/lib/tools/report-tools.ts
// Report generation LangChain tools — aggregate data + LLM summarization
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getUserActivity, getAssignedIssues, getReviewRequests, getGitHubToken } from "../github";
import { model } from "../langchain-model";
import { getOrCreateUser, saveReport } from "../db";

/** Generate a daily report */
export const generateDailyReportTool = tool(
  async ({ date }) => {
    const token = await getGitHubToken();
    const targetDate = date || new Date().toISOString().split("T")[0];
    const since = `${targetDate}T00:00:00Z`;
    const until = `${targetDate}T23:59:59Z`;

    const [activity, todos] = await Promise.all([
      getUserActivity(token, since, until),
      getAssignedIssues(token).then(issues => ({ issues })),
    ]);

    const context = JSON.stringify({ activity, todos }, null, 2);

    const response = await model.invoke([
      {
        role: "system",
        content: `你是一个专业的开发者日报生成助手。根据提供的 GitHub 活动数据，生成一份结构化的日报。

格式要求：
## 今日概览
简要总结今天的工作量和重点

## 完成的工作
- 列出完成的 PR、关闭的 Issue、有意义的 commit
- 每个项目附带仓库名和链接

## 进行中的工作
- 列出 open 的 PR 和未关闭的 Issue
- 标注是否有 review request

## 明日计划
- 基于当前进行中的工作，建议下一步行动

注意事项：
- 用中文回复
- 简洁明了，每个要点不超过两行
- 如果某天没有任何活动，诚实说明
- 不要编造数据`,
      },
      {
        role: "user",
        content: `请根据以下 GitHub 活动数据生成 ${targetDate} 的日报：\n\n${context}`,
      },
    ]);

    const content = typeof response.content === "string" ? response.content : "";

    // Save to database
    try {
      const userId = await getOrCreateUser();
      await saveReport(userId, "daily", content, `${targetDate} 日报`, { date: targetDate });
    } catch {
      // Non-fatal: report is still returned even if save fails
    }

    return content;
  },
  {
    name: "generate_daily_report",
    description: "生成指定日期的个人日报。基于当天的 commits、PR、Issue 活动自动生成。",
    schema: z.object({
      date: z.string().optional().describe("日期（YYYY-MM-DD），默认为今天"),
    }),
  }
);

/** Generate a weekly report */
export const generateWeeklyReportTool = tool(
  async ({ weekStart }) => {
    const token = await getGitHubToken();

    // Calculate date range
    let startDate: Date;
    if (weekStart) {
      startDate = new Date(weekStart);
    } else {
      // Default to this week's Monday
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + mondayOffset);
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const since = startDate.toISOString();
    const until = endDate.toISOString();

    const [activity, assignedIssues, reviewRequests] = await Promise.all([
      getUserActivity(token, since, until),
      getAssignedIssues(token),
      getReviewRequests(token),
    ]);

    const context = JSON.stringify({
      dateRange: `${startDate.toISOString().split("T")[0]} 至 ${endDate.toISOString().split("T")[0]}`,
      activity,
      assignedIssues,
      reviewRequests,
    }, null, 2);

    const response = await model.invoke([
      {
        role: "system",
        content: `你是一个专业的开发者周报生成助手。根据提供的 GitHub 活动数据，生成一份结构化的周报。

格式要求：
## 本周概览
一句话总结本周的工作重点和成果

## 完成事项
### 代码提交
- 按仓库分组，列出主要 commit 和变更

### Pull Requests
- 已合并的 PR（含仓库名和链接）
- 关闭的 PR

### Issues
- 已关闭的 Issue（含仓库名和链接）

## 进行中的工作
- 未合并的 PR
- 未关闭的 Issue
- 待 Review 的 PR

## 遇到的问题
- 记录本周遇到的技术问题和解决过程（如有）

## 下周计划
- 基于当前进行中的工作，建议下周的重点

注意事项：
- 用中文回复
- 重点突出，详略得当
- 不要编造数据，没有内容就说"无"
- 每个要点不超过三行`,
      },
      {
        role: "user",
        content: `请根据以下 GitHub 活动数据生成周报：\n\n${context}`,
      },
    ]);

    const content = typeof response.content === "string" ? response.content : "";

    // Save to database
    try {
      const userId = await getOrCreateUser();
      await saveReport(userId, "weekly", content, `${startDate.toISOString().split("T")[0]} 周报`, {
        weekStart: startDate.toISOString(),
        weekEnd: endDate.toISOString(),
      });
    } catch {
      // Non-fatal
    }

    return content;
  },
  {
    name: "generate_weekly_report",
    description: "生成本周的个人周报。自动汇总本周的 commits、PR、Issue 活动。",
    schema: z.object({
      weekStart: z.string().optional().describe("周起始日期（YYYY-MM-DD），默认为本周一"),
    }),
  }
);

/** Generate code change summary for a PR */
export const generateCodeSummaryTool = tool(
  async ({ repo, prNumber }) => {
    const token = await getGitHubToken();
    if (!token) throw new Error("GitHub token required");

    const [owner, name] = repo.split("/");

    // Get PR details
    const prData = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    }).then(r => r.json()) as { title: string; body: string | null; additions: number; deletions: number; changed_files: number; user: { login: string } };

    // Get PR diff (simplified: just the file list and stats)
    const filesData = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/files?per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    }).then(r => r.json()) as { filename: string; status: string; additions: number; deletions: number; patch?: string }[];

    const context = JSON.stringify({
      title: prData.title,
      description: prData.body,
      author: prData.user.login,
      stats: {
        totalAdditions: prData.additions,
        totalDeletions: prData.deletions,
        changedFiles: prData.changed_files,
      },
      files: filesData.slice(0, 30).map(f => ({
        path: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      })),
    }, null, 2);

    const response = await model.invoke([
      {
        role: "system",
        content: `你是一个代码审查助手。根据 PR 的变更数据，生成一份人类可读的代码变更摘要。

格式要求：
## 变更概览
- 一句话总结这个 PR 的目的
- 统计：+X -Y，Z 个文件

## 主要变更
按功能模块分组，每个模块说明：
- 改了什么文件
- 为什么改（从代码变更推断意图）
- 关键变更点

## 潜在风险
- 标注可能的风险点（如：删除了重要逻辑、修改了公共 API 等）
- 如果没有明显风险，说明"无明显风险"

注意事项：
- 用中文回复
- 不要逐行列举变更，要归纳总结
- 从代码变更推断意图，不要编造`,
      },
      {
        role: "user",
        content: `请分析以下 PR 的代码变更：\n\n${context}`,
      },
    ]);

    const content = typeof response.content === "string" ? response.content : "";

    // Save to database
    try {
      const userId = await getOrCreateUser();
      await saveReport(userId, "code_summary", content, `${repo} #${prNumber} 变更摘要`, {
        repo,
        prNumber,
      });
    } catch {
      // Non-fatal
    }

    return content;
  },
  {
    name: "generate_code_summary",
    description: "生成指定 PR 的代码变更摘要。自动分析 diff，归纳变更意图。",
    schema: z.object({
      repo: z.string().describe("仓库名称，格式为 owner/repo"),
      prNumber: z.number().describe("PR 编号"),
    }),
  }
);

export const allReportTools = [
  generateDailyReportTool,
  generateWeeklyReportTool,
  generateCodeSummaryTool,
];
