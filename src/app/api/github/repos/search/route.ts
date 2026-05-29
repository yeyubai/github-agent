import { NextResponse } from "next/server";
import { searchRepos, getGitHubToken } from "@/lib/github";

export async function GET(request: Request) {
  try {
    const token = await getGitHubToken();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "缺少搜索参数 q" }, { status: 400 });
    }

    const language = searchParams.get("lang") ?? undefined;
    const stars = searchParams.get("stars") ?? undefined;
    const sort = (searchParams.get("sort") as "stars" | "forks" | "updated") ?? "stars";
    const order = (searchParams.get("order") as "asc" | "desc") ?? "desc";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const results = await searchRepos(token, {
      query,
      language,
      stars,
      sort,
      order,
      limit,
      offset,
    });

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
