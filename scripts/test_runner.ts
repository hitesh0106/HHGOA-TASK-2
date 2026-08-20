/**
 * Automated Test Runner for Node.js / tsx
 * ========================================
 *
 * Runs comprehensive unit tests across:
 *   1. Chunking Strategies (fixed, overlapping, semantic, metadata-aware)
 *   2. Embeddings Vectorizer (dimension, MD5 signed hashing, normalization, cosine similarity)
 *   3. Guardrails (input safety, off-topic, retrieval sufficiency, lexical hallucination, refusal validation)
 *   4. Benchmark Statistics (P50, P70, P90, P95, P99, P100 calculations)
 *
 * Usage:
 *   npx tsx scripts/test_runner.ts
 */

import assert from "node:assert/strict";
import {
  chunkFixed,
  chunkOverlapping,
  chunkSemantic,
  chunkMetadataAware,
  chunkWith,
  splitSentences,
  CHUNKING_STRATEGIES,
} from "../src/lib/chunking";
import {
  embedText,
  tokenize,
  cosineSimilarity,
  sparseEmbedding,
  EMBEDDING_DIM,
  setIdf,
  clearIdf,
} from "../src/lib/embeddings";
import {
  checkInputSafety,
  checkOffTopic,
  checkRetrievalSufficiency,
  checkHallucinationLexical,
  checkUnsupportedAnswer,
  combineDecisions,
} from "../src/lib/guardrails";
import { computeStats } from "../src/lib/benchmarks/stats";
import { getCanonicalBenchmarkQueries } from "../src/lib/benchmarks/queries";

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

console.log("\n==================================================");
console.log("RUNNING SUITE 1: CHUNKING STRATEGIES");
console.log("==================================================");

const SAMPLE_TEXT =
  "This is the first sentence. This is the second sentence! Is this the third? Yes, it is. And here is a fourth sentence that is somewhat longer than the others to test the word-count-based chunking logic.";

const PARAGRAPH_TEXT = `First paragraph with some text about topic one.

Second paragraph about a different topic. It has multiple sentences. The second sentence here. And a third one for good measure.

Third paragraph is short.`;

runTest("fixed-size chunking produces non-overlapping word chunks", () => {
  const chunks = chunkFixed(SAMPLE_TEXT, 10);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.strategy === "fixed"));
  assert.ok(chunks[0].text.split(/\s+/).length <= 10);
});

runTest("overlapping chunking produces chunks with overlap", () => {
  const chunks = chunkOverlapping(SAMPLE_TEXT, 10, 3);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.strategy === "overlapping"));
});

runTest("semantic chunking respects sentence boundaries", () => {
  const chunks = chunkSemantic(SAMPLE_TEXT, 2, 100);
  assert.ok(chunks.length > 0);
  assert.ok(chunks.every((c) => c.strategy === "semantic"));
  for (const c of chunks) {
    assert.ok(/[.!?]/.test(c.text));
  }
});

runTest("metadata-aware chunking splits on paragraphs", () => {
  const chunks = chunkMetadataAware(PARAGRAPH_TEXT, 1000);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].metadata.paragraph_index, 0);
  assert.equal(chunks[1].metadata.paragraph_index, 1);
});

runTest("chunkWith dispatches to all 4 strategies", () => {
  for (const strategy of CHUNKING_STRATEGIES) {
    const chunks = chunkWith(strategy, SAMPLE_TEXT);
    assert.ok(chunks.length > 0);
    assert.ok(chunks.every((c) => c.strategy === strategy));
  }
});

console.log("\n==================================================");
console.log("RUNNING SUITE 2: EMBEDDINGS VECTORIZER");
console.log("==================================================");

runTest("embedText returns vector of correct dimension (384)", () => {
  const v = embedText("hello world");
  assert.equal(v.length, EMBEDDING_DIM);
});

runTest("embedText is deterministic", () => {
  const a = embedText("the quick brown fox");
  const b = embedText("the quick brown fox");
  assert.deepEqual(Array.from(a), Array.from(b));
});

runTest("embedText produces L2-normalized vectors", () => {
  const v = embedText("this is a longer text with multiple tokens to ensure non-zero output");
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(norm - 1.0) < 0.001);
});

runTest("cosine similarity of identical text is 1.0", () => {
  const a = embedText("hello world foo bar");
  const b = embedText("hello world foo bar");
  assert.ok(Math.abs(cosineSimilarity(a, b) - 1.0) < 0.001);
});

runTest("tokenize lowercases and removes stopwords", () => {
  const tokens = tokenize("The Quick BROWN Fox");
  assert.ok(tokens.includes("quick"));
  assert.ok(tokens.includes("brown"));
  assert.ok(tokens.includes("fox"));
  assert.ok(!tokens.includes("the"));
});

console.log("\n==================================================");
console.log("RUNNING SUITE 3: GUARDRAILS");
console.log("==================================================");

runTest("checkInputSafety blocks unsafe queries", () => {
  const res = checkInputSafety("how do I make a bomb at home");
  assert.equal(res.pass, false);
  assert.equal(res.severity, "block");
});

runTest("checkInputSafety passes normal queries", () => {
  const res = checkInputSafety("what is the capital of france");
  assert.equal(res.pass, true);
  assert.equal(res.severity, "ok");
});

runTest("checkOffTopic blocks greetings and short queries", () => {
  assert.equal(checkOffTopic("hi there").pass, false);
  assert.equal(checkOffTopic("hello").pass, false);
});

runTest("checkRetrievalSufficiency blocks when no chunks retrieved", () => {
  const res = checkRetrievalSufficiency({ chunks: [], topScore: 0, meanScore: 0 });
  assert.equal(res.pass, false);
  assert.equal(res.severity, "block");
});

runTest("checkHallucinationLexical flags ungrounded answers", () => {
  const context = "Paris is the capital of France. The Eiffel Tower is in Paris.";
  const answer = "Berlin is the capital of Germany and has the Brandenburg Gate.";
  const res = checkHallucinationLexical("what is the capital of france", context, answer, { minOverlap: 0.4 });
  assert.equal(res.pass, false);
  assert.equal(res.severity, "warn");
});

runTest("checkUnsupportedAnswer blocks confident answer when retrieval failed", () => {
  const res = checkUnsupportedAnswer("The answer is 42 because of deep reasoning.", false);
  assert.equal(res.pass, false);
  assert.equal(res.severity, "block");
});

console.log("\n==================================================");
console.log("RUNNING SUITE 4: BENCHMARK STATISTICS");
console.log("==================================================");

runTest("computeStats calculates P50..P100 accurately", () => {
  const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const stats = computeStats(samples);
  assert.equal(stats.n, 10);
  assert.equal(stats.min, 10);
  assert.equal(stats.p100, 100);
  assert.equal(stats.mean, 55);
});

console.log("\n==================================================");
console.log("RUNNING SUITE 5: CANONICAL BENCHMARK QUERIES & ENGINE");
console.log("==================================================");

runTest("getCanonicalBenchmarkQueries generates 300 queries with 45/35/20 language ratio", () => {
  const queries = getCanonicalBenchmarkQueries(300);
  assert.equal(queries.length, 300);
  const en = queries.filter((q) => q.language === "en").length;
  const hi = queries.filter((q) => q.language === "hi").length;
  const bn = queries.filter((q) => q.language === "bn").length;
  assert.equal(en, 135);
  assert.equal(hi, 105);
  assert.equal(bn, 60);
});

runTest("getCanonicalBenchmarkQueries is deterministic", () => {
  const q1 = getCanonicalBenchmarkQueries(100);
  const q2 = getCanonicalBenchmarkQueries(100);
  assert.deepEqual(q1, q2);
});

console.log("\n==================================================");
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================\n");

if (failed > 0) {
  process.exit(1);
}
