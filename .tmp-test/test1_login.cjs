const { chromium } = require('playwright');

const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/screenshots';

async function loginAs(page, method, identifier, password) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  if (method === 'email') {
    // Method toggle defaults to "email" already per Login.jsx
    await page.fill('input[type="email"], input[placeholder*="mail" i]', identifier);
  }
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Log")');
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // VET SESSION
  const vetCtx = await browser.newContext();
  const vetPage = await vetCtx.newPage();
  vetPage.on('console', msg => { if (msg.type() === 'error') errors.push(['VET', msg.text()]); });
  vetPage.on('pageerror', err => errors.push(['VET-PAGEERROR', err.message]));

  await loginAs(vetPage, 'email', 'vetintown@gmail.com', 'V2345a789');
  await vetPage.waitForTimeout(2500);
  console.log('VET URL after login:', vetPage.url());
  await vetPage.screenshot({ path: `${SS_DIR}/01-vet-dashboard.png`, fullPage: true });

  // FARMER SESSION
  const farmerCtx = await browser.newContext();
  const farmerPage = await farmerCtx.newPage();
  farmerPage.on('console', msg => { if (msg.type() === 'error') errors.push(['FARMER', msg.text()]); });
  farmerPage.on('pageerror', err => errors.push(['FARMER-PAGEERROR', err.message]));

  await loginAs(farmerPage, 'email', 'user2farmersconnect@gmail.com', '87654321');
  await farmerPage.waitForTimeout(2500);
  console.log('FARMER URL after login:', farmerPage.url());
  await farmerPage.screenshot({ path: `${SS_DIR}/02-farmer-dashboard.png`, fullPage: true });

  console.log('--- CONSOLE ERRORS ---');
  console.log(JSON.stringify(errors, null, 2));

  await vetCtx.storageState({ path: `${SS_DIR}/../vet-state.json` });
  await farmerCtx.storageState({ path: `${SS_DIR}/../farmer-state.json` });

  await browser.close();
})();
