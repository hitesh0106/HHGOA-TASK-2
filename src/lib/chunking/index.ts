/**
 * Chunking Strategies (TypeScript runtime)
 * =========================================
 *
 * Pure-TypeScript re-implementations of the 4 chunking strategies defined in
 * scripts/ingest_msmarco.py. These are used at runtime by:
 *   • The benchmark runner (to re-chunk a query for fairness)
 *   • The UI (to preview how each strategy would chunk a sample text)
 *   • Tests
 *
 * The actual vector stores are pre-computed by the Python ingestion script
 * using the SAME algorithms. These TS functions are kept for parity, so that
 * re-chunking at runtime produces identical results to ingestion.
 */

export type ChunkingStrategy = "fixed" | "overlapping" | "semantic" | "metadata-aware";

export interface Chunk {
  text: string;
  strategy: ChunkingStrategy;
  metadata: Record<string, unknown>;
}

export const CHUNKING_STRATEGIES: ChunkingStrategy[] = [
  "fixed",
  "overlapping",
  "semantic",
  "metadata-aware",
];

export const CHUNKING_DESCRIPTIONS: Record<ChunkingStrategy, { name: string; description: string; pros: string[]; cons: string[] }> = {
  fixed: {
    name: "Fixed-size",
    description: "Splits text into non-overlapping chunks of N words. Simple, deterministic, fastest.",
    pros: ["Trivially simple", "Deterministic", "Lowest memory overhead"],
    cons: ["Can break sentences mid-thought", "No context overlap between chunks"],
  },
  overlapping: {
    name: "Overlapping",
    description: "Sliding window of N words with K-word overlap between consecutive chunks.",
    pros: ["Preserves cross-boundary context", "Improves retrieval recall for boundary-spanning queries"],
    cons: ["Higher storage cost (~overlap/step ratio)", "May retrieve duplicate context"],
  },
  semantic: {
    name: "Semantic (sentence-aware)",
    description: "Groups whole sentences until a max word count is reached. Respects sentence-level semantics.",
    pros: ["Sentences stay intact", "Better for factoid retrieval", "Natural reading unit"],
    cons: ["Sentence splitter is heuristic", "Chunk size varies more"],
  },
  "metadata-aware": {
    name: "Metadata-aware (paragraph)",
    description: "Splits on paragraph boundaries; long paragraphs are further split on sentences. Each chunk keeps paragraph metadata.",
    pros: ["Best for structured docs", "Preserves section/document structure", "Rich metadata for filtering"],
    cons: ["Less effective on flat text", "Chunk count varies with structure"],
  },
};

// ---------------------------------------------------------------------------
// Sentence splitter (matches Python regex)
// ---------------------------------------------------------------------------
const SENT_SPLIT_RE = /(?<=[.!?])\s+|\n+/;

export function splitSentences(text: string): string[] {
  const parts = text
    .split(SENT_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : text.trim() ? [text.trim()] : [];
}

// ---------------------------------------------------------------------------
// Strategy 1: Fixed-size
// ---------------------------------------------------------------------------
export function chunkFixed(text: string, chunkSize = 100): Chunk[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: Chunk[] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const slice = words.slice(i, i + chunkSize).join(" ");
    chunks.push({
      text: slice,
      strategy: "fixed",
      metadata: { word_offset: i, chunk_size: chunkSize },
    });
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Strategy 2: Overlapping
// ---------------------------------------------------------------------------
export function chunkOverlapping(text: string, chunkSize = 100, overlap = 25): Chunk[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: Chunk[] = [];
  if (words.length === 0) return chunks;
  const step = Math.max(1, chunkSize - overlap);
  for (let i = 0; i < words.length; i += step) {
    const slice = words.slice(i, i + chunkSize).join(" ");
    chunks.push({
      text: slice,
      strategy: "overlapping",
      metadata: { word_offset: i, chunk_size: chunkSize, overlap },
    });
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Strategy 3: Semantic (sentence-boundary)
// ---------------------------------------------------------------------------
export function chunkSemantic(
  text: string,
  maxChunkSentences = 3,
  maxChunkWords = 120
): Chunk[] {
  const sentences = splitSentences(text);
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentWords = 0;
  for (const s of sentences) {
    const sw = s.split(/\s+/).filter((w) => w.length > 0).length;
    if (
      current.length > 0 &&
      (currentWords + sw > maxChunkWords || current.length >= maxChunkSentences)
    ) {
      chunks.push({
        text: current.join(" "),
        strategy: "semantic",
        metadata: { sentence_count: current.length, word_count: currentWords },
      });
      current = [];
      currentWords = 0;
    }
    current.push(s);
    currentWords += sw;
  }
  if (current.length > 0) {
    chunks.push({
      text: current.join(" "),
      strategy: "semantic",
      metadata: { sentence_count: current.length, word_count: currentWords },
    });
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Strategy 4: Metadata-aware (paragraph)
// ---------------------------------------------------------------------------
export function chunkMetadataAware(text: string, maxChunkWords = 120): Chunk[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const chunks: Chunk[] = [];
  paragraphs.forEach((para, pIdx) => {
    const words = para.split(/\s+/).filter((w) => w.length > 0);
    if (words.length <= maxChunkWords) {
      chunks.push({
        text: para,
        strategy: "metadata-aware",
        metadata: {
          paragraph_index: pIdx,
          paragraph_total: paragraphs.length,
          is_paragraph_start: true,
          word_count: words.length,
        },
      });
    } else {
      const sentences = splitSentences(para);
      let current: string[] = [];
      let currentWords = 0;
      let isStart = true;
      for (const s of sentences) {
        const sw = s.split(/\s+/).filter((w) => w.length > 0).length;
        if (current.length > 0 && currentWords + sw > maxChunkWords) {
          chunks.push({
            text: current.join(" "),
            strategy: "metadata-aware",
            metadata: {
              paragraph_index: pIdx,
              paragraph_total: paragraphs.length,
              is_paragraph_start: isStart,
              word_count: currentWords,
            },
          });
          current = [];
          currentWords = 0;
          isStart = false;
        }
        current.push(s);
        currentWords += sw;
      }
      if (current.length > 0) {
        chunks.push({
          text: current.join(" "),
          strategy: "metadata-aware",
          metadata: {
            paragraph_index: pIdx,
            paragraph_total: paragraphs.length,
            is_paragraph_start: isStart,
            word_count: currentWords,
          },
        });
      }
    }
  });
  return chunks;
}

// ---------------------------------------------------------------------------
// Strategy registry
// ---------------------------------------------------------------------------
export const CHUNKERS: Record<
  ChunkingStrategy,
  (text: string) => Chunk[]
> = {
  fixed: (t) => chunkFixed(t),
  overlapping: (t) => chunkOverlapping(t),
  semantic: (t) => chunkSemantic(t),
  "metadata-aware": (t) => chunkMetadataAware(t),
};

export function chunkWith(strategy: ChunkingStrategy, text: string): Chunk[] {
  const fn = CHUNKERS[strategy];
  if (!fn) throw new Error(`unknown chunking strategy: ${strategy}`);
  return fn(text);
}
