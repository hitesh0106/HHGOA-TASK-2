/**
 * Sarvam AI Speech-to-Text Client
 * ===============================
 *
 * Wraps Sarvam AI's `/speech-to-text` REST endpoint with the `saaras:v3`
 * model. Handles:
 *   • multipart/form-data upload of audio bytes
 *   • `mode` parameter (transcribe | translate | verbatim | translit | codemix)
 *   • timeouts and retries with exponential backoff
 *   • structured response with latency instrumentation
 *
 * Reference: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview
 */

const SARVAM_STT_ENDPOINT =
  process.env.SARVAM_STT_ENDPOINT ?? "https://api.sarvam.ai/speech-to-text";
const SARVAM_API_KEY = process.env.SARVAM_API_KEY ?? "";
const SARVAM_STT_MODEL = process.env.SARVAM_STT_MODEL ?? "saaras:v3";
const SARVAM_STT_MODE = (process.env.SARVAM_STT_MODE ?? "transcribe") as
  | "transcribe"
  | "translate"
  | "verbatim"
  | "translit"
  | "codemix";

/**
 * MIME types Sarvam accepts (from official docs).
 * Used to sanitize the incoming MIME type — Sarvam does strict string matching
 * and rejects e.g. "audio/webm;codecs=opus" even though "audio/webm" is allowed.
 */
const SARVAM_ACCEPTED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mpeg3",
  "audio/x-mpeg-3",
  "audio/x-mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/pcm_s16le",
  "audio/pcm_l16",
  "audio/pcm_raw",
  "audio/raw",
  "application/octet-stream",
  "audio/aac",
  "audio/x-aac",
  "audio/aiff",
  "audio/x-aiff",
  "audio/ogg",
  "audio/opus",
  "audio/flac",
  "audio/x-flac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/amr",
  "audio/x-ms-wma",
  "audio/webm",
  "video/webm",
]);

/**
 * Sanitize the incoming MIME type for Sarvam.
 *
 * Browsers record audio as e.g. "audio/webm;codecs=opus" — Sarvam rejects this
 * because it does strict string matching and only "audio/webm" is in the
 * allow-list. We strip codec parameters and validate against the accepted list.
 * Falls back to "application/octet-stream" (which Sarvam accepts) if the
 * sanitized MIME type is not in the allow-list.
 */
function sanitizeMimeType(mimeType: string): string {
  if (!mimeType) return "application/octet-stream";
  // Strip codec parameters: "audio/webm;codecs=opus" → "audio/webm"
  const base = mimeType.split(";")[0].trim().toLowerCase();
  if (SARVAM_ACCEPTED_MIME_TYPES.has(base)) return base;
  // Unknown MIME type — use octet-stream (Sarvam auto-detects codec)
  return "application/octet-stream";
}

/**
 * Pick a sensible file extension for the sanitized MIME type.
 */
function extensionForMimeType(mime: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mpeg3": "mp3",
    "audio/x-mpeg-3": "mp3",
    "audio/x-mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/aac": "aac",
    "audio/x-aac": "aac",
    "audio/aiff": "aiff",
    "audio/x-aiff": "aiff",
    "audio/amr": "amr",
    "audio/x-ms-wma": "wma",
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/pcm_s16le": "pcm",
    "audio/pcm_l16": "pcm",
    "audio/pcm_raw": "pcm",
    "audio/raw": "pcm",
  };
  return map[mime] ?? "bin";
}

export interface SttRequest {
  /** Raw audio bytes (webm, wav, mp3, etc.) */
  audio: Buffer;
  /** MIME type, e.g. "audio/webm" or "audio/wav" */
  mimeType: string;
  /** Filename hint for the multipart upload */
  filename?: string;
  /** Output mode (default: SARVAM_STT_MODE env var) */
  mode?: "transcribe" | "translate" | "verbatim" | "translit" | "codemix";
  /** Optional BCP-47 language code; omit for auto-detection */
  languageCode?: string;
  /** Request timeout (ms) */
  timeoutMs?: number;
  /** Max retry attempts (default 2) */
  maxRetries?: number;
}

export interface SttResponse {
  transcript: string;
  languageCode: string | null;
  languageProbability: number | null;
  requestId: string | null;
  latencyMs: number;
  attempts: number;
  raw: unknown;
}

export class SarvamSttError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly retryable: boolean,
    public readonly raw: unknown
  ) {
    super(message);
    this.name = "SarvamSttError";
  }
}

/**
 * Transcribe an audio buffer via Sarvam AI /speech-to-text.
 *
 * Retries on network errors and 5xx responses with exponential backoff.
 * Throws SarvamSttError on permanent failure.
 */
export async function transcribeAudio(req: SttRequest): Promise<SttResponse> {
  if (!SARVAM_API_KEY) {
    throw new SarvamSttError(
      "SARVAM_API_KEY is not set. Configure it in .env.",
      null,
      false,
      null
    );
  }

  const mode = req.mode ?? SARVAM_STT_MODE;
  // Sanitize MIME type — Sarvam rejects "audio/webm;codecs=opus" but accepts "audio/webm"
  const sanitizedMime = sanitizeMimeType(req.mimeType);
  const ext = extensionForMimeType(sanitizedMime);
  const filename = req.filename ?? `audio-${Date.now()}.${ext}`;
  const timeoutMs = req.timeoutMs ?? 30_000;
  const maxRetries = req.maxRetries ?? 2;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Build multipart/form-data manually to avoid an extra dep
  const boundary = `----sarvam-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const parts: Buffer[] = [];

  const addField = (name: string, value: string) => {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        "utf8"
      )
    );
  };
  addField("model", SARVAM_STT_MODEL);
  addField("mode", mode);
  if (req.languageCode) addField("language_code", req.languageCode);

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${sanitizedMime}\r\n\r\n`,
      "utf8"
    )
  );
  parts.push(req.audio);
  parts.push(Buffer.from("\r\n"));
  parts.push(Buffer.from(`--${boundary}--\r\n`, "utf8"));
  const body = Buffer.concat(parts);

  let attempts = 0;
  let lastError: unknown = null;
  const t0 = performance.now();

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const res = await fetch(SARVAM_STT_ENDPOINT, {
        method: "POST",
        headers: {
          "api-subscription-key": SARVAM_API_KEY,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
        signal: controller.signal,
      });

      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }

      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429;
        const err = new SarvamSttError(
          `Sarvam STT failed: HTTP ${res.status} - ${text.slice(0, 500)}`,
          res.status,
          retryable,
          parsed
        );
        if (!retryable || attempts > maxRetries) {
          clearTimeout(timeout);
          throw err;
        }
        lastError = err;
        await sleep(Math.min(1000 * 2 ** (attempts - 1), 4000));
        continue;
      }

      const data = parsed as {
        transcript?: string;
        language_code?: string | null;
        language_probability?: number | null;
        request_id?: string | null;
      };
      clearTimeout(timeout);
      return {
        transcript: data.transcript ?? "",
        languageCode: data.language_code ?? null,
        languageProbability: data.language_probability ?? null,
        requestId: data.request_id ?? null,
        latencyMs: performance.now() - t0,
        attempts,
        raw: parsed,
      };
    } catch (e) {
      lastError = e;
      if (attempts > maxRetries) break;
      await sleep(Math.min(1000 * 2 ** (attempts - 1), 4000));
    }
  }

  clearTimeout(timeout);
  if (lastError instanceof SarvamSttError) throw lastError;
  throw new SarvamSttError(
    `Sarvam STT failed after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
    null,
    false,
    null
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
