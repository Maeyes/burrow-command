import {describe,it,expect} from 'vitest';
import {addOption,reoption,reoptionQuote,toggleOptionLock,optionTotals,optionSlots,normalizeOptions,OPTION_SLOTS,LOCK_EXTRA,REOPTION_BASE} from './warren-gear-options.js';
import {migrateSave} from './warren-progression.js';

const seq=vals=>{let i=0;return()=>vals[i++%vals.length];};
const state=(rarity='epic',inv={optionStone:5,reoptionStone:5})=>({night:false,gold:1000,inventory:{...inv},gear:[{id:'g1',templateId:'x',rarity,options:[]}]});

describe('gear options',()=>{
 it('line count follows rarity',()=>{
  expect(['normal','good','rare','epic','legend','mythic'].map(r=>optionSlots({rarity:r}))).toEqual([0,0,1,2,3,4]);
 });
 it('adding uses an Option Stone and stops when lines are full',()=>{
  const s=state('rare');
  expect(addOption(s,'g1',seq([0,.5]))).toBeTruthy();
  expect(s.inventory.optionStone).toBe(4);
  expect(addOption(s,'g1')).toBeNull();
 });
 it('never rolls the same stat twice on one item',()=>{
  const s=state('legend');for(let i=0;i<3;i++)addOption(s,'g1',seq([0,.5]));
  const ids=s.gear[0].options.map(o=>o.id);expect(new Set(ids).size).toBe(3);
 });
 it('no lines on Normal gear, no stones = no add',()=>{
  expect(addOption(state('normal'),'g1')).toBeNull();
  expect(addOption(state('epic',{optionStone:0}),'g1')).toBeNull();
 });
 it('reroll keeps locked lines and each lock costs extra',()=>{
  const s=state('epic');addOption(s,'g1',seq([0,.5]));addOption(s,'g1',seq([0,.5]));
  const kept={...s.gear[0].options[0]};
  toggleOptionLock(s,'g1',0);
  const q=reoptionQuote(s,s.gear[0]);
  expect(q.reoptionStone).toBe(REOPTION_BASE.reoptionStone+LOCK_EXTRA.reoptionStone);
  expect(q.gold).toBe(REOPTION_BASE.gold+LOCK_EXTRA.gold);
  reoption(s,'g1',seq([.9,.1]));
  expect(s.gear[0].options[0]).toMatchObject({id:kept.id,value:kept.value,locked:true});
  expect(s.inventory.reoptionStone).toBe(5-q.reoptionStone);
 });
 it('cannot reroll with every line locked',()=>{
  const s=state('rare');addOption(s,'g1');toggleOptionLock(s,'g1',0);
  expect(reoption(s,'g1')).toBeNull();
 });
 it('totals convert to fractions and cap attack speed',()=>{
  const t=optionTotals([{options:[{id:'atkPct',value:10},{id:'aspd',value:40}]},{options:[{id:'aspd',value:40},{id:'crit',value:3}]}]);
  expect(t.atkPct).toBeCloseTo(.1);expect(t.aspd).toBe(.5);expect(t.crit).toBe(3);
 });
 it('options survive save migration and are trimmed to the rarity',()=>{
  expect(normalizeOptions([{id:'atkPct',value:5},{id:'bogus',value:1},{id:'hpPct',value:6}],'rare')).toEqual([{id:'atkPct',value:5,locked:false}]);
  expect(OPTION_SLOTS.mythic).toBe(4);
 });
});
import {optionMax,optionGrade} from './warren-gear-options.js';
describe('option max and grade',()=>{
 it('max scales with rarity',()=>{
  expect(optionMax({id:'hpPct'},'rare')).toBe(10);
  expect(optionMax({id:'hpPct'},'legend')).toBe(15);
 });
 it('grades by share of max: 8/10 gold, 6.5 purple, 4.5 blue, 3 plain',()=>{
  expect([8,6.5,4.5,3].map(v=>optionGrade({id:'hpPct',value:v},'rare'))).toEqual(['gold','purple','blue','plain']);
 });
});
