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
  page.on('response', async (res) => {
    if (res.url().includes('lab-results') || res.url().includes('vet_medical_records')) {
      console.log('RESP', res.status(), res.request().method(), res.url().slice(0, 150));
    }
  });

  await page.goto('http://localhost:5173/vet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.click('text=Upload Lab Results');
  await page.waitForTimeout(500);
  await page.fill('input[placeholder*="Search farmer" i]', 'Kamau');
  await page.waitForTimeout(1000);
  await page.click('text=user2farmersconnect@gmail.com');
  await page.fill('input[placeholder*="Avian Influenza" i]', 'Avian Influenza PCR');
  await page.setInputFiles('input[type="file"]', `${BASE}/dummy-lab-result.txt`);
  await page.screenshot({ path: `${SS_DIR}/21-lab-result-filled.png` });
  await page.click('button[type="submit"]:has-text("Upload")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS_DIR}/22-lab-result-saved.png`, fullPage: true });

  console.log('--- CONSOLE ERRORS ---');
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
})();
