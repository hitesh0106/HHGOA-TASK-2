"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, CheckCircle2 } from "lucide-react";

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
    listening: "Listening…",
    transcribing: "Transcribing…",
    processing: "Retrieving knowledge…",
    ready: "Tap to speak again",
  };

  const handleClick = () => {
    if (isListening) onStop();
    else if (!isWorking) onStart();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Mic + waveform ring */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border border-forest-200" />

        {/* Concentric rings (always visible, faint) */}
        <div className="absolute inset-3 rounded-full border border-forest-200/60" />
        <div className="absolute inset-6 rounded-full border border-forest-100/80" />

        {/* Animated wave rings (only when listening) */}
        {isListening && (
          <>
            <span className="wave-ring text-forest-500" />
            <span className="wave-ring text-forest-500 delay-1" />
            <span className="wave-ring text-forest-500 delay-2" />
            <span className="wave-ring text-goa-gold-400 delay-3" />
          </>
        )}

        {/* Processing shimmer ring */}
        {(isWorking || isReady) && (
          <div
            className="absolute inset-3 rounded-full border-2 border-goa-gold-300/60"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, var(--color-goa-gold-300) 90deg, transparent 180deg)",
              WebkitMask: "radial-gradient(transparent 56%, black 58%)",
              mask: "radial-gradient(transparent 56%, black 58%)",
              animation: "spin 2s linear infinite",
            }}
          />
        )}

        {/* Mic button — pure HTML, no Framer Motion */}
        <button
          onClick={handleClick}
          disabled={isWorking}
          aria-label={isListening ? "Stop recording" : "Start recording"}
          className={`
            relative z-10 w-24 h-24 rounded-full flex items-center justify-center
            transition-all duration-200 active:scale-95
            disabled:opacity-60 disabled:cursor-not-allowed
            ${
              isListening
                ? "bg-forest-800 text-white shadow-[0_8px_30px_-8px_rgba(11,29,20,0.6)]"
                : isWorking
                ? "bg-goa-gold-400 text-forest-900 shadow-[0_8px_30px_-8px_rgba(217,148,32,0.6)]"
                : "bg-forest-700 text-white shadow-[0_8px_30px_-8px_rgba(11,29,20,0.5)] hover:bg-forest-800"
            }
          `}
        >
          {/* Inner gold ring */}
          <span
            className={`absolute inset-2 rounded-full border ${
              isListening ? "border-forest-500" : "border-goa-gold-300/40"
            }`}
          />

          {isWorking ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : isListening ? (
            <Square className="w-6 h-6 fill-current" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>
      </div>

      {/* Status text */}
      <div className="mt-6 text-center">
        <div className="text-sm font-medium text-forest-800">{statusLabel[state]}</div>
        <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-forest-500 tabular">
          {isListening && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Recording · tap to stop</span>
            </>
          )}
          {isWorking && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-goa-gold-500 animate-pulse" />
              <span>Pipeline running</span>
            </>
          )}
          {state === "idle" && <span>Press the microphone to begin</span>}
          {isReady && <span>Ready for your next question</span>}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 max-w-sm px-3 py-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}
    </div>
  );
}
