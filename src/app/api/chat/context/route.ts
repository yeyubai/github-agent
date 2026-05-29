// src/app/api/chat/context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, setUserContext, getUserContext, logActivity } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = await getOrCreateUser();

    const updates: Record<string, unknown> = {};
    if (body.currentRepo !== undefined) updates.current_repo = body.currentRepo;
    if (body.currentPrNumber !== undefined) updates.current_pr_number = body.currentPrNumber;
    if (body.currentIssueNumber !== undefined) updates.current_issue_number = body.currentIssueNumber;

    if (Object.keys(updates).length > 0) {
      await setUserContext(userId, updates as any);
      await logActivity(userId, "context_update", updates);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const userId = await getOrCreateUser();
    const context = await getUserContext(userId);
    return NextResponse.json(context);
  } catch {
    return NextResponse.json({ currentRepo: null, currentPrNumber: null, currentIssueNumber: null, preferences: {} });
  }
}
