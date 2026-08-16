/**
 * Comprehensive Retrieval Accuracy & Grounding Verification Script
 * =================================================================
 *
 * Verifies that the dual-engine RAG system accurately retrieves correct documents
 * and generates grounded answers across all 4 chunking strategies for:
 *  1. In-corpus MSMARCO-XI dataset queries
 *  2. Conversational paraphrases and morphologically varied queries
 *  3. Negative / Out-of-corpus queries (ensuring zero hallucination & safe refusal)
 *  4. Latency verification (<50ms Task 2 SLA)
 */

import { ensureVectorStoresLoaded } from "../src/lib/init";
import { retrieve } from "../src/lib/retrieval";
import { synthesizeFastGroundedAnswer } from "../src/lib/llm/harness";
import { CHUNKING_STRATEGIES } from "../src/lib/chunking";

interface TestCase {
  query: string;
  expectedDocId?: string;
  expectedDocIds?: string[];
  expectedAnswerKeyword?: string;
  mustRefuse?: boolean;
  category: "dataset-exact" | "paraphrase" | "negative-refusal";
}

const TEST_CASES: TestCase[] = [
  // 1. Exact & near-exact dataset queries (Ground-truth MSMARCO-XI 500-doc subset)
  {
    query: "What is a corporation?",
    expectedDocId: "san_0",
    expectedAnswerKeyword: "corporation",
    category: "dataset-exact",
  },
  {
    query: "why did rachel carson write an obligation to endure",
    expectedDocIds: ["san_1", "san_2"],
    expectedAnswerKeyword: "Rachel Carson",
    category: "dataset-exact",
  },
  {
    query: "honesty or integrity definition",
    expectedDocIds: ["san_3", "san_4"],
    expectedAnswerKeyword: "honesty",
    category: "dataset-exact",
  },
  {
    query: "how many women did frank gifford marry",
    expectedDocId: "san_5",
    expectedAnswerKeyword: "three",
    category: "dataset-exact",
  },
  {
    query: "how fast does an eagle travel",
    expectedDocId: "san_6",
    expectedAnswerKeyword: "30 to 55 mph",
    category: "dataset-exact",
  },
  {
    query: "stubhub toll free number",
    expectedDocId: "san_7",
    expectedAnswerKeyword: "866-788-2482",
    category: "dataset-exact",
  },
  {
    query: "does delta fly to bangalore",
    expectedDocId: "san_8",
    expectedAnswerKeyword: "Yes",
    category: "dataset-exact",
  },
  {
    query: "how long for cantaloupe to mature",
    expectedDocId: "san_9",
    expectedAnswerKeyword: "90 days",
    category: "dataset-exact",
  },

  // 2. Paraphrases & Conversational Variations
  {
    query: "what's a corporation",
    expectedDocId: "san_0",
    expectedAnswerKeyword: "corporation",
    category: "paraphrase",
  },
  {
    query: "Can you tell me what a corporation is?",
    expectedDocId: "san_0",
    expectedAnswerKeyword: "corporation",
    category: "paraphrase",
  },
  {
    query: "Delta Fly To Bangalore",
    expectedDocId: "san_8",
    expectedAnswerKeyword: "Yes",
    category: "paraphrase",
  },
  {
    query: "Can Delta take me to Bangalore?",
    expectedDocId: "san_8",
    expectedAnswerKeyword: "Yes",
    category: "paraphrase",
  },
  {
    query: "Does Delta Airlines operate flights to Bangalore?",
    expectedDocId: "san_8",
    expectedAnswerKeyword: "Yes",
    category: "paraphrase",
  },
  {
    query: "How fast can an eagle travel?",
    expectedDocId: "san_6",
    expectedAnswerKeyword: "30 to 55 mph",
    category: "paraphrase",
  },
  {
    query: "How quickly can an eagle fly?",
    expectedDocId: "san_6",
    expectedAnswerKeyword: "30 to 55 mph",
    category: "paraphrase",
  },
  {
    query: "What is the travel speed of an eagle?",
    expectedDocId: "san_6",
    expectedAnswerKeyword: "30 to 55 mph",
    category: "paraphrase",
  },
  {
    query: "Why did Rachel Carson write The Obligation to Endure?",
    expectedDocIds: ["san_1", "san_2"],
    expectedAnswerKeyword: "Rachel Carson",
    category: "paraphrase",
  },
  {
    query: "What is Stubhub customer service telephone helpline?",
    expectedDocId: "san_7",
    expectedAnswerKeyword: "866-788-2482",
    category: "paraphrase",
  },
  {
    query: "how long does it take for a cantaloupe to mature",
    expectedDocId: "san_9",
    expectedAnswerKeyword: "90 days",
    category: "paraphrase",
  },
  {
    query: "definition of integrity vs honesty",
    expectedDocIds: ["san_3", "san_4"],
    expectedAnswerKeyword: "honesty",
    category: "paraphrase",
  },
  {
    query: "how many wives has frank gifford had",
    expectedDocId: "san_5",
    expectedAnswerKeyword: "three",
    category: "paraphrase",
  },

  // 3. Negative / Out-of-Corpus / Non-English Queries (Must Safely Refuse)
  {
    query: "What does blood in stool mean?",
    mustRefuse: true,
    category: "negative-refusal",
  },
  {
    query: "what is the capital of france",
    mustRefuse: true,
    category: "negative-refusal",
  },
  {
    query: "What is a standard deduction for taxes?",
    mustRefuse: true,
    category: "negative-refusal",
  },
  {
    query: "who won the 2026 superbowl",
    mustRefuse: true,
    category: "negative-refusal",
  },
  {
    query: "hello",
    mustRefuse: true,
    category: "negative-refusal",
  },
  {
    query: "कॉरपोरेशन क्या है?",
    mustRefuse: true,
    category: "negative-refusal",
  },
  {
    query: "કોર્પોરેશન શું છે?",
    mustRefuse: true,
    category: "negative-refusal",
  },
];

async function runVerification() {
  console.log("================================================================================");
  console.log("HACKER HOUSE GOA 2026 — TASK 2 RETRIEVAL ACCURACY & GROUNDING VERIFICATION");
  console.log("================================================================================");

  await ensureVectorStoresLoaded();

  // Warmup run
  retrieve({ query: "warmup test query", strategy: "overlapping", topK: 5 });

  let totalTests = 0;
  let totalPassed = 0;
  const latencies: number[] = [];

  for (const strategy of CHUNKING_STRATEGIES) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`EVALUATING STRATEGY: [${strategy.toUpperCase()}]`);
    console.log(`--------------------------------------------------------------------------------`);

    let strategyPassed = 0;

    for (const tc of TEST_CASES) {
      totalTests++;
      const t0 = performance.now();

      const retResult = retrieve({
        query: tc.query,
        strategy,
        topK: 5,
        minScore: 0.05,
      });

      const synthResult = synthesizeFastGroundedAnswer(tc.query, retResult.scoredChunks);
      const totalPipelineMs = performance.now() - t0;
      latencies.push(totalPipelineMs);

      let passed = false;
      let failureReason = "";

      if (tc.mustRefuse) {
        if (synthResult.confidence === "refused" && !synthResult.grounded) {
          passed = true;
        } else {
          failureReason = `Expected REFUSAL, but got answer: "${synthResult.answer}"`;
        }
      } else {
        const topDoc = retResult.scoredChunks[0]?.chunk?.doc_id;
        const validDocIds = tc.expectedDocIds ?? (tc.expectedDocId ? [tc.expectedDocId] : []);
        const matchesDoc = validDocIds.includes(topDoc);
        const matchesAnswer =
          tc.expectedAnswerKeyword &&
          synthResult.answer.toLowerCase().includes(tc.expectedAnswerKeyword.toLowerCase());
        const hasCitation = synthResult.citations.length > 0 && /\[C\d+\]/.test(synthResult.answer);

        if (matchesDoc && matchesAnswer && hasCitation && synthResult.grounded) {
          passed = true;
        } else {
          if (!matchesDoc) {
            failureReason = `Doc mismatch: got ${topDoc}, expected ${validDocIds.join(" or ")}`;
          } else if (!matchesAnswer) {
            failureReason = `Answer missing keyword "${tc.expectedAnswerKeyword}": got "${synthResult.answer}"`;
          } else if (!hasCitation) {
            failureReason = `Missing citation marker [C1]`;
          } else {
            failureReason = `Answer not marked grounded`;
          }
        }
      }

      if (passed) {
        strategyPassed++;
        totalPassed++;
        console.log(`  ✓ PASS [${tc.category}] "${tc.query}"`);
        console.log(`         Doc: ${retResult.scoredChunks[0]?.chunk?.doc_id ?? "NONE"} | Latency: ${totalPipelineMs.toFixed(2)}ms`);
        console.log(`         Answer: ${synthResult.answer}`);
      } else {
        console.log(`  ✗ FAIL [${tc.category}] "${tc.query}"`);
        console.log(`         Reason: ${failureReason}`);
        console.log(`         Top Chunks: ${retResult.scoredChunks.map((s) => `${s.chunk.doc_id}(${s.score.toFixed(2)})`).join(", ")}`);
        console.log(`         Answer: ${synthResult.answer}`);
      }
    }

    console.log(`\nStrategy [${strategy}] Result: ${strategyPassed} / ${TEST_CASES.length} PASSED`);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p100 = latencies[latencies.length - 1];

  console.log("\n================================================================================");
  console.log("FINAL VERIFICATION SUMMARY");
  console.log("================================================================================");
  console.log(`TOTAL TEST RUNS: ${totalTests}`);
  console.log(`PASSED:         ${totalPassed} / ${totalTests} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
  console.log(`LATENCY STATS:  P50 = ${p50.toFixed(2)}ms | P95 = ${p95.toFixed(2)}ms | P100 = ${p100.toFixed(2)}ms`);
  console.log(`TASK 2 SLA (<50ms P100): ${p100 < 50 ? "✓ STRICTLY SATISFIED" : "✗ EXCEEDED"}`);
  console.log("================================================================================\n");

  if (totalPassed < totalTests) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification failed with unhandled error:", err);
  process.exit(1);
});
