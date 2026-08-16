import fs from "fs";
import path from "path";

const subsetPath = path.join(process.cwd(), "data", "msmarco-xi-subset.json");
const raw = fs.readFileSync(subsetPath, "utf8");
const data = JSON.parse(raw);

console.log("================================================================================");
console.log("PHYSICAL INSPECTION OF data/msmarco-xi-subset.json");
console.log("================================================================================");
console.log("Total records:", data.docs.length);

// 1. Search for "blood"
const bloodDocs = data.docs.filter((d: any) => 
  (d.query && d.query.toLowerCase().includes("blood")) ||
  (d.text && d.text.toLowerCase().includes("blood"))
);
console.log("\nRecords matching 'blood':", bloodDocs.length);
bloodDocs.forEach((d: any) => {
  console.log(`  ID: ${d.id} | Query: "${d.query}" | Answer: "${d.answer}"`);
});

// 2. Search for "stool"
const stoolDocs = data.docs.filter((d: any) => 
  (d.query && d.query.toLowerCase().includes("stool")) ||
  (d.text && d.text.toLowerCase().includes("stool"))
);
console.log("\nRecords matching 'stool':", stoolDocs.length);
stoolDocs.forEach((d: any) => {
  console.log(`  ID: ${d.id} | Query: "${d.query}" | Answer: "${d.answer}"`);
  console.log(`  Passage Text: "${d.text}"`);
});

// 3. Search for "what does blood in stool mean"
const exactMatch = data.docs.filter((d: any) =>
  d.query && d.query.toLowerCase().includes("blood in stool")
);
console.log("\nExact query 'blood in stool' matches:", exactMatch.length);

// 4. Search for the 4 other requested records:
const queriesToFind = [
  "what is a corporation",
  "does delta fly to bangalore",
  "how fast does an eagle travel",
  "stubhub toll free number",
];

console.log("\n================================================================================");
console.log("CHECKING REQUESTED RECORDS:");
console.log("================================================================================");

for (const q of queriesToFind) {
  const matches = data.docs.filter((d: any) => 
    d.query && d.query.toLowerCase().includes(q.toLowerCase())
  );
  console.log(`\nQuery: "${q}" -> Matches found: ${matches.length}`);
  for (const m of matches) {
    console.log(`  ID: ${m.id}`);
    console.log(`  Exact Query field: "${m.query}"`);
    console.log(`  Exact Answer field: "${m.answer}"`);
    console.log(`  Passage Text: "${m.text}"`);
  }
}
