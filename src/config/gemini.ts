import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

/** OpenAI-compatible clients — one per configured Gemini API key. */
let geminiClients: OpenAI[] = [];
/** Index of the key currently in use; advanced by `rotateGeminiKey` on a 429. */
let currentKeyIndex = 0;

/**
 * Parses every configured Gemini API key. Two forms are supported (and may be
 * combined) so multiple keys can be used for rate-limit failover:
 *  - `GEMINI_API_KEY` — a single key, or a comma-separated list.
 *  - `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, … — numbered extras.
 */
function parseApiKeys(): string[] {
  const keys: string[] = [];
  for (const part of (process.env.GEMINI_API_KEY ?? "").split(",")) {
    const key = part.trim();
    if (key) keys.push(key);
  }
  for (let i = 2; i <= 10; i++) {
    const key = (process.env[`GEMINI_API_KEY_${i}`] ?? "").trim();
    if (key) keys.push(key);
  }
  return [...new Set(keys)];
}

function ensureClients(): void {
  if (geminiClients.length > 0) {
    return;
  }
  const keys = parseApiKeys();
  if (keys.length === 0) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not defined! Please configure it in your .env file."
    );
  }
  geminiClients = keys.map(
    (apiKey) => new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL })
  );
}

/** True when at least one Gemini API key is configured. */
export function isGeminiKey(): boolean {
  return parseApiKeys().length > 0;
}

/** The OpenAI-compatible client for the API key currently in use. */
export function getGeminiClient(): OpenAI {
  ensureClients();
  return geminiClients[currentKeyIndex];
}

/** Number of configured API keys. */
export function getGeminiKeyCount(): number {
  ensureClients();
  return geminiClients.length;
}

/** Rotates to the next configured API key; returns the new 0-based index. */
export function rotateGeminiKey(): number {
  ensureClients();
  currentKeyIndex = (currentKeyIndex + 1) % geminiClients.length;
  console.log(
    `[Gemini] rotated to API key #${currentKeyIndex + 1}/${geminiClients.length}`
  );
  return currentKeyIndex;
}

/**
 * Resolves the Model ID for LLM chat operations.
 */
export function getGeminiModel(): string {
  if (process.env.LLM_MODEL) {
    return process.env.LLM_MODEL;
  }
  return "gemini-2.5-flash";
}

/**
 * Resolves the Model ID for vector embedding operations.
 */
export function getEmbeddingModel(): string {
  // `gemini-embedding-001` is the current embedding model available on the
  // free tier (the older `text-embedding-004` now 404s on this API version).
  return "gemini-embedding-001";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when an error is an HTTP 429 (rate limit). */
function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const e = error as { status?: unknown; message?: unknown };
  if (e.status === 429) {
    return true;
  }
  return typeof e.message === "string" && e.message.includes("429");
}

/**
 * Chat completion with rate-limit resilience. On a 429 it rotates to the next
 * API key IMMEDIATELY (a fresh key may still have quota); only once every key
 * in a pass has been rate-limited does it back off before the next pass.
 */
export async function geminiChatWithRetry(
  params: Parameters<OpenAI["chat"]["completions"]["create"]>[0],
  maxCycles = 3
): Promise<any> {
  ensureClients();
  const keyCount = geminiClients.length;
  let sleepMs = 2500;

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    for (let keyAttempt = 0; keyAttempt < keyCount; keyAttempt++) {
      try {
        // `reasoning_effort: "none"` disables Gemini "thinking" so the whole
        // token budget goes to the answer. It is not in the OpenAI SDK's
        // `ReasoningEffort` union, hence the cast.
        const response = await geminiClients[currentKeyIndex].chat.completions.create({
          ...params,
          reasoning_effort: "none",
        } as unknown as typeof params);

        if (response && "usage" in response && response.usage) {
          console.log(
            `[Gemini Token Usage] Model: ${params.model || "default"} | Prompt Tokens: ${response.usage.prompt_tokens} | Output Tokens: ${response.usage.completion_tokens} | Total: ${response.usage.total_tokens}`
          );
        }else {
          console.log(
            `[Gemini Token Usage] Model: ${params.model || "default"} | No usage info`
          );
        }

        return response;
      } catch (error) {
        if (!isRateLimitError(error)) {
          throw error; // Non-429 — fail fast, retrying will not help.
        }
        const lastKeyInPass = keyAttempt === keyCount - 1;
        const lastCycle = cycle === maxCycles - 1;
        if (lastKeyInPass && lastCycle) {
          throw error; // Every key rate-limited on the final pass.
        }
        rotateGeminiKey();
        if (lastKeyInPass) {
          console.log(
            `[Gemini Rate-Limit Control] all ${keyCount} key(s) rate-limited; ` +
            `sleeping ${sleepMs}ms before the next pass...`
          );
          await sleep(sleepMs);
          sleepMs = Math.round(sleepMs * 1.5);
        }
      }
    }
  }
  // Unreachable — the loop always returns a response or throws.
  throw new Error("geminiChatWithRetry: exhausted all API keys and retries");
}



export function getGeminiAudioModel() {
  const apiKey = parseApiKeys()[0];

  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });
}