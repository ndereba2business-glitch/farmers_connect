// Clucky on Google's Gemini API, through the Interactions API of the
// official SDK (@google/genai).
//
// This file never imports the SDK: it is handed a client (see
// providers/index.ts), so it is plain TypeScript that the unit tests run
// from Node with a stand-in client (tests/unit/cluckyGemini.test.js).
//
// The call is stateless. The conversation is kept in our own database and
// sent with each question, and `store: false` tells Google not to keep a
// copy of the exchange for later retrieval.
import { AiError, type AiFailure, type AiProvider, type AiRequest, type AiResult, type ChatMessage } from "./types.ts";

// The lowest-cost current Flash model. Override with the GEMINI_MODEL secret.
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

// Give up on a call that has produced nothing for this long.
const TIMEOUT_MS = 60_000;

type TextPart = { type: "text"; text: string };
export type GeminiStep = { type: "user_input" | "model_output"; content: TextPart[] };

// The parts of the SDK this file uses, so a test can stand in for it.
// deno-lint-ignore no-explicit-any
type StreamEvent = Record<string, any>;
export type GeminiClient = {
  interactions: {
    create(params: Record<string, unknown>, options?: Record<string, unknown>): Promise<AsyncIterable<StreamEvent>>;
  };
};

// Our stored conversation in the shape the API expects. Gemini calls the
// assistant's turns "model_output".
export function toGeminiSteps(messages: ChatMessage[]): GeminiStep[] {
  return messages
    .filter(m => m.content.trim())
    .map(m => ({
      type: m.role === "assistant" ? "model_output" as const : "user_input" as const,
      content: [{ type: "text" as const, text: m.content }]
    }));
}

function statusOf(error: unknown): number {
  // deno-lint-ignore no-explicit-any
  const e = (error || {}) as any;
  return Number(e.status ?? e.statusCode) || 0;
}

// Turns whatever the SDK threw into one of our three failure codes.
// Reads the status and a short reason only: never the message body, which
// could echo part of the request.
export function geminiFailure(error: unknown): AiError {
  // deno-lint-ignore no-explicit-any
  const e = (error || {}) as any;
  const status = Number(e.status ?? e.statusCode) || 0;
  const name = typeof e.name === "string" ? e.name : "Error";
  const body = typeof e.body === "string" ? e.body : "";
  const badKey = /API_KEY_INVALID|API key not valid|API key expired|API_KEY_SERVICE_BLOCKED/i.test(body);

  let code: AiFailure = "failed";
  if (badKey || status === 401 || status === 403 || status === 404) code = "not_configured";
  else if (status === 429 || status >= 500) code = "busy";
  else if (/Connection|Timeout|Abort/i.test(name)) code = "busy";

  return new AiError(code, `${name}${status ? ` ${status}` : ""}${badKey ? " (API key rejected)" : ""}`);
}

export function createGeminiProvider(client: GeminiClient, model: string = DEFAULT_GEMINI_MODEL): AiProvider {
  return {
    name: "gemini",
    model,

    async generate(request: AiRequest, onText: (text: string) => void): Promise<AiResult> {
      let text = "";
      let status = "";
      let streamError = "";
      let usage: AiResult["usage"];

      const open = (withThinkingLevel: boolean) => client.interactions.create({
        model,
        input: toGeminiSteps(request.messages),
        system_instruction: request.system,
        stream: true,
        store: false,
        generation_config: {
          max_output_tokens: request.maxOutputTokens,
          // A chat answer needs a little thought, not a long deliberation:
          // thinking is billed as output.
          ...(withThinkingLevel ? { thinking_level: "low" } : {})
        }
      }, { timeout_ms: TIMEOUT_MS });

      try {
        let stream: AsyncIterable<StreamEvent>;
        try {
          stream = await open(true);
        } catch (error) {
          // Not every model accepts a thinking level. If the request itself
          // was refused (and not because of the key), ask once more without
          // it, so a model named in GEMINI_MODEL does not fail every question.
          const refused = geminiFailure(error);
          if (statusOf(error) !== 400 || refused.code === "not_configured") throw refused;
          stream = await open(false);
        }

        for await (const event of stream) {
          if (event.event_type === "step.delta" && event.delta?.type === "text" && event.delta.text) {
            text += event.delta.text;
            onText(event.delta.text);
          } else if (event.event_type === "interaction.completed" || event.event_type === "interaction.status_update") {
            status = event.interaction?.status || event.status || status;
            const u = event.interaction?.usage;
            if (u) usage = { inputTokens: u.total_input_tokens, outputTokens: u.total_output_tokens };
          } else if (event.event_type === "error") {
            streamError = String(event.error?.code || "stream error");
          }
        }
      } catch (error) {
        if (error instanceof AiError) throw error;
        throw geminiFailure(error);
      }

      text = text.trim();
      if (streamError && !text) throw new AiError("busy", `stream error ${streamError}`.slice(0, 80));
      if (status === "failed" && !text) throw new AiError("failed", "interaction failed");

      return {
        text,
        truncated: status === "incomplete" && Boolean(text),
        // Finished but wrote nothing: a safety filter stopped it, or it had
        // nothing to say. Either way there is no answer to show.
        declined: !text,
        usage
      };
    }
  };
}
