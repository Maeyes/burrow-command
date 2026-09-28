import {ARCHIVE_COLLECTIONS,ARCHIVE_BOSS_BY_ID,ORIGINAL_BOSS,FIRST_ARCHIVE_BOSSES,LIVE_ARCHIVE_BOSS_IDS,archiveProgress,relicIconPath} from './warren-relic-archive.js';

const mythicBonus={dragonHeart:'Max HP +1% (กองทัพ)',}; // No speculative stat bonuses for unreleased bosses.
const portraitTitle='Mythic Collector';
function iconFor(boss,large=false){
 const src=relicIconPath(boss.relicId),size=large?'bc-relic-icon large':'bc-relic-icon';
 return src?`<img class="${size}" src="${src}" width="64" height="64" alt="${boss.relicName}" loading="lazy">`:`<span class="${size} bc-relic-glyph" aria-hidden="true">${boss.icon}</span>`;
}
function relicCard(boss,state,selected){
 const owned=Boolean(state.relics?.[boss.relicId]),kills=state.defeats?.[boss.id]||0,live=LIVE_ARCHIVE_BOSS_IDS.includes(boss.id);
 return `<button type="button" class="bc-relic-card ${owned?'owned':''} ${selected?'selected':''}" data-archive-boss="${boss.id}" aria-pressed="${selected}" aria-label="${boss.name}, ${owned?'เก็บได้แล้ว':live?'ยังไม่พบ':'ยังไม่เปิดศึก'}">
  ${iconFor(boss)}<span class="bc-relic-name"><b>${boss.relicName}</b><small>${boss.name}</small><small>${kills?'🏆 '+kills+' ครั้ง':live?'สามารถพบได้แล้ว':'Coming soon'}</small></span>
  <span class="bc-relic-state">${owned?'✓ OWNED':live?'◇ UNKNOWN':'🔒 PLANNED'}</span></button>`;
}
export function renderRelicArchiveHtml(state,tab='first',selectedBossId=null){
 const stats=archiveProgress(state),collection=ARCHIVE_COLLECTIONS.find(group=>group.id===tab),entries=collection?.bosses||FIRST_ARCHIVE_BOSSES;
 const active=entries.find(boss=>boss.id===selectedBossId)||entries[0],owned=Boolean(state.relics?.[active.relicId]),kills=state.defeats?.[active.id]||0;
 const isLive=LIVE_ARCHIVE_BOSS_IDS.includes(active.id),detailBonus=mythicBonus[active.relicId]||'ยังไม่กำหนดโบนัสจนกว่าบอสจะเปิด';
 const subset=count=>`${count.owned}/${count.total}`,progress=collection?stats.collections.find(group=>group.id===collection.id):{owned:stats.first,total:stats.total};
 const completion=stats.complete;
 return `<header class="bc-modal-header bc-archive-header"><div><span class="bc-archive-sigil" aria-hidden="true">✧</span><span><h2>Mythic Archive</h2><small>Relic Collection · บันทึกการพิชิต World Boss</small></span></div><button type="button" class="modal-close" data-modal-close aria-label="ปิด Relic Collection">✕</button></header>
 <div class="bc-modal-body bc-archive-body">
  <section class="bc-archive-overview" aria-label="ความคืบหน้าคอลเลกชันแรก"><div><small>FIRST COLLECTION</small><h3>${stats.first} <span>/ ${stats.total} Legendary Relics</span></h3><div class="bc-archive-progress" role="progressbar" aria-label="ความคืบหน้าชุดแรก" aria-valuenow="${stats.first}" aria-valuemin="0" aria-valuemax="9"><i style="width:${100*stats.first/stats.total}%"></i></div><p>เก็บครบ 9 ชิ้น ปลดล็อกฉายา ${portraitTitle} และกรอบ Portrait พิเศษ</p></div><div class="bc-archive-reward ${completion?'unlocked':''}"><b>${completion?'✦ UNLOCKED':'◇ COLLECTION REWARD'}</b><div class="bc-archive-portrait-frame" aria-label="กรอบ Portrait Mythic Collector"><span>🐰</span></div><span>Mythic Collector</span><small>${completion?'ฉายาและกรอบ Portrait ปลดล็อกแล้ว':'โบนัส Collection แยกจากโบนัส Relic รายชิ้น · ไม่มีค่าสถานะเพิ่มในชุดแรก'}</small></div></section>
  <nav class="bc-archive-tabs" aria-label="เลือกแหล่งตำนาน"><button type="button" data-archive-tab="first" class="${tab==='first'?'active':''}" aria-pressed="${tab==='first'}">✦ First Collection <small>${stats.first}/9</small></button>${ARCHIVE_COLLECTIONS.map(group=>{const total=stats.collections.find(x=>x.id===group.id);return `<button type="button" data-archive-tab="${group.id}" class="${tab===group.id?'active':''}" aria-pressed="${tab===group.id}">${group.icon} ${group.name}<small>${subset(total)}</small></button>`;}).join('')}</nav>
  <div class="bc-archive-section-title"><div><h3>${collection?collection.name+' — '+collection.nameTh:'Mythic Archive — First Collection'}</h3><p>${collection?'สำรวจรายชื่อจากตำนาน · Relic ที่ยังไม่เปิดศึกยังรับไม่ได้':'9 Legendary Relics · 8 ตำนาน และ 1 บอสต้นฉบับ'}</p></div><strong>${progress.owned}/${progress.total}</strong></div>
  <div class="bc-archive-layout"><div class="bc-relic-grid" aria-label="รายการ Relic">${entries.map(boss=>relicCard(boss,state,boss.id===active.id)).join('')}</div>
  <aside class="bc-relic-detail" aria-label="รายละเอียด Relic"><div class="bc-relic-preview">${iconFor(active,true)}<span class="${owned?'bc-archive-owned':'bc-archive-locked'}">${owned?'✦ ACQUIRED':isLive?'◇ NOT DISCOVERED':'🔒 ENCOUNTER PLANNED'}</span></div>
   <small class="bc-relic-eyebrow">LEGENDARY RELIC</small><h3>${active.relicName}</h3><p class="bc-relic-origin">${active.name}</p><p class="bc-relic-mechanic">${active.mechanic}</p>
   <dl><div><dt>บันทึกชัยชนะ</dt><dd>${kills} ครั้ง</dd></div><div><dt>Collection</dt><dd>${owned?'1 / 1':'0 / 1'}</dd></div><div><dt>โบนัส Relic</dt><dd>${owned?detailBonus:isLive?detailBonus+' · เมื่อได้รับ':'ยังไม่เปิดใช้งาน'}</dd></div></dl>
   <p class="bc-archive-note">${isLive?'Ancient Dragon: ชนะ Mythic Invasion มีโอกาส 20% ได้ Dragon Heart; ชิ้นซ้ำเปลี่ยนเป็น Essence +1':'World Boss นี้อยู่ในแผนคอนเทนต์ ยังไม่มี encounter หรือโอกาสดรอปจริงในเกม'}</p>
   </aside></div>
  <footer class="bc-archive-footer"><span>✦ Option Stone ${state.optionStones||0} · Re-option Stone ${state.reoptionStones||0} · Essence ${state.essence||0}</span><span>ชัยชนะบอสสะสม ${Object.values(stats.encounters).reduce((a,b)=>a+b,0)} ครั้ง</span></footer>
 </div>`;
}
