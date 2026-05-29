import { exec } from "child_process";
import { promisify } from "util";
import { platform } from "os";
import { cookies } from "next/headers";

const execAsync = promisify(exec);

const GH_PATH = platform() === "win32"
  ? `"${process.env.ProgramFiles || "C:\\Program Files"}\\GitHub CLI\\gh.exe"`
  : "gh";

const GITHUB_API = "https://api.github.com";

// ==================== Token / Cookie 工具 ====================

const TOKEN_COOKIE = "gh_token";

/** 从 cookie 读取 token，没有则返回 null */
export async function getGitHubToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(TOKEN_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** 判断是否有可用的 token */
function hasToken(token: string | null): token is string {
  return token != null && token.length > 0;
}

// ==================== REST API 封装 ====================

async function githubFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

// ==================== gh CLI 封装 ====================

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

// ==================== 仓库 ====================

/**
 * 获取仓库列表 — 优先使用 Token + REST API，回退到 gh CLI
 */
export async function listRepos(token: string | null, owner?: string, limit = 30) {
  if (hasToken(token)) {
    const perPage = Math.min(limit, 100);
    const raw = await githubFetch(`/user/repos?sort=updated&per_page=${perPage}&type=owner`, token) as {
      full_name: string;
      html_url: string;
      description: string | null;
      private: boolean;
      updated_at: string;
      stargazers_count: number;
      language: string | null;
    }[];
    return raw.slice(0, limit).map(r => ({
      name: r.full_name.split("/").pop()!,
      nameWithOwner: r.full_name,
      fullName: r.full_name,
      url: r.html_url,
      description: r.description,
      isPrivate: r.private,
      updatedAt: r.updated_at,
      stargazerCount: r.stargazers_count,
      primaryLanguage: r.language ? { name: r.language } : null,
    }));
  }

  // 回退：gh CLI
  const scope = owner ? `owner ${owner}` : "";
  const raw = await ghJSON<{ name: string; nameWithOwner: string; url: string; description: string; isPrivate: boolean; updatedAt: string; stargazerCount: number; primaryLanguage: { name: string } | null }[]>(
    `repo list ${scope} --limit ${limit}`.trim(),
    "name,nameWithOwner,url,description,isPrivate,updatedAt,stargazerCount,primaryLanguage"
  );
  return raw.map(r => ({ ...r, fullName: r.nameWithOwner }));
}

// ==================== PR ====================

/**
 * 获取 PR 列表 — 优先使用 Token + REST API，回退到 gh CLI
 */
export async function listPRs(token: string | null, repo?: string, state = "open", limit = 30) {
  if (hasToken(token)) {
    if (repo) {
      const [owner, name] = repo.split("/");
      const raw = await githubFetch(`/repos/${owner}/${name}/pulls?state=${state}&per_page=${limit}`, token) as {
        number: number;
        title: string;
        state: string;
        draft: boolean;
        user: { login: string };
        created_at: string;
        html_url: string;
        labels: { name: string }[];
      }[];
      return raw.map(r => ({
        number: r.number,
        title: r.title,
        state: r.state,
        isDraft: r.draft,
        author: { login: r.user.login },
        createdAt: r.created_at,
        url: r.html_url,
        labels: r.labels || [],
      }));
    }
    // 搜索用户自己的 PR
    const raw = await githubFetch(`/search/issues?q=author:@me+type:pr+state:${state}&per_page=${limit}`, token) as { items: {
      number: number;
      title: string;
      state: string;
      draft?: boolean;
      user: { login: string };
      created_at: string;
      html_url: string;
      labels: { name: string }[];
    }[] };
    return raw.items.map(r => ({
      number: r.number,
      title: r.title,
      state: r.state,
      isDraft: r.draft ?? false,
      author: { login: r.user.login },
      createdAt: r.created_at,
      url: r.html_url,
      labels: r.labels || [],
    }));
  }

  // 回退：gh CLI
  if (repo) {
    return ghJSON<{ number: number; title: string; state: string; isDraft: boolean; author: { login: string }; createdAt: string; url: string; labels: { name: string }[] }[]>(
      `pr list -R ${repo} --state ${state} --limit ${limit}`,
      "number,title,state,isDraft,author,createdAt,url,labels"
    );
  }
  return ghJSON<{ number: number; title: string; state: string; isDraft: boolean; author: { login: string }; createdAt: string; url: string; labels: { name: string }[] }[]>(
    `search prs author:@me --state ${state} --limit ${limit}`,
    "number,title,state,isDraft,author,createdAt,url,labels"
  );
}

// ==================== Issue ====================

/**
 * 获取 Issue 列表 — 优先使用 Token + REST API，回退到 gh CLI
 */
export async function listIssues(token: string | null, repo?: string, state = "open", limit = 30) {
  if (hasToken(token)) {
    if (repo) {
      const [owner, name] = repo.split("/");
      const raw = await githubFetch(`/repos/${owner}/${name}/issues?state=${state}&per_page=${limit}`, token) as {
        number: number;
        title: string;
        state: string;
        user: { login: string };
        created_at: string;
        html_url: string;
        labels: { name: string; color: string }[];
      }[];
      return raw.map(r => ({
        number: r.number,
        title: r.title,
        state: r.state,
        author: { login: r.user.login },
        createdAt: r.created_at,
        url: r.html_url,
        labels: r.labels || [],
      }));
    }
    const raw = await githubFetch(`/search/issues?q=author:@me+type:issue+state:${state}&per_page=${limit}`, token) as { items: {
      number: number;
      title: string;
      state: string;
      user: { login: string };
      created_at: string;
      html_url: string;
      labels: { name: string; color: string }[];
    }[] };
    return raw.items.map(r => ({
      number: r.number,
      title: r.title,
      state: r.state,
      author: { login: r.user.login },
      createdAt: r.created_at,
      url: r.html_url,
      labels: r.labels || [],
    }));
  }

  // 回退：gh CLI
  if (repo) {
    return ghJSON<{ number: number; title: string; state: string; author: { login: string }; createdAt: string; url: string; labels: { name: string; color: string }[] }[]>(
      `issue list -R ${repo} --state ${state} --limit ${limit}`,
      "number,title,state,author,createdAt,url,labels"
    );
  }
  return ghJSON<{ number: number; title: string; state: string; author: { login: string }; createdAt: string; url: string; labels: { name: string; color: string }[] }[]>(
    `search issues author:@me --state ${state} --limit ${limit}`,
    "number,title,state,author,createdAt,url,labels"
  );
}

// ==================== 搜索 ====================

export async function searchCode(token: string | null, query: string, repo?: string) {
  if (hasToken(token)) {
    const repoQ = repo ? `+repo:${repo}` : "";
    const raw = await githubFetch(`/search/code?q=${encodeURIComponent(query + repoQ)}&per_page=20`, token) as { items: {
      path: string;
      repository: { full_name: string };
      text_matches: { fragment: string }[];
    }[] };
    return raw.items.map(r => ({
      textMatches: r.text_matches || [],
      path: r.path,
      repository: { fullName: r.repository.full_name },
    }));
  }

  const repoArg = repo ? `--repo ${repo}` : "";
  return ghJSON<{ textMatches: { fragment: string }[]; path: string; repository: { fullName: string } }[]>(
    `search code "${query}" ${repoArg} --limit 20`,
    "textMatches,path,repository"
  );
}

/** 搜索项目（全文搜索） — 优先使用 Token + REST API，回退到 gh CLI */
export async function searchRepos(token: string | null, options: {
  query: string;
  language?: string;
  stars?: string;
  sort?: "stars" | "forks" | "updated";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}) {
  const { query, language, stars, sort = "stars", order = "desc", limit = 20, offset = 0 } = options;

  if (hasToken(token)) {
    let q = query;
    if (language) q += ` language:${language}`;
    if (stars) q += ` stars:${stars}`;
    const perPage = Math.min(limit + offset, 100);
    const raw = await githubFetch(`/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=${order}&per_page=${perPage}`, token) as { items: {
      full_name: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      language: string | null;
      updated_at: string;
      html_url: string;
    }[] };
    const mapped = raw.items.map(r => ({
      fullName: r.full_name,
      description: r.description,
      stargazerCount: r.stargazers_count,
      forksCount: r.forks_count,
      primaryLanguage: r.language ? { name: r.language } : null,
      updatedAt: r.updated_at,
      url: r.html_url,
    }));
    return mapped.slice(offset, offset + limit);
  }

  // 回退：gh CLI
  const fetchLimit = limit + offset;
  const langArg = language ? `--language=${language}` : "";
  const starsArg = stars ? `--stars="${stars}"` : "";
  const args = `search repos "${query}" ${langArg} ${starsArg} --limit ${fetchLimit} --sort ${sort} --order ${order}`;
  const raw = await ghJSON<{ fullName: string; description: string | null; stargazersCount: number; forksCount: number; language: { name: string } | null; updatedAt: string; url: string }[]>(args,
    "fullName,description,stargazersCount,forksCount,language,updatedAt,url"
  );
  const mapped = raw.map(r => ({
    fullName: r.fullName,
    description: r.description,
    stargazerCount: r.stargazersCount,
    forksCount: r.forksCount,
    primaryLanguage: r.language ? { name: r.language } : null,
    updatedAt: r.updatedAt,
    url: r.url,
  }));
  return mapped.slice(offset, offset + limit);
}

export async function runGhRaw(command: string): Promise<string> {
  return ghCommand(command);
}

// ==================== 仓库详情 & 文件浏览器 ====================

/** 仓库详情 — 优先使用 Token + REST API，回退到 gh CLI */
export async function getRepoDetail(token: string | null, fullName: string) {
  if (hasToken(token)) {
    const raw = await githubFetch(`/repos/${fullName}`, token) as {
      name: string;
      full_name: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      language: string | null;
      updated_at: string;
      html_url: string;
      private: boolean;
      default_branch: string;
      open_issues_count: number;
      watchers_count: number;
      license: { name: string } | null;
    };
    return {
      name: raw.name,
      nameWithOwner: raw.full_name,
      fullName: raw.full_name,
      description: raw.description,
      stargazerCount: raw.stargazers_count,
      forkCount: raw.forks_count,
      primaryLanguage: raw.language ? { name: raw.language } : null,
      updatedAt: raw.updated_at,
      url: raw.html_url,
      isPrivate: raw.private,
      defaultBranchRef: raw.default_branch ? { name: raw.default_branch } : null,
      issues: { totalCount: raw.open_issues_count },
      pullRequests: { totalCount: null },
      watchers: { totalCount: raw.watchers_count },
      licenseInfo: raw.license,
    };
  }

  // 回退：gh CLI
  const raw = await ghJSON<{
    name: string;
    nameWithOwner: string;
    description: string;
    stargazerCount: number;
    forkCount: number;
    primaryLanguage: { name: string } | null;
    updatedAt: string;
    url: string;
    isPrivate: boolean;
    defaultBranchRef: { name: string } | null;
    issues: { totalCount: number } | null;
    pullRequests: { totalCount: number } | null;
    watchers: { totalCount: number } | null;
    licenseInfo: { name: string } | null;
  }>(
    `repo view ${fullName}`,
    "name,nameWithOwner,description,stargazerCount,forkCount,primaryLanguage,updatedAt,url,isPrivate,defaultBranchRef,issues,pullRequests,watchers,licenseInfo"
  );
  return { ...raw, fullName: raw.nameWithOwner };
}

/** 最近提交 — 优先使用 Token + REST API，回退到 gh CLI */
export async function getRepoCommits(token: string | null, fullName: string, limit = 20) {
  if (hasToken(token)) {
    const raw = await githubFetch(`/repos/${fullName}/commits?per_page=${limit}`, token) as {
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
      author: { login: string } | null;
    }[];
    return raw.map(r => ({
      sha: r.sha,
      commit: {
        message: r.commit.message,
        author: r.commit.author,
        committer: r.commit.author,
      },
      author: r.author,
    }));
  }

  const result = await ghCommand(`api repos/${fullName}/commits --jq ".[:${limit}]"`);
  return JSON.parse(result) as {
    sha: string;
    commit: { message: string; author: { name: string; date: string }; committer: { name: string } };
    author: { login: string } | null;
  }[];
}

/** 文件树 — 优先使用 Token + REST API，回退到 gh CLI */
export async function getRepoTree(token: string | null, fullName: string, path = "", ref = "HEAD") {
  if (hasToken(token)) {
    const treeRef = path ? `${ref}:${path}` : ref;
    const raw = await githubFetch(`/repos/${fullName}/git/trees/${encodeURIComponent(treeRef)}`, token) as { tree: {
      path: string;
      type: "tree" | "blob";
      mode: string;
      size?: number;
    }[] };
    return raw.tree;
  }

  const treeRef = path ? `${encodeURIComponent(ref)}:${encodeURIComponent(path)}` : encodeURIComponent(ref);
  const result = await ghCommand(`api repos/${fullName}/git/trees/${treeRef} --jq ".tree"`);
  return JSON.parse(result) as { path: string; type: "tree" | "blob"; mode: string; size?: number }[];
}

/** 文件内容 — 优先使用 Token + REST API，回退到 gh CLI */
export async function getFileContent(token: string | null, fullName: string, filePath: string, ref = "HEAD") {
  if (hasToken(token)) {
    const raw = await githubFetch(`/repos/${fullName}/contents/${encodeURIComponent(filePath)}?ref=${ref}`, token) as {
      name: string;
      path: string;
      content: string;
      encoding: string;
      size: number;
      download_url: string;
    };
    return raw;
  }

  const treeRef = ref;
  const treeResult = await ghCommand(`api repos/${fullName}/git/trees/${treeRef}?recursive=1 --jq ".tree[] | select(.path == \\"${filePath}\\")"`);
  const treeEntry = JSON.parse(treeResult) as { sha: string; type: string; size: number };
  if (!treeEntry || treeEntry.type !== "blob") {
    throw new Error("File not found or is a directory");
  }
  const blobResult = await ghCommand(`api repos/${fullName}/git/blobs/${treeEntry.sha}`);
  const blob = JSON.parse(blobResult) as { content: string; encoding: string; size: number };
  const fileName = filePath.split("/").pop() || filePath;
  return { name: fileName, path: filePath, content: blob.content, encoding: blob.encoding, size: blob.size, download_url: `https://raw.githubusercontent.com/${fullName}/${ref}/${filePath}` };
}

/** 仓库语言分布 — 优先使用 Token + REST API，回退到 gh CLI */
export async function getRepoLanguages(token: string | null, fullName: string) {
  if (hasToken(token)) {
    return await githubFetch(`/repos/${fullName}/languages`, token) as Record<string, number>;
  }

  const result = await ghCommand(`api repos/${fullName}/languages`);
  return JSON.parse(result) as Record<string, number>;
}

/** 贡献者列表 — 优先使用 Token + REST API，回退到 gh CLI */
export async function getRepoContributors(token: string | null, fullName: string, limit = 20) {
  if (hasToken(token)) {
    return await githubFetch(`/repos/${fullName}/contributors?per_page=${limit}`, token) as {
      login: string;
      contributions: number;
      avatar_url: string;
      html_url: string;
    }[];
  }

  const result = await ghCommand(`api repos/${fullName}/contributors --jq ".[:${limit}]"`);
  return JSON.parse(result) as { login: string; contributions: number; avatar_url: string; html_url: string }[];
}
