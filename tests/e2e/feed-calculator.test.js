// End-to-end tests of the feed calculator with the mocked backend. The
// arithmetic itself is covered in tests/unit/feedPlan.test.js; these
// check that the page feeds it the right inputs and shows the answers.
//
//   npm run test:e2e
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { layoutAndA11y } from "./checks.js";

const FARMER = { email: "farmer@feed.test", role: "farmer" };
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
  backend = createMockBackend();
  backend.addUser(FARMER);
  backend.db.tables.farm_batches = [
    { id: "batch-k", user_email: FARMER.email, batch_name: "Kienyeji house 1", batch_type: "dual_purpose", hatch_date: daysAgo(30), current_count: 180, quantity: 200, status: "active" },
    { id: "batch-l", user_email: FARMER.email, batch_name: "Layers 2026", batch_type: "layer", hatch_date: daysAgo(200), current_count: 300, quantity: 300, status: "active" }
  ];
  backend.db.tables.feed_calculations = [];
});

after(async () => { await app?.close(); });

async function openCalculator(viewport = { width: 360, height: 800 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: FARMER.email });
  await session.page.goto(`${app.url}/feed-calculator`, { waitUntil: "domcontentloaded" });
  await session.page.locator("#fd-birds").waitFor();
  return session;
}

const text = (page) => page.locator(".fd-page").innerText();

test("100 broilers to day 42 need about 470 kg, in 10 bags", { timeout: 60000 }, async () => {
  const { context, page, errors } = await openCalculator();
  await page.click('button:has-text("Calculate feed")');
  await page.locator("text=Feed to buy").waitFor();
  const shown = await text(page);

  assert.match(shown, /23 g\s*per bird today/);
  assert.match(shown, /2\.3 kg\s*for all 100 birds/);
  assert.match(shown, /5 L\s*clean water/);
  assert.match(shown, /470\.4 kg\s*total feed/, "448 kg eaten plus the 5% margin");
  assert.match(shown, /10\s*bags of 50 kg/);
  assert.match(shown, /4\.48 kg\s*eaten per bird/);
  assert.match(shown, /2\.92 kg\s*target weight at day 42/);
  assert.match(shown, /Starter: Broiler starter crumbs or mash[\s\S]*3 bags/);
  assert.match(shown, /Finisher: Broiler finisher pellets or mash[\s\S]*7 bags/);
  assert.match(shown, /Week 6[\s\S]*190 g/);

  const saved = backend.db.tables.feed_calculations.at(-1);
  assert.deepEqual([saved.chicken_type, saved.num_birds, saved.target_age, saved.total_kg, saved.bags_50], ["broiler", 100, 42, 470.4, 10]);
  assert.deepEqual(errors, []);
  await context.close();
});

test("choosing a kienyeji batch plans it as kienyeji, not as a broiler", { timeout: 60000 }, async () => {
  const { context, page } = await openCalculator();
  await page.selectOption("#fd-batch", "batch-k");
  assert.equal(await page.inputValue("#fd-type"), "kienyeji");
  assert.equal(await page.inputValue("#fd-birds"), "180");
  assert.equal(await page.inputValue("#fd-age"), "30");
  assert.equal(await page.inputValue("#fd-target"), "140");

  await page.click('button:has-text("Calculate feed")');
  await page.locator("text=Feed to buy").waitFor();
  const shown = await text(page);
  assert.match(shown, /Chick mash/);
  assert.match(shown, /Growers mash/);
  assert.doesNotMatch(shown, /Broiler finisher/);
  assert.doesNotMatch(shown, /target weight/, "no weight table for kienyeji");
  await context.close();
});

test("an older layer batch is planned from its real age to the end of the year", { timeout: 60000 }, async () => {
  const { context, page } = await openCalculator();
  await page.selectOption("#fd-batch", "batch-l");
  assert.equal(await page.inputValue("#fd-type"), "layer");
  assert.equal(await page.inputValue("#fd-age"), "200");
  assert.equal(await page.inputValue("#fd-target"), "365");
  await page.click('button:has-text("Calculate feed")');
  await page.locator("text=Feed to buy").waitFor();
  assert.match(await text(page), /115 g\s*per bird today/);
  assert.match(await text(page), /Layers mash/);
  await context.close();
});

test("impossible inputs are explained and nothing is saved", { timeout: 60000 }, async () => {
  const { context, page } = await openCalculator();
  const before = backend.db.tables.feed_calculations.length;

  await page.fill("#fd-birds", "");
  await page.click('button:has-text("Calculate feed")');
  await page.locator('[role="alert"]', { hasText: "how many birds" }).waitFor();

  await page.fill("#fd-birds", "50");
  await page.fill("#fd-age", "40");
  await page.fill("#fd-target", "20");
  await page.click('button:has-text("Calculate feed")');
  await page.locator('[role="alert"]', { hasText: "later than the current age" }).waitFor();

  await page.fill("#fd-target", "90");
  await page.click('button:has-text("Calculate feed")');
  await page.locator('[role="alert"]', { hasText: "up to 56 days" }).waitFor();

  assert.equal(await page.locator("text=Feed to buy").count(), 0);
  assert.equal(backend.db.tables.feed_calculations.length, before);
  await context.close();
});

test("bag prices turn the plan into a budget", { timeout: 60000 }, async () => {
  const { context, page } = await openCalculator();
  await page.locator(".fd-prices summary").click();
  await page.fill("#fd-price-Starter", "4000");
  await page.click('button:has-text("Calculate feed")');
  await page.locator("text=feed cost so far").waitFor();
  assert.match(await text(page), /Add a price for every feed/);

  await page.fill("#fd-price-Finisher", "3800");
  await page.click('button:has-text("Calculate feed")');
  await page.locator("text=KES 38,600").waitFor();
  assert.match(await text(page), /KES 386\s*feed cost per bird/);

  // prices are remembered on this phone
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#fd-birds").waitFor();
  await page.locator(".fd-prices summary").click();
  assert.equal(await page.inputValue("#fd-price-Finisher"), "3800");
  await context.close();
});

test("saved plans can be reopened and deleted", { timeout: 60000 }, async () => {
  backend.db.tables.feed_calculations = [];
  const { context, page } = await openCalculator();
  await page.fill("#fd-birds", "250");
  await page.click('button:has-text("Calculate feed")');
  await page.locator("text=Feed to buy").waitFor();

  await page.locator("button", { hasText: /^Saved \(1\)$/ }).click();
  await page.locator("text=250 broiler birds").waitFor();
  await page.click('button:has-text("Open")');
  assert.equal(await page.inputValue("#fd-birds"), "250");
  await page.locator("text=Feed to buy").waitFor();

  await page.locator("button", { hasText: /^Saved/ }).click();
  await page.click('button[aria-label^="Delete saved plan"]');
  await page.locator("text=No saved plans yet").waitFor();
  assert.equal(backend.db.tables.feed_calculations.length, 0);
  await context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`form and results meet the layout rules at ${width}px`, { timeout: 60000 }, async () => {
    const { context, page } = await openCalculator({ width, height: 900 });
    await page.selectOption("#fd-type", "layer");
    await page.fill("#fd-birds", "12500");
    await page.locator(".fd-prices summary").click();
    await page.fill("#fd-price-Chick", "4200");
    await page.click('button:has-text("Calculate feed")');
    await page.locator("text=Week by week").waitFor();
    await page.click('button:has-text("Show all")');

    const r = await layoutAndA11y(page);
    assert.equal(r.overflow, false, `horizontal scroll at ${width}px`);
    assert.deepEqual(r.small, [], `touch targets under 44px at ${width}px`);
    assert.deepEqual(r.unnamed, [], `controls without a name at ${width}px`);
    await context.close();
  });
}
