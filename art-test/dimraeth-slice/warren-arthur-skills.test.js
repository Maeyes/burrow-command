import {describe,it,expect,vi} from 'vitest';
import {arthurSkillAt} from './warren-arthur-skills.js';
import {createMythicSkills} from './warren-mythic-skills.js';

// Exercise the real Arthur branch with a simulated clock and combat callbacks.
function fixture(index){
 const S={time:10,units:[{x:30,y:0,hp:1000,down:false}]},m={bossId:'kingArthur',x:0,y:0,atk:20,specialIndex:index,specialCd:0},queue=[],fx={pixelRing:vi.fn(),burst:vi.fn(),spriteWave:vi.fn()},hurt=vi.fn(),text=vi.fn();
 createMythicSkills({S,CENTER:{x:0,y:0},dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),later:(delay,fn)=>queue.push({delay,fn}),hurtUnit:hurt,arthurGoldenWave:{},
  trial:()=>true,skillFx:()=>fx,floaters:()=>({text})})(m,0);
 return{S,m,queue,fx,hurt,text};
}
describe('Arthur combat skills',()=>{
 it('casts Excalibur twice before the area skills and recovers faster',()=>{
  expect(Array.from({length:8},(_,i)=>arthurSkillAt(i).id)).toEqual(['excalibur','excalibur','bowlingBash','knights','excalibur','excalibur','bowlingBash','knights']);
  const f=fixture(0);expect(f.m.specialCd).toBeLessThan(2);for(const job of f.queue)job.fn();expect(f.fx.spriteWave).toHaveBeenCalledTimes(1);expect(f.fx.spriteWave.mock.calls[0][2].x).toBe(1100);expect(f.hurt).toHaveBeenCalledTimes(1);
 });
 it('Bowling Bash hits twice with pixel effects without an extra third impact',()=>{
  const f=fixture(2);expect(f.queue).toHaveLength(2);expect(f.queue[1].delay-f.queue[0].delay).toBeCloseTo(.18);for(const job of f.queue)job.fn();expect(f.hurt).toHaveBeenCalledTimes(2);expect(f.fx.spriteWave).toHaveBeenCalledTimes(2);expect(f.text.mock.calls[0][2]).toBe('BOWLING BASH');
 });
 it('queued casts stop damaging when Arthur dies',()=>{
  const f=fixture(2);f.m.dead=true;for(const job of f.queue)job.fn();expect(f.hurt).not.toHaveBeenCalled();expect(f.fx.spriteWave).not.toHaveBeenCalled();
 });
 it('Bowling Bash covers a boss-sized area and uses the enlarged crescent',()=>{const f=fixture(2);f.S.units=[{x:190,y:0,down:false},{x:210,y:0,down:false}];for(const job of f.queue)job.fn();expect(f.hurt).toHaveBeenCalledTimes(2);expect(f.hurt.mock.calls.every(call=>call[0]===f.S.units[0])).toBe(true);expect(f.fx.spriteWave.mock.calls[0][3].size).toBe(300);});
 it('queued hits read the live trial so they never land after the trial ends',()=>{
  let active=true;const queue=[],hurt=vi.fn(),S={time:10,units:[{x:30,y:0,down:false}]},m={bossId:'kingArthur',x:0,y:0,atk:20,specialIndex:2,specialCd:0};
  createMythicSkills({S,CENTER:{x:0,y:0},dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),later:(d,fn)=>queue.push(fn),hurtUnit:hurt,arthurGoldenWave:{},
   trial:()=>active,skillFx:()=>({pixelRing(){},burst(){},spriteWave(){}}),floaters:()=>({text(){}})})(m,0);
  active=false;for(const fn of queue)fn();
  expect(hurt).not.toHaveBeenCalled();
 });
});
