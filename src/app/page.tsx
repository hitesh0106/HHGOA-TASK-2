"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Mic, Loader2 } from "lucide-react";

import { Navbar } from "@/components/rag/navbar";
import { Hero } from "@/components/rag/hero";
import { VoiceRecorder } from "@/components/rag/voice-recorder";
import { TranscriptCard } from "@/components/rag/transcript-card";
import { RAGPipeline, type PipelineStageId, type PipelineStageStatus } from "@/components/rag/rag-pipeline";
import { RetrievalPanel, type RetrievedChunkData } from "@/components/rag/retrieval-panel";
import { AnswerCard, type AnswerState } from "@/components/rag/answer-card";
import { Sources } from "@/components/rag/sources";
import { LatencyMetrics } from "@/components/rag/latency-metrics";
import { RuntimeBar } from "@/components/rag/runtime-bar";
import { GuardrailStatus, type GuardrailDecision } from "@/components/rag/guardrail-status";
import { SystemStatus } from "@/components/rag/system-status";
import { EvaluationDashboard } from "@/components/rag/evaluation-dashboard";

import { CHUNKING_STRATEGIES, type ChunkingStrategy } from "@/lib/chunking";
import type { RagEngine, SttMode } from "@/components/rag/chunking-selector";

// ---------------------------------------------------------------------------
// Types (mirror backend response shapes)
// ---------------------------------------------------------------------------
interface PipelineResponse {
  query: string;
  strategy: string;
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
  contextPreview: string;
  contextTokenCount: number;
  retrievalStats: {
    strategy: string;
    chunkCount: number;
    topK: number;
    latencyMs: number;
    candidatesScanned: number;
  };
  retrievalWarnings: string[];
  guardrails: {
    input: GuardrailDecision[];
    output: GuardrailDecision[];
    combined: { block: boolean; warn: boolean; reasons: string[]; totalLatencyMs: number };
  };
  harness: { attempts: number; finishReason: string | null; warnings: string[] };
  timings: {
    inputGuardrailsMs: number;
    retrievalMs: number;
    retrievalGuardrailsMs: number;
    generationMs: number;
    outputGuardrailsMs: number;
    totalMs: number;
  };
  blocked: boolean;
  blockReasons: string[];
  ok: boolean;
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
  vectorStores: Array<{ strategy: string; chunks: number; docs: number }>;
  summary?: { doc_count?: number };
}

type Tab = "voice" | "evaluation" | "system";
type RecorderState = "idle" | "listening" | "transcribing" | "processing" | "ready";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Home() {
  const [tab, setTab] = useState<Tab>("voice");

  // System status
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loadedStrategies, setLoadedStrategies] = useState<string[]>([]);

  // Recording state
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [transcript, setTranscript] = useState("");
  const [sttLatency, setSttLatency] = useState<number | null>(null);
  const [sttLang, setSttLang] = useState<string | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Config
  const [strategy, setStrategy] = useState<ChunkingStrategy>("overlapping");
  const [topK, setTopK] = useState(5);
  const [useLlmJudge, setUseLlmJudge] = useState(false);
  const [sttMode, setSttMode] = useState<SttMode>("translate");
  const [language, setLanguage] = useState<string>("auto");
  const [engine, setEngine] = useState<RagEngine>("fast");

  // Pipeline result
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Fetch system health on mount and periodically
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

  // -------------------------------------------------------------------------
  // Recording
  // -------------------------------------------------------------------------
  const startRecording = useCallback(async () => {
    setSttError(null);
    setTranscript("");
    setSttLatency(null);
    setSttLang(null);
    setResult(null);
    setPipelineError(null);

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
        await transcribeAudio(blob);
      };

      mediaRecorderRef.current = mr;
      mr.start(250);
      setRecorderState("listening");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSttError(`Microphone access error: ${msg}`);
      setRecorderState("idle");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecorderState("transcribing");
    }
  }, []);

  // -------------------------------------------------------------------------
  // STT
  // -------------------------------------------------------------------------
  const transcribeAudio = async (blob: Blob) => {
    setRecorderState("transcribing");
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
        setSttError(data.error ?? "STT transcription failed.");
        setRecorderState("idle");
        return;
      }

      setTranscript(data.transcript);
      setSttLatency(data.sttLatencyMs);
      setSttLang(data.languageCode);

      if (data.transcript.trim()) {
        await executeRag(data.transcript.trim());
      } else {
        setSttError("No speech detected in recording. Try speaking closer to the microphone.");
        setRecorderState("idle");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSttError(`STT network error: ${msg}`);
      setRecorderState("idle");
    }
  };

  // -------------------------------------------------------------------------
  // RAG Pipeline
  // -------------------------------------------------------------------------
  const executeRag = async (queryText: string) => {
    setRecorderState("processing");
    setPipelineError(null);
    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          strategy,
          engine,
          topK,
          useLlmJudge,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.ok) {
        setPipelineError(data.error ?? "RAG pipeline failed.");
      } else {
        setResult(data);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPipelineError(`Pipeline network error: ${msg}`);
    } finally {
      setRecorderState("ready");
    }
  };

  const rerunPipeline = () => {
    if (transcript.trim()) executeRag(transcript.trim());
  };

  // -------------------------------------------------------------------------
  // Pipeline stage statuses (truthful calculation)
  // -------------------------------------------------------------------------
  const isWorking = recorderState === "transcribing" || recorderState === "processing";

  const stages: Record<PipelineStageId, PipelineStageStatus> = {
    voice: recorderState === "listening" ? "active" : recorderState !== "idle" ? "done" : "pending",
    transcript:
      recorderState === "transcribing"
        ? "active"
        : transcript
        ? "done"
        : recorderState === "listening"
        ? "pending"
        : "pending",
    retrieve:
      recorderState === "processing"
        ? "active"
        : result
        ? result.blocked && !result.sources?.length
          ? "blocked"
          : "done"
        : "pending",
    ground:
      result
        ? result.blocked
          ? "blocked"
          : "done"
        : recorderState === "processing"
        ? "active"
        : "pending",
    answer: result ? (result.blocked ? "blocked" : "done") : recorderState === "processing" ? "active" : "pending",
  };

  const stageLatencies: Partial<Record<PipelineStageId, number>> = result
    ? {
        voice: undefined,
        transcript: sttLatency ?? undefined,
        retrieve: result.timings.retrievalMs,
        ground: result.timings.inputGuardrailsMs + result.timings.retrievalGuardrailsMs + result.timings.outputGuardrailsMs,
        answer: result.timings.generationMs,
      }
    : {};

  // Answer state
  let answerState: AnswerState = "idle";
  if (result) {
    if (result.blocked) answerState = "blocked";
    else if (!result.grounded || result.confidence === "refused") answerState = "insufficient";
    else answerState = "grounded";
  }

  // Sources (from result, mapped to SourceRef shape)
  const sources = result?.citations.map((c) => {
    const src = result.sources.find((s) => s.rank === c - 1) ?? result.sources[c - 1];
    return {
      citation: c,
      docId: src?.chunk?.doc_id ?? "",
      excerpt: src?.chunk?.text ?? "",
      score: src?.score ?? 0,
      language: src?.chunk?.metadata?.doc_language as string | undefined,
    };
  }) ?? [];

  // Retrieved chunks (top-K from result)
  const retrievedChunks: RetrievedChunkData[] = result?.sources.map((s) => ({
    id: s.chunk.id,
    docId: s.chunk.doc_id,
    text: s.chunk.text,
    score: s.score,
    rank: s.rank,
    strategy: s.chunk.strategy,
    metadata: s.chunk.metadata,
  })) ?? [];

  // Retrieval guardrail decision
  const retrievalGuardrail = result?.guardrails.input.find((g) => g.name === "retrieval-sufficiency") ??
    result?.guardrails.input.find((g) => g.name.includes("retrieval")) ?? null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const systemOnline = (health?.vectorStores?.length ?? 0) > 0 && (health?.sarvamApiKeyConfigured ?? false);

  return (
    <div className="bg-goa-canvas min-h-screen flex flex-col">
      <Navbar active={tab} onNavigate={setTab} systemOnline={systemOnline} />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {tab === "voice" && (
          <VoiceRagTab
            recorderState={recorderState}
            transcript={transcript}
            sttLatency={sttLatency}
            sttLang={sttLang}
            sttError={sttError}
            pipelineError={pipelineError}
            result={result}
            isWorking={isWorking}
            strategy={strategy}
            setStrategy={setStrategy}
            topK={topK}
            setTopK={setTopK}
            useLlmJudge={useLlmJudge}
            setUseLlmJudge={setUseLlmJudge}
            loadedStrategies={loadedStrategies}
            sttMode={sttMode}
            setSttMode={setSttMode}
            language={language}
            setLanguage={setLanguage}
            engine={engine}
            setEngine={setEngine}
            stages={stages}
            stageLatencies={stageLatencies}
            answerState={answerState}
            sources={sources}
            retrievedChunks={retrievedChunks}
            retrievalGuardrail={retrievalGuardrail}
            onStart={startRecording}
            onStop={stopRecording}
            onRerun={rerunPipeline}
          />
        )}

        {tab === "evaluation" && <EvaluationDashboard />}

        {tab === "system" && <SystemStatus health={health} onRefresh={fetchHealth} />}
      </main>

      <footer className="border-t border-forest-200/60 py-4 bg-white/50 text-center text-xs text-forest-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Hacker House Goa 2026 · Task 2 Voice RAG</span>
          <span className="text-forest-400">
            MSMARCO-XI Corpus · Fast Local Synthesizer (&le;50ms SLA) · Sarvam AI
          </span>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice RAG tab (the main experience)
// ---------------------------------------------------------------------------
interface VoiceRagTabProps {
  recorderState: RecorderState;
  transcript: string;
  sttLatency: number | null;
  sttLang: string | null;
  sttError: string | null;
  pipelineError: string | null;
  result: PipelineResponse | null;
  isWorking: boolean;
  strategy: ChunkingStrategy;
  setStrategy: (s: ChunkingStrategy) => void;
  topK: number;
  setTopK: (n: number) => void;
  useLlmJudge: boolean;
  setUseLlmJudge: (b: boolean) => void;
  loadedStrategies: string[];
  sttMode: SttMode;
  setSttMode: (m: SttMode) => void;
  language: string;
  setLanguage: (lang: string) => void;
  engine: RagEngine;
  setEngine: (e: RagEngine) => void;
  stages: Record<PipelineStageId, PipelineStageStatus>;
  stageLatencies: Partial<Record<PipelineStageId, number>>;
  answerState: AnswerState;
  sources: Array<{ citation: number; docId: string; excerpt: string; score: number; language?: string }>;
  retrievedChunks: RetrievedChunkData[];
  retrievalGuardrail: GuardrailDecision | null;
  onStart: () => void;
  onStop: () => void;
  onRerun: () => void;
}

function VoiceRagTab(props: VoiceRagTabProps) {
  const {
    recorderState,
    transcript,
    sttLatency,
    sttLang,
    sttError,
    pipelineError,
    result,
    isWorking,
    strategy,
    setStrategy,
    loadedStrategies,
    sttMode,
    setSttMode,
    language,
    setLanguage,
    engine,
    setEngine,
    stages,
    stageLatencies,
    answerState,
    sources,
    retrievedChunks,
    retrievalGuardrail,
    onStart,
    onStop,
    onRerun,
  } = props;

  return (
    <div className="space-y-6">
      {/* 1. Hero */}
      <Hero hasStarted={recorderState !== "idle" || !!result} />

      {/* 2. Central Voice Recorder */}
      <div className="max-w-2xl mx-auto py-2">
        <VoiceRecorder
          state={recorderState}
          transcript={transcript}
          sttLatencyMs={sttLatency}
          error={sttError}
          onStart={onStart}
          onStop={onStop}
        />
      </div>

      {/* 3. Compact Runtime Settings Bar */}
      <RuntimeBar
        strategy={strategy}
        onStrategyChange={setStrategy}
        engine={engine}
        onEngineChange={setEngine}
        language={language}
        onLanguageChange={setLanguage}
        sttMode={sttMode}
        onSttModeChange={setSttMode}
        loadedStrategies={loadedStrategies}
      />

      {/* 4. Pipeline Execution & Output Cards */}
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Your Question (Transcript) */}
        {transcript && (
          <TranscriptCard
            transcript={transcript}
            sttLatencyMs={sttLatency}
            languageCode={sttLang}
            onRerun={onRerun}
            isProcessing={isWorking}
          />
        )}

        {/* Pipeline Error if any */}
        {pipelineError && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-700">
            <strong>Pipeline error:</strong> {pipelineError}
          </div>
        )}

        {/* End-to-End Orchestration Flow */}
        <RAGPipeline stages={stages} latencies={stageLatencies} />

        {/* Grounded Answer */}
        <AnswerCard
          answer={result?.answer ?? ""}
          state={answerState}
          confidence={result?.confidence ?? "refused"}
          citations={result?.citations ?? []}
          warnings={result?.blockReasons ?? []}
        />

        {/* Real-Time Latency Breakdown (2-Phase Architecture) */}
        <LatencyMetrics
          sttMs={sttLatency}
          retrievalMs={result?.timings.retrievalMs ?? null}
          generationMs={result?.timings.generationMs ?? null}
          totalMs={result?.timings.totalMs ?? null}
          engine={engine}
        />

        {/* Retrieved Knowledge */}
        {retrievedChunks.length > 0 && (
          <RetrievalPanel
            chunks={retrievedChunks}
            totalScanned={result?.retrievalStats.candidatesScanned}
            retrievalLatencyMs={result?.timings.retrievalMs}
          />
        )}

        {/* Cited Sources Only */}
        {sources.length > 0 && (
          <Sources
            sources={sources}
            contextPreview={result?.contextPreview}
          />
        )}

        {/* Guardrail Verification */}
        {result && (
          <GuardrailStatus
            input={result.guardrails.input}
            output={result.guardrails.output}
            retrieval={retrievalGuardrail}
            combined={result.guardrails.combined}
          />
        )}
      </div>
    </div>
  );
}
