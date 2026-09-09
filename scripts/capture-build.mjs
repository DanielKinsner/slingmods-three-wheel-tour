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
const seed = JSON.parse(
  process.argv[3] ||
    '{"version":2,"credits":20000,"chapter":3,"races":6,"wins":3,"upgrades":{"power":2,"grip":3,"boost":1},"wheels":2,"ownedWheels":[0,2],"lighting":1,"paint":6,"rgb":1,"rgbCycle":false,"settings":{"sound":false,"music":false,"voice":false}}',
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-angle=d3d11'],
});
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
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
const raceParts = await page.evaluate(() => {
  const t = window.__tour;
  return { playMode: t?.playMode, drawCalls: t?.drawCalls };
});
console.log(JSON.stringify({ errors, out, raceParts }));
await browser.close();
