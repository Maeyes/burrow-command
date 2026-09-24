import type { SimulationCommand, SimulationEvent } from './contracts';
export interface ClientCommandEnvelopeV2 {sessionId:string;zoneId:string;command:SimulationCommand}
export interface ServerEventEnvelopeV2 {zoneId:string;serverTimeMs:number;events:readonly SimulationEvent[]}
export interface ZoneSnapshotV2 {zoneId:string;serverTimeMs:number;players:Array<{id:string;x:number;y:number;hp:number;maxHp:number;alive:boolean}>;monsters:Array<{id:string;x:number;y:number;hp:number;maxHp:number;alive:boolean}>}
export type ClientMessageV2={type:'command';payload:ClientCommandEnvelopeV2}|{type:'requestSnapshot';zoneId:string};
export type ServerMessageV2={type:'events';payload:ServerEventEnvelopeV2}|{type:'snapshot';payload:ZoneSnapshotV2}|{type:'rejected';reason:string};
