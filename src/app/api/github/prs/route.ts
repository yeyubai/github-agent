import { NextResponse } from "next/server";
import { listPRs } from "@/lib/github";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get("repo");
    const state = searchParams.get("state") || "open";
    const limit = parseInt(searchParams.get("limit") || "30");
    const prs = await listPRs(repo ?? undefined, state, limit);
    return NextResponse.json(prs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}