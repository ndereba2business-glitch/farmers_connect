// User journeys, written once and run by both the mocked and the live
// tests. They drive the UI the way a person would (labels, button text),
// so they break when the real user flow breaks.

const TIMEOUT = 20000;

export async function login(page, baseUrl, { email, password }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Login")');
  await page.waitForURL(u => !u.pathname.startsWith("/login"), { timeout: TIMEOUT });
}

// Creates the supplier profile if the account doesn't have one yet.
export async function ensureSupplierProfile(page, baseUrl, details) {
  await page.goto(`${baseUrl}/supplier-profile`, { waitUntil: "domcontentloaded" });
  const submit = page.locator('button[type="submit"]');
  await submit.waitFor({ timeout: TIMEOUT });
  if ((await submit.textContent()).includes("Submit for review")) {
    await page.fill("#sp-business_name", details.businessName);
    await page.locator(".sf-chip", { hasText: "Feeds" }).click();
    await page.fill("#sp-phone", details.phone);
    await page.fill("#sp-county", details.county);
    await submit.click();
    await page.locator("text=/Save changes/").waitFor({ timeout: TIMEOUT });
  }
}

export async function createProduct(page, baseUrl, product) {
  await page.goto(`${baseUrl}/supplier/products/new`, { waitUntil: "domcontentloaded" });
  await page.locator("#pf-product_name").waitFor({ timeout: TIMEOUT });
  await page.fill("#pf-product_name", product.name);
  await page.selectOption("#pf-category", product.category || "feeds");
  await page.fill("#pf-price", String(product.price));
  if (product.priceMax) await page.fill("#pf-price_max", String(product.priceMax));
  await page.selectOption("#pf-unit", product.unit || "per_bag");
  if (product.minOrder) await page.fill("#pf-min_order_qty", String(product.minOrder));
  if (product.stock) await page.fill("#pf-stock", String(product.stock));
  if (!(await page.inputValue("#pf-county"))) await page.fill("#pf-county", product.county || "Kiambu");
  if (!(await page.inputValue("#pf-seller_phone"))) await page.fill("#pf-seller_phone", product.phone || "0712345678");
  await page.click('button[type="submit"]');
  await page.waitForURL(u => u.pathname === "/supplier/products", { timeout: TIMEOUT });
  await productCard(page, product.name).waitFor({ timeout: TIMEOUT });
}

export function productCard(page, name) {
  return page.locator(".spl-card", { has: page.locator(".spl-name", { hasText: name }) });
}

// Returns the product id from the edit URL.
export async function openEdit(page, baseUrl, name) {
  await page.goto(`${baseUrl}/supplier/products`, { waitUntil: "domcontentloaded" });
  await productCard(page, name).locator('a:has-text("Edit")').click();
  await page.waitForURL(/\/supplier\/products\/[^/]+\/edit$/, { timeout: TIMEOUT });
  await page.locator("#pf-price").waitFor({ timeout: TIMEOUT });
  return page.url().split("/supplier/products/")[1].replace("/edit", "");
}

export async function editPrice(page, baseUrl, name, price) {
  await openEdit(page, baseUrl, name);
  await page.fill("#pf-price", String(price));
  await page.click('button[type="submit"]');
  await page.waitForURL(u => u.pathname === "/supplier/products", { timeout: TIMEOUT });
}

export async function setActive(page, baseUrl, name, active) {
  await page.goto(`${baseUrl}/supplier/products`, { waitUntil: "domcontentloaded" });
  const card = productCard(page, name);
  await card.locator(`button:has-text("${active ? "Activate" : "Deactivate"}")`).click();
  await card.locator(`button:has-text("${active ? "Deactivate" : "Activate"}")`).waitFor({ timeout: TIMEOUT });
}

export async function deleteProduct(page, baseUrl, name) {
  await openEdit(page, baseUrl, name);
  await page.click('button:has-text("Delete product")');
  await page.locator('[role="alertdialog"]').waitFor({ timeout: TIMEOUT });
  await page.click('[role="alertdialog"] button:has-text("Delete")');
  await page.waitForURL(u => u.pathname === "/supplier/products", { timeout: TIMEOUT });
}

export async function findInMarketplace(page, baseUrl, name) {
  await page.goto(`${baseUrl}/marketplace`, { waitUntil: "domcontentloaded" });
  const search = page.locator('input[placeholder="Search products..."]');
  await search.waitFor({ timeout: TIMEOUT });
  await search.fill(name);
  await page.waitForTimeout(400);
  return page.locator(`button[aria-label="WhatsApp the seller of ${name}"]`);
}

// Taps WhatsApp on a listing; returns the wa.me link the app opened.
export async function contactViaWhatsApp(page, baseUrl, name) {
  const button = await findInMarketplace(page, baseUrl, name);
  await button.waitFor({ timeout: TIMEOUT });
  await button.click();
  await page.waitForFunction(() => window.__opened.length > 0, null, { timeout: TIMEOUT });
  return page.evaluate(() => window.__opened[window.__opened.length - 1]);
}
