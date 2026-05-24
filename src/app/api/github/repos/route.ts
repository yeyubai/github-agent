import { NextResponse } from "next/server";
import { listRepos } from "@/lib/github";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const limit = parseInt(searchParams.get("limit") || "30");
    const repos = await listRepos(owner ?? undefined, limit);
    return NextResponse.json(repos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}