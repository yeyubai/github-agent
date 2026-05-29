import { NextResponse } from "next/server";
import { getRepoDetail, getGitHubToken } from "@/lib/github";

export async function GET(_request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  try {
    const token = await getGitHubToken();
    const { owner, repo } = await params;
    const detail = await getRepoDetail(token, `${owner}/${repo}`);
    return NextResponse.json(detail);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
