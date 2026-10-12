// Checks the DEPLOYED "clucky" edge function on the real Supabase project
// in .env. Nothing here is mocked.
//
//   npm run test:clucky-live
//
// The first two checks need no account. The rest sign in as the test
// farmer from .env.test.local (gitignored; never commit it):
//     TEST_FARMER_EMAIL=
//     TEST_FARMER_PASSWORD=
// and skip until that file is filled in.
//
// The last two need the GEMINI_API_KEY function secret to be set, and each
// uses a little of that key's quota (and two of the test farmer's daily
// questions). They report "not switched on" instead of failing while the
// key is missing. The key itself is never read, printed or needed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { applyEvent, createEventParser, startingAnswer } from "../../src/lib/clucky.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

function readEnvFile(name) {
  const file = `${root}${name}`;
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/)
    .map(l => /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l)).filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, "")]));
}

const env = readEnvFile(".env");
const creds = readEnvFile(".env.test.local");
const URL_BASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const FUNCTION_URL = `${URL_BASE}/functions/v1/clucky`;

const noProject = !URL_BASE || !ANON ? "no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env" : false;
const noFarmer = noProject || (!creds.TEST_FARMER_EMAIL || !creds.TEST_FARMER_PASSWORD
  ? "add TEST_FARMER_EMAIL and TEST_FARMER_PASSWORD to .env.test.local to run the signed-in checks" : false);

let token;
async function signIn() {
  if (token) return token;
  const response = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.TEST_FARMER_EMAIL, password: creds.TEST_FARMER_PASSWORD })
  });
  assert.equal(response.status, 200, "the test farmer can sign in");
  token = (await response.json()).access_token;
  return token;
}

function ask(message, bearer) {
  return fetch(FUNCTION_URL, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify({ message })
  });
}

// Reads the streamed reply exactly as the app does, and also keeps the
// "reason" the function attaches when a setting is wrong.
async function readAnswer(response) {
  let answer = startingAnswer();
  let reason;
  const parser = createEventParser(event => {
    answer = applyEvent(answer, event);
    if (event.reason) reason = event.reason;
  });
  parser.push(await response.text());
  parser.finish();
  return { ...answer, reason };
}

// What the owner has to do for each setup problem the function reports.
const SETUP_HELP = {
  key_missing: "the GEMINI_API_KEY function secret is not set",
  key_rejected: "Google does not accept the key in the GEMINI_API_KEY function secret: create a new key in Google AI Studio and set it again",
  not_permitted: "the Gemini key is real but may not make this call: check its API restrictions, and that the Gemini API is enabled for its Google project",
  model_not_found: "the model name does not exist for this key: check the GEMINI_MODEL function secret, or the default in providers/gemini.ts"
};
const explain = (answer) =>
  `code: ${answer.code}${answer.reason ? `, reason: ${answer.reason} — ${SETUP_HELP[answer.reason] || "see the function logs"}` : ""}`;

// Whatever comes back, it must never carry a credential or internals.
function assertNothingLeaks(text) {
  assert.doesNotMatch(text, /AIza[0-9A-Za-z_-]{20,}/, "no Google API key");
  assert.doesNotMatch(text, /GEMINI_API_KEY|service_role|x-goog-api-key/i, "no secret names or headers");
  assert.doesNotMatch(text, /\bat\s+\S+\s+\(.*:\d+:\d+\)/, "no stack trace");
}

test("a request with no sign-in is refused", { skip: noProject }, async () => {
  const response = await ask("Hello");
  const text = await response.text();
  assert.equal(response.status, 401);
  assertNothingLeaks(text);
});

test("the public (anon) key alone is not a sign-in", { skip: noProject }, async () => {
  const response = await ask("Hello", ANON);
  const text = await response.text();
  assert.equal(response.status, 401);
  assertNothingLeaks(text);
});

test("an empty question is refused before anything is spent", { skip: noFarmer }, async () => {
  const response = await ask("   ", await signIn());
  const body = await response.json();
  if (response.status === 503) return assert.equal(body.code, "not_configured");
  assert.equal(response.status, 400);
  assert.equal(body.code, "empty");
});

test("an over-long question is refused before anything is spent", { skip: noFarmer }, async () => {
  const response = await ask("x".repeat(1501), await signIn());
  const body = await response.json();
  if (response.status === 503) return assert.equal(body.code, "not_configured");
  assert.equal(response.status, 400);
  assert.equal(body.code, "too_long");
});

// Records (or withdraws) the test farmer's agreement to AI processing, the
// way the Clucky page does: on their own profile, as themselves.
async function setConsent(bearer, at) {
  const response = await fetch(`${URL_BASE}/rest/v1/farmer_profiles?user_email=eq.${encodeURIComponent(creds.TEST_FARMER_EMAIL)}`, {
    method: "PATCH",
    headers: { apikey: ANON, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ clucky_consent_at: at })
  });
  assert.equal(response.status, 200, "the test farmer can update their own profile");
  assert.equal((await response.json()).length, 1, "the test farmer has a profile");
}

test("nothing is sent to the AI service until the farmer has agreed", { skip: noFarmer, timeout: 60000 }, async () => {
  const bearer = await signIn();
  await setConsent(bearer, null);
  try {
    const response = await ask("How warm should a brooder be?", bearer);
    const body = await response.json();
    if (response.status === 503) return assert.equal(body.code, "not_configured");
    assert.equal(response.status, 403);
    assert.equal(body.code, "consent_required");
  } finally {
    await setConsent(bearer, new Date().toISOString());
  }
});

test("a farmer gets a useful answer, and a follow-up keeps the thread", { skip: noFarmer, timeout: 180000 }, async (t) => {
  const bearer = await signIn();
  await setConsent(bearer, new Date().toISOString());

  const first = await ask("My chickens are coughing. What should I check?", bearer);
  if (first.status === 503) {
    assert.equal((await first.json()).code, "not_configured");
    return t.skip("Clucky is not switched on yet: set the GEMINI_API_KEY function secret, then run this again");
  }
  if (first.status === 429) return t.skip("the test farmer has used today's questions");
  assert.equal(first.status, 200);
  const firstAnswer = await readAnswer(first);
  assert.equal(firstAnswer.status, "done", `first answer finished (${explain(firstAnswer)})`);
  assert.ok(firstAnswer.text.length > 40, "the answer has substance");
  assertNothingLeaks(firstAnswer.text);

  // Only makes sense if the first exchange was remembered.
  const second = await ask("They are 4 weeks old and about 20 birds are affected.", bearer);
  assert.equal(second.status, 200);
  const secondAnswer = await readAnswer(second);
  assert.equal(secondAnswer.status, "done", `follow-up finished (${explain(secondAnswer)})`);
  assert.match(secondAnswer.text, /cough|breath|respirat|vet|week|bird|kukohoa|daktari/i, "the follow-up is answered in context");
  assertNothingLeaks(secondAnswer.text);
});
