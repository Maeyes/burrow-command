import waterfallGuideImage from './assets/ui/bunny_world_waterfall_update_guide.png?url';
import bossUpdateImage from './assets/ui/world-boss-update.png?url';
import waterfallUpdateImage from './assets/ui/waterfall-update.png?url';

// Independent of save slots and Warren levels: one display per published
// infographic revision, not once per login or per gameplay version.
export const WATERFALL_GUIDE_VERSION='world-boss-update-2026-09-v1';
export const WATERFALL_GUIDE_SEEN_KEY='burrow-command:seen:'+WATERFALL_GUIDE_VERSION;
export function shouldShowWaterfallIntro(storage){
 try{return (storage??globalThis.localStorage)?.getItem(WATERFALL_GUIDE_SEEN_KEY)!=='seen';}
 catch{return true;}
}
export function markWaterfallIntroSeen(storage){
 try{(storage??globalThis.localStorage)?.setItem(WATERFALL_GUIDE_SEEN_KEY,'seen');return true;}
 catch{return false;}
}
export function renderWaterfallGuideHtml({intro=false}={}){
 if(intro)return `<header class="bc-modal-header bc-waterfall-header"><div><span>✨</span><span><h2>อัปเดต v0.8.4 · New World Bosses</h2><small>King Arthur · Sun Wukong · ระบบน้ำตก</small></span></div><button type="button" data-waterfall-guide-close aria-label="ปิดประกาศอัปเดต">✕</button></header>
 <div class="bc-modal-body bc-waterfall-guide-body">
 <figure class="bc-waterfall-figure"><img src="${bossUpdateImage}" alt="บอสใหม่ King Arthur และ Sun Wukong" /><figcaption><a href="${bossUpdateImage}" target="_blank" rel="noopener noreferrer">เปิดภาพบอสเต็มขนาด</a></figcaption></figure>
 <p class="bc-waterfall-cost"><strong>บอสใหม่ 2 ตัวเข้าสู่ระบบ!</strong> หลังผ่านคืนปกติ เมื่อหมู่บ้าน Lv 5 ขึ้นไป มีโอกาสพบ World Boss <strong>15%</strong> หากพบ จะสุ่ม Ancient Dragon, Sun Wukong หรือ King Arthur ในโอกาสเท่ากัน <strong>ตัวละ 1 ใน 3</strong> (ประมาณ 5% ต่อคืนสำหรับแต่ละตัว)</p>
 <figure class="bc-waterfall-figure"><img src="${waterfallUpdateImage}" loading="lazy" alt="คู่มือสร้างน้ำตกใน Home Builder: ซื้อพื้นที่เหนือ ขยายกำแพง วางต้นน้ำและบ่อรับน้ำ แล้วเลือกหน้าผา" /><figcaption><a href="${waterfallUpdateImage}" target="_blank" rel="noopener noreferrer">เปิดภาพน้ำตกเต็มขนาด</a> · ภาพคู่มือระบุ v0.6.5; ขั้นตอนระบบล่าสุดดูในคู่มือน้ำตก</figcaption></figure>
 <button type="button" data-open-waterfall-guide>🌊 อ่านคู่มือน้ำตกฉบับปัจจุบัน</button>
 </div><footer class="bc-waterfall-guide-footer"><small>แสดงครั้งเดียวสำหรับอัปเดตนี้ · เปิดซ้ำได้จาก Patch Notes</small><button type="button" data-waterfall-guide-close>เข้าเกม</button></footer>`;
 return `<header class="bc-modal-header bc-waterfall-header"><div><span aria-hidden="true">🌊</span><span><h2 id="waterfallGuideTitle">${intro?'อัปเดตใหม่! คู่มือสร้างน้ำตก':'คู่มือสร้างน้ำตก'}</h2><small>Home Builder · เนินที่สร้างเอง และหน้าผาธรรมชาติ Lv 3</small></span></div><button type="button" data-waterfall-guide-close aria-label="ปิดคู่มือสร้างน้ำตก">✕</button></header>
 <div class="bc-modal-body bc-waterfall-guide-body" id="waterfallGuideDescription">
  <p class="bc-waterfall-cost"><strong>อัปเดต v0.8.3:</strong> ตอนนี้ต้องวาดน้ำบนสันหน้าผาเหนือด้วยตนเอง และสามารถเชื่อมหลายช่องเป็นม่านน้ำตกยาวได้ ภาพ PNG ฝั่งหน้าผาด้านล่างเป็นภาพจากระบบเดิม โปรดยึดขั้นตอนที่อธิบายใต้ภาพเป็นหลัก</p>
 <figure class="bc-waterfall-figure">
   <img src="${waterfallGuideImage}" width="1200" height="875" loading="eager" decoding="async" alt="ผังการสร้างน้ำตกสองแบบ: แบบสร้างเองยกเนินเรียงสามช่องแล้ววาดน้ำบนช่องกลางของเนิน จากนั้นวาดบ่อรับน้ำด้านล่างและแม่น้ำต่อเนื่อง; แบบหน้าผาธรรมชาติระดับ 3 ตามระบบปัจจุบันต้องวาดน้ำบนสันหน้าผาที่เป็นเจ้าของก่อน แล้ววาดบ่อใต้ทุกช่องที่เลือกกับแม่น้ำต่อเนื่อง จึงยืนยันสร้างม่านน้ำตก" />
   <figcaption>ดูผังภาพแล้วทำตามทีละขั้นใน Home Builder · บนมือถือเลื่อนภาพซ้าย–ขวาได้ · <a href="${waterfallGuideImage}" target="_blank" rel="noopener noreferrer">เปิดภาพเต็มขนาด</a></figcaption>
  </figure>
  <div class="bc-waterfall-guide-notes">
   <section><h3>⛰️ แบบ A · เนินที่สร้างเอง</h3><p>ซื้อ Plot เหนือและย้ายกำแพง เปิด Terrain Builder แล้วยกเนิน <strong>3 ช่องติดกัน</strong> วาดน้ำบน<strong>ช่องกลางของเนิน</strong> วาดบ่อรับน้ำบนพื้นระดับปกติแถวถัดไป และวาดแม่น้ำต่อจากบ่ออีกอย่างน้อยหนึ่งช่อง</p><p>กด <strong>✓ ยืนยัน Terrain</strong> รอเกมสร้างพื้นใหม่ แล้วเปิดเครื่องมือ Waterfall และคลิก<strong>ช่องต้นน้ำบนเนิน</strong></p></section>
   <section><h3>🏞️ แบบ B · ม่านน้ำตกบนหน้าผาธรรมชาติ Lv 3</h3><p>ซื้อ Plot เหนือสองช่วงให้ครบ (เหนือ 1–3 และเหนือช่วงสุดท้าย 1–3) และขยายกำแพงจนชนหน้าผา จากนั้นใช้พู่กันน้ำ<strong>วาดบนสันหน้าผาเหนือได้ครบทั้ง 15 ช่องที่ครอบครอง</strong> รวมริมซ้ายและขวา จะเลือกหนึ่งช่องหรือหลายช่องติดกันก็ได้ โดยไม่ต้องยกเนินเพิ่ม</p><p>วาด<strong>บ่อรับน้ำบนพื้นปกติใต้ช่องที่เลือกทุกช่อง</strong> แล้วต่อแม่น้ำลงมาอีกอย่างน้อยหนึ่งช่อง กด <strong>✓ ยืนยัน Terrain</strong> ระบบรวมช่องที่ติดกันเป็นม่านน้ำตกผืนเดียวอัตโนมัติ ไม่ต้องแตะบ่อทีละจุด ม่านผืนใหม่คิดค่าก่อสร้างแยกเพียงครั้งเดียว ต่อให้ขยายความกว้างในภายหลังก็ไม่คิดค่าผืนใหม่</p></section>
  </div>
  <p class="bc-waterfall-cost">ค่าก่อสร้างน้ำตกจากเนิน: 60 วัตถุดิบ + 35 Gold ต่อจุด · ม่านน้ำตกเหนือ: 60 วัตถุดิบ + 35 Gold ต่อม่านผืนใหม่ (ไม่คิดเพิ่มเมื่อขยายผืนเดิม) · ทั้งสองแบบไม่รวมค่าน้ำ ที่ดิน กำแพง และการปรับ Terrain</p>
  <p class="bc-waterfall-caution">ห้ามวางน้ำตกลอยกลางพื้นราบ ต้องมีความต่างระดับ บ่อรับน้ำ และแม่น้ำต่อเนื่องเสมอ</p>
 </div>
 <footer class="bc-waterfall-guide-footer"><small>${intro?'หลังปิดจะไม่แสดงซ้ำสำหรับคู่มือเวอร์ชันนี้ แต่เปิดดูได้เสมอจากปุ่มในคู่มือ':'กลับไปอ่านหัวข้ออื่นในคู่มือได้ทุกเมื่อ'}</small><button type="button" data-waterfall-guide-close>${intro?'เข้าใจแล้ว':'กลับไปคู่มือ'}</button></footer>`;
}
