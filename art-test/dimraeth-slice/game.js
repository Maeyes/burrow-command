// Valley + BunnySimulation prototype.
// Dimraeth owns terrain/rendering. BunnySimulation owns combat/HP/monster AI.
import { boot, teardown, setRuntimeActors, setRuntimeActorUpdater, setRuntimePlayerVisual, canRuntimeActorStand, runtimeWalkHeight, projectRuntimePoint, moveRuntimePlayerToward, setRuntimePlayerControl, setRuntimeClickHandler, setRuntimeSafeZones } from './engine/runtime.js';
import { createNavigator, findPath, canWalkStraight } from './combat/nav.js';
import { createAutoHunt } from './combat/autohunt.js';
import { sceneFromMap } from './scenes/custom.js';
import valleyScene from './scenes/valley.js';
import { chooseRosterId, getRoster, monsterPresentation } from './combat/rosters.js';
import { renderMonsterIndex } from './combat/monsterIndex.js';
import { createFloaters, lootTierForChance, LOOT_COLORS } from './combat/floaters.js';
import { createSkillFx, FX_SPECS, BASIC_ATTACK_FX } from './combat/skillfx.js';
import { openCharacterWindow } from './ui/status.js';
import { MONSTERS_V2 } from '../../src/simulation/monsterDataV2.ts';
import { UNIVERSAL_ORE_CHANCE, UNIVERSAL_ASTRALITE_CHANCE } from '../../src/simulation/loot.ts';
import { mapTitleV2 } from '../../src/simulation/mapNames.ts';
import { combatSFX } from './combat/sfx.js';
import { combatFX } from './combat/fx.js';
import { loadBlessedHero, directionForIndex } from './combat/hero.js';
import { requestZoneTransfer, activePortalAt, mapDataByName } from './combat/zone.js';
import { normalizeCharacterStateV2 } from '../../src/simulation/equipmentMigration.ts';
import { ArenaV2Adapter } from '../../src/simulation/arenaAdapter.ts';
import { createInitialCharacterV2, expToNextLevelV2 } from '../../src/simulation/character.ts';
import { EQUIPMENT_MASTER_V2, SET_DEFINITIONS_V2 } from '../../src/simulation/itemMasterV2.ts';
import { iconHtml } from '../iso-arena-draft/iconFor.js';
import { masteryXpRequired } from '../../src/simulation/mastery.ts';
import { WEAPON_MASTERY_MILESTONES } from '../../src/simulation/masteryMilestones.ts';
import { inventoryCategoryFor, inventoryItemMeta } from '../../src/simulation/itemTagsV2.ts';
import { enhancementRequirement, REFINE_SUCCESS, astraliteCost, progressionCategory, equipmentRarityStatMultiplier } from '../../src/simulation/equipmentV2.ts';
import { equipmentCombatTotals } from '../../src/simulation/equipmentCombat.ts';
import { UTILITY_EQUIPMENT_V2 } from '../../src/simulation/utilityEquipmentV2.ts';
import { SKILLS_V2 } from '../../src/simulation/skills.ts';
import { SKILL_MODIFIERS_V2 } from '../../src/simulation/skillModifiersV2.ts';
import { skillCoreUpgradeQuote } from '../../src/simulation/skillCoreService.ts';
import { WEAPON_SKILLS_BY_FAMILY_V2 } from '../../src/simulation/skillEntitlements.ts';
import { WEAPON_PROC_RULES_V2 } from '../../src/simulation/engine.ts';
import { nextAutoSkillCommand } from '../../src/simulation/auto.ts';
import { beginHeroAttack, cancelHeroAttack, createHeroAttackPlayback, updateHeroAttackPlayback } from '../iso-arena-draft/heroCombat.js';
import { prettyItem, showUiError } from './ui/shared.js';
import { syncHotbar, syncHotbarCooldowns, pulseHotbarSkill, MASTERY_NAMES } from './ui/skills.js';
import { bindProductionUi } from './ui/windows.js';
import { bindUiRuntime } from './ui/runtime.js';

const mirrorImage=img=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(img.width,0);g.scale(-1,1);g.drawImage(img,0,0);return c;};
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Failed to load image: ${src}`));i.src=src;});
const sliceSheet=(img,count)=>{
  const frameWidth=Math.floor(img.width/count),out=[];
  for(let i=0;i<count;i++){const c=document.createElement('canvas');c.width=frameWidth;c.height=img.height;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(img,i*frameWidth,0,frameWidth,img.height,0,0,frameWidth,img.height);out.push(c);}
  return out;
};

const blessedHero=await loadBlessedHero();
const playback=createHeroAttackPlayback(blessedHero.attackDefinition('dagger','south'));
let facing='south',combatTarget=null,lastTargetSample=null,chaseStuck=0,lastKnownLevel=1,skillCastLockUntil=0,lastAutoSkillTry=0;
// Click-to-move pathfinding + Auto Hunt (see combat/nav.js, combat/autohunt.js).
const nav=createNavigator(),autoHunt=createAutoHunt();
let heroRef=null,navReplanIn=0,clickHitMonster=false,lastHuntLabel='';

setRuntimePlayerVisual(player=>{
  const movementDirection=directionForIndex(player.dir);
  if(!playback.active)facing=movementDirection;
  const authoritative=sim.simulation.world.players.get(sim.playerId);
  return blessedHero.visual({
    direction:playback.active?facing:movementDirection,
    moving:player.moving,
    running:Boolean(combatTarget),
    playback,
    weaponFamily:authoritative?.weaponFamily??'dagger',
  });
});

const query=new URLSearchParams(window.location.search);
const routeId=query.get('map')||'forest-combat';
const requestedFile=import.meta.env.DEV?query.get('file'):null;
const SAVE_KEY='bunny-world-character-v2';
function loadCharacter(){try{const raw=localStorage.getItem(SAVE_KEY);if(raw)return normalizeCharacterStateV2(JSON.parse(raw));}catch{}return createInitialCharacterV2('arena-player','Arena Bunny');}
function saveCharacter(state){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{}}
let persistentCharacter=loadCharacter();
let mapFileName=requestedFile||persistentCharacter.currentMapId||'forest1';
if(!mapDataByName(mapFileName))mapFileName='forest1';
let mapData=mapDataByName(mapFileName);
let scene=sceneFromMap(mapData);
let gameplayMapId=mapData.name;
let rosterId=chooseRosterId(mapData?.roster??scene.roster,scene.biome);
let roster=getRoster(rosterId,gameplayMapId);
let pool=roster.pool;
if(!pool.length)throw new Error(`Roster "${rosterId}" has no spawnable monsters`);
await combatFX.init({biome:scene.biome||rosterId,mapId:gameplayMapId});
scene.gameplay={
  ...scene.gameplay,
  mapId:gameplayMapId,
  rosterId,
  fieldPopulation:routeId==='valley-combat'?6:36,
  spawnPool:pool,
  spawnMargin:90,
  minHeroDistance:90,
};

const markerType=(sp,i)=>{
  if(typeof sp?.pool==='string'&&monsterPresentation(roster,sp.pool))return sp.pool;
  if(Array.isArray(sp?.pool)&&sp.pool.length){const candidates=sp.pool.filter(id=>monsterPresentation(roster,id));if(candidates.length)return candidates[i%candidates.length];}
  return pool[i%pool.length];
};
// Field population (2026-09-25): every map fields FIELD_POPULATION mobs scattered over its whole
// walkable area (placed after boot, once terrain exists) plus one boss in its lair. Normals are
// 3:1 over elites so elite-heavy rosters don't flood the map.
const FIELD_POPULATION=80,ELITE_WEIGHT=1,NORMAL_WEIGHT=3;
const bossType=roster.bossType&&monsterPresentation(roster,roster.bossType)?roster.bossType:null;
const fieldPool=pool.filter(id=>id!==bossType&&monsterPresentation(roster,id));
const fieldCount=routeId==='valley-combat'?6:FIELD_POPULATION;
// Elites fill a fixed share of the field (ELITE_WEIGHT/(ELITE_WEIGHT+NORMAL_WEIGHT) = 25%), spread
// evenly over the elite species; normals share the rest. Rosters with whole elite species stay balanced.
const eliteIds=fieldPool.filter(id=>monsterPresentation(roster,id).elite),normalIds=fieldPool.filter(id=>!monsterPresentation(roster,id).elite);
const eliteCount=!normalIds.length?fieldCount:!eliteIds.length?0:Math.round(fieldCount*ELITE_WEIGHT/(ELITE_WEIGHT+NORMAL_WEIGHT));
const fieldTypes=[...Array.from({length:fieldCount-eliteCount},(_,i)=>normalIds[i%normalIds.length]),...Array.from({length:eliteCount},(_,i)=>eliteIds[i%eliteIds.length])];
let spots=fieldTypes.map(type=>[scene.spawn.x/64,scene.spawn.y/64,type]);
if(bossType)spots.push([scene.spawn.x/64,scene.spawn.y/64,bossType]);

const presentations=new Map();
for(const monsterType of new Set(spots.map(sp=>sp[2]))){
  const p=monsterPresentation(roster,monsterType);
  if(!p)throw new Error(`Roster "${rosterId}" has no presentation for "${monsterType}"`);
  if(p.kind==='sheet'){
    const sheet=await loadImage(p.sheetSrc);
    p.frames=sliceSheet(sheet,p.count);
  }else{
    p.frames=await Promise.all(Array.from({length:p.count},(_,i)=>loadImage(p.frameSrc(i))));
  }
  // A missing/broken attack clip must not block the map: fall back to the tackle.
  if(p.attackSrc)p.attackFrames=await Promise.all(Array.from({length:p.attackCount},(_,i)=>loadImage(p.attackSrc(i)))).catch(()=>null);
  // Source art faces right; mirrored copies cover left-facing movement.
  p.framesLeft=p.frames.map(mirrorImage);if(p.attackFrames)p.attackFramesLeft=p.attackFrames.map(mirrorImage);
  presentations.set(monsterType,p);
}

// Safe zones: around every warp portal and the map's spawn. Monsters never spawn, walk or attack inside.
const SAFE_ZONES=[...(scene.portals||[]).map(p=>({x:p.x,y:p.y,r:Math.max(200,(p.radius??p.r??52)*3)})),{x:scene.spawn.x,y:scene.spawn.y,r:200}];
for(const p of scene.portals||[])if(p.to)p.label=`▶ ${mapTitleV2(p.to)}`;
setRuntimeSafeZones(SAFE_ZONES);
const nearestSafeZone=({x,y})=>SAFE_ZONES.reduce((b,z)=>!b||Math.hypot(x-z.x,y-z.y)<Math.hypot(x-b.x,y-b.y)?z:b,null);
const inSafeZone=({x,y},pad=0)=>SAFE_ZONES.some(z=>Math.hypot(x-z.x,y-z.y)<z.r+pad);
spots=spots.map(([tx,ty,type])=>{let x=tx*64,y=ty*64;for(const z of SAFE_ZONES){const dx=x-z.x,dy=y-z.y,d=Math.hypot(dx,dy);if(d<z.r+40){const k=(z.r+40)/Math.max(1,d);x=z.x+(d>1?dx*k:z.r+40);y=z.y+(d>1?dy*k:0);}}return[x/64,y/64,type];});
const MAP_PX=(scene.n??160)*(scene.cell??16);
const standable=(x,y)=>{const z=runtimeWalkHeight(x,y);return z!==null&&canRuntimeActorStand(x,y,z);};
// Main ground = walkable cells reachable from the arrival point without changing terrain level.
// Mobs spawn, respawn and roam only here, so hills stay free to explore and nobody fights across a cliff.
const GROUND_CELL=32,GROUND_N=Math.ceil(MAP_PX/GROUND_CELL),SAME_LEVEL_Z=12;
let mainGround=null;
function buildMainGround(){
  const z0=runtimeWalkHeight(scene.spawn.x,scene.spawn.y);if(z0===null)return;
  const grid=new Uint8Array(GROUND_N*GROUND_N),seen=new Uint8Array(GROUND_N*GROUND_N);
  const at=(i,j)=>{const x=(i+.5)*GROUND_CELL,y=(j+.5)*GROUND_CELL,z=runtimeWalkHeight(x,y);return z!==null&&Math.abs(z-z0)<=SAME_LEVEL_Z&&canRuntimeActorStand(x,y,z);};
  const si=Math.floor(scene.spawn.x/GROUND_CELL),sj=Math.floor(scene.spawn.y/GROUND_CELL),queue=[[si,sj]];seen[sj*GROUND_N+si]=1;
  while(queue.length){const [i,j]=queue.pop();if(!at(i,j))continue;grid[j*GROUND_N+i]=1;
    for(const [a,b] of [[i+1,j],[i-1,j],[i,j+1],[i,j-1]])if(a>=0&&b>=0&&a<GROUND_N&&b<GROUND_N&&!seen[b*GROUND_N+a]){seen[b*GROUND_N+a]=1;queue.push([a,b]);}}
  mainGround=grid;
}
const onMainGround=p=>{if(!mainGround)return true;const i=Math.floor(p.x/GROUND_CELL),j=Math.floor(p.y/GROUND_CELL);return i>=0&&j>=0&&i<GROUND_N&&j<GROUND_N&&mainGround[j*GROUND_N+i]===1;};
const canEngage=(a,b)=>{const za=runtimeWalkHeight(a.x,a.y),zb=runtimeWalkHeight(b.x,b.y);return za===null||zb===null||Math.abs(za-zb)<=SAME_LEVEL_Z;};
// Random spot on the main ground, outside safe zones and away from the hero.
// Respawns land in a ring around the hero (out of sight, still close) so a hunting spot keeps its
// density; only when the ring has no valid ground does it fall back to anywhere on the map.
const RESPAWN_RING_MIN=340,RESPAWN_RING_MAX=760;
function randomFieldPoint(hero,tries=60,taken=null,minGap=0,ring=false){
  for(let i=0;ring&&hero&&i<tries;i++){
    const a=Math.random()*Math.PI*2,r=RESPAWN_RING_MIN+Math.random()*(RESPAWN_RING_MAX-RESPAWN_RING_MIN);
    const p={x:hero.x+Math.cos(a)*r,y:hero.y+Math.sin(a)*r};
    if(p.x<48||p.y<48||p.x>MAP_PX-48||p.y>MAP_PX-48)continue;
    if(!standable(p.x,p.y)||!onMainGround(p)||inSafeZone(p,60))continue;
    if(taken&&taken.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<minGap))continue;
    return p;
  }
  for(let i=0;i<tries;i++){
    const p={x:48+Math.random()*(MAP_PX-96),y:48+Math.random()*(MAP_PX-96)};
    if(!standable(p.x,p.y)||!onMainGround(p)||inSafeZone(p,60))continue;
    if(hero&&Math.hypot(p.x-hero.x,p.y-hero.y)<320)continue;
    if(taken&&taken.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<minGap))continue;
    return p;
  }
  return null;
}
const monsterViews=spots.map(([tx,ty,monsterType],i)=>{
  const p=presentations.get(monsterType);
  return{id:`${gameplayMapId}-m${i}`,monsterType,x:tx*64,y:ty*64,hp:1,maxHp:1,dead:false,elite:!!p?.elite,isBoss:!!p?.isBoss};
});
const playerView={x:scene.spawn.x,y:scene.spawn.y};
const sim=new ArenaV2Adapter({zoneId:gameplayMapId,player:playerView,monsters:monsterViews,character:persistentCharacter,walkableContains:({x,y})=>{const z=runtimeWalkHeight(x,y);return z!==null&&canRuntimeActorStand(x,y,z);},safeZoneContains:p=>inSafeZone(p),monsterForbiddenContains:p=>inSafeZone(p,20)||!onMainGround(p),canEngage:(a,b)=>canEngage(a,b),respawnPointPicker:hero=>randomFieldPoint(hero,60,null,0,true),onReward:(reward,character,defeated)=>{persistentCharacter={...character,currentMapId:gameplayMapId};saveCharacter(persistentCharacter);combatSFX.playPickup();presentReward(reward,defeated);}});
bindUiRuntime({sim,saveCharacter,SAVE_KEY,gameplayMapId,pushRewardLine});
const actors=monsterViews.map((view,i)=>{
  const p=presentations.get(view.monsterType);
  return{
    kind:'actor',view,monsterType:view.monsterType,name:p.name,x:view.x,y:view.y,z:0,r:12,dead:false,
    visualScale:(p.isBoss?1.65:(p.kind==='sheet'?(p.elite?2.68:2.15):2))*(p.scale||1),
    attack:null,
    facingLeft:false,
    getImage(){const now=performance.now(),atk=this.attack,left=this.facingLeft;if(atk&&atk.clip&&now<atk.until){const f=left?p.attackFramesLeft:p.attackFrames;return f[Math.min(f.length-1,Math.floor((now-atk.start)/MONSTER_ATTACK_FRAME_MS))];}const f=left?p.framesLeft:p.frames;return f[Math.floor(now/120+i)%f.length];},
    drawOverlay(g,{x:sx,y:sy}){if(this.dead)return;const v=this.view,w=42,q=Math.max(0,v.hp/v.maxHp);g.fillStyle='rgba(10,12,12,.82)';g.fillRect(sx-w/2,sy-55,w,5);g.fillStyle='#e85b55';g.fillRect(sx-w/2+1,sy-54,(w-2)*q,3);g.font='10px system-ui';g.textAlign='center';g.fillStyle='#fff4cf';g.fillText(this.name,sx,sy-61);}
  };
});
setRuntimeActors(actors);

// Monster attack presentation. Clip = play the PixelLab attack frames; otherwise a code tackle:
// short windup back, lunge toward the target, return, with the global tackle FX at the lunge.
// Screen-space horizontal component of a world delta (iso: screen x follows x-y).
const screenDx=(dx,dy)=>dx-dy;
const MONSTER_ATTACK_FRAME_MS=70,TACKLE_MS=360,TACKLE_DISTANCE=16;
function beginMonsterAttack(actor,target){
  const p=presentations.get(actor.monsterType),now=performance.now();
  actor.facingLeft=screenDx(target.x-actor.view.x,target.y-actor.view.y)<0;
  if(p?.attackFrames?.length){actor.attack={clip:true,start:now,until:now+p.attackFrames.length*MONSTER_ATTACK_FRAME_MS};return;}
  const dx=target.x-actor.view.x,dy=target.y-actor.view.y,len=Math.hypot(dx,dy)||1;
  actor.attack={clip:false,start:now,until:now+TACKLE_MS,dx:dx/len,dy:dy/len,fxDone:false};
}
function tackleOffset(actor){
  const atk=actor.attack,now=performance.now();if(!atk||atk.clip||now>=atk.until)return 0;
  const t=(now-atk.start)/TACKLE_MS;
  if(t<.3)return -.25*(t/.3);
  if(t<.55)return -.25+1.25*((t-.3)/.25);
  return 1-(t-.55)/.45;
}

function faceTarget(player,target){
  const dx=target.x-player.x,dy=target.y-player.y;
  const vx=(dx-dy)/2,vy=(dx+dy)/4;
  const heading=(Math.atan2(vx,-vy)*180/Math.PI+360)%360;
  const dirs=['north','north-east','east','south-east','south','south-west','west','north-west'];
  facing=dirs[Math.round(heading/45)%8];
}
function predictedChasePoint(target,dt){
  const now=performance.now(),prev=lastTargetSample;
  let vx=0,vy=0;
  if(prev?.id===target.id){const secs=Math.max(.001,(now-prev.t)/1000);vx=(target.x-prev.x)/secs;vy=(target.y-prev.y)/secs;}
  lastTargetSample={id:target.id,x:target.x,y:target.y,t:now};
  const lead=Math.min(.32,Math.max(.08,dt*6));
  return{x:target.x+vx*lead,y:target.y+vy*lead};
}
function startAttack(player,target){
  if(!target||target.dead||playback.active)return false;
  const authoritative=sim.simulation.world.players.get(sim.playerId);
  if(authoritative&&sim.simulation.clock.nowMs<authoritative.nextBasicAttackAtMs)return false;
  faceTarget(player,target);
  const family=authoritative?.weaponFamily??'dagger';
  combatSFX.playAttack();
  beginHeroAttack(playback,{definition:blessedHero.attackDefinition(family,facing),attackIntervalMs:375,payload:{targetId:target.id}});
  return true;
}

setRuntimeActorUpdater(({dt,player})=>{
  const simPlayer=sim.simulation.world.players.get(sim.playerId);
  if(simPlayer)simPlayer.position={x:player.x,y:player.y};
  if(combatTarget?.dead)combatTarget=null;
  heroRef=player;
  setRuntimePlayerControl(Boolean(combatTarget||nav.active||autoHunt.on));
  combatFX.update(dt);
  blessedHero.update(dt);
  syncWarpPrompt(player);
  driveAutoHunt(player,simPlayer,dt);
  const autoSkillUsed=tryAutoCoreSkill(simPlayer);

  if(combatTarget){player.target=null;
  if(!playback.active&&!autoSkillUsed&&performance.now()>=skillCastLockUntil){
    const dx=combatTarget.x-player.x,dy=combatTarget.y-player.y,d=Math.hypot(dx,dy);
    const attackRange=Math.max(1,simPlayer?.attackRange??58),chaseStopRange=Math.max(1,attackRange*.7);
    // A targeted passive mob stops wandering (it has 'noticed' the hero) so the swing can't miss.
    const simMonster=sim.simulation.world.monsters.get(combatTarget.id);if(simMonster&&!simMonster.targetPlayerId){simMonster.roamTarget=undefined;simMonster.nextRoamAtMs=sim.simulation.clock.nowMs+800;}
    // Swing as soon as the target is inside attack range (with a small margin for monster drift);
    // only walk closer while it is out of range. Walking stops at chaseStopRange so we end up well inside.
    if(d<=attackRange-3){player.moving=false;player.target=null;lastTargetSample=null;chaseStuck=0;startAttack(player,combatTarget);}
    else chaseTarget(player,combatTarget,d,chaseStopRange,dt);
  }}else if(nav.active)nav.update(player,dt);

  for(const ev of updateHeroAttackPlayback(playback,dt*1000)){
    if(ev.type==='gameplayImpact'){
      const target=monsterViews.find(v=>v.id===ev.payload?.targetId&&!v.dead);
      if(target){
        const authoritative=sim.simulation.world.players.get(sim.playerId),monster=sim.simulation.world.monsters.get(target.id);
        if(authoritative&&monster){
          const dx=monster.position.x-authoritative.position.x,dy=monster.position.y-authoritative.position.y,range=authoritative.attackRange;
          if(Math.hypot(dx,dy)<=range){
            const result=sim.basicAttack(target.id),damageEvent=result?.events?.find(event=>event.type==='damageDealt'&&event.targetId===target.id);
            // Every hand's strike gets its own hit sound/spark; follow-up hits (off-hand, double
            // attack) land 110ms apart so two-dagger swings read as two blows.
            const actor=actors.find(a=>a.view.id===target.id);
            // Basic swing overlay (slash arc / arrow / bolt) for the equipped weapon family.
            if(result?.accepted&&skillFx){const fam=authoritative.weaponFamily,fx=BASIC_ATTACK_FX[fam];if(fx)skillFx.play(fx,{from:{...authoritative.position},to:{...monster.position}});}
            result?.events?.filter(event=>event.type==='damageDealt'&&event.targetId===target.id&&event.sourceId===sim.playerId).forEach((event,k)=>setTimeout(()=>{combatSFX.playHit({critical:event.critical});combatFX.playHitSpark(target.x,target.y,{visualScale:actor?.visualScale??1});},k*110));
            presentCombatEvents(result?.events);
          }

        }
      }
    }
  }
  const restHp=simPlayer?.hp??0,restSp=simPlayer?.sp??0;
  const events=sim.step(dt*1000);
  applyRestBonus(restHp,restSp);
  presentCombatEvents(events);
  for(const a of actors){
    const v=a.view,k=tackleOffset(a)*TACKLE_DISTANCE*a.visualScale;
    if(!a.attack||performance.now()>=a.attack.until){const mdx=screenDx(v.x-(a.lastX??v.x),v.y-(a.lastY??v.y));if(Math.abs(mdx)>.3)a.facingLeft=mdx<0;}
    a.lastX=v.x;a.lastY=v.y;
    a.x=v.x+(k?a.attack.dx*k:0);a.y=v.y+(k?a.attack.dy*k:0);a.dead=v.dead;
    if(a.attack&&!a.attack.clip&&!a.attack.fxDone&&k>TACKLE_DISTANCE*a.visualScale*.8){a.attack.fxDone=true;combatFX.playTackle(a.x,a.y,{visualScale:a.visualScale});}
  }
  setRuntimeActors([...actors,...combatFX.getRuntimeActors()]);
  // Barrier bubble stays on the hero while the shield has HP left.
  {const bp=sim.simulation.world.players.get(sim.playerId);const on=bp&&(bp.barrierHp??0)>0&&(bp.barrierUntilMs??0)>sim.simulation.clock.nowMs;if(on&&skillFx&&(!barrierFx||barrierFx.age>=barrierFx.life-.05)){barrierFx=skillFx.play('barrier',{follow:()=>sim.simulation.world.players.get(sim.playerId)?.position});}if(!on&&barrierFx){skillFx.stop(barrierFx);barrierFx=null;}}
  skillFx?.update(dt);skillFx?.draw();floaters?.update(dt);floaters?.draw();
  syncHud();syncDeathOverlay();
});

let deathUntil=0;
function announceBoss(view){const log=document.getElementById('chat-log');if(!log)return;const p=document.createElement('p');p.className='system';p.textContent=`[World] ${presentations.get(view.monsterType)?.name??'A boss'} has appeared in ${mapTitleV2(gameplayMapId)}!`;log.append(p);log.scrollTop=log.scrollHeight;}
function pushRewardLine(text,color){const feed=document.getElementById('reward-feed');if(!feed)return;const line=document.createElement('div');line.textContent=text;if(color)line.style.color=color;feed.prepend(line);setTimeout(()=>line.remove(),5000);while(feed.children.length>6)feed.lastElementChild?.remove();}
function appendWorldChat(text,{system=false}={}){const log=document.getElementById('chat-log');if(!log)return;const line=document.createElement('p');line.textContent=text;if(system)line.className='system';log.appendChild(line);while(log.children.length>40)log.firstElementChild?.remove();log.scrollTop=log.scrollHeight;}
// Loot and reward feed, as in the arena prototype: sparkles coloured by drop rarity + reward lines.
let floaters=null,skillFx=null,barrierFx=null;
function lootChance(loot,id){if(!loot)return 1;if(id===loot.oreItemId)return UNIVERSAL_ORE_CHANCE;if(id==='astraliteStone')return UNIVERSAL_ASTRALITE_CHANCE;for(const r of [loot.material,loot.aetherstone,loot.modifier,loot.core,loot.blueprint,...(loot.equipmentDrops??[])])if(r?.itemId===id)return r.chance;return 1;}
function presentReward(reward,defeated){
  const items=Object.entries(reward.loot?.items??{}).filter(([,q])=>q>0),loot=MONSTERS_V2[defeated?.monsterType]?.loot;
  if(defeated&&items.length)floaters?.loot(defeated.x,defeated.y,items.map(([id,q])=>({label:`${prettyItem(id)}${q>1?' ×'+q:''}`,tier:lootTierForChance(lootChance(loot,id))})));
  // Same rarity colour as the loot text that popped over the monster.
  for(const [id,q] of items)pushRewardLine(`ได้รับ ${prettyItem(id)} ${q} ea`,LOOT_COLORS[lootTierForChance(lootChance(loot,id))]);
  if(reward.exp>0)pushRewardLine(`ได้รับ ${reward.exp} EXP`,'#b8f28a');
  if(reward.masteryXp>0)pushRewardLine(`ได้รับ ${reward.masteryXp} ${MASTERY_NAMES[reward.masteryFamily]??''} Mastery XP`,'#9fe8ff');
  if(reward.loot?.gold>0)pushRewardLine(`ได้รับ ${reward.loot.gold} Gold`,LOOT_COLORS.gold);
}
// World FX belong to the scene layer, never to document.body above game windows.
const worldFxRoot=document.getElementById('wrap');
const skillFxLayer=document.createElement('div');skillFxLayer.className='skill-fx-layer';worldFxRoot.appendChild(skillFxLayer);
// Skill FX: every core and weapon-mastery skill plays its PixelLab sheet (combat/skillfx.js);
// area skills also get a ground ring for their radius.
function showSkillCastFx(skillId,targetId,ground){
  const skill=SKILLS_V2[skillId];if(!skill||!skillFx)return;
  const player=sim.simulation.world.players.get(sim.playerId);if(!player)return;
  const target=targetId?sim.simulation.world.monsters.get(targetId):null,self={...player.position};
  const to=target?{...target.position}:ground?{...ground}:self;
  if(FX_SPECS[skillId]){
    const spec=FX_SPECS[skillId],attach=spec.kind==='attach';
    skillFx.play(skillId,{from:self,to,radius:skill.radius??0,follow:attach?()=>sim.simulation.world.players.get(sim.playerId)?.position:null});
    // Chain skills also strike the other monsters they hit.
    if(skillId==='thunderStorm'||skillId==='arcCascade'){for(const m of sim.simulation.world.monsters.values())if(m.alive&&m!==target&&Math.hypot(m.position.x-to.x,m.position.y-to.y)<(skill.radius??0))skillFx.play(skillId,{from:self,to:{...m.position}});}
  }
  if(skill.radius&&(skill.targeting==='targetArea'||skill.targeting==='groundArea'))skillFx.ring(to.x,to.y,skill.radius,skill.element==='fire'?'#ff9b62':skill.element==='lightning'?'#9fd2ff':skill.element==='cold'?'#bff3ff':'#ffd27a');
}
// Dash/Blink: white bunny afterimages with a pink aura along the path.
function playDashTrail(skillId,from,to){
  if(!skillFx)return;
  if(skillId==='blink'){
    // Teleport, not a run: a puff at the start, a dotted arcane streak, then a bigger burst on arrival.
    skillFx.play('blink',{from});
    skillFx.burst(from.x,from.y,{color:'#b99cff',color2:'#e9e0ff',count:16,speed:55,up:18,life:.3,h:10,gravity:0});
    const dots=8;for(let k=1;k<dots;k++)setTimeout(()=>{const t=k/dots;skillFx.burst(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,{color:'#9fd2ff',color2:'#ffffff',count:3,speed:18,up:14,life:.35,h:10,gravity:0});},k*14);
    setTimeout(()=>{skillFx.play('blink',{from:to});skillFx.burst(to.x,to.y,{color:'#b99cff',color2:'#9fd2ff',count:22,speed:95,up:26,life:.45,h:10,gravity:60});},110);
    return;
  }
  skillFx.burst(from.x,from.y,{color:'#d9c7a8',color2:'#fff0f8',count:12,speed:60,up:30,life:.45,h:4,gravity:120});
  const steps=6;for(let k=0;k<steps;k++)setTimeout(()=>{const t=(k+1)/(steps+1),v=playerVisualNow();if(v)skillFx.ghost(v,from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,{scale:v.scale??1,life:.28+k*.03});},k*18);
}
function skillRejectMessage(reason){
  return reason==='insufficient-sp'?'Not enough SP':reason==='skill-cooldown'?'Skill is on cooldown':reason==='out-of-range'?'Target is out of range':reason==='invalid-target'||reason==='ground-target-required'||reason==='no-targets'?'Select a valid target':reason==='incompatible-weapon'?'Wrong weapon for this Skill Core':reason||'Skill failed';
}
function executeCoreSkill(skillId,{auto=false}={}){
  const skill=SKILLS_V2[skillId];if(!skill||skill.kind!=='active')return false;
  const target=combatTarget&&!combatTarget.dead?sim.simulation.world.monsters.get(combatTarget.id):undefined;
  let targetId,ground;
  if(skill.targeting==='groundArea'){
    if(!target){if(!auto)showUiError('Select a target first');return false;}ground={...target.position};
  }else if(skill.targeting==='target'||skill.targeting==='targetArea'||(!skill.targeting&&Boolean(skill.scaling))){
    if(!target){if(!auto)showUiError('Select a target first');return false;}targetId=target.id;
  }
  const result=sim.castSkill(skillId,targetId,ground);
  if(!result?.accepted){if(!auto&&result?.reason)showUiError(skillRejectMessage(result.reason));return false;}
  skillCastLockUntil=performance.now()+220;
  presentCombatEvents(result.events);
  syncHud();
  return true;
}
function tryAutoCoreSkill(simPlayer){
  if(!autoHunt.on||resting||deathUntil||playback.active||!simPlayer?.alive||performance.now()-lastAutoSkillTry<140)return false;
  lastAutoSkillTry=performance.now();
  const target=combatTarget&&!combatTarget.dead?sim.simulation.world.monsters.get(combatTarget.id):undefined;
  const monsters=[...sim.simulation.world.monsters.values()].filter(m=>m.alive);
  const command=nextAutoSkillCommand(simPlayer,target,monsters,{mode:'fullAuto',sequence:0,activeSkillIds:simPlayer.skillEntitlements.active,weaponSkillIds:simPlayer.skillEntitlements.weaponSkills,movementSkillId:simPlayer.skillEntitlements.movement,hpFraction:simPlayer.hp/simPlayer.maxHp,nowMs:sim.simulation.clock.nowMs,recovering:false});
  if(!command||command.type!=='castSkill')return false;
  return executeCoreSkill(command.skillId,{auto:true});
}

function presentDamageText(event,stack=0){
  if(!floaters)return;
  if(event.type==='healed'&&event.targetId===sim.playerId){const p=sim.simulation.world.players.get(sim.playerId)?.position;if(p)floaters.text(p.x,p.y,`+${Math.round(event.amount)}`,{color:'#70f59a',dx:30});return;}
  if(event.type==='barrierApplied'&&event.entityId===sim.playerId){const p=sim.simulation.world.players.get(sim.playerId)?.position;if(p)floaters.text(p.x,p.y,`BARRIER +${event.amount}`,{color:'#f7fbff',size:15,lift:44});return;}
  if(event.type==='barrierAbsorbed'&&event.entityId===sim.playerId){const p=sim.simulation.world.players.get(sim.playerId)?.position;if(p)floaters.text(p.x,p.y,`-${event.amount}`,{color:'#ffffff',size:15,lift:34});return;}
  if(event.type!=='damageDealt')return;
  if(event.targetId===sim.playerId){if(event.amount<=0)return;const p=sim.simulation.world.players.get(sim.playerId)?.position;if(p)floaters.text(p.x,p.y,`-${event.amount}`,{color:'#ff6b5e',size:event.critical?17:14});return;}
  if(event.sourceId!==sim.playerId)return;
  const v=monsterViews.find(m=>m.id===event.targetId);if(!v)return;
  const origin=event.effect?.origin,ability=event.effect?.ability,echo=origin==='ECHO',proc=origin==='MASTERY_PROC'||echo;
  const label=echo?(ability==='extraStrike'?'EXTRA STRIKE!':ability==='coreEcho'?'RESONANCE!':'ECHO!'):proc?(ability==='multiShot'?'ADDITIONAL HIT!':ability==='cleave'?'CLEAVE!':String(ability||'').startsWith('doubleAttack')?'DOUBLE ATTACK!':SKILLS_V2[ability]?.name?`${SKILLS_V2[ability].name.toUpperCase()}!`:'MASTERY!'):'';
  const text=event.critical?`${label||'CRITICAL!'} ★  ${event.amount}`:label?`${label}  ${event.amount}`:`${event.amount}`;
  const show=()=>floaters.text(v.x,v.y,text,{color:event.critical?'#ffe36f':echo?(ability==='extraStrike'?'#ffb35c':'#e59bff'):ability==='multiShot'?'#a98cff':proc?'#9fe8ff':'#ffffff',size:event.critical?19:proc?16:15,lift:(proc?46:event.critical?38:26)+stack*20});
  if(stack)setTimeout(show,stack*110);else show();
}
// Code FX for combat events: crit stars on monsters, BLOCK flash on the hero, respawn burst.
function presentEventFx(event){
  if(!skillFx)return;
  if(event.type==='damageDealt'&&event.sourceId===sim.playerId&&event.critical){const m=sim.simulation.world.monsters.get(event.targetId);if(m)skillFx.burst(m.position.x,m.position.y,{color:'#ffe36f',color2:'#fff8d8',count:12,speed:120,up:70,life:.45,size:3,h:24});}
  if(event.type==='damageDealt'&&event.targetId===sim.playerId&&event.blocked){const p=sim.simulation.world.players.get(sim.playerId)?.position;if(p){skillFx.burst(p.x,p.y,{color:'#cfe6ff',color2:'#ffffff',count:10,speed:90,up:40,life:.35,h:22});floaters?.text(p.x,p.y,'BLOCK',{color:'#9fd2ff',size:14,lift:44,dx:-26});}}
  if(event.type==='entityRespawned'&&event.entityId===sim.playerId){const p=event.position;skillFx.pillar(p.x,p.y,{color:'#ffd6ec'});skillFx.burst(p.x,p.y,{color:'#ffffff',color2:'#ff9fcf',count:24,speed:110,up:90,life:.8});}
}
function presentCombatEvents(events){const hitsOn={};for(const event of events||[]){let stack=0;presentEventFx(event);if(event.type==='damageDealt'&&event.sourceId===sim.playerId){stack=hitsOn[event.targetId]??0;hitsOn[event.targetId]=stack+1;}presentDamageText(event,stack);if(event.type==='skillCast'&&event.sourceId===sim.playerId){combatSFX.playSkillCast(event.skillId);pulseHotbarSkill(event.skillId);showSkillCastFx(event.skillId,event.targetId);}if(event.type==='attackStarted'&&event.sourceId!==sim.playerId){const actor=actors.find(a=>a.view.id===event.sourceId),target=event.targetId===sim.playerId?sim.simulation.world.players.get(sim.playerId)?.position:null;if(actor&&target)beginMonsterAttack(actor,target);}if(event.type==='damageDealt'&&event.targetId===sim.playerId&&event.amount>0)blessedHero.hurt();if(event.type==='entityDefeated'&&event.entityId===sim.playerId){blessedHero.die();deathUntil=performance.now()+10000;const o=document.getElementById('death-overlay');if(o)o.hidden=false;combatSFX.playDeath();cancelCombat();}if(event.type==='entityRespawned'&&event.entityId!==sim.playerId){const v=monsterViews.find(x=>x.id===event.entityId);if(v?.isBoss)announceBoss(v);}if(event.type==='entityRespawned'&&event.entityId===sim.playerId){blessedHero.respawn();deathUntil=0;const o=document.getElementById('death-overlay');if(o)o.hidden=true;}if(event.type==='entityDefeated'&&event.entityId!==sim.playerId){combatSFX.playDeath({volume:0.5});const target=monsterViews.find(v=>v.id===event.entityId),actor=actors.find(a=>a.view.id===event.entityId);if(target){const fxOptions={visualScale:actor?.visualScale??1};target.isBoss?combatFX.playBossDeath(target.x,target.y,fxOptions):combatFX.playNormalDeath(target.x,target.y,fxOptions);}pushRewardLine('Monster defeated');}}}
function syncDeathOverlay(){const o=document.getElementById('death-overlay'),v=document.getElementById('death-seconds'),ring=document.querySelector('.death-countdown .progress');if(!o||!v)return;if(!deathUntil){o.hidden=true;return;}const remain=Math.max(0,deathUntil-performance.now()),left=Math.ceil(remain/1000);v.textContent=String(left);if(ring)ring.style.strokeDashoffset=String(264*(1-remain/10000));if(remain<=0){deathUntil=0;o.hidden=true;}}
function bindChat(){const input=document.getElementById('chat-input');if(!input)return;window.addEventListener('keydown',e=>{if(e.code!=='Enter')return;if(document.activeElement===input){e.preventDefault();e.stopImmediatePropagation();const msg=input.value.trim();if(msg){appendWorldChat(`Bunny: ${msg}`);input.value='';}input.blur();return;}if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;e.preventDefault();e.stopImmediatePropagation();input.focus();},true);}
bindChat();

// HUD gauge for the Lv30 weapon skill; hidden until it is unlocked.
const weaponGauge=document.createElement('div');weaponGauge.id='weapon-gauge';weaponGauge.hidden=true;
weaponGauge.style.cssText='position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:40;width:180px;height:8px;border-radius:4px;background:rgba(10,14,18,.8);border:1px solid #d9bd72;overflow:hidden;pointer-events:none';
weaponGauge.innerHTML='<i style="display:block;height:100%;width:0;background:linear-gradient(90deg,#d9a441,#ffe08a)"></i>';document.body.appendChild(weaponGauge);
function syncWeaponGauge(p){const ult=p?.skillEntitlements?.weaponSkills?.[2];
  // The gauge is fixed above the HUD; hide it while any game window or modal is open so it never shows through.
  const windowOpen=[...document.querySelectorAll('#game-window,#equipment-detail-modal,.equipment-panel')].some(el=>!el.hidden&&el.offsetParent!==null);
  weaponGauge.hidden=!ult||windowOpen;if(weaponGauge.hidden)return;const g=p.weaponProc?.gauge??0;weaponGauge.title=`${SKILLS_V2[ult]?.name||ult}: ${g}/${WEAPON_PROC_RULES_V2.gaugeHits}`;weaponGauge.firstChild.style.width=`${100*g/WEAPON_PROC_RULES_V2.gaugeHits}%`;}
function syncBarrierUi(p){
  const hpBar=document.querySelector('.player-hud .bar.hp');
  if(hpBar&&!hpBar.querySelector('.barrier-fill')){const fill=document.createElement('span');fill.className='barrier-fill';hpBar.appendChild(fill);}
  const active=Boolean(p&&(p.barrierHp??0)>0&&(p.barrierUntilMs??0)>sim.simulation.clock.nowMs);
  const fill=hpBar?.querySelector('.barrier-fill');
  if(hpBar)hpBar.classList.toggle('barrier-active',active);
  if(fill)fill.style.width=active?`${100*(p.barrierHp??0)/Math.max(1,p.barrierMaxHp??1)}%`:'0%';
}
function syncHud(){
  const ui=document.getElementById('game-ui');if(ui)ui.hidden=false;
  const p=sim.simulation.world.players.get(sim.playerId),c=sim.character;
  const set=(sel,v)=>{const el=document.querySelector(sel);if(el)el.textContent=v;};
  const width=(sel,v)=>{const el=document.querySelector(sel);if(el)el.style.width=`${Math.max(0,Math.min(100,v))}%`;};
  syncWeaponGauge(p);syncBarrierUi(p);syncHotbarCooldowns();
  set('#hero-name',(c.name||'Bunny').toUpperCase());set('#hero-level',`Lv. ${c.level}`);
  if(c.level>lastKnownLevel){combatSFX.playLevelUp();lastKnownLevel=c.level;const lp=sim.simulation.world.players.get(sim.playerId)?.position;if(lp&&skillFx){skillFx.pillar(lp.x,lp.y);skillFx.burst(lp.x,lp.y,{color:'#ffe27a',color2:'#fff8d8',count:22,speed:70,up:120,life:.9});floaters?.text(lp.x,lp.y,'LEVEL UP!',{color:'#ffe27a',size:20,lift:62,life:1.8});}}
  width('.player-hud .bar.hp i',p?.maxHp?(p.hp/p.maxHp)*100:0);width('.player-hud .bar.sp i',p?.maxSp?((p.sp??0)/p.maxSp)*100:0);
  width('.player-hud .bar.exp i',(c.exp/Math.max(1,expToNextLevelV2(c.level)))*100);
  const target=document.getElementById('target-hud');
  if(target){target.hidden=!combatTarget||combatTarget.dead;if(combatTarget&&!combatTarget.dead){const a=actors.find(x=>x.view.id===combatTarget.id);set('#target-name',a?.name||'MONSTER');set('#target-hp',`${Math.ceil(combatTarget.hp)} / ${Math.ceil(combatTarget.maxHp)}`);width('#target-hud .bar.hp i',combatTarget.maxHp?combatTarget.hp/combatTarget.maxHp*100:0);}}
}



bindProductionUi();
const sfxToggle=document.getElementById('sfx-toggle');
function syncSfxToggle(){if(!sfxToggle)return;sfxToggle.innerHTML=`${combatSFX.enabled?'🔊':'🔇'}<span>${combatSFX.enabled?'Sound':'Muted'}</span>`;sfxToggle.title=combatSFX.enabled?'Mute sound':'Enable sound';}
sfxToggle?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();combatSFX.toggle();syncSfxToggle();});
syncSfxToggle();
syncHotbar();
const warpPrompt=document.createElement('div');warpPrompt.id='warp-prompt';warpPrompt.hidden=true;warpPrompt.style.cssText='position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:50;padding:8px 14px;background:rgba(10,14,18,.9);border:1px solid #d9bd72;border-radius:6px;color:#fff4cf;font:600 14px system-ui;pointer-events:none';document.body.appendChild(warpPrompt);
let nearbyPortal=null,zoneTransferBusy=false;
function syncWarpPrompt(player){nearbyPortal=activePortalAt(scene,player);warpPrompt.hidden=!nearbyPortal;if(nearbyPortal)warpPrompt.textContent=`Warp to ${mapTitleV2(nearbyPortal.to)} [E]`;}
async function performWarp(){if(zoneTransferBusy||!nearbyPortal||!window.__slice)return;zoneTransferBusy=true;cancelCombat();const result=await requestZoneTransfer({fromMap:gameplayMapId,portalId:nearbyPortal.id,scene,player:window.__slice.player});if(result.denied){showUiError(result.reason);zoneTransferBusy=false;return;}combatSFX.playWarp();{const wp=window.__slice?.player;if(wp&&skillFx){skillFx.pillar(wp.x,wp.y,{color:'#9fefff',count:34});skillFx.burst(wp.x,wp.y,{color:'#dffbff',color2:'#7fdcff',count:26,speed:90,up:140,life:.8});}}persistentCharacter={...sim.character,currentMapId:result.map};saveCharacter(persistentCharacter);combatFX.teardown();setRuntimeActors([]);setRuntimeActorUpdater(null);teardown();const url=new URL(location.href);url.searchParams.set('map','forest-combat');if(import.meta.env.DEV)url.searchParams.set('file',result.map);else url.searchParams.delete('file');sessionStorage.setItem('bunny-world-zone-spawn',JSON.stringify(result.spawn));location.replace(url);}
window.addEventListener('keydown',e=>{if((e.code==='KeyE'||e.code==='Enter')&&nearbyPortal){e.preventDefault();performWarp();}});
document.querySelectorAll('[data-hotbar-slot]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.skillId;if(id)executeCoreSkill(id);}));
window.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;const slot={Digit1:0,Digit2:1,Digit3:2}[e.code];if(slot===undefined)return;const id=document.querySelector(`[data-hotbar-slot="${slot}"]`)?.dataset.skillId;if(id){e.preventDefault();executeCoreSkill(id);}});
// Movement core (Dash/Blink) on SPACE and the hotbar button, toward where the hero faces.
// Facing names are screen directions; iso screen (sx,sy) maps to world (sy+sx/2, sy-sx/2).
const FACING_SCREEN={east:[1,0],'south-east':[1,1],south:[0,1],'south-west':[-1,1],west:[-1,0],'north-west':[-1,-1],north:[0,-1],'north-east':[1,-1]};
function castMovementSkill(){
  // Installed movement core (Dash/Blink) if any, otherwise the built-in dodge roll.
  const id=sim.character.skills.movement;
  const [sx,sy]=FACING_SCREEN[facing]||[1,0],wx=sy+sx/2,wy=sy-sx/2,len=Math.hypot(wx,wy)||1,dir={x:wx/len,y:wy/len};
  const start=sim.simulation.world.players.get(sim.playerId)?.position;const from=start&&{...start};
  const result=id?sim.castSkill(id,undefined,undefined,dir):sim.dodge(dir);
  if(!result?.accepted){if(result?.reason&&result.reason!=='dodge-cooldown')showUiError(skillRejectMessage(result.reason));return;}
  presentCombatEvents(result.events);syncHud();
  // The runtime hero is what the camera follows and what syncs back into the sim each frame, so it
  // must jump too — otherwise the next step pulls the sim player back to where the dash started.
  const to=sim.simulation.world.players.get(sim.playerId)?.position,rp=window.__slice?.player;
  if(to&&rp){rp.x=to.x;rp.y=to.y;rp.moving=false;rp.target=null;playerView.x=to.x;playerView.y=to.y;nav.clear();}
  if(from&&to)playDashTrail(id||'dash',from,{...to});
}
function playerVisualNow(){const p=sim.simulation.world.players.get(sim.playerId);return blessedHero.visual({direction:facing,moving:true,running:true,weaponFamily:p?.weaponFamily??'dagger'});}
document.querySelector('[data-hotbar-movement]')?.addEventListener('click',castMovementSkill);
window.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;e.preventDefault();castMovementSkill();});
// C = character status.
window.addEventListener('keydown',e=>{if(e.code!=='KeyC'||e.repeat||e.ctrlKey||e.metaKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;e.preventDefault();openCharacterWindow();});
// ---- chasing: walk straight when the way is clear, otherwise follow an A* route ----
function giveUpTarget(target){if(autoHunt.on)autoHunt.ban(target.id);nav.clear();cancelCombat();chaseStuck=0;}
let chaseWindow=null,chaseForceNavUntil=0;
function chaseTarget(player,target,d,stopRange,dt){
  // A target on another ground level (up/down a cliff) cannot be fought from here.
  if(!canEngage(player,target)&&d<260){giveUpTarget(target);return;}
  const direct=d<200&&performance.now()>=chaseForceNavUntil&&canWalkStraight(player.x,player.y,target.x,target.y);
  if(direct){
    nav.clear();
    moveRuntimePlayerToward(target.x,target.y,Math.min(Math.max(0,d-stopRange),125*dt));
    // Sliding along a ledge still shaves a little distance each frame, so judge real progress over
    // half a second; no progress -> route around with A* (below) instead of running on the spot.
    const now=performance.now();
    if(!chaseWindow||chaseWindow.id!==target.id||now-chaseWindow.t>500){if(chaseWindow?.id===target.id&&chaseWindow.d-d<20)chaseForceNavUntil=now+2500;chaseWindow={id:target.id,t:now,d};}
    if(now>=chaseForceNavUntil)return;
  }
  navReplanIn-=dt;
  if(!nav.active||navReplanIn<=0||!nav.goal||Math.hypot(nav.goal.x-target.x,nav.goal.y-target.y)>120){
    navReplanIn=.6;
    if(!nav.goTo(player,target.x,target.y,{reach:stopRange})||!nav.complete){giveUpTarget(target);return;}
  }
  nav.update(player,dt);
}

// ---- Auto Hunt driver ----
function huntSnapshot(){
  const world=sim.simulation.world;
  return monsterViews.map(v=>{const m=world.monsters.get(v.id);return{id:v.id,x:v.x,y:v.y,level:m?.level??1,hp:v.hp,maxHp:v.maxHp,alive:!v.dead&&m?.alive!==false,elite:v.elite,boss:v.isBoss,aggroed:m?.targetPlayerId===sim.playerId&&m?.alive!==false};});
}
function driveAutoHunt(player,simPlayer,dt){
  if(!autoHunt.on||!simPlayer)return;
  if(deathUntil||!simPlayer.alive){autoHunt.stop();nav.clear();syncHuntButton();return;}
  const hero={x:player.x,y:player.y,hp:simPlayer.hp,maxHp:simPlayer.maxHp,level:sim.character.level,alive:simPlayer.alive,attackRange:simPlayer.attackRange};
  const monsters=huntSnapshot(),reach=Math.max(1,simPlayer.attackRange??58)*.7;
  const pathLength=m=>{const r=findPath(hero.x,hero.y,m.x,m.y,{reach});return r&&r.complete?(r.length??0):null;};
  const zone=nearestSafeZone(hero);
  const safe=zone&&{inside:inSafeZone(hero),travel:()=>{const r=findPath(hero.x,hero.y,zone.x,zone.y,{reach:zone.r*.5});return r&&r.complete?(r.length??0):null;}};
  const act=autoHunt.tick(dt,hero,monsters,{fighting:Boolean(combatTarget),currentId:combatTarget?.id??null,beingAttacked:monsters.some(m=>m.aggroed),pathLength,safe});
  if(act?.action==='retreat'){
    if(combatTarget)cancelCombat();if(resting)setResting(false);
    if(!nav.active&&!nav.goTo(player,zone.x,zone.y,{reach:zone.r*.5}))autoHunt.retreating=false;
    return syncHuntButton();
  }
  if(act?.action==='rest'){nav.clear();if(!resting)setResting(true,'auto');}
  else if(resting&&restSource==='auto')setResting(false);
  if(act?.action==='rest')return syncHuntButton();
  else if(act?.action==='fight'&&act.id&&combatTarget?.id!==act.id){
    const view=monsterViews.find(v=>v.id===act.id);
    if(view&&!view.dead){cancelHeroAttack(playback);lastTargetSample=null;chaseStuck=0;nav.clear();combatTarget=view;}
  }else if(act?.action==='home'&&!nav.active&&!combatTarget&&autoHunt.anchor){nav.goTo(player,autoHunt.anchor.x,autoHunt.anchor.y);}
  syncHuntButton();
}
// ---- Rest (Z / Auto Hunt): stand still, HP/SP regen ×3. Any action cancels it. ----
let resting=false,restSource=null;
function setResting(on,source='manual'){
  if(on){const p=sim.simulation.world.players.get(sim.playerId);if(!p?.alive)return;nav.clear();cancelCombat();}
  resting=on;restSource=on?source:null;
  const b=document.getElementById('rest-badge');if(b)b.hidden=!on;
}
function applyRestBonus(hpBefore,spBefore){
  const p=sim.simulation.world.players.get(sim.playerId);if(!resting||!p?.alive){if(resting&&!p?.alive)setResting(false);return;}
  // A monster hits us → rest breaks (Auto Hunt will fight back).
  const hitBy=[...sim.simulation.world.monsters.values()].some(m=>m.alive&&m.targetPlayerId===sim.playerId);
  if(hitBy&&restSource==='manual'){setResting(false);return;}
  if(p.hp>hpBefore)p.hp=Math.min(p.maxHp,p.hp+(p.hp-hpBefore)*2);
  if(p.sp!==undefined&&p.maxSp!==undefined&&p.sp>spBefore)p.sp=Math.min(p.maxSp,p.sp+(p.sp-spBefore)*2);
  // Engine only switches to fast "resting" regen 5 s after combat; keep that timer honest but not longer.
  if(restSource==='manual'&&p.hp>=p.maxHp&&(p.sp===undefined||p.sp>=p.maxSp))setResting(false);
}
(()=>{const b=document.createElement('div');b.id='rest-badge';b.hidden=true;b.textContent='RESTING · HP/SP ×3';b.style.cssText='position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:20;pointer-events:none;padding:4px 12px;border-radius:12px;background:rgba(30,90,50,.85);color:#c9ffd6;font:700 11px/1 Inter,system-ui,sans-serif;letter-spacing:.06em';document.body.append(b);})();
window.addEventListener('keydown',e=>{if(e.code!=='KeyZ'||e.repeat||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;e.preventDefault();if(resting){setResting(false);return;}if(autoHunt.on){autoHunt.stop();syncHuntButton();}setResting(true,'manual');});
function syncHuntButton(){
  const b=document.getElementById('autohunt-toggle');if(!b)return;
  const label=autoHunt.on?`AUTO HUNT · ${autoHunt.status}`:'AUTO HUNT · OFF';
  if(label===lastHuntLabel)return;lastHuntLabel=label;b.textContent=label;b.classList.toggle('on',autoHunt.on);
}
function setAutoHunt(on){
  if(on===autoHunt.on)return;
  if(on&&heroRef){const p=sim.simulation.world.players.get(sim.playerId);if(p&&!p.alive)return;autoHunt.start({x:heroRef.x,y:heroRef.y});nav.clear();}
  else{autoHunt.stop();nav.clear();cancelCombat();if(restSource==='auto')setResting(false);}
  syncHuntButton();
}
(()=>{
  const b=document.createElement('button');b.id='autohunt-toggle';b.type='button';b.title='Auto Hunt (T)';
  b.style.cssText='position:fixed;left:50%;bottom:118px;transform:translateX(-50%);pointer-events:auto;z-index:20;padding:6px 14px;border-radius:14px;border:1px solid rgba(233,207,122,.5);background:rgba(10,12,14,.78);color:#e9cf7a;font:700 12px/1 Inter,system-ui,sans-serif;letter-spacing:.06em;cursor:pointer';
  const st=document.createElement('style');st.textContent='#autohunt-toggle.on{background:rgba(52,120,64,.85);color:#fff;border-color:#8fe0a0}.click-ripple{position:fixed;width:26px;height:13px;margin:-7px 0 0 -13px;border:2px solid #f5e3a0;border-radius:50%;pointer-events:none;z-index:19;animation:click-ripple .55s ease-out forwards}@keyframes click-ripple{from{opacity:1;transform:scale(.4)}to{opacity:0;transform:scale(1.6)}}';
  document.head.append(st);document.body.append(b);
  b.addEventListener('click',e=>{e.stopPropagation();setAutoHunt(!autoHunt.on);});
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  syncHuntButton();
})();
window.addEventListener('keydown',e=>{if(e.code!=='KeyT'||e.repeat||e.ctrlKey||e.metaKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;setAutoHunt(!autoHunt.on);});
setRuntimeClickHandler((hit,e)=>{
  if(clickHitMonster){clickHitMonster=false;return;}
  if(!heroRef||deathUntil)return;
  autoHunt.stop();cancelCombat();syncHuntButton();if(resting)setResting(false);
  if(nav.goTo(heroRef,hit.x,hit.y)){
    const r=document.createElement('div');r.className='click-ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.append(r);setTimeout(()=>r.remove(),600);
  }
});
function cancelCombat(){combatTarget=null;lastTargetSample=null;cancelHeroAttack(playback);setRuntimePlayerControl(false);syncHud();}
window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){nav.clear();if(resting)setResting(false);if(autoHunt.on){autoHunt.stop();syncHuntButton();}cancelCombat();}});
const canvas=document.getElementById('scene');
skillFx=createSkillFx(canvas);floaters=createFloaters(canvas);
// Status overlays: frost on slowed mobs, stars on stunned ones, sparks on armor-broken ones.
skillFx.setStatusSource(()=>{const now=sim.simulation.clock.nowMs,out=[];for(const m of sim.simulation.world.monsters.values()){if(!m.alive)continue;const slow=(m.slowUntilMs??0)>now,stun=(m.stunnedUntilMs??0)>now,armorBreak=(m.armorBreakUntilMs??0)>now;if(slow||stun||armorBreak)out.push({x:m.position.x,y:m.position.y,slow,stun,armorBreak});}return out;});
// Warm FX the hero will use: equipped cores, weapon skills, basic swing, and the warp circles.
{const c=sim.character,p=sim.simulation.world.players.get(sim.playerId);skillFx.preload([...(c.skills.active||[]),c.skills.movement,...(p?.skillEntitlements?.weaponSkills||[]),BASIC_ATTACK_FX[p?.weaponFamily],'warp']);
 for(const portal of scene.portals||[])skillFx.play('warp',{from:{x:portal.x,y:portal.y}});}
canvas.addEventListener('pointerdown',e=>{
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;
  let hit=null,best=Infinity;
  for(const a of actors){if(a.dead)continue;const p=projectRuntimePoint(a.x,a.y,a.z),d=Math.hypot(x-p.x,y-p.y);if(d<72&&d<best){hit=a;best=d;}}
  if(hit){
    if(combatTarget?.id!==hit.view.id){cancelHeroAttack(playback);lastTargetSample=null;}
    if(resting)setResting(false);combatTarget=hit.view;nav.clear();clickHitMonster=true;setRuntimePlayerControl(true);e.preventDefault();
  }else{clickHitMonster=false;}
});

window.__combat={sim,playback,actors,fx:combatFX,get skillFx(){return skillFx;},showSkillCastFx,sfx:combatSFX,get floaters(){return floaters;},presentCombatEvents,rosterId,roster,mapId:gameplayMapId,routeId,get target(){return combatTarget;},requestZoneTransfer:performWarp};
const pendingSpawn=(()=>{try{const v=JSON.parse(sessionStorage.getItem('bunny-world-zone-spawn')||'null');sessionStorage.removeItem('bunny-world-zone-spawn');return v;}catch{return null;}})();
if(pendingSpawn){scene.spawn={x:pendingSpawn.x,y:pendingSpawn.y};playerView.x=pendingSpawn.x;playerView.y=pendingSpawn.y;}
persistentCharacter={...sim.character,currentMapId:gameplayMapId};saveCharacter(persistentCharacter);
await boot(scene,{canvasEl:canvas,loadingEl:document.getElementById('loading'),playerSprites:null,playerScale:1,worldScale:1.45,zoom:1});
// Terrain now exists: scatter the field over the whole map (min gap ~3 tiles) and put the boss in
// its lair, the walkable spot farthest from the arrival point.
{
  buildMainGround();
  const hero={x:playerView.x,y:playerView.y},taken=[];
  for(const view of monsterViews){
    let p;
    if(view.isBoss){
      let best=null,bestD=-1;for(let i=0;i<400;i++){const q=randomFieldPoint(null,1);if(!q)continue;const d=Math.hypot(q.x-scene.spawn.x,q.y-scene.spawn.y);if(d>bestD){best=q;bestD=d;}}
      p=best;
    }else p=randomFieldPoint(hero,80,taken,128)||randomFieldPoint(hero,80,taken,80)||randomFieldPoint(hero,80);
    if(!p)continue;taken.push(p);sim.placeMonster(view.id,p);
    const actor=actors.find(a=>a.view===view);if(actor){actor.x=p.x;actor.y=p.y;}
  }
  const boss=monsterViews.find(v=>v.isBoss);if(boss)announceBoss(boss);
}
