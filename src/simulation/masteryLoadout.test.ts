import { describe, expect, it } from 'vitest';
import { createInitialCharacterV2 } from './character';
import { applyMasteryLoadoutCommand, MASTERY_PASSIVE_SLOTS, normalizeMasteryLoadout } from './masteryLoadout';

describe('weapon mastery loadout',()=>{
  it('unlocks passive capacity from the highest mastery tier',()=>{
    let s=createInitialCharacterV2('c');
    s.weaponMastery.dagger.level=10;s.weaponMastery.greatsword.level=10;
    s=applyMasteryLoadoutCommand(s,{type:'togglePassive',family:'dagger',milestoneId:'doubleAttack'});
    expect(()=>applyMasteryLoadoutCommand(s,{type:'togglePassive',family:'greatsword',milestoneId:'cleave'})).toThrow('mastery-passive-slots-full');
    s.weaponMastery.dagger.level=20;
    s=applyMasteryLoadoutCommand(s,{type:'togglePassive',family:'greatsword',milestoneId:'cleave'});
    expect(s.masteryLoadout.passive).toHaveLength(2);
  });

  it('limits passive milestones to five unlocked selections across families',()=>{
    let s=createInitialCharacterV2('c');
    for(const f of ['greatsword','dagger','axe','hammer','bow','staff','swordShield'] as const)s.weaponMastery[f].level=50;
    const picks=[
      ['dagger','doubleAttack'],['greatsword','cleave'],['axe','heavyBlow'],['hammer','crushingImpact'],['bow','multiShot'],
    ] as const;
    for(const [family,milestoneId] of picks)s=applyMasteryLoadoutCommand(s,{type:'togglePassive',family,milestoneId});
    expect(s.masteryLoadout.passive).toHaveLength(MASTERY_PASSIVE_SLOTS);
    expect(()=>applyMasteryLoadoutCommand(s,{type:'togglePassive',family:'staff',milestoneId:'coreEcho'})).toThrow('mastery-passive-slots-full');
    s=applyMasteryLoadoutCommand(s,{type:'togglePassive',family:'axe',milestoneId:'heavyBlow'});
    expect(s.masteryLoadout.passive).toHaveLength(4);
  });

  it('uses exactly one active on-hit slot for each Lv10/Lv20/Lv30 mastery band',()=>{
    let s=createInitialCharacterV2('c');
    s.weaponMastery.dagger.level=10;s.weaponMastery.greatsword.level=20;s.weaponMastery.axe.level=30;s.weaponMastery.bow.level=10;
    s=applyMasteryLoadoutCommand(s,{type:'equipActive',level:10,family:'dagger'});
    s=applyMasteryLoadoutCommand(s,{type:'equipActive',level:20,family:'greatsword'});
    s=applyMasteryLoadoutCommand(s,{type:'equipActive',level:30,family:'axe'});
    expect(s.masteryLoadout.active).toEqual({10:'crossSlash',20:'crescentBreak',30:'ravagerArc'});
    // Same band replaces instead of adding a second Lv10 active.
    s=applyMasteryLoadoutCommand(s,{type:'equipActive',level:10,family:'bow'});
    expect(s.masteryLoadout.active).toEqual({10:'powerShot',20:'crescentBreak',30:'ravagerArc'});
    expect(Object.keys(s.masteryLoadout.active)).toHaveLength(3);
  });

  it('rejects locked mastery choices and sanitizes stale persisted loadouts',()=>{
    let s=createInitialCharacterV2('c');
    expect(()=>applyMasteryLoadoutCommand(s,{type:'equipActive',level:30,family:'axe'})).toThrow('mastery-active-locked');
    expect(()=>applyMasteryLoadoutCommand(s,{type:'togglePassive',family:'staff',milestoneId:'coreEcho'})).toThrow('mastery-passive-locked');
    s={...s,masteryLoadout:{passive:[{family:'staff',milestoneId:'coreEcho'}],active:{30:'ravagerArc'}}};
    expect(normalizeMasteryLoadout(s)).toEqual({passive:[],active:{}});
  });
});
