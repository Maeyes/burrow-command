import type { CombatStats, CombatWeaponFamily } from '../systems/combatMath';
import type { EntityId, MonsterId, PlayerId, Vec2 } from './contracts';

export type EntityKind = 'player' | 'monster';

export interface BaseEntity {
  id: EntityId;
  kind: EntityKind;
  position: Vec2;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface PlayerEntity extends BaseEntity {
  kind: 'player';
  id: PlayerId;
  stats: CombatStats;
  /** Authoritative skill resource. Costs are wired per-skill as balancing is finalized. */
  sp?: number;
  maxSp?: number;
  spRecoveryMultiplier?: number;
  healingMultiplier?: number;
  skillCostMultiplier?: number;
  weaponFamily: CombatWeaponFamily;
  weaponAtk: number;
  weaponMatk: number;
  /** Authoritative offhand weapon contribution, kept separate so dual-wield strikes do not double-count it in the main-hand hit. */
  offhandWeaponAtk?: number;
  offhandWeaponMatk?: number;
  hasOffhandWeaponEquipped?: boolean;
  equipmentDef: number;
  equipmentMdef: number;
  hitBonus: number;
  fleeBonus: number;
  critBonusPercent: number;
  equipmentAspd: number;
  castSpeed?: number;
  critDamageMultiplier?: number;
  elementDamageMultiplier?: number;
  attackRange: number;
  moveSpeed: number;
  moveIntent?: Vec2;
  dodgeDistance: number;
  dodgeCooldownMs: number;
  nextDodgeAtMs: number;
  lastClientSequence: number;
  nextBasicAttackAtMs: number;
  /** Last authoritative time this player dealt or received combat interaction. */
  lastCombatAtMs?: number;
  cooldowns: Record<string, number>;
  skillEntitlements: import('./skillEntitlements').SkillEntitlementsV2;
  /** Additive rarity bonus multiplier per installed Skill Core; e.g. Good = 1.10. */
  skillCoreDamageMultipliers?: Record<string,number>;
  /** Snapshot of all character-wide mastery levels; effects remain active after weapon switching. */
  masteryLevels?: Partial<Record<CombatWeaponFamily, number>>;
  /** True only when authoritative offhand equipment is classified as a shield. */
  hasShieldEquipped?: boolean;
  guardedUntilMs?: number;
  /** Temporary Barrier Skill Core shield. */
  barrierHp?: number;
  barrierMaxHp?: number;
  barrierUntilMs?: number;
}

export interface MonsterEntity extends BaseEntity {
  kind: 'monster';
  id: MonsterId;
  level: number;
  atk: number;
  matk: number;
  def: number;
  mdef: number;
  hit: number;
  flee: number;
  critChance: number;
  attackRange: number;
  moveSpeed: number;
  attackIntervalMs: number;
  nextBasicAttackAtMs: number;
  targetPlayerId?: PlayerId;
  /** Distance at which an idle monster may acquire a player. Monsters no longer aggro map-wide. */
  aggroRange?: number;
  /** Authoritative ambient roaming state while the monster has no combat target. */
  homePosition?: Vec2;
  roamTarget?: Vec2;
  roamRadius?: number;
  nextRoamAtMs?: number;
  isElite: boolean;
  isBoss: boolean;
  staggeredUntilMs?: number;
  stunnedUntilMs?: number;
  slowPercent?: number;
  slowUntilMs?: number;
  armorBreakPercent?: number;
  armorBreakUntilMs?: number;
}

export type WorldEntity = PlayerEntity | MonsterEntity;

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalized(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y);
  if (length <= 0) return { x: 0, y: 0 };
  return { x: v.x / length, y: v.y / length };
}
