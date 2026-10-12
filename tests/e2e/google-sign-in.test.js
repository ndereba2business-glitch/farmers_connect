// End-to-end tests of "Continue with Google" with the mocked backend.
// Google itself can't be driven from a test, so these cover our side:
// the button only appears when the provider is switched on in Supabase,
// it sends the browser to Supabase's Google address, and a role picked on
// the sign-up page is applied when the person comes back.
//
//   npm run test:e2e
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { layoutAndA11y } from "./checks.js";

let app;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

const googleButton = (page) => page.locator("button", { hasText: /Google/ });

async function visitor(backend, path, viewport) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context);
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

test("the Google button stays hidden while the provider is off", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  for (const path of ["/login", "/signup"]) {
    const { context, page } = await visitor(backend, path);
    await page.locator('input[type="password"]').waitFor();
    await page.waitForTimeout(800);
    assert.equal(await googleButton(page).count(), 0, `${path}: no dead button`);
    await context.close();
  }
});

// Answers the trip to Google with "no content", so the page stays put
// and the test can see where it was heading and what it parked.
async function leaveForGoogle(context, page, beforeClick) {
  const seen = { authorize: null, parked: undefined };
  await context.route(`${MOCK_SUPABASE_URL}/auth/v1/authorize**`, route => {
    seen.authorize = new URL(route.request().url());
    return route.fulfill({ status: 204, body: "" });
  });
  await googleButton(page).waitFor();
  if (beforeClick) await beforeClick();
  await googleButton(page).click();
  for (let i = 0; i < 50 && !seen.authorize; i++) await page.waitForTimeout(100);
  assert.ok(seen.authorize, "the browser set off for Google");
  seen.parked = await page.evaluate(() => localStorage.getItem("fc_pending_role"));
  return seen;
}

test("login: the button sends the browser to Supabase's Google sign-in", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  backend.db.googleEnabled = true;
  const { context, page } = await visitor(backend, "/login");

  // a role left behind by an earlier, abandoned sign-up on this phone
  await page.evaluate(() => localStorage.setItem("fc_pending_role", JSON.stringify({ role: "vet", at: Date.now() })));
  const seen = await leaveForGoogle(context, page);

  assert.equal(seen.authorize.searchParams.get("provider"), "google");
  assert.equal(seen.authorize.searchParams.get("redirect_to"), `${app.url}/`);
  assert.equal(seen.parked, null, "logging in never carries a parked role");
  await context.close();
});

test("signup: the chosen role is parked before leaving for Google", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  backend.db.googleEnabled = true;
  const { context, page } = await visitor(backend, "/signup");

  const seen = await leaveForGoogle(context, page, async () => {
    await page.locator("button", { hasText: /^supplier$/ }).click();
    assert.match(await page.locator("text=/You'll join as a/").innerText(), /supplier/);
  });

  assert.equal(JSON.parse(seen.parked).role, "supplier");
  await context.close();
});

async function returnFromGoogle(backend, user, parkedRole) {
  const session = await newUserPage(app.browser);
  await backend.attach(session.context, { signedInAs: user.email });
  if (parkedRole) {
    await session.context.addInitScript(([role, at]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("fc_pending_role", JSON.stringify({ role, at }));
        sessionStorage.setItem("seeded", "1");
      }
    }, [parkedRole.role, parkedRole.at ?? Date.now()]);
  }
  await session.page.goto(`${app.url}/`, { waitUntil: "domcontentloaded" });
  return session;
}

test("back from Google: a new account gets the role picked at sign-up", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  const user = backend.addUser({ email: "new-supplier@google.test", role: null });
  const { context, page, errors } = await returnFromGoogle(backend, user, { role: "supplier" });

  await page.waitForURL(u => u.pathname === "/supplier");
  await page.locator("text=Set up your supplier profile").waitFor();
  await page.waitForFunction(() => !localStorage.getItem("fc_pending_role"));
  assert.equal(user.role, "supplier", "the role is saved to the account");
  assert.deepEqual(errors, []);
  await context.close();
});

test("back from Google: a vet lands on the vet dashboard", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  const user = backend.addUser({ email: "new-vet@google.test", role: null });
  const { context, page } = await returnFromGoogle(backend, user, { role: "vet" });
  await page.waitForURL(u => u.pathname === "/vet");
  await context.close();
});

test("a parked role can never make an admin, change an existing role, or apply when stale", { timeout: 60000 }, async () => {
  const backend = createMockBackend();

  const sneaky = backend.addUser({ email: "sneaky@google.test", role: null });
  const a = await returnFromGoogle(backend, sneaky, { role: "admin" });
  await a.page.locator("text=/Good (morning|afternoon|evening)/").waitFor();
  assert.equal(new URL(a.page.url()).pathname, "/", "treated as a farmer");
  assert.equal(sneaky.role, null);
  await a.context.close();

  const farmer = backend.addUser({ email: "existing@google.test", role: "farmer" });
  const b = await returnFromGoogle(backend, farmer, { role: "supplier" });
  await b.page.locator("text=/Good (morning|afternoon|evening)/").waitFor();
  assert.equal(farmer.role, "farmer", "an account that already has a role keeps it");
  await b.context.close();

  const late = backend.addUser({ email: "late@google.test", role: null });
  const c = await returnFromGoogle(backend, late, { role: "vet", at: Date.now() - 60 * 60 * 1000 });
  await c.page.locator("text=/Good (morning|afternoon|evening)/").waitFor();
  assert.equal(late.role, null, "an hour-old choice is ignored");
  await c.context.close();
});

const greeting = (page) => page.locator("text=/Good (morning|afternoon|evening)/");

test("back from Google: the address signs the person in, and they stay signed in", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  const user = backend.addUser({ email: "wanjiru@google.test", role: "farmer" });
  const { context, page, errors } = await newUserPage(app.browser);
  await backend.attach(context, { returningAs: user.email });

  await page.goto(`${app.url}/${backend.googleReturnHash(user)}`, { waitUntil: "domcontentloaded" });
  await greeting(page).waitFor();
  assert.doesNotMatch(page.url(), /access_token|refresh_token/, "the tokens don't stay in the address bar");
  assert.ok(await page.evaluate(() => localStorage.getItem("sb-e2e-auth-token")), "the session is kept on this phone");

  // closing the tab and coming back: no second trip to Google
  await page.goto(`${app.url}/my-farm`, { waitUntil: "domcontentloaded" });
  await page.locator("aside nav a").first().waitFor();
  assert.equal(new URL(page.url()).pathname, "/my-farm");
  assert.deepEqual(errors, []);
  await context.close();
});

test("back from Google, refused: the login page says so in our own words", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  backend.db.googleEnabled = true;
  const refusal = "error=access_denied&error_code=signup_disabled&error_description=Call+0700000000+to+unlock";
  const { context, page, errors } = await visitor(backend, `/?${refusal}#${refusal}`);

  await page.waitForURL(u => u.pathname === "/login");
  const alert = page.locator('[role="alert"]');
  await alert.waitFor();
  assert.match(await alert.innerText(), /New accounts can't be created right now/);
  assert.doesNotMatch(await page.locator("body").innerText(), /0700000000/, "text from the link is never shown");
  assert.doesNotMatch(page.url(), /error/, "the address is tidied");
  await googleButton(page).waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test("signed out: the landing page opens without the database, and private pages ask for a login", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  const { context, page } = await visitor(backend, "/");
  const queries = [];
  page.on("request", r => { if (r.url().startsWith(`${MOCK_SUPABASE_URL}/rest/`)) queries.push(r.url()); });

  await page.locator("h1").first().waitFor();
  await page.locator("a", { hasText: "Log in" }).first().waitFor();
  await page.waitForTimeout(500);
  assert.equal(new URL(page.url()).pathname, "/", "no bounce to the login page");
  assert.deepEqual(queries, [], "the landing page never queries Supabase");

  for (const path of ["/my-farm", "/clucky", "/vet", "/supplier", "/admin"]) {
    await page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(u => u.pathname === "/login");
  }
  await context.close();
});

test("signing in with Google gives no way into another role's pages", { timeout: 60000 }, async () => {
  const backend = createMockBackend();
  const user = backend.addUser({ email: "farmer-only@google.test", role: "farmer" });
  const { context, page } = await newUserPage(app.browser);
  await backend.attach(context, { returningAs: user.email });

  await page.goto(`${app.url}/${backend.googleReturnHash(user)}`, { waitUntil: "domcontentloaded" });
  await greeting(page).waitFor();
  for (const path of ["/admin", "/verifications", "/vet", "/supplier"]) {
    await page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
    await greeting(page).waitFor();
    assert.equal(new URL(page.url()).pathname, "/", `${path}: a farmer is sent home`);
  }
  await context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`login and signup with the Google button at ${width}px`, { timeout: 60000 }, async () => {
    const backend = createMockBackend();
    backend.db.googleEnabled = true;
    for (const path of ["/login", "/signup"]) {
      const { context, page } = await visitor(backend, path, { width, height: 800 });
      await googleButton(page).waitFor();
      const box = await googleButton(page).boundingBox();
      assert.ok(box.height >= 44, `${path}@${width}: Google button is ${Math.round(box.height)}px tall`);
      assert.ok(box.x >= 0 && box.x + box.width <= width, `${path}@${width}: button inside the screen`);
      const r = await layoutAndA11y(page);
      assert.equal(r.overflow, false, `${path}@${width}: horizontal scroll`);
      await context.close();
    }
  });
}
