import {describe,it,expect} from 'vitest';
import {renderArmoryHtml} from './warren-armory-ui.js';
import {renderItemDetailHtml} from './warren-ui.js';
import {CLASS_IDS,defaultBuilds,defaultProgress,defaultMastery,defaultAutoDismantleSettings,
 craftGear,equipBuildItem,
 settleBatchCraft} from './warren-progression.js';
const classes=Object.fromEntries(CLASS_IDS.map(cls=>[cls,{icon:'🐰',name:cls}]));
const state=()=>({warren:1,gold:9999,inventory:{tier1Blueprint:50,copperOre:500,livingMoss:500,brutalSpore:500},
 gear:[],nextGearId:0,builds:defaultBuilds(),progress:defaultProgress(),mastery:defaultMastery(),
 autoDismantle:defaultAutoDismantleSettings(),forgeClass:'archer',armorySlot:'weapon',armoryTab:'craft',batchQty:10,
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
 it('shows each class setting and an explicit one-time approval when a batch is pending',()=>{
  const s=state();s.autoDismantle.archer={enabled:true,minRarity:'legend',protectOtherClasses:false};
  s.pendingCraft={recipeId:'mosswoodBow',qty:10,cls:'archer',settings:{...s.autoDismantle.archer}};
  const html=renderArmoryHtml(s,classes);
  expect(html).toContain('value="legend" selected');
  expect(html).toContain('ยืนยันกฎก่อนเริ่มคราฟต์');
  expect(html).toContain('data-auto-confirm');
  expect(html).toContain('data-auto-cancel');
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
});
