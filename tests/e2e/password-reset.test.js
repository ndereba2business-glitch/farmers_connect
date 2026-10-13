// End-to-end checks of recovering an account, with the mocked backend:
// asking for a link without revealing who has an account, choosing a new
// password, and what happens when the link is no longer good.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

const FARMER = { email: "farmer@reset.test", password: "old-password-1", role: "farmer" };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  backend.addUser(FARMER);
});

async function open(path, { signedIn = false, width = 360 } = {}) {
  const session = await newUserPage(app.browser, { width, height: 800 });
  await backend.attach(session.context, signedIn ? { signedInAs: FARMER.email } : {});
  session.recover = [];
  await session.context.route(`${MOCK_SUPABASE_URL}/auth/v1/recover*`, route => {
    session.recover.push({ url: route.request().url(), body: JSON.parse(route.request().postData() || "{}") });
    if (session.recoverStatus === 429) {
      return route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

test("the login page leads to the reset form, which asks for a link without saying who has an account", { timeout: 60000 }, async () => {
  const session = await open("/login");
  const { context, page, errors } = session;
  await page.locator('a[href="/forgot-password"]').click();
  await page.waitForURL(u => u.pathname === "/forgot-password");

  await page.locator("button", { hasText: "Send me a link" }).click();
  await page.locator('[role="alert"]', { hasText: "Enter the email address" }).waitFor();
  assert.equal(session.recover.length, 0, "nothing is sent for a blank address");

  // an address nobody has: the answer must be the same as for a real one
  await page.fill("#fp-email", "nobody@reset.test");
  await page.locator("button", { hasText: "Send me a link" }).click();
  const done = page.locator('[role="status"]');
  await done.waitFor();
  const forUnknown = await done.innerText();
  assert.match(forUnknown, /^If an account uses that email address/);
  assert.equal(session.recover.length, 1);
  assert.equal(session.recover[0].body.email, "nobody@reset.test");
  assert.match(decodeURIComponent(session.recover[0].url), /redirect_to=.*\/reset-password/, "the link in the email comes back to the reset page");

  await page.goto(`${app.url}/forgot-password`, { waitUntil: "domcontentloaded" });
  await page.fill("#fp-email", FARMER.email);
  await page.locator("button", { hasText: "Send me a link" }).click();
  await done.waitFor();
  assert.equal(await done.innerText(), forUnknown, "a real address gets exactly the same words");

  assert.match(await page.locator("main").innerText(), /Signed up with a phone number\?/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("too many requests are refused plainly, and what was typed stays", { timeout: 60000 }, async () => {
  const session = await open("/forgot-password");
  session.recoverStatus = 429;
  await session.page.fill("#fp-email", FARMER.email);
  await session.page.locator("button", { hasText: "Send me a link" }).click();
  await session.page.locator('[role="alert"]', { hasText: "Wait an hour" }).waitFor();
  assert.equal(await session.page.inputValue("#fp-email"), FARMER.email);
  assert.equal(await session.page.locator('[role="status"]').count(), 0, "no false 'sent'");
  await session.context.close();
});

test("a link that is no longer good says so and offers a new one", { timeout: 60000 }, async () => {
  const { context, page } = await open("/reset-password");
  await page.locator("text=This link has expired or was already used.").waitFor();
  assert.equal(await page.locator('input[type="password"]').count(), 0, "no form without a session");
  await page.locator('a[href="/forgot-password"]').click();
  await page.waitForURL(u => u.pathname === "/forgot-password");
  await context.close();
});

test("a new password is checked, saved, and works at the next sign-in", { timeout: 90000 }, async () => {
  const { context, page, errors } = await open("/reset-password", { signedIn: true });
  const save = page.locator("button", { hasText: "Save new password" });
  await save.waitFor();

  await page.fill("#rp-new", "short");
  await page.fill("#rp-repeat", "short");
  await save.click();
  await page.locator('[role="alert"]', { hasText: "at least 8 characters" }).waitFor();

  await page.fill("#rp-new", "kuku-yangu-2026");
  await page.fill("#rp-repeat", "kuku-yangu-2027");
  await save.click();
  await page.locator('[role="alert"]', { hasText: "not the same" }).waitFor();

  // the server refuses the password already in use
  await page.fill("#rp-new", FARMER.password);
  await page.fill("#rp-repeat", FARMER.password);
  await save.click();
  await page.locator('[role="alert"]', { hasText: "current password" }).waitFor();
  assert.equal(backend.db.users.get(FARMER.email).password, FARMER.password, "nothing changed yet");

  await page.fill("#rp-new", "kuku-yangu-2026");
  await page.fill("#rp-repeat", "kuku-yangu-2026");
  await save.click();
  await page.locator('[role="status"]', { hasText: "Your password has been changed" }).waitFor();
  await page.waitForURL(u => u.pathname === "/");
  assert.equal(backend.db.users.get(FARMER.email).password, "kuku-yangu-2026");
  assert.deepEqual(errors, []);
  await context.close();

  // the old password is refused and the new one works
  const again = await open("/login");
  await again.page.fill('input[type="email"]', FARMER.email);
  await again.page.fill('input[type="password"]', FARMER.password);
  await again.page.click('button:has-text("Log in")');
  await again.page.locator('[role="alert"]').waitFor();
  assert.equal(new URL(again.page.url()).pathname, "/login");
  await again.page.fill('input[type="password"]', "kuku-yangu-2026");
  await again.page.click('button:has-text("Log in")');
  await again.page.waitForURL(u => u.pathname === "/");
  await again.context.close();
});

for (const width of [320, 360, 390, 768, 1280]) {
  test(`the reset pages fit the screen at ${width}px`, { timeout: 60000 }, async () => {
    for (const [path, signedIn] of [["/forgot-password", false], ["/reset-password", true], ["/reset-password", false]]) {
      const { context, page } = await open(path, { signedIn, width });
      await page.locator("h1").waitFor();
      await page.waitForTimeout(300);
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        small: [...document.querySelectorAll("main button, main input, main a.fc-btn")].filter(el => el.offsetParent && el.getBoundingClientRect().height < 44)
          .map(el => `${el.tagName} ${(el.textContent || el.id).trim().slice(0, 20)}`),
        unnamed: [...document.querySelectorAll("main input")].filter(el => !(el.labels?.length || el.getAttribute("aria-label"))).length
      }));
      assert.equal(result.overflow, false, `${path}@${width}: horizontal scroll`);
      assert.deepEqual(result.small, [], `${path}@${width}: controls under 44px`);
      assert.equal(result.unnamed, 0, `${path}@${width}: a field without a label`);
      await context.close();
    }
    // the link on the login page is a comfortable target too
    const login = await open("/login", { width });
    const link = login.page.locator('a[href="/forgot-password"]');
    await link.waitFor();
    assert.ok((await link.boundingBox()).height >= 44, `the "Forgot your password?" link is 44px tall at ${width}px`);
    await login.context.close();
  });
}
