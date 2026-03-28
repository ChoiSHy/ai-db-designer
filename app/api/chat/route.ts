import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { ChatMessage, SchemaJSON } from "@/lib/types";
import { extractAIResponse } from "@/lib/extractAIResponse";
import { callLLM, LLMAuthError } from "@/lib/callLLM";
import { Provider, DEFAULT_PROVIDER_SETTINGS } from "@/lib/providers";

const MAX_HISTORY_TURNS = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userInput,
      schema,
      history,
      provider  = DEFAULT_PROVIDER_SETTINGS.provider,
      apiKey    = "",
      model     = DEFAULT_PROVIDER_SETTINGS.model,
    }: {
      userInput: string;
      schema: SchemaJSON;
      history: ChatMessage[];
      provider?: Provider;
      apiKey?: string;
      model?: string;
    } = body;

    if (!userInput?.trim()) {
      return NextResponse.json({ error: "userInput이 필요합니다." }, { status: 400 });
    }

    const recentHistory = history.slice(-MAX_HISTORY_TURNS * 2);

    const messages = [
      ...recentHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: `[현재 스키마 상태]\n${JSON.stringify(schema, null, 2)}\n\n[사용자 입력]\n${userInput}`,
      },
    ];

    const rawText = await callLLM({ provider, apiKey, model, systemPrompt: SYSTEM_PROMPT, messages });
    const parsed  = extractAIResponse(rawText, schema);
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof LLMAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("API 오류:", error);
    const message = error instanceof Error ? error.message : "AI 응답 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
