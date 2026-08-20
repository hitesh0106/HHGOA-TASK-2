/**
 * Benchmark API Endpoint (/api/benchmark)
 * ========================================
 *
 * Single Source of Truth backend route for benchmark execution and inspection.
 *
 * POST: Runs the unified benchmark suite and returns the authoritative UnifiedBenchmarkReport.
 * GET:  Returns the latest persisted benchmark run, or query & strategy metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  runBenchmarkSuite,
  getLatestBenchmarkRun,
  type BenchmarkConfig,
  type UnifiedBenchmarkReport,
} from "@/lib/benchmarks/runner";
import { CANONICAL_300_QUERIES } from "@/lib/benchmarks/queries";
import { getAllLoadedStrategies } from "@/lib/vector-db";
import { CHUNKING_STRATEGIES, type ChunkingStrategy } from "@/lib/chunking";
import { ensureVectorStoresLoaded } from "@/lib/init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  await ensureVectorStoresLoaded();

  try {
    const body = await req.json().catch(() => ({}));
    const loaded = getAllLoadedStrategies();

    if (loaded.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No vector stores loaded. Run vector ingestion first.",
        },
        { status: 503 }
      );
    }

    const requestedStrategies = Array.isArray(body.strategies)
      ? (body.strategies as ChunkingStrategy[])
      : body.strategy
      ? [body.strategy as ChunkingStrategy]
      : CHUNKING_STRATEGIES;

    const strategies = requestedStrategies.filter((s) => loaded.includes(s));
    if (strategies.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No requested strategies are loaded. Loaded: ${loaded.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const queryCount =
      typeof body.queryCount === "number" && body.queryCount > 0
        ? body.queryCount
        : typeof body.queries === "object" && Array.isArray(body.queries)
        ? body.queries.length
        : 300;

    const engine = body.engine === "sarvam" ? "sarvam" : "fast";
    const budgetMs = typeof body.budgetMs === "number" ? body.budgetMs : 50;
    const warmupCount = typeof body.warmupCount === "number" ? body.warmupCount : 20;

    const config: BenchmarkConfig = {
      queryCount,
      strategies,
      engine,
      budgetMs,
      warmupCount,
      topK: body.topK ?? 5,
    };

    const report = await runBenchmarkSuite(config);

    return NextResponse.json({
      ok: true,
      report,
      benchmark_run_id: report.benchmark_run_id,
      timestamp: report.timestamp,
      apiLatencyMs: performance.now() - t0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message, apiLatencyMs: performance.now() - t0 },
      { status: 500 }
    );
  }
}

export async function GET() {
  await ensureVectorStoresLoaded();

  // Try in-memory cached run first
  let latest = getLatestBenchmarkRun();

  // Try reading persisted run from disk if memory is empty
  if (!latest) {
    try {
      const filePath = path.join(process.cwd(), "data", "benchmarks", "latest-benchmark.json");
      const raw = await readFile(filePath, "utf8");
      latest = JSON.parse(raw) as UnifiedBenchmarkReport;
    } catch {
      // Ignore if file doesn't exist yet
    }
  }

  return NextResponse.json({
    ok: true,
    hasLatest: !!latest,
    report: latest ?? null,
    benchmark_run_id: latest?.benchmark_run_id ?? null,
    timestamp: latest?.timestamp ?? null,
    totalCanonicalQueries: CANONICAL_300_QUERIES.length,
    strategies: CHUNKING_STRATEGIES,
    loadedStrategies: getAllLoadedStrategies(),
  });
}
