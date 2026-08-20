"use client";

import { Mic, Square, Loader2 } from "lucide-react";

type RecorderState = "idle" | "listening" | "transcribing" | "processing" | "ready";

interface VoiceRecorderProps {
  state: RecorderState;
  transcript: string;
  sttLatencyMs: number | null;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

export function VoiceRecorder({
  state,
  transcript,
  sttLatencyMs,
  error,
  onStart,
  onStop,
}: VoiceRecorderProps) {
  const isListening = state === "listening";
  const isWorking = state === "transcribing" || state === "processing";
  const isReady = state === "ready";

  const statusLabel: Record<RecorderState, string> = {
    idle: "Tap to speak",
    listening: "Listening… tap to finish",
    transcribing: "Transcribing speech…",
    processing: "Retrieving knowledge…",
    ready: "Tap to speak again",
  };

  const handleClick = () => {
    if (isListening) onStop();
    else if (!isWorking) onStart();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Mic + waveform ring - Compact & Refined */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border border-forest-200/80 dark:border-forest-800/80 shadow-xs" />

        {/* Concentric ring (faint) */}
        <div className="absolute inset-2 rounded-full border border-forest-200/50 dark:border-forest-800/40" />

        {/* Animated wave rings (only when listening) */}
        {isListening && (
          <>
            <span className="wave-ring text-rose-500" />
            <span className="wave-ring text-rose-500 delay-1" />
            <span className="wave-ring text-goa-gold-400 delay-2" />
          </>
        )}

        {/* Processing shimmer ring */}
        {(isWorking || isReady) && (
          <div
            className="absolute inset-1.5 rounded-full border-2 border-goa-gold-300/70 dark:border-goa-gold-500/70"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, var(--color-goa-gold-300) 90deg, transparent 180deg)",
              WebkitMask: "radial-gradient(transparent 56%, black 58%)",
              mask: "radial-gradient(transparent 56%, black 58%)",
              animation: "spin 2s linear infinite",
            }}
          />
        )}

        {/* Mic button — Rich focal point in both themes */}
        <button suppressHydrationWarning
          onClick={handleClick}
          disabled={isWorking}
          aria-label={isListening ? "Stop recording" : "Start recording"}
          className={`
            relative z-10 w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-95 cursor-pointer
            disabled:opacity-60 disabled:cursor-not-allowed
            ${
              isListening
                ? "bg-rose-600 text-white shadow-[0_6px_24px_-4px_rgba(225,29,72,0.6)] animate-pulse"
                : isWorking
                ? "bg-goa-gold-400 text-forest-950 shadow-[0_6px_24px_-4px_rgba(217,148,32,0.5)]"
                : "bg-forest-800 dark:bg-[#132d22] text-white shadow-[0_6px_20px_-4px_rgba(11,29,20,0.45)] dark:shadow-[0_6px_24px_-4px_rgba(0,0,0,0.7)] hover:bg-forest-900 dark:hover:bg-[#193a2c] hover:scale-105 border border-forest-700/50 dark:border-forest-600/40"
            }
          `}
        >
          {/* Inner gold ring */}
          <span
            className={`absolute inset-1.5 rounded-full border ${
              isListening ? "border-rose-300/40" : "border-goa-gold-300/30 dark:border-goa-gold-400/40"
            }`}
          />

          {isWorking ? (
            <Loader2 className="w-6 h-6 animate-spin text-forest-950" />
          ) : isListening ? (
            <Square className="w-5 h-5 fill-current" />
          ) : (
            <Mic className="w-7 h-7 text-forest-50 dark:text-emerald-100" />
          )}
        </button>
      </div>

      {/* Status text */}
      <div className="mt-2.5 text-center">
        <div className="text-xs font-semibold text-forest-900 dark:text-forest-100">{statusLabel[state]}</div>
        <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-forest-500 dark:text-forest-400 tabular">
          {isListening && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              <span className="text-rose-600 dark:text-rose-400 font-medium">Recording active · speak your question</span>
            </>
          )}
          {isWorking && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-goa-gold-500 animate-pulse" />
              <span className="text-forest-700 dark:text-forest-300">Synthesizing verified grounded answer…</span>
            </>
          )}
          {state === "idle" && <span>Tap mic or type query to begin</span>}
          {isReady && <span>Ready for next voice query</span>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 max-w-sm px-2.5 py-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px]">
          {error}
        </div>
      )}
    </div>
  );
}
