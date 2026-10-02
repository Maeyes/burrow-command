import {describe,it,expect} from 'vitest';
import {NPC_COMMON_PRICES,quoteQuickSell,commitQuickSell} from './warren-quick-sell.js';
import {forgeRarityRoll,applyMonsterResourceBonus,castWarrenHeal,resourceBonusRate,buildingLevelCap} from './warren-village-buildings.js';
import {migrateSave,defaultBuilds} from './warren-progression.js';
describe('Local NPC Quick Sell',()=>{
 it('sells only opted-in common excess while retaining a per-material reserve',()=>{
  const inv={livingMoss:550,copperOre:410,brutalSpore:3,stoneFragment:900,tier1Blueprint:9,optionStone:10};
  const q=quoteQuickSell(inv,300,['livingMoss','copperOre','stoneFragment','tier1Blueprint']);
  expect(q.rows).toEqual([
   {id:'livingMoss',inStock:550,keep:300,qty:250,price:1,gold:250},
   {id:'copperOre',inStock:410,keep:300,qty:110,price:2,gold:220}
  ]);
  const state={inventory:{...inv},gold:17,night:false};
  const result=commitQuickSell(state,300,['livingMoss','copperOre','stoneFragment']);
  expect(result.gold).toBe(470);
  expect(state.gold).toBe(487);
  expect(state.inventory).toMatchObject({livingMoss:300,copperOre:300,brutalSpore:3,stoneFragment:900,tier1Blueprint:9,optionStone:10});
  expect(commitQuickSell(state,300,['livingMoss','copperOre'])).toBeNull();
 });
 it('rejects sales at night and unknown items even when a crafted item exists',()=>{
  const s={night:true,gold:1,gear:[{id:'locked',locked:true}],inventory:{livingMoss:999,astraliteStone:999}};
  expect(commitQuickSell(s,0,Object.keys(NPC_COMMON_PRICES))).toBeNull();
  s.night=false;
  expect(quoteQuickSell(s.inventory,0,['astraliteStone'])).toMatchObject({quantity:0,gold:0});
  expect(s.gear).toHaveLength(1);
 });
 it('migration keeps saved reserve and class/building settings while rejecting invalid IDs',()=>{
  const s=migrateSave({v:3,warren:7,day:6,gold:400,inventory:{livingMoss:650},
   builds:defaultBuilds(),units:[],towers:[],forgeLevel:2,resourceLevel:3,
   resourceGoldBank:.38,resourceMatBank:.97,resourceBonusVersion:1,dayHealDay:6,nightHealDay:5,
   sellReserve:500,sellSelected:['livingMoss','optionStone'],wallLevel:0});
  expect(s).toMatchObject({forgeLevel:2,resourceLevel:3,dayHealDay:6,nightHealDay:5,sellReserve:500,
    sellSelected:['livingMoss'],resourceGoldBank:.38,resourceMatBank:.97});
 });
});
describe('Village building functions',()=>{
 it('unlocks building levels gradually with Warren progression',()=>{
  expect([1,4,5,9,10,14,15,19,20,25].map(buildingLevelCap)).toEqual([1,1,3,3,5,5,8,8,10,10]);
 });
 it('blacksmith upgrades bias future rarity rolls toward the upper end without a guaranteed top rarity',()=>{
  expect(forgeRarityRoll(.5,1)).toBe(.5);
  expect(forgeRarityRoll(.5,2)).toBeGreaterThan(.5);
  expect(forgeRarityRoll(.5,3)).toBeGreaterThan(forgeRarityRoll(.5,2));
  expect(forgeRarityRoll(0,3)).toBe(0);
 });
 it('resource workshop boosts actual monster Gold and common drops by one percent per level',()=>{
  expect([1,2,3,10].map(resourceBonusRate)).toEqual([.01,.02,.03,.1]);
  for(const level of [1,2,3]){
   const state={gold:0,inventory:{livingMoss:0},resourceLevel:level,resourceGoldBank:0,resourceMatBank:0};
   let totalGold=0,totalMoss=0;
   for(let i=0;i<100;i++){
    const loot={gold:7,items:{livingMoss:1,tier1Blueprint:1,stoneFragment:10,ancientRootHeart:1}};
    applyMonsterResourceBonus(state,loot,['livingMoss','brutalSpore','copperOre']);
    totalGold+=loot.gold;totalMoss+=loot.items.livingMoss;
    expect(loot.items).toMatchObject({tier1Blueprint:1,stoneFragment:10,ancientRootHeart:1});
   }
   expect(totalGold).toBe(700+7*level);
   expect(totalMoss).toBe(100+level);
   expect(state.gold).toBe(0);expect(state.inventory.livingMoss).toBe(0);
   expect(state.resourceGoldBank).toBeCloseTo(0,8);
   expect(state.resourceMatBank).toBeCloseTo(0,8);
  }
 });
 it('loot bonus works on split common drops and keeps separate fractional banks',()=>{
  const s={resourceLevel:3,resourceGoldBank:.94,resourceMatBank:.94};
  const loot={gold:2,items:{livingMoss:1,copperOre:1,tier1Blueprint:8,optionStone:2}};
  expect(applyMonsterResourceBonus(s,loot,['livingMoss','copperOre'])).toEqual({gold:1,materials:1});
  expect(loot).toEqual({gold:3,items:{livingMoss:1,copperOre:2,tier1Blueprint:8,optionStone:2}});
  expect(s.resourceGoldBank).toBeCloseTo(0);expect(s.resourceMatBank).toBeCloseTo(0);
 });
 it('legacy passive production fractions do not turn into a free bonus on migration',()=>{
  const raw={v:3,warren:4,day:2,wallLevel:0,resourceLevel:3,resourceGoldBank:.98,resourceMatBank:.99,inventory:{},units:[],towers:[]};
  const legacy=migrateSave(raw);
  expect(legacy).toMatchObject({resourceLevel:3,resourceGoldBank:0,resourceMatBank:0});
  const updated=migrateSave({...raw,resourceBonusVersion:1});
  expect(updated.resourceGoldBank).toBeCloseTo(.98);expect(updated.resourceMatBank).toBeCloseTo(.99);
 });
 it('migrates a paid legacy Healing Lodge level into the new Resource Workshop',()=>{
  const old=migrateSave({v:3,warren:5,day:3,gold:800,inventory:{livingMoss:5},healingLevel:3,units:[],towers:[],wallLevel:0});
  expect(old.resourceLevel).toBe(3);
  expect(migrateSave({...old}).resourceLevel).toBe(3);
 });
 it('a full-HP party does not waste the once-per-phase Warren heal',()=>{
  const s={night:false,day:5,dayHealDay:0,nightHealDay:0,units:[{hp:100,maxHp:100},{hp:0,maxHp:80,down:true}]};
  expect(castWarrenHeal(s,500)).toBeNull();expect(s.dayHealDay).toBe(0);
 });
 it('Warren heal is 20% of HALL max HP for all living field rabbits, once per day and once per night',()=>{
  const s={night:false,day:3,dayHealDay:0,nightHealDay:0,units:[
   {hp:15,maxHp:200},{hp:90,maxHp:350},{hp:0,maxHp:180,down:true},{hp:100,maxHp:100}]};
  const day=castWarrenHeal(s,500);
  expect(day.amount).toBe(100);
  expect(day.healed.map(x=>x.amount)).toEqual([100,100]);
  expect(s.units.map(u=>u.hp)).toEqual([115,190,0,100]);
  expect(castWarrenHeal(s,500)).toBeNull();
  s.night=true;expect(castWarrenHeal(s,500).amount).toBe(100);
  expect(castWarrenHeal(s,500)).toBeNull();
  s.night=false;s.day=4;expect(castWarrenHeal(s,600).amount).toBe(120);
 });
});
import {shouldAutoHeal} from './warren-village-buildings.js';
describe('auto heal',()=>{
 const u=(hp,extra={})=>({hp,maxHp:100,down:false,...extra});
 it('fires once a standing bunny is at or below half HP',()=>{
  expect(shouldAutoHeal({day:3,night:false,dayHealDay:0,units:[u(80),u(50)]})).toBe(true);
  expect(shouldAutoHeal({day:3,night:false,dayHealDay:0,units:[u(80),u(51)]})).toBe(false);
 });
 it('ignores downed bunnies and an already used phase',()=>{
  expect(shouldAutoHeal({day:3,night:false,dayHealDay:0,units:[u(0,{down:true}),u(90)]})).toBe(false);
  expect(shouldAutoHeal({day:3,night:true,nightHealDay:3,units:[u(10)]})).toBe(false);
  expect(shouldAutoHeal({day:3,night:true,nightHealDay:2,dayHealDay:3,units:[u(10)]})).toBe(true);
 });
});
