/**
 * Bunny World V2 authoritative simulation contracts.
 *
 * Phase 1: these types establish the boundary. The browser may host the
 * simulation locally during development, but UI/rendering must communicate
 * through commands/events rather than mutating authoritative outcomes.
 */

export type EntityId = string;
export type PlayerId = string;
export type MonsterId = string;

export type Vec2 = Readonly<{ x: number; y: number }>;

export type SimulationCommand =
  | { type: 'move'; playerId: PlayerId; direction: Vec2; clientSequence: number }
  | { type: 'basicAttack'; playerId: PlayerId; targetId: EntityId; clientSequence: number }
  | { type: 'castSkill'; playerId: PlayerId; skillId: string; targetId?: EntityId; ground?: Vec2; direction?: Vec2; clientSequence: number }
  | { type: 'dodge'; playerId: PlayerId; direction: Vec2; clientSequence: number };

export type EffectOrigin = 'PRIMARY'|'SKILL_CORE'|'MASTERY_PROC'|'ECHO';
export interface EffectMeta { origin:EffectOrigin; echoDepth:number; sourceCoreId?:string; ability?:string }

export type CombatEvent =
  | { type: 'attackMissed'; sourceId: EntityId; targetId: EntityId }
  | { type: 'damageDealt'; sourceId: EntityId; targetId: EntityId; amount: number; critical: boolean; effect?:EffectMeta; blocked?: boolean }
  | { type: 'attackStarted'; sourceId: EntityId; targetId: EntityId; abilityId: string }
  | { type: 'entityDefeated'; entityId: EntityId; killerId?: EntityId }
  | { type: 'entityRespawned'; entityId: EntityId; position: Vec2 }
  | { type: 'skillCast'; sourceId: EntityId; skillId: string; targetId?: EntityId }
  | { type: 'healed'; sourceId: EntityId; targetId: EntityId; amount: number }
  | { type: 'barrierApplied'; entityId: EntityId; amount: number; durationMs: number }
  | { type: 'barrierAbsorbed'; entityId: EntityId; amount: number; remaining: number }
  | { type: 'dodged'; entityId: EntityId; position: Vec2 };

export type SimulationEvent =
  | CombatEvent
  | { type: 'positionChanged'; entityId: EntityId; position: Vec2 }
  | { type: 'cooldownStarted'; entityId: EntityId; abilityId: string; durationMs: number };

export interface SimulationClock {
  readonly nowMs: number;
  readonly tick: number;
}

export interface CommandResult {
  accepted: boolean;
  reason?: string;
  events: readonly SimulationEvent[];
}

export interface AuthoritativeSimulation {
  readonly clock: SimulationClock;
  dispatch(command: SimulationCommand): CommandResult;
  step(deltaMs: number): readonly SimulationEvent[];
}
