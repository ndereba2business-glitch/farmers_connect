// End-to-end checks that a save which does not reach the database is said
// out loud, keeps what the farmer typed, and announces nothing that did not
// happen. Before, these saves ignored the error: the form emptied, a "task
// added" notice appeared, and the task did not exist.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

const FARMER = { email: "farmer@saves.test", password: "kuku-yangu-2026", role: "farmer" };

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  backend.addUser(FARMER);
  backend.db.tables.farm_tasks = [];
  backend.db.tables.vet_questions = [];
  backend.db.tables.notifications = [];
});

async function open(path) {
  const session = await newUserPage(app.browser, { width: 360, height: 800 });
  await backend.attach(session.context, { signedInAs: FARMER.email });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

test("a task that was not saved says so, keeps the form, and sends no 'task added' notice", { timeout: 60000 }, async () => {
  const { context, page } = await open("/tasks");
  await page.locator("button", { hasText: "Add Task" }).first().click();
  await page.fill('input[placeholder="What needs to be done?"]', "Clean the drinkers");

  backend.db.failingWrites.add("farm_tasks");
  await page.locator("button", { hasText: "Add Task" }).last().click();
  await page.locator("text=The task was not saved").waitFor();
  assert.equal(await page.inputValue('input[placeholder="What needs to be done?"]'), "Clean the drinkers", "what was typed stays");
  assert.equal(backend.db.tables.farm_tasks.length, 0);
  assert.equal(backend.db.tables.notifications.filter(n => /Task Added/i.test(n.title || "")).length, 0, "no notice for a task that does not exist");

  // the same button works once the connection is back
  backend.db.failingWrites.clear();
  await page.locator("button", { hasText: "Add Task" }).last().click();
  await page.locator("text=Clean the drinkers").first().waitFor();
  assert.equal(backend.db.tables.farm_tasks.length, 1);
  await context.close();
});

test("a question to a vet that was not sent says so and keeps the question", { timeout: 60000 }, async () => {
  const { context, page } = await open("/bookings");
  const box = page.locator('textarea[aria-label="Describe the problem"]').first();
  await box.fill("Three birds are coughing and not eating since yesterday.");

  backend.db.failingWrites.add("vet_questions");
  await page.locator("button", { hasText: /^Submit$/ }).click();
  await page.locator("text=Your question was not sent").waitFor();
  assert.equal(await box.inputValue(), "Three birds are coughing and not eating since yesterday.");
  assert.equal(await page.locator("button", { hasText: "Submitted!" }).count(), 0, "no false 'Submitted'");

  backend.db.failingWrites.clear();
  await page.locator("button", { hasText: /^Submit$/ }).click();
  await page.locator("button", { hasText: "Submitted!" }).waitFor();
  assert.equal(backend.db.tables.vet_questions.length, 1);
  assert.equal(await box.inputValue(), "");
  await context.close();
});
