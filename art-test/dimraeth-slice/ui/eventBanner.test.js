import {describe,it,expect} from 'vitest';
import {eventBonusLabels,shouldPlayEventEntrance} from './eventBanner.js';

describe('Event Time banner presentation',()=>{
  it('labels only active reward bonuses in the same order as GM Event controls',()=>{
    expect(eventBonusLabels({exp:2,weaponExp:3,drop:1,gold:4,upgradeItem:2,blueprint:5}))
      .toEqual(['CHAR EXP ×2','WEAPON EXP ×3','GOLD ×4','UPGRADE ITEMS ×2','BLUEPRINTS ×5']);
    expect(eventBonusLabels({exp:1,gold:1})).toEqual([]);
  });

  it('plays the entrance exactly on disabled-to-enabled transitions, not multiplier changes',()=>{
    expect(shouldPlayEventEntrance(false,true)).toBe(true);
    expect(shouldPlayEventEntrance(true,true)).toBe(false);
    expect(shouldPlayEventEntrance(true,false)).toBe(false);
    expect(shouldPlayEventEntrance(false,false)).toBe(false);
  });
});
