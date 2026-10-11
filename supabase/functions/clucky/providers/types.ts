// The one seam between Clucky and whichever AI service answers.
//
// index.ts knows farmers, limits and the conversation; a provider knows one
// vendor's API. To move Clucky to another service, write another file that
// returns an AiProvider and pick it in providers/index.ts. Nothing in the
// app, the database or the rest of the function changes.

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AiRequest = {
  // Who Clucky is and what it knows about this farm.
  system: string;
  // The conversation, oldest first, ending with the new question.
  messages: ChatMessage[];
  // A ceiling on what one answer can cost, not a target.
  maxOutputTokens: number;
};

export type AiResult = {
  text: string;
  // The answer was cut off at the token ceiling.
  truncated: boolean;
  // The service refused or returned nothing usable.
  declined: boolean;
  usage?: { inputTokens?: number; outputTokens?: number };
};

// Why a call failed, in terms the app can explain to a farmer:
//   not_configured  the key or model name is wrong: only the owner can fix it
//   busy            rate limited, overloaded or unreachable: worth retrying
//   failed          anything else
export type AiFailure = "not_configured" | "busy" | "failed";

export class AiError extends Error {
  code: AiFailure;
  // Safe to log: never contains the key, the question or the answer.
  detail: string;
  constructor(code: AiFailure, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "AiError";
    this.code = code;
    this.detail = detail;
  }
}

export interface AiProvider {
  name: string;
  model: string;
  // Writes the answer. `onText` is called with each piece as it arrives so
  // it can be shown while it is being written. Throws AiError on failure.
  generate(request: AiRequest, onText: (text: string) => void): Promise<AiResult>;
}
