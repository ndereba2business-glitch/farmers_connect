// Unit tests for the Gemini provider behind Clucky
// (supabase/functions/clucky/providers/gemini.ts). The provider is handed
// its client, so a stand-in plays the part of Google's SDK here: no key,
// no network and no cost.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GEMINI_MODEL, createGeminiProvider, geminiFailure, toGeminiSteps
} from "../../supabase/functions/clucky/providers/gemini.ts";
import { AiError } from "../../supabase/functions/clucky/providers/types.ts";

// A client that records what it was asked and replays the given events.
function fakeClient(events, { fail } = {}) {
  const calls = [];
  return {
    calls,
    interactions: {
      async create(params, options) {
        calls.push({ params, options });
        if (fail) throw fail;
        return (async function* () { for (const event of events) yield event; })();
      }
    }
  };
}

const delta = (text) => ({ event_type: "step.delta", index: 1, delta: { type: "text", text } });
const completed = (status = "completed", usage) => ({ event_type: "interaction.completed", interaction: { id: "i1", status, usage } });

const REQUEST = {
  system: "You are Clucky.",
  messages: [
    { role: "user", content: "My chickens are coughing." },
    { role: "assistant", content: "How old are they, and how many are affected?" },
    { role: "user", content: "4 weeks old, about 20 birds." }
  ],
  maxOutputTokens: 2000
};

test("the whole conversation is sent, so a follow-up is understood", async () => {
  const client = fakeClient([delta("Keep them warm."), completed()]);
  await createGeminiProvider(client).generate(REQUEST, () => {});

  const { params } = client.calls[0];
  assert.deepEqual(params.input.map(step => step.type), ["user_input", "model_output", "user_input"]);
  assert.equal(params.input[1].content[0].text, "How old are they, and how many are affected?");
  assert.equal(params.input.at(-1).content[0].text, "4 weeks old, about 20 birds.");
  assert.equal(params.system_instruction, "You are Clucky.");
});

test("nothing is stored at Google, the answer is streamed and the cost is capped", async () => {
  const client = fakeClient([delta("ok"), completed()]);
  await createGeminiProvider(client).generate(REQUEST, () => {});

  const { params, options } = client.calls[0];
  assert.equal(params.store, false);
  assert.equal(params.stream, true);
  assert.equal(params.generation_config.max_output_tokens, 2000);
  assert.equal(params.generation_config.thinking_level, "low");
  assert.equal(params.previous_interaction_id, undefined, "the conversation is ours, not a server-side session");
  assert.ok(options.timeout_ms > 0, "a call cannot hang forever");
});

test("the model is the economical default unless one is named", async () => {
  assert.match(DEFAULT_GEMINI_MODEL, /^gemini-.*flash/);
  const byDefault = fakeClient([delta("a"), completed()]);
  await createGeminiProvider(byDefault).generate(REQUEST, () => {});
  assert.equal(byDefault.calls[0].params.model, DEFAULT_GEMINI_MODEL);

  const named = fakeClient([delta("a"), completed()]);
  const provider = createGeminiProvider(named, "gemini-3.8-flash");
  await provider.generate(REQUEST, () => {});
  assert.equal(named.calls[0].params.model, "gemini-3.8-flash");
  assert.equal(provider.model, "gemini-3.8-flash");
});

test("the answer arrives piece by piece and comes back whole", async () => {
  const pieces = [];
  const client = fakeClient([
    { event_type: "interaction.created", interaction: { id: "i1", status: "in_progress" } },
    { event_type: "step.start", index: 0, step: { type: "thought" } },
    { event_type: "step.delta", index: 0, delta: { type: "thought_summary", content: { type: "text", text: "thinking about coughs" } } },
    { event_type: "step.stop", index: 0 },
    delta("Separate the sick birds. "),
    delta("Call a vet if more start coughing."),
    completed("completed", { total_input_tokens: 900, total_output_tokens: 60 })
  ]);
  const result = await createGeminiProvider(client).generate(REQUEST, text => pieces.push(text));

  assert.deepEqual(pieces, ["Separate the sick birds. ", "Call a vet if more start coughing."]);
  assert.equal(result.text, "Separate the sick birds. Call a vet if more start coughing.");
  assert.doesNotMatch(result.text, /thinking about/, "the model's own reasoning is never shown");
  assert.equal(result.truncated, false);
  assert.equal(result.declined, false);
  assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 60 });
});

test("an answer cut off at the ceiling is marked so the farmer can ask for the rest", async () => {
  const client = fakeClient([delta("Step 1: clean the drinkers"), completed("incomplete")]);
  const result = await createGeminiProvider(client).generate(REQUEST, () => {});
  assert.equal(result.truncated, true);
  assert.equal(result.declined, false);
});

test("an empty reply is reported as declined, not shown as a blank answer", async () => {
  const blocked = await createGeminiProvider(fakeClient([completed()])).generate(REQUEST, () => {});
  assert.equal(blocked.declined, true);
  const spaces = await createGeminiProvider(fakeClient([delta("  \n "), completed()])).generate(REQUEST, () => {});
  assert.equal(spaces.declined, true);
});

test("failures become one of three plain codes", async () => {
  const cases = [
    [{ name: "BadRequestError", status: 400, body: '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}' }, "not_configured"],
    [{ name: "PermissionDeniedError", status: 403 }, "not_configured"],
    [{ name: "NotFoundError", status: 404 }, "not_configured"],
    [{ name: "RateLimitError", status: 429 }, "busy"],
    [{ name: "InternalServerError", statusCode: 503 }, "busy"],
    [{ name: "ConnectionError" }, "busy"],
    [{ name: "RequestTimeoutError" }, "busy"],
    [{ name: "BadRequestError", status: 400, body: '{"error":{"message":"bad field"}}' }, "failed"],
    [new Error("something else"), "failed"]
  ];
  for (const [thrown, code] of cases) {
    await assert.rejects(
      createGeminiProvider(fakeClient([], { fail: thrown })).generate(REQUEST, () => {}),
      error => error instanceof AiError && error.code === code,
      `${thrown.name} ${thrown.status ?? thrown.statusCode ?? ""} -> ${code}`
    );
  }
});

test("a model that refuses the thinking setting is asked once more without it", async () => {
  const calls = [];
  const client = {
    interactions: {
      async create(params) {
        calls.push(params);
        if (params.generation_config.thinking_level) throw { name: "BadRequestError", status: 400, body: '{"error":{"message":"unsupported field"}}' };
        return (async function* () { yield delta("Answer."); yield completed(); })();
      }
    }
  };
  const result = await createGeminiProvider(client, "some-other-model").generate(REQUEST, () => {});
  assert.equal(result.text, "Answer.");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].generation_config.thinking_level, undefined);
  assert.equal(calls[1].generation_config.max_output_tokens, 2000, "the cost ceiling stays");

  // a rejected key is not retried: nothing would change
  const badKey = fakeClient([], { fail: { name: "BadRequestError", status: 400, body: "API_KEY_INVALID" } });
  await assert.rejects(createGeminiProvider(badKey).generate(REQUEST, () => {}), error => error.code === "not_configured");
  assert.equal(badKey.calls.length, 1);
});

test("a stream that breaks before any text is a failure; one that breaks after keeps what arrived", async () => {
  await assert.rejects(
    createGeminiProvider(fakeClient([{ event_type: "error", error: { code: "unavailable" } }])).generate(REQUEST, () => {}),
    error => error instanceof AiError && error.code === "busy"
  );
  await assert.rejects(
    createGeminiProvider(fakeClient([completed("failed")])).generate(REQUEST, () => {}),
    error => error instanceof AiError && error.code === "failed"
  );
  const partial = await createGeminiProvider(fakeClient([delta("Give clean water."), { event_type: "error", error: { code: "unavailable" } }])).generate(REQUEST, () => {});
  assert.equal(partial.text, "Give clean water.");
});

test("what gets logged about a failure never includes the key or the request", () => {
  const secret = "AIzaSyD-not-a-real-key-000000000000000";
  const failure = geminiFailure({
    name: "BadRequestError", status: 400,
    message: `400 API error: key ${secret} is invalid`,
    body: `{"error":{"message":"API key not valid: ${secret}","details":[{"reason":"API_KEY_INVALID"}]}}`,
    rawResponse: { headers: { "x-goog-api-key": secret } }
  });
  assert.equal(failure.code, "not_configured");
  assert.doesNotMatch(failure.detail, /AIza/);
  assert.doesNotMatch(failure.message, /AIza/);
  assert.doesNotMatch(JSON.stringify(failure), /AIza/);
});

test("blank turns are left out of what is sent", () => {
  assert.deepEqual(
    toGeminiSteps([{ role: "user", content: "q" }, { role: "assistant", content: "  " }, { role: "user", content: "again" }]).map(s => s.content[0].text),
    ["q", "again"]
  );
});
