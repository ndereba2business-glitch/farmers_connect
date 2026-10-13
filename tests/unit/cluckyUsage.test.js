// Unit tests for the figures and advice on the admin's Clucky usage tab
// (src/lib/cluckyUsage.js).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { advice, paidCostUsd, summarise, usd, usdSmall } from "../../src/lib/cluckyUsage.js";

const day = (n, values = {}) => ({
  day: `2026-10-${String(14 - n).padStart(2, "0")}`,
  questions: 0, people: 0, input_tokens: 0, output_tokens: 0, quota_hits: 0, failures: 0, ...values
});
const fortnight = (busy = {}) => Array.from({ length: 14 }, (_, n) => day(n, busy[n]));

test("the paid-plan cost follows the published price per million tokens", () => {
  assert.equal(paidCostUsd(1_000_000, 0), 0.30);
  assert.equal(paidCostUsd(0, 1_000_000), 2.50);
  assert.ok(Math.abs(paidCostUsd(2500, 500) - 0.002) < 1e-9, "a typical answer is about a fifth of a cent");
  assert.equal(paidCostUsd(undefined, null), 0);
});

test("the summary adds the days up, newest first", () => {
  const summary = summarise(fortnight({
    0: { questions: 10, people: 4, input_tokens: "25000", output_tokens: "5000" },
    1: { questions: 30, people: 9, input_tokens: 75000, output_tokens: 15000, quota_hits: 5, failures: 2 }
  }));
  assert.equal(summary.today.questions, 10);
  assert.equal(summary.today.people, 4);
  assert.equal(summary.questions, 40);
  assert.equal(summary.busiestDay.questions, 30);
  assert.equal(summary.daysRanOut, 1);
  assert.equal(summary.timesTurnedAway, 5);
  assert.equal(summary.failures, 2);
  assert.equal(summary.inputTokens, 100000, "numbers that arrive as text are still added, not joined");
  assert.ok(Math.abs(summary.paidCostUsd - 0.08) < 1e-9);
  assert.ok(Math.abs(summary.costPerQuestionUsd - 0.002) < 1e-9);
});

test("no rows at all is an empty summary, not a crash", () => {
  const summary = summarise(null);
  assert.equal(summary.questions, 0);
  assert.equal(summary.today.questions, 0);
  assert.equal(summary.busiestDay, null);
  assert.equal(summary.costPerQuestionUsd, 0);
});

test("the advice says stay, watch or move to the paid plan", () => {
  assert.equal(advice(summarise(fortnight())).tone, "ok");
  assert.match(advice(summarise(fortnight())).text, /Nobody has asked/);

  const enough = advice(summarise(fortnight({ 0: { questions: 20, people: 5 } })));
  assert.equal(enough.tone, "ok");
  assert.match(enough.text, /enough on every one of the last 14 days/);

  const once = advice(summarise(fortnight({ 3: { questions: 60, quota_hits: 4 } })));
  assert.equal(once.tone, "watch");
  assert.match(once.text, /ran out on 1 day in the last 14/);

  const often = advice(summarise(fortnight({ 0: { quota_hits: 2 }, 1: { quota_hits: 9 }, 4: { quota_hits: 1 } })));
  assert.equal(often.tone, "act");
  assert.match(often.text, /ran out on 3 of the last 14 days[\s\S]*turned away 12 times[\s\S]*move to the paid plan/);
});

test("a short period needs fewer bad days before it says to act", () => {
  const week = Array.from({ length: 7 }, (_, n) => day(n, n < 2 ? { questions: 50, quota_hits: 3 } : {}));
  assert.equal(advice(summarise(week)).tone, "act", "2 of 7 days is already a quarter of the time");
});

test("money is shown to the cent, and a tiny cost is not shown as free", () => {
  assert.equal(usd(0), "$0.00");
  assert.equal(usd(0.004), "less than $0.01");
  assert.equal(usd(1.234), "$1.23");
  assert.equal(usdSmall(0.002), "$0.002", "the cost of one question");
  assert.equal(usdSmall(0.0002), "less than $0.001");
  assert.equal(usdSmall(0.25), "$0.25");
  assert.equal(usdSmall(0), "$0.00");
});
