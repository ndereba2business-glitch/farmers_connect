// Unit tests for Clucky AI: the stream reader the app uses
// (src/lib/clucky.js) and what the edge function tells the model
// (supabase/functions/clucky/prompt.ts, plain TypeScript that Node runs
// directly).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEvent, cluckyErrorMessage, createEventParser, startingAnswer } from "../../src/lib/clucky.js";
import {
  HISTORY_MESSAGES, MAX_QUESTION_LENGTH, SYSTEM_PROMPT,
  buildFarmContext, checkQuestion, modelOptions, toModelMessages
} from "../../supabase/functions/clucky/prompt.ts";

function read(chunks) {
  const events = [];
  const parser = createEventParser(e => events.push(e));
  for (const chunk of chunks) parser.push(chunk);
  parser.finish();
  return events;
}

test("events are read correctly however the network splits them", () => {
  const whole = '{"t":"delta","text":"Hello "}\n{"t":"delta","text":"farmer"}\n{"t":"done","truncated":false}\n';
  const expected = [{ t: "delta", text: "Hello " }, { t: "delta", text: "farmer" }, { t: "done", truncated: false }];

  assert.deepEqual(read([whole]), expected, "all at once");
  assert.deepEqual(read(whole.split("")), expected, "one character at a time");
  assert.deepEqual(read([whole.slice(0, 17), whole.slice(17, 40), whole.slice(40)]), expected, "cut mid-event");
  assert.deepEqual(read(['{"t":"done"}']), [{ t: "done" }], "a last line without a newline still counts");
});

test("a damaged line is skipped without losing the rest", () => {
  assert.deepEqual(read(['{"t":"delta","text":"a"}\nnot json\n\n{"t":"delta","text":"b"}\n']),
    [{ t: "delta", text: "a" }, { t: "delta", text: "b" }]);
});

test("text with newlines and quotes survives the trip", () => {
  const text = 'Step 1:\n- Give "clean" water\n- Isolate sick birds';
  assert.deepEqual(read([JSON.stringify({ t: "delta", text }) + "\n"]), [{ t: "delta", text }]);
});

test("the answer builds up, and is discarded when another model takes over", () => {
  let answer = startingAnswer();
  for (const e of [{ t: "delta", text: "I cannot" }, { t: "reset" }, { t: "delta", text: "Isolate " }, { t: "delta", text: "the birds." }]) {
    answer = applyEvent(answer, e);
  }
  assert.equal(answer.text, "Isolate the birds.");
  assert.equal(answer.status, "streaming");

  assert.deepEqual(applyEvent(answer, { t: "done", truncated: true }), { text: "Isolate the birds.", status: "done", code: null, truncated: true });
  assert.equal(applyEvent(answer, { t: "error", code: "busy" }).code, "busy");
  assert.equal(applyEvent(answer, { t: "error" }).code, "failed");
  assert.deepEqual(applyEvent(answer, { t: "something new" }), answer, "unknown events are ignored");
});

test("every problem is explained, and the farmer is never left guessing", () => {
  assert.match(cluckyErrorMessage("daily_limit", { limit: 12 }), /limit of 12 questions[\s\S]*Ask Vet/);
  assert.match(cluckyErrorMessage("not_configured"), /isn't switched on yet/);
  assert.match(cluckyErrorMessage("too_long"), /1,500 characters/);
  assert.match(cluckyErrorMessage("declined"), /another way[\s\S]*still in the box/);
  for (const code of ["busy", "offline", "failed", "anything else", undefined]) {
    assert.match(cluckyErrorMessage(code), /still in the box/, String(code));
  }
});

// ---------- what the model is told ----------

test("Clucky is told to stay on poultry, answer in plain text and defer to vets", () => {
  assert.match(SYSTEM_PROMPT, /only help with poultry farming/);
  assert.match(SYSTEM_PROMPT, /Plain text only/);
  assert.match(SYSTEM_PROMPT, /Do not give drug doses/);
  assert.match(SYSTEM_PROMPT, /Ask Vet/);
  assert.match(SYSTEM_PROMPT, /Reply in the language the farmer wrote in/);
  assert.doesNotMatch(SYSTEM_PROMPT, /\d{4}-\d{2}-\d{2}/, "no dates: the instructions stay identical between requests");
});

test("the farmer's records are summarised briefly, with each batch's age", () => {
  const today = new Date("2026-10-09T08:00:00Z");
  const context = buildFarmContext({
    name: " Wanjiru ", county: "Kiambu",
    batches: [
      { batch_name: "House 1", batch_type: "broiler", hatch_date: "2026-09-18", current_count: 480, quantity: 500 },
      { batch_name: "", batch_type: "dual_purpose", hatch_date: null, current_count: null, quantity: 60 }
    ],
    overdueVaccines: [{ vaccine_name: "Gumboro", scheduled_date: "2026-10-02", batch_name: "House 1" }]
  }, today);

  assert.match(context, /^Today is 2026-10-09\./);
  assert.match(context, /Farmer: Wanjiru, Kiambu County\./);
  assert.match(context, /- House 1: broilers, 480 birds, 21 days old \(week 4\)/);
  assert.match(context, /- Unnamed batch: dual-purpose \(improved kienyeji\), 60 birds/);
  assert.match(context, /- Gumboro \(House 1\), due 2026-10-02/);
});

test("an account with no records says so instead of inventing a farm", () => {
  const context = buildFarmContext({}, new Date("2026-10-09T08:00:00Z"));
  assert.match(context, /have not recorded any active batches/);
  assert.doesNotMatch(context, /Farmer:/);
  assert.doesNotMatch(context, /overdue/);
  assert.match(buildFarmContext({ role: "vet" }), /belongs to a vet/);
});

test("long lists are cut so the context stays small", () => {
  const batches = Array.from({ length: 30 }, (_, i) => ({ batch_name: `B${i}`, batch_type: "layer", hatch_date: "2026-01-01", current_count: 10, quantity: 10 }));
  const context = buildFarmContext({ batches });
  assert.equal(context.split("\n").filter(l => l.startsWith("- B")).length, 8);
});

test("questions are trimmed and checked before any money is spent", () => {
  assert.deepEqual(checkQuestion("  Why are my hens pecking?  "), { ok: true, question: "Why are my hens pecking?" });
  assert.deepEqual(checkQuestion("   "), { ok: false, code: "empty" });
  assert.deepEqual(checkQuestion(undefined), { ok: false, code: "empty" });
  assert.deepEqual(checkQuestion({ text: "hi" }), { ok: false, code: "empty" });
  assert.deepEqual(checkQuestion("x".repeat(MAX_QUESTION_LENGTH)).ok, true);
  assert.deepEqual(checkQuestion("x".repeat(MAX_QUESTION_LENGTH + 1)), { ok: false, code: "too_long" });
});

test("the conversation sent to the model is recent, starts with a question and ends with the new one", () => {
  const history = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const messages = toModelMessages(history, "new question");
  assert.equal(messages.length, HISTORY_MESSAGES + 1);
  assert.equal(messages[0].role, "user");
  assert.deepEqual(messages.at(-1), { role: "user", content: "new question" });

  const startsWithAnswer = toModelMessages([{ role: "assistant", content: "old answer" }, { role: "user", content: "q" }], "next");
  assert.deepEqual(startsWithAnswer.map(m => m.content), ["q", "next"]);
  assert.deepEqual(toModelMessages([], "first"), [{ role: "user", content: "first" }]);
});

test("request options match what each model accepts", () => {
  assert.deepEqual(modelOptions("claude-opus-5-5"), { fallbacks: true, effort: true });
  assert.deepEqual(modelOptions("claude-sonnet-5-5"), { fallbacks: true, effort: true });
  assert.deepEqual(modelOptions("claude-haiku-4-5"), { fallbacks: false, effort: false });
});
