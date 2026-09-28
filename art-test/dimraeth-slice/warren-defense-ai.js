// Burrow Command night-defense targeting: intercept approaching raiders before they reach a tower.
// Pure function so defensive priorities can be regression-tested without canvas or rendering.
export const NIGHT_DEFENSE = Object.freeze({
  villageRadius: 810,  // engage night raiders before they reach the outermost tower
  pursuitLimit: 900,   // never chase indefinitely across the forest
  maxUnitDistance: 1100,
  towerAlertRadius: 330,
  hallCriticalRadius: 315,
  claimPenalty: 175,
});

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

/** Stable guard posts distributed across every built gate. Multiple rabbits assigned to the
 * same gate fan out along its inner edge instead of stacking on the opening. */
export function assignedGateDefensePost(unit,units,sections,center,tile=64,ranged=false){
 const alive=(units||[]).filter(u=>!u.down),index=alive.indexOf(unit);
 const gates=(sections||[]).filter(f=>f.kind==='gate'&&f.hp>0);
 if(index<0||!gates.length)return null;
 const gateIndex=index%gates.length,gate=gates[gateIndex],laneRank=Math.floor(index/gates.length);
 const laneCount=Math.ceil((alive.length-gateIndex)/gates.length),offset=(laneRank-(laneCount-1)/2)*46;
 const x=(gate.x+(gate.axis==='x'?(gate.len||1)/2:0))*tile,y=(gate.y+(gate.axis==='y'?(gate.len||1)/2:0))*tile;
 const dx=center.x-x,dy=center.y-y,d=Math.hypot(dx,dy)||1,inset=ranged?118:72;
 const tx=gate.axis==='x'?1:0,ty=gate.axis==='y'?1:0;
 return {x:x+dx/d*inset+tx*offset,y:y+dy/d*inset+ty*offset,gate:gate.side||gateIndex};
}

/** When a raider nears a player-built barrier, route it through the nearest OPEN gate.
 * Other gates and standard perimeter gaps remain traversable by normal A* if no built gate qualifies. */
export function chooseRaidGate(raider,segments,center,tile=64){
 const d=distance(raider,center);
 const perimeterReach=(segments||[]).reduce((max,f)=>{
  const x=(f.x+(f.axis==='x'?(f.len||1)/2:0))*tile,y=(f.y+(f.axis==='y'?(f.len||1)/2:0))*tile;
  return Math.max(max,Math.hypot(x-center.x,y-center.y));
 },520);
 if(raider.passedGate||d<235||d>Math.max(700,perimeterReach+200))return null;
 const mid=f=>({x:(f.x+(f.axis==='x'?(f.len||1)/2:0))*tile,y:(f.y+(f.axis==='y'?(f.len||1)/2:0))*tile});
 if(!segments.some(f=>f.kind!=='gate'&&f.hp!==0&&distance(raider,mid(f))<145))return null;
 const gates=segments.filter(f=>f.kind==='gate'&&!f.closed&&f.hp!==0).map(mid);
 if(!gates.length)return null;
 return gates.reduce((best,p)=>!best||distance(raider,p)<distance(raider,best)?p:best,null);
}

/** Closed gates on a raider's own approach are vulnerable to an assault if left undefended. */
export function nearestClosedGate(raider,sections,maxDistance=220,tile=64){
 let best=null,dMin=maxDistance;
 for(const gate of sections||[]){
  if(gate.kind!=='gate'||!gate.closed||gate.hp<=0)continue;
  const x=(gate.x+(gate.axis==='x'?(gate.len||1)/2:0))*tile;
  const y=(gate.y+(gate.axis==='y'?(gate.len||1)/2:0))*tile;
  const d=Math.hypot(x-raider.x,y-raider.y);
  if(d<dMin){best=gate;dMin=d;}
 }
 return best;
}

/** Returns an intercept target and claims it for this tick; no target means hold the defense ring. */
export function selectNightDefenseTarget(unit,post,monsters,towers,center){
  let best=null,bestScore=Infinity;
  const activeTowers=towers.filter(t=>t.hp>0);
  for(const m of monsters){
    if(m.dead||!m.night)continue;
    const hallDistance=distance(m,center);
    const towerDistance=activeTowers.reduce((nearest,t)=>Math.min(nearest,distance(m,t)),Infinity);
    const threatensTower=towerDistance<=NIGHT_DEFENSE.towerAlertRadius;
    // Include outer towers as well as raiders heading straight for the hall.
    if(hallDistance>NIGHT_DEFENSE.pursuitLimit || (hallDistance>NIGHT_DEFENSE.villageRadius&&!threatensTower))continue;
    const unitDistance=distance(unit,m);
    if(unitDistance>NIGHT_DEFENSE.maxUnitDistance)continue;
    const sectorDistance=distance(post,m);
    // Tower threats outrank distant raiders. Spread defenders across lanes via claims.
    const towerUrgency=threatensTower?220+(NIGHT_DEFENSE.towerAlertRadius-towerDistance)*.65:0;
    const hallUrgency=hallDistance<NIGHT_DEFENSE.hallCriticalRadius?
      150+(NIGHT_DEFENSE.hallCriticalRadius-hallDistance)*.6:0;
    const score=unitDistance+sectorDistance*.55+(m.claims||0)*NIGHT_DEFENSE.claimPenalty-
      towerUrgency-hallUrgency-(m.boss?45:0);
    if(score<bestScore){bestScore=score;best=m;}
  }
  if(best)best.claims=(best.claims||0)+1;
  return best;
}
