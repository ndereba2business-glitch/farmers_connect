// End-to-end tests of the Clucky AI screen with the mocked backend, which
// stands in for the "clucky" edge function and sends events in the same
// shape. The real function needs an Anthropic API key and is exercised
// by hand after deployment; what it tells the model is unit tested in
// tests/unit/clucky.test.js.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { layoutAndA11y } from "./checks.js";

const FARMER = { email: "farmer@clucky.test", role: "farmer" };
const OTHER = { email: "other@clucky.test", role: "farmer" };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  backend.addUser(FARMER);
  backend.addUser(OTHER);
  backend.db.tables.clucky_messages = [];
});

async function openClucky(viewport = { width: 360, height: 760 }, user = FARMER) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}/clucky`, { waitUntil: "domcontentloaded" });
  await session.page.locator('textarea[aria-label="Ask Clucky a question"]').waitFor();
  return session;
}

const box = (page) => page.locator('textarea[aria-label="Ask Clucky a question"]');
const bubbles = (page) => page.locator(".ck-bubble");

async function askQuestion(page, text) {
  await box(page).fill(text);
  await page.click('button[aria-label="Send question"]');
}

test("a question gets an answer, written out as it arrives", { timeout: 60000 }, async () => {
  backend.db.clucky.reply = "Check the brooder temperature first.\n- Chicks huddling together are cold\n- Chicks far from the heat are too hot";
  const { context, page, errors } = await openClucky();
  await page.locator("text=Hello Test, I'm Clucky").waitFor();

  await askQuestion(page, "My chicks are noisy at night");
  await bubbles(page).nth(1).locator("text=Check the brooder temperature first.").waitFor();

  const [question, answer] = await bubbles(page).allInnerTexts();
  assert.equal(question, "My chicks are noisy at night");
  assert.equal(answer, backend.db.clucky.reply, "line breaks and list dashes are kept");
  assert.doesNotMatch(answer, /discarded draft/, "text from a model that handed over is thrown away");
  assert.equal(await box(page).inputValue(), "");
  assert.deepEqual(backend.db.clucky.asked, [{ user: FARMER.email, message: "My chicks are noisy at night" }]);
  assert.equal(await page.locator(".ck-welcome").count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test("a suggested question can be asked with one tap", { timeout: 60000 }, async () => {
  const { context, page } = await openClucky();
  await page.locator(".ck-suggestion", { hasText: "Newcastle disease" }).click();
  await bubbles(page).nth(1).locator("text=clean water").waitFor();
  assert.match(backend.db.clucky.asked[0].message, /Newcastle disease/);
  await context.close();
});

test("the conversation is still there after a reload, and only mine", { timeout: 60000 }, async () => {
  backend.db.tables.clucky_messages = [
    { id: "a", user_email: FARMER.email, role: "user", content: "How much water do layers need?", created_at: "2026-10-08T08:00:00Z" },
    { id: "b", user_email: FARMER.email, role: "assistant", content: "About twice the weight of their feed.", created_at: "2026-10-08T08:00:05Z" },
    { id: "c", user_email: OTHER.email, role: "user", content: "Someone else's question", created_at: "2026-10-08T09:00:00Z" }
  ];
  const { context, page } = await openClucky();
  await bubbles(page).first().waitFor();
  assert.deepEqual(await bubbles(page).allInnerTexts(), ["How much water do layers need?", "About twice the weight of their feed."]);
  assert.match(await page.locator(".ck-row").first().getAttribute("class"), /ck-row--me/);
  await context.close();
});

test("New chat clears my conversation after asking first", { timeout: 60000 }, async () => {
  backend.db.tables.clucky_messages = [
    { id: "a", user_email: FARMER.email, role: "user", content: "Old question", created_at: "2026-10-08T08:00:00Z" },
    { id: "c", user_email: OTHER.email, role: "user", content: "Not mine", created_at: "2026-10-08T09:00:00Z" }
  ];
  const { context, page } = await openClucky();
  await bubbles(page).first().waitFor();

  await page.click('button:has-text("New chat")');
  await page.click('button:has-text("Keep it")');
  assert.equal(await bubbles(page).count(), 1, "nothing is cleared without confirming");

  await page.click('button:has-text("New chat")');
  await page.click('button:has-text("Yes, clear it")');
  await page.locator(".ck-welcome").waitFor();
  assert.deepEqual(backend.db.tables.clucky_messages.map(m => m.id), ["c"], "someone else's conversation is untouched");
  await context.close();
});

for (const [mode, expected] of [
  ["not_configured", /isn't switched on yet/],
  ["daily_limit", /limit of 30 questions[\s\S]*Ask Vet/],
  ["declined", /couldn't answer that one/],
  ["busy", /busy right now/]
]) {
  test(`when Clucky reports "${mode}", it says so and the question is kept`, { timeout: 60000 }, async () => {
    backend.db.clucky.mode = mode;
    const { context, page } = await openClucky();
    await askQuestion(page, "Why are my broilers limping?");
    await page.locator('.ck-error[role="alert"]', { hasText: expected }).waitFor();

    assert.equal(await box(page).inputValue(), "Why are my broilers limping?", "the question goes back in the box");
    assert.equal(await bubbles(page).count(), 0, "no half-finished exchange is left on screen");
    assert.equal(backend.db.tables.clucky_messages.length, 0);

    // and once it works again, the same question goes through
    backend.db.clucky.mode = "answer";
    await page.click('button[aria-label="Send question"]');
    await bubbles(page).nth(1).locator("text=clean water").waitFor();
    assert.equal(await page.locator(".ck-error").count(), 0);
    await context.close();
  });
}

test("an answer cut off by a dropped connection is kept and flagged", { timeout: 60000 }, async () => {
  backend.db.clucky.mode = "cut_off";
  const { context, page } = await openClucky();
  await askQuestion(page, "How do I brood chicks?");
  await page.locator(".ck-note", { hasText: "may be incomplete" }).waitFor();
  assert.match(await bubbles(page).nth(1).innerText(), /clean water/);
  await context.close();
});

test("a question that is too long is stopped before it is sent", { timeout: 60000 }, async () => {
  const { context, page } = await openClucky();
  await box(page).fill("x".repeat(1510));
  await page.locator('.ck-error[role="alert"]', { hasText: "10 characters too long" }).waitFor();
  assert.equal(await page.locator('button[aria-label="Send question"]').isDisabled(), true);
  assert.equal(backend.db.clucky.asked.length, 0);
  await context.close();
});

test("the question is sent with my sign-in, never an API key", { timeout: 60000 }, async () => {
  const { context, page } = await openClucky();
  const seen = [];
  page.on("request", r => { if (r.url().includes("/functions/v1/clucky") && r.method() === "POST") seen.push(r.headers()); });
  await askQuestion(page, "Hello");
  await bubbles(page).nth(1).locator("text=clean water").waitFor();

  assert.equal(seen.length, 1);
  assert.match(seen[0].authorization, /^Bearer .+\..+\..+/, "the user's own session token");
  assert.equal(seen[0]["x-api-key"], undefined);
  const html = await page.content();
  assert.doesNotMatch(html, /sk-ant-/);
  await context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`Clucky fits the screen and meets the layout rules at ${width}px`, { timeout: 60000 }, async () => {
    backend.db.clucky.reply = "Averyveryverylongwordwithoutanyspaces".repeat(5) + " and then a normal sentence about feed and water.";
    const { context, page } = await openClucky({ width, height: 700 });

    let r = await layoutAndA11y(page);
    assert.equal(r.overflow, false, `welcome: horizontal scroll at ${width}px`);
    assert.deepEqual(r.small, [], `welcome: touch targets under 44px at ${width}px`);
    assert.deepEqual(r.unnamed, [], `welcome: controls without a name at ${width}px`);

    await askQuestion(page, "A question");
    await bubbles(page).nth(1).locator("text=normal sentence").waitFor();

    const fit = await page.evaluate(() => {
      const composer = document.querySelector(".ck-composer").getBoundingClientRect();
      const frame = document.querySelector(".ck-page").getBoundingClientRect();
      return { composerVisible: composer.top > 0 && composer.bottom <= window.innerHeight + 1, inside: frame.left >= 0 && frame.right <= window.innerWidth };
    });
    assert.deepEqual(fit, { composerVisible: true, inside: true }, `chat at ${width}px`);

    r = await layoutAndA11y(page);
    assert.equal(r.overflow, false, `chat: horizontal scroll at ${width}px`);
    assert.deepEqual(r.small, [], `chat: touch targets under 44px at ${width}px`);
    assert.deepEqual(r.unnamed, [], `chat: controls without a name at ${width}px`);
    await context.close();
  });
}
