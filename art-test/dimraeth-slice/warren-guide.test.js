import {describe,it,expect} from 'vitest';
import {BURROW_VERSION,unlocksAtWarrenLevel} from './warren-guide.js';

describe('Burrow in-game guide and versioned unlock notices',()=>{
 it('has a visible semantic version',()=>expect(BURROW_VERSION).toMatch(/^\d+\.\d+\.\d+$/));
 it('describes every current progression breakpoint',()=>{
  expect(unlocksAtWarrenLevel(5).join(' ')).toContain('Lv3');
  expect(unlocksAtWarrenLevel(10).join(' ')).toContain('Skill Core');
  expect(unlocksAtWarrenLevel(15).join(' ')).toContain('รถยิงเวทย์ 2');
  expect(unlocksAtWarrenLevel(20).join(' ')).toContain('รถยิงเวทย์สูงสุด 4');
  expect(unlocksAtWarrenLevel(25).join(' ')).toContain('รถยิงเวทย์สูงสุด 6');
  expect(unlocksAtWarrenLevel(30).join(' ')).toContain('ชุดที่ 3');
 });
});
