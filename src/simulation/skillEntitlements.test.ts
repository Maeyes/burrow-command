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

  it('derives mastery on-hit skills only from the three-band loadout', () => {
    const character = createInitialCharacterV2('c');
    character.weaponMastery.dagger.level = 10;
    character.weaponMastery.greatsword.level = 20;
    character.weaponMastery.axe.level = 30;
    character.masteryLoadout.active = {10:'crossSlash',20:'crescentBreak',30:'ravagerArc'};
    const entitlement = skillEntitlementsForCharacter(character, 'staff');
    expect(entitlement.weaponSkills).toEqual(['crossSlash','crescentBreak','ravagerArc']);
    expect(skillEntitlementReason(entitlement, 'ravagerArc', 'weapon')).toBeUndefined();
    expect(skillEntitlementReason(entitlement, 'powerShot', 'weapon')).toBe('weapon-skill-locked');
    character.masteryLoadout.active[10]='powerShot'; // Bow mastery is still locked.
    expect(skillEntitlementsForCharacter(character).weaponSkills).toEqual([undefined,'crescentBreak','ravagerArc']);
  });
});
