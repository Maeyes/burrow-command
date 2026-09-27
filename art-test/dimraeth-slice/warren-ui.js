// Burrow Command: four focused RPG windows instead of one giant forge panel.
// All graphics reuse the MAIN GAME icon manifest and the loaded Blessed Bunny sprite.
import { iconFor } from '../iso-arena-draft/iconFor.js';
import { CLASS_FAMILIES, CLASS_IDS, GEAR_SLOTS, AUTO_DISMANTLE_RARITIES, availableRecipes, buildFor, canCraft, equippedGearIds, gearSlot, gearScore, EQUIPMENT_MASTER_V2, unlockedTier, refineQuote, classProgress, MAX_FIELD_PER_CLASS } from './warren-progression.js';
import { enhancementRequirement, EQUIPMENT_RARITY_STAT_MULTIPLIER } from '../../src/simulation/equipmentV2.ts';
import { inventoryItemMeta } from '../../src/simulation/itemTagsV2.ts';

export const esc=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const itemLabel=id=>{const t=EQUIPMENT_MASTER_V2[id];return t?`T${t.tier} ${t.name}`:String(id).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,x=>x.toUpperCase());};
const qty=(s,id)=>(s.inventory[id]||0);
const SLOT_NAMES={weapon:'อาวุธ',armor:'เกราะ',accessory:'เครื่องประดับ'};
const RARITY_NAMES={normal:'Normal',good:'Good',rare:'Rare',epic:'Epic',legend:'Legend',mythic:'Mythic',whiteAscended:'White Ascended'};
const attr=id=>esc(id);
const closeButton='<button class="modal-close" data-modal-close aria-label="ปิดหน้าต่าง" title="ปิด">✕</button>';
export function gameIcon(id,kind='item',fallback='◆',cls='bc-icon'){
 const raw=iconFor(id,kind);
 // Main game's ICON_ROOT is root-relative; rebase for /burrow-command/ standalone builds.
 const src=raw?import.meta.env.BASE_URL+raw.replace(/^\//,''):null;
 return src?`<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" draggable="false">`:`<span class="${cls} bc-icon-fallback">${esc(fallback)}</span>`;
}
const classIcon=(cls,classes,sz='bc-class-icon')=>gameIcon(CLASS_FAMILIES[cls],'family',classes[cls].icon,sz);
const sprite=s=>s.heroPortrait?`<img class="bc-bunny-sprite" src="${esc(s.heroPortrait)}" alt="Blessed Bunny" draggable="false">`:'<span class="bc-bunny-fallback">🐰</span>';
const itemName=p=>`${itemLabel(p.templateId)} +${p.enhance||0}${p.refine?' · ✦'+p.refine:''}`;
const itemIcon=p=>gameIcon(p.templateId,'equipment','◈');
// Tier belongs to the item; Enhance/Refine belong to the equipped Class Armory slot.
export function armoryGearIcon(piece,slotProgress=null,{large=false}={}){
 const tier=EQUIPMENT_MASTER_V2[piece.templateId]?.tier??'?';
 return `<span class="${large?'bc-item-show':'bc-item-icon'} bc-gear-icon rarity-${esc(piece.rarity)}">${gameIcon(piece.templateId,'equipment','◈',large?'bc-item-art':'bc-gear-art')}`+
  `<span class="bc-gear-badge bc-gear-tier" title="Equipment Tier">T${tier}</span>`+
  (slotProgress?`<span class="bc-gear-badge bc-gear-enhance" title="Enhance ของช่อง">+${slotProgress.enhance}</span>`+
   `<span class="bc-gear-badge bc-gear-refine" title="Refine ของช่อง">+${slotProgress.refine}</span>`:'')+'</span>';
}
const itemCard=(p,extra='',s=null)=>{const owner=s&&CLASS_IDS.flatMap(cls=>GEAR_SLOTS.map(slot=>({cls,slot}))).find(x=>buildFor(s,x.cls)?.gear[x.slot]===p.id),v=owner?classProgress(s,owner.cls,owner.slot):null;
 return `${armoryGearIcon(p,v)}${extra}`;};
const title=(icon,name,sub)=>`<header class="bc-modal-header"><div>${gameIcon(icon,'ui','◆','bc-header-icon')}<span><h2>${name}</h2><small>${sub}</small></span></div>${closeButton}</header>`;
const classTabs=(s,classes)=>`<nav class="bc-class-tabs" aria-label="เลือกคลาส">${CLASS_IDS.map(cls=>`<button data-forge-class="${cls}" class="${s.forgeClass===cls?'active':''}">${classIcon(cls,classes)}<span>${esc(classes[cls].name)}</span></button>`).join('')}</nav>`;
export function renderSquadHtml(s,classes){
 return s.units.map(u=>`<button class="bc-mini-hero ${u.down?'down':''}" data-hero-unit="${u.id}" title="${esc(u.name)} · Lv ${u.level} · เปิดหน้าจัดการกระต่าย">${classIcon(u.cls,classes)}<span>${esc(u.name)} <small>Lv${u.level}</small></span></button>`).join('');
}
export function renderForgeHtml(s,classes){
 const cls=s.forgeClass;
 const rows=availableRecipes(s,cls).map(t=>{
  const r=t.recipe;
  const mats=[[r.blueprintId,1],[r.oreId,r.oreQty],...r.materials.map(m=>[m.itemId,m.qty])];
  return `<article class="bc-recipe ${canCraft(s,t.id)?'ready':''}">${gameIcon(t.id,'equipment','◈','bc-recipe-icon')}
    <div class="bc-recipe-info"><b>${esc(t.name)} <small>T${t.tier}</small></b>
     <div class="bc-materials">${mats.map(([id,n])=>`<span class="${qty(s,id)>=n?'have':'missing'}">${gameIcon(id,'item','•','bc-material-icon')}${esc(itemLabel(id))} ${qty(s,id)}/${n}</span>`).join('')}</div>
    </div><div class="bc-recipe-action"><small>${r.gold} G / ชิ้น</small><button data-forge-craft="${t.id}" ${s.night||!canCraft(s,t.id)?'disabled':''}>⚒ คราฟต์ ×${s.batchQty||1}</button></div>
   </article>`;
 }).join('');
 return `${title('craft','โรงตีเหล็ก','คราฟต์อุปกรณ์จากสูตรและวัตถุดิบใน Bunny World · Gold '+s.gold.toLocaleString())}
 <div class="bc-modal-body">${classTabs(s,classes)}
 <p class="bc-help">เลือกคลาสก่อนคราฟต์ · Tier ${unlockedTier(s.warren)} · คราฟต์หลายชิ้นเพื่อหา Rarity แล้วเปรียบเทียบก่อนเปลี่ยนอุปกรณ์</p>
 <nav class="bc-batch-filters">${[1,10,20,50].map(n=>`<button data-batch-qty="${n}" class="${(s.batchQty||1)===n?'active':''}">×${n}</button>`).join('')}</nav>
 <div class="bc-recipe-list">${rows||'<p class="bc-empty">ยังไม่มีสูตรที่ปลดล็อก</p>'}</div></div>`;
}
export function renderHeroHtml(s,classes){
 const cls=s.forgeClass||'guard',units=s.units.filter(u=>u.cls===cls),selected=units.find(u=>u.id===s.heroUnitId)||units[0];
 const build=buildFor(s,cls),towerCount=s.towers.filter(t=>t.garrison?.cls===cls).length;
 const cards=units.map(u=>`<button class="bc-hero-pick ${u.id===selected?.id?'active':''}" data-hero-unit="${u.id}">
    ${classIcon(u.cls,classes)}<span>${esc(u.name)}<small>Lv ${u.level} · EXP ${u.exp}/${14+u.level*8}${u.down?' · ล้ม':''}</small></span></button>`).join('');
 const slots=GEAR_SLOTS.map(slot=>{
  const id=build?.gear[slot],piece=s.gear.find(p=>p.id===id),v=classProgress(s,cls,slot);
  return `<div class="bc-equip-slot"><small>${SLOT_NAMES[slot]} · Enhance +${v.enhance} · Refine +${v.refine}</small>
   ${piece?`<button data-open-item="${piece.id}" class="bc-equipped rarity-${piece.rarity}">${itemCard(piece,`<span><b>${esc(itemLabel(piece.templateId))}</b><small>${RARITY_NAMES[piece.rarity]} · กดดู Enhance / Refine</small></span>`,s)}</button>`:
  `<button class="bc-equipped empty" data-open-inventory="equipment">＋ <span>ช่องว่าง · เลือกจากคลัง</span></button>`}</div>`;
 }).join('');
 return `${title('gear','Class Armory','หนึ่งคลาสใช้ของชุดเดียวกัน · กระต่ายแต่ละตัวเพิ่มเลเวลได้เอง')}
 <div class="bc-modal-body">${classTabs(s,classes)}
 <div class="bc-armory-summary"><b>${esc(classes[cls].name)}</b><span>กระต่ายภาคพื้นดิน ${units.length}/${MAX_FIELD_PER_CLASS}${['archer','mage'].includes(cls)?` · ประจำป้อม ${towerCount} ตัว`:''}</span></div>
 ${selected?`<div class="bc-profile"><div class="bc-sprite-stage">${sprite(s)}</div>
  <div><h3>${esc(selected.name)} <button class="bc-rename" data-rename="${selected.id}">✎</button></h3>
   <span>${classIcon(cls,classes)} ${esc(classes[cls].name)}</span><p>Lv ${selected.level} · HP ${Math.ceil(selected.hp)}/${selected.maxHp} · ATK ${Math.round(selected.atk*10)/10}</p>
   <div class="bc-exp"><i style="width:${Math.min(100,100*selected.exp/(14+selected.level*8))}%"></i></div>
   <small>EXP ${selected.exp}/${14+selected.level*8} · เพดาน Lv ${s.warren*3}</small></div></div>`:''}
 <div class="bc-hero-roster-inline">${cards||'<p class="bc-help">ยังไม่มีสมาชิกภาคพื้นดินในคลาสนี้</p>'}</div>
 <section class="bc-build-panel"><h3>อุปกรณ์ส่วนกลางของ ${esc(classes[cls].name)}</h3>
 <p class="bc-help">เมื่อเปลี่ยนของ กระต่ายทุกตัวในคลาสและทหารประจำป้อมใช้ของใหม่ทันที ระดับตีบวกติดช่อง ไม่ติดตัวไอเทม</p>
 <div class="bc-equipped-list">${slots}</div>
 <div class="bc-inline-actions"><button id="forgeAuto" ${s.night?'disabled':''}>✨ จัดอุปกรณ์อัตโนมัติ</button>
 <button id="enhanceAll" ${s.night?'disabled':''}>⚒ Enhance All Max</button>
 <button data-open-inventory="equipment">🎒 เลือกอุปกรณ์จากคลัง</button>
 <button data-open-mastery="${cls}">✦ Mastery</button></div></section></div>`;
}
export function renderInventoryHtml(s,classes){
 const tabs=['All','equipment','Crafting Mat','Upgrading Mat','Blueprint','Skill Core','Quest','Misc'];
 const filter=s.inventoryFilter||'All',used=equippedGearIds(s);
 const gear=filter==='All'||filter==='equipment'?s.gear.filter(p=>!used.has(p.id)).map(p=>`<div class="bc-inventory-piece"><button class="bc-inventory-equip" data-open-item="${p.id}" title="${esc(itemLabel(p.templateId))}">${itemCard(p,'',s)}
   <b>${esc(itemLabel(p.templateId))}</b><small>${RARITY_NAMES[p.rarity]}</small></button>
   <label><input type="checkbox" data-batch-lock="${p.id}" ${p.locked?'checked':''} ${s.night?'disabled':''}> ล็อกเก็บไว้</label></div>`).join(''):'';
 const goods=Object.entries(s.inventory).filter(([id,n])=>n>0&&(filter==='All'||filter===inventoryItemMeta(id).category))
  .sort((a,b)=>a[0].localeCompare(b[0])).map(([id,n])=>`<div class="bc-inventory-piece">
  ${gameIcon(id,'drop','◆','bc-item-icon')}<b>${esc(itemLabel(id))}</b><small>${esc(inventoryItemMeta(id).category)} · ×${n}</small></div>`).join('');
 return `${title('gear','คลังเก็บของ',`กำลังเลือกให้ ${esc(classes?.[s.forgeClass]?.name||s.forgeClass||'guard')} · ไอเทมจากมอนสเตอร์และอุปกรณ์ที่คราฟต์แล้ว`)}
 <div class="bc-modal-body">${classes?classTabs(s,classes):''}<nav class="bc-inventory-tabs">${tabs.map(t=>`<button data-inventory-filter="${esc(t)}" class="${filter===t?'active':''}">${t==='All'?'ทั้งหมด':t==='equipment'?'อุปกรณ์':esc(t)}</button>`).join('')}</nav>
 <div class="bc-inventory-grid">${gear}${goods||(!gear?'<p class="bc-empty">ไม่มีไอเทมในหมวดนี้</p>':'')}</div></div>`;
}
const statNames={atk:'ATK',matk:'MATK',def:'DEF',mdef:'MDEF',maxHp:'HP',crit:'CRI',aspd:'ASPD',hit:'HIT',flee:'FLEE'};
export function renderItemDetailHtml(s,itemId,classes){
 const p=s.gear.find(i=>i.id===itemId);if(!p)return '';
 const t=EQUIPMENT_MASTER_V2[p.templateId],slot=gearSlot(p.templateId),eq=[];
 for(const cls of CLASS_IDS)for(const b of s.builds[cls]||[])for(const sl of GEAR_SLOTS)if(b.gear[sl]===p.id)eq.push({cls,b,sl});
 const cls=s.itemTargetClass||s.forgeClass||'guard';
 const build=buildFor(s,cls,s.forgeBuildByClass?.[cls]);
 const canEquip=slot!=='weapon'||t.weaponFamily===CLASS_FAMILIES[cls];
 const owner=eq[0],isEquippedHere=eq.some(x=>x.cls===cls),progress=classProgress(s,cls,slot),enhance=progress.enhance,refine=progress.refine;
 const req=owner&&enhance<120?enhancementRequirement(t.baseGoldCost,enhance+1):null;
 const refineReq=refineQuote(s,p.id);
 const prot=refineReq?.protectedRequirement,protectedAttempt=!!s.itemProtect;
 const costReady=req&&s.gold>=req.gold&&qty(s,req.stoneId)>=req.stoneQty;
 const refineReady=refineReq&&s.gold>=refineReq.gold&&qty(s,'astraliteStone')>=refineReq.astralite&&(!protectedAttempt||!prot||qty(s,prot.id)>=prot.qty);
 const stats=Object.entries(t.baseCombat).filter(([,v])=>v).map(([k,v])=>`<div><small>${statNames[k]||esc(k)}</small><b>+${Math.round(v*(EQUIPMENT_RARITY_STAT_MULTIPLIER[p.rarity]||1))}</b></div>`).join('');
 return `<header class="bc-modal-header"><div>${gameIcon('gear','ui','◈','bc-header-icon')}<span><h2>T${t.tier} ${esc(t.name)}</h2><small>${RARITY_NAMES[p.rarity]} · ${SLOT_NAMES[slot]}</small></span></div><button class="modal-close" data-item-close aria-label="ปิดรายละเอียด">✕</button></header>
 <div class="bc-modal-body bc-item-detail">
  <div class="bc-item-preview">${armoryGearIcon(p,owner?classProgress(s,owner.cls,owner.sl):null,{large:true})}
    <div><span class="bc-rarity rarity-${p.rarity}">${RARITY_NAMES[p.rarity]}</span><h3>T${t.tier} ${esc(t.name)}</h3>
    <p>${eq.length?'ระดับตีบวกช่อง '+eq[0].cls:'หลังใส่จะใช้ระดับตีบวกช่องของคลาส'} · Enhance +${enhance} · Refine +${refine} · T${t.tier}</p><div class="bc-stats">${stats}</div>
    ${eq.length?`<small>สวมอยู่: ${eq.map(x=>classes[x.cls].name+' / '+x.b.name).map(esc).join(', ')}</small>`:'<small>ยังไม่สวมใส่</small>'}</div></div>
  <div class="bc-item-controls">${!isEquippedHere?`<label>ใส่ให้คลาส <select data-item-class aria-label="คลาสที่จะใช้อุปกรณ์">${CLASS_IDS.map(c=>`<option value="${c}" ${cls===c?'selected':''} ${slot==='weapon'&&t.weaponFamily!==CLASS_FAMILIES[c]?'disabled':''}>${esc(classes[c].name)}</option>`).join('')}</select></label>`:''}${isEquippedHere?
   `<button data-item-unequip="${p.id}" ${s.night?'disabled':''}>ถอดอุปกรณ์</button>`:
   `<button class="bc-primary" data-item-equip="${p.id}" ${s.night||!canEquip||t.tier>unlockedTier(s.warren)?'disabled':''}>ใส่ให้ ${esc(classes[cls].name)} / ${esc(build?.name||'บิลด์หลัก')}</button>`}
   ${owner&&!isEquippedHere?`<p class="bc-warning">ชิ้นนี้สวมอยู่กับ ${esc(classes[owner.cls].name)} · หากย้ายจะถูกถอดจากคลาสเดิม</p>`:''}
   <button data-item-dismantle="${p.id}" ${s.night||eq.length?'disabled':''}>แยกชิ้นส่วน</button></div>
  <div class="bc-upgrade-grid"><section class="bc-upgrade-card bc-enhance-card"><h3>⚒ ENHANCE <strong>+${enhance}</strong></h3>
   <p>เพิ่มค่าสถานะของช่อง Armory ประจำคลาส · สูงสุด +120 ไม่ติดเลเวลบ้าน</p>
   <div class="bc-upgrade-material">${req?`${gameIcon(req.stoneId,'item')}${esc(itemLabel(req.stoneId))} ${qty(s,req.stoneId)}/${req.stoneQty} · ${req.gold}G`:'ถึงเพดานแล้ว'}</div>
   <button data-item-enhance="${p.id}" ${s.night||!costReady?'disabled':''}>Enhance → +${enhance+1}</button></section>
   <section class="bc-upgrade-card bc-refine-card"><h3>✦ REFINE <strong>+${refine}</strong></h3>
   <p>เพิ่มประสิทธิภาพตามค่าตีบวก · ล้มเหลวอาจลด 1 ระดับ (ไม่ต่ำกว่า Safe Floor)</p>
   <div class="bc-upgrade-material">${refineReq?`${gameIcon('astraliteStone','item')}Astralite ${qty(s,'astraliteStone')}/${refineReq.astralite} · ${refineReq.gold.toLocaleString()} G (มี ${s.gold.toLocaleString()} G) · สำเร็จ ${(refineReq.rate*100).toFixed(0)}% · เมื่อล้มเหลวมีโอกาสลดขั้น 20%`:'ถึงเพดาน +15 แล้ว'}</div>
   ${s.refineFeedback?.itemId===p.id?`<p role="status" class="bc-refine-feedback ${s.refineFeedback.success?'success':'failure'}">${esc(s.refineFeedback.text)}</p>`:''}
   ${prot?`<label class="bc-protect"><input id="itemProtect" type="checkbox" ${protectedAttempt?'checked':''}> ใช้ Protection ${gameIcon(prot.id,'item')} ${qty(s,prot.id)}/${prot.qty}</label>`:''}
   <button data-item-refine="${p.id}" ${s.night||!refineReady?'disabled':''}>Refine → +${refine+1}</button></section></div>
 </div>`;
}
