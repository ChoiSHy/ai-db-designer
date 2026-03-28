"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { SchemaPanel } from "@/components/SchemaPanel";
import { ProviderSettingsModal } from "@/components/ProviderSettingsModal";
import { useSchemaChat } from "@/hooks/useSchemaChat";
import { useProviderSettings } from "@/hooks/useProviderSettings";
import { getProvider, getModel } from "@/lib/providers";

export default function Home() {
  const { settings, updateSettings, hydrated: settingsHydrated } = useProviderSettings();
  const {
    messages, schema, lastDiff, canUndo, undoCount,
    isLoading, error, hydrated,
    sendMessage, uploadDocument, undoSchema, resetAll,
  } = useSchemaChat(settings);

  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!hydrated || !settingsHydrated) {
    return (
      <div className="flex items-center justify-center bg-gray-50 text-gray-400 text-sm" style={{ height: "calc(100vh - 48px)" }}>
        불러오는 중...
      </div>
    );
  }

  const providerInfo = getProvider(settings.provider);
  const modelInfo    = getModel(settings.provider, settings.model);

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: "calc(100vh - 48px)" }}>
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗄️</span>
          <div>
            <h1 className="text-base font-bold text-gray-900">AI DB 설계 툴</h1>
            <p className="text-xs text-gray-400">자연어로 DB 스키마를 설계하세요</p>
          </div>
        </div>

        {/* AI 설정 버튼 */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
        >
          <span className="text-[11px] font-medium text-gray-500 group-hover:text-indigo-600">
            {providerInfo.shortName} · {modelInfo.name}
          </span>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-gray-400 group-hover:text-indigo-500"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* 메인: 좌측 채팅 + 우측 스키마 */}
      <main className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-gray-200 bg-white flex flex-col min-h-0">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            error={error}
            onSend={sendMessage}
            onUpload={uploadDocument}
            onReset={resetAll}
          />
        </div>
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

      {/* AI 설정 모달 */}
      <ProviderSettingsModal
        open={settingsOpen}
        initialSettings={settings}
        onSave={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
