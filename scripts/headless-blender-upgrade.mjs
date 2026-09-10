import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const storage = join(process.env.LOCALAPPDATA, 'ms-playwright');
const exe =
  process.env.HEADLESS_CHROMIUM ||
  readdirSync(storage)
    .filter((n) => n.startsWith('chromium_headless_shell-'))
    .sort((a, b) => +b.split('-').at(-1) - +a.split('-').at(-1))
    .map((n) => join(storage, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'))
    .find(existsSync);
const browser = await chromium.launch({
  headless: true,
  executablePath: exe,
  args: ['--use-angle=d3d11'],
});
const out = 'evidence/blender-upgrade';
const visualsOnly = true;
await mkdir(out, { recursive: true });
const result = {
  environment:
    'Isolated headless Chromium; virtual gamepad via navigator.getGamepads, actual application input/physics/timer, wall-clock execution. Not physical controller or phone proof.',
  errors: [],
  snapshots: [],
  assets: [],
  warnings: [],
};
let activePage;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: out + '/raw', size: { width: 960, height: 600 } },
  });
  await context.addInitScript(() => {
    const pad = {
      id: 'Headless test pad',
      mapping: 'standard',
      connected: true,
      index: 0,
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
      timestamp: 0,
    };
    window.__headlessPad = pad;
    navigator.getGamepads = () => [pad];
  });
  const page = await context.newPage();
  activePage = page;
  page.on('pageerror', (e) => result.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'warning') result.warnings.push(m.text());
    if (m.type() === 'error') result.errors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.url().includes('/models/')) result.assets.push({ url: r.url(), status: r.status() });
  });
  await page.goto('http://127.0.0.1:4175/?webgl=1');
  await page.locator('[data-action="quick"]').waitFor({ timeout: 90000 });
  await page.click('[data-action="garage"]');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: out + '/garage-front.png' });
  await page.selectOption('[data-owner="rims"]', 'silver');
  await page.click('[data-paint="2"]');
  await page.click('[data-view="2.1"]');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: out + '/garage-rear.png' });
  await page.selectOption('[data-studio]', 'night');
  await page.click('[data-rgb="2"]');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: out + '/garage-rgb.png' });
  result.garage = await page.evaluate(() => window.__tour);
  await page.click('[data-action="home"]');
  await page.click('[data-action="quick"]');
  await page.click('[data-quicktrack="5"]');
  await page.click('[data-mode="free"]');
  await page.click('[data-action="race"]');
  await page.evaluate(() => {
    window.__driveTimer = setInterval(() => {
      const t = window.__tour,
        p = window.__headlessPad;
      if (!t.player.pose || t.screen !== 'race' || !t.guide) return;
      const pose = t.player.pose,
        dx = t.guide.point[0] - pose.x,
        dz = t.guide.point[2] - pose.z;
      const error = Math.atan2(
        Math.sin(Math.atan2(dx, dz) - pose.yaw),
        Math.cos(Math.atan2(dx, dz) - pose.yaw),
      );
      const steer =
        Math.atan2(2 * 2.667 * Math.sin(error), Math.max(4, Math.hypot(dx, dz))) /
        (0.49 / (1 + Math.abs(t.player.speed) * 0.055));
      p.axes[0] = -Math.max(-1, Math.min(1, steer));
      const target = Math.min(35, Math.sqrt(7.2 / Math.max(0.002, t.guide.bend)));
      p.buttons[7].value = t.player.speed < target ? 1 : 0;
      p.buttons[7].pressed = p.buttons[7].value > 0;
      p.buttons[6].value = Math.max(0, Math.min(1, (t.player.speed - target - 1) / 5));
      p.buttons[6].pressed = p.buttons[6].value > 0;
      p.buttons[0].pressed =
        t.playMode === 'drift' &&
        t.guide.bend > 0.003 &&
        t.player.speed > 18 &&
        t.raceTime % 7 < 5.3 &&
        Math.abs(t.player.lane) < 5;
      p.buttons[0].value = Number(p.buttons[0].pressed);
      p.timestamp = performance.now();
    }, 50);
  });
  result.bundle = await page.locator('script[type="module"]').getAttribute('src');
  if (visualsOnly) {
    await page.waitForTimeout(1500);
    const initial = await page.evaluate(() => window.__tour);
    console.log(
      JSON.stringify({
        initial: {
          paused: initial.paused,
          speed: initial.player.speed,
          distance: initial.player.distance,
          pose: initial.player.pose,
        },
      }),
    );
    if (initial.paused) throw Error('Paused before first guided input leg');
    for (const [distance, name] of [
      [80, 'warehouse'],
      [235, 'covered'],
      [670, 'tanks'],
      [825, 'cranes'],
      [1000, 'waterfront'],
      [1430, 'cargo'],
    ]) {
      await page.waitForFunction((d) => window.__tour.player.distance > d, distance, {
        timeout: 35000,
      });
      await page.screenshot({ path: out + `/final-harbor-${name}.png` });
      result.snapshots.push(await page.evaluate(() => window.__tour));
    }
    await page.keyboard.press('c');
    await page.waitForTimeout(800);
    await page.screenshot({ path: out + '/harbor-cockpit.png' });
    await page.keyboard.press('c');
    await page.keyboard.press('Escape');
    await page.click('[data-action="home"]');
    await page.click('[data-action="quick"]');
    await page.click('[data-night="night"]');
    await page.screenshot({ path: out + '/final-harbor-briefing.png' });
    await page.click('[data-action="race"]');
    await page.waitForFunction(() => window.__tour.player.distance > 235, {}, { timeout: 35000 });
    await page.screenshot({ path: out + '/final-harbor-night.png' });
    result.snapshots.push(await page.evaluate(() => window.__tour));
    result.nightProfile = await page.evaluate(() => window.__tour.frameProfile);
    if (result.snapshots.some((t) => t.paused || t.opponents.length || t.playMode !== 'free'))
      throw Error('Final visual drive failed');
  }
  // Exercise all six cars on an existing circuit, then reload Harbor's cached kit.
  await page.keyboard.press('Escape');
  await page.click('[data-action="home"]');
  await page.click('[data-action="quick"]');
  await page.click('[data-quicktrack="0"]');
  await page.click('[data-mode="race"]');
  await page.click('[data-action="race"]');
  await page.waitForTimeout(12500);
  result.rivals = await page.evaluate(() => window.__tour);
  await page.screenshot({ path: out + '/six-car-race.png' });
  if (
    result.rivals.opponents.length !== 5 ||
    result.rivals.paused ||
    result.rivals.player.distance < 30
  )
    throw Error('Six-car race check failed');
  await page.keyboard.press('Escape');
  await page.click('[data-action="home"]');
  await page.click('[data-action="quick"]');
  await page.click('[data-quicktrack="5"]');
  await page.click('[data-mode="free"]');
  await page.click('[data-action="race"]');
  await page.waitForFunction(() => window.__tour.player.distance > 80, {}, { timeout: 35000 });
  await page.screenshot({ path: out + '/harbor-reloaded.png' });
  result.reloadedHarbor = await page.evaluate(() => window.__tour);
  if (result.reloadedHarbor.paused || result.reloadedHarbor.vehicleArt.suspensionLinks !== 11)
    throw Error('Cached asset reload failed');
  const saved = await page.evaluate(() => localStorage.getItem('slingmods-tour-v1'));
  await page.reload();
  await page.locator('[data-action="quick"]').waitFor({ timeout: 90000 });
  result.savedProgressPreserved =
    saved === (await page.evaluate(() => localStorage.getItem('slingmods-tour-v1')));
  await context.close();
  const gpu = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const g = await gpu.newPage();
  g.on('pageerror', (e) => result.errors.push(e.message));
  await g.goto('http://127.0.0.1:4175/');
  await g.locator('[data-action="quick"]').waitFor({ timeout: 90000 });
  await g.waitForFunction(() => window.__tour?.drawCalls > 0);
  await g.screenshot({ path: out + '/default-renderer.png' });
  result.defaultRenderer = await g.evaluate(() => ({
    backend: window.__tour.backend,
    triangles: window.__tour.triangles,
    drawCalls: window.__tour.drawCalls,
  }));
  await gpu.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();
  const mobileAssets = [];
  mp.on('response', (r) => {
    if (r.url().includes('/models/')) mobileAssets.push(r.url());
  });
  mp.on('pageerror', (e) => result.errors.push(e.message));
  await mp.goto('http://127.0.0.1:4175/?webgl=1');
  await mp.locator('[data-action="quick"]').waitFor({ timeout: 90000 });
  await mp.click('[data-action="quick"]');
  await mp.click('[data-quicktrack="5"]');
  await mp.click('[data-mode="free"]');
  await mp.click('[data-action="race"]');
  await mp.waitForTimeout(1600);
  await mp.keyboard.down('w');
  await mp.waitForTimeout(4500);
  await mp.keyboard.up('w');
  await mp.screenshot({ path: out + '/mobile-emulation.png' });
  result.mobile = { assets: mobileAssets, tour: await mp.evaluate(() => window.__tour) };
  if (mobileAssets.some((u) => u.includes('-hero.glb')))
    throw Error('Full vehicle loaded at mobile boot');
  if (
    !result.savedProgressPreserved ||
    result.mobile.tour.vehicleArt.suspensionLinks !== 11 ||
    result.mobile.tour.vehicleArt.quality !== 'low'
  )
    throw Error('Save/rig contract failed');
  await mobile.close();
} catch (e) {
  result.errors.push(e.stack);
  if (activePage && !activePage.isClosed()) {
    result.failure = await activePage
      .evaluate(() => ({ tour: window.__tour, body: document.body.innerText }))
      .catch(() => null);
    await activePage.screenshot({ path: out + '/failed-visual-drive.png' }).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(
    out + (visualsOnly ? '/final-visuals.json' : '/guided-drive.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        errors: result.errors,
        drift: result.driftResult,
        defaultRenderer: result.defaultRenderer,
        snapshots: result.snapshots.map((t) => ({
          distance: t.player.distance,
          lane: t.player.lane,
          score: t.driftAttack?.banked,
          tokens: t.tokens,
        })),
      },
      null,
      2,
    ),
  );
}
