import { runBenchmarkSuite } from "../src/lib/benchmarks/runner";
import { formatStats } from "../src/lib/benchmarks/stats";

(async () => {
  console.log("================================================================================");
  console.log("RUNNING 4-STRATEGY 300-QUERY BENCHMARK (FRESH LIVE MEASUREMENT)");
  console.log("================================================================================");

  const report = await runBenchmarkSuite({
    queryCount: 300,
    strategies: ["fixed", "overlapping", "semantic", "metadata-aware"],
    engine: "fast",
    budgetMs: 50,
    warmupCount: 20,
  });

  console.log(`\nRun ID: ${report.benchmark_run_id}`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`SLA Status: ${report.summary.slaStatus}`);

  for (const r of report.results) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`STRATEGY: ${r.strategy.toUpperCase()}`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`  Queries:            ${r.queryCount}`);
    console.log(`  P50:                ${r.stageStats.total.p50.toFixed(2)} ms`);
    console.log(`  P70:                ${r.stageStats.total.p70.toFixed(2)} ms`);
    console.log(`  P90:                ${r.stageStats.total.p90.toFixed(2)} ms`);
    console.log(`  P95:                ${r.stageStats.total.p95.toFixed(2)} ms`);
    console.log(`  P99:                ${r.stageStats.total.p99.toFixed(2)} ms`);
    console.log(`  P100 (Max):         ${r.stageStats.total.p100.toFixed(2)} ms`);
    console.log(`  Min:                ${r.stageStats.total.min.toFixed(2)} ms`);
    console.log(`  Mean:               ${r.stageStats.total.mean.toFixed(2)} ms`);
    console.log(`  StdDev:             ${r.stageStats.total.stddev.toFixed(2)} ms`);
    console.log(`  Retrieval (P50):    ${r.stageStats.retrieval.p50.toFixed(2)} ms (P95: ${r.stageStats.retrieval.p95.toFixed(2)} ms)`);
    console.log(`  Generation (P50):   ${r.stageStats.generation.p50.toFixed(2)} ms (P95: ${r.stageStats.generation.p95.toFixed(2)} ms)`);
    console.log(`  Guardrails (P50):   ${r.stageStats.guardrails.p50.toFixed(2)} ms (P95: ${r.stageStats.guardrails.p95.toFixed(2)} ms)`);
    console.log(`  Outcomes:           Answer: ${r.outcomes.Answer}, Abstention: ${r.outcomes.Abstention}`);
    console.log(`  Grounding Rate:     ${r.groundingRate.toFixed(1)}%`);
    console.log(`  Citation Accuracy:  ${r.citationAccuracy.toFixed(1)}%`);
    console.log(`  SLA (<50ms):        ${r.slaPass ? "PASS" : "FAIL"} (Over budget: ${r.overBudgetCount}/${r.queryCount})`);
  }

  console.log("\n================================================================================\n");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
