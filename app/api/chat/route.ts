import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { ChatMessage, SchemaJSON, AIResponse } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * AI 응답 텍스트에서 { message, schema } JSON을 추출한다.
 * Claude가 마크다운 코드블록으로 감싸거나, 앞뒤에 설명을 붙이는 경우를 모두 처리한다.
 */
function extractAIResponse(rawText: string, fallbackSchema: SchemaJSON): AIResponse {
  // 방법 1: 마크다운 코드블록 안에서 추출 (```json ... ``` 또는 ``` ... ```)
  const codeBlockMatch =
    rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
    rawText.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim()) as AIResponse;
      if (parsed.message !== undefined) return ensureSchema(parsed, fallbackSchema);
    } catch { /* 다음 방법 시도 */ }
  }

  // 방법 2: 전체 텍스트를 JSON으로 직접 파싱
  try {
    const parsed = JSON.parse(rawText.trim()) as AIResponse;
    if (parsed.message !== undefined) return ensureSchema(parsed, fallbackSchema);
  } catch { /* 다음 방법 시도 */ }

  // 방법 3: 텍스트 내 첫 번째 { ... } 블록 추출 (앞뒤 텍스트 무시)
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(rawText.slice(start, end + 1)) as AIResponse;
      if (parsed.message !== undefined) return ensureSchema(parsed, fallbackSchema);
    } catch { /* 다음 방법 시도 */ }
  }

  // 모든 방법 실패 시: rawText를 message로 표시하되, JSON처럼 보이면 파싱 실패 안내
  const looksLikeJSON = rawText.trim().startsWith("{");
  return {
    message: looksLikeJSON
      ? "AI 응답 파싱에 실패했습니다. 다시 시도해주세요."
      : rawText,
    schema: fallbackSchema,
  };
}

function ensureSchema(parsed: AIResponse, fallbackSchema: SchemaJSON): AIResponse {
  if (!parsed.schema?.tables) {
    parsed.schema = fallbackSchema;
  }
  return parsed;
}

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
