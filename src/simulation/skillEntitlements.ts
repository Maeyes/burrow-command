import type { CombatWeaponFamily } from '../systems/combatMath';
import type { CharacterStateV2 } from './character';

export interface SkillEntitlementsV2 {
  active: readonly string[];
  movement?: string;
  passive: readonly string[];
  weaponSkills: readonly string[];
  modifiersByActive: Readonly<Record<string,readonly string[]>>;
}

/** Unlocked at Weapon Mastery Lv10 / 20 / 30; they fire from basic attacks (engine weaponSkillProcs). */
export const WEAPON_SKILLS_BY_FAMILY_V2: Readonly<Record<CombatWeaponFamily, readonly string[]>> = {
  greatsword: ['bowlingBash', 'crescentBreak', 'vanguardTempest'],
  dagger: ['crossSlash', 'shadowFlurry', 'phantomBlades'],
  axe: ['cleavingStrike', 'executionersSweep', 'ravagerArc'],
  hammer: ['crushingImpact', 'earthbreaker', 'cataclysm'],
  bow: ['powerShot', 'piercingVolley', 'skyfallBarrage'],
  staff: ['arcBolt', 'arcCascade', 'astralVolley'],
  swordShield: ['radiantBurst', 'gravityPulse', 'astralDominion'],
};

export function skillEntitlementsForCharacter(state: CharacterStateV2, weaponFamily: CombatWeaponFamily): SkillEntitlementsV2 {
  // Weapon Mastery grants the family's three active weapon skills at Lv10/20/30.
  // Passive/mechanical mastery milestones remain separate bonuses and continue through Lv50.
  const masteryLevel = state.weaponMastery[weaponFamily]?.level ?? 1;
  const unlockedCount = masteryLevel >= 30 ? 3 : masteryLevel >= 20 ? 2 : masteryLevel >= 10 ? 1 : 0;
  const weaponSkills = WEAPON_SKILLS_BY_FAMILY_V2[weaponFamily].slice(0, unlockedCount);
  return {
    active: state.skills.active.filter((id): id is string => Boolean(id)),
    movement: state.skills.movement,
    passive: state.skills.passive.filter((id): id is string => Boolean(id)),
    weaponSkills,
    modifiersByActive: state.skills.modifiersByActive,
  };
}

export function skillEntitlementReason(
  entitlements: SkillEntitlementsV2,
  skillId: string,
  kind: 'active' | 'movement' | 'passive' | 'weapon',
): string | undefined {
  if (kind === 'passive') return 'passive-skill';
  if (kind === 'movement') return entitlements.movement === skillId ? undefined : 'skill-not-equipped';
  if (kind === 'weapon') return entitlements.weaponSkills.includes(skillId) ? undefined : 'weapon-skill-locked';
  return entitlements.active.includes(skillId) ? undefined : 'skill-not-equipped';
}
