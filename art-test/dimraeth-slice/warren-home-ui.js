import {esc} from './warren-ui.js';
import {HOME_ITEMS,HOME_CATEGORIES} from './warren-home-builder.js';
import {HOME_HOUSE_BONUSES,activeHomeBonusLabels} from './warren-home-bonuses.js';
import {HOME_SIDES,HOME_SIDE_NAMES,HOME_PLOT_COST,HOME_WALL_COST,sidePlots,fullyOwnedSide,homeWallIntegrity,HOME_NORTH_FINAL,homeAtNorthernCliff} from './warren-home-land.js';
import {HOME_TERRAIN_BRUSHES,quoteHomeTerrain,deriveHomeNorthCurtains,quoteNewHomeNorthCurtains} from './warren-home-terrain.js';
export const HOME_PANES={decor:'🪑 ตกแต่ง',terrain:'⛰️ ภูมิประเทศ',land:'🗺 ที่ดิน & กำแพง'};
const HELP={
 decor:'เลือกของแล้วแตะพื้นเพื่อวาง · แตะของที่วางแล้วเพื่อย้าย/หมุน/รื้อ · ทางเดินใช้พื้นจริงและต่อขอบอัตโนมัติ · R หมุน · Ctrl+Z ย้อน · Esc ยกเลิก',
 terrain:'เลือกพู่กันแล้วแตะพื้นเพื่อร่าง · แก้ได้เฉพาะ Plot ที่ซื้อแล้ว · ยกพื้นได้เฉพาะทางเหนือหลังย้ายกำแพง · กดยืนยันครั้งเดียวเพื่อสร้างจริง (ไม่ต้องโหลดเกมใหม่)',
 land:'ซื้อ Plot 5×5 ครบสามแปลงของทิศหนึ่งเพื่อย้ายกำแพงออกไป · เหนือช่วงสุดท้ายจะใช้หน้าผาระดับ 3 แทนกำแพง · ทำได้เฉพาะกลางวัน'
};
// What the player is doing right now, in one line, with the way out.
export function homeModeLabel(s){
 const item=HOME_ITEMS[s.homeSelected];
 if(s.homeAction==='move')return `📍 กำลังย้าย ${item?.name||''} · แตะจุดใหม่ · Esc ยกเลิก`;
 if(s.homeAction==='recover')return `📦 กำลังกู้คืน ${item?.name||''} · แตะจุดวาง · Esc ยกเลิก`;
 if(s.homeAction==='terrain')return `🖌 ร่าง Terrain: ${HOME_TERRAIN_BRUSHES[s.homeTerrainBrush]?.name||''} · แตะพื้นเพื่อระบาย`;
 if(s.homeAction==='waterfall')return '🌊 เลือกจุดต้นน้ำบนเนิน · Esc ยกเลิก';
 return item?`📌 วาง ${item.name} · R หมุน ${(s.homeRotation||0)*90}°`:'เลือกของที่จะวาง';
}
const costLine=(item,s)=>{
 const lackGold=Math.max(0,item.gold-(s.gold??Infinity)),lackMats=Math.max(0,item.mats-(s.homeMats??Infinity));
 if(!lackGold&&!lackMats)return {ok:true,text:`${item.mats} วัตถุดิบ · ${item.gold}G`};
 return {ok:false,text:'ขาด '+[lackMats?lackMats+' วัตถุดิบ':'',lackGold?lackGold+'G':''].filter(Boolean).join(' · ')};
};
function decorPane(s,disabled,thumb){
 const tabs=Object.entries(HOME_CATEGORIES).map(([id,name])=>`<button data-home-category="${id}" class="${s.homeCategory===id?'active':''}">${name}</button>`).join('');
 const built=new Set((s.homeBuilder?.placedObjects||[]).map(o=>o.prefab));
 const catalog=Object.entries(HOME_ITEMS).filter(([,item])=>item.group===s.homeCategory).map(([id,item])=>{
  const cost=costLine(item,s),src=thumb?.(id),bonus=HOME_HOUSE_BONUSES[id];
  const perk=bonus?`<em class="bc-home-perk ${built.has(id)?'on':''}">${built.has(id)?'✓ ':'★ '}${esc(bonus.label)}</em>`:'';
  return `<button data-home-type="${id}" class="bc-home-item ${s.homeSelected===id&&s.homeAction==='place'?'active':''} ${cost.ok?'':'short'}" ${disabled} title="${esc(item.name)}">
   <span class="bc-home-thumb">${src?`<img src="${src}" alt="">`:`<i>${item.icon}</i>`}</span><b>${esc(item.name)}</b>${perk}<small>${esc(cost.text)}</small></button>`;
 }).join('');
 const sel=(s.homeBuilder?.placedObjects||[]).find(o=>o.id===s.homeSelectedId);
 const selItem=sel&&HOME_ITEMS[sel.prefab];
 const selection=selItem?`<div class="bc-home-selection" role="group" aria-label="ของที่เลือก"><strong>${selItem.icon} ${esc(selItem.name)}</strong>
  <button data-home-move="${esc(sel.id)}" ${disabled}>✥ ย้าย</button><button data-home-sel-rotate ${disabled}>↻ หมุน</button>
  ${selItem.group==='houses'?`<button data-home-sel-variant ${disabled}>🎨 แบบ ${(sel.variant||0)+1}/3</button>`:''}
  <button data-home-demolish="${esc(sel.id)}" class="danger" ${disabled}>🗑 รื้อ (คืน 75%)</button><button data-home-deselect aria-label="ยกเลิกการเลือก">✕</button></div>`:'';
 const placed=(s.homeBuilder?.placedObjects||[]).slice(-35).reverse().map(o=>{
  const item=HOME_ITEMS[o.prefab];
  return `<div class="bc-home-placed"><span>${item?.icon||'📦'} ${esc(item?.name||o.prefab)}</span><button data-home-select="${esc(o.id)}">เลือก</button><button data-home-move="${esc(o.id)}" ${disabled}>ย้าย</button><button data-home-demolish="${esc(o.id)}" ${disabled}>รื้อ</button></div>`;
 }).join('');
 const recovered=(s.homeBuilder?.recovery||[]).filter(o=>HOME_ITEMS[o.prefab]).slice(0,16).map(o=>`<div class="bc-home-placed"><span>📦 ${esc(HOME_ITEMS[o.prefab].name)} <small>${esc(o.reason||'รอจัดวางใหม่')}</small></span><button data-home-recover="${esc(o.id)}" ${disabled}>วางใหม่</button></div>`).join('');
 const houseMode=s.homeCategory==='houses'||(s.homeAction==='move'||s.homeAction==='recover')&&HOME_ITEMS[s.homeSelected]?.group==='houses';
 const perks=activeHomeBonusLabels(s.homeBuilder);
 const perkLine=perks.length?`<div class="bc-home-perks"><strong>★ โบนัสหมู่บ้าน</strong>${perks.map(p=>`<span>${esc(p)}</span>`).join('')}</div>`:(s.homeCategory==='houses'?'<div class="bc-home-perks"><small>บ้านแต่ละแบบให้โบนัสหมู่บ้าน 1 อย่าง · สร้างซ้ำแบบเดิมไม่ซ้อนโบนัส</small></div>':'');
 return `${selection}${perkLine}<div class="bc-home-tabs">${tabs}</div><div class="bc-home-catalog">${catalog}</div>
 <div class="bc-home-actions"><button data-home-rotate title="R" ${disabled}>↻ ${(s.homeRotation||0)*90}°</button>
 ${houseMode?`<button data-home-variant ${disabled}>🎨 แบบ ${(s.homeVariant||0)+1}/3</button>`:''}
 <button data-home-undo title="Ctrl+Z" ${disabled||!s.homeUndo?'disabled':''}>↶ Undo</button></div>
 <details class="bc-home-list"><summary>ของที่วางแล้ว (${s.homeBuilder?.placedObjects?.length||0})</summary>${placed||'<small>ยังไม่มีของตกแต่ง</small>'}</details>
 ${s.homeBuilder?.recovery?.length?`<details class="bc-home-list"><summary>📦 Recovery Storage (${s.homeBuilder.recovery.length})</summary>${recovered||'<small>Terrain และน้ำตกที่ยังต้องแก้ไขจะเก็บไว้ในเซฟ</small>'}</details>`:''}`;
}
function terrainPane(s,disabled){
 const terrain=Object.entries(HOME_TERRAIN_BRUSHES).map(([key,item])=>`<button data-home-brush="${key}" class="${s.homeAction==='terrain'&&s.homeTerrainBrush===key?'active':''}" ${disabled}>${item.icon} ${item.name}</button>`).join('');
 const terrainQuote=s.homeTerrainDraft?quoteHomeTerrain(s.homeBuilder?.terrainEdits,s.homeTerrainDraft):{mats:0,gold:0,changes:0};
 const curtainQuote=s.homeTerrainDraft?quoteNewHomeNorthCurtains(
  deriveHomeNorthCurtains(s.homeBuilder,s.homeBuilder?.terrainEdits),deriveHomeNorthCurtains(s.homeBuilder,s.homeTerrainDraft)):{groups:0,mats:0,gold:0};
 const quote={...terrainQuote,mats:terrainQuote.mats+curtainQuote.mats,gold:terrainQuote.gold+curtainQuote.gold};
 return `<div class="bc-home-terrain-tools">${terrain}</div>
 ${homeAtNorthernCliff(s.homeBuilder)?'<p class="bc-home-info">🌊 ม่านน้ำตก: วาดน้ำบนสันหน้าผาเหนือ แล้ววาดบ่อรับน้ำใต้แต่ละช่องและแม่น้ำถัดลงมา แล้วกดยืนยัน</p>':''}
 <div class="bc-home-actions"><span>ร่าง ${quote.changes} ช่อง · ${quote.mats} วัตถุดิบ · ${quote.gold}G${curtainQuote.groups?` · ม่านน้ำตกใหม่ ${curtainQuote.groups} ผืน`:''}</span>
 ${s.homeTerrainNotice?`<strong class="bc-home-warning">⚠ ${esc(s.homeTerrainNotice)}</strong>`:''}
 <button data-home-terrain-apply class="primary" ${disabled||!quote.changes?'disabled':''}>✓ ยืนยัน</button><button data-home-terrain-cancel ${quote.changes?'':'disabled'}>✕ ล้างร่าง</button></div>
 ${s.homeBuilder?.expandedSides?.includes('north')?`<button data-home-waterfall-mode class="${s.homeAction==='waterfall'?'active':''}" ${disabled}>🌊 สร้างน้ำตกจากเนินที่ยกเอง</button>`:''}
 ${s.homeBuilder?.waterfalls?.length?`<small class="bc-home-info">🌊 น้ำตก ${s.homeBuilder.waterfalls.length} จุด/ผืน</small>`:''}`;
}
function landPane(s,disabled){
 const wall=homeWallIntegrity(s.wallLevel||0,s.homeBuilder,s.fences||[]);
 const live=Number.isInteger(s.homeWallVisible)?s.homeWallVisible:wall.actual-wall.broken;
 const needsRebuild=wall.missing>0||wall.obsolete>0||live<wall.actual-wall.broken;
 const stages=[...HOME_SIDES,...(s.homeBuilder?.expandedSides?.includes('north')?[HOME_NORTH_FINAL]:[])];
 const plots=stages.map(side=>{
  const ids=sidePlots(side),owned=ids.filter(id=>s.homeBuilder?.ownedPlots?.includes(id));
  const expanded=s.homeBuilder?.expandedSides?.includes(side),eligible=fullyOwnedSide(s.homeBuilder,side)&&!!s.wallLevel&&!expanded;
  const buttons=ids.map(id=>s.homeBuilder?.ownedPlots?.includes(id)?`<span class="bc-home-owned">✓ Plot ${id.at(-1)}</span>`:`<button data-home-plot="${id}" ${disabled}>ซื้อ ${id.at(-1)}<small>${HOME_PLOT_COST.gold}G · ${HOME_PLOT_COST.mats} วัตถุดิบ</small></button>`).join('');
  return `<div class="bc-home-land-side"><strong>${HOME_SIDE_NAMES[side]} · ${owned.length}/3 ${expanded?(side===HOME_NORTH_FINAL?'· เชื่อมหน้าผาแล้ว ✓':'· ขยายแล้ว ✓'):''}</strong><div class="bc-home-plots">${buttons}</div>${eligible?`<div class="bc-home-wall-actions"><button data-home-wall-preview="${side}" class="${s.homeWallPreview===side?'active':''}" ${disabled}>👁 ดูแนว</button><button data-home-wall-expand="${side}" class="primary" ${disabled}>${side===HOME_NORTH_FINAL?'เชื่อมหน้าผา':'ย้ายกำแพง'} · ${HOME_WALL_COST.gold}G + ${HOME_WALL_COST.mats} วัตถุดิบ</button></div>`:''}</div>`;
 }).join('');
 return `<p class="bc-home-info">🧱 กำแพง ${wall.actual}/${wall.expected} ส่วน · ประตู ${wall.gates}/3 · ที่ดิน ${(s.homeBuilder?.ownedPlots?.length||1)-1}/15 Plot
 ${wall.broken?`<strong class="bc-home-warning">· พัง ${wall.broken} ส่วน</strong>`:''}</p>
 ${needsRebuild?`<button data-home-wall-rebuild ${disabled}>🔧 คืนส่วนกำแพงที่หาย (${live}/${wall.actual-wall.broken})</button>`:''}
 ${s.homeWallPreviewData&&!s.homeWallPreviewData.ok?`<small class="bc-home-warning">⚠ ${esc(s.homeWallPreviewData.reason)}</small>`:''}${plots}`;
}
export function renderHomeBuilderHtml(s,{thumb}={}){
 const pane=HOME_PANES[s.homePane]?s.homePane:'decor';
 const disabled=s.night||s.homeGroundBusy?'disabled':'';
 const panes=Object.entries(HOME_PANES).map(([id,name])=>`<button data-home-pane="${id}" role="tab" aria-selected="${pane===id}" class="${pane===id?'active':''}">${name}</button>`).join('');
 const body=pane==='terrain'?terrainPane(s,disabled):pane==='land'?landPane(s,disabled):decorPane(s,disabled,thumb);
 return `<div class="bc-home-head"><strong>🔨 Home Builder</strong><button data-home-help class="${s.homeHelp?'active':''}" aria-label="วิธีใช้">?</button><button data-home-close aria-label="ปิดโหมดสร้าง" ${s.homeGroundBusy?'disabled':''}>✕</button></div>
 <div class="bc-home-panes" role="tablist">${panes}</div>
 <div class="bc-home-mode" role="status">${s.homeGroundBusy?'⏳ กำลังสร้างพื้นใหม่…':esc(homeModeLabel(s))}</div>
 ${s.homeHelp?`<p class="bc-home-info bc-home-help">${HELP[pane]}</p>`:''}
 ${body}`;
}
