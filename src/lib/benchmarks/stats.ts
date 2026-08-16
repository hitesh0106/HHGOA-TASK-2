/**
 * Benchmark Statistics
 * ====================
 *
 * Latency statistics: P50, P70, P90, P95, P99, P100 (max), mean, stddev.
 * Used by the benchmark runner to summarize measurements across many queries.
 */

export interface LatencyStats {
  n: number;
  min: number;
  p50: number;
  p70: number;
  p90: number;
  p95: number;
  p99: number;
  p100: number;
  mean: number;
  stddev: number;
}

/**
 * Compute latency stats from an array of measurements (in ms).
 * Returns zeros if the array is empty.
 */
export function computeStats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { n: 0, min: 0, p50: 0, p70: 0, p90: 0, p95: 0, p99: 0, p100: 0, mean: 0, stddev: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const variance = sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  const percentile = (p: number) => {
    if (n === 1) return sorted[0];
    // Use nearest-rank method
    const idx = Math.min(n - 1, Math.max(0, Math.ceil((p / 100) * n) - 1));
    return sorted[idx];
  };

  return {
    n,
    min: sorted[0],
    p50: percentile(50),
    p70: percentile(70),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
    p100: sorted[n - 1],
    mean,
    stddev,
  };
}

/**
 * Format a stats object as a human-readable string for display.
 */
export function formatStats(s: LatencyStats, unit = "ms"): string {
  if (s.n === 0) return "no samples";
  return [
    `n=${s.n}`,
    `min=${s.min.toFixed(2)}${unit}`,
    `p50=${s.p50.toFixed(2)}${unit}`,
    `p70=${s.p70.toFixed(2)}${unit}`,
    `p90=${s.p90.toFixed(2)}${unit}`,
    `p95=${s.p95.toFixed(2)}${unit}`,
    `p99=${s.p99.toFixed(2)}${unit}`,
    `p100=${s.p100.toFixed(2)}${unit}`,
    `mean=${s.mean.toFixed(2)}${unit}`,
    `stddev=${s.stddev.toFixed(2)}${unit}`,
  ].join("  ");
}
