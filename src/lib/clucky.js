// Client-side helpers for Clucky AI (src/pages/CluckyAI.jsx). The answer
// arrives from the "clucky" edge function as newline-delimited JSON, one
// event per line (see supabase/functions/clucky/index.ts). No imports, so
// this file is unit tested on its own.

export const MAX_QUESTION_LENGTH = 1500;

export const SUGGESTIONS = [
  "My chicks are 5 days old. What should I watch for this week?",
  "Some of my layers have stopped laying. Why?",
  "How do I know if it is Newcastle disease?",
  "How can I cut my feed costs without hurting growth?",
  "Vaccination schedule for broilers in Kenya"
];

// Network chunks don't line up with lines: an event can be split across
// two chunks, or several can arrive together. Feed chunks in as they come;
// each complete line is handed to onEvent as a parsed object.
export function createEventParser(onEvent) {
  let buffer = "";
  function emit(line) {
    const text = line.trim();
    if (!text) return;
    try {
      onEvent(JSON.parse(text));
    } catch {
      // a damaged line is skipped rather than ending the whole answer
    }
  }
  return {
    push(chunk) {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        emit(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    },
    // call once the stream ends, in case the last line had no newline
    finish() {
      emit(buffer);
      buffer = "";
    }
  };
}

// Applies one event to the answer being built up.
//   state: { text, status: "streaming" | "done" | "error", code, truncated }
export function applyEvent(state, event) {
  switch (event?.t) {
    case "delta":
      return { ...state, text: state.text + (event.text || "") };
    case "reset":
      return { ...state, text: "" };
    case "done":
      return { ...state, status: "done", truncated: Boolean(event.truncated) };
    case "error":
      return { ...state, status: "error", code: event.code || "failed" };
    default:
      return state;
  }
}

export const startingAnswer = () => ({ text: "", status: "streaming", code: null, truncated: false });

// What to tell the farmer for each problem the function can report.
export function cluckyErrorMessage(code, details = {}) {
  switch (code) {
    case "not_signed_in":
      return "Please sign in again to use Clucky.";
    case "not_configured":
      return "Clucky isn't switched on yet. Please try again later.";
    case "empty":
      return "Type your question first.";
    case "too_long":
      return `That question is too long. Keep it under ${MAX_QUESTION_LENGTH.toLocaleString()} characters.`;
    case "daily_limit":
      return `You've reached today's limit of ${details.limit || 30} questions. Clucky will be ready again tomorrow. If birds are sick or dying, use Ask Vet now.`;
    case "declined":
      return "Clucky couldn't answer that one. Try asking it another way, or ask a vet. Your question is still in the box.";
    case "busy":
      return "Clucky is busy right now. Wait a moment and try again. Your question is still in the box.";
    case "offline":
      return "You seem to be offline. Check your connection and try again. Your question is still in the box.";
    default:
      return "Clucky couldn't answer just now. Try again in a moment. Your question is still in the box.";
  }
}
