import {describe,it,expect} from 'vitest';
import {tutorialStep,TUTORIAL_STEPS} from './warren-tutorial.js';

const fresh={units:2,mats:0,wallCost:160,wallLevel:0,towers:0,garrisons:0,day:1,modal:null,speed:1,gear:0,equipped:0,enhanced:0};
const idx=id=>TUTORIAL_STEPS.findIndex(s=>s.id===id);
describe('tutorial steps',()=>{
 it('waits on the manual welcome card',()=>expect(tutorialStep(0,fresh)).toBe(0));
 it('teaches the speed button and moves on once it is pressed',()=>{
  expect(tutorialStep(idx('speed'),fresh)).toBe(idx('speed'));
  expect(tutorialStep(idx('speed'),{...fresh,speed:2})).toBe(idx('recruit'));
 });
 it('advances past recruit once a third bunny is hired',()=>{
  expect(tutorialStep(idx('recruit'),{...fresh,units:3})).toBe(idx('farm'));
 });
 it('skips steps the player already did on their own',()=>{
  expect(tutorialStep(idx('recruit'),{...fresh,units:3,wallLevel:1,towers:1})).toBe(idx('garrison'));
 });
 it('walks craft → equip → enhance in order',()=>{
  const s={...fresh,units:3,wallLevel:1,towers:1,garrisons:1};
  expect(tutorialStep(idx('garrison'),s)).toBe(idx('craft'));
  expect(tutorialStep(idx('craft'),{...s,gear:1})).toBe(idx('equip'));
  expect(tutorialStep(idx('equip'),{...s,gear:1,equipped:1})).toBe(idx('enhance'));
  expect(tutorialStep(idx('enhance'),{...s,gear:1,equipped:1,enhanced:1})).toBe(idx('options'));
 });
 it('every step after welcome points at something',()=>{
  for(const s of TUTORIAL_STEPS.slice(1))expect(Array.isArray(s.target)&&s.target.length>0).toBe(true);
 });
});
