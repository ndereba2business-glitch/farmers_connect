// End-to-end checks of reporting, blocking and agreeing to AI processing,
// with the mocked backend: a listing, an answer from Clucky and a member
// can each be reported; a blocked member's messages and listings disappear
// for the person who blocked them and come back on unblocking; an admin
// sees the reports; and Clucky sends nothing until the person has agreed.
// The rules behind these are checked in supabase/tests/security.sql.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

const ALICE = { email: "alice@safety.test", role: "farmer" };
const BOB = { email: "bob@safety.test", role: "farmer" };
const NEWCOMER = { email: "new@safety.test", role: "farmer", cluckyConsent: false };
const ADMIN = { email: "admin@safety.test", role: "farmer", admin: true };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

const chat = (id, user, name, text, secondsAgo) => ({
  id, user_email: user.email, user_name: name, message: text, image_url: null, sender_badge: null,
  created_at: new Date(Date.now() - secondsAgo * 1000).toISOString(),
  reply_to_id: null, reply_to_user: null, reply_to_message: null, removed_at: null, removed_by: null
});

beforeEach(() => {
  backend = createMockBackend();
  for (const user of [ALICE, BOB, NEWCOMER, ADMIN]) backend.addUser(user);
  backend.db.tables.community_chat = [
    chat("s1", ALICE, "Alice Wanjiru", "Which layers mash are you all using?", 300),
    chat("s2", BOB, "Bob Otieno", "Send me 500 bob and I will double it by Friday", 200),
    chat("s3", BOB, "Bob Otieno", "Honestly, it works every time", 100)
  ];
  backend.db.tables.message_reactions = [];
  backend.db.tables.community_reports = [];
  backend.db.tables.community_mutes = [];
  backend.db.tables.content_reports = [];
  backend.db.tables.user_blocks = [];
  backend.db.tables.account_requests = [];
  backend.db.tables.clucky_messages = [];
  const now = new Date().toISOString();
  backend.db.products.push({
    id: "bob-listing", product_name: "Miracle growth powder", category: "medicine", price: 200, unit: "per_piece", stock: 5,
    county: "Nakuru", seller_phone: "0712345678", description: "", image_url: "", supplier_id: null, supplier_name: "Bob Otieno",
    user_email: BOB.email, availability: "in_stock", sold_out: false, is_active: true, is_verified: false,
    created_at: now.replace("Z", ""), updated_at: now
  });
});

async function open(user, path, viewport = { width: 360, height: 800 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

const reports = () => backend.db.tables.content_reports;
const bubble = (page, text) => page.locator(".cm-bubble", { hasText: text });
const reportDialog = (page) => page.locator('form[role="dialog"]', { hasText: "What is wrong with it?" });

test("a listing can be reported, and a failed report can be sent again", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(ALICE, "/marketplace");
  await page.locator('button[aria-label="Report the listing Miracle growth powder"]').click();
  const dialog = reportDialog(page);
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Miracle growth powder, KES 200\/item, by Bob Otieno/);
  assert.match(await dialog.innerText(), /not told who reported them/);

  backend.db.failingTables.add("content_reports");
  await page.route(`${MOCK_SUPABASE_URL}/rest/v1/content_reports*`, route => route.abort("failed"), { times: 1 });
  await dialog.locator("button", { hasText: "Illegal or unsafe product" }).click();
  await dialog.locator("textarea").fill("No label, no licence");
  await dialog.locator('button[type="submit"]').click();
  await dialog.locator('[role="alert"]', { hasText: "didn't send" }).waitFor();
  assert.equal(await dialog.locator("textarea").inputValue(), "No label, no licence", "what was typed is kept");
  assert.equal(reports().length, 0);

  backend.db.failingTables.clear();
  await dialog.locator('button[type="submit"]').click();
  await page.locator('[role="status"]', { hasText: "An admin will review this listing" }).waitFor();
  await dialog.waitFor({ state: "detached" });
  assert.equal(reports().length, 1);
  assert.deepEqual(
    { kind: reports()[0].kind, target: reports()[0].target_id, reporter: reports()[0].reporter, reason: reports()[0].reason },
    { kind: "listing", target: "bob-listing", reporter: ALICE.email, reason: "Illegal or unsafe product: No label, no licence" }
  );
  assert.ok(backend.db.products.some(p => p.id === "bob-listing"), "reporting removes nothing by itself");
  assert.deepEqual(errors, []);
  await context.close();

  // the seller is not offered a report button on their own listing
  const bob = await open(BOB, "/marketplace");
  await bob.page.locator("h3", { hasText: "Miracle growth powder" }).waitFor();
  assert.equal(await bob.page.locator('button[aria-label^="Report the listing"]').count(), 0);
  await bob.context.close();
});

test("a member can be reported and blocked from one of their messages", { timeout: 60000 }, async () => {
  const { context, page } = await open(ALICE, "/community");
  await bubble(page, "double it by Friday").click();
  await page.locator(".cm-sheet button", { hasText: "Report Bob Otieno, not just this message" }).click();
  const dialog = reportDialog(page);
  await dialog.locator("button", { hasText: "Scam or fraud" }).click();
  await dialog.locator('button[type="submit"]').click();
  await page.locator('[role="status"]', { hasText: "An admin will review this member" }).waitFor();
  assert.deepEqual(
    { kind: reports()[0].kind, target: reports()[0].target_id, reason: reports()[0].reason },
    { kind: "member", target: BOB.email, reason: "Scam or fraud" }
  );

  await bubble(page, "double it by Friday").click();
  await page.locator(".cm-sheet button", { hasText: "Block Bob Otieno" }).click();
  const confirm = page.locator('[role="alertdialog"]', { hasText: "Block Bob Otieno?" });
  assert.match(await confirm.innerText(), /They are not told/);
  await confirm.locator("button", { hasText: /^\s*Block\s*$/ }).click();
  await bubble(page, "double it by Friday").waitFor({ state: "detached" });
  assert.equal(await bubble(page, "works every time").count(), 0, "every message from the blocked member is gone");
  assert.equal(await bubble(page, "Which layers mash").count(), 1, "nobody else's messages are affected");
  assert.equal(backend.db.tables.user_blocks.length, 1);
  assert.equal(backend.db.tables.community_chat.length, 3, "the messages still exist for everyone else");

  // it holds after a reload, and their listings are hidden too
  await page.reload({ waitUntil: "domcontentloaded" });
  await bubble(page, "Which layers mash").waitFor();
  assert.equal(await bubble(page, "double it by Friday").count(), 0);
  await page.goto(`${app.url}/marketplace`, { waitUntil: "domcontentloaded" });
  await page.locator("text=No products found").waitFor();
  await context.close();

  // the blocked member notices nothing, and other members still see them
  const bob = await open(BOB, "/community");
  await bubble(bob.page, "Which layers mash").waitFor();
  assert.equal(await bubble(bob.page, "double it by Friday").count(), 1);
  await bob.context.close();
});

test("a blocked member can be unblocked from the profile", { timeout: 60000 }, async () => {
  backend.db.tables.user_blocks.push({ id: "b1", blocker: ALICE.email, blocked: BOB.email, blocked_name: "Bob Otieno", created_at: new Date().toISOString() });
  const { context, page } = await open(ALICE, "/profile");
  const row = page.locator(".ac-blocked-row", { hasText: "Bob Otieno" });
  await row.waitFor();
  assert.doesNotMatch(await page.locator(".ac-blocked").innerText(), /bob@safety\.test/, "the list shows a name, not the member's email address");
  await row.locator("button", { hasText: "Unblock" }).click();
  await page.locator('[role="status"]', { hasText: "Bob Otieno is unblocked" }).waitFor();
  assert.equal(backend.db.tables.user_blocks.length, 0);
  await page.goto(`${app.url}/community`, { waitUntil: "domcontentloaded" });
  await bubble(page, "double it by Friday").waitFor();
  await context.close();

  // someone with nobody blocked is not shown an empty list
  const bob = await open(BOB, "/profile");
  await bob.page.locator("#delete-account").waitFor();
  assert.equal(await bob.page.locator(".ac-blocked").count(), 0);
  await bob.context.close();
});

test("Clucky sends nothing to the AI service until the person has agreed", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(NEWCOMER, "/clucky");
  const consent = page.locator(".ac-consent");
  await consent.waitFor();
  const text = await consent.innerText();
  assert.match(text, /written by Google's Gemini AI service/);
  assert.match(text, /your county, your active batches and any overdue vaccinations/);
  assert.match(text, /Your name, email address and phone number are not sent/);
  assert.match(text, /they can be wrong/);
  assert.equal(await page.locator('textarea[aria-label="Ask Clucky a question"]').isVisible(), false, "there is no box to type in yet");
  assert.equal(await page.locator(".ck-suggestion").count(), 0, "and no one-tap questions");
  assert.deepEqual(backend.db.clucky.asked, []);

  await consent.locator("button", { hasText: "I agree, let me ask Clucky" }).click();
  await consent.waitFor({ state: "detached" });
  assert.ok(backend.db.users.get(NEWCOMER.email).cluckyConsentAt, "the agreement is saved on the account");
  await page.locator('textarea[aria-label="Ask Clucky a question"]').fill("How warm should a brooder be?");
  await page.click('button[aria-label="Send question"]');
  await page.locator(".ck-bubble", { hasText: "clean water" }).waitFor();
  assert.equal(backend.db.clucky.asked.length, 1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".ck-bubble").first().waitFor();
  assert.equal(await page.locator(".ac-consent").count(), 0, "it is asked once");
  assert.deepEqual(errors, []);
  await context.close();
});

test("an answer from Clucky can be reported", { timeout: 60000 }, async () => {
  backend.db.tables.clucky_messages = [
    { id: "q1", user_email: ALICE.email, role: "user", content: "What dose of antibiotic for coughing?", created_at: "2026-10-12T08:00:00Z" },
    { id: "a1", user_email: ALICE.email, role: "assistant", content: "Give every bird two tablets a day.", created_at: "2026-10-12T08:00:05Z" }
  ];
  const { context, page } = await open(ALICE, "/clucky");
  await page.locator(".ck-bubble", { hasText: "two tablets" }).waitFor();
  assert.equal(await page.locator("button", { hasText: "Report this answer" }).count(), 1, "offered under Clucky's answer, not under the farmer's question");
  await page.locator("button", { hasText: "Report this answer" }).click();
  const dialog = reportDialog(page);
  assert.match(await dialog.innerText(), /Give every bird two tablets a day\./);
  await dialog.locator('button[type="submit"]').click();
  await page.locator('[role="status"]', { hasText: "An admin will review this answer" }).waitFor();
  assert.deepEqual(
    { kind: reports()[0].kind, target: reports()[0].target_id, reason: reports()[0].reason, summary: reports()[0].target_summary },
    { kind: "clucky_answer", target: "a1", reason: "Wrong or dangerous advice", summary: "Give every bird two tablets a day." }
  );
  await context.close();
});

test("an admin sees the reports and can remove a reported listing", { timeout: 60000 }, async () => {
  reports().push(
    { id: "r1", kind: "listing", target_id: "bob-listing", target_summary: "Miracle growth powder, KES 200/item, by Bob Otieno", reporter: ALICE.email, reason: "Scam or misleading", status: "open", created_at: new Date().toISOString() },
    { id: "r2", kind: "member", target_id: BOB.email, target_summary: "Bob Otieno: Send me 500 bob", reporter: ALICE.email, reason: "Scam or fraud", status: "open", created_at: new Date().toISOString() }
  );
  // a member who is not an admin sees only the reports they sent themselves
  const bob = await open(BOB, "/marketplace");
  const seen = await bob.page.evaluate(async ([url, key]) => {
    const token = JSON.parse(localStorage.getItem("sb-e2e-auth-token")).access_token;
    const response = await fetch(`${url}/rest/v1/content_reports?select=id`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
    return (await response.json()).length;
  }, [MOCK_SUPABASE_URL, MOCK_ANON_KEY]);
  assert.equal(seen, 0, "the reported member cannot read reports about them");
  await bob.context.close();

  const { context, page } = await open(ADMIN, "/admin", { width: 1280, height: 900 });
  await page.locator('button[aria-pressed]:has-text("requests")').click();
  const listing = page.locator(".ac-row", { hasText: "Miracle growth powder" });
  await listing.waitFor();
  assert.match(await listing.innerText(), /Reason: Scam or misleading/);
  await listing.locator("button", { hasText: "Remove the listing" }).click();
  await listing.waitFor({ state: "detached" });
  assert.equal(backend.db.products.some(p => p.id === "bob-listing"), false);
  assert.equal(reports().find(r => r.id === "r1").status, "actioned");

  const member = page.locator(".ac-row", { hasText: BOB.email });
  await member.locator("button", { hasText: "Dismiss" }).click();
  await member.waitFor({ state: "detached" });
  assert.equal(reports().find(r => r.id === "r2").status, "dismissed");
  await page.locator("text=No open reports.").waitFor();
  await context.close();
});

for (const width of [320, 360, 390, 768, 1280]) {
  test(`reporting, blocking and the Clucky agreement fit the screen at ${width}px`, { timeout: 90000 }, async () => {
    const inside = async (locator, what) => {
      const box = await locator.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 801, `${what} is inside the screen at ${width}px`);
      for (const control of await locator.locator("button, textarea").all()) {
        assert.ok((await control.boundingBox()).height >= 44, `${what}: a control is under 44px at ${width}px`);
      }
    };
    const noSidewaysScroll = async (page, what) =>
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${what}@${width}: horizontal scroll`);

    const alice = await open(ALICE, "/marketplace", { width, height: 800 });
    const report = alice.page.locator('button[aria-label="Report the listing Miracle growth powder"]');
    await report.waitFor();
    assert.ok((await report.boundingBox()).height >= 44, "the report link is a 44px target");
    await noSidewaysScroll(alice.page, "/marketplace");
    await report.click();
    await inside(reportDialog(alice.page), "report dialog");
    await alice.page.keyboard.press("Escape");

    await alice.page.goto(`${app.url}/community`, { waitUntil: "domcontentloaded" });
    await bubble(alice.page, "double it by Friday").click();
    await alice.page.locator(".cm-sheet button", { hasText: "Block Bob Otieno" }).click();
    await inside(alice.page.locator('[role="alertdialog"]'), "block dialog");
    await alice.context.close();

    const newcomer = await open(NEWCOMER, "/clucky", { width, height: 800 });
    const consent = newcomer.page.locator(".ac-consent");
    await consent.waitFor();
    const box = await consent.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1, `the Clucky agreement is inside the screen at ${width}px`);
    assert.ok((await consent.locator("button").boundingBox()).height >= 44);
    await noSidewaysScroll(newcomer.page, "/clucky");
    await newcomer.context.close();
  });
}
