"use client";

import { useState } from "react";
import { PROVIDERS, ProviderSettings, Provider, getProvider } from "@/lib/providers";

interface Props {
  open: boolean;
  initialSettings: ProviderSettings;
  onSave: (settings: ProviderSettings) => void;
  onClose: () => void;
}

export function ProviderSettingsModal({ open, initialSettings, onSave, onClose }: Props) {
  const [provider, setProvider] = useState<Provider>(initialSettings.provider);
  const [model,    setModel]    = useState(initialSettings.model);
  const [apiKey,   setApiKey]   = useState(initialSettings.apiKey);
  const [showKey,  setShowKey]  = useState(false);

  // provider 변경 시 첫 번째 모델로 자동 전환
  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(getProvider(p).models[0].id);
  };

  const handleSave = () => {
    onSave({ provider, model, apiKey });
    onClose();
  };

  const providerInfo  = getProvider(provider);
  const hasKey        = apiKey.trim().length > 0;
  const canFallbackEnv = providerInfo.supportsEnvFallback;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-bold text-gray-900">AI 설정</h2>
            <p className="text-xs text-gray-400 mt-0.5">사용할 AI 제공자와 API 키를 설정합니다</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 제공자 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">AI 제공자</label>
            <div className="flex gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderChange(p.id)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${
                    provider === p.id
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* 모델 선택 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">모델</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            >
              {providerInfo.models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* API 키 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">API 키</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={providerInfo.keyPlaceholder}
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-xl text-gray-800 font-mono placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showKey ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* 상태 안내 */}
            <div className="mt-2">
              {hasKey ? (
                <p className="text-[11px] text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                  API 키가 입력되었습니다
                </p>
              ) : canFallbackEnv ? (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full inline-block" />
                  비어있으면 서버의 <code className="font-mono bg-amber-50 px-1 rounded">ANTHROPIC_API_KEY</code> 환경변수를 사용합니다
                </p>
              ) : (
                <p className="text-[11px] text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-400 rounded-full inline-block" />
                  비어있으면 서버의 <code className="font-mono bg-amber-50 px-1 rounded">OPENAI_API_KEY</code> 환경변수를 사용합니다
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
