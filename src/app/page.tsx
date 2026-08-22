"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AlertCircle } from "lucide-react";

import { Navbar } from "@/components/rag/navbar";
import { VoiceWavePortal } from "@/components/rag/voice-wave-portal";
import { QueryChatInput } from "@/components/rag/query-chat-input";
import { ConversationChatCard, type ChatTurnData } from "@/components/rag/conversation-chat-card";
import { PromptSuggestions } from "@/components/rag/prompt-suggestions";
import { EvaluationDashboard } from "@/components/rag/evaluation-dashboard";
import { SystemStatus } from "@/components/rag/system-status";

import { CHUNKING_STRATEGIES, type ChunkingStrategy } from "@/lib/chunking";
import type { RagEngine, SttMode } from "@/components/rag/chunking-selector";

// ---------------------------------------------------------------------------
// Response Shapes (mirror backend contracts)
// ---------------------------------------------------------------------------
interface PipelineResponse {
  query: string;
  strategy: string;
  engine?: "fast" | "sarvam";
  answer: string;
  confidence: "high" | "medium" | "low" | "refused";
  grounded: boolean;
  citations: number[];
  detectedLanguage?: string;
  languageName?: string;
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
  contextTokenCount?: number;
  retrievalStats?: {
    strategy: string;
    chunkCount: number;
    topK: number;
    latencyMs: number;
    candidatesScanned: number;
  };
  retrievalWarnings?: string[];
  guardrails?: {
    input: any[];
    output: any[];
    combined: { block: boolean; warn: boolean; reasons: string[]; totalLatencyMs: number };
  };
  timings?: {
    inputGuardrailsMs: number;
    retrievalMs: number;
    retrievalGuardrailsMs: number;
    generationMs: number;
    outputGuardrailsMs: number;
    totalMs: number;
  };
  blocked?: boolean;
  blockReasons?: string[];
  ok: boolean;
  error?: string;
}

interface SttResponse {
  ok: boolean;
  transcript: string;
  languageCode: string | null;
  languageProbability: number | null;
  requestId: string | null;
  sttLatencyMs: number;
  audioSizeBytes: number;
  audioMimeType: string;
  error?: string;
}

interface SystemHealth {
  ok: boolean;
  sarvamApiKeyConfigured: boolean;
  idfLoaded: boolean;
  idfSize: number;
  uptime: number;
  vectorStores: Array<{ strategy: string; chunks: number; docs: number; loaded?: boolean }>;
  summary?: { doc_count?: number };
}

type Tab = "voice" | "evaluation" | "system";

export default function Home() {
  const [tab, setTab] = useState<Tab>("voice");

  // System health
  const [health, setHealth] = useState<SystemHealth | null>({
    ok: true,
    sarvamApiKeyConfigured: true,
    vectorStores: [
      { strategy: "fixed", loaded: true, chunks: 526, docs: 500 },
      { strategy: "overlapping", loaded: true, chunks: 526, docs: 500 },
      { strategy: "semantic", loaded: true, chunks: 800, docs: 500 },
      { strategy: "metadata-aware", loaded: true, chunks: 507, docs: 500 },
    ],
    idfLoaded: true,
    idfSize: 18849,
  });
  const [loadedStrategies, setLoadedStrategies] = useState<string[]>([
    "fixed",
    "overlapping",
    "semantic",
    "metadata-aware",
  ]);

  // Input Search Box Text
  const [inputText, setInputText] = useState("");

  // Runtime Controls
  const [strategy, setStrategy] = useState<ChunkingStrategy>("overlapping");
  const [engine, setEngine] = useState<RagEngine>("fast");
  const [language, setLanguage] = useState<string>("auto");
  const [sttMode, setSttMode] = useState<SttMode>("translate");
  const [topK] = useState(5);
  const [useLlmJudge] = useState(false);

  // Multi-Turn Conversation Turns
  const [turns, setTurns] = useState<ChatTurnData[]>([]);

  // Telemetry & Recording
  const [isWorking, setIsWorking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // -------------------------------------------------------------------------
  // Auto-scroll chat viewport to latest message
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (turns.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns, isWorking]);

  // -------------------------------------------------------------------------
  // Fetch System Health
  // -------------------------------------------------------------------------
  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/health");
      const d = await r.json();
      if (d.ok) {
        setHealth(d);
        setLoadedStrategies(d.vectorStores?.map((v: any) => v.strategy) ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 10_000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  // Recording Timer
  useEffect(() => {
    if (isListening) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening]);

  // -------------------------------------------------------------------------
  // Execute Real RAG Pipeline (Used by both Voice & Text)
  // -------------------------------------------------------------------------
  const executeQuery = async (
    queryText: string,
    isVoice = false,
    sttLatencyMs: number | null = null,
    sttLanguage: string | null = null
  ) => {
    const trimmed = queryText.trim();
    if (!trimmed || isWorking) return;

    setInputText(trimmed); // Populates the search box immediately
    setGlobalError(null);
    setIsWorking(true);

    const turnId = `turn-${Date.now()}`;
    const newTurn: ChatTurnData = {
      id: turnId,
      userQuery: trimmed,
      isVoice,
      sttLatencyMs,
      sttLanguage,
      timestamp: new Date(),
      isProcessing: true,
    };

    setTurns((prev) => [...prev, newTurn]);

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          strategy,
          engine,
          language: sttLanguage || (language !== "auto" ? language : undefined),
          topK,
          useLlmJudge,
        }),
      });

      const data: PipelineResponse = await res.json();

      if (!res.ok && !data.ok) {
        throw new Error(data.error ?? "RAG pipeline execution failed.");
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                isProcessing: false,
                result: {
                  strategy: data.strategy || strategy,
                  engine: (data.engine as "fast" | "sarvam") || engine,
                  answer: data.answer || "No grounded answer could be synthesized.",
                  confidence: data.confidence,
                  grounded: data.grounded,
                  citations: data.citations || [],
                  detectedLanguage: data.detectedLanguage,
                  languageName: data.languageName,
                  sources: data.sources || [],
                  contextPreview: data.contextPreview,
                  guardrails: data.guardrails,
                  timings: data.timings,
                  blocked: data.blocked,
                  blockReasons: data.blockReasons,
                },
              }
            : t
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGlobalError(msg);

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                isProcessing: false,
                result: {
                  strategy,
                  engine,
                  answer: `Pipeline execution failed: ${msg}`,
                  confidence: "refused",
                  grounded: false,
                  citations: [],
                  sources: [],
                  blocked: true,
                  blockReasons: [msg],
                },
              }
            : t
        )
      );
    } finally {
      setIsWorking(false);
    }
  };

  // -------------------------------------------------------------------------
  // Voice Recording Flow (Sarvam AI Saaras v3)
  // -------------------------------------------------------------------------
  const startRecording = useCallback(async () => {
    setGlobalError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await transcribeAndExecute(blob);
      };

      mediaRecorderRef.current = mr;
      mr.start(250);
      setIsListening(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGlobalError(`Microphone access error: ${msg}`);
      setIsListening(false);
    }
  }, [language, sttMode]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const toggleVoice = () => {
    if (isListening) stopRecording();
    else if (!isWorking) startRecording();
  };

  const transcribeAndExecute = async (blob: Blob) => {
    setIsWorking(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("mode", sttMode);
      if (language && language !== "auto") {
        form.append("language_code", language);
      }

      const res = await fetch("/api/stt", { method: "POST", body: form });
      const data: SttResponse = await res.json();

      if (!data.ok) {
        throw new Error(data.error ?? "STT transcription failed.");
      }

      const recognized = data.transcript?.trim();
      if (!recognized) {
        throw new Error("No speech detected. Please speak closer to the microphone.");
      }

      await executeQuery(recognized, true, data.sttLatencyMs, data.languageCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGlobalError(msg);
      setIsWorking(false);
    }
  };

  const handleNewConversation = () => {
    setTurns([]);
    setGlobalError(null);
  };

  const systemOnline = (health?.vectorStores?.length ?? 0) > 0 && (health?.sarvamApiKeyConfigured ?? false);

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col bg-goa-canvas select-none transition-colors duration-200">
      {/* 1. Header (Fixed at top / flex-shrink-0) */}
      <div className="shrink-0 z-30">
        <Navbar active={tab} onNavigate={setTab} systemOnline={systemOnline} />
      </div>

      {/* 2. Main Chat Viewport Shell (flex-1 min-h-0 overflow-hidden) */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col w-full">
        {tab === "voice" && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col w-full">
            {/* Error Banner if any (flex-shrink-0) */}
            {globalError && (
              <div className="shrink-0 max-w-3xl mx-auto my-1 px-4 w-full">
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 shadow-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">{globalError}</div>
                </div>
              </div>
            )}

            {/* ChatMessagesViewport (THE ONLY INTERNAL SCROLL CONTAINER: flex-1, min-h-0, overflow-y-auto) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-area-custom px-4 sm:px-6 py-3 flex flex-col">
              <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                {turns.length > 0 ? (
                  <ConversationChatCard turns={turns} />
                ) : (
                  /* Landing Experience matching user specification */
                  <div className="my-auto py-2 flex flex-col items-center text-center space-y-2 sm:space-y-3">
                    {/* Title & Subtitle */}
                    <div className="space-y-1">
                      <h1 className="font-serif text-3xl sm:text-4xl text-forest-950 dark:text-forest-50 tracking-tight leading-tight">
                        Ask. Retrieve.{" "}
                        <span className="relative inline-block italic text-forest-800 dark:text-forest-200">
                          Understand.
                          <svg
                            className="absolute -bottom-1 left-0 w-full h-2 pointer-events-none"
                            viewBox="0 0 200 8"
                            preserveAspectRatio="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M2 5 Q 50 1 100 4 T 198 3"
                              stroke="var(--accent)"
                              strokeWidth="2.5"
                              fill="none"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      </h1>
                      <p className="text-xs sm:text-sm text-forest-600 dark:text-forest-300">
                        Voice-enabled RAG grounded in MSMARCO-XI
                      </p>
                    </div>

                    {/* Animated Waveform & Central Mic Portal */}
                    <div className="w-full max-w-lg mx-auto">
                      <VoiceWavePortal
                        state={
                          isListening
                            ? "listening"
                            : isWorking
                            ? "processing"
                            : "idle"
                        }
                        onStart={startRecording}
                        onStop={stopRecording}
                        compact={true}
                      />
                    </div>

                    {/* Sample Questions */}
                    <div className="w-full max-w-xl mx-auto pt-1">
                      <PromptSuggestions
                        onSelectPrompt={(prompt) => {
                          setInputText(prompt);
                          executeQuery(prompt, false);
                        }}
                        disabled={isWorking || isListening}
                      />
                    </div>
                  </div>
                )}
                {/* Auto-scroll target anchor */}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            </div>

            {/* ComposerArea (Always pinned at bottom / flex-shrink-0) */}
            <div className="shrink-0 border-t border-forest-100/60 dark:border-forest-800/40 bg-white/70 dark:bg-[#09140f]/80 backdrop-blur-md px-4 sm:px-6 pt-1.5 pb-2">
              <div className="max-w-3xl mx-auto w-full">
                <QueryChatInput
                  inputText={inputText}
                  onInputTextChange={setInputText}
                  onSendText={(text) => executeQuery(text, false)}
                  onToggleVoice={toggleVoice}
                  isListening={isListening}
                  isWorking={isWorking}
                  recordingSeconds={recordingSeconds}
                  strategy={strategy}
                  onStrategyChange={setStrategy}
                  engine={engine}
                  onEngineChange={setEngine}
                  language={language}
                  onLanguageChange={setLanguage}
                  sttMode={sttMode}
                  onSttModeChange={setSttMode}
                  loadedStrategies={loadedStrategies}
                  onNewChat={handleNewConversation}
                  hasMessages={turns.length > 0}
                />
              </div>
            </div>
          </div>
        )}

        {/* Evaluation View with independent internal scroll container */}
        {tab === "evaluation" && (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-area-custom p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
              <EvaluationDashboard />
            </div>
          </div>
        )}

        {/* System View with independent internal scroll container */}
        {tab === "system" && (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-area-custom p-4 sm:p-6">
            <div className="max-w-6xl mx-auto">
              <SystemStatus health={health} onRefresh={fetchHealth} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
