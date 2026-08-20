import { ensureVectorStoresLoaded } from "../src/lib/init";
import { runPipeline } from "../src/lib/pipeline";

async function main() {
  console.log("Loading vector stores and dataset index...");
  await ensureVectorStoresLoaded();

  const testCases = [
    {
      name: "English Query: What is a corporation?",
      query: "What is a corporation?",
      expectedLang: "en",
      expectedScriptCheck: (ans: string) => /corporation/i.test(ans) && /[a-zA-Z]/.test(ans),
    },
    {
      name: "Hindi Query: कॉर्पोरेशन क्या है?",
      query: "कॉर्पोरेशन क्या है?",
      expectedLang: "hi",
      expectedScriptCheck: (ans: string) => /[\u0900-\u097F]/.test(ans) && ans.includes("कॉर्पोरेशन"),
    },
    {
      name: "Gujarati Query: કોર્પોરેશન શું છે?",
      query: "કોર્પોરેશન શું છે?",
      expectedLang: "gu",
      expectedScriptCheck: (ans: string) => /[\u0A80-\u0AFF]/.test(ans) && ans.includes("કોર્પોરેશન"),
    },
    {
      name: "Bengali Query: কর্পোরেশন কি?",
      query: "কর্পোরেশন কি?",
      expectedLang: "bn",
      expectedScriptCheck: (ans: string) => /[\u0980-\u09FF]/.test(ans) && ans.includes("কর্পোরেশন"),
    },
    {
      name: "English Query: How fast does an eagle fly in normal flight?",
      query: "How fast does an eagle fly in normal flight?",
      expectedLang: "en",
      expectedScriptCheck: (ans: string) => /(30|55|mph|eagle)/i.test(ans),
    },
    {
      name: "Hindi Query: चील कितनी तेजी से उड़ती है?",
      query: "चील कितनी तेजी से उड़ती है?",
      expectedLang: "hi",
      expectedScriptCheck: (ans: string) => /[\u0900-\u097F]/.test(ans) && /(चील|ईगल|30|55)/.test(ans),
    },
    {
      name: "Gujarati Query: ગરુડ કેટલી ઝડપે ઉડે છે?",
      query: "ગરુડ કેટલી ઝડપે ઉડે છે?",
      expectedLang: "gu",
      expectedScriptCheck: (ans: string) => /[\u0A80-\u0AFF]/.test(ans) && /(ગરુડ|30|55|ઝડપ)/.test(ans),
    },
    {
      name: "Bengali Query: একটি ঈগল কতটা দ্রুত ওড়ে?",
      query: "একটি ঈগল কতটা দ্রুত ওড়ে?",
      expectedLang: "bn",
      expectedScriptCheck: (ans: string) => /[\u0980-\u09FF]/.test(ans) && /(ঈগল|৩০|৫৫|mph)/.test(ans),
    },
    {
      name: "Hindi Query: क्या डेल्टा एयरलाइंस बैंगलोर जाती है?",
      query: "क्या डेल्टा एयरलाइंस बैंगलोर जाती है?",
      expectedLang: "hi",
      expectedScriptCheck: (ans: string) => /[\u0900-\u097F]/.test(ans) && (ans.includes("हाँ") || ans.includes("डेल्टा")),
    },
    {
      name: "Gujarati Query: શું ડેલ્ટા એરલાઇન્સ બેંગલોર જાય છે?",
      query: "શું ડેલ્ટા એરલાઇન્સ બેંગલોર જાય છે?",
      expectedLang: "gu",
      expectedScriptCheck: (ans: string) => /[\u0A80-\u0AFF]/.test(ans) && (ans.includes("હા") || ans.includes("ડેલ્ટા")),
    },
    {
      name: "Bengali Query: ডেল্টা কি ব্যাঙ্গালোর যায়?",
      query: "ডেল্টা কি ব্যাঙ্গালোর যায়?",
      expectedLang: "bn",
      expectedScriptCheck: (ans: string) => /[\u0980-\u09FF]/.test(ans) && (ans.includes("হ্যাঁ") || ans.includes("ডেল্টা")),
    },
    {
      name: "Urdu Query: کارپوریشن کیا ہے؟",
      query: "کارپوریشن کیا ہے؟",
      expectedLang: "ur",
      expectedScriptCheck: (ans: string) => /[\u0600-\u06FF]/.test(ans) && ans.includes("کارپوریشن"),
    },
  ];

  let allPassed = true;

  for (const tc of testCases) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Testing: ${tc.name}`);
    const res = await runPipeline({
      query: tc.query,
      strategy: "overlapping",
      engine: "fast",
    });

    console.log(`Query:             "${res.query}"`);
    console.log(`Detected Language: ${res.languageName} (${res.detectedLanguage})`);
    console.log(`Grounded Answer:   ${res.answer}`);
    console.log(`Citations:         ${JSON.stringify(res.citations)}`);
    console.log(`Grounded:          ${res.grounded}`);
    console.log(`Latency:           ${res.timings.totalMs.toFixed(2)}ms`);

    const langMatch = res.detectedLanguage === tc.expectedLang;
    const scriptValid = tc.expectedScriptCheck(res.answer);
    const hasCitations = res.citations.length > 0 && res.answer.includes("[C");

    if (langMatch && scriptValid && hasCitations && res.grounded) {
      console.log(`Result:            PASS ✓`);
    } else {
      console.log(`Result:            FAIL ✗`);
      console.log(`Details: langMatch=${langMatch}, scriptValid=${scriptValid}, hasCitations=${hasCitations}`);
      allPassed = false;
    }
  }

  console.log(`\n==================================================`);
  if (allPassed) {
    console.log("ALL 12 MULTILINGUAL TEST CASES PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("SOME MULTILINGUAL TEST CASES FAILED!");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
