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

  await page.goto('http://localhost:5173/vet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Click "Create Prescription" quick action
  await page.click('text=Create Prescription');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SS_DIR}/03-prescription-modal-open.png` });

  // Type into farmer search
  await page.fill('input[placeholder*="Search farmer" i]', 'Kamau');
  await page.waitForTimeout(1000); // debounce + query
  await page.screenshot({ path: `${SS_DIR}/04-farmer-search-results.png` });

  console.log('--- CONSOLE ERRORS SO FAR ---');
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
})();
