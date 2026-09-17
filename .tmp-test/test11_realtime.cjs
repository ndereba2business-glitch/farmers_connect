const { chromium } = require('playwright');

const SS_DIR = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad/screenshots';
const BASE = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  const vetCtx = await browser.newContext({ storageState: `${BASE}/vet-state.json` });
  const vetPage = await vetCtx.newPage();
  vetPage.on('pageerror', err => errors.push(['VET-PAGEERROR', err.message]));

  const farmerCtx = await browser.newContext({ storageState: `${BASE}/farmer-state.json` });
  const farmerPage = await farmerCtx.newPage();
  farmerPage.on('pageerror', err => errors.push(['FARMER-PAGEERROR', err.message]));

  // Farmer opens the thread with the vet FIRST and leaves it open
  await farmerPage.goto('http://localhost:5173/bookings', { waitUntil: 'domcontentloaded' });
  await farmerPage.waitForTimeout(1200);
  await farmerPage.click('button:has-text("Messages")');
  await farmerPage.waitForTimeout(800);
  await farmerPage.click('text=Vet 1');
  await farmerPage.waitForTimeout(800);
  await farmerPage.screenshot({ path: `${SS_DIR}/17-farmer-thread-before.png` });

  // Vet sends a NEW message while farmer's thread is already open
  await vetPage.goto('http://localhost:5173/vet', { waitUntil: 'domcontentloaded' });
  await vetPage.waitForTimeout(1200);
  await vetPage.click('text=Message Farmer');
  await vetPage.waitForTimeout(600);
  await vetPage.click('text=user2farmersconnect@gmail.com');
  await vetPage.waitForTimeout(600);
  await vetPage.fill('input[placeholder="Type a message..."]', 'Realtime test message from vet');
  await vetPage.click('button[aria-label="Send message"]');
  await vetPage.waitForTimeout(500);
  await vetPage.screenshot({ path: `${SS_DIR}/18-vet-thread-after-send.png` });

  // Give Realtime a few seconds to push to the farmer's already-open thread
  await farmerPage.waitForTimeout(4000);
  await farmerPage.screenshot({ path: `${SS_DIR}/19-farmer-thread-after-realtime-wait.png` });

  const farmerBodyText = await farmerPage.textContent('body');
  console.log('Farmer thread contains new message (live, no reload)?', farmerBodyText.includes('Realtime test message from vet'));

  console.log('--- ERRORS ---');
  console.log(JSON.stringify(errors, null, 2));

  await browser.close();
})();
