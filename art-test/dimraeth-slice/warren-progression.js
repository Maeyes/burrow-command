// Burrow Command progression. Main-game item, loot, rarity, refine and mastery data are authoritative.
import { MONSTERS_V2 } from '../../src/simulation/monsterDataV2.ts';
import { rollLoot } from '../../src/simulation/loot.ts';
import { EQUIPMENT_MASTER_V2, CRAFT_RECIPES_V2 } from '../../src/simulation/itemMasterV2.ts';
import { rollRarity, EQUIPMENT_RARITY_STAT_MULTIPLIER, enhancementRequirement, dismantleFragments, progressionCategory, astraliteCost, protectionRequirement, REFINE_SAFE_FLOORS, REFINE_SUCCESS } from '../../src/simulation/equipmentV2.ts';
import { inventoryItemMeta } from '../../src/simulation/itemTagsV2.ts';
import { masteryXpRequired, masteryContribution, masteryLevelMultiplier } from '../../src/simulation/mastery.ts';
import { WEAPON_MASTERY_MILESTONES } from '../../src/simulation/masteryMilestones.ts';
import { WEAPON_SKILLS_BY_FAMILY_V2 } from '../../src/simulation/skillEntitlements.ts';
import {perimeterBlueprint,perimeterTier,normalizeGateSelections} from './warren-perimeter.js';
import {buildingLevel,forgeRarityRoll} from './warren-village-buildings.js';
import {normalizeClassSkills} from './warren-class-cores.js';

export { EQUIPMENT_MASTER_V2, CRAFT_RECIPES_V2, EQUIPMENT_RARITY_STAT_MULTIPLIER, WEAPON_MASTERY_MILESTONES };
export const CLASS_FAMILIES=Object.freeze({guard:'swordShield',archer:'bow',scout:'dagger',brute:'hammer',axe:'axe',vanguard:'greatsword',mage:'staff'});
export const CLASS_IDS=Object.keys(CLASS_FAMILIES), GEAR_SLOTS=['weapon','armor','accessory'];
// White Ascended belongs above Mythic in the existing main-game seven-rarity table.
export const AUTO_DISMANTLE_RARITIES=Object.freeze(['normal','good','rare','epic','legend','mythic','whiteAscended']);
export function defaultAutoDismantleSettings(){return Object.fromEntries(CLASS_IDS.map(cls=>[cls,{enabled:false,minRarity:'normal',protectOtherClasses:true}]));}
export function normalizeAutoDismantleSettings(raw){
 const defaults=defaultAutoDismantleSettings();
 for(const cls of CLASS_IDS){const value=raw?.[cls];if(!value||typeof value!=='object')continue;
  defaults[cls]={enabled:value.enabled===true,
   minRarity:AUTO_DISMANTLE_RARITIES.includes(value.minRarity)?value.minRarity:'normal',
   protectOtherClasses:value.protectOtherClasses!==false};
 }
 return defaults;
}
export const SAVE_KEY='burrow-command-save-v3', PRIOR_SAVE_KEY='burrow-command-save-v2', LEGACY_SAVE_KEY='burrow-command-save-v1';
export const BUNNY_NAMES=['โมจิ','มะลิ','ถั่วแดง','ปุยฝ้าย','ข้าวปั้น','นุ่มนิ่ม','ตังเม','พุดดิ้ง','คุกกี้','จันทร์เจ้า','Mochi','Clover','Pip','Mallow','Hazel','Luna','Poppy','Basil','Maple','Biscuit'];
// Field squad slots open at Warren Lv 5/7/9. Garrison recruits occupy tower slots, never field slots.
export const MAX_FIELD_PER_CLASS=2, MASTERY_GOLD={10:180,20:600,30:1750,40:4400,50:11500};
export const MASTERY_ACTIVE_LEVELS=Object.freeze([10,20,30]);
// One canonical weapon skill per tier for each fixed Burrow class. Missing saved toggles
// default to enabled, so existing players receive earned Lv10/20/30 actives without re-unlocking.
export function classWeaponMasterySkills(s,cls){
 const m=s.mastery?.[cls],family=CLASS_FAMILIES[cls];
 return (WEAPON_SKILLS_BY_FAMILY_V2[family]||[]).map((id,index)=>{
  const level=MASTERY_ACTIVE_LEVELS[index];
  return m?.unlocked?.includes(level)&&!m?.disabledWeaponSkills?.includes(level)?id:null;
 });
}
export function toggleMasteryWeaponSkill(s,cls,level){
 const m=s.mastery?.[cls];
 if(s.night||!CLASS_FAMILIES[cls]||!MASTERY_ACTIVE_LEVELS.includes(level)||!m?.unlocked?.includes(level))return false;
 const disabled=new Set(m.disabledWeaponSkills||[]);
 if(disabled.has(level))disabled.delete(level);else disabled.add(level);
 m.disabledWeaponSkills=[...disabled].sort((a,b)=>a-b);
 return true;
}
export const FIELD_SQUAD_GATES=Object.freeze([{level:1,slots:7},{level:5,slots:9},{level:7,slots:11},{level:9,slots:14}]);
export const fieldSquadCap=warren=>FIELD_SQUAD_GATES.reduce((cap,gate)=>warren>=gate.level?gate.slots:cap,7);
export const fieldClassCap=warren=>warren>=5?MAX_FIELD_PER_CLASS:1;
// Legacy export retained for callers; additional builds are intentionally disabled.
export const BUILD_GATES=[{level:1,gold:0}];
export const minLevelForTier=tier=>[0,1,11,21,31,41,51][tier]??Infinity;
// Burrow's tier gates follow ten Warren levels, separate from the main RPG character brackets.
export function unlockedTier(warren){
 if(warren>=51)return 6;if(warren>=41)return 5;if(warren>=31)return 4;
 if(warren>=21)return 3;return warren>=11?2:1;
}
export function defaultBuilds(){return Object.fromEntries(CLASS_IDS.map(cls=>[cls,[{id:cls+'-1',name:'Class Armory',spec:'attack',gear:{weapon:null,armor:null,accessory:null}}]]));}
export function defaultProgress(){return Object.fromEntries(CLASS_IDS.map(cls=>[cls,Object.fromEntries(GEAR_SLOTS.map(slot=>[slot,{enhance:0,refine:0}]))]));}
export function defaultMastery(){return Object.fromEntries(CLASS_IDS.map(cls=>[cls,{level:1,xp:0,unlocked:[]}]));}
export function bunnyName(rng=Math.random){return BUNNY_NAMES[Math.min(BUNNY_NAMES.length-1,Math.floor(rng()*BUNNY_NAMES.length))];}
export const expRequired=level=>14+level*8;
export function giveBunnyExp(u,amount,maxLevel=999){
 u.exp=Math.max(0,(u.exp??0)+Math.max(0,Math.floor(amount)));
 const cap=Math.max(1,Math.min(999,Math.floor(maxLevel)));
 let gained=0;
 while(u.level<cap&&u.exp>=expRequired(u.level)){u.exp-=expRequired(u.level);u.level++;gained++;}
 return gained;
}
export function gearSlot(id){const t=EQUIPMENT_MASTER_V2[id];return !t?null:t.slot==='main'?'weapon':t.slot==='armor'?'armor':t.slot==='accessoryLeft'||t.slot==='accessoryRight'?'accessory':null;}
export function buildFor(s,cls){return s.builds[cls]?.[0]??null;}
export function makeBuild(){return null;}
export function classProgress(s,cls,slot){return s.progress?.[cls]?.[slot]??{enhance:0,refine:0};}
export function equippedGearIds(s){return new Set(CLASS_IDS.flatMap(cls=>(s.builds?.[cls]||[]).flatMap(b=>GEAR_SLOTS.map(slot=>b?.gear?.[slot]).filter(Boolean))));}
export function equipBuildItem(s,cls,_buildId,slot,id){
 if(s.night)return false;
 const b=buildFor(s,cls),item=s.gear.find(i=>i.id===id),t=item&&EQUIPMENT_MASTER_V2[item.templateId];
 if(!b||!GEAR_SLOTS.includes(slot)||!t||gearSlot(item.templateId)!==slot||(slot==='weapon'&&t.weaponFamily!==CLASS_FAMILIES[cls])||t.tier>unlockedTier(s.warren))return false;
 for(const c of CLASS_IDS)for(const sl of GEAR_SLOTS)if(buildFor(s,c)?.gear[sl]===id)buildFor(s,c).gear[sl]=null;
 b.gear[slot]=id;return true;
}
export function migrateSave(raw){
 if(!raw||![1,2,3].includes(raw.v))return null;
 const builds=defaultBuilds(),progress=defaultProgress(),mastery=defaultMastery();
 const inventory={...(raw.v===1?{livingMoss:raw.mats?.wood||0,brutalSpore:raw.mats?.hide||0,copperOre:raw.mats?.ore||0}:raw.inventory||{})};
 const goldRefund=raw.v===1?Object.values(raw.tier||{}).reduce((n,v)=>n+[0,20,65,155][Math.max(0,Math.min(3,Number(v)||0))],0):0;
 const gear=(raw.gear||[]).filter(p=>p&&typeof p.id==='string'&&EQUIPMENT_MASTER_V2[p.templateId]).map(p=>({
  id:p.id,templateId:p.templateId,rarity:p.rarity||'normal',
  enhance:Math.max(0,Math.min(120,Math.floor(p.enhance||0))),refine:Math.max(0,Math.min(15,Math.floor(p.refine||0))),locked:!!p.locked
 }));
 const claimed=new Set();
 for(const cls of CLASS_IDS){
  const incoming=raw.builds?.[cls]?.[0]?.gear??{};
  for(const slot of GEAR_SLOTS){
   const id=incoming[slot],piece=gear.find(p=>p.id===id);
   if(!piece||claimed.has(id)||gearSlot(piece.templateId)!==slot||(slot==='weapon'&&EQUIPMENT_MASTER_V2[piece.templateId].weaponFamily!==CLASS_FAMILIES[cls]))continue;
   builds[cls][0].gear[slot]=id;claimed.add(id);
   const old=raw.progress?.[cls]?.[slot];
   progress[cls][slot]={enhance:Math.max(0,Math.min(120,Math.floor(old?.enhance??piece.enhance??0))),
    refine:Math.max(0,Math.min(15,Math.floor(old?.refine??piece.refine??0)))};
  }
  const old=raw.mastery?.[cls]??{};
  const unlocked=(old.unlocked||[]).filter(x=>[10,20,30,40,50].includes(x));
  mastery[cls]={level:Math.max(1,Math.min(50,Math.floor(old.level||1))),
   xp:Math.max(0,Number(old.xp)||0),unlocked,
   ...(Array.isArray(old.disabledWeaponSkills)&&old.disabledWeaponSkills.length?{
    disabledWeaponSkills:[...new Set(old.disabledWeaponSkills.filter(x=>MASTERY_ACTIVE_LEVELS.includes(x)&&unlocked.includes(x)))]
   }:{})};
 }
 // Keep existing field recruits first, favoring one of each class before filling duplicate slots.
 // Extra old recruits go to reserve rather than disappearing when the current Warren squad is full.
 const count=Object.fromEntries(CLASS_IDS.map(cls=>[cls,0])),reserve=[...(raw.reserve||[])],units=[];
 const candidates=(raw.units||[]).filter(u=>u&&CLASS_FAMILIES[u.cls]).map(u=>({cls:u.cls,
  name:String(u.name||bunnyName()).slice(0,22),level:Math.max(1,Math.min(999,Math.floor(u.level||1))),
  exp:Math.max(0,Math.floor(u.exp||0)),buildId:u.cls+'-1',stance:'farm'}));
 const first=new Set(),preferred=[],duplicates=[];
 for(const item of candidates){if(!first.has(item.cls)){preferred.push(item);first.add(item.cls);}else duplicates.push(item);}
 for(const item of [...preferred,...duplicates]){
  if(units.length<fieldSquadCap(Math.max(1,Math.floor(raw.warren||1)))&&count[item.cls]<fieldClassCap(Math.max(1,Math.floor(raw.warren||1)))){units.push(item);count[item.cls]++;}
  else reserve.push(item);
 }
 const towers=(raw.towers||[]).map(t=>({x:t.x,y:t.y,hp:t.hp,level:Math.max(1,Math.min(5,t.level||1)),garrison:t.garrison&&['archer','mage'].includes(t.garrison.cls)?t.garrison:null}));
 // The retired hand-painted fence system is converted into a full common-material refund ONCE.
 // New saves always contain wallLevel, so loading them cannot refund the same pieces again.
 const wallLevel=Number.isInteger(raw.wallLevel)?perimeterTier(raw.wallLevel).level:0;
 if(raw.wallLevel===undefined){for(const f of Array.isArray(raw.fences)?raw.fences:[]){
  if(!f||!['x','y'].includes(f.axis)||!Number.isInteger(f.x)||!Number.isInteger(f.y)||f.x<0||f.x>=40||f.y<0||f.y>=40)continue;
  const receipt=f.spent&&typeof f.spent==='object'?f.spent:null;
  if(receipt){for(const [id,qty] of Object.entries(receipt))if(CONSTRUCTION_MATERIAL_IDS.includes(id)&&Number.isInteger(qty)&&qty>0)inventory[id]=(inventory[id]||0)+Math.min(150,qty);}
  else inventory.livingMoss=(inventory.livingMoss||0)+(f.kind==='gate'?150:30);
 }}
 const stored=new Map((Array.isArray(raw.fences)?raw.fences:[]).map(f=>[f?.axis+':'+f?.x+':'+f?.y,f]));
 const fences=perimeterBlueprint(wallLevel).map(f=>{
  const saved=stored.get(f.axis+':'+f.x+':'+f.y);
  return {...f,hp:Number.isFinite(saved?.hp)?Math.max(0,Math.min(f.maxHp,Math.ceil(saved.hp))):f.hp};
 });
 return {v:3,gold:Math.max(0,Math.floor((raw.gold||0)+goldRefund)),warren:Math.max(1,Math.floor(raw.warren||1)),
  wave:Math.max(1,Math.min(5,Math.floor(raw.wave||1))),cleared:!!raw.cleared,day:Math.max(1,raw.day||1),
  kills:Math.max(0,raw.kills||0),losses:Math.max(0,raw.losses||0),burrow:raw.burrow,inventory,gear,builds,progress,mastery,classSkills:normalizeClassSkills(raw.classSkills),
  reserve,autoDismantle:normalizeAutoDismantleSettings(raw.autoDismantle),
  fortification:Math.max(0,Math.min(fortificationCap(Math.max(1,Math.floor(raw.warren||1))),Math.floor(raw.fortification||0))),
  lureDay:Math.max(0,Math.floor(raw.lureDay||0)),
  wallLevel,fences,gateClosed:normalizeGateSelections(raw.gateClosed),
  healingLevel:Math.max(1,Math.min(3,raw.healingLevel||1)),
  forgeLevel:buildingLevel(raw.forgeLevel),resourceLevel:buildingLevel(raw.resourceLevel??raw.healingLevel),
  // One-time migration: timer-production fractions are not monster-loot bonuses.
  resourceGoldBank:raw.resourceBonusVersion===1?Math.max(0,Math.min(.999999,Number(raw.resourceGoldBank)||0)):0,
  resourceMatBank:raw.resourceBonusVersion===1?Math.max(0,Math.min(.999999,Number(raw.resourceMatBank)||0)):0,
  dayHealDay:Math.max(0,Math.floor(raw.dayHealDay||0)),nightHealDay:Math.max(0,Math.floor(raw.nightHealDay||0)),
  sellReserve:[0,50,100,300,500,1000].includes(raw.sellReserve)?raw.sellReserve:300,
  sellSelected:Array.isArray(raw.sellSelected)?raw.sellSelected.filter(id=>CONSTRUCTION_MATERIAL_IDS.includes(id)):CONSTRUCTION_MATERIAL_IDS.slice(),
  nextGearId:Math.max(raw.nextGearId||0,...gear.map(x=>parseInt(String(x.id).split('-').pop(),10)||0)),
  units,towers};
}
// Burrow-only Gold rewards: flat per monster rank and its actual region.
// +20% of the Forest I baseline per successive region (not compounding); no Warren-level multiplier.
// Resolve by monster type so Frontier Lure still rewards the frontier region, not the current home region.
export const BURROW_GOLD_BY_STAGE=Object.freeze({
 forest1:Object.freeze({normal:5,elite:15,boss:50}),
 forest2:Object.freeze({normal:6,elite:18,boss:60}),
 desert1:Object.freeze({normal:7,elite:21,boss:70}),
 desert2:Object.freeze({normal:8,elite:24,boss:80}),
});
export function burrowMonsterGold(type){
 const monster=MONSTERS_V2[type];
 return monster?(BURROW_GOLD_BY_STAGE[monster.mapId]?.[monster.rank]??0):0;
}
// Garrison kills bypass carrying (especially during daytime farming).
export function shouldDepositLootDirectly(isNight,killer){return isNight||!killer||!!killer.isGarrison;}
export function monsterLoot(type,rng=Math.random,dropMultiplier=1.25){
 const def=MONSTERS_V2[type];return def?rollLoot(def.loot,rng,dropMultiplier):{gold:0,items:{}};
}
export function addInventory(inv,items){for(const [id,n] of Object.entries(items||{}))if(n>0)inv[id]=(inv[id]||0)+Math.floor(n);}
// Only abundant baseline Forest materials fund buildings; rare crafting mats,
// blueprints, upgrade stones and fragments never enter construction spending.
export const CONSTRUCTION_MATERIAL_IDS=Object.freeze(['livingMoss','brutalSpore','copperOre','duneRunnerClaw','cactusSpine','moonstoneShard']);
// Refund exactly half of a player-built fence/gate in the SAME common materials paid,
// including mixed receipts containing odd quantities (never create rare crafting items).
export function constructionRefund(spent){
 const parts=Object.entries(spent||{}).filter(([id,qty])=>CONSTRUCTION_MATERIAL_IDS.includes(id)&&Number.isInteger(qty)&&qty>0);
 const refund=Object.fromEntries(parts.map(([id,qty])=>[id,Math.floor(qty/2)]));
 let extra=Math.floor(parts.reduce((sum,[,qty])=>sum+qty,0)/2)-Object.values(refund).reduce((sum,qty)=>sum+qty,0);
 for(const [id,qty] of parts)if(extra>0&&qty%2){refund[id]++;extra--;}
 return refund;
}
export function constructionMaterialCount(inv){return CONSTRUCTION_MATERIAL_IDS.reduce((total,id)=>total+Math.max(0,inv[id]||0),0);}
export function spendConstructionMaterials(inv,amount){
 if(!Number.isInteger(amount)||amount<0||constructionMaterialCount(inv)<amount)return false;
 for(const id of CONSTRUCTION_MATERIAL_IDS){const used=Math.min(amount,inv[id]||0);inv[id]=(inv[id]||0)-used;amount-=used;if(!amount)break;}
 return true;
}
export const warrenConstructionCost=level=>({gold:0,mats:24+16*(Math.max(1,level)-1)});
export const fortificationCap=warren=>1+2*Math.max(1,warren);
export const fortificationCost=(fortification,warren)=>12+10*Math.max(0,fortification)+8*(Math.max(1,warren)-1);
export const fortificationHpBonus=level=>35*Math.max(0,level);
// One action pays exactly the same 60 HP / 12 Gold rate as manual repair, without partial purchases.
export function repairAllQuote(s,maxHallHp,repairHp=60,repairGold=12){
 const hallMissing=Math.max(0,Math.ceil(maxHallHp-(s.burrow||0)));
 const damagedTowers=(s.towers||[]).filter(t=>t.hp<t.maxHp);
 const towerMissing=damagedTowers.reduce((n,t)=>n+Math.max(0,Math.ceil(t.maxHp-t.hp)),0);
 const wallPieces=(s.wallLevel>0?s.fences:[])||[];
 const damagedWall=wallPieces.filter(f=>(f.kind==='fence'||f.kind==='gate')&&f.hp<f.maxHp);
 const wallMissing=damagedWall.reduce((n,f)=>n+Math.max(0,Math.ceil(f.maxHp-f.hp)),0);
 const missing=hallMissing+towerMissing+wallMissing;
 return {hallMissing,towerMissing,towerCount:damagedTowers.length,...(s.wallLevel>0?{wallMissing,wallCount:damagedWall.length}:{}),missing,repairs:Math.ceil(missing/repairHp),gold:Math.ceil(missing/repairHp)*repairGold};
}
export function repairEverything(s,maxHallHp,repairHp=60,repairGold=12){
 if(s.night)return null;
 const quote=repairAllQuote(s,maxHallHp,repairHp,repairGold);
 if(!quote.repairs||(s.gold||0)<quote.gold)return null;
 s.gold-=quote.gold;s.burrow=maxHallHp;
 for(const t of s.towers||[])t.hp=t.maxHp;
 if(s.wallLevel>0)for(const f of s.fences||[])if(f.kind==='fence'||f.kind==='gate')f.hp=f.maxHp;
 return quote;
}
export function craftMaterialCount(inv){return Object.entries(inv).reduce((sum,[id,n])=>sum+(inventoryItemMeta(id).category==='Crafting Mat'?Math.max(0,n):0),0);}
export function spendCraftMaterials(inv,quantity){
 if(craftMaterialCount(inv)<quantity)return false;
 const ids=Object.keys(inv).filter(id=>inventoryItemMeta(id).category==='Crafting Mat')
 .sort((a,b)=>{const p=id=>{const k=['livingMoss','brutalSpore','copperOre'].indexOf(id);return k<0?100:k;};return p(a)-p(b);});
 for(const id of ids){const n=Math.min(quantity,inv[id]);inv[id]-=n;quantity-=n;if(!quantity)break;}
 return true;
}
export function canCraft(s,id){
 const t=EQUIPMENT_MASTER_V2[id],r=CRAFT_RECIPES_V2[id];
 if(s.night||!t||!r||!gearSlot(id)||!r.available||t.tier>unlockedTier(s.warren))return false;
 return s.gold>=r.gold&&(s.inventory[r.blueprintId]||0)>=1&&(s.inventory[r.oreId]||0)>=r.oreQty
  &&r.materials.every(m=>(s.inventory[m.itemId]||0)>=m.qty);
}
export function craftGear(s,id,rng=Math.random){
 if(!canCraft(s,id))return null;
 const r=CRAFT_RECIPES_V2[id];s.gold-=r.gold;
 const req={[r.blueprintId]:1,[r.oreId]:r.oreQty};
 for(const m of r.materials)req[m.itemId]=(req[m.itemId]||0)+m.qty;
 for(const [key,n] of Object.entries(req))s.inventory[key]-=n;
 const p={id:'bc-gear-'+(++s.nextGearId),templateId:id,rarity:rollRarity(forgeRarityRoll(rng(),s.forgeLevel)),enhance:0,refine:0,locked:false};
 s.gear.push(p);return p;
}
export function craftBatch(s,id,qty=1,rng=Math.random){
 if(s.night||!Number.isInteger(qty)||qty<1||qty>50)return [];
 const made=[];
 for(let i=0;i<qty;i++){const piece=craftGear(s,id,rng);if(!piece)break;made.push(piece);}
 return made;
}
export function enhanceSlot(s,cls,slot){
 if(s.night||!buildFor(s,cls)?.gear[slot])return null;
 const level=classProgress(s,cls,slot).enhance+1;
 if(level>120)return null;
 const id=buildFor(s,cls).gear[slot],t=EQUIPMENT_MASTER_V2[s.gear.find(p=>p.id===id).templateId],req=enhancementRequirement(t.baseGoldCost,level);
 if(s.gold<req.gold||(s.inventory[req.stoneId]||0)<req.stoneQty)return null;
 s.gold-=req.gold;s.inventory[req.stoneId]-=req.stoneQty;s.progress[cls][slot].enhance++;
 return req;
}
export function enhanceGear(s,id){const p=s.gear.find(x=>x.id===id);if(!p)return null;
 for(const cls of CLASS_IDS)for(const slot of GEAR_SLOTS)if(buildFor(s,cls)?.gear[slot]===id)return enhanceSlot(s,cls,slot);
 return null;
}
export function enhanceAll(s,cls){
 if(s.night||!CLASS_FAMILIES[cls])return {levels:0,gold:0};
 const before=s.gold;let levels=0;
 // Lowest progress first, deterministic. Never loop after all three slots fail affordability checks.
 for(let i=0;i<360;i++){
  const slots=GEAR_SLOTS.filter(slot=>buildFor(s,cls)?.gear[slot]).sort((a,b)=>classProgress(s,cls,a).enhance-classProgress(s,cls,b).enhance);
  let done=false;for(const slot of slots)if(enhanceSlot(s,cls,slot)){levels++;done=true;break;}
  if(!done)break;
 }
 return {levels,gold:before-s.gold};
}
// Burrow Command balance only: keep the main Bunny World refinement rules unchanged.
// Exact main-game success rates. Only failed-attempt downgrade chance differs for Burrow.
export const BURROW_REFINE_SUCCESS=Object.freeze([...REFINE_SUCCESS]);
export const BURROW_REFINE_FAIL_DROP_CHANCE=.20;
// Each attempt costs Gold as well as Astralite, including failed or protected attempts.
// A single shared quote is authoritative for UI, affordability and the actual transaction.
export function burrowRefineGoldCost(target,baseGoldCost=0){
 if(!Number.isInteger(target)||target<1||target>15)throw new Error('invalid-refine-target');
 return Math.ceil(60*Math.pow(target,1.5)+Math.max(0,Number(baseGoldCost)||0)*.15);
}
export function resolveBurrowRefinement(current,roll,protectedAttempt=false,dropRoll=0){
 if(!Number.isInteger(current)||current<0||current>=15)throw new Error('invalid-refine-level');
 const target=current+1,protection=protectedAttempt?protectionRequirement(target):null;
 if(roll<BURROW_REFINE_SUCCESS[current])return {success:true,level:target,astralite:astraliteCost(target),protection,dropped:false};
 const floor=REFINE_SAFE_FLOORS.reduce((f,n)=>n<=current?n:f,0);
 const level=protectedAttempt||dropRoll>=BURROW_REFINE_FAIL_DROP_CHANCE?current:Math.max(floor,current-1);
 return {success:false,level,astralite:astraliteCost(target),protection,dropped:level<current};
}
export function refineQuote(s,id){
 const p=s.gear.find(x=>x.id===id);
 if(!p)return null;
 const owner=CLASS_IDS.flatMap(cls=>GEAR_SLOTS.map(slot=>({cls,slot}))).find(x=>buildFor(s,x.cls)?.gear[x.slot]===id);
 if(!owner)return null;
 const current=classProgress(s,owner.cls,owner.slot).refine;
 if(current>=15)return null;
 const target=current+1;
 return {owner,target,rate:BURROW_REFINE_SUCCESS[current],astralite:astraliteCost(target),gold:burrowRefineGoldCost(target,EQUIPMENT_MASTER_V2[p.templateId]?.baseGoldCost),protectedRequirement:protectionRequirement(target)};
}
export function refineGear(s,id,rng=Math.random,protectedAttempt=false,dropRng=Math.random){
 if(s.night)return null;
 const quote=refineQuote(s,id);if(!quote||(s.inventory.astraliteStone||0)<quote.astralite||s.gold<quote.gold)return null;
 const protect=quote.protectedRequirement;if(protectedAttempt&&protect&&(s.inventory[protect.id]||0)<protect.qty)return null;
 const progress=classProgress(s,quote.owner.cls,quote.owner.slot),before=progress.refine;
 const result=resolveBurrowRefinement(before,rng(),protectedAttempt,dropRng());
 s.inventory.astraliteStone-=quote.astralite;s.gold-=quote.gold;if(protectedAttempt&&protect)s.inventory[protect.id]-=protect.qty;
 progress.refine=result.level;return {before,...result,gold:quote.gold};
}
export function dismantleGear(s,id){
 if(s.night)return 0;
 const p=s.gear.find(x=>x.id===id);if(!p||p.locked||equippedGearIds(s).has(id))return 0;
 s.gear=s.gear.filter(x=>x.id!==id);const fragments=dismantleFragments(p.rarity);addInventory(s.inventory,{stoneFragment:fragments});return fragments;
}
export function setGearLock(s,id,locked){const p=s.gear.find(x=>x.id===id);if(!p)return false;p.locked=!!locked;return true;}
export function dismantleSelection(s,ids){
 if(s.night||!Array.isArray(ids)||new Set(ids).size!==ids.length)return null;
 const used=equippedGearIds(s);
 if(ids.some(id=>!s.gear.some(p=>p.id===id&&!p.locked&&!used.has(id))))return null;
 const total=ids.reduce((n,id)=>n+dismantleFragments(s.gear.find(p=>p.id===id).rarity),0);
 for(const id of ids)dismantleGear(s,id);
 return {count:ids.length,fragments:total};
}
export function gearScore(p,cls){
 const t=EQUIPMENT_MASTER_V2[p.templateId];if(!t)return -Infinity;
 const v=t.baseCombat,m=EQUIPMENT_RARITY_STAT_MULTIPLIER[p.rarity]??1;
 const w=cls==='guard'?{atk:.6,def:1.8,maxHp:.18}:cls==='mage'?{matk:2,atk:.2,maxHp:.08,def:.3}:
 cls==='archer'?{atk:1.7,crit:5,aspd:50,maxHp:.05}:cls==='scout'?{atk:1.5,crit:5,aspd:50,def:.2}:
 cls==='brute'?{atk:1.35,def:.7,maxHp:.1}:cls==='axe'?{atk:1.7,maxHp:.10}: {atk:1.6,crit:5,maxHp:.08};
 return Object.entries(w).reduce((n,[key,val])=>n+(v[key]||0)*val*m,0);
}
export function recommendations(s,items,focusCls){
 const used=equippedGearIds(s),assigned=new Set(),out=[];
 const order=[focusCls,...CLASS_IDS.filter(c=>c!==focusCls)];
 for(const cls of order){
  for(const slot of GEAR_SLOTS){
   const current=s.gear.find(p=>p.id===buildFor(s,cls)?.gear[slot]),old=current?gearScore(current,cls):0;
   const sorted=items.filter(p=>!assigned.has(p.id)&&!used.has(p.id)&&gearSlot(p.templateId)===slot&&
      (slot!=='weapon'||EQUIPMENT_MASTER_V2[p.templateId].weaponFamily===CLASS_FAMILIES[cls])&&
      EQUIPMENT_MASTER_V2[p.templateId].tier<=unlockedTier(s.warren))
     .sort((a,b)=>gearScore(b,cls)-gearScore(a,cls));
   if(sorted[0]&&gearScore(sorted[0],cls)>old){
    const p=sorted[0];assigned.add(p.id);
    out.push({cls,slot,itemId:p.id,currentId:current?.id||null,delta:Math.round((gearScore(p,cls)-old)*10)/10});
   }
  }
 }
 return out;
}
/** Craft first, then apply one pre-approved batch salvage rule. Never auto-equip. */
export function settleBatchCraft(s,recipeId,qty,cls,settings={},rng=Math.random){
 if(!CLASS_IDS.includes(cls)||!Number.isInteger(qty)||qty<1||qty>50||s.night)return null;
 const cfg={enabled:settings.enabled===true,
  minRarity:AUTO_DISMANTLE_RARITIES.includes(settings.minRarity)?settings.minRarity:'normal',
  protectOtherClasses:settings.protectOtherClasses!==false};
 const made=craftBatch(s,recipeId,qty,rng);if(!made.length)return null;
 const threshold=AUTO_DISMANTLE_RARITIES.indexOf(cfg.minRarity);
 const pass=p=>AUTO_DISMANTLE_RARITIES.indexOf(p.rarity)>=threshold;
 // Smart Recommendation is only an advisory: protect assigned upgrades for OTHER classes,
 // prioritising the selected class first. Never silently put new gear on a bunny.
 const reviewFor=Object.fromEntries(recommendations(s,made,cls).filter(r=>r.cls!==cls).map(r=>[r.itemId,r.cls]));
 const reserved=cfg.enabled&&cfg.protectOtherClasses?new Set(Object.keys(reviewFor)):new Set();
 const retained=[],review=[],discard=[];
 for(const p of made){
  if(!cfg.enabled||pass(p)||p.locked||equippedGearIds(s).has(p.id))retained.push(p);
  else if(reserved.has(p.id))review.push(p);
  else discard.push(p);
 }
 // All salvaged pieces are fresh, unequipped and unlocked. The batch operation is atomic:
 // a failed validation leaves them in inventory rather than reporting a false salvage.
 const result=discard.length?dismantleSelection(s,discard.map(p=>p.id)):{count:0,fragments:0};
 if(!result){retained.push(...discard);discard.length=0;}
 return {made,retained,review,dismantled:discard.map(p=>({...p})),fragments:result?.fragments||0,
  autoApplied:cfg.enabled,threshold:cfg.minRarity,protectOtherClasses:cfg.protectOtherClasses,reviewFor};
}
export function autoEquipBuild(s,cls){
 if(s.night)return 0;let n=0;
 for(const slot of GEAR_SLOTS){
  const used=equippedGearIds(s);used.delete(buildFor(s,cls)?.gear[slot]);
  const best=s.gear.filter(p=>!used.has(p.id)&&gearSlot(p.templateId)===slot&&EQUIPMENT_MASTER_V2[p.templateId].tier<=unlockedTier(s.warren)&&
    (slot!=='weapon'||EQUIPMENT_MASTER_V2[p.templateId].weaponFamily===CLASS_FAMILIES[cls]))
   .sort((a,b)=>gearScore(b,cls)-gearScore(a,cls))[0];
  if(best&&best.id!==buildFor(s,cls).gear[slot]&&equipBuildItem(s,cls,null,slot,best.id))n++;
 }
 return n;
}
export function buildCombatBonus(s,cls,_buildId,bunnyLevel=1){
 const b=buildFor(s,cls),out={atk:0,maxHp:0,def:0,critBonus:0},bonus={atk:0,def:0,hp:0};
 if(!b)return out;
 for(const slot of GEAR_SLOTS){
  const p=s.gear.find(i=>i.id===b.gear[slot]);if(!p)continue;
  const t=EQUIPMENT_MASTER_V2[p.templateId];if(bunnyLevel<minLevelForTier(t.tier))continue;
  const mult=EQUIPMENT_RARITY_STAT_MULTIPLIER[p.rarity]??1,v=classProgress(s,cls,slot),cat=progressionCategory(t.slot);
  out.atk+=(t.baseCombat.atk||0)*mult+(t.baseCombat.matk||0)*mult+(cat==='offensive'?v.enhance*2:0);
  out.maxHp+=(t.baseCombat.maxHp||0)*mult;
  out.def+=(t.baseCombat.def||0)*mult+(cat==='defensive'?v.enhance:0);
  out.critBonus+=(t.baseCombat.crit||0)*mult;
  if(cat==='offensive')bonus.atk+=v.refine*.005;
  else if(cat==='defensive'){bonus.def+=v.refine*.005;bonus.hp+=v.refine*.005;}
 }
 return {atk:out.atk*.22*(1+bonus.atk),maxHp:out.maxHp*.45*(1+bonus.hp),def:out.def*.4*(1+bonus.def),critBonus:out.critBonus};
}
export function availableRecipes(s,cls){return Object.values(EQUIPMENT_MASTER_V2).filter(t=>gearSlot(t.id)&&t.tier<=unlockedTier(s.warren)&&
 (gearSlot(t.id)!=='weapon'||t.weaponFamily===CLASS_FAMILIES[cls]));}
function settleMastery(m){
 let gained=0;
 while(m.level<50&&m.xp>=masteryXpRequired(m.level)){
  if([10,20,30,40,50].includes(m.level)&&!m.unlocked.includes(m.level))break;
  m.xp-=masteryXpRequired(m.level);m.level++;gained++;
 }
 return gained;
}
export function grantClassMastery(s,cls,bunnyLevel,enemyLevel,rank){
 const m=s.mastery[cls];if(!m||m.level>=50)return 0;
 m.xp+=masteryContribution(rank)*masteryLevelMultiplier(bunnyLevel,enemyLevel,false)*3;
 return settleMastery(m);
}
export function unlockClassMastery(s,cls){
 if(s.night||!CLASS_FAMILIES[cls])return null;
 const m=s.mastery[cls],level=m.level,cost=MASTERY_GOLD[level];
 if(!cost||m.unlocked.includes(level)||s.gold<cost)return null;
 s.gold-=cost;m.unlocked.push(level);
 // XP from time spent at a locked milestone is retained rather than discarded.
 settleMastery(m);
 return {level,cost,milestone:WEAPON_MASTERY_MILESTONES[CLASS_FAMILIES[cls]].find(x=>x.level===level)};
}
export function unlockedMastery(s,cls,level){return (s.mastery[cls]?.unlocked||[]).includes(level);}
