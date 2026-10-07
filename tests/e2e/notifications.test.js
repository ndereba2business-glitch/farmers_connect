// End-to-end tests of the notification bell and the settings on the
// profile page, with the mocked backend. Which events create a
// notification, and that preferences are enforced, is checked against the
// real database by npm run test:security.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";

const FARMER = { email: "farmer@bell.test", role: "farmer" };
const VET = { email: "vet@bell.test", role: "vet" };
const SUPPLIER = { email: "supplier@bell.test", role: "supplier" };

const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  for (const user of [FARMER, VET, SUPPLIER]) backend.addUser(user);
  backend.db.tables.notification_preferences = [];
  backend.db.tables.notifications = [
    { id: "n1", user_email: FARMER.email, type: "vaccination", category: "vaccinations", title: "2 vaccinations are overdue", message: "Newcastle (Batch A), Gumboro (Batch A).", link: "/my-farm", read: false, cleared_at: null, created_at: minutesAgo(5) },
    { id: "n2", user_email: FARMER.email, type: "vet", category: "vet", title: "A vet answered your question", message: "Isolate the sick birds.", link: "/bookings", read: false, cleared_at: null, created_at: minutesAgo(90) },
    { id: "n3", user_email: FARMER.email, type: "community", category: "community", title: "Bob replied to you", message: "Thanks!", link: "/community", read: true, cleared_at: null, created_at: minutesAgo(3000) },
    { id: "n4", user_email: FARMER.email, type: "task", category: "farm", title: "Old and cleared", message: "", link: null, read: true, cleared_at: minutesAgo(10), created_at: minutesAgo(5000) },
    { id: "n5", user_email: VET.email, type: "appointment", category: "vet", title: "New visit request", message: "For the vet only.", link: "/appointments", read: false, cleared_at: null, created_at: minutesAgo(1) }
  ];
});

async function open(user, path, viewport = { width: 360, height: 760 }) {
  const session = await newUserPage(app.browser, viewport);
  await backend.attach(session.context, { signedInAs: user.email });
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

const bell = (page) => page.locator("button.nb-btn");
const panel = (page) => page.locator('[role="dialog"].nb-panel');
const stored = (id) => backend.db.tables.notifications.find(n => n.id === id);

test("the bell is visible on the farmer's screen and counts what is new", { timeout: 60000 }, async () => {
  const { context, page, errors } = await open(FARMER, "/tasks");
  await page.locator(".nb-count", { hasText: "2" }).waitFor();
  assert.equal(await bell(page).getAttribute("aria-label"), "Notifications, 2 new");

  // it used to be a white icon on a white bar
  const look = await bell(page).evaluate(el => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return { background: style.backgroundColor, colour: style.color, width: box.width, height: box.height };
  });
  assert.notEqual(look.background, look.colour, "the icon contrasts with its tile");
  assert.notEqual(look.background, "rgba(0, 0, 0, 0)");
  assert.ok(look.width >= 44 && look.height >= 44);

  assert.deepEqual(backend.db.rpcCalls.filter(c => c.name === "sync_my_reminders").map(c => c.user), [FARMER.email],
    "reminders are worked out once when the app opens");
  assert.deepEqual(errors, []);
  await context.close();
});

test("opening the bell lists my notifications, newest first, and marks them read", { timeout: 60000 }, async () => {
  const { context, page } = await open(FARMER, "/tasks");
  await page.locator(".nb-count").waitFor();
  await bell(page).click();
  await panel(page).waitFor();

  const titles = await panel(page).locator(".nb-item-title").allInnerTexts();
  assert.deepEqual(titles, ["2 vaccinations are overdue", "A vet answered your question", "Bob replied to you"],
    "cleared ones and other people's are not listed");
  assert.match(await panel(page).locator(".nb-item").first().innerText(), /5 min ago · new/);
  assert.equal(await panel(page).locator(".nb-item--new").count(), 2, "what was unread stays highlighted while open");

  await page.locator(".nb-count").waitFor({ state: "detached" });
  for (let i = 0; i < 30 && !stored("n1").read; i++) await page.waitForTimeout(100);
  assert.deepEqual([stored("n1").read, stored("n2").read], [true, true]);
  assert.equal(stored("n5").read, false, "another person's notification is untouched");

  await page.keyboard.press("Escape");
  await panel(page).waitFor({ state: "detached" });
  await context.close();
});

test("tapping a notification goes to what it is about", { timeout: 60000 }, async () => {
  const { context, page } = await open(FARMER, "/tasks");
  await page.locator(".nb-count").waitFor();
  await bell(page).click();
  await panel(page).locator(".nb-item", { hasText: "A vet answered" }).click();
  await page.waitForURL(u => u.pathname === "/bookings");
  assert.equal(await panel(page).count(), 0);
  await context.close();
});

test("Clear all empties the list without deleting the records", { timeout: 60000 }, async () => {
  const { context, page } = await open(FARMER, "/tasks");
  await page.locator(".nb-count").waitFor();
  await bell(page).click();
  await panel(page).locator("button", { hasText: "Clear all" }).click();
  await panel(page).locator("text=You're all caught up").waitFor();

  for (let i = 0; i < 30 && !stored("n3").cleared_at; i++) await page.waitForTimeout(100);
  assert.ok(stored("n1").cleared_at && stored("n2").cleared_at && stored("n3").cleared_at);
  assert.equal(backend.db.tables.notifications.length, 5, "nothing was deleted");
  assert.equal(stored("n5").cleared_at, null);

  await page.reload({ waitUntil: "domcontentloaded" });
  await bell(page).waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.locator(".nb-count").count(), 0);
  await context.close();
});

test("a farmer chooses which notifications to get, and each switch saves at once", { timeout: 60000 }, async () => {
  const { context, page } = await open(FARMER, "/profile");
  const card = page.locator("#notifications");
  await card.locator("#ns-community").waitFor();

  assert.deepEqual(await card.locator(".ns-row-label").allInnerTexts(),
    ["Allow notifications", "Vaccination reminders", "Farm tasks and records", "Vet visits and answers", "Marketplace", "Community", "Clucky AI"]);
  assert.equal(await card.locator("#ns-community").isChecked(), true, "everything is on until changed");

  await card.locator("label", { hasText: "Community" }).click();
  assert.equal(await card.locator("#ns-community").isChecked(), false);
  for (let i = 0; i < 30 && !backend.db.tables.notification_preferences.length; i++) await page.waitForTimeout(100);
  const [saved] = backend.db.tables.notification_preferences;
  assert.deepEqual([saved.user_email, saved.community], [FARMER.email, false]);

  await card.locator("label", { hasText: "Clucky AI" }).click();
  for (let i = 0; i < 30 && backend.db.tables.notification_preferences[0].clucky !== false; i++) await page.waitForTimeout(100);
  assert.equal(backend.db.tables.notification_preferences.length, 1, "one row per person");
  assert.deepEqual([saved.community, saved.clucky], [false, false]);

  // the choices are still there after a reload
  await page.reload({ waitUntil: "domcontentloaded" });
  await card.locator("#ns-community").waitFor();
  await page.waitForFunction(() => !document.querySelector("#ns-vet").disabled);
  assert.deepEqual([await card.locator("#ns-community").isChecked(), await card.locator("#ns-vet").isChecked()], [false, true]);
  await context.close();
});

test("turning notifications off switches every category off with it", { timeout: 60000 }, async () => {
  const { context, page } = await open(FARMER, "/profile");
  const card = page.locator("#notifications");
  await page.waitForFunction(() => document.querySelector("#ns-master") && !document.querySelector("#ns-master").disabled);

  await card.locator("label", { hasText: "Allow notifications" }).click();
  await page.waitForFunction(() => document.querySelector("#ns-vaccinations").disabled);
  assert.equal(await card.locator("#ns-vaccinations").isChecked(), false);
  const user = backend.db.users.get(FARMER.email);
  for (let i = 0; i < 30 && user.notificationsEnabled; i++) await page.waitForTimeout(100);
  assert.equal(user.notificationsEnabled, false);

  await card.locator("label", { hasText: "Allow notifications" }).click();
  await page.waitForFunction(() => !document.querySelector("#ns-vaccinations").disabled);
  assert.equal(await card.locator("#ns-vaccinations").isChecked(), true, "earlier choices come back");
  await context.close();
});

test("vets and suppliers see only the switches for their side of the app", { timeout: 60000 }, async () => {
  const vet = await open(VET, "/profile");
  await vet.page.locator("#ns-vet").waitFor();
  assert.deepEqual(await vet.page.locator("#notifications .ns-row-label").allInnerTexts(),
    ["Allow notifications", "Vet visits and answers", "Community"]);
  await vet.context.close();

  const supplier = await open(SUPPLIER, "/profile");
  await supplier.page.locator("#ns-marketplace").waitFor();
  assert.deepEqual(await supplier.page.locator("#notifications .ns-row-label").allInnerTexts(),
    ["Allow notifications", "Marketplace", "Community"]);
  assert.match(await supplier.page.locator("#notifications").innerText(), /A farmer contacts you about a product/);
  await bellVisible(supplier.page);
  await supplier.context.close();
});

async function bellVisible(page) {
  const box = await bell(page).boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44, "the bell has a 44px touch target");
}

test("the link in the bell opens the settings", { timeout: 60000 }, async () => {
  const { context, page } = await open(FARMER, "/tasks", { width: 360, height: 640 });
  await page.locator(".nb-count").waitFor();
  await bell(page).click();
  await panel(page).locator("a", { hasText: "Choose which notifications you get" }).click();
  await page.waitForURL(u => u.pathname === "/profile" && u.hash === "#notifications");
  await page.locator("#ns-community").waitFor();
  await context.close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`the bell panel and the settings fit the screen at ${width}px`, { timeout: 60000 }, async () => {
    const { context, page } = await open(FARMER, "/profile", { width, height: 720 });
    await page.locator("#ns-community").waitFor();
    await page.locator(".nb-count").waitFor();

    const settings = await page.evaluate(() => {
      const card = document.querySelector("#notifications").getBoundingClientRect();
      const small = [...document.querySelectorAll("#notifications input")].filter(el => el.getBoundingClientRect().height < 44).length;
      const unnamed = [...document.querySelectorAll("#notifications input")].filter(el => !el.labels?.length).length;
      return { inside: card.left >= 0 && card.right <= window.innerWidth, small, unnamed };
    });
    assert.deepEqual(settings, { inside: true, small: 0, unnamed: 0 }, `settings at ${width}px`);

    await bell(page).click();
    await panel(page).waitFor();
    const shown = await page.evaluate(() => {
      const box = document.querySelector(".nb-panel").getBoundingClientRect();
      const small = [...document.querySelectorAll(".nb-panel button, .nb-panel a")].filter(el => el.getBoundingClientRect().height < 44).length;
      return {
        inside: box.left >= 0 && box.right <= window.innerWidth && box.top >= 0 && box.bottom <= window.innerHeight,
        small,
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1
      };
    });
    assert.deepEqual(shown, { inside: true, small: 0, sideways: false }, `bell panel at ${width}px`);
    await context.close();
  });
}
