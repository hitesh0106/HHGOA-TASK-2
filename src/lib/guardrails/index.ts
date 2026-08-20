/**
 * Guardrails
 * ==========
 *
 * The Hacker House Goa 2026 Task 2 explicitly requires the system to know
 * when NOT to answer. This module implements 5 guardrail categories:
 *
 *   1. Input guardrails (off-topic, unsafe/inappropriate)
 *   2. Retrieval guardrails (insufficient context)
 *   3. Hallucination detection (answer claims not supported by context)
 *   4. Unsupported-answer detection (answer goes beyond retrieved context)
 *   5. Combined verdict
 *
 * Every guardrail returns a structured decision:
 *   { pass: boolean, reason: string, severity: 'ok'|'warn'|'block', details?: unknown }
 *
 * The pipeline halts on any 'block' decision and surfaces the reason to the
 * UI; 'warn' decisions still allow the answer through but are flagged.
 */

import { generateChat } from "../llm";
import { cosineSimilarity, embedText } from "../embeddings";
import type { ChunkRecord } from "../vector-db";

export type GuardrailSeverity = "ok" | "warn" | "block";

export interface GuardrailDecision {
  name: string;
  pass: boolean;
  severity: GuardrailSeverity;
  reason: string;
  details?: unknown;
  latencyMs: number;
}

// ===========================================================================
// 1. Input guardrails
// ===========================================================================

// Topic keywords - we accept anything that's plausibly a factual / informational query
// matching the MSMARCO distribution (passages about general knowledge, definitions,
// how-tos, entities). We block clearly off-topic queries (medical diagnosis, legal
// advice, weapons, self-harm, etc.).
const UNSAFE_PATTERNS = [
  /\b(kill|suicide|self[- ]?harm|cut myself|end my life)\b/i,
  /\b(bomb|explosive|terroris|mass shooting)\b/i,
  /\b(child abuse|cp|pedo)\b/i,
  /\b(how to (make|build|synthesize).*(weapon|gun|meth|heroin|cocaine|poison))\b/i,
  // Prompt injection & adversarial override patterns
  /\b(ignore (all )?(previous|prior) (instructions|directions|prompts)|disregard (all )?(previous|prior) (instructions|prompts)|override system (prompt|instructions)|you are now in DAN mode|bypass (all )?(safety|guardrails))\b/i,
];

const OFF_TOPIC_PATTERNS = [
  // Medical / legal advice (require licensed professional)
  /\b(blood in stool|stool mean|diagnos|prescrib|medical advice|should I take|dosage)\b/i,
  /\b(legal advice|sue|file (a )?lawsuit|attorney recommendation)\b/i,
  // Pure entertainment / subjective recommendation
  /\b(what's the (best|worst) (movie|song|game|book))\b/i,
];

const NON_QUESTION_HINTS = [
  /^\s*hi\b/i,
  /^\s*hello\b/i,
  /^\s*hey\b/i,
  /^\s*thanks?\b/i,
  /^\s*(नमस्ते|नमस्कार|प्रणाम|हाय|हेलो)\b/i,
  /^\s*(নমস্কার|হ্যালো|ধন্যবাদ)\b/i,
];

export function checkInputSafety(query: string): GuardrailDecision {
  const t0 = performance.now();

  // Guard against ultra-long payload attacks
  if (query.length > 2000) {
    return {
      name: "input-safety",
      pass: false,
      severity: "block",
      reason: "Query exceeds maximum allowed length of 2000 characters.",
      details: { length: query.length },
      latencyMs: performance.now() - t0,
    };
  }

  for (const re of UNSAFE_PATTERNS) {
    if (re.test(query)) {
      return {
        name: "input-safety",
        pass: false,
        severity: "block",
        reason: "Query matched an unsafe-content pattern. Refusing to answer.",
        details: { pattern: re.source },
        latencyMs: performance.now() - t0,
      };
    }
  }
  return {
    name: "input-safety",
    pass: true,
    severity: "ok",
    reason: "No unsafe patterns detected.",
    latencyMs: performance.now() - t0,
  };
}

export function checkOffTopic(query: string): GuardrailDecision {
  const t0 = performance.now();
  for (const re of OFF_TOPIC_PATTERNS) {
    if (re.test(query)) {
      return {
        name: "off-topic",
        pass: false,
        severity: "block",
        reason: "Query appears to request professional advice (medical/legal/etc.). Refusing.",
        details: { pattern: re.source },
        latencyMs: performance.now() - t0,
      };
    }
  }
  for (const re of NON_QUESTION_HINTS) {
    if (re.test(query)) {
      return {
        name: "off-topic",
        pass: false,
        severity: "block",
        reason: "Query is a greeting or non-informational input.",
        details: { pattern: re.source },
        latencyMs: performance.now() - t0,
      };
    }
  }
  // Too-short queries are treated as off-topic
  const wordCount = query.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 2) {
    return {
      name: "off-topic",
      pass: false,
      severity: "block",
      reason: "Query is too short to be a meaningful informational request.",
      details: { wordCount },
      latencyMs: performance.now() - t0,
    };
  }
  return {
    name: "off-topic",
    pass: true,
    severity: "ok",
    reason: "Query is plausibly an on-topic informational request.",
    latencyMs: performance.now() - t0,
  };
}

// ===========================================================================
// 2. Retrieval guardrails
// ===========================================================================

export interface RetrievalContext {
  chunks: Array<{ chunk: ChunkRecord; score: number }>;
  topScore: number;
  meanScore: number;
}

export function checkRetrievalSufficiency(
  ctx: RetrievalContext,
  opts: { minTopScore?: number; minMeanScore?: number; minChunks?: number; maxChunks?: number } = {}
): GuardrailDecision {
  const t0 = performance.now();
  const minTop = opts.minTopScore ?? 0.10;
  const minMean = opts.minMeanScore ?? 0.05;
  const minChunks = opts.minChunks ?? 1;

  if (ctx.chunks.length === 0) {
    return {
      name: "retrieval-sufficiency",
      pass: false,
      severity: "block",
      reason: "No chunks retrieved above the minimum similarity threshold.",
      details: { topScore: ctx.topScore, minTop },
      latencyMs: performance.now() - t0,
    };
  }
  if (ctx.topScore < minTop) {
    return {
      name: "retrieval-sufficiency",
      pass: false,
      severity: "block",
      reason: `Top retrieval score ${ctx.topScore.toFixed(3)} is below the ${minTop} threshold — context is unlikely to be relevant.`,
      details: { topScore: ctx.topScore, minTop, chunkCount: ctx.chunks.length },
      latencyMs: performance.now() - t0,
    };
  }
  if (ctx.meanScore < minMean) {
    return {
      name: "retrieval-sufficiency",
      pass: false,
      severity: "warn",
      reason: `Mean retrieval score ${ctx.meanScore.toFixed(3)} is low; answer quality may degrade.`,
      details: { meanScore: ctx.meanScore, minMean },
      latencyMs: performance.now() - t0,
    };
  }
  if (ctx.chunks.length < minChunks) {
    return {
      name: "retrieval-sufficiency",
      pass: false,
      severity: "warn",
      reason: `Only ${ctx.chunks.length} chunks retrieved; expected at least ${minChunks}.`,
      details: { chunkCount: ctx.chunks.length, minChunks },
      latencyMs: performance.now() - t0,
    };
  }
  return {
    name: "retrieval-sufficiency",
    pass: true,
    severity: "ok",
    reason: `Retrieved ${ctx.chunks.length} chunks with top score ${ctx.topScore.toFixed(3)}.`,
    details: { topScore: ctx.topScore, meanScore: ctx.meanScore, chunkCount: ctx.chunks.length },
    latencyMs: performance.now() - t0,
  };
}

// ===========================================================================
// 3. Hallucination detection (LLM-as-judge)
// ===========================================================================
//
// We use a structured LLM call that asks: "Does the answer contain any claim
// that is NOT directly supported by the retrieved context?" The LLM returns
// one of: { supported | partial | unsupported }. 'unsupported' triggers a
// block; 'partial' triggers a warn.
//
// For latency-sensitive benchmarks we also have a fast lexical fallback that
// checks if at least 50% of the answer's content tokens appear in the context.
// The LLM judge is opt-in via the `useLlmJudge` flag.

export interface HallucinationCheck {
  verdict: "supported" | "partial" | "unsupported";
  unsupportedClaims: string[];
  reason: string;
}

export async function checkHallucinationLlm(
  query: string,
  context: string,
  answer: string,
  opts: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<GuardrailDecision> {
  const t0 = performance.now();
  const sys = `You are a strict retrieval-augmented-generation fact-checker.
Given a QUESTION, a piece of CONTEXT (retrieved passages), and an ANSWER,
decide whether every factual claim in the ANSWER is directly supported by
the CONTEXT. Return STRICT JSON only.

Schema:
{
  "verdict": "supported" | "partial" | "unsupported",
  "unsupported_claims": [string, ...],
  "reason": "one-sentence explanation"
}

Definitions:
- supported: every factual claim in the ANSWER is grounded in the CONTEXT.
- partial:   most claims are grounded, but at least one is not.
- unsupported: the ANSWER contains material claims absent from CONTEXT, or
              contradicts the CONTEXT.

If the ANSWER explicitly says it cannot answer, return verdict=supported
with an empty unsupported_claims list.`;

  const user = `QUESTION:
${query}

CONTEXT:
${context}

ANSWER:
${answer}

Return JSON now.`;

  try {
    const res = await generateChat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.0,
      maxTokens: 256,
      timeoutMs: opts.timeoutMs ?? 8000,
      maxRetries: opts.maxRetries ?? 1,
    });

    const parsed = parseLooseJson<HallucinationCheck>(res.content);
    if (!parsed) {
      return {
        name: "hallucination-llm",
        pass: true,
        severity: "warn",
        reason: "Hallucination LLM returned non-JSON output; skipping strict check.",
        details: { raw: res.content.slice(0, 500) },
        latencyMs: performance.now() - t0,
      };
    }
    const verdict = parsed.verdict ?? "supported";
    const claims = parsed.unsupported_claims ?? [];
    if (verdict === "unsupported") {
      return {
        name: "hallucination-llm",
        pass: false,
        severity: "block",
        reason: `LLM flagged ${claims.length} unsupported claim(s).`,
        details: { verdict, claims, reason: parsed.reason },
        latencyMs: performance.now() - t0,
      };
    }
    if (verdict === "partial") {
      return {
        name: "hallucination-llm",
        pass: true,
        severity: "warn",
        reason: `LLM flagged partial support: ${claims.length} claim(s) not directly grounded.`,
        details: { verdict, claims, reason: parsed.reason },
        latencyMs: performance.now() - t0,
      };
    }
    return {
      name: "hallucination-llm",
      pass: true,
      severity: "ok",
      reason: "All answer claims are grounded in retrieved context.",
      details: { verdict, claims, reason: parsed.reason },
      latencyMs: performance.now() - t0,
    };
  } catch (e) {
    return {
      name: "hallucination-llm",
      pass: true,
      severity: "warn",
      reason: `Hallucination LLM check failed (${e instanceof Error ? e.message : String(e)}); skipping.`,
      latencyMs: performance.now() - t0,
    };
  }
}

/**
 * Fast lexical hallucination check. Computes the fraction of the answer's
 * content tokens that appear in the context. Below threshold => warn (not
 * block, because lexical overlap is a weak signal).
 */
export function checkHallucinationLexical(
  _query: string,
  context: string,
  answer: string,
  opts: { minOverlap?: number } = {}
): GuardrailDecision {
  const t0 = performance.now();
  const minOverlap = opts.minOverlap ?? 0.5;
  const ctxTokens = new Set(
    context
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
  const ansTokens = answer
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (ansTokens.length === 0) {
    return {
      name: "hallucination-lexical",
      pass: true,
      severity: "ok",
      reason: "Answer has no content tokens to check.",
      latencyMs: performance.now() - t0,
    };
  }
  let matched = 0;
  for (const t of ansTokens) if (ctxTokens.has(t)) matched++;
  const overlap = matched / ansTokens.length;
  if (overlap < minOverlap) {
    return {
      name: "hallucination-lexical",
      pass: false,
      severity: "warn",
      reason: `Only ${(overlap * 100).toFixed(1)}% of answer tokens appear in retrieved context (threshold ${(minOverlap * 100).toFixed(0)}%).`,
      details: { overlap, minOverlap, matched, total: ansTokens.length },
      latencyMs: performance.now() - t0,
    };
  }
  return {
    name: "hallucination-lexical",
    pass: true,
    severity: "ok",
    reason: `${(overlap * 100).toFixed(1)}% of answer tokens are grounded in retrieved context.`,
    details: { overlap, minOverlap, matched, total: ansTokens.length },
    latencyMs: performance.now() - t0,
  };
}

// ===========================================================================
// 4. Unsupported-answer detection (refusal validation)
// ===========================================================================
//
// If the LLM was asked to refuse when context is insufficient, we verify
// that the refusal is genuine (mentions lack of context) rather than a
// hallucinated answer dressed up as a refusal.

const REFUSAL_PATTERNS = [
  /\bI (?:cannot|can't|don't|do not) (?:find|answer|provide)\b/i,
  /\b(?:insufficient|not enough) (?:context|information)\b/i,
  /\b(?:not covered|not mentioned) (?:in|by) the (?:context|retrieved|provided)\b/i,
  /\bI (?:don't|do not) have (?:enough )?(?:information|context)\b/i,
];

export function checkUnsupportedAnswer(answer: string, retrievalPassed: boolean): GuardrailDecision {
  const t0 = performance.now();
  const isRefusal = REFUSAL_PATTERNS.some((re) => re.test(answer));
  if (!retrievalPassed && !isRefusal) {
    // Retrieval was insufficient but the model still produced a confident answer - block.
    return {
      name: "unsupported-answer",
      pass: false,
      severity: "block",
      reason: "Retrieval was insufficient but the answer did not include a refusal. Potential hallucination.",
      details: { retrievalPassed, isRefusal },
      latencyMs: performance.now() - t0,
    };
  }
  if (retrievalPassed && isRefusal) {
    // Retrieval was fine but the model refused anyway - warn (might be overly cautious).
    return {
      name: "unsupported-answer",
      pass: true,
      severity: "warn",
      reason: "Retrieval was sufficient but the model refused to answer. May be overly cautious.",
      details: { retrievalPassed, isRefusal },
      latencyMs: performance.now() - t0,
    };
  }
  return {
    name: "unsupported-answer",
    pass: true,
    severity: "ok",
    reason: isRefusal
      ? "Refusal is appropriate given insufficient context."
      : "Answer is grounded and not a refusal.",
    details: { retrievalPassed, isRefusal },
    latencyMs: performance.now() - t0,
  };
}

// ===========================================================================
// 5. Combined verdict
// ===========================================================================
export interface CombinedGuardrailVerdict {
  decisions: GuardrailDecision[];
  block: boolean;
  warn: boolean;
  reasons: string[];
  totalLatencyMs: number;
}

export function combineDecisions(decisions: GuardrailDecision[]): CombinedGuardrailVerdict {
  const block = decisions.some((d) => d.severity === "block");
  const warn = decisions.some((d) => d.severity === "warn");
  const reasons = decisions.filter((d) => !d.pass).map((d) => `[${d.name}] ${d.reason}`);
  const totalLatencyMs = decisions.reduce((s, d) => s + d.latencyMs, 0);
  return { decisions, block, warn, reasons, totalLatencyMs };
}

// ===========================================================================
// Helpers
// ===========================================================================
function parseLooseJson<T>(s: string): T | null {
  if (!s) return null;
  // Strip markdown code fences
  let cleaned = s.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  // Find first { ... last }
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

// Re-export for downstream
export { cosineSimilarity, embedText };
