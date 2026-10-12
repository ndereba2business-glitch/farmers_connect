// End-to-end checks of how a farmer finds a supplier from Ask Vet, with
// the mocked backend: real supplier profiles and their real listings,
// only approved suppliers, an honest "Verified" label, search and filter,
// contact by phone or WhatsApp (counted, never messaged in-app), and a
// supplier's changes reaching the farmer.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { editPrice, setActive } from "./flows.js";
import { layoutAndA11y } from "./checks.js";

const FARMER = { email: "farmer@discovery.test", role: "farmer" };
const FEEDS = { email: "feeds@discovery.test", role: "supplier" };
const AGROVET = { email: "agrovet@discovery.test", role: "supplier" };
const PENDING = { email: "pending@discovery.test", role: "supplier" };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

function listing(overrides) {
  const now = new Date().toISOString();
  return {
    id: `disc-${Math.random().toString(36).slice(2, 10)}`, unit: "per_bag", stock: 20, county: "Kiambu",
    seller_phone: "0712345678", description: "", image_url: "", availability: "in_stock", sold_out: false,
    is_active: true, is_verified: false, created_at: now.replace("Z", ""), updated_at: now, ...overrides
  };
}

beforeEach(() => {
  backend = createMockBackend();
  backend.addUser(FARMER);
  const feeds = backend.addUser(FEEDS);
  const agrovet = backend.addUser(AGROVET);
  const pending = backend.addUser(PENDING);
  backend.db.supplier_profiles.push(
    {
      id: "sp-feeds", user_id: feeds.id, business_name: "Kiambu Feeds", verification_status: "verified",
      product_categories: ["feeds"], county: "Kiambu", location_details: "Opposite the market", operating_hours: "Mon-Sat 8am-6pm",
      phone: "0712 345 678", whatsapp_number: "", description: "Layers and broiler feeds from local millers.", delivery_available: true, logo_url: null
    },
    {
      id: "sp-agrovet", user_id: agrovet.id, business_name: "Nakuru Agrovet", verification_status: "verified",
      product_categories: ["medicine", "equipment"], county: "Nakuru", location_details: "", operating_hours: "",
      phone: "0722 000 111", whatsapp_number: "0733 222 333", description: "", delivery_available: false, logo_url: null
    },
    {
      id: "sp-pending", user_id: pending.id, business_name: "Unreviewed Traders", verification_status: "pending",
      product_categories: ["feeds"], county: "Kiambu", phone: "0700 000 000", whatsapp_number: "", description: "", delivery_available: false, logo_url: null
    }
  );
  backend.db.products.push(
    listing({ product_name: "Layers mash 70kg", category: "feeds", price: 3300, price_max: 3500, supplier_name: "Kiambu Feeds", user_email: FEEDS.email, supplier_id: "sp-feeds" }),
    listing({ product_name: "Chick drinker 3L", category: "equipment", unit: "per_piece", price: 350, supplier_name: "Nakuru Agrovet", user_email: AGROVET.email, supplier_id: "sp-agrovet", county: "Nakuru", availability: "on_order" }),
    listing({ product_name: "Hidden stock", category: "feeds", price: 100, supplier_name: "Kiambu Feeds", user_email: FEEDS.email, supplier_id: "sp-feeds", is_active: false }),
    listing({ product_name: "Unreviewed maize", category: "feeds", price: 50, supplier_name: "Unreviewed Traders", user_email: PENDING.email, supplier_id: "sp-pending" })
  );
});

async function open(user, path, viewport = { width: 360, height: 900 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

// Ask Vet with the Suppliers tab open.
async function askVetSuppliers(viewport) {
  const session = await open(FARMER, "/bookings", viewport);
  await session.page.locator('button[aria-pressed]:has-text("Suppliers")').click();
  await session.page.locator(".sd-root").waitFor();
  return session;
}

const card = (page, name) => page.locator(".sd-card", { has: page.locator("h3", { hasText: name }) });

test("Ask Vet lists approved suppliers with what they really sell, and nothing invented", { timeout: 60000 }, async () => {
  const { context, page, errors } = await askVetSuppliers();
  const feeds = card(page, "Kiambu Feeds");
  await feeds.waitFor();
  const text = await feeds.innerText();
  assert.match(text, /Verified/);
  assert.match(text, /Feeds/);
  assert.match(text, /Opposite the market, Kiambu/);
  assert.match(text, /Mon-Sat 8am-6pm/);
  assert.match(text, /Delivers/);
  assert.match(text, /Layers and broiler feeds from local millers\./);
  assert.match(text, /Layers mash 70kg/);
  assert.match(text, /KES 3,300 - 3,500\/bag/);
  assert.match(text, /In stock/);
  assert.doesNotMatch(text, /Hidden stock/, "a deactivated product is not shown");

  const agrovet = await card(page, "Nakuru Agrovet").innerText();
  assert.match(agrovet, /Chick drinker 3L/);
  assert.match(agrovet, /KES 350\/item/);
  assert.match(agrovet, /Available on order/);
  assert.doesNotMatch(agrovet, /Delivers/, "delivery is only claimed when the supplier said so");

  const all = await page.locator(".sd-root").innerText();
  assert.doesNotMatch(all, /Unreviewed Traders|Unreviewed maize/, "a supplier nobody has approved is not listed");
  assert.match(all, /2 suppliers, in alphabetical order/, "the order is stated, and it is not a ranking");
  assert.match(all, /Verified means our team reviewed and approved the supplier's profile/);
  assert.match(all, /not a guarantee of prices or product quality/);
  assert.doesNotMatch(all, /rating|stars|recommended|best/i, "no ratings or endorsements exist, so none are shown");
  assert.equal(await page.locator("text=Coming Soon").count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("search and the category filter narrow the list, and an empty result can be cleared", { timeout: 60000 }, async () => {
  const { context, page } = await askVetSuppliers();
  await card(page, "Kiambu Feeds").waitFor();

  // by something a supplier lists, not only by their name
  await page.fill('.sd-search input', "drinker");
  await card(page, "Kiambu Feeds").waitFor({ state: "detached" });
  assert.equal(await card(page, "Nakuru Agrovet").count(), 1);

  await page.fill('.sd-search input', "");
  await page.locator(".sd-chip", { hasText: "Medicine & vaccines" }).click();
  assert.equal(await card(page, "Nakuru Agrovet").count(), 1);
  assert.equal(await card(page, "Kiambu Feeds").count(), 0);
  assert.equal(await page.locator(".sd-chip--on").getAttribute("aria-pressed"), "true");

  await page.fill('.sd-search input', "zzz nothing");
  await page.locator("text=No suppliers match").waitFor();
  await page.locator("button", { hasText: "Clear search and filter" }).click();
  assert.equal(await page.locator(".sd-card").count(), 2);
  await context.close();
});

test("contact is a phone call or a WhatsApp chat, and it is counted for the supplier", { timeout: 60000 }, async () => {
  const { context, page } = await askVetSuppliers();
  const agrovet = card(page, "Nakuru Agrovet");
  await agrovet.waitFor();

  assert.equal(await agrovet.locator('a[aria-label="Call Nakuru Agrovet"]').getAttribute("href"), "tel:+254722000111");
  const whatsapp = await agrovet.locator('a[aria-label="WhatsApp Nakuru Agrovet"]').getAttribute("href");
  assert.match(whatsapp, /^https:\/\/wa\.me\/254733222333\?text=/, "the WhatsApp number the supplier gave, not their call number");
  assert.match(decodeURIComponent(whatsapp), /Hello Nakuru Agrovet! I found you in the Farmers Connect supplier directory/);

  // the one with no separate WhatsApp number falls back to the phone
  assert.match(await card(page, "Kiambu Feeds").locator('a[aria-label="WhatsApp Kiambu Feeds"]').getAttribute("href"), /^https:\/\/wa\.me\/254712345678\?/);

  // tap Call without leaving the test page
  await page.evaluate(() => document.addEventListener("click", e => { if (e.target.closest("a[href^='tel:']")) e.preventDefault(); }, true));
  await agrovet.locator('a[aria-label="Call Nakuru Agrovet"]').click();
  await page.waitForTimeout(400);
  const event = backend.db.contact_events.find(e => e.supplier_id === "sp-agrovet");
  assert.ok(event, "the contact was recorded");
  assert.equal(event.channel, "call");

  assert.equal(await page.locator(".sd-root textarea, .sd-root form").count(), 0, "no in-app messaging");
  await context.close();
});

test("a supplier's change reaches the farmer: new price, then a deactivated listing", { timeout: 90000 }, async () => {
  const supplier = await open(FEEDS, "/supplier/products");
  await editPrice(supplier.page, app.url, "Layers mash 70kg", 3400);

  const farmer = await askVetSuppliers();
  const feeds = card(farmer.page, "Kiambu Feeds");
  await feeds.locator("text=KES 3,400 - 3,500/bag").waitFor();
  assert.doesNotMatch(await feeds.innerText(), /3,300/);

  // the farmer leaves the app and comes back: the list is fetched again
  await setActive(supplier.page, app.url, "Layers mash 70kg", false);
  await farmer.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await feeds.locator("text=No products listed yet").waitFor();
  assert.equal(await feeds.locator("text=Layers mash 70kg").count(), 0);
  assert.match(await feeds.innerText(), /Verified/, "the supplier is still listed and still contactable");

  await supplier.context.close();
  await farmer.context.close();
});

test("a failed load says so and recovers on Try again; no suppliers is its own message", { timeout: 60000 }, async () => {
  backend.db.failingTables.add("supplier_profiles");
  const { context, page } = await askVetSuppliers();
  await page.locator('.sd-error[role="alert"]', { hasText: "couldn't load suppliers" }).waitFor();
  assert.equal(await page.locator(".sd-card:not(.sd-skeleton)").count(), 0);

  backend.db.failingTables.clear();
  await page.locator(".sd-error button", { hasText: "Try again" }).click();
  await card(page, "Kiambu Feeds").waitFor();

  // listings failing to load must not hide the suppliers themselves
  backend.db.failingTables.add("products");
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await card(page, "Kiambu Feeds").locator("text=No products listed yet").waitFor();
  assert.equal(await page.locator(".sd-card").count(), 2);
  await context.close();

  backend.db.failingTables.clear();
  backend.db.supplier_profiles = backend.db.supplier_profiles.filter(s => s.verification_status !== "verified");
  const empty = await askVetSuppliers();
  await empty.page.locator("text=No verified suppliers yet").waitFor();
  assert.equal(await empty.page.locator("text=Unreviewed Traders").count(), 0);
  await empty.context.close();
});

for (const width of [320, 360, 390, 768, 1280]) {
  test(`supplier discovery fits the screen at ${width}px, in Ask Vet and on its own page`, { timeout: 60000 }, async () => {
    const askVet = await askVetSuppliers({ width, height: 900 });
    await card(askVet.page, "Kiambu Feeds").waitFor();
    let r = await layoutAndA11y(askVet.page);
    assert.equal(r.overflow, false, `ask vet suppliers@${width}: horizontal scroll`);
    const sdSmall = await askVet.page.evaluate(() =>
      [...document.querySelectorAll(".sd-root a, .sd-root button, .sd-root input")]
        .filter(el => el.getBoundingClientRect().height < 44)
        .map(el => `${el.tagName} ${(el.textContent || el.placeholder || "").trim().slice(0, 24)} ${Math.round(el.getBoundingClientRect().height)}px`));
    assert.deepEqual(sdSmall, [], `ask vet suppliers@${width}: touch targets under 44px`);
    const sdUnnamed = await askVet.page.evaluate(() =>
      [...document.querySelectorAll(".sd-root a, .sd-root button, .sd-root input")]
        .filter(el => !(el.getAttribute("aria-label") || el.textContent.trim() || el.labels?.length)).length);
    assert.equal(sdUnnamed, 0, `ask vet suppliers@${width}: controls without an accessible name`);
    await askVet.context.close();

    const directory = await open(FARMER, "/suppliers", { width, height: 900 });
    await card(directory.page, "Kiambu Feeds").waitFor();
    r = await layoutAndA11y(directory.page);
    assert.equal(r.overflow, false, `/suppliers@${width}: horizontal scroll`);
    assert.deepEqual(r.small, [], `/suppliers@${width}: touch targets under 44px`);
    assert.deepEqual(r.unnamed, [], `/suppliers@${width}: controls without an accessible name`);
    await directory.context.close();
  });
}
