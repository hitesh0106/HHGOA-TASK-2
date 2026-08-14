import { describe, test, expect } from "bun:test";
import {
  embedText,
  tokenize,
  cosineSimilarity,
  sparseEmbedding,
  EMBEDDING_DIM,
  setIdf,
  clearIdf,
} from "@/lib/embeddings";

describe("embeddings", () => {
  test("embedText returns a vector of the correct dimension", () => {
    const v = embedText("hello world");
    expect(v.length).toBe(EMBEDDING_DIM);
  });

  test("embedText is deterministic", () => {
    const a = embedText("the quick brown fox");
    const b = embedText("the quick brown fox");
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test("embedText produces a zero vector for empty input", () => {
    const v = embedText("");
    expect(v.every((x) => x === 0)).toBe(true);
  });

  test("embedText produces L2-normalized vectors", () => {
    const v = embedText("this is a longer text with multiple tokens to ensure non-zero output");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  test("cosine similarity of identical text is 1", () => {
    const a = embedText("hello world foo bar");
    const b = embedText("hello world foo bar");
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 4);
  });

  test("cosine similarity of unrelated text is low", () => {
    const a = embedText("quantum mechanics physics");
    const b = embedText("cooking recipes pasta italian");
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeLessThan(0.5);
  });

  test("cosine similarity of similar text is higher than dissimilar", () => {
    const q = embedText("what is a corporation");
    const a = embedText("a corporation is a company authorized to act as a single entity");
    const b = embedText("the weather today is sunny and warm");
    const simA = cosineSimilarity(q, a);
    const simB = cosineSimilarity(q, b);
    expect(simA).toBeGreaterThan(simB);
  });

  test("tokenize lowercases and removes stopwords", () => {
    const tokens = tokenize("The Quick BROWN Fox");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("fox");
    expect(tokens).not.toContain("the"); // stopword
  });

  test("sparseEmbedding returns only non-zero indices", () => {
    const sparse = sparseEmbedding("hello world");
    expect(sparse.length).toBeGreaterThan(0);
    expect(sparse.length).toBeLessThan(EMBEDDING_DIM);
    for (const { idx, val } of sparse) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(EMBEDDING_DIM);
      expect(val).not.toBe(0);
    }
  });

  test("IDF affects embedding weights", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    const noIdf = embedText(text);
    setIdf({ quick: 5.0, brown: 5.0, fox: 5.0 });
    const withIdf = embedText(text);
    clearIdf();
    // Vectors should be different (after normalization, the magnitudes still differ)
    const sim = cosineSimilarity(noIdf, withIdf);
    expect(sim).toBeLessThan(1.0);
  });
});
