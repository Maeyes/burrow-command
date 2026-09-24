import { describe, expect, it } from 'vitest';
import { WEAPON_MASTERY_MILESTONES } from './masteryMilestones';

describe('weapon mastery milestones', () => {
  it('does not grant embedded active weapon skills', () => {
    for (const milestones of Object.values(WEAPON_MASTERY_MILESTONES)) {
      expect(milestones).toHaveLength(5);
      expect(milestones.map(x => x.level)).toEqual([10,20,30,40,50]);
    }
  });
});