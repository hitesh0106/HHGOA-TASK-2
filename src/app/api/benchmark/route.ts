/**
 * POST /api/benchmark
 * Runs the benchmark suite. Returns a BenchmarkReport with P50/P70/P100
 * latency stats for each chunking strategy.
 *
 * Body: {
 *   queries?: string[],
 *   strategies?: ("fixed"|"overlapping"|"semantic"|"metadata-aware")[],
 *   includeFullPipeline?: boolean,
 *   fullPipelineQueryCount?: number
 * }
 *
 * The retrieval-only benchmark is fast (<10s for 30 queries × 4 strategies).
 * The full-pipeline benchmark calls the LLM and can take minutes.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateBenchmarkReport } from "@/lib/benchmarks/runner";
import { getAllLoadedStrategies } from "@/lib/vector-db";
import { CHUNKING_STRATEGIES, type ChunkingStrategy } from "@/lib/chunking";
import { ensureVectorStoresLoaded } from "@/lib/init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  // Ensure vector stores are loaded (idempotent)
  await ensureVectorStoresLoaded();
  try {
    const body = await req.json().catch(() => ({}));
    const loaded = getAllLoadedStrategies();
    if (loaded.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No vector stores loaded. Run `python scripts/ingest_msmarco.py` first.",
        },
        { status: 503 }
      );
    }
    const requestedStrategies = Array.isArray(body.strategies)
      ? (body.strategies as ChunkingStrategy[])
      : CHUNKING_STRATEGIES;
    const strategies = requestedStrategies.filter((s) => loaded.includes(s));
    if (strategies.length === 0) {
      return NextResponse.json(
        { ok: false, error: `No requested strategies are loaded. Loaded: ${loaded.join(", ")}` },
        { status: 400 }
      );
    }

    const engine = body.engine === "sarvam" ? "sarvam" : "fast";

    const report = await generateBenchmarkReport({
      queries: Array.isArray(body.queries) ? body.queries : undefined,
      strategies,
      includeFullPipeline: body.includeFullPipeline !== false,
      fullPipelineQueryCount: body.fullPipelineQueryCount ?? undefined,
      engine,
    });

    return NextResponse.json({
      ok: true,
      report,
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

/**
 * GET /api/benchmark
 * Returns the default benchmark query set + strategies so the UI can
 * preview them without running anything.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    queries: (await import("@/lib/benchmarks/runner")).DEFAULT_BENCHMARK_QUERIES,
    strategies: CHUNKING_STRATEGIES,
    loadedStrategies: getAllLoadedStrategies(),
  });
}
