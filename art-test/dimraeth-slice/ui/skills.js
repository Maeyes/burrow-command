// Split from game.js (UI). Code moved as-is; see ui/runtime.js for game-state bindings.
import { iconHtml } from '../../iso-arena-draft/iconFor.js';
import { masteryXpRequired } from '../../../src/simulation/mastery.ts';
import { WEAPON_MASTERY_MILESTONES } from '../../../src/simulation/masteryMilestones.ts';
import { inventoryItemMeta } from '../../../src/simulation/itemTagsV2.ts';
import { SKILLS_V2, skillSpCostV2 } from '../../../src/simulation/skills.ts';
import { SKILL_MODIFIERS_V2, stackedSkillModifierFraction } from '../../../src/simulation/skillModifiersV2.ts';
import { skillItemUpgradeQuote, skillUpgradeKind, availableSkillUpgradeCopies, equippedSkillItemCount, movementSkillDistanceBonus, skillCoreDamageMultiplier } from '../../../src/simulation/skillCoreService.ts';
import { WEAPON_SKILLS_BY_FAMILY_V2 } from '../../../src/simulation/skillEntitlements.ts';
import { WEAPON_PROC_RULES_V2 } from '../../../src/simulation/engine.ts';
import { MASTERY_ACTIVE_LEVELS, MASTERY_PASSIVE_SLOTS, masteryPassiveSlotCapacity } from '../../../src/simulation/masteryLoadout.ts';
import { sim, saveCharacter } from './runtime.js';
import { bindDetailModalClose, showUiError } from './shared.js';

export const masteryUi={selected:null,milestone:null};
export const MASTERY_NAMES={greatsword:'Greatsword',dagger:'Dagger',axe:'Axe',hammer:'Hammer',bow:'Bow',staff:'Staff',swordShield:'Sword + Shield'};
export const MASTERY_GLYPHS={greatsword:'⚔',dagger:'†',axe:'🪓',hammer:'🔨',bow:'🏹',staff:'✦',swordShield:'🛡'};
export const MASTERY_MILESTONE_NAMES={cleave:'Cleave',cleaveII:'Cleave II',wideCleave:'Wide Cleave',cleaveIII:'Cleave III',perfectCleave:'Perfect Cleave',doubleAttack:'Double Attack',doubleAttackII:'Double Attack II',precisionFollowup:'Precision Follow-up',criticalFollowup:'Critical Follow-up',doubleAttackIII:'Double Attack III',heavyBlow:'Heavy Blow',heavyBlowII:'Heavy Blow II',armorBreak:'Armor Break',heavyBlowIII:'Heavy Blow III',crushingArmorBreak:'Crushing Armor Break',crushingImpact:'Crushing Impact',crushingImpactII:'Crushing Impact II',concussion:'Concussion',crushingImpactIII:'Crushing Impact III',shockwave:'Shockwave',multiShot:'Multi Shot',multiShotII:'Multi Shot II',eagleEye:'Eagle Eye',piercingArrow:'Piercing Arrow',multiShotIII:'Multi Shot III',concentration:'Concentration',mobileCasting:'Mobile Casting',flowCasting:'Flow Casting',coreEcho:'Core Echo',perfectCasting:'Perfect Casting',guard:'Guard',firmGuard:'Firm Guard',counterGuard:'Counter Guard',perfectGuard:'Perfect Guard',aegisMastery:'Aegis Mastery'};
export const skillsHubUi={tab:'skills'};
export function skillLabel(id){return id?String(id).replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase()):'Empty'}
export function coreRarity(id){return id?(sim.character.skills.coreRarity?.[id]??'normal'):'normal'}
export function coreRarityIndex(id){return ['normal','good','rare','epic','legend','mythic','whiteAscended'].indexOf(coreRarity(id))}
export function coreDamageBonus(id){return Math.max(0,coreRarityIndex(id))*10}
const CORE_SKILL_DESCRIPTIONS={
  cyclone:'Spin around the caster and strike enemies inside the area.',
  thunderStorm:'Call down lightning around the selected target.',
  meteorStorm:'Strike a selected ground area with repeated meteors.',
  dash:'Dash quickly in the chosen direction.',
  blink:'Blink a longer distance in the chosen direction.',
  barrier:'Create a temporary white Barrier that absorbs incoming damage before HP.',
  frostNova:'Release a cold burst around the caster.',
  chainLightning:'Strike the selected target area with lightning.',
  fireball:'Launch a fire projectile at a single target.',
  piercingShot:'Fire a powerful physical shot at a single target.',
  groundSlam:'Smash the ground and hit enemies around the caster.',
  bladeRush:'Deliver a rapid multi-hit physical attack.',
  iceLance:'Launch a cold single-target magic attack.',
  healingPulse:'Restore a portion of the caster’s Max HP.',
  blackHole:'Pull nearby enemies toward the caster, then damage them.',
  lightningField:'Strike a selected ground area with repeated lightning hits.',
  flameTrail:'Damage enemies around the caster with repeated fire hits.',
  warCry:'Utility Skill Core. It currently has no authored damage component.',
};
export function skillDetailHtml(id){
 const s=SKILLS_V2[id];if(!s)return '<p>Skill data unavailable.</p>';
 const scaling=s.scaling==='physicalAttack'?'Physical ATK':s.scaling==='magicalAttack'?'Magical ATK':null,total=s.coefficient?Math.round(s.coefficient*100)+'% '+scaling:null;
 const targetMap={selfArea:'AoE around caster',targetArea:'AoE around target',groundArea:'Ground-targeted AoE',target:'Single target'};const target=(s.targeting?targetMap[s.targeting]:null)||'Utility';
 const desc=CORE_SKILL_DESCRIPTIONS[id]||target;
 const stats=/** @type {string[]} */([]);
 if(s.barrierMaxHpFraction)stats.push(`<span>Barrier <b>${Math.round(s.barrierMaxHpFraction*100)}% Max HP</b></span>`);
 if(s.durationMs)stats.push(`<span>Duration <b>${s.durationMs/1000}s</b></span>`);
 if(s.healMaxHpFraction)stats.push(`<span>Heal <b>${Math.round(s.healMaxHpFraction*100)}% Max HP</b></span>`);
 if(s.kind==='movement')stats.push(`<span>Travel <b>${(s.movementDistance??0)+movementSkillDistanceBonus(sim.character,id)}</b></span>`);
 if(s.radius)stats.push(`<span>AoE Radius <b>${s.radius}</b></span>`);
 if(s.range)stats.push(`<span>Range <b>${s.range}</b></span>`);
 if(s.hitCount)stats.push(`<span>Hits <b>${s.hitCount}</b></span>`);
 if(total)stats.push(`<span>Damage <b>${total}</b></span>`);
 if(s.cooldownMs)stats.push(`<span>Cooldown <b>${s.cooldownMs/1000}s</b></span>`);
 if(skillSpCostV2(s))stats.push(`<span>SP <b>${skillSpCostV2(s)}</b></span>`);
 return `<div class="skill-detail-block"><div class="skill-detail-title"><strong>${s.name}</strong><span>SKILL CORE · ${s.kind.toUpperCase()}</span></div><p>${desc}</p><small class="skill-detail-meta">${target}${s.element?' · '+s.element.toUpperCase():''}</small><div class="skill-detail-stats">${stats.join('')}</div></div>`;
}
// Weapon mastery actives are on-hit procs, not manual hotkey skills.
export const WEAPON_SKILL_TRIGGERS=[
  {level:10,text:()=>`${Math.round(WEAPON_PROC_RULES_V2.chance*100)}% chance on each basic attack`},
  {level:20,text:()=>`Every ${WEAPON_PROC_RULES_V2.everyNthHit}th basic attack`},
  {level:30,text:()=>`When the gauge fills (${WEAPON_PROC_RULES_V2.gaugeHits} basic attacks)`},
];
function masteryPassiveInstalled(family,id){
  return (sim.character.masteryLoadout?.passive??[]).some(x=>x.family===family&&x.milestoneId===id);
}
function masteryActiveAt(level){return sim.character.masteryLoadout?.active?.[level];}
function masteryWeaponSkillStatsHtml(skill,trigger){
  if(!skill)return '';
  const scale=skill.scaling==='magicalAttack'?'MATK':'ATK';
  const power=skill.coefficient?Math.round(skill.coefficient*100):0;
  const hits=Math.max(1,skill.hitCount??1);
  const perHit=hits>1&&power?Math.round(power/hits*10)/10:null;
  const icd=Math.max(trigger.level===10?WEAPON_PROC_RULES_V2.chanceIcdMs:0,(skill.cooldownMs??0)*WEAPON_PROC_RULES_V2.cooldownFloor);
  const stats=/** @type {string[]} */([]);
  if(power)stats.push(`<span><b>${power}% ${scale}</b><small>TOTAL POWER</small></span>`);
  if(hits>1)stats.push(`<span><b>${hits} HITS</b><small>${perHit}% ${scale} / HIT</small></span>`);
  if(skill.range)stats.push(`<span><b>${skill.range}</b><small>RANGE</small></span>`);
  if(skill.radius)stats.push(`<span><b>${skill.radius}</b><small>AOE RADIUS</small></span>`);
  if(skill.element)stats.push(`<span><b>${skill.element.toUpperCase()}</b><small>ELEMENT</small></span>`);
  if(icd)stats.push(`<span><b>≥ ${(icd/1000).toFixed(icd%1000?1:0)}s</b><small>PROC ICD</small></span>`);
  return `<p class="mastery-active-trigger">${trigger.text()}.</p><div class="mastery-active-stats">${stats.join('')}</div>`;
}
function masteryLoadoutSummaryHtml(){
  const c=sim.character,passive=c.masteryLoadout?.passive??[],passiveCapacity=masteryPassiveSlotCapacity(c);
  const passiveSlots=Array.from({length:MASTERY_PASSIVE_SLOTS},(_,i)=>{
    const x=passive[i],unlocked=i<passiveCapacity;
    if(x){
      const name=`${MASTERY_NAMES[x.family]} · ${MASTERY_MILESTONE_NAMES[x.milestoneId]||x.milestoneId}`;
      return `<button class="mastery-loadout-icon passive filled" data-clear-mastery-passive-family="${x.family}" data-clear-mastery-passive-id="${x.milestoneId}" title="${name} — click to remove"><span>Lv ${10*(i+1)}</span><b>${iconHtml(x.family+'_'+x.milestoneId,'mastery',MASTERY_GLYPHS[x.family])}</b></button>`;
    }
    return `<button class="mastery-loadout-icon passive ${unlocked?'empty':'locked'}" disabled title="${unlocked?'Empty passive slot':'Unlocks when any Weapon Mastery reaches Lv '+((i+1)*10)}"><span>Lv ${10*(i+1)}</span><b>${unlocked?'＋':'🔒'}</b></button>`;
  }).join('');
  const activeSlots=MASTERY_ACTIVE_LEVELS.map((lv,i)=>{
    const id=masteryActiveAt(lv),family=id?Object.keys(WEAPON_SKILLS_BY_FAMILY_V2).find(f=>WEAPON_SKILLS_BY_FAMILY_V2[f]?.[i]===id):null;
    const unlocked=['greatsword','dagger','axe','hammer','bow','staff','swordShield'].some(f=>(c.weaponMastery?.[f]?.level??1)>=lv);
    const familyName=family?MASTERY_NAMES[family]:'Mastery';
    const title=id?`${familyName} · ${SKILLS_V2[id]?.name||id} — click to remove`:(unlocked?`Empty Lv${lv} on-hit slot`:`Unlock a Lv${lv} Weapon Mastery skill first`);
    return `<button class="mastery-loadout-icon active ${id?'filled':unlocked?'empty':'locked'}" data-clear-mastery-active="${lv}" ${id?'':'disabled'} title="${title}"><span>Lv ${lv}</span><b>${id?iconHtml(id,'skill','✦'):unlocked?'＋':'🔒'}</b></button>`;
  }).join('');
  return `<section class="mastery-loadout"><div class="mastery-panel-head"><strong>MASTERY LOADOUT</strong><span>PASSIVE ${passive.length}/${passiveCapacity} · ON-HIT ${Object.keys(c.masteryLoadout?.active??{}).length}/3</span></div><div class="mastery-loadout-strip">${passiveSlots}${activeSlots}</div><p class="mastery-loadout-note">Passive capacity grows with your highest Weapon Mastery: Lv10 = 1 slot … Lv50 = 5. On-hit slots remain fixed at Lv10 / Lv20 / Lv30.</p></section>`;
}
export function weaponSkillsHtml(family,level){
  const ids=WEAPON_SKILLS_BY_FAMILY_V2[family]||[];
  return `<div class="mastery-panel-head" style="margin-top:12px"><strong>ON-HIT ACTIVE</strong><span>ONE SKILL PER MASTERY BAND</span></div>${ids.map((id,i)=>{
    const t=WEAPON_SKILL_TRIGGERS[i],unlocked=level>=t.level,installed=masteryActiveAt(t.level)===id,s=SKILLS_V2[id],status=installed?`INSTALLED · LV ${t.level}`:unlocked?`UNLOCKED · LV ${t.level}`:`LOCKED · LV ${t.level}`;
    return `<div class="mastery-detail-card mastery-active-choice ${unlocked?'unlocked':'locked'} ${installed?'equipped':''}"><div class="mastery-active-card-head"><div class="mastery-active-identity"><span>${iconHtml(id,'skill','✦')}</span><strong>${s?.name||id}</strong></div><span class="mastery-active-status">${status}</span></div><div class="mastery-active-copy">${masteryWeaponSkillStatsHtml(s,t)}</div><button class="bw-btn ${installed?'':'primary'}" data-mastery-active-family="${family}" data-mastery-active-level="${t.level}" ${unlocked?'':'disabled'}>${installed?'REMOVE':'INSTALL IN LV '+t.level}</button></div>`;
  }).join('')}`;
}
function masteryPassiveCardHtml(detail,family,unlocked,installed,passiveFull){
  if(!detail)return '';
  const status=installed?'INSTALLED':unlocked?'UNLOCKED':`LOCKED · LV ${detail.level}`;
  const label=MASTERY_MILESTONE_NAMES[detail.id]||detail.id;
  return `<div class="mastery-detail-card mastery-passive-choice ${unlocked?'unlocked':'locked'} ${installed?'equipped':''}"><div class="mastery-active-card-head"><div class="mastery-active-identity"><span>${iconHtml(family+'_'+detail.id,'mastery',MASTERY_GLYPHS[family])}</span><strong>${label}</strong></div><span class="mastery-active-status">${status}</span></div><div class="mastery-active-copy"><p class="mastery-active-trigger">${detail.description}</p><div class="mastery-active-stats"><span><b>PASSIVE</b><small>TYPE</small></span><span><b>${MASTERY_NAMES[family]}</b><small>FAMILY</small></span><span><b>LV ${detail.level}</b><small>MILESTONE</small></span></div></div><button class="bw-btn ${installed?'':'primary'}" data-toggle-mastery-passive="${detail.id}" data-passive-family="${family}" ${(unlocked&&!passiveFull)||installed?'':'disabled'}>${installed?'REMOVE PASSIVE':passiveFull?'PASSIVE SLOTS FULL':'INSTALL PASSIVE'}</button></div>`;
}
export function renderWeaponMastery(target){
  const c=sim.character,families=Object.keys(MASTERY_NAMES);
  if(!masteryUi.selected||!c.weaponMastery[masteryUi.selected])masteryUi.selected=families[0];
  const selected=masteryUi.selected,m=c.weaponMastery[selected]||{level:1,xp:0},milestones=WEAPON_MASTERY_MILESTONES[selected]||[];
  if(!masteryUi.milestone||!milestones.some(x=>x.id===masteryUi.milestone))masteryUi.milestone=(milestones.filter(x=>m.level>=x.level).at(-1)||milestones[0])?.id;
  const detail=milestones.find(x=>x.id===masteryUi.milestone)||milestones[0],unlocked=detail&&m.level>=detail.level,passiveOn=detail&&masteryPassiveInstalled(selected,detail.id),passiveCapacity=masteryPassiveSlotCapacity(c),passiveFull=!passiveOn&&(c.masteryLoadout?.passive?.length??0)>=passiveCapacity;
  target.innerHTML=`${masteryLoadoutSummaryHtml()}<div class="mastery-layout"><section class="mastery-panel"><div class="mastery-panel-head"><strong>WEAPON MASTERY</strong><span>LV PROGRESS</span></div><div class="mastery-progress-list">${families.map(f=>{const x=c.weaponMastery[f]||{level:1,xp:0},max=x.level>=50?0:masteryXpRequired(x.level),pct=x.level>=50?100:Math.min(100,max?x.xp/max*100:0);return `<button class="mastery-progress-card ${f===selected?'active':''}" data-mastery-family="${f}"><span class="mastery-family-glyph">${iconHtml(f,'family',MASTERY_GLYPHS[f])}</span><span class="mastery-family-info"><b>${MASTERY_NAMES[f]}</b><small>Lv ${x.level}</small><i><em style="width:${pct}%"></em></i><small class="mastery-xp">${x.level>=50?'MAX':Math.floor(x.xp)+' / '+max+' XP'}</small></span></button>`}).join('')}</div></section><section class="mastery-panel mastery-milestone-panel"><div class="mastery-panel-head"><strong>${MASTERY_NAMES[selected]}</strong><span>PASSIVE MILESTONES</span></div><div class="mastery-milestone-grid">${milestones.map(x=>`<button class="mastery-milestone ${m.level>=x.level?'unlocked':'locked'} ${x.id===masteryUi.milestone?'selected':''} ${masteryPassiveInstalled(selected,x.id)?'equipped':''}" data-milestone="${x.id}"><span class="mastery-level-tag">Lv ${x.level}</span><span class="mastery-milestone-glyph">${iconHtml(selected+'_'+x.id,'mastery',MASTERY_GLYPHS[selected])}</span></button>`).join('')}</div>${masteryPassiveCardHtml(detail,selected,unlocked,passiveOn,passiveFull)}${weaponSkillsHtml(selected,m.level)}</section></div>`;
  target.querySelectorAll('[data-mastery-family]').forEach(b=>b.onclick=()=>{masteryUi.selected=b.dataset.masteryFamily;masteryUi.milestone=null;renderSkillsHub();});
  target.querySelectorAll('[data-milestone]').forEach(b=>b.onclick=()=>{masteryUi.milestone=b.dataset.milestone;renderSkillsHub();});
  target.querySelector('[data-toggle-mastery-passive]')?.addEventListener('click',b=>{try{const el=b.currentTarget;sim.masteryLoadoutCommand({type:'togglePassive',family:el.dataset.passiveFamily,milestoneId:el.dataset.toggleMasteryPassive});saveCharacter?.(sim.character);renderSkillsHub();}catch(e){showUiError(String(e?.message||e));}});
  target.querySelectorAll('[data-mastery-active-family]').forEach(b=>b.onclick=()=>{try{const lv=Number(b.dataset.masteryActiveLevel),id=masteryActiveAt(lv),family=b.dataset.masteryActiveFamily,expected=WEAPON_SKILLS_BY_FAMILY_V2[family]?.[MASTERY_ACTIVE_LEVELS.indexOf(lv)];sim.masteryLoadoutCommand(id===expected?{type:'unequipActive',level:lv}:{type:'equipActive',level:lv,family});saveCharacter?.(sim.character);renderSkillsHub();}catch(e){showUiError(String(e?.message||e));}});
  target.querySelectorAll('[data-clear-mastery-passive-family]').forEach(b=>b.onclick=()=>{try{sim.masteryLoadoutCommand({type:'togglePassive',family:b.dataset.clearMasteryPassiveFamily,milestoneId:b.dataset.clearMasteryPassiveId});saveCharacter?.(sim.character);renderSkillsHub();}catch(e){showUiError(String(e?.message||e));}});
  target.querySelectorAll('[data-clear-mastery-active]').forEach(b=>b.onclick=()=>{try{sim.masteryLoadoutCommand({type:'unequipActive',level:Number(b.dataset.clearMasteryActive)});saveCharacter?.(sim.character);renderSkillsHub();}catch(e){showUiError(String(e?.message||e));}});
}
export function showSkillCorePicker(slot){const c=sim.character,modal=document.getElementById('equipment-detail-modal'),equipped=new Set(c.skills.active.filter(Boolean)),owned=Object.entries(c.inventory).filter(([id,q])=>q>0&&inventoryItemMeta(id).tags.includes('skill-core')&&SKILLS_V2[id]?.kind!=='movement'&&!equipped.has(id));modal.innerHTML=`<button class="rpg-modal-close">×</button><div class="equipment-detail-card"><div class="skill-picker-head"><strong>INSTALL SKILL CORE ${slot+1}</strong></div><div class="skill-picker-list">${owned.length?owned.map(([id,q])=>`<button data-pick-core="${id}"><b>${iconHtml(id,'skill','')}${SKILLS_V2[id]?.name||skillLabel(id)}</b><small>OWNED ×${q}</small>${skillDetailHtml(id)}</button>`).join(''):'<p>No Skill Core available.</p>'}</div></div>`;modal.hidden=false;bindDetailModalClose(modal);modal.querySelectorAll('[data-pick-core]').forEach(b=>b.onclick=()=>{sim.skillCoreCommand({type:'equipCore',coreId:b.dataset.pickCore,slot});saveCharacter?.(sim.character);modal.hidden=true;renderSkillsHub();syncHotbar();});}
function duplicateModPreview(coreId,modSlot,id){
  const mods=sim.character.skills.modifiersByActive?.[coreId]??[],other=mods[modSlot===0?1:0];
  if(other!==id)return '';
  const desc=SKILL_MODIFIERS_V2[id]?.description||'',values=[...desc.matchAll(/(\d+(?:\.\d+)?)%/g)].map(m=>Number(m[1]));
  const multiplier=skillCoreDamageMultiplier(sim.character,id);
  const summary=values.map(v=>{const base=v/100*multiplier;return `${Math.round(base*10000)/100}% → ${Math.round(stackedSkillModifierFraction([id,id],id,base)*10000)/100}%`;}).join(' · ');
  return `<em class="skill-mod-duplicate-note">DUPLICATE STACK${summary?' · '+summary:''}</em>`;
}
export function showSkillModPicker(coreId,modSlot){
 const c=sim.character,modal=document.getElementById('equipment-detail-modal');
 const existing=c.skills.modifiersByActive?.[coreId]?.[modSlot];
 const owned=Object.entries(c.inventory).filter(([id,q])=>q>0&&inventoryItemMeta(id).tags.includes('skill-modifier')&&(availableSkillUpgradeCopies(c,id)>0||existing===id));
 modal.innerHTML=`<button class="rpg-modal-close">×</button><div class="equipment-detail-card"><div class="skill-picker-head"><strong>INSTALL SKILL MOD ${modSlot+1}</strong><small>Duplicate Mods scale their own percentages multiplicatively. Equipped copies are reserved.</small></div><div class="skill-picker-list">${owned.map(([id,q])=>`<button data-pick-mod="${id}"><b>${iconHtml(id,'item','')}${SKILL_MODIFIERS_V2[id]?.name||skillLabel(id)}</b><small>AVAILABLE ×${availableSkillUpgradeCopies(c,id)}${existing===id?' · INSTALLED':''}</small><p>${SKILL_MODIFIERS_V2[id]?.description||''}</p>${duplicateModPreview(coreId,modSlot,id)}</button>`).join('')||'<p>No available Skill Mod copies.</p>'}</div></div>`;
 modal.hidden=false;bindDetailModalClose(modal);
 modal.querySelectorAll('[data-pick-mod]').forEach(b=>b.onclick=()=>{try{
  sim.skillCoreCommand({type:'equipModifier',coreId,modifierId:b.dataset.pickMod,modSlot});
  saveCharacter?.(sim.character);modal.hidden=true;renderSkillsHub();syncHotbar();
 }catch(e){showUiError(String(e?.message||e));}});
}
function showMovementCorePicker(){
 const c=sim.character,modal=document.getElementById('equipment-detail-modal');
 const owned=Object.entries(c.inventory).filter(([id,q])=>q>0&&SKILLS_V2[id]?.kind==='movement');
 modal.innerHTML=`<button class="rpg-modal-close">×</button><div class="equipment-detail-card"><div class="skill-picker-head"><strong>INSTALL MOVEMENT CORE</strong></div><div class="skill-picker-list">${owned.map(([id,q])=>`<button data-pick-movement="${id}"><b>${iconHtml(id,'skill','➤')}${SKILLS_V2[id].name}</b><small>OWNED ×${q}</small>${skillDetailHtml(id)}</button>`).join('')||'<p>No Movement Core available.</p>'}</div></div>`;
 modal.hidden=false;bindDetailModalClose(modal);
 modal.querySelectorAll('[data-pick-movement]').forEach(b=>b.onclick=()=>{try{
  sim.skillCoreCommand({type:'equipMovementCore',coreId:b.dataset.pickMovement});
  saveCharacter?.(sim.character);modal.hidden=true;renderSkillsHub();syncHotbar();
 }catch(e){showUiError(String(e?.message||e));}});
}
function showSkillUpgrade(id,kind=skillUpgradeKind(id),context={},feedback=''){
 const c=sim.character,modal=document.getElementById('equipment-detail-modal'),quote=skillItemUpgradeQuote(c,id),rarity=coreRarity(id);
 if(!kind)return;
 const owned=c.inventory[id]??0,held=equippedSkillItemCount(c,id),available=availableSkillUpgradeCopies(c,id);
 const enoughItems=Boolean(quote&&available>=quote.duplicateQty),enoughGold=Boolean(quote&&c.gold>=quote.gold),canUpgrade=enoughItems&&enoughGold;
 const title=kind==='modifier'?'SKILL MOD':kind==='movement'?'MOVEMENT CORE':'SKILL CORE';
 const name=kind==='modifier'?(SKILL_MODIFIERS_V2[id]?.name||skillLabel(id)):(SKILLS_V2[id]?.name||skillLabel(id));
 const progress=quote?(kind==='movement'
   ?`<span>TRAVEL <b>${quote.currentDistance} → ${quote.nextDistance}</b></span><small>+1 travel distance on successful upgrade</small>`
   :kind==='modifier'
   ?`<span>MOD EFFECT <b>×${quote.currentEffectMultiplier.toFixed(2)} → ×${quote.nextEffectMultiplier.toFixed(2)}</b></span><small>All authored modifier percentages scale with rarity</small>`
   :`<span>CORE DMG <b>+${Math.round(quote.currentDamageBonus*100)}% → +${Math.round(quote.nextDamageBonus*100)}%</b></span><small>Only applicable to damage-dealing Skill Cores</small>`)
   :'<strong>MAX RARITY</strong>';
 const details=kind==='modifier'
   ?`<p class="upgrade-item-description">${SKILL_MODIFIERS_V2[id]?.description||''}</p>`
   :skillDetailHtml(id);
 const change=context.coreId!==undefined
  ?'<button class="bw-btn" data-change-mod>CHANGE MOD</button>'
  :kind==='movement'?'<button class="bw-btn" data-change-movement>CHANGE MOVEMENT</button>':'';
 const required=quote?.duplicateQty??0;
 const needLabel=!enoughItems?'NOT ENOUGH DUPLICATES':!enoughGold?'NOT ENOUGH GOLD':'UPGRADE';
 modal.innerHTML=`<button class="rpg-modal-close" aria-label="Close">×</button>
 <div class="equipment-detail-card skill-core-upgrade skill-upgrade-card core-rarity-${rarity}">
  <div class="craft-success-heading">UPGRADE ${title}</div>
  <div class="skill-upgrade-layout">
   <div class="skill-upgrade-info">
    <div class="skill-upgrade-identity">
     <div class="skill-core-upgrade-icon">${iconHtml(id,kind==='modifier'?'item':'skill','✦')}</div>
     <div><h2>${name}</h2><div class="bw-chip gold">${rarity.replace('whiteAscended','White Ascended').toUpperCase()}</div></div>
    </div>
    ${details}
    ${kind==='modifier'?'<p class="bw-note">Rarity is shared by every installed copy of this Mod type.</p>':''}
   </div>
   <div class="skill-upgrade-action">
    <div class="skill-upgrade-progress">${progress}</div>
    ${feedback?`<p class="skill-upgrade-feedback" role="status">${feedback}</p>`:''}
    ${quote?`<div class="skill-upgrade-target"><strong>${quote.current.toUpperCase()} → ${quote.next.toUpperCase()}</strong><span>SUCCESS ${Math.round(quote.successRate*100)}%</span></div>
     <div class="skill-upgrade-costs">
      <div class="skill-upgrade-cost ${enoughItems?'enough':'short'}"><span>${iconHtml(id,kind==='modifier'?'item':'skill','✦')} DUPLICATE ${title}</span><strong>${available} / ${required}</strong><small>Owned: ${owned} · Reserved: ${held} (installed copies not counted)</small></div>
      <div class="skill-upgrade-cost ${enoughGold?'enough':'short'}"><span>GOLD</span><strong>${c.gold.toLocaleString()} / ${quote.gold.toLocaleString()}</strong></div>
     </div><button class="craft-button" data-upgrade-item ${canUpgrade?'':'disabled'}>${canUpgrade?'UPGRADE · '+quote.gold.toLocaleString()+' G':needLabel}</button>
     <p class="bw-note">On failure, Gold and duplicates are consumed; the equipped item and its rarity remain unchanged.</p>`
     :'<p class="skill-upgrade-max">MAX RARITY — no further upgrades</p>'}
    ${change}
   </div>
  </div>
 </div>`;
 modal.hidden=false;bindDetailModalClose(modal);
 modal.querySelector('[data-upgrade-item]')?.addEventListener('click',()=>{if(!canUpgrade)return;try{
  const command=kind==='modifier'?{type:'upgradeModifier',modifierId:id}:kind==='movement'?{type:'upgradeMovementCore',coreId:id}:{type:'upgradeCore',coreId:id};
  sim.skillCoreCommand(command);saveCharacter?.(sim.character);
  const updated=coreRarity(id),result=updated===rarity?'UPGRADE FAILED — resources consumed':'UPGRADE SUCCESS — '+updated.toUpperCase();
  showSkillUpgrade(id,kind,context,result);renderSkillsHub();syncHotbar();
 }catch(e){showUiError(String(e?.message||e));showSkillUpgrade(id,kind,context);}});
 modal.querySelector('[data-change-mod]')?.addEventListener('click',()=>showSkillModPicker(context.coreId,context.modSlot));
 modal.querySelector('[data-change-movement]')?.addEventListener('click',showMovementCorePicker);
}
export function showSkillCoreUpgrade(coreId){return showSkillUpgrade(coreId,'core');}
export function renderSkillsWindow(target){
 const s=sim.character.skills;
 target.innerHTML=`<div class="skill-core-shell"><div class="skill-core-head"><strong>SKILL CORE LOADOUT</strong><span>3 CORE · 2 MOD EACH</span></div>
  <div class="skill-core-list">${[0,1,2].map(i=>{
   const core=s.active[i],mods=core?(s.modifiersByActive[core]||[]).slice(0,2):[];
   return `<section class="skill-core-card">
    <button class="skill-core-main ${!core?'empty':'core-rarity-'+coreRarity(core)}" data-core-slot="${i}">
      <div class="skill-core-icon">${core?iconHtml(core,'skill','✦'):'＋'}</div>
      <div><small>CORE ${i+1}</small><strong>${skillLabel(core)}</strong>${core?`<em>DMG +${coreDamageBonus(core)}% · UPGRADE</em>`:''}</div>
    </button>
    <div class="skill-core-arrow">➜</div>
    <div class="skill-mods">${[0,1].map(j=>`<button class="skill-mod ${!mods[j]?'empty':'core-rarity-'+coreRarity(mods[j])}" data-mod-slot="${j}" data-mod-core="${core||''}" ${!core?'disabled':''}>
      <span>${iconHtml(mods[j],'item','◆')}</span><div><small>MOD ${j+1}</small><b>${skillLabel(mods[j])}</b>${mods[j]?`<em>Effect +${coreDamageBonus(mods[j])}% · UPGRADE</em>`:''}</div></button>`).join('')}</div>
    ${core?`<div class="skill-core-inline-detail">${skillDetailHtml(core)}</div>`:''}
   </section>`;
  }).join('')}</div>
  <div class="movement-slot-wrap"><small>MOVEMENT</small>
   <button class="movement-skill-tile ${!s.movement?'empty':'core-rarity-'+coreRarity(s.movement)}" data-movement-slot>
    <span>${s.movement?iconHtml(s.movement,'skill','➤'):'＋'}</span>
    <b>${skillLabel(s.movement)}</b>
    <small>${s.movement?`TRAVEL ${(SKILLS_V2[s.movement]?.movementDistance??0)+movementSkillDistanceBonus(sim.character,s.movement)} · UPGRADE`:'INSTALL MOVEMENT CORE'}</small>
   </button>
  </div></div>`;
 target.querySelectorAll('[data-core-slot]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.coreSlot),core=sim.character.skills.active[i];core?showSkillCoreUpgrade(core):showSkillCorePicker(i);});
 target.querySelectorAll('[data-mod-slot]').forEach(b=>b.onclick=()=>{
  const id=b.dataset.modCore,slot=Number(b.dataset.modSlot),mod=sim.character.skills.modifiersByActive?.[id]?.[slot];
  if(!id)return;
  mod?showSkillUpgrade(mod,'modifier',{coreId:id,modSlot:slot}):showSkillModPicker(id,slot);
 });
 target.querySelector('[data-movement-slot]')?.addEventListener('click',()=>{
  const move=sim.character.skills.movement;
  move?showSkillUpgrade(move,'movement'):showMovementCorePicker();
 });
}
export function renderSkillsHub(){const title=document.getElementById('game-window-title'),body=document.getElementById('game-window-body');title.textContent='Skills & Mastery';body.innerHTML=`<div class="skills-hub-tabs"><button data-skills-tab="skills" class="${skillsHubUi.tab==='skills'?'active':''}">SKILL CORE</button><button data-skills-tab="mastery" class="${skillsHubUi.tab==='mastery'?'active':''}">WEAPON MASTERY</button></div><div id="skills-hub-content"></div>`;const host=body.querySelector('#skills-hub-content');skillsHubUi.tab==='mastery'?renderWeaponMastery(host):renderSkillsWindow(host);body.querySelectorAll('[data-skills-tab]').forEach(b=>b.onclick=()=>{skillsHubUi.tab=b.dataset.skillsTab;renderSkillsHub();});}
function paintHotbarButton(button,id,{movement=false}={}){
 const label=id?(SKILLS_V2[id]?.name||skillLabel(id)):'Empty';
 button.dataset.skillId=id||'';
 button.classList.toggle('empty',!id);
 button.title=id?label:'Empty';
 let icon=button.querySelector('.hotbar-skill-icon');
 if(!icon){icon=document.createElement('span');icon.className='hotbar-skill-icon';button.insertBefore(icon,button.querySelector('kbd'));}
 icon.innerHTML=id?iconHtml(id,'skill','✦'):'';
 icon.setAttribute('aria-hidden','true');
 let cd=button.querySelector('.hotbar-cooldown-mask');if(!cd){cd=document.createElement('i');cd.className='hotbar-cooldown-mask';button.appendChild(cd);}
 let ct=button.querySelector('.hotbar-cd-text');if(!ct){ct=document.createElement('b');ct.className='hotbar-cd-text';button.appendChild(ct);}
 button.dataset.skillKind=movement?'movement':(SKILLS_V2[id]?.kind||'');
}
export function syncHotbar(){
 const skills=sim.character.skills.active;
 document.querySelectorAll('[data-hotbar-slot]').forEach((b,i)=>paintHotbarButton(b,skills[i]));
 const move=document.querySelector('[data-hotbar-movement]');if(move)paintHotbarButton(move,sim.character.skills.movement,{movement:true});
 syncHotbarCooldowns();
}
export function syncHotbarCooldowns(){
 const player=sim?.simulation?.world?.players?.get(sim.playerId);if(!player)return;
 const now=sim.simulation.clock.nowMs;
 document.querySelectorAll('[data-hotbar-slot],[data-hotbar-movement]').forEach(button=>{
  const id=button.dataset.skillId,end=id?(player.cooldowns?.[id]??0):0,remaining=Math.max(0,end-now),base=Math.max(1,SKILLS_V2[id]?.cooldownMs??remaining??1);
  const pct=Math.max(0,Math.min(1,remaining/base)),mask=button.querySelector('.hotbar-cooldown-mask'),text=button.querySelector('.hotbar-cd-text');
  button.classList.toggle('cooling',remaining>0);
  if(mask)mask.style.setProperty('--cooldown-pct',String(pct));
  if(text)text.textContent=remaining>0?(remaining/1000).toFixed(remaining<1000?1:0):'';
 });
}
export function pulseHotbarSkill(skillId){
 const button=document.querySelector(`[data-skill-id="${skillId}"]`);if(!button)return;
 button.classList.remove('skill-fired');void button.offsetWidth;button.classList.add('skill-fired');
}
