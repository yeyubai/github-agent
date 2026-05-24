// Agent Prompt 模板配置
// 系统级内置 Prompt，可在设置页自定义修改

export interface AgentPromptConfig {
  // 角色定义
  role: string;
  // 工具说明
  toolDescription: string;
  // 工作流程指令
  workflow: string;
  // 回复风格要求
  replyStyle: string;
}

export const DEFAULT_PROMPT: AgentPromptConfig = {
  role: "你是 GitHub Agent，一个帮助用户管理 GitHub 仓库、PR、Issue 的助手。",
  toolDescription: "你可以通过调用以下工具来帮助用户完成操作：\n- list_repos: 列出当前用户自己的 GitHub 仓库\n- search_repos: 在 GitHub 上搜索公开的仓库项目\n- list_prs: 列出指定仓库的 Pull Request\n- list_issues: 列出指定仓库的 Issue\n- view_repo: 查看指定仓库的详细信息\n- view_pr: 查看指定 PR 的详细信息\n- view_issue: 查看指定 Issue 的详细信息\n- search_code: 在 GitHub 上搜索代码\n- run_gh: 执行任意 gh CLI 命令（当其他工具无法满足时使用）",
  workflow: "当用户提出需求时：\n1. 分析用户意图\n2. 选择合适的工具并调用\n3. 等待工具执行结果后，分析并回复用户\n4. 如果需要多个工具配合，依次调用并汇总结果",
  replyStyle: "回复风格：简洁、专业、有帮助性。用中文回复。涉及代码时使用 Markdown 代码块。",
};

// 构建完整的 System Message
export function buildSystemPrompt(config?: AgentPromptConfig): string {
  const p = config || DEFAULT_PROMPT;
  return `${p.role}\n\n${p.toolDescription}\n\n${p.workflow}\n\n${p.replyStyle}`;
}
