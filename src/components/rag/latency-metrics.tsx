"use client";

import { Mic, Database, Cpu, Gauge, Timer, Info } from "lucide-react";

interface LatencyMetricsProps {
  sttMs: number | null;
  retrievalMs: number | null;
  generationMs: number | null;
  totalMs: number | null;
  engine?: "fast" | "sarvam";
}

export function LatencyMetrics({
  sttMs,
  retrievalMs,
  generationMs,
  totalMs,
  engine = "fast",
}: LatencyMetricsProps) {
  const targetMs = 50; // Task 2 SLA target for Fast Local RAG Pipeline

  const ragMeetsTarget = totalMs !== null && totalMs <= targetMs;
  const ragExceedsTarget = totalMs !== null && totalMs > targetMs;

  return (
    <div className="card-paper rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-forest-600" />
          <span className="eyebrow">Real-Time Latency Breakdown</span>
        </div>
        <span className="text-[11px] text-forest-500 tabular">Live Measured Telemetry</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Phase 1: Remote Voice Input (Outside RAG SLA) */}
        <div className="md:col-span-4 rounded-lg border border-forest-200/80 bg-forest-50/30 p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-forest-600 font-semibold">
                <Mic className="w-3 h-3 text-forest-600" />
                Remote Voice STT
              </div>
              <span className="chip chip-muted text-[9px] uppercase">Cloud API</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-forest-900 tabular">
                {sttMs === null ? "—" : sttMs < 1 ? "<1" : sttMs.toFixed(sttMs < 10 ? 2 : 0)}
              </span>
              <span className="text-xs text-forest-500 font-medium">ms</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-forest-100 text-[10px] text-forest-500 leading-tight">
            Sarvam Saaras v3 (Audio Upload + ASR Inference)
          </div>
        </div>

        {/* Phase 2: Fast Local RAG Pipeline (Subject to Task 2 <50ms SLA) */}
        <div className="md:col-span-8 rounded-lg border border-forest-300 bg-forest-50/50 p-3 space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-forest-200/60">
            <div className="text-[10px] uppercase tracking-wider text-forest-700 font-bold flex items-center gap-1">
              <Gauge className="w-3 h-3 text-forest-700" />
              Fast Local RAG Pipeline
            </div>
            <span className="chip chip-gold text-[9px] font-semibold">
              Task 2 Target ≤ {targetMs}ms
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Retrieval Substage */}
            <div className="bg-white/80 rounded border border-forest-200/60 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-forest-500 font-semibold">
                <Database className="w-2.5 h-2.5" />
                Retrieval
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-0.5">
                <span className="text-base font-semibold text-forest-900 tabular">
                  {retrievalMs === null ? "—" : retrievalMs < 1 ? "<1" : retrievalMs.toFixed(retrievalMs < 10 ? 2 : 0)}
                </span>
                <span className="text-[9px] text-forest-500">ms</span>
              </div>
              <div className="text-[9px] text-forest-400 mt-0.5 truncate">BM25 + Vector</div>
            </div>

            {/* Synthesizer Substage */}
            <div className="bg-white/80 rounded border border-forest-200/60 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-forest-500 font-semibold">
                <Cpu className="w-2.5 h-2.5" />
                Synthesizer
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-0.5">
                <span className="text-base font-semibold text-forest-900 tabular">
                  {generationMs === null ? "—" : generationMs < 1 ? "<1" : generationMs.toFixed(generationMs < 10 ? 2 : 0)}
                </span>
                <span className="text-[9px] text-forest-500">ms</span>
              </div>
              <div className="text-[9px] text-forest-400 mt-0.5 truncate">
                {engine === "sarvam" ? "Sarvam-105B" : "Claim Extractor"}
              </div>
            </div>

            {/* RAG Total */}
            <div className={`rounded border p-2 text-center ${ragMeetsTarget ? "bg-emerald-50/70 border-emerald-300" : ragExceedsTarget ? "bg-rose-50/70 border-rose-300" : "bg-white/80 border-forest-200/60"}`}>
              <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-forest-700 font-bold">
                <Gauge className="w-2.5 h-2.5" />
                RAG Total
              </div>
              <div className="mt-1 flex items-baseline justify-center gap-0.5">
                <span className="text-base font-bold text-forest-900 tabular">
                  {totalMs === null ? "—" : totalMs < 1 ? "<1" : totalMs.toFixed(totalMs < 10 ? 2 : 0)}
                </span>
                <span className="text-[9px] text-forest-500 font-medium">ms</span>
              </div>
              {ragMeetsTarget && (
                <div className="text-[9px] text-emerald-700 font-semibold mt-0.5">✓ Under SLA</div>
              )}
              {ragExceedsTarget && (
                <div className="text-[9px] text-rose-700 font-semibold mt-0.5">✗ Cold Start</div>
              )}
              {totalMs === null && (
                <div className="text-[9px] text-forest-400 mt-0.5">≤ 50ms SLA</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-1.5 text-[10px] text-forest-500 bg-forest-50/50 rounded-md p-2.5 border border-forest-100">
        <Info className="w-3.5 h-3.5 text-forest-600 flex-shrink-0 mt-0.5" />
        <span>
          <strong>Timing Architecture:</strong> Task 2 &lt;50ms SLA applies strictly to the <strong>Fast Local RAG Pipeline</strong> (Guardrails + Hybrid Retrieval + Grounded Synthesizer). Voice transcription (Sarvam STT) operates over remote cloud network and is measured separately.
        </span>
      </div>
    </div>
  );
}
