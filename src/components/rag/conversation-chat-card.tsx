"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  Mic,
  Bot,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Timer,
  ChevronDown,
  ChevronRight,
  Database,
} from "lucide-react";
import type { StageTimings } from "./pipeline-timing-card";
import type { GuardrailDecision } from "./guardrail-status";
import { speakAnswer } from "@/lib/tts";

export interface ChatTurnData {
  id: string;
  userQuery: string;
  isVoice?: boolean;
  sttLatencyMs?: number | null;
  sttLanguage?: string | null;
  timestamp: Date;
  isProcessing?: boolean;
  result?: {
    strategy: string;
    engine: "fast" | "sarvam";
    answer: string;
    confidence: "high" | "medium" | "low" | "refused";
    grounded: boolean;
    citations: number[];
    sources: Array<{
      chunk: {
        id: string;
        doc_id: string;
        text: string;
        strategy: string;
        metadata: Record<string, unknown>;
      };
      score: number;
      rank: number;
    }>;
    detectedLanguage?: string;
    languageName?: string;
    contextPreview?: string;
    guardrails?: {
      input: GuardrailDecision[];
      output: GuardrailDecision[];
      combined: { block: boolean; warn: boolean; reasons: string[]; totalLatencyMs: number };
    };
    timings?: StageTimings;
    blocked?: boolean;
    blockReasons?: string[];
  };
}

interface ConversationChatCardProps {
  turns: ChatTurnData[];
}

export function ConversationChatCard({ turns }: ConversationChatCardProps) {
  if (turns.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 my-4">
      {turns.map((turn) => (
        <TurnItem key={turn.id} turn={turn} />
      ))}
    </div>
  );
}

function TurnItem({ turn }: { turn: ChatTurnData }) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<"sources" | "timings" | "guardrails" | null>(null);

  const res = turn.result;
  const isBlocked = res?.blocked;
  const isGrounded = res?.grounded;
  const citations = res?.citations || [];
  const sources = res?.sources || [];
  const timings = res?.timings;
  const totalMs = timings?.totalMs;
  const guardrails = res?.guardrails;

  const handleCopy = async () => {
    if (!res?.answer) return;
    try {
      await navigator.clipboard.writeText(res.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleTTS = () => {
    if (!res?.answer || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    speakAnswer(
      res.answer,
      res.detectedLanguage || "en",
      () => setIsSpeaking(false),
      () => setIsSpeaking(false)
    );
  };

  const toggleDrawer = (drawer: "sources" | "timings" | "guardrails") => {
    setActiveDrawer((prev) => (prev === drawer ? null : drawer));
  };

  return (
    <div className="space-y-4">
      {/* 1. User Message (Aligned Right) */}
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs px-5 py-3 bg-forest-800 dark:bg-[#1a382a] text-white shadow-xs space-y-1">
          <div className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
            {turn.userQuery}
          </div>
          {turn.isVoice && (
            <div className="flex items-center gap-1.5 text-[10px] text-forest-200/90 pt-0.5">
              <Mic className="w-3 h-3 text-goa-gold-400" />
              <span>Spoken query</span>
              {turn.sttLatencyMs && (
                <span className="tabular font-mono">({turn.sttLatencyMs.toFixed(0)}ms)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Loading State if processing */}
      {turn.isProcessing && !res && (
        <div className="card-paper rounded-2xl p-5 border border-forest-200 dark:border-forest-800 bg-white/90 dark:bg-[#0e2219] shadow-sm animate-pulse space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-forest-900 dark:text-forest-100">
            <span className="w-2 h-2 rounded-full bg-goa-gold-500 animate-ping" />
            <span>Voice RAG is synthesizing grounded answer…</span>
          </div>
          <div className="h-3 w-3/4 bg-forest-100 dark:bg-forest-900 rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-forest-100 dark:bg-forest-900 rounded animate-pulse" />
        </div>
      )}

      {/* 3. Assistant Card (Matches the Exact Screenshot) */}
      {res && (
        <div className="card-paper rounded-2xl p-5 sm:p-6 space-y-4 border border-forest-200/80 dark:border-forest-800/80 bg-white dark:bg-[#0e2219] shadow-sm animate-fadeIn">
          {/* Header Row: Voice RAG + Strategy + Engine on Left | Grounded + Confidence on Right */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-forest-100 dark:border-forest-800/60">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-forest-100 dark:bg-[#193a2b] text-forest-700 dark:text-emerald-200 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-forest-900 dark:text-forest-100 tracking-wide">
                Voice RAG
              </span>
              {res.strategy && (
                <span className="px-2 py-0.5 rounded-full text-[9px] uppercase font-mono font-semibold bg-forest-100/70 dark:bg-forest-900/80 text-forest-700 dark:text-forest-300 border border-forest-200/60 dark:border-forest-800/60">
                  {res.strategy}
                </span>
              )}
              {res.engine && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-forest-100/70 dark:bg-forest-900/80 text-forest-700 dark:text-forest-300 border border-forest-200/60 dark:border-forest-800/60">
                  {res.engine === "fast" ? "Fast Local" : "Sarvam Cloud"}
                </span>
              )}
              {res.languageName && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-forest-100/70 dark:bg-forest-900/80 text-forest-700 dark:text-forest-300 border border-forest-200/60 dark:border-forest-800/60">
                  {res.languageName} ({res.detectedLanguage || "en"})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isBlocked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/80">
                  <ShieldAlert className="w-3 h-3" />
                  Refused by Guardrail
                </span>
              ) : isGrounded ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-[#123624] text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 shadow-2xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Grounded in Context
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/80">
                  <AlertTriangle className="w-3 h-3" />
                  Insufficient Evidence
                </span>
              )}

              {res.confidence && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-forest-100/60 dark:bg-forest-900/60 text-forest-600 dark:text-forest-400 border border-forest-200/60 dark:border-forest-800/60 capitalize hidden sm:inline">
                  {res.confidence} Confidence
                </span>
              )}
            </div>
          </div>

          {/* Answer Text */}
          <div className="text-xs sm:text-sm text-forest-950 dark:text-forest-50 leading-relaxed font-normal">
            {res.answer}
          </div>

          {/* Citations Row */}
          {citations.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] font-semibold text-forest-500 dark:text-forest-400">
                Citations:
              </span>
              {citations.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleDrawer("sources")}
                  className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-goa-gold-100/90 dark:bg-[#2b220d] text-goa-gold-900 dark:text-goa-gold-300 border border-goa-gold-300 dark:border-goa-gold-500/40 hover:scale-105 transition-transform cursor-pointer"
                  title={`View passage [C${c}]`}
                >
                  [C{c}]
                </button>
              ))}
            </div>
          )}

          {/* Bottom Actions & Technical Triggers */}
          <div className="pt-3 border-t border-forest-100 dark:border-forest-800/60 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            {/* Left Actions: Copy, Listen */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-forest-200/70 dark:border-forest-800 bg-forest-50/60 dark:bg-[#132c20] hover:bg-forest-100 dark:hover:bg-[#1a3a2b] text-forest-700 dark:text-forest-300 text-[11px] font-medium transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                suppressHydrationWarning
                onClick={handleTTS}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-forest-200/70 dark:border-forest-800 bg-forest-50/60 dark:bg-[#132c20] hover:bg-forest-100 dark:hover:bg-[#1a3a2b] text-forest-700 dark:text-forest-300 text-[11px] font-medium transition-colors cursor-pointer"
              >
                {isSpeaking ? (
                  <>
                    <VolumeX className="w-3 h-3 text-rose-500 animate-pulse" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3 text-forest-600 dark:text-forest-400" />
                    <span>Listen</span>
                  </>
                )}
              </button>
            </div>

            {/* Right Triggers: Sources (5) > | 9.4ms > | Guardrails > */}
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-medium">
              {sources.length > 0 && (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => toggleDrawer("sources")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    activeDrawer === "sources"
                      ? "bg-forest-800 dark:bg-[#1f4a36] text-white border-forest-800"
                      : "bg-forest-50/60 dark:bg-[#132c20] border-forest-200/70 dark:border-forest-800 text-forest-700 dark:text-forest-300 hover:bg-forest-100"
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Sources ({sources.length})</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${activeDrawer === "sources" ? "rotate-90" : ""}`} />
                </button>
              )}

              {totalMs !== undefined && (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => toggleDrawer("timings")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer font-mono ${
                    activeDrawer === "timings"
                      ? "bg-forest-800 dark:bg-[#1f4a36] text-white border-forest-800"
                      : "bg-forest-50/60 dark:bg-[#132c20] border-forest-200/70 dark:border-forest-800 text-forest-700 dark:text-forest-300 hover:bg-forest-100"
                  }`}
                >
                  <Timer className="w-3 h-3" />
                  <span>{totalMs < 1 ? "<1ms" : `${totalMs.toFixed(1)}ms`}</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${activeDrawer === "timings" ? "rotate-90" : ""}`} />
                </button>
              )}

              <button
                type="button"
                suppressHydrationWarning
                onClick={() => toggleDrawer("guardrails")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                  activeDrawer === "guardrails"
                    ? "bg-forest-800 dark:bg-[#1f4a36] text-white border-forest-800"
                    : "bg-forest-50/60 dark:bg-[#132c20] border-forest-200/70 dark:border-forest-800 text-forest-700 dark:text-forest-300 hover:bg-forest-100"
                }`}
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Guardrails</span>
                <ChevronRight className={`w-3 h-3 transition-transform ${activeDrawer === "guardrails" ? "rotate-90" : ""}`} />
              </button>
            </div>
          </div>

          {/* Expandable Drawer 1: Sources */}
          {activeDrawer === "sources" && sources.length > 0 && (
            <div className="mt-3 p-3.5 rounded-xl bg-forest-50/70 dark:bg-[#0a1811] border border-forest-200/80 dark:border-forest-800/80 space-y-2 text-xs animate-fadeIn">
              <div className="font-bold text-forest-900 dark:text-forest-100">
                Grounded Knowledge Sources ({sources.length}):
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto scroll-area-custom">
                {sources.map((s, idx) => (
                  <div
                    key={s.chunk.id || idx}
                    className="p-2.5 rounded-lg bg-white dark:bg-[#11231c] border border-forest-200/70 dark:border-forest-800/70 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="chip chip-gold font-bold font-mono">[C{idx + 1}]</span>
                      <span className="font-mono text-forest-500">{s.chunk.doc_id}</span>
                      <span className="chip chip-muted tabular font-mono">score: {s.score.toFixed(3)}</span>
                    </div>
                    <p className="text-[11px] text-forest-700 dark:text-forest-200 leading-snug">
                      {s.chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expandable Drawer 2: Timings */}
          {activeDrawer === "timings" && timings && (
            <div className="mt-3 p-3.5 rounded-xl bg-forest-50/70 dark:bg-[#0a1811] border border-forest-200/80 dark:border-forest-800/80 space-y-2 text-xs animate-fadeIn">
              <div className="font-bold text-forest-900 dark:text-forest-100">
                Measured Stage Latencies:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-white dark:bg-[#11231c] border border-forest-200/60 dark:border-forest-800/60">
                  <div className="text-[9px] uppercase font-semibold text-forest-500">Retrieval</div>
                  <div className="font-mono font-bold text-forest-900 dark:text-forest-100">
                    {timings.retrievalMs?.toFixed(2) ?? "—"}ms
                  </div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-[#11231c] border border-forest-200/60 dark:border-forest-800/60">
                  <div className="text-[9px] uppercase font-semibold text-forest-500">Guardrails</div>
                  <div className="font-mono font-bold text-forest-900 dark:text-forest-100">
                    {((timings.inputGuardrailsMs ?? 0) + (timings.outputGuardrailsMs ?? 0)).toFixed(2)}ms
                  </div>
                </div>
                <div className="p-2 rounded bg-white dark:bg-[#11231c] border border-forest-200/60 dark:border-forest-800/60">
                  <div className="text-[9px] uppercase font-semibold text-forest-500">Synthesizer</div>
                  <div className="font-mono font-bold text-forest-900 dark:text-forest-100">
                    {timings.generationMs?.toFixed(2) ?? "—"}ms
                  </div>
                </div>
                <div className="p-2 rounded bg-emerald-50 dark:bg-[#123624] border border-emerald-300 dark:border-emerald-700">
                  <div className="text-[9px] uppercase font-bold text-emerald-800 dark:text-emerald-300">Total RAG</div>
                  <div className="font-mono font-bold text-emerald-950 dark:text-emerald-100">
                    {timings.totalMs?.toFixed(2) ?? "—"}ms
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expandable Drawer 3: Guardrails */}
          {activeDrawer === "guardrails" && guardrails && (
            <div className="mt-3 p-3.5 rounded-xl bg-forest-50/70 dark:bg-[#0a1811] border border-forest-200/80 dark:border-forest-800/80 space-y-1.5 text-xs animate-fadeIn">
              <div className="font-bold text-forest-900 dark:text-forest-100 mb-1">
                Guardrails Verification Log:
              </div>
              {[...guardrails.input, ...guardrails.output].map((g, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-white dark:bg-[#11231c] border border-forest-200/60 dark:border-forest-800/60 flex items-center justify-between"
                >
                  <span className="font-semibold text-forest-900 dark:text-forest-100 capitalize">{g.name}</span>
                  <span className="chip chip-emerald text-[9px] uppercase font-bold">{g.severity}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
