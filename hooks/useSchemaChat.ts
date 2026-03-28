"use client";

import { useState, useCallback, useEffect } from "react";
import { ChatMessage, SchemaJSON } from "@/lib/types";
import { SchemaDiff, computeSchemaDiff, hasDiff } from "@/lib/schemaDiff";
import { ProviderSettings, DEFAULT_PROVIDER_SETTINGS } from "@/lib/providers";

const ACCEPTED_FILE_TYPES = [".pdf", ".docx", ".txt", ".md"] as const;
export { ACCEPTED_FILE_TYPES };

const EMPTY_SCHEMA: SchemaJSON = { tables: [] };

export function useSchemaChat(
  projectId: string | null,
  providerSettings: ProviderSettings = DEFAULT_PROVIDER_SETTINGS
) {
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [schema,        setSchema]        = useState<SchemaJSON>(EMPTY_SCHEMA);
  const [historyCount,  setHistoryCount]  = useState(0);
  const [lastDiff,      setLastDiff]      = useState<SchemaDiff | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [hydrated,      setHydrated]      = useState(false);

  // ── 프로젝트 데이터 로드 ─────────────────────────────────
  useEffect(() => {
    if (!projectId) {
      setMessages([]);
      setSchema(EMPTY_SCHEMA);
      setHistoryCount(0);
      setLastDiff(null);
      setHydrated(true);
      return;
    }

    setHydrated(false);
    setLastDiff(null);

    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setSchema(data.project?.schema_json ?? EMPTY_SCHEMA);
        setHistoryCount((data.schemaHistory ?? []).length);
      })
      .catch(() => {
        setMessages([]);
        setSchema(EMPTY_SCHEMA);
        setHistoryCount(0);
      })
      .finally(() => setHydrated(true));
  }, [projectId]);

  // ── 공통: AI 응답 처리 (assistant 메시지만 추가 — user는 이미 추가됨) ──
  const applyAIResponse = useCallback(
    (
      data: { message?: string; schema?: SchemaJSON },
      prevSchema: SchemaJSON,
      userContent: string,
      assistantContent: string
    ) => {
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);

      if (data.schema?.tables) {
        const newSchema = data.schema;
        const diff = computeSchemaDiff(prevSchema, newSchema);
        setSchema(newSchema);
        if (hasDiff(diff)) {
          setLastDiff(diff);
          setHistoryCount((c) => c + 1);
        } else {
          setLastDiff(null);
        }

        // DB 저장 — fire-and-forget (UI 블로킹 없음)
        if (projectId) {
          Promise.all([
            fetch(`/api/projects/${projectId}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "assistant", content: assistantContent }),
            }),
            fetch(`/api/projects/${projectId}/schema`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                schema: newSchema,
                prevSchema: hasDiff(diff) ? prevSchema : undefined,
              }),
            }),
          ]).catch(() => {});
        }
      } else {
        setLastDiff(null);
        if (projectId) {
          fetch(`/api/projects/${projectId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "assistant", content: assistantContent }),
          }).catch(() => {});
        }
      }
    },
    [projectId]
  );

  // ── 메시지 전송 ──────────────────────────────────────────
  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim() || isLoading) return;

      // 유저 메시지 즉시 표시
      setMessages((prev) => [...prev, { role: "user", content: userInput }]);
      setIsLoading(true);
      setError(null);

      const prevSchema = schema;

      // 유저 메시지 DB 저장 (fire-and-forget)
      if (projectId) {
        fetch(`/api/projects/${projectId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: userInput }),
        }).catch(() => {});
      }

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userInput,
            schema,
            history: messages,
            provider: providerSettings.provider,
            apiKey:   providerSettings.apiKey,
            model:    providerSettings.model,
          }),
        });

        const errData = !res.ok ? await res.json() : null;

        if (res.status === 401) {
          const errMsg = `🔑 **인증 오류**\n${errData?.error ?? "API 키가 유효하지 않습니다."}`;
          setMessages((prev) => [...prev,
            { role: "user", content: userInput },
            { role: "assistant", content: errMsg },
          ]);
          return;
        }

        if (!res.ok) throw new Error(errData?.error || "요청에 실패했습니다.");

        const data = await res.json();
        applyAIResponse(data, prevSchema, userInput, data.message ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        // 유저 메시지 롤백
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [messages, schema, isLoading, providerSettings, projectId, applyAIResponse]
  );

  // ── 문서 업로드 ──────────────────────────────────────────
  const uploadDocument = useCallback(
    async (file: File, context?: string) => {
      if (isLoading) return;

      const userLabel = context?.trim()
        ? `📄 ${file.name}\n${context.trim()}`
        : `📄 ${file.name} 문서를 분석해서 DB 스키마를 만들어줘.`;

      // 유저 메시지 즉시 표시
      setMessages((prev) => [...prev, { role: "user", content: userLabel }]);
      setIsLoading(true);
      setError(null);

      const prevSchema = schema;

      // 유저 메시지 DB 저장 (fire-and-forget)
      if (projectId) {
        fetch(`/api/projects/${projectId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: userLabel }),
        }).catch(() => {});
      }

      try {
        const formData = new FormData();
        formData.append("file",     file);
        formData.append("schema",   JSON.stringify(schema));
        formData.append("provider", providerSettings.provider);
        formData.append("apiKey",   providerSettings.apiKey);
        formData.append("model",    providerSettings.model);
        if (context?.trim()) formData.append("context", context.trim());

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const errData = !res.ok ? await res.json() : null;

        if (res.status === 401) {
          const errMsg = `🔑 **인증 오류**\n${errData?.error ?? "API 키가 유효하지 않습니다."}`;
          setMessages((prev) => [...prev,
            { role: "user", content: userLabel },
            { role: "assistant", content: errMsg },
          ]);
          return;
        }

        if (!res.ok) throw new Error(errData?.error || "요청에 실패했습니다.");

        const data = await res.json();
        await applyAIResponse(data, prevSchema, userLabel, data.message ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        // 유저 메시지 롤백
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [schema, isLoading, providerSettings, projectId, applyAIResponse]
  );

  // ── DDL 파싱 ─────────────────────────────────────────────
  const parseDDL = useCallback(
    async (ddl: string) => {
      if (isLoading) return;

      const prevSchema = schema;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/parse-ddl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ddl,
            schema,
            provider: providerSettings.provider,
            apiKey:   providerSettings.apiKey,
            model:    providerSettings.model,
          }),
        });

        const errData = !res.ok ? await res.json() : null;

        if (res.status === 401) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: `🔑 **인증 오류**\n${errData?.error ?? "API 키가 유효하지 않습니다."}`,
          }]);
          return;
        }

        if (!res.ok) throw new Error(errData?.error || "DDL 파싱에 실패했습니다.");

        const data = await res.json();
        // DDL 파싱은 채팅 메시지 없이 스키마만 업데이트
        if (data.schema?.tables) {
          const newSchema = data.schema;
          const diff = computeSchemaDiff(prevSchema, newSchema);
          setSchema(newSchema);
          if (hasDiff(diff)) {
            setLastDiff(diff);
            setHistoryCount((c) => c + 1);
          } else {
            setLastDiff(null);
          }
          if (projectId) {
            fetch(`/api/projects/${projectId}/schema`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                schema: newSchema,
                prevSchema: hasDiff(diff) ? prevSchema : undefined,
              }),
            }).catch(() => {});
          }
        }
        if (data.message) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [schema, isLoading, providerSettings, projectId]
  );

  // ── 실행 취소 ────────────────────────────────────────────
  const undoSchema = useCallback(async () => {
    if (historyCount === 0 || !projectId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/undo`, { method: "POST" });
      if (!res.ok) return;
      const { schema: restoredSchema } = await res.json();
      setSchema(restoredSchema);
      setHistoryCount((c) => Math.max(0, c - 1));
      setLastDiff(null);
    } catch {
      // 실패 시 무시
    }
  }, [projectId, historyCount]);

  // ── 프로젝트 초기화 ──────────────────────────────────────
  const resetAll = useCallback(async () => {
    if (!projectId) return;

    try {
      await fetch(`/api/projects/${projectId}/schema`, { method: "DELETE" });
    } catch {
      // 실패 시 무시
    }

    setMessages([]);
    setSchema(EMPTY_SCHEMA);
    setHistoryCount(0);
    setLastDiff(null);
    setError(null);
  }, [projectId]);

  return {
    messages,
    schema,
    lastDiff,
    canUndo: historyCount > 0,
    undoCount: historyCount,
    isLoading,
    error,
    hydrated,
    sendMessage,
    uploadDocument,
    parseDDL,
    undoSchema,
    resetAll,
  };
}
