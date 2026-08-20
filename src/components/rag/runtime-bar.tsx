"use client";

import { Sliders, Cpu, Globe, Layers } from "lucide-react";
import { CHUNKING_STRATEGIES, CHUNKING_DESCRIPTIONS, type ChunkingStrategy } from "@/lib/chunking";
import { SUPPORTED_LANGUAGES, type SttMode, type RagEngine } from "./chunking-selector";

interface RuntimeBarProps {
  strategy: ChunkingStrategy;
  onStrategyChange: (s: ChunkingStrategy) => void;
  engine: RagEngine;
  onEngineChange: (e: RagEngine) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  sttMode: SttMode;
  onSttModeChange: (m: SttMode) => void;
  loadedStrategies: string[];
}

export function RuntimeBar({
  strategy,
  onStrategyChange,
  engine,
  onEngineChange,
  language,
  onLanguageChange,
  sttMode,
  onSttModeChange,
  loadedStrategies,
}: RuntimeBarProps) {
  return (
    <div className="card-paper rounded-xl p-3 sm:p-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Strategy selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-forest-700 dark:text-forest-300 font-semibold">
            <Layers className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
            <span className="text-[11px] uppercase tracking-wider">Strategy:</span>
          </div>
          <select
            value={strategy}
            onChange={(e) => onStrategyChange(e.target.value as ChunkingStrategy)}
            className="text-[11px] font-medium bg-white dark:bg-[#11231c] border border-forest-200 dark:border-forest-800 rounded-md px-2 py-1 text-forest-800 dark:text-forest-100 focus:outline-none focus:ring-1 focus:ring-forest-500 capitalize"
          >
            {CHUNKING_STRATEGIES.map((s) => {
              const loaded = loadedStrategies.includes(s);
              return (
                <option key={s} value={s} disabled={!loaded} className="bg-white dark:bg-[#11231c] text-forest-900 dark:text-forest-100">
                  {CHUNKING_DESCRIPTIONS[s].name} {!loaded ? "(not loaded)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Engine selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-forest-700 dark:text-forest-300 font-semibold">
            <Cpu className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
            <span className="text-[11px] uppercase tracking-wider">Engine:</span>
          </div>
          <div className="flex items-center gap-0.5 bg-forest-100/70 dark:bg-forest-950/60 rounded-full p-0.5 border border-forest-200/50 dark:border-forest-800/50">
            <button
              suppressHydrationWarning
              onClick={() => onEngineChange("fast")}
              className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                engine === "fast"
                  ? "bg-forest-800 dark:bg-forest-600 text-white shadow-xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-800 dark:hover:text-forest-200"
              }`}
              title="Fast Local Grounded Synthesizer (Sub-millisecond claim extractor)"
            >
              Fast Local (&le;50ms SLA)
            </button>
            <button
              suppressHydrationWarning
              onClick={() => onEngineChange("sarvam")}
              className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                engine === "sarvam"
                  ? "bg-forest-800 dark:bg-forest-600 text-white shadow-xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-800 dark:hover:text-forest-200"
              }`}
              title="Sarvam AI Cloud LLM Generative Mode (~950ms)"
            >
              Sarvam Cloud
            </button>
          </div>
        </div>

        {/* Speech Language selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-forest-700 dark:text-forest-300 font-semibold">
            <Globe className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
            <span className="text-[11px] uppercase tracking-wider">Voice:</span>
          </div>
          <select
            value={language}
            onChange={(e) => {
              const newLang = e.target.value;
              onLanguageChange(newLang);
              if (newLang !== "en-IN" && newLang !== "auto" && sttMode === "transcribe") {
                onSttModeChange("translate");
              }
            }}
            className="text-[11px] font-medium bg-white dark:bg-[#11231c] border border-forest-200 dark:border-forest-800 rounded-md px-2 py-1 text-forest-800 dark:text-forest-100 focus:outline-none focus:ring-1 focus:ring-forest-500"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} className="bg-white dark:bg-[#11231c] text-forest-900 dark:text-forest-100">
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
