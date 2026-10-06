// The same journeys as supplier-dashboard.test.js, but against the REAL
// Supabase project in .env, with two real test accounts:
//
//   1. Sign up in the app: one account as a supplier, one as a farmer.
//   2. Create .env.test.local in the project root with their logins. It
//      is gitignored (*.local); never commit it.
//        TEST_SUPPLIER_EMAIL=
//        TEST_SUPPLIER_PASSWORD=
//        TEST_FARMER_EMAIL=
//        TEST_FARMER_PASSWORD=
//   3. npm run test:live
//
// Skips (does not fail) until .env.test.local is filled in.
//
// It writes to the live database: it creates the supplier profile if the
// test supplier has none, creates one product named "E2E live <time>",
// records one farmer contact, and deletes the product again at the end,
// even if a step fails.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { newUserPage, startApp } from "./harness.js";
import {
  contactViaWhatsApp, createProduct, editPrice, ensureSupplierProfile, findInMarketplace, login, openEdit, setActive
} from "./flows.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

function readEnvFile(name) {
  const file = `${root}${name}`;
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/)
    .map(l => /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l)).filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, "")]));
}

const creds = readEnvFile(".env.test.local");
const env = readEnvFile(".env");
const SUPPLIER = { email: creds.TEST_SUPPLIER_EMAIL, password: creds.TEST_SUPPLIER_PASSWORD };
const FARMER = { email: creds.TEST_FARMER_EMAIL, password: creds.TEST_FARMER_PASSWORD };
const missing = [SUPPLIER.email, SUPPLIER.password, FARMER.email, FARMER.password].some(v => !v) || !env.VITE_SUPABASE_URL;
const skip = missing ? "create .env.test.local with TEST_SUPPLIER_EMAIL, TEST_SUPPLIER_PASSWORD, TEST_FARMER_EMAIL and TEST_FARMER_PASSWORD to run the live tests" : false;

const PRODUCT = `E2E live ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

let app;
let supplier;
let farmer;
let productId;

async function accessToken(page) {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k));
    return key ? JSON.parse(localStorage.getItem(key)).access_token : null;
  });
}

async function rest(page, method, path, body) {
  const token = await accessToken(page);
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", Prefer: "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, rows: res.status < 300 ? await res.json() : [] };
}

before(async () => {
  if (skip) return;
  app = await startApp();
  supplier = await newUserPage(app.browser);
  farmer = await newUserPage(app.browser);
  await login(supplier.page, app.url, SUPPLIER);
  await login(farmer.page, app.url, FARMER);
});

after(async () => {
  if (skip || !app) return;
  try {
    if (supplier?.page) await rest(supplier.page, "DELETE", `products?product_name=eq.${encodeURIComponent(PRODUCT)}`);
  } finally {
    await app.close();
  }
});

test("live: supplier creates and edits a product", { skip, timeout: 120000 }, async () => {
  await ensureSupplierProfile(supplier.page, app.url, { businessName: "E2E Test Supplier", phone: "0712345678", county: "Kiambu" });
  await createProduct(supplier.page, app.url, { name: PRODUCT, price: 1234, priceMax: 1500, minOrder: 2, stock: 10 });
  productId = await openEdit(supplier.page, app.url, PRODUCT);
  await editPrice(supplier.page, app.url, PRODUCT, 1250);
  const { rows } = await rest(supplier.page, "GET", `products?id=eq.${productId}&select=price,availability,supplier_id`);
  assert.equal(Number(rows[0].price), 1250);
  assert.ok(rows[0].supplier_id, "tied to the supplier profile");
});

test("live: deactivated products are hidden from farmers", { skip, timeout: 120000 }, async () => {
  await setActive(supplier.page, app.url, PRODUCT, false);
  assert.equal(await (await findInMarketplace(farmer.page, app.url, PRODUCT)).count(), 0);
  await setActive(supplier.page, app.url, PRODUCT, true);
  await (await findInMarketplace(farmer.page, app.url, PRODUCT)).waitFor({ timeout: 20000 });
});

test("live: farmer contacts the supplier with the product's details", { skip, timeout: 120000 }, async () => {
  const link = await contactViaWhatsApp(farmer.page, app.url, PRODUCT);
  const message = decodeURIComponent(link.split("?text=")[1] || "");
  assert.match(link, /^https:\/\/wa\.me\/254/);
  assert.match(message, new RegExp(PRODUCT));
  await supplier.page.goto(`${app.url}/supplier`);
  await supplier.page.locator(".sd-contacts").waitFor({ timeout: 20000 });
  assert.doesNotMatch(await supplier.page.locator(".sd-contacts").innerText(), /^0 farmer contacts/);
});

test("live: a farmer cannot edit or delete the supplier's product", { skip, timeout: 60000 }, async () => {
  const update = await rest(farmer.page, "PATCH", `products?id=eq.${productId}`, { price: 1 });
  assert.deepEqual(update.rows, [], "update matched no rows");
  const del = await rest(farmer.page, "DELETE", `products?id=eq.${productId}`);
  assert.deepEqual(del.rows, [], "delete matched no rows");
  await farmer.page.goto(`${app.url}/supplier/products/${productId}/edit`);
  await farmer.page.waitForURL(u => !u.pathname.startsWith("/supplier"), { timeout: 20000 });
  const { rows } = await rest(supplier.page, "GET", `products?id=eq.${productId}&select=price`);
  assert.equal(Number(rows[0].price), 1250, "price unchanged");
});
