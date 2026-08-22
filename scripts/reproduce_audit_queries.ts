/**
 * Phase 1: Reproduction test script for the 15 audit queries.
 * Runs all queries through the live runPipeline() and captures detailed metrics.
 */
import { runPipeline } from "../src/lib/pipeline";
import { ensureVectorStoresLoaded } from "../src/lib/init";
import { writeFileSync } from "node:fs";
import path from "node:path";

const AUDIT_QUERIES = [
  // ENGLISH
  { id: 1, category: "ENGLISH", query: "What is a corporation?" },
  { id: 2, category: "ENGLISH", query: "Explain what a corporation is in detail." },
  { id: 3, category: "ENGLISH", query: "Why is a corporation considered a separate legal entity?" },
  { id: 4, category: "ENGLISH", query: "What is a corporation, how is it formed, and what are its main characteristics?" },
  { id: 5, category: "ENGLISH", query: "Tell me everything available in the knowledge base about corporations." },
  // HINDI
  { id: 6, category: "HINDI", query: "कॉर्पोरेशन क्या है?" },
  { id: 7, category: "HINDI", query: "कॉर्पोरेशन क्या है? विस्तार से समझाइए।" },
  { id: 8, category: "HINDI", query: "कॉर्पोरेशन को एक अलग कानूनी इकाई क्यों माना जाता है?" },
  // HINGLISH
  { id: 9, category: "HINGLISH", query: "Corporation kya hota hai?" },
  { id: 10, category: "HINGLISH", query: "Corporation kya hota hai aur detail me samjhao?" },
  // BENGALI
  { id: 11, category: "BENGALI", query: "কর্পোরেশন কী?" },
  { id: 12, category: "BENGALI", query: "কর্পোরেশন কী? বিস্তারিতভাবে ব্যাখ্যা করুন।" },
  // UNANSWERABLE CONTROL TESTS
  { id: 13, category: "UNANSWERABLE_CONTROL", query: "Who is the current President of Mars?" },
  { id: 14, category: "UNANSWERABLE_CONTROL", query: "What is the secret phone number of the CEO of Mars?" },
  { id: 15, category: "UNANSWERABLE_CONTROL", query: "Explain the history of a fictional company that does not exist in the knowledge base." },
];

async function runAudit() {
  await ensureVectorStoresLoaded();
  console.log("===============================================================");
  console.log("PHASE 1: RUNNING REPRODUCTION MATRIX FOR 15 AUDIT QUERIES");
  console.log("===============================================================\n");

  const results: any[] = [];

  for (const q of AUDIT_QUERIES) {
    const res = await runPipeline({
      query: q.query,
      strategy: "overlapping",
      engine: "fast",
    });

    const topChunk = res.sources[0];

    const record = {
      id: q.id,
      category: q.category,
      query: q.query,
      detectedLanguage: res.detectedLanguage,
      languageName: res.languageName,
      strategy: res.strategy,
      topChunkId: topChunk?.chunk?.id ?? null,
      topChunkDocId: topChunk?.chunk?.doc_id ?? null,
      topChunkScore: topChunk?.score ?? 0,
      topChunkSnippet: topChunk?.chunk?.text ? topChunk.chunk.text.slice(0, 140) + "..." : null,
      scoredChunksCount: res.sources.length,
      answer: res.answer,
      confidence: res.confidence,
      grounded: res.grounded,
      citations: res.citations,
      guardrailCombinedPass: res.guardrails.combined.pass,
      guardrailBlockReasons: res.blockReasons,
      retrievalWarnings: res.retrievalWarnings,
      totalMs: res.timings.totalMs,
      retrievalMs: res.timings.retrievalMs,
      generationMs: res.timings.generationMs,
    };

    results.push(record);

    console.log(`[Q${q.id.toString().padStart(2, "0")}] [${q.category}] "${q.query}"`);
    console.log(`  Lang: ${res.languageName} (${res.detectedLanguage}) | Grounded: ${res.grounded} | Confidence: ${res.confidence}`);
    console.log(`  Top Chunk: ${topChunk?.chunk?.id ?? "NONE"} (Doc: ${topChunk?.chunk?.doc_id ?? "NONE"}, Score: ${topChunk?.score?.toFixed(4) ?? "0"})`);
    console.log(`  Answer: "${res.answer}"`);
    console.log(`  Latency: ${res.timings.totalMs.toFixed(2)}ms (Ret: ${res.timings.retrievalMs.toFixed(2)}ms, Gen: ${res.timings.generationMs.toFixed(2)}ms)`);
    console.log(`  Guardrails: pass=${res.guardrails.combined.pass} | Blocked: ${res.blocked} ${res.blockReasons.length > 0 ? "Reasons: " + res.blockReasons.join(", ") : ""}`);
    console.log("---------------------------------------------------------------");
  }

  const outPath = path.join(process.cwd(), "data", "audit_reproduction_before.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nSaved reproduction log to: ${outPath}`);
}

runAudit().catch(console.error);
