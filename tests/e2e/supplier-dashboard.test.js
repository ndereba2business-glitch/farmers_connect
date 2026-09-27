// End-to-end tests of the supplier dashboard and farmer marketplace with a
// mocked Supabase backend (tests/e2e/mockBackend.js). They run the real
// app in Chromium and cover the launch checklist:
//   supplier login, create / edit / deactivate / delete a product,
//   a farmer seeing and contacting a listing, unauthorized editing blocked,
//   and layout + accessibility at 320, 360, 768 and 1280px.
//
//   npm run test:e2e
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import {
  contactViaWhatsApp, createProduct, deleteProduct, editPrice, ensureSupplierProfile,
  findInMarketplace, login, openEdit, productCard, setActive
} from "./flows.js";
import { layoutAndA11y } from "./checks.js";

const SUPPLIER = { email: "supplier@e2e.test", password: "supplier-pass", role: "supplier" };
const OTHER_SUPPLIER = { email: "other@e2e.test", password: "other-pass", role: "supplier" };
const FARMER = { email: "farmer@e2e.test", password: "farmer-pass", role: "farmer" };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
  backend = createMockBackend();
  backend.addUser(SUPPLIER);
  backend.addUser(OTHER_SUPPLIER);
  backend.addUser(FARMER);
});

after(async () => { await app?.close(); });

async function signedIn(user, viewport) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  return session;
}

test("supplier can log in and lands on the supplier dashboard", { timeout: 60000 }, async () => {
  const { context, page, errors } = await newUserPage(app.browser);
  await backend.attach(context);
  await login(page, app.url, SUPPLIER);
  assert.equal(new URL(page.url()).pathname, "/supplier");
  await page.locator("text=Set up your supplier profile").waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test("empty states meet the layout and accessibility rules", { timeout: 60000 }, async () => {
  const farmer = await signedIn(FARMER, { width: 320, height: 900 });
  await farmer.page.goto(`${app.url}/marketplace`, { waitUntil: "domcontentloaded" });
  await farmer.page.waitForTimeout(800);
  let r = await layoutAndA11y(farmer.page);
  assert.deepEqual([r.overflow, r.small, r.unnamed], [false, [], []], "empty marketplace");
  await farmer.context.close();

  const supplier = await signedIn(OTHER_SUPPLIER, { width: 320, height: 900 });
  for (const path of ["/supplier", "/supplier/products"]) {
    await supplier.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
    await supplier.page.waitForTimeout(700);
    r = await layoutAndA11y(supplier.page);
    assert.deepEqual([r.overflow, r.small, r.unnamed], [false, [], []], `${path} with no supplier profile`);
  }
  await supplier.context.close();
});

test("wrong password shows an error and stays on login", { timeout: 60000 }, async () => {
  const { context, page } = await newUserPage(app.browser);
  await backend.attach(context);
  await page.goto(`${app.url}/login`);
  await page.fill('input[type="email"]', SUPPLIER.email);
  await page.fill('input[type="password"]', "wrong");
  await page.click('button:has-text("Login")');
  await page.locator("text=Invalid login credentials").waitFor();
  assert.equal(new URL(page.url()).pathname, "/login");
  await context.close();
});

test("supplier creates, edits, deactivates and deletes a product", { timeout: 120000 }, async () => {
  const { context, page, errors } = await signedIn(SUPPLIER);
  await ensureSupplierProfile(page, app.url, { businessName: "E2E Agrovet", phone: "0712345678", county: "Kiambu" });
  const profile = backend.db.supplier_profiles.find(p => p.business_name === "E2E Agrovet");
  assert.ok(profile, "profile saved");
  assert.equal(profile.verification_status, "pending", "a new supplier is never self-verified");

  await createProduct(page, app.url, { name: "E2E Layers Mash", price: 3200, priceMax: 3500, minOrder: 5, stock: 40 });
  const product = backend.db.products.find(p => p.product_name === "E2E Layers Mash");
  assert.equal(product.supplier_id, profile.id, "product tied to the supplier's own profile");
  assert.equal(product.user_email, SUPPLIER.email);
  assert.deepEqual([product.price, product.price_max, product.min_order_qty, product.stock, product.availability], [3200, 3500, 5, 40, "in_stock"]);

  await editPrice(page, app.url, "E2E Layers Mash", 3300);
  assert.equal(product.price, 3300);

  await setActive(page, app.url, "E2E Layers Mash", false);
  assert.equal(product.is_active, false);
  await setActive(page, app.url, "E2E Layers Mash", true);
  assert.equal(product.is_active, true);

  await createProduct(page, app.url, { name: "E2E To Delete", price: 100 });
  await deleteProduct(page, app.url, "E2E To Delete");
  assert.equal(backend.db.products.some(p => p.product_name === "E2E To Delete"), false);
  assert.equal(await productCard(page, "E2E To Delete").count(), 0);

  assert.deepEqual(errors, []);
  await context.close();
});

test("the product form blocks contradictory availability", { timeout: 60000 }, async () => {
  const { context, page } = await signedIn(SUPPLIER);
  await page.goto(`${app.url}/supplier/products/new`);
  await page.locator("#pf-product_name").waitFor();
  await page.fill("#pf-product_name", "E2E Contradiction");
  await page.selectOption("#pf-unit", "per_bag");
  await page.fill("#pf-price", "100");
  await page.locator(".sf-choice", { hasText: "Out of stock" }).click();
  await page.fill("#pf-stock", "5");
  const before = backend.db.products.length;
  await page.click('button[type="submit"]');
  await page.locator("#pf-availability-err").waitFor();
  assert.equal(backend.db.products.length, before, "nothing saved");
  await context.close();
});

test("farmer sees the listing, and hidden listings stay hidden", { timeout: 60000 }, async () => {
  const supplier = await signedIn(SUPPLIER);
  await setActive(supplier.page, app.url, "E2E Layers Mash", false);

  const { context, page } = await signedIn(FARMER);
  assert.equal(await (await findInMarketplace(page, app.url, "E2E Layers Mash")).count(), 0, "inactive listing hidden from farmers");

  await setActive(supplier.page, app.url, "E2E Layers Mash", true);
  const button = await findInMarketplace(page, app.url, "E2E Layers Mash");
  await button.waitFor();
  const text = await page.locator("main").innerText();
  assert.match(text, /KES 3,300 - 3,500/);
  assert.match(text, /Min\. order 5 bags/);
  await supplier.context.close();
  await context.close();
});

test("farmer contacts the supplier with the product's details, and it is counted", { timeout: 60000 }, async () => {
  const { context, page } = await signedIn(FARMER);
  const link = await contactViaWhatsApp(page, app.url, "E2E Layers Mash");
  assert.match(link, /^https:\/\/wa\.me\/254712345678\?text=/);
  const message = decodeURIComponent(link.split("?text=")[1]);
  assert.match(message, /E2E Layers Mash/);
  assert.match(message, /KES 3,300 - 3,500 per bag/);
  assert.match(message, /Location: Kiambu/);

  const product = backend.db.products.find(p => p.product_name === "E2E Layers Mash");
  const event = backend.db.contact_events.find(e => e.product_id === product.id);
  assert.ok(event, "contact recorded");
  assert.equal(event.channel, "whatsapp");
  await context.close();

  const supplier = await signedIn(SUPPLIER);
  await supplier.page.goto(`${app.url}/supplier`);
  await supplier.page.locator("text=/1 farmer contact/").waitFor();
  await supplier.context.close();
});

test("unauthorized users cannot edit a supplier's products", { timeout: 60000 }, async () => {
  const product = backend.db.products.find(p => p.product_name === "E2E Layers Mash");

  // a farmer is kept out of the supplier pages entirely
  const farmer = await signedIn(FARMER);
  await farmer.page.goto(`${app.url}/supplier/products/${product.id}/edit`);
  await farmer.page.waitForURL(u => !u.pathname.startsWith("/supplier"));
  await farmer.context.close();

  // another supplier gets "not found", not an editable form
  const other = await signedIn(OTHER_SUPPLIER);
  await ensureSupplierProfile(other.page, app.url, { businessName: "Other Supplier", phone: "0722000000", county: "Nakuru" });
  await other.page.goto(`${app.url}/supplier/products/${product.id}/edit`);
  await other.page.locator("text=Product not found").waitFor();
  assert.equal(await other.page.locator("#pf-price").count(), 0);
  await other.context.close();

  assert.equal(product.price, 3300, "price unchanged");
});

test("the supplier deletes the product through the confirmation dialog", { timeout: 60000 }, async () => {
  const { context, page } = await signedIn(SUPPLIER);
  await openEdit(page, app.url, "E2E Layers Mash");
  await page.click('button:has-text("Delete product")');
  const dialog = page.locator('[role="alertdialog"]');
  await dialog.waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.ok(backend.db.products.some(p => p.product_name === "E2E Layers Mash"), "Escape cancels");
  await deleteProduct(page, app.url, "E2E Layers Mash");
  assert.equal(backend.db.products.some(p => p.product_name === "E2E Layers Mash"), false);
  await context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`layout and accessibility at ${width}px`, { timeout: 120000 }, async () => {
    const supplier = await signedIn(SUPPLIER, { width, height: 900 });
    await createProduct(supplier.page, app.url, { name: `E2E Layout ${width}`, price: 500 });
    const pages = ["/supplier", "/supplier/products", "/supplier/products/new", "/supplier-profile"];
    for (const path of pages) {
      await supplier.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
      await supplier.page.waitForTimeout(700);
      const r = await layoutAndA11y(supplier.page);
      assert.equal(r.overflow, false, `${path}@${width}: horizontal scroll`);
      assert.deepEqual(r.small, [], `${path}@${width}: touch targets under 44px`);
      assert.deepEqual(r.unnamed, [], `${path}@${width}: controls without an accessible name`);
    }
    await supplier.context.close();

    const farmer = await signedIn(FARMER, { width, height: 900 });
    for (const path of ["/marketplace", "/suppliers"]) {
      await farmer.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
      await farmer.page.waitForTimeout(700);
      const r = await layoutAndA11y(farmer.page);
      assert.equal(r.overflow, false, `${path}@${width}: horizontal scroll`);
      assert.deepEqual(r.small, [], `${path}@${width}: touch targets under 44px`);
      assert.deepEqual(r.unnamed, [], `${path}@${width}: controls without an accessible name`);
    }
    await farmer.context.close();
  });
}
