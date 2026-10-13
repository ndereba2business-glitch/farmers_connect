// The Privacy Policy and the Terms are legal documents that the owner
// publishes deliberately (POLICIES_PUBLISHED in src/config/features.js).
// This file runs the app as it ships by default, with that switch off,
// and checks that nothing of them is shown or demanded, while account
// deletion still works. Every other end-to-end file runs with it on.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

const OLD_TIMER = { email: "old@unpublished.test", password: "old-pass", role: "farmer", termsAccepted: false };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY, VITE_POLICIES_PUBLISHED: "false" } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  backend.addUser(OLD_TIMER);
});

async function open(user, path) {
  const session = await newUserPage(app.browser, { width: 360, height: 800 });
  await backend.attach(session.context, user ? { signedInAs: user.email } : {});
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

test("unpublished policy pages are not reachable and not linked from anywhere", { timeout: 60000 }, async () => {
  const { context, page } = await open(null, "/privacy");
  await page.waitForURL(u => u.pathname === "/");
  await page.goto(`${app.url}/terms`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(u => u.pathname === "/");
  await page.locator("footer").waitFor();
  assert.equal(await page.locator('a[href="/privacy"], a[href="/terms"]').count(), 0, "landing page");
  assert.equal(await page.locator('footer a[href="/delete-account"]').count(), 1, "the deletion page is always linked");

  await page.goto(`${app.url}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('a[href="/delete-account"]').waitFor();
  assert.equal(await page.locator('a[href="/privacy"], a[href="/terms"]').count(), 0, "login page");

  await page.goto(`${app.url}/signup`, { waitUntil: "domcontentloaded" });
  const submit = page.locator('form button[type="submit"]');
  await submit.waitFor();
  assert.equal(await page.locator('form input[type="checkbox"]').count(), 0, "no tick box for documents that are not published");
  assert.equal(await submit.isDisabled(), false, "and sign-up is not held up by one");
  await context.close();
});

test("nobody is asked to accept unpublished terms, and deletion still works", { timeout: 60000 }, async () => {
  const { context, page } = await open(OLD_TIMER, "/profile");
  await page.locator("#delete-account").waitFor();
  assert.equal(await page.locator('[role="dialog"]').count(), 0, "no acceptance dialog");
  assert.equal(await page.locator('a[href^="/privacy"], a[href="/terms"]').count(), 0, "no dead links inside the app");

  await page.locator("#delete-account button", { hasText: "Delete my account" }).click();
  const dialog = page.locator('[role="dialog"]', { hasText: "Delete your account for good?" });
  await dialog.locator("input").first().fill("DELETE");
  await dialog.locator('input[type="password"]').fill(OLD_TIMER.password);
  await dialog.locator('button[type="submit"]').click();
  await page.locator("h1", { hasText: "Your account has been deleted" }).waitFor();
  assert.equal(backend.db.users.has(OLD_TIMER.email), false);
  await context.close();

  const visitor = await open(null, "/delete-account");
  await visitor.page.locator("h1", { hasText: "Delete your Farmers Connect account" }).waitFor();
  assert.equal(await visitor.page.locator('a[href^="/privacy"], a[href="/terms"]').count(), 0);
  assert.ok(await visitor.page.locator("form.lg-form").count(), "the request form is there for someone who cannot sign in");
  await visitor.context.close();
});
