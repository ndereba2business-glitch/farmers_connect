// End-to-end tests of the community group chat with the mocked backend,
// which applies the same rules as the real database (server-set names
// and reply previews, blocked words, one reaction per person, removal by
// the author or an admin). The real rules are checked against the live
// database by npm run test:security.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { layoutAndA11y } from "./checks.js";

const ALICE = { email: "alice@group.test", role: "farmer" };
const BOB = { email: "bob@group.test", role: "farmer" };
const ADMIN = { email: "admin@group.test", role: "farmer", admin: true };

const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

const message = (id, user, text, at, extra = {}) => ({
  id, user_email: user.email, user_name: user === BOB ? "Bob Otieno" : "Alice Wanjiru", message: text, image_url: null,
  sender_badge: null, created_at: at, reply_to_id: null, reply_to_user: null, reply_to_message: null,
  removed_at: null, removed_by: null, ...extra
});

// A fresh group for every test: two messages from yesterday, two from today.
beforeEach(() => {
  backend = createMockBackend();
  for (const user of [ALICE, BOB, ADMIN]) backend.addUser(user);
  backend.db.tables.community_chat = [
    message("m1", BOB, "My layers have stopped laying, any ideas?", minutesAgo(24 * 60 + 30)),
    message("m2", ALICE, "Check the feed, mine did that on poor mash.", minutesAgo(24 * 60 + 20)),
    message("m3", BOB, "Thanks, I changed supplier and they are back.", minutesAgo(3)),
    message("m4", BOB, "Anyone selling day-old kienyeji chicks in Nakuru?", minutesAgo(2))
  ];
  backend.db.tables.message_reactions = [{ id: "r1", message_id: "m1", user_email: BOB.email, user_name: "Bob Otieno", emoji: "👍" }];
  backend.db.tables.community_reports = [];
  backend.db.tables.community_mutes = [];
});

async function openGroup(user, viewport = { width: 360, height: 760 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}/community`, { waitUntil: "domcontentloaded" });
  await session.page.locator(".cm-bubble").first().waitFor();
  return session;
}

const bubble = (page, text) => page.locator(".cm-bubble", { hasText: text });
const row = (page, text) => page.locator(".cm-row", { has: bubble(page, text) });
const sheet = (page) => page.locator('[role="dialog"].cm-sheet');
const chat = () => backend.db.tables.community_chat;
const reactionsOf = (id, email) => backend.db.tables.message_reactions.filter(r => r.message_id === id && (!email || r.user_email === email));

async function sendText(page, text) {
  await page.fill('textarea[aria-label="Message"]', text);
  await page.click('button[aria-label="Send message"]');
}

test("the group reads like a chat: oldest first, a heading per day, my messages on the right", { timeout: 60000 }, async () => {
  const { context, page, errors } = await openGroup(ALICE);
  assert.deepEqual(await page.locator(".cm-day").allInnerTexts(), ["Yesterday", "Today"]);

  const texts = await page.locator(".cm-bubble").allInnerTexts();
  assert.match(texts[0], /stopped laying/);
  assert.match(texts[3], /kienyeji chicks/);

  assert.match(await row(page, "Check the feed").getAttribute("class"), /cm-row--mine/);
  assert.doesNotMatch(await row(page, "stopped laying").getAttribute("class"), /cm-row--mine/);
  assert.match(texts[0], /Bob Otieno/, "other members are named");
  assert.doesNotMatch(texts[3], /Bob Otieno/, "but only on the first of a run of their messages");
  assert.match(await page.locator(".cm-notice").innerText(), /poultry farming only/);
  assert.deepEqual(errors, []);
  await context.close();
});

test("sending a message adds it at the bottom and clears the box", { timeout: 60000 }, async () => {
  const { context, page } = await openGroup(ALICE);
  await sendText(page, "Try Nakuru hatcheries, Bob.");
  await bubble(page, "Try Nakuru hatcheries").waitFor();

  assert.equal(await page.inputValue('textarea[aria-label="Message"]'), "");
  assert.match((await page.locator(".cm-bubble").allInnerTexts()).at(-1), /Try Nakuru hatcheries/);
  const saved = chat().at(-1);
  assert.equal(saved.user_email, ALICE.email);
  assert.equal(saved.user_name, "Test farmer", "the name comes from the server, not the page");
  await context.close();
});

test("replying quotes the message it answers", { timeout: 60000 }, async () => {
  const { context, page } = await openGroup(ALICE);
  await bubble(page, "kienyeji chicks").click();
  await sheet(page).locator("button", { hasText: "Reply" }).click();
  await page.locator(".cm-context", { hasText: "Replying to Bob Otieno" }).waitFor();

  await sendText(page, "I have 200 ready next week.");
  const reply = bubble(page, "I have 200 ready next week.");
  await reply.waitFor();
  assert.match(await reply.locator(".cm-quote").innerText(), /Bob Otieno[\s\S]*kienyeji chicks in Nakuru/);
  assert.equal(chat().at(-1).reply_to_id, "m4");
  assert.equal(await page.locator(".cm-context").count(), 0, "the reply bar closes after sending");
  await context.close();
});

test("a person can react to a message only once", { timeout: 60000 }, async () => {
  const { context, page } = await openGroup(ALICE);
  const target = row(page, "changed supplier");

  await bubble(page, "changed supplier").click();
  await sheet(page).locator('button[aria-label="React with 👍"]').click();
  await target.locator(".cm-reaction", { hasText: "👍 1" }).waitFor();

  // choosing another emoji replaces the first instead of adding a second
  await bubble(page, "changed supplier").click();
  await sheet(page).locator('button[aria-label="React with ❤️"]').click();
  await target.locator(".cm-reaction", { hasText: "❤️ 1" }).waitFor();
  assert.equal(await target.locator(".cm-reaction").count(), 1);
  for (let i = 0; i < 30 && reactionsOf("m3", ALICE.email)[0]?.emoji !== "❤️"; i++) await page.waitForTimeout(100);
  assert.deepEqual(reactionsOf("m3", ALICE.email).map(r => r.emoji), ["❤️"], "one saved reaction");

  // tapping my own reaction takes it away
  await target.locator(".cm-reaction", { hasText: "❤️ 1" }).click();
  await target.locator(".cm-reaction").waitFor({ state: "detached" });
  for (let i = 0; i < 30 && reactionsOf("m3").length; i++) await page.waitForTimeout(100);
  assert.equal(reactionsOf("m3").length, 0);

  // joining someone else's reaction counts both people
  await row(page, "stopped laying").locator(".cm-reaction", { hasText: "👍 1" }).click();
  await row(page, "stopped laying").locator(".cm-reaction", { hasText: "👍 2" }).waitFor();
  await context.close();
});

test("off-topic adverts are refused and the text is kept", { timeout: 60000 }, async () => {
  const { context, page } = await openGroup(ALICE);
  const before = chat().length;
  await sendText(page, "Join my betting group and win big");
  await page.locator('[role="alert"]', { hasText: "poultry farming only" }).waitFor();
  assert.equal(await page.inputValue('textarea[aria-label="Message"]'), "Join my betting group and win big");
  assert.equal(chat().length, before);

  // an honest word that merely contains a blocked one is fine
  await sendText(page, "Which is the better feed, pellets or mash?");
  await bubble(page, "better feed").waitFor();
  await context.close();
});

test("I can delete my own message, and replies to it lose the quote", { timeout: 60000 }, async () => {
  chat().push(message("m5", BOB, "Good tip Alice.", minutesAgo(1), { reply_to_id: "m2", reply_to_user: "Alice Wanjiru", reply_to_message: "Check the feed, mine did that on poor mash." }));
  const { context, page } = await openGroup(ALICE);

  await bubble(page, "Check the feed, mine did that").first().click();
  await sheet(page).locator("button", { hasText: "Delete for everyone" }).click();
  await sheet(page).locator("button", { hasText: "Yes, remove it" }).click();
  await page.locator("text=You deleted this message.").waitFor();

  const removed = chat().find(m => m.id === "m2");
  assert.deepEqual([removed.message, removed.removed_by], ["", "author"]);
  assert.match(await bubble(page, "Good tip Alice").locator(".cm-quote").innerText(), /Message removed/);
  await context.close();
});

test("a member can report someone else's message but not remove it", { timeout: 60000 }, async () => {
  const { context, page } = await openGroup(ALICE);
  await bubble(page, "kienyeji chicks").click();
  assert.equal(await sheet(page).locator("button", { hasText: /Delete|Remove/ }).count(), 0);
  assert.equal(await sheet(page).locator("button", { hasText: /Stop .* posting/ }).count(), 0);

  await sheet(page).locator("button", { hasText: "Report to admins" }).click();
  await sheet(page).locator("button", { hasText: "Spam or a scam" }).click();
  await sheet(page).locator("#cm-report-note").fill("Same advert every day");
  await sheet(page).locator("button", { hasText: "Send report" }).click();
  await sheet(page).waitFor({ state: "detached" });

  const [report] = backend.db.tables.community_reports;
  assert.deepEqual([report.message_id, report.reporter, report.reason], ["m4", ALICE.email, "Spam or a scam: Same advert every day"]);
  await context.close();
});

test("an admin can remove any message and pause its sender", { timeout: 60000 }, async () => {
  const admin = await openGroup(ADMIN);
  await bubble(admin.page, "kienyeji chicks").click();
  await sheet(admin.page).locator("button", { hasText: "Remove message (admin)" }).click();
  await sheet(admin.page).locator("button", { hasText: "Yes, remove it" }).click();
  await admin.page.locator("text=This message was removed by an admin.").waitFor();
  assert.equal(chat().find(m => m.id === "m4").removed_by, "admin");

  await bubble(admin.page, "changed supplier").click();
  await sheet(admin.page).locator("button", { hasText: "posting for 24 hours" }).click();
  await sheet(admin.page).waitFor({ state: "detached" });
  const [mute] = backend.db.tables.community_mutes;
  assert.equal(mute.user_email, BOB.email);
  assert.ok(new Date(mute.muted_until) > new Date(Date.now() + 23 * 3600000));
  await admin.context.close();

  // the paused member can read but not write
  const bob = await openGroup(BOB);
  await bob.page.locator(".cm-muted", { hasText: "paused your posting" }).waitFor();
  assert.equal(await bob.page.locator('textarea[aria-label="Message"]').count(), 0);
  assert.equal(await bubble(bob.page, "stopped laying").count(), 1);
  await bob.context.close();
});

test("a photo can be shared with a message", { timeout: 60000 }, async () => {
  const { context, page } = await openGroup(ALICE);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.setInputFiles('input[type="file"]', { name: "hen.png", mimeType: "image/png", buffer: png });
  await page.locator(".cm-context", { hasText: "Photo attached" }).waitFor();

  await sendText(page, "Is this fowl pox?");
  await bubble(page, "Is this fowl pox?").waitFor();
  const saved = chat().at(-1);
  assert.match(saved.image_url, /community-posts/);
  assert.equal(await bubble(page, "Is this fowl pox?").locator("img.cm-photo").count(), 1);
  assert.equal(await page.locator(".cm-context").count(), 0);
  await context.close();
});

test("older messages load on request, keeping the newest in view first", { timeout: 60000 }, async () => {
  backend.db.tables.community_chat = Array.from({ length: 45 }, (_, i) =>
    message(`old-${i}`, i % 2 ? ALICE : BOB, `Message number ${i + 1}`, minutesAgo(200 - i)));
  const { context, page } = await openGroup(ALICE);

  assert.equal(await page.locator(".cm-bubble").count(), 40);
  assert.match((await page.locator(".cm-bubble").allInnerTexts()).at(-1), /Message number 45/);
  const atBottom = await page.locator(".cm-list").evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 4);
  assert.equal(atBottom, true, "opens at the newest message");

  await page.click('button:has-text("Load earlier messages")');
  await bubble(page, "Message number 1").first().waitFor();
  assert.equal(await page.locator(".cm-bubble").count(), 45);
  assert.equal(await page.locator('button:has-text("Load earlier messages")').count(), 0);
  await context.close();
});

test("the old Messages address opens the group, and the menu has one entry", { timeout: 60000 }, async () => {
  const session = await newUserPage(app.browser, { width: 1280, height: 800 });
  await backend.attach(session.context, { signedInAs: ALICE.email });
  await session.page.goto(`${app.url}/community-chat`, { waitUntil: "domcontentloaded" });
  await session.page.waitForURL(u => u.pathname === "/community");
  await session.page.locator(".cm-bubble").first().waitFor();

  const links = await session.page.locator("aside nav a").allInnerTexts();
  assert.equal(links.filter(t => /Community/.test(t)).length, 1);
  assert.equal(links.filter(t => /Messages/.test(t)).length, 0);
  await session.context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`the group fits the screen and meets the layout rules at ${width}px`, { timeout: 60000 }, async () => {
    chat().push(message("long", BOB, "Averyveryverylongwordwithoutanyspaces".repeat(6), minutesAgo(1)));
    const { context, page } = await openGroup(ALICE, { width, height: 700 });

    const fit = await page.evaluate(() => {
      const composer = document.querySelector(".cm-composer").getBoundingClientRect();
      const page = document.querySelector(".cm-page").getBoundingClientRect();
      return { composerVisible: composer.bottom <= window.innerHeight + 1 && composer.top > 0, inside: page.left >= 0 && page.right <= window.innerWidth };
    });
    assert.equal(fit.composerVisible, true, `the message box is on screen at ${width}px`);
    assert.equal(fit.inside, true);

    let r = await layoutAndA11y(page);
    assert.equal(r.overflow, false, `horizontal scroll at ${width}px`);
    assert.deepEqual(r.small, [], `touch targets under 44px at ${width}px`);
    assert.deepEqual(r.unnamed, [], `controls without a name at ${width}px`);

    // and with the action sheet open
    await bubble(page, "kienyeji chicks").click();
    await sheet(page).waitFor();
    const small = await sheet(page).locator("button").evaluateAll(buttons => buttons.filter(b => b.getBoundingClientRect().height < 44).length);
    assert.equal(small, 0, `sheet buttons under 44px at ${width}px`);
    await context.close();
  });
}

test("an admin works through the review queue from the dashboard", { timeout: 60000 }, async () => {
  backend.db.tables.community_reports = [
    { id: "rep1", message_id: "m4", reporter: ALICE.email, reason: "Spam or a scam", status: "open", created_at: minutesAgo(2) },
    { id: "rep2", message_id: "m4", reporter: "carol@group.test", reason: "Not about poultry", status: "open", created_at: minutesAgo(1) },
    { id: "rep3", message_id: "m1", reporter: ALICE.email, reason: "Something else", status: "open", created_at: minutesAgo(1) }
  ];
  backend.db.tables.community_mutes = [{ user_email: "old@group.test", muted_until: new Date(Date.now() + 86400000).toISOString(), reason: "x" }];
  backend.db.tables.community_blocked_terms = [{ term: "betting", kind: "off_topic" }];

  const session = await newUserPage(app.browser, { width: 360, height: 800 });
  await backend.attach(session.context, { signedInAs: ADMIN.email });
  const { page } = session;
  await page.goto(`${app.url}/admin`, { waitUntil: "domcontentloaded" });
  await page.locator("button", { hasText: /^\s*\d*\s*community$/i }).click();

  // two members reported the same message: one card, both reasons
  await page.locator("text=Reported messages (2)").waitFor();
  const advert = page.locator(".md-card", { hasText: "kienyeji chicks" });
  assert.match(await advert.innerText(), /Not about poultry[\s\S]*Spam or a scam/, "newest report first");

  await page.locator(".md-card", { hasText: "stopped laying" }).locator("button", { hasText: "Keep it" }).click();
  await page.locator("text=Reported messages (1)").waitFor();
  assert.equal(backend.db.tables.community_reports.find(r => r.id === "rep3").status, "dismissed");
  assert.equal(chat().find(m => m.id === "m1").removed_at, null, "the message stays");

  await advert.locator("button", { hasText: "Pause sender 24 hours" }).click();
  await page.locator(".md-row", { hasText: BOB.email }).waitFor();
  await advert.locator("button", { hasText: "Remove message" }).click();
  await page.locator("text=Reported messages (0)").waitFor();
  assert.equal(chat().find(m => m.id === "m4").removed_by, "admin");
  assert.deepEqual(backend.db.tables.community_reports.filter(r => r.message_id === "m4").map(r => r.status), ["removed", "removed"]);

  await page.locator(".md-row", { hasText: "old@group.test" }).locator("button", { hasText: "Let them post now" }).click();
  await page.locator(".md-row", { hasText: "old@group.test" }).waitFor({ state: "detached" });
  assert.deepEqual(backend.db.tables.community_mutes.map(m => m.user_email), [BOB.email]);

  await page.fill("#md-new-term", "  Airdrop ");
  await page.click('.md-add button:has-text("Add")');
  await page.locator(".md-term", { hasText: "airdrop" }).waitFor();
  await page.click('button[aria-label=\'Stop blocking "betting"\']');
  await page.locator(".md-term", { hasText: "betting" }).waitFor({ state: "detached" });
  assert.deepEqual(backend.db.tables.community_blocked_terms.map(t => t.term), ["airdrop"]);

  const review = await page.evaluate(() => {
    const wrap = document.querySelector(".md-wrap");
    const small = [...wrap.querySelectorAll("button, input")].filter(el => el.getBoundingClientRect().height < 44).length;
    const main = document.querySelector(".fc-main");
    return { small, sideways: main.scrollWidth > main.clientWidth + 1 };
  });
  assert.deepEqual(review, { small: 0, sideways: false });
  await session.context.close();
});

test("the review queue is not offered to a member who is not an admin", { timeout: 60000 }, async () => {
  const session = await newUserPage(app.browser);
  await backend.attach(session.context, { signedInAs: ALICE.email });
  await session.page.goto(`${app.url}/admin`, { waitUntil: "domcontentloaded" });
  await session.page.waitForURL(u => u.pathname === "/");
  await session.context.close();
});
