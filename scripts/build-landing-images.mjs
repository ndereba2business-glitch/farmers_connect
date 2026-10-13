// Regenerates the photographs on the public landing page.
//
//   node scripts/build-landing-images.mjs
//
// Every photograph is a real one of real poultry in Kenya, published on
// Wikimedia Commons under a licence that allows commercial use. The
// sources, authors and licences are in src/components/landing/photos.js,
// which this script and the page both read, and in
// docs/play-store/image-licences.md.
//
// For each photograph it downloads a working copy from Commons, crops it
// to the shape the page uses, and writes WebP files at three widths plus
// one JPEG for browsers without WebP. It uses the Playwright browser
// already installed for the end-to-end tests, so there is no extra
// dependency. The outputs are committed, so the site never depends on
// Commons being reachable: nothing on the page is hot-linked.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PHOTOS, PHOTO_WIDTHS } from "../src/components/landing/photos.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = `${root}public/landing`;
mkdirSync(outDir, { recursive: true });

const headers = { "User-Agent": "FarmersConnect-landing-images/1.0 (build script)" };

async function download(photo) {
  const api = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
    action: "query", format: "json", titles: photo.commonsTitle, prop: "imageinfo", iiprop: "url|sha1", iiurlwidth: "1600"
  });
  const info = Object.values((await (await fetch(api, { headers })).json()).query.pages)[0]?.imageinfo?.[0];
  if (!info) throw new Error(`Commons has no file called ${photo.commonsTitle}`);
  // the file on Commons must be the one whose licence was checked
  if (info.sha1 !== photo.sha1) throw new Error(`${photo.commonsTitle} has changed on Commons (sha1 ${info.sha1}); check its licence again before using it`);
  return Buffer.from(await (await fetch(info.thumburl, { headers })).arrayBuffer());
}

const browser = await chromium.launch();
const page = await browser.newPage();

// Crops to `ratio` around the focal point and scales to `width`, in the
// browser's own canvas, then encodes.
async function render(source, { width, ratio, focus, type, quality }) {
  return page.evaluate(async ({ dataUrl, width, ratio, focus, type, quality }) => {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    let sw = img.naturalWidth;
    let sh = Math.round(sw / ratio);
    if (sh > img.naturalHeight) { sh = img.naturalHeight; sw = Math.round(sh * ratio); }
    const sx = Math.round(Math.min(Math.max(img.naturalWidth * focus[0] - sw / 2, 0), img.naturalWidth - sw));
    const sy = Math.round(Math.min(Math.max(img.naturalHeight * focus[1] - sh / 2, 0), img.naturalHeight - sh));
    const w = Math.min(width, sw);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = Math.round(w / ratio);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
    return { bytes: Array.from(new Uint8Array(await blob.arrayBuffer())), width: canvas.width, height: canvas.height };
  }, { dataUrl: `data:image/jpeg;base64,${source.toString("base64")}`, width, ratio, focus, type, quality });
}

for (const photo of PHOTOS) {
  const source = await download(photo);
  for (const width of PHOTO_WIDTHS) {
    const out = await render(source, { width, ratio: photo.ratio, focus: photo.focus, type: "image/webp", quality: 0.74 });
    writeFileSync(`${outDir}/${photo.id}-${width}.webp`, Buffer.from(out.bytes));
    console.log(`wrote public/landing/${photo.id}-${width}.webp  ${out.width}x${out.height}  ${Math.round(out.bytes.length / 1024)} KB`);
  }
  const fallback = await render(source, { width: PHOTO_WIDTHS[1], ratio: photo.ratio, focus: photo.focus, type: "image/jpeg", quality: 0.78 });
  writeFileSync(`${outDir}/${photo.id}.jpg`, Buffer.from(fallback.bytes));
  console.log(`wrote public/landing/${photo.id}.jpg  ${fallback.width}x${fallback.height}  ${Math.round(fallback.bytes.length / 1024)} KB`);
}

await browser.close();
