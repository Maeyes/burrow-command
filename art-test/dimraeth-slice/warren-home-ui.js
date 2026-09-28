import {esc} from './warren-ui.js';
import {HOME_ITEMS,HOME_CATEGORIES} from './warren-home-builder.js';
import {HOME_SIDES,HOME_SIDE_NAMES,HOME_PLOT_COST,HOME_WALL_COST,sidePlots,fullyOwnedSide,homeWallIntegrity,HOME_NORTH_FINAL,homeAtNorthernCliff} from './warren-home-land.js';
import {HOME_TERRAIN_BRUSHES,quoteHomeTerrain,deriveHomeNorthCurtains,quoteNewHomeNorthCurtains} from './warren-home-terrain.js';
export function renderHomeBuilderHtml(s){
 const selected=HOME_ITEMS[s.homeSelected]||HOME_ITEMS.dirtPath;
 const disabled=s.night||s.homeGroundBusy?'disabled':'';
 const wall=homeWallIntegrity(s.wallLevel||0,s.homeBuilder,s.fences||[]);
 const live=Number.isInteger(s.homeWallVisible)?s.homeWallVisible:wall.actual-wall.broken;
 const needsRebuild=wall.missing>0||wall.obsolete>0||live<wall.actual-wall.broken;
 const tabs=Object.entries(HOME_CATEGORIES).map(([id,name])=>`<button data-home-category="${id}" class="${s.homeCategory===id?'active':''}">${name}</button>`).join('');
 const catalog=Object.entries(HOME_ITEMS).filter(([,item])=>item.group===s.homeCategory).map(([id,item])=>
  `<button data-home-type="${id}" class="bc-home-item ${s.homeSelected===id&&s.homeAction==='place'?'active':''}" ${disabled}><b>${item.icon} ${esc(item.name)}</b><small>${item.mats} วัตถุดิบ + ${item.gold} Gold</small></button>`).join('');
 const stages=[...HOME_SIDES,...(s.homeBuilder?.expandedSides?.includes('north')?[HOME_NORTH_FINAL]:[])];
 const plots=stages.map(side=>{
  const ids=sidePlots(side),owned=ids.filter(id=>s.homeBuilder?.ownedPlots?.includes(id));
  const expanded=s.homeBuilder?.expandedSides?.includes(side),eligible=fullyOwnedSide(s.homeBuilder,side)&&!!s.wallLevel&&!expanded;
  const buttons=ids.map(id=>s.homeBuilder?.ownedPlots?.includes(id)?`<span class="bc-home-owned">✓ Plot ${id.at(-1)}</span>`:`<button data-home-plot="${id}" ${disabled}>ซื้อ ${id.at(-1)} (${HOME_PLOT_COST.gold}G + ${HOME_PLOT_COST.mats} วัตถุดิบ)</button>`).join('');
  return `<div class="bc-home-land-side"><strong>${HOME_SIDE_NAMES[side]} · ${owned.length}/3 Plot ${expanded?(side===HOME_NORTH_FINAL?'· เชื่อมหน้าผาแล้ว':'· กำแพงขยายแล้ว'):''}</strong><div class="bc-home-plots">${buttons}</div>${eligible?`<div class="bc-home-wall-actions"><button data-home-wall-preview="${side}" ${disabled}>👁 ดูแนวกำแพง</button><button data-home-wall-expand="${side}" ${disabled}>${side===HOME_NORTH_FINAL?'เชื่อมกับหน้าผา · ถอดกำแพงเหนือ':'ย้ายกำแพง (+10 ส่วน)'} ${HOME_WALL_COST.gold}G + ${HOME_WALL_COST.mats} วัตถุดิบ</button></div>`:''}</div>`;
 }).join('');
 const terrain=Object.entries(HOME_TERRAIN_BRUSHES).map(([key,item])=>`<button data-home-brush="${key}" class="${s.homeAction==='terrain'&&s.homeTerrainBrush===key?'active':''}" ${disabled}>${item.icon} ${item.name}</button>`).join('');
 const terrainQuote=s.homeTerrainDraft?quoteHomeTerrain(s.homeBuilder?.terrainEdits,s.homeTerrainDraft):{mats:0,gold:0,changes:0};
 const curtainQuote=s.homeTerrainDraft?quoteNewHomeNorthCurtains(
  deriveHomeNorthCurtains(s.homeBuilder,s.homeBuilder?.terrainEdits),deriveHomeNorthCurtains(s.homeBuilder,s.homeTerrainDraft)):{groups:0,mats:0,gold:0};
 const quote={...terrainQuote,mats:terrainQuote.mats+curtainQuote.mats,gold:terrainQuote.gold+curtainQuote.gold};
 const recovered=(s.homeBuilder?.recovery||[]).filter(o=>HOME_ITEMS[o.prefab]).slice(0,16).map(o=>`<div class="bc-home-placed"><span>📦 ${esc(HOME_ITEMS[o.prefab].name)} <small>${esc(o.reason||'รอจัดวางใหม่')}</small></span><button data-home-recover="${esc(o.id)}" ${disabled}>เลือกวางใหม่</button></div>`).join('');
 const placed=(s.homeBuilder?.placedObjects||[]).slice(-35).reverse().map(o=>{
  const item=HOME_ITEMS[o.prefab];
  return `<div class="bc-home-placed"><span>${item?.icon||'📦'} ${esc(item?.name||o.prefab)} <small>(${Math.round(o.x/64)},${Math.round(o.y/64)})</small></span><button data-home-move="${esc(o.id)}" ${disabled}>ย้าย</button><button data-home-demolish="${esc(o.id)}" ${disabled}>รื้อ</button></div>`;
 }).join('');
 return `<div class="bc-home-head"><strong>🔨 Home Builder</strong><button data-home-close aria-label="ปิดโหมดสร้าง" ${disabled}>✕</button></div>
 ${s.homeGroundBusy?'<p class="bc-home-info" role="status">⏳ กำลังวาดพื้นทางเดินด้วย Map Editor…</p>':''}
 <p class="bc-home-info">🟫 ทางเดินดิน / 🪨 ทางเดินหินใช้พื้น Map Editor จริง ขอบทางเดินต่อกันอัตโนมัติ · ย้ายและรื้อทางเดินเก่าได้ตามเดิม</p>
 <p class="bc-home-info">ซื้อ Plot 5×5 · หลังขยายเหนือช่วงแรกจะซื้อเหนือช่วงสุดท้ายได้ และหน้าผาระดับ 3 จะปิดทางเหนือแทนกำแพง · สร้างได้ตอนกลางวัน</p>
 <p class="bc-home-info">🧱 กำแพง ${wall.actual}/${wall.expected} ส่วน · ประตู ${wall.gates}/3 ${wall.broken?`<strong class="bc-home-warning">· พัง ${wall.broken} ส่วน — กดซ่อมทั้งหมดตอนกลางวัน</strong>`:''}${needsRebuild?`<strong class="bc-home-warning">· กำแพงแสดงผล ${live}/${wall.actual-wall.broken} ส่วน</strong> <button data-home-wall-rebuild ${disabled}>🔧 คืนส่วนกำแพงที่หาย (ไม่ซ่อม HP)</button>`:''}</p>
 <details class="bc-home-land" ${s.homeLandOpen?'open':''}><summary>🗺 ซื้อที่ดินและขยายกำแพง (${s.homeBuilder?.ownedPlots?.length-1||0}/15)</summary>${plots}${s.homeWallPreviewData&&!s.homeWallPreviewData.ok?`<small class="bc-home-warning">⚠ ${esc(s.homeWallPreviewData.reason)}</small>`:''}</details>
 <details class="bc-home-land" ${s.homeTerrainOpen?'open':''}><summary>⛰️ Terrain Builder (Preview ก่อนยืนยัน)</summary>
 <p class="bc-home-info">แก้เฉพาะ Plot ที่ซื้อแล้ว · ยกพื้นได้เฉพาะเหนือหลังย้ายกำแพง · คลิกพื้นที่เพื่อระบาย แล้วกดยืนยันครั้งเดียวเพื่อสร้าง Terrain จริง</p>
 ${homeAtNorthernCliff(s.homeBuilder)?'<p class="bc-home-info">🌊 ม่านน้ำตก: เลือกพู่กันน้ำ วาดบนสันหน้าผาเหนือที่ซื้อแล้วได้ครบ 15 ช่อง (รวมริมซ้าย/ขวา) จากนั้นวาดบ่อรับน้ำตรงใต้แต่ละช่อง และแม่น้ำถัดลงมาอย่างน้อยหนึ่งช่อง · กดยืนยันเพื่อสร้างม่านน้ำตกที่ต่อกันอัตโนมัติ ไม่มีแท่นเนินใหม่</p>':''}
 <div class="bc-home-terrain-tools">${terrain}</div>
 <div class="bc-home-actions"><span>ร่างแก้ไข ${quote.changes} ช่อง · ${quote.mats} วัตถุดิบ + ${quote.gold} Gold ${curtainQuote.groups?` · รวมค่าม่านน้ำตกใหม่ ${curtainQuote.groups} ผืน`:''}${s.homeTerrainNotice?` · ${esc(s.homeTerrainNotice)}`:''}</span>
 <button data-home-terrain-apply ${disabled||!quote.changes?'disabled':''}>✓ ยืนยัน</button><button data-home-terrain-cancel>✕ ล้างร่าง</button></div>
 ${s.homeBuilder?.expandedSides?.includes('north')?`<button data-home-waterfall-mode ${disabled}>🌊 สร้างน้ำตกจากเนินที่ยกเอง (3 ช่อง + ต้นน้ำ + บ่อ + แม่น้ำ)</button>`:''}
 ${s.homeBuilder?.waterfalls?.length?`<small>🌊 น้ำตก ${s.homeBuilder.waterfalls.length} จุด/ผืน · ม่านน้ำตกเหนือ ${s.homeBuilder.waterfalls.filter(w=>w.type==='north-curtain').reduce((n,w)=>n+w.sourceTiles.length,0)} ช่อง</small>`:''}</details>
 <div class="bc-home-tabs">${tabs}</div><div class="bc-home-catalog">${catalog}</div>
 <div class="bc-home-actions"><span>${s.homeAction==='move'?'📍 เลือกที่วางใหม่':'📌 '+selected.name}</span>
 <button data-home-rotate ${disabled}>↻ หมุน ${(s.homeRotation||0)*90}°</button>
 ${s.homeCategory==='houses'||s.homeAction==='move'&&HOME_ITEMS[s.homeSelected]?.group==='houses'?`<button data-home-variant ${disabled}>🎨 แบบบ้าน ${(s.homeVariant||0)+1}/3</button>`:''}
 <button data-home-undo ${disabled||!s.homeUndo?'disabled':''}>↶ Undo</button></div>
 <div class="bc-home-placed-list"><strong>ของที่วางแล้ว (${s.homeBuilder?.placedObjects?.length||0})</strong>${placed||'<small>ยังไม่มีของตกแต่ง</small>'}</div>
 ${s.homeBuilder?.recovery?.length?`<details class="bc-home-land"><summary>📦 Recovery Storage: ${s.homeBuilder.recovery.length} รายการ</summary>${recovered||'<small>Terrain และน้ำตกที่ยังต้องแก้ไขจะเก็บไว้ในเซฟ</small>'}</details>`:''}`;
}
