"use client";

import React, { useState, useRef } from "react";
import { Mic, Square, ArrowUp, Loader2 } from "lucide-react";

interface ChatInputBarProps {
  onSendText: (query: string) => void;
  onToggleVoice: () => void;
  isListening: boolean;
  isWorking: boolean;
  recordingSeconds?: number;
  disabled?: boolean;
}

export function ChatInputBar({
  onSendText,
  onToggleVoice,
  isListening,
  isWorking,
  recordingSeconds = 0,
  disabled = false,
}: ChatInputBarProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isWorking || isListening || disabled) return;
    onSendText(trimmed);
    setText("");
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className={`relative rounded-2xl border transition-all duration-200 shadow-xs bg-white dark:bg-[#11231c] flex items-center gap-2 p-2 sm:p-2.5 ${
          isListening
            ? "border-rose-500 ring-2 ring-rose-500/20"
            : isWorking
            ? "border-goa-gold-400 dark:border-goa-gold-500 ring-2 ring-goa-gold-400/20"
            : "border-forest-200/90 dark:border-forest-800 focus-within:border-forest-500 dark:focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-500/15"
        }`}
      >
        {/* Microphone Button inside input bar */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={onToggleVoice}
          disabled={isWorking || disabled}
          aria-label={isListening ? "Stop recording voice" : "Start speaking voice query"}
          title={isListening ? "Stop recording" : "Tap to speak your question"}
          className={`
            flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
            transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed
            active:scale-95
            ${
              isListening
                ? "bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.6)] animate-pulse"
                : isWorking
                ? "bg-goa-gold-400 text-forest-950"
                : "bg-forest-100 dark:bg-forest-900 text-forest-700 dark:text-forest-200 hover:bg-forest-200 dark:hover:bg-forest-800"
            }
          `}
        >
          {isWorking ? (
            <Loader2 className="w-4 h-4 animate-spin text-forest-950" />
          ) : isListening ? (
            <Square className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Mic className="w-4 h-4 text-forest-700 dark:text-emerald-100" />
          )}
        </button>

        {/* Text Input */}
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isWorking || isListening || disabled}
            placeholder={
              isListening
                ? `Listening… (${formatTimer(recordingSeconds)}) Speak your question`
                : isWorking
                ? "Processing query through RAG pipeline…"
                : "Ask anything about the knowledge base or type here..."
            }
            className="w-full bg-transparent outline-none text-xs sm:text-sm text-forest-950 dark:text-forest-50 placeholder:text-forest-400 dark:placeholder:text-forest-500 py-1"
          />
        </div>

        {/* Submit Arrow Button */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={handleSubmit}
          disabled={!text.trim() || isWorking || isListening || disabled}
          aria-label="Send query"
          title="Send query (Enter)"
          className={`
            flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
            transition-all duration-200 active:scale-95 cursor-pointer
            ${
              text.trim() && !isWorking && !isListening
                ? "bg-forest-800 dark:bg-forest-700 text-white shadow-xs hover:bg-forest-900 dark:hover:bg-forest-600 hover:scale-105"
                : "bg-forest-100 dark:bg-forest-900 text-forest-400 dark:text-forest-600 cursor-not-allowed opacity-60"
            }
          `}
        >
          {isWorking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-forest-700 dark:text-forest-300" />
          ) : (
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          )}
        </button>
      </div>
    </div>
  );
}
