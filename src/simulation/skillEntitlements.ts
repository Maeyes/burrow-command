import type { CombatWeaponFamily } from '../systems/combatMath';
import type { CharacterStateV2 } from './character';

export interface SkillEntitlementsV2 {
  active: readonly string[];
  movement?: string;
  passive: readonly string[];
  /** Mastery on-hit loadout slots: index 0/1/2 = mastery Lv10/Lv20/Lv30. */
  weaponSkills: readonly [string?,string?,string?];
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

export function skillEntitlementsForCharacter(state: CharacterStateV2, _weaponFamily?: CombatWeaponFamily): SkillEntitlementsV2 {
  // Mastery actives are build loadout choices, not "everything unlocked on the equipped weapon".
  // Slots are fixed by mastery band so only one Lv10, one Lv20 and one Lv30 on-hit skill can be installed.
  const levels=[10,20,30] as const;
  const weaponSkills=levels.map((level,index)=>{
    const skillId=state.masteryLoadout?.active?.[level];if(!skillId)return undefined;
    const family=(Object.keys(WEAPON_SKILLS_BY_FAMILY_V2) as CombatWeaponFamily[]).find(f=>WEAPON_SKILLS_BY_FAMILY_V2[f]?.[index]===skillId);
    return family&&(state.weaponMastery[family]?.level??1)>=level?skillId:undefined;
  }) as [string?,string?,string?];
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
