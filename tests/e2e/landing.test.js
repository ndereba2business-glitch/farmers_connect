// End-to-end checks of the public landing page, with the mocked backend:
// it reads nothing from the database, its photographs load from this site
// without moving the page about, a phone gets the small files, the
// community section says only what the product does, its buttons lead
// somewhere, and the credit the photographs' licences require is shown.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { PHOTOS } from "../../src/components/landing/photos.js";

const FARMER = { email: "farmer@landing.test", password: "farmer-pass", role: "farmer" };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  backend.addUser(FARMER);
  backend.db.tables.community_chat = [];
  backend.db.tables.message_reactions = [];
  backend.db.tables.community_mutes = [];
});

async function visit(viewport = { width: 360, height: 800 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context);
  session.requests = [];
  session.page.on("request", r => session.requests.push(r.url()));
  // every time something on the page moves after being drawn
  await session.context.addInitScript(() => {
    window.__shift = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await session.page.goto(`${app.url}/`, { waitUntil: "domcontentloaded" });
  await session.page.locator(".lp-hero h1").waitFor();
  return session;
}

// The landing page scrolls inside its own frame, so bring a section into view there.
const show = (page, selector) => page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: "center" }), selector);

test("the landing page reads nothing from the database and loads every image from this site", { timeout: 60000 }, async () => {
  const { context, page, errors, requests } = await visit();
  for (const selector of ["#myfarm", "#marketplace", "#community", ".lp-footer"]) {
    await show(page, selector);
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => [...document.querySelectorAll(".lp-photo img")].every(img => img.complete && img.naturalWidth > 0));

  assert.deepEqual(requests.filter(u => u.includes("/rest/v1/") || u.includes("/functions/v1/")), [], "no database or function call");
  const images = requests.filter(u => /\.(webp|jpe?g|png|gif|avif)(\?|$)/i.test(u));
  assert.ok(images.length >= PHOTOS.length, "the photographs were requested");
  assert.deepEqual(images.filter(u => !u.startsWith(app.url)), [], "no image is hot-linked from another site");
  assert.deepEqual(errors, []);
  await context.close();
});

test("photographs hold their space, describe themselves, and do not move the page as they arrive", { timeout: 60000 }, async () => {
  const { context, page } = await visit();
  const hero = page.locator(".lp-hero-photo img");
  assert.equal(await hero.getAttribute("loading"), "eager", "the first photograph loads straight away");
  for (const selector of ["#myfarm", "#marketplace", "#community"]) {
    await show(page, selector);
    await page.waitForTimeout(600);
  }
  await page.waitForFunction(() => [...document.querySelectorAll(".lp-photo img")].every(img => img.complete && img.naturalWidth > 0));

  const photos = await page.evaluate(() => [...document.querySelectorAll(".lp-photo img")].map(img => ({
    alt: img.alt, width: img.getAttribute("width"), height: img.getAttribute("height"), loading: img.loading,
    drawnRatio: img.getBoundingClientRect().width / img.getBoundingClientRect().height,
    declaredRatio: Number(img.getAttribute("width")) / Number(img.getAttribute("height"))
  })));
  assert.equal(photos.length, PHOTOS.length);
  for (const photo of photos) {
    assert.ok(photo.alt.length > 20, "each photograph has a real description");
    assert.ok(Number(photo.width) > 0 && Number(photo.height) > 0, "width and height are declared, so the space is reserved");
    assert.ok(Math.abs(photo.drawnRatio - photo.declaredRatio) < 0.02, "it is drawn in the shape it declared");
  }
  assert.equal(photos.filter(p => p.loading === "lazy").length, PHOTOS.length - 1, "photographs further down wait until they are needed");
  const shift = await page.evaluate(() => window.__shift);
  assert.ok(shift < 0.05, `the page moved by ${shift.toFixed(3)} while loading (0.1 is the limit for a good page; 0.05 is ours)`);
  await context.close();
});

test("a phone downloads the small photographs, a desktop the larger ones", { timeout: 60000 }, async () => {
  const phone = await visit({ width: 360, height: 800 });
  await phone.page.waitForFunction(() => document.querySelector(".lp-hero-photo img").currentSrc);
  assert.match(await phone.page.evaluate(() => document.querySelector(".lp-hero-photo img").currentSrc), /kienyeji-hens-480\.webp$/);
  assert.equal(phone.requests.some(u => /-1200\.webp/.test(u)), false, "nothing desktop-sized is fetched on a phone");
  await phone.context.close();

  const desktop = await visit({ width: 1280, height: 900 });
  await desktop.page.waitForFunction(() => document.querySelector(".lp-hero-photo img").currentSrc);
  assert.match(await desktop.page.evaluate(() => document.querySelector(".lp-hero-photo img").currentSrc), /kienyeji-hens-(480|800)\.webp$/, "a 420px-wide photograph does not need the 1200px file");
  await desktop.context.close();
});

test("the community section describes the real group and invents nothing", { timeout: 60000 }, async () => {
  const { context, page } = await visit();
  await show(page, "#community");
  const text = await page.locator("#community").innerText();
  for (const benefit of ["Ask the people who keep the same birds", "Get an answer you can follow", "Show it, don't describe it",
    "Know who is a vet and who is a supplier", "Kept to poultry farming"]) {
    assert.ok(text.includes(benefit), `says "${benefit}"`);
  }
  assert.match(text, /one group/i, "it is one group, which is what the app has");
  assert.doesNotMatch(text, /\b\d[\d,.]*\+?\s*(farmers|members|users|vets|suppliers|answers|questions)\b/i, "no invented numbers");
  assert.doesNotMatch(text, /testimonial|trusted by|rated|stars|"[^"]{20,}"\s*[-–—]\s*\w+/i, "no invented praise or quotes");
  assert.doesNotMatch(text, /post a question|comment on|posts feed/i, "nothing about the old posts feed, which no longer exists");

  assert.equal(await page.locator('#community a[href="/signup"]').innerText().then(t => t.trim()), "Join the community");
  assert.equal(await page.locator('#community a[href="/login?next=/community"]').count(), 1);
  await context.close();
});

test("the community buttons lead to sign-up, and after signing in to the group itself", { timeout: 60000 }, async () => {
  const { context, page } = await visit();
  await show(page, ".lp-community-cta");
  await page.locator('#community a[href="/signup"]').click();
  await page.waitForURL(u => u.pathname === "/signup");
  await page.goBack();
  await page.locator(".lp-hero h1").waitFor();

  await show(page, ".lp-community-cta");
  await page.locator('#community a[href="/login?next=/community"]').click();
  await page.waitForURL(u => u.pathname === "/login");
  await page.fill('input[type="email"]', FARMER.email);
  await page.fill('input[type="password"]', FARMER.password);
  await page.click('button:has-text("Log in")');
  await page.waitForURL(u => u.pathname === "/community");
  await page.locator("text=Farmers Community").first().waitFor();
  await context.close();
});

test("every photograph is credited with its author, source and licence", { timeout: 60000 }, async () => {
  const { context, page } = await visit();
  await show(page, ".lp-credits");
  const credits = page.locator(".lp-credits");
  const text = await credits.innerText();
  for (const photo of PHOTOS) {
    assert.ok(text.includes(photo.author), `${photo.id}: names ${photo.author}`);
    assert.equal(await credits.locator(`a[href="${photo.source}"]`).count(), 1, `${photo.id}: links to its source`);
    assert.ok(await credits.locator(`a[href="${photo.licenceUrl}"]`).count() >= 1, `${photo.id}: links to its licence`);
  }
  assert.match(text, /cropped and resized/, "says the photographs were changed");
  await context.close();
});

for (const width of [320, 360, 390, 768, 1280]) {
  test(`the landing page fits the screen at ${width}px`, { timeout: 60000 }, async () => {
    const { context, page } = await visit({ width, height: 800 });
    for (const selector of [".lp-hero", "#myfarm", "#marketplace", "#community", ".lp-community-cta", ".lp-footer"]) {
      await show(page, selector);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => {
        const frame = document.querySelector(".lp-root");
        return frame.scrollWidth > frame.clientWidth + 1 || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      assert.equal(overflow, false, `${selector}@${width}: horizontal scroll`);
    }
    const tooWide = await page.evaluate(w => [...document.querySelectorAll(".lp-photo img")].filter(img => img.getBoundingClientRect().right > w + 1).length, width);
    assert.equal(tooWide, 0, `a photograph runs off the screen at ${width}px`);
    const small = await page.evaluate(() => [...document.querySelectorAll("#community a.lp-btn, .lp-hero a.lp-btn, .lp-footer-col a")]
      .filter(a => a.getBoundingClientRect().height < 44).map(a => a.textContent.trim()));
    assert.deepEqual(small, [], `${width}px: buttons and footer links are at least 44px tall`);
    await context.close();
  });
}
