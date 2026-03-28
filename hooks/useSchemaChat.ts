"use client";

import { useState, useCallback, useEffect } from "react";
import { ChatMessage, SchemaJSON } from "@/lib/types";
import { SchemaDiff, computeSchemaDiff, hasDiff } from "@/lib/schemaDiff";

const ACCEPTED_FILE_TYPES = [".pdf", ".docx", ".txt", ".md"] as const;
export { ACCEPTED_FILE_TYPES };

const EMPTY_SCHEMA: SchemaJSON = { tables: [] };
const LS_MESSAGES_KEY = "db-designer:messages";
const LS_SCHEMA_KEY   = "db-designer:schema";
const LS_HISTORY_KEY  = "db-designer:schema-history";
const MAX_HISTORY = 20;

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useSchemaChat() {
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [schema,         setSchema]         = useState<SchemaJSON>(EMPTY_SCHEMA);
  const [schemaHistory,  setSchemaHistory]  = useState<SchemaJSON[]>([]);
  const [lastDiff,       setLastDiff]       = useState<SchemaDiff | null>(null);
  const [isLoading,      setIsLoading]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [hydrated,       setHydrated]       = useState(false);

  // ── 마운트 시 localStorage 복원 ──────────────────────────
  useEffect(() => {
    setMessages(loadJSON<ChatMessage[]>(LS_MESSAGES_KEY, []));
    setSchema(loadJSON<SchemaJSON>(LS_SCHEMA_KEY, EMPTY_SCHEMA));
    setSchemaHistory(loadJSON<SchemaJSON[]>(LS_HISTORY_KEY, []));
    setHydrated(true);
  }, []);

  // ── localStorage 자동 저장 ───────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_MESSAGES_KEY, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_SCHEMA_KEY, JSON.stringify(schema));
  }, [schema, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(schemaHistory));
  }, [schemaHistory, hydrated]);

  // ── 공통: AI 응답 처리 ──────────────────────────────────
  const applyAIResponse = useCallback(
    (data: { message?: string; schema?: SchemaJSON }, prevSchema: SchemaJSON, rollbackMessages: ChatMessage[]) => {
      if (data.schema?.tables) {
        const newSchema: SchemaJSON = data.schema;
        const diff = computeSchemaDiff(prevSchema, newSchema);
        if (hasDiff(diff)) {
          setSchemaHistory((prev) => [prevSchema, ...prev].slice(0, MAX_HISTORY));
          setLastDiff(diff);
        } else {
          setLastDiff(null);
        }
        setSchema(newSchema);
      } else {
        setLastDiff(null);
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.message || "",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    []
  );

  // ── 메시지 전송 ──────────────────────────────────────────
  const sendMessage = useCallback(
    async (userInput: string) => {
      if (!userInput.trim() || isLoading) return;

      const userMessage: ChatMessage = { role: "user", content: userInput };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);
      setError(null);

      const prevSchema = schema;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userInput, schema, history: messages }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "요청에 실패했습니다.");
        }

        const data = await res.json();
        applyAIResponse(data, prevSchema, messages);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
        setError(message);
        setMessages(messages);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, schema, isLoading, applyAIResponse]
  );

  // ── 문서 업로드 ──────────────────────────────────────────
  const uploadDocument = useCallback(
    async (file: File, context?: string) => {
      if (isLoading) return;

      const label = context?.trim()
        ? `📄 ${file.name}\n${context.trim()}`
        : `📄 ${file.name} 문서를 분석해서 DB 스키마를 만들어줘.`;
      const userMessage: ChatMessage = { role: "user", content: label };
      const prevMessages = messages;
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      const prevSchema = schema;

      try {
        const formData = new FormData();
        formData.append("file",   file);
        formData.append("schema", JSON.stringify(schema));
        if (context?.trim()) formData.append("context", context.trim());

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "요청에 실패했습니다.");
        }

        const data = await res.json();
        applyAIResponse(data, prevSchema, prevMessages);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
        setError(message);
        setMessages(prevMessages);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, schema, isLoading, applyAIResponse]
  );

  // ── 실행 취소 ────────────────────────────────────────────
  const undoSchema = useCallback(() => {
    if (schemaHistory.length === 0) return;
    const [prev, ...rest] = schemaHistory;
    setSchema(prev);
    setSchemaHistory(rest);
    setLastDiff(null);
  }, [schemaHistory]);

  // ── 전체 초기화 ──────────────────────────────────────────
  const resetAll = useCallback(() => {
    setMessages([]);
    setSchema(EMPTY_SCHEMA);
    setSchemaHistory([]);
    setLastDiff(null);
    setError(null);
    localStorage.removeItem(LS_MESSAGES_KEY);
    localStorage.removeItem(LS_SCHEMA_KEY);
    localStorage.removeItem(LS_HISTORY_KEY);
  }, []);

  return {
    messages,
    schema,
    lastDiff,
    canUndo: schemaHistory.length > 0,
    undoCount: schemaHistory.length,
    isLoading,
    error,
    hydrated,
    sendMessage,
    uploadDocument,
    undoSchema,
    resetAll,
  };
}
