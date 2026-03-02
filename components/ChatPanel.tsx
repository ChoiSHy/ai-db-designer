"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ChatMessage } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onSend: (input: string) => void;
  onReset: () => void;
}

const EXAMPLE_PROMPTS = [
  "쇼핑몰 DB를 설계해줘",
  "블로그 서비스 DB가 필요해",
  "예약 시스템 DB를 만들어줘",
  "SNS 서비스 DB 설계해줘",
];

export function ChatPanel({
  messages,
  isLoading,
  error,
  onSend,
  onReset,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // 자동 높이 조절
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">AI와 대화</h2>
          <p className="text-xs text-gray-500">
            자연어로 DB 구조를 설명하세요
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
          >
            초기화
          </button>
        )}
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-4">🗄️</div>
            <h3 className="text-gray-700 font-medium mb-2">
              DB 설계를 시작해보세요
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              어떤 서비스의 DB가 필요한지 설명해주세요
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSend(prompt)}
                  className="text-left px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <ellipse cx="7" cy="3.5" rx="4.5" ry="1.5" stroke="white" strokeWidth="1.2" />
                    <path d="M2.5 3.5V7c0 .83 2.01 1.5 4.5 1.5S11.5 7.83 11.5 7V3.5" stroke="white" strokeWidth="1.2" />
                    <path d="M2.5 7v3.5c0 .83 2.01 1.5 4.5 1.5s4.5-.67 4.5-1.5V7" stroke="white" strokeWidth="1.2" />
                  </svg>
                </div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="ml-14 mr-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
          {error}
        </div>
      )}

      {/* 입력창 */}
      <div className="py-3 pr-4 pl-14 border-t border-gray-200 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="DB 요구사항을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
