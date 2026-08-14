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
import { cosineSimilarity } from "./embeddings";

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
}

export interface RetrievalStats {
  strategy: string;
  chunkCount: number;
  topK: number;
  latencyMs: number;
  candidatesScanned: number;
}

class VectorStore {
  private chunks: ChunkRecord[] = [];
  private embeddings: Float32Array[] = [];
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
   * Load a pre-computed vector store from disk. Throws if the file is missing
   * or malformed.
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
    this.loaded = true;
  }

  /**
   * Top-K cosine similarity search.
   *
   * @param queryText raw query string
   * @param topK number of results to return
   * @param minScore discard results below this threshold
   * @returns scored chunks (sorted by score desc) + retrieval stats
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

    // Sparse query embedding + sparse dot product for speed
    const qSparse = embeddingsModule.sparseEmbedding(queryText);
    const scores = new Float32Array(this.embeddings.length);
    for (let i = 0; i < this.embeddings.length; i++) {
      const doc = this.embeddings[i];
      let dot = 0;
      for (const { idx, val } of qSparse) dot += val * doc[idx];
      scores[i] = dot;
    }

    // Partial selection of top-K (more efficient than full sort for large N)
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
   * Bulk-search variant used by the benchmark runner to amortize query
   * embedding cost across multiple queries (still pure read).
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
   * Used by hallucination/grouding validators.
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
