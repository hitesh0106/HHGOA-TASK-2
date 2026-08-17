/**
 * Hacker House Goa 2026 — Task 2
 * Multilingual Voice RAG Latency & Accuracy Benchmark
 * ====================================================
 * Dataset: MSMARCO-XI (500-doc AI4Bharat Sanskrit/Indic Corpus)
 * Strategy: Overlapping / Fixed / Semantic / Metadata-Aware
 * Budget: 50ms Task 2 SLA
 *
 * Usage:
 *   npx tsx scripts/bench_latency.ts --queries 300 --strategy overlapping
 *   python -m bench.latency --queries 300
 *   npm run bench:latency
 */

import {
  runBenchmarkSuite,
  type BenchmarkConfig,
  type BenchmarkStrategyResult,
} from "../src/lib/benchmarks/runner";
import type { ChunkingStrategy } from "../src/lib/chunking";

// Parse CLI arguments
const args = process.argv.slice(2);
let queryCount = 300;
let budgetMs = 50; // Task 2 SLA: 50ms
let strategy: ChunkingStrategy = "overlapping";
let engine: "fast" | "sarvam" = "fast";
let warmupCount = 20;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--queries" && args[i + 1]) {
    queryCount = parseInt(args[i + 1], 10) || 300;
    i++;
  } else if (args[i] === "--budget" && args[i + 1]) {
    budgetMs = parseFloat(args[i + 1]) || 50;
    i++;
  } else if (args[i] === "--strategy" && args[i + 1]) {
    strategy = args[i + 1] as ChunkingStrategy;
    i++;
  } else if (args[i] === "--engine" && args[i + 1]) {
    engine = args[i + 1] === "sarvam" ? "sarvam" : "fast";
    i++;
  } else if (args[i] === "--warmup" && args[i + 1]) {
    warmupCount = parseInt(args[i + 1], 10) || 20;
    i++;
  }
}

function printStageTable(title: string, result: BenchmarkStrategyResult, count: number, budget: number) {
  const stages = [
    { name: "guardrail", stats: result.stageStats.guardrails },
    { name: "retrieval", stats: result.stageStats.retrieval },
    { name: "generation", stats: result.stageStats.generation },
    { name: "total", stats: result.stageStats.total, isTotal: true },
  ];

  console.log(`\n--- ${title} (n=${count}) ---`);
  console.log(
    `stage`.padEnd(12) +
    `avg`.padStart(8) +
    `p50`.padStart(8) +
    `p70`.padStart(8) +
    `p95`.padStart(8) +
    `p99`.padStart(8) +
    `p100`.padStart(8) +
    `   (ms)`
  );

  for (const s of stages) {
    const line =
      s.name.padEnd(12) +
      s.stats.mean.toFixed(1).padStart(8) +
      s.stats.p50.toFixed(1).padStart(8) +
      s.stats.p70.toFixed(1).padStart(8) +
      s.stats.p95.toFixed(1).padStart(8) +
      s.stats.p99.toFixed(1).padStart(8) +
      s.stats.p100.toFixed(1).padStart(8) +
      (s.isTotal ? "   <-- SLO" : "");
    console.log(line);
  }

  console.log(
    `over budget : ${result.overBudgetCount}/${count} (${result.overBudgetPct.toFixed(1)}%)`
  );
}

async function main() {
  console.log("================================================================================");
  console.log("HACKER HOUSE GOA 2026 — TASK 2 VOICE RAG BENCHMARK");
  console.log("================================================================================");
  console.log(`Dataset  : MSMARCO-XI (500 docs subset)`);
  console.log(`Strategy : ${strategy.toUpperCase()}`);
  console.log(`Engine   : ${engine === "fast" ? "Fast Grounded Synthesizer (<50ms Task 2 SLA)" : "Sarvam Cloud LLM"}`);
  console.log(`Queries  : ${queryCount} (after ${warmupCount} warm-up, discarded)`);
  console.log(`Budget   : ${budgetMs} ms\n`);

  const report = await runBenchmarkSuite({
    queryCount,
    strategy,
    engine,
    budgetMs,
    warmupCount,
  });

  const res = report.results[0];
  if (!res) {
    throw new Error("No benchmark results generated.");
  }

  console.log(`[Traceability] Benchmark Run ID: ${report.benchmark_run_id}`);
  console.log(`[Traceability] Timestamp:        ${report.timestamp}`);

  // Print Language Breakdown
  if (res.languageBreakdown["en"]) {
    console.log(`\n--- English (n=${res.languageBreakdown["en"].count}) ---`);
    console.log(`  P50: ${res.languageBreakdown["en"].totalStats.p50.toFixed(1)}ms | P95: ${res.languageBreakdown["en"].totalStats.p95.toFixed(1)}ms | P100: ${res.languageBreakdown["en"].totalStats.p100.toFixed(1)}ms`);
  }
  if (res.languageBreakdown["hi"]) {
    console.log(`--- Hindi (n=${res.languageBreakdown["hi"].count}) ---`);
    console.log(`  P50: ${res.languageBreakdown["hi"].totalStats.p50.toFixed(1)}ms | P95: ${res.languageBreakdown["hi"].totalStats.p95.toFixed(1)}ms | P100: ${res.languageBreakdown["hi"].totalStats.p100.toFixed(1)}ms`);
  }
  if (res.languageBreakdown["bn"]) {
    console.log(`--- Bengali (n=${res.languageBreakdown["bn"].count}) ---`);
    console.log(`  P50: ${res.languageBreakdown["bn"].totalStats.p50.toFixed(1)}ms | P95: ${res.languageBreakdown["bn"].totalStats.p95.toFixed(1)}ms | P100: ${res.languageBreakdown["bn"].totalStats.p100.toFixed(1)}ms`);
  }

  // Print Complete Stage Table
  printStageTable("ALL", res, queryCount, budgetMs);

  console.log(
    `\noutcomes: { 'Answer': ${res.outcomes.Answer}, 'Abstention': ${res.outcomes.Abstention} }`
  );
  console.log(`grounding_rate     : ${res.groundingRate.toFixed(1)}%`);
  console.log(`citation_accuracy  : ${res.citationAccuracy.toFixed(1)}%`);
  console.log(
    `\nbudget ${budgetMs} ms | p100 ${res.stageStats.total.p100.toFixed(1)} ms | p99 ${res.stageStats.total.p99.toFixed(1)} ms | p95 ${res.stageStats.total.p95.toFixed(1)} ms | p50 ${res.stageStats.total.p50.toFixed(1)} ms`
  );

  if (res.slaPass) {
    console.log(
      `PASS: ${queryCount - res.overBudgetCount}/${queryCount} within budget (${(
        ((queryCount - res.overBudgetCount) / queryCount) *
        100
      ).toFixed(1)}%)\n`
    );
    process.exit(0);
  } else {
    console.log(`FAIL: p95 latency exceeded budget of ${budgetMs}ms\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Benchmark failed:", e);
  process.exit(1);
});
