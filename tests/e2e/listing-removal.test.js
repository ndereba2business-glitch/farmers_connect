// End-to-end checks of removing a marketplace listing, with the mocked
// backend: the owner removes their own listing through a confirmation
// dialog, a failure is shown and can be retried, nobody else is offered
// the controls, a supplier can delete from their product list, and an
// admin can take a listing down. The database rules themselves (including
// the listing that other farmers had already contacted, which used to be
// impossible to delete) are checked in supabase/tests/security.sql.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { layoutAndA11y } from "./checks.js";

const SELLER = { email: "seller@removal.test", role: "farmer" };
const BUYER = { email: "buyer@removal.test", role: "farmer" };
const SUPPLIER = { email: "supplier@removal.test", role: "supplier" };
const ADMIN = { email: "admin@removal.test", role: "farmer", admin: true };

const LISTING = "Kienyeji cockerels";

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

function product(overrides) {
  const now = new Date().toISOString();
  return {
    id: `listing-${Math.random().toString(36).slice(2, 10)}`, category: "chickens", price: 900, unit: "per_bird", stock: 12,
    county: "Nakuru", seller_phone: "0712345678", description: "", image_url: "", supplier_id: null,
    availability: "in_stock", sold_out: false, is_active: true, is_verified: false,
    created_at: now.replace("Z", ""), updated_at: now, ...overrides
  };
}

beforeEach(() => {
  backend = createMockBackend();
  const supplier = backend.addUser(SUPPLIER);
  for (const user of [SELLER, BUYER, ADMIN]) backend.addUser(user);
  backend.db.supplier_profiles.push({
    id: "sp-removal", user_id: supplier.id, business_name: "Removal Feeds", verification_status: "verified",
    phone: "0722000111", county: "Kiambu", product_categories: ["feeds"]
  });
  backend.db.products.push(
    product({ product_name: LISTING, supplier_name: "Mama Njeri", user_email: SELLER.email }),
    product({ product_name: "Layers mash 70kg", category: "feeds", unit: "per_bag", price: 3400, supplier_name: "Removal Feeds", user_email: SUPPLIER.email, supplier_id: "sp-removal" })
  );
});

async function open(user, path, viewport = { width: 360, height: 900 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

const listed = (name) => backend.db.products.some(p => p.product_name === name);
const deletes = () => backend.db.writes.filter(w => w.method === "DELETE" && w.table === "products").length;

// The seller's own card on the marketplace, with its controls opened.
async function sellerControls(page, name) {
  const heading = page.locator("h3", { hasText: name });
  await heading.waitFor();
  const card = heading.locator("xpath=ancestor::div[.//button[contains(., 'Seller controls')]][1]");
  await card.locator("button", { hasText: "Seller controls" }).click();
  return card;
}

test("the seller removes their own listing after confirming, and can change their mind", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(SELLER, "/marketplace");
  const card = await sellerControls(page, LISTING);
  await card.locator("button", { hasText: "Remove" }).click();

  const dialog = page.locator('[role="alertdialog"]');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Remove "Kienyeji cockerels"\?/);

  // Escape and "Keep listing" both leave it alone
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await card.locator("button", { hasText: "Remove" }).click();
  await dialog.locator("button", { hasText: "Keep listing" }).click();
  await dialog.waitFor({ state: "detached" });
  assert.ok(listed(LISTING), "cancelling keeps the listing");
  assert.equal(deletes(), 0, "nothing was sent to the database");

  await card.locator("button", { hasText: "Remove" }).click();
  await dialog.locator("button", { hasText: "Remove listing" }).click();
  await page.locator('[role="status"]', { hasText: "was removed from the marketplace" }).waitFor();
  await page.locator("h3", { hasText: LISTING }).waitFor({ state: "detached" });
  assert.equal(listed(LISTING), false, "the listing is gone from the database");
  assert.ok(listed("Layers mash 70kg"), "other listings are untouched");
  assert.equal(deletes(), 1, "one delete, not several");
  assert.deepEqual(errors, []);
  await context.close();
});

test("a removal that fails says so, keeps the listing on the page, and can be tried again", { timeout: 60000 }, async () => {
  const { context, page } = await open(SELLER, "/marketplace");
  backend.db.productDeleteFails = true;
  const card = await sellerControls(page, LISTING);
  await card.locator("button", { hasText: "Remove" }).click();
  const dialog = page.locator('[role="alertdialog"]');
  await dialog.locator("button", { hasText: "Remove listing" }).click();

  await dialog.locator('[role="alert"]', { hasText: "wasn't removed" }).waitFor();
  assert.ok(listed(LISTING));
  assert.equal(await page.locator("h3", { hasText: LISTING }).count(), 1, "still shown, because it still exists");
  assert.equal(await page.locator('[role="status"]', { hasText: "was removed" }).count(), 0, "no false success");

  backend.db.productDeleteFails = false;
  await dialog.locator("button", { hasText: "Try again" }).click();
  await page.locator("h3", { hasText: LISTING }).waitFor({ state: "detached" });
  assert.equal(listed(LISTING), false);
  await context.close();
});

test("someone else's listing has no seller controls, only ways to contact the seller", { timeout: 60000 }, async () => {
  const { context, page } = await open(BUYER, "/marketplace");
  await page.locator("h3", { hasText: LISTING }).waitFor();
  assert.equal(await page.locator("button", { hasText: "Seller controls" }).count(), 0);
  assert.equal(await page.locator("button", { hasText: "Remove" }).count(), 0);
  assert.ok(await page.locator(`[aria-label="WhatsApp the seller of ${LISTING}"]`).count(), "the buyer can contact the seller");
  await context.close();
});

test("a supplier deletes a product straight from their product list", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(SUPPLIER, "/supplier/products");
  const card = page.locator(".spl-card", { hasText: "Layers mash 70kg" });
  await card.waitFor();
  await card.locator("button", { hasText: "Delete" }).click();
  const dialog = page.locator('[role="alertdialog"]');
  await dialog.locator("button", { hasText: "Keep product" }).click();
  assert.ok(listed("Layers mash 70kg"));

  await card.locator("button", { hasText: "Delete" }).click();
  await dialog.locator("button", { hasText: /^\s*Delete\s*$/ }).click();
  await card.waitFor({ state: "detached" });
  assert.equal(listed("Layers mash 70kg"), false);
  assert.ok(listed(LISTING), "a farmer's listing is not the supplier's to delete");
  assert.deepEqual(errors, []);
  await context.close();
});

test("an admin can take any listing down from the admin dashboard", { timeout: 60000 }, async () => {
  backend.db.products.push(product({ product_name: "Ownerless old listing", supplier_name: null, user_email: null }));
  const { context, page, errors } = await open(ADMIN, "/admin", { width: 1280, height: 900 });
  await page.locator("button", { hasText: /^products$/i }).click();
  const row = page.locator(".al-row", { hasText: "Ownerless old listing" });
  await row.waitFor();
  assert.match(await row.innerText(), /No owner recorded/);
  await row.locator("button", { hasText: "Remove" }).click();
  await page.locator('[role="alertdialog"] button', { hasText: "Remove listing" }).click();
  await row.waitFor({ state: "detached" });
  assert.equal(listed("Ownerless old listing"), false);
  assert.ok(listed(LISTING), "only the chosen listing went");
  assert.deepEqual(errors, []);
  await context.close();
});

for (const width of [320, 360, 390, 768, 1280]) {
  test(`the removal dialog and the admin listings fit the screen at ${width}px`, { timeout: 60000 }, async () => {
    const seller = await open(SELLER, "/marketplace", { width, height: 800 });
    const card = await sellerControls(seller.page, LISTING);
    await card.locator("button", { hasText: "Remove" }).click();
    const dialog = seller.page.locator('[role="alertdialog"]');
    await dialog.waitFor();
    const box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `dialog is inside the screen at ${width}px`);
    for (const button of await dialog.locator("button").all()) {
      assert.ok((await button.boundingBox()).height >= 44, "dialog buttons are at least 44px tall");
    }
    assert.equal(await seller.page.evaluate(() => document.activeElement?.textContent?.trim()), "Keep listing", "focus starts on the safe choice");
    await seller.context.close();

    const admin = await open(ADMIN, "/admin", { width, height: 800 });
    await admin.page.locator("button", { hasText: /^products$/i }).click();
    await admin.page.locator(".al-row").first().waitFor();
    const r = await layoutAndA11y(admin.page);
    assert.equal(r.overflow, false, `admin listings@${width}: horizontal scroll`);
    assert.deepEqual(r.unnamed, [], `admin listings@${width}: controls without an accessible name`);
    for (const button of await admin.page.locator(".al-remove").all()) {
      assert.ok((await button.boundingBox()).height >= 44, "Remove is at least 44px tall");
    }
    await admin.context.close();
  });
}
