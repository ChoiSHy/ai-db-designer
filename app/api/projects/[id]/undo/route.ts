import { NextRequest, NextResponse } from "next/server";
import { undoSchema } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const restoredSchema = await undoSchema(id);
    if (!restoredSchema) {
      return NextResponse.json({ error: "되돌릴 히스토리가 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ schema: restoredSchema });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
