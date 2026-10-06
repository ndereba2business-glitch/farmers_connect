// End-to-end tests of the onboarding tour with the mocked backend:
// a new account of each role gets its own tour on first sign-in, the tour
// is remembered once finished or skipped, and "Replay Tour" brings it back.
//
//   npm run test:e2e
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
  backend = createMockBackend();
});

after(async () => { await app?.close(); });

async function open(user, path = "/", viewport = { width: 360, height: 760 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

const tour = (page) => page.locator('[role="dialog"].ot-card');

// Walks every step, returning the step titles in order.
async function walk(page) {
  await page.click('button:has-text("Start tour")');
  const titles = [];
  while (await page.locator('button:has-text("Next")').count()) {
    titles.push(await page.locator("#ot-title").innerText());
    await page.click('button:has-text("Next")');
  }
  return titles;
}

const ROLES = [
  { role: "farmer", first: /My Farm/, mustNotMention: /Supplier profile|Vet Dashboard/, cta: "Go to My Farm", lands: "/my-farm" },
  { role: "vet", first: /My Vet Profile/, mustNotMention: /Feed Calculator|Supplier profile/, cta: "Set up my vet profile", lands: "/vet-profile" },
  { role: "supplier", first: /Supplier profile/, mustNotMention: /Feed Calculator|Vet Dashboard/, cta: "Set up my supplier profile", lands: "/supplier-profile" }
];

for (const { role, first, mustNotMention, cta, lands } of ROLES) {
  test(`a new ${role} gets the ${role} tour on first sign-in and it is remembered`, { timeout: 60000 }, async () => {
    const user = backend.addUser({ email: `new-${role}@tour.test`, role, newUser: true });
    const { context, page, errors } = await open(user);

    await tour(page).waitFor();
    assert.match(await page.locator("#ot-title").innerText(), /Welcome to Farmers Connect/);

    const titles = await walk(page);
    assert.ok(titles.length >= 5, `${role} tour has ${titles.length} steps`);
    assert.match(titles[0], first);
    assert.doesNotMatch(titles.join(" | "), mustNotMention, "only this role's features are described");

    await page.click(`button:has-text("${cta}")`);
    await tour(page).waitFor({ state: "detached" });
    await page.waitForURL(u => u.pathname === lands);
    assert.equal(user.hasSeenOnboarding, true, "finishing is saved to the account");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    assert.equal(await tour(page).count(), 0, "the tour does not come back on the next visit");
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("skipping and Escape both close the tour, and Replay Tour brings it back", { timeout: 60000 }, async () => {
  const user = backend.addUser({ email: "skipper@tour.test", role: "farmer", newUser: true });
  const { context, page } = await open(user, "/profile");

  await tour(page).waitFor();
  await page.click('button:has-text("Skip tour")');
  await tour(page).waitFor({ state: "detached" });
  assert.equal(user.hasSeenOnboarding, true);

  await page.click('button:has-text("Replay Tour")');
  await tour(page).waitFor();
  assert.match(await page.locator("#ot-title").innerText(), /Welcome/, "a replay starts from the beginning");
  assert.equal(user.hasSeenOnboarding, false);

  await page.keyboard.press("Escape");
  await tour(page).waitFor({ state: "detached" });
  assert.equal(user.hasSeenOnboarding, true);
  await context.close();
});

test("returning users are not shown the tour", { timeout: 60000 }, async () => {
  const returning = backend.addUser({ email: "old-hand@tour.test", role: "farmer" });
  const a = await open(returning);
  await a.page.waitForTimeout(1500);
  assert.equal(await tour(a.page).count(), 0);
  await a.context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`the tour fits the screen at ${width}px`, { timeout: 60000 }, async () => {
    const user = backend.addUser({ email: `fit-${width}@tour.test`, role: "farmer", newUser: true });
    const { context, page } = await open(user, "/", { width, height: 640 });
    await tour(page).waitFor();
    await page.click('button:has-text("Start tour")');

    for (let i = 0; i < 3; i++) {
      const r = await page.evaluate(() => {
        const card = document.querySelector(".ot-card").getBoundingClientRect();
        const small = [...document.querySelectorAll(".ot-card button")]
          .filter(b => b.getBoundingClientRect().height < 44).map(b => b.textContent.trim() || b.getAttribute("aria-label"));
        return { left: card.left, right: card.right, vw: window.innerWidth, small, sideways: document.documentElement.scrollWidth > window.innerWidth + 1 };
      });
      assert.ok(r.left >= 0 && r.right <= r.vw, `card inside the screen at ${width}px`);
      assert.equal(r.sideways, false, `no sideways scroll at ${width}px`);
      assert.deepEqual(r.small, [], `tour buttons are at least 44px tall at ${width}px`);
      await page.click('button:has-text("Next")');
    }
    await context.close();
  });
}
