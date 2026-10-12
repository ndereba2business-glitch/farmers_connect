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
  buildFarmContext, checkQuestion, styleNote, toModelMessages
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
  // whatever went wrong at the AI service, the farmer sees one calm line
  for (const code of ["busy", "failed", "PERMISSION_DENIED: API key AIza...", undefined]) {
    const message = cluckyErrorMessage(code);
    assert.match(message, /having trouble connecting right now\. Please try again in a moment/, String(code));
    assert.doesNotMatch(message, /AIza|API|key|error|stack|Gemini|Google/i, "nothing technical reaches the farmer");
  }
});

// ---------- what the model is told ----------

test("Clucky is told to stay on poultry, answer in plain text and defer to vets", () => {
  assert.match(SYSTEM_PROMPT, /only help with poultry farming/);
  assert.match(SYSTEM_PROMPT, /Plain text only/);
  assert.match(SYSTEM_PROMPT, /Do not give drug doses/);
  assert.match(SYSTEM_PROMPT, /Ask Vet/);
  assert.match(SYSTEM_PROMPT, /Reply in the language the farmer wrote in/);
  assert.match(SYSTEM_PROMPT, /Never state a diagnosis as certain/);
  assert.match(SYSTEM_PROMPT, /Never make up a medicine or brand name, a dose, a withdrawal period/);
  assert.match(SYSTEM_PROMPT, /say so plainly/);
  assert.match(SYSTEM_PROMPT, /one continuing conversation/);
  assert.match(SYSTEM_PROMPT, /ask for the one or two facts that matter most/);
  assert.match(SYSTEM_PROMPT, /never hold back urgent advice while you wait for an answer/);
  for (const sign of ["sudden deaths", "deaths that are rising day by day", "severe breathing trouble", "paralysis", "suspected poisoning", "serious injury"]) {
    assert.match(SYSTEM_PROMPT, new RegExp(sign), `"${sign}" is treated as urgent`);
  }
  assert.doesNotMatch(SYSTEM_PROMPT, /\d{4}-\d{2}-\d{2}/, "no dates: the instructions stay identical between requests");
  assert.doesNotMatch(SYSTEM_PROMPT, /[`*#]/, "the instructions themselves are plain text, like the answers asked for");
});

test("Clucky has a character, and the character never outranks the safety rules", () => {
  assert.match(SYSTEM_PROMPT, /You are a chicken, and a sharp one/);
  assert.match(SYSTEM_PROMPT, /The advice always comes first/);
  // sparing and varied, not a sign-off on every answer
  assert.match(SYSTEM_PROMPT, /roughly one answer in three/);
  assert.match(SYSTEM_PROMPT, /Never reuse a line or its pattern/);
  assert.match(SYSTEM_PROMPT, /They are not a list to work through/);
  // nothing playful about sick or dying birds
  assert.match(SYSTEM_PROMPT, /Drop the chicken talk completely when the subject is serious/);
  assert.match(SYSTEM_PROMPT, /must never feel you are making light of it/);
  assert.match(SYSTEM_PROMPT, /the health and safety rules win/);
  assert.ok(
    SYSTEM_PROMPT.indexOf("Who you are:") < SYSTEM_PROMPT.indexOf("Health and safety:"),
    "the safety rules are read last, after the personality"
  );
});

test("a full answer is asked for only when the question needs one", () => {
  for (const part of ["The direct answer", "Why:", "The practical steps, most important first", "What to watch", "How to stop it happening again", "One follow-up question"]) {
    assert.match(SYSTEM_PROMPT, new RegExp(part));
  }
  assert.match(SYSTEM_PROMPT, /a way of thinking, not a form to fill in/);
  assert.match(SYSTEM_PROMPT, /leave out every part the question does not need/);
  assert.match(SYSTEM_PROMPT, /do not ask for what you can already see/);
});

test("Clucky is told to be careful with medicines, honest about doubt and neutral about sellers", () => {
  assert.match(SYSTEM_PROMPT, /Never suggest antibiotics as a first step, routinely, "just in case" or without a diagnosis/);
  assert.match(SYSTEM_PROMPT, /only an examination or a lab test can confirm/);
  assert.match(SYSTEM_PROMPT, /move sick birds away from the healthy ones/);
  assert.match(SYSTEM_PROMPT, /a statistic or a price/);
  assert.match(SYSTEM_PROMPT, /Never name or recommend a particular business, shop or brand/);
  assert.match(SYSTEM_PROMPT, /It is not a guarantee of their products or prices/);
});

test("Clucky is told to check its sums, and to say what protects people when birds are dying", () => {
  // found by reading real answers: "one box for every 4 to 5 hens" next to "about 5 boxes" for 50 hens
  assert.match(SYSTEM_PROMPT, /do the sum before you write the answer and show it/);
  assert.match(SYSTEM_PROMPT, /a rule and a result that disagree is worse than no number at all/);
  assert.match(SYSTEM_PROMPT, /also say these two things every time/);
  assert.match(SYSTEM_PROMPT, /the county veterinary office should be told/);
  assert.match(SYSTEM_PROMPT, /sick or dead birds must not be eaten, sold or given away/);
});

test("a question about sick or dying birds switches the chicken talk off, in English and Swahili", () => {
  const serious = [
    "My broilers are dying, 12 dead since yesterday",
    "3 of my layers died this morning",
    "They are coughing and gasping at night",
    "bloody droppings in the brooder",
    "I lost 40 birds this week",
    "Is this Newcastle disease?",
    "kuku wangu wamekufa watatu leo",
    "Kuku ni wagonjwa na wanakohoa",
    "kuku ana damu kwa kinyesi",
    "My chicks look weak and are not eating"
  ];
  for (const question of serious) {
    assert.match(styleNote([], question), /no chicken expressions/, question);
  }
  const calm = [
    "What diet is best for layers at 20 weeks?",
    "How much feed does a broiler eat per day?",
    "Can you illustrate how to build a brooder?",
    "When do kienyeji hens start laying?",
    "Ninaweza kuuza mayai wapi?",
    "How do I record a sale in My Farm?"
  ];
  for (const question of calm) {
    assert.equal(styleNote([], question), "", question);
  }
});

test("a chicken line is never allowed two answers in a row", () => {
  const afterAJoke = [
    { role: "user", content: "How many nest boxes for 50 layers?" },
    { role: "assistant", content: "About 10 to 12 boxes, one for every four or five hens. That's my two clucks' worth!" }
  ];
  assert.match(styleNote(afterAJoke, "And how high off the floor?"), /Keep this answer plain/);

  const afterAPlainAnswer = [
    { role: "user", content: "How many nest boxes for 50 layers?" },
    { role: "assistant", content: "About 10 to 12 boxes, one for every four or five hens." }
  ];
  assert.equal(styleNote(afterAPlainAnswer, "And how high off the floor?"), "");

  // only the most recent answer counts, and a serious question still wins
  const olderJoke = [...afterAJoke, { role: "user", content: "ok" }, { role: "assistant", content: "Put them 45 to 60 cm up." }];
  assert.equal(styleNote(olderJoke, "What about lighting?"), "");
  assert.match(styleNote(afterAJoke, "Two hens died overnight"), /no chicken expressions/);
  assert.equal(styleNote([], "Any tips for a new farmer?"), "");
});

test("the farmer's records are summarised briefly, with each batch's age", () => {
  const today = new Date("2026-10-09T08:00:00Z");
  const context = buildFarmContext({
    name: " Wanjiru ", farm_name: "Wanjiru Farm", email: "wanjiru@example.com", phone: "0712345678", county: " Kiambu ",
    batches: [
      { batch_name: "House 1", batch_type: "broiler", hatch_date: "2026-09-18", current_count: 480, quantity: 500 },
      { batch_name: "", batch_type: "dual_purpose", hatch_date: null, current_count: null, quantity: 60 }
    ],
    overdueVaccines: [{ vaccine_name: "Gumboro", scheduled_date: "2026-10-02", batch_name: "House 1" }]
  }, today);

  assert.match(context, /^Today is 2026-10-09\./);
  assert.match(context, /The farm is in Kiambu County, Kenya\./);
  assert.doesNotMatch(context, /Wanjiru|example\.com|0712345678/, "no name, email or phone number goes to the AI service");
  assert.match(context, /- House 1: broilers, 480 birds, 21 days old \(week 4\)/);
  assert.match(context, /- Unnamed batch: dual-purpose \(improved kienyeji\), 60 birds/);
  assert.match(context, /- Gumboro \(House 1\), due 2026-10-02/);
});

test("an account with no records says so instead of inventing a farm", () => {
  const context = buildFarmContext({}, new Date("2026-10-09T08:00:00Z"));
  assert.match(context, /have not recorded any active batches/);
  assert.doesNotMatch(context, /County/);
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
