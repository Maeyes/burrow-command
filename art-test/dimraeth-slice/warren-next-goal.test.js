import {describe,it,expect} from 'vitest';
import {nextGoal,DUSK_WARNING_S} from './warren-next-goal.js';

const base={over:false,night:false,left:60,enemies:0,units:7,squadMax:7,recruitPrice:null,gold:0,wallLevel:1,wallCost:160,mats:0,
 towers:1,towerMax:3,towerGold:60,towerMats:10,cleared:false,warren:1,maxWarren:20,warrenMats:100,wave:2};
describe('next goal hint',()=>{
 it('is hidden when the game is over or a mythic trial runs',()=>expect(nextGoal({...base,over:true})).toBeNull());
 it('night shows remaining enemies',()=>expect(nextGoal({...base,night:true,enemies:9}).text).toContain('9'));
 it('warns shortly before dusk ahead of any other goal',()=>{
  const g=nextGoal({...base,left:DUSK_WARNING_S,units:2});
  expect(g.tone).toBe('warn');expect(g.text).toContain('15s');
 });
 it('asks to recruit first, or says how much Gold is missing',()=>{
  expect(nextGoal({...base,units:2,recruitPrice:36,gold:50}).text).toContain('จ้างกระต่ายเพิ่ม');
  expect(nextGoal({...base,units:2,recruitPrice:36,gold:20}).text).toContain('16G');
 });
 it('then the wall, then a tower',()=>{
  expect(nextGoal({...base,wallLevel:0,mats:40}).text).toContain('120');
  expect(nextGoal({...base,wallLevel:0,mats:500}).text).toContain('สร้างรั้ว');
  expect(nextGoal({...base,towers:0}).text).toContain('ป้อมธนู');
 });
 it('points at the warren upgrade once the wave is cleared',()=>{
  expect(nextGoal({...base,cleared:true,mats:100}).text).toContain('Lv 2');
  expect(nextGoal({...base,cleared:true,mats:30}).text).toContain('70');
  expect(nextGoal({...base}).text).toContain('1-2');
 });
});
