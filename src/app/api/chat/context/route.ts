import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser, setUserContext, getUserContext, logActivity, UserContext } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = await getOrCreateUser();

    const updates: Partial<UserContext> = {};
    if (body.currentRepo !== undefined) updates.currentRepo = body.currentRepo;
    if (body.currentPrNumber !== undefined) updates.currentPrNumber = body.currentPrNumber;
    if (body.currentIssueNumber !== undefined) updates.currentIssueNumber = body.currentIssueNumber;

    if (Object.keys(updates).length > 0) {
      await setUserContext(userId, updates);
      await logActivity(userId, "context_update", updates as Record<string, unknown>);
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
