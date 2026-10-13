// End-to-end checks of the policy pages, accepting the terms, deleting an
// account and the admin's request list, with the mocked backend. The
// deletion itself (what the database removes and keeps) is checked in
// supabase/tests/security.sql, and the function's rules in
// tests/unit/accountDeletion.test.js.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

const FARMER = { email: "farmer@account.test", password: "farmer-pass", role: "farmer" };
const VET = { email: "vet@account.test", password: "vet-pass", role: "vet" };
const SUPPLIER = { email: "supplier@account.test", password: "supplier-pass", role: "supplier" };
const OLD_TIMER = { email: "old@account.test", password: "old-pass", role: "farmer", termsAccepted: false };
const ADMIN = { email: "admin@account.test", password: "admin-pass", role: "farmer", admin: true };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  for (const user of [FARMER, VET, SUPPLIER, OLD_TIMER, ADMIN]) backend.addUser(user);
  backend.db.tables.account_requests = [];
  backend.db.tables.content_reports = [];
});

async function open(user, path, viewport = { width: 360, height: 900 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, user ? { signedInAs: user.email } : {});
  // every call to the database, so "reads nothing" can be shown
  session.databaseCalls = [];
  session.page.on("request", r => { if (r.url().includes("/rest/v1/")) session.databaseCalls.push(r.url()); });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

// Buttons, fields and the links that stand alone. A link inside a sentence
// is exempt from the 44px rule, like any other word in it.
async function layoutProblems(page) {
  return page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null;
    const standalone = [...document.querySelectorAll("button, input:not([type=checkbox]):not([tabindex='-1']), select, textarea, .fc-btn, .lg-back, .lg-brand, .lg-foot a, summary")].filter(visible);
    const small = standalone.filter(el => el.getBoundingClientRect().height < 44)
      .map(el => `${el.tagName} "${(el.textContent || el.id || "").trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().height)}px`);
    const unnamed = [...document.querySelectorAll("input:not([tabindex='-1']), select, textarea")].filter(visible)
      .filter(el => !(el.labels?.length || el.getAttribute("aria-label"))).map(el => el.outerHTML.slice(0, 60));
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return { small, unnamed, overflow };
  });
}

test("the policy pages open for a visitor and read nothing from the database", { timeout: 60000 }, async () => {
  for (const [path, heading, mustSay] of [
    ["/privacy", "Privacy Policy", [/What we collect/, /Clucky and artificial intelligence/, /Deleting your account/, /Data Protection Act, 2019/, /We do not sell your information/]],
    ["/terms", "Terms and Community Rules", [/Community rules/, /Reporting, blocking and what we do about it/, /Clucky is a computer program, not a vet/, /No money moves through Farmers Connect/]],
    ["/delete-account", "Delete your Farmers Connect account", [/Delete it yourself/, /If you cannot sign in/, /What is deleted/, /What is kept, and why/]]
  ]) {
    const { context, page, errors, databaseCalls } = await open(null, path);
    await page.locator("h1", { hasText: heading }).waitFor();
    const text = await page.locator("main").innerText();
    for (const phrase of mustSay) assert.match(text, phrase, `${path} says ${phrase}`);
    assert.doesNotMatch(text, /lorem|TODO|\[.*owner.*\]|undefined/i, `${path} has no placeholder text`);
    assert.deepEqual(databaseCalls, [], `${path} made no database call`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test("the landing page, the login page and the signed-in menu all link to the policies", { timeout: 60000 }, async () => {
  const visitor = await open(null, "/");
  await visitor.page.locator("footer").waitFor();
  for (const path of ["/privacy", "/terms", "/delete-account"]) {
    assert.ok(await visitor.page.locator(`footer a[href="${path}"]`).count(), `landing footer links to ${path}`);
  }
  await visitor.page.goto(`${app.url}/login`);
  await visitor.page.locator('a[href="/privacy"]').waitFor();
  assert.ok(await visitor.page.locator('a[href="/delete-account"]').count());
  await visitor.context.close();

  for (const user of [FARMER, SUPPLIER]) {
    const member = await open(user, user === SUPPLIER ? "/supplier" : "/", { width: 1280, height: 900 });
    await member.page.locator('.fc-policy-links a[href="/privacy"]').first().waitFor();
    assert.ok(await member.page.locator('.fc-policy-links a[href="/terms"]').count(), `${user.role} menu links to the terms`);
    await member.context.close();
  }
});

test("someone who joined before the terms existed must accept them before using the app", { timeout: 60000 }, async () => {
  const { context, page } = await open(OLD_TIMER, "/");
  const gate = page.locator('[role="dialog"]', { hasText: "Before you continue with Farmers Connect" });
  await gate.waitFor();
  const agree = gate.locator("button", { hasText: "Agree and continue" });
  assert.equal(await agree.isDisabled(), true, "nothing is agreed until the box is ticked");
  assert.equal(await gate.locator('a[href="/terms"]').getAttribute("target"), "_blank", "the terms open without losing the dialog");
  await page.keyboard.press("Escape");
  assert.equal(await gate.count(), 1, "it cannot be dismissed by pressing Escape");

  await gate.locator('input[type="checkbox"]').check();
  await agree.click();
  await gate.waitFor({ state: "detached" });
  const saved = backend.db.users.get(OLD_TIMER.email);
  assert.ok(saved.termsAcceptedAt, "the acceptance is saved on the account");
  assert.equal(saved.termsVersion, "2026-10-12");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  assert.equal(await page.locator('[role="dialog"]', { hasText: "Before you continue" }).count(), 0, "and is not asked for again");
  await context.close();

  // an account that has accepted is never interrupted
  const farmer = await open(FARMER, "/");
  await farmer.page.waitForTimeout(800);
  assert.equal(await farmer.page.locator('[role="dialog"]', { hasText: "Before you continue" }).count(), 0);
  await farmer.context.close();
});

test("a new account cannot be created without accepting the terms", { timeout: 60000 }, async () => {
  const { context, page } = await open(null, "/signup");
  const submit = page.locator('form button[type="submit"]');
  await submit.waitFor();
  assert.equal(await submit.isDisabled(), true);
  assert.ok(await page.locator('form a[href="/terms"]').count());
  assert.ok(await page.locator('form a[href="/privacy"]').count());
  await page.locator('form input[type="checkbox"]').check();
  assert.equal(await submit.isDisabled(), false);
  await context.close();
});

for (const user of [FARMER, VET, SUPPLIER]) {
  test(`a ${user.role} finds "Delete my account" on their profile`, { timeout: 60000 }, async () => {
    const { context, page } = await open(user, "/profile");
    const section = page.locator("#delete-account");
    await section.waitFor();
    await section.locator("summary").click();
    const text = await section.innerText();
    assert.match(text, /removes it and your data permanently\. It is not a pause/);
    assert.match(text, /Deleted straight away/);
    assert.match(text, /Kept/);
    await context.close();
  });
}

test("deleting an account needs the word and the right password, and then it is gone", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(FARMER, "/profile");
  await page.locator("#delete-account button", { hasText: "Delete my account" }).click();
  const dialog = page.locator('[role="dialog"]', { hasText: "Delete your account for good?" });
  await dialog.waitFor();
  const confirm = dialog.locator('button[type="submit"]');
  assert.equal(await confirm.isDisabled(), true);

  await dialog.locator("input").first().fill("delete");
  await dialog.locator('input[type="password"]').fill("wrong-password");
  assert.equal(await confirm.isDisabled(), true, "the word must be typed exactly");
  await dialog.locator("input").first().fill("DELETE");
  await confirm.click();
  await dialog.locator('[role="alert"]', { hasText: "That password is not right" }).waitFor();
  assert.ok(backend.db.users.has(FARMER.email), "a wrong password deletes nothing");

  // cancelling keeps the account too
  await dialog.locator("button", { hasText: "Keep my account" }).click();
  await dialog.waitFor({ state: "detached" });
  assert.ok(backend.db.users.has(FARMER.email));

  await page.locator("#delete-account button", { hasText: "Delete my account" }).click();
  await dialog.locator("input").first().fill("DELETE");
  await dialog.locator('input[type="password"]').fill(FARMER.password);
  await confirm.click();
  await page.waitForURL(u => u.pathname === "/account-deleted");
  await page.locator("h1", { hasText: "Your account has been deleted" }).waitFor();
  assert.equal(backend.db.users.has(FARMER.email), false, "the account no longer exists");
  assert.equal(backend.db.deleteAccount.calls.length, 2, "one refused attempt and one deletion, no duplicates");

  // Signed out on this device: the saved session is gone, and the home page
  // is the public one again. (Followed as a link, not a fresh load: this
  // test harness re-plants the saved session on every page load.)
  await page.waitForFunction(() => Object.keys(localStorage).every(k => !k.includes("auth-token")));
  await page.locator("a", { hasText: "Go to the home page" }).click();
  await page.locator('.lp-hero a[href="/signup"]').waitFor();
  assert.deepEqual(errors, []);
  await context.close();
});

test("a deletion that fails says so, deletes nothing, and can be tried again", { timeout: 60000 }, async () => {
  backend.db.deleteAccount.mode = "failed";
  const { context, page } = await open(FARMER, "/profile");
  await page.locator("#delete-account button", { hasText: "Delete my account" }).click();
  const dialog = page.locator('[role="dialog"]', { hasText: "Delete your account for good?" });
  await dialog.locator("input").first().fill("DELETE");
  await dialog.locator('input[type="password"]').fill(FARMER.password);
  await dialog.locator('button[type="submit"]').click();
  await dialog.locator('[role="alert"]', { hasText: "Nothing has been removed" }).waitFor();
  assert.ok(backend.db.users.has(FARMER.email));
  assert.equal(new URL(page.url()).pathname, "/profile", "no false goodbye page");

  backend.db.deleteAccount.mode = "ok";
  await dialog.locator('button[type="submit"]').click();
  await page.waitForURL(u => u.pathname === "/account-deleted");
  await context.close();
});

test("an administrator account cannot delete itself from the app", { timeout: 60000 }, async () => {
  const { context, page } = await open(ADMIN, "/profile");
  await page.locator("#delete-account").waitFor();
  assert.match(await page.locator("#delete-account").innerText(), /removed by the project owner/);
  assert.equal(await page.locator("#delete-account button", { hasText: "Delete my account" }).count(), 0);
  await context.close();
});

test("the public deletion page works signed in, and sends a visitor back to it after signing in", { timeout: 60000 }, async () => {
  const visitor = await open(null, "/delete-account");
  assert.equal(await visitor.page.locator("#delete-account").count(), 0, "a visitor is not shown a delete button");
  await visitor.page.locator('a[href="/login?next=/delete-account"]').click();
  await visitor.page.waitForURL(u => u.pathname === "/login");
  await visitor.page.fill('input[type="email"]', VET.email);
  await visitor.page.fill('input[type="password"]', VET.password);
  await visitor.page.click('button:has-text("Log in")');
  await visitor.page.waitForURL(u => u.pathname === "/delete-account");
  await visitor.page.locator("#delete-account button", { hasText: "Delete my account" }).waitFor();
  await visitor.context.close();
});

test("someone who cannot sign in can ask for deletion, and an admin can act on it", { timeout: 90000 }, async () => {
  const visitor = await open(null, "/delete-account");
  const form = visitor.page.locator("form.lg-form");
  await form.locator("button", { hasText: "Send request" }).click();
  await form.locator('[role="alert"]', { hasText: "Enter the email address or phone number" }).waitFor();
  assert.equal(backend.db.tables.account_requests.length, 0);

  // a dropped connection keeps what was typed
  backend.db.accountRequestFails = true;
  await form.locator("#rq-identity").fill(SUPPLIER.email);
  await form.locator("#rq-message").fill("I lost my phone");
  await form.locator("button", { hasText: "Send request" }).click();
  await form.locator('[role="alert"]', { hasText: "was not sent" }).waitFor();
  assert.equal(await form.locator("#rq-message").inputValue(), "I lost my phone");

  backend.db.accountRequestFails = false;
  await form.locator("button", { hasText: "Send request" }).click();
  await visitor.page.locator('[role="status"]', { hasText: "Your request has been received" }).waitFor();
  assert.equal(backend.db.tables.account_requests.length, 1);
  assert.equal(backend.db.tables.account_requests[0].identity, SUPPLIER.email);
  assert.ok(backend.db.users.has(SUPPLIER.email), "sending a request deletes nothing by itself");
  await visitor.context.close();

  // a member who is not an admin has no such list
  const member = await open(FARMER, "/admin");
  await member.page.waitForURL(u => u.pathname !== "/admin");
  await member.context.close();

  const admin = await open(ADMIN, "/admin", { width: 1280, height: 900 });
  await admin.page.locator('button[aria-pressed]:has-text("requests")').click();
  const row = admin.page.locator(".ac-row", { hasText: SUPPLIER.email });
  await row.waitFor();
  assert.match(await row.innerText(), /I lost my phone/);
  assert.match(await admin.page.locator(".ac-requests").innerText(), /confirm the account is theirs before deleting it/);
  await row.locator("button", { hasText: "Delete this account" }).click();
  const dialog = admin.page.locator('[role="alertdialog"]');
  assert.match(await dialog.innerText(), /Only continue if you have confirmed with them/);
  await dialog.locator("button", { hasText: "Delete account" }).click();
  await row.waitFor({ state: "detached" });
  assert.equal(backend.db.users.has(SUPPLIER.email), false);
  assert.deepEqual(backend.db.deleteAccount.calls.at(-1), { user: ADMIN.email, target: SUPPLIER.email });
  await admin.context.close();
});

for (const width of [320, 360, 390, 768, 1280]) {
  test(`the policy pages, the terms dialog and the deletion dialog fit the screen at ${width}px`, { timeout: 90000 }, async () => {
    const visitor = await open(null, "/privacy", { width, height: 800 });
    for (const path of ["/privacy", "/terms", "/delete-account"]) {
      await visitor.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
      await visitor.page.locator("h1").waitFor();
      const r = await layoutProblems(visitor.page);
      assert.equal(r.overflow, false, `${path}@${width}: horizontal scroll`);
      assert.deepEqual(r.small, [], `${path}@${width}: touch targets under 44px`);
      assert.deepEqual(r.unnamed, [], `${path}@${width}: fields without a label`);
    }
    await visitor.context.close();

    const old = await open(OLD_TIMER, "/", { width, height: 800 });
    const gate = old.page.locator('[role="dialog"]', { hasText: "Before you continue" });
    await gate.waitFor();
    let box = await gate.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 801, `terms dialog is inside the screen at ${width}px`);
    for (const button of await gate.locator("button").all()) assert.ok((await button.boundingBox()).height >= 44);
    await old.context.close();

    const farmer = await open(FARMER, "/profile", { width, height: 800 });
    await farmer.page.locator("#delete-account button", { hasText: "Delete my account" }).click();
    const dialog = farmer.page.locator('[role="dialog"]', { hasText: "Delete your account for good?" });
    await dialog.waitFor();
    box = await dialog.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 801, `deletion dialog is inside the screen at ${width}px`);
    for (const control of await dialog.locator("button, input").all()) assert.ok((await control.boundingBox()).height >= 44);
    const r = await layoutProblems(farmer.page);
    assert.equal(r.overflow, false, `/profile@${width}: horizontal scroll`);
    await farmer.context.close();
  });
}
