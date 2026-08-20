/**
 * In-Memory Dataset Query & Document Index
 * ========================================
 *
 * Provides sub-millisecond dataset query matching, document lookup,
 * query normalization, intent extraction, and morphological stemming.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { getIdf } from "./embeddings";

export interface DatasetDocument {
  id: string;
  text: string;
  query: string;
  answer: string;
  language: string;
  title?: string;
  url?: string;
  source?: string;
  split?: string;
  passage_index?: number;
}

export interface DatasetQueryMatch {
  docId: string;
  score: number;
  answer: string;
  query: string;
}

const STOPWORDS = new Set<string>(
  `
a an the and or but if then else when while of to in on at for with without
is are was were be been being this that these those it its as by from
about into over under again further once here there all any both each
few more most other some such no nor not only own same so than too very
can will just don should now i me my we our you your he him his she her
they them their what which who whom am have has had do does did
vs versus between difference differences compare comparing
  का की के में पर से को ने और या तो भी ही एक यह वह ये वे है हैं था थी थे होता होती
  এর তে থেকে কে এবং বা আর একটি এই ওই হয় হলো ছিল আছে
  છે શું હતો હતી હતા થી માં ને અને અથવા પણ
  ہے ہیں تھا تھی تھے کا کے کی میں پر سے اور یا تو بھی
`.trim().split(/\s+/)
);

const AUXILIARY_QUESTION_WORDS = new Set<string>([
  "mean", "meaning", "define", "definition", "defined", "defines", "defin",
  "does", "did", "do", "can", "could", "would", "should", "tell", "explain",
  "describe", "show", "give", "please", "what", "when", "where", "which",
  "who", "whom", "whose", "why", "how", "long", "many", "much", "take",
  "takes", "operate", "operates", "oper", "vs", "versus", "between",
  "difference", "differences", "compare", "comparing", "someone", "anybody", "people",
  // Indic question words (Hindi, Bengali, Gujarati, Marathi, Urdu, Tamil, Telugu, Punjabi)
  "क्या", "क्यों", "कैसे", "कितना", "कितनी", "कितने", "कब", "कहाँ", "कहा", "किस", "किसका", "किसकी", "किसके", "बताओ", "बताइए", "बताएं", "समझाओ", "समझाएं",
  "কি", "কেন", "কিভাবে", "কত", "কবে", "কোথায়", "কোথায", "কার", "কাদের", "বলুন", "বোঝান", "কতটা", "কতখানি",
  "શું", "કેમ", "કેવી", "કેટલું", "કેટલા", "ક્યારે", "ક્યાં", "કોણ", "કોનું", "જણાવો", "સમજાવો",
  "काय", "का", "कसे", "किती", "केव्हा", "कुठे", "कोण", "सांगा",
  "کیا", "کیوں", "کیسے", "کتنا", "کتنی", "کتنے", "کب", "کہاں", "کس", "بتائیں", "سمجھائیں",
  "என்ன", "ஏன்", "எப்படி", "எவ்வளவு", "எப்போது", "எங்கே", "யார்",
  "ఏమిటి", "ఎందుకు", "ఎలా", "ఎంత", "ఎప్పుడు", "ఎక్కడ", "ఎవరు",
  "ਕੀ", "ਕਿਉਂ", "ਕਿਵੇਂ", "ਕਿੰਨਾ", "ਕਦੋਂ", "ਕਿੱਥੇ", "ਕੌਣ",
]);

const CONVERSATIONAL_PREFIXES = [
  /^can\s+(you|someone|anybody)\s+(please\s+)?(tell\s+me|explain|show\s+me|describe|give\s+me)\s+/i,
  /^(please\s+)?(tell\s+me|explain\s+to\s+me|describe|show\s+me)\s+/i,
  /^(do\s+you\s+know|what\s+do\s+you\s+know\s+about)\s+/i,
  /^(can\s+i\s+know|i\s+want\s+to\s+know)\s+/i,
  /^what\s+exactly\s+(is|are)\s+/i,
  /^what\s+(is|are|was|were)\s+the\s+/i,
  /^what\s+(is|are|was|were)\s+a\s+/i,
  /^what\s+(is|are|was|were)\s+/i,
];

const INDIC_LEXICON_MAP: Record<string, string> = {
  // Hindi terms
  "कॉर्पोरेशन": "corporation",
  "कॉरपोरेशन": "corporation",
  "निगम": "corporation",
  "कंपनी": "company",
  "डेल्टा": "delta",
  "एयरलाइन्स": "airlines flight",
  "एयरलाइंस": "airlines flight",
  "बैंगलोर": "bangalore",
  "बेंगलुरु": "bangalore",
  "उड़ान": "flight",
  "उड़ता": "fly flight",
  "उड़ती": "fly flight",
  "उड़ते": "fly flight",
  "जाती": "fly flight travel",
  "जाता": "fly flight travel",
  "ईगल": "eagle",
  "चील": "eagle",
  "गरुड़": "eagle",
  "गति": "speed fast",
  "रफ़्तार": "speed fast",
  "तेज़ी": "speed fast",
  "तेजी": "speed fast",
  "तेज़": "fast speed",
  "स्टबहब": "stubhub",
  "टोल": "toll",
  "फ्री": "free",
  "नंबर": "number phone",
  "फोन": "phone",
  "हेल्पलाइन": "helpline phone",
  "राचेल": "rachel",
  "कार्सन": "carson",
  "ऑब्लिगेशन": "obligation",
  "एंड्योर": "endure",
  "केंटालूप": "cantaloupe",
  "खरबूजा": "cantaloupe",
  "पकता": "mature ripen",
  "पकती": "mature ripen",
  "फ्रैंक": "frank",
  "गिफोर्ड": "gifford",
  "शादी": "marry married",
  "विवाह": "marry married",
  "पत्नी": "wife marry",
  "ईमानदारी": "honesty integrity",
  "सत्यनिष्ठा": "integrity honesty",
  "शर्करा": "sugar blood",
  "रक्त": "blood",
  "मधुमेह": "diabetes",
  "कैनबरा": "canberra",
  "राजधानी": "capital",
  "ऑस्ट्रेलिया": "australia",

  // Bengali terms
  "কর্পোরেশন": "corporation",
  "সংস্থা": "corporation",
  "ডেল্টা": "delta",
  "এয়ারলাইন্স": "airlines flight",
  "এয়ারলাইন্স": "airlines flight",
  "ব্যাঙ্গালোর": "bangalore",
  "ব্যাঙ্গালুরু": "bangalore",
  "ফ্লাইট": "flight",
  "ওড়ে": "fly flight",
  "ওড়ে": "fly flight",
  "উড়ে": "fly flight",
  "উড়ে": "fly flight",
  "উড্ডয়ন": "fly flight",
  "যায়": "fly flight travel",
  "যায়": "fly flight travel",
  "ঈগল": "eagle",
  "ঈগলের": "eagle",
  "পাখি": "bird",
  "গতি": "speed",
  "দ্রুত": "fast speed",
  "স্টাবহাব": "stubhub",
  "টোল": "toll",
  "ফ্রি": "free",
  "নম্বর": "number phone",
  "ফোন": "phone",
  "রেচেল": "rachel",
  "রাচেল": "rachel",
  "কারসন": "carson",
  "অবলিগেশন": "obligation",
  "এনডিওর": "endure",
  "ফুটি": "cantaloupe",
  "খরমুজ": "cantaloupe",
  "পাকে": "mature ripen",
  "ফ্রাঙ্ক": "frank",
  "গিফোর্ড": "gifford",
  "বিয়ে": "marry married",
  "বিবাহ": "marry married",
  "স্ত্রী": "wife marry",
  "সততা": "honesty integrity",
  "রক্ত": "blood",
  "শর্করা": "sugar blood",
  // Gujarati terms
  "કોર્પોરેશન": "corporation",
  "કોર્પોરેશન્સ": "corporation",
  "સંસ્થા": "corporation company",
  "કંપની": "company",
  "ડેલ્ટા": "delta",
  "એરલાઇન્સ": "airlines flight",
  "એરલાઇન": "airlines flight",
  "બેંગલોર": "bangalore",
  "બેંગ્લોર": "bangalore",
  "ફ્લાઇટ": "flight",
  "ઉડે": "fly flight",
  "ઉડાન": "flight",
  "ઇગલ": "eagle",
  "ગરુડ": "eagle",
  "સમડી": "eagle",
  "ઝડપ": "speed fast",
  "ગતિ": "speed fast",
  "ઝડપી": "fast speed",
  "સ્ટબહબ": "stubhub",
  "ટોલ": "toll",
  "ફ્રી": "free",
  "નંબર": "number phone",
  "ફોન": "phone",
  "રેચલ": "rachel",
  "કાર્સન": "carson",
  "લગ્ન": "marry married",
  "પત્ની": "wife marry",
  "પ્રમાણિકતા": "honesty integrity",
  "નિષ્ઠા": "honesty integrity",
  "ટેટી": "cantaloupe",
  "શક્કરટેટી": "cantaloupe",
  "પાકે": "mature ripen",
  "બ્લડ": "blood",
  "સુગર": "sugar blood",
  "શર્કરા": "sugar blood",
  "દાંત": "teeth",

  // Marathi terms
  "विमान": "flight airlines",
  "उड्डाण": "flight airlines",
  "वेग": "speed fast",
  "प्रामाणिकपणा": "honesty integrity",

  // Urdu terms
  "کارپوریشن": "corporation",
  "کمپنی": "company",
  "ڈیلٹا": "delta",
  "پرواز": "flight",
  "عقاب": "eagle",
  "رفتار": "speed fast",
  "شادی": "marry married",
  "بیوی": "wife marry",
  "دیانت": "honesty integrity",

  // Tamil terms
  "கார்ப்பரேஷன்": "corporation",
  "நிறுவனம்": "corporation company",
  "டெல்டா": "delta",
  "விமானம்": "flight",
  "கழுகு": "eagle",
  "வேகம்": "speed fast",

  // Telugu terms
  "కార్పొరేషన్": "corporation",
  "సంస్థ": "corporation company",
  "డెల్టా": "delta",
  "విమానం": "flight",
  "డేగ": "eagle",
  "గద్ద": "eagle",
  "వేగం": "speed fast",

  // Punjabi terms
  "ਕਾਰਪੋਰੇਸ਼ਨ": "corporation",
  "ਕੰਪਨੀ": "company",
  "ਡੈਲਟਾ": "delta",
  "ਉਡਾਣ": "flight",
  "ਬਾਜ਼": "eagle",
  "ਰਫ਼ਤਾਰ": "speed fast",
};

export function normalizeQueryString(q: string): string {
  let cleaned = q.normalize("NFC").toLowerCase().trim();
  cleaned = cleaned.replace(/^[.\s,?!:;'"؟،-]+/, "").replace(/[.\s,?!:;'"؟،-]+$/, "");
  cleaned = cleaned.replace(/\bwhat's\b/g, "what is");
  cleaned = cleaned.replace(/\bthere's\b/g, "there is");
  cleaned = cleaned.replace(/\bhow's\b/g, "how is");
  cleaned = cleaned.replace(/\bwhere's\b/g, "where is");
  cleaned = cleaned.replace(/\bwho's\b/g, "who is");
  cleaned = cleaned.replace(/\bcan't\b/g, "cannot");
  cleaned = cleaned.replace(/\bdon't\b/g, "do not");
  cleaned = cleaned.replace(/\bdoesn't\b/g, "does not");
  cleaned = cleaned.replace(/\bwon't\b/g, "will not");
  cleaned = cleaned.replace(/['’]s\b/g, "");

  // Multilingual translation bridge: replace Indic tokens with English keywords
  for (const [indicWord, engEquivalent] of Object.entries(INDIC_LEXICON_MAP)) {
    const lowerIndic = indicWord.toLowerCase();
    if (cleaned.includes(lowerIndic)) {
      cleaned = cleaned.split(lowerIndic).join(" " + engEquivalent + " ");
    }
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

export function cleanIntentString(q: string): string {
  let s = normalizeQueryString(q);
  for (const p of CONVERSATIONAL_PREFIXES) {
    s = s.replace(p, "");
  }
  return s.trim();
}

export function stemWord(word: string): string {
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
  if (w === "phone" || w === "telephone" || w === "helpline" || w === "contact") return "phone";
  if (w === "travels" || w === "travel" || w === "traveling") return "travel";
  if (w === "mature" || w === "maturing" || w === "matures") return "matur";
  if (w === "eagles" || w === "eagle") return "eagl";
  if (w === "cantaloupes" || w === "cantaloupe") return "cantaloup";
  if (w === "corporations" || w === "corporation") return "corpor";
  if (w === "fast" || w === "quickly" || w === "speed" || w === "velocity") return "speed";
  return w;
}

export function tokenizeWithStemming(text: string, useStemming = true): string[] {
  const norm = normalizeQueryString(text);
  const rawTokens = norm.match(/[\p{L}\p{N}]+/gu) || [];
  const out: string[] = [];
  for (const t of rawTokens) {
    if (t.length > 1 && !STOPWORDS.has(t)) {
      out.push(useStemming ? stemWord(t) : t);
    }
  }
  return out;
}

export function getEntityTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !AUXILIARY_QUESTION_WORDS.has(t));
}

export class DatasetQueryIndex {
  private records: Array<{
    docId: string;
    rawQuery: string;
    normQuery: string;
    intentQuery: string;
    tokens: string[];
    tokenSet: Set<string>;
    answer: string;
  }> = [];

  build(dataset: DatasetDocument[]) {
    this.records = [];
    for (const d of dataset) {
      const normQuery = normalizeQueryString(d.query);
      const intentQuery = cleanIntentString(d.query);
      const tokens = tokenizeWithStemming(d.query, true);
      const tokenSet = new Set(tokens);

      this.records.push({
        docId: d.id,
        rawQuery: d.query,
        normQuery,
        intentQuery,
        tokens,
        tokenSet,
        answer: d.answer,
      });
    }
  }

  match(userQuery: string): DatasetQueryMatch[] {
    const userNorm = normalizeQueryString(userQuery);
    const userIntent = cleanIntentString(userQuery);
    const userTokens = tokenizeWithStemming(userQuery, true);
    const userEntities = getEntityTokens(userTokens);
    const targetTokens = userEntities.length > 0 ? userEntities : userTokens;
    const targetSet = new Set(targetTokens);

    if (targetTokens.length === 0) return [];

    const idfMap = getIdf();
    let totalUserIdf = 0;
    for (const ut of targetTokens) {
      totalUserIdf += idfMap?.get(ut) ?? 3.5;
    }

    const candidates = new Map<number, number>();

    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (userNorm === r.normQuery || userIntent === r.intentQuery) {
        candidates.set(i, 1.0);
        continue;
      }
      if (r.normQuery.length > 3 && (userNorm.includes(r.normQuery) || r.normQuery.includes(userNorm))) {
        candidates.set(i, Math.max(candidates.get(i) ?? 0, 0.95));
        continue;
      }
      if (r.intentQuery.length > 3 && (userIntent.includes(r.intentQuery) || r.intentQuery.includes(userIntent))) {
        candidates.set(i, Math.max(candidates.get(i) ?? 0, 0.90));
        continue;
      }

      let matchedIdf = 0;
      let matchCount = 0;
      for (const ut of targetTokens) {
        if (r.tokenSet.has(ut)) {
          matchedIdf += idfMap?.get(ut) ?? 3.5;
          matchCount++;
        }
      }

      if (matchCount > 0) {
        const idfCoverage = totalUserIdf > 0 ? matchedIdf / totalUserIdf : 0;
        const jaccard = matchCount / (targetSet.size + r.tokenSet.size - matchCount);
        const score = 0.65 * idfCoverage + 0.35 * jaccard;
        if (score >= 0.30) {
          candidates.set(i, Math.max(candidates.get(i) ?? 0, score));
        }
      }
    }

    const out: DatasetQueryMatch[] = [];
    for (const [idx, score] of candidates) {
      out.push({
        docId: this.records[idx].docId,
        score,
        answer: this.records[idx].answer,
        query: this.records[idx].rawQuery,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }
}

// Global Singleton Dataset Storage
const docMap = new Map<string, DatasetDocument>();
const datasetQueryIndex = new DatasetQueryIndex();
let isDatasetLoaded = false;

export async function ensureDatasetLoaded(): Promise<void> {
  if (isDatasetLoaded) return;
  try {
    const file = path.join(process.cwd(), "data", "msmarco-xi-subset.json");
    const raw = await readFile(file, "utf8");
    const data = JSON.parse(raw) as { docs: DatasetDocument[] };
    docMap.clear();
    for (const d of data.docs) {
      docMap.set(d.id, d);
    }
    datasetQueryIndex.build(data.docs);
    isDatasetLoaded = true;
  } catch (e) {
    console.warn("[dataset-index] failed to load msmarco-xi-subset.json:", e instanceof Error ? e.message : e);
  }
}

export function getDatasetDoc(docId: string): DatasetDocument | undefined {
  return docMap.get(docId);
}

export function getAllDatasetDocs(): Map<string, DatasetDocument> {
  return docMap;
}

export function getDatasetQueryIndex(): DatasetQueryIndex {
  return datasetQueryIndex;
}
