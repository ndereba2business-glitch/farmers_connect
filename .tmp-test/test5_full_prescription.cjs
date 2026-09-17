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

  // --- PRESCRIPTION ---
  await page.click('text=Create Prescription');
  await page.waitForTimeout(500);
  await page.fill('input[placeholder*="Search farmer" i]', 'Kamau');
  await page.waitForTimeout(1000);
  await page.click('text=user2farmersconnect@gmail.com');
  await page.fill('input[placeholder*="Amoxicillin" i]', 'Amoxicillin');
  await page.fill('input[placeholder*="5L water" i]', '1g per 5L water');
  await page.fill('textarea[placeholder*="Twice daily" i]', 'Twice daily for 5 days');
  await page.screenshot({ path: `${SS_DIR}/07-prescription-filled.png` });
  await page.click('button:has-text("Save Prescription")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS_DIR}/08-prescription-saved.png`, fullPage: true });
  console.log('After prescription save, errors so far:', JSON.stringify(errors));

  // --- DIAGNOSIS ---
  await page.click('text=Record Diagnosis');
  await page.waitForTimeout(500);
  await page.fill('input[placeholder*="Search farmer" i]', 'Kamau');
  await page.waitForTimeout(1000);
  await page.click('text=user2farmersconnect@gmail.com');
  await page.fill('textarea[placeholder*="Newcastle disease" i]', 'Suspected coccidiosis');
  await page.click('button:has-text("Save Diagnosis")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS_DIR}/09-diagnosis-saved.png`, fullPage: true });
  console.log('After diagnosis save, errors so far:', JSON.stringify(errors));

  // --- VACCINATION ---
  await page.click('text=Add Vaccination Record');
  await page.waitForTimeout(500);
  await page.fill('input[placeholder*="Search farmer" i]', 'Kamau');
  await page.waitForTimeout(1000);
  await page.click('text=user2farmersconnect@gmail.com');
  await page.fill('input[placeholder*="Newcastle Disease Vaccine" i]', 'Newcastle Disease Vaccine');
  await page.click('button:has-text("Save Vaccination Record")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS_DIR}/10-vaccination-saved.png`, fullPage: true });
  console.log('After vaccination save, errors so far:', JSON.stringify(errors));

  console.log('--- ALL CONSOLE ERRORS ---');
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
})();
