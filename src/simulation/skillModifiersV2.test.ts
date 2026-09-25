import { describe, expect, it } from 'vitest';
import { stackedSkillModifierFraction } from './skillModifiersV2';

describe('Skill Mod duplicate stacking',()=>{
  it('keeps one copy at its authored percentage',()=>{
    expect(stackedSkillModifierFraction(['lingering'],'lingering',.20)).toBeCloseTo(.20,8);
  });
  it('scales a duplicate multiplicatively instead of adding a full second copy',()=>{
    expect(stackedSkillModifierFraction(['lingering','lingering'],'lingering',.20)).toBeCloseTo(.24,8);
    expect(stackedSkillModifierFraction(['combustion','combustion'],'combustion',.30)).toBeCloseTo(.39,8);
  });
  it('does not let unrelated mods affect the stack',()=>{
    expect(stackedSkillModifierFraction(['lingering','rapidCasting'],'lingering',.20)).toBeCloseTo(.20,8);
  });
});
