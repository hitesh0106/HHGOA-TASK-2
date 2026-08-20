"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

export interface RetrievedChunkData {
  id: string;
  docId: string;
  text: string;
  score: number;
  rank: number;
  strategy: string;
  metadata?: Record<string, unknown>;
}

interface RetrievalPanelProps {
  chunks: RetrievedChunkData[];
  totalScanned?: number;
  retrievalLatencyMs?: number;
}

export function RetrievalPanel({
  chunks,
  totalScanned,
  retrievalLatencyMs,
}: RetrievalPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="card-paper rounded-xl overflow-hidden">
      <button suppressHydrationWarning
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-forest-50/40 dark:hover:bg-forest-950/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
          <span className="eyebrow">Retrieved Knowledge</span>
          <span className="chip chip-forest tabular ml-2">
            {chunks.length} of top 5
          </span>
        </div>
        <div className="flex items-center gap-3">
          {retrievalLatencyMs !== undefined && (
            <span className="text-[11px] text-forest-500 dark:text-forest-400 tabular">
              {retrievalLatencyMs.toFixed(2)}ms
            </span>
          )}
          {totalScanned !== undefined && (
            <span className="text-[11px] text-forest-400 dark:text-forest-500 tabular hidden sm:inline">
              scanned {totalScanned}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-forest-500 dark:text-forest-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-forest-500 dark:text-forest-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-forest-100 dark:border-forest-800/60">
          {chunks.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-forest-400 dark:text-forest-500">
              No chunks retrieved above threshold.
            </div>
          ) : (
            <div className="divide-y divide-forest-100 dark:divide-forest-800/60">
              {chunks.map((c, i) => (
                <RetrievedChunk key={c.id} chunk={c} index={i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RetrievedChunk({ chunk, index }: { chunk: RetrievedChunkData; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  // Score → color
  const score = chunk.score;
  const scoreChip =
    score >= 0.4 ? "chip-emerald" : score >= 0.2 ? "chip-gold" : "chip-muted";

  return (
    <div className="px-5 py-3 hover:bg-forest-50/30 dark:hover:bg-forest-950/30 transition-colors">
      <button suppressHydrationWarning
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start gap-3 cursor-pointer"
      >
        <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-forest-100 dark:bg-forest-900 text-forest-700 dark:text-forest-200 text-[10px] font-semibold flex items-center justify-center tabular">
          C{index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`chip ${scoreChip} tabular`}>
              {score.toFixed(3)}
            </span>
            <span className="chip chip-muted uppercase">
              {chunk.strategy}
            </span>
            {typeof chunk.metadata?.word_count === "number" && (
              <span className="text-[10px] text-forest-400 dark:text-forest-500 tabular">
                {String(chunk.metadata.word_count)} words
              </span>
            )}
          </div>
          <p
            className={`text-sm text-forest-800 dark:text-forest-100 leading-snug ${
              expanded ? "" : "line-clamp-2"
            }`}
          >
            {chunk.text}
          </p>
        </div>
        <ChevronRight
          className={`flex-shrink-0 w-4 h-4 text-forest-400 dark:text-forest-500 mt-1 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>
    </div>
  );
}
