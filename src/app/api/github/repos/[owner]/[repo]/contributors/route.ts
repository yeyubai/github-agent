import { NextResponse } from "next/server";
import { getRepoContributors, getGitHubToken } from "@/lib/github";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  try {
    const token = await getGitHubToken();
    const { owner, repo } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const contributors = await getRepoContributors(token, `${owner}/${repo}`, limit);
    return NextResponse.json(contributors);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
