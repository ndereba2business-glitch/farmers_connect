// Regenerates the app icons from the brand mark.
//
//   node scripts/build-icons.mjs
//
// The artwork is src/components/brandMarkArt.js, the same file the app's
// BrandMark component draws from. Run this after changing it. It uses the
// Playwright browser already installed for the end-to-end tests, so there
// is no extra dependency.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MARK_SCALE_SMALL, markSvg } from "../src/components/brandMarkArt.js";

const root = fileURLToPath(new URL("..", import.meta.url));

// Browser tabs: tiny, so the rooster is drawn larger inside the tile.
const small = markSvg({ scale: MARK_SCALE_SMALL });
// Rounded tile, as supplied: desktop shortcuts and install prompts.
const tile = markSvg();
// Full-bleed square: iOS rounds the corners itself.
const square = markSvg({ rounded: false });
// Maskable: Android crops to a circle or squircle. As supplied, the
// rooster already sits inside the central "safe zone", so nothing is cut.
const maskable = markSvg({ rounded: false });

mkdirSync(`${root}public/icons`, { recursive: true });
writeFileSync(`${root}public/favicon.svg`, small + "\n");

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
await png(small, 32, "icons/favicon-32.png");
await browser.close();
