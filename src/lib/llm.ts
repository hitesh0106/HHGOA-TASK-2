/**
 * LLM Client (z-ai-web-dev-sdk)
 * =============================
 *
 * Thin wrapper around the in-house ZAI SDK chat completions API. Used for
 * grounded answer generation, hallucination detection, and answer validation.
 *
 * Why z-ai-web-dev-sdk?
 * ---------------------
 * The Hacker House Goa task gives us a Sarvam API key but Sarvam does not
 * currently expose a general-purpose chat LLM endpoint suitable for grounded
 * answer generation. The in-house ZAI SDK provides GLM-4.5 (a strong
 * multilingual LLM) free of charge in this sandbox, with no extra API key
 * required.
 *
 * For production deployment, this module is the single integration point —
 * swap implementations to Sarvam's LLM, OpenAI, Anthropic, etc. without
 * touching the rest of the pipeline.
 */

import ZAI from "z-ai-web-dev-sdk";

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

let cachedClient: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getClient(): Promise<Awaited<ReturnType<typeof ZAI.create>>> {
  if (cachedClient) return cachedClient;
  cachedClient = await ZAI.create();
  return cachedClient;
}

/**
 * Generate a chat completion with retries, timeout, and structured response.
 *
 * Throws LlmError on permanent failure.
 */
export async function generateChat(req: LlmRequest): Promise<LlmResponse> {
  const maxRetries = req.maxRetries ?? 2;
  const timeoutMs = req.timeoutMs ?? 15_000;

  let attempts = 0;
  let lastError: unknown = null;
  const t0 = performance.now();

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const client = await getClient();
      // Race the completion against a timeout
      const completion = await Promise.race([
        client.chat.completions.create({
          messages: req.messages as any,
          temperature: req.temperature ?? 0.2,
          max_tokens: req.maxTokens ?? 1024,
          thinking: { type: req.thinking === "enabled" ? "enabled" : "disabled" },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new LlmError(`LLM timed out after ${timeoutMs}ms`, true, null)), timeoutMs)
        ),
      ]);

      const content = completion?.choices?.[0]?.message?.content ?? "";
      const finishReason = completion?.choices?.[0]?.finish_reason ?? null;
      return {
        content,
        finishReason,
        latencyMs: performance.now() - t0,
        attempts,
        model: completion?.model ?? "glm-4.5",
        raw: completion,
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
  throw new LlmError(`LLM failed after ${attempts} attempts: ${msg}`, false, null);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
