"use client";

import { ChatPanel } from "@/components/ChatPanel";
import { SchemaPanel } from "@/components/SchemaPanel";
import { useSchemaChat } from "@/hooks/useSchemaChat";

export default function Home() {
  const {
    messages, schema, lastDiff, canUndo, undoCount,
    isLoading, error, hydrated,
    sendMessage, undoSchema, resetAll,
  } = useSchemaChat();

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center bg-gray-50 text-gray-400 text-sm" style={{ height: "calc(100vh - 48px)" }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: "calc(100vh - 48px)" }}>
      {/* 헤더 */}
      <header className="flex items-center px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗄️</span>
          <div>
            <h1 className="text-base font-bold text-gray-900">AI DB 설계 툴</h1>
            <p className="text-xs text-gray-400">
              자연어로 DB 스키마를 설계하세요
            </p>
          </div>
        </div>
      </header>

      {/* 메인: 좌측 채팅 + 우측 스키마 */}
      <main className="flex flex-1 min-h-0">
        {/* 채팅 패널 */}
        <div className="w-1/2 border-r border-gray-200 bg-white flex flex-col min-h-0">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            error={error}
            onSend={sendMessage}
            onReset={resetAll}
          />
        </div>

        {/* 스키마 패널 */}
        <div className="w-1/2 bg-white flex flex-col min-h-0">
          <SchemaPanel
            schema={schema}
            lastDiff={lastDiff}
            canUndo={canUndo}
            undoCount={undoCount}
            onUndo={undoSchema}
          />
        </div>
      </main>
    </div>
  );
}
