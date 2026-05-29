import { NextResponse } from "next/server";
import { listIssues, getGitHubToken } from "@/lib/github";

export async function GET(request: Request) {
  try {
    const token = await getGitHubToken();
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");
    const state = searchParams.get("state") || "open";
    const limit = parseInt(searchParams.get("limit") || "30");
    const issues = await listIssues(token, repo ?? undefined, state, limit);
    return NextResponse.json(issues);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
