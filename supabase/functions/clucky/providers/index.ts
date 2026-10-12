// Chooses the AI service behind Clucky. Today that is Gemini; adding
// another means one more file beside gemini.ts and one more case here.
//
// Secrets are read here and nowhere else:
//   GEMINI_API_KEY   required. Set with `supabase secrets set`, never in
//                    the app's .env and never with a VITE_ prefix.
//   GEMINI_MODEL     optional. Defaults to the lowest-cost Flash model.
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_GEMINI_MODEL, createGeminiProvider, type GeminiClient } from "./gemini.ts";
import type { AiProvider } from "./types.ts";

// Returns null when the key has not been set, so the caller can say that
// Clucky is not switched on instead of failing obscurely.
export function getProvider(): AiProvider | null {
  // A key pasted with a space, a line break or its quotation marks still
  // around it is rejected by Google as invalid, so those are removed.
  const apiKey = (Deno.env.get("GEMINI_API_KEY") || "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (!apiKey) return null;
  const model = Deno.env.get("GEMINI_MODEL")?.trim() || DEFAULT_GEMINI_MODEL;
  const client = new GoogleGenAI({ apiKey }) as unknown as GeminiClient;
  return createGeminiProvider(client, model);
}
