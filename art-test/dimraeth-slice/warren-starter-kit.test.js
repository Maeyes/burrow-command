import {describe,it,expect} from 'vitest';
import {starterCraftMaterials,starterWeaponTemplate,grantStarterKit,STARTER_KIT_GOLD} from './warren-starter-kit.js';
import {CRAFT_RECIPES_V2,EQUIPMENT_MASTER_V2,availableRecipes,canCraft,defaultBuilds,CLASS_IDS,gearSlot} from './warren-progression.js';

const fresh=()=>({night:false,warren:1,gold:500,inventory:{},gear:[],nextGearId:0,builds:defaultBuilds()});
describe('starter kit',()=>{
 it('covers every Tier 1 recipe of every class, twice',()=>{
  const s=fresh();grantStarterKit(s);
  for(const cls of CLASS_IDS)for(const r of availableRecipes(s,cls).filter(r=>r.tier===1))expect(canCraft(s,r.id),r.id).toBe(true);
  const m=starterCraftMaterials();const any=Object.entries(CRAFT_RECIPES_V2).find(([id,r])=>EQUIPMENT_MASTER_V2[id]?.tier===1&&r.available&&gearSlot(id));
  expect(m[any[1].oreId]).toBeGreaterThanOrEqual(any[1].oreQty*2);
 });
 it('equips a Rare guard weapon that has option lines to try',()=>{
  const s=fresh(),kit=grantStarterKit(s);
  expect(kit.weapon.rarity).toBe('rare');
  expect(s.builds.guard[0].gear.weapon).toBe(kit.weapon.id);
  expect(EQUIPMENT_MASTER_V2[starterWeaponTemplate('guard')].weaponFamily).toBe('swordShield');
 });
 it('adds upgrade and option stones plus kit gold',()=>{
  const s=fresh();grantStarterKit(s);
  expect(s.inventory.optionStone).toBe(2);expect(s.inventory.reoptionStone).toBe(1);
  expect(s.inventory.verdantAetherstone).toBeGreaterThan(0);expect(s.gold).toBe(500+STARTER_KIT_GOLD);
 });
});
