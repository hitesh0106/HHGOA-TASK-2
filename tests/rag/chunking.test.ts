import { describe, test, expect } from "bun:test";
import {
  chunkFixed,
  chunkOverlapping,
  chunkSemantic,
  chunkMetadataAware,
  chunkWith,
  splitSentences,
  CHUNKING_STRATEGIES,
} from "@/lib/chunking";

const SAMPLE_TEXT =
  "This is the first sentence. This is the second sentence! Is this the third? Yes, it is. And here is a fourth sentence that is somewhat longer than the others to test the word-count-based chunking logic.";

const PARAGRAPH_TEXT = `First paragraph with some text about topic one.

Second paragraph about a different topic. It has multiple sentences. The second sentence here. And a third one for good measure.

Third paragraph is short.`;

describe("chunking strategies", () => {
  test("fixed-size chunking produces non-overlapping word chunks", () => {
    const chunks = chunkFixed(SAMPLE_TEXT, 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.strategy === "fixed")).toBe(true);
    // First chunk should have at most 10 words
    expect(chunks[0].text.split(/\s+/).length).toBeLessThanOrEqual(10);
    // No overlap: word_offset should advance by chunk_size
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1].metadata.word_offset as number;
      const curr = chunks[i].metadata.word_offset as number;
      expect(curr).toBe(prev + 10);
    }
  });

  test("overlapping chunking produces chunks with overlap", () => {
    const chunks = chunkOverlapping(SAMPLE_TEXT, 10, 3);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.strategy === "overlapping")).toBe(true);
    // Step should be chunk_size - overlap = 7
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1].metadata.word_offset as number;
      const curr = chunks[i].metadata.word_offset as number;
      expect(curr).toBe(prev + 7);
    }
  });

  test("semantic chunking respects sentence boundaries", () => {
    const chunks = chunkSemantic(SAMPLE_TEXT, 2, 100);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.strategy === "semantic")).toBe(true);
    // Each chunk should contain at least one sentence-ending punctuation
    for (const c of chunks) {
      expect(/[.!?]/.test(c.text)).toBe(true);
    }
  });

  test("metadata-aware chunking splits on paragraphs", () => {
    const chunks = chunkMetadataAware(PARAGRAPH_TEXT, 1000);
    expect(chunks.length).toBe(3); // 3 paragraphs
    expect(chunks.every((c) => c.strategy === "metadata-aware")).toBe(true);
    expect(chunks[0].metadata.paragraph_index).toBe(0);
    expect(chunks[1].metadata.paragraph_index).toBe(1);
    expect(chunks[2].metadata.paragraph_index).toBe(2);
    expect(chunks[0].metadata.is_paragraph_start).toBe(true);
  });

  test("metadata-aware splits long paragraphs on sentences", () => {
    const longPara = Array.from({ length: 50 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = chunkMetadataAware(longPara, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.is_paragraph_start).toBe(true);
    expect(chunks[1].metadata.is_paragraph_start).toBe(false);
  });

  test("chunkWith dispatches to the correct strategy", () => {
    for (const strategy of CHUNKING_STRATEGIES) {
      const chunks = chunkWith(strategy, SAMPLE_TEXT);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every((c) => c.strategy === strategy)).toBe(true);
    }
  });

  test("chunkWith throws on unknown strategy", () => {
    expect(() => chunkWith("unknown" as any, SAMPLE_TEXT)).toThrow();
  });

  test("splitSentences handles various punctuation", () => {
    const s = splitSentences("Hello world. How are you? I am fine! Done.");
    expect(s.length).toBe(4);
  });

  test("splitSentences returns empty array for empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });
});
