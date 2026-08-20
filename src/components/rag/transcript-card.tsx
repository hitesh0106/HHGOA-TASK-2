"use client";

import { CheckCircle2, Mic, RotateCcw } from "lucide-react";

interface TranscriptCardProps {
  transcript: string;
  sttLatencyMs: number | null;
  languageCode: string | null;
  onRerun: () => void;
  isProcessing: boolean;
}

export function TranscriptCard({
  transcript,
  sttLatencyMs,
  languageCode,
  onRerun,
  isProcessing,
}: TranscriptCardProps) {
  if (!transcript) return null;

  return (
    <div className="card-paper rounded-xl p-5 hover-lift">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Your Question</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-emerald">
            <CheckCircle2 className="w-3 h-3" />
            Speech recognized
          </span>
          {sttLatencyMs !== null && (
            <span className="chip chip-muted tabular">STT {sttLatencyMs.toFixed(0)}ms</span>
          )}
          {languageCode && (
            <span className="chip chip-muted uppercase">{languageCode}</span>
          )}
        </div>
      </div>

      <p className="font-serif text-lg sm:text-xl text-forest-900 dark:text-forest-50 leading-snug">
        “{transcript}”
      </p>

      <div className="mt-4 pt-4 border-t border-forest-100 dark:border-forest-800/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-forest-500 dark:text-forest-400">
          <Mic className="w-3 h-3" />
          <span>Sarvam Saaras v3</span>
        </div>
        <button suppressHydrationWarning
          onClick={onRerun}
          disabled={isProcessing}
          className="flex items-center gap-1.5 text-[11px] font-medium text-forest-600 dark:text-forest-300 hover:text-forest-800 dark:hover:text-forest-100 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          Re-run pipeline
        </button>
      </div>
    </div>
  );
}
