import type { RandomFn } from './engine';

export type ProcTrigger='onHit'|'onCriticalHit'|'onKill'|'onSkillUse'|'onDodge'|'onTakingDamage';
export interface ProcDefinitionV2 {id:string;trigger:ProcTrigger;chance:number;internalCooldownMs:number;effectId:string}
export interface ProcRuntimeState {readyAt:Record<string,number>}
export interface ProcEvent {procId:string;effectId:string}

export function createProcRuntimeState():ProcRuntimeState{return{readyAt:{}}}
export function resolveProcs(defs:readonly ProcDefinitionV2[],trigger:ProcTrigger,nowMs:number,state:ProcRuntimeState,rng:RandomFn=Math.random,sourceIsProc=false):ProcEvent[]{
 if(sourceIsProc)return[]; // hard anti-recursion rule
 const out:ProcEvent[]=[];
 for(const def of defs){if(def.trigger!==trigger)continue;if(nowMs<(state.readyAt[def.id]??0))continue;if(rng()>=def.chance)continue;state.readyAt[def.id]=nowMs+def.internalCooldownMs;out.push({procId:def.id,effectId:def.effectId});}
 return out;
}
