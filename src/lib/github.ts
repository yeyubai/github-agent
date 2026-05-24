import { exec } from "child_process";
import { promisify } from "util";
import { platform } from "os";

const execAsync = promisify(exec);

// Windows 下 gh.exe 的默认安装路径
const GH_PATH = platform() === "win32"
  ? `"${process.env.ProgramFiles || "C:\\Program Files"}\\GitHub CLI\\gh.exe"`
  : "gh";

export async function ghCommand(args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`${GH_PATH} ${args}`, {
      maxBuffer: 1024 * 1024 * 10,
      timeout: 30000,
    });
    return stdout.trim();
  } catch (error: any) {
    throw new Error(error.stderr || error.message);
  }
}

export async function ghJSON<T = any>(args: string, fields: string): Promise<T> {
  const result = await ghCommand(`${args} --json ${fields}`);
  return JSON.parse(result);
}

// 仓库
export async function listRepos(owner?: string, limit = 30) {
  const scope = owner ? `owner ${owner}` : "owner";
  return ghJSON<{ name: string; url: string; description: string; isPrivate: boolean; updatedAt: string; stargazerCount: number; primaryLanguage: { name: string } | null }[]>(
    `repo list ${scope} --limit ${limit}`,
    "name,url,description,isPrivate,updatedAt,stargazerCount,primaryLanguage"
  );
}

// PR
export async function listPRs(repo?: string, state = "open", limit = 30) {
  if (repo) {
    return ghJSON<{ number: number; title: string; state: string; isDraft: boolean; author: { login: string }; createdAt: string; url: string; labels: { name: string }[]; baseRefName: string; headRefName: string }[]>(
      `pr list -R ${repo} --state ${state} --limit ${limit}`,
      "number,title,state,isDraft,author,createdAt,url,labels,baseRefName,headRefName"
    );
  }
  // 不指定仓库时，搜索用户自己的所有 PR
  return ghJSON<{ number: number; title: string; state: string; isDraft: boolean; author: { login: string }; createdAt: string; url: string; labels: { name: string }[]; baseRefName: string; headRefName: string }[]>(
    `search prs author:@me --state ${state} --limit ${limit}`,
    "number,title,state,isDraft,author,createdAt,url,labels,baseRefName,headRefName"
  );
}

// Issue
export async function listIssues(repo?: string, state = "open", limit = 30) {
  if (repo) {
    return ghJSON<{ number: number; title: string; state: string; stateReason: string | null; author: { login: string }; createdAt: string; url: string; labels: { name: string; color: string }[] }[]>(
      `issue list -R ${repo} --state ${state} --limit ${limit}`,
      "number,title,state,stateReason,author,createdAt,url,labels"
    );
  }
  // 不指定仓库时，搜索用户自己的所有 Issue
  return ghJSON<{ number: number; title: string; state: string; stateReason: string | null; author: { login: string }; createdAt: string; url: string; labels: { name: string; color: string }[] }[]>(
    `search issues author:@me --state ${state} --limit ${limit}`,
    "number,title,state,stateReason,author,createdAt,url,labels"
  );
}

// 搜索
export async function searchCode(query: string, repo?: string) {
  const repoArg = repo ? `--repo ${repo}` : "";
  return ghJSON<{ textMatches: { fragment: string }[]; path: string; repository: { fullName: string } }[]>(
    `search code "${query}" ${repoArg} --limit 20`,
    "textMatches,path,repository"
  );
}

// 执行通用 gh 命令
export async function runGhRaw(command: string): Promise<string> {
  return ghCommand(command);
}

// 搜索项目（全文搜索，不限于 owner）
export async function searchRepos(options: {
  query: string;
  language?: string;
  stars?: string;
  sort?: "stars" | "forks" | "updated";
  order?: "asc" | "desc";
  limit?: number;
}) {
  const { query, language, stars, sort = "stars", order = "desc", limit = 20 } = options;
  const langArg = language ? `--language=${language}` : "";
  const starsArg = stars ? `--stars="${stars}"` : "";
  const args = `search repos "${query}" ${langArg} ${starsArg} --limit ${limit} --sort ${sort} --order ${order}`;
  return ghJSON<{ fullName: string; description: string | null; stargazerCount: number; forksCount: number; primaryLanguage: { name: string } | null; updatedAt: string; url: string }[]>(args,
    "fullName,description,stargazerCount,forksCount,primaryLanguage,updatedAt,url"
  );
}