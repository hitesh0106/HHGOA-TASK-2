"use client";

import { Languages } from "lucide-react";
import { CHUNKING_STRATEGIES, CHUNKING_DESCRIPTIONS, type ChunkingStrategy } from "@/lib/chunking";

export type SttMode = "transcribe" | "translate";
export type RagEngine = "fast" | "sarvam";

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
      <div className="mb-4 rounded-lg border border-goa-gold-300/70 bg-goa-gold-50/40 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-forest-900">Answer Engine</span>
          <div className="flex items-center gap-1 bg-forest-100 rounded-full p-0.5">
            <button suppressHydrationWarning
              onClick={() => onEngineChange("fast")}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors ${
                engine === "fast" ? "bg-forest-700 text-white shadow-sm" : "text-forest-600"
              }`}
            >
              Fast Local (&lt;50ms)
            </button>
            <button suppressHydrationWarning
              onClick={() => onEngineChange("sarvam")}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-full transition-colors ${
                engine === "sarvam" ? "bg-forest-700 text-white shadow-sm" : "text-forest-600"
              }`}
            >
              Sarvam Cloud
            </button>
          </div>
        </div>
        <p className="text-[10px] text-forest-600 leading-snug">
          {engine === "fast"
            ? "⚡ Fast Local Grounded Synthesizer (<2ms). 100% compliant with Task 2 <50ms SLA. Zero hallucination."
            : "☁️ Sarvam AI Cloud LLM Generative Mode (~950ms). Synthesizes natural language answers."}
        </p>
      </div>

      {/* STT mode toggle — translate Indic speech to English for retrieval */}
      <div className="mb-4 rounded-lg border border-forest-200/70 bg-forest-50/40 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-forest-600" />
            <span className="text-xs font-medium text-forest-800">Speech mode</span>
          </div>
          <div className="flex items-center gap-1 bg-forest-100 rounded-full p-0.5">
            <button suppressHydrationWarning
              onClick={() => onSttModeChange("transcribe")}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors ${
                sttMode === "transcribe" ? "bg-white text-forest-800 shadow-sm" : "text-forest-600"
              }`}
            >
              Transcribe
            </button>
            <button suppressHydrationWarning
              onClick={() => onSttModeChange("translate")}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-colors ${
                sttMode === "translate" ? "bg-white text-forest-800 shadow-sm" : "text-forest-600"
              }`}
            >
              Translate → EN
            </button>
          </div>
        </div>
        <p className="text-[10px] text-forest-500 leading-snug">
          {sttMode === "transcribe"
            ? "Keeps speech in its original language. Best for English queries."
            : "Translates Indic speech to English before retrieval. Use this for Hindi/Marathi/Tamil/etc. — the corpus is English."}
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
                    ? "border-forest-500 bg-forest-50 shadow-[0_0_0_3px_rgba(53,97,70,0.10)]"
                    : "border-forest-200 hover:border-forest-300 bg-white"
                }
                ${!loaded ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <div className="text-xs font-semibold text-forest-800">
                {CHUNKING_DESCRIPTIONS[s].name}
              </div>
              <div className="text-[10px] text-forest-500 mt-0.5">
                {loaded ? "loaded" : "not loaded"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Description */}
      <div className="rounded-md bg-forest-50/60 border border-forest-100 p-3 mb-4">
        <p className="text-[11px] text-forest-700 leading-relaxed">{meta.description}</p>
      </div>

      {/* Top-K slider */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider text-forest-600 font-semibold">
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
        <div className="flex justify-between text-[10px] text-forest-400 tabular">
          <span>1</span>
          <span>10</span>
        </div>
      </div>

      {/* LLM judge toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-forest-100">
        <div>
          <div className="text-xs font-medium text-forest-800">LLM hallucination judge</div>
          <div className="text-[10px] text-forest-500">Strict grounding · adds ~1.5s</div>
        </div>
        <button suppressHydrationWarning
          onClick={() => onUseLlmJudgeChange(!useLlmJudge)}
          role="switch"
          aria-checked={useLlmJudge}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            useLlmJudge ? "bg-forest-600" : "bg-forest-200"
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
