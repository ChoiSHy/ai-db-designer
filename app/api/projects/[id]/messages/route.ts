import { NextRequest, NextResponse } from "next/server";
import { appendMessage } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { role, content } = await req.json();
    if (!role || !content) {
      return NextResponse.json({ error: "role, content가 필요합니다." }, { status: 400 });
    }
    await appendMessage(id, role, content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
