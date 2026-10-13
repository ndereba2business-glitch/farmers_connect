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

// Tests never really wait between attempts; they record how long the
// provider asked to wait instead.
const waits = [];
const noWait = async (ms) => { waits.push(ms); };
const provider = (client, model) => createGeminiProvider(client, model, noWait);

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
  await provider(client).generate(REQUEST, () => {});

  const { params } = client.calls[0];
  assert.deepEqual(params.input.map(step => step.type), ["user_input", "model_output", "user_input"]);
  assert.equal(params.input[1].content[0].text, "How old are they, and how many are affected?");
  assert.equal(params.input.at(-1).content[0].text, "4 weeks old, about 20 birds.");
  assert.equal(params.system_instruction, "You are Clucky.");
});

test("nothing is stored at Google, the answer is streamed and the cost is capped", async () => {
  const client = fakeClient([delta("ok"), completed()]);
  await provider(client).generate(REQUEST, () => {});

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
  await provider(byDefault).generate(REQUEST, () => {});
  assert.equal(byDefault.calls[0].params.model, DEFAULT_GEMINI_MODEL);

  const named = fakeClient([delta("a"), completed()]);
  const chosen = provider(named, "gemini-3.8-flash");
  await chosen.generate(REQUEST, () => {});
  assert.equal(named.calls[0].params.model, "gemini-3.8-flash");
  assert.equal(chosen.model, "gemini-3.8-flash");
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
  const result = await provider(client).generate(REQUEST, text => pieces.push(text));

  assert.deepEqual(pieces, ["Separate the sick birds. ", "Call a vet if more start coughing."]);
  assert.equal(result.text, "Separate the sick birds. Call a vet if more start coughing.");
  assert.doesNotMatch(result.text, /thinking about/, "the model's own reasoning is never shown");
  assert.equal(result.truncated, false);
  assert.equal(result.declined, false);
  assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 60 });
});

test("an answer cut off at the ceiling is marked so the farmer can ask for the rest", async () => {
  const client = fakeClient([delta("Step 1: clean the drinkers"), completed("incomplete")]);
  const result = await provider(client).generate(REQUEST, () => {});
  assert.equal(result.truncated, true);
  assert.equal(result.declined, false);
});

test("an empty reply is reported as declined, not shown as a blank answer", async () => {
  const blocked = await provider(fakeClient([completed()])).generate(REQUEST, () => {});
  assert.equal(blocked.declined, true);
  const spaces = await provider(fakeClient([delta("  \n "), completed()])).generate(REQUEST, () => {});
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
      provider(fakeClient([], { fail: thrown })).generate(REQUEST, () => {}),
      error => error instanceof AiError && error.code === code,
      `${thrown.name} ${thrown.status ?? thrown.statusCode ?? ""} -> ${code}`
    );
  }
});

test("a setup problem says which setting is wrong, so the owner knows what to fix", () => {
  const cases = [
    [{ name: "BadRequestError", status: 400, body: '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}' }, "key_rejected"],
    [{ name: "BadRequestError", status: 400, body: '{"error":{"message":"API key expired. Please renew the API key.","details":[{"reason":"API_KEY_EXPIRED"}]}}' }, "key_rejected"],
    [{ name: "UnauthorizedError", status: 401 }, "key_rejected"],
    // a real key that is not allowed to call Gemini is a different fix
    [{ name: "PermissionDeniedError", status: 403, body: '{"error":{"details":[{"reason":"API_KEY_SERVICE_BLOCKED"}]}}' }, "not_permitted"],
    [{ name: "PermissionDeniedError", status: 403, body: '{"error":{"details":[{"reason":"API_KEY_HTTP_REFERRER_BLOCKED"}]}}' }, "not_permitted"],
    [{ name: "PermissionDeniedError", status: 403, body: '{"error":{"details":[{"reason":"SERVICE_DISABLED"}]}}' }, "not_permitted"],
    [{ name: "PermissionDeniedError", status: 403 }, "not_permitted"],
    [{ name: "NotFoundError", status: 404 }, "model_not_found"]
  ];
  for (const [thrown, reason] of cases) {
    const failure = geminiFailure(thrown);
    assert.equal(failure.code, "not_configured", thrown.name);
    assert.equal(failure.reason, reason, thrown.name);
    assert.match(failure.detail, new RegExp(reason));
  }
  // anything that is not the owner's setup carries no reason
  assert.equal(geminiFailure({ name: "RateLimitError", status: 429 }).reason, undefined);
  assert.equal(geminiFailure(new Error("x")).reason, undefined);
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
  const result = await provider(client, "some-other-model").generate(REQUEST, () => {});
  assert.equal(result.text, "Answer.");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].generation_config.thinking_level, undefined);
  assert.equal(calls[1].generation_config.max_output_tokens, 2000, "the cost ceiling stays");

  // a rejected key is not retried: nothing would change
  const badKey = fakeClient([], { fail: { name: "BadRequestError", status: 400, body: "API_KEY_INVALID" } });
  await assert.rejects(provider(badKey).generate(REQUEST, () => {}), error => error.code === "not_configured");
  assert.equal(badKey.calls.length, 1);
});

test("a stream that breaks before any text is a failure; one that breaks after keeps what arrived", async () => {
  await assert.rejects(
    provider(fakeClient([{ event_type: "error", error: { code: "unavailable" } }])).generate(REQUEST, () => {}),
    error => error instanceof AiError && error.code === "busy"
  );
  await assert.rejects(
    provider(fakeClient([completed("failed")])).generate(REQUEST, () => {}),
    error => error instanceof AiError && error.code === "failed"
  );
  const partial = await provider(fakeClient([delta("Give clean water."), { event_type: "error", error: { code: "unavailable" } }])).generate(REQUEST, () => {});
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

test("Google's own reason token reaches the logs, and nothing else from the reply does", () => {
  const failure = geminiFailure({
    name: "BadRequestError", status: 400,
    body: '{"error":{"message":"API key not valid. Please pass a valid API key.","details":[{"reason":"API_KEY_INVALID","metadata":{"service":"generativelanguage.googleapis.com"}}]}}'
  });
  assert.equal(failure.detail, "BadRequestError 400 API_KEY_INVALID (key_rejected)");

  // a "reason" that is not a plain token is ignored rather than logged
  const odd = geminiFailure({ name: "BadRequestError", status: 400, body: '{"reason":"the key AIzaSyD-not-a-real-key-000000000000000 is bad"}' });
  assert.doesNotMatch(odd.detail, /AIza|the key/);
});

// ---------- the free plan: a few requests a minute, a fixed number a day ----------

const perMinute = { name: "RateLimitError", status: 429, body: JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [
  { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }] },
  { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "5s" }
] } }) };
const perDay = { name: "RateLimitError", status: 429, body: JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [
  { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] },
  { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "41000s" }
] } }) };

// Fails with each given error in turn, then answers.
function flakyClient(errors) {
  const calls = [];
  return {
    calls,
    interactions: {
      async create(params) {
        calls.push(params);
        if (errors.length) throw errors.shift();
        return (async function* () { yield delta("Keep them warm."); yield completed(); })();
      }
    }
  };
}

test("turned away for a moment, Clucky waits as long as it was told and tries once more", async () => {
  waits.length = 0;
  const client = flakyClient([perMinute]);
  const result = await provider(client).generate(REQUEST, () => {});
  assert.equal(result.text, "Keep them warm.", "the farmer gets the answer, a little later");
  assert.equal(client.calls.length, 2);
  assert.deepEqual(waits, [5000]);
});

test("the wait is never long, because someone is watching the screen", async () => {
  waits.length = 0;
  const slow = { name: "RateLimitError", status: 429, body: JSON.stringify({ error: { details: [{ retryDelay: "55s" }] } }) };
  await provider(flakyClient([slow])).generate(REQUEST, () => {});
  assert.deepEqual(waits, [8000]);

  waits.length = 0;
  await provider(flakyClient([{ name: "InternalServerError", status: 503 }])).generate(REQUEST, () => {});
  assert.deepEqual(waits, [3000], "no hint from the service: a short default");
});

test("it tries again once, not for ever", async () => {
  waits.length = 0;
  const client = flakyClient([perMinute, perMinute, perMinute]);
  await assert.rejects(provider(client).generate(REQUEST, () => {}), error => error instanceof AiError && error.code === "busy");
  assert.equal(client.calls.length, 2);
  assert.equal(waits.length, 1);
});

test("a used-up daily allowance is recognised and not retried", async () => {
  waits.length = 0;
  const client = flakyClient([perDay]);
  await assert.rejects(provider(client).generate(REQUEST, () => {}), error => error instanceof AiError && error.code === "quota");
  assert.equal(client.calls.length, 1, "asking again would only be refused again");
  assert.deepEqual(waits, []);

  const failure = geminiFailure(perDay);
  assert.equal(failure.code, "quota");
  assert.match(failure.detail, /429 GenerateRequestsPerDayPerProjectPerModel-FreeTier/, "the log names the limit that was hit");
  assert.equal(geminiFailure(perMinute).code, "busy");
  assert.equal(geminiFailure({ name: "RateLimitError", status: 429 }).code, "busy", "an unexplained 429 is treated as momentary");
});

test("nothing is retried once part of the answer has been shown", async () => {
  waits.length = 0;
  const client = {
    calls: 0,
    interactions: {
      async create() {
        client.calls++;
        return (async function* () { yield delta("Give clean "); throw { name: "RateLimitError", status: 429 }; })();
      }
    }
  };
  await assert.rejects(provider(client).generate(REQUEST, () => {}), error => error.code === "busy");
  assert.equal(client.calls, 1, "a second attempt would write the answer twice");
});
