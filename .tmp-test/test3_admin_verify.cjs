const { chromium } = require('playwright');

const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/screenshots';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGEERROR: ' + err.message));

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], input[placeholder*="mail" i]', 'ndereducation2025@gmail.com');
  await page.fill('input[type="password"]', 'L0s7coz!m@n');
  await page.click('button[type="submit"], button:has-text("Log")');
  await page.waitForTimeout(2500);
  console.log('ADMIN URL after login:', page.url());
  await page.screenshot({ path: `${SS_DIR}/05-admin-dashboard.png`, fullPage: true });

  console.log('--- CONSOLE ERRORS AFTER LOGIN ---');
  console.log(JSON.stringify(errors, null, 2));

  await ctx.storageState({ path: 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/admin-state.json' });

  await browser.close();
})();
