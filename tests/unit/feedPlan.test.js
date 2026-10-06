// Unit tests for the feed planning maths (src/lib/feedPlan.js).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { BIRD_TYPES, birdTypeForBatch, buildFeedPlan, dailyIntake, phaseOn, planProblem, targetWeight } from "../../src/lib/feedPlan.js";

const plan = (over = {}) => buildFeedPlan({ type: "broiler", birds: 100, currentAge: 0, targetAge: 42, wastagePct: 0, ...over });

test("intake rises week by week and never falls as birds grow", () => {
  for (const [type, profile] of Object.entries(BIRD_TYPES)) {
    for (let week = 1; week < profile.weeklyIntake.length; week++) {
      assert.ok(profile.weeklyIntake[week] >= profile.weeklyIntake[week - 1], `${type} week ${week + 1}`);
    }
  }
  assert.equal(dailyIntake("broiler", 1), 23);
  assert.equal(dailyIntake("broiler", 7), 23);
  assert.equal(dailyIntake("broiler", 8), 53);
  assert.equal(dailyIntake("broiler", 42), 190);
  assert.equal(dailyIntake("layer", 400), 115, "adult intake stays level past the table");
  assert.equal(dailyIntake("broiler", 0), 23, "day 0 is treated as the first day");
});

test("a broiler eats about 4.5 kg to six weeks, in line with breed targets", () => {
  const p = plan();
  assert.ok(p.perBirdKg > 4.2 && p.perBirdKg < 4.8, `${p.perBirdKg} kg per bird`);
  assert.equal(p.eatenKg, 448);
  assert.ok(p.weightAtTarget > 2.8 && p.weightAtTarget < 3.1);
  assert.ok(p.feedPerKgGain > 1.4 && p.feedPerKgGain < 1.7, `feed per kg of weight ${p.feedPerKgGain}`);
});

test("a pullet eats about 6 to 6.5 kg to point of lay (18 weeks)", () => {
  const p = plan({ type: "layer", targetAge: 126 });
  assert.ok(p.perBirdKg > 5.9 && p.perBirdKg < 6.6, `${p.perBirdKg} kg per bird`);
});

test("a hen in lay eats 110 to 120 g a day", () => {
  const g = dailyIntake("layer", 200);
  assert.ok(g >= 110 && g <= 120);
});

test("kienyeji birds eat about 2 kg of chick mash in their first 8 weeks", () => {
  const p = plan({ type: "kienyeji", targetAge: 56 });
  assert.ok(p.perBirdKg > 1.9 && p.perBirdKg < 2.5, `${p.perBirdKg} kg per bird`);
});

test("feed is split by the phase each day falls in", () => {
  const p = plan();
  assert.deepEqual(p.phases.map(x => [x.name, x.days]), [["Starter", 21], ["Finisher", 21]]);
  assert.equal(p.phases[0].eatenKg, 114.8, "(23 + 53 + 88) g x 7 days x 100 birds");
  assert.equal(p.phases[1].eatenKg, 333.2, "(126 + 160 + 190) g x 7 days x 100 birds");
  assert.equal(phaseOn("layer", 126).name, "Grower");
  assert.equal(phaseOn("layer", 127).name, "Layer");
});

test("a plan that starts partway only counts the days left", () => {
  const p = plan({ currentAge: 22 });
  assert.deepEqual(p.phases.map(x => x.name), ["Finisher"]);
  assert.equal(p.days.length, 21);
  assert.equal(p.days[0].day, 22);
  assert.equal(p.today.gPerBird, 126);
  assert.equal(p.feedPerKgGain, null, "feed per kg of weight needs the whole life");
});

test("bags are rounded up per feed type, and the margin is added before rounding", () => {
  const exact = plan();
  assert.deepEqual(exact.phases.map(x => x.bags50), [3, 7], "114.8 kg -> 3 bags, 333.2 kg -> 7 bags");
  assert.equal(exact.bags50, 10);

  const padded = plan({ wastagePct: 10 });
  assert.equal(padded.totalKg, 492.8);
  assert.equal(padded.eatenKg, 448, "what the birds eat doesn't change");
  assert.deepEqual(padded.phases.map(x => x.bags50), [3, 8]);
});

test("today's amounts and water follow the bird count", () => {
  const p = plan({ birds: 250, currentAge: 30 });
  assert.equal(p.today.gPerBird, 160);
  assert.equal(p.today.kg, 40);
  assert.equal(p.today.waterLitres, 80, "about 2 litres of water per kg of feed");
  assert.equal(p.today.perFeedKg, 40 / 3);
});

test("cost uses whole bags and reports when a price is missing", () => {
  const priced = plan({ prices: { Starter: 4000, Finisher: 3800 } });
  assert.equal(priced.cost.total, 3 * 4000 + 7 * 3800);
  assert.equal(priced.cost.perBird, 386);
  assert.equal(priced.cost.complete, true);

  const partial = plan({ prices: { Starter: 4000 } });
  assert.equal(partial.cost.total, 12000);
  assert.equal(partial.cost.complete, false);
  assert.equal(partial.phases[1].cost, null);

  assert.equal(plan().cost, null, "no prices, no cost");
});

test("target weight grows between the weekly figures", () => {
  assert.equal(targetWeight("broiler", 3), null, "too young for a figure");
  assert.equal(targetWeight("broiler", 7), 0.21);
  assert.equal(targetWeight("broiler", 42), 2.92);
  const midweek = targetWeight("broiler", 38);
  assert.ok(midweek > 2.24 && midweek < 2.92);
  assert.equal(targetWeight("layer", 42), null, "only broilers have a weight table");
});

test("My Farm batch types map to the right feeding profile", () => {
  assert.equal(birdTypeForBatch("broiler"), "broiler");
  assert.equal(birdTypeForBatch("layer"), "layer");
  assert.equal(birdTypeForBatch("dual_purpose"), "kienyeji");
  assert.equal(birdTypeForBatch("indigenous"), "kienyeji");
  assert.equal(birdTypeForBatch(undefined), "broiler");
});

test("bad input is explained instead of producing a wrong plan", () => {
  const ok = { type: "broiler", birds: 100, currentAge: 0, targetAge: 42 };
  assert.equal(planProblem(ok), null);
  assert.match(planProblem({ ...ok, birds: 0 }), /how many birds/);
  assert.match(planProblem({ ...ok, birds: 10.5 }), /whole number/);
  assert.match(planProblem({ ...ok, birds: NaN }), /how many birds/);
  assert.match(planProblem({ ...ok, currentAge: 50, targetAge: 42 }), /later than/);
  assert.match(planProblem({ ...ok, targetAge: 90 }), /up to 56 days/);
  assert.equal(planProblem({ ...ok, type: "layer", targetAge: 365 }), null);
});
