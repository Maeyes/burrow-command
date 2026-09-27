// Shared, data-driven result preview for Burrow's Class Armory crafting screen.
// Uses canonical item templates, rarity multipliers and the CURRENT forge modifier.
import {CRAFT_RARITY_TABLE, EQUIPMENT_RARITY_STAT_MULTIPLIER} from '../../src/simulation/equipmentV2.ts';
import {EQUIPMENT_MASTER_V2,buildFor,classProgress,gearSlot,minLevelForTier} from './warren-progression.js';
import {esc,gameIcon} from './warren-ui.js';

const STAT_LABELS={atk:'ATK',matk:'MATK',def:'DEF',mdef:'MDEF',maxHp:'HP',maxSp:'SP',crit:'CRIT',aspd:'ASPD',hit:'HIT',flee:'FLEE'};
const STAT_ORDER=['atk','matk','def','mdef','maxHp','maxSp','crit','aspd','hit','flee'];
const RARITY_LABELS={normal:'Normal',good:'Good',rare:'Rare',epic:'Epic',legend:'Legend',mythic:'Mythic',whiteAscended:'White Ascended'};
const ROLE_LABELS={neutral:'ทั่วไป',damage:'Damage',tank:'Tank',support:'Support'};
const SLOT_LABELS={weapon:'อาวุธหลัก',armor:'เกราะ',accessory:'เครื่องประดับ'};

const number=n=>Number(n||0).toLocaleString();
const statsOf=t=>Object.entries(t?.baseCombat||{}).filter(([,value])=>Number(value)!==0)
 .sort(([left],[right])=>{
  const a=STAT_ORDER.indexOf(left),b=STAT_ORDER.indexOf(right);
  return (a<0?99:a)-(b<0?99:b);
 });
const label=id=>STAT_LABELS[id]||String(id).toUpperCase();
const rolled=(v,rarity)=>Math.round(v*(EQUIPMENT_RARITY_STAT_MULTIPLIER[rarity]??1));

/** Two essential stats in the recipe picker so players can distinguish recipes before selecting. */
export function craftStatSummary(template){
 return statsOf(template).slice(0,2).map(([id,v])=>label(id)+' +'+number(v)).join(' · ')||'ไม่มีค่าสถานะพื้นฐาน';
}

/** Exact rarity bucket probabilities under the same monotone forgeRarityRoll used by craftGear. */
export function forgeRarityChances(forgeLevel=1){
 const level=Math.max(1,Math.min(10,Math.floor(Number(forgeLevel)||1)));
 const power=1+(level-1)*.10;
 const cdf=x=>1-Math.pow(Math.max(0,1-x),1/power);
 let sum=0,previous=0;
 return CRAFT_RARITY_TABLE.map(([rarity,base])=>{
  sum+=base;
  const current=cdf(Math.min(1,sum));
  const chance=Math.max(0,current-previous);
  previous=current;
  return {rarity,chance};
 });
}

export function renderCraftPreview(s,template,classes){
 if(!template)return '';
 const cls=s.forgeClass||'guard',slot=gearSlot(template.id),build=buildFor(s,cls),progress=classProgress(s,cls,slot);
 const equipped=s.gear.find(p=>p.id===build?.gear?.[slot]);
 const previous=equipped&&EQUIPMENT_MASTER_V2[equipped.templateId];
 const stats=statsOf(template),prior=statsOf(previous);
 const keys=[...new Set([...stats.map(([key])=>key),...prior.map(([key])=>key)])];
 const comparison=equipped?'<p class="bc-craft-note">เทียบกับของที่ใส่อยู่: '+esc(previous.name)+' ('+esc(RARITY_LABELS[equipped.rarity]||equipped.rarity)+'). เทียบเฉพาะค่าสถานะไอเทม ไม่รวม Enhance/Refine ของช่อง</p>':'<p class="bc-craft-note">ช่องนี้ยังไม่ได้ใส่อุปกรณ์ จึงแสดงค่าไอเทมที่จะคราฟต์เป็น Normal</p>';
 const statRows=keys.map(key=>{
  const raw=template.baseCombat[key]||0,old=previous?rolled(previous.baseCombat[key]||0,equipped.rarity):null,delta=old===null?null:raw-old;
  const diff=delta===null?'—':delta>0?'+'+number(delta):number(delta);
  return '<tr><th scope="row">'+esc(label(key))+'</th><td>+'+number(raw)+'</td>'+
   (equipped?'<td>+'+number(old)+'</td><td class="'+(delta>0?'gain':delta<0?'loss':'same')+'">'+diff+'</td>':'')+'</tr>';
 }).join('');
 const group=template.setId?(template.setId.endsWith('-body')?'เซ็ต Body 3 ชิ้น':'เซ็ต Accessory 2 ชิ้น'):'ไม่ใช่อุปกรณ์เซ็ต';
 const requirement=minLevelForTier(template.tier);
 const rows=forgeRarityChances(s.forgeLevel).map(({rarity,chance})=>{
  const mult=EQUIPMENT_RARITY_STAT_MULTIPLIER[rarity]??1;
  const statsText=stats.map(([id,v])=>esc(label(id))+' +'+number(rolled(v,rarity))).join(' · ');
  return '<tr><th scope="row"><span class="bc-craft-rarity rarity-'+rarity+'">'+esc(RARITY_LABELS[rarity])+'</span></th>'+
   '<td>×'+mult.toFixed(mult%1?1:0)+'</td><td>'+esc(statsText)+'</td><td>'+((chance*100)<.01?'&lt;0.01':(chance*100).toFixed((chance*100)<1?2:1))+'%</td></tr>';
 }).join('');
 return '<section class="bc-craft-preview" aria-label="รายละเอียดผลลัพธ์ที่คราฟต์">'+
  '<div class="bc-craft-preview-heading">'+gameIcon(template.id,'equipment','◈','bc-craft-preview-art')+
  '<div><span class="bc-craft-eyebrow">ผลลัพธ์จากสูตรที่เลือก · สำหรับ '+esc(classes[cls]?.name||cls)+'</span><h4>T'+template.tier+' '+esc(template.name)+'</h4>'+
  '<div class="bc-craft-chips"><span>'+esc(SLOT_LABELS[slot]||template.slot)+'</span><span>'+esc(ROLE_LABELS[template.role]||template.role)+'</span>'+
  '<span>กระต่าย Lv '+requirement+'+</span><span>'+esc(group)+'</span></div></div></div>'+
  '<h5>ค่าสถานะที่จะได้รับ (ตัวอย่าง Rarity: Normal)</h5>'+
  '<div class="bc-craft-stat-grid">'+stats.map(([key,value])=>'<div class="bc-craft-stat"><small>'+esc(label(key))+'</small><strong>+'+number(value)+'</strong></div>').join('')+'</div>'+
  comparison+
  '<div class="bc-craft-table-wrap"><table class="bc-craft-compare"><thead><tr><th>ค่าสถานะ</th><th>คราฟต์ Normal</th>'+
  (equipped?'<th>ที่ใส่อยู่</th><th>ต่างกัน</th>':'')+'</tr></thead><tbody>'+statRows+'</tbody></table></div>'+
  '<p class="bc-craft-note">เป็นค่าพื้นฐานบนไอเทมก่อน Rarity และไม่รวมโบนัส Enhance/Refine ที่ติดช่อง Armory; ค่าต่อสู้สุดท้ายคำนวณโดยระบบ Burrow</p>'+
  (template.setId?'<p class="bc-craft-note">ชิ้นส่วนเซ็ตตาม Equipment Master; Burrow ยังไม่ได้เปิดใช้โบนัสเมื่อสวมครบเซ็ต</p>':'')+
  '<details class="bc-craft-rarity-details"><summary>ดูค่าสถานะทุก Rarity และโอกาสสุ่ม (Forge Lv '+Number(s.forgeLevel||1)+')</summary>'+
   '<div class="bc-craft-table-wrap"><table class="bc-craft-rarity-table"><thead><tr><th>Rarity</th><th>ตัวคูณ</th><th>ค่าสถานะ</th><th>โอกาส</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
   '<p class="bc-craft-note">Rarity สุ่มเมื่อคราฟต์จริง; อัปเกรดโรงตีเหล็กจะปรับโอกาส ผลลัพธ์ในตารางเป็นเพียงตัวอย่าง ไม่รับประกันว่าจะได้ Rarity นั้น</p></details>'+
  '<p class="bc-craft-note">อุปกรณ์ที่คราฟต์จะเข้าคลังของคลาส ไม่ได้สวมใส่อัตโนมัติ'+
  (progress.enhance||progress.refine?' · ช่องนี้มี Enhance +'+number(progress.enhance)+' / Refine +'+number(progress.refine)+' ที่ใช้กับของใหม่เมื่อสวมใส่':'')+
  '</p></section>';
}
