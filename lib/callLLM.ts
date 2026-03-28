import Anthropic from "@anthropic-ai/sdk";
import { Provider } from "./providers";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  provider: Provider;
  /** 빈 문자열이면 환경변수(ANTHROPIC_API_KEY / OPENAI_API_KEY) 사용 */
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: LLMMessage[];
  maxTokens?: number;
}

/** 인증 실패(401) 전용 에러 — API 라우트에서 status 401로 반환 */
export class LLMAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMAuthError";
  }
}

/**
 * provider에 맞는 LLM을 호출하고 응답 텍스트를 반환한다.
 */
export async function callLLM(req: LLMRequest): Promise<string> {
  const maxTokens = req.maxTokens ?? 8192;

  // ── Anthropic (Claude) ───────────────────────────────────
  if (req.provider === "anthropic") {
    const key = req.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new LLMAuthError("Anthropic API 키가 없습니다. 설정(⚙️)에서 입력하거나 .env.local에 ANTHROPIC_API_KEY를 설정하세요.");

    const client = new Anthropic({ apiKey: key });
    try {
      const response = await client.messages.create({
        model: req.model,
        max_tokens: maxTokens,
        system: req.systemPrompt,
        messages: req.messages,
      });
      return response.content[0].type === "text" ? response.content[0].text : "";
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        throw new LLMAuthError("Anthropic API 키가 유효하지 않습니다. 설정(⚙️)에서 API 키를 확인해주세요.");
      }
      // API 키에 비ASCII 문자가 포함된 경우 fetch 헤더 직렬화 실패
      if (err instanceof TypeError && err.message.includes("ByteString")) {
        throw new LLMAuthError("API 키가 올바르지 않습니다. 설정(⚙️)에서 유효한 API 키를 입력해주세요.");
      }
      throw err;
    }
  }

  // ── OpenAI ───────────────────────────────────────────────
  if (req.provider === "openai") {
    const key =  req.apiKey || process.env.OPENAI_API_KEY
    if (!key) throw new LLMAuthError("OpenAI API 키가 없습니다. 설정(⚙️)에서 입력하거나 .env.local에 OPENAI_API_KEY를 설정하세요.");

    const messages = [
      { role: "system", content: req.systemPrompt },
      ...req.messages,
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: req.model, messages, max_tokens: maxTokens }),
    });

    if (res.status === 401) {
      throw new LLMAuthError("OpenAI API 키가 유효하지 않습니다. 설정(⚙️)에서 API 키를 확인해주세요.");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `OpenAI API 오류 (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }

  throw new Error(`지원하지 않는 AI 제공자입니다: ${req.provider}`);
}
