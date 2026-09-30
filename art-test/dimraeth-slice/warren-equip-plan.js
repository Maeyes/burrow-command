// Equip planner for Batch Craft results: which new piece suits which class, compared with
// what that class wears now. Advisory only — the player confirms every change.
import {EQUIPMENT_MASTER_V2,CLASS_IDS,CLASS_FAMILIES,gearScore,gearSlot,buildFor,equippedGearIds,unlockedTier} from './warren-progression.js';

export const RARITY_ORDER=Object.freeze(['normal','good','rare','epic','legend','mythic','whiteAscended']);
const rank=r=>RARITY_ORDER.indexOf(r);
const round=n=>Math.round(n*10)/10;

function canWear(s,p,cls){
 const t=EQUIPMENT_MASTER_V2[p.templateId],slot=gearSlot(p.templateId);
 if(!t||!slot||t.tier>unlockedTier(s.warren))return false;
 return slot!=='weapon'||t.weaponFamily===CLASS_FAMILIES[cls];
}

/** Rows for every candidate piece (rarest first). Each row has a best pick and up to 3 options.
 *  Picks are assigned globally, biggest improvement first, so one class slot never gets two
 *  pieces and the strongest armor goes to whichever class gains the most from it. */
export function equipPlan(s,items,{minRarity='normal'}={}){
 const used=equippedGearIds(s),min=rank(minRarity);
 const pool=items.filter(p=>p&&!used.has(p.id)&&rank(p.rarity)>=min);
 const pairs=[];
 for(const p of pool)for(const cls of CLASS_IDS){
  if(!canWear(s,p,cls))continue;
  const slot=gearSlot(p.templateId),current=s.gear.find(x=>x.id===buildFor(s,cls)?.gear?.[slot])||null;
  const before=current?gearScore(current,cls):0,after=gearScore(p,cls);
  if(after>before)pairs.push({itemId:p.id,cls,slot,current,before:round(before),after:round(after),delta:round(after-before)});
 }
 pairs.sort((a,b)=>b.delta-a.delta);
 const takenItem=new Set(),takenSlot=new Set(),pick=new Map();
 for(const x of pairs){
  const key=x.cls+':'+x.slot;
  if(takenItem.has(x.itemId)||takenSlot.has(key))continue;
  takenItem.add(x.itemId);takenSlot.add(key);pick.set(x.itemId,x);
 }
 return pool.map(p=>({item:p,slot:gearSlot(p.templateId),role:EQUIPMENT_MASTER_V2[p.templateId]?.role||'neutral',
  pick:pick.get(p.id)||null,options:pairs.filter(x=>x.itemId===p.id).slice(0,3)}))
  .sort((a,b)=>(!!b.pick-!!a.pick)||rank(b.item.rarity)-rank(a.item.rarity)||(b.pick?.delta||0)-(a.pick?.delta||0));
}
