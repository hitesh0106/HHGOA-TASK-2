"use client";

import { CHUNKING_STRATEGIES, CHUNKING_DESCRIPTIONS, type ChunkingStrategy } from "@/lib/chunking";

interface ChunkingSelectorProps {
  strategy: ChunkingStrategy;
  onChange: (s: ChunkingStrategy) => void;
  topK: number;
  onTopKChange: (n: number) => void;
  useLlmJudge: boolean;
  onUseLlmJudgeChange: (b: boolean) => void;
  loadedStrategies: string[];
}

export function ChunkingSelector({
  strategy,
  onChange,
  topK,
  onTopKChange,
  useLlmJudge,
  onUseLlmJudgeChange,
  loadedStrategies,
}: ChunkingSelectorProps) {
  const meta = CHUNKING_DESCRIPTIONS[strategy];

  return (
    <div className="card-paper rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Chunking Strategy</span>
        <span className="chip chip-gold capitalize">{strategy}</span>
      </div>

      {/* Strategy grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {CHUNKING_STRATEGIES.map((s) => {
          const loaded = loadedStrategies.includes(s);
          const isActive = s === strategy;
          return (
            <button
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
        <button
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
