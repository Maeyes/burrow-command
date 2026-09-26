import {describe,it,expect} from 'vitest';
import {CLASS_IDS,CLASS_FAMILIES,SAVE_KEY,PRIOR_SAVE_KEY,LEGACY_SAVE_KEY,MAX_FIELD_PER_CLASS,
 defaultBuilds,defaultMastery,defaultProgress,migrateSave,expRequired,giveBunnyExp,monsterLoot,
 addInventory,craftMaterialCount,spendCraftMaterials,scaledWarrenGold,shouldDepositLootDirectly,unlockedTier,minLevelForTier,
 availableRecipes,canCraft,craftGear,craftBatch,enhanceGear,enhanceAll,refineGear,refineQuote,
 dismantleGear,dismantleSelection,setGearLock,recommendations,
 buildFor,buildCombatBonus,equipBuildItem,autoEquipBuild,makeBuild,equippedGearIds,
 grantClassMastery,unlockClassMastery,unlockedMastery,MASTERY_GOLD,EQUIPMENT_MASTER_V2}
 from './warren-progression.js';
import {BURROW_REFINE_SUCCESS,BURROW_REFINE_FAIL_DROP_CHANCE,resolveBurrowRefinement} from './warren-progression.js';
import {renderSquadHtml,renderForgeHtml,renderHeroHtml,renderInventoryHtml,renderItemDetailHtml,gameIcon} from './warren-ui.js';
import {renderTowerHtml,renderLodgeHtml,renderMasteryHtml,renderBatchHtml} from './warren-extra-ui.js';
import {masteryXpRequired} from '../../src/simulation/mastery.ts';

const classes=Object.fromEntries(CLASS_IDS.map(c=>[c,{name:c,icon:'🐰'}]));
const old=()=>({v:2,gold:500,warren:3,wave:5,day:12,burrow:200,kills:70,losses:3,cleared:false,
 inventory:{tier1Blueprint:8,copperOre:60,livingMoss:90,brutalSpore:90,verdantAetherstone:30,astraliteStone:30},
 gear:[],builds:defaultBuilds(),units:[{cls:'guard',name:'Pip',level:8,exp:19},{cls:'guard',name:'Maple',level:6,exp:12},{cls:'archer',name:'Luna',level:2,exp:0}],
 towers:[{x:121,y:140,hp:160}]});
const starter=()=>migrateSave(old());
const fund=s=>{s.gold=20000;addInventory(s.inventory,{tier1Blueprint:80,copperOre:800,livingMoss:800,brutalSpore:800,verdantAetherstone:80,astraliteStone:100});return s;};

describe('Burrow Command new progression',()=>{
 it('migrates v1/v2 to v3 without losing levels, items, towers or old upgrades',()=>{
  const s=migrateSave(old());
  expect(SAVE_KEY).toBe('burrow-command-save-v3');expect(PRIOR_SAVE_KEY).toBe('burrow-command-save-v2');
  expect(LEGACY_SAVE_KEY).toBe('burrow-command-save-v1');
  expect(s).toMatchObject({v:3,gold:500,warren:3,wave:5,day:12,kills:70,losses:3});
  expect(s.units.map(u=>u.level)).toEqual([8,2]); // At Warren 3, two field slots favor existing class variety.
  expect(s.reserve).toMatchObject([{cls:'guard',name:'Maple',level:6,exp:12}]);
  expect(s.towers[0]).toMatchObject({level:1,hp:160,garrison:null});
  expect(s.progress.guard.weapon).toEqual({enhance:0,refine:0});
  expect(s.mastery.mage).toEqual({level:1,xp:0,unlocked:[]});
  const v1=migrateSave({v:1,gold:70,warren:2,mats:{wood:3,hide:4,ore:5},tier:{guard:1},
   units:[{cls:'guard'}],towers:[]});
  expect(v1.gold).toBe(90);
  expect(v1.inventory).toMatchObject({livingMoss:3,brutalSpore:4,copperOre:5});
  expect(migrateSave(JSON.parse(JSON.stringify(s))).units).toEqual(s.units);
 });
 it('limits field bunnies by Warren capacity, preserving existing class variety and extra recruits',()=>{
  const raw=old();raw.units.push({cls:'guard',name:'Third',level:12,exp:120});
  const s=migrateSave(raw);
  expect(MAX_FIELD_PER_CLASS).toBe(2);expect(s.units.filter(u=>u.cls==='guard')).toHaveLength(1);
  expect(s.reserve).toMatchObject([{name:'Maple',level:6,exp:12},{name:'Third',level:12,exp:120}]);
  expect(migrateSave(JSON.parse(JSON.stringify(s))).reserve).toEqual(s.reserve);
  expect(CLASS_IDS).toEqual(['guard','archer','scout','brute','axe','vanguard','mage']);
 });
 it('constrains gold growth while keeping rewards positive as the village levels',()=>{
  expect(scaledWarrenGold(100,1)).toBe(13);
  expect(scaledWarrenGold(100,10)).toBe(26);
  expect(scaledWarrenGold(100,50)).toBe(31);
  expect(scaledWarrenGold(1,1)).toBe(1);
 });
 it('allows bunny XP to grow beyond village level without losing banked experience',()=>{
  const u={level:1,exp:0};
  expect(giveBunnyExp(u,100)).toBeGreaterThan(1);
  expect(u.level).toBeGreaterThan(3);
  expect(u.exp).toBeGreaterThanOrEqual(0);
 });
 it('banks EXP at three times the Warren level and releases it after the next village upgrade',()=>{
  const unit={level:1,exp:0};
  expect(giveBunnyExp(unit,10000,3)).toBe(2);
  expect(unit.level).toBe(3);expect(unit.exp).toBeGreaterThan(9000);
  expect(giveBunnyExp(unit,0,6)).toBe(3);
  expect(unit.level).toBe(6);
 });
 it('deposits daytime tower-garrison kills directly while field-bunny drops are carried',()=>{
  expect(shouldDepositLootDirectly(false,{isGarrison:true,cls:'archer'})).toBe(true);
  expect(shouldDepositLootDirectly(false,{isGarrison:false,cls:'archer'})).toBe(false);
  expect(shouldDepositLootDirectly(false,null)).toBe(true);
  expect(shouldDepositLootDirectly(true,{isGarrison:false,cls:'archer'})).toBe(true);
 });
 it('uses canonical monster loot and prevents building consumption of blueprints and aetherstones',()=>{
  const loot=monsterLoot('mossblob1',()=>0);
  expect(loot.gold).toBeGreaterThan(0);
  expect(loot.items.livingMoss).toBeGreaterThan(0);
  const s=starter();const before=s.inventory.tier1Blueprint;
  const count=craftMaterialCount(s.inventory);
  expect(spendCraftMaterials(s.inventory,9)).toBe(true);
  expect(craftMaterialCount(s.inventory)).toBe(count-9);
  expect(s.inventory.tier1Blueprint).toBe(before);
 });
 it('crafts batches of real recipe items; stops at resource shortage; rejects >50',()=>{
  const s=fund(starter());
  expect(canCraft(s,'mosswoodBow')).toBe(true);
  const made=craftBatch(s,'mosswoodBow',10,()=>.51);
  expect(made).toHaveLength(10);
  expect(made.every(p=>p.rarity==='good'&&!p.locked)).toBe(true);
  expect(new Set(made.map(p=>p.id)).size).toBe(10);
  expect(craftBatch(s,'mosswoodBow',51)).toEqual([]);
  expect(craftBatch({...s,night:true},'mosswoodBow',1)).toEqual([]);
  const only=starter();only.inventory.tier1Blueprint=1;only.gold=999;
  expect(craftBatch(only,'mosswoodBow',10)).toHaveLength(1);
 });
 it('collapses legacy multi-build gear into class armory, transferring slot upgrades and keeping spare gear',()=>{
  const raw=old(),s=fund(starter());
  const a=craftGear(s,'mosswoodBow',()=>0),b=craftGear(s,'t1Armor',()=>0);
  raw.gear=[{...a,enhance:6,refine:3},{...b,enhance:4,refine:1}];
  raw.builds.archer=[{id:'archer-1',gear:{weapon:a.id,armor:null,accessory:null}},
                     {id:'archer-2',gear:{weapon:null,armor:b.id,accessory:null}}];
  const result=migrateSave(raw);
  expect(result.builds.archer).toHaveLength(1);
  expect(result.builds.archer[0].gear.weapon).toBe(a.id);
  expect(result.builds.archer[0].gear.armor).toBeNull();
  expect(result.progress.archer.weapon).toEqual({enhance:6,refine:3});
  expect(result.gear).toHaveLength(2);
  expect(makeBuild(result,'archer')).toBeNull();
 });
 it('equips one class armory per class and cannot duplicate a physical item',()=>{
  const s=fund(starter());
  const bow=craftGear(s,'mosswoodBow',()=>0),armor=craftGear(s,'t1Armor',()=>0);
  expect(equipBuildItem(s,'guard',null,'weapon',bow.id)).toBe(false);
  expect(equipBuildItem(s,'archer',null,'weapon',bow.id)).toBe(true);
  expect(equipBuildItem(s,'archer',null,'armor',armor.id)).toBe(true);
  expect(equipBuildItem(s,'guard',null,'armor',armor.id)).toBe(true);
  expect(buildFor(s,'archer').gear.armor).toBeNull();
  expect(dismantleGear(s,armor.id)).toBe(0);
  expect(equippedGearIds(s).has(armor.id)).toBe(true);
 });
 it('Enhance All upgrades slots (not items) and new rarity inherits slot levels',()=>{
  const s=fund(starter());
  const a=craftGear(s,'mosswoodBow',()=>0),b=craftGear(s,'mosswoodBow',()=>.99);
  expect(equipBuildItem(s,'archer',null,'weapon',a.id)).toBe(true);
  const result=enhanceAll(s,'archer');
  expect(result.levels).toBeGreaterThan(0);
  const level=s.progress.archer.weapon.enhance;
  expect(a.enhance).toBe(0);
  expect(equipBuildItem(s,'archer',null,'weapon',b.id)).toBe(true);
  expect(s.progress.archer.weapon.enhance).toBe(level);
  expect(enhanceGear(s,a.id)).toBeNull(); // unequipped item cannot consume stones.
  expect(buildCombatBonus(s,'archer',null,1).atk).toBeGreaterThan(0);
 });
 it('refines occupied armory slots using main-game Astralite/Protection and respects safe floors',()=>{
  const s=fund(starter()),item=craftGear(s,'mosswoodBow',()=>0);
  expect(refineQuote(s,item.id)).toBeNull();
  expect(equipBuildItem(s,'archer',null,'weapon',item.id)).toBe(true);
  expect(refineQuote(s,item.id)).toMatchObject({target:1,rate:1,astralite:1});
  expect(refineGear(s,item.id,()=>0)).toMatchObject({success:true,level:1});
  s.progress.archer.weapon.refine=5;s.inventory.refineProtectionLv1=1;
  expect(refineGear(s,item.id,()=>.99,true,()=>0)).toMatchObject({success:false,level:5,dropped:false});
  expect(s.inventory.refineProtectionLv1).toBe(0);
  expect(refineGear(s,item.id,()=>0)).toMatchObject({success:true,level:6});
  const replacement=craftGear(s,'mosswoodBow',()=>.51);
  expect(equipBuildItem(s,'archer',null,'weapon',replacement.id)).toBe(true);
  expect(s.progress.archer.weapon.refine).toBe(6);
 });
 it('locks inventory pieces, never dismantles equipped/locked gear, requires explicit selected ids',()=>{
  const s=fund(starter()),[a,b,c]=craftBatch(s,'mosswoodBow',3,()=>0);
  expect(setGearLock(s,a.id,true)).toBe(true);
  expect(equipBuildItem(s,'archer',null,'weapon',b.id)).toBe(true);
  expect(dismantleSelection(s,[a.id,c.id])).toBeNull();
  expect(dismantleSelection(s,[b.id])).toBeNull();
  const r=dismantleSelection(s,[c.id]);
  expect(r).toMatchObject({count:1});expect(s.gear).toHaveLength(2);
  expect(dismantleSelection({...s,night:true},[a.id])).toBeNull();
 });
 it('recommends current class first and another eligible class for remaining shared gear, never duplicates',()=>{
  const s=fund(starter());
  const a=craftGear(s,'t1Armor',()=>.99),b=craftGear(s,'t1Armor',()=>.51);
  const r=recommendations(s,[a,b],'archer');
  expect(r[0].cls).toBe('archer');
  expect(r.some(x=>x.cls==='guard')).toBe(true);
  expect(new Set(r.map(x=>x.itemId)).size).toBe(r.length);
  expect(r.every(x=>x.delta>0)).toBe(true);
 });
 it('mastery XP is shared at class level, milestones cost Gold, banked XP survives milestone gate',()=>{
  const s=fund(starter()),m=s.mastery.archer;
  m.level=10;m.xp=masteryXpRequired(10)*2;
  grantClassMastery(s,'archer',10,10,'boss');
  expect(m.level).toBe(10);
  expect(unlockedMastery(s,'archer',10)).toBe(false);
  const gold=s.gold;
  expect(unlockClassMastery(s,'archer')).toMatchObject({level:10,cost:MASTERY_GOLD[10]});
  expect(s.gold).toBe(gold-MASTERY_GOLD[10]);
  expect(m.level).toBeGreaterThan(10);
  expect(unlockedMastery(s,'archer',10)).toBe(true);
  expect(unlockClassMastery({...s,night:true},'archer')).toBeNull();
 });
 it('enforces night rules in real progression functions, not only disabled HTML buttons',()=>{
  const s=fund(starter()),piece=craftGear(s,'mosswoodBow',()=>0);
  equipBuildItem(s,'archer',null,'weapon',piece.id);s.night=true;
  const oldGold=s.gold;
  expect(canCraft(s,'mosswoodBow')).toBe(false);
  expect(craftGear(s,'mosswoodBow')).toBeNull();
  expect(equipBuildItem(s,'archer',null,'weapon',piece.id)).toBe(false);
  expect(enhanceGear(s,piece.id)).toBeNull();
  expect(enhanceAll(s,'archer')).toMatchObject({levels:0});
  expect(refineGear(s,piece.id)).toBeNull();
  expect(dismantleGear(s,piece.id)).toBe(0);
  expect(s.gold).toBe(oldGold);
 });
 it('includes Seven Class Armory, actual main-game icons and separate Tower/Healing/Mastery/Batch windows',()=>{
  const s=fund(starter()),p=craftGear(s,'mosswoodBow',()=>0);
  s.forgeClass='archer';s.heroPortrait='/assets/test.png';s.batchClass='archer';s.batchResults=[p.id];
  const html=[renderSquadHtml(s,classes),renderHeroHtml(s,classes),renderForgeHtml(s,classes),
    renderInventoryHtml(s),renderItemDetailHtml(s,p.id,classes),renderTowerHtml({...s,selectedTower:0},classes),
    renderLodgeHtml(s),renderMasteryHtml(s,classes),renderBatchHtml(s,classes)].join('');
  expect(html).toContain('data-batch-qty="10"');
  expect(html).toContain('Healing Lodge');
  expect(html).toContain('Class Mastery');
  expect(html).toContain('/assets/icons/equipment/mosswoodBow.png');
  expect(html).toContain('data-batch-lock=');
  expect(html).not.toContain('data-forge-new-build');
  expect(gameIcon('axe','family')).toContain('/assets/icons/family/axe.png');
 });
 it('improves only Burrow refine by x1.5 (capped, with guaranteed first level), with 20% drop on failed attempts',()=>{
  expect(BURROW_REFINE_SUCCESS[0]).toBe(1);
  expect(BURROW_REFINE_SUCCESS[1]).toBe(.95);
  expect(BURROW_REFINE_SUCCESS[8]).toBeCloseTo(.525);
  expect(BURROW_REFINE_SUCCESS[14]).toBeCloseTo(.075);
  expect(BURROW_REFINE_FAIL_DROP_CHANCE).toBe(.2);
  expect(resolveBurrowRefinement(8,.99,false,.19)).toMatchObject({success:false,level:7,dropped:true});
  expect(resolveBurrowRefinement(8,.99,false,.2)).toMatchObject({success:false,level:8,dropped:false});
  expect(resolveBurrowRefinement(9,.99,false,.01)).toMatchObject({success:false,level:9,dropped:false});
  expect(resolveBurrowRefinement(8,.99,true,0)).toMatchObject({success:false,level:8,dropped:false});
  const s=fund(starter()),piece=craftGear(s,'mosswoodBow',()=>0);
  equipBuildItem(s,'archer',null,'weapon',piece.id);
  s.progress.archer.weapon.refine=8;
  expect(refineQuote(s,piece.id).rate).toBeCloseTo(.525);
  expect(refineGear(s,piece.id,()=>.99,false,()=>.2)).toMatchObject({success:false,level:8,dropped:false});
 });
});
