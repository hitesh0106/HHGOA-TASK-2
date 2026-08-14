import { describe, test, expect } from "bun:test";
import { computeStats, formatStats } from "@/lib/benchmarks/stats";

describe("benchmark stats", () => {
  test("computeStats handles empty array", () => {
    const s = computeStats([]);
    expect(s.n).toBe(0);
    expect(s.p50).toBe(0);
    expect(s.p100).toBe(0);
  });

  test("computeStats handles single sample", () => {
    const s = computeStats([42]);
    expect(s.n).toBe(1);
    expect(s.min).toBe(42);
    expect(s.p50).toBe(42);
    expect(s.p100).toBe(42);
  });

  test("computeStats computes percentiles correctly", () => {
    // 10 samples: 1..10
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const s = computeStats(samples);
    expect(s.n).toBe(10);
    expect(s.min).toBe(1);
    expect(s.p100).toBe(10);
    expect(s.mean).toBe(5.5);
    expect(s.p50).toBeGreaterThanOrEqual(5);
    expect(s.p50).toBeLessThanOrEqual(6);
    expect(s.p70).toBeGreaterThanOrEqual(7);
    expect(s.p70).toBeLessThanOrEqual(8);
  });

  test("computeStats stddev is non-negative", () => {
    const s = computeStats([1, 2, 3, 4, 5]);
    expect(s.stddev).toBeGreaterThan(0);
  });

  test("computeStats stddev is 0 for constant array", () => {
    const s = computeStats([5, 5, 5, 5]);
    expect(s.stddev).toBe(0);
  });

  test("formatStats returns human-readable string", () => {
    const s = computeStats([10, 20, 30, 40, 50]);
    const str = formatStats(s);
    expect(str).toContain("n=5");
    expect(str).toContain("p50=");
    expect(str).toContain("p100=");
    expect(str).toContain("ms");
  });

  test("formatStats handles empty array", () => {
    const s = computeStats([]);
    expect(formatStats(s)).toBe("no samples");
  });

  test("computeStats is sorted-input-agnostic", () => {
    const a = computeStats([3, 1, 2, 5, 4]);
    const b = computeStats([1, 2, 3, 4, 5]);
    expect(a.p50).toBe(b.p50);
    expect(a.p100).toBe(b.p100);
    expect(a.mean).toBe(b.mean);
  });
});
