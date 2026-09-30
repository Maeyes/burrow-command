import {describe,it,expect} from 'vitest';
import {WUKONG_INTRO_DURATION,wukongIntroPhase} from './warren-wukong-cinematic.js';

describe('Sun Wukong boss entrance timeline',()=>{
 it('plays every authored beat in order',()=>{
  expect([0,4,6.5,8.3,9.5,11,15,WUKONG_INTRO_DURATION].map(wukongIntroPhase)).toEqual([
   'clouds','proclamation','staffFall','impact','storm','banner','reveal','done',
  ]);
 });
 it('does not finish before the reveal has been held on screen',()=>{
  expect(wukongIntroPhase(WUKONG_INTRO_DURATION-.01)).toBe('reveal');
 });
});
