import 'dotenv/config';
import { ensureVectorStoresLoaded } from '../src/lib/init';
import { retrieve } from '../src/lib/retrieval';
import { runPipeline } from '../src/lib/pipeline';
import { getVectorStore } from '../src/lib/vector-db';

async function main() {
  console.log("==================================================");
  console.log("TESTING HYBRID RETRIEVAL FIX");
  console.log("==================================================");

  await ensureVectorStoresLoaded();

  // Test A: "What is the corporation?"
  console.log("\n--- TEST A: 'What is the corporation?' ---");
  const retA = retrieve({ query: "What is the corporation?", strategy: "overlapping", topK: 5 });
  console.log(`Retrieved ${retA.scoredChunks.length} chunks in ${retA.totalLatencyMs.toFixed(3)}ms:`);
  retA.scoredChunks.forEach((sc, i) => {
    console.log(`  Rank ${i + 1} | Score: ${sc.score.toFixed(4)} | Doc: ${sc.chunk.doc_id} | Chunk: ${sc.chunk.id} | ${sc.chunk.text.slice(0, 80)}...`);
  });
  const topDocA = retA.scoredChunks[0]?.chunk.doc_id;
  const isCorpTop = topDocA === 'san_0' || topDocA === 'san_257';
  const hasHarrison = retA.scoredChunks.some(sc => sc.chunk.doc_id === 'san_157');
  console.log(`VERDICT A: Corporation is Top Doc? ${isCorpTop ? 'PASS' : 'FAIL'} | Harrison Ford eliminated? ${!hasHarrison ? 'PASS' : 'FAIL'}`);

  // Test B: "why did rachel carson write an obligation to endure"
  console.log("\n--- TEST B: 'why did rachel carson write an obligation to endure' ---");
  const retB = retrieve({ query: "why did rachel carson write an obligation to endure", strategy: "overlapping", topK: 5 });
  retB.scoredChunks.forEach((sc, i) => {
    console.log(`  Rank ${i + 1} | Score: ${sc.score.toFixed(4)} | Doc: ${sc.chunk.doc_id} | ${sc.chunk.text.slice(0, 80)}...`);
  });
  const isRachelTop = retB.scoredChunks[0]?.chunk.doc_id === 'san_1';
  console.log(`VERDICT B: Rachel Carson is Top Doc? ${isRachelTop ? 'PASS' : 'FAIL'}`);

  // Test C: "stubhub toll free number"
  console.log("\n--- TEST C: 'stubhub toll free number' ---");
  const retC = retrieve({ query: "stubhub toll free number", strategy: "overlapping", topK: 5 });
  retC.scoredChunks.forEach((sc, i) => {
    console.log(`  Rank ${i + 1} | Score: ${sc.score.toFixed(4)} | Doc: ${sc.chunk.doc_id} | ${sc.chunk.text.slice(0, 80)}...`);
  });
  const isStubhubTop = retC.scoredChunks[0]?.chunk.doc_id === 'san_7';
  console.log(`VERDICT C: StubHub is Top Doc? ${isStubhubTop ? 'PASS' : 'FAIL'}`);

  // Test D: "does delta fly to bangalore"
  console.log("\n--- TEST D: 'does delta fly to bangalore' ---");
  const retD = retrieve({ query: "does delta fly to bangalore", strategy: "overlapping", topK: 5 });
  retD.scoredChunks.forEach((sc, i) => {
    console.log(`  Rank ${i + 1} | Score: ${sc.score.toFixed(4)} | Doc: ${sc.chunk.doc_id} | ${sc.chunk.text.slice(0, 80)}...`);
  });
  const isDeltaTop = retD.scoredChunks[0]?.chunk.doc_id === 'san_8';
  console.log(`VERDICT D: Delta is Top Doc? ${isDeltaTop ? 'PASS' : 'FAIL'}`);

  // Test E: Unsupported: "what is the capital of france"
  console.log("\n--- TEST E (Unsupported): 'what is the capital of france' ---");
  const pipeE = await runPipeline({ query: "what is the capital of france", strategy: "overlapping" });
  console.log(`Result E: Blocked=${pipeE.blocked} | Confidence=${pipeE.confidence} | Answer=${pipeE.answer.slice(0, 100)}...`);

  // Test F: Off-topic: "hello"
  console.log("\n--- TEST F (Off-topic): 'hello' ---");
  const pipeF = await runPipeline({ query: "hello", strategy: "overlapping" });
  console.log(`Result F: Blocked=${pipeF.blocked} | Confidence=${pipeF.confidence} | Reasons=${pipeF.blockReasons}`);

  // Run Test A through Full Pipeline to verify LLM citation & answer
  console.log("\n--- FULL PIPELINE TEST: 'What is the corporation?' ---");
  const pipeA = await runPipeline({ query: "What is the corporation?", strategy: "overlapping" });
  console.log(`Answer: ${pipeA.answer}`);
  console.log(`Confidence: ${pipeA.confidence}`);
  console.log(`Citations: ${JSON.stringify(pipeA.citations)}`);
  console.log(`Grounded: ${pipeA.grounded}`);
  console.log(`Blocked: ${pipeA.blocked}`);
  console.log(`Timings: ${JSON.stringify(pipeA.timings, null, 2)}`);
}

main().catch(console.error);
