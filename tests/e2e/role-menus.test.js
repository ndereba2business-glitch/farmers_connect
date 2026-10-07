// End-to-end checks of what each role is and isn't offered, with the
// mocked backend: suppliers reach the community from their own menu,
// admins have no Revenue page until payments exist, and the vet
// dashboard makes no claim about earnings.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { layoutAndA11y } from "./checks.js";

const SUPPLIER = { email: "supplier@menus.test", role: "supplier" };
const FARMER = { email: "farmer@menus.test", role: "farmer" };
const VET = { email: "vet@menus.test", role: "vet" };
const ADMIN = { email: "admin@menus.test", role: "farmer", admin: true };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  for (const user of [SUPPLIER, FARMER, VET, ADMIN]) backend.addUser(user);
  backend.db.tables.community_chat = [{
    id: "m1", user_email: FARMER.email, user_name: "Wanjiru", message: "Who sells layers mash in Kiambu?", image_url: null,
    sender_badge: null, created_at: new Date(Date.now() - 60000).toISOString(),
    reply_to_id: null, reply_to_user: null, reply_to_message: null, removed_at: null, removed_by: null
  }];
  backend.db.tables.message_reactions = [];
  backend.db.tables.community_mutes = [];
});

async function open(user, path, viewport = { width: 1280, height: 800 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

const menu = (page) => page.locator("aside nav a").allInnerTexts().then(links => links.map(t => t.trim()));

test("a supplier finds Community in their menu and can join the conversation", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(SUPPLIER, "/supplier");
  await page.locator("aside nav a", { hasText: "Community" }).waitFor();
  assert.deepEqual(await menu(page), ["Dashboard", "Products", "Marketplace", "Supplier profile", "Community", "Account"]);

  await page.locator("aside nav a", { hasText: "Community" }).click();
  await page.waitForURL(u => u.pathname === "/community");
  await page.locator(".cm-bubble", { hasText: "layers mash in Kiambu" }).waitFor();

  await page.fill('textarea[aria-label="Message"]', "We do, at our Kiambu shop.");
  await page.click('button[aria-label="Send message"]');
  await page.locator(".cm-bubble", { hasText: "We do, at our Kiambu shop." }).waitFor();
  assert.equal(backend.db.tables.community_chat.at(-1).user_email, SUPPLIER.email);
  assert.deepEqual(errors, []);
  await context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`the community fits inside the supplier layout at ${width}px`, { timeout: 60000 }, async () => {
    const { context, page } = await open(SUPPLIER, "/community", { width, height: 700 });
    await page.locator(".cm-bubble").first().waitFor();

    const fit = await page.evaluate(() => {
      const composer = document.querySelector(".cm-composer").getBoundingClientRect();
      const tabs = document.querySelector(".ss-bottomnav");
      const tabsTop = tabs && getComputedStyle(tabs).display !== "none" ? tabs.getBoundingClientRect().top : window.innerHeight;
      return { aboveTabs: composer.bottom <= tabsTop + 1, onScreen: composer.top > 0, title: document.querySelector(".ss-topbar-title")?.textContent };
    });
    assert.equal(fit.aboveTabs, true, `the message box is not hidden behind the bottom tabs at ${width}px`);
    assert.equal(fit.onScreen, true);
    assert.equal(fit.title, "Community");

    const r = await layoutAndA11y(page);
    assert.equal(r.overflow, false, `horizontal scroll at ${width}px`);
    assert.deepEqual(r.small, [], `touch targets under 44px at ${width}px`);
    assert.deepEqual(r.unnamed, [], `controls without a name at ${width}px`);
    await context.close();
  });
}

test("the admin menu has no Revenue page, and its old address goes to the dashboard", { timeout: 60000 }, async () => {
  const { context, page } = await open(ADMIN, "/admin");
  await page.locator("aside nav a", { hasText: "Admin Panel" }).waitFor();
  assert.deepEqual(await menu(page), ["Admin Panel", "Verifications", "Marketplace", "Community"]);

  await page.goto(`${app.url}/revenue`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(u => u.pathname === "/admin");
  await context.close();

  const farmer = await open(FARMER, "/revenue");
  await farmer.page.waitForURL(u => u.pathname === "/");
  await farmer.context.close();
});

test("the vet dashboard makes no claim about earnings", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(VET, "/vet");
  await page.locator("text=Completed Visits").waitFor();
  const text = await page.locator("main").innerText();
  assert.doesNotMatch(text, /earnings/i);
  for (const label of ["Total Farmers", "Upcoming Visits", "Pending Requests", "Completed Visits", "Emergencies"]) {
    assert.match(text, new RegExp(label));
  }
  assert.deepEqual(errors, []);
  await context.close();
});
