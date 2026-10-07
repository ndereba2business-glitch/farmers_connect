// Unit tests for the notification helpers (src/lib/notificationHelpers.js).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";

import { badgeText, categoriesFor, categoryColour, timeAgo, NOTIFICATION_CATEGORIES } from "../../src/lib/notificationHelpers.js";

const NOW = new Date("2026-10-08T12:00:00Z");
const before = (seconds) => new Date(NOW.getTime() - seconds * 1000).toISOString();

test("each role is offered only the switches that apply to it", () => {
  assert.deepEqual(categoriesFor("farmer").map(c => c.key), ["vaccinations", "farm", "vet", "marketplace", "community", "clucky"]);
  assert.deepEqual(categoriesFor("vet").map(c => c.key), ["vet", "community"]);
  assert.deepEqual(categoriesFor("supplier").map(c => c.key), ["marketplace", "community"]);
  assert.deepEqual(categoriesFor("admin").map(c => c.key), ["community"]);
});

test("the wording of a shared switch fits the role reading it", () => {
  const forFarmer = categoriesFor("farmer").find(c => c.key === "vet").detail;
  const forVet = categoriesFor("vet").find(c => c.key === "vet").detail;
  assert.match(forFarmer, /answers your question/);
  assert.match(forVet, /New visit requests/);
  for (const role of ["farmer", "vet", "supplier", "admin"]) {
    for (const c of categoriesFor(role)) assert.equal(typeof c.detail, "string", `${role}/${c.key}`);
  }
});

test("every switch matches a column in notification_preferences", () => {
  const columns = ["vaccinations", "farm", "vet", "community", "marketplace", "clucky"];
  assert.deepEqual(NOTIFICATION_CATEGORIES.map(c => c.key).sort(), [...columns].sort());
});

test("times read naturally", () => {
  assert.equal(timeAgo(before(5), NOW), "just now");
  assert.equal(timeAgo(before(5 * 60), NOW), "5 min ago");
  assert.equal(timeAgo(before(3 * 3600), NOW), "3 h ago");
  assert.equal(timeAgo(before(30 * 3600), NOW), "yesterday");
  assert.equal(timeAgo(before(3 * 86400), NOW), "3 days ago");
  assert.match(timeAgo(before(20 * 86400), NOW), /Sep/);
  assert.equal(timeAgo(new Date(NOW.getTime() + 60000).toISOString(), NOW), "just now", "a clock a little ahead is not negative");
});

test("the badge is empty at zero and capped at 9+", () => {
  assert.equal(badgeText(0), "");
  assert.equal(badgeText(undefined), "");
  assert.equal(badgeText(3), "3");
  assert.equal(badgeText(9), "9");
  assert.equal(badgeText(25), "9+");
});

test("unknown categories fall back to the account colour", () => {
  assert.equal(categoryColour("nonsense"), categoryColour("account"));
  assert.notEqual(categoryColour("vaccinations"), categoryColour("account"));
});
