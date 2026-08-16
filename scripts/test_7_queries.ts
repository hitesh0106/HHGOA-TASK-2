import { ensureVectorStoresLoaded } from "../src/lib/init";
import { runPipeline } from "../src/lib/pipeline";

async function main() {
  await ensureVectorStoresLoaded();
  const queries = [
    "What is a corporation?",
    "Does Delta fly to Bangalore?",
    "How fast can an eagle travel?",
    "StubHub toll free number",
    "Why did Rachel Carson write The Obligation to Endure?",
    "What is a standard deduction for taxes?",
    "How long for cantaloupe to mature?"
  ];

  console.log("=== TARGET QUERIES EVALUATION (Strategy: overlapping, Engine: fast) ===\n");
  for (const q of queries) {
    const res = await runPipeline({ query: q, strategy: "overlapping", engine: "fast" });
    console.log(`QUERY:          "${q}"`);
    console.log(`TOP DOC:        ${res.sources[0]?.chunk?.doc_id ?? "NONE"} (Score: ${res.sources[0]?.score?.toFixed(3) ?? 0})`);
    console.log(`ANSWER:         ${res.answer}`);
    console.log(`CITATIONS:      [${res.citations.join(", ")}]`);
    console.log(`GROUNDED:       ${res.grounded}`);
    console.log(`CONFIDENCE:     ${res.confidence}`);
    console.log(`TIMINGS:        Total: ${res.timings.totalMs.toFixed(2)}ms (Ret: ${res.timings.retrievalMs.toFixed(2)}ms, Gen: ${res.timings.generationMs.toFixed(2)}ms, Guard: ${(res.timings.inputGuardrailsMs + res.timings.retrievalGuardrailsMs + res.timings.outputGuardrailsMs).toFixed(2)}ms)`);
    console.log(`STATUS:         ${res.grounded && res.citations.length > 0 ? "✓ PASS" : res.confidence === "refused" ? "✓ REFUSED (Out of Corpus)" : "FAIL"}`);
    console.log("--------------------------------------------------------------------------------");
  }
}
main();
