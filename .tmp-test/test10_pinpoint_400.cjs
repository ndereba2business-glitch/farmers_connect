const { chromium } = require('playwright');

const BASE = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: `${BASE}/farmer-state.json` });
  const page = await ctx.newPage();

  page.on('response', async (res) => {
    if (res.status() >= 400) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.log('FAILED:', res.status(), res.url());
      console.log('BODY:', body.slice(0, 500));
    }
  });

  await page.goto('http://localhost:5173/bookings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("Messages")');
  await page.waitForTimeout(1500);

  await browser.close();
})();
