// Home Builder houses give the village a small gameplay bonus.
// Each house TYPE counts once: a second smithy looks nice but does not stack.
// Values are deliberately modest; tune them here only.
export const HOME_HOUSE_BONUSES=Object.freeze({
 farmerHouse:{key:'matRate',value:.03,label:'วัตถุดิบจากมอนสเตอร์ +3%'},
 storeHouse:{key:'goldRate',value:.03,label:'Gold จากมอนสเตอร์ +3%'},
 smithHouse:{key:'wallHp',value:.10,label:'HP กำแพงและประตู +10%'},
 mageHouse:{key:'cartDamage',value:.10,label:'ดาเมจรถยิงเวทย์ +10%'},
 barnHouse:{key:'restHeal',value:.50,label:'พักฟื้นในหมู่บ้านเร็วขึ้น 50%'},
 pavilion:{key:'exp',value:.10,label:'EXP กระต่าย +10%'}
});
export const NO_HOME_BONUS=Object.freeze({matRate:0,goldRate:0,wallHp:0,cartDamage:0,restHeal:0,exp:0});

export function homeBonuses(home){
 const out={...NO_HOME_BONUS},seen=new Set();
 for(const o of home?.placedObjects||[]){
  const bonus=HOME_HOUSE_BONUSES[o?.prefab];
  if(!bonus||seen.has(o.prefab))continue;
  seen.add(o.prefab);out[bonus.key]+=bonus.value;
 }
 return out;
}
// Active bonus lines for the UI, in catalog order.
export function activeHomeBonusLabels(home){
 const built=new Set((home?.placedObjects||[]).map(o=>o?.prefab));
 return Object.entries(HOME_HOUSE_BONUSES).filter(([id])=>built.has(id)).map(([,b])=>b.label);
}
