import { NextResponse } from "next/server";

const TOKEN_COOKIE = "gh_token";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request) {
  try {
    const { token } = await request.json() as { token: string };
    if (!token?.trim()) {
      return NextResponse.json({ error: "Token 不能为空" }, { status: 400 });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(TOKEN_COOKIE, token.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: MAX_AGE,
      path: "/",
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
