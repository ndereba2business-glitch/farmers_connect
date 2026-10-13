// Unit tests for the landing page's photographs: every one has a licence
// that allows this use, the credit that licence requires, and files on
// disk small enough for a phone on mobile data.
//
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PHOTOS, PHOTO_WIDTHS, photoById } from "../../src/components/landing/photos.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const file = (name) => `${root}public/landing/${name}`;

// Licences that allow use on a commercial product's public page.
const ALLOWED = { "CC0 1.0": false, "CC BY 4.0": true, "CC BY-SA 4.0": true, "CC BY 2.0": true, "CC BY-SA 3.0": true };

test("every photograph has a source, an author, and a licence that allows commercial use", () => {
  assert.ok(PHOTOS.length >= 3);
  assert.equal(new Set(PHOTOS.map(p => p.id)).size, PHOTOS.length, "ids are unique");
  for (const photo of PHOTOS) {
    assert.ok(photo.licence in ALLOWED, `${photo.id}: "${photo.licence}" is not on the list of licences that allow this use`);
    assert.doesNotMatch(photo.licence, /NC|ND/, `${photo.id}: non-commercial and no-derivatives licences cannot be used (the photo is cropped)`);
    assert.match(photo.source, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${photo.id}: the source is its Commons page`);
    assert.match(photo.licenceUrl, /^https:\/\/creativecommons\.org\//, `${photo.id}: the licence links to its text`);
    assert.match(photo.sha1, /^[0-9a-f]{40}$/, `${photo.id}: the exact file is pinned`);
    assert.ok(photo.author.trim(), `${photo.id}: the author is named`);
    assert.ok(photo.changes.trim(), `${photo.id}: says the photo was changed, as the licence asks`);
    assert.ok(photo.alt.length > 20 && !/photo of|image of|picture of/i.test(photo.alt), `${photo.id}: the description says what is in the picture`);
  }
  assert.equal(photoById("kienyeji-hens").author, "Yganyana");
  assert.equal(photoById("nothing"), undefined);
});

test("the credit the licences require is printed on the page", () => {
  const footer = readFileSync(`${root}src/components/landing/LandingFooter.jsx`, "utf8");
  for (const needed of ["PHOTOS.map", "photo.author", "photo.source", "photo.licenceUrl", "photo.licence", "photo.changes"]) {
    assert.ok(footer.includes(needed), `the footer prints ${needed}`);
  }
});

test("each photograph is on disk in every size, and small enough for mobile data", () => {
  const budgets = { 480: 60, 800: 110, 1200: 250 };   // kilobytes
  for (const photo of PHOTOS) {
    for (const width of PHOTO_WIDTHS) {
      const name = `${photo.id}-${width}.webp`;
      assert.ok(existsSync(file(name)), `${name} exists (run node scripts/build-landing-images.mjs)`);
      const kb = statSync(file(name)).size / 1024;
      assert.ok(kb <= budgets[width], `${name} is ${Math.round(kb)} KB, over the ${budgets[width]} KB budget`);
      // RIFF....WEBP
      assert.equal(readFileSync(file(name)).subarray(8, 12).toString("ascii"), "WEBP", `${name} really is a WebP file`);
    }
    assert.ok(existsSync(file(`${photo.id}.jpg`)), `${photo.id}.jpg exists as the fallback`);
    assert.ok(statSync(file(`${photo.id}.jpg`)).size / 1024 <= 150, `${photo.id}.jpg is under 150 KB`);
  }
});

test("nothing is in the photo folder that is not accounted for", () => {
  const expected = new Set(PHOTOS.flatMap(p => [...PHOTO_WIDTHS.map(w => `${p.id}-${w}.webp`), `${p.id}.jpg`]));
  const stray = readdirSync(`${root}public/landing`).filter(name => !expected.has(name));
  assert.deepEqual(stray, [], "every file in public/landing belongs to a photograph with a recorded licence");
});

test("the landing page hot-links no image from another site", () => {
  for (const name of readdirSync(`${root}src/components/landing`).filter(n => /\.(jsx|css)$/.test(n))) {
    const text = readFileSync(`${root}src/components/landing/${name}`, "utf8");
    const remote = [...text.matchAll(/(?:src|srcSet|url)\s*[=(:]\s*["'(]?\s*(https?:\/\/[^"')\s]+)/g)].map(m => m[1]);
    assert.deepEqual(remote, [], `${name} loads an image from another site`);
  }
});
