// Unit tests for account deletion and the public request form: the rules
// the edge functions apply (supabase/functions/delete-account/logic.ts and
// account-request/logic.ts, plain TypeScript that Node runs directly) and
// the wording the app shows (src/lib/accountRules.js).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONFIRM_WORD as SERVER_WORD, OWN_FOLDER_BUCKETS, REAUTH_WINDOW_SECONDS,
  groupFiles, lastSignInAt, proofNeeded, readClaims, signedInRecently, storageRefFromUrl
} from "../../supabase/functions/delete-account/logic.ts";
import { MAX_MESSAGE_LENGTH, checkRequest } from "../../supabase/functions/account-request/logic.ts";
import {
  CONFIRM_WORD, DELETED_ITEMS, KEPT_ITEMS, deleteErrorMessage, hasPassword, requestErrorMessage
} from "../../src/lib/accountRules.js";
import { TERMS_VERSION } from "../../src/config/legal.js";
import { MOCK_TERMS_VERSION } from "../e2e/mockBackend.js";

const NOW = 1_800_000_000;
const token = (payload) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;
const PROJECT = "https://abc.supabase.co";

test("the app and the function ask for the same word", () => {
  assert.equal(CONFIRM_WORD, SERVER_WORD);
  assert.equal(CONFIRM_WORD, "DELETE");
});

test("the time of the real sign-in is read from the token, not the time it was last refreshed", () => {
  const claims = readClaims(token({ iat: NOW, amr: [{ method: "password", timestamp: NOW - 5000 }] }));
  assert.equal(lastSignInAt(claims), NOW - 5000, "a background refresh does not count as signing in");
  assert.equal(signedInRecently(claims, NOW), false);
  assert.equal(signedInRecently(readClaims(token({ amr: [{ method: "oauth", timestamp: NOW - 60 }] })), NOW), true);
  assert.equal(signedInRecently(readClaims(token({ amr: [{ method: "password", timestamp: NOW - REAUTH_WINDOW_SECONDS - 1 }] })), NOW), false);
  // a token that says nothing, a damaged one, and one from the future prove nothing
  assert.equal(signedInRecently(readClaims(token({})), NOW), false);
  assert.equal(signedInRecently(readClaims("not-a-token"), NOW), false);
  assert.equal(signedInRecently(readClaims(token({ amr: [{ timestamp: NOW + 500 }] })), NOW), false);
});

test("an account is only deleted with the typed word and proof of who is asking", () => {
  const stale = { amr: [{ method: "password", timestamp: NOW - 86400 }] };
  const fresh = { amr: [{ method: "oauth", timestamp: NOW - 30 }] };
  assert.equal(proofNeeded({}, fresh, NOW), "confirm_required");
  assert.equal(proofNeeded({ confirm: "delete" }, fresh, NOW), "confirm_required", "the word is case-sensitive");
  assert.equal(proofNeeded({ confirm: "DELETE", password: "hunter2" }, fresh, NOW), "check_password", "a supplied password is always checked");
  assert.equal(proofNeeded({ confirm: "DELETE", password: "hunter2" }, stale, NOW), "check_password");
  assert.equal(proofNeeded({ confirm: "DELETE" }, stale, NOW), "reauth_required", "an old session with no password proves nothing");
  assert.equal(proofNeeded({ confirm: "DELETE", password: "" }, stale, NOW), "reauth_required");
  assert.equal(proofNeeded({ confirm: "DELETE" }, fresh, NOW), "ok", "a Google account that has just signed in may go ahead");
});

test("only files in this project's own buckets are removed, wherever the address came from", () => {
  assert.deepEqual(storageRefFromUrl(`${PROJECT}/storage/v1/object/public/avatars/uid-1/me.jpg?v=3`, PROJECT), { bucket: "avatars", path: "uid-1/me.jpg" });
  assert.deepEqual(storageRefFromUrl(`${PROJECT}/storage/v1/object/public/farm-gallery/old%20photo.jpg`, PROJECT), { bucket: "farm-gallery", path: "old photo.jpg" });
  assert.equal(storageRefFromUrl("https://lh3.googleusercontent.com/a/photo", PROJECT), null, "a Google profile photo is not ours to delete");
  assert.equal(storageRefFromUrl(`https://evil.example/storage/v1/object/public/avatars/x.jpg`, PROJECT), null);
  assert.equal(storageRefFromUrl(`${PROJECT}/storage/v1/object/public/secrets/x.jpg`, PROJECT), null, "an unknown bucket is refused");
  assert.equal(storageRefFromUrl(`${PROJECT}/storage/v1/object/public/avatars/../lab-results/x.pdf`, PROJECT), null, "no climbing out of the bucket");
  assert.equal(storageRefFromUrl("", PROJECT), null);

  assert.deepEqual(groupFiles([
    `${PROJECT}/storage/v1/object/public/avatars/a.jpg`,
    `${PROJECT}/storage/v1/object/public/avatars/a.jpg`,
    `${PROJECT}/storage/v1/object/public/marketplace-images/u/b.jpg`,
    "https://elsewhere.example/c.jpg"
  ], PROJECT), { avatars: ["a.jpg"], "marketplace-images": ["u/b.jpg"] });
});

test("a vet's lab-results folder is never emptied wholesale: farmers' records live there", () => {
  assert.equal(OWN_FOLDER_BUCKETS.includes("lab-results"), false);
  assert.deepEqual([...OWN_FOLDER_BUCKETS].sort(), ["avatars", "community-posts", "farm-gallery", "marketplace-images"]);
});

test("the public request form accepts an email or a phone number and nothing else", () => {
  assert.deepEqual(checkRequest({ kind: "delete_account", identity: "  Wanjiru@Example.COM ", message: " please " }),
    { ok: true, kind: "delete_account", identity: "wanjiru@example.com", message: "please" });
  for (const phone of ["0712 345 678", "+254712345678", "254712345678"]) {
    assert.deepEqual(checkRequest({ kind: "privacy", identity: phone }), { ok: true, kind: "privacy", identity: "254712345678", message: null }, phone);
  }
  for (const identity of ["", "   ", "wanjiru", "a@b", "12345", null, 42]) {
    assert.deepEqual(checkRequest({ kind: "delete_account", identity }), { ok: false, code: "bad_identity" }, String(identity));
  }
  assert.deepEqual(checkRequest({ kind: "delete_everyone", identity: "a@b.co" }), { ok: false, code: "bad_kind" });
  assert.deepEqual(checkRequest({ kind: "privacy", identity: "a@b.co", message: "x".repeat(MAX_MESSAGE_LENGTH + 1) }), { ok: false, code: "too_long" });
  assert.deepEqual(checkRequest({ kind: "privacy", identity: "a@b.co", website: "http://spam.example" }), { ok: false, code: "bot" }, "the hidden field catches scripts");
});

test("a Google-only account is not asked for a password it does not have", () => {
  assert.equal(hasPassword({ email: "a@b.co", identities: [{ provider: "email" }] }), true);
  assert.equal(hasPassword({ phone: "254712345678", identities: [{ provider: "phone" }] }), true);
  assert.equal(hasPassword({ email: "a@b.co", identities: [{ provider: "google" }] }), false);
  assert.equal(hasPassword({ email: "a@b.co", identities: [{ provider: "google" }, { provider: "email" }] }), true);
  assert.equal(hasPassword({ email: "a@b.co", app_metadata: { provider: "google" } }), false);
  assert.equal(hasPassword({ email: "a@b.co", app_metadata: { provider: "email" } }), true);
  assert.equal(hasPassword(null), false);
});

test("every outcome is explained, and a failure never claims anything was deleted", () => {
  for (const code of ["wrong_password", "reauth_required", "confirm_required", "admin_account", "not_signed_in", "login_not_removed", "not_found", "not_allowed", "failed", "something_new"]) {
    const message = deleteErrorMessage(code);
    assert.ok(message.length > 20, code);
    assert.doesNotMatch(message, /undefined|null|\bcode\b/i, code);
  }
  assert.match(deleteErrorMessage("failed"), /Nothing has been removed/);
  assert.match(deleteErrorMessage("login_not_removed"), /data was deleted/, "the one partial outcome says exactly what happened");
  for (const code of ["bad_identity", "too_long", "busy", "failed"]) assert.ok(requestErrorMessage(code).length > 20, code);
});

test("what people are told is deleted matches what the database function removes", () => {
  const promised = DELETED_ITEMS.join(" ").toLowerCase();
  for (const thing of ["login", "batches", "vaccinations", "gallery photos", "listings", "supplier profile", "community messages", "questions to vets", "bookings", "clucky", "notifications", "vet profile"]) {
    assert.ok(promised.includes(thing), `"${thing}" is listed as deleted`);
  }
  const kept = KEPT_ITEMS.join(" ").toLowerCase();
  assert.match(kept, /visit reports, prescriptions and lab results you wrote stay in the farmer's own records/);
  assert.match(kept, /no name, email or phone number/);
});

test("the mocked accounts accept the same terms version the app asks for", () => {
  assert.equal(MOCK_TERMS_VERSION, TERMS_VERSION);
});
