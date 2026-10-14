// Checks the DEPLOYED account functions on the real Supabase project in
// .env: "delete-account" and "account-request". Nothing here is mocked.
//
//   npm run test:account-live
//
// It never touches a real person's account. It signs up a throwaway
// account with a random @example.com address (a domain reserved for
// tests, so no email can reach anyone), gives it a batch, a listing and a
// community-free footprint, deletes it through the function, and then
// shows that the login no longer works and the address can sign up again
// with nothing left over. The one request it sends through the public
// form is marked as an automated check for an admin to close.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const root = fileURLToPath(new URL("../..", import.meta.url));
const env = existsSync(`${root}.env`)
  ? Object.fromEntries(readFileSync(`${root}.env`, "utf8").split(/\r?\n/)
      .map(l => /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l)).filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, "")]))
  : {};
const URL_BASE = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const skip = !URL_BASE || !ANON ? "no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env" : false;

const email = `fc-delete-check-${randomBytes(6).toString("hex")}@example.com`;
const password = `Check-${randomBytes(9).toString("base64url")}`;
const headers = (bearer) => ({ apikey: ANON, "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) });

const post = (path, body, bearer) =>
  fetch(`${URL_BASE}${path}`, { method: "POST", headers: headers(bearer), body: JSON.stringify(body) });
const rest = (path, bearer, init = {}) =>
  fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...headers(bearer), Prefer: "return=representation", ...(init.headers || {}) } });
const signIn = () => post("/auth/v1/token?grant_type=password", { email, password });
const remove = (body, bearer) => post("/functions/v1/delete-account", body, bearer);

function assertNothingLeaks(text) {
  assert.doesNotMatch(text, /service_role|SUPABASE_SERVICE|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "no key or token in the reply");
}

test("deleting an account needs a sign-in", { skip }, async () => {
  for (const bearer of [undefined, ANON]) {
    const response = await remove({ confirm: "DELETE" }, bearer);
    const text = await response.text();
    assert.equal(response.status, 401, bearer ? "the public key alone is not a sign-in" : "no token");
    assertNothingLeaks(text);
  }
});

test("a throwaway account is deleted completely, and only after the word and the right password", { skip, timeout: 120000 }, async (t) => {
  // With "Confirm email" on, a sign-up makes Supabase send a real email. To an
  // @example.com address it bounces, which counts against the project's email
  // sending, and the account stays behind unconfirmed. Stop before signing up.
  const settings = await (await fetch(`${URL_BASE}/auth/v1/settings`, { headers: headers() })).json();
  if (settings.mailer_autoconfirm === false) {
    return t.skip("email confirmation is on, so this check would email a test address; run it on a project or branch with confirmation off");
  }
  const created = await post("/auth/v1/signup", { email, password, data: { full_name: "Automated deletion check", role: "farmer" } });
  const signup = await created.json();
  if (!signup.access_token) return t.skip(`this project does not sign new accounts in straight away (${created.status}): cannot run without a confirmed account`);
  let token = signup.access_token;
  const userId = signup.user.id;

  // something of every kind the account can own from the app
  const profile = await rest(`farmer_profiles?user_email=eq.${encodeURIComponent(email)}&select=id`, token);
  assert.equal((await profile.json()).length, 1, "sign-up created a profile");
  const batch = await rest("farm_batches", token, { method: "POST", body: JSON.stringify({ user_email: email, batch_name: "deletion check", batch_type: "broiler", quantity: 10, status: "active" }) });
  assert.equal(batch.status, 201, "a batch can be recorded");
  const listing = await rest("products", token, { method: "POST", body: JSON.stringify({ user_email: email, product_name: "deletion check, not for sale", category: "other", price: 1, unit: "per_piece", is_active: false }) });
  assert.equal(listing.status, 201, "a listing can be created");
  const task = await rest("farm_tasks", token, { method: "POST", body: JSON.stringify({ user_email: email, title: "deletion check" }) });
  assert.equal(task.status, 201);

  // 1. the word is required
  let response = await remove({ password }, token);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "confirm_required");

  // 2. a wrong password deletes nothing
  response = await remove({ confirm: "DELETE", password: "not-the-password" }, token);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "wrong_password");
  assert.equal((await (await rest(`farm_batches?user_email=eq.${encodeURIComponent(email)}&select=id`, token)).json()).length, 1, "the batch is still there");

  // 3. somebody else's account cannot be named by a non-admin
  response = await remove({ target: "someone-else@example.com" }, token);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "not_allowed");

  // 4. the real thing
  response = await remove({ confirm: "DELETE", password }, token);
  const body = await response.text();
  assert.equal(response.status, 200, `the account is deleted (${body.slice(0, 120)})`);
  assertNothingLeaks(body);

  // the login is gone
  const again = await signIn();
  assert.equal(again.status, 400, "the deleted account cannot sign in");
  const userCheck = await fetch(`${URL_BASE}/auth/v1/user`, { headers: headers(token) });
  assert.notEqual(userCheck.status, 200, "the old token no longer names a user");

  // the same address signs up afresh and inherits nothing
  const reborn = await (await post("/auth/v1/signup", { email, password, data: { full_name: "Automated deletion check" } })).json();
  assert.ok(reborn.access_token, "the address is free to register again");
  assert.notEqual(reborn.user.id, userId, "as a new account");
  token = reborn.access_token;
  for (const table of ["farm_batches", "products", "farm_tasks"]) {
    const rows = await (await rest(`${table}?user_email=eq.${encodeURIComponent(email)}&select=id`, token)).json();
    assert.deepEqual(rows, [], `nothing left in ${table} for a new account to inherit`);
  }

  // and that second throwaway account is removed too
  response = await remove({ confirm: "DELETE" }, token);
  assert.equal(response.status, 200, "an account that signed in seconds ago needs no password");
});

test("the public request form takes a request, refuses nonsense, and reveals nothing", { skip, timeout: 60000 }, async () => {
  let response = await post("/functions/v1/account-request", { kind: "delete_account", identity: "not an address" });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "bad_identity");

  response = await post("/functions/v1/account-request", { kind: "everything", identity: "a@example.com" });
  assert.equal(response.status, 400);

  // a script that fills the hidden field is told it worked and nothing is stored
  response = await post("/functions/v1/account-request", { kind: "privacy", identity: "bot@example.com", website: "http://spam.example" });
  assert.equal(response.status, 200);

  // the same answer whether or not the address has an account
  response = await post("/functions/v1/account-request", {
    kind: "privacy", identity: "fc-release-check@example.com", message: "Automated check of the request form. Safe to close."
  });
  const text = await response.text();
  assert.equal(response.status, 200, text.slice(0, 120));
  assert.deepEqual(JSON.parse(text), { ok: true });
  assertNothingLeaks(text);

  // visitors still cannot read or write the table directly
  const direct = await rest("account_requests?select=id", undefined);
  assert.ok(direct.status === 401 || direct.status === 403 || (await direct.json()).length === 0, "a visitor reads no requests");
});
