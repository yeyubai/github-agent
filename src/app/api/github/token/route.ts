import { NextResponse } from "next/server";
import { getOrCreateUser, setGitHubToken, removeGitHubToken, getGitHubToken } from "@/lib/db";

const TOKEN_COOKIE = "gh_token";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token: string };
    if (!token?.trim()) {
      return NextResponse.json({ error: "Token 不能为空" }, { status: 400 });
    }

    // Save to Supabase
    const userId = await getOrCreateUser();
    await setGitHubToken(userId, token.trim());

    // Also set cookie for server-side API calls
    const response = NextResponse.json({ ok: true });
    response.cookies.set(TOKEN_COOKIE, token.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const userId = await getOrCreateUser();
    await removeGitHubToken(userId);

    const response = NextResponse.json({ ok: true });
    response.cookies.delete(TOKEN_COOKIE);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const userId = await getOrCreateUser();
    const token = await getGitHubToken(userId);
    return NextResponse.json({ hasToken: !!token });
  } catch {
    return NextResponse.json({ hasToken: false });
  }
}
