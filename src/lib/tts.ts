/**
 * Text-to-Speech (TTS) Voice Engine
 * =================================
 *
 * Implements a soft, sweet, calm, warm, and natural female AI voice
 * with clear pronunciation and language-matching capabilities.
 *
 * Speech Characteristics:
 *   - Gender: Female
 *   - Personality: Soft, sweet, calm, warm, natural, professional AI assistant
 *   - Voice Preference: Indian English / English (India) or high-quality natural female voice
 *   - Rate: ~0.90 (slightly slower, serene and composed)
 *   - Pitch: ~1.10 (slightly higher natural female pitch)
 *   - Volume: ~0.75 (comfortable, gentle, non-aggressive)
 */

export interface VoiceSelectionResult {
  voice: SpeechSynthesisVoice | null;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
}

/**
 * Keywords indicating high-quality, soft, natural female voices across browsers
 * (Chrome, Edge, Safari, Firefox) on Windows, macOS, Android, and iOS.
 */
const FEMALE_VOICE_KEYWORDS = [
  // High-Quality Indian English & Indic Female Voices
  "neerja",
  "swara",
  "heera",
  "aditi",
  "priya",
  "kavya",
  "ananya",
  "shruti",
  "rashmi",
  "kalpana",
  "shreya",
  "geeta",

  // Microsoft Edge Natural / Online Female Voices
  "microsoft neerja online (natural)",
  "microsoft swara online (natural)",
  "microsoft heera",
  "microsoft zira",
  "microsoft jenny online (natural)",
  "microsoft aria online (natural)",
  "microsoft sonia online (natural)",
  "microsoft mia online (natural)",
  "microsoft emily online (natural)",

  // Google Chrome Natural Female Voices
  "google हिन्दी",
  "google বাংলা",
  "google ગુજરાતી",
  "google தமிழ்",
  "google తెలుగు",
  "google ಕನ್ನಡ",
  "google മലയാളം",
  "google uk english female",
  "google us english female",

  // Apple & Standard OS Female Voices
  "samantha",
  "victoria",
  "karen",
  "moira",
  "fiona",
  "tessa",
  "veena",
  "lekha",
  "sangeeta",
  "rishi",

  // General Markers
  "female",
  "woman",
  "natural",
  "neural",
];

/**
 * Language mapping to BCP-47 speech synthesis tags.
 */
const SPEECH_LANG_TAGS: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  ur: "ur-IN",
  or: "or-IN",
};

/**
 * Intelligently selects the best available soft female voice from window.speechSynthesis.
 */
export function selectBestFemaleVoice(
  langCode: string = "en",
  voices: SpeechSynthesisVoice[] = []
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const targetCode = langCode.toLowerCase().split(/[-_]/)[0];
  const targetTag = SPEECH_LANG_TAGS[targetCode] || `${targetCode}-IN`;

  // 1. Exact match for target language with female keyword preference
  const langVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith(targetCode) ||
      v.lang.toLowerCase() === targetTag.toLowerCase()
  );

  if (langVoices.length > 0) {
    // Prefer explicitly named soft female / natural voices
    const namedFemale = langVoices.find((v) => {
      const name = v.name.toLowerCase();
      return FEMALE_VOICE_KEYWORDS.some((kw) => name.includes(kw));
    });
    if (namedFemale) return namedFemale;

    // Next, check voice URI or generic name not containing "male" / "david" / "george" / "mark" / "ravi"
    const nonMale = langVoices.find(
      (v) =>
        !v.name.toLowerCase().includes("male") &&
        !v.name.toLowerCase().includes("david") &&
        !v.name.toLowerCase().includes("george") &&
        !v.name.toLowerCase().includes("mark") &&
        !v.name.toLowerCase().includes("ravi") &&
        !v.name.toLowerCase().includes("guy")
    );
    if (nonMale) return nonMale;

    return langVoices[0];
  }

  // 2. If English or fallback:
  // Priority 1: Indian English Natural Female (Neerja, Heera, Swara, Google en-IN)
  const inEnFemale = voices.find((v) => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    return (
      (lang.includes("in") || lang.startsWith("en-in") || lang.startsWith("hi")) &&
      FEMALE_VOICE_KEYWORDS.some((kw) => name.includes(kw))
    );
  });
  if (inEnFemale) return inEnFemale;

  // Priority 2: Neural / Natural Microsoft or Google English Female
  const naturalEnFemale = voices.find((v) => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    return (
      lang.startsWith("en") &&
      (name.includes("natural") || name.includes("online") || name.includes("neural") || name.includes("google")) &&
      FEMALE_VOICE_KEYWORDS.some((kw) => name.includes(kw))
    );
  });
  if (naturalEnFemale) return naturalEnFemale;

  // Priority 3: Named high quality female voices (Aria, Jenny, Zira, Samantha, Victoria)
  const namedEnFemale = voices.find((v) => {
    const name = v.name.toLowerCase();
    return (
      v.lang.toLowerCase().startsWith("en") &&
      ["aria", "jenny", "zira", "samantha", "victoria", "karen", "moira", "fiona"].some((n) =>
        name.includes(n)
      )
    );
  });
  if (namedEnFemale) return namedEnFemale;

  // Priority 4: Any English voice with female keyword
  const anyEnFemale = voices.find((v) => {
    const name = v.name.toLowerCase();
    return v.lang.toLowerCase().startsWith("en") && FEMALE_VOICE_KEYWORDS.some((kw) => name.includes(kw));
  });
  if (anyEnFemale) return anyEnFemale;

  // Priority 5: Any non-male English voice
  const anyNonMaleEn = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith("en") &&
      !v.name.toLowerCase().includes("male") &&
      !v.name.toLowerCase().includes("david") &&
      !v.name.toLowerCase().includes("mark")
  );
  if (anyNonMaleEn) return anyNonMaleEn;

  return voices[0] || null;
}

/**
 * Prepares and speaks the answer using a sweet, calm, warm female voice.
 * Automatically cleans citations [C1], [C2], URLs, and technical symbols.
 */
export function speakAnswer(
  text: string,
  langCode: string = "en",
  onEnd?: () => void,
  onError?: () => void
): () => void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => {};
  }

  window.speechSynthesis.cancel();

  // Clean out citations ([C1], [C2]), markdown syntax, URLs, and excessive spaces
  const clean = text
    .replace(/\[C\d+\]/gi, "")
    .replace(/\[\d+\]/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[*_#`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    if (onEnd) onEnd();
    return () => {};
  }

  const utterance = new SpeechSynthesisUtterance(clean);

  // Soft, sweet, calm, warm, and natural female voice settings
  utterance.rate = 0.90; // Slightly slower than default for calm, clear articulation
  utterance.pitch = 1.10; // Slightly higher natural female pitch (1.05 - 1.15)
  utterance.volume = 0.75; // Comfortable, gentle volume (0.7 - 0.8)

  const applyVoiceAndSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const selectedVoice = selectBestFemaleVoice(langCode, voices);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      const code = langCode.toLowerCase().split(/[-_]/)[0];
      utterance.lang = SPEECH_LANG_TAGS[code] || "en-IN";
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      if (onError) onError();
    };

    window.speechSynthesis.speak(utterance);
  };

  // If voices are already loaded, speak immediately. Otherwise wait for onvoiceschanged.
  const currentVoices = window.speechSynthesis.getVoices();
  if (currentVoices && currentVoices.length > 0) {
    applyVoiceAndSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      applyVoiceAndSpeak();
    };
    // Fallback if event doesn't fire
    setTimeout(() => {
      if (!window.speechSynthesis.speaking) {
        applyVoiceAndSpeak();
      }
    }, 100);
  }

  return () => {
    window.speechSynthesis.cancel();
  };
}
