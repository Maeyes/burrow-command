import type { SimulationCommand, SimulationEvent } from './contracts';
import { BunnySimulation, type RandomFn } from './engine';
import type { WorldState } from './world';

export class ZoneInstanceV2 {
 readonly simulation:BunnySimulation;
 constructor(readonly zoneId:string,world:WorldState,random?:RandomFn){if(world.zoneId!==zoneId)throw new Error('zone-id-mismatch');this.simulation=new BunnySimulation(world,random)}
 dispatch(command:SimulationCommand){return this.simulation.dispatch(command)}
 step(deltaMs:number):readonly SimulationEvent[]{return this.simulation.step(deltaMs)}
 snapshot(){return{zoneId:this.zoneId,serverTimeMs:this.simulation.clock.nowMs,players:[...this.simulation.world.players.values()].map(p=>({id:p.id,x:p.position.x,y:p.position.y,hp:p.hp,maxHp:p.maxHp,alive:p.alive})),monsters:[...this.simulation.world.monsters.values()].map(m=>({id:m.id,x:m.position.x,y:m.position.y,hp:m.hp,maxHp:m.maxHp,alive:m.alive}))}}
}
export class ZoneManagerV2{
 private readonly zones=new Map<string,ZoneInstanceV2>();
 add(zone:ZoneInstanceV2){if(this.zones.has(zone.zoneId))throw new Error('duplicate-zone');this.zones.set(zone.zoneId,zone)}
 get(zoneId:string){return this.zones.get(zoneId)}
 remove(zoneId:string){return this.zones.delete(zoneId)}
 stepAll(deltaMs:number){const out=new Map<string,readonly SimulationEvent[]>();for(const [id,z]of this.zones)out.set(id,z.step(deltaMs));return out}
}
