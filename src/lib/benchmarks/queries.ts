/**
 * Canonical Benchmark Query Pool
 * ==============================
 *
 * Single Source of Truth for all latency, grounding, and retrieval benchmarks
 * across CLI scripts, API endpoints, and Frontend dashboard.
 *
 * Covers:
 *   1. English MSMARCO-XI Ground Truth Queries
 *   2. English Paraphrased / Conversational Queries
 *   3. English Abstention / Out-of-Corpus Queries
 *   4. Hindi MSMARCO-XI Ground Truth & Paraphrases
 *   5. Hindi Abstention / Conversational Queries
 *   6. Bengali MSMARCO-XI Ground Truth & Paraphrases
 *   7. Bengali Abstention / Conversational Queries
 */

export interface CanonicalBenchmarkQuery {
  id: number;
  query: string;
  language: "en" | "hi" | "bn";
  category: "ground_truth" | "paraphrase" | "abstention" | "off_topic";
  expectedDocId?: string;
  expectedOutcome: "Answer" | "Abstention";
}

// ---------------------------------------------------------------------------
// Base Query Pools
// ---------------------------------------------------------------------------

export const BASE_ENGLISH_QUERIES: Array<Omit<CanonicalBenchmarkQuery, "id">> = [
  // Ground Truth MSMARCO queries (in-corpus)
  { query: "what is a corporation", language: "en", category: "ground_truth", expectedDocId: "san_0", expectedOutcome: "Answer" },
  { query: "why did rachel carson write an obligation to endure", language: "en", category: "ground_truth", expectedDocId: "san_1", expectedOutcome: "Answer" },
  { query: "honesty or integrity definition", language: "en", category: "ground_truth", expectedDocId: "san_4", expectedOutcome: "Answer" },
  { query: "how many women did frank gifford marry", language: "en", category: "ground_truth", expectedDocId: "san_5", expectedOutcome: "Answer" },
  { query: "how fast does an eagle travel", language: "en", category: "ground_truth", expectedDocId: "san_6", expectedOutcome: "Answer" },
  { query: "stubhub toll free number", language: "en", category: "ground_truth", expectedDocId: "san_7", expectedOutcome: "Answer" },
  { query: "does delta fly to bangalore", language: "en", category: "ground_truth", expectedDocId: "san_8", expectedOutcome: "Answer" },
  { query: "how long for cantaloupe to mature", language: "en", category: "ground_truth", expectedDocId: "san_9", expectedOutcome: "Answer" },
  { query: "definition of arbitrary decision", language: "en", category: "ground_truth", expectedDocId: "san_12", expectedOutcome: "Answer" },
  { query: "what is barter system and its problems", language: "en", category: "ground_truth", expectedDocId: "san_15", expectedOutcome: "Answer" },
  { query: "study of climate weather difference", language: "en", category: "ground_truth", expectedDocId: "san_18", expectedOutcome: "Answer" },
  { query: "how much xbox games cost", language: "en", category: "ground_truth", expectedDocId: "san_22", expectedOutcome: "Answer" },
  { query: "how long keep IRS tax records", language: "en", category: "ground_truth", expectedDocId: "san_25", expectedOutcome: "Answer" },
  { query: "how far is philadelphia from lancaster pa", language: "en", category: "ground_truth", expectedDocId: "san_30", expectedOutcome: "Answer" },
  { query: "average salary of a office manager mortgage lending", language: "en", category: "ground_truth", expectedDocId: "san_35", expectedOutcome: "Answer" },
  { query: "what is basic programming language", language: "en", category: "ground_truth", expectedDocId: "san_40", expectedOutcome: "Answer" },
  { query: "how to print an excel sheet", language: "en", category: "ground_truth", expectedDocId: "san_45", expectedOutcome: "Answer" },
  { query: "calories in a small cucumber", language: "en", category: "ground_truth", expectedDocId: "san_50", expectedOutcome: "Answer" },
  { query: "does inflatable neck traction work", language: "en", category: "ground_truth", expectedDocId: "san_55", expectedOutcome: "Answer" },
  { query: "foods and supplements to lower blood sugar", language: "en", category: "ground_truth", expectedDocId: "san_60", expectedOutcome: "Answer" },
  { query: "how long does it take cracked ribs to heal", language: "en", category: "ground_truth", expectedDocId: "san_65", expectedOutcome: "Answer" },
  { query: "what is bayern munich sports club", language: "en", category: "ground_truth", expectedDocId: "san_70", expectedOutcome: "Answer" },
  { query: "can ear infections cause seizures in cats", language: "en", category: "ground_truth", expectedDocId: "san_75", expectedOutcome: "Answer" },
  { query: "how much does matt lauer make a year", language: "en", category: "ground_truth", expectedDocId: "san_80", expectedOutcome: "Answer" },
  { query: "how to pit cherries with straw", language: "en", category: "ground_truth", expectedDocId: "san_85", expectedOutcome: "Answer" },

  // Paraphrased queries (in-corpus)
  { query: "Can someone explain what defines a corporation entity?", language: "en", category: "paraphrase", expectedDocId: "san_0", expectedOutcome: "Answer" },
  { query: "Why was The Obligation to Endure written by Carson?", language: "en", category: "paraphrase", expectedDocId: "san_1", expectedOutcome: "Answer" },
  { query: "What is Stubhub customer service telephone helpline?", language: "en", category: "paraphrase", expectedDocId: "san_7", expectedOutcome: "Answer" },
  { query: "Are there flights on Delta between Bangalore and Paris?", language: "en", category: "paraphrase", expectedDocId: "san_8", expectedOutcome: "Answer" },
  { query: "How many times was Frank Gifford married?", language: "en", category: "paraphrase", expectedDocId: "san_5", expectedOutcome: "Answer" },

  // Abstention / Out-of-corpus queries (must refuse)
  { query: "what is the capital of france", language: "en", category: "abstention", expectedOutcome: "Abstention" },
  { query: "what is quantum gravitational propulsion", language: "en", category: "abstention", expectedOutcome: "Abstention" },
  { query: "who won the 2026 superbowl", language: "en", category: "abstention", expectedOutcome: "Abstention" },
  { query: "what is a standard deduction for taxes", language: "en", category: "abstention", expectedOutcome: "Abstention" },
  { query: "what does blood in stool mean", language: "en", category: "abstention", expectedOutcome: "Abstention" },
  { query: "hello", language: "en", category: "off_topic", expectedOutcome: "Abstention" },
  { query: "hey there how are you doing today", language: "en", category: "off_topic", expectedOutcome: "Abstention" },
];

export const BASE_HINDI_QUERIES: Array<Omit<CanonicalBenchmarkQuery, "id">> = [
  // Ground Truth & Paraphrased Indic queries (in-corpus)
  { query: "कॉरपोरेशन क्या है?", language: "hi", category: "ground_truth", expectedDocId: "san_0", expectedOutcome: "Answer" },
  { query: "डेल्टा एयरलाइंस बैंगलोर जाती है?", language: "hi", category: "ground_truth", expectedDocId: "san_8", expectedOutcome: "Answer" },
  { query: "ईगल कितनी तेजी से उड़ता है?", language: "hi", category: "ground_truth", expectedDocId: "san_6", expectedOutcome: "Answer" },
  { query: "स्टबहब का टोल फ्री नंबर क्या है?", language: "hi", category: "ground_truth", expectedDocId: "san_7", expectedOutcome: "Answer" },
  { query: "केंटालूप कब पकता है?", language: "hi", category: "ground_truth", expectedDocId: "san_9", expectedOutcome: "Answer" },
  { query: "ईमानदारी और सत्यनिष्ठा की परिभाषा क्या है?", language: "hi", category: "ground_truth", expectedDocId: "san_4", expectedOutcome: "Answer" },
  { query: "फ्रैंक गिफोर्ड ने कितनी महिलाओं से शादी की?", language: "hi", category: "ground_truth", expectedDocId: "san_5", expectedOutcome: "Answer" },
  { query: "राचेल कार्सन ने द ऑब्लिगेशन टू एंड्योर क्यों लिखी?", language: "hi", category: "ground_truth", expectedDocId: "san_1", expectedOutcome: "Answer" },
  { query: "रक्त शर्करा कम करने वाले खाद्य पदार्थ", language: "hi", category: "ground_truth", expectedDocId: "san_60", expectedOutcome: "Answer" },
  { query: "क्या डेल्टा एयरलाइंस बैंगलोर के लिए उड़ान भरती है?", language: "hi", category: "paraphrase", expectedDocId: "san_8", expectedOutcome: "Answer" },
  { query: "चील की उड़ान की गति कितनी होती है?", language: "hi", category: "paraphrase", expectedDocId: "san_6", expectedOutcome: "Answer" },
  { query: "स्टबहब ग्राहक सेवा फोन नंबर", language: "hi", category: "paraphrase", expectedDocId: "san_7", expectedOutcome: "Answer" },
  { query: "खरबूजा कितने दिनों में पकता है?", language: "hi", category: "paraphrase", expectedDocId: "san_9", expectedOutcome: "Answer" },

  // Abstention / Out-of-corpus queries
  { query: "फ्रांस की राजधानी क्या है?", language: "hi", category: "abstention", expectedOutcome: "Abstention" },
  { query: "क्वांटम कंप्यूटर कैसे काम करता है?", language: "hi", category: "abstention", expectedOutcome: "Abstention" },
  { query: "नमस्ते आप कैसे हैं?", language: "hi", category: "off_topic", expectedOutcome: "Abstention" },
];

export const BASE_BENGALI_QUERIES: Array<Omit<CanonicalBenchmarkQuery, "id">> = [
  // Ground Truth & Paraphrased Indic queries (in-corpus)
  { query: "কর্পোরেশন কি?", language: "bn", category: "ground_truth", expectedDocId: "san_0", expectedOutcome: "Answer" },
  { query: "ডেল্টা কি ব্যাঙ্গালোর যায়?", language: "bn", category: "ground_truth", expectedDocId: "san_8", expectedOutcome: "Answer" },
  { query: "ঈগল কত দ্রুত উড়ে?", language: "bn", category: "ground_truth", expectedDocId: "san_6", expectedOutcome: "Answer" },
  { query: "ফ্রাঙ্ক গিফোর্ড কাকে বিয়ে করেছিলেন?", language: "bn", category: "ground_truth", expectedDocId: "san_5", expectedOutcome: "Answer" },
  { query: "স্টাবহাব টোল ফ্রি নম্বর কি?", language: "bn", category: "ground_truth", expectedDocId: "san_7", expectedOutcome: "Answer" },
  { query: "কেন্টালূপ কখন পাকে?", language: "bn", category: "ground_truth", expectedDocId: "san_9", expectedOutcome: "Answer" },
  { query: "সততা এবং নিষ্ঠার সংজ্ঞা কি?", language: "bn", category: "ground_truth", expectedDocId: "san_4", expectedOutcome: "Answer" },
  { query: "রেচেল কারসন দি অবলিগেশন টু এনডিওর কেন লিখেছিলেন?", language: "bn", category: "ground_truth", expectedDocId: "san_1", expectedOutcome: "Answer" },
  { query: "রক্তের শর্করা কমানোর খাবার", language: "bn", category: "ground_truth", expectedDocId: "san_60", expectedOutcome: "Answer" },
  { query: "ডেল্টা এয়ারলাইন্স কি ব্যাঙ্গালোরে ফ্লাইট চালায়?", language: "bn", category: "paraphrase", expectedDocId: "san_8", expectedOutcome: "Answer" },
  { query: "ঈগলের ওড়ার গতি কত?", language: "bn", category: "paraphrase", expectedDocId: "san_6", expectedOutcome: "Answer" },

  // Abstention / Out-of-corpus queries
  { query: "ফ্রান্সের রাজধানী কি?", language: "bn", category: "abstention", expectedOutcome: "Abstention" },
  { query: "কোয়ান্টাম গ্র্যাভিটেশনাল প্রপালশন কি?", language: "bn", category: "abstention", expectedOutcome: "Abstention" },
  { query: "হ্যালো কেমন আছেন?", language: "bn", category: "off_topic", expectedOutcome: "Abstention" },
];

// ---------------------------------------------------------------------------
// Deterministic 300-Query Generator
// ---------------------------------------------------------------------------

/**
 * Builds the canonical benchmark queries deterministically:
 *   • 45% English (135 queries for n=300)
 *   • 35% Hindi (105 queries for n=300)
 *   • 20% Bengali (60 queries for n=300)
 */
export function getCanonicalBenchmarkQueries(targetCount = 300): CanonicalBenchmarkQuery[] {
  if (targetCount <= 0) return [];

  const enCount = Math.round(targetCount * 0.45);
  const hiCount = Math.round(targetCount * 0.35);
  const bnCount = targetCount - enCount - hiCount;

  const result: CanonicalBenchmarkQuery[] = [];
  let currentId = 1;

  for (let i = 0; i < enCount; i++) {
    const item = BASE_ENGLISH_QUERIES[i % BASE_ENGLISH_QUERIES.length];
    result.push({ ...item, id: currentId++ });
  }

  for (let i = 0; i < hiCount; i++) {
    const item = BASE_HINDI_QUERIES[i % BASE_HINDI_QUERIES.length];
    result.push({ ...item, id: currentId++ });
  }

  for (let i = 0; i < bnCount; i++) {
    const item = BASE_BENGALI_QUERIES[i % BASE_BENGALI_QUERIES.length];
    result.push({ ...item, id: currentId++ });
  }

  return result;
}

export const CANONICAL_300_QUERIES = getCanonicalBenchmarkQueries(300);
export const DEFAULT_BENCHMARK_QUERIES = CANONICAL_300_QUERIES.map((q) => q.query);
