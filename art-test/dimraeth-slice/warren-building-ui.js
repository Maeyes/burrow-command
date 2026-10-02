import {warrenConstructionCost,fortificationCost,fortificationCap,constructionMaterialCount} from './warren-progression.js';
import {BUILDING_LEVEL_MAX,FORGE_COST,RESOURCE_COST,buildingLevelCap,resourceBonusRate} from './warren-village-buildings.js';
import {PHASE1_MAX_LEVEL} from './warren-phase1.js';
const head=(icon,name,subtitle)=>'<header class="bc-modal-header"><div>'+icon+' <span><h2>'+name+'</h2><small>'+subtitle+'</small></span></div><button data-modal-close aria-label="ปิดหน้าต่าง">✕</button></header>';
export function renderHallBuildingHtml(s,maxHall,healAmount){
 const up=warrenConstructionCost(s.warren),mats=constructionMaterialCount(s.inventory);
 const boost=fortificationCost(s.fortification,s.warren),maxFort=fortificationCap(s.warren);
 const healUsed=s.night?s.nightHealDay===s.day:s.dayHealDay===s.day;
 const wounded=s.units.some(u=>!u.down&&u.hp>0&&u.hp<u.maxHp);
 return head('🏠','โพรงกระต่าย · Lv '+s.warren,'ศูนย์กลางหมู่บ้าน · ป้องกันและรักษากระต่าย')+
 '<div class="bc-modal-body bc-building-body"><div class="bc-building-stat"><b>HP '+Math.ceil(s.burrow)+' / '+maxHall+'</b><span>สกิล Heal +'+healAmount+' HP ต่อกระต่าย</span></div>'+
 '<section><h3>✚ Auto Heal ทั้งกองทัพ</h3><p>โพรงฮีลให้อัตโนมัติเมื่อกระต่ายตัวไหน HP ต่ำกว่า 50% ฮีลทุกตัวครั้งละ 20% ของ Max HP บ้าน · 1 ครั้งกลางวัน และ 1 ครั้งกลางคืน · ไม่ชุบชีวิต</p>'+
 '<p class="bc-heal-status">'+(healUsed?'✓ ใช้ Heal ช่วงนี้แล้ว · พร้อมอีกครั้ง'+(s.night?'ตอนเช้า':'ตอนค่ำ'):'● พร้อมฮีลอัตโนมัติ · +'+healAmount+' HP')+'</p></section>'+
 '<section><h3>⬆ อัปเกรดโพรง</h3><p>ผ่านบอสเวฟ 5 ของเลเวลนี้ก่อน จึงอัปเป็นเลเวลถัดไปได้</p>'+
 '<button data-hall-upgrade '+(s.night||s.warren>=PHASE1_MAX_LEVEL||!s.cleared||mats<up.mats?'disabled':'')+'>'+(s.warren>=PHASE1_MAX_LEVEL?'บ้านถึงเพดาน Phase 1 แล้ว':'บ้าน Lv '+(s.warren+1)+' · '+up.mats+' วัตถุดิบ')+'</button></section>'+
 '<section><h3>🧱 เสริมฐาน</h3><p>เพิ่ม HP สูงสุด +35 โดยไม่ต้องผ่านบอส</p>'+
 '<button data-hall-fortify '+(s.night||s.fortification>=maxFort||mats<boost?'disabled':'')+'>'+(s.fortification>=maxFort?'เสริมฐานเต็มแล้ว':'เสริมฐาน · '+boost+' วัตถุดิบ')+'</button></section></div>';
}
export function renderBlacksmithBuildingHtml(s){
 const lv=s.forgeLevel||1,cost=FORGE_COST[lv]||0,cap=buildingLevelCap(s.warren);
 return head('⚒','โรงตีเหล็ก · Lv '+lv,'เพิ่มโอกาสออก Rarity สูง · ใช้สูตรคราฟต์เดิม')+
 '<div class="bc-modal-body bc-building-body"><div class="bc-building-stat"><b>โบนัส Rarity Lv '+lv+'</b><span>'+(lv===1?'โอกาสพื้นฐาน':'เพิ่มน้ำหนักฝั่ง Rarity สูง '+((lv-1)*10)+'%')+'</span></div>'+
 '<section><h3>การคราฟต์</h3><p>อัปเกรดโรงตีเหล็กจะเพิ่มโอกาสได้ Rarity ดีขึ้นเท่านั้น ไม่เพิ่ม Enhance หรือ Refine และไม่เปลี่ยนสูตรคราฟต์</p>'+
 '<button data-open-crafting>⚒ เปิดหน้าคราฟต์อุปกรณ์</button></section>'+
 '<section><h3>อัปเกรดโรงตีเหล็ก</h3><button data-forge-upgrade '+(s.night||lv>=cap||s.gold<cost?'disabled':'')+'>'+
 (lv>=BUILDING_LEVEL_MAX?'เต็มระดับแล้ว':lv>=cap?'ปลดเพดานถัดไปเมื่อบ้าน Lv '+(s.warren<5?5:s.warren<10?10:s.warren<15?15:20):'ขึ้น Lv '+(lv+1)+' · '+cost+' Gold')+'</button></section></div>';
}
export function renderResourceBuildingHtml(s){
 const lv=s.resourceLevel||1,cost=RESOURCE_COST[lv]||0,bonus=Math.round(resourceBonusRate(lv)*100),cap=buildingLevelCap(s.warren);
 return head('📦','โรงผลิตทรัพยากร · Lv '+lv,'เพิ่มรางวัลจากมอนสเตอร์แทนการผลิตต่อวินาที')+
 '<div class="bc-modal-body bc-building-body"><div class="bc-building-stat"><b>+'+bonus+'% Gold จากมอนสเตอร์</b><span>+'+bonus+'% วัตถุดิบทั่วไปที่มอนสเตอร์ดรอป</span></div>'+
 '<section><h3>โบนัสผลตอบแทนการล่า</h3><p>ได้รับเมื่อฆ่ามอนสเตอร์ทั้งกลางวันและกลางคืน รวมถึงของที่กระต่ายขนกลับบ้าน โบนัสสะสมเศษจนได้เป็นจำนวนเต็ม ไม่เพิ่ม Blueprint หินอัปเกรด ของหายาก หรือ Gold จาก Quick Sell และไม่มีรายได้ขณะไม่ได้ล่า</p></section>'+
 '<section><h3>อัปเกรดโรงผลิต</h3><button data-resource-upgrade '+(s.night||lv>=cap||s.gold<cost?'disabled':'')+'>'+
 (lv>=BUILDING_LEVEL_MAX?'เต็มระดับแล้ว':lv>=cap?'ปลดเพดานถัดไปเมื่อบ้าน Lv '+(s.warren<5?5:s.warren<10?10:s.warren<15?15:20):'ขึ้น Lv '+(lv+1)+' · '+cost+' Gold · โบนัส +'+Math.round(resourceBonusRate(lv+1)*100)+'%')+'</button></section></div>';
}
