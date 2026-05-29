import { NextResponse } from "next/server";
import { getFileContent, getGitHubToken } from "@/lib/github";

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }) {
  try {
    const token = await getGitHubToken();
    const { owner, repo } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("path");
    const ref = searchParams.get("ref") || "HEAD";
    if (!filePath) {
      return NextResponse.json({ error: "Missing file path" }, { status: 400 });
    }
    const file = await getFileContent(token, `${owner}/${repo}`, filePath, ref);
    return NextResponse.json(file);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
