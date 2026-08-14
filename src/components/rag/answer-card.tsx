"use client";

import { CheckCircle2, AlertTriangle, ShieldAlert, Quote } from "lucide-react";

export type AnswerState = "grounded" | "insufficient" | "blocked" | "idle";

interface AnswerCardProps {
  answer: string;
  state: AnswerState;
  confidence: "high" | "medium" | "low" | "refused";
  citations: number[];
  warnings?: string[];
}

export function AnswerCard({
  answer,
  state,
  confidence,
  citations,
  warnings = [],
}: AnswerCardProps) {
  const stateConfig: Record<
    AnswerState,
    { label: string; icon: React.ReactNode; chip: string; tint: string }
  > = {
    idle: {
      label: "Awaiting pipeline",
      icon: <Quote className="w-3.5 h-3.5" />,
      chip: "chip-muted",
      tint: "",
    },
    grounded: {
      label: "Grounded in retrieved context",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      chip: "chip-emerald",
      tint: "border-l-2 border-l-forest-500",
    },
    insufficient: {
      label: "Insufficient evidence",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      chip: "chip-gold",
      tint: "border-l-2 border-l-goa-gold-400",
    },
    blocked: {
      label: "Refused by guardrail",
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      chip: "chip-rose",
      tint: "border-l-2 border-l-rose-400",
    },
  };

  const cfg = stateConfig[state];

  const confidenceLabel: Record<typeof confidence, string> = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    refused: "Refused",
  };

  return (
    <div className={`card-paper rounded-xl p-5 ${cfg.tint}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Grounded Answer</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip ${cfg.chip}`}>
            {cfg.icon}
            {cfg.label}
          </span>
          {state !== "idle" && (
            <span className="chip chip-muted capitalize">
              {confidenceLabel[confidence]}
            </span>
          )}
        </div>
      </div>

      {state === "idle" ? (
        <p className="text-forest-400 italic text-sm">
          The grounded answer will appear here after you speak a question.
        </p>
      ) : state === "blocked" ? (
        <div className="space-y-3">
          <p className="font-serif text-lg text-forest-900 leading-snug">
            {answer}
          </p>
          {warnings.length > 0 && (
            <ul className="space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-rose-700 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : state === "insufficient" ? (
        <div className="space-y-3">
          <p className="font-serif text-lg text-forest-900 leading-snug">
            {answer}
          </p>
          <p className="text-xs text-goa-gold-800 italic">
            The retrieved context did not contain enough evidence to answer this
            question confidently.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-serif text-lg text-forest-900 leading-snug">
            {answer}
          </p>
          {citations.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-forest-100">
              <span className="text-[11px] text-forest-500">Citations:</span>
              {citations.map((c) => (
                <span
                  key={c}
                  className="chip chip-gold tabular"
                >
                  C{c}
                </span>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="text-xs text-forest-600 italic">
              {warnings.join(" ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
