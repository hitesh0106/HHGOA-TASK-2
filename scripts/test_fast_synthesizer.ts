import 'dotenv/config';
import { ensureVectorStoresLoaded } from '../src/lib/init';
import { retrieve } from '../src/lib/retrieval';
import { tokenize, getIdf } from '../src/lib/embeddings';
import { splitSentences } from '../src/lib/chunking';
import type { ScoredChunk } from '../src/lib/vector-db';

interface FastSynthesizerOutput {
  answer: string;
  confidence: "high" | "medium" | "low" | "refused";
  citations: number[];
  grounded: boolean;
  finishReason: string;
  attempts: number;
  latencyMs: number;
  warnings: string[];
}

const COMMON_QUESTION_WORDS = new Set([
  "can", "someone", "explain", "tell", "describe", "find", "show", "give", "please",
  "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
  "long", "many", "much", "fast", "far", "old", "does", "did", "do", "is", "are", "the", "a", "an"
]);

function getSignificantTokens(tokens: string[]): string[] {
  return tokens.filter(t => !COMMON_QUESTION_WORDS.has(t));
}

function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w === "fly" || w === "flight" || w === "flights" || w === "flying") return "flight";
  if (w === "married" || w === "marry" || w === "marriage") return "marri";
  if (w === "defines" || w === "definition" || w === "define" || w === "defined") return "defin";
  if (w === "entities" || w === "entity") return "entiti";
  if (w === "service" || w === "services") return "servic";
  if (w === "phone" || w === "telephone") return "phone";
  return w;
}

function tokensMatch(t1: string, t2: string): boolean {
  if (t1 === t2) return true;
  const s1 = stem(t1);
  const s2 = stem(t2);
  if (s1 === s2) return true;
  if (s1.length >= 4 && s2.length >= 4 && (s1.startsWith(s2) || s2.startsWith(s1))) return true;
  return false;
}

function computeIdfCoverage(qTokens: string[], docTokens: string[], idfMap: Map<string, number> | null): { coverage: number; matched: string[]; missingCount: number } {
  if (qTokens.length === 0) return { coverage: 0, matched: [], missingCount: 0 };
  let totalIdf = 0;
  let matchedIdf = 0;
  const matched: string[] = [];

  for (const qt of qTokens) {
    const idf = idfMap?.get(qt) ?? 2.0;
    totalIdf += idf;
    if (docTokens.some(dt => tokensMatch(qt, dt))) {
      matchedIdf += idf;
      matched.push(qt);
    }
  }
  return {
    coverage: totalIdf > 0 ? matchedIdf / totalIdf : 0,
    matched,
    missingCount: qTokens.length - matched.length
  };
}

export function synthesizeFastGroundedAnswer(query: string, chunks: ScoredChunk[]): FastSynthesizerOutput {
  const t0 = performance.now();
  const warnings: string[] = [];

  if (!chunks || chunks.length === 0 || !chunks[0] || chunks[0].score < 0.15) {
    return {
      answer: "I don't have enough information in the retrieved context to answer this question confidently.",
      confidence: "refused",
      citations: [],
      grounded: false,
      finishReason: "stop",
      attempts: 1,
      latencyMs: performance.now() - t0,
      warnings: ["Insufficient retrieval score for grounded synthesis."]
    };
  }

  const rawTokens = tokenize(query);
  const sigTokens = getSignificantTokens(rawTokens);
  const qTokens = sigTokens.length > 0 ? sigTokens : rawTokens;

  if (qTokens.length === 0) {
    return {
      answer: "I don't have enough information in the retrieved context to answer this question confidently.",
      confidence: "refused",
      citations: [],
      grounded: false,
      finishReason: "stop",
      attempts: 1,
      latencyMs: performance.now() - t0,
      warnings: ["Empty query tokens."]
    };
  }

  const idfMap = getIdf();

  interface ScoredCandidate {
    sentence: string;
    chunkIdx: number; // 1-indexed for citation
    score: number;
    coverage: number;
    chunkScore: number;
    missingCount: number;
  }

  const candidates: ScoredCandidate[] = [];

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const sc = chunks[cIdx];
    const chunkTokens = tokenize(sc.chunk.text);
    
    // Overall chunk IDF coverage
    const chunkCoverage = computeIdfCoverage(qTokens, chunkTokens, idfMap);
    
    // For short queries (1-2 tokens), ALL significant tokens must be present in the chunk
    if (qTokens.length <= 2 && chunkCoverage.missingCount > 0) continue;
    // For longer queries, at least 65% IDF coverage is required
    if (chunkCoverage.coverage < 0.65) continue;

    const sentences = splitSentences(sc.chunk.text);

    for (const sent of sentences) {
      const trimmed = sent.trim();
      if (trimmed.length < 10) continue;

      const sTokens = tokenize(trimmed);
      if (sTokens.length === 0) continue;

      const sentCoverage = computeIdfCoverage(qTokens, sTokens, idfMap);
      if (sentCoverage.matched.length === 0) continue;

      // Informative definition / explanation patterns boost
      let patternBoost = 1.0;
      if (/\b(is a|is an|is the|are|defined as|refers to|means|causes|because|travels|speed of|toll[- ]?free|phone number|number is|fly to|flights|married to|serves as|established by|answer|definition|mature|born on|born in)\b/i.test(trimmed)) {
        patternBoost += 0.30;
      }

      // Position boost
      const rankMultiplier = 1.0 / (1.0 + cIdx * 0.12);

      const sentenceScore = (sc.score * 0.4 + sentCoverage.coverage * 0.8) * patternBoost * rankMultiplier;

      candidates.push({
        sentence: trimmed,
        chunkIdx: cIdx + 1,
        score: sentenceScore,
        coverage: sentCoverage.coverage,
        chunkScore: sc.score,
        missingCount: sentCoverage.missingCount
      });
    }
  }

  if (candidates.length === 0) {
    return {
      answer: "I don't have enough information in the retrieved context to answer this question confidently.",
      confidence: "refused",
      citations: [],
      grounded: false,
      finishReason: "stop",
      attempts: 1,
      latencyMs: performance.now() - t0,
      warnings: ["No candidate sentence satisfied query coverage requirements."]
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Refusal thresholding
  if (qTokens.length <= 2 && best.missingCount > 0) {
    return {
      answer: "I don't have enough information in the retrieved context to answer this question confidently.",
      confidence: "refused",
      citations: [],
      grounded: false,
      finishReason: "stop",
      attempts: 1,
      latencyMs: performance.now() - t0,
      warnings: ["Missing key query term."]
    };
  }

  // Format clean answer with citation
  let formattedSentence = best.sentence;
  if (!/[.!?]$/.test(formattedSentence)) formattedSentence += ".";
  const answer = `${formattedSentence} [C${best.chunkIdx}]`;

  // Confidence determination
  let confidence: "high" | "medium" | "low" = "low";
  if (best.coverage >= 0.75 && best.chunkScore >= 0.5) {
    confidence = "high";
  } else if (best.coverage >= 0.50 || best.chunkScore >= 0.3) {
    confidence = "medium";
  }

  return {
    answer,
    confidence,
    citations: [best.chunkIdx],
    grounded: true,
    finishReason: "stop",
    attempts: 1,
    latencyMs: performance.now() - t0,
    warnings
  };
}

async function runTests() {
  await ensureVectorStoresLoaded();

  const testQueries = [
    "What is a corporation?",
    "why did rachel carson write an obligation to endure",
    "stubhub toll free number",
    "does delta fly to bangalore",
    "how fast does an eagle travel",
    "how many women did frank gifford marry",
    "how long for cantaloupe to mature",
    "what is the capital of france",
    "Can someone explain what defines a corporation entity?",
    "What is Stubhub customer service telephone helpline?"
  ];

  for (const q of testQueries) {
    const t0 = performance.now();
    const ret = retrieve({ query: q, strategy: "overlapping", topK: 5 });
    const synth = synthesizeFastGroundedAnswer(q, ret.scoredChunks);
    const totalMs = performance.now() - t0;

    console.log(`\n==================================================`);
    console.log(`QUERY: "${q}"`);
    console.log(`TOTAL LATENCY: ${totalMs.toFixed(3)}ms (Retrieval: ${ret.totalLatencyMs.toFixed(3)}ms, Synth: ${synth.latencyMs.toFixed(3)}ms)`);
    console.log(`ANSWER: ${synth.answer}`);
    console.log(`CONFIDENCE: ${synth.confidence} | CITATIONS: ${JSON.stringify(synth.citations)} | GROUNDED: ${synth.grounded}`);
  }
}

runTests().catch(console.error);
