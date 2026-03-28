import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { ChatMessage, SchemaJSON } from "@/lib/types";
import { extractAIResponse } from "@/lib/extractAIResponse";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_HISTORY_TURNS = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userInput,
      schema,
      history,
    }: {
      userInput: string;
      schema: SchemaJSON;
      history: ChatMessage[];
    } = body;

    if (!userInput?.trim()) {
      return NextResponse.json(
        { error: "userInput이 필요합니다." },
        { status: 400 }
      );
    }

    // 히스토리 최근 N턴만 유지 (스키마는 히스토리에 포함하지 않음)
    const recentHistory = history.slice(-MAX_HISTORY_TURNS * 2);

    // Claude API 메시지 구성
    const messages: Anthropic.MessageParam[] = [
      ...recentHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      {
        role: "user",
        content: `[현재 스키마 상태]
${JSON.stringify(schema, null, 2)}

[사용자 입력]
${userInput}`,
      },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = extractAIResponse(rawText, schema);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { error: "AI 응답 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
