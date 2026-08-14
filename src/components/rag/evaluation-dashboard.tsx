"use client";

import { useState } from "react";
import { Play, Loader2, BarChart3, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export function EvaluationDashboard() {
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
    <div className="card-paper rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <BarChart3 className="w-4 h-4 text-forest-700" />
            <span className="eyebrow">Evaluation Dashboard</span>
          </div>
          <h2 className="font-serif text-2xl text-forest-900">P50 · P70 · P100 benchmarks</h2>
          <p className="text-sm text-forest-600 mt-1">
            Latency measured across {report?.queries.length ?? 31} queries × 4 chunking strategies.
            Real wall-clock measurements, not estimates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button suppressHydrationWarning
            onClick={() => setIncludeFullPipeline(!includeFullPipeline)}
            disabled={running}
            className={cn(
              "px-3 py-1.5 text-xs rounded-full border transition-colors",
              includeFullPipeline
                ? "bg-forest-700 border-forest-800 text-forest-50"
                : "bg-white border-forest-200 text-forest-700 hover:bg-forest-50"
            )}
          >
            + Full-pipeline (LLM)
          </button>
          <Button
            onClick={runBenchmark}
            disabled={running}
            suppressHydrationWarning
            className="btn-gold rounded-full text-xs h-8"
          >
            {running ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
            {running ? "Running…" : "Run benchmark"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="bg-rose-50 border-rose-200 text-rose-700 mb-4">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {!report && !running && (
        <div className="text-center py-12 text-forest-500 text-sm">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-30" />
          Click <span className="font-semibold text-forest-700">Run benchmark</span> to measure
          P50 / P70 / P100 latency across all four chunking strategies.
        </div>
      )}

      {running && !report && (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 mx-auto mb-3 text-forest-600 animate-spin" />
          <div className="text-sm text-forest-600">
            {includeFullPipeline ? "Running LLM calls — this may take ~30s…" : "Running retrieval benchmark…"}
          </div>
        </div>
      )}

      {report && (
        <div className="space-y-5">
          {/* Headline stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HeadlineStat
              label="Queries"
              value={String(report.queries.length)}
              hint="test inputs"
            />
            <HeadlineStat
              label="Strategies"
              value={String(report.retrievalOnly.length)}
              hint="chunking methods"
            />
            <HeadlineStat
              label="Measurements"
              value={String(
                report.queries.length * report.retrievalOnly.length
              )}
              hint="total samples"
            />
            <HeadlineStat
              label="Target"
              value="<50ms"
              hint="retrieval P100"
            />
          </div>

          {/* Strategy comparison table */}
          <StrategyComparisonTable results={report.retrievalOnly} />

          {/* Full pipeline results */}
          {report.fullPipeline && report.fullPipeline.length > 0 && (
            <div className="space-y-3">
              <div className="eyebrow flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-forest-600" />
                Full pipeline (with LLM)
              </div>
              {report.fullPipeline.map((fp) => (
                <FullPipelineCard key={fp.strategy} result={fp} />
              ))}
            </div>
          )}

          {/* Per-query table */}
          <PerQueryTable report={report} />

          {/* Notes */}
          {report.notes.map((n, i) => (
            <div key={i} className="text-[11px] text-forest-500 italic border-t border-forest-100 pt-3">
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HeadlineStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-forest-200/70 bg-forest-50/40 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-forest-500 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-serif text-forest-900 mt-1 tabular">{value}</div>
      <div className="text-[10px] text-forest-400 mt-0.5">{hint}</div>
    </div>
  );
}

function StrategyComparisonTable({ results }: { results: StrategyResult[] }) {
  const bestP50 = Math.min(...results.map((r) => r.retrievalStats.p50));
  const bestP100 = Math.min(...results.map((r) => r.retrievalStats.p100));

  return (
    <div>
      <div className="eyebrow flex items-center gap-1.5 mb-3">
        <Trophy className="w-3 h-3 text-goa-gold-600" />
        Strategy comparison — retrieval only
      </div>
      <div className="overflow-x-auto rounded-lg border border-forest-200/70">
        <table className="w-full text-xs">
          <thead className="bg-forest-50/60">
            <tr className="text-left text-[10px] uppercase tracking-wider text-forest-600 font-semibold border-b border-forest-200/70">
              <th className="py-2.5 px-3">Strategy</th>
              <th className="py-2.5 px-2 text-right">Chunks</th>
              <th className="py-2.5 px-2 text-right">P50</th>
              <th className="py-2.5 px-2 text-right">P70</th>
              <th className="py-2.5 px-2 text-right">P90</th>
              <th className="py-2.5 px-2 text-right">P95</th>
              <th className="py-2.5 px-2 text-right">P99</th>
              <th className="py-2.5 px-2 text-right">P100</th>
              <th className="py-2.5 px-3 text-right">Mean</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const isBestP50 = r.retrievalStats.p50 === bestP50;
              const isBestP100 = r.retrievalStats.p100 === bestP100;
              const meetsTarget = r.retrievalStats.p100 <= 50;
              return (
                <tr
                  key={r.strategy}
                  className="border-b border-forest-100 last:border-0 text-forest-800 hover:bg-forest-50/40"
                >
                  <td className="py-2.5 px-3 font-medium capitalize">{r.strategy}</td>
                  <td className="py-2.5 px-2 text-right text-forest-500 tabular">{r.chunkCount}</td>
                  <td className={cn("py-2.5 px-2 text-right tabular", isBestP50 && "text-forest-700 font-semibold")}>
                    {r.retrievalStats.p50.toFixed(2)}
                    {isBestP50 && <span className="text-goa-gold-600 ml-0.5">★</span>}
                  </td>
                  <td className="py-2.5 px-2 text-right text-forest-600 tabular">{r.retrievalStats.p70.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right text-forest-600 tabular">{r.retrievalStats.p90.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right text-forest-600 tabular">{r.retrievalStats.p95.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-right text-forest-600 tabular">{r.retrievalStats.p99.toFixed(2)}</td>
                  <td className={cn("py-2.5 px-2 text-right tabular", isBestP100 && "text-forest-700 font-semibold")}>
                    {r.retrievalStats.p100.toFixed(2)}
                    {isBestP100 && <span className="text-goa-gold-600 ml-0.5">★</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right text-forest-500 tabular">{r.retrievalStats.mean.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-forest-500 italic flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="text-goa-gold-600">★</span> best (lowest)
        </span>
        <span>·</span>
        <span>All latencies in ms · target: P100 ≤ 50ms</span>
      </div>
    </div>
  );
}

function FullPipelineCard({ result }: { result: FullPipelineResult }) {
  return (
    <div className="rounded-lg border border-forest-200/70 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium capitalize text-forest-800">{result.strategy}</div>
        <div className="flex items-center gap-2">
          <span className="chip chip-emerald">{result.groundedCount} grounded</span>
          <span className="chip chip-gold">{result.refusedCount} refused</span>
          {result.blockedCount > 0 && (
            <span className="chip chip-rose">{result.blockedCount} blocked</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Total" stats={result.totalStats} />
        <StatBox label="Retrieval" stats={result.retrievalStats} />
        <StatBox label="Generation" stats={result.generationStats} />
      </div>
    </div>
  );
}

function StatBox({ label, stats }: { label: string; stats: LatencyStats }) {
  return (
    <div className="rounded-md bg-forest-50/50 p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-forest-500 font-semibold">{label}</div>
      <div className="text-sm font-semibold text-forest-800 tabular mt-1">
        P50 {stats.p50.toFixed(stats.p50 < 10 ? 2 : 0)}ms
      </div>
      <div className="text-[11px] text-forest-500 tabular">
        P100 {stats.p100.toFixed(stats.p100 < 10 ? 2 : 0)}ms
      </div>
    </div>
  );
}

function PerQueryTable({ report }: { report: BenchmarkReport }) {
  const [expanded, setExpanded] = useState(false);
  const data = report.retrievalOnly[0];
  if (!data) return null;
  const queriesToShow = expanded ? data.perQuery : data.perQuery.slice(0, 5);

  return (
    <div>
      <div className="eyebrow flex items-center gap-1.5 mb-3">
        <TrendingUp className="w-3 h-3 text-forest-600" />
        Per-query latency ({data.strategy})
      </div>
      <div className="overflow-x-auto rounded-lg border border-forest-200/70">
        <table className="w-full text-xs">
          <thead className="bg-forest-50/60">
            <tr className="text-left text-[10px] uppercase tracking-wider text-forest-600 font-semibold border-b border-forest-200/70">
              <th className="py-2 px-3">Query</th>
              <th className="py-2 px-2 text-right">Embed</th>
              <th className="py-2 px-2 text-right">Search</th>
              <th className="py-2 px-2 text-right">Total</th>
              <th className="py-2 px-3 text-right">Top score</th>
            </tr>
          </thead>
          <tbody>
            {queriesToShow.map((q, i) => (
              <tr
                key={i}
                className="border-b border-forest-100 last:border-0 text-forest-700 hover:bg-forest-50/40"
              >
                <td className="py-2 px-3 max-w-[260px] truncate text-forest-600">{q.query}</td>
                <td className="py-2 px-2 text-right text-forest-500 tabular">{q.embeddingMs.toFixed(2)}</td>
                <td className="py-2 px-2 text-right text-forest-500 tabular">{q.searchMs.toFixed(2)}</td>
                <td className="py-2 px-2 text-right text-forest-800 font-semibold tabular">
                  {q.totalRetrievalMs.toFixed(2)}
                </td>
                <td className="py-2 px-3 text-right text-forest-500 tabular">{q.topScore.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.perQuery.length > 5 && (
        <button suppressHydrationWarning
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-[11px] text-forest-600 hover:text-forest-800 font-medium"
        >
          {expanded ? "Show less" : `Show all ${data.perQuery.length} queries →`}
        </button>
      )}
    </div>
  );
}
