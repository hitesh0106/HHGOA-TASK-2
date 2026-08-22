/**
 * Export TypeScript embedding vectors and generator answers for 10 test queries
 * to data/ts_parity_reference.json so that Python can verify parity.
 */
import { embedText, tokenize } from "../src/lib/embeddings";
import { synthesizeFastGroundedAnswer } from "../src/lib/llm/harness";
import { writeFileSync } from "node:fs";
import path from "node:path";

const TEST_INPUTS = [
  "test",
  "hello world",
  "What is a corporation?",
  "Delta Airlines Bangalore",
  "How fast can an eagle travel?",
  "",
  "!!! ???",
  "123 456 test",
  "Repeated repeated repeated repeated",
  "A corporation is a company or group of people authorized to act as a single entity and recognized as such in law.",
];

const results = TEST_INPUTS.map((input) => {
  const vec = Array.from(embedText(input));
  const tokens = tokenize(input);

  // Compute L2 norm
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));

  return {
    input,
    tokens,
    dimension: vec.length,
    norm,
    vector: vec,
  };
});

const outPath = path.join(process.cwd(), "data", "ts_parity_reference.json");
writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
console.log(`Exported ${results.length} reference vectors to ${outPath}`);
