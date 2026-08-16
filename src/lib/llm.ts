/**
 * LLM Client (Sarvam AI / Multi-Provider Abstraction)
 * ====================================================
 *
 * Server-side REST client for Sarvam AI Chat Completions (`sarvam-30b`)
 * and OpenAI-compatible endpoints. Used for grounded answer generation,
 * hallucination detection, and refusal validation.
 *
 * Provider: Sarvam AI (`sarvam-30b`)
 * Endpoint: POST https://api.sarvam.ai/v1/chat/completions
 * Header: api-subscription-key: ${SARVAM_API_KEY}
 */

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  thinking?: "enabled" | "disabled";
}

export interface LlmResponse {
  content: string;
  finishReason: string | null;
  latencyMs: number;
  attempts: number;
  model: string;
  raw: unknown;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly raw: unknown
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * Generate a chat completion via Sarvam AI REST API with retries, timeout,
 * and structured response parsing.
 *
 * Throws LlmError on permanent failure.
 */
export async function generateChat(req: LlmRequest): Promise<LlmResponse> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey || apiKey.includes("your_sarvam_api_key")) {
    throw new LlmError(
      "SARVAM_API_KEY is missing or unconfigured in .env",
      false,
      null
    );
  }

  const endpoint =
    process.env.SARVAM_LLM_ENDPOINT || "https://api.sarvam.ai/v1/chat/completions";
  const model = process.env.LLM_MODEL || "sarvam-105b-conversations";
  const maxRetries = req.maxRetries ?? Number(process.env.LLM_MAX_RETRIES ?? 2);
  const timeoutMs = req.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS ?? 15_000);

  const payload = {
    model,
    messages: req.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: req.temperature ?? 0.2,
    max_tokens: req.maxTokens ?? 512,
  };

  let attempts = 0;
  let lastError: unknown = null;
  const t0 = performance.now();

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "");
        const isRetryable = resp.status >= 500 || resp.status === 429;
        throw new LlmError(
          `Sarvam LLM HTTP ${resp.status}: ${errorText || resp.statusText}`,
          isRetryable,
          { status: resp.status, body: errorText }
        );
      }

      const json = await resp.json();
      const msgObj = json?.choices?.[0]?.message;
      const content = (typeof msgObj?.content === "string" && msgObj.content.trim())
        ? msgObj.content
        : (typeof msgObj?.reasoning_content === "string" ? msgObj.reasoning_content : "");
      const finishReason = json?.choices?.[0]?.finish_reason ?? null;

      return {
        content,
        finishReason,
        latencyMs: performance.now() - t0,
        attempts,
        model: json?.model ?? model,
        raw: json,
      };
    } catch (e) {
      lastError = e;
      if (e instanceof LlmError && !e.retryable) break;
      if (attempts > maxRetries) break;
      await sleep(Math.min(800 * 2 ** (attempts - 1), 3000));
    }
  }

  if (lastError instanceof LlmError) throw lastError;
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new LlmError(`Sarvam LLM failed after ${attempts} attempts: ${msg}`, false, null);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
