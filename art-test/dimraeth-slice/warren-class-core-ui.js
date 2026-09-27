// Uses the same core/mod/item definitions, duplicate costs and slot contract as Bunny World.
import {CLASS_IDS,CLASS_FAMILIES,classWeaponMasterySkills,MASTERY_ACTIVE_LEVELS} from './warren-progression.js';
import {WEAPON_SKILLS_BY_FAMILY_V2} from '../../src/simulation/skillEntitlements.ts';
import {CLASS_CORE_UNLOCK,CLASS_MOD_UNLOCKS,classSkillProxy,classSkillQuote} from './warren-class-cores.js';
import {SKILLS_V2} from '../../src/simulation/skills.ts';
import {SKILL_MODIFIERS_V2} from '../../src/simulation/skillModifiersV2.ts';
import {SKILL_CORE_RARITIES,modsForSlot,availableSkillUpgradeCopies,skillUpgradeKind,shardIdFor,SHARD_EXCHANGE_COST} from '../../src/simulation/skillCoreService.ts';
import {esc,gameIcon} from './warren-ui.js';
const tierName=id=>SKILL_CORE_RARITIES.includes(id)?id:'normal';
const fmt=n=>Number(n||0).toLocaleString();
const select=(attribute,value,choices,disabled=false)=>'<select '+attribute+' '+(disabled?'disabled':'')+'><option value="">— ว่าง —</option>'+
 choices.map(([id,label])=>'<option value="'+esc(id)+'" '+(id===value?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>';
function upgrade(s,cls,id){
 const quote=classSkillQuote(s,cls,id);
 if(!quote)return '<span class="bc-help">ระดับสูงสุดแล้ว</span>';
 const able=s.gold>=quote.gold&&quote.shardsOwned>=quote.shardsNeeded&&!s.night;
 return '<div class="bc-core-upgrade"><span>'+esc(tierName(quote.current))+' → '+esc(quote.next)+' · '+Math.round(quote.successRate*100)+'% · '+
  fmt(quote.gold)+' Gold · สำเนา '+quote.useDuplicates+'/'+quote.duplicateQty+
  (quote.shardsNeeded?' · '+(quote.kind==='modifier'?'Mod':'Core')+' Shards '+quote.shardsOwned+'/'+quote.shardsNeeded:'')+
  '</span><button data-skill-upgrade="'+esc(id)+'" '+(!able?'disabled':'')+'>อัปเกรด '+esc(id)+'</button></div>';
}
export function renderClassCoreHtml(s,classes){
 const cls=CLASS_IDS.includes(s.coreClass)?s.coreClass:'guard',unlocked=s.warren>=CLASS_CORE_UNLOCK,
  state=classSkillProxy(s,cls),skills=state.skills;
 const tabs=CLASS_IDS.map(key=>'<button data-core-class="'+key+'" class="'+(cls===key?'active':'')+'">'+
  gameIcon(CLASS_FAMILIES[key],'family',classes[key].icon,'bc-class-icon')+' '+esc(classes[key].name)+'</button>').join('');
 const coreChoices=Object.values(SKILLS_V2).filter(d=>['active','passive'].includes(d.kind)&&
  (!d.compatibleWeaponFamilies?.length||d.compatibleWeaponFamilies.includes(CLASS_FAMILIES[cls]))&&
  (state.inventory[d.id]||0)>0);
 const modChoices=Object.values(SKILL_MODIFIERS_V2).filter(d=>(state.inventory[d.id]||0)>0);
 const cards=[0,1,2].map(slot=>{
  const coreId=skills.active?.[slot]||null,core=SKILLS_V2[coreId]||null,mods=modsForSlot(state,slot);
  const options=coreChoices.filter(d=>d.id===coreId||!skills.active.includes(d.id))
   .map(d=>[d.id,d.name+' ×'+state.inventory[d.id]]);
  if(core&&!options.some(([id])=>id===coreId))options.unshift([coreId,core.name]);
  const picked=select('data-core-choose="'+slot+'" aria-label="Skill Core '+(slot+1)+'"',coreId,options,!unlocked||s.night);
  const modifierHtml=CLASS_MOD_UNLOCKS.map((level,j)=>{
   const modId=mods[j],mod=SKILL_MODIFIERS_V2[modId],locked=s.warren<level;
   const available=modChoices.filter(d=>d.id===modId||availableSkillUpgradeCopies(state,d.id)>0)
    .map(d=>[d.id,d.name+' ×'+state.inventory[d.id]]);
   if(mod&&!available.some(([id])=>id===modId))available.unshift([modId,mod.name]);
   return '<div class="bc-core-mod"><b>Mod '+(j+1)+' '+(locked?'🔒 Warren Lv '+level:'')+'</b>'+
    select('data-mod-choose="'+slot+':'+j+'" aria-label="Skill Mod '+(j+1)+'"',modId,available,locked||!core||s.night)+
    (mod?'<small>'+esc(mod.description)+'</small>'+upgrade(s,cls,modId):'<small>'+(locked?'ยังไม่ปลดล็อก':'เลือก Skill Mod ที่ได้รับจากมอนสเตอร์')+'</small>')+'</div>';
  }).join('');
  return '<section class="bc-core-card"><div class="bc-core-large-icon">'+(core?gameIcon(coreId,'skill','✦'):'◇')+'</div><div class="bc-core-content">'+
   '<h3>Skill Core '+(slot+1)+(core?' · '+esc(core.name):'')+'</h3>'+picked+
   (core?'<p>'+esc(core.name)+' · '+(core.scaling?Math.round(core.coefficient*100)+'% '+esc(core.scaling):core.barrierMaxHpFraction?'Barrier '+Math.round(core.barrierMaxHpFraction*100)+'% Max HP':core.healMaxHpFraction?'Heal '+Math.round(core.healMaxHpFraction*100)+'% Max HP':'Utility')+
    ' · Cooldown '+((core.cooldownMs||0)/1000)+'s</p>'+upgrade(s,cls,coreId):
    '<p>ดรอป Skill Core จากมอนสเตอร์ก่อนจึงสวมใส่ได้</p>')+
   '<div class="bc-core-mods">'+modifierHtml+'</div></div></section>';
 }).join('');
 const movement=skills.movement,moveChoices=Object.values(SKILLS_V2)
  .filter(d=>d.kind==='movement'&&(state.inventory[d.id]||0)>0).map(d=>[d.id,d.name+' ×'+state.inventory[d.id]]);
 if(movement&&!moveChoices.some(([id])=>id===movement))moveChoices.unshift([movement,SKILLS_V2[movement]?.name||movement]);
 const movementHtml='<section class="bc-core-card"><div class="bc-core-large-icon">➤</div><div class="bc-core-content"><h3>Movement Core</h3>'+
  select('data-movement-choose aria-label="Movement Core"',movement,moveChoices,!unlocked||s.night)+
  (movement?upgrade(s,cls,movement):'<p>Dash / Blink ใช้ช่องแยกตามเกมหลัก</p>')+'</div></section>';
 const knownItems=Object.keys(s.inventory||{}).filter(id=>skillUpgradeKind(id)&&
  (state.inventory[id]??0)>=0).sort();
 const masterySlots=classWeaponMasterySkills(s,cls),masterySkills=WEAPON_SKILLS_BY_FAMILY_V2[CLASS_FAMILIES[cls]]||[];
 const masteryHtml='<section class="bc-mastery-actives"><h3>Weapon Mastery Active · ไม่ใช้ช่อง Skill Core</h3>'+
  '<p class="bc-help">สกิลอาวุธที่ปลดล็อกจาก Mastery Lv10/20/30 จะทำงานอัตโนมัติเมื่อโจมตีปกติ</p>'+
  masterySkills.map((id,index)=>'<div class="bc-mastery-active '+(masterySlots[index]?'unlocked':'')+'">'+
   gameIcon(id,'skill','✦','bc-master-art')+'<div><b>Lv '+MASTERY_ACTIVE_LEVELS[index]+' · '+esc(SKILLS_V2[id].name)+'</b>'+
   '<p>'+(masterySlots[index]?'ใช้งานอยู่':s.mastery?.[cls]?.unlocked?.includes(MASTERY_ACTIVE_LEVELS[index])?'ปิดอยู่':'ยังไม่ปลดล็อก')+
   ' · '+((SKILLS_V2[id].cooldownMs||0)/1000)+'s</p></div></div>').join('')+
  '<button data-open-mastery="'+cls+'">จัดการ Weapon Mastery</button></section>';
 const recycling='<details class="bc-core-recycling"><summary>♻ Skill Core / Mod Shards · ย่อยสำเนาและแลกไอเทมที่เคยพบ</summary>'+
  '<p class="bc-help">สำเนาที่ติดตั้งอยู่กับคลาสอื่นจะถูกกันไว้ด้วย · ย่อยหนึ่งชิ้นได้ 1 Shard · แลกไอเทมที่เคยพบใช้ '+
  SHARD_EXCHANGE_COST+' Shards (กฎเดียวกับเกมหลัก)</p>'+
  knownItems.map(id=>{
   const free=availableSkillUpgradeCopies(state,id),shard=shardIdFor(id),stock=s.inventory?.[shard]||0;
   return '<div class="bc-core-recycle-row"><b>'+esc(SKILLS_V2[id]?.name||SKILL_MODIFIERS_V2[id]?.name||id)+'</b>'+
    '<span>ว่าง '+free+' · '+esc(shard)+' '+stock+'</span>'+
    '<button data-skill-salvage="'+esc(id)+'" '+(!unlocked||s.night||free<1?'disabled':'')+'>ย่อย 1</button>'+
    '<button data-skill-exchange="'+esc(id)+'" '+(!unlocked||s.night||stock<SHARD_EXCHANGE_COST?'disabled':'')+'>แลก '+SHARD_EXCHANGE_COST+' Shards</button></div>';
  }).join('')+
  '<p class="bc-help">Core Shards '+fmt(s.inventory?.coreShard)+' · Mod Shards '+fmt(s.inventory?.modShard)+'</p></details>';
 return '<header class="bc-modal-header"><div><span class="bc-core-icon">✦</span><span><h2>Class Skill Core</h2>' +
  '<small>SKILLS_V2 · 3 Core Slots · 2 Mods ต่อ Core · Movement แยก · ของใช้ร่วมกันทุกคลาส</small></span></div>'+
  '<button data-modal-close aria-label="ปิด Skill Core">✕</button></header>'+
  '<div class="bc-modal-body bc-core-body"><nav class="bc-class-tabs" aria-label="เลือกคลาส Skill Core">'+tabs+'</nav>'+
  '<p class="bc-help">ปลดล็อก Core เมื่อ Warren Lv '+CLASS_CORE_UNLOCK+' · Mod 1 Lv '+CLASS_MOD_UNLOCKS[0]+
  ' · Mod 2 Lv '+CLASS_MOD_UNLOCKS[1]+'. ระบบสวมใส่และตี Rarity ใช้กฎเดียวกับเกมหลัก ของที่ดรอปใช้ร่วมกันทุกคลาส'+
  (unlocked?'':' · 🔒 ยังไม่ถึงระดับปลดล็อก')+'</p>'+cards+movementHtml+
  masteryHtml+recycling+'<p class="bc-help">อัปเกรดใช้สำเนา/Shard และ Gold ตามกฎ Skill Core ของเกมหลัก ไม่ได้เพิ่มสกิลพิเศษเฉพาะ Burrow</p></div>';
}
