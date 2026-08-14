"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Loader2, BarChart3, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LatencyStats {
  n: number;
  min: number;
  p50: number;
  p70: number;
  p90: number;
  p95: number;
  p99: number;
  p100: number;
  mean: number;
  stddev: number;
}

interface StrategyResult {
  strategy: string;
  chunkCount: number;
  retrievalStats: LatencyStats;
  embeddingStats: LatencyStats;
  searchStats: LatencyStats;
  topScoreStats: LatencyStats;
  perQuery: Array<{
    query: string;
    embeddingMs: number;
    searchMs: number;
    totalRetrievalMs: number;
    topScore: number;
    chunksRetrieved: number;
  }>;
}

interface FullPipelineResult {
  strategy: string;
  totalStats: LatencyStats;
  retrievalStats: LatencyStats;
  generationStats: LatencyStats;
  blockedCount: number;
  refusedCount: number;
  groundedCount: number;
  perQuery: Array<{
    query: string;
    totalMs: number;
    retrievalMs: number;
    generationMs: number;
    blocked: boolean;
    confidence: string;
    grounded: boolean;
  }>;
}

interface BenchmarkReport {
  generatedAt: string;
  queries: string[];
  retrievalOnly: StrategyResult[];
  fullPipeline?: FullPipelineResult[];
  notes: string[];
}

export function BenchmarkPanel() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeFullPipeline, setIncludeFullPipeline] = useState(false);

  const runBenchmark = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeFullPipeline,
          fullPipelineQueryCount: 5,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Benchmark failed");
      } else {
        setReport(data.report);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Benchmark & Evaluation
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Runs the official benchmark suite — P50 / P70 / P100 latency stats per chunking strategy.
          Retrieval-only mode is fast (~10s). Full-pipeline mode calls the LLM and is much slower.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={runBenchmark}
              disabled={running}
              size="sm"
              className="bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30"
            >
              {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
              Run benchmark
            </Button>
            <button
              onClick={() => setIncludeFullPipeline(!includeFullPipeline)}
              disabled={running}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md border transition-colors",
                includeFullPipeline
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-200"
                  : "bg-slate-800/50 border-slate-700 text-slate-400"
              )}
            >
              Include full-pipeline (LLM) — slower
            </button>
          </div>
          {report && (
            <Badge variant="outline" className="text-[10px] bg-slate-800/50 border-slate-700">
              {new Date(report.generatedAt).toLocaleTimeString()}
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/30 text-rose-200">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {report && (
          <>
            {report.notes.map((n, i) => (
              <div key={i} className="text-[10px] text-slate-500 italic">
                {n}
              </div>
            ))}

            <StrategyComparisonTable results={report.retrievalOnly} />

            {report.fullPipeline && report.fullPipeline.length > 0 && (
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                  Full-pipeline (with LLM)
                </div>
                {report.fullPipeline.map((fp) => (
                  <FullPipelineCard key={fp.strategy} result={fp} />
                ))}
              </div>
            )}

            <PerQueryTable report={report} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Strategy comparison table
// ---------------------------------------------------------------------------
function StrategyComparisonTable({ results }: { results: StrategyResult[] }) {
  // Find best P50 and best P100
  const bestP50 = Math.min(...results.map((r) => r.retrievalStats.p50));
  const bestP100 = Math.min(...results.map((r) => r.retrievalStats.p100));

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
        <Trophy className="w-3 h-3 text-amber-400" />
        Strategy comparison — retrieval only
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 border-b border-slate-800">
              <th className="py-2 pr-3 font-medium">Strategy</th>
              <th className="py-2 px-2 font-medium text-right">Chunks</th>
              <th className="py-2 px-2 font-medium text-right">P50</th>
              <th className="py-2 px-2 font-medium text-right">P70</th>
              <th className="py-2 px-2 font-medium text-right">P90</th>
              <th className="py-2 px-2 font-medium text-right">P95</th>
              <th className="py-2 px-2 font-medium text-right">P100</th>
              <th className="py-2 px-2 font-medium text-right">Mean</th>
              <th className="py-2 pl-2 font-medium text-right">Top score P50</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isBestP50 = r.retrievalStats.p50 === bestP50;
              const isBestP100 = r.retrievalStats.p100 === bestP100;
              return (
                <tr key={r.strategy} className="border-b border-slate-800/60 text-slate-300">
                  <td className="py-2 pr-3 font-medium text-slate-200">{r.strategy}</td>
                  <td className="py-2 px-2 text-right text-slate-400">{r.chunkCount}</td>
                  <td className={cn("py-2 px-2 text-right font-mono", isBestP50 && "text-emerald-400 font-semibold")}>
                    {r.retrievalStats.p50.toFixed(2)}
                    {isBestP50 && <span className="text-[9px] ml-1">★</span>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">{r.retrievalStats.p70.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">{r.retrievalStats.p90.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">{r.retrievalStats.p95.toFixed(2)}</td>
                  <td className={cn("py-2 px-2 text-right font-mono", isBestP100 && "text-emerald-400 font-semibold")}>
                    {r.retrievalStats.p100.toFixed(2)}
                    {isBestP100 && <span className="text-[9px] ml-1">★</span>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-400">{r.retrievalStats.mean.toFixed(2)}</td>
                  <td className="py-2 pl-2 text-right font-mono text-slate-400">{r.topScoreStats.p50.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-500 italic">
        ★ = best (lowest) latency. All latencies in milliseconds. Target: P100 &lt; 50ms for retrieval.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full pipeline card
// ---------------------------------------------------------------------------
function FullPipelineCard({ result }: { result: FullPipelineResult }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-200">{result.strategy}</div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/40 text-emerald-300">
            {result.groundedCount} grounded
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/40 text-amber-300">
            {result.refusedCount} refused
          </Badge>
          {result.blockedCount > 0 && (
            <Badge variant="outline" className="text-[10px] bg-rose-500/10 border-rose-500/40 text-rose-300">
              {result.blockedCount} blocked
            </Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <StatBox label="Total" stats={result.totalStats} />
        <StatBox label="Retrieval" stats={result.retrievalStats} />
        <StatBox label="Generation" stats={result.generationStats} />
      </div>
    </div>
  );
}

function StatBox({ label, stats }: { label: string; stats: LatencyStats }) {
  return (
    <div className="bg-slate-900/40 rounded p-2">
      <div className="text-slate-500 uppercase tracking-wider font-medium">{label}</div>
      <div className="font-mono text-slate-300 mt-1">
        P50: <span className="text-slate-100">{stats.p50.toFixed(0)}ms</span>
      </div>
      <div className="font-mono text-slate-400">
        P100: <span className="text-slate-200">{stats.p100.toFixed(0)}ms</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-query table
// ---------------------------------------------------------------------------
function PerQueryTable({ report }: { report: BenchmarkReport }) {
  const [expanded, setExpanded] = useState(false);
  // Show per-query for the first retrieval-only strategy
  const data = report.retrievalOnly[0];
  if (!data) return null;
  const queriesToShow = expanded ? data.perQuery : data.perQuery.slice(0, 5);
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3 text-cyan-400" />
        Per-query retrieval latency ({data.strategy})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-slate-500 border-b border-slate-800">
              <th className="py-1.5 pr-3 font-medium">Query</th>
              <th className="py-1.5 px-2 font-medium text-right">Embed (ms)</th>
              <th className="py-1.5 px-2 font-medium text-right">Search (ms)</th>
              <th className="py-1.5 px-2 font-medium text-right">Total (ms)</th>
              <th className="py-1.5 px-2 font-medium text-right">Top score</th>
              <th className="py-1.5 pl-2 font-medium text-right">Chunks</th>
            </tr>
          </thead>
          <tbody>
            {queriesToShow.map((q, i) => (
              <tr key={i} className="border-b border-slate-800/60 text-slate-300">
                <td className="py-1.5 pr-3 max-w-[280px] truncate text-slate-400">{q.query}</td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-400">{q.embeddingMs.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-400">{q.searchMs.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-100 font-semibold">
                  {q.totalRetrievalMs.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-400">{q.topScore.toFixed(3)}</td>
                <td className="py-1.5 pl-2 text-right text-slate-400">{q.chunksRetrieved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.perQuery.length > 5 && (
        <Button
          onClick={() => setExpanded(!expanded)}
          variant="ghost"
          size="sm"
          className="text-[10px] text-slate-400 hover:text-slate-200 h-6"
        >
          {expanded ? "Show less" : `Show all ${data.perQuery.length} queries`}
        </Button>
      )}
    </div>
  );
}
