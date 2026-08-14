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
  const filename = req.filename ?? `audio-${Date.now()}.webm`;
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
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${req.mimeType}\r\n\r\n`,
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
