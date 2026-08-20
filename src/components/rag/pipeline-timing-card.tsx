"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Zap, Timer, ShieldCheck, Database, Sparkles } from "lucide-react";

export interface StageTimings {
  sttMs?: number | null;
  inputGuardrailsMs?: number;
  retrievalMs?: number;
  retrievalGuardrailsMs?: number;
  generationMs?: number;
  outputGuardrailsMs?: number;
  totalMs?: number;
}

interface PipelineTimingCardProps {
  isProcessing: boolean;
  timings?: StageTimings | null;
  engine?: "fast" | "sarvam";
  isVoice?: boolean;
  onAnimationComplete?: () => void;
}

export function PipelineTimingCard({
  isProcessing,
  timings,
  engine = "fast",
  isVoice = false,
  onAnimationComplete,
}: PipelineTimingCardProps) {
  // Step reveal state for sequential timing animation (0 -> 1 -> 2 -> 3 -> 4)
  const [revealedStep, setRevealedStep] = useState<number>(isProcessing ? 0 : 4);

  useEffect(() => {
    if (isProcessing) {
      setRevealedStep(0);
      return;
    }

    if (timings) {
      // Sequentially reveal stages 1 -> 2 -> 3 -> 4 rapidly
      let step = 1;
      setRevealedStep(step);
      const interval = setInterval(() => {
        step += 1;
        setRevealedStep(step);
        if (step >= 4) {
          clearInterval(interval);
          if (onAnimationComplete) onAnimationComplete();
        }
      }, 120);

      return () => clearInterval(interval);
    }
  }, [isProcessing, timings, onAnimationComplete]);

  // If currently fetching from backend and no timings yet:
  if (isProcessing && !timings) {
    return (
      <div className="w-full rounded-xl border border-goa-gold-300/60 dark:border-goa-gold-500/30 bg-goa-gold-50/40 dark:bg-goa-gold-950/30 p-3.5 space-y-2.5 shadow-2xs animate-pulse">
        <div className="flex items-center justify-between text-xs font-semibold text-forest-900 dark:text-forest-100">
          <span className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-goa-gold-500 animate-spin" />
            <span>Processing query through RAG pipeline…</span>
          </span>
          <span className="text-[10px] text-forest-500 font-mono">Live Execution</span>
        </div>

        <div className="space-y-1.5 text-xs text-forest-600 dark:text-forest-300">
          <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-goa-gold-500 animate-spin" />
            <span>Retrieving knowledge from MSMARCO-XI…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!timings) return null;

  const sttMs = timings.sttMs;
  const retrievalMs = timings.retrievalMs ?? 0;
  const guardrailsMs =
    (timings.inputGuardrailsMs ?? 0) +
    (timings.retrievalGuardrailsMs ?? 0) +
    (timings.outputGuardrailsMs ?? 0);
  const genMs = timings.generationMs ?? 0;
  const totalMs = timings.totalMs ?? retrievalMs + guardrailsMs + genMs;
  const targetMs = 50; // Task 2 SLA
  const meetsSla = totalMs <= targetMs;

  const isFastEngine = engine === "fast";

  return (
    <div className="w-full rounded-xl border border-forest-200/80 dark:border-forest-800 bg-white/90 dark:bg-[#11231c]/90 p-3.5 space-y-2.5 shadow-2xs transition-all duration-200">
      {/* Header status */}
      <div className="flex items-center justify-between text-xs font-bold text-forest-900 dark:text-forest-100 pb-1.5 border-b border-forest-100 dark:border-forest-800/60">
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-goa-gold-500" />
          <span>Real RAG Pipeline Execution</span>
        </span>
        <span className="text-[10px] uppercase font-mono tracking-wider text-forest-500 dark:text-forest-400">
          {isFastEngine ? "Fast Local Engine" : "Sarvam Cloud Engine"}
        </span>
      </div>

      {/* Sequential real stage timings */}
      <div className="space-y-1.5 text-xs">
        {/* Stage 0: STT (if voice) */}
        {isVoice && sttMs !== undefined && sttMs !== null && (
          <div className="flex items-center justify-between transition-opacity duration-150">
            <span className="flex items-center gap-2 text-forest-800 dark:text-forest-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Speech recognition (Sarvam Saaras v3)</span>
            </span>
            <span className="font-mono text-[11px] font-semibold text-forest-600 dark:text-forest-300 tabular">
              {sttMs.toFixed(0)}ms
            </span>
          </div>
        )}

        {/* Stage 1: Retrieval */}
        {revealedStep >= 1 && (
          <div className="flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2 text-forest-800 dark:text-forest-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Retrieval (BM25 + Vector Hybrid)</span>
            </span>
            <span className="font-mono text-[11px] font-semibold text-forest-600 dark:text-forest-300 tabular">
              {retrievalMs < 0.1 ? "<0.10ms" : `${retrievalMs.toFixed(2)}ms`}
            </span>
          </div>
        )}

        {/* Stage 2: Guardrails */}
        {revealedStep >= 2 && (
          <div className="flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2 text-forest-800 dark:text-forest-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Guardrails (Safety, Topic, Lexical Grounding)</span>
            </span>
            <span className="font-mono text-[11px] font-semibold text-forest-600 dark:text-forest-300 tabular">
              {guardrailsMs < 0.1 ? "<0.10ms" : `${guardrailsMs.toFixed(2)}ms`}
            </span>
          </div>
        )}

        {/* Stage 3: Grounded Synthesis */}
        {revealedStep >= 3 && (
          <div className="flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2 text-forest-800 dark:text-forest-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>Grounded synthesis ({isFastEngine ? "Fast Claim Extractor" : "Sarvam-105B"})</span>
            </span>
            <span className="font-mono text-[11px] font-semibold text-forest-600 dark:text-forest-300 tabular">
              {genMs < 0.1 ? "<0.10ms" : `${genMs.toFixed(2)}ms`}
            </span>
          </div>
        )}
      </div>

      {/* Stage 4: Total Timing Summary & SLA Verdict */}
      {revealedStep >= 4 && (
        <div className="pt-2 mt-1 border-t border-forest-100 dark:border-forest-800/80 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold text-forest-950 dark:text-forest-50">
            <Zap className="w-3.5 h-3.5 text-goa-gold-500" />
            <span>Total {isFastEngine ? "Fast Local RAG" : "Pipeline"}</span>
            <span className="font-mono tabular text-sm text-goa-gold-700 dark:text-goa-gold-400">
              {totalMs < 1 ? "<1.0ms" : `${totalMs.toFixed(2)}ms`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={`chip text-[10px] font-bold ${
                meetsSla ? "chip-emerald" : "chip-rose"
              }`}
            >
              {meetsSla ? "✓ Under 50ms SLA" : "Over 50ms SLA"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
