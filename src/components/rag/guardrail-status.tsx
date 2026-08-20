"use client";

import { CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";

export interface GuardrailDecision {
  name: string;
  pass: boolean;
  severity: "ok" | "warn" | "block";
  reason: string;
  latencyMs: number;
}

interface GuardrailStatusProps {
  input: GuardrailDecision[];
  output: GuardrailDecision[];
  retrieval: GuardrailDecision | null;
  combined: { block: boolean; warn: boolean; reasons: string[]; totalLatencyMs: number };
}

export function GuardrailStatus({
  input,
  output,
  retrieval,
  combined,
}: GuardrailStatusProps) {
  const all = [...input, ...(retrieval ? [retrieval] : []), ...output];

  const overall: "ok" | "warn" | "block" = combined.block
    ? "block"
    : combined.warn
    ? "warn"
    : "ok";

  const overallConfig = {
    ok: {
      label: "All guardrails passed",
      icon: <ShieldCheck className="w-4 h-4 text-forest-600 dark:text-emerald-400" />,
      chipClass: "chip-emerald",
      bgClass: "bg-forest-50/60 dark:bg-forest-950/40 border-forest-200 dark:border-forest-800/80",
    },
    warn: {
      label: "Passed with warnings",
      icon: <AlertTriangle className="w-4 h-4 text-goa-gold-700 dark:text-goa-gold-400" />,
      chipClass: "chip-gold",
      bgClass: "bg-goa-gold-50/60 dark:bg-goa-gold-950/40 border-goa-gold-300 dark:border-goa-gold-500/40",
    },
    block: {
      label: "Blocked by guardrail",
      icon: <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
      chipClass: "chip-rose",
      bgClass: "bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/60",
    },
  }[overall];

  return (
    <div className="card-paper rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow">Guardrails</span>
        <span className="text-[11px] text-forest-500 dark:text-forest-400 tabular">
          {all.length} checks · {combined.totalLatencyMs.toFixed(2)}ms
        </span>
      </div>

      {/* Overall verdict */}
      <div className={`rounded-lg border ${overallConfig.bgClass} p-3 mb-4`}>
        <div className="flex items-center gap-2">
          {overallConfig.icon}
          <span className="text-sm font-medium text-forest-800 dark:text-forest-100">{overallConfig.label}</span>
        </div>
        {combined.reasons.length > 0 && (
          <ul className="mt-2 space-y-1">
            {combined.reasons.map((r, i) => (
              <li key={i} className="text-[11px] text-forest-600 dark:text-forest-300 flex items-start gap-1.5">
                <span className="text-forest-400 dark:text-forest-500 mt-0.5">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Per-guardrail list */}
      <div className="space-y-2">
        {all.map((g, i) => (
          <GuardrailRow key={`${g.name}-${i}`} decision={g} />
        ))}
      </div>
    </div>
  );
}

function GuardrailRow({ decision }: { decision: GuardrailDecision }) {
  const config = {
    ok: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-forest-500 dark:text-emerald-400" />,
      chipClass: "chip-emerald",
    },
    warn: {
      icon: <AlertTriangle className="w-3.5 h-3.5 text-goa-gold-600 dark:text-goa-gold-400" />,
      chipClass: "chip-gold",
    },
    block: {
      icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />,
      chipClass: "chip-rose",
    },
  }[decision.severity];

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-forest-100 dark:border-forest-800/60 last:border-0">
      <div className="mt-0.5 flex-shrink-0">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-forest-800 dark:text-forest-100">{decision.name}</span>
          <span className="text-[10px] text-forest-400 dark:text-forest-500 tabular">
            {decision.latencyMs.toFixed(2)}ms
          </span>
        </div>
        <p className="text-[11px] text-forest-600 dark:text-forest-300 leading-snug mt-0.5">
          {decision.reason}
        </p>
      </div>
    </div>
  );
}
