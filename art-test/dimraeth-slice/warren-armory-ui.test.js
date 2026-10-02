import {describe,it,expect} from 'vitest';
import {renderArmoryHtml,visibleArmoryInventory} from './warren-armory-ui.js';
import {renderItemDetailHtml,renderInventoryHtml} from './warren-ui.js';
import {CLASS_IDS,defaultBuilds,defaultProgress,defaultMastery,defaultAutoDismantleSettings,
 craftGear,equipBuildItem,dismantleSelection,
 settleBatchCraft} from './warren-progression.js';
const classes=Object.fromEntries(CLASS_IDS.map(cls=>[cls,{icon:'🐰',name:cls}]));
const state=()=>({warren:1,gold:9999,inventory:{tier1Blueprint:50,copperOre:500,livingMoss:500,brutalSpore:500},
 gear:[],nextGearId:0,builds:defaultBuilds(),progress:defaultProgress(),mastery:defaultMastery(),
 autoDismantle:defaultAutoDismantleSettings(),armoryInventorySelection:[],forgeClass:'archer',armorySlot:'weapon',armoryTab:'craft',armoryMoreOpen:true,batchQty:10,
 units:[],towers:[],batchResults:[],batchFilter:'all',batchSelection:[],night:false});
describe('single-screen Class Armory',()=>{
 it('chooses class, slot, recipe, quantity and automatic salvage rules before crafting',()=>{
  const html=renderArmoryHtml(state(),classes);
  expect(html).toContain('Class Armory · archer');
  expect(html).toContain('data-armory-slot="weapon"');
  expect(html).toContain('data-armory-slot="armor"');
  expect(html).toContain('data-armory-tab="inventory"');
  expect(html).toContain('data-armory-recipe="mosswoodBow"');
  expect(html).toContain('data-batch-qty="50"');
  expect(html).toContain('data-auto-enabled');
  expect(html).toContain('data-auto-protect');
  expect(html).toContain('data-auto-rarity');
  expect(html).toContain('White Ascended');
 });
 it('shows per-class auto-salvage preferences and crafts directly without a second confirmation',()=>{
  const s=state();s.autoDismantle.archer={enabled:true,minRarity:'legend',protectOtherClasses:false};
  const html=renderArmoryHtml(s,classes);
  expect(html).toContain('value="legend" selected');
  expect(html).toContain('data-forge-craft="mosswoodBow"');
  expect(html).not.toContain('ยืนยันกฎก่อนเริ่มคราฟต์');
  expect(html).not.toContain('data-auto-confirm');
  expect(html).not.toContain('data-auto-cancel');
 });
 it('keeps results and actionable replacement recommendations inside the same armory',()=>{
  const s=state();const result=settleBatchCraft(s,'mosswoodBow',10,'archer',
   {enabled:true,minRarity:'rare',protectOtherClasses:true},(()=>{const rolls=[.95,.85,.85,.65,.65,.65,.01,.01,.01,.01];let i=0;return()=>rolls[i++];})());
  s.batchReport=result;s.batchResults=[...result.retained,...result.review].map(p=>p.id);s.batchClass='archer';
  const html=renderArmoryHtml(s,classes);
  expect(html).toContain('bc-armory-results');
  expect(html).toContain('Stone Fragments');
  expect(html).toContain('data-batch-equip=');
  expect(html).toContain('data-batch-expanded');
  expect(html).not.toContain('id="batchPanel"');
 });
 it('displays tier at upper left and distinct slot-bound E / R badges at lower corners',()=>{
  const s=state();s.forgeClass='archer';s.armorySlot='weapon';s.armoryTab='upgrade';
  s.inventory.tier1Blueprint=2;
  const p=craftGear(s,'mosswoodBow',()=>.51);expect(p).toBeTruthy();
  expect(equipBuildItem(s,'archer',null,'weapon',p.id)).toBe(true);
  s.progress.archer.weapon={enhance:12,refine:4};
  const html=renderArmoryHtml(s,classes);
  expect(html).toContain('bc-gear-tier');expect(html).toContain('>T1</span>');
  expect(html).toContain('bc-gear-enhance');expect(html).toContain('title="Enhance ของช่อง">+12</span>');
  expect(html).toContain('bc-gear-refine');expect(html).toContain('title="Refine ของช่อง">+4</span>');
  s.refineFeedback={itemId:p.id,success:true,text:'✦ Refine ติด! Mosswood Bow +3 → +4'};
  expect(renderItemDetailHtml(s,p.id,classes)).toContain('role="status" class="bc-refine-feedback success"');
 });
 it('shows direct bag salvage for selected unlocked copies and protects locked/equipped gear',()=>{
  const s=state();s.armoryTab='inventory';s.armorySlot='weapon';s.armoryInventorySelection=[];
  const equipped=craftGear(s,'mosswoodBow',()=>.51);
  const locked=craftGear(s,'mosswoodBow',()=>.51);
  const spare=craftGear(s,'mosswoodBow',()=>.51);
  expect(equipBuildItem(s,'archer',null,'weapon',equipped.id)).toBe(true);
  locked.locked=true;
  expect(visibleArmoryInventory(s).map(p=>p.id)).toEqual([locked.id,spare.id]);
  let html=renderArmoryHtml(s,classes);
  expect(html).not.toContain('data-armory-select="'+equipped.id+'"');
  expect(html).toContain('data-armory-select="'+locked.id+'"  disabled');
  expect(html).toContain('data-armory-select="'+spare.id+'" ');
  expect(html).toContain('data-armory-select-all');
  expect(html).toContain('data-armory-dismantle disabled');
  s.armoryInventorySelection=[locked.id,spare.id];
  html=renderArmoryHtml(s,classes);
  expect(html).toContain('เลือกย่อย 1 / 1 ชิ้น'); // locked item never counts
  expect(html).toContain('data-armory-dismantle ');
  const before=s.gear.length;
  expect(dismantleSelection(s,[spare.id,locked.id])).toBeNull(); // atomic if any item became locked
  expect(s.gear.length).toBe(before);
  const removed=dismantleSelection(s,[spare.id]);
  expect(removed).toMatchObject({count:1});
  expect(removed.fragments).toBeGreaterThan(0);
  expect(s.inventory.stoneFragment).toBe(removed.fragments);
  expect(new Set(s.gear.map(p=>p.id))).toEqual(new Set([equipped.id,locked.id]));
  expect(dismantleSelection(s,[equipped.id])).toBeNull();
  s.night=true;
  expect(dismantleSelection(s,[locked.id])).toBeNull();
 });
 it('shows only unequipped item instances in Armory and inventory, while keeping equipped slots actionable',()=>{
  const s=state();s.armoryTab='inventory';s.armorySlot='armor';
  const [archerArmor,guardArmor,spare]=Array.from({length:3},()=>craftGear(s,'t1Armor',()=>.51));
  expect([archerArmor,guardArmor,spare].every(Boolean)).toBe(true);
  expect(new Set([archerArmor.id,guardArmor.id,spare.id]).size).toBe(3);
  expect(equipBuildItem(s,'archer',null,'armor',archerArmor.id)).toBe(true);
  expect(equipBuildItem(s,'guard',null,'armor',guardArmor.id)).toBe(true);
  const armoryIds=()=>[...renderArmoryHtml(s,classes).matchAll(/data-open-item="([^"]+)"/g)].map(m=>m[1]);
  const storedIds=()=>[...renderInventoryHtml(s,classes).matchAll(/data-open-item="([^"]+)"/g)].map(m=>m[1]);
  expect(armoryIds()).toEqual([spare.id]); // Same template, distinct actual items.
  expect(storedIds()).toEqual([spare.id]); // Applies to the separate inventory view too.
  expect(renderArmoryHtml(s,classes)).toContain('T1'); // Equipped slot summary stays visible.
  expect(renderItemDetailHtml(s,archerArmor.id,classes)).toContain('ถอดอุปกรณ์');
  expect(equipBuildItem(s,'archer',null,'armor',spare.id)).toBe(true);
  expect(armoryIds()).toEqual([archerArmor.id]); // Replaced item returns to the bag.
  expect(storedIds()).toEqual([archerArmor.id]);
  s.builds.guard[0].gear.armor=null;
  expect(new Set(armoryIds())).toEqual(new Set([archerArmor.id,guardArmor.id]));
  expect(new Set(storedIds())).toEqual(new Set([archerArmor.id,guardArmor.id]));
  s.armoryInventoryRarity='mythic';
  expect(armoryIds()).toEqual([]); // Rarity filter still applies after excluding equipped pieces.
  s.armoryInventoryRarity='all';s.inventoryFilter='equipment';
  expect(new Set(storedIds())).toEqual(new Set([archerArmor.id,guardArmor.id]));
 });
});
describe('armory action panes',()=>{
 it('panes are closed until a button is pressed',()=>{
  const s=state();s.armoryMoreOpen=false;
  const html=renderArmoryHtml(s,classes);
  expect(html).toContain('data-armory-tab="options"');
  expect(html).not.toContain('data-forge-craft');
 });
});
