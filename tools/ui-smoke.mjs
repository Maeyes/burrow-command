// UI smoke test for the main game: opens every window and walks the core loop
// (craft -> equip -> enhance -> refine -> allocate stats -> inspect items -> fight -> loot).
// Usage: node tools/ui-smoke.mjs [baseUrl]   (default http://localhost:5173; needs `npm run dev`)
import { chromium } from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';

const baseUrl = process.argv[2] ?? 'http://localhost:5173';
const SAVE_KEY = 'bunny-world-character-v2';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

// Fresh, well-funded character on the starter map so every action has what it needs.
await page.goto(`${baseUrl}/art-test/dimraeth-slice/`);
await page.evaluate(k => localStorage.removeItem(k), SAVE_KEY);
await page.reload();
await page.waitForFunction(() => window.__combat, null, { timeout: 120000 });
await page.evaluate(k => {
  const c = window.__combat.sim.character;
  const funded = { ...c, gold: 1e6, inventory: { ...c.inventory, tier1Blueprint: 5, copperOre: 50, livingMoss: 50, brutalSpore: 50, verdantAetherstone: 20, astraliteStone: 20, fireball: 1, stoneFragment: 12 } };
  localStorage.setItem(k, JSON.stringify(funded));
}, SAVE_KEY);
await page.reload();
await page.waitForFunction(() => window.__combat?.sim.character.gold >= 1e6, null, { timeout: 120000 });
check('game boots on forest1', await page.evaluate(() => window.__combat.mapId) === 'forest1');

const open = name => page.click(`.quick-menu [data-window="${name}"]`);
const modal = page.locator('#equipment-detail-modal');

// Craft -> success card -> equip
await open('Craft');
await page.click('#game-window-body [data-craft-recipe="mosswoodSword"]');
await page.click('#game-window-body [data-craft-now]');
check('craft shows success card', await modal.locator('.craft-success-heading').isVisible());
const crafted = await modal.locator('[data-equip-now]').getAttribute('data-equip-now');
await modal.locator('[data-equip-now]').click();
check('crafted item equips', await page.evaluate(id => window.__combat.sim.character.equipment.equippedBySlot.main === id, crafted));

// Gear panel -> equipped item -> enhance and refine
await page.keyboard.press('Escape');
await open('Inventory');
check('gear panel opens', await page.locator('.equipment-panel').isVisible());
await page.click(`.equipment-panel [data-id="${crafted}"]`);
check('item modal has actions', (await modal.locator('.rpg-detail-actions button').allTextContents()).join('|').toUpperCase() === 'ENHANCE|REFINE|OPTION|UNEQUIP');
await modal.locator('[data-upgrade-mode="enhance"]').click();
await modal.locator('[data-enhance]').click();
check('enhance +1 and saved', await page.evaluate(k => JSON.parse(localStorage.getItem(k)).equipment.enhancementBySlot.main === 1, SAVE_KEY));
await modal.locator('[data-switch-upgrade="refine"]').click();
await modal.locator('[data-refine]').click();
check('refine consumes astralite', await page.evaluate(() => window.__combat.sim.character.inventory.astraliteStone === 19));

// Inventory item detail
await page.keyboard.press('Escape');
await page.click('.equipment-panel [data-tab="Upgrading Mat"]');
await page.click('.equipment-panel [data-item-info="astraliteStone"]');
check('inventory item shows detail', await modal.locator('.item-description, .rpg-detail-head').first().isVisible());
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

// Dismantle fragments -> refine protection (inventory item detail)
await open('Inventory');
await page.click('.equipment-panel [data-tab="Upgrading Mat"]');
await page.click('.equipment-panel [data-item-info="stoneFragment"]');
await modal.locator('[data-craft-protection="1"]').click();
check('fragments craft a protection stone', await page.evaluate(() => { const i = window.__combat.sim.character.inventory; return i.refineProtectionLv1 === 1 && i.stoneFragment === 2; }));
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

// Character status: + buttons, confirm, saved
await page.click('#character-hud');
const plus = await page.locator('#game-window-body [data-stat-plus]').count();
await page.click('#game-window-body [data-stat-plus="str"]');
await page.waitForTimeout(400);
await page.click('#stats-confirm');
check('status has 6 + buttons', plus === 6, `found ${plus}`);
check('stat point saved', await page.evaluate(k => JSON.parse(localStorage.getItem(k)).stats.str === 2, SAVE_KEY));

// Every other window renders something
for (const name of ['Skills', 'Monster Index', 'Settings']) {
  await open(name);
  check(`${name} window renders`, (await page.locator('#game-window-body').innerText()).trim().length > 20);
}
await page.keyboard.press('Escape');

// Fight: damage numbers and loot go through the game's event presenter
const fought = await page.evaluate(() => {
  const c = window.__combat, sp = c.sim.simulation.world.players.get(c.sim.playerId);
  const a = c.actors.find(x => !x.dead), m = c.sim.simulation.world.monsters.get(a.view.id);
  m.position = { x: sp.position.x + 30, y: sp.position.y }; m.hp = 1; sp.nextBasicAttackAtMs = 0;
  c.sim.setGmEventMultipliers({ drop: 10 });
  const before = document.querySelectorAll('#reward-feed div').length;
  c.presentCombatEvents(c.sim.basicAttack(a.view.id).events);
  return { killed: !m.alive, feed: document.querySelectorAll('#reward-feed div').length - before };
});
check('kill posts reward lines', fought.killed && fought.feed > 0, JSON.stringify(fought));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? `  (${r.detail})` : ''}`);
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
