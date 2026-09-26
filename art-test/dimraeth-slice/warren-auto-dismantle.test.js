import {describe,it,expect} from 'vitest';
import {CLASS_IDS,defaultBuilds,defaultProgress,defaultMastery,defaultAutoDismantleSettings,
 normalizeAutoDismantleSettings,settleBatchCraft,migrateSave,equipBuildItem,dismantleSelection}
 from './warren-progression.js';
const state=()=>({v:3,warren:1,gold:100000,inventory:{tier1Blueprint:90,copperOre:1000,livingMoss:1000,brutalSpore:1000},
 gear:[],nextGearId:0,builds:defaultBuilds(),progress:defaultProgress(),mastery:defaultMastery(),night:false});
const config=(minRarity,protectOtherClasses=true)=>({enabled:true,minRarity,protectOtherClasses});
describe('Burrow Command pre-craft Auto Dismantle',()=>{
 it('defaults OFF and preserves each class setting across save migration',()=>{
  const defaults=defaultAutoDismantleSettings();expect(Object.keys(defaults)).toEqual(CLASS_IDS);
  expect(defaults.archer).toEqual({enabled:false,minRarity:'normal',protectOtherClasses:true});
  const prefs=normalizeAutoDismantleSettings({archer:config('legend'),mage:config('rare',false),guard:config('invalid')});
  expect(prefs.archer.minRarity).toBe('legend');expect(prefs.mage).toMatchObject({minRarity:'rare',protectOtherClasses:false});
  expect(prefs.guard.minRarity).toBe('normal');
  expect(migrateSave({...state(),autoDismantle:prefs}).autoDismantle).toEqual(prefs);
 });
 it('retains rarity >= threshold, salvages only below threshold, reports actual fragments and no auto-equip',()=>{
  const s=state(),random=[.999,.95,.85,.85,.60,.60,.60,.10,.10,.10];let i=0;
  const result=settleBatchCraft(s,'mosswoodBow',10,'archer',config('rare'),()=>random[i++]);
  expect(result.made).toHaveLength(10);expect(result.retained).toHaveLength(4);
  expect(result.review).toHaveLength(0);expect(result.dismantled).toHaveLength(6);
  expect(result.fragments).toBe(9);expect(s.inventory.stoneFragment).toBe(9);
  expect(s.gear).toHaveLength(4);expect(s.builds.archer[0].gear.weapon).toBeNull();
  expect(result.made.filter(p=>p.rarity==='mythic')).toHaveLength(1);
 });
 it('protects recommended equipment for other classes but never equips it automatically',()=>{
  const s=state();const r=settleBatchCraft(s,'t1Armor',3,'guard',config('legend',true),()=>.01);
  expect(r.review.length).toBeGreaterThan(0);
  expect(r.review.every(p=>p.rarity==='normal')).toBe(true);
  expect(s.gear.every(p=>r.review.some(v=>v.id===p.id))).toBe(true);
  expect(s.builds.archer[0].gear.armor).toBeNull();
  const unprotected=state(),x=settleBatchCraft(unprotected,'t1Armor',3,'guard',config('legend',false),()=>.01);
  expect(x.review).toHaveLength(0);expect(x.dismantled).toHaveLength(3);
 });
 it('when disabled keeps all 50, supports White Ascended, and never salvages locked or equipped existing items',()=>{
  const s=state(),all=settleBatchCraft(s,'mosswoodBow',10,'archer',{enabled:false,minRarity:'legend'},()=>.01);
  expect(all.retained).toHaveLength(10);expect(all.dismantled).toHaveLength(0);
  const first=all.retained[0];first.locked=true;
  const equip=all.retained[1];expect(equipBuildItem(s,'archer',null,'weapon',equip.id)).toBe(true);
  expect(dismantleSelection(s,[first.id])).toBeNull();expect(dismantleSelection(s,[equip.id])).toBeNull();
  const white=settleBatchCraft(s,'mosswoodBow',1,'archer',config('mythic'),()=>.999999);
  expect(white.retained).toHaveLength(1);expect(white.retained[0].rarity).toBe('whiteAscended');
 });
});
