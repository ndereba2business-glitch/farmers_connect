const { chromium } = require('playwright');

const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/screenshots';
const BASE = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // VET sends first message
  const vetCtx = await browser.newContext({ storageState: `${BASE}/vet-state.json` });
  const vetPage = await vetCtx.newPage();
  vetPage.on('console', msg => { if (msg.type() === 'error') errors.push(['VET', msg.text()]); });
  vetPage.on('pageerror', err => errors.push(['VET-PAGEERROR', err.message]));

  await vetPage.goto('http://localhost:5173/vet', { waitUntil: 'domcontentloaded' });
  await vetPage.waitForTimeout(1500);
  await vetPage.click('text=Message Farmer');
  await vetPage.waitForTimeout(500);
  await vetPage.screenshot({ path: `${SS_DIR}/13-messages-modal-empty.png` });

  await vetPage.click('button[aria-label="New conversation"]');
  await vetPage.waitForTimeout(500);
  await vetPage.fill('input[placeholder*="Search farmer" i]', 'Kamau');
  await vetPage.waitForTimeout(1000);
  await vetPage.click('text=user2farmersconnect@gmail.com');
  await vetPage.click('button:has-text("Start Conversation")');
  await vetPage.waitForTimeout(500);
  await vetPage.fill('input[placeholder="Type a message..."]', 'Hi Kamau, how is the flock doing after the vaccination?');
  await vetPage.click('button[aria-label="Send message"]');
  await vetPage.waitForTimeout(1500);
  await vetPage.screenshot({ path: `${SS_DIR}/14-vet-sent-message.png` });

  console.log('VET errors after sending:', JSON.stringify(errors));

  // FARMER checks Messages tab and replies
  const farmerCtx = await browser.newContext({ storageState: `${BASE}/farmer-state.json` });
  const farmerPage = await farmerCtx.newPage();
  farmerPage.on('console', msg => { if (msg.type() === 'error') errors.push(['FARMER', msg.text()]); });
  farmerPage.on('pageerror', err => errors.push(['FARMER-PAGEERROR', err.message]));

  await farmerPage.goto('http://localhost:5173/bookings', { waitUntil: 'domcontentloaded' });
  await farmerPage.waitForTimeout(1500);
  await farmerPage.click('button:has-text("Messages")');
  await farmerPage.waitForTimeout(1000);
  await farmerPage.screenshot({ path: `${SS_DIR}/15-farmer-messages-tab.png`, fullPage: true });

  console.log('--- ALL ERRORS ---');
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
})();
