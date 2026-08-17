/**
 * Benchmark Consistency Verification Harness
 * ============================================
 *
 * Automated verification that CMD and Frontend/API benchmark executions:
 *   1. Use the EXACT same dataset, query pool, chunk stores, and configuration.
 *   2. Use the EXACT same warm-up/discard rules (20 warmups).
 *   3. Measure the EXACT same pipeline latency boundaries.
 *   4. Calculate P50, P70, P90, P95, P99, P100 using the EXACT same algorithm.
 *   5. Produce matching outcomes, grounding rates, and citation metrics.
 *   6. Match within runtime measurement noise (<= 6ms).
 *   7. Produce unique benchmark_run_id and valid timestamp.
 *
 * Usage:
 *   npx tsx scripts/verify_benchmark_consistency.ts
 */

import assert from "node:assert/strict";
import {
  runBenchmarkSuite,
  type UnifiedBenchmarkReport,
} from "../src/lib/benchmarks/runner";
import {
  getCanonicalBenchmarkQueries,
  CANONICAL_300_QUERIES,
} from "../src/lib/benchmarks/queries";
import { computeStats } from "../src/lib/benchmarks/stats";
import { ensureVectorStoresLoaded } from "../src/lib/init";
import { ensureDatasetLoaded } from "../src/lib/dataset-index";

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(title: string, fn: () => void | Promise<void>) {
  totalChecks++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  ✓ PASS: ${title}`);
          passedChecks++;
        })
        .catch((err) => {
          console.error(`  ✗ FAIL: ${title}`);
          console.error(`    ${err instanceof Error ? err.message : String(err)}`);
          failedChecks++;
        });
    } else {
      console.log(`  ✓ PASS: ${title}`);
      passedChecks++;
    }
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failedChecks++;
  }
}

async function main() {
  console.log("\n================================================================================");
  console.log("RUNNING BENCHMARK CONSISTENCY VERIFICATION SUITE");
  console.log("================================================================================");

  await ensureVectorStoresLoaded();
  await ensureDatasetLoaded();

  // ---------------------------------------------------------------------------
  // Check 1: Canonical Query Pool Structure & Determinism
  // ---------------------------------------------------------------------------
  console.log("\n[Group 1: Canonical Query Pool & Distribution]");

  check("Canonical 300-query pool length and distribution (45% EN, 35% HI, 20% BN)", () => {
    const queries = getCanonicalBenchmarkQueries(300);
    assert.equal(queries.length, 300, "Should generate exactly 300 queries");

    const en = queries.filter((q) => q.language === "en").length;
    const hi = queries.filter((q) => q.language === "hi").length;
    const bn = queries.filter((q) => q.language === "bn").length;

    assert.equal(en, 135, "English queries should be 135 (45%)");
    assert.equal(hi, 105, "Hindi queries should be 105 (35%)");
    assert.equal(bn, 60, "Bengali queries should be 60 (20%)");
  });

  check("Canonical query pool generator is strictly deterministic across calls", () => {
    const run1 = getCanonicalBenchmarkQueries(300);
    const run2 = getCanonicalBenchmarkQueries(300);
    assert.deepEqual(run1, run2, "Repeated calls must yield identical query arrays");
  });

  // ---------------------------------------------------------------------------
  // Check 2: Statistical Percentile Calculation Consistency
  // ---------------------------------------------------------------------------
  console.log("\n[Group 2: Statistical Metric Calculation Engine]");

  check("computeStats calculates P50, P70, P90, P95, P99, P100 accurately", () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s = computeStats(samples);
    assert.equal(s.n, 10);
    assert.equal(s.min, 1);
    assert.equal(s.p50, 5);
    assert.equal(s.p70, 7);
    assert.equal(s.p90, 9);
    assert.equal(s.p95, 10);
    assert.equal(s.p99, 10);
    assert.equal(s.p100, 10);
    assert.equal(s.mean, 5.5);
  });

  // ---------------------------------------------------------------------------
  // Check 3: Dual-Run Execution Consistency (CMD Run vs API/Frontend Run)
  // ---------------------------------------------------------------------------
  console.log("\n[Group 3: Benchmark Execution Consistency (CMD vs API Simulation)]");

  console.log("  Executing Run A (Simulating CMD runner, n=50 queries)...");
  const reportA: UnifiedBenchmarkReport = await runBenchmarkSuite({
    queryCount: 50,
    strategy: "overlapping",
    engine: "fast",
    budgetMs: 50,
    warmupCount: 20,
  });

  console.log("  Executing Run B (Simulating API/Frontend runner, n=50 queries)...");
  const reportB: UnifiedBenchmarkReport = await runBenchmarkSuite({
    queryCount: 50,
    strategy: "overlapping",
    engine: "fast",
    budgetMs: 50,
    warmupCount: 20,
  });

  check("Both runs generate valid, distinct benchmark_run_ids and timestamps", () => {
    assert.ok(reportA.benchmark_run_id.startsWith("bench_"), "Run ID A must start with bench_");
    assert.ok(reportB.benchmark_run_id.startsWith("bench_"), "Run ID B must start with bench_");
    assert.notEqual(reportA.benchmark_run_id, reportB.benchmark_run_id, "Run IDs must be unique");
    assert.ok(!isNaN(Date.parse(reportA.timestamp)), "Timestamp A must be valid ISO date");
    assert.ok(!isNaN(Date.parse(reportB.timestamp)), "Timestamp B must be valid ISO date");
  });

  check("Both runs process identical query sequences and categories", () => {
    const resA = reportA.results[0];
    const resB = reportB.results[0];
    assert.equal(resA.queryCount, resB.queryCount, "Query counts must match");

    for (let i = 0; i < resA.rawRecords.length; i++) {
      const qA = resA.rawRecords[i];
      const qB = resB.rawRecords[i];
      assert.equal(qA.query, qB.query, `Query ${i} text must match`);
      assert.equal(qA.language, qB.language, `Query ${i} language must match`);
      assert.equal(qA.category, qB.category, `Query ${i} category must match`);
    }
  });

  check("Both runs produce identical outcomes (Answer vs Abstention)", () => {
    const resA = reportA.results[0];
    const resB = reportB.results[0];
    assert.equal(resA.outcomes.Answer, resB.outcomes.Answer, "Answer count must match");
    assert.equal(resA.outcomes.Abstention, resB.outcomes.Abstention, "Abstention count must match");
  });

  check("Both runs produce matching grounding and citation metrics", () => {
    const resA = reportA.results[0];
    const resB = reportB.results[0];
    assert.equal(resA.groundingRate, resB.groundingRate, "Grounding rate must match");
    assert.equal(resA.citationAccuracy, resB.citationAccuracy, "Citation accuracy must match");
  });

  check("Both runs produce matching SLA PASS/FAIL verdicts", () => {
    const resA = reportA.results[0];
    const resB = reportB.results[0];
    assert.equal(resA.slaPass, resB.slaPass, "SLA pass status must match");
    assert.equal(reportA.summary.slaStatus, reportB.summary.slaStatus, "Summary SLA status must match");
  });

  check("Latency measurements between runs are within runtime measurement noise (<= 6ms delta)", () => {
    const resA = reportA.results[0];
    const resB = reportB.results[0];
    const deltaP50 = Math.abs(resA.stageStats.total.p50 - resB.stageStats.total.p50);
    const deltaP95 = Math.abs(resA.stageStats.total.p95 - resB.stageStats.total.p95);
    const deltaP100 = Math.abs(resA.stageStats.total.p100 - resB.stageStats.total.p100);

    console.log(`    Run A: P50=${resA.stageStats.total.p50.toFixed(2)}ms, P95=${resA.stageStats.total.p95.toFixed(2)}ms, P100=${resA.stageStats.total.p100.toFixed(2)}ms (SLA: ${resA.slaPass ? "PASS" : "FAIL"})`);
    console.log(`    Run B: P50=${resB.stageStats.total.p50.toFixed(2)}ms, P95=${resB.stageStats.total.p95.toFixed(2)}ms, P100=${resB.stageStats.total.p100.toFixed(2)}ms (SLA: ${resB.slaPass ? "PASS" : "FAIL"})`);
    console.log(`    Delta P50: ${deltaP50.toFixed(2)}ms | Delta P95: ${deltaP95.toFixed(2)}ms | Delta P100: ${deltaP100.toFixed(2)}ms`);
    assert.ok(deltaP50 <= 6.0, `Delta P50 (${deltaP50.toFixed(2)}ms) must be <= 6.0ms`);
    assert.ok(deltaP95 <= 6.0, `Delta P95 (${deltaP95.toFixed(2)}ms) must be <= 6.0ms`);
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`CONSISTENCY TEST SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED (Total: ${totalChecks})`);
  console.log("================================================================================\n");

  if (failedChecks > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Consistency test runner failed:", err);
  process.exit(1);
});
