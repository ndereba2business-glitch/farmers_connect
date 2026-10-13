// Unit tests for choosing a new password and for the words shown when a
// reset goes wrong (src/lib/passwordRules.js).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_PASSWORD_LENGTH, passwordProblem, passwordUpdateMessage, resetRequestMessage } from "../../src/lib/passwordRules.js";

test("a new password must be long enough, typed the same twice, and not an obvious one", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.match(passwordProblem("short", "short"), /at least 8 characters/);
  assert.match(passwordProblem("", ""), /at least 8 characters/);
  assert.match(passwordProblem("kuku-yangu-9", "kuku-yangu-8"), /not the same/);
  for (const weak of ["12345678", "87654321", "password", "PASSWORD", "aaaaaaaa", "11111111"]) {
    assert.match(passwordProblem(weak, weak), /too easy to guess/, weak);
  }
  assert.match(passwordProblem(" kuku-yangu-9", " kuku-yangu-9"), /cannot start or end with a space/);
  assert.equal(passwordProblem("kuku-yangu-9", "kuku-yangu-9"), "");
  assert.equal(passwordProblem("mayai mengi leo", "mayai mengi leo"), "", "a phrase with spaces inside is fine, and no symbol is demanded");
  assert.equal(passwordProblem("kuku-yangu-9"), "", "the repeat is only checked when it is given");
});

test("asking for a reset link says the same thing whether or not the address has an account", () => {
  const sent = resetRequestMessage(null);
  assert.equal(sent.ok, true);
  assert.match(sent.message, /^If an account uses that email address/);
  // Supabase answers "user not found" for an unknown address in some setups: the person must not be told
  const unknown = resetRequestMessage({ status: 400, code: "user_not_found", message: "User not found" });
  assert.deepEqual(unknown, sent, "an unknown address reads exactly like a known one");
  assert.deepEqual(resetRequestMessage({ message: "Failed to fetch" }), sent);

  for (const limited of [{ status: 429 }, { code: "over_email_send_rate_limit", message: "email rate limit exceeded" }, { message: "Too many requests" }]) {
    const result = resetRequestMessage(limited);
    assert.equal(result.ok, false);
    assert.match(result.message, /Wait an hour/);
  }
});

test("a failed password change is explained in words the person can act on", () => {
  assert.match(passwordUpdateMessage({ code: "same_password", message: "New password should be different from the old password." }), /current password/);
  assert.match(passwordUpdateMessage({ code: "weak_password", message: "Password should be at least 6 characters" }), /not strong enough/);
  assert.match(passwordUpdateMessage({ message: "Auth session missing!" }), /expired or was already used/);
  assert.match(passwordUpdateMessage({ message: "Failed to fetch" }), /Check your connection/);
  assert.match(passwordUpdateMessage(null), /was not changed/);
});
