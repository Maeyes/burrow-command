// Syncs generated icon PNGs into public/assets/icons and writes the manifest used by iconFor().
// Only IDs that are authoritative in src/simulation are copied. Weapon skills are authoritative since Mastery grants them at Lv10/20/30.
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const ROOT = process.cwd();
const SRC_OUT = path.join(ROOT, 'art-test/icon-production/output');
const DEST = path.join(ROOT, 'public/assets/icons');
const MANIFEST = path.join(ROOT, 'art-test/iso-arena-draft/iconManifest.generated.js');
const REPORT = path.join(ROOT, 'art-test/icon-production/ICON_COVERAGE.md');
const check = process.argv.includes('--check');

const server = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const load = p => server.ssrLoadModule(p);
const { SKILLS_V2 } = await load('/src/simulation/skills.ts');
const { SKILL_MODIFIERS_V2 } = await load('/src/simulation/skillModifiersV2.ts');
const { EQUIPMENT_MASTER_V2 } = await load('/src/simulation/itemMasterV2.ts');
const { UTILITY_EQUIPMENT_V2 } = await load('/src/simulation/utilityEquipmentV2.ts');
const { WEAPON_MASTERY_MILESTONES } = await load('/src/simulation/masteryMilestones.ts');
const { MONSTERS_V2 } = await load('/src/simulation/monsterDataV2.ts');
const { inventoryItemMeta } = await load('/src/simulation/itemTagsV2.ts');
await server.close();

const sourceIndex = new Map();
const special = { ui: new Map(), family: new Map() };
for (const [kind, folder] of [['ui', 'UI'], ['family', 'FAMILY']]) {
  const dir = path.join(SRC_OUT, folder);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) special[kind].set(f.slice(0, -4), path.join(dir, f));
}
for (const batch of fs.readdirSync(SRC_OUT)) {
  if (batch === 'UI' || batch === 'FAMILY') continue;
  const dir = path.join(SRC_OUT, batch);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.png')) continue;
    const id = f.slice(0, -4);
    if (sourceIndex.has(id)) throw new Error(`duplicate icon id ${id}: ${sourceIndex.get(id)} and ${batch}`);
    sourceIndex.set(id, path.join(dir, f));
  }
}

const equipmentIds = [...new Set([...Object.keys(EQUIPMENT_MASTER_V2), ...Object.keys(UTILITY_EQUIPMENT_V2), 'starterDagger'])];
const skillIds = Object.values(SKILLS_V2).map(s => s.id);
const excludedWeaponSkills = [];
const masteryIds = Object.entries(WEAPON_MASTERY_MILESTONES).flatMap(([family, list]) => list.map(m => `${family}_${m.id}`));

const itemCandidates = new Map();
const addItem = (id, source) => { if (id && !itemCandidates.has(id)) itemCandidates.set(id, source); };
for (const t of Object.values(EQUIPMENT_MASTER_V2)) {
  addItem(t.recipe.blueprintId, 'recipe'); addItem(t.recipe.oreId, 'recipe');
  t.recipe.materials.forEach(m => addItem(m.itemId, 'recipe'));
}
for (const m of Object.values(MONSTERS_V2)) {
  const l = m.loot;
  [l.oreItemId, l.material?.itemId, l.aetherstone?.itemId, l.modifier?.itemId, l.blueprint?.itemId, l.unique?.itemId, l.signatureMaterial?.itemId].forEach(id => addItem(id, 'monster-loot'));
  addItem(l.core?.itemId, 'monster-loot');
}
Object.keys(SKILL_MODIFIERS_V2).forEach(id => addItem(id, 'modifier'));
['astraliteStone', 'optionStone', 'reoptionStone', 'refineProtectionLv1', 'refineProtectionLv2', 'stoneFragment', 'verdantAetherstone', 'azureAetherstone', 'violetAetherstone', 'sunforgeCore', 'leaderEmblem']
  .forEach(id => addItem(id, 'itemTagsV2'));
for (let t = 1; t <= 5; t++) addItem(`tier${t}Blueprint`, 'itemTagsV2');

const itemIds = [], itemSkipped = [];
for (const [id, source] of itemCandidates) {
  const skill = SKILLS_V2[id];
  if (skill) { (skill.kind === 'weapon' ? itemSkipped : []).push(id); continue; }
  itemIds.push({ id, source, category: inventoryItemMeta(id).category });
}

const missing = { equipment: [], items: [], skills: [], mastery: [], ui: [], family: [] };
const wired = { equipment: [], items: [], skills: [], mastery: [], ui: [], family: [] };
const uiIds = ['gear', 'craft', 'skill', 'monster', 'settings', 'potion', 'home', 'auto'];
const familyIds = Object.keys(WEAPON_MASTERY_MILESTONES);
const copy = (kind, id) => {
  const src = (special[kind] ?? sourceIndex).get(id);
  if (!src) { missing[kind].push(id); return; }
  wired[kind].push(id);
  if (check) return;
  fs.mkdirSync(path.join(DEST, kind), { recursive: true });
  fs.copyFileSync(src, path.join(DEST, kind, `${id}.png`));
};
equipmentIds.forEach(id => copy('equipment', id));
itemIds.forEach(({ id }) => copy('items', id));
skillIds.forEach(id => copy('skills', id));
masteryIds.forEach(id => copy('mastery', id));
uiIds.forEach(id => copy('ui', id));
familyIds.forEach(id => copy('family', id));

const used = new Set([...wired.equipment, ...wired.items, ...wired.skills, ...wired.mastery]);
const unused = [...sourceIndex.keys()].filter(id => !used.has(id));

if (!check) {
  fs.writeFileSync(MANIFEST, `// GENERATED by tools/sync-icons.mjs — do not edit.\nexport const ICON_ROOT='/assets/icons';\nexport const ICON_MANIFEST=${JSON.stringify(Object.fromEntries(Object.entries(wired).map(([k, v]) => [k, v.sort()])), null, 1)};\n`);
}

const byCat = itemIds.filter(x => missing.items.includes(x.id)).reduce((a, x) => ((a[x.category] ||= []).push(`${x.id} (${x.source})`), a), {});
const lines = [
  '# Icon coverage (generated by tools/sync-icons.mjs)', '',
  `Wired: equipment ${wired.equipment.length}/${equipmentIds.length}, items ${wired.items.length}/${itemIds.length}, skills ${wired.skills.length}/${skillIds.length}, mastery ${wired.mastery.length}/${masteryIds.length}, ui ${wired.ui.length}/${uiIds.length}, family ${wired.family.length}/${familyIds.length}`, '',
  '## Authoritative IDs falling back to a glyph (no PNG)', '',
  `### Equipment (${missing.equipment.length})`, missing.equipment.join(', ') || '—', '',
  `### Inventory items (${missing.items.length})`, ...Object.entries(byCat).map(([c, v]) => `- ${c}: ${v.join(', ')}`), missing.items.length ? '' : '—', '',
  `### Skills (${missing.skills.length})`, missing.skills.join(', ') || '—', '',
  `### Mastery milestones (${missing.mastery.length})`, missing.mastery.join(', ') || '—', '',
  '## Generated PNGs intentionally not wired', '',
  `Weapon skills excluded: ${excludedWeaponSkills.join(', ') || 'none'}`, '',
  `Other generated PNGs with no authoritative id: ${unused.filter(id => !excludedWeaponSkills.includes(id)).join(', ') || '—'}`, '',
];
fs.writeFileSync(REPORT, lines.join('\n'));
console.log(lines.join('\n'));
