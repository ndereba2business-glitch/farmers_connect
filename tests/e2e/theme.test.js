// End-to-end checks of the light and dark themes, with the mocked backend:
// no flash of the wrong theme, the control in every role's top bar, where
// the choice is remembered and which source wins, following the phone,
// nothing lost when switching, and readable contrast on every page of
// every role in the dark theme.
//
//   npm run test:e2e
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { newUserPage, startApp } from "./harness.js";
import { MOCK_ANON_KEY, MOCK_SUPABASE_URL, createMockBackend } from "./mockBackend.js";
import { PAGES, THEME_USERS, auditContrast, seedEverything } from "./themeFixtures.js";

let app;
let backend;

before(async () => {
  app = await startApp({ env: { VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: MOCK_ANON_KEY } });
});

after(async () => { await app?.close(); });

beforeEach(() => {
  backend = createMockBackend();
  seedEverything(backend);
});

// system: what the phone itself is set to. saved: what this browser remembers.
async function open(role, path, { system = "light", saved = null, width = 360, height = 800 } = {}) {
  const session = await newUserPage(app.browser, { width, height });
  await session.page.emulateMedia({ colorScheme: system });
  await backend.attach(session.context, role === "visitor" ? {} : { signedInAs: THEME_USERS[role].email });
  if (saved) await session.context.addInitScript(value => { if (!localStorage.getItem("fc-theme")) localStorage.setItem("fc-theme", value); }, saved);
  await session.page.goto(`${app.url}${path}`, { waitUntil: "domcontentloaded" });
  return session;
}

const themeOf = (page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
const toggle = (page) => page.locator("button.fc-theme-toggle");
const profileOf = (role) => backend.db.users.get(THEME_USERS[role].email);

test("the right theme is on the page before the app has loaded, so nothing flashes", { timeout: 60000 }, async () => {
  for (const [system, saved, expected] of [
    ["dark", null, "dark"],       // nothing remembered: follow the phone
    ["light", null, "light"],
    ["light", "dark", "dark"],    // a remembered choice beats the phone
    ["dark", "light", "light"]
  ]) {
    const session = await newUserPage(app.browser, { width: 360, height: 800 });
    await session.page.emulateMedia({ colorScheme: system });
    await backend.attach(session.context);
    if (saved) await session.context.addInitScript(value => localStorage.setItem("fc-theme", value), saved);
    // stop the app's own script from ever running: only index.html has had a say
    await session.context.route("**/src/main.jsx*", route => route.abort());
    await session.page.goto(`${app.url}/login`, { waitUntil: "domcontentloaded" });
    assert.equal(await themeOf(session.page), expected, `phone ${system}, remembered ${saved}`);
    const background = await session.page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    assert.equal(background, expected === "dark" ? "rgb(15, 21, 18)" : "rgb(247, 248, 245)", "the empty page is already the theme's colour");
    await session.context.close();
  }
});

for (const [role, home] of [["farmer", "/"], ["vet", "/vet"], ["supplier", "/supplier"], ["admin", "/admin"]]) {
  test(`a ${role} has the theme button in the top bar, and it switches the whole screen`, { timeout: 60000 }, async () => {
    const { context, page, errors } = await open(role, home);
    const button = toggle(page);
    await button.waitFor();
    assert.equal(await themeOf(page), "light");
    assert.equal(await button.getAttribute("aria-label"), "Switch to dark theme", "it says what it will do");
    const box = await button.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44, "a 44px target");

    const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await button.focus();
    await page.keyboard.press("Enter");
    assert.equal(await themeOf(page), "dark", "works from the keyboard");
    assert.equal(await button.getAttribute("aria-label"), "Switch to light theme");
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), before);
    assert.equal(await page.evaluate(() => localStorage.getItem("fc-theme")), "dark", "remembered in this browser");
    await page.waitForFunction(() => document.querySelector('meta[name="theme-color"]').content === "#0f1512");
    assert.deepEqual(errors, []);
    // the save is not awaited by the button, so give it a moment to land
    for (let i = 0; i < 30 && profileOf(role).themePreference !== "dark"; i++) await page.waitForTimeout(100);
    assert.equal(profileOf(role).themePreference, "dark", "and saved to the account");
    await context.close();
  });
}

test("the choice survives moving between pages and reloading", { timeout: 60000 }, async () => {
  const { context, page } = await open("farmer", "/");
  await toggle(page).click();
  await page.goto(`${app.url}/tasks`, { waitUntil: "domcontentloaded" });
  assert.equal(await themeOf(page), "dark");
  await page.locator('a[href="/my-farm"]').first().click({ force: true }).catch(() => {});
  await page.goto(`${app.url}/community`, { waitUntil: "domcontentloaded" });
  await page.locator(".cm-bubble").first().waitFor();
  assert.equal(await themeOf(page), "dark");
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await themeOf(page), "dark");
  await context.close();
});

test("the account's choice follows the person to a new device and beats that device's own", { timeout: 60000 }, async () => {
  profileOf("vet").themePreference = "dark";
  // a phone set to light, a browser that has never seen this person
  const { context, page } = await open("vet", "/vet", { system: "light" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  assert.equal(await page.evaluate(() => localStorage.getItem("fc-theme")), "dark", "remembered here now, so the next visit does not flash");
  await context.close();

  // and an account that never chose leaves the device alone
  const other = await open("supplier", "/supplier", { system: "dark" });
  await toggle(other.page).waitFor();
  await other.page.waitForTimeout(600);
  assert.equal(await themeOf(other.page), "dark");
  assert.equal(profileOf("supplier").themePreference ?? null, null, "nothing was written without a choice");
  await other.context.close();
});

test("with no choice made, the app follows the phone when it changes", { timeout: 60000 }, async () => {
  const { context, page } = await open("farmer", "/", { system: "light" });
  await toggle(page).waitFor();
  assert.equal(await themeOf(page), "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");

  // once the person has chosen, the phone no longer decides
  await toggle(page).click();
  assert.equal(await themeOf(page), "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(300);
  assert.equal(await themeOf(page), "dark");
  await context.close();
});

test("the profile offers light, dark and match my phone", { timeout: 60000 }, async () => {
  const { context, page } = await open("farmer", "/profile", { system: "dark", saved: "light" });
  const group = page.locator('[role="radiogroup"]', { has: page.locator("text=Match my phone") });
  await group.waitFor();
  const checked = () => group.locator('[role="radio"][aria-checked="true"]').innerText();
  assert.equal((await checked()).trim(), "Light");
  assert.equal(await themeOf(page), "light");

  await group.locator('[role="radio"]', { hasText: "Dark" }).click();
  assert.equal(await themeOf(page), "dark");
  assert.equal((await checked()).trim(), "Dark");

  await group.locator('[role="radio"]', { hasText: "Match my phone" }).click();
  assert.equal(await themeOf(page), "dark", "the phone is dark");
  assert.equal(await page.evaluate(() => localStorage.getItem("fc-theme")), null, "nothing is pinned");
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light");
  for (const radio of await group.locator('[role="radio"]').all()) assert.ok((await radio.boundingBox()).height >= 44);
  for (let i = 0; i < 30 && profileOf("farmer").themePreference !== "system"; i++) await page.waitForTimeout(100);
  assert.equal(profileOf("farmer").themePreference, "system");
  await context.close();
});

test("switching theme loses nothing that was typed or loaded", { timeout: 60000 }, async () => {
  const { context, page } = await open("farmer", "/clucky");
  const box = page.locator('textarea[aria-label="Ask Clucky a question"]');
  await page.locator(".ck-bubble").first().waitFor();
  await box.fill("How warm should a brooder be in week one?");
  const bubbles = await page.locator(".ck-bubble").count();
  await toggle(page).click();
  assert.equal(await themeOf(page), "dark");
  assert.equal(await box.inputValue(), "How warm should a brooder be in week one?");
  assert.equal(await page.locator(".ck-bubble").count(), bubbles, "the conversation is still there");
  assert.equal(new URL(page.url()).pathname, "/clucky", "and so is the page");
  await context.close();

  // An open dialog and its half-filled form stay put too. (A different
  // account: the farmer's choice of dark above is now saved on theirs.)
  const profile = await open("vet", "/profile");
  await profile.page.locator("#delete-account button", { hasText: "Delete my account" }).click();
  const dialog = profile.page.locator('[role="dialog"]', { hasText: "Delete your account for good?" });
  await dialog.locator("input").first().fill("DEL");
  await profile.page.evaluate(() => document.querySelector(".fc-theme-toggle").click());
  await profile.page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark");
  assert.equal(await dialog.locator("input").first().inputValue(), "DEL");
  await profile.context.close();
});

test("signed-out pages follow the phone, and the public policy pages have the button too", { timeout: 60000 }, async () => {
  const { context, page } = await open("visitor", "/login", { system: "dark" });
  await page.locator('input[type="email"]').waitFor();
  assert.equal(await themeOf(page), "dark");
  await page.goto(`${app.url}/delete-account`, { waitUntil: "domcontentloaded" });
  await toggle(page).waitFor();
  await toggle(page).click();
  assert.equal(await themeOf(page), "light");
  assert.equal(await page.evaluate(() => localStorage.getItem("fc-theme")), "light");
  await context.close();
});

for (const theme of ["dark", "light"]) for (const role of Object.keys(PAGES)) {
  test(`every ${role} page is readable in the ${theme} theme (WCAG AA contrast)`, { timeout: 240000 }, async () => {
    const { context, page } = await open(role, PAGES[role][0], { saved: theme });
    for (const route of PAGES[role]) {
      await page.goto(`${app.url}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      assert.equal(await themeOf(page), theme);
      const failures = await page.evaluate(auditContrast);
      assert.deepEqual(failures, [], `${route} (${theme}): text below 4.5:1 (3:1 for large text) against what is behind it`);
      if (theme === "light") continue;
      // nothing is left white: no large surface keeps a light background
      const glaring = await page.evaluate(() => [...document.querySelectorAll("main *, aside *, header *, nav *")]
        .filter(el => {
          const r = el.getBoundingClientRect();
          if (r.width < 120 || r.height < 60) return false;
          const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(getComputedStyle(el).backgroundColor);
          return m && (m[4] === undefined || Number(m[4]) > 0.9) && Number(m[1]) > 225 && Number(m[2]) > 225 && Number(m[3]) > 225;
        })
        .map(el => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 30)}`));
      assert.deepEqual(glaring, [], `${route}: a surface is still light in the dark theme`);
    }
    await context.close();
  });
}

for (const width of [320, 360, 390, 1280]) {
  test(`the top bar still fits with the theme button at ${width}px, in both themes`, { timeout: 120000 }, async () => {
    for (const saved of ["light", "dark"]) {
      for (const [role, route] of [["farmer", "/"], ["supplier", "/supplier"], ["vet", "/vet"]]) {
        const { context, page } = await open(role, route, { saved, width });
        const button = toggle(page);
        await button.waitFor();
        const box = await button.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width, `${role}@${width} ${saved}: the theme button is inside the screen`);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false,
          `${role}@${width} ${saved}: horizontal scroll`);
        const bell = await page.locator(".nb-button, [aria-label*='otification']").first().boundingBox();
        if (bell) assert.ok(bell.x + bell.width <= width && (bell.x >= box.x + box.width - 1 || bell.x + bell.width <= box.x + 1), `${role}@${width}: the bell and the theme button do not overlap`);
        await context.close();
      }
    }
  });
}
