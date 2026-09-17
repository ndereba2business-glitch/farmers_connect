const { chromium } = require('playwright');

const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/screenshots';
const BASE = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ storageState: `${BASE}/vet-state.json` });
  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:5173/vet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.click('text=Message Farmer');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SS_DIR}/16-conversations-list-after-reload.png` });

  console.log('--- CONSOLE ERRORS ---');
  console.log(JSON.stringify(errors, null, 2));
  console.log('Body text sample:', (await page.textContent('body')).slice(0, 800));

  await browser.close();
})();
