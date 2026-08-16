import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as embeddings from '../src/lib/embeddings';

async function main() {
  const storeData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'vector-stores', 'overlapping.json'), 'utf8'));
  const idfMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'vector-stores', '_idf.json'), 'utf8'));
  embeddings.setIdf(idfMap);

  console.log("==================================================");
  console.log("EXACT LEXICAL BM25 / TF-IDF INVERTED INDEX TEST");
  console.log("==================================================");

  const queryTokens = ['corporation'];
  const exactScores: Array<{ id: string; doc_id: string; score: number; text: string }> = [];

  for (const chunk of storeData.chunks) {
    const words = chunk.text.toLowerCase().match(/[a-z0-9]+/g) || [];
    let tf = 0;
    for (const w of words) {
      if (w === 'corporation' || w === 'corporations') tf++;
    }
    if (tf > 0) {
      const idf = idfMap['corporation'] || 1.0;
      const score = (tf / words.length) * idf;
      exactScores.push({ id: chunk.id, doc_id: chunk.doc_id, score, text: chunk.text });
    }
  }

  exactScores.sort((a, b) => b.score - a.score);
  console.log("Top matches for exact term 'corporation':");
  exactScores.slice(0, 5).forEach((item, idx) => {
    console.log(`Rank ${idx + 1} | Score: ${item.score.toFixed(4)} | Chunk: ${item.id} | Doc: ${item.doc_id} | ${item.text.slice(0, 80)}...`);
  });

  const harrisonMatch = exactScores.find(x => x.doc_id === 'san_157');
  console.log("\nDoes Harrison Ford (san_157) match in exact index?", harrisonMatch ? "YES" : "NO (Score = 0.0000)");

  console.log("\n==================================================");
  console.log("HASH COLLISION AUDIT FOR BUCKET 192 (Query: 'corporation')");
  console.log("==================================================");
  const wordsInBucket192: string[] = [];
  for (const word of Object.keys(idfMap)) {
    const vec = embeddings.embedText(word);
    if (vec[192] !== 0 && Object.keys(vec).length === 1) { // pure 1-hot
      // check if it maps to 192
    }
  }
}

main().catch(console.error);
