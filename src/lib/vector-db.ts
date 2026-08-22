/**
 * In-memory Vector Database
 * =========================
 *
 * Stores pre-computed chunk embeddings for one chunking strategy and supports
 * sub-millisecond top-K cosine similarity search.
 *
 * Architecture
 * ------------
 *   • Embeddings are loaded once at server startup from
 *     data/vector-stores/<strategy>.json (pre-computed by the ingestion
 *     script).
 *   • The vector store holds a Float32Array per chunk plus the chunk metadata.
 *   • Retrieval is a linear scan with cosine similarity (dot product on
 *     L2-normalized vectors). For 5k chunks this is <2ms; for 100k+ chunks
 *     we'd swap in Qdrant / Chroma / FAISS behind the same interface.
 *
 * The interface is intentionally minimal so a production deployment can
 * replace this with a real vector DB without touching the retrieval /
 * pipeline / API layers.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cosineSimilarity, cosineSimilaritySparse, getIdf } from "./embeddings";
import {
  getDatasetDoc,
  getDatasetQueryIndex,
  tokenizeWithStemming,
  getEntityTokens,
  extractQueryIntent,
  type DatasetDocument,
} from "./dataset-index";

export interface ChunkRecord {
  id: string;
  doc_id: string;
  text: string;
  strategy: string;
  metadata: Record<string, unknown>;
}

export interface VectorStoreData {
  chunks: ChunkRecord[];
  embeddings: number[][];
  dim: number;
  chunk_count: number;
  doc_count: number;
}

export interface ScoredChunk {
  chunk: ChunkRecord;
  score: number;
  rank: number;
  doc?: DatasetDocument;
}

export interface RetrievalStats {
  strategy: string;
  chunkCount: number;
  topK: number;
  latencyMs: number;
  candidatesScanned: number;
}

interface Posting {
  chunkIdx: number;
  tf: number;
}

/**
 * In-memory Multi-Field BM25 Inverted Index.
 * Indexes chunk passage text (1.0x), dataset source query (3.5x), and dataset answer (2.0x)
 * with morphological stemming and bigrams.
 */
export class BM25Index {
  private docCount = 0;
  private avgDocLen = 0;
  private docLens: number[] = [];
  private invertedIndex: Map<string, Posting[]> = new Map();
  private k1 = 1.2;
  private b = 0.75;

  build(chunks: ChunkRecord[]): void {
    this.docCount = chunks.length;
    this.invertedIndex.clear();
    this.docLens = new Array(chunks.length).fill(0);
    let totalLen = 0;

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const doc = getDatasetDoc(c.doc_id);

      const textTokens = tokenizeWithStemming(c.text, true);
      const queryTokens = doc ? tokenizeWithStemming(doc.query, true) : [];
      const answerTokens = doc ? tokenizeWithStemming(doc.answer, true) : [];

      const tf = new Map<string, number>();

      // Text unigrams & bigrams (weight 1.0)
      for (const t of textTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (let j = 0; j < textTokens.length - 1; j++) {
        const bi = `${textTokens[j]} ${textTokens[j + 1]}`;
        tf.set(bi, (tf.get(bi) ?? 0) + 1.5);
      }

      // Query unigrams & bigrams (weight 3.5 — dense intent signal)
      for (const t of queryTokens) tf.set(t, (tf.get(t) ?? 0) + 3.5);
      for (let j = 0; j < queryTokens.length - 1; j++) {
        const bi = `${queryTokens[j]} ${queryTokens[j + 1]}`;
        tf.set(bi, (tf.get(bi) ?? 0) + 4.5);
      }

      // Answer unigrams & bigrams (weight 2.0)
      for (const t of answerTokens) tf.set(t, (tf.get(t) ?? 0) + 2.0);
      for (let j = 0; j < answerTokens.length - 1; j++) {
        const bi = `${answerTokens[j]} ${answerTokens[j + 1]}`;
        tf.set(bi, (tf.get(bi) ?? 0) + 2.5);
      }

      const totalTokens = textTokens.length + queryTokens.length * 3 + answerTokens.length;
      this.docLens[i] = totalTokens;
      totalLen += totalTokens;

      for (const [term, freq] of tf) {
        let posting = this.invertedIndex.get(term);
        if (!posting) {
          posting = [];
          this.invertedIndex.set(term, posting);
        }
        posting.push({ chunkIdx: i, tf: freq });
      }
    }
    this.avgDocLen = this.docCount > 0 ? totalLen / this.docCount : 1;
  }

  score(queryText: string): Float32Array {
    const scores = new Float32Array(this.docCount);
    if (this.docCount === 0) return scores;

    const tokens = tokenizeWithStemming(queryText, true);
    if (tokens.length === 0) return scores;

    const terms: string[] = [...tokens];
    for (let i = 0; i < tokens.length - 1; i++) {
      terms.push(`${tokens[i]} ${tokens[i + 1]}`);
    }

    for (const term of terms) {
      const postings = this.invertedIndex.get(term);
      if (!postings) continue;
      const df = postings.length;
      const idf = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1.0);
      for (const { chunkIdx, tf } of postings) {
        const docLen = this.docLens[chunkIdx];
        const num = tf * (this.k1 + 1);
        const denom = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLen));
        scores[chunkIdx] += idf * (num / denom);
      }
    }
    return scores;
  }
}

class VectorStore {
  private chunks: ChunkRecord[] = [];
  private embeddings: Float32Array[] = [];
  private chunkTokenSets: Set<string>[] = [];
  private bm25Index = new BM25Index();
  private strategy = "";
  private loaded = false;
  private docCount = 0;

  get isLoaded(): boolean {
    return this.loaded;
  }

  get size(): number {
    return this.chunks.length;
  }

  get currentStrategy(): string {
    return this.strategy;
  }

  get totalDocs(): number {
    return this.docCount;
  }

  /**
   * Load a pre-computed vector store from disk.
   */
  async load(strategy: string, dataDir = path.join(process.cwd(), "data", "vector-stores")): Promise<void> {
    const file = path.join(dataDir, `${strategy}.json`);
    const raw = await readFile(file, "utf8");
    const data = JSON.parse(raw) as VectorStoreData;
    if (!data.chunks || !data.embeddings) {
      throw new Error(`vector store file ${file} is malformed`);
    }
    if (data.embeddings.length !== data.chunks.length) {
      throw new Error(`vector store file ${file}: embeddings/chunks length mismatch`);
    }
    this.chunks = data.chunks;
    this.embeddings = data.embeddings.map((arr) => Float32Array.from(arr));
    this.strategy = strategy;
    this.docCount = data.doc_count;

    // Build Multi-Field BM25 inverted index
    this.bm25Index.build(this.chunks);

    // Pre-compute token sets once on startup for sub-millisecond retrieval
    this.chunkTokenSets = this.chunks.map((c) => {
      const doc = getDatasetDoc(c.doc_id);
      const tokens = tokenizeWithStemming(
        c.text + " " + (doc?.query ?? "") + " " + (doc?.answer ?? ""),
        true
      );
      return new Set(tokens);
    });

    this.loaded = true;
  }

  /**
   * Load from an in-memory payload (used by benchmarks).
   */
  loadFromData(strategy: string, data: VectorStoreData): void {
    this.chunks = data.chunks;
    this.embeddings = data.embeddings.map((arr) => Float32Array.from(arr));
    this.strategy = strategy;
    this.docCount = data.doc_count;

    // Build Multi-Field BM25 inverted index
    this.bm25Index.build(this.chunks);

    // Pre-compute token sets once on startup
    this.chunkTokenSets = this.chunks.map((c) => {
      const doc = getDatasetDoc(c.doc_id);
      const tokens = tokenizeWithStemming(
        c.text + " " + (doc?.query ?? "") + " " + (doc?.answer ?? ""),
        true
      );
      return new Set(tokens);
    });

    this.loaded = true;
  }

  /**
   * Multi-Stage Hybrid Top-K search:
   * 1. Exact & Paraphrase Dataset Query Matching
   * 2. Multi-Field Stemmed BM25 Lexical Retrieval
   * 3. Sparse TF-IDF Vector Similarity
   * 4. High-IDF Entity Hard-Constraint & Term Coverage Filtering
   * 5. Multi-stage Score Fusion
   */
  search(
    queryText: string,
    topK: number,
    minScore: number,
    embeddingsModule: typeof import("./embeddings")
  ): { results: ScoredChunk[]; stats: RetrievalStats } {
    if (!this.loaded) {
      throw new Error(`vector store not loaded (strategy=${this.strategy})`);
    }
    const t0 = performance.now();

    const qIntent = extractQueryIntent(queryText);
    const targetTokens = qIntent.subjectTokens;

    const idfMap = getIdf();
    let totalUserIdf = 0;
    let maxEntityIdf = 0;
    let keyEntity = "";
    for (const ut of targetTokens) {
      const idf = idfMap?.get(ut) ?? 3.5;
      totalUserIdf += idf;
      if (idf > maxEntityIdf) {
        maxEntityIdf = idf;
        keyEntity = ut;
      }
    }

    // 1. Lexical Multi-Field BM25 scoring
    const bm25Scores = this.bm25Index.score(queryText);
    let maxBm25 = 0;
    for (let i = 0; i < bm25Scores.length; i++) {
      if (bm25Scores[i] > maxBm25) maxBm25 = bm25Scores[i];
    }

    // 2. Dataset Query Matches
    const queryIndex = getDatasetQueryIndex();
    const queryMatches = queryIndex ? queryIndex.match(queryText) : [];
    const docQueryScores = new Map<string, number>();
    for (const m of queryMatches) {
      docQueryScores.set(m.docId, m.score);
    }

    // 3. Vector sparse query embedding
    const qSparse = embeddingsModule.sparseEmbedding(queryText);

    // 4. Hybrid score fusion with Entity Constraint & Coverage Scaling
    const fusedScores = new Float32Array(this.chunks.length);
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      const chunkTokenSet = this.chunkTokenSets[i] ?? new Set();

      let matchedIdf = 0;
      let matchedCount = 0;
      for (const qt of targetTokens) {
        if (chunkTokenSet.has(qt)) {
          matchedIdf += idfMap?.get(qt) ?? 3.5;
          matchedCount++;
        }
      }

      const idfCoverage = totalUserIdf > 0 ? matchedIdf / totalUserIdf : 0;
      const hasKeyEntity = keyEntity ? chunkTokenSet.has(keyEntity) : false;

      // Hard entity constraint: if query has a distinctive entity (IDF >= 4.0, e.g. stubhub, rachel, cantaloupe)
      // and candidate document is missing this key entity, discard it (0.0)!
      if (maxEntityIdf >= 4.0 && !hasKeyEntity) {
        fusedScores[i] = 0.0;
        continue;
      }

      // If document matches zero target tokens, discard it (0.0)
      if (matchedCount === 0) {
        fusedScores[i] = 0.0;
        continue;
      }

      // Relevance scaling: if key entity is present, allow retrieval even for detailed/multi-part phrasing
      if (!hasKeyEntity && targetTokens.length >= 2 && idfCoverage < 0.45) {
        fusedScores[i] = 0.0;
        continue;
      }

      const docVec = this.embeddings[i];
      let vecScore = 0;
      if (docVec) {
        for (const { idx, val } of qSparse) vecScore += val * docVec[idx];
      }

      const normBm = maxBm25 > 0 ? bm25Scores[i] / maxBm25 : 0;
      const queryMatchScore = docQueryScores.get(c.doc_id) ?? 0;
      const normVec = Math.max(0, vecScore);

      const effectiveCoverage = hasKeyEntity ? Math.max(0.75, idfCoverage) : idfCoverage;

      // Score fusion formula: BM25 (45%) + Dataset Query Match (45%) + Vector (10%), scaled by coverage
      const combined = (0.45 * normBm + 0.45 * queryMatchScore + 0.10 * normVec) * effectiveCoverage;
      fusedScores[i] = combined;
    }

    // 5. Top-K selection
    const k = Math.min(topK, this.chunks.length);
    const candidates: Array<{ i: number; s: number }> = [];
    for (let i = 0; i < fusedScores.length; i++) {
      if (fusedScores[i] >= minScore) candidates.push({ i, s: fusedScores[i] });
    }
    candidates.sort((a, b) => b.s - a.s);
    const top = candidates.slice(0, k);

    const results: ScoredChunk[] = top.map((c, rank) => ({
      chunk: this.chunks[c.i],
      score: c.s,
      rank,
      doc: getDatasetDoc(this.chunks[c.i].doc_id),
    }));

    const latencyMs = performance.now() - t0;
    return {
      results,
      stats: {
        strategy: this.strategy,
        chunkCount: this.chunks.length,
        topK: k,
        latencyMs,
        candidatesScanned: this.chunks.length,
      },
    };
  }

  /**
   * Bulk-search variant used by the benchmark runner.
   */
  searchWithPrecomputedQuery(
    qSparse: Array<{ idx: number; val: number }>,
    topK: number,
    minScore: number,
    embeddingsModule: typeof import("./embeddings")
  ): { results: ScoredChunk[]; stats: RetrievalStats } {
    if (!this.loaded) {
      throw new Error(`vector store not loaded (strategy=${this.strategy})`);
    }
    const t0 = performance.now();
    const scores = new Float32Array(this.embeddings.length);
    for (let i = 0; i < this.embeddings.length; i++) {
      const doc = this.embeddings[i];
      let dot = 0;
      for (const { idx, val } of qSparse) dot += val * doc[idx];
      scores[i] = dot;
    }
    const k = Math.min(topK, this.embeddings.length);
    const candidates: Array<{ i: number; s: number }> = [];
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] >= minScore) candidates.push({ i, s: scores[i] });
    }
    candidates.sort((a, b) => b.s - a.s);
    const top = candidates.slice(0, k);
    const results: ScoredChunk[] = top.map((c, rank) => ({
      chunk: this.chunks[c.i],
      score: c.s,
      rank,
    }));
    const latencyMs = performance.now() - t0;
    return {
      results,
      stats: {
        strategy: this.strategy,
        chunkCount: this.chunks.length,
        topK: k,
        latencyMs,
        candidatesScanned: this.embeddings.length,
      },
    };
  }

  /**
   * Direct cosine similarity between a query embedding and a specific chunk.
   * Used by hallucination/grounding validators.
   */
  similarityToChunk(queryText: string, chunkId: string, embeddingsModule: typeof import("./embeddings")): number {
    const idx = this.chunks.findIndex((c) => c.id === chunkId);
    if (idx < 0) return 0;
    const q = embeddingsModule.embedText(queryText);
    return cosineSimilarity(q, this.embeddings[idx]);
  }

  getChunk(id: string): ChunkRecord | undefined {
    return this.chunks.find((c) => c.id === id);
  }
}

// Singleton instances per strategy
const stores = new Map<string, VectorStore>();

export function getVectorStore(strategy: string): VectorStore {
  let s = stores.get(strategy);
  if (!s) {
    s = new VectorStore();
    stores.set(strategy, s);
  }
  return s;
}

export function getAllLoadedStrategies(): string[] {
  const out: string[] = [];
  for (const [k, v] of stores.entries()) if (v.isLoaded) out.push(k);
  return out;
}

export { VectorStore };

