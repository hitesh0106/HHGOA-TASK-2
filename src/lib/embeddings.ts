/**
 * TF-IDF Hash Vectorizer (matches scripts/ingest_msmarco.py exactly)
 * =================================================================
 *
 * A pure-TypeScript embedding pipeline that produces a 384-dimensional
 * L2-normalized TF-IDF hash vector for any text.
 *
 * Why this approach?
 * ------------------
 * The official Hacker House Goa 2026 Task 2 latency target is <50ms for the
 * retrieval/RAG processing pipeline (query embedding → vector search → top-K
 * retrieval). Neural embedding models like MiniLM-L6-v2 take 20-50ms per
 * query on CPU and require either a 90MB model download or an external API
 * call. A hash-based TF-IDF vectorizer:
 *   • Runs in <2ms per query on commodity hardware
 *   • Requires no model download (works in any sandbox / air-gapped env)
 *   • Produces a real, comparable vector space (not a fake placeholder)
 *   • Is used in production by Lucene / Elasticsearch / Solr
 *
 * The vector space is fully deterministic: the same input text always
 * produces the same vector. Document embeddings are pre-computed by the
 * ingestion script (scripts/ingest_msmarco.py) using the identical
 * algorithm, so runtime query embeddings are directly comparable to the
 * pre-computed document vectors via cosine similarity.
 *
 * Production upgrade path
 * -----------------------
 * For higher semantic recall, swap `embedText` for a neural embedder
 * (sentence-transformers MiniLM-L6-v2, OpenAI text-embedding-3-small, Cohere
 * embed-v3, or Sarvam when an embeddings endpoint becomes available) and
 * re-run the ingestion script with the matching Python implementation.
 * The rest of the pipeline (vector store, retrieval, harness, guardrails)
 * is model-agnostic.
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Configuration (must match scripts/ingest_msmarco.py)
// ---------------------------------------------------------------------------
export const EMBEDDING_DIM = 384;
const NGRAM_SIZES = [1, 2] as const;

const STOPWORDS = new Set<string>(
  `
a an the and or but if then else when while of to in on at for with without
is are was were be been being this that these those it its as by from
about into over under again further once here there all any both each
few more most other some such no nor not only own same so than too very
can will just don should now i me my we our you your he him his she her
they them their what which who whom this that am have has had do does did
`.trim().split(/\s+/)
);

const TOKEN_RE = /[a-z0-9]+/g;

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(lower)) !== null) {
    const t = m[0];
    if (t.length > 1 && !STOPWORDS.has(t)) out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------
function hash32(s: string): number {
  // First 8 hex chars of md5 → 32-bit unsigned int
  const h = createHash("md5").update(s, "utf8").digest("hex");
  return parseInt(h.slice(0, 8), 16) >>> 0;
}

function signedHash(s: string): number {
  // Used for sign-flipping to reduce collision bias
  return hash32(s + "_sign") % 2 === 0 ? 1 : -1;
}

// ---------------------------------------------------------------------------
// IDF (loaded once at startup from pre-computed _idf.json)
// ---------------------------------------------------------------------------
let idfMap: Map<string, number> | null = null;

export function setIdf(idf: Record<string, number>): void {
  idfMap = new Map(Object.entries(idf));
}

export function getIdf(): Map<string, number> | null {
  return idfMap;
}

export function clearIdf(): void {
  idfMap = null;
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------
export function embedText(text: string): Float32Array {
  const tokens = tokenize(text);
  const vec = new Float32Array(EMBEDDING_DIM);
  if (tokens.length === 0) return vec;

  // Build n-grams
  const ngrams: string[] = [];
  for (const n of NGRAM_SIZES) {
    if (tokens.length < n) continue;
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(" "));
    }
  }

  // Term frequencies
  const tf = new Map<string, number>();
  for (const g of ngrams) tf.set(g, (tf.get(g) ?? 0) + 1);

  // Project into fixed-dim vector with signed hashing
  for (const [g, count] of tf) {
    const idx = hash32(g) % EMBEDDING_DIM;
    let weight = count;
    const idf = idfMap?.get(g);
    if (idf !== undefined) weight *= idf;
    const sign = signedHash(g);
    vec[idx] += sign * weight;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }
  return vec;
}

// ---------------------------------------------------------------------------
// Cosine similarity (vectors are pre-normalized → dot product)
// ---------------------------------------------------------------------------
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  // Assumes both inputs are L2-normalized.
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Sparse cosine similarity for query embedding vs. many doc embeddings.
 * Pre-computing the non-zero indices of the query dramatically speeds up
 * retrieval when the document corpus is large.
 */
export function cosineSimilaritySparse(
  queryNonZeros: Array<{ idx: number; val: number }>,
  doc: Float32Array
): number {
  let dot = 0;
  for (const { idx, val } of queryNonZeros) dot += val * doc[idx];
  return dot;
}

export function sparseEmbedding(text: string): Array<{ idx: number; val: number }> {
  const dense = embedText(text);
  const out: Array<{ idx: number; val: number }> = [];
  for (let i = 0; i < dense.length; i++) {
    if (dense[i] !== 0) out.push({ idx: i, val: dense[i] });
  }
  return out;
}
