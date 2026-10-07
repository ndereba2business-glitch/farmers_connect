// Unit tests for the community chat helpers (src/lib/community.js).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMyReaction, buildTimeline, dayLabel, nameColour, removedText, sendErrorMessage, summariseReactions
} from "../../src/lib/community.js";

const ME = "me@farm.test";
const NOW = new Date(2026, 9, 7, 15, 0);
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

test("days are labelled the way chat apps do", () => {
  assert.equal(dayLabel(at(7, 9), NOW), "Today");
  assert.equal(dayLabel(at(6, 23, 59), NOW), "Yesterday");
  assert.match(dayLabel(at(1, 9), NOW), /1/);
  assert.doesNotMatch(dayLabel(at(1, 9), NOW), /2026/, "this year's dates leave the year out");
  assert.match(dayLabel(new Date(2025, 11, 25, 9).toISOString(), NOW), /2025/);
});

test("the timeline adds a heading per day and names a sender once per run", () => {
  const messages = [
    { id: "1", user_email: "a", created_at: at(6, 9) },
    { id: "2", user_email: "a", created_at: at(6, 9, 5) },
    { id: "3", user_email: "b", created_at: at(6, 10) },
    { id: "4", user_email: "b", created_at: at(7, 8) },
    { id: "5", user_email: "b", created_at: at(7, 8, 1) }
  ];
  const timeline = buildTimeline(messages, NOW);
  assert.deepEqual(timeline.map(i => i.kind === "day" ? i.label : `${i.message.id}${i.showSender ? "*" : ""}`),
    ["Yesterday", "1*", "2", "3*", "Today", "4*", "5"]);
});

test("the sender is named again after a removed message", () => {
  const timeline = buildTimeline([
    { id: "1", user_email: "a", created_at: at(7, 9), removed_at: at(7, 9, 30) },
    { id: "2", user_email: "a", created_at: at(7, 9, 5) }
  ], NOW);
  assert.equal(timeline[2].showSender, true);
});

test("reactions are counted per emoji and mark which one is mine", () => {
  const summary = summariseReactions([
    { user_email: "a", emoji: "👍" }, { user_email: "b", emoji: "👍" }, { user_email: ME, emoji: "❤️" }
  ], ME);
  assert.deepEqual(summary, [{ emoji: "👍", count: 2, mine: false }, { emoji: "❤️", count: 1, mine: true }]);
  assert.deepEqual(summariseReactions(undefined, ME), []);
});

test("a person has one reaction: tapping another emoji replaces it, tapping the same removes it", () => {
  const start = [{ user_email: "a", emoji: "👍" }];

  const first = applyMyReaction(start, ME, "👍");
  assert.equal(first.action, "set");
  assert.equal(first.reactions.filter(r => r.user_email === ME).length, 1);

  const changed = applyMyReaction(first.reactions, ME, "🔥");
  assert.equal(changed.action, "set");
  assert.deepEqual(changed.reactions.filter(r => r.user_email === ME), [{ user_email: ME, emoji: "🔥" }], "still exactly one");
  assert.equal(changed.reactions.length, 2, "other people's reactions are untouched");

  const removed = applyMyReaction(changed.reactions, ME, "🔥");
  assert.equal(removed.action, "remove");
  assert.deepEqual(removed.reactions, start);
});

test("server refusals are explained in plain words", () => {
  assert.match(sendErrorMessage({ message: "community_blocked" }), /poultry farming only/);
  assert.match(sendErrorMessage({ message: "community_too_fast" }), /Wait a minute/);
  assert.match(sendErrorMessage({ message: "community_muted" }), /paused/);
  assert.match(sendErrorMessage({ message: "community_empty" }), /Type a message/);
  assert.match(sendErrorMessage({ message: 'violates check constraint "community_chat_message_length"' }), /too long/);
  assert.match(sendErrorMessage({ message: "Failed to fetch" }), /still in the box/);
  assert.match(sendErrorMessage(null), /still in the box/);
});

test("removed messages say who removed them", () => {
  assert.match(removedText({ removed_by: "admin", user_email: ME }, ME), /by an admin/);
  assert.equal(removedText({ removed_by: "author", user_email: ME }, ME), "You deleted this message.");
  assert.equal(removedText({ removed_by: "author", user_email: "a" }, ME), "This message was deleted.");
});

test("a member keeps the same name colour", () => {
  assert.equal(nameColour("a@farm.test"), nameColour("a@farm.test"));
  assert.match(nameColour("+254712345678"), /^#[0-9a-f]{6}$/);
  assert.match(nameColour(undefined), /^#[0-9a-f]{6}$/);
});
