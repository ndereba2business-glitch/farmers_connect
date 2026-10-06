// End-to-end tests of the farm gallery with the mocked backend: photos
// are laid out as a tight grid (several across, even on a small phone),
// grouped by month, and open in a full-screen viewer.
//
//   npm run test:e2e
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { layoutAndA11y } from "./checks.js";

const FARMER = { email: "farmer@gallery.test", role: "farmer" };

// A tiny inline picture, so tiles load without the network.
const picture = (colour) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="${colour}"/></svg>`)}`;

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
  backend = createMockBackend();
  backend.addUser(FARMER);
  backend.addUser({ email: "other@gallery.test", role: "farmer" });

  // 9 photos in September, 5 in August, newest first, as the page asks for them.
  const photos = [];
  for (let i = 0; i < 14; i++) {
    const september = i < 9;
    photos.push({
      id: `photo-${i}`,
      user_email: FARMER.email,
      image_url: picture(september ? "#16a34a" : "#ea580c"),
      caption: i === 0 ? "Day-old chicks arrive" : "",
      date_taken: september ? `2026-09-${String(28 - i).padStart(2, "0")}` : `2026-08-${String(20 - i).padStart(2, "0")}`,
      batch_name: i === 0 ? "Batch A" : null,
      tags: i % 2 === 0 ? "broilers" : "layers"
    });
  }
  photos.push({ id: "not-mine", user_email: "other@gallery.test", image_url: picture("#000"), caption: "someone else", date_taken: "2026-09-30", tags: "" });
  backend.db.tables.farm_gallery = photos;
});

after(async () => { await app?.close(); });

async function openGallery(viewport) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: FARMER.email });
  await session.page.goto(`${app.url}/gallery`, { waitUntil: "domcontentloaded" });
  await session.page.locator(".fg-tile").first().waitFor();
  return session;
}

// How many tiles sit on the first row, and how wide they are.
const firstRow = (page) => page.evaluate(() => {
  const tiles = [...document.querySelectorAll(".fg-grid")[0].querySelectorAll(".fg-tile")].map(t => t.getBoundingClientRect());
  return { across: tiles.filter(t => Math.abs(t.top - tiles[0].top) < 2).length, width: Math.round(tiles[0].width), height: Math.round(tiles[0].height) };
});

for (const [width, minAcross] of [[320, 3], [360, 3], [768, 4], [1280, 5]]) {
  test(`the grid shows at least ${minAcross} photos across at ${width}px`, { timeout: 60000 }, async () => {
    const { context, page, errors } = await openGallery({ width, height: 800 });
    const row = await firstRow(page);
    assert.ok(row.across >= minAcross, `${row.across} across at ${width}px`);
    assert.ok(Math.abs(row.width - row.height) <= 1, "tiles are square");
    assert.ok(row.width >= 88, `tiles are big enough to tap (${row.width}px)`);

    const r = await layoutAndA11y(page);
    assert.equal(r.overflow, false, `horizontal scroll at ${width}px`);
    assert.deepEqual(r.unnamed, [], "every tile and button has a name");
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test("photos are grouped by month, newest first, and only the owner's are shown", { timeout: 60000 }, async () => {
  const { context, page } = await openGallery({ width: 360, height: 800 });
  const titles = await page.locator(".fg-month-title").allInnerTexts();
  assert.equal(titles.length, 2);
  assert.match(titles[0], /September 2026\s*· 9/);
  assert.match(titles[1], /August 2026\s*· 5/);
  assert.equal(await page.locator(".fg-tile").count(), 14, "another farmer's photo is not listed");
  await context.close();
});

test("the tag filter narrows the grid", { timeout: 60000 }, async () => {
  const { context, page } = await openGallery({ width: 360, height: 800 });
  await page.locator(".fg-tag", { hasText: "layers" }).click();
  assert.equal(await page.locator(".fg-tile").count(), 7);
  await page.locator(".fg-tag", { hasText: "All" }).click();
  assert.equal(await page.locator(".fg-tile").count(), 14);
  await context.close();
});

test("a photo opens full screen, steps through the others, and closes", { timeout: 60000 }, async () => {
  const { context, page } = await openGallery({ width: 360, height: 760 });
  await page.locator(".fg-tile").first().click();
  const viewer = page.locator('[role="dialog"].fg-viewer');
  await viewer.waitFor();
  assert.match(await viewer.innerText(), /1 of 14/);
  assert.match(await viewer.innerText(), /Day-old chicks arrive/);
  assert.match(await viewer.innerText(), /Batch A/);
  assert.equal(await page.locator('button[aria-label="Previous photo"]').isDisabled(), true, "nothing before the first photo");

  await page.click('button[aria-label="Next photo"]');
  await page.locator("text=2 of 14").waitFor();
  await page.keyboard.press("ArrowRight");
  await page.locator("text=3 of 14").waitFor();
  await page.keyboard.press("ArrowLeft");
  await page.locator("text=2 of 14").waitFor();

  const fits = await page.evaluate(() => {
    const img = document.querySelector(".fg-viewer-stage img").getBoundingClientRect();
    const small = [...document.querySelectorAll(".fg-viewer button")].filter(b => b.getBoundingClientRect().height < 44).length;
    return { inside: img.left >= 0 && img.right <= window.innerWidth && img.bottom <= window.innerHeight, small };
  });
  assert.equal(fits.inside, true, "the whole photo is visible");
  assert.equal(fits.small, 0, "viewer buttons are at least 44px");

  await page.keyboard.press("Escape");
  await viewer.waitFor({ state: "detached" });
  await context.close();
});

test("an empty gallery invites the first photo", { timeout: 60000 }, async () => {
  const session = await newUserPage(app.browser, { width: 360, height: 760 });
  await backend.attach(session.context, { signedInAs: "other@gallery.test" });
  backend.db.tables.farm_gallery = backend.db.tables.farm_gallery.filter(p => p.id !== "not-mine");
  await session.page.goto(`${app.url}/gallery`, { waitUntil: "domcontentloaded" });
  await session.page.locator("text=No photos yet").waitFor();
  await session.context.close();
});
