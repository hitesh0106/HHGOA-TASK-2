"use client";

import { Mic, Database, Cpu, Gauge, Timer } from "lucide-react";

interface LatencyMetricsProps {
  sttMs: number | null;
  retrievalMs: number | null;
  generationMs: number | null;
  totalMs: number | null;
}

export function LatencyMetrics({
  sttMs,
  retrievalMs,
  generationMs,
  totalMs,
}: LatencyMetricsProps) {
  const targetMs = 50; // retrieval target

  const metrics = [
    {
      label: "STT",
      icon: <Mic className="w-3 h-3" />,
      value: sttMs,
      unit: "ms",
      hint: "Sarvam Saaras",
      showTarget: false,
    },
    {
      label: "Retrieval",
      icon: <Database className="w-3 h-3" />,
      value: retrievalMs,
      unit: "ms",
      hint: `target ≤ ${targetMs}ms`,
      showTarget: true,
    },
    {
      label: "Generation",
      icon: <Cpu className="w-3 h-3" />,
      value: generationMs,
      unit: "ms",
      hint: "Sarvam-105B",
      showTarget: false,
    },
    {
      label: "Total",
      icon: <Gauge className="w-3 h-3" />,
      value: totalMs,
      unit: "ms",
      hint: "End-to-end",
      showTarget: false,
    },
  ];

  return (
    <div className="card-paper rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="w-3.5 h-3.5 text-forest-600" />
          <span className="eyebrow">Latency Metrics</span>
        </div>
        <span className="text-[11px] text-forest-500 tabular">measured · real-time</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const meetsTarget =
            m.showTarget && m.value !== null && m.value <= targetMs;
          const exceedsTarget =
            m.showTarget && m.value !== null && m.value > targetMs;
          return (
            <div
              key={m.label}
              className="rounded-lg border border-forest-200/70 bg-forest-50/40 p-3 text-center"
            >
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider text-forest-500 font-semibold">
                {m.icon}
                {m.label}
              </div>
              <div className="mt-1.5 flex items-baseline justify-center gap-1">
                <span className="text-xl font-semibold text-forest-900 tabular">
                  {m.value === null ? "—" : m.value < 1 ? "<1" : m.value.toFixed(m.value < 10 ? 2 : 0)}
                </span>
                <span className="text-[10px] text-forest-500">{m.unit}</span>
              </div>
              <div className="text-[10px] text-forest-400 mt-0.5">{m.hint}</div>
              {m.showTarget && meetsTarget && (
                <div className="mt-1 text-[10px] text-forest-600 font-medium">
                  ✓ under 50ms
                </div>
              )}
              {m.showTarget && exceedsTarget && (
                <div className="mt-1 text-[10px] text-rose-600 font-medium">
                  ✗ over 50ms
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
