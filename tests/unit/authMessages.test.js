import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmationRedirect, needsEmailConfirmation, isUnconfirmedEmail,
  signInErrorMessage, signUpErrorMessage, resendMessage
} from "../../src/lib/authMessages.js";

test("the confirmation link comes back to the root of the same site", () => {
  assert.equal(confirmationRedirect("https://farmers-connect-azure.vercel.app"), "https://farmers-connect-azure.vercel.app/");
  assert.equal(confirmationRedirect("http://localhost:5173/"), "http://localhost:5173/");
});

test("a sign-up without a session means the email must be confirmed first", () => {
  assert.equal(needsEmailConfirmation({ user: { id: "u1" }, session: null }), true);
  assert.equal(needsEmailConfirmation({ user: { id: "u1" }, session: { access_token: "t" } }), false);
  assert.equal(needsEmailConfirmation({ user: null, session: null }), false);
  assert.equal(needsEmailConfirmation(undefined), false);
});

test("an unconfirmed email is recognised by code or by Supabase's wording", () => {
  assert.equal(isUnconfirmedEmail({ code: "email_not_confirmed" }), true);
  assert.equal(isUnconfirmedEmail({ message: "Email not confirmed" }), true);
  assert.equal(isUnconfirmedEmail({ message: "Invalid login credentials" }), false);
  assert.equal(isUnconfirmedEmail(null), false);
});

test("login problems are explained in plain words", () => {
  assert.match(signInErrorMessage({ code: "email_not_confirmed", message: "Email not confirmed" }), /^Confirm your email address first/);
  assert.match(signInErrorMessage({ message: "Invalid login credentials" }), /email address and password don't match/);
  assert.match(signInErrorMessage({ message: "Invalid login credentials" }, "phone"), /phone number and password don't match/);
  assert.match(signInErrorMessage({ status: 429, message: "Request rate limit reached" }), /Wait a few minutes/);
  assert.match(signInErrorMessage({ name: "AuthRetryableFetchError", message: "Failed to fetch" }), /Check your connection/);
  assert.equal(signInErrorMessage({ message: "Something new" }), "Something new");
  assert.equal(signInErrorMessage(null), "");
});

test("sign-up problems are explained in plain words", () => {
  assert.match(signUpErrorMessage({ code: "user_already_exists", message: "User already registered" }), /Log in instead/);
  assert.match(signUpErrorMessage({ code: "weak_password", message: "Password should be at least 6 characters." }), /at least 8 characters/);
  assert.match(signUpErrorMessage({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }), /Wait a few minutes/);
  assert.match(signUpErrorMessage({ message: "Failed to fetch" }), /what you typed is still here/);
});

test("asking for the link again says whether it worked", () => {
  assert.deepEqual(resendMessage(null).ok, true);
  assert.equal(resendMessage({ status: 429 }).ok, false);
  assert.match(resendMessage({ code: "over_email_send_rate_limit" }).message, /Wait an hour/);
  assert.equal(resendMessage({ message: "boom" }).ok, false);
});
