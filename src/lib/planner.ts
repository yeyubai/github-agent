// src/lib/planner.ts
// Intent parser and multi-step plan generator for complex user requests
import { allTools } from "./tools/github-tools";
import { model } from "./langchain-model";
import { z } from "zod";

const PlanStep = z.object({
  toolName: z.string().describe("Tool to execute"),
  toolArgs: z.record(z.string(), z.unknown()).describe("Arguments for the tool"),
  description: z.string().describe("Human-readable description of this step"),
  dependsOn: z.array(z.number()).default([]).describe("Step indices this step depends on (0-based)"),
});

const MultiStepPlan = z.object({
  summary: z.string().describe("Brief summary of what the plan accomplishes"),
  steps: z.array(PlanStep).describe("Ordered list of steps to execute"),
  autoExecute: z.boolean().describe("Whether this plan is safe to auto-execute (all read-only steps)"),
});

export type PlanStepType = z.infer<typeof PlanStep>;
export type MultiStepPlanType = z.infer<typeof MultiStepPlan>;

/**
 * Parse a user request into a multi-step plan using the LLM
 * Returns a structured plan or null if the request is simple enough for direct tool calling
 */
export async function parseIntent(userMessage: string): Promise<MultiStepPlanType | null> {
  // Simple heuristic: if the message is short and direct, skip planning
  if (userMessage.length < 30 && !userMessage.includes("和") && !userMessage.includes("然后") && !userMessage.includes("再")) {
    return null;
  }

  const toolDescriptions = allTools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const systemPrompt = `你是一个 GitHub 操作计划生成器。用户的请求可能涉及多个步骤。你的任务是：

1. 分析用户请求，判断是否需要多个工具调用来完成
2. 如果需要，生成一个有序的多步执行计划
3. 标记该计划是否可以安全地自动执行（所有步骤都是只读操作 = 可以自动执行）

可用工具：
${toolDescriptions}

重要规则：
- 如果用户请求只需要一个工具，返回 null（让系统直接调用）
- 如果请求涉及多个步骤，按依赖关系排序
- 写操作（create_issue, comment_on_*, update_issue, merge_pr, close_pr）标记 autoExecute=false
- 读操作（list_*, search_*, view_*, get_*）标记 autoExecute=true
- 混合操作（先读后写）标记 autoExecute=false
- 每个步骤必须明确指定 toolName 和 toolArgs`;

  const response = await model.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: `用户请求：${userMessage}\n\n请生成执行计划（JSON 格式），如果不需要多步计划则返回 null。` },
  ]);

  const content = typeof response.content === "string" ? response.content : "";

  // Try to extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const result = MultiStepPlan.safeParse(parsed);
    if (!result.success || !result.data.steps.length) return null;
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Execute a multi-step plan sequentially, collecting results
 */
export async function executePlan(
  plan: MultiStepPlanType,
  executeTool: (toolName: string, args: Record<string, unknown>) => Promise<string>
): Promise<{ stepIndex: number; result: string; success: boolean }[]> {
  const results: { stepIndex: number; result: string; success: boolean }[] = [];
  const stepOutputs = new Map<number, string>();

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];

    // Check dependencies
    const depsMet = step.dependsOn.every((depIdx) => stepOutputs.has(depIdx));
    if (!depsMet) {
      results.push({ stepIndex: i, result: "依赖的步骤尚未完成，跳过", success: false });
      continue;
    }

    try {
      const result = await executeTool(step.toolName, step.toolArgs);
      stepOutputs.set(i, result);
      results.push({ stepIndex: i, result, success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "执行失败";
      results.push({ stepIndex: i, result: message, success: false });
      // Stop execution on failure
      break;
    }
  }

  return results;
}

/**
 * Check if a plan contains only read-only (safe) tools
 */
export function isPlanReadOnly(plan: MultiStepPlanType): boolean {
  const readOnlyTools = new Set([
    "list_repos", "search_repos", "list_prs", "list_issues",
    "view_repo", "view_pr", "view_issue", "search_code", "run_gh",
  ]);
  return plan.steps.every((step) => readOnlyTools.has(step.toolName));
}
