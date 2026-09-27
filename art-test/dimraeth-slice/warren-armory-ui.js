// Burrow Command's single-screen Class Armory. Legacy RPG windows remain importable for regression tests.
import {esc,itemLabel,gameIcon,renderItemDetailHtml,armoryGearIcon} from './warren-ui.js';
import {dismantleFragments} from '../../src/simulation/equipmentV2.ts';
import {renderBatchHtml} from './warren-extra-ui.js';
import {craftStatSummary,renderCraftPreview} from './warren-craft-preview.js';
import {CLASS_IDS,CLASS_FAMILIES,GEAR_SLOTS,AUTO_DISMANTLE_RARITIES,
 availableRecipes,buildFor,canCraft,equippedGearIds,gearSlot,gearScore,
 EQUIPMENT_MASTER_V2,unlockedTier,classProgress,fieldClassCap}
 from './warren-progression.js';

const SLOTS={weapon:'⚔ Weapon',armor:'🛡 Armor',accessory:'💍 Accessory'};
const RARITY_NAMES={normal:'Normal',good:'Good',rare:'Rare',epic:'Epic',legend:'Legend',mythic:'Mythic',whiteAscended:'White Ascended'};
const label=x=>RARITY_NAMES[x]||x;
const img=(id,kind='equipment')=>gameIcon(id,kind,'◈','bc-recipe-icon');
const fmt=n=>Number(n||0).toLocaleString();
function classTabs(s,classes){
 return '<nav class="bc-class-tabs" aria-label="เลือกคลาส">'+CLASS_IDS.map(cls=>
  '<button data-forge-class="'+cls+'" class="'+(s.forgeClass===cls?'active':'')+'">'+
  gameIcon(CLASS_FAMILIES[cls],'family',classes[cls].icon,'bc-class-icon')+
  '<span>'+esc(classes[cls].name)+'</span></button>').join('')+'</nav>';
}
function craftPanel(s,classes){
 const cls=s.forgeClass,slot=s.armorySlot||'weapon';
 const recipes=availableRecipes(s,cls).filter(t=>gearSlot(t.id)===slot);
 const selected=recipes.find(x=>x.id===s.armoryRecipe)||recipes[0];
 const prefs=s.autoDismantle?.[cls]||{enabled:false,minRarity:'normal',protectOtherClasses:true};
 const list=recipes.map(t=>'<button class="bc-armory-recipe '+(selected?.id===t.id?'active':'')+
  '" data-armory-recipe="'+esc(t.id)+'">'+img(t.id)+
  '<span><b>'+esc(t.name)+'</b><small>T'+t.tier+' · '+esc(craftStatSummary(t))+'</small><small>'+fmt(t.recipe.gold)+' Gold / ชิ้น</small></span></button>').join('');
 const r=selected?.recipe,req=r?[[r.blueprintId,1],[r.oreId,r.oreQty],...r.materials.map(m=>[m.itemId,m.qty])]:[];
 const craftable=r?Math.max(0,Math.min(50,Math.floor(s.gold/r.gold),...req.map(([id,n])=>Math.floor((s.inventory[id]||0)/n)))):0;
 const materials=req.map(([id,n])=>'<span class="'+((s.inventory[id]||0)>=n?'have':'missing')+'">'+
  gameIcon(id,'item','•','bc-material-icon')+esc(itemLabel(id))+' '+fmt(s.inventory[id])+'/'+fmt(n)+'</span>').join('');
 const options=AUTO_DISMANTLE_RARITIES.map((key,i)=>'<option value="'+key+'" '+(prefs.minRarity===key?'selected':'')+'>'+
  (i===0?'เก็บทั้งหมด':label(key)+' ขึ้นไป')+'</option>').join('');
  return '<section class="bc-armory-work"><h3>คราฟต์ '+SLOTS[slot]+' ให้ '+esc(classes[cls].name)+'</h3>'+
  '<div class="bc-armory-recipes">'+(list||'<p class="bc-empty">ยังไม่มีสูตรที่ใช้ได้กับช่องนี้</p>')+'</div>'+
  (selected?renderCraftPreview(s,selected,classes)+'<div class="bc-craft-cost"><strong>วัตถุดิบที่ต้องใช้ / ชิ้น · '+fmt(r.gold)+' Gold</strong><div class="bc-materials bc-craft-materials">'+materials+'</div>'+
  '<small class="bc-craft-capacity">'+(s.night?'คราฟต์ได้เฉพาะกลางวัน':craftable?'วัตถุดิบและ Gold ตอนนี้เพียงพอสำหรับ '+craftable+' ชิ้น':'วัตถุดิบหรือ Gold ยังไม่พอสำหรับชิ้นนี้')+'</small></div>':'')+
  '<div class="bc-armory-qty"><strong>จำนวนที่คราฟต์</strong><nav class="bc-batch-filters">'+
  [1,10,20,50].map(n=>'<button data-batch-qty="'+n+'" class="'+((s.batchQty||1)===n?'active':'')+'">×'+n+'</button>').join('')+
  '</nav></div>'+
  '<fieldset class="bc-auto-settings"><legend>Auto Dismantle</legend>'+
  '<label class="bc-auto-toggle"><input type="checkbox" data-auto-enabled '+(prefs.enabled?'checked':'')+'> เปิดย่อยอัตโนมัติหลังคราฟต์</label>'+
  '<label class="bc-auto-select">เก็บอุปกรณ์ขั้นต่ำ <select data-auto-rarity aria-label="Rarity ขั้นต่ำที่จะเก็บ">'+options+'</select></label>'+
  '<label class="bc-auto-toggle"><input type="checkbox" data-auto-protect '+(prefs.protectOtherClasses?'checked':'')+
  '> ป้องกันชิ้นที่ Smart Recommendation แนะนำให้คลาสอื่น</label>'+
  '<p class="bc-help">ตั้งค่านี้จำแยกตามคลาส · ไอเทมล็อกและที่สวมใส่อยู่จะไม่ถูกย่อย · ไม่สวมของใหม่ให้อัตโนมัติ</p></fieldset>'+
  '<div class="bc-armory-primary"><button class="bc-primary" data-forge-craft="'+esc(selected?.id||'')+'" '+
  (!selected||s.night||!canCraft(s,selected.id)?'disabled':'')+'>⚒ คราฟต์ ×'+(s.batchQty||1)+
  (prefs.enabled?' · Auto Dismantle':'')+'</button>'+
  (s.batchReport&&s.batchClass===cls?'<button type="button" class="bc-results-link" data-armory-show-results>↓ ดูผลคราฟต์ล่าสุด</button>':'')+
  '</div></section>';
}
// Only current-class, current-slot and currently visible rarity items can be batch-salvaged.
// The same predicate is used by the UI and by the click handler before the atomic transaction.
export function visibleArmoryInventory(s){
 const cls=s.forgeClass||'guard',slot=s.armorySlot||'weapon',used=equippedGearIds(s);
 const rarity=s.armoryInventoryRarity||'all';
 return s.gear.filter(p=>!used.has(p.id)&&gearSlot(p.templateId)===slot&&
  (slot!=='weapon'||EQUIPMENT_MASTER_V2[p.templateId]?.weaponFamily===CLASS_FAMILIES[cls])&&
  EQUIPMENT_MASTER_V2[p.templateId]?.tier<=unlockedTier(s.warren))
  .filter(p=>rarity==='all'||p.rarity===rarity)
  .sort((a,b)=>gearScore(b,cls)-gearScore(a,cls));
}
function inventoryPanel(s,classes){
 const slot=s.armorySlot||'weapon',rarity=s.armoryInventoryRarity||'all',eligible=visibleArmoryInventory(s);
 const selected=new Set(s.armoryInventorySelection||[]),chosen=eligible.filter(p=>!p.locked&&selected.has(p.id));
 const selectable=eligible.filter(p=>!p.locked);
 const fragmentPreview=chosen.reduce((n,p)=>n+dismantleFragments(p.rarity),0);
 const rarityFilters=['all',...AUTO_DISMANTLE_RARITIES].map(key=>
  '<button class="'+(rarity===key?'active':'')+'" data-armory-rarity="'+key+'">'+(key==='all'?'ทั้งหมด':label(key))+'</button>').join('');
 return '<section class="bc-armory-work"><h3>เลือก '+SLOTS[slot]+' จากคลัง</h3>'+
  '<p class="bc-help">คลังแสดงเฉพาะอุปกรณ์ที่ยังไม่ได้สวมใส่ · ของที่สวมอยู่ดูได้จากช่องอุปกรณ์ของแต่ละคลาส</p>'+
  '<nav class="bc-batch-filters">'+rarityFilters+'</nav>'+
  '<div class="bc-armory-salvage-bar"><span>เลือกย่อย '+chosen.length+' / '+selectable.length+' ชิ้น'+
  (chosen.length?' · จะได้รับ '+fragmentPreview+' Stone Fragments':'')+'</span>'+
  '<button data-armory-select-all '+(s.night||!selectable.length?'disabled':'')+'>'+
  (selectable.length&&selectable.every(p=>selected.has(p.id))?'ยกเลิกทั้งหมด':'เลือกทั้งหมดที่ย่อยได้')+'</button>'+
  '<button class="bc-armory-salvage-action" data-armory-dismantle '+(s.night||!chosen.length?'disabled':'')+'>♻ ย่อยที่เลือก ('+chosen.length+')</button></div>'+
  '<div class="bc-inventory-grid">'+
  (eligible.map(p=>'<article class="bc-inventory-piece rarity-'+p.rarity+'">'+armoryGearIcon(p)+
   '<b>'+esc(itemLabel(p.templateId))+'</b><small>'+label(p.rarity)+'</small>'+
   '<button data-open-item="'+esc(p.id)+'">ดู / เลือกใส่</button>'+
   '<label class="bc-armory-select-label"><input type="checkbox" data-armory-select="'+esc(p.id)+'" '+
   (selected.has(p.id)?'checked':'')+(p.locked||s.night?' disabled':'')+'> เลือกย่อย</label>'+
   '<label><input type="checkbox" data-batch-lock="'+esc(p.id)+'" '+(p.locked?'checked':'')+
   (s.night?' disabled':'')+'> 🔒 ล็อก</label></article>').join('')||
   '<p class="bc-empty">ไม่มีอุปกรณ์ที่ตรงกับคลาส ช่อง และ Rarity นี้</p>')+'</div></section>';
}
export function renderArmoryHtml(s,classes){
 const cls=s.forgeClass||'guard',slot=s.armorySlot||'weapon',units=s.units.filter(u=>u.cls===cls),
  currentId=buildFor(s,cls)?.gear[slot],piece=s.gear.find(p=>p.id===currentId),progress=classProgress(s,cls,slot);
 const towerCount=s.towers.filter(t=>t.garrison?.cls===cls).length,tab=s.armoryTab||'craft';
 const slots=GEAR_SLOTS.map(key=>{
  const id=buildFor(s,cls)?.gear[key],p=s.gear.find(x=>x.id===id),v=classProgress(s,cls,key);
  return '<button data-armory-slot="'+key+'" class="bc-armory-slot '+(key===slot?'active':'')+'">'+SLOTS[key]+
   '<span>'+(p?'T'+EQUIPMENT_MASTER_V2[p.templateId].tier+' '+label(p.rarity)+' '+esc(EQUIPMENT_MASTER_V2[p.templateId].name):'ช่องว่าง')+'</span>'+
   '<small><span class="bc-enhance-text">E +'+v.enhance+'</span> · <span class="bc-refine-text">R +'+v.refine+'</span></small></button>';
 }).join('');
 let view='';
 if(tab==='inventory')view=inventoryPanel(s,classes);
 else if(tab==='upgrade')view=piece?'<section class="bc-armory-work">'+
  renderItemDetailHtml(s,piece.id,classes,{embedded:true})+'</section>':
  '<p class="bc-empty">ช่องนี้ยังว่าง เลือกจากคลังหรือคราฟต์ก่อน</p>';
 else view=craftPanel(s,classes);
 const detail=s.itemDetailId&&s.gear.some(p=>p.id===s.itemDetailId)?
  '<section class="bc-armory-detail"><h3>รายละเอียด / เลือกสวมใส่</h3>'+renderItemDetailHtml(s,s.itemDetailId,classes,{embedded:true})+'</section>':'';
 const results=s.batchReport&&s.batchClass===cls?renderBatchHtml(s,classes,true):'';
 return '<header class="bc-modal-header"><div>'+gameIcon('gear','ui','◈','bc-header-icon')+
  '<span><h2>Class Armory · '+esc(classes[cls].name)+'</h2><small>เลือกคลาส → ช่อง → คราฟต์ / คลัง / อัปเกรด → เปรียบเทียบและเลือกใส่</small></span></div>'+
  '<button class="modal-close" data-modal-close aria-label="ปิด">✕</button></header>'+
  '<div class="bc-modal-body bc-armory-body">'+classTabs(s,classes)+
  '<div class="bc-armory-summary"><b>'+esc(classes[cls].name)+'</b><span>ภาคพื้นดิน '+units.length+'/'+fieldClassCap(s.warren)+
  (['archer','mage'].includes(cls)?' · ประจำป้อม '+towerCount+' ตัว':'')+'</span></div>'+
  '<details class="bc-armory-roster"><summary>สมาชิกคลาสนี้ · '+units.length+' ตัว</summary>'+
  units.map(u=>'<div class="bc-armory-member">'+gameIcon(CLASS_FAMILIES[cls],'family',classes[cls].icon,'bc-class-icon')+
   '<b>'+esc(u.name)+'</b> Lv '+u.level+' · EXP '+u.exp+
   ' <button data-rename="'+u.id+'">✎ เปลี่ยนชื่อ</button></div>').join('')+'</details>'+
  '<nav class="bc-armory-slots" aria-label="เลือกช่องอุปกรณ์">'+slots+'</nav>'+
  '<div class="bc-armory-current">'+(piece?armoryGearIcon(piece,progress):'<span class="bc-armory-empty-icon">＋</span>')+
  '<div><b>'+(piece?'T'+EQUIPMENT_MASTER_V2[piece.templateId].tier+' '+label(piece.rarity)+' '+esc(EQUIPMENT_MASTER_V2[piece.templateId].name):'ยังไม่ได้ใส่ '+SLOTS[slot])+'</b>'+
  '<small><span class="bc-enhance-text">Enhance +'+progress.enhance+'</span> · <span class="bc-refine-text">Refine +'+progress.refine+'</span> (ติดช่อง Armory ไม่ติดไอเทม)</small></div>'+
  '<button data-armory-tab="upgrade" '+(!piece?'disabled':'')+'>อัปเกรดช่อง</button></div>'+
  (s.armoryNotice?'<p role="status" class="bc-armory-notice">'+esc(s.armoryNotice)+'</p>':'')+
  '<div class="bc-inline-actions bc-armory-toolbar">'+
  [['craft','⚒ คราฟต์ของใหม่'],['inventory','🎒 เลือกจากคลัง'],['upgrade','⬆ อัปเกรด']].map(([key,name])=>
   '<button data-armory-tab="'+key+'" class="'+(tab===key?'active':'')+'">'+name+'</button>').join('')+
  '<button id="enhanceAll" '+(s.night?'disabled':'')+'>Enhance All Max</button>'+
  '<button data-open-mastery="'+cls+'">✦ Mastery</button></div>'+
  detail+view+results+'</div>';
}
