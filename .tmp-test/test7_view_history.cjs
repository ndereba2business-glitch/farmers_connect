const { chromium } = require('playwright');

const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/screenshots';
const STATE = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/vet-state.json';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ storageState: STATE });
  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:5173/vet/farmers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("View History")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS_DIR}/12-view-history-modal.png`, fullPage: true });

  console.log('--- CONSOLE ERRORS ---');
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
})();
