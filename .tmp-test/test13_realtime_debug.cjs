const { chromium } = require('playwright');
const BASE = 'C:/Users/user/AppData/Local/Temp/claude/d--system-files-farmersconnect/0f4d3a60-e9e1-4906-af67-bbd8a948f5a3/scratchpad';

(async () => {
  const browser = await chromium.launch();

  const farmerCtx = await browser.newContext({ storageState: `${BASE}/farmer-state.json` });
  const farmerPage = await farmerCtx.newPage();
  farmerPage.on('console', msg => console.log('FARMER-CONSOLE', msg.type(), msg.text()));
  farmerPage.on('websocket', ws => {
    console.log('WS OPENED:', ws.url());
    ws.on('framereceived', f => console.log('WS RECV:', String(f.payload).slice(0, 300)));
    ws.on('framesent', f => console.log('WS SENT:', String(f.payload).slice(0, 300)));
    ws.on('close', () => console.log('WS CLOSED'));
  });

  await farmerPage.goto('http://localhost:5173/bookings', { waitUntil: 'domcontentloaded' });
  await farmerPage.waitForTimeout(1200);
  await farmerPage.click('button:has-text("Messages")');
  await farmerPage.waitForTimeout(800);
  await farmerPage.click('text=Vet 1');
  await farmerPage.waitForTimeout(1500);
  console.log('=== FARMER THREAD OPEN, WAITING FOR VET MESSAGE ===');

  const vetCtx = await browser.newContext({ storageState: `${BASE}/vet-state.json` });
  const vetPage = await vetCtx.newPage();
  await vetPage.goto('http://localhost:5173/vet', { waitUntil: 'domcontentloaded' });
  await vetPage.waitForTimeout(1200);
  await vetPage.click('text=Message Farmer');
  await vetPage.waitForTimeout(600);
  await vetPage.click('text=user2farmersconnect@gmail.com');
  await vetPage.waitForTimeout(600);
  const marker = 'LIVE-TEST-' + Date.now();
  await vetPage.fill('input[placeholder="Type a message..."]', marker);
  await vetPage.click('button[aria-label="Send message"]');
  console.log('=== VET SENT:', marker, '===');

  await farmerPage.waitForTimeout(6000);
  const text = await farmerPage.textContent('body');
  console.log('FARMER SEES IT LIVE:', text.includes(marker));

  await browser.close();
})();
