import { describe, expect, it } from 'vitest';
import { createInitialCharacterV2 } from './character';
import { skillEntitlementReason, skillEntitlementsForCharacter } from './skillEntitlements';

describe('authoritative skill entitlements', () => {
  it('derives equipped active, movement, and passive skills from CharacterState', () => {
    const character = createInitialCharacterV2('c');
    character.skills.active = ['fireball'];
    character.skills.movement = 'dash';
    character.skills.passive = ['barrier'];
    const entitlement = skillEntitlementsForCharacter(character, 'staff');
    expect(entitlement.active).toEqual(['fireball']);
    expect(entitlement.movement).toBe('dash');
    expect(entitlement.passive).toEqual(['barrier']);
    expect(skillEntitlementReason(entitlement, 'fireball', 'active')).toBeUndefined();
    expect(skillEntitlementReason(entitlement, 'meteorStorm', 'active')).toBe('skill-not-equipped');
    expect(skillEntitlementReason(entitlement, 'blink', 'movement')).toBe('skill-not-equipped');
    expect(skillEntitlementReason(entitlement, 'barrier', 'passive')).toBe('passive-skill');
  });

  it('unlocks the current weapon family skills at mastery 10, 20, and 30', () => {
    const character = createInitialCharacterV2('c');
    character.weaponMastery.greatsword.level = 9;
    expect(skillEntitlementsForCharacter(character, 'greatsword').weaponSkills).toEqual([]);
    character.weaponMastery.greatsword.level = 10;
    expect(skillEntitlementsForCharacter(character, 'greatsword').weaponSkills).toEqual(['bowlingBash']);
    character.weaponMastery.greatsword.level = 20;
    expect(skillEntitlementsForCharacter(character, 'greatsword').weaponSkills).toEqual(['bowlingBash','crescentBreak']);
    character.weaponMastery.greatsword.level = 30;
    const entitlement = skillEntitlementsForCharacter(character, 'greatsword');
    expect(entitlement.weaponSkills).toEqual(['bowlingBash','crescentBreak','vanguardTempest']);
    expect(skillEntitlementReason(entitlement, 'vanguardTempest', 'weapon')).toBeUndefined();
    expect(skillEntitlementReason(entitlement, 'powerShot', 'weapon')).toBe('weapon-skill-locked');
  });
});
