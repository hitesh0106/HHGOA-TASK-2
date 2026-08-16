/**
 * Benchmark Runner
 * ================
 *
 * Runs a set of test queries against the RAG pipeline and reports per-stage
 * latency statistics: STT, retrieval (embed + search), generation, total.
 *
 * Two modes:
 *   • `benchmarkRetrieval()`   - measures ONLY the retrieval stage (the part
 *                                 the task targets for <50ms). Skips the LLM
 *                                 so we can run hundreds of queries quickly.
 *   • `benchmarkFullPipeline()` - runs the full pipeline (retrieval + LLM).
 *                                 Much slower (LLM calls dominate).
 *
 * Both modes return a `BenchmarkReport` that includes P50/P70/P100 etc. for
 * each stage, plus a per-strategy comparison.
 */

import { retrieve, type RetrievalResult } from "../retrieval";
import { getVectorStore } from "../vector-db";
import { runPipeline } from "../pipeline";
import { computeStats, type LatencyStats } from "./stats";
import { CHUNKING_STRATEGIES, type ChunkingStrategy } from "../chunking";

// ---------------------------------------------------------------------------
// Test queries - drawn from the kinds of questions MSMARCO is built for.
// The first group is corpus-aligned (extracted from MSMARCO-XI sample queries);
// the second group is general-knowledge questions that the system should
// REFUSE to answer (since they're not in our 500-doc subset) - this tests
// the guardrails.
// ---------------------------------------------------------------------------
export const DEFAULT_BENCHMARK_QUERIES: string[] = [
  // Corpus-aligned queries (extracted from MSMARCO-XI sample)
  "what is a corporation",
  "why did rachel carson write an obligation to endure",
  "what is the definition of a corporation",
  "how does a corporation work",
  "what are the harmful uses of chemicals according to rachel carson",
  // General-knowledge queries (should be refused if not in corpus)
  "what is the capital of france",
  "how does photosynthesis work",
  "who wrote the declaration of independence",
  "what are the symptoms of diabetes",
  "explain how a transformer neural network works",
  "what is the boiling point of water",
  "how many planets are in the solar system",
  "what is the speed of light",
  "when did world war 2 end",
  "what is the tallest mountain in the world",
  "how do vaccines work",
  "what causes climate change",
  "who painted the mona lisa",
  "what is the largest ocean on earth",
  "how does the immune system work",
  "what is quantum entanglement",
  "describe the water cycle",
  "what is the population of india",
  "how do earthquakes happen",
  "what is the function of the mitochondria",
  "who invented the telephone",
  "what is the distance from earth to the moon",
  "how does gravity work",
  "what is the chemical formula for water",
  "what are the benefits of exercise",
  "describe the process of cellular respiration",
];

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------
export interface StrategyBenchmarkResult {
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

export interface FullPipelineResult {
  strategy: string;
  totalStats: LatencyStats;
  retrievalStats: LatencyStats;
  generationStats: LatencyStats;
  inputGuardrailStats: LatencyStats;
  outputGuardrailStats: LatencyStats;
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

export interface BenchmarkReport {
  generatedAt: string;
  queries: string[];
  retrievalOnly: StrategyBenchmarkResult[];
  fullPipeline?: FullPipelineResult[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Retrieval-only benchmark
// ---------------------------------------------------------------------------
export function benchmarkRetrieval(
  queries: string[] = DEFAULT_BENCHMARK_QUERIES,
  strategies: ChunkingStrategy[] = CHUNKING_STRATEGIES,
  topK = 5,
  minScore = 0.05
): StrategyBenchmarkResult[] {
  const out: StrategyBenchmarkResult[] = [];
  for (const strategy of strategies) {
    const store = getVectorStore(strategy);
    if (!store.isLoaded) {
      throw new Error(`vector store "${strategy}" not loaded`);
    }
    const perQuery: StrategyBenchmarkResult["perQuery"] = [];
    for (const query of queries) {
      const r: RetrievalResult = retrieve({ query, strategy, topK, minScore });
      perQuery.push({
        query,
        embeddingMs: r.embeddingLatencyMs,
        searchMs: r.searchLatencyMs,
        totalRetrievalMs: r.totalLatencyMs,
        topScore: r.scoredChunks.length > 0 ? r.scoredChunks[0].score : 0,
        chunksRetrieved: r.scoredChunks.length,
      });
    }
    out.push({
      strategy,
      chunkCount: store.size,
      retrievalStats: computeStats(perQuery.map((q) => q.totalRetrievalMs)),
      embeddingStats: computeStats(perQuery.map((q) => q.embeddingMs)),
      searchStats: computeStats(perQuery.map((q) => q.searchMs)),
      topScoreStats: computeStats(perQuery.map((q) => q.topScore)),
      perQuery,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Full-pipeline benchmark
// ---------------------------------------------------------------------------
export async function benchmarkFullPipeline(
  queries: string[] = DEFAULT_BENCHMARK_QUERIES,
  strategies: ChunkingStrategy[] = CHUNKING_STRATEGIES,
  topK = 5,
  engine: "fast" | "sarvam" = "fast"
): Promise<FullPipelineResult[]> {
  const out: FullPipelineResult[] = [];
  for (const strategy of strategies) {
    const store = getVectorStore(strategy);
    if (!store.isLoaded) {
      throw new Error(`vector store "${strategy}" not loaded`);
    }
    const perQuery: FullPipelineResult["perQuery"] = [];
    const inputGuardrailMsList: number[] = [];
    const outputGuardrailMsList: number[] = [];
    let blockedCount = 0;
    let refusedCount = 0;
    let groundedCount = 0;
    for (const query of queries) {
      const res = await runPipeline({ query, strategy, topK, engine, useLlmJudge: false });
      perQuery.push({
        query,
        totalMs: res.timings.totalMs,
        retrievalMs: res.timings.retrievalMs,
        generationMs: res.timings.generationMs,
        blocked: res.blocked,
        confidence: res.confidence,
        grounded: res.grounded,
      });
      inputGuardrailMsList.push(res.timings.inputGuardrailsMs);
      outputGuardrailMsList.push(res.timings.outputGuardrailsMs);
      if (res.blocked) blockedCount++;
      if (res.confidence === "refused") refusedCount++;
      if (res.grounded) groundedCount++;
    }
    out.push({
      strategy,
      totalStats: computeStats(perQuery.map((q) => q.totalMs)),
      retrievalStats: computeStats(perQuery.map((q) => q.retrievalMs)),
      generationStats: computeStats(perQuery.map((q) => q.generationMs)),
      inputGuardrailStats: computeStats(inputGuardrailMsList),
      outputGuardrailStats: computeStats(outputGuardrailMsList),
      blockedCount,
      refusedCount,
      groundedCount,
      perQuery,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Generate a full report (retrieval-only + fast full-pipeline)
// ---------------------------------------------------------------------------
export async function generateBenchmarkReport(opts: {
  queries?: string[];
  strategies?: ChunkingStrategy[];
  includeFullPipeline?: boolean;
  fullPipelineQueryCount?: number;
  engine?: "fast" | "sarvam";
} = {}): Promise<BenchmarkReport> {
  const queries = opts.queries ?? DEFAULT_BENCHMARK_QUERIES;
  const strategies = opts.strategies ?? CHUNKING_STRATEGIES;
  const engine = opts.engine ?? "fast";
  const notes: string[] = [];

  const retrievalOnly = benchmarkRetrieval(queries, strategies);
  notes.push(
    `Retrieval benchmark ran ${queries.length} queries × ${strategies.length} strategies = ${
      queries.length * strategies.length
    } measurements.`
  );

  let fullPipeline: FullPipelineResult[] | undefined;
  if (opts.includeFullPipeline !== false) {
    const fpQueries = queries.slice(0, opts.fullPipelineQueryCount ?? queries.length);
    fullPipeline = await benchmarkFullPipeline(fpQueries, strategies, 5, engine);
    notes.push(
      `Full-pipeline benchmark ran ${fpQueries.length} queries × ${strategies.length} strategies using "${engine}" engine.`
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    queries,
    retrievalOnly,
    fullPipeline,
    notes,
  };
}
