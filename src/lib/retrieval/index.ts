/**
 * Retrieval Layer
 * ===============
 *
 * Provides:
 *   • `retrieve()` - top-K vector search with retrieval validation
 *   • `buildContext()` - flatten retrieved chunks into a single context string
 *     with citation markers, capped to a max token budget
 *   • `validateRetrieval()` - heuristic checks on retrieval quality
 *
 * The actual vector search is delegated to the VectorStore class. This module
 * adds orchestration, validation, and context formatting.
 */

import { getVectorStore, type ChunkRecord, type ScoredChunk, type RetrievalStats } from "../vector-db";
import * as embeddings from "../embeddings";
import {
  checkRetrievalSufficiency,
  type RetrievalContext,
  type GuardrailDecision,
} from "../guardrails";

export interface RetrievalRequest {
  query: string;
  strategy: string;
  topK?: number;
  minScore?: number;
  maxContextTokens?: number;
}

export interface RetrievalResult {
  query: string;
  strategy: string;
  scoredChunks: ScoredChunk[];
  context: string;
  contextTokenCount: number;
  stats: RetrievalStats;
  embeddingLatencyMs: number;
  searchLatencyMs: number;
  totalLatencyMs: number;
  guardrail: GuardrailDecision;
  retrievalContext: RetrievalContext;
}

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.05;
const DEFAULT_MAX_CONTEXT_TOKENS = 2048;

/**
 * Run a single retrieval pass. Latency is split into:
 *   • embeddingLatencyMs  - query embedding time
 *   • searchLatencyMs     - vector store search time (also reported by VectorStore)
 *   • totalLatencyMs      - end-to-end
 */
export function retrieve(req: RetrievalRequest): RetrievalResult {
  const t0 = performance.now();
  const topK = req.topK ?? DEFAULT_TOP_K;
  const minScore = req.minScore ?? DEFAULT_MIN_SCORE;
  const maxCtxTokens = req.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS;

  const store = getVectorStore(req.strategy);
  if (!store.isLoaded) {
    throw new Error(
      `Vector store for strategy "${req.strategy}" is not loaded. Run the ingestion script first.`
    );
  }

  const tEmb0 = performance.now();
  const _qSparse = embeddings.sparseEmbedding(req.query);
  const embeddingLatencyMs = performance.now() - tEmb0;

  const { results, stats } = store.search(req.query, topK, minScore, embeddings);

  // Build retrieval context object for guardrails
  const topScore = results.length > 0 ? results[0].score : 0;
  const meanScore =
    results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const retrievalContext: RetrievalContext = {
    chunks: results.map((r) => ({ chunk: r.chunk, score: r.score })),
    topScore,
    meanScore,
  };

  // Retrieval sufficiency guardrail
  const guardrail = checkRetrievalSufficiency(retrievalContext, {
    minTopScore: minScore + 0.05,
    minMeanScore: 0.04,
    minChunks: 1,
  });

  // Build context string with citation markers
  const { context, tokenCount } = buildContext(results, maxCtxTokens);

  const totalLatencyMs = performance.now() - t0;
  return {
    query: req.query,
    strategy: req.strategy,
    scoredChunks: results,
    context,
    contextTokenCount: tokenCount,
    stats,
    embeddingLatencyMs,
    searchLatencyMs: stats.latencyMs,
    totalLatencyMs,
    guardrail,
    retrievalContext,
  };
}

/**
 * Flatten retrieved chunks into a single context string with [C1], [C2], ...
 * citation markers. Caps the total token count (rough estimate: 1 token ≈ 4 chars).
 */
export function buildContext(
  chunks: ScoredChunk[],
  maxTokens: number
): { context: string; tokenCount: number } {
  const parts: string[] = [];
  let totalChars = 0;
  const maxChars = maxTokens * 4;
  let used = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const cite = `[C${i + 1}]`;
    const text = c.chunk.text;
    if (totalChars + text.length + cite.length + 2 > maxChars) {
      // Truncate this chunk to fit
      const remaining = Math.max(0, maxChars - totalChars - cite.length - 4);
      if (remaining < 40) break;
      parts.push(`${cite} ${text.slice(0, remaining)}…`);
      totalChars += remaining + cite.length + 4;
      used++;
      break;
    }
    parts.push(`${cite} ${text}`);
    totalChars += text.length + cite.length + 2;
    used++;
  }
  const context = parts.join("\n\n");
  const tokenCount = Math.ceil(context.length / 4);
  return { context, tokenCount };
}

/**
 * Heuristic validation that retrieval produced usable context.
 * Returns a list of warnings (empty if all checks pass).
 */
export function validateRetrieval(result: RetrievalResult): string[] {
  const warnings: string[] = [];
  if (result.scoredChunks.length === 0) {
    warnings.push("No chunks retrieved.");
  }
  if (result.scoredChunks.length > 0 && result.scoredChunks[0].score < 0.1) {
    warnings.push(`Top score ${result.scoredChunks[0].score.toFixed(3)} is low; answer may not be grounded.`);
  }
  if (result.contextTokenCount < 50) {
    warnings.push(`Context is very short (${result.contextTokenCount} tokens).`);
  }
  // Check for exact-duplicate chunks (often a sign of bad chunking)
  const texts = new Set<string>();
  let dupCount = 0;
  for (const r of result.scoredChunks) {
    if (texts.has(r.chunk.text)) dupCount++;
    else texts.add(r.chunk.text);
  }
  if (dupCount > 0) warnings.push(`${dupCount} duplicate chunks in top-K.`);
  return warnings;
}
