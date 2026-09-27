import { test } from "node:test";
import assert from "node:assert/strict";
import { STALE_DAYS, freshness, minOrderText, priceText, unitSuffix, unitWord } from "../../src/lib/productListing.js";

const DAY = 86400000;
const NOW = Date.parse("2026-09-27T12:00:00Z");

test("price text shows a range only when the top is higher", () => {
  assert.equal(priceText({ price: 3000 }), "KES 3,000");
  assert.equal(priceText({ price: 3000, price_max: 3400 }), "KES 3,000 - 3,400");
  assert.equal(priceText({ price: 3000, price_max: 2000 }), "KES 3,000");
});

test("units read naturally", () => {
  assert.equal(unitSuffix("per_bag"), "/bag");
  assert.equal(unitSuffix("unknown"), "");
  assert.equal(unitWord("per_bird", 1), "chick");
  assert.equal(unitWord("per_bird", 50), "chicks");
  assert.equal(minOrderText({ unit: "per_bag", min_order_qty: 5 }), "Min. order 5 bags");
  assert.equal(minOrderText({ unit: "per_bag", min_order_qty: 1 }), "");
  assert.equal(minOrderText({ unit: "per_bag" }), "");
});

test("freshness labels and the stale threshold", () => {
  const at = (days) => new Date(NOW - days * DAY).toISOString();
  assert.equal(freshness({ updated_at: at(0) }, NOW).label, "Updated today");
  assert.equal(freshness({ updated_at: at(1) }, NOW).label, "Updated yesterday");
  assert.equal(freshness({ updated_at: at(10) }, NOW).label, "Updated 10 days ago");
  assert.equal(freshness({ updated_at: at(STALE_DAYS - 1) }, NOW).stale, false);
  assert.equal(freshness({ updated_at: at(STALE_DAYS) }, NOW).stale, true);
});

test("old rows without updated_at fall back to created_at, read as UTC", () => {
  const created = "2026-08-01 08:00:00.123";
  const f = freshness({ created_at: created }, NOW);
  assert.equal(f.date.toISOString(), "2026-08-01T08:00:00.123Z");
  assert.equal(f.stale, true);
});
