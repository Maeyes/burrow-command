import {describe,it,expect} from 'vitest';
import {perimeterBlueprint} from './warren-perimeter.js';
import {constructionMaterialCount,spendConstructionMaterials,warrenConstructionCost,
 fortificationCap,fortificationCost,fortificationHpBonus,repairAllQuote,repairEverything,migrateSave,defaultBuilds,constructionRefund} from './warren-progression.js';

describe('Burrow Command material-only base progression',()=>{
 it('makes fortification available at day one; warren upgrades use only materials',()=>{
  expect(fortificationCap(1)).toBe(3);
  expect(fortificationCost(0,1)).toBe(12);
  expect(fortificationCost(1,1)).toBe(22);
  expect(fortificationCost(2,1)).toBe(32);
  expect(warrenConstructionCost(1)).toEqual({gold:0,mats:24});
  expect(warrenConstructionCost(2)).toEqual({gold:0,mats:40});
  expect(fortificationHpBonus(3)).toBe(105);
 });
 it('spends common forest construction items only; reserves valuable crafting items and never overdrafts',()=>{
  const inv={livingMoss:9,brutalSpore:7,copperOre:20,
    astraliteStone:50,verdantAetherstone:30,tier1Blueprint:20,stoneFragment:40,
    rareSnowIngredient:99};
  expect(constructionMaterialCount(inv)).toBe(36);
  expect(spendConstructionMaterials(inv,12)).toBe(true);
  expect(inv).toMatchObject({livingMoss:0,brutalSpore:4,copperOre:20});
  expect(constructionMaterialCount(inv)).toBe(24);
  expect(spendConstructionMaterials(inv,25)).toBe(false);
  expect(spendConstructionMaterials(inv,-1)).toBe(false);
  expect(inv).toMatchObject({astraliteStone:50,verdantAetherstone:30,
    tier1Blueprint:20,stoneFragment:40,rareSnowIngredient:99});
 });
 it('returns precisely half the actual mix of materials paid for gates and fences',()=>{
  expect(constructionRefund({livingMoss:95,copperOre:55})).toEqual({livingMoss:48,copperOre:27});
  expect(constructionRefund({livingMoss:30})).toEqual({livingMoss:15});
  expect(constructionRefund({livingMoss:1,brutalSpore:1,copperOre:1})).toEqual({livingMoss:1,brutalSpore:0,copperOre:0});
  expect(constructionRefund({astraliteStone:999,stoneFragment:50})).toEqual({});
 });
 it('migrates existing saves with no reinforcement, preserves reinforcement across reload',()=>{
  const basic={v:3,day:6,warren:2,wave:4,gold:200,inventory:{livingMoss:14},
    builds:defaultBuilds(),gear:[],units:[],towers:[]};
  const legacy=migrateSave(basic);
  expect(legacy.fortification).toBe(0);
  const fortified=migrateSave({...basic,fortification:4});
  expect(fortified.fortification).toBe(4);
  expect(migrateSave({...fortified}).fortification).toBe(4);
  expect(migrateSave({...basic,fortification:999}).fortification).toBe(fortificationCap(2));
  // Retired manually painted fences are removed and their spent materials are returned once.
  const withGate=migrateSave({...basic,inventory:{livingMoss:0},fences:[
   {x:20,y:26,axis:'x',kind:'gate',spent:{livingMoss:95,copperOre:55,astraliteStone:999}},
   {x:21,y:26,axis:'x',kind:'fence',spent:{brutalSpore:30}}]});
  expect(withGate.wallLevel).toBe(0);expect(withGate.fences).toEqual([]);
  expect(withGate.inventory).toMatchObject({livingMoss:95,copperOre:55,brutalSpore:30});
  expect(migrateSave(withGate).inventory).toEqual(withGate.inventory);
 });
 it('migrates 4-open-gate saves to 3 selectable gates without losing surviving HP or repeatedly refunding',()=>{
  const basic={v:3,warren:4,day:3,gold:500,wallLevel:1,
    gateClosed:['south','east','west','invalid','south'],inventory:{livingMoss:80},units:[],towers:[],builds:defaultBuilds(),gear:[]};
  const old=perimeterBlueprint(1);old.find(f=>f.side==='south').hp=90;
  const s=migrateSave({...basic,fences:old});
  expect(s.fences.filter(f=>f.kind==='gate').map(f=>f.side)).toEqual(['south','west','east']);
  expect(s.gateClosed).toEqual(['south','east']);
  expect(s.fences.find(f=>f.side==='south').hp).toBe(90);
  expect(s.inventory.livingMoss).toBe(80);
  expect(migrateSave(s).fences).toEqual(s.fences);
  const damaged=s.fences.find(f=>f.kind==='fence');damaged.hp=0;
  const quote=repairAllQuote({...s,night:false,burrow:500,towers:[]},500);
  expect(quote.wallMissing).toBe((s.fences.find(f=>f.side==='south').maxHp-90)+damaged.maxHp);
  const restored=repairEverything({...s,night:false,burrow:500,gold:10000,towers:[]},500);
  expect(restored.wallMissing).toBe(quote.wallMissing);
  expect(s.fences.every(f=>f.hp===f.maxHp)).toBe(true);
 });
 it('keeps purchased upgrades when an old larger perimeter save migrates to fixed 15×15 stone walls',()=>{
  const old=migrateSave({v:3,warren:8,wallLevel:3,day:9,gold:117,gateClosed:['south','west'],
    inventory:{livingMoss:35},units:[],towers:[],
    fences:[{axis:'x',x:10.5,y:10.5,kind:'fence',hp:43,maxHp:125},
      {axis:'x',x:18.5,y:29.5,kind:'gate',side:'south',len:3,hp:350,maxHp:500}]});
  expect(old.wallLevel).toBe(3);
  expect(old.fences).toHaveLength(54);
  expect(old.fences.every(f=>f.material==='stone'&&f.reinforced)).toBe(true);
  expect(old.fences.every(f=>f.x>=12.5&&f.x<=27.5&&f.y>=12.5&&f.y<=27.5)).toBe(true);
  expect(old.gateClosed).toEqual(['south','west']);
  expect(old.inventory.livingMoss).toBe(35);
  expect(old.gold).toBe(117);
  expect(migrateSave(old).fences).toEqual(old.fences);
 });
 it('repairs the entire hall and every damaged tower for the same rounded manual-repair Gold rate',()=>{
  const s={gold:40,night:false,burrow:431,towers:[{hp:120,maxHp:160},{hp:180,maxHp:180},{hp:49,maxHp:110}]};
  const quote=repairAllQuote(s,500);
  expect(quote).toEqual({hallMissing:69,towerMissing:101,towerCount:2,missing:170,repairs:3,gold:36});
  expect(repairEverything(s,500)).toEqual(quote);
  expect(s.gold).toBe(4);expect(s.burrow).toBe(500);
  expect(s.towers.map(t=>t.hp)).toEqual([160,180,110]);
  expect(repairEverything(s,500)).toBeNull();
 });
 it('repair all never partially spends when the wallet is short or during nighttime',()=>{
  const s={gold:23,night:false,burrow:400,towers:[{hp:1,maxHp:121}]};
  expect(repairAllQuote(s,500).gold).toBe(48);
  expect(repairEverything(s,500)).toBeNull();
  expect(s).toMatchObject({gold:23,burrow:400,towers:[{hp:1}]});
  s.gold=999;s.night=true;
  expect(repairEverything(s,500)).toBeNull();expect(s.gold).toBe(999);
 });
});
