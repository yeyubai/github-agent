import { NextResponse } from "next/server";
import { listRepos, getGitHubToken } from "@/lib/github";

export async function GET(request: Request) {
  try {
    const token = await getGitHubToken();
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const limit = parseInt(searchParams.get("limit") || "30");
    const repos = await listRepos(token, owner ?? undefined, limit);
    return NextResponse.json(repos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
