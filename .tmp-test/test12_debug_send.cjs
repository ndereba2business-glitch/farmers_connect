const { chromium } = require('playwright');

const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/screenshots';
const BASE = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: `${BASE}/vet-state.json` });
  const page = await ctx.newPage();

  page.on('response', async (res) => {
    if (res.url().includes('vet_farmer_messages') || res.url().includes('realtime')) {
      console.log('RESP', res.status(), res.request().method(), res.url());
    }
  });
  page.on('console', msg => console.log('CONSOLE', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGEERROR', err.message));

  await page.goto('http://localhost:5173/vet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.click('text=Message Farmer');
  await page.waitForTimeout(600);
  await page.click('text=user2farmersconnect@gmail.com');
  await page.waitForTimeout(800);
  console.log('--- BEFORE SEND ---');
  console.log(await page.textContent('body'));

  await page.fill('input[placeholder="Type a message..."]', 'Debug message ' + Date.now());
  await page.click('button[aria-label="Send message"]');
  await page.waitForTimeout(2500);

  console.log('--- AFTER SEND (2.5s wait) ---');
  const afterText = await page.textContent('body');
  console.log(afterText.includes('Debug message') ? 'MESSAGE VISIBLE' : 'MESSAGE NOT VISIBLE');
  await page.screenshot({ path: `${SS_DIR}/20-debug-after-send.png` });

  await browser.close();
})();
