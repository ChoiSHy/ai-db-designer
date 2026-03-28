"use client";

import { useState, useEffect, useRef } from "react";
import { SchemaJSON, ChatMessage } from "@/lib/types";

const LS_MESSAGES_KEY  = "db-designer:messages";
const LS_SCHEMA_KEY    = "db-designer:schema";
const LS_HISTORY_KEY   = "db-designer:schema-history";
const LS_USERNAME_KEY  = "db-designer:username";

interface LoginModalProps {
  onLogin: (username: string) => void;
}

export function LoginModal({ onLogin }: LoginModalProps) {
  const [input,       setInput]       = useState("");
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [hasMigData,  setHasMigData]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // 기존 localStorage 데이터 감지
    const hasMessages = !!localStorage.getItem(LS_MESSAGES_KEY);
    const hasSchema   = !!localStorage.getItem(LS_SCHEMA_KEY);
    setHasMigData(hasMessages || hasSchema);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const username = input.trim();
    if (!username) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. 사용자 생성/조회
      const userRes = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!userRes.ok) {
        const d = await userRes.json();
        throw new Error(d.error ?? "로그인에 실패했습니다.");
      }

      // 2. localStorage 데이터 마이그레이션
      if (hasMigData) {
        const messages     = JSON.parse(localStorage.getItem(LS_MESSAGES_KEY) ?? "[]") as ChatMessage[];
        const schema       = JSON.parse(localStorage.getItem(LS_SCHEMA_KEY)   ?? '{"tables":[]}') as SchemaJSON;
        const schemaHistory = JSON.parse(localStorage.getItem(LS_HISTORY_KEY) ?? "[]") as SchemaJSON[];

        const migRes = await fetch("/api/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, messages, schema, schemaHistory }),
        });

        if (migRes.ok) {
          // 마이그레이션 성공 시 localStorage 정리
          localStorage.removeItem(LS_MESSAGES_KEY);
          localStorage.removeItem(LS_SCHEMA_KEY);
          localStorage.removeItem(LS_HISTORY_KEY);
        }
      }

      // 3. username 로컬 저장 + 로그인 완료
      localStorage.setItem(LS_USERNAME_KEY, username);
      onLogin(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8">
        {/* 로고 */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🗄️</div>
          <h1 className="text-xl font-bold text-gray-900">AI DB 설계 툴</h1>
          <p className="text-sm text-gray-500 mt-1">사용할 이름을 입력하세요</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="예: alice, team-backend"
            maxLength={40}
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          />

          {hasMigData && (
            <p className="text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">
              기존 대화 데이터를 발견했습니다. 로그인 시 자동으로 가져옵니다.
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "처리 중..." : "시작하기"}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          비밀번호 없이 이름만으로 데이터가 저장됩니다
        </p>
      </div>
    </div>
  );
}
