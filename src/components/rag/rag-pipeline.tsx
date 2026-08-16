"use client";

import { Mic, FileText, Search, ShieldCheck, MessageSquare } from "lucide-react";

export type PipelineStageId = "voice" | "transcript" | "retrieve" | "ground" | "answer";

export type PipelineStageStatus = "pending" | "active" | "done" | "blocked";

interface Stage {
  id: PipelineStageId;
  label: string;
  icon: React.ReactNode;
  latencyMs?: number;
}

interface RAGPipelineProps {
  stages: Record<PipelineStageId, PipelineStageStatus>;
  /** Optional per-stage latency to display under each node */
  latencies?: Partial<Record<PipelineStageId, number>>;
}

const STAGE_ORDER: Stage[] = [
  { id: "voice", label: "Voice", icon: <Mic className="w-4 h-4" /> },
  { id: "transcript", label: "Transcript", icon: <FileText className="w-4 h-4" /> },
  { id: "retrieve", label: "Retrieve", icon: <Search className="w-4 h-4" /> },
  { id: "ground", label: "Ground", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "answer", label: "Answer", icon: <MessageSquare className="w-4 h-4" /> },
];

export function RAGPipeline({ stages, latencies }: RAGPipelineProps) {
  return (
    <div className="card-paper rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">RAG Pipeline</span>
        <span className="text-[11px] text-forest-500 tabular">5-stage orchestration</span>
      </div>

      {/* Desktop: horizontal flow */}
      <div className="hidden sm:flex items-center justify-between">
        {STAGE_ORDER.map((stage, i) => (
          <div key={stage.id} className="flex-1 flex items-center">
            <PipelineNode
              stage={stage}
              status={stages[stage.id]}
              latency={latencies?.[stage.id]}
            />
            {i < STAGE_ORDER.length - 1 && (
              <div
                className={`flex-1 mx-1 ${
                  stages[stage.id] === "done" && stages[STAGE_ORDER[i + 1].id] !== "pending"
                    ? "flow-line animated"
                    : "flow-line opacity-40"
                }`}
                style={{ color: "var(--color-forest-400)" }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical flow */}
      <div className="sm:hidden flex flex-col gap-2">
        {STAGE_ORDER.map((stage, i) => (
          <div key={stage.id}>
            <PipelineNode
              stage={stage}
              status={stages[stage.id]}
              latency={latencies?.[stage.id]}
              compact
            />
            {i < STAGE_ORDER.length - 1 && (
              <div
                className={`ml-5 w-px h-4 ${
                  stages[stage.id] === "done" ? "bg-forest-400" : "bg-forest-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineNode({
  stage,
  status,
  latency,
  compact = false,
}: {
  stage: Stage;
  status: PipelineStageStatus;
  latency?: number;
  compact?: boolean;
}) {
  const styles: Record<PipelineStageStatus, { ring: string; bg: string; text: string; label: string }> = {
    pending: {
      ring: "border-forest-200",
      bg: "bg-white",
      text: "text-forest-400",
      label: "text-forest-400",
    },
    active: {
      ring: "border-goa-gold-400",
      bg: "bg-goa-gold-50",
      text: "text-goa-gold-700",
      label: "text-goa-gold-800",
    },
    done: {
      ring: "border-forest-500",
      bg: "bg-forest-50",
      text: "text-forest-700",
      label: "text-forest-700",
    },
    blocked: {
      ring: "border-rose-400",
      bg: "bg-rose-50",
      text: "text-rose-600",
      label: "text-rose-700",
    },
  };
  const s = styles[status];

  return (
    <div className={`flex ${compact ? "flex-row items-center gap-3" : "flex-col items-center"} ${compact ? "" : "w-20"} text-center`}>
      <div
        className={`
          ${compact ? "w-9 h-9" : "w-12 h-12"} rounded-full flex items-center justify-center
          border-2 ${s.ring} ${s.bg} ${s.text}
          ${status === "active" ? "shadow-[0_0_0_4px_rgba(231,177,58,0.15)]" : ""}
          transition-all duration-300
        `}
      >
        {status === "active" ? (
          <div className="w-2 h-2 rounded-full bg-goa-gold-500 animate-pulse" />
        ) : (
          stage.icon
        )}
      </div>
      <div className={`mt-2 text-[11px] font-medium ${s.label} ${compact ? "mt-0" : ""}`}>
        {stage.label}
      </div>
      {latency !== undefined && status === "done" && (
        <div className="text-[10px] text-forest-500 tabular mt-0.5">
          {latency < 1 ? `${(latency * 1000).toFixed(0)}µs` : `${latency.toFixed(latency < 10 ? 2 : 0)}ms`}
        </div>
      )}
    </div>
  );
}
