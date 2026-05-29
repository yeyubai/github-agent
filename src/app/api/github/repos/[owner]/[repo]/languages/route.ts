import { NextResponse } from "next/server";
import { getRepoLanguages, getGitHubToken } from "@/lib/github";

export async function GET(_request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  try {
    const token = await getGitHubToken();
    const { owner, repo } = await params;
    const languages = await getRepoLanguages(token, `${owner}/${repo}`);
    return NextResponse.json(languages);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
