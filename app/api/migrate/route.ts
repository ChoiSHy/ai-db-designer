import { NextRequest, NextResponse } from "next/server";
import { migrateFromLocalStorage } from "@/lib/db";
import { ChatMessage, SchemaJSON } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { username, messages, schema, schemaHistory } = await req.json();
    if (!username) {
      return NextResponse.json({ error: "username이 필요합니다." }, { status: 400 });
    }
    const project = await migrateFromLocalStorage(
      username,
      (messages ?? []) as ChatMessage[],
      (schema ?? { tables: [] }) as SchemaJSON,
      (schemaHistory ?? []) as SchemaJSON[]
    );
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "마이그레이션 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
