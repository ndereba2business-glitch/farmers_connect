// Starts the real app on a local Vite server and opens Chromium.
// Mocked tests point the app at a fake Supabase URL (set before Vite
// starts, so it overrides .env); live tests leave .env alone.
import { createServer } from "vite";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

export async function startApp({ env = {} } = {}) {
  Object.assign(process.env, env);
  const server = await createServer({
    root,
    logLevel: "silent",
    server: { port: 5310, strictPort: false, host: "127.0.0.1" }
  });
  await server.listen();
  const url = server.resolvedUrls.local[0].replace(/\/$/, "");
  const browser = await chromium.launch();
  return {
    url,
    browser,
    async close() {
      await browser.close();
      await server.close();
    }
  };
}

// A fresh browser context per user, with window.open captured so WhatsApp
// links can be checked without leaving the page.
export async function newUserPage(browser, { width = 360, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => { window.__opened.push(String(url)); return null; };
  });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  return { context, page, errors };
}
