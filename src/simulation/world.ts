import type { EntityId, MonsterId, PlayerId } from './contracts';
import type { MonsterEntity, PlayerEntity, WorldEntity } from './entities';

export interface WorldState {
  zoneId: string;
  players: Map<PlayerId, PlayerEntity>;
  monsters: Map<MonsterId, MonsterEntity>;
}

export function createWorldState(zoneId: string): WorldState {
  return { zoneId, players: new Map(), monsters: new Map() };
}

export function entityById(world: WorldState, id: EntityId): WorldEntity | undefined {
  return world.players.get(id as PlayerId) ?? world.monsters.get(id as MonsterId);
}

export function addPlayer(world: WorldState, player: PlayerEntity): void {
  if (entityById(world, player.id)) throw new Error(`Duplicate entity id: ${player.id}`);
  world.players.set(player.id, player);
}

export function addMonster(world: WorldState, monster: MonsterEntity): void {
  if (entityById(world, monster.id)) throw new Error(`Duplicate entity id: ${monster.id}`);
  world.monsters.set(monster.id, monster);
}
