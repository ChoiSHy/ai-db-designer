import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username || typeof username !== "string" || !username.trim()) {
      return NextResponse.json({ error: "username이 필요합니다." }, { status: 400 });
    }
    await getOrCreateUser(username.trim());
    return NextResponse.json({ username: username.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
