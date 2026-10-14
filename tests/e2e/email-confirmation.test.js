// End-to-end checks of signing up when Supabase asks new members to confirm
// their email address ("Confirm email" on), with the mocked backend: the
// sign-up page says to open the link instead of pretending the account is
// ready, the link can be sent again, and logging in before confirming says
// what to do.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
});

async function open(path, { width = 360 } = {}) {
  const session = await newUserPage(app.browser, { width, height: 800 });
  await backend.attach(session.context);
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

async function signUp(page, email) {
  await page.fill('input[aria-label="Full Name"]', "Wanjiku Kamau");
  await page.fill('input[aria-label="Email"]', email);
  await page.fill('input[aria-label="Password"]', "kuku-yangu-2026");
  const terms = page.locator(".ac-check input");
  if (await terms.count()) await terms.check();
  await page.locator("button", { hasText: "Create account" }).click();
}

test("a new email account is told to open the link, not sent into the app", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open("/signup");
  await signUp(page, "new@confirm.test");

  await page.locator("h2", { hasText: "Check your email" }).waitFor();
  assert.match(await page.locator(".ac-sent").innerText(), /new@confirm\.test/);
  await page.waitForTimeout(1800);
  assert.equal(new URL(page.url()).pathname, "/signup", "no move into the app without a session");
  assert.equal(await page.locator("text=Account created successfully").count(), 0, "no false success");

  assert.equal(backend.db.signups.length, 1);
  assert.match(decodeURIComponent(backend.db.signups[0].url), new RegExp(`redirect_to=${app.url}/$`), "the link comes back to this site");

  // the link again
  await page.locator("button", { hasText: "Send the link again" }).click();
  await page.locator('.ac-sent [role="status"]', { hasText: "A new link is on its way" }).waitFor();
  assert.equal(backend.db.resends.length, 1);
  assert.equal(backend.db.resends[0].email, "new@confirm.test");
  assert.equal(backend.db.resends[0].type, "signup");

  backend.db.resendStatus = 429;
  await page.locator("button", { hasText: "Send the link again" }).click();
  await page.locator('.ac-sent [role="alert"]', { hasText: "Wait an hour" }).waitFor();

  await page.locator('.ac-sent a[href="/login"]').click();
  await page.waitForURL(u => u.pathname === "/login");
  assert.deepEqual(errors, []);
  await context.close();
});

test("an address that already has an account gets the same answer, so membership is not revealed", { timeout: 60000 }, async () => {
  backend.addUser({ email: "member@confirm.test", password: "old-password-1" });
  const { context, page } = await open("/signup");
  await signUp(page, "member@confirm.test");
  await page.locator("h2", { hasText: "Check your email" }).waitFor();
  assert.match(await page.locator(".ac-sent").innerText(), /already has an account, no new one was made/);
  assert.equal(backend.db.users.get("member@confirm.test").password, "old-password-1", "the existing account is untouched");
  await context.close();
});

test("logging in before confirming explains what to do and can send the link again", { timeout: 60000 }, async () => {
  backend.addUser({ email: "waiting@confirm.test", password: "kuku-yangu-2026", confirmed: false });
  const { context, page, errors } = await open("/login");
  await page.fill('input[type="email"]', "waiting@confirm.test");
  await page.fill('input[type="password"]', "kuku-yangu-2026");
  await page.click('button:has-text("Log in")');
  await page.locator('[role="alert"]', { hasText: "Confirm your email address first" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/login");

  await page.locator("button", { hasText: "Send the confirmation link again" }).click();
  await page.locator('[role="status"]', { hasText: "A new link is on its way" }).waitFor();
  assert.equal(backend.db.resends[0].email, "waiting@confirm.test");

  // a wrong password is explained in plain words, and the resend offer goes away
  await page.fill('input[type="password"]', "not-the-password");
  backend.db.users.get("waiting@confirm.test").confirmed = true;
  await page.click('button:has-text("Log in")');
  await page.locator('[role="alert"]', { hasText: "don't match an account" }).waitFor();
  assert.equal(await page.locator("button", { hasText: "Send the confirmation link again" }).count(), 0);

  // once confirmed, the same details work
  await page.fill('input[type="password"]', "kuku-yangu-2026");
  await page.click('button:has-text("Log in")');
  await page.waitForURL(u => u.pathname === "/");
  assert.deepEqual(errors, []);
  await context.close();
});

test("with confirmation switched off, sign-up still goes straight into the app", { timeout: 60000 }, async () => {
  backend.db.confirmEmail = false;
  const { context, page } = await open("/signup");
  await signUp(page, "instant@confirm.test");
  await page.locator("text=Account created successfully").waitFor();
  await page.waitForURL(u => u.pathname !== "/signup", { timeout: 10000 });
  assert.equal(await page.locator("h2", { hasText: "Check your email" }).count(), 0);
  await context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`the "check your email" panel fits the screen at ${width}px`, { timeout: 60000 }, async () => {
    const { context, page } = await open("/signup", { width });
    await signUp(page, "a-rather-long-address-for-a-small-screen@confirm.test");
    await page.locator("h2", { hasText: "Check your email" }).waitFor();
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      small: [...document.querySelectorAll(".ac-sent button, .ac-sent a")].filter(el => el.getBoundingClientRect().height < 44)
        .map(el => el.textContent.trim())
    }));
    assert.equal(result.overflow, false, `horizontal scroll at ${width}px`);
    assert.deepEqual(result.small, [], `controls under 44px at ${width}px`);
    await context.close();
  });
}
