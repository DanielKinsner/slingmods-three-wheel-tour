// Headless garage capture: seeds a full build and screenshots each garage view.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const storage = join(process.env.LOCALAPPDATA, 'ms-playwright');
const candidates = readdirSync(storage)
  .filter((n) => n.startsWith('chromium_headless_shell-'))
  .sort((a, b) => Number(b.split('-').at(-1)) - Number(a.split('-').at(-1)));
const executablePath = candidates
  .map((n) => join(storage, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'))
  .find(existsSync);
const out = process.argv[2] || 'shots';
const seedArg = process.argv.slice(3).find((a) => !a.startsWith('--'));
const seed = JSON.parse(
  seedArg ||
    '{"version":2,"credits":20000,"chapter":3,"races":6,"wins":3,"upgrades":{"power":2,"grip":3,"boost":1},"wheels":2,"ownedWheels":[0,2],"lighting":1,"paint":6,"rgb":1,"rgbCycle":false,"settings":{"sound":false,"music":false,"voice":false}}',
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-angle=d3d11'],
});
// --mobile checks the garage at a phone viewport (390x844) instead of desktop.
const mobile = process.argv.includes('--mobile');
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  isMobile: mobile,
  hasTouch: mobile,
});
await context.addInitScript(
  (s) => localStorage.setItem('slingmods-tour-v1', JSON.stringify(s)),
  seed,
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:5173/?webgl=1');
await page.locator('[data-action="quick"]').waitFor({ timeout: 90000 });
await page.waitForFunction(() => window.__tour?.drawCalls > 0, {}, { timeout: 90000 });
await page.click('[data-action="garage"]');
await page.waitForTimeout(2500);
if (mobile) {
  await page.screenshot({ path: `${out}/mobile-garage.png`, fullPage: true });
  await page.click('[data-garagetab="build"]').catch(() => {});
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(
    JSON.stringify({
      errors,
      out,
      overflow,
      lowTier: await page.evaluate(() => window.__tour?.build),
    }),
  );
  await browser.close();
  process.exit(0);
}
for (const [view, name] of [
  [0, 'front'],
  [0.9, 'side'],
  [2.1, 'rear'],
]) {
  await page.click(`[data-view="${view}"]`);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/garage-${name}.png` });
  await page.screenshot({
    path: `${out}/car-${name}.png`,
    clip: { x: 380, y: 260, width: 900, height: 560 },
  });
  for (const [zone, clip] of Object.entries({
    front: { x: 420, y: 430, width: 520, height: 330 },
    side: { x: 420, y: 430, width: 560, height: 330 },
    rear: { x: 620, y: 430, width: 520, height: 330 },
  }))
    if (zone === name) await page.screenshot({ path: `${out}/zoom-${name}.png`, clip });
}
await page.selectOption('[data-studio]', 'night');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/garage-night.png` });
// Parts must survive into a race: start a quick race on the coast and grab the chase view.
await page.click('[data-action="home"]');
await page.waitForTimeout(800);
await page.click('[data-action="quick"]');
await page.waitForTimeout(800);
await page.click('[data-action="race"]');
await page.waitForTimeout(6500);
await page.screenshot({ path: `${out}/race.png` });
// Night race on the coast: headlight spots and halos must sit on the lofted nose.
await page.goto('http://127.0.0.1:5173/?webgl=1');
await page.locator('[data-action="quick"]').waitFor({ timeout: 90000 });
await page.waitForFunction(() => window.__tour?.drawCalls > 0, {}, { timeout: 90000 });
await page.click('[data-action="quick"]');
await page.waitForTimeout(600);
await page.click('[data-night="night"]').catch(() => {});
await page.waitForTimeout(400);
await page.click('[data-action="race"]');
await page.waitForTimeout(6500);
await page.screenshot({ path: `${out}/race-night.png` });
// A screenshot blurs the page and the game auto-pauses on lost focus; dismiss before continuing.
await page.click('[data-action="close"]').catch(() => {});
await page.waitForTimeout(300);
await page.keyboard.press('KeyC');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/race-night-cockpit.png` });
const raceParts = await page.evaluate(() => {
  const t = window.__tour;
  return { playMode: t?.playMode, drawCalls: t?.drawCalls };
});
console.log(JSON.stringify({ errors, out, raceParts }));
await browser.close();
