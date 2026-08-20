"use client";

import { Mic, FileText, Search, ShieldCheck, MessageSquare, ArrowRight } from "lucide-react";

export type PipelineStageId = "voice" | "transcript" | "retrieve" | "ground" | "answer";
export type PipelineStageStatus = "pending" | "active" | "done" | "blocked";

interface Stage {
  id: PipelineStageId;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  latencyMs?: number;
}

interface RAGPipelineProps {
  stages: Record<PipelineStageId, PipelineStageStatus>;
  latencies?: Partial<Record<PipelineStageId, number>>;
}

const VOICE_STAGES: Stage[] = [
  { id: "voice", label: "Audio In", sublabel: "Mic Stream", icon: <Mic className="w-3.5 h-3.5" /> },
  { id: "transcript", label: "Speech ASR", sublabel: "Sarvam v3", icon: <FileText className="w-3.5 h-3.5" /> },
];

const RAG_STAGES: Stage[] = [
  { id: "retrieve", label: "Retrieval", sublabel: "BM25 + Vec", icon: <Search className="w-3.5 h-3.5" /> },
  { id: "ground", label: "Guardrails", sublabel: "Grounding", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  { id: "answer", label: "Synthesizer", sublabel: "Grounded Claim", icon: <MessageSquare className="w-3.5 h-3.5" /> },
];

export function RAGPipeline({ stages, latencies }: RAGPipelineProps) {
  return (
    <div className="card-paper rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">End-to-End Orchestration Flow</span>
        <span className="text-[11px] text-forest-500 dark:text-forest-400 tabular">2-Phase Architecture</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Block 1: Remote Voice Gateway */}
        <div className="lg:col-span-4 rounded-lg border border-forest-200/80 dark:border-forest-800/80 bg-forest-50/30 dark:bg-forest-950/30 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-forest-700 dark:text-forest-300 tracking-wider">
              Phase 1: Remote Voice Gateway
            </span>
            <span className="chip chip-muted text-[9px]">Remote API</span>
          </div>

          <div className="flex items-center justify-around py-1">
            {VOICE_STAGES.map((stage, i) => (
              <div key={stage.id} className="flex items-center">
                <PipelineNode
                  stage={stage}
                  status={stages[stage.id]}
                  latency={latencies?.[stage.id]}
                />
                {i < VOICE_STAGES.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-forest-300 dark:text-forest-700 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Phase Transition Divider */}
        <div className="hidden lg:flex items-center justify-center">
          <ArrowRight className="w-4 h-4 text-forest-400 dark:text-forest-600" />
        </div>

        {/* Block 2: Fast Local RAG Pipeline (<50ms Target) */}
        <div className="lg:col-span-7 rounded-lg border border-forest-300 dark:border-forest-700/80 bg-forest-50/60 dark:bg-forest-950/50 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-bold text-forest-800 dark:text-forest-200 tracking-wider">
              Phase 2: Fast Local RAG Pipeline
            </span>
            <span className="chip chip-gold text-[9px] font-semibold">
              Target &le; 50ms SLA
            </span>
          </div>

          <div className="flex items-center justify-around py-1">
            {RAG_STAGES.map((stage, i) => (
              <div key={stage.id} className="flex items-center">
                <PipelineNode
                  stage={stage}
                  status={stages[stage.id]}
                  latency={latencies?.[stage.id]}
                />
                {i < RAG_STAGES.length - 1 && (
                  <div className="w-4 h-0.5 bg-forest-200 dark:bg-forest-800 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineNode({
  stage,
  status,
  latency,
}: {
  stage: Stage;
  status: PipelineStageStatus;
  latency?: number;
}) {
  const styles: Record<PipelineStageStatus, { ring: string; bg: string; text: string; label: string }> = {
    pending: {
      ring: "border-forest-200 dark:border-forest-800",
      bg: "bg-white dark:bg-[#11231c]",
      text: "text-forest-400 dark:text-forest-500",
      label: "text-forest-400 dark:text-forest-500",
    },
    active: {
      ring: "border-goa-gold-400 dark:border-goa-gold-500",
      bg: "bg-goa-gold-50 dark:bg-goa-gold-950/60",
      text: "text-goa-gold-700 dark:text-goa-gold-300",
      label: "text-goa-gold-800 dark:text-goa-gold-200",
    },
    done: {
      ring: "border-forest-500 dark:border-forest-500",
      bg: "bg-forest-50 dark:bg-forest-900/60",
      text: "text-forest-700 dark:text-emerald-300",
      label: "text-forest-700 dark:text-forest-200",
    },
    blocked: {
      ring: "border-rose-400 dark:border-rose-500",
      bg: "bg-rose-50 dark:bg-rose-950/50",
      text: "text-rose-600 dark:text-rose-300",
      label: "text-rose-700 dark:text-rose-300",
    },
  };
  const s = styles[status];

  return (
    <div className="flex flex-col items-center text-center w-20">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          border-2 ${s.ring} ${s.bg} ${s.text}
          ${status === "active" ? "shadow-[0_0_0_4px_rgba(231,177,58,0.15)] dark:shadow-[0_0_0_4px_rgba(243,195,92,0.2)]" : ""}
          transition-all duration-300
        `}
      >
        {status === "active" ? (
          <div className="w-2 h-2 rounded-full bg-goa-gold-500 animate-pulse" />
        ) : (
          stage.icon
        )}
      </div>
      <div className={`mt-1 text-[11px] font-semibold ${s.label} truncate w-full`}>
        {stage.label}
      </div>
      <div className="text-[9px] text-forest-400 dark:text-forest-500 truncate w-full">
        {stage.sublabel}
      </div>
      {latency !== undefined && status === "done" && (
        <div className="text-[10px] text-forest-600 dark:text-emerald-400 font-semibold tabular mt-0.5">
          {latency < 1 ? `${(latency * 1000).toFixed(0)}µs` : `${latency.toFixed(latency < 10 ? 2 : 0)}ms`}
        </div>
      )}
    </div>
  );
}
