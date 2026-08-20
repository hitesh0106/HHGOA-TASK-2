"use client";

import { Languages, Globe } from "lucide-react";
import { CHUNKING_STRATEGIES, CHUNKING_DESCRIPTIONS, type ChunkingStrategy } from "@/lib/chunking";

export type SttMode = "transcribe" | "translate";
export type RagEngine = "fast" | "sarvam";

export const SUPPORTED_LANGUAGES = [
  { code: "auto", name: "Auto Detect (AI)", flag: "🌐" },
  { code: "en-IN", name: "English (India)", flag: "🇬🇧" },
  { code: "hi-IN", name: "Hindi (हिन्दी)", flag: "🇮🇳" },
  { code: "bn-IN", name: "Bengali (বাংলা)", flag: "🇮🇳" },
  { code: "mr-IN", name: "Marathi (मराठी)", flag: "🇮🇳" },
  { code: "ta-IN", name: "Tamil (தமிழ்)", flag: "🇮🇳" },
  { code: "te-IN", name: "Telugu (తెలుగు)", flag: "🇮🇳" },
  { code: "gu-IN", name: "Gujarati (ગુજરાતી)", flag: "🇮🇳" },
  { code: "kn-IN", name: "Kannada (ಕನ್ನಡ)", flag: "🇮🇳" },
  { code: "ml-IN", name: "Malayalam (മലയാളം)", flag: "🇮🇳" },
  { code: "pa-IN", name: "Punjabi (ਪੰਜਾਬੀ)", flag: "🇮🇳" },
  { code: "ur-IN", name: "Urdu (اردو)", flag: "🇮🇳" },
  { code: "od-IN", name: "Odia (ଓଡ଼ିଆ)", flag: "🇮🇳" },
];

interface ChunkingSelectorProps {
  strategy: ChunkingStrategy;
  onChange: (s: ChunkingStrategy) => void;
  topK: number;
  onTopKChange: (n: number) => void;
  useLlmJudge: boolean;
  onUseLlmJudgeChange: (b: boolean) => void;
  loadedStrategies: string[];
  sttMode: SttMode;
  onSttModeChange: (m: SttMode) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  engine: RagEngine;
  onEngineChange: (e: RagEngine) => void;
}

export function ChunkingSelector({
  strategy,
  onChange,
  topK,
  onTopKChange,
  useLlmJudge,
  onUseLlmJudgeChange,
  loadedStrategies,
  sttMode,
  onSttModeChange,
  language,
  onLanguageChange,
  engine,
  onEngineChange,
}: ChunkingSelectorProps) {
  const meta = CHUNKING_DESCRIPTIONS[strategy];

  return (
    <div className="card-paper rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">RAG Architecture</span>
        <span className="chip chip-gold capitalize">{strategy}</span>
      </div>

      {/* Generation Engine Selector (Task 2 <50ms SLA) */}
      <div className="mb-4 rounded-lg border border-goa-gold-300/70 dark:border-goa-gold-500/30 bg-goa-gold-50/40 dark:bg-goa-gold-950/30 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-forest-900 dark:text-forest-100">Answer Engine</span>
          <div className="flex items-center gap-1 bg-forest-100 dark:bg-forest-950/60 rounded-full p-0.5 border border-forest-200/50 dark:border-forest-800/50">
            <button suppressHydrationWarning
              onClick={() => onEngineChange("fast")}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                engine === "fast"
                  ? "bg-forest-700 dark:bg-forest-600 text-white shadow-xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-800 dark:hover:text-forest-200"
              }`}
            >
              Fast Local (&lt;50ms)
            </button>
            <button suppressHydrationWarning
              onClick={() => onEngineChange("sarvam")}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors cursor-pointer ${
                engine === "sarvam"
                  ? "bg-forest-700 dark:bg-forest-600 text-white shadow-xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-800 dark:hover:text-forest-200"
              }`}
            >
              Sarvam Cloud
            </button>
          </div>
        </div>
        <p className="text-[10px] text-forest-600 dark:text-forest-300 leading-snug">
          {engine === "fast"
            ? "⚡ Fast Local Grounded Synthesizer (<2ms). 100% compliant with Task 2 <50ms SLA. Zero hallucination."
            : "☁️ Sarvam AI Cloud LLM Generative Mode (~950ms). Synthesizes natural language answers."}
        </p>
      </div>

      {/* Multilingual Speech & Language Configuration */}
      <div className="mb-4 rounded-lg border border-forest-200/70 dark:border-forest-800/70 bg-forest-50/40 dark:bg-forest-950/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
            <span className="text-xs font-semibold text-forest-800 dark:text-forest-200">Voice Language</span>
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

        {/* STT mode toggle — translate Indic speech to English for retrieval */}
        <div className="flex items-center justify-between pt-2 border-t border-forest-200/40 dark:border-forest-800/40">
          <div className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
            <span className="text-[11px] font-medium text-forest-700 dark:text-forest-300">Speech Mode</span>
          </div>
          <div className="flex items-center gap-1 bg-forest-100 dark:bg-forest-950/60 rounded-full p-0.5 border border-forest-200/50 dark:border-forest-800/50">
            <button suppressHydrationWarning
              onClick={() => onSttModeChange("transcribe")}
              className={`px-2.5 py-0.5 text-[10px] font-medium rounded-full transition-colors cursor-pointer ${
                sttMode === "transcribe"
                  ? "bg-white dark:bg-forest-800 text-forest-800 dark:text-forest-100 shadow-xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-200"
              }`}
            >
              Transcribe
            </button>
            <button suppressHydrationWarning
              onClick={() => onSttModeChange("translate")}
              className={`px-2.5 py-0.5 text-[10px] font-medium rounded-full transition-colors cursor-pointer ${
                sttMode === "translate"
                  ? "bg-white dark:bg-forest-800 text-forest-800 dark:text-forest-100 shadow-xs"
                  : "text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-200"
              }`}
            >
              Translate → EN
            </button>
          </div>
        </div>
        <p className="text-[10px] text-forest-500 dark:text-forest-400 mt-1.5 leading-snug">
          {sttMode === "translate"
            ? "✨ Translates spoken Indic languages (Hindi, Bengali, Tamil, etc.) to English before retrieval for optimal MSMARCO matching."
            : "Transcribes speech in original language."}
        </p>
      </div>

      {/* Strategy grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {CHUNKING_STRATEGIES.map((s) => {
          const loaded = loadedStrategies.includes(s);
          const isActive = s === strategy;
          return (
            <button suppressHydrationWarning
              key={s}
              onClick={() => loaded && onChange(s)}
              disabled={!loaded}
              className={`
                px-3 py-2.5 rounded-lg border text-left transition-all
                ${
                  isActive
                    ? "border-forest-500 bg-forest-50/80 dark:border-forest-500 dark:bg-forest-950/60 shadow-[0_0_0_3px_rgba(82,183,136,0.15)]"
                    : "border-forest-200 dark:border-forest-800/80 hover:border-forest-300 dark:hover:border-forest-700 bg-white dark:bg-[#11231c]"
                }
                ${!loaded ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <div className="text-xs font-semibold text-forest-800 dark:text-forest-100">
                {CHUNKING_DESCRIPTIONS[s].name}
              </div>
              <div className="text-[10px] text-forest-500 dark:text-forest-400 mt-0.5">
                {loaded ? "loaded" : "not loaded"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div className="rounded-md bg-forest-50/60 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60 p-3 mb-4">
        <p className="text-[11px] text-forest-700 dark:text-forest-300 leading-relaxed">{meta.description}</p>
      </div>

      {/* Top-K slider */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider text-forest-600 dark:text-forest-400 font-semibold">
            Top-K chunks
          </label>
          <span className="chip chip-forest tabular">{topK}</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={topK}
          onChange={(e) => onTopKChange(Number(e.target.value))}
          className="brand-range"
        />
        <div className="flex justify-between text-[10px] text-forest-400 dark:text-forest-500 tabular">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      {/* LLM judge toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-forest-100 dark:border-forest-800/60">
        <div>
          <div className="text-xs font-medium text-forest-800 dark:text-forest-200">LLM hallucination judge</div>
          <div className="text-[10px] text-forest-500 dark:text-forest-400">Strict grounding · adds ~1.5s</div>
        </div>
        <button suppressHydrationWarning
          onClick={() => onUseLlmJudgeChange(!useLlmJudge)}
          role="switch"
          aria-checked={useLlmJudge}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
            useLlmJudge ? "bg-forest-600 dark:bg-forest-500" : "bg-forest-200 dark:bg-forest-800"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              useLlmJudge ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
