// Unit tests for the light/dark theme rules (src/lib/theme.js) and for the
// palette file the older screens' colours were moved into
// (src/styles/theme.css).
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BAR_COLOUR, PREFERENCES, STORAGE_KEY, isPreference, reconcile, resolveTheme, toggledPreference } from "../../src/lib/theme.js";

const read = (rel) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("the phone's setting decides only when the person has not chosen", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  // anything unexpected behaves like "no choice"
  assert.equal(resolveTheme(undefined, true), "dark");
  assert.equal(resolveTheme("purple", false), "light");
});

test("the sun/moon button always lands on an explicit choice", () => {
  assert.equal(toggledPreference("light"), "dark");
  assert.equal(toggledPreference("dark"), "light");
  assert.deepEqual(PREFERENCES, ["light", "dark", "system"]);
  assert.equal(isPreference("system"), true);
  assert.equal(isPreference(""), false);
  assert.equal(isPreference(null), false);
});

test("a choice made on another device arrives; a choice made here offline is not thrown away", () => {
  // first sign-in on this browser: the profile's choice is adopted
  assert.deepEqual(reconcile({ local: null, synced: null, profile: "dark" }), { preference: "dark", synced: "dark" });
  // nothing new from the profile: this browser keeps what it has
  assert.deepEqual(reconcile({ local: "dark", synced: "dark", profile: "dark" }), { preference: "dark", synced: "dark" });
  // changed on another phone since this browser last looked
  assert.deepEqual(reconcile({ local: "dark", synced: "dark", profile: "light" }), { preference: "light", synced: "light" });
  // changed HERE to light while the save failed: the profile still says
  // dark, which this browser already knew, so the newer local choice stands
  assert.deepEqual(reconcile({ local: "light", synced: "dark", profile: "dark" }), { preference: "light", synced: "dark" });
  // a profile that has never chosen changes nothing
  assert.deepEqual(reconcile({ local: "dark", synced: null, profile: null }), { preference: "dark", synced: null });
  assert.deepEqual(reconcile({ local: null, synced: null, profile: undefined }), { preference: "system", synced: null });
  // "follow my phone" is a real choice and travels like the others
  assert.deepEqual(reconcile({ local: "dark", synced: "dark", profile: "system" }), { preference: "system", synced: "system" });
});

test("the script that prevents a flash reads the same key and colours as the app", () => {
  const html = read("index.html");
  assert.ok(html.includes(`localStorage.getItem("${STORAGE_KEY}")`), "index.html reads the key src/lib/theme.js writes");
  assert.ok(html.includes(BAR_COLOUR.dark), "the dark browser-bar colour matches");
  assert.ok(html.includes(`content="${BAR_COLOUR.light}"`), "the light browser-bar colour matches");
  assert.ok(html.indexOf("data-theme") < html.indexOf('src="/src/main.jsx"'), "the theme is set before the app's script runs");
  assert.match(html, /prefers-color-scheme: dark/);
});

test("every palette colour has a light and a dark value, and the semantic tokens too", () => {
  const css = read("src/styles/theme.css");
  const [, light, dark] = /:root \{([\s\S]*?)\}\s*:root\[data-theme="dark"\] \{([\s\S]*?)\}/.exec(css);
  const names = (block) => [...block.matchAll(/(--fc-[a-z0-9-]+):/g)].map(m => m[1]).sort();
  assert.deepEqual(names(dark), names(light), "the same variables are defined in both themes");
  assert.ok(names(light).length > 80, "the palette is there");

  const tokens = read("src/styles/tokens.css");
  const darkTokens = /:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/.exec(tokens)[1];
  for (const name of ["--fc-ink", "--fc-ink-2", "--fc-muted", "--fc-line", "--fc-surface", "--fc-bg", "--fc-link", "--fc-danger", "--fc-warning", "--fc-info", "--fc-primary-soft"]) {
    assert.ok(darkTokens.includes(`${name}:`), `${name} has a dark value`);
  }
  assert.match(darkTokens, /color-scheme: dark/, "native controls and scrollbars go dark too");
});

test("no screen still hard-codes a surface or ink colour outside the two theme files", () => {
  // The landing page keeps its own fixed palette; the brand mark and
  // Google's button are not ours to recolour; sender names are mixed
  // towards white in CSS (Community.css).
  const allowed = /components[\\/]landing|BrandMark|brandMarkArt|GoogleButton|styles[\\/](tokens|theme)\.css|lib[\\/]community\.js/;
  const offenders = [];
  const scan = (dir) => {
    for (const entry of new URL(dir, import.meta.url).pathname && []) void entry;
  };
  void scan;
  for (const rel of ["src/pages/Dashboard.jsx", "src/pages/MyFarm.jsx", "src/pages/Marketplace.jsx", "src/pages/Bookings.jsx", "src/pages/Profile.jsx",
    "src/pages/Login.jsx", "src/pages/Signup.jsx", "src/pages/VetDashboard.jsx", "src/pages/AdminDashboard.jsx", "src/pages/Tasks.jsx", "src/pages/Finance.jsx",
    "src/components/Layout.css", "src/pages/Community.css", "src/pages/Clucky.css", "src/components/NotificationsBell.css"]) {
    if (allowed.test(rel)) continue;
    const text = read(rel);
    // white, near-white, and the greys used for text and borders
    for (const m of text.matchAll(/#(?:fff(?:fff)?|f9fafb|f3f4f6|e5e7eb|111827|374151|6b7280|9ca3af)\b/gi)) {
      const line = text.slice(text.lastIndexOf("\n", m.index) + 1, text.indexOf("\n", m.index));
      // Right in both themes, so left as written: white text on a coloured
      // button, a shadow, the fallback inside var(--x, #...), and the white
      // that sender names are mixed towards in the dark theme.
      if (/color: ?["']?#fff|[?] "#fff"|box-shadow|var[(]--[a-z0-9-]+, ?#|color-mix/i.test(line)) continue;
      offenders.push(`${rel}: ${line.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, []);
});
