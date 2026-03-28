import { NextRequest, NextResponse } from "next/server";
import { getProjects, createProject } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username");
    if (!username) {
      return NextResponse.json({ error: "username이 필요합니다." }, { status: 400 });
    }
    const projects = await getProjects(username);
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { username, name } = await req.json();
    if (!username) {
      return NextResponse.json({ error: "username이 필요합니다." }, { status: 400 });
    }
    const project = await createProject(username, name);
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
