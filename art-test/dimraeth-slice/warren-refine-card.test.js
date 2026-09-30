import {describe,it,expect} from 'vitest';
import {renderRefineCard} from './warren-ui.js';

const p={id:'g1',templateId:'mosswoodBow',rarity:'rare'};
const quote=(target,extra={})=>({owner:{cls:'archer',slot:'weapon'},target,rate:.45,astralite:4,gold:1200,protectedRequirement:null,...extra});
const card=(s,opts)=>renderRefineCard({gold:5000,inventory:{astraliteStone:10},night:false,...s},p,{owner:{cls:'archer'},refine:0,prot:null,protectedAttempt:false,refineReady:true,...opts});

describe('refine card',()=>{
 it('asks to equip first instead of claiming the cap is reached',()=>{
  const html=card({},{owner:null,refineReq:null});
  expect(html).toContain('ใส่ชิ้นนี้ให้คลาสก่อน');expect(html).not.toContain('เพดาน +15');
 });
 it('shows the cap only when the slot really is +15',()=>expect(card({},{refineReq:null})).toContain('ถึงเพดาน +15'));
 it('shows the jump, the odds and the real failure outcome',()=>{
  const html=card({},{refineReq:quote(8)});
  expect(html).toContain('+7</b><span>→</span><b>+8');
  expect(html).toContain('45%');expect(html).toContain('data-risk="mid"');
  expect(html).toContain('20% ลดเหลือ +6');   // +7 fails → +6, never below the +6 safe floor
 });
 it('never drops below a safe floor and explains protection',()=>{
  expect(card({},{refineReq:quote(7)})).toContain('อยู่ที่ +6 (Safe Floor)');
  const prot={id:'refineProtectionLv1',qty:2};
  expect(card({inventory:{astraliteStone:10,refineProtectionLv1:2}},{refineReq:quote(9,{protectedRequirement:prot}),prot,protectedAttempt:true})).toContain('ใช้ Protection');
 });
 it('names exactly what is missing on the button',()=>{
  const html=card({gold:200,inventory:{astraliteStone:1}},{refineReq:quote(8),refineReady:false});
  expect(html).toContain('ขาด Astralite 3 · 1,000 G');expect(html).toContain('bc-cost-chip short');
 });
});
