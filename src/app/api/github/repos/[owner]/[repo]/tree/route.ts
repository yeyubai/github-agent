import { NextResponse } from "next/server";
import { getRepoTree, getGitHubToken } from "@/lib/github";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  try {
    const token = await getGitHubToken();
    const { owner, repo } = await params;
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path") || "";
    const ref = searchParams.get("ref") || "HEAD";
    const tree = await getRepoTree(token, `${owner}/${repo}`, path, ref);
    return NextResponse.json(tree);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
