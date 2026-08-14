"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Square,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Database,
  Cpu,
  Zap,
  ChevronDown,
  ChevronRight,
  Gauge,
  Layers,
  Sparkles,
  Play,
  Terminal,
  FileText,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CHUNKING_STRATEGIES, CHUNKING_DESCRIPTIONS, type ChunkingStrategy } from "@/lib/chunking";
import { BenchmarkPanel } from "@/components/rag/benchmark-panel";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror backend response shapes)
// ---------------------------------------------------------------------------
interface GuardrailDecision {
  name: string;
  pass: boolean;
  severity: "ok" | "warn" | "block";
  reason: string;
  details?: unknown;
  latencyMs: number;
}

interface ScoredChunk {
  chunk: {
    id: string;
    doc_id: string;
    text: string;
    strategy: string;
    metadata: Record<string, unknown>;
  };
  score: number;
  rank: number;
}

interface RetrievalStats {
  strategy: string;
  chunkCount: number;
  topK: number;
  latencyMs: number;
  candidatesScanned: number;
}

interface PipelineTimings {
  inputGuardrailsMs: number;
  retrievalMs: number;
  retrievalGuardrailsMs: number;
  generationMs: number;
  outputGuardrailsMs: number;
  totalMs: number;
}

interface PipelineResponse {
  query: string;
  strategy: string;
  answer: string;
  confidence: "high" | "medium" | "low" | "refused";
  grounded: boolean;
  citations: number[];
  sources: ScoredChunk[];
  contextPreview: string;
  contextTokenCount: number;
  retrievalStats: RetrievalStats;
  retrievalWarnings: string[];
  guardrails: {
    input: GuardrailDecision[];
    output: GuardrailDecision[];
    combined: { block: boolean; warn: boolean; reasons: string[]; totalLatencyMs: number };
  };
  harness: { attempts: number; finishReason: string | null; warnings: string[] };
  timings: PipelineTimings;
  blocked: boolean;
  blockReasons: string[];
  ok: boolean;
  apiLatencyMs?: number;
}

interface SttResponse {
  ok: boolean;
  transcript: string;
  languageCode: string | null;
  languageProbability: number | null;
  requestId: string | null;
  sttLatencyMs: number;
  attempts: number;
  audioSizeBytes: number;
  audioMimeType: string;
  totalLatencyMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Home() {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sttLatency, setSttLatency] = useState<number | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Pipeline state
  const [strategy, setStrategy] = useState<ChunkingStrategy>("overlapping");
  const [topK, setTopK] = useState(5);
  const [useLlmJudge, setUseLlmJudge] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<PipelineResponse | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // System status
  const [loadedStrategies, setLoadedStrategies] = useState<string[]>([]);
  const [systemStatus, setSystemStatus] = useState<{
    sarvamApiKeyConfigured: boolean;
    idfLoaded: boolean;
    idfSize: number;
    vectorStores: Array<{ strategy: string; chunks: number; docs: number }>;
  } | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState("answer");

  // Fetch system status on mount
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSystemStatus(d);
          setLoadedStrategies(d.vectorStores?.map((v: any) => v.strategy) ?? []);
        }
      })
      .catch(() => {});
  }, []);

  // -------------------------------------------------------------------------
  // Recording handlers
  // -------------------------------------------------------------------------
  const startRecording = useCallback(async () => {
    setSttError(null);
    setTranscript("");
    setSttLatency(null);
    setPipelineResult(null);
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
      setIsRecording(true);
    } catch (e) {
      setSttError(
        e instanceof Error
          ? `Microphone access failed: ${e.message}`
          : "Microphone access failed. Check browser permissions."
      );
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("mode", "transcribe");
      const res = await fetch("/api/stt", { method: "POST", body: formData });
      const data: SttResponse = await res.json();
      if (!data.ok) {
        setSttError(data.error ?? "STT failed");
      } else {
        setTranscript(data.transcript);
        setSttLatency(data.sttLatencyMs);
        // Auto-run pipeline if transcript is non-trivial
        if (data.transcript.trim().split(/\s+/).length >= 2) {
          await runPipeline(data.transcript);
        }
      }
    } catch (e) {
      setSttError(e instanceof Error ? e.message : "Network error during STT");
    } finally {
      setIsTranscribing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Pipeline runner
  // -------------------------------------------------------------------------
  const runPipeline = async (query: string) => {
    setIsProcessing(true);
    setPipelineError(null);
    setPipelineResult(null);
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
        setPipelineResult(data);
      }
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : "Network error during RAG");
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <Header systemStatus={systemStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: voice input + transcript */}
          <div className="lg:col-span-1 space-y-6">
            <VoiceRecorderCard
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              isProcessing={isProcessing}
              transcript={transcript}
              sttLatency={sttLatency}
              sttError={sttError}
              onStart={startRecording}
              onStop={stopRecording}
              onRetry={() => transcript && runPipeline(transcript)}
            />
            <ConfigCard
              strategy={strategy}
              setStrategy={setStrategy}
              topK={topK}
              setTopK={setTopK}
              useLlmJudge={useLlmJudge}
              setUseLlmJudge={setUseLlmJudge}
              loadedStrategies={loadedStrategies}
            />
          </div>

          {/* Middle + right column: results */}
          <div className="lg:col-span-2 space-y-6">
            <ResultTabs
              result={pipelineResult}
              isProcessing={isProcessing}
              error={pipelineError}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
            <SystemStatusCard systemStatus={systemStatus} />
          </div>
        </div>

        {/* Full-width benchmark & evaluation panel */}
        <div className="mt-6">
          <BenchmarkPanel />
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({ systemStatus }: { systemStatus: any }) {
  return (
    <header className="border-b border-slate-800/80 backdrop-blur-sm sticky top-0 z-30 bg-slate-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Mic className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Voice RAG · MSMARCO-XI</div>
            <div className="text-[10px] text-slate-400 -mt-0.5">Hacker House Goa 2026 · Task 2</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill
            ok={systemStatus?.sarvamApiKeyConfigured}
            label="Sarvam STT"
            icon={<Mic className="w-3 h-3" />}
          />
          <StatusPill
            ok={(systemStatus?.vectorStores?.length ?? 0) > 0}
            label={`${systemStatus?.vectorStores?.length ?? 0} stores loaded`}
            icon={<Database className="w-3 h-3" />}
          />
        </div>
      </div>
    </header>
  );
}

function StatusPill({ ok, label, icon }: { ok?: boolean; label: string; icon: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border",
        ok
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-amber-500/10 border-amber-500/30 text-amber-300"
      )}
    >
      {icon}
      {label}
      <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-amber-400")} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice recorder card
// ---------------------------------------------------------------------------
function VoiceRecorderCard({
  isRecording,
  isTranscribing,
  isProcessing,
  transcript,
  sttLatency,
  sttError,
  onStart,
  onStop,
  onRetry,
}: {
  isRecording: boolean;
  isTranscribing: boolean;
  isProcessing: boolean;
  transcript: string;
  sttLatency: number | null;
  sttError: string | null;
  onStart: () => void;
  onStop: () => void;
  onRetry: () => void;
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Mic className="w-4 h-4 text-emerald-400" />
          Voice Input
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Tap the mic and ask a question. Audio is streamed to Sarvam Saaras v3 for transcription.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <motion.button
          onClick={isRecording ? onStop : onStart}
          disabled={isTranscribing || isProcessing}
          whileTap={{ scale: 0.96 }}
          className={cn(
            "relative w-24 h-24 rounded-full flex items-center justify-center transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            isRecording
              ? "bg-rose-500/20 border-2 border-rose-500"
              : "bg-emerald-500/20 border-2 border-emerald-500 hover:bg-emerald-500/30"
          )}
        >
          {isRecording && (
            <>
              <motion.span
                className="absolute inset-0 rounded-full bg-rose-500/30"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.span
                className="absolute inset-0 rounded-full bg-rose-500/20"
                animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
              />
            </>
          )}
          {isTranscribing ? (
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          ) : isRecording ? (
            <Square className="w-8 h-8 text-rose-300 fill-rose-400" />
          ) : (
            <Mic className="w-8 h-8 text-emerald-300" />
          )}
        </motion.button>
        <div className="text-center text-xs">
          {isRecording ? (
            <span className="text-rose-300 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Recording… tap to stop
            </span>
          ) : isTranscribing ? (
            <span className="text-emerald-300">Transcribing via Sarvam…</span>
          ) : isProcessing ? (
            <span className="text-cyan-300">Running RAG pipeline…</span>
          ) : (
            <span className="text-slate-400">Tap mic to start</span>
          )}
        </div>
      </CardContent>

      {sttError && (
        <CardContent className="pt-0">
          <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/30 text-rose-200">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle className="text-xs">STT error</AlertTitle>
            <AlertDescription className="text-xs">{sttError}</AlertDescription>
          </Alert>
        </CardContent>
      )}

      {transcript && (
        <CardContent className="pt-0 space-y-3">
          <Separator className="bg-slate-800" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                Transcribed question
              </div>
              {sttLatency !== null && (
                <Badge variant="outline" className="text-[10px] bg-slate-800/50 border-slate-700 text-slate-300">
                  <Zap className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                  {sttLatency.toFixed(0)} ms
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-100 leading-relaxed bg-slate-950/60 rounded-md p-3 border border-slate-800">
              {transcript}
            </p>
            <Button
              onClick={onRetry}
              disabled={isProcessing}
              size="sm"
              variant="outline"
              className="w-full bg-slate-800/50 border-slate-700 hover:bg-slate-800 text-slate-200"
            >
              {isProcessing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              Re-run pipeline
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Config card
// ---------------------------------------------------------------------------
function ConfigCard({
  strategy,
  setStrategy,
  topK,
  setTopK,
  useLlmJudge,
  setUseLlmJudge,
  loadedStrategies,
}: {
  strategy: ChunkingStrategy;
  setStrategy: (s: ChunkingStrategy) => void;
  topK: number;
  setTopK: (n: number) => void;
  useLlmJudge: boolean;
  setUseLlmJudge: (b: boolean) => void;
  loadedStrategies: string[];
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Retrieval configuration
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Compare chunking strategies live. Settings apply to the next pipeline run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
            Chunking strategy
          </label>
          <Select value={strategy} onValueChange={(v) => setStrategy(v as ChunkingStrategy)}>
            <SelectTrigger className="bg-slate-950/60 border-slate-800 text-slate-200 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800">
              {CHUNKING_STRATEGIES.map((s) => (
                <SelectItem key={s} value={s} disabled={!loadedStrategies.includes(s)}>
                  <span className="text-xs">{CHUNKING_DESCRIPTIONS[s].name}</span>
                  {!loadedStrategies.includes(s) && (
                    <span className="text-[10px] text-amber-400 ml-2">(not loaded)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-slate-500 leading-snug pt-1">
            {CHUNKING_DESCRIPTIONS[strategy].description}
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              Top-K chunks
            </label>
            <Badge variant="outline" className="text-[10px] bg-slate-800/50 border-slate-700">
              {topK}
            </Badge>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="text-xs text-slate-200 font-medium">LLM hallucination judge</div>
            <div className="text-[10px] text-slate-500">Slower but stricter grounding check</div>
          </div>
          <button
            onClick={() => setUseLlmJudge(!useLlmJudge)}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors",
              useLlmJudge ? "bg-emerald-500" : "bg-slate-700"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                useLlmJudge ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Result tabs
// ---------------------------------------------------------------------------
function ResultTabs({
  result,
  isProcessing,
  error,
  activeTab,
  setActiveTab,
}: {
  result: PipelineResponse | null;
  isProcessing: boolean;
  error: string | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-800 min-h-[420px]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Pipeline output
          </CardTitle>
          {result && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                result.blocked
                  ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                  : result.grounded
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/40 text-amber-300"
              )}
            >
              {result.blocked ? (
                <>
                  <ShieldAlert className="w-3 h-3 mr-1" />
                  Blocked
                </>
              ) : result.grounded ? (
                <>
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Grounded
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Ungrounded
                </>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/30 text-rose-200 mb-4">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle className="text-xs">Pipeline error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {isProcessing && !result && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            <div className="text-xs text-slate-400">Running RAG pipeline…</div>
          </div>
        )}

        {!isProcessing && !result && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center">
              <Mic className="w-5 h-5 text-slate-500" />
            </div>
            <div className="text-xs text-slate-500 max-w-xs">
              Speak a question to see the full RAG pipeline response — answer, sources, guardrails, and latency breakdown.
            </div>
          </div>
        )}

        {result && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-950/60 border border-slate-800 w-full justify-start h-9">
              <TabsTrigger value="answer" className="text-xs data-[state=active]:bg-slate-800">
                Answer
              </TabsTrigger>
              <TabsTrigger value="sources" className="text-xs data-[state=active]:bg-slate-800">
                Sources ({result.sources.length})
              </TabsTrigger>
              <TabsTrigger value="guardrails" className="text-xs data-[state=active]:bg-slate-800">
                Guardrails
              </TabsTrigger>
              <TabsTrigger value="latency" className="text-xs data-[state=active]:bg-slate-800">
                Latency
              </TabsTrigger>
              <TabsTrigger value="context" className="text-xs data-[state=active]:bg-slate-800">
                Context
              </TabsTrigger>
            </TabsList>

            <TabsContent value="answer" className="mt-4">
              <AnswerTab result={result} />
            </TabsContent>
            <TabsContent value="sources" className="mt-4">
              <SourcesTab result={result} />
            </TabsContent>
            <TabsContent value="guardrails" className="mt-4">
              <GuardrailsTab result={result} />
            </TabsContent>
            <TabsContent value="latency" className="mt-4">
              <LatencyTab result={result} />
            </TabsContent>
            <TabsContent value="context" className="mt-4">
              <ContextTab result={result} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Answer tab
// ---------------------------------------------------------------------------
function AnswerTab({ result }: { result: PipelineResponse }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Question</div>
        <p className="text-sm text-slate-300 italic">{result.query}</p>
      </div>
      <Separator className="bg-slate-800" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Answer</div>
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={result.confidence} />
            {result.grounded && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/40 text-emerald-300">
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                Grounded
              </Badge>
            )}
          </div>
        </div>
        <div className="text-sm text-slate-100 leading-relaxed bg-slate-950/60 rounded-md p-4 border border-slate-800 min-h-[100px]">
          {result.answer}
        </div>
        {result.citations.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] text-slate-500">Citations:</span>
            {result.citations.map((c) => (
              <Badge key={c} variant="outline" className="text-[10px] bg-cyan-500/10 border-cyan-500/30 text-cyan-300">
                C{c}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {result.harness.warnings.length > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-200">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            {result.harness.warnings.join(" ")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: PipelineResponse["confidence"] }) {
  const map = {
    high: { label: "High confidence", className: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" },
    medium: { label: "Medium confidence", className: "bg-cyan-500/10 border-cyan-500/40 text-cyan-300" },
    low: { label: "Low confidence", className: "bg-amber-500/10 border-amber-500/40 text-amber-300" },
    refused: { label: "Refused", className: "bg-rose-500/10 border-rose-500/40 text-rose-300" },
  };
  const c = map[confidence];
  return (
    <Badge variant="outline" className={cn("text-[10px]", c.className)}>
      {c.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Sources tab
// ---------------------------------------------------------------------------
function SourcesTab({ result }: { result: PipelineResponse }) {
  if (result.sources.length === 0) {
    return (
      <div className="text-xs text-slate-500 py-8 text-center">
        No sources retrieved. The retrieval guardrail blocked this query.
      </div>
    );
  }
  return (
    <ScrollArea className="h-[400px] pr-3">
      <div className="space-y-3">
        {result.sources.map((s, i) => (
          <div key={s.chunk.id} className="bg-slate-950/60 border border-slate-800 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] bg-cyan-500/10 border-cyan-500/30 text-cyan-300">
                  C{i + 1}
                </Badge>
                <span className="text-[10px] text-slate-500 font-mono">{s.chunk.id}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">score</span>
                <Badge variant="outline" className="text-[10px] bg-slate-800/50 border-slate-700 text-slate-300">
                  {s.score.toFixed(3)}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{s.chunk.text}</p>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60 flex-wrap">
              <Badge variant="secondary" className="text-[10px] bg-slate-800/60 text-slate-400">
                {s.chunk.strategy}
              </Badge>
              {s.chunk.metadata.doc_language && (
                <Badge variant="secondary" className="text-[10px] bg-slate-800/60 text-slate-400">
                  lang: {String(s.chunk.metadata.doc_language)}
                </Badge>
              )}
              {typeof s.chunk.metadata.word_count === "number" && (
                <Badge variant="secondary" className="text-[10px] bg-slate-800/60 text-slate-400">
                  {String(s.chunk.metadata.word_count)} words
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ---------------------------------------------------------------------------
// Guardrails tab
// ---------------------------------------------------------------------------
function GuardrailsTab({ result }: { result: PipelineResponse }) {
  const all = [...result.guardrails.input, ...result.guardrails.output];
  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-md p-3 border text-xs",
          result.guardrails.combined.block
            ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
            : result.guardrails.combined.warn
            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
        )}
      >
        <div className="flex items-center gap-2 font-medium">
          {result.guardrails.combined.block ? (
            <ShieldAlert className="w-4 h-4" />
          ) : result.guardrails.combined.warn ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          {result.guardrails.combined.block
            ? "Pipeline blocked"
            : result.guardrails.combined.warn
            ? "Pipeline passed with warnings"
            : "All guardrails passed"}
          <span className="ml-auto text-[10px] opacity-70">
            {result.guardrails.combined.totalLatencyMs.toFixed(2)} ms total
          </span>
        </div>
        {result.guardrails.combined.reasons.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] opacity-90">
            {result.guardrails.combined.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span>•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Per-guardrail decisions</div>
        {all.map((g, i) => (
          <div
            key={`${g.name}-${i}`}
            className="bg-slate-950/60 border border-slate-800 rounded-md p-3 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <GuardrailIcon severity={g.severity} />
                <span className="font-medium text-slate-200">{g.name}</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  g.severity === "ok"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : g.severity === "warn"
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                    : "bg-rose-500/10 border-rose-500/40 text-rose-300"
                )}
              >
                {g.severity.toUpperCase()}
              </Badge>
            </div>
            <p className="text-slate-400 text-[11px]">{g.reason}</p>
            <div className="text-[10px] text-slate-600 mt-1">{g.latencyMs.toFixed(2)} ms</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuardrailIcon({ severity }: { severity: "ok" | "warn" | "block" }) {
  if (severity === "ok") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (severity === "warn") return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  return <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />;
}

// ---------------------------------------------------------------------------
// Latency tab
// ---------------------------------------------------------------------------
function LatencyTab({ result }: { result: PipelineResponse }) {
  const t = result.timings;
  const maxMs = Math.max(t.inputGuardrailsMs, t.retrievalMs, t.retrievalGuardrailsMs, t.generationMs, t.outputGuardrailsMs, 1);
  const target = 50; // ms target for retrieval stage

  const stages = [
    { name: "Input guardrails", ms: t.inputGuardrailsMs, icon: <ShieldCheck className="w-3 h-3" />, color: "bg-emerald-500" },
    { name: "Retrieval (embed + search)", ms: t.retrievalMs, icon: <Database className="w-3 h-3" />, color: "bg-cyan-500", target },
    { name: "Retrieval guardrails", ms: t.retrievalGuardrailsMs, icon: <ShieldCheck className="w-3 h-3" />, color: "bg-emerald-500" },
    { name: "LLM generation", ms: t.generationMs, icon: <Cpu className="w-3 h-3" />, color: "bg-purple-500" },
    { name: "Output guardrails", ms: t.outputGuardrailsMs, icon: <ShieldCheck className="w-3 h-3" />, color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total pipeline" value={t.totalMs.toFixed(1)} unit="ms" icon={<Gauge className="w-3 h-3" />} accent="cyan" />
        <MetricCard label="Retrieval only" value={t.retrievalMs.toFixed(1)} unit="ms" icon={<Database className="w-3 h-3" />} accent="emerald" target={50} />
        <MetricCard label="LLM attempts" value={String(result.harness.attempts)} unit="" icon={<Cpu className="w-3 h-3" />} accent="purple" />
        <MetricCard label="Context tokens" value={String(result.contextTokenCount)} unit="tok" icon={<FileText className="w-3 h-3" />} accent="amber" />
      </div>

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Per-stage breakdown</div>
        {stages.map((s) => (
          <div key={s.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                {s.icon}
                {s.name}
              </div>
              <span className="font-mono text-slate-200">{s.ms.toFixed(2)} ms</span>
            </div>
            <div className="relative h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full", s.color)}
                style={{ width: `${Math.min(100, (s.ms / maxMs) * 100)}%` }}
              />
              {s.target && (
                <div
                  className="absolute inset-y-0 w-px bg-rose-400"
                  style={{ left: `${Math.min(100, (s.target / maxMs) * 100)}%` }}
                  title="50ms target"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
        <span className="w-2 h-px bg-rose-400" />
        Red marker = 50ms retrieval target (Hacker House Goa 2026 Task 2)
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon,
  accent,
  target,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  accent: "cyan" | "emerald" | "purple" | "amber";
  target?: number;
}) {
  const accentMap = {
    cyan: "text-cyan-400 border-cyan-500/30 bg-cyan-500/5",
    emerald: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    purple: "text-purple-400 border-purple-500/30 bg-purple-500/5",
    amber: "text-amber-400 border-amber-500/30 bg-amber-500/5",
  };
  const valueNum = parseFloat(value);
  const meetsTarget = target !== undefined && valueNum <= target;
  return (
    <div className={cn("rounded-md border p-3", accentMap[accent])}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80 font-medium">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-xl font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-[10px] opacity-60">{unit}</span>}
        {target && (
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-[9px]",
              meetsTarget
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/40 text-rose-300"
            )}
          >
            {meetsTarget ? "✓ ≤50ms" : "✗ >50ms"}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context tab
// ---------------------------------------------------------------------------
function ContextTab({ result }: { result: PipelineResponse }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
        Retrieved context (sent to LLM, with citation markers)
      </div>
      <div className="text-[10px] text-slate-500">
        {result.contextTokenCount} tokens · {result.sources.length} chunks · strategy: {result.strategy}
      </div>
      <ScrollArea className="h-[380px]">
        <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-mono bg-slate-950/60 border border-slate-800 rounded-md p-3">
          {result.contextPreview}
        </pre>
      </ScrollArea>
      {result.retrievalWarnings.length > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-200">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            <ul className="space-y-1">
              {result.retrievalWarnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// System status card
// ---------------------------------------------------------------------------
function SystemStatusCard({ systemStatus }: { systemStatus: any }) {
  if (!systemStatus) return null;
  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-400" />
          Observability
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Developer view of system state and loaded indices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatusItem
            label="Sarvam API key"
            value={systemStatus.sarvamApiKeyConfigured ? "configured" : "missing"}
            ok={systemStatus.sarvamApiKeyConfigured}
          />
          <StatusItem
            label="IDF loaded"
            value={`${systemStatus.idfSize} terms`}
            ok={systemStatus.idfLoaded}
          />
          <StatusItem
            label="Stores loaded"
            value={`${systemStatus.vectorStores?.length ?? 0}/4`}
            ok={(systemStatus.vectorStores?.length ?? 0) > 0}
          />
          <StatusItem
            label="Uptime"
            value={`${Math.round(systemStatus.uptime)}s`}
            ok
          />
        </div>
        {systemStatus.vectorStores?.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
              Vector stores
            </div>
            <div className="space-y-1">
              {systemStatus.vectorStores.map((v: any) => (
                <div
                  key={v.strategy}
                  className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded px-2 py-1.5 text-[11px]"
                >
                  <span className="text-slate-300 font-medium">{v.strategy}</span>
                  <div className="flex items-center gap-3 text-slate-500">
                    <span>{v.chunks} chunks</span>
                    <span>·</span>
                    <span>{v.docs} docs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-md p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-400" : "bg-rose-400")} />
        <span className="text-xs text-slate-200 font-medium truncate">{value}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 py-4 bg-slate-950/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3" />
          Voice RAG · Sarvam Saaras v3 · GLM-4.5 · MSMARCO-XI
        </div>
        <div>Hacker House Goa 2026 · Task 2</div>
      </div>
    </footer>
  );
}
