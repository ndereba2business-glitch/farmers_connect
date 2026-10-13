// Unit tests for the message shown when a sign-in comes back refused
// (src/lib/signInReturn.js).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readSignInProblem } from "../../src/lib/signInReturn.js";

const SITE = "https://farm.test";

test("an ordinary address is not a sign-in problem", () => {
  assert.equal(readSignInProblem(`${SITE}/`), null);
  assert.equal(readSignInProblem(`${SITE}/supplier/products?status=active`), null);
  assert.equal(readSignInProblem(`${SITE}/#access_token=abc&refresh_token=def&expires_in=3600&token_type=bearer`), null);
  assert.equal(readSignInProblem("not an address"), null);
});

test("the reason is read from before or after the #", () => {
  const cancelled = /Google sign-in was cancelled or refused/;
  assert.match(readSignInProblem(`${SITE}/?error=access_denied`), cancelled);
  assert.match(readSignInProblem(`${SITE}/#error=access_denied`), cancelled);
});

test("a known code gets its own message, ahead of the general error", () => {
  assert.match(readSignInProblem(`${SITE}/?error=access_denied&error_code=signup_disabled`), /New accounts can't be created/);
  assert.match(readSignInProblem(`${SITE}/?error=access_denied&error_code=user_banned`), /has been paused/);
  assert.match(readSignInProblem(`${SITE}/#error=access_denied&error_code=otp_expired`), /link has expired/);
});

test("anything else still tells the person to try again", () => {
  assert.match(readSignInProblem(`${SITE}/?error=server_error&error_code=unexpected_failure`), /Sign-in did not finish/);
  assert.match(readSignInProblem(`${SITE}/?error_code=something_new`), /try again/);
});

test("the description in the link is never repeated", () => {
  const message = readSignInProblem(`${SITE}/?error=access_denied&error_description=Call+0700000000+to+unlock+your+account`);
  assert.doesNotMatch(message, /0700000000|unlock/);
});
