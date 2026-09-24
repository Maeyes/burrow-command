export interface CombatTelemetryV2{startedAtMs:number;elapsedMs:number;damageDealt:number;damageTaken:number;kills:number;deaths:number;gold:number;items:Record<string,number>;masteryXp:number}
export function createTelemetry(nowMs=0):CombatTelemetryV2{return{startedAtMs:nowMs,elapsedMs:0,damageDealt:0,damageTaken:0,kills:0,deaths:0,gold:0,items:{},masteryXp:0}}
export function recordTelemetryEvent(t:CombatTelemetryV2,event:{type:string;sourceId?:string;targetId?:string;amount?:number;entityId?:string},playerId:string,nowMs:number):CombatTelemetryV2{
 const n={...t,items:{...t.items},elapsedMs:Math.max(0,nowMs-t.startedAtMs)};
 if(event.type==='damageDealt'&&event.sourceId===playerId)n.damageDealt+=event.amount??0;
 if(event.type==='damageDealt'&&event.targetId===playerId)n.damageTaken+=event.amount??0;
 if(event.type==='entityDefeated'&&event.entityId===playerId)n.deaths+=1;
 return n;
}
export function recordTelemetryReward(t:CombatTelemetryV2,reward:{gold:number;items:Record<string,number>},masteryXp:number){const n={...t,items:{...t.items},gold:t.gold+reward.gold,masteryXp:t.masteryXp+masteryXp};for(const[id,q]of Object.entries(reward.items))n.items[id]=(n.items[id]??0)+q;n.kills+=1;return n}
export function telemetryRates(t:CombatTelemetryV2){const hours=Math.max(t.elapsedMs/3600000,1/3600);return{dps:t.elapsedMs? t.damageDealt/(t.elapsedMs/1000):0,killsPerHour:t.kills/hours,goldPerHour:t.gold/hours,masteryXpPerHour:t.masteryXp/hours}}
