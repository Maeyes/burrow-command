import {describe,it,expect} from 'vitest';
import {snapshotNight,summarizeNight,renderNightSummaryHtml} from './warren-night-summary.js';

const state=()=>({day:3,kills:10,gold:100,burrow:500,fences:[{hp:50},{hp:50}],units:[{down:false},{down:false},{down:false}]});
describe('night summary',()=>{
 it('reports kills, loot, wall and hall damage, and downed rabbits',()=>{
  const s=state(),before=snapshotNight(s,40);
  s.kills=22;s.gold=160;s.fences[0].hp=0;s.fences[1].hp=30;s.burrow=450;s.units[0].down=true;
  const r=summarizeNight(before,s,55,true);
  expect(r).toMatchObject({won:true,day:3,kills:12,gold:60,mats:15,wallLost:70,wallBroken:1,hallLost:50,downed:1,units:3});
  const html=renderNightSummaryHtml(r);
  expect(html).toContain('รอดคืนที่ 3');expect(html).toContain('+60');expect(html).toContain('พัง 1 ส่วน');expect(html).toContain('ซ่อมกำแพง');
 });
 it('has no report without a dusk snapshot, and says so on a loss',()=>{
  expect(summarizeNight(null,state(),0,true)).toBeNull();
  const s=state(),r=summarizeNight(snapshotNight(s,0),s,0,false);
  expect(renderNightSummaryHtml(r)).toContain('แพ้คืนที่ 3');
  expect(renderNightSummaryHtml(r)).toContain('สมบูรณ์');
 });
});
