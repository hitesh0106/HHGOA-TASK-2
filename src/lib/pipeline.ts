/**
 * RAG Pipeline
 * ============
 *
 * Orchestrates the full Voice RAG flow:
 *
 *   query (already STT-transcribed)
 *     → input guardrails (off-topic, unsafe)
 *     → retrieval (query embedding → vector search → top-K)
 *     → retrieval guardrails (sufficient context?)
 *     → LLM harness (grounded answer generation)
 *     → hallucination guardrails (LLM judge + lexical overlap)
 *     → unsupported-answer guardrails (refusal validation)
 *     → final response with full latency breakdown
 *
 * Every stage is instrumented. If any guardrail returns 'block', the pipeline
 * short-circuits and returns the block reason instead of calling the LLM.
 */

import { retrieve, validateRetrieval, type RetrievalResult } from "./retrieval";
import {
  checkHallucinationLlm,
  checkHallucinationLexical,
  checkInputSafety,
  checkOffTopic,
  checkUnsupportedAnswer,
  combineDecisions,
  type CombinedGuardrailVerdict,
  type GuardrailDecision,
} from "./guardrails";
import { runHarness, type HarnessOutput } from "./llm/harness";

// ---------------------------------------------------------------------------
// Pipeline input / output
// ---------------------------------------------------------------------------
export interface PipelineRequest {
  query: string;
  strategy: string;
  engine?: "fast" | "sarvam"; // default "fast"
  topK?: number;
  minScore?: number;
  maxContextTokens?: number;
  useLlmJudge?: boolean; // default false (lexical check is faster)
  /** Skip STT (already transcribed) - this is the typical path */
  skipStt?: boolean;
}

export interface PipelineStageTimings {
  inputGuardrailsMs: number;
  retrievalMs: number;
  retrievalGuardrailsMs: number;
  generationMs: number;
  outputGuardrailsMs: number;
  totalMs: number;
}

export interface PipelineResponse {
  query: string;
  strategy: string;
  engine: "fast" | "sarvam";
  answer: string;
  confidence: HarnessOutput["confidence"];
  grounded: boolean;
  citations: number[];
  sources: RetrievalResult["scoredChunks"];
  contextPreview: string;
  contextTokenCount: number;
  retrievalStats: RetrievalResult["stats"];
  retrievalWarnings: string[];
  guardrails: {
    input: GuardrailDecision[];
    output: GuardrailDecision[];
    combined: CombinedGuardrailVerdict;
  };
  harness: {
    attempts: number;
    finishReason: string | null;
    warnings: string[];
  };
  timings: PipelineStageTimings;
  blocked: boolean;
  blockReasons: string[];
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
export async function runPipeline(req: PipelineRequest): Promise<PipelineResponse> {
  const tStart = performance.now();
  const query = req.query.trim();
  const strategy = req.strategy;
  const engine = req.engine ?? "fast";

  // -----------------------------------------------------------------------
  // Stage 1: input guardrails
  // -----------------------------------------------------------------------
  const tInput0 = performance.now();
  const inputSafety = checkInputSafety(query);
  const inputOffTopic = checkOffTopic(query);
  const inputGuardrails = [inputSafety, inputOffTopic];
  const inputVerdict = combineDecisions(inputGuardrails);
  const inputGuardrailsMs = performance.now() - tInput0;

  if (inputVerdict.block) {
    return buildBlockedResponse({
      query,
      strategy,
      engine,
      blockReasons: inputVerdict.reasons,
      inputGuardrails,
      inputGuardrailsMs,
      totalMs: performance.now() - tStart,
    });
  }

  // -----------------------------------------------------------------------
  // Stage 2: retrieval
  // -----------------------------------------------------------------------
  let retrieval: RetrievalResult;
  try {
    retrieval = retrieve({
      query,
      strategy,
      topK: req.topK,
      minScore: req.minScore,
      maxContextTokens: req.maxContextTokens,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return buildBlockedResponse({
      query,
      strategy,
      blockReasons: [`[retrieval] ${msg}`],
      inputGuardrails,
      inputGuardrailsMs,
      totalMs: performance.now() - tStart,
    });
  }
  const retrievalWarnings = validateRetrieval(retrieval);
  const retrievalMs = retrieval.totalLatencyMs;

  // -----------------------------------------------------------------------
  // Stage 3: retrieval guardrails
  // -----------------------------------------------------------------------
  const tRetG0 = performance.now();
  const retrievalGuardrail = retrieval.guardrail;
  const retrievalGuardrailsMs = performance.now() - tRetG0;

  if (retrievalGuardrail.severity === "block") {
    return buildBlockedResponse({
      query,
      strategy,
      blockReasons: [retrievalGuardrail.reason],
      inputGuardrails,
      inputGuardrailsMs,
      retrieval,
      retrievalMs,
      retrievalGuardrailsMs,
      retrievalWarnings,
      totalMs: performance.now() - tStart,
    });
  }

  // -----------------------------------------------------------------------
  // Stage 4: LLM harness
  // -----------------------------------------------------------------------
  const harness = await runHarness({
    query,
    context: retrieval.context,
    contextChunks: retrieval.scoredChunks,
    strategy,
    engine,
    temperature: 0.2,
    maxTokens: 512,
    timeoutMs: 12_000,
    maxRetries: 1,
  });
  const generationMs = harness.latencyMs;

  // -----------------------------------------------------------------------
  // Stage 5: output guardrails (hallucination + unsupported-answer)
  // -----------------------------------------------------------------------
  const tOutG0 = performance.now();
  const outputDecisions: GuardrailDecision[] = [];

  // Always run lexical hallucination check (fast, <1ms)
  outputDecisions.push(
    checkHallucinationLexical(query, retrieval.context, harness.answer, { minOverlap: 0.4 })
  );

  // Optionally run LLM judge (slower, ~1-3s)
  if (req.useLlmJudge) {
    const llmJudge = await checkHallucinationLlm(query, retrieval.context, harness.answer, {
      timeoutMs: 8_000,
      maxRetries: 1,
    });
    outputDecisions.push(llmJudge);
  }

  // Unsupported-answer / refusal validation
  outputDecisions.push(
    checkUnsupportedAnswer(harness.answer, retrievalGuardrail.pass)
  );

  const outputVerdict = combineDecisions(outputDecisions);
  const outputGuardrailsMs = performance.now() - tOutG0;

  const combined = combineDecisions([...inputGuardrails, retrievalGuardrail, ...outputDecisions]);

  // -----------------------------------------------------------------------
  // Compose final response
  // -----------------------------------------------------------------------
  const totalMs = performance.now() - tStart;
  const blocked = outputVerdict.block;
  const ok = !blocked;

  // If output guardrails block, override the answer with a refusal
  const finalAnswer = blocked
    ? "I cannot provide this answer because it failed grounding validation."
    : harness.answer;

  return {
    query,
    strategy,
    engine,
    answer: finalAnswer,
    confidence: blocked ? "refused" : harness.confidence,
    grounded: blocked ? false : harness.grounded,
    citations: blocked ? [] : harness.citations,
    sources: retrieval.scoredChunks,
    contextPreview: retrieval.context.slice(0, 800) + (retrieval.context.length > 800 ? "…" : ""),
    contextTokenCount: retrieval.contextTokenCount,
    retrievalStats: retrieval.stats,
    retrievalWarnings,
    guardrails: {
      input: inputGuardrails,
      output: outputDecisions,
      combined,
    },
    harness: {
      attempts: harness.attempts,
      finishReason: harness.finishReason,
      warnings: harness.warnings,
    },
    timings: {
      inputGuardrailsMs,
      retrievalMs,
      retrievalGuardrailsMs,
      generationMs,
      outputGuardrailsMs,
      totalMs,
    },
    blocked,
    blockReasons: blocked ? outputVerdict.reasons : [],
    ok,
  };
}

// ---------------------------------------------------------------------------
// Blocked-response builder
// ---------------------------------------------------------------------------
function buildBlockedResponse(args: {
  query: string;
  strategy: string;
  engine?: "fast" | "sarvam";
  blockReasons: string[];
  inputGuardrails: GuardrailDecision[];
  inputGuardrailsMs: number;
  retrieval?: RetrievalResult;
  retrievalMs?: number;
  retrievalGuardrailsMs?: number;
  retrievalWarnings?: string[];
  totalMs: number;
}): PipelineResponse {
  const combined = combineDecisions(
    args.retrieval
      ? [...args.inputGuardrails, args.retrieval.guardrail]
      : args.inputGuardrails
  );

  return {
    query: args.query,
    strategy: args.strategy,
    engine: args.engine ?? "fast",
    answer:
      "I don't have enough information in the retrieved context to answer this question confidently.",
    confidence: "refused",
    grounded: false,
    citations: [],
    sources: args.retrieval?.scoredChunks ?? [],
    contextPreview: args.retrieval
      ? args.retrieval.context.slice(0, 800) + (args.retrieval.context.length > 800 ? "…" : "")
      : "",
    contextTokenCount: args.retrieval?.contextTokenCount ?? 0,
    retrievalStats: args.retrieval?.stats ?? {
      strategy: args.strategy,
      chunkCount: 0,
      topK: 0,
      latencyMs: 0,
      candidatesScanned: 0,
    },
    retrievalWarnings: args.retrievalWarnings ?? [],
    guardrails: {
      input: args.inputGuardrails,
      output: [],
      combined,
    },
    harness: {
      attempts: 0,
      finishReason: null,
      warnings: ["Pipeline short-circuited by guardrail."],
    },
    timings: {
      inputGuardrailsMs: args.inputGuardrailsMs,
      retrievalMs: args.retrievalMs ?? 0,
      retrievalGuardrailsMs: args.retrievalGuardrailsMs ?? 0,
      generationMs: 0,
      outputGuardrailsMs: 0,
      totalMs: args.totalMs,
    },
    blocked: true,
    blockReasons: args.blockReasons,
    // A blocked pipeline is NOT a network failure — it's a successful refusal.
    // The system correctly decided not to answer. ok=true means "the pipeline
    // ran successfully and returned a decision", not "an answer was produced".
    ok: true,
  };
}
