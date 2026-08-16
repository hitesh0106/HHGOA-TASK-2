import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as embeddings from '../src/lib/embeddings';

const storeData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'vector-stores', 'overlapping.json'), 'utf8'));
const idfMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'vector-stores', '_idf.json'), 'utf8'));
embeddings.setIdf(idfMap);

function testHybrid(query: string) {
  const tokens = embeddings.tokenize(query);
  const terms: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    terms.push(`${tokens[i]} ${tokens[i+1]}`);
  }

  // Pre-calculate BM25 scores
  const bm25Scores = new Float32Array(storeData.chunks.length);
  for (let i = 0; i < storeData.chunks.length; i++) {
    const cTokens = embeddings.tokenize(storeData.chunks[i].text);
    const cTf = new Map<string, number>();
    for (const t of cTokens) cTf.set(t, (cTf.get(t) ?? 0) + 1);
    for (let j = 0; j < cTokens.length - 1; j++) {
      const bi = `${cTokens[j]} ${cTokens[j+1]}`;
      cTf.set(bi, (cTf.get(bi) ?? 0) + 1);
    }
    for (const term of terms) {
      const tf = cTf.get(term) ?? 0;
      if (tf > 0) bm25Scores[i] += tf * (idfMap[term] ?? 1.0);
    }
  }

  let maxBm25 = 0;
  for (let i = 0; i < bm25Scores.length; i++) {
    if (bm25Scores[i] > maxBm25) maxBm25 = bm25Scores[i];
  }

  const qVec = embeddings.embedText(query);
  const results: Array<{ id: string; doc_id: string; score: number; text: string }> = [];

  for (let i = 0; i < storeData.chunks.length; i++) {
    const dVec = Float32Array.from(storeData.embeddings[i]);
    const vecScore = embeddings.cosineSimilarity(qVec, dVec);
    let hybrid = 0;
    if (maxBm25 > 0) {
      if (bm25Scores[i] > 0) {
        const normBm = bm25Scores[i] / maxBm25;
        const normVec = Math.max(0, vecScore);
        hybrid = 0.70 * normBm + 0.30 * normVec;
      }
    } else {
      hybrid = Math.max(0, vecScore);
    }
    if (hybrid >= 0.05) {
      results.push({
        id: storeData.chunks[i].id,
        doc_id: storeData.chunks[i].doc_id,
        score: hybrid,
        text: storeData.chunks[i].text
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  console.log(`\n=== QUERY: "${query}" ===`);
  results.slice(0, 5).forEach((r, idx) => {
    console.log(`  Rank ${idx + 1}: Score=${r.score.toFixed(4)} | Doc=${r.doc_id} | ${r.text.slice(0, 70)}...`);
  });
}

testHybrid('What is the corporation?');
testHybrid('why did rachel carson write an obligation to endure');
testHybrid('stubhub toll free number');
testHybrid('does delta fly to bangalore');
testHybrid('what is the capital of france');
testHybrid('hello');
