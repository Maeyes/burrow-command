// Split from game.js (UI). Code moved as-is; see ui/runtime.js for game-state bindings.
import { MONSTERS_V2 } from '../../../src/simulation/monsterDataV2.ts';
import { EQUIPMENT_MASTER_V2 } from '../../../src/simulation/itemMasterV2.ts';
import { innateDescriptionForItem, weaponInnateBonuses } from '../../../src/simulation/weaponInnatePassives.ts';
import { iconHtml } from '../../iso-arena-draft/iconFor.js';
import { inventoryItemMeta } from '../../../src/simulation/itemTagsV2.ts';
import { enhancementRequirement, REFINE_SUCCESS, astraliteCost, progressionCategory, equipmentRarityStatMultiplier, protectionRequirement } from '../../../src/simulation/equipmentV2.ts';
import { PROTECTION_RECIPES_V2 } from '../../../src/simulation/equipmentService.ts';
import { equipmentCombatTotals, ENHANCE_GAIN_V2, REFINE_MILESTONES_V2, REFINE_MILESTONE_LEVELS_V2, refineMilestoneKind } from '../../../src/simulation/equipmentCombat.ts';
import { UTILITY_EQUIPMENT_V2 } from '../../../src/simulation/utilityEquipmentV2.ts';
import { SKILLS_V2 } from '../../../src/simulation/skills.ts';
import { SKILL_MODIFIERS_V2 } from '../../../src/simulation/skillModifiersV2.ts';
import { availableSkillUpgradeCopies, shardIdFor } from '../../../src/simulation/skillCoreService.ts';
import { sim, saveCharacter, pushRewardLine } from './runtime.js';
import { gearGlyph, inventoryCategory, itemInfo, prettyItem, showEquipmentError, showRefineResult } from './shared.js';
import { CRAFT_SET_BY_ID, craftUi, equippedSetCount } from './craft.js';
import { renderSkillsHub, skillDetailHtml, syncHotbar } from './skills.js';
import { openBasicWindow } from './windows.js';

export const equipmentUi={tab:'Gear',selectedId:null,tier:'all',slot:'all'};
export const batchDestroyUi={active:false,selected:new Set()};
/** Skill Core tab: pick items, then salvage every spare (not installed) copy of each into shards. */
export const batchSalvageUi={active:false,selected:new Set()};
export const GEAR_SLOT_FILTERS=[['all','All Parts'],['main','Main'],['offhand','Offhand'],['armor','Armor'],['cape','Cape'],['shoes','Shoes'],['accessory','Accessory'],['hat','Hat'],['face','Face'],['mouth','Mouth']];
export function gearMatchesFilter(item){const template=EQUIPMENT_MASTER_V2[item.templateId],tier=template?.tier;if(equipmentUi.tier!=='all'&&tier!==Number(equipmentUi.tier))return false;const s=equipmentUi.slot;if(s==='all')return true;if(s==='accessory')return item.slot==='accessoryLeft'||item.slot==='accessoryRight';return item.slot===s;}
// Gear / Inventory, item detail, upgrade modules and Character Status: ported verbatim from the
// arena prototype (iso-arena-draft/poc.js) so both games share one UI. Only references were renamed.
export const equipmentPanel=document.createElement('section');equipmentPanel.className='equipment-panel';equipmentPanel.hidden=true;equipmentPanel.style.zIndex='60'; // above the auto-hunt pill and HUD, below the item modal (80)
export const equipmentDetailModal=document.getElementById('equipment-detail-modal');
(document.getElementById('game-ui')||document.body).append(equipmentPanel);
// The auto-hunt pill sits in its own stacking layer; hide it while any window covers the screen.
{const win=document.getElementById('game-window');const sync=()=>{const t=document.getElementById('autohunt-toggle');if(t)t.style.visibility=equipmentPanel.hidden&&(!win||win.hidden)?'':'hidden';};
 const mo=new MutationObserver(sync);mo.observe(equipmentPanel,{attributes:true,attributeFilter:['hidden']});if(win)mo.observe(win,{attributes:true,attributeFilter:['hidden']});}
export function equipmentAction(command){
  try{
    const selectedId=equipmentUi.selectedId;
    const keepUpgradeModal=(command.type==='enhance'||command.type==='refine'||command.type==='addOption'||command.type==='reoption')&&selectedId&& !equipmentDetailModal.hidden;
    const result=sim.equipmentCommand(command);saveCharacter(sim.character);
    // Presentation state must follow the authoritative build immediately; previously it only refreshed on page load.
    if(command.type==='refine')showRefineResult(result.refineSuccess===true);
    // Keep the same item and upgrade view open after Enhance/Refine so repeated attempts need one click only.
    if((command.type==='enhance'||command.type==='refine'||command.type==='addOption'||command.type==='reoption')&&selectedId&&sim.character.equipment.instances[selectedId]){
      equipmentUi.selectedId=selectedId;renderEquipmentUi();
      const item=sim.character.equipment.instances[selectedId],detail=equipmentPanel.querySelector('.rpg-detail-panel');
      const upgradeMode=command.type==='refine'?'refine':(command.type==='addOption'||command.type==='reoption')?'option':'enhance';if(keepUpgradeModal){equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card">${upgradeHtml(item,sim.character,upgradeMode)}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;bindEquipmentActionButtons(equipmentDetailModal);}else if(detail){detail.innerHTML=upgradeHtml(item,sim.character,upgradeMode);bindEquipmentActionButtons();}
    }else{equipmentUi.selectedId=null;renderEquipmentUi();if(command.type==='equip'&&!equipmentDetailModal.hidden)equipmentDetailModal.hidden=true;}
  }catch(error){showEquipmentError(String(error?.message||error));}
}
export function gearTile(item,c,equipped=false,emptySlot=''){
  if(!item)return `<button class="rpg-gear-tile empty" data-empty-slot="${emptySlot}" title="Craft equipment for ${emptySlot}"><span class="gear-glyph">＋</span></button>`;
  // Equipped accessories can originate from the opposite accessory template; progression belongs to the occupied slot, not item.slot.
  const progressionSlot=equipped&&emptySlot?emptySlot:item.slot;
  const enhance=c.equipment.enhancementBySlot?.[progressionSlot]??0,refine=c.equipment.refinementBySlot?.[progressionSlot]??0;
  const progression=equipped?`<span class="enhance-mark">+${enhance}</span><span class="refine-mark">+${refine}</span>`:'';
  const select=batchDestroyUi.active&&!equipped,checked=select&&batchDestroyUi.selected.has(item.id);
  return `<button class="rpg-gear-tile rarity-${item.rarity} ${equipped?'equipped':''} ${checked?'batch-selected':''}" data-id="${item.id}" title="${prettyItem(item.templateId)}">${select?`<span class="batch-check">${checked?'✓':'○'}</span>`:''}${progression}<span class="gear-glyph">${iconHtml(item.templateId,'equipment',gearGlyph(item.slot))}</span></button>`;
}
export function equippedSlotForItem(item,c){return Object.entries(c.equipment.equippedBySlot).find(([,id])=>id===item.id)?.[0]??item.slot;}
const SLOT_LABEL={main:'Main',offhand:'Offhand',armor:'Armor',cape:'Cape',shoes:'Shoes',accessoryLeft:'Ring',accessoryRight:'Pendant',hat:'Hat',face:'Face',mouth:'Mouth'};
const STAT_LABEL={atk:'ATK',matk:'MATK',def:'DEF',mdef:'MDEF',maxHp:'HP',maxSp:'SP',crit:'CRIT',aspd:'ASPD',hit:'HIT',flee:'FLEE'};
// Human-readable refine milestone bonuses (numbers come from REFINE_MILESTONES_V2).
function milestoneText(b){const pct=v=>`${Math.round(v*100)}%`;return Object.entries(b).map(([k,v])=>({atkPct:`ATK/MATK +${pct(v)}`,defPct:`DEF +${pct(v)}`,mdefPct:`MDEF +${pct(v)}`,hpPct:`HP +${pct(v)}`,crit:`CRIT +${v}`,aspd:`ASPD +${v}`,hit:`HIT +${v}`,flee:`FLEE +${v}`,critDamage:`CRIT DMG +${pct(v)}`,weaponSkillDamage:`Weapon skill DMG +${pct(v)}`,coreSkillDamage:`Skill Core DMG +${pct(v)}`,coreCooldown:`Skill Core CD −${pct(v)}`,damageTaken:`Damage taken −${pct(v)}`,moveSpeed:`Move speed +${pct(v)}`,dodgeCooldown:`Dodge CD −${pct(v)}`,weaponProcChance:`Lv10 weapon skill chance +${pct(v)}`,blockChance:`Block chance +${pct(v)}`,utilityPct:`EXP/Drop ${pct(v)}`})[k]||k).join(' · ');}
function refineMilestonesHtml(slot,offhandType,refine){const steps=REFINE_MILESTONES_V2[refineMilestoneKind(slot,offhandType)];return `<ul class="bw-milestones">${REFINE_MILESTONE_LEVELS_V2.map((lv,i)=>`<li class="${refine>=lv?'on':''}"><b>+${lv}</b><span>${milestoneText(steps[i])}</span></li>`).join('')}</ul>`;}
export function itemDetailHtml(item,c,equipped){
  const slot=equipped?equippedSlotForItem(item,c):item.slot;
  const enhance=c.equipment.enhancementBySlot?.[slot]??0,refine=c.equipment.refinementBySlot?.[slot]??0,base=item.baseCombat||{},mult=equipmentRarityStatMultiplier(item.rarity);
  const utility=UTILITY_EQUIPMENT_V2[item.templateId],source=utility?Object.values(MONSTERS_V2).filter(m=>(m.loot.equipmentDrops??[]).some(d=>d.itemId===item.templateId)).map(m=>m.name).join(', '):'';
  const template=EQUIPMENT_MASTER_V2[item.templateId],name=template?.name||prettyItem(item.templateId);
  const innateDescription=innateDescriptionForItem(item),innate=weaponInnateBonuses(c);
  const innateActive=equipped&&(slot==='main'?Boolean(innate.family):item.offhandType==='shield'?innate.hasShieldEquipped:innate.dualDagger);
  const set=item.setId?CRAFT_SET_BY_ID.get(item.setId):null,setCount=set?Math.min(set.requiredPieces,equippedSetCount(item.setId,c)):0,setOn=Boolean(set&&setCount>=set.requiredPieces);
  const stats=Object.entries(base).filter(([,v])=>Number(v)!==0).map(([k,v])=>`<div><dt>${STAT_LABEL[k]||k.toUpperCase()}</dt><dd>+${Math.round(Number(v)*mult)}</dd></div>`).join('')||'<div><dt>Base stats</dt><dd>—</dd></div>';
  const chips=[template?`T${template.tier}`:null,SLOT_LABEL[item.slot]||prettyItem(item.slot),`Lv ${item.requiredLevel??1}+`,template?.role&&template.role!=='neutral'?template.role:null].filter(Boolean).map(t=>`<span class="bw-chip">${t}</span>`).join('');
  const actions=equipped
    ?`<button class="bw-btn primary" data-open-upgrade="${item.id}" data-upgrade-mode="enhance">Enhance</button><button class="bw-btn primary" data-open-upgrade="${item.id}" data-upgrade-mode="refine">Refine</button><button class="bw-btn" data-open-upgrade="${item.id}" data-upgrade-mode="option">Option</button><button class="bw-btn" data-unequip="${slot}">Unequip</button>`
    :`<button class="bw-btn primary" data-equip-now="${item.id}">Equip</button><button class="bw-btn danger" data-destroy="${item.id}">Destroy</button>`;
  return `<div class="bw-item">
   <div class="bw-item-head">${gearTile(item,c,equipped,equipped?slot:'')}<div><h3>${name}</h3><div class="bw-chips"><span class="bw-chip rarity-text rarity-${item.rarity}">${item.rarity.toUpperCase()}</span>${chips}</div></div></div>
   ${utility?`<p class="bw-note">${utility.description}</p>`:''}
   <section class="bw-block"><h4>Stats</h4><dl class="bw-stat-grid">${stats}</dl></section>
   ${innateDescription?`<section class="bw-block"><h4>Innate Passive ${equipped?`<span class="bw-count">${innateActive?'ACTIVE':'PAIR REQUIRED'}</span>`:''}</h4><p class="bw-note">${innateDescription}</p></section>`:''}
   <section class="bw-block"><h4>Options</h4><p class="${item.affixes.length?'':'bw-muted'}">${item.affixes.length?item.affixes.map(prettyItem).join(' · '):'No bonus options'}</p></section>
   ${set?`<section class="bw-block ${setOn?'bw-set-on':''}"><h4>${name.split(' ')[0]} set <span class="bw-count">${setCount}/${set.requiredPieces}</span></h4>${set.effect.map(e=>`<p class="bw-set-line">${e}</p>`).join('')}</section>`:''}
   ${equipped&&!utility?`<section class="bw-block"><h4>Progress <span class="bw-count">Enhance +${enhance} · Refine +${refine}</span></h4>${refineMilestonesHtml(slot,item.offhandType,refine)}</section>`:''}
   ${source?`<p class="bw-note">Drops from <b>${source}</b></p>`:''}
   <div class="rpg-detail-actions bw-actions">${actions}</div></div>`;
}
// Protection keeps the refine level on failure. Levels +6..+10 use Lv1, +11..+15 use Lv2.
function protectHtml(refine,c){
  if(refine>=15)return'';const req=protectionRequirement(refine+1);if(!req)return'<p class="bw-note">No protection needed below +6. A failed refine has a 50% chance to drop one level.</p>';
  const have=c.inventory[req.id]??0,enough=have>=req.qty;
  return `<label class="bw-protect ${enough?'':'off'}"><input type="checkbox" id="refine-protect" ${enough?'':'disabled'}><span>Use ${prettyItem(req.id)} ×${req.qty} <small>(have ${have})</small> — always keeps +${refine} if it fails (otherwise 50% to drop)</span></label>`;
}
function showCraftedProtection(root,level){const r=PROTECTION_RECIPES_V2[level];pushRewardLine(`ได้รับ ${prettyItem(r.outputId)} 1 ea`);const q=root.querySelector(`[data-protection-have="${level}"]`);if(q)q.textContent=String(sim.character.inventory[r.outputId]??0);renderEquipmentUi();}
export function protectionCraftHtml(id,c){
  const level=id==='stoneFragment'?1:id==='refineProtectionLv1'?2:0;if(!level)return'';const r=PROTECTION_RECIPES_V2[level],have=c.inventory[r.inputId]??0,can=have>=r.inputQty&&c.gold>=r.gold;
  return `<section class="bw-block"><h4>Craft ${prettyItem(r.outputId)} <span class="bw-count">have <b data-protection-have="${level}">${c.inventory[r.outputId]??0}</b></span></h4><p class="bw-note">${r.inputQty} ${prettyItem(r.inputId)} + ${r.gold.toLocaleString()} Gold → 1 ${prettyItem(r.outputId)}. Protection keeps your refine level when an attempt fails.</p><div class="rpg-detail-actions bw-actions"><button class="bw-btn primary" data-craft-protection="${level}" ${can?'':'disabled'}>Craft 1</button></div></section>`;
}
export function upgradeHtml(item,c,mode='enhance'){
  const slot=equippedSlotForItem(item,c),enhance=c.equipment.enhancementBySlot?.[slot]??0,refine=c.equipment.refinementBySlot?.[slot]??0;
  const nextEnhance=enhance+1,category=progressionCategory(slot,item.offhandType);
  let req=null;try{if(nextEnhance<=c.level)req=enhancementRequirement(item.baseGoldCost,nextEnhance);}catch{}
  const utilityEnhance=slot==='hat'?'EXP +0.1% (multiplicative)':slot==='face'?'Drop +0.1% (multiplicative)':slot==='mouth'?'EXP +0.05% · Drop +0.05% (multiplicative)':'Utility';
  const g=ENHANCE_GAIN_V2,enhanceGain=category==='offensive'?`ATK +${g.offensive} · MATK +${g.offensive}`:category==='defensive'?`DEF +${g.defensive} · MDEF +${g.defensive}`:utilityEnhance;
  const refineGain=category==='offensive'?'Character ATK +0.5% · MATK +0.5%':category==='defensive'?'Character DEF +0.5% · MDEF +0.5% · Max HP +0.5%':'ASPD +0.05 · Cast SPD +0.05 · CRI DMG +0.3% · Element DMG +0.3%';
  const target=refine+1,rate=refine<15?Math.round(REFINE_SUCCESS[refine]*100):0,astraliteNeed=refine<15?astraliteCost(target):0,astraliteHave=c.inventory.astraliteStone??0,canRefine=refine<15&&astraliteHave>=astraliteNeed;
  const enhanceStatus=enhance>=120?'Maximum enhancement reached':nextEnhance>c.level?`Requires Hero Lv. ${nextEnhance}`:req?`${prettyItem(req.stoneId)} ×${req.stoneQty}<br>Gold ${req.gold}`:'Enhancement unavailable';
  const tabs=`<div class="upgrade-module-tabs"><button data-switch-upgrade="enhance" class="${mode==='enhance'?'active':''}">ENHANCE</button><button data-switch-upgrade="refine" class="${mode==='refine'?'active':''}">REFINE</button><button data-switch-upgrade="option" class="${mode==='option'?'active':''}">OPTION</button></div>`;
  let body='';
  if(mode==='refine') body=`<section class="upgrade-module"><h3>REFINE</h3><div class="upgrade-level">+${refine} <i>→</i> +${Math.min(target,15)}</div><p class="upgrade-gain"><strong>Next refinement:</strong> ${refineGain}</p><p>${refine<15?`Success ${rate}%<br>Astralite ${astraliteHave} / ${astraliteNeed}`:'Maximum refinement reached'}</p>${protectHtml(refine,c)}<button data-refine="${slot}" ${canRefine?'':'disabled'}>REFINE</button></section>`;
  else if(mode==='option') body=`<section class="upgrade-module option-module"><h3>OPTIONS</h3><div class="current-options">${item.affixes.length?item.affixes.map((a,i)=>`<span><b>${i+1}</b>${prettyItem(a)}</span>`).join(''):'<p>No options yet</p>'}</div><div class="option-module-actions"><div><strong>ADD OPTION</strong><small>Option Stone · ${c.inventory.optionStone??0}</small><button data-add-option="${item.id}">ADD</button></div><div><strong>RE-OPTION</strong><small>Re-option Stone · ${c.inventory.reoptionStone??0}</small><button data-reoption="${item.id}" ${item.affixes.length?'':'disabled'}>RE-OPTION</button></div></div></section>`;
  else body=`<section class="upgrade-module"><h3>ENHANCE</h3><div class="upgrade-level">+${enhance} <i>→</i> +${Math.min(nextEnhance,120)}</div><p class="upgrade-gain"><strong>Next upgrade:</strong> ${enhanceGain}</p><p>${enhanceStatus}</p><button data-enhance="${slot}" ${req&&enhance<120?'':'disabled'}>ENHANCE</button></section>`;
  return `<button class="rpg-back" data-back-detail="${item.id}">‹ ITEM DETAIL</button><div class="upgrade-title"><strong>${prettyItem(item.templateId)}</strong><span>${prettyItem(slot)}</span></div>${tabs}<div class="upgrade-module-host">${body}</div>`;
}
export function masterRefinementCard(c){
  const gear=equipmentCombatTotals(c),levels=Object.entries(c.equipment.equippedBySlot).filter(([,id])=>Boolean(id)).map(([slot])=>c.equipment.refinementBySlot?.[slot]??0);
  const active=gear.masterRefinement,next=active<5?5:active<10?10:active<15?15:null,count=levels.filter(l=>l>=(next??15)).length;
  const bonus=active===15?'ATK/MATK +15% · HP/SP +12%':active===10?'ATK/MATK +10% · HP/SP +8%':active===5?'ATK/MATK +5% · HP/SP +5%':'Refine 6 equipped slots to +5 for ATK/MATK +5%';
  return `<div class="bw-master ${active?'on':''}"><div><strong>Master refine ${active?`+${active}`:''}</strong><span>${next?`${Math.min(count,6)}/6 at +${next}`:'Max'}</span></div><i><em style="width:${next?Math.min(100,count/6*100):100}%"></em></i><small>${bonus}</small></div>`;
}
export function renderEquipmentUi(){
  const c=sim.character,tabs=['Gear','Crafting Mat','Upgrading Mat','Blueprint','Skill Core','Quest','Misc'];
  const equippedIds=new Set(Object.values(c.equipment.equippedBySlot).filter(Boolean));
  const inventoryGear=Object.values(c.equipment.instances).filter(x=>!equippedIds.has(x.id));
  const gear=equipmentCombatTotals(c);
  const slotHtml=slot=>{const id=c.equipment.equippedBySlot[slot];return `<div class="bw-slot"><small>${SLOT_LABEL[slot]}</small>${gearTile(id&&c.equipment.instances[id],c,true,slot)}</div>`;};
  const summary=[['ATK',gear.weaponAtk],['MATK',gear.weaponMatk],['DEF',gear.equipmentDef],['MDEF',gear.equipmentMdef],['HP',gear.equipmentMaxHp],['CRIT',gear.critBonusPercent]].map(([k,v])=>`<div><dt>${k}</dt><dd>+${Math.round(v)}</dd></div>`).join('');
  const filtered=inventoryGear.filter(gearMatchesFilter);
  equipmentPanel.innerHTML=`<div class="bw-gear">
   <header class="bw-gear-head"><h2>Equipment</h2><div class="bw-chips"><span class="bw-chip">Lv. ${c.level}</span><span class="bw-chip gold">${c.gold.toLocaleString()} G</span></div><button class="rpg-modal-close bw-close" type="button" aria-label="Close">×</button></header>
   <section class="bw-doll">
    <div class="bw-card bw-equip-card">
     <div class="bw-hero-row"><div class="bw-avatar">🐰</div><strong>${c.name}</strong></div>
     <div class="bw-slot-grid">${['hat','face','mouth','armor','main','offhand','cape','shoes','accessoryLeft','accessoryRight'].map(slotHtml).join('')}</div>
    </div>
    <div class="bw-card">${masterRefinementCard(c)}<button type="button" class="bw-btn primary bw-enhance-all" data-enhance-all title="Enhance every equipped piece as far as stones, Gold and your level allow (lowest piece first)">ENHANCE ALL · MAX</button></div>
    <div class="bw-card"><h4>Gear bonus</h4><dl class="bw-stat-grid">${summary}</dl></div>
   </section>
   <section class="bw-inv">
    <nav class="bw-tabs">${tabs.map(t=>`<button data-tab="${t}" class="${equipmentUi.tab===t?'active':''}">${t}</button>`).join('')}</nav>
    ${equipmentUi.tab==='Gear'?`<div class="bw-filter-row">
      <div class="bw-seg" role="group" aria-label="Tier">${['all','1','2','3','4','5','6'].map(t=>`<button data-gear-tier="${t}" class="${equipmentUi.tier===t?'active':''}">${t==='all'?'All':'T'+t}</button>`).join('')}</div>
      <select id="gear-part-filter" aria-label="Part">${GEAR_SLOT_FILTERS.map(([id,label])=>`<option value="${id}" ${equipmentUi.slot===id?'selected':''}>${label}</option>`).join('')}</select>
      <button class="bw-link" data-batch-mode>${batchDestroyUi.active?'Cancel':'Batch destroy'}</button>
     </div>${batchDestroyUi.active?`<div class="bw-batch-bar"><span>${batchDestroyUi.selected.size} selected</span><button class="bw-link" data-select-visible>Select all shown</button><button class="bw-btn danger" data-destroy-selected ${batchDestroyUi.selected.size?'':'disabled'}>Destroy</button></div>`:''}`:''}
    ${equipmentUi.tab==='Skill Core'?`<div class="bw-filter-row"><span class="bw-note">Core ${c.inventory.coreShard??0} · Mod ${c.inventory.modShard??0} shards</span><button class="bw-link" data-salvage-mode>${batchSalvageUi.active?'Cancel':'Batch salvage'}</button></div>${batchSalvageUi.active?`<div class="bw-batch-bar"><span>${[...batchSalvageUi.selected].reduce((n,id)=>n+availableSkillUpgradeCopies(c,id),0)} spare copies selected</span><button class="bw-link" data-salvage-all-spare>Select all spare</button><button class="bw-btn danger" data-salvage-selected ${batchSalvageUi.selected.size?'':'disabled'}>Salvage</button></div>`:''}`:''}
    <div class="inventory-grid bw-grid"></div>
    <footer class="bw-inv-foot">${equipmentUi.tab==='Gear'?`${filtered.length} of ${inventoryGear.length} gear`:''}</footer>
   </section></div>`;
  const grid=equipmentPanel.querySelector('.inventory-grid');
  if(equipmentUi.tab==='Gear'){grid.innerHTML=filtered.length?filtered.map(x=>gearTile(x,c,false)).join(''):'<div class="inventory-empty">No gear matches these filters</div>';}
  else{const entries=Object.entries(c.inventory).filter(([id])=>inventoryCategory(id)===equipmentUi.tab);grid.innerHTML=entries.length?entries.map(([id,qty])=>`<button class="rpg-item-tile ${batchSalvageUi.active&&batchSalvageUi.selected.has(id)?'selected':''} ${batchSalvageUi.active&&!(shardIdFor(id)&&availableSkillUpgradeCopies(c,id)>0)?'dim':''}" data-item-info="${id}" title="${prettyItem(id)}"><span class="item-glyph">${iconHtml(id,'item','◆')}</span><b>${qty}</b></button>`).join(''):'<div class="inventory-empty">No items in this category</div>';}
  equipmentPanel.querySelector('#gear-part-filter')?.addEventListener('change',e=>{equipmentUi.slot=e.target.value;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelector('.rpg-modal-close')?.addEventListener('click',()=>equipmentPanel.hidden=true);
  equipmentPanel.querySelector('[data-salvage-mode]')?.addEventListener('click',()=>{batchSalvageUi.active=!batchSalvageUi.active;batchSalvageUi.selected.clear();renderEquipmentUi();});
  equipmentPanel.querySelector('[data-salvage-all-spare]')?.addEventListener('click',()=>{Object.keys(c.inventory).filter(id=>shardIdFor(id)&&availableSkillUpgradeCopies(c,id)>0).forEach(id=>batchSalvageUi.selected.add(id));renderEquipmentUi();});
  equipmentPanel.querySelector('[data-salvage-selected]')?.addEventListener('click',()=>{const picks=[...batchSalvageUi.selected].map(id=>[id,availableSkillUpgradeCopies(sim.character,id)]).filter(([,n])=>n>0);const total=picks.reduce((n,[,q])=>n+q,0);if(!total||!confirm(`Salvage ${total} spare copies into shards? Installed copies are kept.`))return;for(const [id,qty] of picks){try{sim.skillCoreCommand({type:'salvageSkillItem',itemId:id,qty});}catch{}}saveCharacter(sim.character);batchSalvageUi.active=false;batchSalvageUi.selected.clear();renderEquipmentUi();renderSkillsHub();});
  equipmentPanel.querySelectorAll('[data-item-info]').forEach(el=>el.onclick=()=>{if(batchSalvageUi.active){const id=el.dataset.itemInfo;if(!shardIdFor(id)||availableSkillUpgradeCopies(c,id)<1)return;if(batchSalvageUi.selected.has(id))batchSalvageUi.selected.delete(id);else batchSalvageUi.selected.add(id);renderEquipmentUi();return;}const id=el.dataset.itemInfo,qty=c.inventory[id]??0,meta=inventoryItemMeta(id),skill=SKILLS_V2[id];const mod=SKILL_MODIFIERS_V2[id];const coreActions=meta.tags.includes('skill-core')?(skill?.kind==='movement'?'<button data-equip-movement-core="'+id+'">EQUIP MOVEMENT</button>':'<div class="core-equip-actions"><button data-equip-core="'+id+'" data-core-slot="0">EQUIP CORE 1</button><button data-equip-core="'+id+'" data-core-slot="1">EQUIP CORE 2</button><button data-equip-core="'+id+'" data-core-slot="2">EQUIP CORE 3</button></div>'):'';equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card"><div class="rpg-detail-head"><div class="rpg-item-tile"><span class="item-glyph">${iconHtml(id,'item','◆')}</span></div><div><strong>${prettyItem(id)}</strong><small>${meta.category.toUpperCase()} · ×${qty}</small></div></div>${skill&&meta.tags.includes('skill-core')?skillDetailHtml(id):mod?`<div class="skill-detail-block"><div class="skill-detail-title"><strong>${mod.name}</strong><span>SKILL MOD</span></div><p>${mod.description}</p><p class="skill-formula">Equip this Mod into MOD 1 or MOD 2 of an installed Skill Core. Its effect is applied by the authoritative combat simulation.</p></div>`:`<p class="item-description">${itemInfo(id)}</p>`}${coreActions}${protectionCraftHtml(id,c)}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;bindEquipmentActionButtons(equipmentDetailModal);equipmentDetailModal.querySelectorAll('[data-equip-core]').forEach(b=>b.onclick=()=>{sim.skillCoreCommand({type:'equipCore',coreId:b.dataset.equipCore,slot:Number(b.dataset.coreSlot)});saveCharacter(sim.character);equipmentDetailModal.hidden=true;syncHotbar();renderEquipmentUi();renderSkillsHub();});equipmentDetailModal.querySelectorAll('[data-equip-movement-core]').forEach(b=>b.onclick=()=>{sim.skillCoreCommand({type:'equipMovementCore',coreId:b.dataset.equipMovementCore});saveCharacter(sim.character);equipmentDetailModal.hidden=true;syncHotbar();renderEquipmentUi();});});
  equipmentPanel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{equipmentDetailModal.hidden=true;equipmentDetailModal.replaceChildren();equipmentUi.tab=b.dataset.tab;equipmentUi.selectedId=null;batchSalvageUi.active=false;batchSalvageUi.selected.clear();renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-gear-tier]').forEach(b=>b.onclick=()=>{equipmentUi.tier=b.dataset.gearTier;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-gear-slot]').forEach(b=>b.onclick=()=>{equipmentUi.slot=b.dataset.gearSlot;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelector('[data-batch-mode]')?.addEventListener('click',()=>{batchDestroyUi.active=!batchDestroyUi.active;batchDestroyUi.selected.clear();equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelector('[data-select-visible]')?.addEventListener('click',()=>{inventoryGear.filter(gearMatchesFilter).forEach(x=>batchDestroyUi.selected.add(x.id));renderEquipmentUi();});
  equipmentPanel.querySelector('[data-destroy-selected]')?.addEventListener('click',()=>{const ids=[...batchDestroyUi.selected].filter(id=>sim.character.equipment.instances[id]);if(!ids.length)return;if(!confirm(`Destroy ${ids.length} selected gear? This cannot be undone.`))return;let destroyed=0;for(const id of ids){try{sim.equipmentCommand({type:'dismantle',equipmentId:id});destroyed++;}catch{}}saveCharacter(sim.character);batchDestroyUi.selected.clear();batchDestroyUi.active=false;pushRewardLine(`Destroyed ${destroyed} gear`);renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-empty-slot]').forEach(el=>el.onclick=()=>{const slot=el.dataset.emptySlot;craftUi.type=slot==='main'?'Weapon':slot==='offhand'?'Offhand':slot==='armor'?'Armor':slot==='cape'?'Cape':slot==='shoes'?'Shoes':slot==='accessoryLeft'||slot==='accessoryRight'?'Accessory':'Weapon';equipmentPanel.hidden=true;openBasicWindow('Craft');});
  equipmentPanel.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>{if(batchDestroyUi.active){const id=el.dataset.id;if(batchDestroyUi.selected.has(id))batchDestroyUi.selected.delete(id);else batchDestroyUi.selected.add(id);renderEquipmentUi();return;}equipmentUi.selectedId=el.dataset.id;const item=c.equipment.instances[equipmentUi.selectedId];if(!item)return;equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card">${itemDetailHtml(item,c,equippedIds.has(item.id))}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;bindEquipmentActionButtons(equipmentDetailModal);});
  equipmentPanel.querySelector('[data-enhance-all]')?.addEventListener('click',()=>{
    try{
      const res=sim.equipmentCommand({type:'enhanceAll'});saveCharacter(sim.character);
      const total=Object.values(res.enhanced??{}).reduce((a,b)=>a+b,0);
      pushRewardLine(`Enhance All: +${total} levels on ${Object.keys(res.enhanced??{}).length} pieces · ${(res.goldSpent??0).toLocaleString()} G`,'#ffd45c');
      renderEquipmentUi();
    }catch(e){const m=String(e?.message||e);showEquipmentError(m==='nothing-to-enhance'?'Nothing to enhance: every piece is at your level or stones/Gold ran out':m);}
  });
  bindEquipmentActionButtons();
}
export function confirmDestroyEquipment(itemId,root=equipmentPanel){
  const item=sim.character.equipment.instances[itemId];if(!item)return;
  const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');if(!host)return;
  host.innerHTML=`<div class="destroy-confirm"><strong>Are you sure you want to destroy?</strong><p>${prettyItem(item.templateId)} will be permanently destroyed.</p><div class="rpg-detail-actions"><button data-confirm-destroy="${item.id}">YES</button><button data-cancel-destroy="${item.id}">NO</button></div></div>`;
  host.querySelector('[data-cancel-destroy]')?.addEventListener('click',()=>{host.innerHTML=itemDetailHtml(item,sim.character,false);bindEquipmentActionButtons(root);});
  host.querySelector('[data-confirm-destroy]')?.addEventListener('click',()=>{
    try{
      sim.equipmentCommand({type:'dismantle',equipmentId:item.id});saveCharacter(sim.character);
      host.innerHTML='<div class="destroy-confirm destroyed"><strong>DESTROYED</strong></div>';
      equipmentUi.selectedId=null;renderEquipmentUi();
      setTimeout(()=>{if(root===equipmentDetailModal)equipmentDetailModal.hidden=true;},550);
    }catch(error){showEquipmentError(String(error?.message||error));}
  });
}

export function bindEquipmentActionButtons(root=equipmentPanel){
  root.querySelectorAll('[data-equip-now]').forEach(b=>b.onclick=()=>{const id=b.dataset.equipNow,item=sim.character.equipment.instances[id];if(item&&(item.slot==='accessoryLeft'||item.slot==='accessoryRight')){const slots=sim.character.equipment.equippedBySlot;const target=!slots.accessoryLeft?'accessoryLeft':!slots.accessoryRight?'accessoryRight':item.slot;equipmentAction({type:'equip',equipmentId:id,targetSlot:target});}else equipmentAction({type:'equip',equipmentId:id});});
  root.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>equipmentAction({type:'unequip',slot:b.dataset.unequip}));
  root.querySelectorAll('[data-destroy]').forEach(b=>b.onclick=()=>confirmDestroyEquipment(b.dataset.destroy,root));
  root.querySelectorAll('[data-open-upgrade]').forEach(b=>b.onclick=()=>{const item=sim.character.equipment.instances[b.dataset.openUpgrade];const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=upgradeHtml(item,sim.character,b.dataset.upgradeMode||'enhance');bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-switch-upgrade]').forEach(b=>b.onclick=()=>{const itemId=equipmentUi.selectedId;const item=sim.character.equipment.instances[itemId];if(!item)return;const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=upgradeHtml(item,sim.character,b.dataset.switchUpgrade);bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-back-detail]').forEach(b=>b.onclick=()=>{const item=sim.character.equipment.instances[b.dataset.backDetail];const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=itemDetailHtml(item,sim.character,true);bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-enhance]').forEach(b=>b.onclick=()=>equipmentAction({type:'enhance',slot:b.dataset.enhance}));
  root.querySelectorAll('[data-refine]').forEach(b=>b.onclick=()=>equipmentAction({type:'refine',slot:b.dataset.refine,protectedAttempt:Boolean(root.querySelector('#refine-protect')?.checked)}));
  root.querySelectorAll('[data-craft-protection]').forEach(b=>b.onclick=()=>{try{sim.equipmentCommand({type:'craftProtection',level:Number(b.dataset.craftProtection)});saveCharacter(sim.character);showCraftedProtection(root,b.dataset.craftProtection);}catch(e){showEquipmentError(String(e?.message||e));}});
  root.querySelectorAll('[data-add-option]').forEach(b=>b.onclick=()=>equipmentAction({type:'addOption',equipmentId:b.dataset.addOption}));
  root.querySelectorAll('[data-reoption]').forEach(b=>b.onclick=()=>equipmentAction({type:'reoption',equipmentId:b.dataset.reoption,lockedIndexes:[]}));
}
