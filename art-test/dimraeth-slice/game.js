// Valley + BunnySimulation prototype.
// Dimraeth owns terrain/rendering. BunnySimulation owns combat/HP/monster AI.
import { boot, teardown, setRuntimeActors, setRuntimeActorUpdater, setRuntimePlayerVisual, canRuntimeActorStand, runtimeWalkHeight, projectRuntimePoint, moveRuntimePlayerToward, setRuntimePlayerControl, setRuntimeClickHandler, setRuntimeSafeZones } from './engine/runtime.js';
import { createNavigator, findPath, canWalkStraight } from './combat/nav.js';
import { createAutoHunt } from './combat/autohunt.js';
import { sceneFromMap } from './scenes/custom.js';
import valleyScene from './scenes/valley.js';
import { chooseRosterId, getRoster, monsterPresentation } from './combat/rosters.js';
import { renderMonsterIndex } from './combat/monsterIndex.js';
import { createFloaters, lootTierForChance } from './combat/floaters.js';
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
import { beginHeroAttack, cancelHeroAttack, createHeroAttackPlayback, updateHeroAttackPlayback } from '../iso-arena-draft/heroCombat.js';

const mirrorImage=img=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(img.width,0);g.scale(-1,1);g.drawImage(img,0,0);return c;};
const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Failed to load image: ${src}`));i.src=src;});
const sliceSheet=(img,count)=>{
  const frameWidth=Math.floor(img.width/count),out=[];
  for(let i=0;i<count;i++){const c=document.createElement('canvas');c.width=frameWidth;c.height=img.height;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(img,i*frameWidth,0,frameWidth,img.height,0,0,frameWidth,img.height);out.push(c);}
  return out;
};

const blessedHero=await loadBlessedHero();
const playback=createHeroAttackPlayback(blessedHero.attackDefinition('dagger','south'));
let facing='south',combatTarget=null,lastTargetSample=null,chaseStuck=0,lastKnownLevel=1;
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
let spots;
if(scene.gameplay.spawnPoints?.length>0){
  spots=scene.gameplay.spawnPoints.map((sp,i)=>([sp.x/64,sp.y/64,markerType(sp,i)]));
}else if(routeId==='valley-combat'){
  const valleyPositions=[[21.8,25.2],[18.8,27.2],[15.2,24.7],[29.2,25.4],[13.2,18.2],[9.4,12.4]];
  spots=valleyPositions.map(([tx,ty],i)=>[tx,ty,pool[i%pool.length]]);
}else{
  spots=Array.from({length:scene.gameplay.fieldPopulation},(_,i)=>{
    const angle=i*2.399963229728653,ring=4.8+(i%9)*1.35;
    const tx=scene.spawn.x/64+Math.cos(angle)*ring,ty=scene.spawn.y/64+Math.sin(angle)*ring;
    return[tx,ty,pool[i%pool.length]];
  });
  const safeR=(scene.gameplay.minHeroDistance??192)/64+1.5;
  for(const sp of spots){const dx=sp[0]-scene.spawn.x/64,dy=sp[1]-scene.spawn.y/64,d=Math.hypot(dx,dy);if(d<safeR){const k=safeR/Math.max(d,.01);sp[0]=scene.spawn.x/64+dx*k;sp[1]=scene.spawn.y/64+dy*k;}}
}

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
const monsterViews=spots.map(([tx,ty,monsterType],i)=>{
  const p=presentations.get(monsterType);
  return{id:`${gameplayMapId}-m${i}`,monsterType,x:tx*64,y:ty*64,hp:1,maxHp:1,dead:false,elite:!!p?.elite,isBoss:!!p?.isBoss};
});
const playerView={x:scene.spawn.x,y:scene.spawn.y};
const sim=new ArenaV2Adapter({zoneId:gameplayMapId,player:playerView,monsters:monsterViews,character:persistentCharacter,walkableContains:({x,y})=>{const z=runtimeWalkHeight(x,y);return z!==null&&canRuntimeActorStand(x,y,z);},safeZoneContains:p=>inSafeZone(p),monsterForbiddenContains:p=>inSafeZone(p,20),onReward:(reward,character,defeated)=>{persistentCharacter={...character,currentMapId:gameplayMapId};saveCharacter(persistentCharacter);combatSFX.playPickup();presentReward(reward,defeated);}});
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

  if(combatTarget){player.target=null;
  if(!playback.active){
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
            if(damageEvent){const actor=actors.find(a=>a.view.id===target.id);combatSFX.playHit({critical:damageEvent.critical});combatFX.playHitSpark(target.x,target.y,{visualScale:actor?.visualScale??1});}
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
  floaters?.update(dt);floaters?.draw();
  syncHud();syncDeathOverlay();
});

let deathUntil=0;
function pushRewardLine(text){const feed=document.getElementById('reward-feed');if(!feed)return;const line=document.createElement('div');line.textContent=text;feed.prepend(line);setTimeout(()=>line.remove(),5000);while(feed.children.length>6)feed.lastElementChild?.remove();}
function appendWorldChat(text,{system=false}={}){const log=document.getElementById('chat-log');if(!log)return;const line=document.createElement('p');line.textContent=text;if(system)line.className='system';log.appendChild(line);while(log.children.length>40)log.firstElementChild?.remove();log.scrollTop=log.scrollHeight;}
// Loot and reward feed, as in the arena prototype: sparkles coloured by drop rarity + reward lines.
let floaters=null;
function lootChance(loot,id){if(!loot)return 1;if(id===loot.oreItemId)return UNIVERSAL_ORE_CHANCE;if(id==='astraliteStone')return UNIVERSAL_ASTRALITE_CHANCE;for(const r of [loot.material,loot.aetherstone,loot.modifier,loot.core,loot.blueprint,...(loot.equipmentDrops??[])])if(r?.itemId===id)return r.chance;return 1;}
function presentReward(reward,defeated){
  const items=Object.entries(reward.loot?.items??{}).filter(([,q])=>q>0),loot=MONSTERS_V2[defeated?.monsterType]?.loot;
  if(defeated&&items.length)floaters?.loot(defeated.x,defeated.y,items.map(([id,q])=>({label:`${prettyItem(id)}${q>1?' ×'+q:''}`,tier:lootTierForChance(lootChance(loot,id))})));
  for(const [id,q] of items)pushRewardLine(`ได้รับ ${prettyItem(id)} ${q} ea`);
  if(reward.exp>0)pushRewardLine(`ได้รับ ${reward.exp} EXP`);
  if(reward.loot?.gold>0)pushRewardLine(`ได้รับ ${reward.loot.gold} Gold`);
}
function presentDamageText(event){
  if(!floaters)return;
  if(event.type==='healed'&&event.targetId===sim.playerId){const p=sim.simulation.world.players.get(sim.playerId)?.position;if(p)floaters.text(p.x,p.y,`+${event.amount}`,{color:'#70f59a',dx:30});return;}
  if(event.type!=='damageDealt')return;
  if(event.targetId===sim.playerId){const p=sim.simulation.world.players.get(sim.playerId)?.position;if(p)floaters.text(p.x,p.y,`-${event.amount}`,{color:'#ff6b5e',size:event.critical?17:14});return;}
  if(event.sourceId!==sim.playerId)return;
  const v=monsterViews.find(m=>m.id===event.targetId);if(!v)return;
  const origin=event.effect?.origin,ability=event.effect?.ability,proc=origin==='MASTERY_PROC';
  const label=proc?(ability==='multiShot'?'ADDITIONAL HIT!':ability==='cleave'?'CLEAVE!':'DOUBLE ATTACK!'):'';
  const text=event.critical?`${label||'CRITICAL!'} ★  ${event.amount}`:label?`${label}  ${event.amount}`:`${event.amount}`;
  floaters.text(v.x,v.y,text,{color:event.critical?'#ffe36f':ability==='multiShot'?'#a98cff':proc?'#9fe8ff':'#ffffff',size:event.critical?19:proc?16:15,lift:proc?46:event.critical?38:26});
}
function presentCombatEvents(events){for(const event of events||[]){presentDamageText(event);if(event.type==='attackStarted'&&event.sourceId!==sim.playerId){const actor=actors.find(a=>a.view.id===event.sourceId),target=event.targetId===sim.playerId?sim.simulation.world.players.get(sim.playerId)?.position:null;if(actor&&target)beginMonsterAttack(actor,target);}if(event.type==='damageDealt'&&event.targetId===sim.playerId&&event.amount>0)blessedHero.hurt();if(event.type==='entityDefeated'&&event.entityId===sim.playerId){blessedHero.die();deathUntil=performance.now()+10000;const o=document.getElementById('death-overlay');if(o)o.hidden=false;combatSFX.playDeath();cancelCombat();}if(event.type==='entityRespawned'&&event.entityId===sim.playerId){blessedHero.respawn();deathUntil=0;const o=document.getElementById('death-overlay');if(o)o.hidden=true;}if(event.type==='entityDefeated'&&event.entityId!==sim.playerId){combatSFX.playDeath({volume:0.5});const target=monsterViews.find(v=>v.id===event.entityId),actor=actors.find(a=>a.view.id===event.entityId);if(target){const fxOptions={visualScale:actor?.visualScale??1};target.isBoss?combatFX.playBossDeath(target.x,target.y,fxOptions):combatFX.playNormalDeath(target.x,target.y,fxOptions);}pushRewardLine('Monster defeated');}}}
function syncDeathOverlay(){const o=document.getElementById('death-overlay'),v=document.getElementById('death-seconds'),ring=document.querySelector('.death-countdown .progress');if(!o||!v)return;if(!deathUntil){o.hidden=true;return;}const remain=Math.max(0,deathUntil-performance.now()),left=Math.ceil(remain/1000);v.textContent=String(left);if(ring)ring.style.strokeDashoffset=String(264*(1-remain/10000));if(remain<=0){deathUntil=0;o.hidden=true;}}
function bindChat(){const input=document.getElementById('chat-input');if(!input)return;window.addEventListener('keydown',e=>{if(e.code!=='Enter')return;if(document.activeElement===input){e.preventDefault();e.stopImmediatePropagation();const msg=input.value.trim();if(msg){appendWorldChat(`Bunny: ${msg}`);input.value='';}input.blur();return;}if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;e.preventDefault();e.stopImmediatePropagation();input.focus();},true);}
bindChat();

// HUD gauge for the Lv30 weapon skill; hidden until it is unlocked.
const weaponGauge=document.createElement('div');weaponGauge.id='weapon-gauge';weaponGauge.hidden=true;
weaponGauge.style.cssText='position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:40;width:180px;height:8px;border-radius:4px;background:rgba(10,14,18,.8);border:1px solid #d9bd72;overflow:hidden;pointer-events:none';
weaponGauge.innerHTML='<i style="display:block;height:100%;width:0;background:linear-gradient(90deg,#d9a441,#ffe08a)"></i>';document.body.appendChild(weaponGauge);
function syncWeaponGauge(p){const ult=p?.skillEntitlements?.weaponSkills?.[2];weaponGauge.hidden=!ult;if(!ult)return;const g=p.weaponProc?.gauge??0;weaponGauge.title=`${SKILLS_V2[ult]?.name||ult}: ${g}/${WEAPON_PROC_RULES_V2.gaugeHits}`;weaponGauge.firstChild.style.width=`${100*g/WEAPON_PROC_RULES_V2.gaugeHits}%`;}
function syncHud(){
  const ui=document.getElementById('game-ui');if(ui)ui.hidden=false;
  const p=sim.simulation.world.players.get(sim.playerId),c=sim.character;
  const set=(sel,v)=>{const el=document.querySelector(sel);if(el)el.textContent=v;};
  const width=(sel,v)=>{const el=document.querySelector(sel);if(el)el.style.width=`${Math.max(0,Math.min(100,v))}%`;};
  syncWeaponGauge(p);
  set('#hero-name',(c.name||'Bunny').toUpperCase());set('#hero-level',`Lv. ${c.level}`);
  if(c.level>lastKnownLevel){combatSFX.playLevelUp();lastKnownLevel=c.level;}
  width('.player-hud .bar.hp i',p?.maxHp?(p.hp/p.maxHp)*100:0);width('.player-hud .bar.sp i',p?.maxSp?((p.sp??0)/p.maxSp)*100:0);
  width('.player-hud .bar.exp i',(c.exp/Math.max(1,expToNextLevelV2(c.level)))*100);
  const target=document.getElementById('target-hud');
  if(target){target.hidden=!combatTarget||combatTarget.dead;if(combatTarget&&!combatTarget.dead){const a=actors.find(x=>x.view.id===combatTarget.id);set('#target-name',a?.name||'MONSTER');set('#target-hp',`${Math.ceil(combatTarget.hp)} / ${Math.ceil(combatTarget.maxHp)}`);width('#target-hud .bar.hp i',combatTarget.maxHp?combatTarget.hp/combatTarget.maxHp*100:0);}}
}
const CRAFT_UI_RECIPES=Object.values(EQUIPMENT_MASTER_V2).map(item=>({id:item.id,name:item.name,tier:item.tier,slot:item.slot,type:item.slot==='main'?'Weapon':item.slot==='offhand'?'Offhand':(item.slot==='accessoryLeft'||item.slot==='accessoryRight')?'Accessory':item.slot[0].toUpperCase()+item.slot.slice(1),blueprintId:item.recipe.blueprintId,oreId:item.recipe.oreId,oreQty:item.recipe.oreQty,materials:item.recipe.materials,gold:item.recipe.gold,baseGoldCost:item.baseGoldCost,baseCombat:item.baseCombat,offhandType:item.offhandType,setId:item.setId,requiredLevel:item.requiredLevel,available:item.recipe.available,role:item.role}));
const CRAFT_SET_BY_ID=new Map(SET_DEFINITIONS_V2.map(set=>[set.id,set]));
const CRAFT_RARITIES=[['Normal','50%'],['Good','27%'],['Rare','15%'],['Epic','6%'],['Legend','1.7%'],['Mythic','0.28%'],['White Ascended','0.02%']];
const craftUi={type:'Weapon',tier:'All',selected:'mosswoodSword',batch:1};
const prettyItem=id=>String(id||'').replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());
function craftStatLines(stats={}){const labels={atk:'ATK',matk:'MATK',def:'DEF',mdef:'MDEF',maxHp:'HP',crit:'CRIT',aspd:'ASPD',hit:'HIT',flee:'FLEE'};return Object.entries(stats).filter(([,v])=>Number(v)!==0).map(([k,v])=>`<div><span>${labels[k]||k}</span><b>+${v}</b></div>`).join('')||'<div><span>Base Stats</span><b>—</b></div>';}
function equippedSetCount(setId,c){return Object.values(c.equipment.equippedBySlot).filter(Boolean).map(id=>c.equipment.instances[id]).filter(item=>item?.setId===setId).length;}
function craftSetDetail(recipe,c){if(!recipe.setId)return '<div class="craft-no-set">No Set Bonus</div>';const set=CRAFT_SET_BY_ID.get(recipe.setId);if(!set)return '';const count=Math.min(set.requiredPieces,equippedSetCount(recipe.setId,c)),active=count>=set.requiredPieces;return `<div class="craft-set-box ${active?'set-active':'set-inactive'}"><div class="craft-set-head"><div><strong>${recipe.name.split(' ')[0]} Set</strong><small>${set.group==='body'?'BODY SET':'ACCESSORY SET'} · ${set.role.toUpperCase()}</small></div><b>${count}/${set.requiredPieces}</b></div>${set.effect.map(effect=>`<p>◆ ${effect}</p>`).join('')}</div>`;}
function showUiError(message){let t=document.querySelector('.equipment-result-toast');if(!t){t=document.createElement('div');t.className='equipment-result-toast';document.body.append(t);}t.className='equipment-result-toast error show';t.textContent=message;clearTimeout(showUiError.timer);showUiError.timer=setTimeout(()=>t.classList.remove('show'),1800);}
function renderCraftWindow(){
 const body=document.getElementById('game-window-body'),c=sim.character,types=['Weapon','Offhand','Armor','Cape','Shoes','Accessory'];if(!body)return;
 let list=CRAFT_UI_RECIPES.filter(r=>r.type===craftUi.type&&(craftUi.tier==='All'||r.tier===Number(craftUi.tier)));if(!list.length)list=CRAFT_UI_RECIPES.filter(r=>craftUi.tier==='All'||r.tier===Number(craftUi.tier));const selected=list.find(r=>r.id===craftUi.selected)||list[0];
 body.innerHTML=`<div class="craft-topbar"><div class="craft-tabs">${types.map(t=>`<button data-craft-type="${t}" class="${craftUi.type===t?'active':''}">${t}</button>`).join('')}</div><label>Tier <select id="craft-tier"><option value="All">All T</option>${[1,2,3,4,5].map(t=>`<option value="${t}" ${String(craftUi.tier)===String(t)?'selected':''}>T${t}</option>`).join('')}</select></label></div><div class="craft-three"><section class="craft-card craft-list"><header>CRAFTING LIST</header>${list.map(r=>`<button data-craft-recipe="${r.id}" class="${selected?.id===r.id?'active':''}"><span class="craft-icon">${iconHtml(r.id,'equipment','◆')}</span><span><strong>${r.name}</strong><small>T${r.tier} · ${r.type}</small></span></button>`).join('')}</section><section class="craft-card craft-detail"><header>ITEM DETAIL</header>${selected?`<div class="craft-preview">${iconHtml(selected.id,'equipment','◆')}</div><div class="craft-detail-title"><h2>${selected.name}</h2><span class="tier-chip">T${selected.tier} · ${selected.type}</span></div><div class="craft-tags"><span>Lv ${selected.requiredLevel}+</span><span>${selected.role.toUpperCase()}</span></div><div class="craft-stat-box"><h3>BASE STATS</h3>${craftStatLines(selected.baseCombat)}</div>${craftSetDetail(selected,c)}<div class="craft-meta"><span>Slot</span><b>${selected.slot.toUpperCase()}</b><span>Required Level</span><b>${selected.requiredLevel}</b><span>Base value</span><b>${selected.baseGoldCost} G</b></div>`:''}</section><section class="craft-card craft-cost"><header>MATERIALS & RARITY</header>${selected?`<div class="craft-materials">${[[selected.blueprintId,1],[selected.oreId,selected.oreQty],...selected.materials.map(m=>[m.itemId,m.qty])].map(([id,q])=>`<div><span class="craft-mat-name">${iconHtml(id,'item','')}${prettyItem(id)}</span><b class="${(c.inventory[id]??0)>=q?'enough':'missing'}">${c.inventory[id]??0} / ${q}</b></div>`).join('')}<div class="gold-cost"><span>Gold</span><b>${c.gold.toLocaleString()} / ${selected.gold.toLocaleString()}</b></div></div><h3>RARITY CHANCE</h3><div class="rarity-chances">${CRAFT_RARITIES.map(([n,p])=>`<span class="rarity-mini rarity-${n.toLowerCase().replace(' ','-')}"><i>${n}</i><b>${p}</b></span>`).join('')}</div><div class="craft-batch-picker"><span>CRAFT QTY</span>${[1,10,20,50].map(q=>`<button data-craft-qty="${q}" class="${craftUi.batch===q?'active':''}">×${q}</button>`).join('')}</div><button class="craft-button" data-craft-now="${selected.id}" ${selected.available?'':'disabled'}>${selected.available?(craftUi.batch===1?'CRAFT':`BATCH CRAFT ×${craftUi.batch}`):'PLANNED'}</button>`:''}</section></div>`;
 body.querySelectorAll('[data-craft-type]').forEach(b=>b.onclick=()=>{craftUi.type=b.dataset.craftType;craftUi.selected='';renderCraftWindow();});body.querySelector('#craft-tier')?.addEventListener('change',e=>{craftUi.tier=e.target.value;craftUi.selected='';renderCraftWindow();});body.querySelectorAll('[data-craft-recipe]').forEach(b=>b.onclick=()=>{craftUi.selected=b.dataset.craftRecipe;renderCraftWindow();});body.querySelectorAll('[data-craft-qty]').forEach(b=>b.onclick=()=>{craftUi.batch=Number(b.dataset.craftQty);renderCraftWindow();});
 body.querySelector('[data-craft-now]')?.addEventListener('click',()=>{const r=CRAFT_UI_RECIPES.find(x=>x.id===selected?.id);if(!r)return;const qty=craftUi.batch||1,recipe={templateId:r.id,slot:r.slot,blueprintId:r.blueprintId,oreId:r.oreId,oreQty:r.oreQty,materials:r.materials,gold:r.gold,baseGoldCost:r.baseGoldCost,baseCombat:r.baseCombat,offhandType:r.offhandType,setId:r.setId,requiredLevel:r.requiredLevel,available:r.available};try{const need=[[r.blueprintId,1],[r.oreId,r.oreQty],...r.materials.map(m=>[m.itemId,m.qty])];if(need.find(([id,n])=>(c.inventory[id]??0)<n*qty)||c.gold<r.gold*qty){showUiError(`Materials/Gold insufficient for ×${qty}`);return;}const made=[];for(let i=0;i<qty;i++){const res=sim.equipmentCommand({type:'craft',recipe});const item=sim.character.equipment.instances[res.createdEquipmentId];if(item)made.push(item);}saveCharacter(sim.character);renderCraftWindow();if(made.length===1)showCraftSuccess(made[0]);else if(made.length)showBatchCraftResults(made,r.name);}catch(error){showUiError(String(error?.message||error));}});
}

const masteryUi={selected:null,milestone:null};
const MASTERY_NAMES={greatsword:'Greatsword',dagger:'Dagger',axe:'Axe',hammer:'Hammer',bow:'Bow',staff:'Staff',swordShield:'Sword + Shield'};
const MASTERY_GLYPHS={greatsword:'⚔',dagger:'†',axe:'🪓',hammer:'🔨',bow:'🏹',staff:'✦',swordShield:'🛡'};
const MASTERY_MILESTONE_NAMES={cleave:'Cleave',cleaveII:'Cleave II',wideCleave:'Wide Cleave',cleaveIII:'Cleave III',perfectCleave:'Perfect Cleave',doubleAttack:'Double Attack',doubleAttackII:'Double Attack II',precisionFollowup:'Precision Follow-up',criticalFollowup:'Critical Follow-up',doubleAttackIII:'Double Attack III',heavyBlow:'Heavy Blow',heavyBlowII:'Heavy Blow II',armorBreak:'Armor Break',heavyBlowIII:'Heavy Blow III',crushingArmorBreak:'Crushing Armor Break',crushingImpact:'Crushing Impact',crushingImpactII:'Crushing Impact II',concussion:'Concussion',crushingImpactIII:'Crushing Impact III',shockwave:'Shockwave',multiShot:'Multi Shot',multiShotII:'Multi Shot II',eagleEye:'Eagle Eye',piercingArrow:'Piercing Arrow',multiShotIII:'Multi Shot III',concentration:'Concentration',mobileCasting:'Mobile Casting',flowCasting:'Flow Casting',coreEcho:'Core Echo',perfectCasting:'Perfect Casting',guard:'Guard',firmGuard:'Firm Guard',counterGuard:'Counter Guard',perfectGuard:'Perfect Guard',aegisMastery:'Aegis Mastery'};
const skillsHubUi={tab:'skills'};
function skillLabel(id){return id?String(id).replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase()):'Empty'}
function coreRarity(id){return id?(sim.character.skills.coreRarity?.[id]??'normal'):'normal'}
function coreRarityIndex(id){return ['normal','good','rare','epic','legend','mythic','whiteAscended'].indexOf(coreRarity(id))}
function coreDamageBonus(id){return Math.max(0,coreRarityIndex(id))*10}
function skillDetailHtml(id){const s=SKILLS_V2[id];if(!s)return '<p>Skill data unavailable.</p>';const scaling=s.scaling==='physicalAttack'?'Physical ATK':s.scaling==='magicalAttack'?'Magical ATK':null,total=s.coefficient?Math.round(s.coefficient*100)+'% '+scaling:null,target={selfArea:'AoE around caster',targetArea:'AoE around target',groundArea:'Ground-targeted AoE',target:'Single target'}[s.targeting]||'Utility';return `<div class="skill-detail-block"><div class="skill-detail-title"><strong>${s.name}</strong><span>SKILL CORE · ${s.kind.toUpperCase()}</span></div><p>${target}${s.element?' · '+s.element.toUpperCase():''}</p><div class="skill-detail-stats">${s.radius?`<span>AoE Radius <b>${s.radius}</b></span>`:''}${s.range?`<span>Range <b>${s.range}</b></span>`:''}${s.hitCount?`<span>Hits <b>${s.hitCount}</b></span>`:''}${total?`<span>Damage <b>${total}</b></span>`:''}${s.cooldownMs?`<span>Cooldown <b>${s.cooldownMs/1000}s</b></span>`:''}</div></div>`;}
// Weapon skills are not pressed; each slot has its own basic-attack trigger (engine WEAPON_PROC_RULES_V2).
const WEAPON_SKILL_TRIGGERS=[
  {level:10,text:()=>`${Math.round(WEAPON_PROC_RULES_V2.chance*100)}% chance on each basic attack`},
  {level:20,text:()=>`Every ${WEAPON_PROC_RULES_V2.everyNthHit}th basic attack`},
  {level:30,text:()=>`When the gauge fills (${WEAPON_PROC_RULES_V2.gaugeHits} basic attacks)`},
];
function weaponSkillsHtml(family,level){const ids=WEAPON_SKILLS_BY_FAMILY_V2[family]||[];return `<div class="mastery-panel-head" style="margin-top:12px"><strong>WEAPON SKILLS</strong><span>TRIGGER ON ATTACK</span></div>${ids.map((id,i)=>{const t=WEAPON_SKILL_TRIGGERS[i],on=level>=t.level,s=SKILLS_V2[id];return `<div class="mastery-detail-card ${on?'unlocked':'locked'}"><strong>${iconHtml(id,'skill','✦')} ${s?.name||id}</strong><span>${on?'UNLOCKED':'LOCKED · LV '+t.level}</span><p>${t.text()}.</p></div>`}).join('')}`;}
function renderWeaponMastery(target){const c=sim.character,families=Object.keys(MASTERY_NAMES);if(!masteryUi.selected||!c.weaponMastery[masteryUi.selected])masteryUi.selected=families[0];const selected=masteryUi.selected,m=c.weaponMastery[selected]||{level:1,xp:0},milestones=WEAPON_MASTERY_MILESTONES[selected]||[];if(!masteryUi.milestone||!milestones.some(x=>x.id===masteryUi.milestone))masteryUi.milestone=(milestones.filter(x=>m.level>=x.level).at(-1)||milestones[0])?.id;const detail=milestones.find(x=>x.id===masteryUi.milestone)||milestones[0],unlocked=detail&&m.level>=detail.level;target.innerHTML=`<div class="mastery-layout"><section class="mastery-panel"><div class="mastery-panel-head"><strong>WEAPON MASTERY</strong><span>LV PROGRESS</span></div><div class="mastery-progress-list">${families.map(f=>{const x=c.weaponMastery[f]||{level:1,xp:0},max=x.level>=50?0:masteryXpRequired(x.level),pct=x.level>=50?100:Math.min(100,max?x.xp/max*100:0);return `<button class="mastery-progress-card ${f===selected?'active':''}" data-mastery-family="${f}"><span class="mastery-family-glyph">${iconHtml(f,'family',MASTERY_GLYPHS[f])}</span><span class="mastery-family-info"><b>${MASTERY_NAMES[f]}</b><small>Lv ${x.level}</small><i><em style="width:${pct}%"></em></i><small class="mastery-xp">${x.level>=50?'MAX':Math.floor(x.xp)+' / '+max+' XP'}</small></span></button>`}).join('')}</div></section><section class="mastery-panel mastery-milestone-panel"><div class="mastery-panel-head"><strong>${MASTERY_NAMES[selected]}</strong><span>MILESTONES</span></div><div class="mastery-milestone-grid">${milestones.map(x=>`<button class="mastery-milestone ${m.level>=x.level?'unlocked':'locked'} ${x.id===masteryUi.milestone?'selected':''}" data-milestone="${x.id}"><span class="mastery-level-tag">Lv ${x.level}</span><span class="mastery-milestone-glyph">${iconHtml(selected+'_'+x.id,'mastery',MASTERY_GLYPHS[selected])}</span></button>`).join('')}</div>${detail?`<div class="mastery-detail-card ${unlocked?'unlocked':'locked'}"><strong>${MASTERY_MILESTONE_NAMES[detail.id]||detail.id}</strong><span>${unlocked?'UNLOCKED':'LOCKED · LV '+detail.level}</span><p>${detail.description}</p></div>`:''}${weaponSkillsHtml(selected,m.level)}</section></div>`;target.querySelectorAll('[data-mastery-family]').forEach(b=>b.onclick=()=>{masteryUi.selected=b.dataset.masteryFamily;masteryUi.milestone=null;renderSkillsHub();});target.querySelectorAll('[data-milestone]').forEach(b=>b.onclick=()=>{masteryUi.milestone=b.dataset.milestone;renderSkillsHub();});}
function closeDetailModal(){const modal=document.getElementById('equipment-detail-modal');if(!modal)return;modal.hidden=true;modal.replaceChildren();}
function bindDetailModalClose(modal){const close=modal.querySelector('.rpg-modal-close');if(close)close.onclick=e=>{e.preventDefault();e.stopPropagation();closeDetailModal();};modal.onclick=e=>{if(e.target===modal)closeDetailModal();};}

function showSkillCorePicker(slot){const c=sim.character,modal=document.getElementById('equipment-detail-modal'),equipped=new Set(c.skills.active.filter(Boolean)),owned=Object.entries(c.inventory).filter(([id,q])=>q>0&&inventoryItemMeta(id).tags.includes('skill-core')&&SKILLS_V2[id]?.kind!=='movement'&&!equipped.has(id));modal.innerHTML=`<button class="rpg-modal-close">×</button><div class="equipment-detail-card"><div class="skill-picker-head"><strong>INSTALL SKILL CORE ${slot+1}</strong></div><div class="skill-picker-list">${owned.length?owned.map(([id,q])=>`<button data-pick-core="${id}"><b>${iconHtml(id,'skill','')}${SKILLS_V2[id]?.name||skillLabel(id)}</b><small>OWNED ×${q}</small>${skillDetailHtml(id)}</button>`).join(''):'<p>No Skill Core available.</p>'}</div></div>`;modal.hidden=false;bindDetailModalClose(modal);modal.querySelectorAll('[data-pick-core]').forEach(b=>b.onclick=()=>{sim.skillCoreCommand({type:'equipCore',coreId:b.dataset.pickCore,slot});modal.hidden=true;renderSkillsHub();syncHotbar();});}
function showSkillModPicker(coreId,modSlot){const c=sim.character,modal=document.getElementById('equipment-detail-modal'),owned=Object.entries(c.inventory).filter(([id,q])=>q>0&&inventoryItemMeta(id).tags.includes('skill-modifier'));modal.innerHTML=`<button class="rpg-modal-close">×</button><div class="equipment-detail-card"><div class="skill-picker-head"><strong>INSTALL SKILL MOD ${modSlot+1}</strong></div><div class="skill-picker-list">${owned.map(([id,q])=>`<button data-pick-mod="${id}"><b>${iconHtml(id,'item','')}${SKILL_MODIFIERS_V2[id]?.name||skillLabel(id)}</b><small>×${q}</small><p>${SKILL_MODIFIERS_V2[id]?.description||''}</p></button>`).join('')||'<p>No Skill Mod owned.</p>'}</div></div>`;modal.hidden=false;bindDetailModalClose(modal);modal.querySelectorAll('[data-pick-mod]').forEach(b=>b.onclick=()=>{sim.skillCoreCommand({type:'equipModifier',coreId,modifierId:b.dataset.pickMod,modSlot});modal.hidden=true;renderSkillsHub();});}
function showSkillCoreUpgrade(coreId){const modal=document.getElementById('equipment-detail-modal'),quote=skillCoreUpgradeQuote(sim.character,coreId),rarity=coreRarity(coreId);modal.innerHTML=`<button class="rpg-modal-close">×</button><div class="equipment-detail-card skill-core-upgrade core-rarity-${rarity}"><div class="craft-success-heading">UPGRADE CORE</div><div class="skill-core-upgrade-icon">${iconHtml(coreId,'skill','✦')}</div><h2>${skillLabel(coreId)}</h2><div>${rarity.replace('whiteAscended','White Ascended').toUpperCase()} · DMG +${coreDamageBonus(coreId)}%</div>${quote?`<p><b>${quote.current.toUpperCase()} → ${quote.next.toUpperCase()}</b></p><button class="craft-button" data-upgrade-core>UPGRADE · ${quote.gold} G</button>`:'<p>MAX RARITY</p>'}</div>`;modal.hidden=false;bindDetailModalClose(modal);modal.querySelector('[data-upgrade-core]')?.addEventListener('click',()=>{try{sim.skillCoreCommand({type:'upgradeCore',coreId});showSkillCoreUpgrade(coreId);renderSkillsHub();syncHotbar();}catch(e){showUiError(String(e?.message||e));}});}
function renderSkillsWindow(target){const s=sim.character.skills;target.innerHTML=`<div class="skill-core-shell"><div class="skill-core-head"><strong>SKILL CORE LOADOUT</strong><span>3 CORE · 2 MOD EACH</span></div><div class="skill-core-list">${[0,1,2].map(i=>{const core=s.active[i],mods=core?(s.modifiersByActive[core]||[]).slice(0,2):[];return `<section class="skill-core-card"><button class="skill-core-main ${!core?'empty':'core-rarity-'+coreRarity(core)}" data-core-slot="${i}"><div class="skill-core-icon">${core?iconHtml(core,'skill','✦'):'＋'}</div><div><small>CORE ${i+1}</small><strong>${skillLabel(core)}</strong>${core?`<em>DMG +${coreDamageBonus(core)}%</em>`:''}</div></button><div class="skill-core-arrow">➜</div><div class="skill-mods">${[0,1].map(j=>`<button class="skill-mod ${!mods[j]?'empty':''}" data-mod-slot="${j}" data-mod-core="${core||''}" ${!core?'disabled':''}><span>${iconHtml(mods[j],'item','◆')}</span><div><small>MOD ${j+1}</small><b>${skillLabel(mods[j])}</b></div></button>`).join('')}</div>${core?`<div class="skill-core-inline-detail">${skillDetailHtml(core)}</div>`:''}</section>`}).join('')}</div><div class="movement-slot-wrap"><small>MOVEMENT</small><div class="movement-skill-tile ${!s.movement?'empty':''}"><span>${s.movement?iconHtml(s.movement,'skill','➤'):'＋'}</span><b>${skillLabel(s.movement)}</b></div></div></div>`;target.querySelectorAll('[data-core-slot]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.coreSlot),core=sim.character.skills.active[i];core?showSkillCoreUpgrade(core):showSkillCorePicker(i);});target.querySelectorAll('[data-mod-slot]').forEach(b=>b.onclick=()=>b.dataset.modCore&&showSkillModPicker(b.dataset.modCore,Number(b.dataset.modSlot)));}
function renderSkillsHub(){const title=document.getElementById('game-window-title'),body=document.getElementById('game-window-body');title.textContent='Skills & Mastery';body.innerHTML=`<div class="skills-hub-tabs"><button data-skills-tab="skills" class="${skillsHubUi.tab==='skills'?'active':''}">SKILL CORE</button><button data-skills-tab="mastery" class="${skillsHubUi.tab==='mastery'?'active':''}">WEAPON MASTERY</button></div><div id="skills-hub-content"></div>`;const host=body.querySelector('#skills-hub-content');skillsHubUi.tab==='mastery'?renderWeaponMastery(host):renderSkillsWindow(host);body.querySelectorAll('[data-skills-tab]').forEach(b=>b.onclick=()=>{skillsHubUi.tab=b.dataset.skillsTab;renderSkillsHub();});}
function syncHotbar(){const skills=sim.character.skills.active;document.querySelectorAll('[data-hotbar-slot]').forEach((b,i)=>{const id=skills[i];b.dataset.skillId=id||'';const span=b.querySelector('span');if(span)span.textContent=skillLabel(id);b.title=id?(SKILLS_V2[id]?.name||skillLabel(id)):'Empty';});const move=document.querySelector('[data-hotbar-movement]');if(move){move.dataset.skillId=sim.character.skills.movement||'';const span=move.querySelector('span');if(span)span.textContent=skillLabel(sim.character.skills.movement);}}

const equipmentUi={tab:'Gear',selectedId:null,tier:'all',slot:'all'};
const batchDestroyUi={active:false,selected:new Set()};
const GEAR_SLOT_FILTERS=[['all','All Parts'],['main','Main'],['offhand','Offhand'],['armor','Armor'],['cape','Cape'],['shoes','Shoes'],['accessory','Accessory'],['hat','Hat'],['face','Face'],['mouth','Mouth']];
const ITEM_INFO={livingMoss:'Crafting material from Mossblobs.',brutalSpore:'Crafting material from Sporekin.',copperOre:'Early crafting ore.',ironOre:'Forest crafting ore.',moonstoneShard:'Desert crafting ore.',silverOre:'Advanced desert crafting ore.',mithrilOre:'Mine crafting ore.',verdantAetherstone:'Enhancement stone up to +40.',azureAetherstone:'Enhancement stone for +41–80.',violetAetherstone:'Enhancement stone for +81–120.',astraliteStone:'Refinement material.'};
function gearMatchesFilter(item){const template=EQUIPMENT_MASTER_V2[item.templateId],tier=template?.tier;if(equipmentUi.tier!=='all'&&tier!==Number(equipmentUi.tier))return false;const s=equipmentUi.slot;if(s==='all')return true;if(s==='accessory')return item.slot==='accessoryLeft'||item.slot==='accessoryRight';return item.slot===s;}
function gearGlyph(slot){return {armor:'◈',cape:'⌁',shoes:'⌑',accessoryLeft:'◇',accessoryRight:'◇',hat:'♢',face:'◉',mouth:'◆',main:'†',offhand:'◐'}[slot]||'◆';}
function inventoryCategory(id){return inventoryCategoryFor(id)}
function itemInfo(id){const skill=SKILLS_V2[id],meta=inventoryItemMeta(id);if(skill&&meta.tags.includes('skill-core'))return `Skill Core: ${skill.name}.`;return ITEM_INFO[id]||(meta.category==='Blueprint'?'Equipment blueprint used for crafting.':meta.category==='Crafting Mat'?'Crafting material.':meta.category==='Upgrading Mat'?'Upgrade material.':'Adventure item.');}

function renderSettings(body){body.innerHTML='<div class="settings-panel"><h3>ACCOUNT</h3><p class="window-note">Reset Account permanently deletes this browser\'s Bunny World character, then starts a new game.</p><button class="danger-button" type="button" data-reset-account>RESET ACCOUNT</button></div>';body.querySelector('[data-reset-account]').onclick=()=>{if(!confirm('Reset your Bunny World account? All character progress, inventory, equipment and skills on this browser will be permanently deleted.'))return;if(!confirm('Are you sure? This cannot be undone.'))return;try{localStorage.removeItem(SAVE_KEY);}catch{}location.reload();};}
// GM event multipliers (dev-only button). Applies to rewards through ArenaV2Adapter.setGmEventMultipliers.
const gmEvent={enabled:false,exp:2,weaponExp:2,drop:2,gold:2,upgradeItem:2,blueprint:2};
function applyGmEvent(){const on=gmEvent.enabled;sim.setGmEventMultipliers({exp:on?gmEvent.exp:1,weaponExp:on?gmEvent.weaponExp:1,drop:on?gmEvent.drop:1,gold:on?gmEvent.gold:1,upgradeItem:on?gmEvent.upgradeItem:1,blueprint:on?gmEvent.blueprint:1});}
function renderGmEventPanel(title,body){title.textContent='GM EVENT CONTROL';const rows=[['exp','CHAR EXP'],['weaponExp','WEAPON EXP'],['drop','DROP'],['gold','GOLD'],['upgradeItem','UPGRADE ITEM'],['blueprint','BLUEPRINT']];body.innerHTML=`<div class="gm-panel"><div class="gm-master"><div><strong>EVENT MODE</strong><small>${gmEvent.enabled?'LIVE':'OFF'}</small></div><label class="gm-switch"><input id="gm-master" data-gm-master type="checkbox" ${gmEvent.enabled?'checked':''}><span></span></label></div><p class="window-note">Set each reward multiplier independently from ×2 to ×10.</p><div class="gm-toggle-list">${rows.map(([k,l])=>`<label><span>${l}</span><div class="gm-multiplier-control"><button type="button" data-gm-minus="${k}">−</button><strong>×${gmEvent[k]}</strong><button type="button" data-gm-plus="${k}">+</button></div></label>`).join('')}</div></div>`;const again=()=>{applyGmEvent();renderGmEventPanel(title,body);};body.querySelector('[data-gm-master]').onchange=e=>{gmEvent.enabled=e.target.checked;again();};body.querySelectorAll('[data-gm-minus]').forEach(b=>b.onclick=()=>{gmEvent[b.dataset.gmMinus]=Math.max(2,gmEvent[b.dataset.gmMinus]-1);again();});body.querySelectorAll('[data-gm-plus]').forEach(b=>b.onclick=()=>{gmEvent[b.dataset.gmPlus]=Math.min(10,gmEvent[b.dataset.gmPlus]+1);again();});}
if(import.meta.env.DEV){const gm=document.createElement('button');gm.dataset.window='GM Event';gm.type='button';gm.innerHTML='GM<span>Event</span>';document.querySelector('.quick-menu')?.insertBefore(gm,document.getElementById('sfx-toggle'));}
// Gear / Inventory, item detail, upgrade modules and Character Status: ported verbatim from the
// arena prototype (iso-arena-draft/poc.js) so both games share one UI. Only references were renamed.
const equipmentPanel=document.createElement('section');equipmentPanel.className='equipment-panel';equipmentPanel.hidden=true;equipmentPanel.style.zIndex='60'; // above the auto-hunt pill and HUD, below the item modal (80)
const equipmentDetailModal=document.getElementById('equipment-detail-modal');
(document.getElementById('game-ui')||document.body).append(equipmentPanel);
// The auto-hunt pill sits in its own stacking layer; hide it while the Gear panel covers the screen.
new MutationObserver(()=>{const t=document.getElementById('autohunt-toggle');if(t)t.style.visibility=equipmentPanel.hidden?'':'hidden';}).observe(equipmentPanel,{attributes:true,attributeFilter:['hidden']});
const gameUi={pendingStats:{}};
const gameWindow=document.getElementById('game-window'),gameWindowTitle=document.getElementById('game-window-title'),gameWindowBody=document.getElementById('game-window-body');
function equipmentAction(command){
  try{
    const selectedId=equipmentUi.selectedId;
    const keepUpgradeModal=(command.type==='enhance'||command.type==='refine'||command.type==='addOption'||command.type==='reoption')&&selectedId&& !equipmentDetailModal.hidden;
    const result=sim.equipmentCommand(command);saveCharacter(sim.character);
    // Presentation state must follow the authoritative build immediately; previously it only refreshed on page load.
    if(command.type==='refine')showRefineResult(result.refineSuccess===true);
    // Keep the same item and upgrade view open after Enhance/Refine so repeated attempts need one click only.
    if((command.type==='enhance'||command.type==='refine'||command.type==='addOption'||command.type==='reoption')&&selectedId&&sim.character.equipment.instances[selectedId]){
      equipmentUi.selectedId=selectedId;renderEquipmentUi();
      const item=sim.character.equipment.instances[selectedId],detail=equipmentPanel.querySelector('.rpg-detail-panel');
      const upgradeMode=command.type==='refine'?'refine':(command.type==='addOption'||command.type==='reoption')?'option':'enhance';if(keepUpgradeModal){equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card">${upgradeHtml(item,sim.character,upgradeMode)}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;bindEquipmentActionButtons(equipmentDetailModal);}else if(detail){detail.innerHTML=upgradeHtml(item,sim.character,upgradeMode);bindEquipmentActionButtons();}
    }else{equipmentUi.selectedId=null;renderEquipmentUi();if(command.type==='equip'&&!equipmentDetailModal.hidden)equipmentDetailModal.hidden=true;}
  }catch(error){showEquipmentError(String(error?.message||error));}
}
function showEquipmentError(message){let toast=document.querySelector('.equipment-result-toast');if(!toast){toast=document.createElement('div');toast.className='equipment-result-toast error';(document.getElementById('game-ui')||document.body).append(toast);}toast.className='equipment-result-toast error show';toast.textContent=message;clearTimeout(showEquipmentError.timer);showEquipmentError.timer=setTimeout(()=>toast.classList.remove('show'),1500);}
function showCraftSuccess(item){
 const c=sim.character;
 equipmentUi.selectedId=item.id;
 equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card craft-success-card"><div class="craft-success-heading">CRAFT SUCCEEDED!</div>${itemDetailHtml(item,c,false)}</div>`;
 equipmentDetailModal.hidden=false;
 equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;
 bindEquipmentActionButtons(equipmentDetailModal);
}
function showBatchCraftResults(items,name){let page=0;const pages=[];for(let i=0;i<items.length;i+=10)pages.push(items.slice(i,i+10));const render=()=>{const batch=pages[page],summary=Object.entries(items.reduce((a,x)=>(a[x.rarity]=(a[x.rarity]||0)+1,a),{})).map(([r,n])=>`${r.toUpperCase()} ×${n}`).join(' · ');equipmentDetailModal.innerHTML=`<div class="batch-craft-result"><small>BATCH CRAFT · ${name}</small><h2>REVEAL ${page+1}/${pages.length}</h2><div class="batch-craft-grid">${batch.map(x=>`<div class="batch-craft-drop rarity-${x.rarity}"><span>${iconHtml(x.templateId,'equipment',gearGlyph(x.slot))}</span><strong>${x.rarity.toUpperCase()}</strong></div>`).join('')}</div><p>${summary}</p><button data-batch-next>${page<pages.length-1?'NEXT ×10':'DONE'}</button></div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('[data-batch-next]').onclick=()=>{if(page<pages.length-1){page++;render();}else equipmentDetailModal.hidden=true;};};render();}
function showRefineResult(success){let toast=document.querySelector('.equipment-result-toast');if(!toast){toast=document.createElement('div');toast.className='equipment-result-toast';(document.getElementById('game-ui')||document.body).append(toast);}toast.className='equipment-result-toast '+(success?'success':'fail')+' show';toast.innerHTML=success?'<strong>REFINE SUCCEEDED!</strong><span>Refinement level increased</span>':'<strong>REFINE FAILED</strong><span>Refinement did not succeed</span>';clearTimeout(showRefineResult.timer);showRefineResult.timer=setTimeout(()=>toast.classList.remove('show'),1400);}
function gearTile(item,c,equipped=false,emptySlot=''){
  if(!item)return `<button class="rpg-gear-tile empty" data-empty-slot="${emptySlot}" title="Craft equipment for ${emptySlot}"><span class="gear-glyph">＋</span></button>`;
  // Equipped accessories can originate from the opposite accessory template; progression belongs to the occupied slot, not item.slot.
  const progressionSlot=equipped&&emptySlot?emptySlot:item.slot;
  const enhance=c.equipment.enhancementBySlot?.[progressionSlot]??0,refine=c.equipment.refinementBySlot?.[progressionSlot]??0;
  const progression=equipped?`<span class="enhance-mark">+${enhance}</span><span class="refine-mark">+${refine}</span>`:'';
  const select=batchDestroyUi.active&&!equipped,checked=select&&batchDestroyUi.selected.has(item.id);
  return `<button class="rpg-gear-tile rarity-${item.rarity} ${equipped?'equipped':''} ${checked?'batch-selected':''}" data-id="${item.id}" title="${prettyItem(item.templateId)}">${select?`<span class="batch-check">${checked?'✓':'○'}</span>`:''}${progression}<span class="gear-glyph">${iconHtml(item.templateId,'equipment',gearGlyph(item.slot))}</span></button>`;
}
function equippedSlotForItem(item,c){return Object.entries(c.equipment.equippedBySlot).find(([,id])=>id===item.id)?.[0]??item.slot;}
function itemDetailHtml(item,c,equipped){
  const progressionSlot=equipped?equippedSlotForItem(item,c):item.slot;
  const enhance=c.equipment.enhancementBySlot?.[progressionSlot]??0,refine=c.equipment.refinementBySlot?.[progressionSlot]??0,base=item.baseCombat||{},rarityMultiplier=equipmentRarityStatMultiplier(item.rarity);
  const stat=Object.entries(base).map(([k,v])=>`<span>${k.toUpperCase()} <b>${Math.round(Number(v)*rarityMultiplier)}</b></span>`).join('')||'<span>Starter equipment</span>';
  const utility=UTILITY_EQUIPMENT_V2[item.templateId],source=utility?Object.values(MONSTERS_V2).filter(m=>(m.loot.equipmentDrops??[]).some(d=>d.itemId===item.templateId)).map(m=>m.name).join(', '):'';
  const template=EQUIPMENT_MASTER_V2[item.templateId],displayName=template?.name||prettyItem(item.templateId),set= item.setId?CRAFT_SET_BY_ID.get(item.setId):null,setCount=set?Math.min(set.requiredPieces,equippedSetCount(item.setId,c)):0,setActive=Boolean(set&&setCount>=set.requiredPieces),setHtml=set?`<div class="equipment-set-status ${setActive?'set-active':'set-inactive'}"><div><strong>${displayName.split(' ')[0]} Set</strong><b>${setCount}/${set.requiredPieces}</b></div>${set.effect.map(effect=>`<p>◆ ${effect}</p>`).join('')}</div>`:'';
  const detailStats=Object.entries(base).filter(([,v])=>Number(v)!==0).map(([k,v])=>`<div><span>${({maxHp:'HP',maxSp:'SP'}[k]||k.toUpperCase())}</span><b>+${Math.round(Number(v)*rarityMultiplier)}</b></div>`).join('')||'<div><span>Base Stats</span><b>—</b></div>';
  const optionText=item.affixes.length?item.affixes.join(' · '):'No bonus options';
  return `<div class="equip-inspect"><div class="equip-inspect-preview">${gearTile(item,c,equipped)}</div><div class="equip-inspect-title"><h2>${displayName}</h2><span class="tier-chip">T${template?.tier??'?'} · ${prettyItem(item.slot)}</span></div><div class="craft-tags"><span>Lv ${item.requiredLevel??1}+</span><span class="rarity-label rarity-${item.rarity}">${item.rarity.toUpperCase()}</span>${template?.role?`<span>${template.role.toUpperCase()}</span>`:''}</div>${utility?`<p class="window-note">${utility.description}</p>`:''}<div class="craft-stat-box equip-stat-box"><h3>ITEM STATS</h3>${detailStats}</div><div class="equip-option-box"><h3>OPTIONS</h3><p>${optionText}</p></div>${setHtml}${source?`<div class="equip-source">Source <b>${source}</b></div>`:''}${equipped&&!utility?`<div class="equip-progression"><div><span>ENHANCEMENT</span><b>+${enhance}</b></div><div><span>REFINEMENT</span><b>+${refine}</b></div></div>`:utility?'<div class="equip-source">Acquisition <b>DROP ONLY</b></div>':''}<div class="rpg-detail-actions">${equipped?`<button data-open-upgrade="${item.id}" data-upgrade-mode="enhance">ENHANCE</button><button data-open-upgrade="${item.id}" data-upgrade-mode="refine">REFINE</button><button data-open-upgrade="${item.id}" data-upgrade-mode="option">OPTION</button><button data-unequip="${progressionSlot}">UNEQUIP</button>`:`<button data-equip-now="${item.id}">EQUIP</button><button data-destroy="${item.id}">DESTROY</button>`}</div></div>`;
}
function upgradeHtml(item,c,mode='enhance'){
  const slot=equippedSlotForItem(item,c),enhance=c.equipment.enhancementBySlot?.[slot]??0,refine=c.equipment.refinementBySlot?.[slot]??0;
  const nextEnhance=enhance+1,category=progressionCategory(slot,item.offhandType);
  let req=null;try{if(nextEnhance<=c.level)req=enhancementRequirement(item.baseGoldCost,nextEnhance);}catch{}
  const utilityEnhance=slot==='hat'?'EXP +0.1% (multiplicative)':slot==='face'?'Drop +0.1% (multiplicative)':slot==='mouth'?'EXP +0.05% · Drop +0.05% (multiplicative)':'Utility';
  const enhanceGain=category==='offensive'?'ATK +2 · MATK +2':category==='defensive'?'DEF +1 · MDEF +1':utilityEnhance;
  const refineGain=category==='offensive'?'Character ATK +0.5% · MATK +0.5%':category==='defensive'?'Character DEF +0.5% · MDEF +0.5% · Max HP +0.5%':'ASPD +0.05 · Cast SPD +0.05 · CRI DMG +0.3% · Element DMG +0.3%';
  const target=refine+1,rate=refine<15?Math.round(REFINE_SUCCESS[refine]*100):0,astraliteNeed=refine<15?astraliteCost(target):0,astraliteHave=c.inventory.astraliteStone??0,canRefine=refine<15&&astraliteHave>=astraliteNeed;
  const enhanceStatus=enhance>=120?'Maximum enhancement reached':nextEnhance>c.level?`Requires Hero Lv. ${nextEnhance}`:req?`${prettyItem(req.stoneId)} ×${req.stoneQty}<br>Gold ${req.gold}`:'Enhancement unavailable';
  const tabs=`<div class="upgrade-module-tabs"><button data-switch-upgrade="enhance" class="${mode==='enhance'?'active':''}">ENHANCE</button><button data-switch-upgrade="refine" class="${mode==='refine'?'active':''}">REFINE</button><button data-switch-upgrade="option" class="${mode==='option'?'active':''}">OPTION</button></div>`;
  let body='';
  if(mode==='refine') body=`<section class="upgrade-module"><h3>REFINE</h3><div class="upgrade-level">+${refine} <i>→</i> +${Math.min(target,15)}</div><p class="upgrade-gain"><strong>Next refinement:</strong> ${refineGain}</p><p>${refine<15?`Success ${rate}%<br>Astralite ${astraliteHave} / ${astraliteNeed}`:'Maximum refinement reached'}</p><button data-refine="${slot}" ${canRefine?'':'disabled'}>REFINE</button></section>`;
  else if(mode==='option') body=`<section class="upgrade-module option-module"><h3>OPTIONS</h3><div class="current-options">${item.affixes.length?item.affixes.map((a,i)=>`<span><b>${i+1}</b>${prettyItem(a)}</span>`).join(''):'<p>No options yet</p>'}</div><div class="option-module-actions"><div><strong>ADD OPTION</strong><small>Option Stone · ${c.inventory.optionStone??0}</small><button data-add-option="${item.id}">ADD</button></div><div><strong>RE-OPTION</strong><small>Re-option Stone · ${c.inventory.reoptionStone??0}</small><button data-reoption="${item.id}" ${item.affixes.length?'':'disabled'}>RE-OPTION</button></div></div></section>`;
  else body=`<section class="upgrade-module"><h3>ENHANCE</h3><div class="upgrade-level">+${enhance} <i>→</i> +${Math.min(nextEnhance,120)}</div><p class="upgrade-gain"><strong>Next upgrade:</strong> ${enhanceGain}</p><p>${enhanceStatus}</p><button data-enhance="${slot}" ${req&&enhance<120?'':'disabled'}>ENHANCE</button></section>`;
  return `<button class="rpg-back" data-back-detail="${item.id}">‹ ITEM DETAIL</button><div class="upgrade-title"><strong>${prettyItem(item.templateId)}</strong><span>${prettyItem(slot)}</span></div>${tabs}<div class="upgrade-module-host">${body}</div>`;
}
function masterRefinementCard(c){
  const gear=equipmentCombatTotals(c),levels=Object.entries(c.equipment.equippedBySlot).filter(([,id])=>Boolean(id)).map(([slot])=>c.equipment.refinementBySlot?.[slot]??0);
  const active=gear.masterRefinement,next=active<5?5:active<10?10:active<15?15:null,target=next??15,count=levels.filter(level=>level>=target).length;
  const bonus=active===15?'ATK +800 · MATK +800 · HP +1500 · SP +500':active===10?'ATK +400 · MATK +400 · HP +900 · SP +300':active===5?'ATK +200 · MATK +200 · HP +500 · SP +200':'Refine 6 equipped slots to +5';
  const badge=active?`+${active}`:'—',status=next?`${Math.min(count,6)}/6 slots ≥ +${next}`:'MAXIMUM';
  return `<div class="master-refinement-card ${active?'active':'inactive'}"><div class="master-refinement-top"><span class="master-refinement-badge">${badge}</span><div><strong>MASTER REFINEMENT</strong><small>${active?`Tier +${active} active`:'Inactive'}</small></div><b>${status}</b></div><div class="master-refinement-bonus">${bonus}</div>${next?`<div class="master-refinement-track"><i style="width:${Math.min(100,(count/6)*100)}%"></i></div>`:''}</div>`;
}
function renderEquipmentUi(){
  const c=sim.character,tabs=['Gear','Crafting Mat','Upgrading Mat','Blueprint','Skill Core','Quest','Misc'];
  const equippedIds=new Set(Object.values(c.equipment.equippedBySlot).filter(Boolean));
  const inventoryGear=Object.values(c.equipment.instances).filter(x=>!equippedIds.has(x.id));
  equipmentPanel.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="rpg-equipment-shell"><div class="rpg-equip-side"><div class="rpg-screen-title"><strong>GEAR</strong><span>Equipment</span></div><div class="rpg-character-stage"><div class="gear-column left">${['hat','mouth','main','cape','accessoryLeft'].map(slot=>{const id=c.equipment.equippedBySlot[slot];return gearTile(id&&c.equipment.instances[id],c,true,slot)}).join('')}</div><div class="character-silhouette"><span>🐰</span><strong>${c.name}</strong><small>LV. ${c.level}</small>${masterRefinementCard(c)}</div><div class="gear-column right">${['face','armor','offhand','shoes','accessoryRight'].map(slot=>{const id=c.equipment.equippedBySlot[slot];return gearTile(id&&c.equipment.instances[id],c,true,slot)}).join('')}</div></div><div class="rpg-detail-panel"></div></div><div class="rpg-inventory-side"><div class="rpg-screen-title"><strong>INVENTORY</strong><span>${inventoryGear.length} gear · ${c.gold} G</span></div><div class="inventory-tabs">${tabs.map(t=>`<button data-tab="${t}" class="${equipmentUi.tab===t?'active':''}">${t}</button>`).join('')}</div>${equipmentUi.tab==='Gear'?`<div class="batch-destroy-bar"><button data-batch-mode class="${batchDestroyUi.active?'active':''}">${batchDestroyUi.active?'CANCEL SELECT':'BATCH DESTROY'}</button>${batchDestroyUi.active?`<button data-select-visible>SELECT ALL FILTERED</button><button data-destroy-selected ${batchDestroyUi.selected.size?'':'disabled'}>DESTROY SELECTED (${batchDestroyUi.selected.size})</button>`:''}</div><div class="gear-filters"><div class="gear-filter-row"><span>TIER</span>${['all','1','2','3','4','5'].map(t=>`<button data-gear-tier="${t}" class="${equipmentUi.tier===t?'active':''}">${t==='all'?'ALL':'T'+t}</button>`).join('')}</div><div class="gear-filter-row gear-slot-filter"><span>PART</span>${GEAR_SLOT_FILTERS.map(([id,label])=>`<button data-gear-slot="${id}" class="${equipmentUi.slot===id?'active':''}">${label}</button>`).join('')}</div></div>`:''}<div class="inventory-grid"></div></div></div>`;
  const grid=equipmentPanel.querySelector('.inventory-grid');
  if(equipmentUi.tab==='Gear'){const visibleGear=inventoryGear.filter(gearMatchesFilter);grid.innerHTML=visibleGear.length?visibleGear.map(x=>gearTile(x,c,false)).join(''):'<div class="inventory-empty">No gear matches these filters</div>';grid.scrollTop=0;}
  else{const entries=Object.entries(c.inventory).filter(([id])=>inventoryCategory(id)===equipmentUi.tab);grid.innerHTML=entries.length?entries.map(([id,qty])=>`<button class="rpg-item-tile" data-item-info="${id}"><span class="item-glyph">${iconHtml(id,'item','◆')}</span><strong>${prettyItem(id)}</strong><b>${qty}</b></button>`).join(''):'<div class="inventory-empty">No items in this category</div>';}
  equipmentPanel.querySelector('.rpg-modal-close')?.addEventListener('click',()=>equipmentPanel.hidden=true);
  equipmentPanel.querySelectorAll('[data-item-info]').forEach(el=>el.onclick=()=>{const id=el.dataset.itemInfo,qty=c.inventory[id]??0,meta=inventoryItemMeta(id),skill=SKILLS_V2[id];const mod=SKILL_MODIFIERS_V2[id];const coreActions=meta.tags.includes('skill-core')?(skill?.kind==='movement'?'<button data-equip-movement-core="'+id+'">EQUIP MOVEMENT</button>':'<div class="core-equip-actions"><button data-equip-core="'+id+'" data-core-slot="0">EQUIP CORE 1</button><button data-equip-core="'+id+'" data-core-slot="1">EQUIP CORE 2</button><button data-equip-core="'+id+'" data-core-slot="2">EQUIP CORE 3</button></div>'):'';equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card"><div class="rpg-detail-head"><div class="rpg-item-tile"><span class="item-glyph">${iconHtml(id,'item','◆')}</span></div><div><strong>${prettyItem(id)}</strong><small>${meta.category.toUpperCase()} · ×${qty}</small></div></div>${skill&&meta.tags.includes('skill-core')?skillDetailHtml(id):mod?`<div class="skill-detail-block"><div class="skill-detail-title"><strong>${mod.name}</strong><span>SKILL MOD</span></div><p>${mod.description}</p><p class="skill-formula">Equip this Mod into MOD 1 or MOD 2 of an installed Skill Core. Its effect is applied by the authoritative combat simulation.</p></div>`:`<p class="item-description">${itemInfo(id)}</p>`}${coreActions}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;equipmentDetailModal.querySelectorAll('[data-equip-core]').forEach(b=>b.onclick=()=>{sim.skillCoreCommand({type:'equipCore',coreId:b.dataset.equipCore,slot:Number(b.dataset.coreSlot)});saveCharacter(sim.character);equipmentDetailModal.hidden=true;syncHotbar();renderEquipmentUi();renderSkillsHub();});equipmentDetailModal.querySelectorAll('[data-equip-movement-core]').forEach(b=>b.onclick=()=>{sim.skillCoreCommand({type:'equipMovementCore',coreId:b.dataset.equipMovementCore});saveCharacter(sim.character);equipmentDetailModal.hidden=true;renderEquipmentUi();});});
  equipmentPanel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{equipmentDetailModal.hidden=true;equipmentDetailModal.replaceChildren();equipmentUi.tab=b.dataset.tab;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-gear-tier]').forEach(b=>b.onclick=()=>{equipmentUi.tier=b.dataset.gearTier;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-gear-slot]').forEach(b=>b.onclick=()=>{equipmentUi.slot=b.dataset.gearSlot;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelector('[data-batch-mode]')?.addEventListener('click',()=>{batchDestroyUi.active=!batchDestroyUi.active;batchDestroyUi.selected.clear();equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelector('[data-select-visible]')?.addEventListener('click',()=>{inventoryGear.filter(gearMatchesFilter).forEach(x=>batchDestroyUi.selected.add(x.id));renderEquipmentUi();});
  equipmentPanel.querySelector('[data-destroy-selected]')?.addEventListener('click',()=>{const ids=[...batchDestroyUi.selected].filter(id=>sim.character.equipment.instances[id]);if(!ids.length)return;if(!confirm(`Destroy ${ids.length} selected gear? This cannot be undone.`))return;let destroyed=0;for(const id of ids){try{sim.equipmentCommand({type:'dismantle',equipmentId:id});destroyed++;}catch{}}saveCharacter(sim.character);batchDestroyUi.selected.clear();batchDestroyUi.active=false;pushRewardLine(`Destroyed ${destroyed} gear`);renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-empty-slot]').forEach(el=>el.onclick=()=>{const slot=el.dataset.emptySlot;craftUi.type=slot==='main'?'Weapon':slot==='offhand'?'Offhand':slot==='armor'?'Armor':slot==='cape'?'Cape':slot==='shoes'?'Shoes':slot==='accessoryLeft'||slot==='accessoryRight'?'Accessory':'Weapon';equipmentPanel.hidden=true;openBasicWindow('Craft');});
  equipmentPanel.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>{if(batchDestroyUi.active){const id=el.dataset.id;if(batchDestroyUi.selected.has(id))batchDestroyUi.selected.delete(id);else batchDestroyUi.selected.add(id);renderEquipmentUi();return;}equipmentUi.selectedId=el.dataset.id;const item=c.equipment.instances[equipmentUi.selectedId];if(!item)return;equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card">${itemDetailHtml(item,c,equippedIds.has(item.id))}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;bindEquipmentActionButtons(equipmentDetailModal);});
  if(equipmentUi.selectedId&&c.equipment.instances[equipmentUi.selectedId]){const item=c.equipment.instances[equipmentUi.selectedId];equipmentPanel.querySelector('.rpg-detail-panel').innerHTML=itemDetailHtml(item,c,equippedIds.has(item.id));}
  bindEquipmentActionButtons();
}
function confirmDestroyEquipment(itemId,root=equipmentPanel){
  const item=sim.character.equipment.instances[itemId];if(!item)return;
  const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');if(!host)return;
  host.innerHTML=`<div class="destroy-confirm"><strong>Are you sure you want to destroy?</strong><p>${prettyItem(item.templateId)} will be permanently destroyed.</p><div class="rpg-detail-actions"><button data-confirm-destroy="${item.id}">YES</button><button data-cancel-destroy="${item.id}">NO</button></div></div>`;
  host.querySelector('[data-cancel-destroy]')?.addEventListener('click',()=>{host.innerHTML=itemDetailHtml(item,sim.character,false);bindEquipmentActionButtons(root);});
  host.querySelector('[data-confirm-destroy]')?.addEventListener('click',()=>{
    try{
      sim.equipmentCommand({type:'dismantle',equipmentId:item.id});saveCharacter(sim.character);
      host.innerHTML='<div class="destroy-confirm destroyed"><strong>DESTROYED</strong></div>';
      equipmentUi.selectedId=null;renderEquipmentUi();
      setTimeout(()=>{if(root===equipmentDetailModal)equipmentDetailModal.hidden=true;},550);
    }catch(error){showEquipmentError(String(error?.message||error));}
  });
}

function bindEquipmentActionButtons(root=equipmentPanel){
  root.querySelectorAll('[data-equip-now]').forEach(b=>b.onclick=()=>{const id=b.dataset.equipNow,item=sim.character.equipment.instances[id];if(item&&(item.slot==='accessoryLeft'||item.slot==='accessoryRight')){const slots=sim.character.equipment.equippedBySlot;const target=!slots.accessoryLeft?'accessoryLeft':!slots.accessoryRight?'accessoryRight':item.slot;equipmentAction({type:'equip',equipmentId:id,targetSlot:target});}else equipmentAction({type:'equip',equipmentId:id});});
  root.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>equipmentAction({type:'unequip',slot:b.dataset.unequip}));
  root.querySelectorAll('[data-destroy]').forEach(b=>b.onclick=()=>confirmDestroyEquipment(b.dataset.destroy,root));
  root.querySelectorAll('[data-open-upgrade]').forEach(b=>b.onclick=()=>{const item=sim.character.equipment.instances[b.dataset.openUpgrade];const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=upgradeHtml(item,sim.character,b.dataset.upgradeMode||'enhance');bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-switch-upgrade]').forEach(b=>b.onclick=()=>{const itemId=equipmentUi.selectedId;const item=sim.character.equipment.instances[itemId];if(!item)return;const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=upgradeHtml(item,sim.character,b.dataset.switchUpgrade);bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-back-detail]').forEach(b=>b.onclick=()=>{const item=sim.character.equipment.instances[b.dataset.backDetail];const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=itemDetailHtml(item,sim.character,true);bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-enhance]').forEach(b=>b.onclick=()=>equipmentAction({type:'enhance',slot:b.dataset.enhance}));
  root.querySelectorAll('[data-refine]').forEach(b=>b.onclick=()=>equipmentAction({type:'refine',slot:b.dataset.refine}));
  root.querySelectorAll('[data-add-option]').forEach(b=>b.onclick=()=>equipmentAction({type:'addOption',equipmentId:b.dataset.addOption}));
  root.querySelectorAll('[data-reoption]').forEach(b=>b.onclick=()=>equipmentAction({type:'reoption',equipmentId:b.dataset.reoption,lockedIndexes:[]}));
}
function openCharacterWindow(){const c=sim.character;let statEditGuardUntil=0;gameWindow.hidden=false;gameWindowTitle.textContent='CHARACTER STATUS';const stats=['str','agi','vit','int','dex','luk'];gameUi.pendingStats={};const render=()=>{const used=Object.values(gameUi.pendingStats).reduce((a,v)=>a+v,0),remaining=c.unspentStatPoints-used,preview={...c.stats};for(const s of stats)preview[s]+=gameUi.pendingStats[s]||0;const p=sim.simulation.world.players.get(sim.playerId);const d={ATK:Math.round(p.weaponAtk+preview.str+preview.str*preview.str/100+preview.dex/5+preview.luk/3),MATK:Math.round(p.weaponMatk+preview.int+preview.int*preview.int/100+preview.dex/5+preview.luk/3),DEF:Math.round(p.equipmentDef+preview.vit/2),MDEF:Math.round(p.equipmentMdef+preview.int/2+preview.vit/4),HIT:175+c.level+preview.dex+p.hitBonus,FLEE:100+c.level+preview.agi+p.fleeBonus,CRIT:(1+preview.luk*.3+p.critBonusPercent).toFixed(1)+'%',ASPD:Math.floor(150+preview.agi*.25+preview.dex*.1+p.equipmentAspd),HP:100+c.level*12+preview.vit*10};gameWindowBody.innerHTML='<p class="window-note">Lv. '+c.level+' · Status Point: <b>'+remaining+'</b></p><div class="character-status-columns"><section><h3>STATUS</h3>'+stats.map(s=>'<div class="stat-row"><span><strong>'+s.toUpperCase()+'</strong><b>'+preview[s]+'</b></span>'+(remaining>0?'<button data-stat-plus="'+s+'">+</button>':'')+'</div>').join('')+'</section><section><h3>DETAIL STATUS</h3>'+Object.entries(d).map(([k,v])=>'<div class="detail-stat-row"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</section></div><div class="equipment-actions"><button id="stats-confirm" type="button" aria-disabled="'+(used<=0)+'">Confirm</button><button id="stats-reset">Reset</button></div>';gameWindowBody.querySelectorAll('[data-stat-plus]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();if(remaining<=0)return;statEditGuardUntil=performance.now()+350;gameUi.pendingStats[b.dataset.statPlus]=(gameUi.pendingStats[b.dataset.statPlus]||0)+1;render();});const confirm=gameWindowBody.querySelector('#stats-confirm');if(confirm)confirm.onclick=e=>{e.preventDefault();e.stopPropagation();if(performance.now()<statEditGuardUntil)return;const allocation={...gameUi.pendingStats};if(!Object.values(allocation).some(v=>v>0))return;if(sim.allocateStats(allocation)){saveCharacter(sim.character);gameUi.pendingStats={};openCharacterWindow();}};gameWindowBody.querySelector('#stats-reset').onclick=()=>{gameUi.pendingStats={};render();};};render();}
function openBasicWindow(name){
  const win=document.getElementById('game-window'),title=document.getElementById('game-window-title'),body=document.getElementById('game-window-body');
  if(!win||!title||!body)return;win.hidden=false;title.textContent=name;equipmentPanel.hidden=true;
  const c=sim.character,p=sim.simulation.world.players.get(sim.playerId);
  if(name==='Inventory'){equipmentUi.tab='Gear';equipmentUi.selectedId=null;renderEquipmentUi();win.hidden=true;equipmentPanel.hidden=false;return;}
  if(name==='Skills'){renderSkillsHub();return;}
  if(name==='Craft'){renderCraftWindow();return;}
  if(name==='Settings'){renderSettings(body);return;}
  if(name==='GM Event'){renderGmEventPanel(title,body);return;}
  if(name==='Monster Index'){renderMonsterIndex({win,title,body,character:c,currentMapId:gameplayMapId,itemInfo,prettyItem});return;}
}
function bindProductionUi(){
  document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>openBasicWindow(b.dataset.window)));
  document.getElementById('character-hud')?.addEventListener('click',openCharacterWindow);
  document.getElementById('game-window-close')?.addEventListener('click',()=>{document.getElementById('game-window').hidden=true;});
  window.addEventListener('keydown',e=>{if(e.code==='KeyI')openBasicWindow('Inventory');if(e.code==='KeyK')openBasicWindow('Skills');if(e.code==='KeyY')openBasicWindow('Craft');if(e.code==='KeyM')openBasicWindow('Monster Index');if(e.key==='Escape'){const detail=document.getElementById('equipment-detail-modal');if(detail&&!detail.hidden){closeDetailModal();return;}if(!equipmentPanel.hidden){equipmentPanel.hidden=true;return;}const w=document.getElementById('game-window');if(w)w.hidden=true;}});
}
// Same as the arena prototype: static [data-ui-icon] glyphs are swapped for the pixel UI icons.
document.querySelectorAll('[data-ui-icon]').forEach(el=>{el.innerHTML=iconHtml(el.dataset.uiIcon,'ui',el.innerHTML,'pixel-icon ui-icon');});
bindProductionUi();
const sfxToggle=document.getElementById('sfx-toggle');
function syncSfxToggle(){if(!sfxToggle)return;sfxToggle.innerHTML=`${combatSFX.enabled?'🔊':'🔇'}<span>${combatSFX.enabled?'Sound':'Muted'}</span>`;sfxToggle.title=combatSFX.enabled?'Mute sound':'Enable sound';}
sfxToggle?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();combatSFX.toggle();syncSfxToggle();});
syncSfxToggle();
syncHotbar();
const warpPrompt=document.createElement('div');warpPrompt.id='warp-prompt';warpPrompt.hidden=true;warpPrompt.style.cssText='position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:50;padding:8px 14px;background:rgba(10,14,18,.9);border:1px solid #d9bd72;border-radius:6px;color:#fff4cf;font:600 14px system-ui;pointer-events:none';document.body.appendChild(warpPrompt);
let nearbyPortal=null,zoneTransferBusy=false;
function syncWarpPrompt(player){nearbyPortal=activePortalAt(scene,player);warpPrompt.hidden=!nearbyPortal;if(nearbyPortal)warpPrompt.textContent=`Warp to ${mapTitleV2(nearbyPortal.to)} [E]`;}
async function performWarp(){if(zoneTransferBusy||!nearbyPortal||!window.__slice)return;zoneTransferBusy=true;cancelCombat();const result=await requestZoneTransfer({fromMap:gameplayMapId,portalId:nearbyPortal.id,scene,player:window.__slice.player});if(result.denied){showUiError(result.reason);zoneTransferBusy=false;return;}combatSFX.playWarp();persistentCharacter={...sim.character,currentMapId:result.map};saveCharacter(persistentCharacter);combatFX.teardown();setRuntimeActors([]);setRuntimeActorUpdater(null);teardown();const url=new URL(location.href);url.searchParams.set('map','forest-combat');if(import.meta.env.DEV)url.searchParams.set('file',result.map);else url.searchParams.delete('file');sessionStorage.setItem('bunny-world-zone-spawn',JSON.stringify(result.spawn));location.replace(url);}
window.addEventListener('keydown',e=>{if((e.code==='KeyE'||e.code==='Enter')&&nearbyPortal){e.preventDefault();performWarp();}});
document.querySelectorAll('[data-hotbar-slot]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.skillId;if(!id)return;try{sim.castSkill(id,combatTarget?.id);}catch(e){showUiError(String(e?.message||e));}}));
document.querySelector('[data-hotbar-movement]')?.addEventListener('click',()=>{const id=sim.character.skills.movement;if(!id)return;try{sim.castSkill(id,undefined,undefined,{x:1,y:0});}catch(e){showUiError(String(e?.message||e));}});


// ---- chasing: walk straight when the way is clear, otherwise follow an A* route ----
function giveUpTarget(target){if(autoHunt.on)autoHunt.ban(target.id);nav.clear();cancelCombat();chaseStuck=0;}
function chaseTarget(player,target,d,stopRange,dt){
  const direct=d<200&&canWalkStraight(player.x,player.y,target.x,target.y);
  if(direct){
    nav.clear();
    const before=d;
    moveRuntimePlayerToward(target.x,target.y,Math.min(Math.max(0,d-stopRange),125*dt));
    const after=Math.hypot(target.x-player.x,target.y-player.y);
    // blocked (tree/rock/cliff between us): give up instead of running on the spot
    chaseStuck=after<before-.5?0:chaseStuck+dt;
    if(chaseStuck>1.2)giveUpTarget(target);
    return;
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
floaters=createFloaters(canvas);
canvas.addEventListener('pointerdown',e=>{
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;
  let hit=null,best=Infinity;
  for(const a of actors){if(a.dead)continue;const p=projectRuntimePoint(a.x,a.y,a.z),d=Math.hypot(x-p.x,y-p.y);if(d<72&&d<best){hit=a;best=d;}}
  if(hit){
    if(combatTarget?.id!==hit.view.id){cancelHeroAttack(playback);lastTargetSample=null;}
    if(resting)setResting(false);combatTarget=hit.view;nav.clear();clickHitMonster=true;setRuntimePlayerControl(true);e.preventDefault();
  }else{clickHitMonster=false;}
});

window.__combat={sim,playback,actors,fx:combatFX,sfx:combatSFX,get floaters(){return floaters;},presentCombatEvents,rosterId,roster,mapId:gameplayMapId,routeId,get target(){return combatTarget;},requestZoneTransfer:performWarp};
const pendingSpawn=(()=>{try{const v=JSON.parse(sessionStorage.getItem('bunny-world-zone-spawn')||'null');sessionStorage.removeItem('bunny-world-zone-spawn');return v;}catch{return null;}})();
if(pendingSpawn){scene.spawn={x:pendingSpawn.x,y:pendingSpawn.y};playerView.x=pendingSpawn.x;playerView.y=pendingSpawn.y;}
persistentCharacter={...sim.character,currentMapId:gameplayMapId};saveCharacter(persistentCharacter);
await boot(scene,{canvasEl:canvas,loadingEl:document.getElementById('loading'),playerSprites:null,playerScale:1,worldScale:1.45,zoom:1});
