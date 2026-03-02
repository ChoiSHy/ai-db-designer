"use client";

import { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

function AIAvatar() {
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mr-2 mt-1 flex-shrink-0 shadow-sm">
      {/* DB 아이콘 */}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <ellipse cx="7" cy="3.5" rx="4.5" ry="1.5" stroke="white" strokeWidth="1.2" />
        <path d="M2.5 3.5V7c0 .83 2.01 1.5 4.5 1.5S11.5 7.83 11.5 7V3.5" stroke="white" strokeWidth="1.2" />
        <path d="M2.5 7v3.5c0 .83 2.01 1.5 4.5 1.5s4.5-.67 4.5-1.5V7" stroke="white" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && <AIAvatar />}

      <div
        className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600 text-white rounded-2xl rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
