// Focused windows for tower garrison, healing lodge, mastery and safe batch-craft results.
import { gameIcon, itemLabel, esc } from './warren-ui.js';
import { CLASS_FAMILIES, CLASS_IDS, MAX_FIELD_PER_CLASS, MASTERY_GOLD, WEAPON_MASTERY_MILESTONES, equippedGearIds, recommendations, gearScore } from './warren-progression.js';
import { masteryXpRequired } from '../../src/simulation/mastery.ts';
import {WEAPON_SKILLS_BY_FAMILY_V2} from '../../src/simulation/skillEntitlements.ts';
import {SKILLS_V2} from '../../src/simulation/skills.ts';
import {WEAPON_PROC_RULES_V2} from '../../src/simulation/engine.ts';

const close='<button class="modal-close" data-modal-close aria-label="ปิดหน้าต่าง">✕</button>';
const head=(icon,title,info)=>`<header class="bc-modal-header"><div>${gameIcon(icon,'ui','◈','bc-header-icon')}<span><h2>${title}</h2><small>${info}</small></span></div>${close}</header>`;
const fam=(cls,classes)=>gameIcon(CLASS_FAMILIES[cls],'family',classes[cls].icon,'bc-class-icon');
const TOWER_UPGRADE=[0,120,320,720,1450],TOWER_HP=[270,410,590,820,1120],HIRE={archer:90,mage:135};
export function renderTowerHtml(s,classes){
 const t=s.towers[s.selectedTower];if(!t)return head('gear','ป้อมปราการ','ยังไม่ได้เลือกป้อม')+'<p>คลิกป้อมบนแผนที่ก่อน</p>';
 const next=t.level<5?TOWER_UPGRADE[t.level]:null,has=t.garrison;
 return `${head('gear','ป้อมปราการ · #'+(s.selectedTower+1),'คลิกป้อมเพื่อจ้างพลประจำป้อม · 1 ตัว / ป้อม')}
 <div class="bc-modal-body bc-tower-window"><div class="bc-tower-layout"><div class="bc-tower-portrait">
 ${gameIcon(has?CLASS_FAMILIES[has.cls]:'bow',has?'family':'family','🏹','bc-tower-big-icon')}
 <h3>ป้อม Lv ${t.level}</h3><div class="bc-exp"><i style="width:${100*t.hp/t.maxHp}%"></i></div><p>HP ${Math.ceil(t.hp)} / ${t.maxHp}</p></div>
 <section><h3>ทหารประจำป้อม</h3>
 ${has?`<div class="bc-garrison">${fam(has.cls,classes)}<div><b>${esc(has.name)} · ${esc(classes[has.cls].name)}</b><small>Lv ${has.level} · EXP ${has.exp}/${14+has.level*8}</small><p>ใช้ Class Armory และ Mastery ของ ${esc(classes[has.cls].name)} ร่วมกับทหารภาคพื้นดิน</p></div></div>`:
  `<p class="bc-help">ป้อมว่างยังไม่ยิง จ้างนักธนูหรือนักเวทได้ตอนกลางวันเท่านั้น</p>
   <div class="bc-tower-hire">${['archer','mage'].map(cls=>`<button data-tower-hire="${cls}" ${s.night||t.hp<=0||s.gold<HIRE[cls]?'disabled':''}>${fam(cls,classes)}<b>${esc(classes[cls].name)}</b><small>${HIRE[cls]} Gold</small></button>`).join('')}</div>`}
 <h3>อัปเกรดความทนทาน</h3><p class="bc-help">อัปป้อมเพิ่ม HP อย่างเดียว ไม่เพิ่ม ATK ของกระต่าย</p>
 ${next?`<div class="bc-upgrade-material">ป้อม Lv ${t.level+1} · ${TOWER_HP[t.level]} HP · ${next} Gold</div>`:'<p>ป้อมเต็มระดับแล้ว</p>'}
 <button data-tower-upgrade ${!next||s.night||s.gold<next?'disabled':''}>อัปเกรดป้อม</button>
 <button data-tower-move ${s.night?'disabled':''} title="ย้ายป้อมโดยไม่เสียค่ารื้อและยังคงเลเวล HP กับทหารประจำป้อม">📍 ย้ายป้อม · คลิกตำแหน่งใหม่</button>
 ${t.hp<=0?'<p class="bc-warning">ป้อมพัง · ซ่อมตอนกลางวันเพื่อให้ทหารกลับมาปฏิบัติหน้าที่</p>':''}
 </section></div></div>`;
}
export function renderLodgeHtml(s){
 const cost=[0,260,720][s.healingLevel],rate=[1,1.25,1.5][s.healingLevel-1];
 return `${head('home','Healing Lodge · บ้านสมุนไพร','ใช้บ้านเดิมเป็นสถานฟื้นฟู · ไม่สามารถชุบชีวิต')}
 <div class="bc-modal-body"><div class="bc-lodge">
 <div class="bc-lodge-art">✚</div><div><h2>Healing Lodge Lv ${s.healingLevel}</h2>
 <p>ฟื้นฟู ${rate}% Max HP ทุก 15 วินาที ให้กระต่ายที่ยังไม่ล้มในรัศมีรอบบ้าน</p>
 <p>การฟื้นฟูมีผลทั้งกลางวันและกลางคืน · ไม่ชุบชีวิตและไม่ฟื้นฟูป้อม</p>
 <button data-lodge-upgrade ${!cost||s.night||s.gold<cost?'disabled':''}>${cost?'อัปเกรด · '+cost+' Gold':'เต็มระดับแล้ว'}</button></div></div></div>`;
}
export function renderMasteryHtml(s,classes){
 const cls=s.masteryClass||s.forgeClass||'guard',state=s.mastery[cls],steps=WEAPON_MASTERY_MILESTONES[CLASS_FAMILIES[cls]]||[],need=masteryXpRequired(state.level);
 const tabs=CLASS_IDS.map(c=>`<button data-mastery-class="${c}" class="${c===cls?'active':''}">${fam(c,classes)} ${esc(classes[c].name)}</button>`).join('');
 const milestones=steps.map(step=>{const done=state.unlocked.includes(step.level),can=state.level>=step.level&&!done&&!s.night&&s.gold>=MASTERY_GOLD[step.level];
  return `<article class="bc-master-step ${done?'unlocked':''}">${gameIcon(CLASS_FAMILIES[cls]+'_'+step.id,'mastery','✦','bc-master-art')}
   <div><b>Lv ${step.level} · ${esc(step.id)}</b><p>${esc(step.description)}</p></div>
   <button data-unlock-mastery="${cls}" ${can?'':'disabled'}>${done?'ปลดล็อกแล้ว':state.level<step.level?'Lv '+step.level:MASTERY_GOLD[step.level]+' Gold'}</button></article>`;}).join('');
 const actives=(WEAPON_SKILLS_BY_FAMILY_V2[CLASS_FAMILIES[cls]]||[]).map((id,index)=>{
  const level=[10,20,30][index],skill=SKILLS_V2[id],unlocked=state.unlocked.includes(level),enabled=unlocked&&!state.disabledWeaponSkills?.includes(level);
  const trigger=index===0?Math.round(WEAPON_PROC_RULES_V2.chance*100)+'% ต่อการโจมตี':index===1?'ทุก '+WEAPON_PROC_RULES_V2.everyNthHit+' ครั้งที่โจมตี':'สะสม '+WEAPON_PROC_RULES_V2.gaugeHits+' ครั้งที่โจมตี';
  return `<article class="bc-mastery-active ${enabled?'unlocked':''}">${gameIcon(id,'skill','✦','bc-master-art')}
   <div><b>Lv ${level} · ${esc(skill.name)}</b><p>${trigger} · ${skill.hitCount||1} Hit · คูลดาวน์ ${skill.cooldownMs/1000}s</p></div>
   <button data-mastery-active-level="${level}" data-mastery-active-class="${cls}" ${!unlocked||s.night?'disabled':''}>${!unlocked?'ยังไม่ปลดล็อก':enabled?'ใช้งานอยู่ · กดปิด':'ปิดอยู่ · กดเปิด'}</button></article>`;
 }).join('');
 return `${head('skill','Class Mastery','สะสม EXP จากมอนสเตอร์ · ใช้ Gold ปลดล็อกทุก 10 ระดับ')}
 <div class="bc-modal-body"><nav class="bc-class-tabs">${tabs}</nav><div class="bc-mastery-progress">
 <div><h3>${esc(classes[cls].name)} · Mastery Lv ${state.level}/50</h3>
 <p>EXP ${Math.floor(state.xp)} / ${need} ${[10,20,30,40,50].includes(state.level)&&!state.unlocked.includes(state.level)?'· รอใช้ Gold ปลดขั้น':''}</p></div>
 <div class="bc-exp"><i style="width:${state.level===50?100:Math.min(100,state.xp/need*100)}%"></i></div></div>
 <div class="bc-master-list">${milestones}</div>
 <section class="bc-mastery-actives"><h3>Weapon Mastery Active · 3 ช่องแยกจาก Skill Core</h3>
 <p class="bc-help">ปลดล็อกพร้อม Mastery Lv10/20/30 · ทำงานอัตโนมัติเมื่อโจมตีปกติ ตามกฎเกมหลัก ไม่ใช้ SP หรือช่อง Skill Core</p>
 ${actives}</section></div>`;
}
const rarities=['normal','good','rare','epic','legend','mythic','whiteAscended'];
const rarityLabel={normal:'Normal',good:'Good',rare:'Rare',epic:'Epic',legend:'Legend',mythic:'Mythic',whiteAscended:'White Ascended'};
export function renderBatchHtml(s,classes,embedded=false){
 const ids=s.batchResults||[],items=ids.map(id=>s.gear.find(p=>p.id===id)).filter(Boolean),
  focus=s.batchClass||s.forgeClass||'guard',rec=recommendations(s,items,focus),used=equippedGearIds(s),selected=s.batchSelection||[],report=s.batchReport;
 const filtered=items.filter(p=>s.batchFilter==='all'||p.rarity===s.batchFilter);
 const filters=['all',...rarities].filter(r=>r==='all'||items.some(p=>p.rarity===r)).map(r=>`<button class="${s.batchFilter===r?'active':''}" data-batch-filter="${r}">${r==='all'?'ทั้งหมด':rarityLabel[r]} · ${r==='all'?items.length:items.filter(p=>p.rarity===r).length}</button>`).join('');
 const recommend=rec.map(r=>{const p=s.gear.find(x=>x.id===r.itemId);
  const old=s.gear.find(x=>x.id===r.currentId),before=old?gearScore(old,r.cls):0,newScore=gearScore(p,r.cls);
  return {cls:r.cls,html:`<div class="bc-recommend ${r.cls===focus?'primary':''}">${gameIcon(p.templateId,'equipment','◈','bc-recommend-icon')}
    <div><b>${esc(classes[r.cls].name)} · ${esc(itemLabel(p.templateId))}</b><small>${rarityLabel[p.rarity]} · เพิ่มค่าเหมาะสมกับคลาส +${r.delta}</small>
    <small>คะแนนความเหมาะสม ${Math.round(before*10)/10} → ${Math.round(newScore*10)/10} · ${r.currentId?'ของเดิมกลับเข้าคลัง ระดับตีบวกช่องยังอยู่':'ช่องนี้ยังว่าง'}</small></div>
    <button data-batch-equip="${r.cls}:${p.id}" ${s.night?'disabled':''}>เลือกเปลี่ยน</button></div>`};});
 const primaryRecommend=recommend.filter(x=>x.cls===focus).map(x=>x.html).join('');
 const otherRecommend=recommend.filter(x=>x.cls!==focus).map(x=>x.html).join('');
 const cards=filtered.map(p=>{
  const r=rec.find(x=>x.itemId===p.id),checked=selected.includes(p.id),underReview=report?.review.some(x=>x.id===p.id);
  return `<article class="bc-batch-card rarity-${p.rarity}">
   ${gameIcon(p.templateId,'equipment','◈','bc-batch-art')}<b>${rarityLabel[p.rarity]}</b>
   <small>${esc(itemLabel(p.templateId))}</small>${underReview?'<span class="bc-suggest-tag">รอพิจารณา · ป้องกันให้ '+esc(classes[report.reviewFor?.[p.id]]?.name||'คลาสอื่น')+'</span>':r?`<span class="bc-suggest-tag">เหมาะกับ ${esc(classes[r.cls].name)}</span>`:''}
   <label><input type="checkbox" data-batch-lock="${p.id}" ${p.locked?'checked':''}> 🔒 ล็อก</label>
   <label><input type="checkbox" data-batch-select="${p.id}" ${checked?'checked':''} ${p.locked||used.has(p.id)||s.night?'disabled':''}> เลือกแยก</label>
   <button data-open-item="${p.id}">ดู / เลือกใส่</button>
   ${used.has(p.id)?'<small class="bc-have">สวมอยู่</small>':''}</article>`;
 }).join('');
 const salvage=items.filter(p=>selected.includes(p.id)&&!p.locked&&!used.has(p.id)),blocked=salvage.filter(p=>rec.some(r=>r.itemId===p.id));
 const summary=report?`<div class="bc-batch-summary"><span>คราฟต์ <b>${report.made.length}</b> ชิ้น</span><span>เก็บ <b>${report.retained.length}</b> ชิ้น</span><span>รอพิจารณา <b>${report.review.length}</b> ชิ้น</span><span>ย่อยอัตโนมัติ <b>${report.dismantled.length}</b> ชิ้น</span><span>ย่อยเพิ่ม <b>${report.manualDismantled?.length||0}</b> ชิ้น</span><span>Stone Fragments <b>+${report.fragments}</b></span></div>`:'';
 return `${embedded?'<section class="bc-armory-results" aria-label="ผล Batch Craft"><h3>ผล Batch Craft · '+esc(classes[focus].name)+'</h3>':head('craft','Batch Craft Results','คลาส '+esc(classes[focus].name)+' · เลือกใส่เองและยืนยันก่อนแยกชิ้นส่วน')}
 ${embedded?'':'<div class="bc-modal-body">'}${summary}<section class="bc-batch-recommend"><h3>คำแนะนำให้ ${esc(classes[focus].name)}</h3>
 <p class="bc-help">พิจารณา Rarity และค่าสถานะตามหน้าที่ของคลาส · ไม่เปลี่ยนอุปกรณ์อัตโนมัติ</p>
 ${primaryRecommend||'<p class="bc-help">ไม่มีชิ้นใดเพิ่มค่าพลังให้คลาสนี้</p>'}
 ${otherRecommend?`<details class="bc-recommend-other"><summary>ดูคำแนะนำสำหรับคลาสอื่น (${recommend.filter(x=>x.cls!==focus).length})</summary>${otherRecommend}</details>`:''}</section>
 ${report?.review.length?`<p class="bc-review-notice">รอพิจารณา ${report.review.length} ชิ้น: ต่ำกว่า Rarity ขั้นต่ำ แต่ Smart Recommendation แนะนำให้คลาสอื่น จึงไม่ย่อยอัตโนมัติ</p>`:''}
 ${embedded?`<button class="bc-results-toggle" data-batch-expanded>${s.batchExpanded?'ซ่อนรายการอื่น':'ดูของที่เหลือ '+items.length+' ชิ้น · กรอง Rarity / ล็อก / เลือกย่อย'}</button>`:''}
 <div class="bc-batch-expansion" ${embedded&&!s.batchExpanded?'hidden':''}>
 <nav class="bc-batch-filters">${filters}</nav>
 <div class="bc-batch-grid">${cards||'<p class="bc-empty">ไม่มีไอเทมในตัวกรองนี้</p>'}</div>
 <div class="bc-batch-footer"><b>เลือกแยก ${salvage.length} ชิ้น · ล็อก ${items.filter(p=>p.locked).length} ชิ้น</b>
 <button data-batch-select-leftovers ${s.night?'disabled':''}>เลือกเฉพาะของที่ไม่แนะนำ</button>
 <button data-batch-confirm ${s.night||!salvage.length?'disabled':''}>ตรวจรายการก่อนแยกชิ้นส่วน</button></div>
 ${s.batchConfirm?`<section class="bc-batch-confirm"><h3>ยืนยันแยกชิ้นส่วน ${salvage.length} ชิ้น</h3>
 <p>${salvage.map(p=>esc(itemLabel(p.templateId))+' ['+rarityLabel[p.rarity]+']').join(' · ')}</p>
 ${blocked.length?`<p class="bc-warning">คำเตือน: ${blocked.length} ชิ้นยังมีคำแนะนำให้เปลี่ยนไปใช้กับคลาสอื่น</p>`:''}
 <button data-batch-dismantle ${s.night?'disabled':''}>ยืนยันแยกชิ้นส่วน</button> <button data-batch-cancel>ยกเลิก</button></section>`:''}
 </div>${embedded?'</section>':'</div>'}`;
}
