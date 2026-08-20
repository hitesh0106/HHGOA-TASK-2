"use client";

import React, { useState, useRef } from "react";
import {
  Mic,
  Square,
  ArrowUp,
  Loader2,
  Layers,
  Cpu,
  Globe,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { CHUNKING_STRATEGIES, CHUNKING_DESCRIPTIONS, type ChunkingStrategy } from "@/lib/chunking";
import { SUPPORTED_LANGUAGES, type RagEngine, type SttMode } from "./chunking-selector";

interface QueryChatInputProps {
  onSendText: (query: string) => void;
  onToggleVoice: () => void;
  isListening: boolean;
  isWorking: boolean;
  recordingSeconds?: number;
  strategy: ChunkingStrategy;
  onStrategyChange: (s: ChunkingStrategy) => void;
  engine: RagEngine;
  onEngineChange: (e: RagEngine) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  sttMode: SttMode;
  onSttModeChange: (m: SttMode) => void;
  loadedStrategies: string[];
  onNewChat?: () => void;
  hasMessages?: boolean;
  disabled?: boolean;
}

export function QueryChatInput({
  onSendText,
  onToggleVoice,
  isListening,
  isWorking,
  recordingSeconds = 0,
  strategy,
  onStrategyChange,
  engine,
  onEngineChange,
  language,
  onLanguageChange,
  sttMode,
  onSttModeChange,
  loadedStrategies,
  onNewChat,
  hasMessages = false,
  disabled = false,
}: QueryChatInputProps) {
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
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* 1. Main Rounded Input Bar */}
      <div
        className={`relative rounded-2xl border transition-all duration-200 shadow-sm bg-white dark:bg-[#0e2219] flex items-center gap-3 p-2.5 sm:p-3 ${
          isListening
            ? "border-rose-500 ring-2 ring-rose-500/20"
            : isWorking
            ? "border-goa-gold-400 dark:border-goa-gold-500 ring-2 ring-goa-gold-400/20"
            : "border-forest-200/90 dark:border-forest-800/80 focus-within:border-forest-500 dark:focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-500/15"
        }`}
      >
        {/* Big Circular Microphone Button on the Left */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={onToggleVoice}
          disabled={isWorking || disabled}
          aria-label={isListening ? "Stop recording voice" : "Start speaking voice query"}
          title={isListening ? "Stop recording" : "Tap to speak your question"}
          className={`
            flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center
            transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed
            active:scale-95
            ${
              isListening
                ? "bg-rose-600 text-white shadow-[0_0_20px_rgba(225,29,72,0.6)] animate-pulse"
                : isWorking
                ? "bg-goa-gold-400 text-forest-950 shadow-sm"
                : "bg-forest-100 dark:bg-[#1a3a2b] text-forest-800 dark:text-emerald-100 hover:bg-forest-200 dark:hover:bg-[#214836] shadow-xs"
            }
          `}
        >
          {isWorking ? (
            <Loader2 className="w-5 h-5 animate-spin text-forest-950" />
          ) : isListening ? (
            <Square className="w-4 h-4 fill-current text-white" />
          ) : (
            <Mic className="w-5 h-5 text-forest-800 dark:text-emerald-200" />
          )}
        </button>

        {/* Text Input Field in the Middle */}
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
                ? `Listening… (${formatTimer(recordingSeconds)}) Speak clearly into microphone`
                : isWorking
                ? "Processing query through RAG pipeline…"
                : "Ask anything about the knowledge base or type here..."
            }
            className="w-full bg-transparent outline-none text-xs sm:text-sm text-forest-950 dark:text-forest-50 placeholder:text-forest-400 dark:placeholder:text-forest-500 py-1"
          />
        </div>

        {/* Circular Send Arrow Button on the Right */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={handleSubmit}
          disabled={!text.trim() || isWorking || isListening || disabled}
          aria-label="Send query"
          title="Send query (Enter)"
          className={`
            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-95 cursor-pointer
            ${
              text.trim() && !isWorking && !isListening
                ? "bg-forest-800 dark:bg-[#1d4633] text-white shadow-xs hover:bg-forest-900 dark:hover:bg-[#25563f] hover:scale-105"
                : "bg-forest-100 dark:bg-[#14291f] text-forest-400 dark:text-forest-600 cursor-not-allowed opacity-60"
            }
          `}
        >
          {isWorking ? (
            <Loader2 className="w-4 h-4 animate-spin text-forest-700 dark:text-forest-300" />
          ) : (
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          )}
        </button>
      </div>

      {/* 2. Control Strip Directly Below the Input Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Strategy Dropdown */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#0e2219] border border-forest-200/80 dark:border-forest-800/80 px-2.5 py-1 rounded-full text-forest-700 dark:text-forest-300 shadow-2xs">
            <Layers className="w-3 h-3 text-forest-500" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-forest-500 dark:text-forest-400">
              Strategy:
            </span>
            <select
              value={strategy}
              onChange={(e) => onStrategyChange(e.target.value as ChunkingStrategy)}
              disabled={isWorking || isListening}
              className="bg-transparent text-[11px] font-semibold text-forest-900 dark:text-forest-100 outline-none cursor-pointer capitalize"
            >
              {CHUNKING_STRATEGIES.map((s) => {
                const loaded = loadedStrategies.includes(s);
                return (
                  <option
                    key={s}
                    value={s}
                    disabled={!loaded}
                    className="bg-white dark:bg-[#0e2219] text-forest-900 dark:text-forest-100"
                  >
                    {CHUNKING_DESCRIPTIONS[s].name} {!loaded ? "(not loaded)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Engine Selector: Fast Local vs Sarvam Cloud */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#0e2219] border border-forest-200/80 dark:border-forest-800/80 p-0.5 rounded-full shadow-2xs">
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => onEngineChange("fast")}
              disabled={isWorking || isListening}
              className={`flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                engine === "fast"
                  ? "bg-forest-800 dark:bg-[#1a412f] text-goa-gold-300 dark:text-goa-gold-300 shadow-2xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100"
              }`}
              title="Fast Local Grounded Synthesizer (<50ms SLA)"
            >
              <Sparkles className="w-2.5 h-2.5 text-goa-gold-400" />
              <span>Fast Local</span>
            </button>
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => onEngineChange("sarvam")}
              disabled={isWorking || isListening}
              className={`flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                engine === "sarvam"
                  ? "bg-forest-800 dark:bg-[#1a412f] text-goa-gold-300 dark:text-goa-gold-300 shadow-2xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100"
              }`}
              title="Sarvam AI Cloud LLM Generative Mode (~950ms)"
            >
              <span>☁️ Sarvam Cloud</span>
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#0e2219] border border-forest-200/80 dark:border-forest-800/80 px-2.5 py-1 rounded-full text-forest-700 dark:text-forest-300 shadow-2xs">
            <Globe className="w-3 h-3 text-forest-500" />
            <select
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                onLanguageChange(newLang);
                if (newLang !== "en-IN" && newLang !== "auto" && sttMode === "transcribe") {
                  onSttModeChange("translate");
                }
              }}
              disabled={isWorking || isListening}
              className="bg-transparent text-[11px] font-semibold text-forest-900 dark:text-forest-100 outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option
                  key={l.code}
                  value={l.code}
                  className="bg-white dark:bg-[#0e2219] text-forest-900 dark:text-forest-100"
                >
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. New Chat Link */}
        {hasMessages && onNewChat && (
          <button
            type="button"
            suppressHydrationWarning
            onClick={onNewChat}
            disabled={isWorking || isListening}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>New Chat</span>
          </button>
        )}
      </div>
    </div>
  );
}
