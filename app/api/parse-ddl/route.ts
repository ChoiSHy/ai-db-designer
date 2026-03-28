import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { SchemaJSON } from "@/lib/types";
import { extractAIResponse } from "@/lib/extractAIResponse";
import { callLLM, LLMAuthError } from "@/lib/callLLM";
import { Provider, DEFAULT_PROVIDER_SETTINGS } from "@/lib/providers";

export async function POST(req: NextRequest) {
  try {
    const {
      ddl,
      schema,
      provider = DEFAULT_PROVIDER_SETTINGS.provider,
      apiKey   = "",
      model    = DEFAULT_PROVIDER_SETTINGS.model,
    }: {
      ddl: string;
      schema: SchemaJSON;
      provider?: Provider;
      apiKey?: string;
      model?: string;
    } = await req.json();

    if (!ddl?.trim()) {
      return NextResponse.json({ error: "DDL이 비어 있습니다." }, { status: 400 });
    }

    const rawText = await callLLM({
      provider,
      apiKey,
      model,
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `[현재 스키마 상태]\n${JSON.stringify(schema, null, 2)}\n\n` +
            `[사용자 입력]\n다음 DDL SQL을 분석해서 SchemaJSON으로 변환해줘.\n\n\`\`\`sql\n${ddl}\n\`\`\``,
        },
      ],
    });

    const parsed = extractAIResponse(rawText, schema);
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("DDL 파싱 오류:", error);
    const message = error instanceof Error ? error.message : "DDL 파싱 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
