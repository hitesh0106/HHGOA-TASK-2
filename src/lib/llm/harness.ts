/**
 * Model Harness
 * =============
 *
 * Orchestration layer for grounded answer generation. NOT a simple
 * prompt → response call. Provides:
 *
 *   • Structured input (LLM generates a JSON answer with fields)
 *   • Structured output validation (zod-style runtime checks)
 *   • Tool/function call pattern: harness calls `lookup_context` "tool"
 *     before generation, then `validate_answer` after generation
 *   • Retry with backoff (delegated to LLM client)
 *   • Timeout handling (delegated to LLM client)
 *   • Error recovery: on JSON parse failure, fall back to plain-text answer
 *   • Retrieval validation: ensures context has signal before calling LLM
 *   • Answer validation: ensures the answer is grounded
 *
 * The harness is the ONLY place where the LLM is called for answer
 * generation. Guardrails wrap it but never bypass it.
 */

import { generateChat, type LlmMessage } from "../llm";
import type { ScoredChunk } from "../vector-db";

// ---------------------------------------------------------------------------
// Structured I/O
// ---------------------------------------------------------------------------
export interface HarnessInput {
  query: string;
  context: string;
  contextChunks: ScoredChunk[];
  strategy: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface HarnessOutput {
  answer: string;
  confidence: "high" | "medium" | "low" | "refused";
  citations: number[]; // 1-indexed [C1], [C2]... references in the answer
  grounded: boolean; // best-effort grounding flag (LLM self-report)
  finishReason: string | null;
  attempts: number;
  latencyMs: number;
  raw: unknown;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a strict retrieval-augmented-generation assistant.
You will be given a QUESTION and a set of CONTEXT passages, each prefixed
with a citation marker like [C1], [C2], etc.

Your job:
1. Answer the QUESTION using ONLY the provided CONTEXT.
2. Cite every factual claim with one or more citation markers (e.g. "Paris is the capital of France [C1].").
3. If the CONTEXT does not contain enough information to answer, REFUSE by
   responding with: "I don't have enough information in the retrieved context
   to answer this question confidently."
4. Never invent facts, numbers, names, dates, or quotes that are not in the CONTEXT.
5. Keep the answer concise (1-3 sentences) and direct.

Return STRICT JSON with this schema:
{
  "answer": string,
  "confidence": "high" | "medium" | "low" | "refused",
  "citations": [number, ...],
  "grounded": boolean
}

"confidence" definitions:
- high:    the context directly answers the question with little ambiguity
- medium:  the context partially answers; some inference was required
- low:     the context is only tangentially related; answer is best-effort
- refused: you declined to answer due to insufficient context

"grounded" is true if every claim in the answer is directly supported by
the context; false otherwise. Set grounded=false if you refused.

Return JSON only - no prose, no markdown fences.`;

// ---------------------------------------------------------------------------
// Tool pattern (mimics function calling)
// ---------------------------------------------------------------------------
/**
 * Tool 1: lookup_context
 * Returns the pre-fetched context. In a more complex system this would
 * actually call the retriever; here it's pre-fetched by the pipeline.
 */
function lookupContext(input: HarnessInput): { context: string; chunkCount: number } {
  return {
    context: input.context,
    chunkCount: input.contextChunks.length,
  };
}

/**
 * Tool 2: validate_answer (post-generation)
 * Cheap structural validation - LLM may have produced bad JSON or claimed
 * citations that don't exist. We don't call the LLM here; we use heuristics.
 */
function validateAnswer(
  parsed: Partial<HarnessOutput>,
  input: HarnessInput
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!parsed.answer || typeof parsed.answer !== "string") {
    return { valid: false, warnings: ["Missing or invalid 'answer' field."] };
  }
  if (!parsed.confidence || !["high", "medium", "low", "refused"].includes(parsed.confidence)) {
    warnings.push(`Invalid confidence '${parsed.confidence}'; defaulting to 'low'.`);
    parsed.confidence = "low";
  }
  if (!Array.isArray(parsed.citations)) {
    warnings.push("'citations' is not an array; defaulting to [].");
    parsed.citations = [];
  }
  // Validate citation indices
  const maxIdx = input.contextChunks.length;
  const filtered = (parsed.citations as number[]).filter(
    (c) => Number.isInteger(c) && c >= 1 && c <= maxIdx
  );
  if (filtered.length < (parsed.citations as number[]).length) {
    warnings.push("Some citation indices were out of range and have been removed.");
  }
  parsed.citations = filtered;
  if (typeof parsed.grounded !== "boolean") {
    warnings.push("'grounded' is not a boolean; defaulting to false.");
    parsed.grounded = false;
  }
  return { valid: true, warnings };
}

// ---------------------------------------------------------------------------
// Main harness entry point
// ---------------------------------------------------------------------------
export async function runHarness(input: HarnessInput): Promise<HarnessOutput> {
  const t0 = performance.now();
  const warnings: string[] = [];

  // Step 1: retrieval validation (refuse to call LLM if context is empty)
  const ctxTool = lookupContext(input);
  if (ctxTool.chunkCount === 0 || !ctxTool.context.trim()) {
    warnings.push("Empty context - refusing to call LLM.");
    return {
      answer:
        "I don't have enough information in the retrieved context to answer this question confidently.",
      confidence: "refused",
      citations: [],
      grounded: false,
      finishReason: null,
      attempts: 0,
      latencyMs: performance.now() - t0,
      raw: null,
      warnings,
    };
  }

  // Step 2: build user message
  const userMessage = `QUESTION:
${input.query}

CONTEXT:
${input.context}

Return JSON now.`;

  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // Step 3: call LLM (with retries / timeout inside generateChat)
  let attempts = 0;
  let rawContent = "";
  let finishReason: string | null = null;
  let raw: unknown = null;
  try {
    const res = await generateChat({
      messages,
      temperature: input.temperature ?? 0.2,
      maxTokens: input.maxTokens ?? 512,
      timeoutMs: input.timeoutMs ?? 12_000,
      maxRetries: input.maxRetries ?? 1,
    });
    attempts = res.attempts;
    rawContent = res.content;
    finishReason = res.finishReason;
    raw = res.raw;
  } catch (e) {
    warnings.push(`LLM call failed: ${e instanceof Error ? e.message : String(e)}`);
    return {
      answer:
        "I'm unable to generate an answer right now due to an LLM error. Please try again.",
      confidence: "refused",
      citations: [],
      grounded: false,
      finishReason: null,
      attempts,
      latencyMs: performance.now() - t0,
      raw: null,
      warnings,
    };
  }

  // Step 4: parse structured output (with error recovery)
  let parsed: Partial<HarnessOutput> | null = parseLooseJson(rawContent);
  let usedFallback = false;
  if (!parsed) {
    // Fallback: treat raw content as plain-text answer with low confidence
    warnings.push("LLM did not return valid JSON; using plain-text fallback.");
    parsed = {
      answer: rawContent.trim(),
      confidence: "low",
      citations: [],
      grounded: false,
    };
    usedFallback = true;
  }

  // Step 5: validate answer structure
  const v = validateAnswer(parsed, input);
  warnings.push(...v.warnings);
  if (!v.valid) {
    return {
      answer:
        "I don't have enough information in the retrieved context to answer this question confidently.",
      confidence: "refused",
      citations: [],
      grounded: false,
      finishReason,
      attempts,
      latencyMs: performance.now() - t0,
      raw,
      warnings,
    };
  }

  return {
    answer: parsed.answer!,
    confidence: parsed.confidence as HarnessOutput["confidence"],
    citations: parsed.citations!,
    grounded: parsed.grounded ?? false,
    finishReason,
    attempts,
    latencyMs: performance.now() - t0,
    raw: usedFallback ? rawContent : raw,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseLooseJson<T>(s: string): T | null {
  if (!s) return null;
  let cleaned = s.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) return null;
  cleaned = cleaned.slice(first, last + 1);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}
