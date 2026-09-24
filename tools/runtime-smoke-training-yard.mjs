import { chromium } from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4178';
const outputDir = new URL('../artifacts/runtime-smoke/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
const failedLocalRequests = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  if (request.url().startsWith(baseUrl)) failedLocalRequests.push(`${request.url()}: ${request.failure()?.errorText}`);
});

const url = `${baseUrl}/bunny.html?threeDebugRoster=1`;
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__BUNNY_3D_DEBUG__?.snapshot().walkableSurfaces > 0);
await page.waitForFunction(() => window.__BUNNY_3D_DEBUG__?.snapshot().mobs.length >= 5);
await page.locator('.bw-event-start-overlay').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});

const initial = await page.evaluate(() => window.__BUNNY_3D_DEBUG__.snapshot());
const expected = new Map([
  ['สไลม์ฝึกหัด', 300],
  ['หุ่นฟางซ้อมดาบ', 360],
  ['หนูโรงฝึก', 420],
  ['ครูฝึกไม้เก่า', 580],
  ['ลานฝึกผู้พิทักษ์', 1800],
]);
for (const [name, hp] of expected) {
  const mob = initial.mobs.find((entry) => entry.name === name);
  if (!mob) throw new Error(`Missing debug roster monster: ${name}`);
  if (mob.maxHp !== hp) throw new Error(`Non-authoritative HP for ${name}: ${mob.maxHp} !== ${hp}`);
}
if (initial.worldSource !== 'fallback') throw new Error(`Unexpected world source without restored GLB: ${initial.worldSource}`);

await page.screenshot({ path: fileURLToPath(new URL('training-yard-loaded.png', outputDir)), fullPage: true });

await page.keyboard.down('d');
await page.waitForTimeout(450);
await page.keyboard.up('d');
const afterWasd = await page.evaluate(() => window.__BUNNY_3D_DEBUG__.snapshot());
if (afterWasd.hero[0] <= initial.hero[0] + 0.25) throw new Error('WASD movement did not move the Bunny');

const slime = afterWasd.mobs.find((entry) => entry.name === 'สไลม์ฝึกหัด');
if (!slime?.screen) throw new Error('Training Slime has no projected selection point');
const canvas = page.locator('canvas.bw-three-combat');
await canvas.dispatchEvent('pointerdown', {
  clientX: slime.screen[0],
  clientY: slime.screen[1],
  pointerId: 1,
  pointerType: 'mouse',
});
await page.waitForFunction(() => window.__BUNNY_3D_DEBUG__.snapshot().selectedMonster === 'สไลม์ฝึกหัด');
await page.waitForFunction(() => {
  const mob = window.__BUNNY_3D_DEBUG__.snapshot().mobs.find((entry) => entry.name === 'สไลม์ฝึกหัด');
  return mob && mob.hp < mob.maxHp;
}, null, { timeout: 10000 });
const afterHit = await page.evaluate(() => window.__BUNNY_3D_DEBUG__.snapshot());

await page.waitForFunction(() => {
  const mob = window.__BUNNY_3D_DEBUG__.snapshot().mobs.find((entry) => entry.name === 'สไลม์ฝึกหัด');
  return mob && !mob.alive;
}, null, { timeout: 15000 });
const afterDeath = await page.evaluate(() => window.__BUNNY_3D_DEBUG__.snapshot());
await page.screenshot({ path: fileURLToPath(new URL('training-yard-death-effect.png', outputDir)), fullPage: true });

await page.waitForFunction(() => {
  const mob = window.__BUNNY_3D_DEBUG__.snapshot().mobs.find((entry) => entry.name === 'สไลม์ฝึกหัด');
  return mob && mob.alive && mob.hp === mob.maxHp;
}, null, { timeout: 6000 });
const afterRespawn = await page.evaluate(() => window.__BUNNY_3D_DEBUG__.snapshot());

const box = await canvas.boundingBox();
if (!box) throw new Error('Three.js canvas is unavailable');
await canvas.dispatchEvent('pointerdown', {
  clientX: box.x + box.width * 0.72,
  clientY: box.y + box.height * 0.73,
  pointerId: 1,
  pointerType: 'mouse',
});
await page.waitForTimeout(100);
const afterGroundClick = await page.evaluate(() => window.__BUNNY_3D_DEBUG__.snapshot());
if (!afterGroundClick.destination) throw new Error('Click-to-move did not create a walk destination');

const report = {
  result: 'pass',
  url,
  authoritativeRoster: Object.fromEntries(expected),
  loadedRoots: initial.mobs.map(({ name, root }) => ({ name, root })),
  worldSource: initial.worldSource,
  walkableSurfaces: initial.walkableSurfaces,
  wasdDeltaX: Number((afterWasd.hero[0] - initial.hero[0]).toFixed(3)),
  slimeHpAfterFirstObservedHit: afterHit.mobs.find((entry) => entry.name === 'สไลม์ฝึกหัด')?.hp,
  slimeAliveAfterDeath: afterDeath.mobs.find((entry) => entry.name === 'สไลม์ฝึกหัด')?.alive,
  slimeHpAfterRespawn: afterRespawn.mobs.find((entry) => entry.name === 'สไลม์ฝึกหัด')?.hp,
  clickDestination: afterGroundClick.destination,
  failedLocalRequests,
  consoleErrors,
};
await writeFile(new URL('training-yard-smoke.json', outputDir), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
