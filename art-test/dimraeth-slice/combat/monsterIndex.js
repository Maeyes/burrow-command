// Monster Index window for the unified Dimraeth game page.
// Data comes straight from MONSTERS_V2, so new maps/monsters appear without UI changes.
// Art comes from the roster modules; monsters without art yet show a "?" tile.
import { MONSTERS_V2 } from '../../../src/simulation/monsterDataV2.ts';
import { UNIVERSAL_ORE_CHANCE, UNIVERSAL_ASTRALITE_CHANCE } from '../../../src/simulation/loot.ts';
import { UTILITY_EQUIPMENT_V2 } from '../../../src/simulation/utilityEquipmentV2.ts';
import { monsterBaseExpV2 } from '../../../src/simulation/rewards.ts';
import { equipmentCombatTotals } from '../../../src/simulation/equipmentCombat.ts';
import { iconHtml } from '../../iso-arena-draft/iconFor.js';
import { presentationForMonsterId } from './rosters.js';
import { MAP_ORDER_V2, mapTitleV2 } from '../../../src/simulation/mapNames.ts';

const mapLabel = mapTitleV2;
const ui = { map: null, selected: null };
let previewRaf = 0;

const baseExp = monsterBaseExpV2;
const pct = chance => `${(chance * 100).toFixed(chance < .01 ? 2 : 1).replace(/\.0$/, '')}%`;
const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function dropRows(m) {
  const l = m.loot;
  return [
    [l.oreItemId, UNIVERSAL_ORE_CHANCE], ['astraliteStone', UNIVERSAL_ASTRALITE_CHANCE],
    l.material && [l.material.itemId, l.material.chance], l.aetherstone && [l.aetherstone.itemId, l.aetherstone.chance],
    l.modifier && [l.modifier.itemId, l.modifier.chance], l.core && [l.core.itemId, l.core.chance],
    l.blueprint && [l.blueprint.itemId, l.blueprint.chance], l.unique && [l.unique.itemId, l.unique.chance],
    l.signatureMaterial && [l.signatureMaterial.itemId, l.signatureMaterial.chance],
    ...(l.equipmentDrops ?? []).map(x => [x.itemId, x.chance]),
  ].filter(Boolean);
}

function spriteHtml(id, large = false) {
  const view = presentationForMonsterId(id), cls = `monster-index-sprite${large ? ' large' : ''}`;
  if (!view) return `<span class="${cls} missing"></span>`;
  if (view.kind === 'sheet') return `<span class="${cls} sheet" data-preview-kind="sheet" data-preview-count="${view.count}"><img src="${view.sheetSrc}" alt="" onerror="this.parentElement.classList.add('missing')"></span>`;
  return `<span class="${cls}" data-preview-kind="frames" data-preview-id="${id}" data-preview-count="${view.count}"><img src="${view.frameSrc(0)}" alt="" onerror="this.parentElement.classList.add('missing')"></span>`;
}

function startPreview(win, body) {
  cancelAnimationFrame(previewRaf);
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const frameSrc = new Map();
  let shown = -1;
  const tick = now => {
    if (win.hidden || !body.querySelector('.monster-index')) return;
    const step = Math.floor(now / 160);
    if (step !== shown) {
      shown = step;
      body.querySelectorAll('[data-preview-kind]').forEach(node => {
        if (node.classList.contains('missing')) return;
        const index = step % (Number(node.dataset.previewCount) || 1);
        if (node.dataset.previewKind === 'sheet') { node.style.setProperty('--preview-frame', String(index)); return; }
        const id = node.dataset.previewId;
        if (!frameSrc.has(id)) frameSrc.set(id, presentationForMonsterId(id)?.frameSrc);
        const img = node.querySelector('img'), src = frameSrc.get(id);
        if (img && src) img.src = src(index);
      });
    }
    previewRaf = requestAnimationFrame(tick);
  };
  previewRaf = requestAnimationFrame(tick);
}

export function renderMonsterIndex({ win, title, body, character, currentMapId, itemInfo, prettyItem }) {
  title.textContent = 'Monster Index';
  try {
    const all = Object.values(MONSTERS_V2);
    const known = MAP_ORDER_V2;
    const maps = [...new Set(all.map(m => m.mapId))].sort((a, b) => (known.indexOf(a) + 1 || 99) - (known.indexOf(b) + 1 || 99));
    if (!maps.includes(ui.map)) ui.map = maps.includes(currentMapId) ? currentMapId : maps[0];
    const roster = all.filter(m => m.mapId === ui.map).sort((a, b) => a.level - b.level);
    const selected = roster.find(m => m.id === ui.selected) || roster[0];
    ui.selected = selected?.id ?? null;

    const gear = equipmentCombatTotals(character), dropBonus = gear.dropMultiplier - 1, expBonus = gear.expMultiplier - 1;
    const info = id => {
      const u = UTILITY_EQUIPMENT_V2[id];
      return u ? `${u.description} ${Object.entries(u.baseCombat).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')}` : itemInfo(id);
    };
    const exp = selected ? baseExp(selected) : 0;
    const profile = selected ? `
      <div class="monster-profile-hero">${spriteHtml(selected.id, true)}<div><small>MONSTER PROFILE</small><h2>${selected.name}</h2></div></div>
      <div class="monster-profile-tags"><span>LV ${selected.level}</span><span>${selected.rank.toUpperCase()}</span><span>${mapLabel(selected.mapId)}</span></div>
      <div class="monster-stats"><div>HP <b>${selected.maxHp}</b></div><div>ATK <b>${selected.atk}</b></div><div>DEF <b>${selected.def}</b></div><div>MDEF <b>${selected.mdef}</b></div><div>FLEE <b>${selected.flee}</b></div></div>
      <div class="monster-loot-row"><span>EXP</span><b>${exp}</b>${expBonus > 0 ? `<em style="color:#ff9d3d"> +${Math.round(exp * expBonus)} (${(expBonus * 100).toFixed(1)}%)</em>` : ''}</div>
      <h3>LOOT TABLE</h3>
      <div class="monster-loot">
        <div class="monster-loot-row"><span>Gold</span><b>${selected.loot.goldMin}–${selected.loot.goldMax}</b></div>
        ${dropRows(selected).map(([id, chance]) => {
          const bonus = chance * dropBonus, text = info(id);
          return `<div class="monster-loot-row" title="${escapeAttr(text)}"><span>${iconHtml(id, 'drop', '')}${prettyItem(id)}</span><b>${pct(chance)}</b>${bonus > 0 ? `<em style="color:#ff9d3d"> +${(bonus * 100).toFixed(bonus < .001 ? 3 : 2)}%</em>` : ''}<small>${text}</small></div>`;
        }).join('')}
      </div>` : 'No monster data for this map yet.';

    body.innerHTML = `<div class="monster-index">
      <div class="monster-index-maps">${maps.map(id => `<button data-monster-map="${id}" class="${ui.map === id ? 'active' : ''}">${mapLabel(id)}</button>`).join('')}</div>
      <div class="monster-index-body">
        <section class="monster-index-list">${roster.map(m => `<button data-monster-id="${m.id}" class="${selected?.id === m.id ? 'active' : ''}">${spriteHtml(m.id)}<span><strong>${m.name}</strong><small>Lv.${m.level} · ${m.rank.toUpperCase()}</small></span></button>`).join('')}</section>
        <section class="monster-profile">${profile}</section>
      </div></div>`;

    const rerender = () => renderMonsterIndex({ win, title, body, character, currentMapId, itemInfo, prettyItem });
    body.querySelectorAll('[data-monster-map]').forEach(b => b.onclick = () => { ui.map = b.dataset.monsterMap; ui.selected = null; rerender(); });
    body.querySelectorAll('[data-monster-id]').forEach(b => b.onclick = () => { ui.selected = b.dataset.monsterId; rerender(); });
    startPreview(win, body);
  } catch (error) {
    console.error('Monster Index render failed', error);
    body.innerHTML = `<div class="monster-index-error"><strong>MONSTER INDEX ERROR</strong><p>${String(error?.message || error)}</p></div>`;
  }
}
