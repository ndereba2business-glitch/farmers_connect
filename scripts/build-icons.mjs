// Regenerates the app icons from the brand mark.
//
//   node scripts/build-icons.mjs
//
// The mark's artwork lives in three places that must match: this file,
// src/components/BrandMark.jsx and public/favicon.svg (written here). Run
// this after changing it. It uses the Playwright browser already installed
// for the end-to-end tests, so there is no extra dependency.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const GREEN = "#14532d";
const MARK = `
  <rect x="17" y="14" width="9" height="36" rx="4.5" fill="#f7f5ec"/>
  <path d="M21 14 H47 C45 20 38.5 23.5 30 23.5 H21 Z" fill="#f7f5ec"/>
  <path d="M21 29 H35 C34 34.5 30 38 25.5 38 H21 Z" fill="#f7f5ec"/>
  <ellipse cx="44.5" cy="35" rx="4.6" ry="5.8" fill="#f2b01e"/>`;

// Rounded tile: browser tabs and desktop shortcuts.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${GREEN}"/>${MARK}</svg>`;
// Full-bleed square: iOS rounds the corners itself.
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${GREEN}"/>${MARK}</svg>`;
// Maskable: Android crops to a circle or squircle, so the mark sits inside
// the central 70% "safe zone".
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${GREEN}"/><g transform="translate(32 32) scale(0.7) translate(-32 -32)">${MARK}</g></svg>`;

mkdirSync(`${root}public/icons`, { recursive: true });
writeFileSync(`${root}public/favicon.svg`, tile + "\n");

const browser = await chromium.launch();
async function png(svg, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg}</div></body>`);
  await page.screenshot({ path: `${root}public/${file}`, omitBackground: true });
  await page.close();
  console.log("wrote public/" + file);
}
await png(tile, 192, "icons/icon-192.png");
await png(tile, 512, "icons/icon-512.png");
await png(maskable, 512, "icons/icon-maskable-512.png");
await png(square, 180, "icons/apple-touch-icon.png");
await png(tile, 32, "icons/favicon-32.png");
await browser.close();
