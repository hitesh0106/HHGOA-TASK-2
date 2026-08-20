/**
 * 4-Strategy Multi-Query Full-Pipeline Latency Benchmark
 * =======================================================
 * Uses the Unified Single-Source Benchmark Engine.
 * Evaluates Fixed, Overlapping, Semantic, and Metadata-Aware chunking.
 */

import { runBenchmarkSuite } from "../src/lib/benchmarks/runner";
import { formatStats } from "../src/lib/benchmarks/stats";

(async () => {
  console.log("\n================================================================================");
  console.log("MULTI-STRATEGY FULL-PIPELINE LATENCY BENCHMARK (UNIFIED ENGINE)");
  console.log("================================================================================");

  const report = await runBenchmarkSuite({
    queryCount: 30, // 30-query multi-strategy evaluation
    strategies: ["fixed", "overlapping", "semantic", "metadata-aware"],
    engine: "fast",
    budgetMs: 50,
    warmupCount: 10,
  });

  console.log(`[Traceability] Benchmark Run ID: ${report.benchmark_run_id}`);
  console.log(`[Traceability] Timestamp:        ${report.timestamp}`);

  for (const res of report.results) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`STRATEGY: ${res.strategy.toUpperCase()} (${res.queryCount} Queries × Full Pipeline)`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`  TOTAL LATENCY      | ${formatStats(res.stageStats.total)}`);
    console.log(`  Retrieval Stage    | ${formatStats(res.stageStats.retrieval)}`);
    console.log(`  Generation Stage   | ${formatStats(res.stageStats.generation)}`);
    console.log(`  Guardrails Stage   | ${formatStats(res.stageStats.guardrails)}`);
    console.log(`  Grounding Rate     | ${res.groundingRate.toFixed(1)}%`);
    console.log(`  Citation Accuracy  | ${res.citationAccuracy.toFixed(1)}%`);
    console.log(`  <50ms SLA Status   | ${res.slaPass ? "✓ PASSED (P95 < 50ms)" : "✗ FAILED"}`);
  }

  console.log("\n================================================================================\n");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
