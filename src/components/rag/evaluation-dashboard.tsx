"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Play,
  Loader2,
  BarChart3,
  Trophy,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hash,
  Clock,
  RefreshCw,
  Search,
  Globe2,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type {
  UnifiedBenchmarkReport,
  BenchmarkStrategyResult,
  BenchmarkQueryRecord,
} from "@/lib/benchmarks/runner";
import type { LatencyStats } from "@/lib/benchmarks/stats";

export function EvaluationDashboard() {
  const [report, setReport] = useState<UnifiedBenchmarkReport | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration options
  const [queryCount, setQueryCount] = useState<number>(300);
  const [engine, setEngine] = useState<"fast" | "sarvam">("fast");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("all");

  // Per-query table filters
  const [querySearch, setQuerySearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [expandedTable, setExpandedTable] = useState(false);

  // ---------------------------------------------------------------------------
  // Load latest benchmark run on mount
  // ---------------------------------------------------------------------------
  const fetchLatestRun = useCallback(async () => {
    setLoadingLatest(true);
    try {
      const res = await fetch("/api/benchmark");
      const data = await res.json();
      if (data.ok && data.report) {
        setReport(data.report);
      }
    } catch {
      // Ignore initial fetch errors
    } finally {
      setLoadingLatest(false);
    }
  }, []);

  useEffect(() => {
    fetchLatestRun();
  }, [fetchLatestRun]);

  // ---------------------------------------------------------------------------
  // Run live benchmark
  // ---------------------------------------------------------------------------
  const runBenchmark = async () => {
    setRunning(true);
    setError(null);
    try {
      const strategies =
        selectedStrategy === "all"
          ? ["fixed", "overlapping", "semantic", "metadata-aware"]
          : [selectedStrategy];

      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryCount,
          strategies,
          engine,
          budgetMs: 50,
          warmupCount: 20,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Benchmark run failed.");
      } else {
        setReport(data.report);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error during benchmark execution.");
    } finally {
      setRunning(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Active strategy result
  // ---------------------------------------------------------------------------
  const activeResult: BenchmarkStrategyResult | undefined = useMemo(() => {
    if (!report || report.results.length === 0) return undefined;
    if (selectedStrategy !== "all") {
      return report.results.find((r) => r.strategy === selectedStrategy) ?? report.results[0];
    }
    // Default to overlapping if all strategies were evaluated
    return report.results.find((r) => r.strategy === "overlapping") ?? report.results[0];
  }, [report, selectedStrategy]);

  // Filtered raw query records
  const filteredRecords = useMemo(() => {
    if (!activeResult || !activeResult.rawRecords) return [];
    return activeResult.rawRecords.filter((rec) => {
      if (querySearch.trim()) {
        const q = querySearch.toLowerCase();
        const matchesQuery = rec.query?.toLowerCase().includes(q);
        const matchesAnswer = rec.answer?.toLowerCase().includes(q);
        if (!matchesQuery && !matchesAnswer) return false;
      }
      if (languageFilter !== "all" && rec.language !== languageFilter) {
        return false;
      }
      if (outcomeFilter !== "all" && rec.outcome !== outcomeFilter) {
        return false;
      }
      return true;
    });
  }, [activeResult, querySearch, languageFilter, outcomeFilter]);

  const recordsToShow = expandedTable ? filteredRecords : filteredRecords.slice(0, 10);

  const hasLanguageData = Boolean(
    activeResult?.languageBreakdown &&
    Object.values(activeResult.languageBreakdown).some((v) => v.count > 0)
  );

  return (
    <div className="space-y-6">
      {/* 1. Evaluation Header & Controls */}
      <div className="card-paper rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-forest-700 dark:text-forest-300" />
              <span className="eyebrow">Task 2 Voice RAG Evaluation</span>
            </div>
            <h2 className="font-serif text-2xl text-forest-900 dark:text-forest-50">
              Fast Local RAG Pipeline Benchmark
            </h2>
            <p className="text-xs text-forest-600 dark:text-forest-300 mt-1">
              Measured wall-clock latency (Guardrails &rarr; Hybrid BM25 &amp; Vector Retrieval &rarr; Grounded Synthesizer &rarr; Output Checks). Remote STT measured separately.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Query Count Preset */}
            <select
              value={queryCount}
              onChange={(e) => setQueryCount(Number(e.target.value))}
              disabled={running}
              className="px-3 py-1.5 text-xs rounded-lg border border-forest-200 dark:border-forest-800 bg-white dark:bg-[#11231c] text-forest-800 dark:text-forest-100 focus:outline-none focus:ring-1 focus:ring-forest-500 cursor-pointer"
            >
              <option value={300}>300 Queries (Canonical Suite)</option>
              <option value={100}>100 Queries (Balanced Mix)</option>
              <option value={30}>30 Queries (Quick Scan)</option>
            </select>

            {/* Engine Toggle */}
            <div className="flex items-center bg-forest-100 dark:bg-forest-950/60 rounded-full p-0.5 border border-forest-200/50 dark:border-forest-800/50">
              <button
                suppressHydrationWarning
                onClick={() => setEngine("fast")}
                disabled={running}
                className={cn(
                  "px-3 py-1 text-[11px] font-semibold rounded-full transition-colors cursor-pointer",
                  engine === "fast"
                    ? "bg-forest-800 dark:bg-forest-600 text-white shadow-xs"
                    : "text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-200"
                )}
                title="Fast Local Grounded Synthesizer (<2ms)"
              >
                Fast Local (&le;50ms SLA)
              </button>
              <button
                suppressHydrationWarning
                onClick={() => setEngine("sarvam")}
                disabled={running}
                className={cn(
                  "px-3 py-1 text-[11px] font-semibold rounded-full transition-colors cursor-pointer",
                  engine === "sarvam"
                    ? "bg-forest-800 dark:bg-forest-600 text-white shadow-xs"
                    : "text-forest-600 dark:text-forest-400 hover:text-forest-900 dark:hover:text-forest-200"
                )}
                title="Sarvam AI Cloud LLM Generative Mode (~950ms)"
              >
                Sarvam Cloud
              </button>
            </div>

            {/* Strategy Select */}
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              disabled={running}
              className="px-3 py-1.5 text-xs rounded-lg border border-forest-200 dark:border-forest-800 bg-white dark:bg-[#11231c] text-forest-800 dark:text-forest-100 focus:outline-none focus:ring-1 focus:ring-forest-500 capitalize cursor-pointer"
            >
              <option value="all">All 4 Strategies</option>
              <option value="overlapping">Overlapping</option>
              <option value="fixed">Fixed</option>
              <option value="semantic">Semantic</option>
              <option value="metadata-aware">Metadata-Aware</option>
            </select>

            {/* Action Buttons */}
            <Button
              onClick={runBenchmark}
              disabled={running}
              suppressHydrationWarning
              className="btn-gold rounded-full text-xs h-8 px-4 cursor-pointer"
            >
              {running ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 mr-1.5" />
              )}
              {running ? "Running Suite…" : "Run Benchmark"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchLatestRun}
              disabled={running || loadingLatest}
              className="rounded-full text-xs h-8 px-3 border-forest-200 dark:border-forest-700 text-forest-700 dark:text-forest-200 hover:bg-forest-50 dark:hover:bg-forest-900/60 cursor-pointer"
              title="Refresh Latest Benchmark Run"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loadingLatest && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* 2. Explicit Benchmark Scope Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3 border-t border-forest-100 dark:border-forest-800/60 text-center text-xs">
          <div className="p-2 rounded bg-forest-50/50 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60">
            <span className="text-[9px] uppercase font-semibold text-forest-500 dark:text-forest-400 block">Dataset</span>
            <span className="font-bold text-forest-800 dark:text-forest-200 text-[11px]">MSMARCO-XI (500 Docs)</span>
          </div>
          <div className="p-2 rounded bg-forest-50/50 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60">
            <span className="text-[9px] uppercase font-semibold text-forest-500 dark:text-forest-400 block">Queries Evaluated</span>
            <span className="font-bold text-forest-800 dark:text-forest-200 text-[11px]">{report?.config?.queryCount ?? queryCount} Canonical Pool</span>
          </div>
          <div className="p-2 rounded bg-forest-50/50 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60">
            <span className="text-[9px] uppercase font-semibold text-forest-500 dark:text-forest-400 block">Warm-up Runs</span>
            <span className="font-bold text-forest-800 dark:text-forest-200 text-[11px]">20 Discarded Runs</span>
          </div>
          <div className="p-2 rounded bg-forest-50/50 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60">
            <span className="text-[9px] uppercase font-semibold text-forest-500 dark:text-forest-400 block">Strategies</span>
            <span className="font-bold text-forest-800 dark:text-forest-200 text-[11px]">All 4 Evaluated</span>
          </div>
          <div className="p-2 rounded bg-forest-50/50 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60">
            <span className="text-[9px] uppercase font-semibold text-forest-500 dark:text-forest-400 block">Measurement Scope</span>
            <span className="font-bold text-forest-800 dark:text-forest-200 text-[11px]">Fast Local RAG Pipeline</span>
          </div>
          <div className="p-2 rounded bg-forest-50/50 dark:bg-forest-950/40 border border-forest-100 dark:border-forest-800/60">
            <span className="text-[9px] uppercase font-semibold text-forest-500 dark:text-forest-400 block">SLA Target</span>
            <span className="font-bold text-forest-800 dark:text-forest-200 text-[11px]">P95 &le; 50.0ms</span>
          </div>
        </div>

        {error && (
          <Alert className="bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 mt-2">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Loading state */}
      {running && !report && (
        <div className="card-paper rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-forest-600 dark:text-forest-400 animate-spin" />
          <h3 className="font-serif text-lg text-forest-900 dark:text-forest-100">Executing Unified Benchmark Suite</h3>
          <p className="text-xs text-forest-500 dark:text-forest-400 mt-1 max-w-md mx-auto">
            Processing 20 warm-up runs + {queryCount} timed queries across selected chunking strategies.
          </p>
        </div>
      )}

      {/* Report Dashboard */}
      {report && (
        <div className="space-y-6">
          {/* 3. Traceability & Metadata Banner */}
          <div className="rounded-xl border border-forest-200/80 dark:border-forest-800/80 bg-white/80 dark:bg-[#11231c]/80 backdrop-blur-sm p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 font-mono text-forest-800 dark:text-forest-200">
                <Hash className="w-3.5 h-3.5 text-forest-500 dark:text-forest-400" />
                <span className="font-semibold">Run ID:</span> {report.benchmark_run_id}
              </div>
              <span className="text-forest-300 dark:text-forest-700">|</span>
              <div className="flex items-center gap-1.5 text-forest-600 dark:text-forest-300">
                <Clock className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500" />
                <span>{new Date(report.timestamp).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full",
                  report.summary?.slaStatus === "PASS"
                    ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                )}
              >
                {report.summary?.slaStatus === "PASS" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 mr-1 inline" />
                )}
                SLA &lt;50ms {report.summary?.slaStatus ?? "PASS"}
              </Badge>
              <span className="text-[11px] text-forest-500 dark:text-forest-400">
                Engine: <strong>{report.config?.engine ?? "fast"}</strong>
              </span>
            </div>
          </div>

          {/* 4. Top Key Headline Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <HeadlineStatCard
              label="P50 Latency"
              value={`${(activeResult?.stageStats?.total?.p50 ?? report.summary?.overallP50 ?? 0).toFixed(1)}ms`}
              hint={`Strategy: ${activeResult?.strategy ?? "all"}`}
              highlight="p50"
            />
            <HeadlineStatCard
              label="P95 Latency"
              value={`${(activeResult?.stageStats?.total?.p95 ?? report.summary?.overallP95 ?? 0).toFixed(1)}ms`}
              hint="95th percentile"
              highlight="p95"
            />
            <HeadlineStatCard
              label="P100 (Max)"
              value={`${(activeResult?.stageStats?.total?.p100 ?? report.summary?.overallP100 ?? 0).toFixed(1)}ms`}
              hint="Worst-case latency"
              highlight="p100"
            />
            <HeadlineStatCard
              label="Grounding Rate"
              value={`${(activeResult?.groundingRate ?? report.summary?.groundingRate ?? 0).toFixed(1)}%`}
              hint="Factual context overlap"
            />
            <HeadlineStatCard
              label="Citation Accuracy"
              value={`${(activeResult?.citationAccuracy ?? report.summary?.citationAccuracy ?? 0).toFixed(1)}%`}
              hint="Valid [C1]-[C5] claims"
            />
            <HeadlineStatCard
              label="Outcomes"
              value={`${activeResult?.outcomes?.Answer ?? 0} / ${activeResult?.outcomes?.Abstention ?? 0}`}
              hint="Answer / Abstention"
            />
          </div>

          {/* 5. Strategy Comparison Table */}
          <div className="card-paper rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="eyebrow flex items-center gap-1.5 text-forest-700 dark:text-forest-300">
                <Trophy className="w-3.5 h-3.5 text-goa-gold-600 dark:text-goa-gold-400" />
                Strategy Comparison — Fast Local RAG Pipeline Latency (ms)
              </div>
              <span className="text-[11px] text-forest-500 dark:text-forest-400">
                SLA Target: P95 &le; 50.0ms
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-forest-200/80 dark:border-forest-800/80">
              <table className="w-full text-xs">
                <thead className="bg-forest-50/70 dark:bg-forest-950/70">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-forest-600 dark:text-forest-400 font-semibold border-b border-forest-200/80 dark:border-forest-800/80">
                    <th className="py-2.5 px-3">Strategy</th>
                    <th className="py-2.5 px-2 text-right">Queries</th>
                    <th className="py-2.5 px-2 text-right">P50</th>
                    <th className="py-2.5 px-2 text-right">P70</th>
                    <th className="py-2.5 px-2 text-right">P90</th>
                    <th className="py-2.5 px-2 text-right">P95</th>
                    <th className="py-2.5 px-2 text-right">P99</th>
                    <th className="py-2.5 px-2 text-right">P100 (Max)</th>
                    <th className="py-2.5 px-2 text-right">Grounding</th>
                    <th className="py-2.5 px-3 text-center">SLA Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((res) => {
                    const isSelected =
                      selectedStrategy === res.strategy ||
                      (selectedStrategy === "all" && res.strategy === "overlapping");

                    return (
                      <tr
                        key={res.strategy}
                        onClick={() => setSelectedStrategy(res.strategy)}
                        className={cn(
                          "border-b border-forest-100 dark:border-forest-800/60 last:border-0 cursor-pointer transition-colors",
                          isSelected
                            ? "bg-forest-50/80 dark:bg-forest-900/60 font-medium text-forest-950 dark:text-forest-50"
                            : "hover:bg-forest-50/40 dark:hover:bg-forest-950/40 text-forest-800 dark:text-forest-200"
                        )}
                      >
                        <td className="py-2.5 px-3 capitalize flex items-center gap-1.5">
                          {isSelected && <span className="text-goa-gold-600 dark:text-goa-gold-400 font-bold">&bull;</span>}
                          {res.strategy}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular text-forest-500 dark:text-forest-400">
                          {res.queryCount}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular font-semibold text-forest-800 dark:text-forest-100">
                          {res.stageStats?.total?.p50?.toFixed(2) ?? "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular text-forest-600 dark:text-forest-300">
                          {res.stageStats?.total?.p70?.toFixed(2) ?? "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular text-forest-600 dark:text-forest-300">
                          {res.stageStats?.total?.p90?.toFixed(2) ?? "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular font-semibold text-forest-800 dark:text-forest-100">
                          {res.stageStats?.total?.p95?.toFixed(2) ?? "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular text-forest-600 dark:text-forest-300">
                          {res.stageStats?.total?.p99?.toFixed(2) ?? "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular text-forest-700 dark:text-forest-300">
                          {res.stageStats?.total?.p100?.toFixed(2) ?? "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular text-emerald-700 dark:text-emerald-400">
                          {res.groundingRate?.toFixed(1) ?? "—"}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {res.slaPass ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                              FAIL
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Active Strategy Stage Breakdown & 7. Language Cards */}
          {activeResult && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stage Breakdown */}
              <div className="card-paper rounded-xl p-5 space-y-3">
                <div className="eyebrow flex items-center gap-1.5 text-forest-700 dark:text-forest-300">
                  <TrendingUp className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
                  Stage Latency Breakdown ({activeResult.strategy})
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <StageBox
                    label="Guardrails Stage"
                    p50={activeResult.stageStats?.guardrails?.p50}
                    p95={activeResult.stageStats?.guardrails?.p95}
                    p100={activeResult.stageStats?.guardrails?.p100}
                    hint="Input, retrieval & refusal filters"
                  />
                  <StageBox
                    label="Retrieval Stage"
                    p50={activeResult.stageStats?.retrieval?.p50}
                    p95={activeResult.stageStats?.retrieval?.p95}
                    p100={activeResult.stageStats?.retrieval?.p100}
                    hint="Multi-Field BM25 + Vector Search"
                  />
                  <StageBox
                    label="Synthesizer Stage"
                    p50={activeResult.stageStats?.generation?.p50}
                    p95={activeResult.stageStats?.generation?.p95}
                    p100={activeResult.stageStats?.generation?.p100}
                    hint="Grounded claim extraction"
                  />
                  <StageBox
                    label="Total RAG Pipeline"
                    p50={activeResult.stageStats?.total?.p50}
                    p95={activeResult.stageStats?.total?.p95}
                    p100={activeResult.stageStats?.total?.p100}
                    hint="End-to-end local latency"
                    highlight
                  />
                </div>
              </div>

              {/* Multilingual Performance */}
              {hasLanguageData && (
                <div className="card-paper rounded-xl p-5 space-y-3">
                  <div className="eyebrow flex items-center gap-1.5 text-forest-700 dark:text-forest-300">
                    <Globe2 className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
                    Multilingual Performance ({activeResult.strategy})
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <LangBox
                      lang="English (en)"
                      stats={activeResult.languageBreakdown?.en}
                    />
                    <LangBox
                      lang="Hindi (hi)"
                      stats={activeResult.languageBreakdown?.hi}
                    />
                    <LangBox
                      lang="Bengali (bn)"
                      stats={activeResult.languageBreakdown?.bn}
                    />
                  </div>

                  <p className="text-[10px] text-forest-500 dark:text-forest-400 leading-tight pt-1">
                    Indic queries are bridged via lexical translations directly to English corpus passages.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 8. Raw Query Telemetry Inspector */}
          <div className="card-paper rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="eyebrow flex items-center gap-1.5 text-forest-700 dark:text-forest-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
                  Per-Query Benchmark Telemetry Inspector
                </div>
                <p className="text-[11px] text-forest-500 dark:text-forest-400 mt-0.5">
                  Live trace of {filteredRecords.length} recorded queries for strategy{" "}
                  <strong className="text-forest-800 dark:text-forest-200">{activeResult?.strategy}</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-forest-400 dark:text-forest-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search queries/answers…"
                    value={querySearch}
                    onChange={(e) => setQuerySearch(e.target.value)}
                    className="pl-8 pr-3 py-1 text-xs rounded-lg border border-forest-200 dark:border-forest-800 bg-white dark:bg-[#11231c] text-forest-800 dark:text-forest-100 focus:outline-none focus:ring-1 focus:ring-forest-500 w-48"
                  />
                </div>

                {/* Language filter */}
                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-forest-200 dark:border-forest-800 bg-white dark:bg-[#11231c] text-forest-800 dark:text-forest-100 focus:outline-none focus:ring-1 focus:ring-forest-500 cursor-pointer"
                >
                  <option value="all">All Languages</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="bn">Bengali</option>
                </select>

                {/* Outcome filter */}
                <select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-forest-200 dark:border-forest-800 bg-white dark:bg-[#11231c] text-forest-800 dark:text-forest-100 focus:outline-none focus:ring-1 focus:ring-forest-500 cursor-pointer"
                >
                  <option value="all">All Outcomes</option>
                  <option value="Answer">Answer</option>
                  <option value="Abstention">Abstention</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-forest-200/80 dark:border-forest-800/80">
              <table className="w-full text-xs">
                <thead className="bg-forest-50/70 dark:bg-forest-950/70">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-forest-600 dark:text-forest-400 font-semibold border-b border-forest-200/80 dark:border-forest-800/80">
                    <th className="py-2 px-2.5 w-10">#</th>
                    <th className="py-2 px-2">Query</th>
                    <th className="py-2 px-2 w-14">Lang</th>
                    <th className="py-2 px-2 text-right w-16">Guard (ms)</th>
                    <th className="py-2 px-2 text-right w-16">Retr (ms)</th>
                    <th className="py-2 px-2 text-right w-16">Gen (ms)</th>
                    <th className="py-2 px-2 text-right w-16 font-bold">Total (ms)</th>
                    <th className="py-2 px-2 text-center w-20">Outcome</th>
                    <th className="py-2 px-3">Answer / Claim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-100 dark:divide-forest-800/60">
                  {recordsToShow.map((rec, idx) => {
                    const index = rec.queryIndex !== undefined ? rec.queryIndex : idx + 1;
                    const guard = rec.guardrailsMs ?? (rec as any).stageLatencies?.guardrailsMs ?? 0;
                    const retr = rec.retrievalMs ?? (rec as any).stageLatencies?.retrievalMs ?? 0;
                    const gen = rec.generationMs ?? (rec as any).stageLatencies?.generationMs ?? 0;
                    const total = rec.totalMs ?? (rec as any).stageLatencies?.totalMs ?? 0;

                    return (
                      <tr key={index} className="hover:bg-forest-50/30 dark:hover:bg-forest-950/40 transition-colors">
                        <td className="py-2 px-2.5 text-forest-400 dark:text-forest-500 font-mono text-[10px]">
                          {index}
                        </td>
                        <td className="py-2 px-2 text-forest-900 dark:text-forest-100 font-medium max-w-xs truncate" title={rec.query}>
                          {rec.query}
                        </td>
                        <td className="py-2 px-2 uppercase font-mono text-[10px] text-forest-600 dark:text-forest-400">
                          {rec.language}
                        </td>
                        <td className="py-2 px-2 text-right tabular text-forest-500 dark:text-forest-400 font-mono text-[10px]">
                          {guard.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right tabular text-forest-600 dark:text-forest-300 font-mono text-[10px]">
                          {retr.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right tabular text-forest-500 dark:text-forest-400 font-mono text-[10px]">
                          {gen.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right tabular font-bold text-forest-900 dark:text-forest-50 font-mono text-[10px]">
                          {total.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
                              rec.outcome === "Answer"
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                                : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                            )}
                          >
                            {rec.outcome}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-forest-700 dark:text-forest-300 text-[11px] max-w-sm truncate" title={rec.answer}>
                          {rec.answer}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRecords.length > 10 && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandedTable(!expandedTable)}
                  className="text-xs h-7 text-forest-700 dark:text-forest-200 border-forest-200 dark:border-forest-700 hover:bg-forest-50 dark:hover:bg-forest-900/60 cursor-pointer"
                >
                  {expandedTable ? "Show Less (Top 10)" : `Show All (${filteredRecords.length} Queries)`}
                </Button>
              </div>
            )}
          </div>

          {/* 9. Benchmark Definitions & Methodology */}
          <div className="card-paper rounded-xl p-5 space-y-2 bg-forest-50/30 dark:bg-forest-950/30 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-forest-800 dark:text-forest-200">
              <Info className="w-3.5 h-3.5 text-forest-600 dark:text-forest-400" />
              Benchmark Methodology & Definitions
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-forest-600 dark:text-forest-300 pt-1 leading-relaxed">
              <div>
                <strong>Nearest-Rank Percentiles:</strong> Computed using <code className="font-mono bg-white dark:bg-[#0c1813] px-1 py-0.5 rounded text-forest-700 dark:text-forest-300 border border-forest-100 dark:border-forest-800">Math.ceil((p / 100) * n) - 1</code> indexing directly over raw sorted execution sample arrays.
              </div>
              <div>
                <strong>Timing Boundaries:</strong> Measures the server-side RAG pipeline (<code className="font-mono bg-white dark:bg-[#0c1813] px-1 py-0.5 rounded text-forest-700 dark:text-forest-300 border border-forest-100 dark:border-forest-800">runPipeline()</code>: Input Guardrails + Hybrid BM25 & Vector Retrieval + Synthesizer + Grounding Checks). Remote STT network latency is measured separately.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function HeadlineStatCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: "p50" | "p95" | "p100";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-center space-y-1 transition-all",
        highlight === "p50" && "border-forest-300 dark:border-forest-700 bg-forest-50/50 dark:bg-forest-950/50",
        highlight === "p95" && "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/50 shadow-xs",
        highlight === "p100" && "border-forest-200 dark:border-forest-800 bg-white dark:bg-[#11231c]",
        !highlight && "border-forest-200/80 dark:border-forest-800/80 bg-white dark:bg-[#11231c]"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-forest-500 dark:text-forest-400">
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-bold text-forest-900 dark:text-forest-50 tabular">
        {value}
      </div>
      <div className="text-[9px] text-forest-400 dark:text-forest-500 truncate">{hint}</div>
    </div>
  );
}

function StageBox({
  label,
  p50,
  p95,
  p100,
  hint,
  highlight = false,
}: {
  label: string;
  p50?: number;
  p95?: number;
  p100?: number;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border space-y-1",
        highlight
          ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/40"
          : "border-forest-200/80 dark:border-forest-800/80 bg-forest-50/30 dark:bg-forest-950/30"
      )}
    >
      <div className="font-bold text-forest-900 dark:text-forest-100 text-xs">{label}</div>
      <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono">
        <div>
          <span className="text-[9px] text-forest-400 dark:text-forest-500 block uppercase">P50</span>
          <span className="font-semibold text-forest-800 dark:text-forest-200 text-[11px] tabular">
            {p50 !== undefined ? `${p50.toFixed(2)}ms` : "—"}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-forest-400 dark:text-forest-500 block uppercase">P95</span>
          <span className="font-semibold text-forest-800 dark:text-forest-200 text-[11px] tabular">
            {p95 !== undefined ? `${p95.toFixed(2)}ms` : "—"}
          </span>
        </div>
        <div>
          <span className="text-[9px] text-forest-400 dark:text-forest-500 block uppercase">P100</span>
          <span className="font-semibold text-forest-800 dark:text-forest-200 text-[11px] tabular">
            {p100 !== undefined ? `${p100.toFixed(2)}ms` : "—"}
          </span>
        </div>
      </div>
      <div className="text-[9px] text-forest-400 dark:text-forest-500 truncate pt-0.5">{hint}</div>
    </div>
  );
}

function LangBox({
  lang,
  stats,
}: {
  lang: string;
  stats?: { count: number; totalStats: LatencyStats };
}) {
  if (!stats || stats.count === 0) return null;
  return (
    <div className="p-2.5 rounded-lg border border-forest-200/80 dark:border-forest-800/80 bg-forest-50/30 dark:bg-forest-950/30 space-y-1">
      <div className="text-xs font-bold text-forest-900 dark:text-forest-100">{lang}</div>
      <div className="text-[10px] text-forest-500 dark:text-forest-400 font-mono">
        n={stats.count} samples
      </div>
      <div className="grid grid-cols-3 gap-0.5 pt-1 border-t border-forest-100 dark:border-forest-800/60 font-mono text-[10px] tabular">
        <div>
          <span className="text-[8px] text-forest-400 dark:text-forest-500 block">P50</span>
          <span className="font-semibold text-forest-800 dark:text-forest-200">
            {stats.totalStats.p50.toFixed(1)}ms
          </span>
        </div>
        <div>
          <span className="text-[8px] text-forest-400 dark:text-forest-500 block">P95</span>
          <span className="font-semibold text-forest-800 dark:text-forest-200">
            {stats.totalStats.p95.toFixed(1)}ms
          </span>
        </div>
        <div>
          <span className="text-[8px] text-forest-400 dark:text-forest-500 block">P100</span>
          <span className="font-semibold text-forest-800 dark:text-forest-200">
            {stats.totalStats.p100.toFixed(1)}ms
          </span>
        </div>
      </div>
    </div>
  );
}
