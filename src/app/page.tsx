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
import { ChunkingSelector } from "@/components/rag/chunking-selector";
import { GuardrailStatus, type GuardrailDecision } from "@/components/rag/guardrail-status";
import { SystemStatus } from "@/components/rag/system-status";
import { EvaluationDashboard } from "@/components/rag/evaluation-dashboard";

import { CHUNKING_STRATEGIES, type ChunkingStrategy } from "@/lib/chunking";

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
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        await transcribeAudio(audioBlob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecorderState("listening");
    } catch (e) {
      setSttError(
        e instanceof Error
          ? `Microphone access failed: ${e.message}`
          : "Microphone access failed. Check browser permissions."
      );
    }
  }, [strategy, topK, useLlmJudge]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recorderState === "listening") {
      mediaRecorderRef.current.stop();
      setRecorderState("transcribing");
    }
  }, [recorderState]);

  const transcribeAudio = useCallback(
    async (audioBlob: Blob) => {
      setRecorderState("transcribing");
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("mode", "transcribe");
        const res = await fetch("/api/stt", { method: "POST", body: formData });
        const data: SttResponse = await res.json();
        if (!data.ok) {
          setSttError(data.error ?? "STT failed");
          setRecorderState("idle");
        } else {
          setTranscript(data.transcript);
          setSttLatency(data.sttLatencyMs);
          setSttLang(data.languageCode);
          if (data.transcript.trim().split(/\s+/).length >= 2) {
            await runPipeline(data.transcript);
          } else {
            setRecorderState("ready");
          }
        }
      } catch (e) {
        setSttError(e instanceof Error ? e.message : "Network error during STT");
        setRecorderState("idle");
      }
    },
    [strategy, topK, useLlmJudge]
  );

  // -------------------------------------------------------------------------
  // Pipeline
  // -------------------------------------------------------------------------
  const runPipeline = useCallback(
    async (query: string) => {
      setRecorderState("processing");
      setPipelineError(null);
      setResult(null);
      try {
        const res = await fetch("/api/rag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            strategy,
            topK,
            useLlmJudge,
            minScore: 0.05,
            maxContextTokens: 2048,
          }),
        });
        const data: PipelineResponse & { error?: string } = await res.json();
        if (!data.ok) {
          setPipelineError(data.error ?? "Pipeline failed");
        } else {
          setResult(data);
        }
      } catch (e) {
        setPipelineError(e instanceof Error ? e.message : "Network error during RAG");
      } finally {
        setRecorderState("ready");
      }
    },
    [strategy, topK, useLlmJudge]
  );

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  const isWorking = recorderState === "transcribing" || recorderState === "processing";

  // Pipeline stage statuses (derived from recorder state + result)
  const stages: Record<PipelineStageId, PipelineStageStatus> = {
    voice: recorderState === "idle" && !result ? "pending" : "done",
    transcript:
      recorderState === "transcribing"
        ? "active"
        : transcript
        ? "done"
        : "pending",
    retrieve:
      recorderState === "processing"
        ? "active"
        : result
        ? "done"
        : "pending",
    ground:
      result && !result.blocked && result.grounded
        ? "done"
        : result && (result.blocked || !result.grounded)
        ? "blocked"
        : recorderState === "processing"
        ? "active"
        : "pending",
    answer: result ? "done" : recorderState === "processing" ? "active" : "pending",
  };

  const stageLatencies: Partial<Record<PipelineStageId, number>> = result
    ? {
        voice: sttLatency ?? undefined,
        transcript: undefined,
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16">
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
            stages={stages}
            stageLatencies={stageLatencies}
            answerState={answerState}
            sources={sources}
            retrievedChunks={retrievedChunks}
            retrievalGuardrail={retrievalGuardrail}
            onStart={startRecording}
            onStop={stopRecording}
            onRerun={() => transcript && runPipeline(transcript)}
          />
        )}

        {tab === "evaluation" && (
          <div className="pt-8">
            <EvaluationDashboard />
          </div>
        )}

        {tab === "system" && (
          <div className="pt-8 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-goa-gold-300/60 bg-goa-gold-50/80">
                <span className="w-1 h-1 rounded-full bg-goa-gold-500" />
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-goa-gold-800">
                  System
                </span>
              </div>
              <h1 className="mt-4 font-serif text-3xl text-forest-900">System Status</h1>
              <p className="mt-2 text-sm text-forest-600 max-w-md mx-auto">
                Real-time health of the Voice RAG pipeline components.
              </p>
            </div>
            {health && (
              <SystemStatus
                sarvamConfigured={health.sarvamApiKeyConfigured}
                vectorStoresLoaded={health.vectorStores?.length ?? 0}
                totalVectorStores={4}
                idfSize={health.idfSize}
                docCount={health.summary?.doc_count ?? 0}
                uptime={health.uptime}
              />
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-forest-200/60 bg-white/60 backdrop-blur-sm py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-[10px] text-forest-500">
          <div>
            HH Goa 2026 · Voice RAG · AI Lab
          </div>
          <div className="tabular">
            Sarvam Saaras v3 · GLM-4.5 · MSMARCO-XI
          </div>
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
    topK,
    setTopK,
    useLlmJudge,
    setUseLlmJudge,
    loadedStrategies,
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
    <>
      <Hero hasStarted={recorderState !== "idle" || !!result} />

      {/* Voice recorder — centered */}
      <div className="max-w-2xl mx-auto py-6">
        <VoiceRecorder
          state={recorderState}
          transcript={transcript}
          sttLatencyMs={sttLatency}
          error={sttError}
          onStart={onStart}
          onStop={onStop}
        />
      </div>

      {/* Two-column layout below */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-6">
        {/* Left column: config + transcript */}
        <div className="lg:col-span-4 space-y-5">
          <ChunkingSelector
            strategy={strategy}
            onChange={setStrategy}
            topK={topK}
            onTopKChange={setTopK}
            useLlmJudge={useLlmJudge}
            onUseLlmJudgeChange={setUseLlmJudge}
            loadedStrategies={loadedStrategies}
          />

          {transcript && (
            <TranscriptCard
              transcript={transcript}
              sttLatencyMs={sttLatency}
              languageCode={sttLang}
              onRerun={onRerun}
              isProcessing={isWorking}
            />
          )}
        </div>

        {/* Right column: pipeline + answer + sources */}
        <div className="lg:col-span-8 space-y-5">
          <RAGPipeline stages={stages} latencies={stageLatencies} />

          {pipelineError && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-xs text-rose-700">
              <strong>Pipeline error:</strong> {pipelineError}
            </div>
          )}

          <AnswerCard
            answer={result?.answer ?? ""}
            state={answerState}
            confidence={result?.confidence ?? "refused"}
            citations={result?.citations ?? []}
            warnings={result?.blockReasons ?? []}
          />

          <LatencyMetrics
            sttMs={sttLatency}
            retrievalMs={result?.timings.retrievalMs ?? null}
            generationMs={result?.timings.generationMs ?? null}
            totalMs={result?.timings.totalMs ?? null}
          />

          {retrievedChunks.length > 0 && (
            <RetrievalPanel
              chunks={retrievedChunks}
              totalScanned={result?.retrievalStats.candidatesScanned}
              retrievalLatencyMs={result?.timings.retrievalMs}
            />
          )}

          {sources.length > 0 && (
            <Sources
              sources={sources}
              contextPreview={result?.contextPreview}
            />
          )}

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
    </>
  );
}
