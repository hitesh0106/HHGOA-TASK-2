/**
 * Benchmark Dataset Deduplication & Integrity Engine
 * ==================================================
 *
 * Implements strict, lossless duplicate detection, cross-category integrity
 * verification, and honest aggregation of repeated benchmark runs.
 *
 * Principles:
 *   1. Lossless: All individual execution runs are 100% preserved.
 *   2. Strict: Only exact normalized duplicates are grouped; semantically similar
 *      different queries remain distinct.
 *   3. Truthful: Aggregate latencies and outcomes are computed directly from
 *      the underlying execution runs without data smoothing.
 *   4. Diagnostic: Cross-category conflicts (e.g. same query in answerable &
 *      unanswerable sets) are flagged explicitly.
 */

import type { BenchmarkQueryRecord } from "./runner";
import { computeStats } from "./stats";

// ---------------------------------------------------------------------------
// Query Normalization for Deduplication
// ---------------------------------------------------------------------------

/**
 * Normalizes a query for exact duplicate detection:
 *   • Unicode NFC normalization
 *   • Trim leading and trailing whitespace
 *   • Lowercase for Latin-script text
 *   • Collapse all internal whitespace sequences to a single space
 *   • Strip safe edge punctuation (e.g. "?", "!", ".", quotes, dashes)
 *   • Normalizes punctuation inside query
 *   • Preserves Indic scripts and non-Latin character sets verbatim
 */
export function normalizeForDeduplication(query: string): string {
  if (!query) return "";

  // 1. Unicode NFC
  let norm = query.normalize("NFC");

  // 2. Lowercase (for Latin and case-sensitive scripts)
  norm = norm.toLowerCase();

  // 3. Strip leading/trailing edge punctuation and symbols
  norm = norm.replace(/^[.\s,?!:;'"؟،\-—–_…/\\()\[\]{}|<>«»“”‘’]+/u, "");
  norm = norm.replace(/[.\s,?!:;'"؟،\-—–_…/\\()\[\]{}|<>«»“”‘’]+$/u, "");

  // 4. Normalize internal punctuation to single spaces
  norm = norm.replace(/[.,?!:;'"؟،\-—–_…/\\()\[\]{}|<>«»“”‘’]/gu, " ");

  // 5. Collapse all internal whitespace sequences to a single ASCII space
  norm = norm.replace(/\s+/g, " ");

  return norm.trim();
}

// ---------------------------------------------------------------------------
// Integrity & Grouping Types
// ---------------------------------------------------------------------------

export interface DuplicateQueryGroup {
  normalizedQuery: string;
  displayQuery: string;
  originalQueries: string[];
  count: number;
  indices: number[];
  categories: string[];
  languages: string[];
}

export interface DatasetIntegrityConflict {
  normalizedQuery: string;
  answerableIndices: number[];
  unanswerableIndices: number[];
  queries: string[];
  reason: string;
}

export interface DatasetIntegrityReport {
  totalQueries: number;
  uniqueNormalizedQueries: number;
  duplicateCount: number; // total - unique
  duplicateGroups: DuplicateQueryGroup[];
  hasConflicts: boolean;
  conflicts: DatasetIntegrityConflict[];
  answerableStats: {
    total: number;
    unique: number;
    duplicates: number;
  };
  unanswerableStats: {
    total: number;
    unique: number;
    duplicates: number;
  };
}

export interface GroupedQueryRecord {
  normalizedQuery: string;
  displayQuery: string; // original query text of the first instance
  language: string;
  category: string;
  runCount: number;
  runs: BenchmarkQueryRecord[]; // Full lossless list of individual runs
  avgGuardrailsMs: number;
  avgRetrievalMs: number;
  avgGenerationMs: number;
  avgTotalMs: number;
  p95TotalMs: number;
  minTotalMs: number;
  maxTotalMs: number;
  outcomes: {
    Answer: number;
    Abstention: number;
  };
  consensusOutcome: "Answer" | "Abstention";
  groundedRate: number; // percentage 0 - 100
  citationRate: number; // percentage 0 - 100
  latestAnswer: string;
  topScore: number;
  allGrounded: boolean;
  hasOverBudgetRun: boolean;
}

// ---------------------------------------------------------------------------
// Dataset Integrity Checker
// ---------------------------------------------------------------------------

export interface QueryLike {
  id?: number;
  query: string;
  language?: string;
  category?: string;
  expectedOutcome?: "Answer" | "Abstention" | string;
}

/**
 * Checks query dataset integrity, separating answerable from unanswerable pools,
 * detecting duplicate groups, and flagging cross-category conflicts.
 */
export function checkDatasetIntegrity(queries: QueryLike[]): DatasetIntegrityReport {
  const totalQueries = queries.length;

  const answerableMap = new Map<string, { indices: number[]; items: QueryLike[] }>();
  const unanswerableMap = new Map<string, { indices: number[]; items: QueryLike[] }>();
  const allNormalizedMap = new Map<string, { indices: number[]; items: QueryLike[] }>();

  for (let idx = 0; idx < queries.length; idx++) {
    const q = queries[idx];
    const norm = normalizeForDeduplication(q.query);
    const indexNum = q.id ?? idx + 1;

    // Track in global map
    if (!allNormalizedMap.has(norm)) {
      allNormalizedMap.set(norm, { indices: [], items: [] });
    }
    const globalEntry = allNormalizedMap.get(norm)!;
    globalEntry.indices.push(indexNum);
    globalEntry.items.push(q);

    // Determine category
    const isUnanswerable =
      q.expectedOutcome === "Abstention" ||
      q.category === "abstention" ||
      q.category === "off_topic";

    if (isUnanswerable) {
      if (!unanswerableMap.has(norm)) {
        unanswerableMap.set(norm, { indices: [], items: [] });
      }
      const uEntry = unanswerableMap.get(norm)!;
      uEntry.indices.push(indexNum);
      uEntry.items.push(q);
    } else {
      if (!answerableMap.has(norm)) {
        answerableMap.set(norm, { indices: [], items: [] });
      }
      const aEntry = answerableMap.get(norm)!;
      aEntry.indices.push(indexNum);
      aEntry.items.push(q);
    }
  }

  // Find duplicate groups (where count > 1)
  const duplicateGroups: DuplicateQueryGroup[] = [];
  for (const [norm, data] of allNormalizedMap.entries()) {
    if (data.indices.length > 1) {
      const originalQueries = Array.from(new Set(data.items.map((i) => i.query)));
      const categories = Array.from(new Set(data.items.map((i) => i.category || "unknown")));
      const languages = Array.from(new Set(data.items.map((i) => i.language || "en")));

      duplicateGroups.push({
        normalizedQuery: norm,
        displayQuery: data.items[0].query,
        originalQueries,
        count: data.indices.length,
        indices: data.indices,
        categories,
        languages,
      });
    }
  }

  // Find cross-category conflicts
  const conflicts: DatasetIntegrityConflict[] = [];
  for (const [norm, aData] of answerableMap.entries()) {
    if (unanswerableMap.has(norm)) {
      const uData = unanswerableMap.get(norm)!;
      const combinedQueries = Array.from(
        new Set([...aData.items.map((i) => i.query), ...uData.items.map((i) => i.query)])
      );

      conflicts.push({
        normalizedQuery: norm,
        answerableIndices: aData.indices,
        unanswerableIndices: uData.indices,
        queries: combinedQueries,
        reason: `Query "${norm}" is configured as both Answerable (indices: ${aData.indices.join(", ")}) and Unanswerable/Abstention (indices: ${uData.indices.join(", ")}).`,
      });
    }
  }

  // Compute category-specific counts
  let answerableTotal = 0;
  for (const a of answerableMap.values()) answerableTotal += a.indices.length;
  const answerableUnique = answerableMap.size;

  let unanswerableTotal = 0;
  for (const u of unanswerableMap.values()) unanswerableTotal += u.indices.length;
  const unanswerableUnique = unanswerableMap.size;

  const uniqueNormalizedQueries = allNormalizedMap.size;
  const duplicateCount = totalQueries - uniqueNormalizedQueries;

  return {
    totalQueries,
    uniqueNormalizedQueries,
    duplicateCount,
    duplicateGroups,
    hasConflicts: conflicts.length > 0,
    conflicts,
    answerableStats: {
      total: answerableTotal,
      unique: answerableUnique,
      duplicates: answerableTotal - answerableUnique,
    },
    unanswerableStats: {
      total: unanswerableTotal,
      unique: unanswerableUnique,
      duplicates: unanswerableTotal - unanswerableUnique,
    },
  };
}

// ---------------------------------------------------------------------------
// Group Query Records for Unique Queries View
// ---------------------------------------------------------------------------

/**
 * Groups raw benchmark query records into unified unique query rows with honest
 * aggregations, while preserving all individual execution runs.
 */
export function groupQueryRecords(records: BenchmarkQueryRecord[]): GroupedQueryRecord[] {
  if (!records || records.length === 0) return [];

  const groupsMap = new Map<string, BenchmarkQueryRecord[]>();

  for (const rec of records) {
    const norm = normalizeForDeduplication(rec.query);
    if (!groupsMap.has(norm)) {
      groupsMap.set(norm, []);
    }
    groupsMap.get(norm)!.push(rec);
  }

  const grouped: GroupedQueryRecord[] = [];

  for (const [norm, runs] of groupsMap.entries()) {
    const first = runs[0];
    const count = runs.length;

    let sumGuardrails = 0;
    let sumRetrieval = 0;
    let sumGeneration = 0;
    let sumTotal = 0;
    let minTotal = Infinity;
    let maxTotal = -Infinity;
    let groundedCount = 0;
    let citationCount = 0;
    const outcomes = { Answer: 0, Abstention: 0 };
    const totalLatencies: number[] = [];

    for (const r of runs) {
      sumGuardrails += r.guardrailsMs;
      sumRetrieval += r.retrievalMs;
      sumGeneration += r.generationMs;
      sumTotal += r.totalMs;
      if (r.totalMs < minTotal) minTotal = r.totalMs;
      if (r.totalMs > maxTotal) maxTotal = r.totalMs;
      if (r.grounded) groundedCount++;
      if (r.hasCitation) citationCount++;
      outcomes[r.outcome]++;
      totalLatencies.push(r.totalMs);
    }

    const totalStats = computeStats(totalLatencies);
    const avgGuardrailsMs = sumGuardrails / count;
    const avgRetrievalMs = sumRetrieval / count;
    const avgGenerationMs = sumGeneration / count;
    const avgTotalMs = sumTotal / count;
    const groundedRate = (groundedCount / count) * 100;
    const citationRate = (citationCount / count) * 100;
    const consensusOutcome: "Answer" | "Abstention" =
      outcomes.Answer >= outcomes.Abstention ? "Answer" : "Abstention";

    grouped.push({
      normalizedQuery: norm,
      displayQuery: first.query,
      language: first.language,
      category: first.category,
      runCount: count,
      runs,
      avgGuardrailsMs,
      avgRetrievalMs,
      avgGenerationMs,
      avgTotalMs,
      p95TotalMs: totalStats.p95,
      minTotalMs: minTotal === Infinity ? 0 : minTotal,
      maxTotalMs: maxTotal === -Infinity ? 0 : maxTotal,
      outcomes,
      consensusOutcome,
      groundedRate,
      citationRate,
      latestAnswer: runs[runs.length - 1].answer,
      topScore: first.topScore,
      allGrounded: groundedCount === count,
      hasOverBudgetRun: runs.some((r) => r.overBudget),
    });
  }

  return grouped;
}
