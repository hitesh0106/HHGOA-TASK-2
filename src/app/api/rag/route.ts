/**
 * POST /api/rag
 * Main RAG endpoint. Accepts a text query and returns the full pipeline
 * response: answer, sources, guardrail decisions, latency breakdown.
 *
 * Body: {
 *   query: string,
 *   strategy?: "fixed" | "overlapping" | "semantic" | "metadata-aware",
 *   topK?: number,
 *   minScore?: number,
 *   maxContextTokens?: number,
 *   useLlmJudge?: boolean
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { getAllLoadedStrategies } from "@/lib/vector-db";
import { CHUNKING_STRATEGIES } from "@/lib/chunking";
import { ensureVectorStoresLoaded } from "@/lib/init";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  // Ensure vector stores are loaded (idempotent)
  await ensureVectorStoresLoaded();
  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const strategy =
      typeof body.strategy === "string" && CHUNKING_STRATEGIES.includes(body.strategy)
        ? body.strategy
        : (process.env.DEFAULT_CHUNKING_STRATEGY ?? "overlapping");

    if (!query) {
      return NextResponse.json(
        { ok: false, error: "Missing 'query' field." },
        { status: 400 }
      );
    }

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
    if (!loaded.includes(strategy)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Strategy "${strategy}" is not loaded. Available: ${loaded.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const engine = body.engine === "sarvam" ? "sarvam" : "fast";
    const language = typeof body.language === "string" ? body.language : undefined;

    const result = await runPipeline({
      query,
      strategy,
      engine,
      language,
      topK: body.topK,
      minScore: body.minScore,
      maxContextTokens: body.maxContextTokens,
      useLlmJudge: body.useLlmJudge === true,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      apiLatencyMs: performance.now() - t0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        apiLatencyMs: performance.now() - t0,
      },
      { status: 500 }
    );
  }
}
