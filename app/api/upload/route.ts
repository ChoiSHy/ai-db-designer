import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt";
import { SchemaJSON } from "@/lib/types";
import { extractAIResponse } from "@/lib/extractAIResponse";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_DOC_CHARS = 50_000; // Claude에 전달할 최대 문자 수

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  if (name.endsWith(".pdf")) {
    // pdf-parse v2: new PDFParse({ data: buffer }).getText()
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("지원하지 않는 파일 형식입니다. PDF, Word(.docx), 텍스트 파일만 가능합니다.");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file")    as File   | null;
    const schemaRaw = formData.get("schema") as string | null;
    const context  = (formData.get("context") as string | null)?.trim() ?? "";

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const schema: SchemaJSON = schemaRaw ? JSON.parse(schemaRaw) : { tables: [] };

    // ── 텍스트 추출 ──────────────────────────────────────────
    let docText: string;
    try {
      docText = await extractText(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "텍스트 추출에 실패했습니다.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const trimmedDoc = docText.trim();
    if (!trimmedDoc) {
      return NextResponse.json(
        { error: "문서에서 텍스트를 추출할 수 없습니다. 스캔본 PDF는 지원되지 않습니다." },
        { status: 400 }
      );
    }

    // ── Claude 메시지 조합 ───────────────────────────────────
    const docSection = trimmedDoc.length > MAX_DOC_CHARS
      ? trimmedDoc.slice(0, MAX_DOC_CHARS) + "\n\n[... 문서가 너무 길어 일부 생략됨 ...]"
      : trimmedDoc;

    const userMessage = [
      `아래 요구사항 문서를 분석해서 DB 스키마 초안을 만들어줘.`,
      context ? `\n추가 요청: ${context}` : "",
      `\n[현재 스키마 상태]\n${JSON.stringify(schema, null, 2)}`,
      `\n[요구사항 문서: ${file.name}]\n--- 문서 시작 ---\n${docSection}\n--- 문서 끝 ---`,
    ].join("");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    const parsed = extractAIResponse(rawText, schema);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("업로드 API 오류:", error);
    return NextResponse.json(
      { error: "문서 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
