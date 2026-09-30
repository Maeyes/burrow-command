// One-line "what should I do next?" hint for the HUD.
// Pure: warren.js passes a small snapshot, this picks the single most useful goal.
export const DUSK_WARNING_S=15;

export function nextGoal(g){
 if(g.over)return null;
 if(g.night)return {tone:'night',text:`🌙 ป้องกันหมู่บ้านให้รอด · เหลือศัตรู ${g.enemies} ตัว`};
 if(g.left<=DUSK_WARNING_S)return {tone:'warn',text:`⚠️ ค่ำใน ${g.left}s · ศัตรูบุกจาก${g.gates||'ประตูรอบหมู่บ้าน'} เตรียมกำแพงและป้อมให้พร้อม`};
 if(g.units<g.squadMax&&g.recruitPrice!=null){
  return g.gold>=g.recruitPrice
   ?{tone:'goal',text:`🐰 จ้างกระต่ายเพิ่ม (${g.units}/${g.squadMax}) · ถูกสุด ${g.recruitPrice}G`}
   :{tone:'goal',text:`💰 เก็บ Gold อีก ${g.recruitPrice-g.gold}G เพื่อจ้างกระต่ายตัวถัดไป (${g.units}/${g.squadMax})`};
 }
 if(!g.wallLevel)return {tone:'goal',text:g.mats>=g.wallCost?'🧱 สร้างรั้วรอบหมู่บ้านก่อนค่ำ':`🧱 หาวัตถุดิบอีก ${g.wallCost-g.mats} ชิ้นเพื่อสร้างรั้วรอบหมู่บ้าน`};
 if(!g.towers&&g.towerMax>0)return {tone:'goal',text:`🏹 สร้างป้อมธนูป้องกันประตู (${g.towerGold}G + ${g.towerMats} วัตถุดิบ)`};
 if(g.cleared&&g.warren<g.maxWarren)return {tone:'goal',text:g.mats>=g.warrenMats?`🏠 อัปบ้านเป็น Lv ${g.warren+1} ได้แล้ว!`:`🏠 หาวัตถุดิบอีก ${g.warrenMats-g.mats} ชิ้นเพื่ออัปบ้าน Lv ${g.warren+1}`};
 if(!g.cleared)return {tone:'goal',text:`⚔️ ผ่านคืนให้ครบเพื่อเคลียร์เวฟ ${g.warren}-${g.wave}`};
 return {tone:'goal',text:'🔨 ตกแต่งหมู่บ้าน · บ้านแต่ละแบบให้โบนัสหมู่บ้าน'};
}
