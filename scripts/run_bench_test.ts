import { runPipeline } from "../src/lib/pipeline";
import { ensureVectorStoresLoaded } from "../src/lib/init";
import { computeStats, formatStats } from "../src/lib/benchmarks/stats";

export const BENCHMARK_31_QUERIES = [
  // 1-5: Known core queries
  "What is a corporation?",
  "why did rachel carson write an obligation to endure",
  "stubhub toll free number",
  "does delta fly to bangalore",
  "how fast does an eagle travel",

  // 6-10: MSMARCO dataset queries
  "honesty or integrity definition",
  "how many women did frank gifford marry",
  "how long for cantaloupe to mature",
  "what is a standard deduction for taxes",
  "what does blood in stool mean",

  // 11-15: Additional factual MSMARCO queries
  "book delta bangalore paris flight air tickets",
  "definition of business personal property",
  "Andre the Giant birthplace and height",
  "Swazi national language overview",
  "foods and supplements to lower blood sugar",

  // 16-20: Paraphrased queries (NOT identical to dataset text)
  "Can someone explain what defines a corporation entity?",
  "Why was The Obligation to Endure written by Carson?",
  "What is Stubhub customer service telephone helpline?",
  "Are there flights on Delta between Bangalore and Paris?",
  "How many times was Frank Gifford married?",

  // 21-25: General knowledge queries
  "What is the definition of honesty in ethics?",
  "What is the toll-free contact for ticket support?",
  "How many wives did Gifford have in his life?",
  "What is descriptive cataloging in library science?",
  "What are the symptoms and causes of indigestion?",

  // 26-28: Unsupported queries (should refuse)
  "what is the capital of france",
  "who won the 2024 ICC T20 cricket world cup",
  "what is the quantum mechanical spin of a photon",

  // 29-31: Off-topic / conversational queries (should block/refuse)
  "hello",
  "hey there how are you doing today",
  "good morning assistant"
];

(async () => {
  await ensureVectorStoresLoaded();
  console.log("\n================================================================================");
  console.log("31-QUERY FULL-PIPELINE LATENCY BENCHMARK (ENGINE = FAST GROUNDED HARNESS)");
  console.log("================================================================================");

  const strategies = ["fixed", "overlapping", "semantic", "metadata-aware"] as const;

  for (const strategy of strategies) {
    // Warmup
    await runPipeline({ query: "warmup query text", strategy, engine: "fast" });

    const totalMsList: number[] = [];
    const retrievalMsList: number[] = [];
    const generationMsList: number[] = [];
    const guardrailMsList: number[] = [];

    const perQueryResults: Array<{
      query: string;
      answer: string;
      confidence: string;
      citation: number[];
      grounded: boolean;
      totalMs: number;
    }> = [];

    for (const q of BENCHMARK_31_QUERIES) {
      const res = await runPipeline({ query: q, strategy, engine: "fast" });
      const guardrailsMs =
        res.timings.inputGuardrailsMs +
        res.timings.retrievalGuardrailsMs +
        res.timings.outputGuardrailsMs;

      totalMsList.push(res.timings.totalMs);
      retrievalMsList.push(res.timings.retrievalMs);
      generationMsList.push(res.timings.generationMs);
      guardrailMsList.push(guardrailsMs);

      perQueryResults.push({
        query: q,
        answer: res.answer,
        confidence: res.confidence,
        citation: res.citations,
        grounded: res.grounded,
        totalMs: res.timings.totalMs,
      });
    }

    const totalStats = computeStats(totalMsList);
    const retStats = computeStats(retrievalMsList);
    const genStats = computeStats(generationMsList);
    const guardStats = computeStats(guardrailMsList);

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`STRATEGY: ${strategy.toUpperCase()} (31 Queries × Full Pipeline)`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`  TOTAL LATENCY      | ${formatStats(totalStats)}`);
    console.log(`  Retrieval Stage    | ${formatStats(retStats)}`);
    console.log(`  Generation Stage   | ${formatStats(genStats)}`);
    console.log(`  Guardrails Stage   | ${formatStats(guardStats)}`);

    const compliant = totalStats.p100 < 50;
    console.log(`  <50ms SLA Status   | ${compliant ? "✓ PASSED (P100 < 50ms)" : "✗ FAILED"}`);
  }

  // Print sample detailed query responses from overlapping strategy
  console.log("\n================================================================================");
  console.log("SAMPLE QUERY RESPONSES (Strategy: overlapping, Engine: fast)");
  console.log("================================================================================");
  const sampleQueries = [
    "What is a corporation?",
    "why did rachel carson write an obligation to endure",
    "stubhub toll free number",
    "does delta fly to bangalore",
    "Can someone explain what defines a corporation entity?",
    "what is the capital of france",
    "hello",
  ];

  for (const q of sampleQueries) {
    const res = await runPipeline({ query: q, strategy: "overlapping", engine: "fast" });
    console.log(`\nQ: "${q}"`);
    console.log(`  Answer:     ${res.answer}`);
    console.log(`  Confidence: ${res.confidence} | Grounded: ${res.grounded} | Citations: ${JSON.stringify(res.citations)} | Blocked: ${res.blocked}`);
    console.log(`  Timings:    Total: ${res.timings.totalMs.toFixed(3)}ms (Ret: ${res.timings.retrievalMs.toFixed(3)}ms, Gen: ${res.timings.generationMs.toFixed(3)}ms, Guard: ${(res.timings.inputGuardrailsMs + res.timings.retrievalGuardrailsMs + res.timings.outputGuardrailsMs).toFixed(3)}ms)`);
  }

  console.log("\n================================================================================\n");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
