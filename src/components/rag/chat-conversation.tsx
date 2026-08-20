"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  Mic,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Timer,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
} from "lucide-react";
import { PipelineTimingCard, type StageTimings } from "./pipeline-timing-card";
import { speakAnswer } from "@/lib/tts";

export interface ConversationTurn {
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
    contextPreview?: string;
    timings?: StageTimings;
    blocked?: boolean;
    blockReasons?: string[];
  };
}

interface ChatConversationProps {
  turns: ConversationTurn[];
  onNewConversation?: () => void;
  onSelectSource?: (docId: string) => void;
}

export function ChatConversation({
  turns,
  onNewConversation,
  onSelectSource,
}: ChatConversationProps) {
  if (turns.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 my-6">
      {/* Session header */}
      <div className="flex items-center justify-between text-xs text-forest-600 dark:text-forest-400 pb-2 border-b border-forest-100 dark:border-forest-800/60">
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          Session Dialogue ({turns.length} {turns.length === 1 ? "query" : "queries"})
        </span>
        {onNewConversation && (
          <button
            type="button"
            suppressHydrationWarning
            onClick={onNewConversation}
            className="flex items-center gap-1 text-[11px] font-medium text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-100 px-2.5 py-1 rounded-full hover:bg-forest-100 dark:hover:bg-forest-900 transition-colors cursor-pointer"
            title="Start fresh conversation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>New Chat</span>
          </button>
        )}
      </div>

      {turns.map((turn) => (
        <TurnView key={turn.id} turn={turn} onSelectSource={onSelectSource} />
      ))}
    </div>
  );
}

function TurnView({
  turn,
  onSelectSource,
}: {
  turn: ConversationTurn;
  onSelectSource?: (docId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const res = turn.result;
  const isBlocked = res?.blocked;
  const isGrounded = res?.grounded;
  const citations = res?.citations || [];
  const sources = res?.sources || [];
  const totalMs = res?.timings?.totalMs;

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

  return (
    <div className="space-y-4">
      {/* 1. USER MESSAGE (Aligned Right) */}
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs px-4 py-3 bg-forest-800 dark:bg-forest-700 text-white shadow-xs space-y-1">
          <div className="text-xs sm:text-sm font-normal leading-relaxed whitespace-pre-wrap">
            {turn.userQuery}
          </div>
          {turn.isVoice && (
            <div className="flex items-center gap-1.5 text-[10px] text-forest-200/90 pt-0.5">
              <Mic className="w-3 h-3 text-goa-gold-400" />
              <span>Voice Query</span>
              {turn.sttLatencyMs && (
                <span className="tabular font-mono">({turn.sttLatencyMs.toFixed(0)}ms)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. REAL PIPELINE TIMING SUMMARY (Rendered BEFORE the assistant answer!) */}
      <div className="max-w-2xl ml-auto mr-auto sm:ml-0 sm:mr-auto w-full">
        <PipelineTimingCard
          isProcessing={turn.isProcessing || false}
          timings={
            res?.timings
              ? {
                  ...res.timings,
                  sttMs: turn.sttLatencyMs,
                }
              : null
          }
          engine={res?.engine}
          isVoice={turn.isVoice}
        />
      </div>

      {/* 3. FINAL GROUNDED ANSWER CARD (Rendered ONLY AFTER pipeline timing!) */}
      {res && (
        <div className="card-paper rounded-2xl p-5 sm:p-6 space-y-4 border border-forest-200/80 dark:border-forest-800 shadow-sm animate-fadeIn">
          {/* Header Status Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-forest-100 dark:border-forest-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-forest-900 dark:text-forest-100 tracking-wider">
                Voice RAG
              </span>
              {res.strategy && (
                <span className="chip chip-muted text-[9px] uppercase font-mono">
                  {res.strategy}
                </span>
              )}
            </div>

            <div>
              {isBlocked ? (
                <span className="chip chip-rose text-[10px] font-semibold">
                  <ShieldAlert className="w-3 h-3" />
                  Refused by Guardrail
                </span>
              ) : isGrounded ? (
                <span className="chip chip-emerald text-[10px] font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  Grounded ✓
                </span>
              ) : (
                <span className="chip chip-gold text-[10px] font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  Insufficient Evidence
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
              <span className="text-[11px] font-semibold text-forest-600 dark:text-forest-400">
                Sources:
              </span>
              {citations.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setShowSources(!showSources)}
                  className="chip chip-gold text-[10px] font-bold font-mono hover:scale-105 transition-transform cursor-pointer"
                  title={`Passage [C${c}]`}
                >
                  [C{c}]
                </button>
              ))}
            </div>
          )}

          {/* Action Toolbar: Listen | Copy | Sources */}
          <div className="pt-3 border-t border-forest-100 dark:border-forest-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                suppressHydrationWarning
                onClick={handleTTS}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-forest-200/70 dark:border-forest-800 bg-forest-50/60 dark:bg-forest-950/40 hover:bg-forest-100 dark:hover:bg-forest-900 text-forest-700 dark:text-forest-300 text-[11px] font-medium transition-colors cursor-pointer"
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

              <button
                type="button"
                suppressHydrationWarning
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-forest-200/70 dark:border-forest-800 bg-forest-50/60 dark:bg-forest-950/40 hover:bg-forest-100 dark:hover:bg-forest-900 text-forest-700 dark:text-forest-300 text-[11px] font-medium transition-colors cursor-pointer"
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

              {sources.length > 0 && (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-forest-200/70 dark:border-forest-800 bg-forest-50/60 dark:bg-forest-950/40 hover:bg-forest-100 dark:hover:bg-forest-900 text-forest-700 dark:text-forest-300 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Sources ({sources.length})</span>
                  {showSources ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Quick Timing & Guardrail status badge */}
            <div className="flex items-center gap-2 text-[11px] font-medium text-forest-600 dark:text-forest-400">
              {totalMs !== undefined && (
                <span className="font-mono tabular">
                  {totalMs < 1 ? "<1ms" : `${totalMs.toFixed(1)}ms`}
                </span>
              )}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Guardrails ✓
              </span>
            </div>
          </div>

          {/* Expandable Sources Drawer */}
          {showSources && sources.length > 0 && (
            <div className="mt-3 p-3.5 rounded-xl bg-forest-50/50 dark:bg-forest-950/50 border border-forest-200/80 dark:border-forest-800/80 space-y-2 text-xs">
              <div className="font-bold text-forest-900 dark:text-forest-100">
                Grounded Sources ({sources.length}):
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto scroll-area-custom">
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
        </div>
      )}
    </div>
  );
}
