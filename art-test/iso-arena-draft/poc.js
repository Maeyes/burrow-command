import { MAP_NAMES_V2 } from '../../src/simulation/mapNames.ts';
import { FOREST_ASSET_ROOT, FOREST_MONSTERS, FOREST_BOSSES, FOREST_MAPS } from './forestRoster.js';
import { ArenaV2Adapter } from '../../src/simulation/arenaAdapter.ts';
import { createInitialCharacterV2, expToNextLevelV2 } from '../../src/simulation/character.ts';
import { enhancementRequirement, REFINE_SUCCESS, astraliteCost, progressionCategory, equipmentRarityStatMultiplier } from '../../src/simulation/equipmentV2.ts';
import { equipmentCombatTotals } from '../../src/simulation/equipmentCombat.ts';
import { MONSTERS_V2 } from '../../src/simulation/monsterDataV2.ts';
import { EQUIPMENT_MASTER_V2, SET_DEFINITIONS_V2 } from '../../src/simulation/itemMasterV2.ts';
import { UTILITY_EQUIPMENT_V2 } from '../../src/simulation/utilityEquipmentV2.ts';
import { UNIVERSAL_ORE_CHANCE, UNIVERSAL_ASTRALITE_CHANCE } from '../../src/simulation/loot.ts';
import { masteryXpRequired } from '../../src/simulation/mastery.ts';
import { WEAPON_MASTERY_MILESTONES } from '../../src/simulation/masteryMilestones.ts';
import { inventoryCategoryFor, inventoryItemMeta } from '../../src/simulation/itemTagsV2.ts';
import { SKILLS_V2 } from '../../src/simulation/skills.ts';
import { SKILL_MODIFIERS_V2 } from '../../src/simulation/skillModifiersV2.ts';
import { skillCoreUpgradeQuote } from '../../src/simulation/skillCoreService.ts';
import { iconFor, iconHtml } from './iconFor.js';
import { DESERT_ASSET_ROOT, DESERT_MONSTERS, DESERT_BOSSES, DESERT_MAPS } from './desertRoster.js';
import { MINE_MONSTERS, MINE_BOSSES, MINE_MAP, MINE_BOSS_ROOT } from './mineRoster.js';
import { MINE_PALETTE, MINE_PROPS, MINE_ZONES, MINE_SPAWNS } from './mineLayout.js';
import { beginBossAttackState, getBossAttackConfig, getBossAttackProgress, updateBossAttackState } from './bossCombat.js';
import { prepare as prepareMapEngine, renderHosted as renderMapEngine, canRuntimeActorStand, runtimeWalkHeight } from '../dimraeth-slice/engine/runtime.js';
import forestEngineScene from '../dimraeth-slice/scenes/forest.js';
import {
  DAGGER_ATTACK_01,
  SWORD_ATTACK_01,
  beginHeroAttack,
  createHeroAttackPlayback,
  heroCombatFramePath,
  updateHeroAttackPlayback,
} from './heroCombat.js';

const canvas = document.querySelector('#scene');
const playerHpBar = document.querySelector('.player-hud .bar.hp i');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;
const HORIZON = 0;
const GROUND_Y = 382;
// Canonical 2:1 isometric projection: one world axis goes down-right, the other down-left.
const ISO_X = 0.5;
const ISO_Y = 0.25;
// Full field scale: 4x the former arena AREA (2x each world dimension).
const WORLD = { minX: -1240, maxX: 1240, minY: -1100, maxY: 1300 };
const ASSET_ROOT = '../isometric-player';
// Arena draft: fixed square combat diorama. Keep the proven 2:1 projection/depth system,
// but constrain the composition to one screen instead of an open scrolling world.
const MOVE_SPEED = 168;
const HYSTERESIS = 7;
const params = new URLSearchParams(window.location.search);
const qaMode = params.get('qa');
const biome = ['town','forest1','forest2','desert1','desert2','mine','worldboss80','snow','blender','worldcrop'].includes(params.get('biome')) ? params.get('biome') : 'forest1';
const forestMap = biome === 'forest2' ? FOREST_MAPS.forest2 : FOREST_MAPS.forest1;
const desertMap = biome === 'desert2' ? DESERT_MAPS.desert2 : DESERT_MAPS.desert1;
const TOWN_MAP={id:'town',title:'Bunny Haven',level:'SAFE ZONE',boss:'NONE'};
const WORLD_BOSS_80_MAP={id:'worldboss80',title:'Hall of the Fallen Crown',level:'LV. 80 INSTANCE',boss:'Ancient Castle Sovereign'};
const activeMap = biome === 'town' ? TOWN_MAP : biome === 'worldboss80' ? WORLD_BOSS_80_MAP : biome === 'mine' ? MINE_MAP : biome.startsWith('desert') ? desertMap : forestMap;
const paletteBiome = biome === 'town' ? 'town' : biome === 'forest1' || biome === 'forest2' ? 'greenfield' : biome.startsWith('desert') ? 'desert' : biome;
const blenderMode = biome === 'blender' || biome === 'worldcrop';
const worldCropMode = biome === 'worldcrop';
const BIOME = {
  town:{ground:'#596b58',edge:'#29352d',back:'#17201c',patch:'#62755f',patchHi:'#7e8d70',trail:'#9a8766',trailHi:'#b8a17b',clearing:'#6c775f',landmark:'#8b7659'},
  greenfield:{ground:'#28543b',edge:'#152f25',back:'#10271f',patch:'#28553a',patchHi:'#3a6040',trail:'#6b5a3b',trailHi:'#806b46',clearing:'#244f36',landmark:'#294f39'},
  desert:{ground:'#b98a4f',edge:'#60462e',back:'#30251d',patch:'#c99b59',patchHi:'#e0b86f',trail:'#8f663e',trailHi:'#d0a25f',clearing:'#b18149',landmark:'#a8733f'},
  snow:{ground:'#c7d6d5',edge:'#667b80',back:'#1c2c35',patch:'#b7cbca',patchHi:'#e4eeee',trail:'#8b9b9b',trailHi:'#b9c5c4',clearing:'#bfd0cf',landmark:'#aebfc0'},
  mine:MINE_PALETTE,
  worldboss80:{ground:'#282631',edge:'#100e16',back:'#08070d',patch:'#34303d',patchHi:'#51485b',trail:'#665b52',trailHi:'#9a876f',clearing:'#302b38',landmark:'#514336'},
  blender:{ground:'#28543b',edge:'#152f25',back:'#10271f',patch:'#28553a',patchHi:'#3a6040',trail:'#6b5a3b',trailHi:'#806b46',clearing:'#244f36',landmark:'#294f39'},
  worldcrop:{ground:'#28543b',edge:'#152f25',back:'#10271f',patch:'#28553a',patchHi:'#3a6040',trail:'#6b5a3b',trailHi:'#806b46',clearing:'#244f36',landmark:'#294f39'}
}[paletteBiome];
const qaStartTime = performance.now();
const useForestEngine = biome === 'forest1';
let forestEngineReady = false;
let forestEngineSpawn = null;
const MAP_PROGRESSION=['town','forest1','forest2','desert1','desert2','mine'];
const MAP_NAMES={town:'BUNNY HAVEN',...Object.fromEntries(Object.entries(MAP_NAMES_V2).map(([id,m])=>[id,m.title.toUpperCase()])),worldboss80:'HALL OF THE FALLEN CROWN'};
const mapIndex=MAP_PROGRESSION.indexOf(biome);
const warpPortals=biome==='worldboss80'?[{direction:'back',target:'town',x:WORLD.minX+190,y:WORLD.minY+190,radius:76,triggered:false}]:[
  ...(mapIndex>0?[{direction:'back',target:MAP_PROGRESSION[mapIndex-1],x:WORLD.minX+190,y:WORLD.minY+190,radius:76,triggered:false}]:[]),
  ...(mapIndex>=0&&mapIndex<MAP_PROGRESSION.length-1?[{direction:'next',target:MAP_PROGRESSION[mapIndex+1],x:WORLD.maxX-190,y:WORLD.maxY-190,radius:76,triggered:false}]:[])
];
function enterWarpPortal(portal){if(!portal||portal.triggered)return;portal.triggered=true;saveWorldSession();const url=new URL(window.location.href);url.searchParams.set('biome',portal.target);url.searchParams.set('from',biome);url.searchParams.delete('qa');window.location.assign(url.toString());}
const WORLD_BOSS_WINDOW_MS=5*60*1000,WORLD_BOSS_ENTRY_LIMIT=3;
// TEMP QA: keep the World Boss open while tuning the first playable event build.
const WORLD_BOSS_DEV_OPEN=true;
function worldBossSlotStart(now=Date.now()){const d=new Date(now);d.setMinutes(0,0,0);d.setHours(Math.floor(d.getHours()/2)*2);return d.getTime();}
function worldBossWindowOpen(now=Date.now()){return WORLD_BOSS_DEV_OPEN||now-worldBossSlotStart(now)<WORLD_BOSS_WINDOW_MS;}
function worldBossDailyKey(now=Date.now()){const d=new Date(now);return `bunny-world:worldboss80:${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function worldBossEntries(now=Date.now()){return Number(localStorage.getItem(worldBossDailyKey(now))||0);}
function nextWorldBossAt(now=Date.now()){const start=worldBossSlotStart(now);return now<start+WORLD_BOSS_WINDOW_MS?start:start+2*60*60*1000;}
const worldBossEventBanner=document.querySelector('#world-boss-event-banner');
if(worldBossEventBanner){
  if(biome==='worldboss80'){worldBossEventBanner.classList.add('in-instance');worldBossEventBanner.querySelector('b').textContent='LEAVE INSTANCE ›';}
  worldBossEventBanner.addEventListener('click',()=>{saveWorldSession();const url=new URL(window.location.href);if(biome==='worldboss80'){url.searchParams.set('biome','town');}else{const qaWorldBoss=qaMode==='worldboss';if(!qaWorldBoss&&!worldBossWindowOpen()){alert('World Boss opens every 2 hours for 5 minutes.');return;}const used=WORLD_BOSS_DEV_OPEN?0:worldBossEntries();if(!qaWorldBoss&&!WORLD_BOSS_DEV_OPEN&&used>=WORLD_BOSS_ENTRY_LIMIT){alert('World Boss daily entry limit reached (3/3).');return;}if(!qaWorldBoss&&!WORLD_BOSS_DEV_OPEN)localStorage.setItem(worldBossDailyKey(),String(used+1));sessionStorage.setItem('bunny-world:worldboss80:endAt',String(Date.now()+WORLD_BOSS_WINDOW_MS));url.searchParams.set('biome','worldboss80');}url.searchParams.set('from',biome);url.searchParams.delete('qa');window.location.assign(url.toString());});
}
// Test shortcut: B warps directly into the Goblin Leader boss-room variant of Goblin Mine.
window.addEventListener('keydown',event=>{if(event.code!=='KeyB'||event.repeat||event.target?.matches?.('input,textarea'))return;const url=new URL(window.location.href);url.searchParams.set('biome','mine');url.searchParams.set('qa','boss');url.searchParams.set('from',biome);window.location.assign(url.toString());});
const SAFE_ZONE_RADIUS=540;
function pointInsideSafeZone(x,y){return warpPortals.some(portal=>Math.hypot(x-portal.x,y-portal.y)<=SAFE_ZONE_RADIUS);}
function activeSafeZone(){return warpPortals.find(portal=>Math.hypot(state.player.x-portal.x,state.player.y-portal.y)<=SAFE_ZONE_RADIUS)??null;}
function updateWarpPortal(){for(const portal of warpPortals){if(Math.hypot(state.player.x-portal.x,state.player.y-portal.y)<=portal.radius)enterWarpPortal(portal);}}
function drawWarpPortal(){for(const portal of warpPortals){const safe=worldToScreen(portal.x,portal.y);ctx.save();ctx.fillStyle='rgba(80,220,130,.055)';ctx.strokeStyle='rgba(105,235,150,.34)';ctx.lineWidth=1.5;ctx.setLineDash([7,7]);ctx.beginPath();ctx.ellipse(safe.x,safe.y,288,138,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);drawLabel('SAFE ZONE',safe.x,safe.y+150,'#7de6a4');ctx.restore();const p=worldToScreen(portal.x,portal.y),pulse=.5+.5*Math.sin(state.time*4),back=portal.direction==='back';ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=back?`rgba(190,150,255,${.08+pulse*.05})`:`rgba(104,174,255,${.08+pulse*.05})`;ctx.strokeStyle=back?`rgba(200,169,255,${.65+pulse*.25})`:`rgba(135,202,255,${.65+pulse*.25})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,42+pulse*4,20+pulse*2,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=back?`rgba(226,207,255,${.35+pulse*.25})`:`rgba(193,229,255,${.35+pulse*.25})`;ctx.beginPath();ctx.ellipse(p.x,p.y,28-pulse*2,13-pulse,0,0,Math.PI*2);ctx.stroke();for(let i=0;i<5;i++){const a=state.time*(.7+i*.08)+i*1.26,x=p.x+Math.cos(a)*(24+i*3),y=p.y+Math.sin(a)*(10+i);ctx.fillStyle=back?'rgba(226,207,255,.8)':'rgba(190,228,255,.8)';ctx.fillRect(Math.round(x),Math.round(y-5-pulse*8),2,2);}ctx.restore();drawLabel(`WARP · ${MAP_NAMES[portal.target]}`,p.x,p.y-32,back?'#d6bfff':'#a9d8ff');}}

const directionNames = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const sprites = {};
// 8-frame transparent melee slash strip. Asset path is intentionally isolated so the VFX can be swapped without touching combat logic.
let meleeSlashFxSheet=null;
loadImage('/fx/melee_slash_8f.png').then(img=>{meleeSlashFxSheet=img;}).catch(()=>{});
let cyclonePixelFxSheet=null;
loadImage('/fx/Create_an_8-frame_spinning_MEL-spritesheet/Create_an_8-frame_spinning_MEL.png').then(img=>{cyclonePixelFxSheet=img;}).catch(()=>{});
const pixelFxSheets={};
for(const [key,path] of Object.entries({heavy:'/fx/runtime/2handed%20weapon/Create_HEAVY_MELEE_SLASH_VFX_f.png',dual:'/fx/runtime/dualdagger/Create_HEAVY_MELEE_SLASH_VFX_f.png',combustion:'/fx/runtime/combussion/Create_HEAVY_MELEE_SLASH_VFX_f.png',groundSlam:'/fx/runtime/ground%20slam/Animate_this_ground_impact_eff.png',meteorStorm:'/fx/runtime/Animate_this_Meteor_Storm_effe-spritesheet/Animate_this_Meteor_Storm_effe.png',blackHole:'/fx/runtime/Create_a_single_Black_Hole_ski-spritesheet/Create_a_single_Black_Hole_ski.png'}))loadImage(path).then(img=>{pixelFxSheets[key]=img;}).catch(()=>{});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

await Promise.all(directionNames.map(async (direction) => {
  sprites[direction] = await loadImage(`${ASSET_ROOT}/${direction}.png`);
}));

const sunnysideRoot = '/Sunnyside_World_Assets';
const monsterSheets = {
  goblin: {
    walk: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_walk_strip8.png'),
    idle: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_idle_strip9.png'),
    attack: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_attack_strip10.png'),
    hurt: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_hurt_strip8.png'),
    death: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_death_strip13.png'),
    axe: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_axe_strip10.png'),
    mining: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_mining_strip10.png'),
    dig: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_dig_strip13.png'),
    carry: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_carry_strip8.png'),
    hammering: await loadImage(sunnysideRoot + '/Characters/Goblin/PNG/spr_hammering_strip23.png'),
  },
  skeleton: {
    walk: await loadImage(sunnysideRoot + '/Characters/Skeleton/PNG/skeleton_walk_strip8.png'),
    idle: await loadImage(sunnysideRoot + '/Characters/Skeleton/PNG/skeleton_idle_strip6.png'),
    attack: await loadImage(sunnysideRoot + '/Characters/Skeleton/PNG/skeleton_attack_strip7.png'),
    hurt: await loadImage(sunnysideRoot + '/Characters/Skeleton/PNG/skeleton_hurt_strip7.png'),
    death: await loadImage(sunnysideRoot + '/Characters/Skeleton/PNG/skeleton_death_strip10.png'),
  },
};
const redBars = await Promise.all([0,1,2,3,4,5,6].map(i => loadImage(sunnysideRoot + '/UI/redbar_0' + i + '.png')));
const worldBossDragonSheet=await loadImage('/art-test/iso-arena-draft/assets/worldboss80/ORIGINAL_GREAT_MYTHICAL_DRAGON.png');
const greenBars = await Promise.all([0,1,2,3,4,5,6].map(i => loadImage(sunnysideRoot + '/UI/greenbar_0' + i + '.png')));
const forestFrames = {};
for (const [id, asset] of Object.entries(FOREST_MONSTERS)) {
  forestFrames[id] = await Promise.all(Array.from({length:asset.count},(_,i)=>loadImage(`${FOREST_ASSET_ROOT}/${asset.dir}/animations/${asset.anim}/unknown/frame_${String(i).padStart(3,'0')}.png`)));
}
for (const [id, asset] of Object.entries(DESERT_MONSTERS)) {
  forestFrames[id] = await Promise.all(Array.from({length:asset.count},(_,i)=>loadImage(`${DESERT_ASSET_ROOT}/${asset.dir}/animations/${asset.anim}/unknown/frame_${String(i).padStart(3,'0')}.png`)));
}
const bossFrames = {};
for (const [id, asset] of Object.entries(FOREST_BOSSES)) {
  bossFrames[id] = {
    walk: await Promise.all(Array.from({length:asset.count},(_,i)=>loadImage(`${FOREST_ASSET_ROOT}/${asset.dir}/animations/${asset.anim}/unknown/frame_${String(i).padStart(3,'0')}.png`))),
    attack: await Promise.all(Array.from({length:asset.attackCount},(_,i)=>loadImage(`${FOREST_ASSET_ROOT}/${asset.dir}/animations/${asset.attack}/unknown/frame_${String(i).padStart(3,'0')}.png`))),
  };
}
for (const [id, asset] of Object.entries(DESERT_BOSSES)) {
  bossFrames[id] = {
    walk: await Promise.all(Array.from({length:asset.count},(_,i)=>loadImage(`${DESERT_ASSET_ROOT}/${asset.dir}/animations/${asset.anim}/unknown/frame_${String(i).padStart(3,'0')}.png`))),
    attack: await Promise.all(Array.from({length:asset.attackCount},(_,i)=>loadImage(`${DESERT_ASSET_ROOT}/${asset.dir}/animations/${asset.attack}/unknown/frame_${String(i).padStart(3,'0')}.png`))),
  };
}

const mineSheets = {
  mineGoblin: monsterSheets.goblin,
  goblinAxer: monsterSheets.goblin,
  goblinForeman: monsterSheets.goblin,
  skeleton: monsterSheets.skeleton,
};
const mineBossAsset = MINE_BOSSES.goblinLeader;
const mineBossFrames = {
  goblinLeader: {
    walk: await Promise.all(Array.from({ length: mineBossAsset.frameCount }, (_, i) =>
      loadImage(`${MINE_BOSS_ROOT}/animations/${mineBossAsset.animations.leader}/unknown/frame_${String(i).padStart(3, '0')}.png`)
    )),
    attack: await Promise.all(Array.from({ length: mineBossAsset.frameCount }, (_, i) =>
      loadImage(`${MINE_BOSS_ROOT}/animations/${mineBossAsset.animations.brutal}/unknown/frame_${String(i).padStart(3, '0')}.png`)
    )),
    warStomp: await Promise.all(Array.from({ length: mineBossAsset.frameCount }, (_, i) =>
      loadImage(`${MINE_BOSS_ROOT}/animations/${mineBossAsset.animations.warSt}/unknown/frame_${String(i).padStart(3, '0')}.png`)
    )),
    leaderCharge: await Promise.all(Array.from({ length: mineBossAsset.frameCount }, (_, i) =>
      loadImage(`${MINE_BOSS_ROOT}/animations/${mineBossAsset.animations.leader}/unknown/frame_${String(i).padStart(3, '0')}.png`)
    )),
  },
};
const WORLD_SESSION_KEY=`bunny-world:v2:world:${biome}`;
function loadWorldSession(){try{return JSON.parse(localStorage.getItem(WORLD_SESSION_KEY)||'null')}catch{return null}}
function saveWorldSession(){try{const p=typeof arenaV2!=='undefined'?arenaV2.simulation.world.players.get(arenaV2.playerId):null;localStorage.setItem(WORLD_SESSION_KEY,JSON.stringify({player:{x:state.player.x,y:state.player.y,hp:p?.hp,maxHp:p?.maxHp,sp:p?.sp,maxSp:p?.maxSp},bossNextAt:worldSession.bossNextAt,bossAlive:worldSession.bossAlive,bossSpawnId:worldSession.bossSpawnId??null}))}catch{}}
const savedWorldSession=loadWorldSession();
const arrivedFrom=params.get('from');
const arrivalIndex=MAP_PROGRESSION.indexOf(arrivedFrom);
const currentIndex=MAP_PROGRESSION.indexOf(biome);
const portalArrival=arrivalIndex>=0&&currentIndex>=0&&Math.abs(arrivalIndex-currentIndex)===1
  ? (arrivalIndex<currentIndex?{x:WORLD.minX+310,y:WORLD.minY+310}:{x:WORLD.maxX-310,y:WORLD.maxY-310})
  : null;
const savedBossNextAt=Number(savedWorldSession?.bossNextAt);
const worldSession={bossNextAt:Number.isFinite(savedBossNextAt)&&savedBossNextAt>0?savedBossNextAt:Date.now()+300000,bossAlive:Boolean(savedWorldSession?.bossAlive),bossSpawnId:savedWorldSession?.bossSpawnId??null};
const state = {
  time: 0,
  player: { x: portalArrival?.x ?? (Number(savedWorldSession?.player?.x) || -90), y: portalArrival?.y ?? (Number(savedWorldSession?.player?.y) || 290), hp:Number.isFinite(savedWorldSession?.player?.hp)?savedWorldSession.player.hp:undefined, maxHp:Number.isFinite(savedWorldSession?.player?.maxHp)?savedWorldSession.player.maxHp:undefined, sp:Number.isFinite(savedWorldSession?.player?.sp)?savedWorldSession.player.sp:undefined, maxSp:Number.isFinite(savedWorldSession?.player?.maxSp)?savedWorldSession.player.maxSp:undefined, vx: 0, vy: 0, radiusX: 10, radiusY: 7, heading: 0, directionIndex: 0, hitTimer: 0, knockbackTimer: 0, jumpTimer: 0, jumpDuration: .58 },
  camera: { x: -20, y: 160 },
  target: null,
  keys: new Set(),
  attackTimer: 0,
  damageTimer: 0,
  combatPunch: { flash: 0, shake: 0, hitStop: 0 },
  autoCombat: false,
  manualRest: false,
  controlMode: 'manual',
  autoMonsterTypes: new Set(),
  autoRestEnabled: true,
  autoRestBelowPercent: 25,
  autoResumePercent: 75,
  combatTarget: null,
  attackCooldown: 0,
  heroCombat: {
    weaponFamily: 'dagger',
    attackIntervalMs: 800,
    playback: createHeroAttackPlayback(DAGGER_ATTACK_01),
    visualFx: [],
  },
  cycloneCooldown: 2.4,
  cycloneTimer: 0,
  meteorCooldown: 1.4,
  meteors: [],
  thunderStormCooldown: 0,
  thunderStorms: [],
  kills: 0,
  gold: 0,
  loot: 0,
  particles: [],
  floaters: [],
  lootFx: [],
  skillSpriteFx: [],
  cycloneHits: [],
  debug: {
    grid: false,
    pivots: false,
    labels: false,
    collisions: false,
    depth: false,
    range: true,
    hitboxes: false,
    composition: false,
  },
};
const worldBossEvent={active:biome==='worldboss80',endAt:Number(sessionStorage.getItem('bunny-world:worldboss80:endAt'))||Date.now()+WORLD_BOSS_WINDOW_MS,totalDamage:0,startedAt:Date.now(),nextCastAt:2.5,castIndex:0,telegraphs:[],finished:false,rewardGranted:false,rank:null};

if (qaMode === 'behind-tree') Object.assign(state.player, { x: 405, y: 30, heading: 180, directionIndex: 4 });
if (qaMode === 'front-tree') Object.assign(state.player, { x: 405, y: 135, heading: 0, directionIndex: 0 });
if (qaMode === 'ruin-side') Object.assign(state.player, { x: -500, y: 150, heading: 90, directionIndex: 2 });
if (qaMode === 'combat') Object.assign(state.player, { x: 20, y: 315, heading: 0, directionIndex: 0 });
if (qaMode === 'circle') Object.assign(state.player, { x: 500, y: 80, heading: 180, directionIndex: 4 });
if (qaMode && qaMode !== 'blockout') Object.assign(state.camera, { x: state.player.x - 30, y: state.player.y - 90 });

const sceneMetadata = {
  projection: '2:1 isometric camera plane', light: 'upper-left', shadow: 'lower-right',
  spawn: { x: -90, y: 290 }, eventSocket: { x: 10, y: -328 },
  clearings: [
    { id: 'SMALL COMBAT', x: -390, y: -40, rx: 175, ry: 105 },
    { id: 'MEDIUM COMBAT', x: 30, y: 280, rx: 280, ry: 165 },
    { id: 'LANDMARK / EVENT', x: 10, y: -310, rx: 190, ry: 105 },
  ],
  occlusionTests: [{ x: 405, y: 80 }, { x: -510, y: 170 }, { x: 250, y: 480 }],
};
window.__GOLDEN_SCENE__ = sceneMetadata;
const biomeTitle = document.querySelector('#biome-title');
if (biomeTitle) biomeTitle.textContent = (biome === 'worldboss80'||biome === 'mine' || biome === 'forest1' || biome === 'forest2' || biome.startsWith('desert')) ? `${activeMap.title.toUpperCase()} · ${activeMap.level} · BOSS: ${activeMap.boss}` : `${biome.toUpperCase()} · ARENA VARIANT 01`;
const blenderStage = document.querySelector('#blender-stage');
if (blenderStage) {
  blenderStage.hidden = !blenderMode;
  const img = blenderStage.querySelector('img');
  if (img && worldCropMode) img.src = '../blender-pixel-terrain/blender_world_crop.png';
}
if (blenderMode) canvas.classList.add('blender-overlay');

const townProps = [
  {type:'townHall',x:0,y:-520,size:1.35,seed:801},
  {type:'house',x:-500,y:-430,size:1.12,seed:802,roof:'red'},{type:'house',x:500,y:-430,size:1.12,seed:803,roof:'blue'},
  {type:'shop',x:-690,y:-80,size:1.05,seed:804,sign:'ITEM'},{type:'shop',x:690,y:-80,size:1.05,seed:805,sign:'GEAR'},
  {type:'house',x:-760,y:390,size:1.08,seed:806,roof:'blue'},{type:'house',x:760,y:390,size:1.08,seed:807,roof:'red'},
  {type:'fountain',x:0,y:20,size:1.15,seed:808},
  {type:'lamp',x:-250,y:-180,size:1,seed:809},{type:'lamp',x:250,y:-180,size:1,seed:810},
  {type:'lamp',x:-250,y:250,size:1,seed:811},{type:'lamp',x:250,y:250,size:1,seed:812},
  {type:'stall',x:-420,y:190,size:1,seed:813},{type:'stall',x:420,y:190,size:1,seed:814},
  {type:'tree',family:'broad',x:-980,y:-600,size:1.2,seed:815},{type:'tree',family:'broad',x:980,y:-600,size:1.2,seed:816},
  {type:'tree',family:'broad',x:-980,y:650,size:1.2,seed:817},{type:'tree',family:'broad',x:980,y:650,size:1.2,seed:818},
  {type:'bush',x:-570,y:650,size:1,seed:819},{type:'bush',x:570,y:650,size:1,seed:820}
];
const forest1Props = [
  { type:'tree', family:'moonroot', x:-250,y:-430,size:1.18,seed:1 }, { type:'tree',family:'broad',x:270,y:-445,size:1.14,seed:2 },
  { type:'tree', family:'spire',x:-500,y:-330,size:1.08,seed:3 }, { type:'tree',family:'broad',x:530,y:-330,size:1.22,seed:4 },
  { type:'shrine',x:10,y:-302,size:1.08,seed:70,landmark:true }, { type:'ruin',x:-175,y:-245,size:.95,seed:71 }, { type:'ruin',x:185,y:-225,size:1.05,seed:72 },
  { type:'tree',family:'broad',x:-690,y:-120,size:1.14,seed:5 }, { type:'tree',family:'spire',x:-685,y:150,size:1.05,seed:6 },
  { type:'tree',family:'moonroot',x:-520,y:330,size:1.2,seed:7 }, { type:'ruin',x:-510,y:170,size:1.05,seed:73 },
  { type:'rock',variant:'large',x:-590,y:425,size:1.1,seed:31 }, { type:'rock',variant:'medium',x:-310,y:100,size:.9,seed:32 },
  { type:'tree',family:'moonroot',x:405,y:80,size:1.28,seed:8,heroTree:true }, { type:'tree',family:'spire',x:700,y:135,size:1.14,seed:9 },
  { type:'tree',family:'broad',x:660,y:430,size:1.22,seed:10 }, { type:'ruin',x:520,y:365,size:1.18,seed:75 },
  { type:'rock',variant:'large',x:590,y:-80,size:1.08,seed:33 }, { type:'rock',variant:'small',x:315,y:300,size:.72,seed:34 },
  { type:'tree',family:'broad',x:-760,y:610,size:1.3,seed:11 }, { type:'tree',family:'spire',x:-410,y:760,size:1.12,seed:12 },
  { type:'tree',family:'moonroot',x:430,y:770,size:1.25,seed:13 }, { type:'tree',family:'broad',x:790,y:650,size:1.34,seed:14 },
  { type:'log',x:-255,y:565,size:.95,seed:50 }, { type:'rock',variant:'medium',x:165,y:635,size:.92,seed:35 },
  { type:'bush',x:-245,y:-120,size:.92,seed:40 }, { type:'bush',x:230,y:-92,size:1.04,seed:41 }, { type:'bush',x:-340,y:390,size:.85,seed:42 },
  { type:'bush',x:250,y:480,size:.92,seed:43 }, { type:'bush',x:515,y:565,size:1.04,seed:44 },
];
const forest2Props = [
  {type:'tree',family:'moonroot',x:-535,y:-405,size:1.34,seed:101},{type:'tree',family:'broad',x:-290,y:-455,size:1.18,seed:102},
  {type:'tree',family:'spire',x:470,y:-390,size:1.32,seed:103},{type:'tree',family:'moonroot',x:650,y:-190,size:1.22,seed:104},
  {type:'ruin',x:-420,y:-235,size:1.12,seed:105},{type:'rock',variant:'large',x:320,y:-255,size:1.18,seed:106},
  {type:'tree',family:'broad',x:-675,y:35,size:1.28,seed:107},{type:'tree',family:'spire',x:610,y:115,size:1.2,seed:108},
  {type:'log',x:-365,y:120,size:1.12,seed:109},{type:'ruin',x:410,y:185,size:1.16,seed:110},
  {type:'tree',family:'moonroot',x:-610,y:420,size:1.3,seed:111},{type:'tree',family:'broad',x:-360,y:585,size:1.22,seed:112},
  {type:'tree',family:'spire',x:430,y:590,size:1.25,seed:113},{type:'tree',family:'moonroot',x:690,y:455,size:1.36,seed:114},
  {type:'rock',variant:'medium',x:-110,y:505,size:.95,seed:115},{type:'rock',variant:'small',x:535,y:355,size:.8,seed:116},
  {type:'bush',x:-470,y:280,size:1.02,seed:117},{type:'bush',x:455,y:-65,size:.94,seed:118},{type:'bush',x:280,y:430,size:1.08,seed:119},
];
const desert1Props = [
  {type:'rock',variant:'large',x:-650,y:-390,size:1.2,seed:201},{type:'rock',variant:'medium',x:-420,y:-300,size:.95,seed:202},
  {type:'ruin',x:260,y:-360,size:1.08,seed:203},{type:'rock',variant:'small',x:520,y:-270,size:.78,seed:204},
  {type:'rock',variant:'medium',x:-570,y:40,size:1.05,seed:205},{type:'ruin',x:430,y:90,size:1.12,seed:206},
  {type:'rock',variant:'large',x:-410,y:430,size:1.14,seed:207},{type:'rock',variant:'small',x:180,y:510,size:.82,seed:208},
  {type:'rock',variant:'medium',x:610,y:420,size:1.0,seed:209},
];
const desert2Props = [
  {type:'ruin',x:-520,y:-410,size:1.18,seed:221},{type:'rock',variant:'large',x:500,y:-420,size:1.22,seed:222},
  {type:'rock',variant:'small',x:-180,y:-260,size:.82,seed:223},{type:'ruin',x:120,y:-190,size:1.0,seed:224},
  {type:'rock',variant:'medium',x:-680,y:180,size:1.08,seed:225},{type:'rock',variant:'large',x:650,y:120,size:1.12,seed:226},
  {type:'ruin',x:-210,y:470,size:1.15,seed:227},{type:'rock',variant:'small',x:350,y:560,size:.76,seed:228},
];
const worldBoss80Props=[
  {type:'ruin',x:-720,y:-520,size:1.45,seed:901},{type:'ruin',x:720,y:-520,size:1.45,seed:902},
  {type:'ruin',x:-820,y:40,size:1.35,seed:903},{type:'ruin',x:820,y:40,size:1.35,seed:904},
  {type:'ruin',x:-700,y:560,size:1.42,seed:905},{type:'ruin',x:700,y:560,size:1.42,seed:906},
  {type:'shrine',x:0,y:-690,size:1.55,seed:907}
];
const props = biome === 'town' ? townProps : biome === 'worldboss80' ? worldBoss80Props : biome === 'mine' ? MINE_PROPS : biome === 'forest2' ? forest2Props : biome === 'desert1' ? desert1Props : biome === 'desert2' ? desert2Props : forest1Props;

for (const prop of props) {
  if (prop.type === 'tree') prop.collider = { rx: 15 * prop.size, ry: 9 * prop.size };
  if (prop.type === 'rock') prop.collider = { rx: (prop.variant === 'large' ? 31 : prop.variant === 'small' ? 14 : 23) * prop.size, ry: (prop.variant === 'large' ? 17 : prop.variant === 'small' ? 8 : 13) * prop.size };
  if (prop.type === 'log') prop.collider = { rx: 39 * prop.size, ry: 10 * prop.size };
  if (prop.type === 'ruin') prop.collider = { rx: 34 * prop.size, ry: 12 * prop.size };
  if (prop.type === 'shrine') prop.collider = { rx: 34 * prop.size, ry: 16 * prop.size };
  if (prop.type === 'townHall') prop.collider = { rx: 88 * prop.size, ry: 30 * prop.size };
  if (prop.type === 'house' || prop.type === 'shop') prop.collider = { rx: 58 * prop.size, ry: 24 * prop.size };
  if (prop.type === 'fountain') prop.collider = { rx: 38 * prop.size, ry: 18 * prop.size };
  if (prop.type === 'stall') prop.collider = { rx: 34 * prop.size, ry: 13 * prop.size };
  if (prop.type === 'mineWall') prop.collider = { rx: 42 * prop.size, ry: 18 * prop.size };
  if (prop.type === 'mineRock') prop.collider = { rx: 27 * prop.size, ry: 14 * prop.size };
  if (prop.type === 'mineCart') prop.collider = { rx: 30 * prop.size, ry: 11 * prop.size };
  if (prop.type === 'timber' || prop.type === 'brokenTimber') prop.collider = { rx: 25 * prop.size, ry: 9 * prop.size };
}

const isRosterMap = biome === 'mine' || biome === 'forest1' || biome === 'forest2' || biome.startsWith('desert');
const isWorldBoss80=biome==='worldboss80';
const activePool = biome==='town' ? [] : isRosterMap ? activeMap.pool : ['mossblob1','sporekin1','acorn1','twig1'];
// Bosses are time-gated, never rerolled by page refresh. QA combat can still force one.
const bossDue=isRosterMap&&Date.now()>=worldSession.bossNextAt;
const bossWave=isRosterMap&&(qaMode==='combat'||worldSession.bossAlive||bossDue);
if(bossWave&&qaMode!=='combat'&&!worldSession.bossAlive){worldSession.bossAlive=true;worldSession.bossSpawnId=`${biome}:${worldSession.bossNextAt}`;saveWorldSession();}
// Field population baseline. Forest 1 is intentionally dense with passive low-level mobs
// so a fresh character always has viable leveling targets; later maps are less dense because they aggro.
const fieldPopulation = biome === 'town'||isWorldBoss80 ? 0 : biome === 'forest1' ? 36 : biome === 'forest2' ? 28 : biome.startsWith('desert') ? 24 : 12;
const normalSpawnCount = bossWave ? Math.max(12, Math.round(fieldPopulation * .7)) : fieldPopulation;
function stableSpawnUnit(index,salt=0){const seed=[...biome].reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),2166136261)^(index*2654435761)^(salt*2246822519);let x=seed>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967295;}
function stableMapSpawn(index,count,minHeroDistance=90){
  // Stable stratified field population: one spawn slot per cell, with deterministic jitter.
  // This prevents stacked clusters while still filling the middle of the map.
  const margin=90,width=WORLD.maxX-WORLD.minX-margin*2,height=WORLD.maxY-WORLD.minY-margin*2;
  const cols=Math.max(1,Math.ceil(Math.sqrt(count*width/height))),rows=Math.max(1,Math.ceil(count/cols));
  const cellW=width/cols,cellH=height/rows,col=index%cols,row=Math.floor(index/cols);
  const jitterX=(stableSpawnUnit(index,17)-.5)*cellW*.52,jitterY=(stableSpawnUnit(index,29)-.5)*cellH*.52;
  let x=WORLD.minX+margin+(col+.5)*cellW+jitterX,y=WORLD.minY+margin+(row+.5)*cellH+jitterY;
  if(Math.hypot(x-state.player.x,y-state.player.y)<minHeroDistance){
    const angle=stableSpawnUnit(index,41)*Math.PI*2;x=state.player.x+Math.cos(angle)*minHeroDistance;y=state.player.y+Math.sin(angle)*minHeroDistance;
  }
  x=Math.max(WORLD.minX+margin,Math.min(WORLD.maxX-margin,x));y=Math.max(WORLD.minY+margin,Math.min(WORLD.maxY-margin,y));
  // Safe zones are spawn-free. Push deterministic field spawns outside the nearest portal buffer.
  for(const portal of warpPortals){const dx=x-portal.x,dy=y-portal.y,d=Math.hypot(dx,dy);if(d<SAFE_ZONE_RADIUS+80){const a=d>1?Math.atan2(dy,dx):stableSpawnUnit(index,73)*Math.PI*2;x=portal.x+Math.cos(a)*(SAFE_ZONE_RADIUS+80);y=portal.y+Math.sin(a)*(SAFE_ZONE_RADIUS+80);}}
  return{x:Math.max(WORLD.minX+margin,Math.min(WORLD.maxX-margin,x)),y:Math.max(WORLD.minY+margin,Math.min(WORLD.maxY-margin,y))};
}
const mineActiveSpawns = biome === 'mine' ? MINE_SPAWNS.filter(spawn => !spawn.boss || qaMode === 'boss') : [];
let monsters = biome === 'mine' ? mineActiveSpawns.map((spawn,i)=>{
  const asset=MINE_MONSTERS[spawn.monster] || MINE_BOSSES[spawn.monster];
  // Mine uses authored dungeon spawn points. Never stage mobs in a ring around the hero.
  const x=spawn.x,y=spawn.y;
  return {kind:spawn.boss?'boss':'small',monsterType:spawn.monster,name:asset.name,isBoss:!!spawn.boss,elite:asset.tier==='elite',x,y,size:spawn.boss?92:asset.tier==='elite'?64:52,spriteScale:spawn.boss?1.65:asset.tier==='elite'?2.68:2.15,speed:spawn.boss?52:68,targetX:x,targetY:y,phase:i*1.7,radiusX:spawn.boss?20:11,radiusY:spawn.boss?12:7,hp:spawn.boss?8:1,maxHp:spawn.boss?8:1,spawnX:x,spawnY:y,dead:false,aggressive:false,aggroRange:spawn.boss?300:spawn.monster==='goblinForeman'?190:150,facing:'right',anim:'walk',animTimer:0,hurtTimer:0,flashTimer:0,attackTimer:0,deathTimer:0,ambient:spawn.ambient || null,respawn:spawn.boss?9999:undefined};
}) : Array.from({ length: normalSpawnCount }, (_, i) => {
  const {x,y}=stableMapSpawn(i,normalSpawnCount,90);
  // Bias the onboarding field toward genuinely low-level targets instead of distributing
  // every roster member equally. Higher-level/elite variants still exist, just less often.
  const forest1LevelingPool=['mossblob1','mossblob1','mossblob1','mossblob3','mossblob3','sporekin1','sporekin1','sporekin3','mossblob2','sporekin2'];
  const spawnPool=biome==='forest1'?forest1LevelingPool:activePool;
  const monsterType = spawnPool[i % spawnPool.length];
  const family = monsterType.replace(/\d+$/,'');
  const asset = FOREST_MONSTERS[monsterType] || DESERT_MONSTERS[monsterType];
  return {
    kind:'small', monsterType, name:asset.name, elite:!!asset.elite,
    x, y, size:asset.elite ? 64 : 52, spriteScale:asset.elite ? 2.68 : 2.15, speed:family === 'twig' ? 78 : family === 'mossblob' ? 64 : 70,
    targetX:x, targetY:y, phase:i*1.7, aggroRange:asset.elite?190:150,
    radiusX:11, radiusY:7, hp:1, maxHp:1, spawnX:x, spawnY:y,
    dead:false, aggressive:false, facing:'right', anim:'walk', animTimer:0, hurtTimer:0, flashTimer:0, attackTimer:0, deathTimer:0
  };
});
if(isWorldBoss80){
  monsters=[{id:'worldboss80-dragon',kind:'boss',monsterType:'greatMythicDragon',name:'Great Mythic Fire Dragon',isBoss:true,level:80,levelOverride:80,maxHpOverride:100000,x:0,y:-180,size:138,spriteScale:3.15,speed:34,targetX:0,targetY:-180,phase:0,radiusX:34,radiusY:20,hp:100000,maxHp:100000,spawnX:0,spawnY:-180,dead:false,aggressive:false,aggroRange:0,facing:'right',anim:'walk',animTimer:0,hurtTimer:0,flashTimer:0,attackTimer:0,deathTimer:0,respawn:9999}];
}
if (bossWave && biome !== 'mine') {
  const bossType = biome.startsWith('desert') ? activeMap.bossType : biome === 'forest2' ? 'thornroot' : 'mushroom';
  const bossName = biome.startsWith('desert') ? activeMap.boss : biome === 'forest2' ? 'Thornroot Warden' : 'Mushroom Brute';
  const {x,y}=stableMapSpawn(normalSpawnCount,normalSpawnCount+1,260);
  monsters.push({kind:'boss',monsterType:bossType,name:bossName,isBoss:true,x,y,size:92,spriteScale:1.65,speed:52,targetX:x,targetY:y,phase:2.3,radiusX:20,radiusY:12,hp:8,maxHp:8,spawnX:x,spawnY:y,dead:false,aggressive:false,aggroRange:300,facing:'right',anim:'walk',animTimer:0,hurtTimer:0,flashTimer:0,attackTimer:0,deathTimer:0,respawn:9999});
}

// V2 CUTOVER: combat state is authoritative in BunnySimulation.
// The objects below remain presentation objects only; HP/death are mirrored out from V2.
for (let i=0;i<monsters.length;i++) {
  const monster=monsters[i];
  monster.id = monster.id || `${monster.monsterType}-${i}`;
  const def=MONSTERS_V2[monster.monsterType];
  if (def) { monster.level=def.level; monster.attackRange=def.attackRange; monster.speed=def.moveSpeed; }
}
const CHARACTER_SAVE_KEY='bunny-world:v2:arena-character';
function loadArenaCharacter(){
  try{
    const raw=localStorage.getItem(CHARACTER_SAVE_KEY);
    if(raw){
      const saved=JSON.parse(raw);
      if(saved?.schemaVersion===2&&saved?.characterId==='arena-player'){
        // One-time starter migration for saves created before the starter dagger existed.
        // Never duplicates or replaces a real main-hand item.
        const instances=saved.equipment?.instances||{};
        const equipped=saved.equipment?.equippedBySlot||{};
        const hasStarter=Boolean(instances['starter-dagger']);
        // Migrate the original starter dagger from ATK 4 to ATK 19 (+15) without touching upgraded/replaced gear.
        if(hasStarter&&instances['starter-dagger']?.templateId==='starterDagger'&&instances['starter-dagger']?.baseCombat?.atk===4){
          instances['starter-dagger'].baseCombat.atk=19;
          localStorage.setItem(CHARACTER_SAVE_KEY,JSON.stringify(saved));
        }
        if(!hasStarter&&!equipped.main){
          const fresh=createInitialCharacterV2('arena-player',saved.name||'Arena Bunny');
          saved.equipment={...saved.equipment,instances:{...instances,'starter-dagger':fresh.equipment.instances['starter-dagger']},equippedBySlot:{...equipped,main:'starter-dagger'}};
          localStorage.setItem(CHARACTER_SAVE_KEY,JSON.stringify(saved));
        }
        return saved;
      }
    }
  }catch(error){console.warn('Character save load failed; starting fresh.',error);}
  return createInitialCharacterV2('arena-player','Arena Bunny');
}
function saveArenaCharacter(character){try{localStorage.setItem(CHARACTER_SAVE_KEY,JSON.stringify(character));}catch(error){console.warn('Character save failed.',error);}}
const arenaCharacter=loadArenaCharacter();
// Temporary live-test grant for the three newly wired Skill Cores. Keep normal loot progression intact; only ensure one test copy exists.
for(const coreId of ['meteorStorm','cyclone','blackHole'])arenaCharacter.inventory[coreId]=Math.max(1,arenaCharacter.inventory[coreId]??0);
function equippedMainWeaponFamily(character){const id=character?.equipment?.equippedBySlot?.main,item=id?character.equipment.instances?.[id]:null;return item?(EQUIPMENT_MASTER_V2[item.templateId]?.weaponFamily??'dagger'):'dagger';}
state.heroCombat.weaponFamily=equippedMainWeaponFamily(arenaCharacter);
// Start with the authoritative default loadout. Skills are earned/equipped through progression; no demo combat skills are injected here.
const arenaV2 = new ArenaV2Adapter({
  character: arenaCharacter,
  zoneId: biome,
  player: state.player,
  monsters,
  weaponFamily: state.heroCombat.weaponFamily,
  safeZoneContains: ({x,y}) => pointInsideSafeZone(x,y),
  // Forest1 uses the same authored walk-height grid as the standalone Dimraeth maps (town included).
  // This constrains both the hero and simulation-owned monsters to real terrain/stairs instead of
  // treating the new map as a background image.
  walkableContains: useForestEngine ? ({x,y}) => {
    if(!forestEngineReady)return true;
    const z=runtimeWalkHeight(x,y);
    return z!==null&&canRuntimeActorStand(x,y,z);
  } : undefined,
  onReward: (reward, character, defeated) => {
    const beforeMastery=loadArenaCharacter()?.weaponMastery?.[state.heroCombat.weaponFamily];
    saveArenaCharacter(character);
    state.gold = character.gold;
    state.loot = Object.values(character.inventory).reduce((sum, qty) => sum + qty, 0);
    spawnLootFx({...reward,enemyId:defeated?.id,enemyType:defeated?.monsterType});
    for(const [id,qty] of Object.entries(reward.loot.items).filter(([,qty])=>qty>0))pushRewardLine(`ได้รับ ${prettyItem(id)} ${qty} ea`);
    if(reward.exp>0)pushRewardLine(`ได้รับ ${reward.exp} EXP`);
    const afterMastery=character.weaponMastery?.[state.heroCombat.weaponFamily];const masteryGain=beforeMastery&&afterMastery?Math.max(0,(afterMastery.level-beforeMastery.level)*100+afterMastery.xp-beforeMastery.xp):0;if(masteryGain>0)pushRewardLine(`ได้รับ ${masteryGain} XP Mastery`);
    if(reward.loot.gold>0)pushRewardLine(`ได้รับ ${reward.loot.gold} Gold`);
    // Keep an already-open Mastery panel live instead of requiring close/reopen.
    if(!gameWindow.hidden&&skillsHubUi?.tab==='mastery'&&gameWindowBody.querySelector('#skills-hub-content'))renderSkillsHub();
  },
});
const worldBossHud=document.createElement('div');worldBossHud.className='world-boss-live-hud';worldBossHud.hidden=!worldBossEvent.active;worldBossHud.innerHTML='<small>WORLD BOSS · LV.80</small><strong data-wb-time>05:00</strong><span>DMG <b data-wb-damage>0</b> · DPS <b data-wb-dps>0</b></span>';document.querySelector('.viewport-frame')?.appendChild(worldBossHud);
const worldBossResult=document.createElement('div');worldBossResult.className='world-boss-result';worldBossResult.hidden=true;document.querySelector('.viewport-frame')?.appendChild(worldBossResult);
function finishWorldBoss(reason){if(!worldBossEvent.active||worldBossEvent.finished)return;worldBossEvent.finished=true;worldBossEvent.telegraphs.length=0;arenaV2.move({x:0,y:0});state.autoCombat=false;state.combatTarget=null;const elapsed=Math.max(1,(Date.now()-worldBossEvent.startedAt)/1000),rank=worldBossEvent.rank,bonus=rank===1?3:rank&&rank<=3?2:rank&&rank<=10?1:0,each=2+bonus;if(!worldBossEvent.rewardGranted){const c=arenaV2.grantEventItems({optionStone:each,reoptionStone:each});saveArenaCharacter(c);worldBossEvent.rewardGranted=true;}worldBossResult.hidden=false;worldBossResult.innerHTML=`<div><small>WORLD BOSS RESULT</small><h2>${reason==='defeated'?'DRAGON DEFEATED':'TIME UP'}</h2><p>Total Damage <b>${Math.round(worldBossEvent.totalDamage).toLocaleString()}</b></p><p>Average DPS <b>${Math.round(worldBossEvent.totalDamage/elapsed).toLocaleString()}</b></p><p>Rank <b>${rank??'Pending server ranking'}</b></p><p>Reward <b>Option Stone ×${each} · Re-option Stone ×${each}</b></p><button data-wb-leave>RETURN TO BUNNY HAVEN</button></div>`;worldBossResult.querySelector('[data-wb-leave]').onclick=()=>{const u=new URL(location.href);u.searchParams.set('biome','town');u.searchParams.set('from','worldboss80');location.assign(u.toString());};}
function worldBossCast(){const boss=monsters.find(m=>m.monsterType==='greatMythicDragon'&&!m.dead);if(!boss||worldBossEvent.finished)return;const skills=[{kind:'meteorStorm',name:'METEOR',radius:118,damage:.62,target:'player'},{kind:'groundSlam',name:'GROUND SLAM',radius:175,damage:.78,target:'boss'},{kind:'combustion',name:'COMBUSTION',radius:135,damage:.68,target:'player'}],skill=skills[worldBossEvent.castIndex++%skills.length],center=skill.target==='boss'?{x:boss.x,y:boss.y}:{x:state.player.x,y:state.player.y};worldBossEvent.telegraphs.push({...skill,x:center.x,y:center.y,age:0,duration:2});boss.bossAttackPhase=true;boss.bossAttackKind=skill.kind;}
function updateWorldBossEvent(dt){if(!worldBossEvent.active||worldBossEvent.finished)return;const boss=monsters.find(m=>m.monsterType==='greatMythicDragon');if(!boss)return;const remaining=Math.max(0,worldBossEvent.endAt-Date.now());if(remaining<=0){finishWorldBoss('timeout');return;}if(boss.dead){finishWorldBoss('defeated');return;}worldBossEvent.nextCastAt-=dt;if(worldBossEvent.nextCastAt<=0){worldBossCast();worldBossEvent.nextCastAt=5.5;}for(const t of [...worldBossEvent.telegraphs]){t.age+=dt;if(t.age<2)continue;const d=Math.hypot(state.player.x-t.x,state.player.y-t.y),player=arenaV2.simulation.world.players.get(arenaV2.playerId);if(player?.alive&&d<=t.radius){const events=arenaV2.applyBossHazardDamage(boss.id,Math.max(1,Math.round(player.maxHp*t.damage)));presentV2Events(events);}state.skillSpriteFx.push({kind:t.kind,x:t.x,y:t.y,age:0,duration:t.kind==='meteorStorm'?.82:.72});worldBossEvent.telegraphs.splice(worldBossEvent.telegraphs.indexOf(t),1);boss.bossAttackPhase=false;}const secs=Math.ceil(remaining/1000),elapsed=Math.max(1,(Date.now()-worldBossEvent.startedAt)/1000);worldBossHud.querySelector('[data-wb-time]').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;worldBossHud.querySelector('[data-wb-damage]').textContent=Math.round(worldBossEvent.totalDamage).toLocaleString();worldBossHud.querySelector('[data-wb-dps]').textContent=Math.round(worldBossEvent.totalDamage/elapsed).toLocaleString();}
function updateWorldBossBanner(){if(!worldBossEventBanner||biome==='worldboss80')return;const open=worldBossWindowOpen(),used=WORLD_BOSS_DEV_OPEN?0:worldBossEntries(),b=worldBossEventBanner.querySelector('b'),small=worldBossEventBanner.querySelector('small');if(open&&used<WORLD_BOSS_ENTRY_LIMIT){b.textContent=`ENTER INSTANCE · ${used}/3 ›`;small.textContent='Hall of the Fallen Crown · OPEN NOW · 5 MIN';}else if(used>=WORLD_BOSS_ENTRY_LIMIT){b.textContent='DAILY LIMIT · 3/3';small.textContent='Next entries reset tomorrow';}else{const sec=Math.max(0,Math.ceil((nextWorldBossAt()-Date.now())/1000));b.textContent=`NEXT ${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec%3600/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;small.textContent='Fire Dragon · every 2 hours · 3 entries/day';}}
function drawWorldBossTelegraphs(){if(!worldBossEvent.active||worldBossEvent.finished)return;for(const t of worldBossEvent.telegraphs){const p=worldToScreen(t.x,t.y),pulse=.45+.25*Math.sin(state.time*10),r=t.radius,remain=Math.max(0,2-t.age);ctx.save();ctx.fillStyle=`rgba(220,30,30,${pulse})`;ctx.strokeStyle='rgba(255,90,65,.95)';ctx.lineWidth=3;ctx.setLineDash([9,6]);ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.48,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff0e8';ctx.font='900 12px system-ui';ctx.textAlign='center';ctx.fillText(`${t.name} · ${remain.toFixed(1)}s`,p.x,p.y-r*.48-9);ctx.restore();}}
function lootDropChance(source,itemId){const rolls=[{itemId:source.oreItemId,chance:.12},{itemId:'astraliteStone',chance:.02},source.material,source.aetherstone,source.modifier,source.core,source.blueprint,source.unique,source.signatureMaterial,...(source.equipmentDrops||[])].filter(Boolean);return rolls.find(r=>r.itemId===itemId)?.chance??1;}
function lootFxTier(chance){return chance>=.20?'white':chance>=.10?'green':chance>=.03?'blue':chance>=.005?'purple':'gold';}
function spawnLootFx(reward){const source=MONSTERS_V2[reward.enemyType]?.loot;const defeated=monsters.find(m=>m.id===reward.enemyId);if(!source||!defeated)return;let i=0;for(const[id,qty]of Object.entries(reward.loot.items).filter(([,q])=>q>0)){const chance=lootDropChance(source,id),tier=lootFxTier(chance);for(let n=0;n<Math.min(qty,4);n++){const angle=((i++*.93)+n*.7)-1.4;state.lootFx.push({id,tier,x:defeated.x,y:defeated.y,vx:Math.cos(angle)*42,vy:Math.sin(angle)*30-34,age:0,delay:.30+i*.055,duration:1.05});}}}
function syncArenaV2Positions(){ /* V2 positions are simulation-owned; presentation never writes inward. */ }

const EQUIPMENT_SLOTS=['armor','cape','shoes','accessoryLeft','accessoryRight','hat','face','mouth','main','offhand'];
const equipmentUi={tab:'Gear',selectedId:null,tier:'all',slot:'all'};
const GEAR_SLOT_FILTERS=[['all','All Parts'],['main','Main'],['offhand','Offhand'],['armor','Armor'],['cape','Cape'],['shoes','Shoes'],['accessory','Accessory'],['hat','Hat'],['face','Face'],['mouth','Mouth']];
function gearMatchesFilter(item){const template=EQUIPMENT_MASTER_V2[item.templateId],tier=template?.tier;if(equipmentUi.tier!=='all'&&tier!==Number(equipmentUi.tier))return false;const s=equipmentUi.slot;if(s==='all')return true;if(s==='accessory')return item.slot==='accessoryLeft'||item.slot==='accessoryRight';return item.slot===s;}
let rewardFeed;
function ensureRewardFeed(){if(rewardFeed)return rewardFeed;rewardFeed=document.createElement('div');rewardFeed.className='reward-feed';document.querySelector('.viewport-frame')?.append(rewardFeed);return rewardFeed;}
function pushRewardLine(text){const feed=ensureRewardFeed(),line=document.createElement('div');line.className='reward-line';line.textContent=text;feed.append(line);while(feed.children.length>8)feed.firstElementChild?.remove();setTimeout(()=>{line.classList.add('leaving');setTimeout(()=>line.remove(),250);},4200);}
const equipmentToggle=document.createElement('button');equipmentToggle.className='equipment-toggle';equipmentToggle.textContent='GEAR / INVENTORY';
const equipmentPanel=document.createElement('section');equipmentPanel.className='equipment-panel';equipmentPanel.hidden=true;
const equipmentDetailModal=document.createElement('section');equipmentDetailModal.className='equipment-detail-modal';equipmentDetailModal.hidden=true;
// Legacy lower-right Gear/Inventory toggle retired. The panel is reused only inside the top-right menu window.
document.querySelector('.viewport-frame')?.append(equipmentPanel,equipmentDetailModal);
function equipmentAction(command){
  try{
    const selectedId=equipmentUi.selectedId;
    const keepUpgradeModal=(command.type==='enhance'||command.type==='refine'||command.type==='addOption'||command.type==='reoption')&&selectedId&& !equipmentDetailModal.hidden;
    const result=arenaV2.equipmentCommand(command);saveArenaCharacter(arenaV2.character);
    // Presentation state must follow the authoritative build immediately; previously it only refreshed on page load.
    if(command.type==='equip'||command.type==='unequip'){state.heroCombat.weaponFamily=equippedMainWeaponFamily(arenaV2.character);state.heroCombat.playback.active=false;state.heroCombat.playback.queued=false;}
    if(command.type==='refine')showRefineResult(result.refineSuccess===true);
    // Keep the same item and upgrade view open after Enhance/Refine so repeated attempts need one click only.
    if((command.type==='enhance'||command.type==='refine'||command.type==='addOption'||command.type==='reoption')&&selectedId&&arenaV2.character.equipment.instances[selectedId]){
      equipmentUi.selectedId=selectedId;renderEquipmentUi();
      const item=arenaV2.character.equipment.instances[selectedId],detail=equipmentPanel.querySelector('.rpg-detail-panel');
      const upgradeMode=command.type==='refine'?'refine':(command.type==='addOption'||command.type==='reoption')?'option':'enhance';if(keepUpgradeModal){equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card">${upgradeHtml(item,arenaV2.character,upgradeMode)}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;bindEquipmentActionButtons(equipmentDetailModal);}else if(detail){detail.innerHTML=upgradeHtml(item,arenaV2.character,upgradeMode);bindEquipmentActionButtons();}
    }else{equipmentUi.selectedId=null;renderEquipmentUi();if(command.type==='equip'&&!equipmentDetailModal.hidden)equipmentDetailModal.hidden=true;}
  }catch(error){showEquipmentError(String(error?.message||error));}
}
function showEquipmentError(message){let toast=document.querySelector('.equipment-result-toast');if(!toast){toast=document.createElement('div');toast.className='equipment-result-toast error';document.querySelector('.viewport-frame')?.append(toast);}toast.className='equipment-result-toast error show';toast.textContent=message;clearTimeout(showEquipmentError.timer);showEquipmentError.timer=setTimeout(()=>toast.classList.remove('show'),1500);}
function showCraftSuccess(item){
 const c=arenaV2.character;
 equipmentUi.selectedId=item.id;
 equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card craft-success-card"><div class="craft-success-heading">CRAFT SUCCEEDED!</div>${itemDetailHtml(item,c,false)}</div>`;
 equipmentDetailModal.hidden=false;
 equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;
 bindEquipmentActionButtons(equipmentDetailModal);
}
function showBatchCraftResults(items,name){let page=0;const pages=[];for(let i=0;i<items.length;i+=10)pages.push(items.slice(i,i+10));const render=()=>{const batch=pages[page],summary=Object.entries(items.reduce((a,x)=>(a[x.rarity]=(a[x.rarity]||0)+1,a),{})).map(([r,n])=>`${r.toUpperCase()} ×${n}`).join(' · ');equipmentDetailModal.innerHTML=`<div class="batch-craft-result"><small>BATCH CRAFT · ${name}</small><h2>REVEAL ${page+1}/${pages.length}</h2><div class="batch-craft-grid">${batch.map(x=>`<div class="batch-craft-drop rarity-${x.rarity}"><span>${iconHtml(x.templateId,'equipment',gearGlyph(x.slot))}</span><strong>${x.rarity.toUpperCase()}</strong></div>`).join('')}</div><p>${summary}</p><button data-batch-next>${page<pages.length-1?'NEXT ×10':'DONE'}</button></div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('[data-batch-next]').onclick=()=>{if(page<pages.length-1){page++;render();}else equipmentDetailModal.hidden=true;};};render();}
function showRefineResult(success){let toast=document.querySelector('.equipment-result-toast');if(!toast){toast=document.createElement('div');toast.className='equipment-result-toast';document.querySelector('.viewport-frame')?.append(toast);}toast.className='equipment-result-toast '+(success?'success':'fail')+' show';toast.innerHTML=success?'<strong>REFINE SUCCEEDED!</strong><span>Refinement level increased</span>':'<strong>REFINE FAILED</strong><span>Refinement did not succeed</span>';clearTimeout(showRefineResult.timer);showRefineResult.timer=setTimeout(()=>toast.classList.remove('show'),1400);}
function gearGlyph(slot){return {armor:'◈',cape:'⌁',shoes:'⌑',accessoryLeft:'◇',accessoryRight:'◇',hat:'♢',face:'◉',mouth:'◆',main:'†',offhand:'◐'}[slot]||'◆';}
function prettyItem(id){return String(id).replace(/([A-Z])/g,' $1').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase());}
const ITEM_INFO={livingMoss:'Crafting material from Mossblobs.',brutalSpore:'Crafting material from Sporekin.',duneRunnerClaw:'Crafting material from Dunelings.',cactusSpine:'Crafting material from Cactlings.',djinnEssence:'Crafting material from Dust Djinns.',sunscarabCarapace:'Crafting material from Sunscarabs.',goblinIronScrap:'Crafting material from Goblins.',cursedBone:'Crafting material from Skeletons.',copperOre:'Early crafting ore.',ironOre:'Forest crafting ore.',moonstoneShard:'Desert crafting ore.',silverOre:'Advanced desert crafting ore.',mithrilOre:'Mine crafting ore.',verdantAetherstone:'Enhancement stone up to +40.',azureAetherstone:'Enhancement stone for +41–80.',violetAetherstone:'Enhancement stone for +81–120.',astraliteStone:'Refinement material.',cyclone:'Skill Core: Cyclone.'};
function itemInfo(id){const skill=SKILLS_V2[id],meta=inventoryItemMeta(id);if(skill&&meta.tags.includes('skill-core'))return `Skill Core: ${skill.name}. Equip it into the ${skill.kind==='movement'?'Movement':'Core 1–3'} slot.`;return ITEM_INFO[id]||(meta.category==='Blueprint'?'Equipment blueprint used for crafting.':meta.category==='Crafting Mat'?'Crafting material.':meta.category==='Upgrading Mat'?'Upgrade material.':'Adventure item.');}
function inventoryCategory(id){return inventoryCategoryFor(id);}
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
  const c=arenaV2.character,tabs=['Gear','Crafting Mat','Upgrading Mat','Blueprint','Skill Core','Quest','Misc'];
  const equippedIds=new Set(Object.values(c.equipment.equippedBySlot).filter(Boolean));
  const inventoryGear=Object.values(c.equipment.instances).filter(x=>!equippedIds.has(x.id));
  equipmentPanel.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="rpg-equipment-shell"><div class="rpg-equip-side"><div class="rpg-screen-title"><strong>GEAR</strong><span>Equipment</span></div><div class="rpg-character-stage"><div class="gear-column left">${['hat','mouth','main','cape','accessoryLeft'].map(slot=>{const id=c.equipment.equippedBySlot[slot];return gearTile(id&&c.equipment.instances[id],c,true,slot)}).join('')}</div><div class="character-silhouette"><span>🐰</span><strong>${c.name}</strong><small>LV. ${c.level}</small>${masterRefinementCard(c)}</div><div class="gear-column right">${['face','armor','offhand','shoes','accessoryRight'].map(slot=>{const id=c.equipment.equippedBySlot[slot];return gearTile(id&&c.equipment.instances[id],c,true,slot)}).join('')}</div></div><div class="rpg-detail-panel"></div></div><div class="rpg-inventory-side"><div class="rpg-screen-title"><strong>INVENTORY</strong><span>${inventoryGear.length} gear · ${c.gold} G</span></div><div class="inventory-tabs">${tabs.map(t=>`<button data-tab="${t}" class="${equipmentUi.tab===t?'active':''}">${t}</button>`).join('')}</div>${equipmentUi.tab==='Gear'?`<div class="batch-destroy-bar"><button data-batch-mode class="${batchDestroyUi.active?'active':''}">${batchDestroyUi.active?'CANCEL SELECT':'BATCH DESTROY'}</button>${batchDestroyUi.active?`<button data-select-visible>SELECT ALL FILTERED</button><button data-destroy-selected ${batchDestroyUi.selected.size?'':'disabled'}>DESTROY SELECTED (${batchDestroyUi.selected.size})</button>`:''}</div><div class="gear-filters"><div class="gear-filter-row"><span>TIER</span>${['all','1','2','3','4','5'].map(t=>`<button data-gear-tier="${t}" class="${equipmentUi.tier===t?'active':''}">${t==='all'?'ALL':'T'+t}</button>`).join('')}</div><div class="gear-filter-row gear-slot-filter"><span>PART</span>${GEAR_SLOT_FILTERS.map(([id,label])=>`<button data-gear-slot="${id}" class="${equipmentUi.slot===id?'active':''}">${label}</button>`).join('')}</div></div>`:''}<div class="inventory-grid"></div></div></div>`;
  const grid=equipmentPanel.querySelector('.inventory-grid');
  if(equipmentUi.tab==='Gear'){const visibleGear=inventoryGear.filter(gearMatchesFilter);grid.innerHTML=visibleGear.length?visibleGear.map(x=>gearTile(x,c,false)).join(''):'<div class="inventory-empty">No gear matches these filters</div>';grid.scrollTop=0;}
  else{const entries=Object.entries(c.inventory).filter(([id])=>inventoryCategory(id)===equipmentUi.tab);grid.innerHTML=entries.length?entries.map(([id,qty])=>`<button class="rpg-item-tile" data-item-info="${id}"><span class="item-glyph">${iconHtml(id,'item','◆')}</span><strong>${prettyItem(id)}</strong><b>${qty}</b></button>`).join(''):'<div class="inventory-empty">No items in this category</div>';}
  equipmentPanel.querySelector('.rpg-modal-close')?.addEventListener('click',()=>equipmentPanel.hidden=true);
  equipmentPanel.querySelectorAll('[data-item-info]').forEach(el=>el.onclick=()=>{const id=el.dataset.itemInfo,qty=c.inventory[id]??0,meta=inventoryItemMeta(id),skill=SKILLS_V2[id];const mod=SKILL_MODIFIERS_V2[id];const coreActions=meta.tags.includes('skill-core')?(skill?.kind==='movement'?'<button data-equip-movement-core="'+id+'">EQUIP MOVEMENT</button>':'<div class="core-equip-actions"><button data-equip-core="'+id+'" data-core-slot="0">EQUIP CORE 1</button><button data-equip-core="'+id+'" data-core-slot="1">EQUIP CORE 2</button><button data-equip-core="'+id+'" data-core-slot="2">EQUIP CORE 3</button></div>'):'';equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card"><div class="rpg-detail-head"><div class="rpg-item-tile"><span class="item-glyph">${iconHtml(id,'item','◆')}</span></div><div><strong>${prettyItem(id)}</strong><small>${meta.category.toUpperCase()} · ×${qty}</small></div></div>${skill&&meta.tags.includes('skill-core')?skillDetailHtml(id):mod?`<div class="skill-detail-block"><div class="skill-detail-title"><strong>${mod.name}</strong><span>SKILL MOD</span></div><p>${mod.description}</p><p class="skill-formula">Equip this Mod into MOD 1 or MOD 2 of an installed Skill Core. Its effect is applied by the authoritative combat simulation.</p></div>`:`<p class="item-description">${itemInfo(id)}</p>`}${coreActions}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;equipmentDetailModal.querySelectorAll('[data-equip-core]').forEach(b=>b.onclick=()=>{arenaV2.skillCoreCommand({type:'equipCore',coreId:b.dataset.equipCore,slot:Number(b.dataset.coreSlot)});saveArenaCharacter(arenaV2.character);equipmentDetailModal.hidden=true;syncSkillHotbar();renderEquipmentUi();renderSkillsHub();});equipmentDetailModal.querySelectorAll('[data-equip-movement-core]').forEach(b=>b.onclick=()=>{arenaV2.skillCoreCommand({type:'equipMovementCore',coreId:b.dataset.equipMovementCore});saveArenaCharacter(arenaV2.character);equipmentDetailModal.hidden=true;renderEquipmentUi();});});
  equipmentPanel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{equipmentDetailModal.hidden=true;equipmentDetailModal.replaceChildren();equipmentUi.tab=b.dataset.tab;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-gear-tier]').forEach(b=>b.onclick=()=>{equipmentUi.tier=b.dataset.gearTier;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-gear-slot]').forEach(b=>b.onclick=()=>{equipmentUi.slot=b.dataset.gearSlot;equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelector('[data-batch-mode]')?.addEventListener('click',()=>{batchDestroyUi.active=!batchDestroyUi.active;batchDestroyUi.selected.clear();equipmentUi.selectedId=null;renderEquipmentUi();});
  equipmentPanel.querySelector('[data-select-visible]')?.addEventListener('click',()=>{inventoryGear.filter(gearMatchesFilter).forEach(x=>batchDestroyUi.selected.add(x.id));renderEquipmentUi();});
  equipmentPanel.querySelector('[data-destroy-selected]')?.addEventListener('click',()=>{const ids=[...batchDestroyUi.selected].filter(id=>arenaV2.character.equipment.instances[id]);if(!ids.length)return;if(!confirm(`Destroy ${ids.length} selected gear? This cannot be undone.`))return;let destroyed=0;for(const id of ids){try{arenaV2.equipmentCommand({type:'dismantle',equipmentId:id});destroyed++;}catch{}}saveArenaCharacter(arenaV2.character);batchDestroyUi.selected.clear();batchDestroyUi.active=false;pushRewardLine(`Destroyed ${destroyed} gear`);renderEquipmentUi();});
  equipmentPanel.querySelectorAll('[data-empty-slot]').forEach(el=>el.onclick=()=>{const slot=el.dataset.emptySlot;craftUi.type=slot==='main'?'Weapon':slot==='offhand'?'Offhand':slot==='armor'?'Armor':slot==='cape'?'Cape':slot==='shoes'?'Shoes':slot==='accessoryLeft'||slot==='accessoryRight'?'Accessory':'Weapon';equipmentPanel.hidden=true;openGameWindow('Craft');});
  equipmentPanel.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>{if(batchDestroyUi.active){const id=el.dataset.id;if(batchDestroyUi.selected.has(id))batchDestroyUi.selected.delete(id);else batchDestroyUi.selected.add(id);renderEquipmentUi();return;}equipmentUi.selectedId=el.dataset.id;const item=c.equipment.instances[equipmentUi.selectedId];if(!item)return;equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card">${itemDetailHtml(item,c,equippedIds.has(item.id))}</div>`;equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;bindEquipmentActionButtons(equipmentDetailModal);});
  if(equipmentUi.selectedId&&c.equipment.instances[equipmentUi.selectedId]){const item=c.equipment.instances[equipmentUi.selectedId];equipmentPanel.querySelector('.rpg-detail-panel').innerHTML=itemDetailHtml(item,c,equippedIds.has(item.id));}
  bindEquipmentActionButtons();
}
function confirmDestroyEquipment(itemId,root=equipmentPanel){
  const item=arenaV2.character.equipment.instances[itemId];if(!item)return;
  const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');if(!host)return;
  host.innerHTML=`<div class="destroy-confirm"><strong>Are you sure you want to destroy?</strong><p>${prettyItem(item.templateId)} will be permanently destroyed.</p><div class="rpg-detail-actions"><button data-confirm-destroy="${item.id}">YES</button><button data-cancel-destroy="${item.id}">NO</button></div></div>`;
  host.querySelector('[data-cancel-destroy]')?.addEventListener('click',()=>{host.innerHTML=itemDetailHtml(item,arenaV2.character,false);bindEquipmentActionButtons(root);});
  host.querySelector('[data-confirm-destroy]')?.addEventListener('click',()=>{
    try{
      arenaV2.equipmentCommand({type:'dismantle',equipmentId:item.id});saveArenaCharacter(arenaV2.character);
      host.innerHTML='<div class="destroy-confirm destroyed"><strong>DESTROYED</strong></div>';
      equipmentUi.selectedId=null;renderEquipmentUi();
      setTimeout(()=>{if(root===equipmentDetailModal)equipmentDetailModal.hidden=true;},550);
    }catch(error){showEquipmentError(String(error?.message||error));}
  });
}

function bindEquipmentActionButtons(root=equipmentPanel){
  root.querySelectorAll('[data-equip-now]').forEach(b=>b.onclick=()=>{const id=b.dataset.equipNow,item=arenaV2.character.equipment.instances[id];if(item&&(item.slot==='accessoryLeft'||item.slot==='accessoryRight')){const slots=arenaV2.character.equipment.equippedBySlot;const target=!slots.accessoryLeft?'accessoryLeft':!slots.accessoryRight?'accessoryRight':item.slot;equipmentAction({type:'equip',equipmentId:id,targetSlot:target});}else equipmentAction({type:'equip',equipmentId:id});});
  root.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>equipmentAction({type:'unequip',slot:b.dataset.unequip}));
  root.querySelectorAll('[data-destroy]').forEach(b=>b.onclick=()=>confirmDestroyEquipment(b.dataset.destroy,root));
  root.querySelectorAll('[data-open-upgrade]').forEach(b=>b.onclick=()=>{const item=arenaV2.character.equipment.instances[b.dataset.openUpgrade];const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=upgradeHtml(item,arenaV2.character,b.dataset.upgradeMode||'enhance');bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-switch-upgrade]').forEach(b=>b.onclick=()=>{const itemId=equipmentUi.selectedId;const item=arenaV2.character.equipment.instances[itemId];if(!item)return;const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=upgradeHtml(item,arenaV2.character,b.dataset.switchUpgrade);bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-back-detail]').forEach(b=>b.onclick=()=>{const item=arenaV2.character.equipment.instances[b.dataset.backDetail];const host=root===equipmentDetailModal?root.querySelector('.equipment-detail-card'):equipmentPanel.querySelector('.rpg-detail-panel');host.innerHTML=itemDetailHtml(item,arenaV2.character,true);bindEquipmentActionButtons(root);});
  root.querySelectorAll('[data-enhance]').forEach(b=>b.onclick=()=>equipmentAction({type:'enhance',slot:b.dataset.enhance}));
  root.querySelectorAll('[data-refine]').forEach(b=>b.onclick=()=>equipmentAction({type:'refine',slot:b.dataset.refine}));
  root.querySelectorAll('[data-add-option]').forEach(b=>b.onclick=()=>equipmentAction({type:'addOption',equipmentId:b.dataset.addOption}));
  root.querySelectorAll('[data-reoption]').forEach(b=>b.onclick=()=>equipmentAction({type:'reoption',equipmentId:b.dataset.reoption,lockedIndexes:[]}));
}



const gameUi={pendingStats:{},deathUntil:0};
const menuToggle=document.querySelector('#menu-toggle'),gameMenu=document.querySelector('#game-menu'),gameWindow=document.querySelector('#game-window'),gameWindowTitle=document.querySelector('#game-window-title'),gameWindowBody=document.querySelector('#game-window-body');
const gmEvent={enabled:false,exp:2,weaponExp:2,drop:2,gold:2,upgradeItem:2,blueprint:2};
function applyGmEvent(){const active=gmEvent.enabled;arenaV2.setGmEventMultipliers({exp:active?gmEvent.exp:1,weaponExp:active?gmEvent.weaponExp:1,drop:active?gmEvent.drop:1,gold:active?gmEvent.gold:1,upgradeItem:active?gmEvent.upgradeItem:1,blueprint:active?gmEvent.blueprint:1});const banner=document.querySelector('#gm-event-banner');const details=[['CHAR EXP',gmEvent.exp],['WEAPON EXP',gmEvent.weaponExp],['DROP',gmEvent.drop],['GOLD',gmEvent.gold],['UPGRADE ITEM',gmEvent.upgradeItem],['BLUEPRINT',gmEvent.blueprint]].filter(([,v])=>v>1).map(([k,v])=>`${k} ×${v}`).join(' · ');if(banner){banner.hidden=!active;banner.querySelector('#gm-event-detail').textContent=details||'TEST EVENT';banner.querySelector('#gm-event-detail-copy').textContent=details||'TEST EVENT';}}
function renderGmEventPanel(){gameWindowTitle.textContent='GM EVENT CONTROL';const rows=[['exp','CHAR EXP'],['weaponExp','WEAPON EXP'],['drop','DROP'],['gold','GOLD'],['upgradeItem','UPGRADE ITEM'],['blueprint','BLUEPRINT']];gameWindowBody.innerHTML=`<div class="gm-panel"><div class="gm-master"><div><strong>EVENT MODE</strong><small>${gmEvent.enabled?'LIVE':'OFF'}</small></div><label class="gm-switch"><input data-gm-master type="checkbox" ${gmEvent.enabled?'checked':''}><span></span></label></div><p class="window-note">Set each reward multiplier independently from ×2 to ×10.</p><div class="gm-toggle-list">${rows.map(([key,label])=>`<label><span>${label}</span><div class="gm-multiplier-control"><button type="button" data-gm-minus="${key}">−</button><strong>×${gmEvent[key]}</strong><button type="button" data-gm-plus="${key}">+</button></div></label>`).join('')}</div></div>`;gameWindowBody.querySelector('[data-gm-master]').onchange=e=>{gmEvent.enabled=e.target.checked;applyGmEvent();renderGmEventPanel();};gameWindowBody.querySelectorAll('[data-gm-minus]').forEach(b=>b.onclick=()=>{const k=b.dataset.gmMinus;gmEvent[k]=Math.max(2,gmEvent[k]-1);applyGmEvent();renderGmEventPanel();});gameWindowBody.querySelectorAll('[data-gm-plus]').forEach(b=>b.onclick=()=>{const k=b.dataset.gmPlus;gmEvent[k]=Math.min(10,gmEvent[k]+1);applyGmEvent();renderGmEventPanel();});}
let renderTarget=gameWindowBody;
function renderSettings(){gameWindowBody.innerHTML='<div class="settings-panel"><h3>ACCOUNT</h3><p class="window-note">Reset Account permanently deletes this browser\'s Bunny World character and saved world sessions, then starts a new game.</p><button class="danger-button" data-reset-account>RESET ACCOUNT</button></div>';gameWindowBody.querySelector('[data-reset-account]')?.addEventListener('click',()=>{if(!window.confirm('Reset your Bunny World account? All character progress, inventory, equipment, skills and world-session progress on this browser will be permanently deleted.'))return;if(!window.confirm('Are you sure? This cannot be undone.'))return;localStorage.removeItem(CHARACTER_SAVE_KEY);for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('bunny-world:v2:world:'))localStorage.removeItem(key);}location.reload();});}


const CRAFT_UI_RECIPES=Object.values(EQUIPMENT_MASTER_V2).map(item=>({
 id:item.id,name:item.name,tier:item.tier,slot:item.slot,
 type:item.slot==='main'?'Weapon':item.slot==='offhand'?'Offhand':(item.slot==='accessoryLeft'||item.slot==='accessoryRight')?'Accessory':item.slot[0].toUpperCase()+item.slot.slice(1),
 blueprintId:item.recipe.blueprintId,oreId:item.recipe.oreId,oreQty:item.recipe.oreQty,materials:item.recipe.materials,
 gold:item.recipe.gold,baseGoldCost:item.baseGoldCost,baseCombat:item.baseCombat,offhandType:item.offhandType,setId:item.setId,requiredLevel:item.requiredLevel,available:item.recipe.available,
 role:item.role,
 detail:`T${item.tier} ${item.role} equipment${item.setId?` · ${item.setId}`:''}.`
}));
const CRAFT_SET_BY_ID=new Map(SET_DEFINITIONS_V2.map(set=>[set.id,set]));
function craftStatLines(stats={}){
 const labels={atk:'ATK',matk:'MATK',def:'DEF',mdef:'MDEF',maxHp:'HP',crit:'CRIT',aspd:'ASPD',hit:'HIT',flee:'FLEE'};
 return Object.entries(stats).filter(([,v])=>Number(v)!==0).map(([k,v])=>`<div><span>${labels[k]||k}</span><b>+${v}</b></div>`).join('')||'<div><span>Base Stats</span><b>—</b></div>';
}
function equippedSetCount(setId,c){return Object.values(c.equipment.equippedBySlot).filter(Boolean).map(id=>c.equipment.instances[id]).filter(item=>item?.setId===setId).length;}
function craftSetDetail(recipe,c){
 if(!recipe.setId)return '<div class="craft-no-set">No Set Bonus</div>';
 const set=CRAFT_SET_BY_ID.get(recipe.setId);if(!set)return '<div class="craft-no-set">Set data unavailable</div>';
 const family=recipe.name.split(' ')[0],count=Math.min(set.requiredPieces,equippedSetCount(recipe.setId,c)),active=count>=set.requiredPieces;
 return `<div class="craft-set-box ${active?'set-active':'set-inactive'}"><div class="craft-set-head"><div><strong>${family} Set</strong><small>${set.group==='body'?'BODY SET':'ACCESSORY SET'} · ${set.role.toUpperCase()}</small></div><b>${count}/${set.requiredPieces}</b></div>${set.effect.map(effect=>`<p>◆ ${effect}</p>`).join('')}</div>`;
}
const CRAFT_RARITIES=[['Normal','50%'],['Good','27%'],['Rare','15%'],['Epic','6%'],['Legend','1.7%'],['Mythic','0.28%'],['White Ascended','0.02%']];
const craftUi={type:'Weapon',tier:'All',selected:'mosswoodSword',batch:1};
const batchDestroyUi={active:false,selected:new Set()};
function renderCraftWindow(){
 const c=arenaV2.character,types=['Weapon','Offhand','Armor','Cape','Shoes','Accessory'];
 let list=CRAFT_UI_RECIPES.filter(r=>r.type===craftUi.type&&(craftUi.tier==='All'||r.tier===Number(craftUi.tier)));
 if(!list.length)list=CRAFT_UI_RECIPES.filter(r=>(craftUi.tier==='All'||r.tier===Number(craftUi.tier)));
 let selected=list.find(r=>r.id===craftUi.selected)||list[0];
 gameWindowBody.innerHTML=`<div class="craft-topbar"><div class="craft-tabs">${types.map(t=>`<button data-craft-type="${t}" class="${craftUi.type===t?'active':''}">${t}</button>`).join('')}</div><label>Tier <select id="craft-tier"><option value="All">All T</option>${[1,2,3,4,5].map(t=>`<option value="${t}" ${String(craftUi.tier)===String(t)?'selected':''}>T${t}</option>`).join('')}</select></label></div>
 <div class="craft-three">
  <section class="craft-card craft-list"><header>CRAFTING LIST</header>${list.length?list.map(r=>`<button data-craft-recipe="${r.id}" class="${selected?.id===r.id?'active':''}"><span class="craft-icon">${iconHtml(r.id,'equipment','◆')}</span><span><strong>${r.name}</strong><small>T${r.tier} · ${r.type}</small></span></button>`).join(''):'<p class="craft-empty">No recipe in this category yet.</p>'}</section>
  <section class="craft-card craft-detail"><header>ITEM DETAIL</header>${selected?`<div class="craft-preview">${iconHtml(selected.id,'equipment','◆')}</div><div class="craft-detail-title"><h2>${selected.name}</h2><span class="tier-chip">T${selected.tier} · ${selected.type}</span></div><div class="craft-tags"><span>Lv ${selected.requiredLevel}+</span><span>${selected.role.toUpperCase()}</span>${selected.offhandType?`<span>${selected.offhandType.toUpperCase()}</span>`:''}</div><div class="craft-stat-box"><h3>BASE STATS</h3>${craftStatLines(selected.baseCombat)}</div>${craftSetDetail(selected,c)}<div class="craft-meta"><span>Slot</span><b>${selected.slot==='accessoryLeft'?'ACCESSORY L':selected.slot==='accessoryRight'?'ACCESSORY R':selected.slot.toUpperCase()}</b><span>Required Level</span><b>${selected.requiredLevel}</b><span>Base value</span><b>${selected.baseGoldCost} G</b></div>`:'<p class="craft-empty">Select a recipe.</p>'}</section>
  <section class="craft-card craft-cost"><header>MATERIALS & RARITY</header>${selected?`<div class="craft-materials">${[[selected.blueprintId,1],[selected.oreId,selected.oreQty],...selected.materials.map(m=>[m.itemId,m.qty])].map(([id,q])=>`<div><span class="craft-mat-name">${iconHtml(id,'item','')}${prettyItem(id)}</span><b class="${(c.inventory[id]??0)>=q?'enough':'missing'}">${c.inventory[id]??0} / ${q}</b></div>`).join('')}<div class="gold-cost"><span>Gold</span><b>${c.gold.toLocaleString()} / ${selected.gold.toLocaleString()}</b></div></div><h3>RARITY CHANCE</h3><div class="rarity-chances">${CRAFT_RARITIES.map(([n,p])=>`<span class="rarity-mini rarity-${n.toLowerCase().replace(' ','-')}"><i>${n}</i><b>${p}</b></span>`).join('')}</div><div class="craft-batch-picker"><span>CRAFT QTY</span>${[1,10,20,50].map(q=>`<button data-craft-qty="${q}" class="${craftUi.batch===q?'active':''}">×${q}</button>`).join('')}</div><button class="craft-button" data-craft-now="${selected.id}" ${selected.available?'':'disabled'}>${selected.available?(craftUi.batch===1?'CRAFT':`BATCH CRAFT ×${craftUi.batch}`):'PLANNED'}</button>`:'<p class="craft-empty">No recipe selected.</p>'}</section>
 </div>`;
 gameWindowBody.querySelectorAll('[data-craft-type]').forEach(b=>b.onclick=()=>{craftUi.type=b.dataset.craftType;craftUi.selected='';renderCraftWindow();});
 gameWindowBody.querySelector('#craft-tier')?.addEventListener('change',e=>{craftUi.tier=e.target.value;craftUi.selected='';renderCraftWindow();});
 gameWindowBody.querySelectorAll('[data-craft-recipe]').forEach(b=>b.onclick=()=>{craftUi.selected=b.dataset.craftRecipe;renderCraftWindow();});
 gameWindowBody.querySelectorAll('[data-craft-qty]').forEach(b=>b.onclick=()=>{craftUi.batch=Number(b.dataset.craftQty);renderCraftWindow();});
 gameWindowBody.querySelector('[data-craft-now]')?.addEventListener('click',()=>{const r=CRAFT_UI_RECIPES.find(x=>x.id===selected?.id);if(!r)return;const qty=craftUi.batch||1,recipe={templateId:r.id,slot:r.slot,blueprintId:r.blueprintId,oreId:r.oreId,oreQty:r.oreQty,materials:r.materials,gold:r.gold,baseGoldCost:r.baseGoldCost,baseCombat:r.baseCombat,offhandType:r.offhandType,setId:r.setId,requiredLevel:r.requiredLevel,available:r.available};try{if(qty===1){const result=arenaV2.equipmentCommand({type:'craft',recipe});saveArenaCharacter(arenaV2.character);const item=arenaV2.character.equipment.instances[result.createdEquipmentId];pushRewardLine(`สร้าง ${r.name} สำเร็จ · ${item?.rarity?.toUpperCase()||'NORMAL'}`);renderCraftWindow();if(item)showCraftSuccess(item);return;}const needItems=[[r.blueprintId,1],[r.oreId,r.oreQty],...r.materials.map(m=>[m.itemId,m.qty])];const missing=needItems.find(([id,n])=>(arenaV2.character.inventory[id]??0)<n*qty);if(missing||arenaV2.character.gold<r.gold*qty){showEquipmentError(`Materials/Gold insufficient for ×${qty}`);return;}const items=[];for(let i=0;i<qty;i++){const result=arenaV2.equipmentCommand({type:'craft',recipe});items.push(arenaV2.character.equipment.instances[result.createdEquipmentId]);}saveArenaCharacter(arenaV2.character);showBatchCraftResults(items,r.name);renderCraftWindow();}catch(error){showEquipmentError(String(error?.message||error));}});
}


const MAP_LABELS=Object.fromEntries(Object.keys(MAP_NAMES_V2).map(id=>[id,MAP_NAMES_V2[id].title]));
const monsterIndexUi={map:'forest1',selected:'mossblob1'};
function dropRowsForMonster(m){
 const l=m.loot,rows=[
  [l.oreItemId,UNIVERSAL_ORE_CHANCE],[ 'astraliteStone',UNIVERSAL_ASTRALITE_CHANCE],
  l.material&&[l.material.itemId,l.material.chance],l.aetherstone&&[l.aetherstone.itemId,l.aetherstone.chance],
  l.modifier&&[l.modifier.itemId,l.modifier.chance],l.core&&[l.core.itemId,l.core.chance],
  l.blueprint&&[l.blueprint.itemId,l.blueprint.chance],l.unique&&[l.unique.itemId,l.unique.chance],
  l.signatureMaterial&&[l.signatureMaterial.itemId,l.signatureMaterial.chance],
  ...(l.equipmentDrops??[]).map(x=>[x.itemId,x.chance])
 ].filter(Boolean);
 return rows;
}
function monsterDropInfo(id){
 const utility=UTILITY_EQUIPMENT_V2[id];
 if(utility)return utility.description+' '+Object.entries(utility.baseCombat).map(([k,v])=>k.toUpperCase()+' +'+v).join(', ');
 return itemInfo(id);
}
function monsterIndexSpriteHtml(id,large=false){
 const forest=FOREST_MONSTERS[id]||FOREST_BOSSES[id];
 if(forest){const root=FOREST_ASSET_ROOT;return `<span class="monster-index-sprite ${large?'large':''}" data-preview-kind="frames" data-preview-count="${forest.count||8}" data-preview-base="${root}/${forest.dir}/animations/${forest.anim}/unknown/frame_"><img src="${root}/${forest.dir}/animations/${forest.anim}/unknown/frame_000.png" alt="" onerror="this.parentElement.classList.add('missing')"></span>`;}
 const desert=DESERT_MONSTERS[id]||DESERT_BOSSES[id];
 if(desert)return `<span class="monster-index-sprite ${large?'large':''}" data-preview-kind="frames" data-preview-count="${desert.count||9}" data-preview-base="${DESERT_ASSET_ROOT}/${desert.dir}/animations/${desert.anim}/unknown/frame_"><img src="${DESERT_ASSET_ROOT}/${desert.dir}/animations/${desert.anim}/unknown/frame_000.png" alt="" onerror="this.parentElement.classList.add('missing')"></span>`;
 if(id==='goblinLeader'){const base=`${MINE_BOSS_ROOT}/animations/${MINE_BOSSES.goblinLeader.animations.leader}/unknown/frame_`;return `<span class="monster-index-sprite ${large?'large':''}" data-preview-kind="frames" data-preview-count="${MINE_BOSSES.goblinLeader.frameCount}" data-preview-base="${base}"><img src="${base}000.png" alt="" onerror="this.parentElement.classList.add('missing')"></span>`;}
 const mine=MINE_MONSTERS[id];if(mine){const skeleton=mine.sheet==='skeleton',src=skeleton?sunnysideRoot+'/Characters/Skeleton/PNG/skeleton_idle_strip6.png':sunnysideRoot+'/Characters/Goblin/PNG/spr_idle_strip9.png',count=skeleton?6:9;return `<span class="monster-index-sprite sheet ${large?'large':''}" data-preview-kind="sheet" data-preview-count="${count}"><img src="${src}" alt="" onerror="this.parentElement.classList.add('missing')"></span>`;}
 return '<span class="monster-index-sprite missing"></span>';
}
let monsterIndexPreviewRaf=0;
function startMonsterIndexPreviewAnimation(){
 cancelAnimationFrame(monsterIndexPreviewRaf);
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 let shown=-1;
 const animate=now=>{
  if(gameWindow.hidden)return;
  const step=Math.floor(now/160);
  if(step!==shown){shown=step;gameWindowBody.querySelectorAll('[data-preview-kind]').forEach(node=>{const count=Number(node.dataset.previewCount)||1,index=step%count,img=node.querySelector('img');if(!img)return;if(node.dataset.previewKind==='frames')img.src=`${node.dataset.previewBase}${String(index).padStart(3,'0')}.png`;else node.style.setProperty('--preview-frame',String(index));});}
  monsterIndexPreviewRaf=requestAnimationFrame(animate);
 };
 monsterIndexPreviewRaf=requestAnimationFrame(animate);
}

function renderMonsterIndex(){
 gameWindowTitle.textContent='Monster Index';
 gameWindowBody.innerHTML='<div class="monster-index-loading">Loading monster data…</div>';
 try{
 const maps=Object.keys(MAP_LABELS),allMonsters=Object.values(MONSTERS_V2),availableMaps=maps.filter(id=>allMonsters.some(m=>m.mapId===id));
 if(!availableMaps.includes(monsterIndexUi.map))monsterIndexUi.map=availableMaps[0]??maps[0];
 const roster=allMonsters.filter(m=>m.mapId===monsterIndexUi.map).sort((a,b)=>a.level-b.level);
 const selected=roster.find(m=>m.id===monsterIndexUi.selected)||roster[0];if(selected)monsterIndexUi.selected=selected.id;
 const drops=selected?dropRowsForMonster(selected):[];const rewardGear=equipmentCombatTotals(arenaV2.character),dropBonus=rewardGear.dropMultiplier-1,expBonus=rewardGear.expMultiplier-1;
 gameWindowBody.innerHTML=`<div class="monster-index">
  <div class="monster-index-maps">${availableMaps.map(id=>`<button data-monster-map="${id}" class="${monsterIndexUi.map===id?'active':''}">${MAP_LABELS[id]}</button>`).join('')}</div>
  <div class="monster-index-body"><section class="monster-index-list">${roster.map(m=>`<button data-monster-id="${m.id}" class="${selected?.id===m.id?'active':''}">${monsterIndexSpriteHtml(m.id)}<span><strong>${m.name}</strong><small>Lv.${m.level} · ${m.rank.toUpperCase()}</small></span></button>`).join('')}</section>
  <section class="monster-profile">${selected?`<div class="monster-profile-hero">${monsterIndexSpriteHtml(selected.id,true)}<div><small>MONSTER PROFILE</small><h2>${selected.name}</h2></div></div><div class="monster-profile-tags"><span>LV ${selected.level}</span><span>${selected.rank.toUpperCase()}</span><span>${MAP_LABELS[selected.mapId]}</span></div>
   <div class="monster-stats"><div>HP <b>${selected.maxHp}</b></div><div>ATK <b>${selected.atk}</b></div><div>DEF <b>${selected.def}</b></div><div>MDEF <b>${selected.mdef}</b></div><div>FLEE <b>${selected.flee}</b></div></div>
   <div class="monster-loot-row"><span>EXP</span><b>${Math.round(selected.level*4*(selected.rank==='boss'?20:selected.rank==='elite'?5:1))}</b>${expBonus>0?`<em style="color:#ff9d3d"> +${Math.round(selected.level*4*(selected.rank==='boss'?20:selected.rank==='elite'?5:1)*expBonus)} (${(expBonus*100).toFixed(1)}%)</em>`:''}</div><h3>LOOT TABLE</h3><div class="monster-loot"><div class="monster-loot-row"><span>Gold</span><b>${selected.loot.goldMin}–${selected.loot.goldMax}</b></div>${drops.map(([id,chance])=>{const bonus=chance*dropBonus;return `<div class="monster-loot-row" title="${monsterDropInfo(id)}"><span>${iconHtml(id,'drop','')}${prettyItem(id)}</span><b>${(chance*100).toFixed(chance<.01?2:1).replace(/\\.0$/,'')}%</b>${bonus>0?`<em style="color:#ff9d3d"> +${(bonus*100).toFixed(bonus<.001?3:2)}%</em>`:''}<small>${monsterDropInfo(id)}</small></div>`}).join('')}</div>`:'No monster selected.'}</section></div></div>`;
 gameWindowBody.querySelectorAll('[data-monster-map]').forEach(b=>b.onclick=()=>{monsterIndexUi.map=b.dataset.monsterMap;monsterIndexUi.selected='';renderMonsterIndex();});
 gameWindowBody.querySelectorAll('[data-monster-id]').forEach(b=>b.onclick=()=>{monsterIndexUi.selected=b.dataset.monsterId;renderMonsterIndex();});startMonsterIndexPreviewAnimation();
 }catch(error){
  console.error('Monster Index render failed',error);
  gameWindowBody.innerHTML=`<div class="monster-index-error"><strong>MONSTER INDEX ERROR</strong><p>${String(error?.message||error)}</p><button type="button" data-monster-retry>RETRY</button></div>`;
  gameWindowBody.querySelector('[data-monster-retry]')?.addEventListener('click',renderMonsterIndex);
 }
}

const masteryUi={selected:null};
const MASTERY_NAMES={greatsword:'Greatsword',dagger:'Dagger',axe:'Axe',hammer:'Hammer',bow:'Bow',staff:'Staff',swordShield:'Sword + Shield'};
const MASTERY_GLYPHS={greatsword:'⚔',dagger:'†',axe:'🪓',hammer:'🔨',bow:'🏹',staff:'✦',swordShield:'🛡'};
const MASTERY_MILESTONE_NAMES={cleave:'Cleave',cleaveII:'Cleave II',wideCleave:'Wide Cleave',cleaveIII:'Cleave III',perfectCleave:'Perfect Cleave',doubleAttack:'Double Attack',doubleAttackII:'Double Attack II',precisionFollowup:'Precision Follow-up',criticalFollowup:'Critical Follow-up',doubleAttackIII:'Double Attack III',heavyBlow:'Heavy Blow',heavyBlowII:'Heavy Blow II',armorBreak:'Armor Break',heavyBlowIII:'Heavy Blow III',crushingArmorBreak:'Crushing Armor Break',crushingImpact:'Crushing Impact',crushingImpactII:'Crushing Impact II',concussion:'Concussion',crushingImpactIII:'Crushing Impact III',shockwave:'Shockwave',multiShot:'Multi Shot',multiShotII:'Multi Shot II',eagleEye:'Eagle Eye',piercingArrow:'Piercing Arrow',multiShotIII:'Multi Shot III',concentration:'Concentration',mobileCasting:'Mobile Casting',flowCasting:'Flow Casting',coreEcho:'Core Echo',perfectCasting:'Perfect Casting',guard:'Guard',firmGuard:'Firm Guard',counterGuard:'Counter Guard',perfectGuard:'Perfect Guard',aegisMastery:'Aegis Mastery'};
function renderWeaponMastery(target=gameWindowBody){
 const c=arenaV2.character,families=Object.keys(MASTERY_NAMES);if(!masteryUi.selected||!c.weaponMastery[masteryUi.selected])masteryUi.selected=families[0];
 const selected=masteryUi.selected,m=c.weaponMastery[selected]||{level:1,xp:0},milestones=WEAPON_MASTERY_MILESTONES[selected]||[];if(!masteryUi.milestone||!milestones.some(x=>x.id===masteryUi.milestone))masteryUi.milestone=(milestones.filter(x=>m.level>=x.level).at(-1)||milestones[0])?.id;
 const detail=milestones.find(x=>x.id===masteryUi.milestone)||milestones[0],detailUnlocked=detail&&m.level>=detail.level;
 target.innerHTML='<div class="mastery-layout"><section class="mastery-panel"><div class="mastery-panel-head"><strong>WEAPON MASTERY</strong><span>LV PROGRESS</span></div><div class="mastery-progress-list">'+families.map(f=>{const x=c.weaponMastery[f]||{level:1,xp:0},max=x.level>=50?0:masteryXpRequired(x.level),pct=x.level>=50?100:Math.min(100,max?x.xp/max*100:0);return '<button class="mastery-progress-card '+(f===selected?'active':'')+'" data-mastery-family="'+f+'"><span class="mastery-family-glyph">'+iconHtml(f,'family',MASTERY_GLYPHS[f])+'</span><span class="mastery-family-info"><b>'+MASTERY_NAMES[f]+'</b><small>Lv '+x.level+'</small><i><em style="width:'+pct+'%"></em></i><small class="mastery-xp">'+(x.level>=50?'MAX':Math.floor(x.xp)+' / '+max+' XP')+'</small></span></button>'}).join('')+'</div></section><section class="mastery-panel mastery-milestone-panel"><div class="mastery-panel-head"><strong>'+MASTERY_NAMES[selected]+'</strong><span>MILESTONES</span></div><div class="mastery-milestone-grid">'+milestones.map(x=>'<button class="mastery-milestone '+(m.level>=x.level?'unlocked':'locked')+' '+(x.id===masteryUi.milestone?'selected':'')+'" data-milestone="'+x.id+'"><span class="mastery-level-tag">Lv '+x.level+'</span><span class="mastery-milestone-glyph">'+iconHtml(selected+'_'+x.id,'mastery',MASTERY_GLYPHS[selected])+'</span></button>').join('')+'</div>'+(detail?'<div class="mastery-detail-card '+(detailUnlocked?'unlocked':'locked')+'"><div class="mastery-detail-icon"><span>'+iconHtml(selected+'_'+detail.id,'mastery',MASTERY_GLYPHS[selected])+'</span><b>Lv '+detail.level+'</b></div><div><div class="mastery-detail-heading"><strong>'+(MASTERY_MILESTONE_NAMES[detail.id]||detail.id)+'</strong><span>'+(detailUnlocked?'UNLOCKED':'LOCKED · LV '+detail.level)+'</span></div><p>'+detail.description+'</p></div></div>':'')+'</section></div>';
 target.querySelectorAll('[data-mastery-family]').forEach(b=>b.onclick=()=>{masteryUi.selected=b.dataset.masteryFamily;masteryUi.milestone=null;renderSkillsHub();});target.querySelectorAll('[data-milestone]').forEach(b=>b.onclick=()=>{masteryUi.milestone=b.dataset.milestone;renderSkillsHub();});
}

function skillLabel(id){return id?String(id).replace(/([A-Z])/g,' $1').replace(/^./,x=>x.toUpperCase()):'Empty'}
function coreRarity(id){return id?(arenaV2.character.skills.coreRarity?.[id]??'normal'):'normal'}
function coreRarityIndex(id){return ['normal','good','rare','epic','legend','mythic','whiteAscended'].indexOf(coreRarity(id))}
function coreDamageBonus(id){return Math.max(0,coreRarityIndex(id))*10}
function skillDetailHtml(id){
 const s=SKILLS_V2[id];if(!s)return '<p>Skill data unavailable.</p>';
 const scaling=s.scaling==='physicalAttack'?'Physical ATK':s.scaling==='magicalAttack'?'Magical ATK':null;
 const total=s.coefficient?Math.round(s.coefficient*100)+'% '+scaling:null;
 const perHit=s.coefficient&&s.hitCount>1?Math.round(s.coefficient/s.hitCount*100)+'% '+scaling+' per hit':null;
 const target={selfArea:'AoE around caster',targetArea:'AoE around target',groundArea:'Ground-targeted AoE',target:'Single target'}[s.targeting]||'Utility';
 return '<div class="skill-detail-block"><div class="skill-detail-title"><strong>'+s.name+'</strong><span>SKILL CORE · '+s.kind.toUpperCase()+'</span></div><p>'+target+(s.element?' · '+s.element.toUpperCase():'')+'</p><div class="skill-detail-stats">'+(s.radius?'<span>AoE Radius <b>'+s.radius+'</b></span>':'')+(s.range?'<span>Range <b>'+s.range+'</b></span>':'')+(s.hitCount?'<span>Hits <b>'+s.hitCount+'</b></span>':'')+(total?'<span>Damage <b>'+total+'</b></span>':'')+(perHit?'<span>Per Hit <b>'+perHit+'</b></span>':'')+(s.defenseType?'<span>Defense <b>'+s.defenseType.toUpperCase()+'</b></span>':'')+(s.canCrit!==undefined?'<span>Can Crit <b>'+(s.canCrit?'YES':'NO')+'</b></span>':'')+(s.cooldownMs?'<span>Cooldown <b>'+(s.cooldownMs/1000)+'s</b></span>':'')+(s.movementDistance?'<span>Distance <b>'+s.movementDistance+'</b></span>':'')+'</div>'+(scaling?'<p class="skill-formula">Raw damage = '+scaling+' × '+s.coefficient+(s.flatPower?' + '+s.flatPower:'')+(s.hitCount>1?' total, split across '+s.hitCount+' hits':'')+'. Damage is then reduced by '+(s.defenseType||'target defense')+'.</p>':'')+'</div>';
}
function showSkillCorePicker(slot){
 const c=arenaV2.character,equipped=new Set(c.skills.active.filter(Boolean)),owned=Object.entries(c.inventory).filter(([id,q])=>q>0&&inventoryItemMeta(id).tags.includes('skill-core')&&SKILLS_V2[id]?.kind!=='movement'&&!equipped.has(id));
 equipmentDetailModal.innerHTML='<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card"><div class="skill-picker-head"><strong>INSTALL SKILL CORE '+(slot+1)+'</strong><span>Available Skill Cores</span></div><div class="skill-picker-list">'+(owned.length?owned.map(([id,q])=>{const skill=SKILLS_V2[id],equippedSlot=c.skills.active.findIndex(x=>x===id),implemented=Boolean(skill?.scaling&&skill?.coefficient)||id==='healingPulse'||id==='barrier';const status=!implemented?'NOT IMPLEMENTED':equippedSlot>=0?'EQUIPPED IN CORE '+(equippedSlot+1)+' · CLICK TO MOVE':'AVAILABLE';return '<button data-pick-core="'+id+'" '+(!implemented?'disabled':'')+'><b>'+iconHtml(id,'skill','')+skill.name+'</b><small>OWNED ×'+q+' · '+status+'</small>'+skillDetailHtml(id)+(implemented?'':'<p class="skill-unimplemented">This Core exists in the loot table but has no combat effect yet, so installation is disabled.</p>')+'</button>'}).join(''):'<div class="skill-picker-empty"><strong>No Skill Core available</strong><p>All owned Skill Cores are already equipped, or you do not own another Core.</p></div>')+'</div></div>';
 equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;
 equipmentDetailModal.querySelectorAll('[data-pick-core]').forEach(b=>b.onclick=()=>{arenaV2.skillCoreCommand({type:'equipCore',coreId:b.dataset.pickCore,slot});saveArenaCharacter(arenaV2.character);equipmentDetailModal.hidden=true;syncSkillHotbar();renderSkillsHub();});
}
function showSkillModPicker(coreId,modSlot){
 const c=arenaV2.character,owned=Object.entries(c.inventory).filter(([id,q])=>q>0&&inventoryItemMeta(id).tags.includes('skill-modifier'));
 equipmentDetailModal.innerHTML='<button class="rpg-modal-close" type="button" aria-label="Close">×</button><div class="equipment-detail-card"><div class="skill-picker-head"><strong>INSTALL SKILL MOD '+(modSlot+1)+'</strong><span>'+skillLabel(coreId)+'</span></div><div class="skill-picker-list">'+(owned.length?owned.map(([id,q])=>{const m=SKILL_MODIFIERS_V2[id];return '<button data-pick-mod="'+id+'"><b>'+iconHtml(id,'item','')+(m?.name||skillLabel(id))+'</b><small>×'+q+' · SKILL MOD</small><p>'+(m?.description||'Modifier details unavailable.')+'</p></button>'}).join(''):'<p>No Skill Mod owned.</p>')+'</div></div>';
 equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;
 equipmentDetailModal.querySelectorAll('[data-pick-mod]').forEach(b=>b.onclick=()=>{arenaV2.skillCoreCommand({type:'equipModifier',coreId,modifierId:b.dataset.pickMod,modSlot});saveArenaCharacter(arenaV2.character);equipmentDetailModal.hidden=true;syncSkillHotbar();renderSkillsHub();});
}
function showSkillCoreUpgrade(coreId){
 const quote=skillCoreUpgradeQuote(arenaV2.character,coreId),rarity=arenaV2.character.skills.coreRarity?.[coreId]??'normal';
 equipmentDetailModal.innerHTML=`<button class="rpg-modal-close" type="button">×</button><div class="equipment-detail-card skill-core-upgrade core-rarity-${rarity}"><div class="craft-success-heading">UPGRADE CORE</div><div class="skill-core-upgrade-icon core-rarity-${rarity}">${iconHtml(coreId,'skill','✦')}</div><h2>${skillLabel(coreId)}</h2><div class="core-upgrade-rarity core-rarity-text">${rarity.replace('whiteAscended','White Ascended').toUpperCase()} · DMG +${coreDamageBonus(coreId)}%</div>${quote?`<p><b>${quote.current.toUpperCase()} → ${quote.next.toUpperCase()}</b></p><div class="rpg-stat-list"><span>Success <b>${Math.round(quote.successRate*100)}%</b></span><span>Damage <b>+${Math.round(quote.currentDamageBonus*100)}% → +${Math.round(quote.nextDamageBonus*100)}%</b></span><span>Duplicate Core <b>${arenaV2.character.inventory[coreId]??0} / 2</b></span><span>Gold <b>${arenaV2.character.gold.toLocaleString()} / ${quote.gold.toLocaleString()}</b></span></div><button class="craft-button" data-upgrade-core="${coreId}">UPGRADE</button>`:`<p><b>${rarity.toUpperCase()}</b> · MAX RARITY</p>`}</div>`;
 equipmentDetailModal.hidden=false;equipmentDetailModal.querySelector('.rpg-modal-close').onclick=()=>equipmentDetailModal.hidden=true;
 equipmentDetailModal.querySelector('[data-upgrade-core]')?.addEventListener('click',()=>{try{const before=arenaV2.character.skills.coreRarity?.[coreId]??'normal';arenaV2.skillCoreCommand({type:'upgradeCore',coreId});saveArenaCharacter(arenaV2.character);const after=arenaV2.character.skills.coreRarity?.[coreId]??'normal';showEquipmentError(after!==before?'CORE UPGRADE SUCCEEDED!':'CORE UPGRADE FAILED');showSkillCoreUpgrade(coreId);renderSkillsHub();}catch(error){showEquipmentError(String(error?.message||error));}});
}

function renderSkillsWindow(target=gameWindowBody){
 const s=arenaV2.character.skills,slots=[0,1,2];
 target.innerHTML='<div class="skill-core-shell"><div class="skill-core-head"><strong>SKILL CORE LOADOUT</strong><span>3 CORE · 2 MOD EACH</span></div><div class="skill-core-list">'+slots.map(i=>{const core=s.active[i],mods=core?(s.modifiersByActive[core]||[]).slice(0,2):[];return '<section class="skill-core-card"><button class="skill-core-main '+(!core?'empty':'core-rarity-'+coreRarity(core))+'" data-core-slot="'+i+'"><div class="skill-core-icon">'+(core?iconHtml(core,'skill','✦'):'＋')+'</div><div><small>CORE '+(i+1)+(core?' · <span class="core-rarity-text">'+coreRarity(core).replace('whiteAscended','White Ascended').toUpperCase()+'</span>':'')+'</small><strong>'+skillLabel(core)+'</strong>'+(core?'<em class="core-damage-bonus">DMG +'+coreDamageBonus(core)+'%</em>':'')+'</div></button><div class="skill-core-arrow">➜</div><div class="skill-mods"><button class="skill-mod '+(!mods[0]?'empty':'')+'" data-mod-slot="0" data-mod-core="'+(core||'')+'" '+(!core?'disabled':'')+'><span>'+iconHtml(mods[0],'item','◆')+'</span><div><small>MOD 1</small><b>'+skillLabel(mods[0])+'</b></div></button><button class="skill-mod '+(!mods[1]?'empty':'')+'" data-mod-slot="1" data-mod-core="'+(core||'')+'" '+(!core?'disabled':'')+'><span>'+iconHtml(mods[1],'item','◆')+'</span><div><small>MOD 2</small><b>'+skillLabel(mods[1])+'</b></div></button></div>'+(core?'<div class="skill-core-inline-detail">'+skillDetailHtml(core)+'</div>':'')+'</section>'}).join('')+'</div><div class="movement-slot-wrap"><small>MOVEMENT</small><div class="movement-skill-tile '+(!s.movement?'empty':'')+'" title="'+skillLabel(s.movement)+'"><span>'+(s.movement?iconHtml(s.movement,'skill','➤'):'＋')+'</span><b>'+skillLabel(s.movement)+'</b></div></div></div>';
 target.querySelectorAll('[data-core-slot]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.coreSlot),core=arenaV2.character.skills.active[i];if(core)showSkillCoreUpgrade(core);else showSkillCorePicker(i);});
 target.querySelectorAll('[data-mod-slot]').forEach(b=>b.onclick=()=>{if(b.dataset.modCore)showSkillModPicker(b.dataset.modCore,Number(b.dataset.modSlot));});
}

const skillsHubUi={tab:'skills'};
function renderSkillsHub(){
 gameWindowTitle.textContent='Skills & Mastery';
 gameWindowBody.innerHTML='<div class="skills-hub-tabs"><button data-skills-tab="skills" class="'+(skillsHubUi.tab==='skills'?'active':'')+'">SKILL CORE</button><button data-skills-tab="mastery" class="'+(skillsHubUi.tab==='mastery'?'active':'')+'">WEAPON MASTERY</button></div><div id="skills-hub-content"></div>';
 const host=gameWindowBody.querySelector('#skills-hub-content');
 if(skillsHubUi.tab==='mastery')renderWeaponMastery(host);else renderSkillsWindow(host);
 gameWindowBody.querySelectorAll('[data-skills-tab]').forEach(b=>b.onclick=()=>{skillsHubUi.tab=b.dataset.skillsTab;renderSkillsHub();});
}

function openGameWindow(name){
  gameWindow.hidden=false;gameWindowBody.replaceChildren();gameWindowTitle.textContent=name;gameMenu.hidden=true;menuToggle?.setAttribute('aria-expanded','false');
  const c=arenaV2.character;
  if(name==='Inventory'){equipmentUi.tab='Gear';equipmentUi.selectedId=null;renderEquipmentUi();gameWindow.hidden=true;equipmentPanel.hidden=false;return;}
  if(name==='Equipment'){equipmentUi.tab='Gear';equipmentUi.selectedId=null;renderEquipmentUi();gameWindow.hidden=true;equipmentPanel.hidden=false;return;}
  if(name==='Craft'){gameWindowTitle.textContent='Craft';renderCraftWindow();return;}
  if(name==='Monster Index'){renderMonsterIndex();return;}
  if(name==='Skills'||name==='Weapon Mastery'){skillsHubUi.tab=name==='Weapon Mastery'?'mastery':'skills';renderSkillsHub();return;}
  if(['Market','Friends','Guild','Party'].includes(name)){gameWindowBody.innerHTML='<div class="ui-card"><strong>'+name+'</strong>UI shell reserved for the MMO phase. No fake local economy/social authority is being added now.</div>';return;}
  if(name==='Settings'){renderSettings();return;}
  if(name==='GM Event'){renderGmEventPanel();return;}
  gameWindowBody.innerHTML='<div class="ui-card"><strong>'+name+'</strong></div>';
}
function openCharacterWindow(){const c=arenaV2.character;let statEditGuardUntil=0;gameWindow.hidden=false;gameWindowTitle.textContent='CHARACTER STATUS';gameMenu.hidden=true;const stats=['str','agi','vit','int','dex','luk'];gameUi.pendingStats={};const render=()=>{const used=Object.values(gameUi.pendingStats).reduce((a,v)=>a+v,0),remaining=c.unspentStatPoints-used,preview={...c.stats};for(const s of stats)preview[s]+=gameUi.pendingStats[s]||0;const p=arenaV2.simulation.world.players.get(arenaV2.playerId);const d={ATK:Math.round(p.weaponAtk+preview.str+preview.str*preview.str/100+preview.dex/5+preview.luk/3),MATK:Math.round(p.weaponMatk+preview.int+preview.int*preview.int/100+preview.dex/5+preview.luk/3),DEF:Math.round(p.equipmentDef+preview.vit/2),MDEF:Math.round(p.equipmentMdef+preview.int/2+preview.vit/4),HIT:175+c.level+preview.dex+p.hitBonus,FLEE:100+c.level+preview.agi+p.fleeBonus,CRIT:(1+preview.luk*.3+p.critBonusPercent).toFixed(1)+'%',ASPD:Math.floor(150+preview.agi*.25+preview.dex*.1+p.equipmentAspd),HP:100+c.level*12+preview.vit*10};gameWindowBody.innerHTML='<p class="window-note">Lv. '+c.level+' · Status Point: <b>'+remaining+'</b></p><div class="character-status-columns"><section><h3>STATUS</h3>'+stats.map(s=>'<div class="stat-row"><span><strong>'+s.toUpperCase()+'</strong><b>'+preview[s]+'</b></span>'+(remaining>0?'<button data-stat-plus="'+s+'">+</button>':'')+'</div>').join('')+'</section><section><h3>DETAIL STATUS</h3>'+Object.entries(d).map(([k,v])=>'<div class="detail-stat-row"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</section></div><div class="equipment-actions"><button id="stats-confirm" type="button" aria-disabled="'+(used<=0)+'">Confirm</button><button id="stats-reset">Reset</button></div>';gameWindowBody.querySelectorAll('[data-stat-plus]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();if(remaining<=0)return;statEditGuardUntil=performance.now()+350;gameUi.pendingStats[b.dataset.statPlus]=(gameUi.pendingStats[b.dataset.statPlus]||0)+1;render();});const confirm=gameWindowBody.querySelector('#stats-confirm');if(confirm)confirm.onclick=e=>{e.preventDefault();e.stopPropagation();if(performance.now()<statEditGuardUntil)return;const allocation={...gameUi.pendingStats};if(!Object.values(allocation).some(v=>v>0))return;if(arenaV2.allocateStats(allocation)){saveArenaCharacter(arenaV2.character);gameUi.pendingStats={};openCharacterWindow();}};gameWindowBody.querySelector('#stats-reset').onclick=()=>{gameUi.pendingStats={};render();};};render();}
menuToggle?.addEventListener('click',()=>{gameMenu.hidden=!gameMenu.hidden;menuToggle.setAttribute('aria-expanded',String(!gameMenu.hidden));menuToggle.textContent=gameMenu.hidden?'≪':'≫';});
document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>openGameWindow(b.dataset.window)));
document.querySelector('#game-window-close')?.addEventListener('click',()=>gameWindow.hidden=true);
window.addEventListener('keydown',event=>{if(event.key!=='Escape')return;let closed=false;if(!equipmentDetailModal.hidden){equipmentDetailModal.hidden=true;closed=true;}else if(!equipmentPanel.hidden){equipmentPanel.hidden=true;closed=true;}if(!gameWindow.hidden){gameWindow.hidden=true;closed=true;}if(!gameMenu.hidden){gameMenu.hidden=true;menuToggle?.setAttribute('aria-expanded','false');menuToggle&&(menuToggle.textContent='≪');closed=true;}if(!autoHuntPopover?.hidden){autoHuntPopover.hidden=true;closed=true;}if(closed)event.preventDefault();});
document.querySelector('#character-hud')?.addEventListener('click',openCharacterWindow);
document.querySelector('[data-mobile="auto"]')?.addEventListener('click',()=>{state.controlMode=state.controlMode==='fullAuto'?'manual':'fullAuto';state.autoCombat=state.controlMode!=='manual';state.combatTarget=null;arenaV2.move({x:0,y:0});syncAutoHuntButton();});
document.querySelector('[data-mobile="attack"]')?.addEventListener('click',()=>triggerAttack(state.combatTarget || nearestMonster()?.monster || null));
function ensureCooldownUi(button){let overlay=button.querySelector('.skill-cooldown-overlay');if(!overlay){overlay=document.createElement('i');overlay.className='skill-cooldown-overlay';overlay.innerHTML='<b></b>';button.append(overlay);}return overlay;}
function syncSkillCooldowns(){const p=arenaV2.simulation.world.players.get(arenaV2.playerId);if(!p)return;const now=arenaV2.simulation.clock.nowMs;document.querySelectorAll('[data-hotbar-slot],[data-hotbar-movement]').forEach(b=>{const id=b.dataset.skillId,overlay=ensureCooldownUi(b),skill=id?SKILLS_V2[id]:null,end=id?(p.cooldowns?.[id]??0):0,remaining=Math.max(0,end-now),total=Math.max(1,skill?.cooldownMs??1),ratio=Math.max(0,Math.min(1,remaining/total));overlay.style.setProperty('--cooldown-angle',`${ratio*360}deg`);overlay.querySelector('b').textContent=remaining>0?(remaining>=10000?String(Math.ceil(remaining/1000)):(remaining/1000).toFixed(1)):'';overlay.classList.toggle('active',remaining>0);});}
function hydrateStaticIcons(){document.querySelectorAll('[data-ui-icon]').forEach(el=>{el.innerHTML=iconHtml(el.dataset.uiIcon,'ui',el.innerHTML,'pixel-icon ui-icon');});[['[data-skill="potion"]','potion'],['#return-spawn-button','home'],['#auto-hunt-button','auto']].forEach(([sel,id])=>{const b=document.querySelector(sel);if(b)setHotbarIcon(b,id,'ui');});}
function setHotbarIcon(button,id,kind='skill'){const url=id?iconFor(id,kind):null;let img=button.querySelector('.hotbar-icon');if(!url){img?.remove();return;}if(!img){img=document.createElement('img');img.className='pixel-icon hotbar-icon';img.alt='';img.draggable=false;button.prepend(img);}if(img.getAttribute('src')!==url)img.src=url;}
function syncSkillHotbar(){const s=arenaV2.character.skills;document.querySelectorAll('[data-hotbar-slot]').forEach(b=>{const id=s.active[Number(b.dataset.hotbarSlot)];b.dataset.skillId=id||'';b.querySelector('span').textContent=id?(SKILLS_V2[id]?.name||skillLabel(id)):'Empty';setHotbarIcon(b,id);b.disabled=!id;ensureCooldownUi(b);});const move=document.querySelector('[data-hotbar-movement]'),id=s.movement;if(move){move.dataset.skillId=id||'';move.querySelector('span').textContent=id?(SKILLS_V2[id]?.name||skillLabel(id)):'Empty';setHotbarIcon(move,id);move.disabled=!id;ensureCooldownUi(move);}syncSkillCooldowns();}
hydrateStaticIcons();
function castHotbarSkill(slot){const id=arenaV2.character.skills.active[slot];if(!id)return;const skill=SKILLS_V2[id],target=state.combatTarget&&!state.combatTarget.dead?state.combatTarget:nearestMonster()?.monster;if(!skill)return;if(skill.targeting==='selfArea'){dispatchV2Skill(id);return;}if(!target)return;const ground=skill.targeting==='groundArea'?{x:target.x,y:target.y}:undefined;dispatchV2Skill(id,target,ground);}
document.querySelectorAll('[data-hotbar-slot]').forEach(b=>b.addEventListener('click',()=>castHotbarSkill(Number(b.dataset.hotbarSlot))));
document.querySelector('[data-hotbar-movement]')?.addEventListener('click',()=>triggerDash());
syncSkillHotbar();


const autoHuntButton=document.querySelector('#auto-hunt-button'),autoHuntPopover=document.querySelector('#auto-hunt-popover'),returnSpawnButton=document.querySelector('#return-spawn-button');
function returnToSpawn(){saveWorldSession();const url=new URL(window.location.href);url.searchParams.set('biome','town');url.searchParams.delete('from');url.searchParams.delete('qa');window.location.assign(url.toString());}
returnSpawnButton?.addEventListener('click',returnToSpawn);
function syncAutoHuntButton(){if(!autoHuntButton)return;autoHuntButton.classList.remove('manual','semi','auto');const mode=state.controlMode==='fullAuto'?'auto':state.controlMode==='semiAuto'?'semi':'manual';autoHuntButton.classList.add(mode);autoHuntButton.title=mode==='auto'?'Auto Hunt: ON':mode==='semi'?'Semi Auto':'Manual';}
function renderAutoHuntPopover(){if(!autoHuntPopover)return;const roster=[...new Map(monsters.filter(m=>!m.isBoss).map(m=>[m.monsterType,{type:m.monsterType,name:m.name,level:m.level}])).values()].sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));autoHuntPopover.innerHTML='<strong>AUTO MODE</strong><div class="mode-picker">'+[['semiAuto','SEMI'],['fullAuto','AUTO']].map(([v,l])=>'<button data-auto-mode="'+v+'" class="'+(state.controlMode===v?'active':'')+'">'+l+'</button>').join('')+'</div><strong>HP REST</strong><label class="auto-rest-toggle"><input type="checkbox" data-auto-rest '+(state.autoRestEnabled?'checked':'')+'><span>พักฟื้นเมื่อ HP ต่ำ</span></label><label class="auto-rest-range"><span>พักเมื่อ HP ≤ <b data-auto-rest-value>'+state.autoRestBelowPercent+'%</b></span><input type="range" min="5" max="90" step="5" value="'+state.autoRestBelowPercent+'" data-auto-rest-threshold '+(state.autoRestEnabled?'':'disabled')+'></label><label class="auto-rest-range"><span>กลับไปล่าเมื่อ HP ≥ <b data-auto-resume-value>'+state.autoResumePercent+'%</b></span><input type="range" min="10" max="100" step="5" value="'+state.autoResumePercent+'" data-auto-resume-threshold '+(state.autoRestEnabled?'':'disabled')+'></label><strong>TARGET MONSTERS</strong><div class="monster-filter">'+roster.map(m=>'<label><input type="checkbox" data-auto-monster="'+m.type+'" '+(state.autoMonsterTypes.has(m.type)?'checked':'')+'><span>LV.'+m.level+' '+m.name+'</span></label>').join('')+'</div>';autoHuntPopover.querySelectorAll('[data-auto-mode]').forEach(b=>b.onclick=()=>{state.controlMode=b.dataset.autoMode;state.autoCombat=true;state.combatTarget=null;arenaV2.move({x:0,y:0});syncAutoHuntButton();renderAutoHuntPopover();});const restToggle=autoHuntPopover.querySelector('[data-auto-rest]'),restSlider=autoHuntPopover.querySelector('[data-auto-rest-threshold]'),resumeSlider=autoHuntPopover.querySelector('[data-auto-resume-threshold]');restToggle.onchange=()=>{state.autoRestEnabled=restToggle.checked;renderAutoHuntPopover();};restSlider.oninput=()=>{state.autoRestBelowPercent=Number(restSlider.value);if(state.autoResumePercent<state.autoRestBelowPercent)state.autoResumePercent=state.autoRestBelowPercent;autoHuntPopover.querySelector('[data-auto-rest-value]').textContent=state.autoRestBelowPercent+'%';};resumeSlider.oninput=()=>{state.autoResumePercent=Math.max(state.autoRestBelowPercent,Number(resumeSlider.value));resumeSlider.value=String(state.autoResumePercent);autoHuntPopover.querySelector('[data-auto-resume-value]').textContent=state.autoResumePercent+'%';};autoHuntPopover.querySelectorAll('[data-auto-monster]').forEach(cb=>cb.onchange=()=>{cb.checked?state.autoMonsterTypes.add(cb.dataset.autoMonster):state.autoMonsterTypes.delete(cb.dataset.autoMonster);state.combatTarget=null;});}
autoHuntButton?.addEventListener('click',event=>{if(event.shiftKey){autoHuntPopover.hidden=!autoHuntPopover.hidden;if(!autoHuntPopover.hidden)renderAutoHuntPopover();return;}if(state.controlMode==='manual'){state.controlMode=autoHuntButton.dataset.preferredMode||'fullAuto';state.autoCombat=true;}else{autoHuntButton.dataset.preferredMode=state.controlMode;state.controlMode='manual';state.autoCombat=false;state.combatTarget=null;arenaV2.move({x:0,y:0});}syncAutoHuntButton();});autoHuntButton?.addEventListener('contextmenu',event=>{event.preventDefault();autoHuntPopover.hidden=!autoHuntPopover.hidden;if(!autoHuntPopover.hidden)renderAutoHuntPopover();});syncAutoHuntButton();
const chatInput=document.querySelector('#chat-input'),chatLog=document.querySelector('#chat-log');
window.addEventListener('keydown',event=>{if(event.code!=='Enter')return;if(document.activeElement===chatInput){event.preventDefault();const message=chatInput.value.trim();if(message){const p=document.createElement('p');p.textContent='Bunny: '+message;chatLog.appendChild(p);chatLog.scrollTop=chatLog.scrollHeight;chatInput.value='';}chatInput.blur();return;}event.preventDefault();chatInput?.focus();});

function startDeathOverlay(){gameUi.deathUntil=performance.now()+10000;const o=document.querySelector('#death-overlay');if(o)o.hidden=false;}
function updateProductionHud(){const c=arenaV2.character,p=arenaV2.simulation.world.players.get(arenaV2.playerId);const heroName=document.querySelector('#hero-name'),heroLevel=document.querySelector('#hero-level'),spBar=document.querySelector('.bar.sp i'),expBar=document.querySelector('.bar.exp i');if(spBar&&p?.maxSp)spBar.style.width=Math.max(0,Math.min(100,(p.sp??0)/p.maxSp*100))+'%';if(heroName)heroName.textContent=c.name.toUpperCase();if(heroLevel)heroLevel.textContent='Lv. '+c.level;if(expBar)expBar.style.width=Math.min(100,c.exp/Math.max(1,expToNextLevelV2(c.level))*100)+'%';if(gameUi.deathUntil){const remain=Math.max(0,gameUi.deathUntil-performance.now()),sec=Math.ceil(remain/1000),o=document.querySelector('#death-overlay'),label=document.querySelector('#death-seconds'),ring=document.querySelector('.death-countdown .progress');if(label)label.textContent=String(sec);if(ring)ring.style.strokeDashoffset=String(264*(1-remain/10000));if(remain<=0){gameUi.deathUntil=0;if(o)o.hidden=true;}}}

function spawnSkillFx(skillId,targetId){
 const target=monsters.find(m=>m.id===targetId),origin=target||state.player;
 if(skillId==='cyclone')state.cycloneTimer=.9;
 if(skillId==='groundSlam')state.skillSpriteFx.push({kind:'groundSlam',x:state.player.x,y:state.player.y,age:0,duration:.62});
 if(skillId==='combustion')state.skillSpriteFx.push({kind:'combustion',x:origin.x,y:origin.y,age:0,duration:.48});
 if(skillId==='blackHole')state.skillSpriteFx.push({kind:'blackHole',x:state.player.x,y:state.player.y,age:0,duration:1.15,radius:260});
 if(skillId==='meteorStorm')state.skillSpriteFx.push({kind:'meteorStorm',x:origin.x,y:origin.y,age:0,duration:.82});
 const palette={blackHole:'#9d8cff',cyclone:'#8eeaff',fireball:'#ff9b62',meteorStorm:'#ff7355',thunderStorm:'#8fc8ff',lightningField:'#b5d8ff',frostNova:'#b8efff',groundSlam:'#d8b07a',chainLightning:'#b7caff'};const color=palette[skillId]||'#e8ddff';
 const count=skillId==='blackHole'?42:skillId==='cyclone'?34:26;
 for(let i=0;i<count;i++){const a=(i/count)*Math.PI*2,r=18+Math.random()*(skillId==='blackHole'?150:62);state.particles.push({x:origin.x+Math.cos(a)*r,y:origin.y+Math.sin(a)*r,vx:Math.cos(a)*(skillId==='blackHole'?-85:35),vy:Math.sin(a)*(skillId==='blackHole'?-85:35)-18,life:.45+Math.random()*.35,size:2+Math.random()*3,color});}
}
function presentV2Events(events,{hitFx=true}={}){
  for(const event of events){
    if(event.type==='skillCast' && event.sourceId===arenaV2.playerId){addSkillCastLabel(event.skillId);spawnSkillFx(event.skillId,event.targetId);}
    if(event.type==='barrierApplied'&&event.entityId===arenaV2.playerId){state.barrierFx={life:event.durationMs/1000,maxLife:event.durationMs/1000,amount:event.amount};addFloater(state.player,`SHIELD ${event.amount}`,'#8ed8ff',-48,1,{bg:'rgba(16,55,88,.9)',life:1.1});}
    if(event.type==='barrierAbsorbed'&&event.entityId===arenaV2.playerId)addFloater(state.player,`-${event.amount} SHIELD`,'#9ee7ff',-28,.9,{offsetX:-42,life:.8});
    if(event.type==='healed' && event.targetId===arenaV2.playerId)addFloater(state.player,`+${event.amount}`,'#70f59a',-34,1.05,{offsetX:34,life:1.05});
    if(event.type==='attackStarted' && event.sourceId===arenaV2.playerId && !state.heroCombat.playback.active){
      const enemy=monsters.find(m=>m.id===event.targetId);if(enemy)faceWorldTarget(enemy);
      beginHeroAttack(state.heroCombat.playback,{attackIntervalMs:state.heroCombat.attackIntervalMs,payload:null});
    }
    if(event.type==='damageDealt' && event.sourceId===arenaV2.playerId){
      const enemy=monsters.find(m=>m.id===event.targetId); if(!enemy) continue;
      if(worldBossEvent.active&&enemy.monsterType==='greatMythicDragon')worldBossEvent.totalDamage+=Math.max(0,event.amount||0);
      enemy.hurtTimer=.28; enemy.flashTimer=.16; if(!enemy.bossAttackPhase) enemy.anim='hurt';
      const masteryProc=event.effect?.origin==='MASTERY_PROC';
      const additionalHit=masteryProc&&event.effect?.ability==='multiShot';
      const procLabel=additionalHit?'ADDITIONAL HIT!':'DOUBLE ATTACK!';
      addFloater(enemy,masteryProc?(event.critical?`${procLabel} ★  ${event.amount}`:`${procLabel}  ${event.amount}`):(event.critical?`CRITICAL! ★  ${event.amount}`:`${event.amount}`),event.critical?'#ffe36f':additionalHit?'#a98cff':masteryProc?'#9fe8ff':'#ffffff',masteryProc?-46:event.critical?-38:-24,masteryProc?1.55:event.critical?1.72:1.35);if(event.critical){spawnCritBurst(enemy);}
      if(hitFx) spawnStripFx('global-hit-spark',enemy.x,enemy.y-(enemy.isBoss?30:16),{duration:.18,scale:enemy.isBoss?1.25:1});
    }
    if(event.type==='attackStarted' && event.targetId===arenaV2.playerId){
      const enemy=monsters.find(m=>m.id===event.sourceId); if(enemy){enemy.anim='attack';enemy.attackStartedFx=true;enemy.attackTimer=Math.max(enemy.attackTimer??0,(arenaV2.simulation.world.monsters.get(enemy.id)?.attackIntervalMs??850)/1000);}
    }
    if(event.type==='damageDealt' && event.targetId===arenaV2.playerId){
      state.player.hitTimer=event.critical?.28:.18;state.player.hurtAnimTimer=HERO_HURT_ANIM_SECONDS;
      spawnStripFx('global-hit-spark',state.player.x,state.player.y-18,{duration:.18,scale:event.critical?1.35:1});
      addFloater(state.player,event.critical?`CRIT -${event.amount}`:`-${event.amount}`,'#ff8d82',-42,event.critical?1.1:.9);
    }
    if(event.type==='entityDefeated'){
      const enemy=monsters.find(m=>m.id===event.entityId); if(enemy){presentMonsterDeath(enemy);if(state.combatTarget===enemy){state.combatTarget=null;arenaV2.move({x:0,y:0});}}
      if(event.entityId===arenaV2.playerId){addFloater(state.player,'DEFEATED','#ff8d82',-54,1.2);startDeathOverlay();setTimeout(()=>{saveArenaCharacter(arenaV2.character);const url=new URL(window.location.href);url.searchParams.set('biome','town');url.searchParams.delete('qa');window.location.assign(url.toString());},10000);}
    }
    if(event.type==='entityRespawned'){
      const enemy=monsters.find(m=>m.id===event.entityId);if(enemy){enemy.deathPresented=false;enemy.dead=false;enemy.aggressive=biome!=='mine';enemy.anim='walk';enemy.animTimer=0;enemy.hurtTimer=0;enemy.flashTimer=0;enemy.attackTimer=0;enemy.deathTimer=0;}
    }
  }
}
function entityInsideSafeZone(entity){return Boolean(entity&&pointInsideSafeZone(entity.x,entity.y));}
function dispatchV2BasicAttack(enemy){
  if(activeSafeZone()||entityInsideSafeZone(enemy))return{accepted:false,events:[],reason:'safe-zone'};
  const result=arenaV2.basicAttack(enemy.id);if(result.accepted)presentV2Events(result.events);return result;
}
function dispatchV2Skill(skillId,enemy,ground){ syncArenaV2Positions(); const result=arenaV2.castSkill(skillId,enemy?.id,ground); if(result.accepted)presentV2Events(result.events); return result; }

const groundBits = Array.from({ length: 520 }, (_, i) => ({
  x: WORLD.minX + hash(i * 3.1) * (WORLD.maxX - WORLD.minX),
  y: WORLD.minY + hash(i * 7.7 + 4) * (WORLD.maxY - WORLD.minY),
  type: i % 11 === 0 ? 'stone' : i % 17 === 0 ? 'magic' : 'grass',
  tone: Math.floor(hash(i * 9.4) * 3),
}));

const mossPatches = Array.from({ length: 34 }, (_, i) => ({
  x: WORLD.minX + hash(i * 13 + 2) * (WORLD.maxX - WORLD.minX),
  y: WORLD.minY + hash(i * 19 + 8) * (WORLD.maxY - WORLD.minY),
  width: 45 + hash(i * 5) * 90,
  height: 12 + hash(i * 11) * 24,
}));

function hash(value) {
  const x = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function worldToScreen(x, y) {
  const dx = x - state.camera.x;
  const dy = y - state.camera.y;
  return {
    x: Math.round(W / 2 + (dx - dy) * ISO_X),
    y: Math.round(GROUND_Y + (dx + dy) * ISO_Y),
  };
}

function screenToWorld(x, y) {
  const sx = x - W / 2;
  const sy = y - GROUND_Y;
  const dx = sx + sy * 2;
  const dy = sy * 2 - sx;
  return { x: state.camera.x + dx, y: state.camera.y + dy };
}

function angularDifference(a, b) {
  return ((a - b + 540) % 360) - 180;
}

function setFacing(vx, vy) {
  if (Math.hypot(vx, vy) < .01) return;
  // vx/vy are WORLD-space movement. Sprite directions are SCREEN-space directions.
  // Under the 2:1 projection, +worldX travels down-right and +worldY travels down-left.
  // Using world vectors directly made the hero visually face sideways/backwards while
  // authoritative movement was correctly approaching the target.
  const screenVx=(vx-vy)*ISO_X;
  const screenVy=(vx+vy)*ISO_Y;
  const heading = (Math.atan2(screenVx, -screenVy) * 180 / Math.PI + 360) % 360;
  const currentCenter = state.player.directionIndex * 45;
  if (Math.abs(angularDifference(heading, currentCenter)) > 22.5 + HYSTERESIS) {
    state.player.directionIndex = Math.round(heading / 45) % 8;
  }
  state.player.heading = heading;
}

function resolveCollisions(entity) {
  entity.x = Math.max(WORLD.minX + 34, Math.min(WORLD.maxX - 34, entity.x));
  entity.y = Math.max(WORLD.minY + 24, Math.min(WORLD.maxY - 24, entity.y));
  for (let pass = 0; pass < 2; pass += 1) {
    for (const prop of props) {
      if (!prop.collider) continue;
      const rx = prop.collider.rx + entity.radiusX;
      const ry = prop.collider.ry + entity.radiusY;
      const nx = (entity.x - prop.x) / rx;
      const ny = (entity.y - prop.y) / ry;
      const distance = Math.hypot(nx, ny);
      if (distance >= 1) continue;
      const safe = distance || .001;
      entity.x = prop.x + nx / safe * rx;
      entity.y = prop.y + ny / safe * ry;
    }
  }
}

function updatePlayer(dt) {
  if (qaMode === 'circle') {
    const angle = (performance.now() - qaStartTime) / 1000 * .82;
    state.player.x = 405 + Math.cos(angle) * 108;
    state.player.y = 80 + Math.sin(angle) * 70;
    state.player.vx = -Math.sin(angle) * 108 * .82;
    state.player.vy = Math.cos(angle) * 70 * .82;
    setFacing(state.player.vx, state.player.vy);
    return;
  }

  let vx = Number(state.keys.has('right')) - Number(state.keys.has('left'));
  let vy = Number(state.keys.has('down')) - Number(state.keys.has('up'));
  const manual = Boolean(vx || vy || state.target);

  if (vx || vy) {
    state.target = null;
    state.combatTarget = null;
    const length = Math.hypot(vx, vy);
    vx = vx / length * MOVE_SPEED;
    vy = vy / length * MOVE_SPEED;
  } else {
    let destination = state.target;
    if (!destination && state.autoCombat) {
      const allowedIds=state.autoMonsterTypes.size?new Set(monsters.filter(m=>state.autoMonsterTypes.has(m.monsterType)).map(m=>m.id)):undefined;
      const auto=arenaV2.autoStep(state.controlMode,{allowedMonsterIds:allowedIds,restEnabled:state.autoRestEnabled,restBelowHpFraction:state.autoRestBelowPercent/100,resumeAboveHpFraction:state.autoResumePercent/100});
      if(auto?.result?.accepted){
        presentV2Events(auto.result.events);
        // Commands only set authoritative intent. Position is advanced by simulation.step(),
        // so do not derive presentation velocity from a zero-distance command dispatch.
      }
      const targetId=auto?.command?.targetId;
      state.combatTarget=targetId?monsters.find(m=>m.id===targetId)??state.combatTarget:state.combatTarget;
      return;
    }

    if (destination) {
      const dx = destination.x - state.player.x;
      const dy = destination.y - state.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < (manual ? 3 : 55)) {
        if (state.target) state.target = null;
      } else {
        vx = dx / distance * MOVE_SPEED;
        vy = dy / distance * MOVE_SPEED;
      }
    }
  }

  if (vx || vy) setFacing(vx, vy);
  const length=Math.hypot(vx,vy);
  // Forest1 Engine is authoritative for walkability. Cancel the movement command when the
  // projected next foot position is water, a cliff step, or otherwise not standable.
  if(useForestEngine&&forestEngineReady&&length){
    const step=Math.min(10,MOVE_SPEED*dt),nx=state.player.x+vx/length*step,ny=state.player.y+vy/length*step;
    const z=runtimeWalkHeight(state.player.x,state.player.y)??0;
    if(!canRuntimeActorStand(nx,ny,z)){vx=0;vy=0;}
  }
  const acceptedLength=Math.hypot(vx,vy);
  arenaV2.move(acceptedLength?{x:vx/acceptedLength,y:vy/acceptedLength}:{x:0,y:0});
  state.player.vx=vx;state.player.vy=vy;
}

const HERO_MOTION_ROOT = '../Cute_chibi_anthropomorph-change_to_white_rabb/change_to_white_rabb/animations';
const HERO_JUMP_ACTION = 'Two-Footed_Jump';
const heroMotionFrames = { run: {}, jump: {} };
const heroNativeDirection = {
  south: ['south', false],
  'south-east': ['south-east', false],
  east: ['east', false],
  'north-east': ['north-east', false],
  north: ['north', false],
  'south-west': ['south-east', true],
  west: ['east', true],
  'north-west': ['north-east', true],
};
async function loadHeroMotion(action, frameCount) {
  const result = {};
  for (const [direction, [folder, flipX]] of Object.entries(heroNativeDirection)) {
    const frames = await Promise.all(Array.from({length:frameCount}, (_, i) =>
      loadImage(`${HERO_MOTION_ROOT}/${action}/${folder}/frame_${String(i).padStart(3,'0')}.png`)
    ));
    result[direction] = { frames, flipX };
  }
  return result;
}
heroMotionFrames.jump = await loadHeroMotion(HERO_JUMP_ACTION, 7);

// Blessed white bunny (PixelLab, exported by shadow-bunny-pixellab/export_blessed_bunny.py).
// 5 authored directions; west side mirrors via heroNativeDirection. footY = feet row in the frame.
const BLESSED_ROOT = '../isometric-player/blessed-bunny';
const blessedManifest = await fetch(`${BLESSED_ROOT}/manifest.json`).then(r => r.json());
async function loadBlessedAnim(anim) {
  const result = {};
  for (const [direction, [folder, flipX]] of Object.entries(heroNativeDirection)) {
    const meta = blessedManifest[anim][folder];
    const frames = await Promise.all(Array.from({length:meta.frames}, (_, i) =>
      loadImage(`${BLESSED_ROOT}/${anim}/${folder}/frame_${String(i).padStart(3,'0')}.png`)
    ));
    result[direction] = { frames, flipX, footY: meta.footY };
  }
  return result;
}
const heroIdleFrames = await loadBlessedAnim('idle');
const heroHurtFrames = await loadBlessedAnim('hurt');
const heroDeathFrames = await loadBlessedAnim('death');
const HERO_HURT_ANIM_SECONDS = .36, HERO_DEATH_ANIM_SECONDS = 1.1;
heroMotionFrames.run = await loadBlessedAnim('run');
// Weapon + slash arc are baked per family; staff has no baked attack and keeps code FX.
const BAKED_ATTACK_FAMILIES = ['greatsword', 'dagger', 'axe', 'hammer', 'bow', 'swordShield'];
const heroAttackFrames = Object.fromEntries(await Promise.all(
  BAKED_ATTACK_FAMILIES.map(async family => [family, await loadBlessedAnim(`atk_${family}`)])
));


const combatFxStrips = new Map();

async function registerCombatFxFrames(id, basePath, frameCount, frameWidth, frameHeight, frameMs) {
  const frames = await Promise.all(Array.from({length:frameCount}, (_, i) =>
    loadImage(`${basePath}/frame_${String(i).padStart(3,'0')}.png`)
  ));
  combatFxStrips.set(id, { frames, frameCount, frameWidth, frameHeight, frameMs });
}

await Promise.all([
  registerCombatFxFrames('global-hit-spark', './fx/approved/global/hit_spark', 5, 32, 32, 35),
  registerCombatFxFrames('global-tackle', './fx/approved/global/tackle', 8, 64, 64, 35),
  registerCombatFxFrames('global-normal-death', './fx/approved/global/normal_death', 8, 64, 64, 55),
  registerCombatFxFrames('global-boss-death-burst', './fx/approved/global/boss_death_burst', 5, 96, 96, 60),
  registerCombatFxFrames('mushroom-telegraph', './fx/approved/forest1/mushroom_brute_telegraph', 4, 96, 64, 90),
  registerCombatFxFrames('thornroot-telegraph', './fx/approved/forest2/thornroot_telegraph', 5, 128, 64, 80),
  registerCombatFxFrames('thornroot-eruption', './fx/approved/forest2/thornroot_eruption', 8, 96, 64, 45),
  registerCombatFxFrames('dunemaw-telegraph', './fx/approved/desert1/dune_maw_telegraph', 5, 128, 64, 85),
  registerCombatFxFrames('dunemaw-eruption', './fx/approved/desert1/dune_maw_eruption', 7, 96, 96, 45),
  registerCombatFxFrames('sunforge-telegraph', './fx/approved/desert2/sunforge_telegraph', 5, 128, 64, 85),
  registerCombatFxFrames('goblin-cleave-impact', './fx/approved/mine/goblin_leader_cleave_impact', 6, 64, 64, 40),
  registerCombatFxFrames('goblin-charge-telegraph', './fx/approved/mine/goblin_leader_charge_telegraph', 4, 128, 64, 85),
  registerCombatFxFrames('goblin-charge-trail', './fx/approved/mine/goblin_leader_charge_trail', 8, 96, 64, 35),
  registerCombatFxFrames('goblin-charge-impact', './fx/approved/mine/goblin_leader_charge_impact', 5, 96, 96, 45),
]);

function spawnStripFx(id, x, y, options = {}) {
  const strip = combatFxStrips.get(id);
  if (!strip) return false;
  state.stripFx ??= [];
  state.stripFx.push({
    id, x, y, age: 0,
    duration: options.duration ?? strip.frameCount * strip.frameMs / 1000,
    scale: Math.max(1, Math.round(options.scale ?? 1)),
    rotation: options.rotation ?? 0,
    flipX: options.flipX ?? false,
    anchor: options.anchor ?? 'center',
  });
  return true;
}

function beginTackle(monster, dx, dy, distance) {
  const len = Math.max(1, distance);
  monster.tacklePhase = 'windup';
  monster.tackleTimer = monster.elite ? .34 : .28;
  monster.tackleX = dx / len;
  monster.tackleY = dy / len;
  monster.attackTimer = monster.elite ? 1.35 : 1.15;
  state.attackTelegraphs ??= [];
  state.attackTelegraphs.push({type:'tackle',x:monster.x,y:monster.y,dx:monster.tackleX,dy:monster.tackleY,age:0,duration:monster.tackleTimer,elite:!!monster.elite});
}

function updateTackle(monster, dt) {
  if (!monster.tacklePhase) return false;
  monster.tackleTimer -= dt;
  if (monster.tacklePhase === 'windup' && monster.tackleTimer <= 0) {
    monster.tacklePhase = 'lunge'; monster.tackleTimer = .28;
    spawnStripFx('global-tackle', monster.x, monster.y - 8, {
      flipX: monster.facing === 'left',
      duration: .28,
      scale: monster.elite ? 2 : 1,
    });
  } else if (monster.tacklePhase === 'lunge') {
    const step = 100 * dt;
    monster.x += monster.tackleX * step; monster.y += monster.tackleY * step;
    resolveCollisions(monster);
    if (monster.tackleTimer <= 0) {
      monster.tacklePhase = 'impact'; monster.tackleTimer = .08;
      // Presentation-only impact. Authoritative hit/damage is resolved by BunnySimulation.
    }
  } else if (monster.tacklePhase === 'impact' && monster.tackleTimer <= 0) {
    monster.tacklePhase = 'recovery'; monster.tackleTimer = .18;
  } else if (monster.tacklePhase === 'recovery' && monster.tackleTimer <= 0) {
    monster.tacklePhase = null; monster.tackleTimer = 0;
  }
  return true;
}

function beginBossAttack(monster) {
  if (monster.monsterType === 'goblinLeader') {
    const cycle = ['cleave', 'stomp', 'charge'];
    monster.bossAttackKind = cycle[(monster.bossAttackCount ?? 0) % cycle.length];
    monster.bossAttackCount = (monster.bossAttackCount ?? 0) + 1;
  }
  const config = beginBossAttackState(monster);
  if (!config) return false;
  const type = monster.monsterType;
  if (type === 'thornroot') {
    const screenA=worldToScreen(monster.x,monster.y), screenB=worldToScreen(state.player.x,state.player.y);
    spawnStripFx('thornroot-telegraph', monster.x, monster.y, {
      duration:monster.bossAttackTimer, anchor:'left-ground-origin',
      flipX:screenB.x<screenA.x, rotation:Math.atan2(screenB.y-screenA.y,screenB.x-screenA.x),
    });
  } else if (type === 'mushroom') {
    spawnStripFx('mushroom-telegraph', monster.x, monster.y, { duration: config.telegraph, anchor: 'ground-center' });
    state.bossTelegraphs ??= [];
    state.bossTelegraphs.push({type:'mushroom-slam',x:monster.x,y:monster.y,age:0,duration:config.telegraph,maxRadius:72});
  } else if (type === 'dunemaw') {
    monster.bossTargetX = state.player.x; monster.bossTargetY = state.player.y;
    spawnStripFx('dunemaw-telegraph', monster.bossTargetX, monster.bossTargetY, { duration:config.telegraph, anchor:'ground-center' });
  } else if (type === 'colossus') {
    monster.bossTargetX = state.player.x; monster.bossTargetY = state.player.y;
    spawnStripFx('sunforge-telegraph', monster.bossTargetX, monster.bossTargetY, { duration:config.telegraph, anchor:'ground-center' });
  } else if (type === 'goblinLeader') {
    const dx=state.player.x-monster.x, dy=state.player.y-monster.y, len=Math.max(1,Math.hypot(dx,dy));
    monster.bossAttackX=dx/len; monster.bossAttackY=dy/len;
    state.bossTelegraphs ??= [];
    if (monster.bossAttackKind === 'cleave') {
      state.bossTelegraphs.push({type:'goblin-cleave',x:monster.x,y:monster.y,dx:monster.bossAttackX,dy:monster.bossAttackY,age:0,duration:config.telegraph,maxRadius:76});
    } else if (monster.bossAttackKind === 'stomp') {
      state.bossTelegraphs.push({type:'goblin-stomp',x:monster.x,y:monster.y,age:0,duration:config.telegraph,maxRadius:88});
    } else {
      const a=worldToScreen(monster.x,monster.y), b=worldToScreen(state.player.x,state.player.y);
      spawnStripFx('goblin-charge-telegraph',monster.x,monster.y,{duration:config.telegraph,anchor:'left-ground-origin',flipX:b.x<a.x,rotation:Math.atan2(b.y-a.y,b.x-a.x)});
    }
  }
  return true;
}

function updateBossAttack(monster, dt) {
  if (!monster.bossAttackPhase) return false;
  const events = updateBossAttackState(monster, dt);
  if (!events.includes('impact')) return true;

  const type = monster.monsterType;
  const config = getBossAttackConfig(type);
  let hitX = monster.x, hitY = monster.y, hitRange = config?.hitRange ?? 72, label = 'HIT!';

  if (type === 'thornroot') {
    const dx=state.player.x-monster.x, dy=state.player.y-monster.y, len=Math.max(1,Math.hypot(dx,dy));
    hitX=monster.x+dx/len*68; hitY=monster.y+dy/len*68;
    spawnStripFx('thornroot-eruption', hitX, hitY, { duration:.36, anchor:'ground-center' });
    label='ROOT HIT!';
  } else if (type === 'mushroom') {
    const palette=['#76502f','#9a6a3c','#c8d99b','#dce9b2'];
    for(let i=0;i<30;i++){const a=Math.random()*Math.PI*2,s=38+Math.random()*105;state.particles.push({x:monster.x,y:monster.y-4,vx:Math.cos(a)*s,vy:Math.sin(a)*s-48,life:.32+Math.random()*.36,size:2+Math.floor(Math.random()*3),color:palette[i%palette.length]});}
    state.shockwaves ??= []; state.shockwaves.push({x:monster.x,y:monster.y,age:0,duration:.42,maxRadius:94,kind:'mushroom-slam'});
    label='SLAM!';
  } else if (type === 'dunemaw') {
    hitX=monster.bossTargetX ?? monster.x; hitY=monster.bossTargetY ?? monster.y;
    spawnStripFx('dunemaw-eruption',hitX,hitY,{duration:.315,anchor:'ground-center'});
    label='AMBUSH!';
  } else if (type === 'colossus') {
    hitX=monster.bossTargetX ?? monster.x; hitY=monster.bossTargetY ?? monster.y;
    state.shockwaves ??= []; state.shockwaves.push({x:hitX,y:hitY,age:0,duration:.34,maxRadius:104,kind:'sunforge'});
    const palette=['#f3c45d','#d99a3d','#fff0a6','#8f6a42'];
    for(let i=0;i<18;i++){const a=(i/18)*Math.PI*2,s=55+Math.random()*65;state.particles.push({x:hitX,y:hitY,vx:Math.cos(a)*s,vy:Math.sin(a)*s*.55-22,life:.24+Math.random()*.18,size:2,color:palette[i%palette.length]});}
    label='CORE PULSE!';
  } else if (type === 'goblinLeader') {
    const a=worldToScreen(monster.x,monster.y), endpointX=monster.x+(monster.bossAttackX??1)*78, endpointY=monster.y+(monster.bossAttackY??0)*78;
    if (monster.bossAttackKind === 'cleave') {
      spawnStripFx('goblin-cleave-impact',monster.x+(monster.bossAttackX??1)*34,monster.y+(monster.bossAttackY??0)*34,{duration:.24,anchor:'ground-center',flipX:monster.facing==='left'});
      hitRange=86; label='BRUTAL CLEAVE!';
    } else if (monster.bossAttackKind === 'stomp') {
      state.shockwaves ??= []; state.shockwaves.push({x:monster.x,y:monster.y,age:0,duration:.42,maxRadius:112,kind:'goblin-stomp'});
      for(let i=0;i<20;i++){const q=Math.random()*Math.PI*2,s=38+Math.random()*80;state.particles.push({x:monster.x,y:monster.y,vx:Math.cos(q)*s,vy:Math.sin(q)*s-34,life:.25+Math.random()*.25,size:2+Math.floor(Math.random()*2),color:i%2?'#80664b':'#a1845d'});}
      hitRange=92; label='WAR STOMP!';
    } else {
      const beforeX=monster.x,beforeY=monster.y;
      monster.x=endpointX; monster.y=endpointY; resolveCollisions(monster);
      const b=worldToScreen(monster.x,monster.y);
      spawnStripFx('goblin-charge-trail',beforeX,beforeY,{duration:.28,anchor:'left-ground-origin',flipX:b.x<a.x,rotation:Math.atan2(b.y-a.y,b.x-a.x)});
      spawnStripFx('goblin-charge-impact',monster.x,monster.y,{duration:.225,anchor:'ground-center'});
      hitX=monster.x; hitY=monster.y; hitRange=58; label="LEADER'S CHARGE!";
    }
  }

  if (!monster.bossAttackHit && Math.hypot(state.player.x-hitX,state.player.y-hitY) <= hitRange) {
    monster.bossAttackHit=true;
    // Telegraph/animation only. BunnySimulation owns whether this attack hits and its damage.
  }
  return true;
}

function debugTrigger(kind) {
  const target = state.combatTarget || nearestMonster()?.monster;
  if (!target) return;
  if (kind === 'hit') dispatchV2BasicAttack(target);
  if (kind === 'death') { const simMonster=arenaV2.simulation.world.monsters.get(target.id); if(simMonster){simMonster.hp=0;simMonster.alive=false;presentMonsterDeath(target);} }
  if (kind === 'tackle' && !target.isBoss) beginTackle(target, state.player.x-target.x, state.player.y-target.y, Math.hypot(state.player.x-target.x,state.player.y-target.y));
  if (kind === 'boss' && target.isBoss) beginBossAttack(target);
}

function updateMonsters(dt) {
  for (const monster of monsters) {
    const simMonster=arenaV2.simulation.world.monsters.get(monster.id);
    if (monster.dead) {
      monster.deathTimer = Math.max(0, (monster.deathTimer ?? 0) - dt);
      if (monster.isBoss) {
        if (monster.deathTimer <= .65 && !monster.bossDeathFxDone) {
          monster.bossDeathFxDone = true;
          spawnStripFx('global-boss-death-burst', monster.x, monster.y - 28, { duration:.6, scale:2 });
          state.shockwaves ??= [];
          state.shockwaves.push({x:monster.x,y:monster.y,age:0,duration:.55,maxRadius:150,kind:'boss-death-final'});
        }
        if (monster.deathTimer <= 0 && !monster.deathBurstDone) monster.deathBurstDone = true;
        continue;
      }
      // Respawn timing/state is owned by ArenaV2Adapter; renderer waits for entityRespawned.
      continue;
    }
    monster.hurtTimer = Math.max(0, (monster.hurtTimer ?? 0) - dt);
    monster.flashTimer = Math.max(0, (monster.flashTimer ?? 0) - dt);
    const previousAttackTimer = monster.attackTimer ?? 0;
    monster.attackTimer = Math.max(0, previousAttackTimer - dt);
    if (monster.tacklePhase) { updateTackle(monster, dt); continue; }
    if (monster.bossAttackPhase) { updateBossAttack(monster, dt); continue; }
    const dx = state.player.x - monster.x;
    const dy = state.player.y - monster.y;
    if(activeSafeZone()){
      monster.aggressive=false;
      if(simMonster)simMonster.targetPlayerId=undefined;
      monster.anim=monster.hurtTimer>0?'hurt':'walk';
      continue;
    }
    // Monsters never enter a portal safe zone. If roaming/chasing reaches its boundary,
    // clear aggro and send the presentation entity back toward its spawn point.
    if(entityInsideSafeZone(monster)){
      monster.aggressive=false;if(simMonster)simMonster.targetPlayerId=undefined;
      monster.x=monster.spawnX;monster.y=monster.spawnY;monster.targetX=monster.spawnX;monster.targetY=monster.spawnY;
      if(simMonster)simMonster.position={x:monster.spawnX,y:monster.spawnY};
      continue;
    }
    const distance = Math.hypot(dx, dy);
    if (biome === 'mine' && !monster.aggressive) {
      // Mine monsters should acquire the hero from a useful encounter distance,
      // then close into the much tighter melee/skill range below.
      if (distance <= (monster.aggroRange ?? 260)) {
        monster.aggressive = true;
        monster.ambient = null;
      } else {
        monster.anim = 'walk';
        continue;
      }
    }
    if (monster.aggressive) {
      // Mine enemies are visually larger and their shared 72/86px trigger made them attack before melee contact.
      // Keep the established Forest/Desert tuning; only tighten Mine engagement distance.
      const attackRange = biome === 'mine'
        ? (monster.isBoss ? 62 : monster.elite ? 48 : 42)
        : (monster.isBoss ? 78 : monster.elite ? 86 : 72);
      if (distance > attackRange) {
        monster.anim = monster.hurtTimer > 0 ? 'hurt' : 'walk';
      } else {
        if (monster.hurtTimer > 0) monster.anim = 'hurt';
        else {
          monster.anim = 'attack';
          // Attack timing and hit resolution are authoritative in BunnySimulation.
          // These states only select matching presentation animation/telegraph after simulation events.
          if (monster.attackStartedFx && !monster.isBoss && !monster.tacklePhase) { monster.attackStartedFx=false; beginTackle(monster, dx, dy, distance); }
          else if (monster.attackStartedFx && monster.isBoss && getBossAttackConfig(monster.monsterType) && !monster.bossAttackPhase) { monster.attackStartedFx=false; beginBossAttack(monster); }
        }
      }
      continue;
    }
  }
}

function update(dt) {
  state.time += dt;
  updateProductionHud();
  updateWorldBossBanner();
  syncSkillCooldowns();
  if(playerHpBar){const hp=state.player.hp??1,maxHp=state.player.maxHp??1;playerHpBar.style.width=`${Math.max(0,Math.min(100,hp/maxHp*100))}%`;}
  syncArenaV2Positions();
  const beforeStepX=state.player.x,beforeStepY=state.player.y;
  const simPlayer=arenaV2.simulation.world.players.get(arenaV2.playerId);
  const preRestHp=simPlayer?.hp??0,preRestSp=simPlayer?.sp??0;
  const stepEvents=arenaV2.step(dt * 1000);
  presentV2Events(stepEvents);
  updateWorldBossEvent(dt);
  if(state.manualRest&&simPlayer?.alive){
    // Engine already applied normal regeneration this tick. Rest triples that actual tick gain.
    if(simPlayer.hp>preRestHp)simPlayer.hp=Math.min(simPlayer.maxHp,simPlayer.hp+(simPlayer.hp-preRestHp)*2);
    if(simPlayer.sp!==undefined&&simPlayer.maxSp!==undefined&&simPlayer.sp>preRestSp)simPlayer.sp=Math.min(simPlayer.maxSp,simPlayer.sp+(simPlayer.sp-preRestSp)*2);
  }
  // Presentation facing follows the ACTUAL authoritative displacement from this tick.
  // This keeps the run sprite pointed along the path to the target instead of using
  // a stale/command-space vector.
  const authoritativeDx=state.player.x-beforeStepX,authoritativeDy=state.player.y-beforeStepY;
  if(authoritativeDx||authoritativeDy){
    setFacing(authoritativeDx,authoritativeDy);
    state.player.vx=authoritativeDx/Math.max(dt,.001);
    state.player.vy=authoritativeDy/Math.max(dt,.001);
  }else if(state.autoCombat){
    state.player.vx=0;state.player.vy=0;
  }
  updatePlayer(dt);
  // updatePlayer can issue a new movement intent after the authoritative step. Do not let
  // that command-space vector overwrite the facing for the displacement already rendered
  // this frame; this was the visible moonwalk during chase/Auto transitions.
  if(authoritativeDx||authoritativeDy){setFacing(authoritativeDx,authoritativeDy);state.player.vx=authoritativeDx/Math.max(dt,.001);state.player.vy=authoritativeDy/Math.max(dt,.001);}
  updateHeroCombat(dt);
  updateWarpPortal();
  if(state.controlMode==='manual'&&state.combatTarget&&!state.combatTarget.dead&&!state.heroCombat.playback.active){
    const dx=state.combatTarget.x-state.player.x,dy=state.combatTarget.y-state.player.y,dist=Math.hypot(dx,dy);
    const authoritativePlayer=arenaV2.simulation.world.players.get(arenaV2.playerId);
    const attackRange=Math.max(1,(authoritativePlayer?.attackRange??58)-2);
    if(dist<=attackRange){arenaV2.move({x:0,y:0});triggerAttack(state.combatTarget);}
    else arenaV2.move({x:dx,y:dy});
  }
  updateMonsters(dt);
  updateCombatFx(dt);
  updateCycloneHits(dt);
  if(state.barrierFx){state.barrierFx.life-=dt;if(state.barrierFx.life<=0)state.barrierFx=null;}
  updateMeteors(dt);
  updateThunderStorms(dt);
  state.cycloneTimer = Math.max(0, state.cycloneTimer - dt);
  state.attackTimer = Math.max(0, state.attackTimer - dt);
  state.damageTimer = Math.max(0, state.damageTimer - dt);
  state.player.hitTimer = Math.max(0, (state.player.hitTimer ?? 0) - dt);
  state.player.hurtAnimTimer = Math.max(0, (state.player.hurtAnimTimer ?? 0) - dt);
  state.player.jumpTimer = Math.max(0, (state.player.jumpTimer ?? 0) - dt);
  const follow = 1 - Math.exp(-4.7 * dt);
  state.camera.x += (state.player.x - 70 - state.camera.x) * follow;
  state.camera.y += (state.player.y - 130 - state.camera.y) * follow;
}

function drawSky() {
  ctx.fillStyle = '#182a2c'; ctx.fillRect(0, 0, W, HORIZON);
  ctx.fillStyle = '#20383a'; ctx.fillRect(0, 62, W, 72);
  ctx.fillStyle = '#2b4745'; ctx.fillRect(0, 134, W, 68);
  ctx.fillStyle = '#38534d'; ctx.fillRect(0, 202, W, 62);
  ctx.fillStyle = 'rgba(202,207,164,.08)';
  for (let i = 0; i < 70; i += 1) {
    const x = Math.floor(hash(i * 3) * W / 4) * 4;
    const y = Math.floor(hash(i * 8) * HORIZON / 4) * 4;
    ctx.fillRect(x, y, 4, 4);
  }
  const moonX = 1035 - state.camera.x * .035;
  ctx.fillStyle = '#b7d4c7';
  ctx.fillRect(Math.round(moonX - 24), 66, 48, 48);
  ctx.fillStyle = '#182a2c';
  ctx.fillRect(Math.round(moonX - 30), 58, 28, 52);
}

function steppedMountain(x, base, width, height, color) {
  ctx.fillStyle = color;
  const steps = 10;
  for (let i = 0; i < steps; i += 1) {
    const ratio = i / steps;
    const bandWidth = width * (1 - ratio);
    ctx.fillRect(Math.round(x - bandWidth / 2), Math.round(base - height * ratio), Math.round(bandWidth), Math.ceil(height / steps) + 2);
  }
}

function drawMountains() {
  const shift = -state.camera.x * .075;
  for (let i = -2; i < 7; i += 1) steppedMountain(i * 310 + 85 + shift, 280, 360, 155 + (i % 2) * 35, i % 2 ? '#213a39' : '#284443');
}

function drawCastle() {
  const x = 850 - state.camera.x * .17;
  ctx.fillStyle = '#172c2d';
  ctx.fillRect(Math.round(x - 124), 164, 250, 116);
  for (const tower of [-112, -38, 47, 107]) {
    const h = tower === -38 ? 96 : 64;
    ctx.fillRect(Math.round(x + tower - 16), 164 - h, 32, h + 116);
    ctx.fillRect(Math.round(x + tower - 22), 164 - h, 10, 13);
    ctx.fillRect(Math.round(x + tower + 12), 164 - h, 10, 13);
  }
  ctx.fillStyle = '#b2c98f';
  for (let i = -1; i <= 2; i += 1) ctx.fillRect(Math.round(x + i * 48), 218, 5, 10);
}

function drawFarForest() {
  const shift = -state.camera.x * .3;
  for (let i = -4; i < 20; i += 1) {
    const x = i * 92 + shift % 92;
    const height = 68 + hash(i + 30) * 65;
    ctx.fillStyle = i % 3 ? '#18342d' : '#1d3b31';
    ctx.fillRect(Math.round(x - 8), Math.round(HORIZON - height + 33), 16, Math.round(height));
    for (let b = 0; b < 5; b += 1) {
      const width = 58 - b * 8;
      ctx.fillRect(Math.round(x - width / 2), Math.round(HORIZON - height + b * 16), width, 18);
    }
  }
}

function drawMist() {
  const drift = (state.time * 6 - state.camera.x * .08) % 220;
  ctx.fillStyle = 'rgba(147, 188, 174, .08)';
  for (let i = -2; i < 8; i += 1) {
    const x = i * 220 + drift;
    ctx.fillRect(Math.round(x), 225 + (i % 2) * 12, 142, 10);
    ctx.fillRect(Math.round(x + 36), 237 + (i % 2) * 12, 176, 7);
  }
}

function drawGround() {
  // Dark backdrop + a readable square-isometric diorama slab. The diamond is the projection
  // of the square arena; there is no gameplay ring painted into the combat clearing.
  ctx.fillStyle = BIOME.back; ctx.fillRect(0, 0, W, H);
  const corners = [
    worldToScreen(WORLD.minX, WORLD.minY), worldToScreen(WORLD.maxX, WORLD.minY),
    worldToScreen(WORLD.maxX, WORLD.maxY), worldToScreen(WORLD.minX, WORLD.maxY),
  ];
  ctx.save();
  ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath(); ctx.fillStyle = BIOME.ground; ctx.fill();
  ctx.strokeStyle = BIOME.edge; ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.clip();

  // Keep culling conservative under the rotated iso basis; art density matters more than a tiny POC optimization.
  const visibleLeft = WORLD.minX - 100;
  const visibleRight = WORLD.maxX + 100;
  const visibleTop = WORLD.minY - 100;
  const visibleBottom = WORLD.maxY + 100;

  for (const patch of mossPatches) {
    if (patch.x < visibleLeft || patch.x > visibleRight || patch.y < visibleTop || patch.y > visibleBottom) continue;
    const p = worldToScreen(patch.x, patch.y);
    ctx.fillStyle = BIOME.patch;
    ctx.fillRect(Math.round(p.x - patch.width / 2), Math.round(p.y - patch.height / 4), Math.round(patch.width), Math.round(patch.height / 2));
    ctx.fillStyle = BIOME.patchHi;
    ctx.fillRect(Math.round(p.x - patch.width * .3), Math.round(p.y - patch.height * .6), Math.round(patch.width * .46), 4);
  }

  drawTrail();
  if(biome==='worldboss80'){
    // Ancient castle great hall: cold stone nave, central carpet, broken dais and symmetric pillars.
    const c=worldToScreen(0,0);ctx.fillStyle='#34313a';for(let yy=-190;yy<=190;yy+=12){ctx.fillRect(c.x-430,c.y+yy,860,11);ctx.fillStyle=yy%24===0?'#403b45':'#34313a';}ctx.fillStyle='#4d2630';ctx.fillRect(c.x-72,c.y-205,144,405);ctx.fillStyle='#765044';ctx.fillRect(c.x-5,c.y-205,10,405);const dais=worldToScreen(0,-500);ctx.fillStyle='#514b53';ctx.fillRect(dais.x-190,dais.y-32,380,64);ctx.fillStyle='#211d27';ctx.fillRect(dais.x-150,dais.y-46,300,18);for(const side of [-1,1])for(let i=0;i<4;i++){const p=worldToScreen(side*(470+i*55),-430+i*280);ctx.fillStyle='#1b1820';ctx.fillRect(p.x-22,p.y-118,44,118);ctx.fillStyle='#57515d';ctx.fillRect(p.x-17,p.y-112,34,102);ctx.fillStyle='#756b72';ctx.fillRect(p.x-25,p.y-120,50,12);ctx.fillRect(p.x-24,p.y-12,48,12);}
  }
  if(biome==='town'){
    const plaza=worldToScreen(0,20);ctx.fillStyle='#8e816a';for(let yy=-150;yy<=150;yy+=10){const ww=300*Math.sqrt(Math.max(0,1-(yy*yy)/(150*150)));ctx.fillRect(plaza.x-ww,plaza.y+yy,ww*2,10);}ctx.strokeStyle='rgba(210,195,157,.28)';ctx.lineWidth=2;for(let i=-240;i<=240;i+=40){ctx.beginPath();ctx.moveTo(plaza.x+i,plaza.y-125);ctx.lineTo(plaza.x+i,plaza.y+125);ctx.stroke();}for(let i=-100;i<=100;i+=28){ctx.beginPath();ctx.moveTo(plaza.x-260,plaza.y+i);ctx.lineTo(plaza.x+260,plaza.y+i);ctx.stroke();}
  }
  if (biome === 'forest2') drawSwampPools();

  for (const zone of sceneMetadata.clearings) {
    const p = worldToScreen(zone.x, zone.y);
    ctx.fillStyle = zone.id.startsWith('LANDMARK') ? BIOME.landmark : BIOME.clearing;
    for (let yy = -zone.ry / 2; yy <= zone.ry / 2; yy += 4) {
      const ww = zone.rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / ((zone.ry / 2) ** 2)));
      ctx.fillRect(Math.round(p.x - ww), Math.round(p.y + yy), Math.round(ww * 2), 4);
    }
  }

  for (const bit of groundBits) {
    if (bit.x < visibleLeft || bit.x > visibleRight || bit.y < visibleTop || bit.y > visibleBottom) continue;
    const p = worldToScreen(bit.x, bit.y);
    if (bit.type === 'stone') {
      ctx.fillStyle = biome === 'desert' ? (bit.tone ? '#9b7045' : '#825d3d') : biome === 'snow' ? (bit.tone ? '#8fa3a5' : '#788d91') : (bit.tone ? '#557061' : '#486355');
      ctx.fillRect(p.x - 4, p.y - 2, 9, 4);
      ctx.fillStyle = biome === 'desert' ? '#d0a36a' : biome === 'snow' ? '#e5eeee' : '#789180'; ctx.fillRect(p.x - 2, p.y - 3, 5, 2);
    } else if (bit.type === 'magic') {
      const glow = .42 + Math.sin(state.time * 2 + bit.x) * .16;
      ctx.fillStyle = `rgba(152, 227, 181, ${glow})`;
      ctx.fillRect(p.x, p.y - 8, 3, 8); ctx.fillRect(p.x - 3, p.y - 5, 3, 3); ctx.fillRect(p.x + 3, p.y - 6, 3, 3);
    } else {
      ctx.fillStyle = biome === 'desert' ? (bit.tone === 0 ? '#9a7b43' : bit.tone === 1 ? '#806b3b' : '#b18a4a') : biome === 'snow' ? (bit.tone === 0 ? '#9fb6b5' : bit.tone === 1 ? '#879fa0' : '#dce7e5') : (bit.tone === 0 ? '#355941' : bit.tone === 1 ? '#2c5038' : '#3a6044');
      ctx.fillRect(p.x, p.y, 3, 7); ctx.fillRect(p.x + 4, p.y + 2, 2, 5);
    }
  }

  const socket = worldToScreen(sceneMetadata.eventSocket.x, sceneMetadata.eventSocket.y);
  ctx.strokeStyle = '#d7be68'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(socket.x, socket.y, 23, 8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f0d982'; ctx.fillRect(socket.x - 2, socket.y - 3, 4, 4);
  if (state.debug.grid) drawGrid();
  if (state.debug.composition || qaMode === 'map') {
    for (const zone of sceneMetadata.clearings) { const p = worldToScreen(zone.x, zone.y); ctx.strokeStyle='#e9cf7a'; ctx.setLineDash([8,6]); ctx.beginPath(); ctx.ellipse(p.x,p.y,zone.rx,zone.ry/2,0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); drawLabel(zone.id,p.x,p.y-zone.ry/2-8,'#f0d982'); }
    const spawn = worldToScreen(sceneMetadata.spawn.x, sceneMetadata.spawn.y); drawLabel('BUNNY SPAWN',spawn.x,spawn.y+25,'#a9e1bd'); drawLabel('EVENT SOCKET',socket.x,socket.y+22,'#f0d982');
  }
  ctx.restore();
}

function drawTrail() {
  const points = biome === 'forest2'
    ? [{x:-520,y:1050},{x:-390,y:720},{x:-120,y:540},{x:70,y:330},{x:250,y:90},{x:180,y:-150},{x:390,y:-390}]
    : [{ x: -210, y: 1120 }, { x: -180, y: 760 }, { x: -40, y: 520 }, { x: 30, y: 270 }, { x: -80, y: 80 }, { x: -15, y: -125 }, { x: 10, y: -335 }];
  ctx.fillStyle = BIOME.trail;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]; const b = points[i + 1];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(distance / 22);
    for (let j = 0; j <= steps; j += 1) {
      const t = j / steps, x = a.x + (b.x-a.x)*t, y = a.y + (b.y-a.y)*t, p=worldToScreen(x,y);
      const width=(biome==='forest2'?54:70)+hash(i*100+j)*(biome==='forest2'?20:28);
      ctx.fillRect(Math.round(p.x-width/2),Math.round(p.y-7),Math.round(width),14);
      if(j%4===0){ctx.fillStyle=BIOME.trailHi;ctx.fillRect(p.x-18,p.y-7,23,3);ctx.fillStyle=BIOME.trail;}
    }
  }
  const branch = biome === 'forest2'
    ? [{x:55,y:330},{x:-180,y:245},{x:-430,y:205},{x:-720,y:260}]
    : [{x:22,y:275},{x:260,y:310},{x:520,y:360},{x:900,y:380}];
  for(let i=0;i<branch.length-1;i+=1) for(let j=0;j<=18;j+=1){const t=j/18,p=worldToScreen(branch[i].x+(branch[i+1].x-branch[i].x)*t,branch[i].y+(branch[i+1].y-branch[i].y)*t);ctx.fillStyle=BIOME.trail;ctx.fillRect(p.x-(biome==='forest2'?24:32),p.y-6,biome==='forest2'?48:64,12);}
}

function drawSwampPools() {
  // Ancient Grove identity: irregular shallow swamp pockets framing the central hunting lane.
  const pools=[
    {x:-390,y:-35,rx:150,ry:105,seed:1},{x:315,y:285,rx:175,ry:120,seed:2},{x:-255,y:455,rx:105,ry:78,seed:3}
  ];
  for(const pool of pools){
    const p=worldToScreen(pool.x,pool.y);
    ctx.fillStyle='#173f3b';
    for(let yy=-pool.ry/2;yy<=pool.ry/2;yy+=4){const w=pool.rx*Math.sqrt(Math.max(0,1-(yy*yy)/((pool.ry/2)**2)));ctx.fillRect(Math.round(p.x-w),Math.round(p.y+yy),Math.round(w*2),4);}
    ctx.fillStyle='#24574e';ctx.fillRect(Math.round(p.x-pool.rx*.58),Math.round(p.y-pool.ry*.25),Math.round(pool.rx*.7),3);
    ctx.fillStyle='#6f8b54';
    for(let i=0;i<5;i++){const ox=(hash(pool.seed*31+i)-.5)*pool.rx*1.25,oy=(hash(pool.seed*67+i)-.5)*pool.ry*.65;ctx.fillRect(Math.round(p.x+ox),Math.round(p.y+oy),7,3);ctx.fillRect(Math.round(p.x+ox+2),Math.round(p.y+oy-2),3,7);}
    ctx.fillStyle='#3d704f';
    for(let i=0;i<6;i++){const ox=(hash(pool.seed*91+i)-.5)*pool.rx*1.45,oy=(hash(pool.seed*113+i)-.5)*pool.ry*.8;ctx.fillRect(Math.round(p.x+ox),Math.round(p.y+oy-7),2,9);ctx.fillRect(Math.round(p.x+ox+4),Math.round(p.y+oy-5),2,7);}
  }
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(193, 221, 180, .18)';
  ctx.lineWidth = 1;
  const spacingX = 96;
  const spacingY = 48;
  const origin = worldToScreen(0,0);
  for(let k=-18;k<=18;k+=1){const o=k*spacingX;ctx.beginPath();ctx.moveTo(origin.x+o-H*2,origin.y-H);ctx.lineTo(origin.x+o+H*2,origin.y+H);ctx.stroke();ctx.beginPath();ctx.moveTo(origin.x+o-H*2,origin.y+H);ctx.lineTo(origin.x+o+H*2,origin.y-H);ctx.stroke();}
}

function drawTree(prop, p) {
  const s = prop.size;
  ctx.fillStyle = biome === 'snow' ? 'rgba(20,34,42,.32)' : 'rgba(7,15,10,.4)';
  ctx.fillRect(p.x - 28 * s, p.y - 4, 56 * s, 8);

  if (biome === 'desert') {
    ctx.fillStyle='#60422a'; ctx.fillRect(p.x-7*s,p.y-70*s,14*s,70*s);
    ctx.fillStyle='#7a5632'; ctx.fillRect(p.x-3*s,p.y-67*s,5*s,55*s);
    ctx.fillStyle='#5f6a36';
    ctx.fillRect(p.x-55*s,p.y-91*s,48*s,25*s); ctx.fillRect(p.x-18*s,p.y-106*s,55*s,30*s); ctx.fillRect(p.x+24*s,p.y-86*s,42*s,23*s);
    ctx.fillStyle='#8a8241';
    ctx.fillRect(p.x-47*s,p.y-87*s,27*s,5*s); ctx.fillRect(p.x-9*s,p.y-101*s,30*s,5*s);
    return;
  }

  ctx.fillStyle = biome === 'snow' ? '#4b3d35' : '#3c2f22';
  ctx.fillRect(p.x - 9 * s, p.y - 79 * s, 18 * s, 79 * s);
  ctx.fillStyle = biome === 'snow' ? '#675449' : '#59422a';
  ctx.fillRect(p.x - 5 * s, p.y - 91 * s, 10 * s, 78 * s);
  if (prop.family === 'spire') {
    const dark=biome==='snow'?'#274951':'#163c2b', mid=biome==='snow'?'#3f6970':'#24573a', light=biome==='snow'?'#dbe8e7':'#3f744b';
    ctx.fillStyle=dark;ctx.fillRect(p.x-40*s,p.y-112*s,80*s,35*s);ctx.fillRect(p.x-32*s,p.y-139*s,64*s,29*s);ctx.fillRect(p.x-21*s,p.y-160*s,42*s,24*s);
    ctx.fillStyle=mid;ctx.fillRect(p.x-29*s,p.y-129*s,53*s,18*s);ctx.fillRect(p.x-17*s,p.y-151*s,31*s,16*s);
    ctx.fillStyle=light;ctx.fillRect(p.x-17*s,p.y-145*s,22*s,5*s);
  } else {
    const dark=biome==='snow'?'#31565d':'#18422e', mid=biome==='snow'?'#52767b':'#276044', light=biome==='snow'?'#edf4f3':'#4b8054';
    ctx.fillStyle=dark;ctx.fillRect(p.x-55*s,p.y-118*s,110*s,49*s);ctx.fillRect(p.x-39*s,p.y-143*s,78*s,31*s);
    ctx.fillStyle=mid;ctx.fillRect(p.x-45*s,p.y-128*s,72*s,32*s);ctx.fillRect(p.x-25*s,p.y-151*s,48*s,25*s);
    ctx.fillStyle=light;ctx.fillRect(p.x-26*s,p.y-139*s,31*s,7*s);
  }
}

function drawRock(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.32)'; ctx.fillRect(p.x - 30 * s, p.y - 4, 60 * s, 8);
  ctx.fillStyle = biome === 'desert' ? '#79533a' : biome === 'snow' ? '#697b80' : '#3c5146';
  ctx.fillRect(p.x - 27 * s, p.y - 29 * s, 54 * s, 29 * s);
  ctx.fillStyle = biome === 'desert' ? '#a46f43' : biome === 'snow' ? '#8ea0a3' : '#536d5e';
  ctx.fillRect(p.x - 18 * s, p.y - 37 * s, 33 * s, 12 * s);
  ctx.fillStyle = biome === 'desert' ? '#d09a5e' : biome === 'snow' ? '#edf4f3' : '#759079';
  ctx.fillRect(p.x - 12 * s, p.y - 33 * s, 20 * s, 5 * s);
  ctx.fillStyle = biome === 'desert' ? '#6d4930' : biome === 'snow' ? '#b9cbcb' : '#31523c';
  ctx.fillRect(p.x + 3 * s, p.y - 8 * s, 20 * s, 6 * s);
}

function drawBush(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.28)'; ctx.fillRect(p.x - 28 * s, p.y - 3, 56 * s, 7);
  ctx.fillStyle = biome === 'desert' ? '#6f7135' : biome === 'snow' ? '#48636a' : '#1e4a34';
  ctx.fillRect(p.x - 31 * s, p.y - 30 * s, 28 * s, 28 * s); ctx.fillRect(p.x - 5 * s, p.y - 38 * s, 31 * s, 36 * s); ctx.fillRect(p.x + 18 * s, p.y - 25 * s, 22 * s, 23 * s);
  ctx.fillStyle = biome === 'desert' ? '#b09849' : biome === 'snow' ? '#e7f0ef' : '#3b714d';
  ctx.fillRect(p.x - 22 * s, p.y - 25 * s, 13 * s, 6 * s); ctx.fillRect(p.x + 2 * s, p.y - 32 * s, 14 * s, 6 * s);
}

function drawLog(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.28)'; ctx.fillRect(p.x - 46 * s, p.y - 3, 92 * s, 7);
  ctx.fillStyle = '#513823'; ctx.fillRect(p.x - 43 * s, p.y - 18 * s, 86 * s, 18 * s);
  ctx.fillStyle = '#735034'; ctx.fillRect(p.x - 37 * s, p.y - 18 * s, 62 * s, 5 * s);
  ctx.fillStyle = '#33543b'; ctx.fillRect(p.x - 13 * s, p.y - 23 * s, 30 * s, 7 * s);
}

function drawRuin(prop, p) {
  const s = prop.size;
  ctx.fillStyle = 'rgba(7,15,10,.3)'; ctx.fillRect(p.x - 36 * s, p.y - 4, 72 * s, 8);
  ctx.fillStyle = '#465950'; ctx.fillRect(p.x - 31 * s, p.y - 47 * s, 22 * s, 47 * s); ctx.fillRect(p.x - 7 * s, p.y - 28 * s, 39 * s, 28 * s);
  ctx.fillStyle = '#68796d'; ctx.fillRect(p.x - 26 * s, p.y - 42 * s, 13 * s, 7 * s); ctx.fillRect(p.x, p.y - 23 * s, 25 * s, 6 * s);
  ctx.fillStyle = '#31553c'; ctx.fillRect(p.x - 31 * s, p.y - 9 * s, 27 * s, 6 * s);
}

function drawShrine(prop, p) {
  const s=prop.size;
  ctx.fillStyle='rgba(5,14,11,.38)';ctx.fillRect(p.x-88*s,p.y-5,176*s,10);
  ctx.fillStyle='#3e514d';ctx.fillRect(p.x-79*s,p.y-80*s,25*s,80*s);ctx.fillRect(p.x+54*s,p.y-80*s,25*s,80*s);
  ctx.fillStyle='#596c64';ctx.fillRect(p.x-73*s,p.y-76*s,12*s,66*s);ctx.fillRect(p.x+60*s,p.y-76*s,12*s,66*s);
  ctx.fillStyle='#465b55';ctx.fillRect(p.x-78*s,p.y-103*s,156*s,28*s);ctx.fillRect(p.x-61*s,p.y-123*s,122*s,26*s);
  ctx.fillStyle='#75867a';ctx.fillRect(p.x-50*s,p.y-116*s,100*s,7*s);ctx.fillRect(p.x-68*s,p.y-96*s,56*s,6*s);
  ctx.fillStyle='#c8d9bd';ctx.fillRect(p.x-10,p.y-108*s,20,27);ctx.fillStyle='#465b55';ctx.fillRect(p.x-3,p.y-112*s,17,25);
  const glow=.72+Math.sin(state.time*2.2)*.18;ctx.fillStyle=`rgba(245,196,92,${glow})`;ctx.fillRect(p.x-61*s,p.y-55*s,7,12);ctx.fillRect(p.x+55*s,p.y-55*s,7,12);
  ctx.fillStyle='#315a3f';ctx.fillRect(p.x-80*s,p.y-15*s,50*s,10*s);ctx.fillRect(p.x+29*s,p.y-20*s,48*s,10*s);
}


function drawTownProp(prop,p){
 const s=prop.size||1;
 if(prop.type==='house'||prop.type==='shop'||prop.type==='townHall'){
  const hall=prop.type==='townHall',w=(hall?170:108)*s,h=(hall?105:72)*s;
  ctx.fillStyle='rgba(8,12,10,.34)';ctx.fillRect(p.x-w*.55,p.y-5,w*1.1,10);
  ctx.fillStyle=hall?'#d8c79f':'#cdbb91';ctx.fillRect(p.x-w/2,p.y-h,w,h);
  ctx.fillStyle='#8b7657';ctx.fillRect(p.x-w/2+8*s,p.y-h+10*s,w-16*s,8*s);
  const roof=hall?'#5c4250':prop.roof==='blue'?'#405d70':'#765047';
  ctx.fillStyle=roof;ctx.fillRect(p.x-w*.58,p.y-h-30*s,w*1.16,31*s);ctx.fillRect(p.x-w*.43,p.y-h-45*s,w*.86,18*s);
  ctx.fillStyle='#f0dfb2';ctx.fillRect(p.x-w*.32,p.y-h+28*s,22*s,20*s);ctx.fillRect(p.x+w*.15,p.y-h+28*s,22*s,20*s);
  ctx.fillStyle='#59412f';ctx.fillRect(p.x-12*s,p.y-36*s,24*s,36*s);
  if(hall){ctx.fillStyle='#d6a94f';ctx.fillRect(p.x-5*s,p.y-h-66*s,10*s,24*s);ctx.fillRect(p.x-18*s,p.y-h-60*s,36*s,8*s);}
  if(prop.type==='shop'){ctx.fillStyle='#e3c266';ctx.fillRect(p.x-34*s,p.y-h+4*s,68*s,15*s);ctx.fillStyle='#403628';ctx.font=`${Math.max(7,8*s)}px ui-monospace`;ctx.textAlign='center';ctx.fillText(prop.sign||'SHOP',p.x,p.y-h+15*s);}
 }else if(prop.type==='fountain'){
  ctx.fillStyle='rgba(8,12,10,.3)';ctx.fillRect(p.x-50*s,p.y-4,100*s,8);
  ctx.fillStyle='#7c8b83';ctx.fillRect(p.x-44*s,p.y-16*s,88*s,16*s);ctx.fillStyle='#a9b6aa';ctx.fillRect(p.x-34*s,p.y-22*s,68*s,8*s);
  ctx.fillStyle='#5da4b2';ctx.fillRect(p.x-29*s,p.y-20*s,58*s,7*s);ctx.fillStyle='#8b9990';ctx.fillRect(p.x-7*s,p.y-54*s,14*s,35*s);
  ctx.fillStyle='#8bd7df';ctx.fillRect(p.x-2*s,p.y-66*s,4*s,24*s);
 }else if(prop.type==='lamp'){
  ctx.fillStyle='#3c352d';ctx.fillRect(p.x-3*s,p.y-48*s,6*s,48*s);ctx.fillStyle='#d8a94e';ctx.fillRect(p.x-8*s,p.y-61*s,16*s,15*s);ctx.fillStyle='rgba(255,218,120,.35)';ctx.fillRect(p.x-13*s,p.y-65*s,26*s,23*s);
 }else if(prop.type==='stall'){
  ctx.fillStyle='#70513a';ctx.fillRect(p.x-34*s,p.y-30*s,68*s,30*s);ctx.fillStyle='#b95f52';ctx.fillRect(p.x-42*s,p.y-49*s,84*s,20*s);ctx.fillStyle='#e7c98d';for(let i=-30;i<=30;i+=20)ctx.fillRect(p.x+i*s,p.y-49*s,10*s,20*s);
 }
}

function drawMineProp(prop, p) {
  const z=prop.size||1;
  if(prop.type==='mineWall'||prop.type==='mineRock'){
    ctx.fillStyle='rgba(0,0,0,.38)';ctx.fillRect(p.x-38*z,p.y-3,76*z,8);
    ctx.fillStyle='#17191b';ctx.fillRect(p.x-34*z,p.y-38*z,68*z,38*z);
    ctx.fillStyle='#303338';ctx.fillRect(p.x-27*z,p.y-45*z,48*z,13*z);
    ctx.fillStyle='#4a4c4d';ctx.fillRect(p.x-20*z,p.y-41*z,18*z,5*z);
  } else if(prop.type==='timber'||prop.type==='brokenTimber'){
    ctx.fillStyle='#3b2719';ctx.fillRect(p.x-30*z,p.y-9*z,60*z,9*z);
    ctx.fillStyle='#69452a';ctx.fillRect(p.x-25*z,p.y-12*z,45*z,4*z);
    ctx.fillRect(p.x-24*z,p.y-48*z,8*z,42*z);ctx.fillRect(p.x+17*z,p.y-48*z,8*z,42*z);
  } else if(prop.type==='rail'){
    ctx.fillStyle='#17191a';ctx.fillRect(p.x-42*z,p.y-5,84*z,4);ctx.fillRect(p.x-42*z,p.y+5,84*z,4);
    ctx.fillStyle='#4b4d4d';for(let i=-36;i<=36;i+=18)ctx.fillRect(p.x+i*z,p.y-8,4,20);
  } else if(prop.type==='mineCart'){
    ctx.fillStyle='#202326';ctx.fillRect(p.x-30*z,p.y-24*z,60*z,22*z);
    ctx.fillStyle='#55595a';ctx.fillRect(p.x-25*z,p.y-20*z,50*z,6*z);
    ctx.fillStyle='#111';ctx.fillRect(p.x-22*z,p.y,12*z,7*z);ctx.fillRect(p.x+12*z,p.y,12*z,7*z);
  } else if(prop.type==='torch'){
    ctx.fillStyle='#4a3020';ctx.fillRect(p.x-3*z,p.y-34*z,6*z,34*z);
    const flicker=Math.sin(state.time*11+prop.seed)*2;
    ctx.globalAlpha=prop.dim?.65:1;
    ctx.fillStyle='#b84f24';ctx.fillRect(p.x-6*z,p.y-45*z+flicker,12*z,13*z);
    ctx.fillStyle='#ff9d32';ctx.fillRect(p.x-4*z,p.y-49*z+flicker,8*z,12*z);
    ctx.fillStyle='#ffe08a';ctx.fillRect(p.x-2*z,p.y-45*z+flicker,4*z,7*z);
    ctx.globalAlpha=1;
  }
}

function drawProp(prop) {
  const p = worldToScreen(prop.x, prop.y);
  if (prop.type === 'tree') drawTree(prop, p);
  if (prop.type === 'rock') drawRock(prop, p);
  if (prop.type === 'bush') drawBush(prop, p);
  if (prop.type === 'log') drawLog(prop, p);
  if (prop.type === 'ruin') drawRuin(prop, p);
  if (prop.type === 'shrine') drawShrine(prop, p);
  if (['townHall','house','shop','fountain','lamp','stall'].includes(prop.type)) drawTownProp(prop,p);
  if (['mineWall','mineRock','mineCart','timber','brokenTimber','rail','torch'].includes(prop.type)) drawMineProp(prop,p);
  drawEntityDebug(prop, p, prop.type.toUpperCase());
}

function drawCastShadow(prop) {
  if (prop.type === 'bush') return;
  const p=worldToScreen(prop.x,prop.y);const s=prop.size||1;const large=prop.type==='tree'||prop.type==='shrine';
  const length=(large?86:48)*s;ctx.fillStyle=large?'rgba(5,18,22,.28)':'rgba(5,18,22,.2)';
  for(let i=0;i<4;i+=1)ctx.fillRect(Math.round(p.x+8+i*length/4),Math.round(p.y+3+i*5),Math.round(length/3),Math.max(3,Math.round((large?8:6)-i)));
}

function nearestMonster() {
  return monsters.reduce((best, monster) => {
    const distance = Math.hypot(monster.x - state.player.x, monster.y - state.player.y);
    return !best || distance < best.distance ? { monster, distance } : best;
  }, null);
}

function drawMonster(monster) {
  const p = worldToScreen(monster.x, monster.y);
  const hitFlash = (monster.flashTimer ?? 0) > 0;
  const bossDeath = monster.dead && monster.isBoss && (monster.deathTimer ?? 0) > 0;
  const normalDeath = monster.dead && !monster.isBoss && (monster.deathTimer ?? 0) > 0;
  if (monster.dead && !bossDeath && !normalDeath) return;
  // Death dissolve progress (0 at moment of death → 1 as it fades out) for normal monsters.
  const dProg = normalDeath ? Math.max(0, Math.min(1, 1 - monster.deathTimer / (monster.deathDuration || .55))) : 0;
  // Hurt lunge: brief recoil away from the hero while the hit registers.
  let hurtDX = 0, hurtDY = 0;
  if (!monster.dead && (monster.hurtTimer ?? 0) > 0) {
    const k = Math.min(1, monster.hurtTimer / .28), recoil = 5 * k;
    const away = Math.atan2(monster.y - state.player.y, monster.x - state.player.x);
    hurtDX = Math.cos(away) * recoil; hurtDY = Math.sin(away) * recoil * .5;
    hurtDX += (Math.random() - .5) * 2.4 * k; hurtDY += (Math.random() - .5) * 1.6 * k;
  }
  p.x += hurtDX; p.y += hurtDY;
  const target = !monster.dead && (state.combatTarget === monster || nearestMonster()?.monster === monster);
  if (target) drawTargetIndicator(p.x, p.y, monster.size);
  if (!bossDeath && !normalDeath) {
    ctx.fillStyle = 'rgba(7,15,10,.34)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, monster.size * .3, monster.size * .1, 0, 0, Math.PI * 2); ctx.fill();
  }

  const normalFrames = forestFrames[monster.monsterType];
  const bossSet = bossFrames[monster.monsterType] || mineBossFrames[monster.monsterType];
  const mineSheet = mineSheets[monster.monsterType];
  const bossAttacking = Boolean(bossSet && monster.bossAttackPhase && !bossDeath);
  const bossAttackFrames = monster.monsterType === 'goblinLeader' && bossAttacking
    ? monster.bossAttackKind === 'stomp' ? bossSet.warStomp
      : monster.bossAttackKind === 'charge' ? bossSet.leaderCharge
      : bossSet.attack
    : bossSet?.attack;
  const frames = bossSet ? (bossAttacking ? bossAttackFrames : bossSet.walk) : normalFrames;

  if(monster.monsterType==='greatMythicDragon'&&worldBossDragonSheet){
    const frame=Math.floor(state.time*7+monster.phase)%9,row=monster.dead?2:monster.bossAttackPhase?2:1,cell=64,scale=monster.spriteScale||3.15,dw=cell*scale,dh=cell*scale;
    ctx.save();ctx.imageSmoothingEnabled=false;if(hitFlash)ctx.filter='brightness(1.8) saturate(1.4)';if(monster.facing==='left'){ctx.translate(Math.round(p.x),0);ctx.scale(-1,1);ctx.drawImage(worldBossDragonSheet,frame*cell,row*cell,cell,cell,-dw/2,Math.round(p.y-dh),dw,dh);}else ctx.drawImage(worldBossDragonSheet,frame*cell,row*cell,cell,cell,Math.round(p.x-dw/2),Math.round(p.y-dh),dw,dh);ctx.restore();
  } else if (frames) {
    let frame;
    if (bossDeath) frame = Math.max(0, Math.min(frames.length - 1, monster.deathFrame ?? 0));
    else if (bossAttacking) {
      const progress = Math.min(.999, getBossAttackProgress(monster));
      frame = Math.floor(progress * frames.length);
    } else frame = Math.floor(state.time * (bossSet ? 6 : 9) + monster.phase) % frames.length;
    const img=frames[Math.max(0,Math.min(frames.length-1,frame))], scale=monster.spriteScale || 2.15;
    const dw=Math.round(img.width*scale), dh=Math.round(img.height*scale);
    let drawX=Math.round(p.x), drawY=Math.round(p.y-dh);
    ctx.save();
    if (bossDeath) {
      const elapsed=(monster.deathDuration ?? 2.6) - monster.deathTimer;
      const lift=Math.min(16, elapsed*12);
      drawY-=Math.round(lift);
      ctx.translate(drawX, Math.round(drawY+dh*.62));
      ctx.rotate(Math.min(.28, elapsed*.28));
      const blink = elapsed > .7 && Math.floor(elapsed * 14) % 2 === 0;
      if (blink) ctx.globalAlpha=.18;
      if (monster.facing==='left') { ctx.scale(-1,1); ctx.drawImage(img,Math.round(-dw/2),Math.round(-dh*.62),dw,dh); }
      else ctx.drawImage(img,Math.round(-dw/2),Math.round(-dh*.62),dw,dh);
    } else if (normalDeath) {
      // Sprite death: squash + rise + white blowout that fades into transparency.
      const squash = 1 - .3 * dProg, rise = Math.round(dProg * 12);
      ctx.globalAlpha = Math.max(0, 1 - dProg * 1.05);
      if (dProg < .22) ctx.filter = 'brightness(2.6) saturate(0)';
      ctx.translate(drawX, drawY + dh - rise); ctx.scale(1, squash);
      if (monster.facing === 'left') ctx.scale(-1, 1);
      ctx.drawImage(img, Math.round(-dw / 2), -dh, dw, dh);
    } else {
      if (hitFlash) {
        // Two-stage hit: white blowout on the first frames, then the red damage tint.
        ctx.filter = (monster.flashTimer ?? 0) > .09 ? 'brightness(2.4) saturate(0) contrast(1.3)' : 'sepia(1) saturate(10) hue-rotate(305deg) brightness(1.5)';
        ctx.globalAlpha = .97;
      }
      if(monster.facing==='left'){ctx.translate(drawX,0);ctx.scale(-1,1);ctx.drawImage(img,Math.round(-dw/2),drawY,dw,dh);}
      else ctx.drawImage(img,Math.round(drawX-dw/2),drawY,dw,dh);
    }
    ctx.restore();
  } else if (mineSheet) {
    const goblinRoleAttack = monster.monsterType === 'goblinAxer' ? mineSheet.axe : monster.monsterType === 'goblinForeman' ? mineSheet.hammering : mineSheet.attack;
    const ambientSheet = monster.ambient && monster.anim === 'walk' && mineSheet[monster.ambient] ? mineSheet[monster.ambient] : null;
    const sheet = monster.anim === 'attack' ? goblinRoleAttack : monster.anim === 'hurt' ? mineSheet.hurt : ambientSheet || mineSheet.walk;
    if (sheet) {
      const frameWidth = 96, frameHeight = 64;
      // Sunnyside's longer actions wrap onto additional 64px rows (dig=13, hammering=23).
      // Treat every sheet as a row-major grid of 96x64 cells instead of drawing the full sheet height.
      const actionCounts = { attack: 9, axe: 10, mining: 10, dig: 13, carry: 8, hammering: 23, hurt: 8, walk: 8 };
      const action = monster.anim === 'attack'
        ? (monster.monsterType === 'goblinAxer' ? 'axe' : monster.monsterType === 'goblinForeman' ? 'hammering' : 'attack')
        : monster.anim === 'hurt' ? 'hurt'
          : (monster.ambient && mineSheet[monster.ambient] ? monster.ambient : 'walk');
      const columns = Math.max(1, Math.floor(sheet.width / frameWidth));
      const availableCells = columns * Math.max(1, Math.floor(sheet.height / frameHeight));
      const count = Math.min(actionCounts[action] ?? availableCells, availableCells);
      const frame = Math.floor(state.time * 8 + monster.phase) % Math.max(1, count);
      const sourceX = (frame % columns) * frameWidth;
      const sourceY = Math.floor(frame / columns) * frameHeight;
      const scale = monster.spriteScale || 2.15;
      const dw = Math.round(frameWidth * scale), dh = Math.round(frameHeight * scale);
      // Alpha inspection of the source art puts Goblin feet at y≈39 and Skeleton at y≈40.
      const sourceFootY = monster.monsterType === 'skeleton' ? 40 : 39;
      const drawX = Math.round(p.x), drawY = Math.round(p.y - sourceFootY * scale);
      ctx.save();
      if (normalDeath) {
        const squash = 1 - .3 * dProg, rise = Math.round(dProg * 12);
        ctx.globalAlpha = Math.max(0, 1 - dProg * 1.05);
        if (dProg < .22) ctx.filter = 'brightness(2.6) saturate(0)';
        ctx.translate(drawX, drawY + dh - rise); ctx.scale(1, squash);
        if (monster.facing === 'left') ctx.scale(-1, 1);
        ctx.drawImage(sheet, sourceX, sourceY, frameWidth, frameHeight, Math.round(-dw/2), -dh, dw, dh);
      } else {
        if (hitFlash) {
          ctx.filter = (monster.flashTimer ?? 0) > .09 ? 'brightness(2.4) saturate(0) contrast(1.3)' : 'sepia(1) saturate(10) hue-rotate(305deg) brightness(1.5)';
          ctx.globalAlpha = .97;
        }
        if (monster.facing === 'left') {
          ctx.translate(drawX, 0); ctx.scale(-1, 1);
          ctx.drawImage(sheet, sourceX, sourceY, frameWidth, frameHeight, Math.round(-dw/2), drawY, dw, dh);
        } else {
          ctx.drawImage(sheet, sourceX, sourceY, frameWidth, frameHeight, Math.round(drawX-dw/2), drawY, dw, dh);
        }
      }
      ctx.restore();
    }
  }

  if (!monster.dead) {
    const hpRatio = Math.max(0, (monster.hp || 0) / (monster.maxHp || 1));
    const barSet = target ? greenBars : redBars;
    const barIndex = Math.max(0, Math.min(6, Math.ceil(hpRatio * 6)));
    const bar = barSet[barIndex];
    if (bar) ctx.drawImage(bar, Math.round(p.x - 15), Math.round(p.y - monster.size - 20), 30, 14);
  }
  if (!monster.dead) drawLabel(`LV.${monster.level ?? '?'} ${monster.name}`, p.x, p.y + 18, monster.isBoss ? '#f29a91' : monster.elite ? '#f0cf78' : '#e7e1d2');
  if (state.debug.hitboxes && !monster.dead) drawEllipse(p.x, p.y, monster.radiusX, monster.radiusY, '#f08376');
  if (!bossDeath) drawAnchor(p.x, p.y, monster.y, '#ee8f7d');
}

function drawPlayer() {
  const player = state.player;
  const p = worldToScreen(player.x, player.y);
  const direction = directionNames[player.directionIndex];
  ctx.fillStyle = 'rgba(7,15,10,.34)'; ctx.fillRect(p.x - 18, p.y - 4, 36, 8);
  ctx.save();
  if ((player.hitTimer ?? 0) > 0) ctx.filter='sepia(1) saturate(8) hue-rotate(315deg) brightness(1.45)';
  const playback = state.heroCombat.playback;
  const moving = Math.hypot(player.vx || 0, player.vy || 0) > 8;
  const jumping = (player.jumpTimer ?? 0) > 0;
  let visual = null;
  const attackSet = heroAttackFrames[state.heroCombat.weaponFamily];
  const deathElapsed = performance.now() < gameUi.deathUntil ?(performance.now() - (gameUi.deathUntil - 10000)) / 1000 : -1;
  if (deathElapsed >= 0) {
    // Fall once, then hold the last frame under the death overlay.
    // Only the south / south-east falls read as a collapse; other facings reuse them.
    const deathDir = direction === 'south' || direction === 'north' ? 'south' : direction.endsWith('west') || direction === 'west' ? 'south-west' : 'south-east';
    const death = heroDeathFrames[deathDir];
    const frame = Math.min(death.frames.length - 1, Math.floor(deathElapsed / HERO_DEATH_ANIM_SECONDS * death.frames.length));
    visual = { image: death.frames[frame], flipX: death.flipX, footY: death.footY };
  } else if ((player.hurtAnimTimer ?? 0) > 0 && !playback.active) {
    const hurt = heroHurtFrames[direction];
    const progress = 1 - player.hurtAnimTimer / HERO_HURT_ANIM_SECONDS;
    visual = { image: hurt.frames[Math.min(hurt.frames.length - 1, Math.floor(progress * hurt.frames.length))], flipX: hurt.flipX, footY: hurt.footY };
  } else if (playback.active && attackSet) {
    const attack = attackSet[direction];
    const frame = Math.min(attack.frames.length - 1, Math.floor(playback.frame / Math.max(1, playback.definition.frames) * attack.frames.length));
    visual = { image: attack.frames[frame], flipX: attack.flipX, footY: attack.footY };
  } else if (jumping) {
    const jump = heroMotionFrames.jump[direction];
    const progress = 1 - player.jumpTimer / player.jumpDuration;
    const image = jump.frames[Math.min(jump.frames.length - 1, Math.floor(progress * jump.frames.length))];
    visual = { image, flipX: jump.flipX, footY: image.height - 18 };
  } else if (moving) {
    const run = heroMotionFrames.run[direction];
    visual = { image: run.frames[Math.floor(state.time * 12) % run.frames.length], flipX: run.flipX, footY: run.footY };
  } else {
    // Idle, and staff casting (no baked attack; its FX are drawn in code).
    const idle = heroIdleFrames[direction];
    visual = { image: idle.frames[Math.floor(state.time * 7) % idle.frames.length], flipX: idle.flipX, footY: idle.footY };
  }
  const image = visual.image;
  const drawW = image.width;
  const drawH = image.height;
  // Anchor the visible feet (footY row from the export manifest) to world ground.
  const drawY = Math.round(p.y - visual.footY);
  if (visual.flipX) {
    ctx.translate(Math.round(p.x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -Math.round(drawW / 2), drawY, drawW, drawH);
  } else {
    ctx.drawImage(image, p.x - Math.round(drawW / 2), drawY, drawW, drawH);
  }
  ctx.restore();
  // In-world hero identity: name first, then HP directly underneath the character.
  const hp=Math.max(0,player.hp??1),maxHp=Math.max(1,player.maxHp??1),hpRatio=Math.max(0,Math.min(1,hp/maxHp));
  const heroState=arenaV2.character,labelY=p.y+17;
  const hpW=46,hpH=5,hpX=Math.round(p.x-hpW/2),hpY=Math.round(labelY);
  ctx.fillStyle='rgba(4,10,7,.78)';ctx.fillRect(hpX-1,hpY-1,hpW+2,hpH+2);
  ctx.fillStyle='#24572f';ctx.fillRect(hpX,hpY,hpW,hpH);
  ctx.fillStyle='#55d66f';ctx.fillRect(hpX,hpY,Math.round(hpW*hpRatio),hpH);
  drawLabel(`LV.${heroState.level} ${heroState.name.toUpperCase()}`,p.x,hpY+17,'#f3dc82');
  if (state.debug.labels) drawLabel(`${Math.round(player.heading)}° · ${direction.toUpperCase()}`, p.x, p.y - 76, '#f3dc82');
  if (state.debug.hitboxes) drawEllipse(p.x, p.y, player.radiusX, player.radiusY, '#72d8be');
  drawAnchor(p.x, p.y, player.y, '#f3dc82');
}

function drawCombatGround() {
  if (!state.debug.range) return;
  const p = worldToScreen(state.player.x, state.player.y);
  ctx.strokeStyle = state.attackTimer > 0 ? 'rgba(247,218,112,.8)' : 'rgba(247,218,112,.25)';
  ctx.lineWidth = state.attackTimer > 0 ? 2 : 1;
  ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(p.x, p.y, 96, 48, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
}

function drawSkillSpriteFx(){
 for(const fx of state.skillSpriteFx){const sheet=pixelFxSheets[fx.kind];if(!sheet)continue;const p=worldToScreen(fx.x,fx.y),progress=Math.min(.999,fx.age/fx.duration),frame=Math.min(8,Math.floor(progress*9)),cell=fx.kind==='blackHole'?112:(fx.kind==='groundSlam'||fx.kind==='meteorStorm'?96:48),size=fx.kind==='blackHole'?230:fx.kind==='meteorStorm'?180:fx.kind==='groundSlam'?154:112;if(fx.kind==='blackHole'){const pulse=.5+.5*Math.sin(progress*Math.PI*8),r=fx.radius??260;ctx.save();ctx.globalAlpha=.16+.14*(1-progress);ctx.fillStyle='rgba(135,78,255,.08)';ctx.strokeStyle=`rgba(183,135,255,${.55+.25*pulse})`;ctx.lineWidth=2;ctx.setLineDash([10,8]);ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.48,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(221,199,255,.9)';ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillText(`PULL RANGE · ${r}`,p.x,p.y-r*.48-10);ctx.restore();}ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(p.x),Math.round(p.y-(fx.kind==='groundSlam'?10:fx.kind==='meteorStorm'?42:22)));if(fx.kind==='groundSlam'||fx.kind==='blackHole')ctx.scale(1,.72);ctx.globalAlpha=Math.min(1,(1-progress)*1.55);ctx.drawImage(sheet,frame*cell,cell,cell,cell,-size/2,-size/2,size,size);ctx.restore();}
}
function drawSlash() {
  for (const fx of state.heroCombat.visualFx) {
    if(fx.type==='dashAfterimage'){
      const p=worldToScreen(fx.x,fx.y),progress=Math.min(1,fx.age/fx.duration),fade=Math.max(0,1-progress);
      const idle=heroIdleFrames[fx.direction],frame=idle?.frames?.[0];if(!frame)continue;
      ctx.save();ctx.globalAlpha=fade*.58;ctx.filter='brightness(0) invert(1)';
      const w=frame.width,h=frame.height,top=Math.round(p.y-idle.footY);
      if(fx.flipX){ctx.translate(Math.round(p.x),0);ctx.scale(-1,1);ctx.drawImage(frame,-Math.round(w/2),top,w,h);}else ctx.drawImage(frame,Math.round(p.x-w/2),top,w,h);
      ctx.restore();continue;
    }
    if (fx.type !== 'weaponTrail') continue;
    // Families with a baked attack already carry their weapon and slash arc in the sprite.
    // Exception: the greatsword's back view hides the blade, so north keeps the code crescent.
    const heroFacing = directionNames[state.player.directionIndex];
    if (fx.melee && heroAttackFrames[state.heroCombat.weaponFamily] && !(state.heroCombat.weaponFamily === 'greatsword' && heroFacing === 'north')) continue;
    const p = worldToScreen(fx.x, fx.y);
    // Procedural blade glow: a code-only emissive streak layered under the attack FX.
    // It follows the actual attack heading, so all 8 isometric directions work without extra sprite assets.
    if (fx.melee) {
      // Bold procedural crescent — the primary readable slash. An iso-flattened arc that
      // sweeps across the attack heading, bright leading edge tapering into a fading trail.
      {
        const fam = state.heroCombat.weaponFamily;
        const prog = Math.min(1, fx.age / fx.duration);
        const fadeC = Math.max(0, 1 - prog);
        const heading = fx.angle ?? 0;
        // screen-space forward direction (respects the 2:1 iso projection)
        const fwd = worldToScreen(fx.x + Math.sin(heading) * 40, fx.y - Math.cos(heading) * 40);
        const cx = p.x, cy = p.y - 30;
        const baseAng = Math.atan2(fwd.y - p.y, fwd.x - cx);
        const heavy = fam === 'greatsword' || fam === 'axe' || fam === 'hammer';
        const R = heavy ? 62 : 44, ry = R * .58;
        const span = heavy ? 1.7 : 1.25;
        const a0 = baseAng - span / 2, a1 = baseAng + span / 2;
        const reveal = a0 + (a1 - a0) * Math.min(1, prog * 1.5);
        const edge = fam === 'dagger' ? 'rgba(190,240,255,' : heavy ? 'rgba(255,232,150,' : 'rgba(210,245,255,';
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        // outer glow
        ctx.strokeStyle = edge + (.30 * fadeC) + ')'; ctx.lineWidth = heavy ? 26 : 17;
        ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, a0, reveal); ctx.stroke();
        // mid body
        ctx.strokeStyle = edge + (.75 * fadeC) + ')'; ctx.lineWidth = heavy ? 9 : 6;
        ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, a0, reveal); ctx.stroke();
        // white core
        ctx.strokeStyle = `rgba(255,255,255,${fadeC})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, a0, reveal); ctx.stroke();
        // leading-edge spark at the tip of the sweep
        const tx = Math.cos(reveal) * R, ty = Math.sin(reveal) * ry;
        ctx.fillStyle = `rgba(255,255,255,${fadeC})`;
        ctx.beginPath(); ctx.arc(tx, ty, heavy ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      const progress = Math.min(1, fx.age / fx.duration);
      const fade = Math.max(0, 1 - progress);
      const heading = fx.angle ?? 0;
      const wx = Math.sin(heading), wy = -Math.cos(heading);
      const front = worldToScreen(fx.x + wx * 58, fx.y + wy * 58);
      const dx = front.x - p.x, dy = front.y - p.y;
      const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const reach = state.heroCombat.weaponFamily === 'dagger' ? 48 : 70;
      const sweep = Math.sin(progress * Math.PI);
      const cx = p.x + ux * reach * (.42 + .38 * sweep);
      const cy = p.y - 30 + uy * reach * (.42 + .38 * sweep);
      const half = (state.heroCombat.weaponFamily === 'dagger' ? 23 : 38) * (.65 + .35 * sweep);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.globalAlpha = fade * (.55 + .45 * sweep);
      ctx.strokeStyle = 'rgba(115,205,255,.20)'; ctx.lineWidth = state.heroCombat.weaponFamily === 'dagger' ? 14 : 20;
      ctx.beginPath(); ctx.moveTo(cx - ux * half, cy - uy * half); ctx.lineTo(cx + ux * half, cy + uy * half); ctx.stroke();
      ctx.strokeStyle = 'rgba(155,225,255,.58)'; ctx.lineWidth = state.heroCombat.weaponFamily === 'dagger' ? 7 : 9;
      ctx.beginPath(); ctx.moveTo(cx - ux * half, cy - uy * half); ctx.lineTo(cx + ux * half, cy + uy * half); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.96)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx - ux * half, cy - uy * half); ctx.lineTo(cx + ux * half, cy + uy * half); ctx.stroke();
      ctx.restore();
    }
    const family=state.heroCombat.weaponFamily,weaponSheet=family==='dagger'?pixelFxSheets.dual:(family==='greatsword'||family==='axe')?pixelFxSheets.heavy:null;
    if(weaponSheet&&fx.melee){const progress=Math.min(.999,fx.age/fx.duration),frame=Math.min(8,Math.floor(progress*9)),p=worldToScreen(fx.x,fx.y),size=family==='dagger'?104:112,heading=fx.angle??0;ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=Math.min(1,(1-progress)*1.5);if(family==='dagger'){ctx.translate(Math.round(p.x),Math.round(p.y-27));ctx.rotate(heading);ctx.drawImage(weaponSheet,frame*48,48,48,48,-size/2,-size/2,size,size);}else{/* Straight 2H overhead chop: no arc/curve. The slash is a rigid blade-shaped streak moving from above the hero straight into the screen-forward attack lane. */const wx=Math.sin(heading),wy=-Math.cos(heading),front=worldToScreen(fx.x+wx*54,fx.y+wy*54),sdx=front.x-p.x,sdy=front.y-p.y,slen=Math.hypot(sdx,sdy)||1,ux=sdx/slen,uy=sdy/slen,t=Math.min(1,progress/.72),ease=t*t*(3-2*t),startX=p.x,startY=p.y-105,endX=p.x+ux*74,endY=p.y-22+uy*74,tipX=startX+(endX-startX)*ease,tipY=startY+(endY-startY)*ease,trail=.48,tailX=startX+(endX-startX)*Math.max(0,ease-trail),tailY=startY+(endY-startY)*Math.max(0,ease-trail);ctx.lineCap='butt';ctx.globalCompositeOperation='lighter';ctx.strokeStyle='rgba(255,225,153,.28)';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(tipX,tipY);ctx.stroke();ctx.strokeStyle='rgba(255,252,230,.96)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(tailX,tailY);ctx.lineTo(tipX,tipY);ctx.stroke();ctx.strokeStyle='rgba(224,166,65,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(tailX+3,tailY);ctx.lineTo(tipX+3,tipY);ctx.stroke();}ctx.restore();continue;}
    if(meleeSlashFxSheet&&fx.melee){
      const progress=Math.min(.999,fx.age/fx.duration),frame=Math.min(7,Math.floor(progress*8)),cols=4,rows=2,sw=meleeSlashFxSheet.width/cols,sh=meleeSlashFxSheet.height/rows,sx=(frame%cols)*sw,sy=Math.floor(frame/cols)*sh;
      const size=132,ratio=sh/sw,dh=size*ratio,heading=fx.angle??0;
      ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y-28));ctx.rotate(heading);ctx.globalAlpha=Math.min(1,(1-progress)*1.35);ctx.globalCompositeOperation='lighter';
      ctx.drawImage(meleeSlashFxSheet,sx,sy,sw,sh,-size/2,-dh/2,size,dh);ctx.restore();continue;
    }
    const progress = Math.min(1, fx.age / fx.duration);
    const fade = Math.max(0, 1 - progress);
    const base = fx.angle - Math.PI / 2;
    const sweep = 1.15;
    const radius = 50;
    const squash = .62;
    const drawArc = (offset, alpha, width, radiusOffset = 0) => {
      ctx.save();
      ctx.translate(Math.round(p.x), Math.round(p.y - 25));
      ctx.rotate(base);
      ctx.scale(1, squash);
      ctx.globalAlpha = fade * alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, radius + radiusOffset, -sweep / 2 + offset, sweep / 2 + offset);
      ctx.stroke();
      ctx.restore();
    };
    // Dual-dagger cross slash: two short white crescents with faint afterimages.
    drawArc(-.38 + progress * .22, .30, 8, -5);
    drawArc(-.20 + progress * .15, 1.0, 5, 1);
    drawArc(Math.PI + .20 - progress * .15, .28, 8, -6);
    drawArc(Math.PI + .38 - progress * .22, .96, 5, 2);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 29), 6, 6);
    ctx.globalAlpha = fade * .45;
    ctx.fillRect(Math.round(p.x - 7), Math.round(p.y - 27), 14, 2);
    ctx.fillRect(Math.round(p.x - 1), Math.round(p.y - 34), 2, 14);
    ctx.restore();
  }
}

function drawTargetIndicator(x, y, size) {
  ctx.strokeStyle = '#e9cf7a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 18, y + 8); ctx.lineTo(x, y + 14); ctx.lineTo(x + 18, y + 8); ctx.stroke();
  ctx.fillStyle = '#e9cf7a'; ctx.fillRect(x - 2, y + 11, 4, 4);
}

function drawDamageNumber(x, y) {
  const lift = (1 - state.damageTimer / .65) * 20;
  ctx.font = 'bold 16px ui-monospace, monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#3b2018'; ctx.fillText('128', x + 2, y - lift + 2);
  ctx.fillStyle = '#ffe08a'; ctx.fillText('128', x, y - lift);
}

function drawForeground() {
  const shift = -state.camera.x * 1.1;
  ctx.fillStyle = '#10291e';
  const positions = [-110, 175, 1040, 1310];
  for (let i = 0; i < positions.length; i += 1) {
    const x = positions[i] + (shift % 80);
    const y = H - 14;
    ctx.fillRect(x, y - 88, 12, 92); ctx.fillRect(x + 28, y - 62, 9, 66);
    ctx.fillRect(x - 24, y - 82, 48, 18); ctx.fillRect(x + 9, y - 58, 55, 16);
    ctx.fillStyle = '#173626'; ctx.fillRect(x - 14, y - 91, 32, 12); ctx.fillStyle = '#10291e';
  }
}

function drawParallaxLabels() {
  if (!state.debug.parallax) return;
  drawLayerTag('L0 SKY · 0×', 20, 48, '#9bc9c0');
  drawLayerTag('L1 FAR MOUNTAINS · 0.075×', 20, 82, '#8bbab3');
  drawLayerTag('L2 ANCIENT CASTLE · 0.17×', 20, 116, '#d2c783');
  drawLayerTag('L3 FAR FOREST · 0.30×', 20, 150, '#74ad8c');
  drawLayerTag('L4 GAMEPLAY PLANE · 1.0×', 20, 184, '#a8d28f');
  drawLayerTag('L5 FOREGROUND · 1.10×', 20, 218, '#65a77a');
}

function drawParticles() {
  for (let i = 0; i < 24; i += 1) {
    const x = (hash(i * 4) * W + state.time * (5 + i % 4) - state.camera.x * .12) % W;
    const y = HORIZON + 15 + hash(i * 9) * (H - HORIZON - 45);
    const pulse = .25 + Math.sin(state.time * 1.8 + i) * .18;
    ctx.fillStyle = `rgba(166, 230, 168, ${pulse})`; ctx.fillRect(Math.round(x), Math.round(y), i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
  }
  for (let i = 0; i < 10; i += 1) {
    const x = (hash(i * 12) * W - state.time * (9 + i) - state.camera.x * .2 + W * 2) % W;
    const y = HORIZON + 20 + ((hash(i * 3) * 240 + state.time * 7) % 250);
    ctx.fillStyle = i % 2 ? '#7d8f58' : '#9b8a4d'; ctx.fillRect(Math.round(x), Math.round(y), 5, 3);
  }
}

function drawEntityDebug(entity, p, label) {
  if (state.debug.collisions && entity.collider) drawEllipse(p.x, p.y, entity.collider.rx, entity.collider.ry * .5, '#ec766b');
  if (state.debug.labels) drawLabel(label, p.x, p.y + 18, '#b8cfb3');
  drawAnchor(p.x, p.y, entity.y, '#7bd2ad');
}

function drawAnchor(x, y, depth, color) {
  if (state.debug.pivots) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
  }
  if (state.debug.depth) {
    ctx.fillStyle = color; ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.font = '8px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.fillText(`z ${depth.toFixed(0)}`, x + 6, y + 3);
  }
}

function drawEllipse(x, y, rx, ry, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
}

function drawLabel(text, x, y, color) {
  ctx.save();
  ctx.font = '800 10px Noto Sans Thai, Noto Sans, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline='alphabetic';
  const px=Math.round(x),py=Math.round(y);
  ctx.lineJoin='round';ctx.miterLimit=2;ctx.lineWidth=3;ctx.strokeStyle='rgba(2,5,10,.92)';ctx.strokeText(text,px,py+2);
  ctx.fillStyle=color;ctx.fillText(text,px,py+2);ctx.restore();
}

function drawLayerTag(text, x, y, color) {
  ctx.font = '8px ui-monospace, monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(6,12,9,.72)'; ctx.fillRect(x, y - 10, ctx.measureText(text).width + 10, 15);
  ctx.fillStyle = color; ctx.fillText(text, x + 5, y);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  if (useForestEngine && forestEngineReady) {
    // Forest1 changes the map renderer only. Arena keeps all existing gameplay actors unchanged.
    renderMapEngine({cameraX:state.camera.x,cameraY:state.camera.y,screenCenterY:GROUND_Y,timeSeconds:state.time});
  } else if (!blenderMode) {
    drawGround();
    for (const prop of props) drawCastShadow(prop);
  }
  drawCombatGround();
  drawWorldBossTelegraphs();
  drawWarpPortal();
  if(state.manualRest){const p=worldToScreen(state.player.x,state.player.y),pulse=.5+.5*Math.sin(state.time*4);ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(75,220,115,${.07+pulse*.05})`;ctx.strokeStyle=`rgba(105,255,145,${.55+pulse*.3})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+3,34+pulse*5,16+pulse*2,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}

  const entities = [
    ...(blenderMode || (useForestEngine && forestEngineReady) ? [] : props.map((entity) => ({ kind: 'prop', entity }))),
    ...monsters.map((entity) => ({ kind: 'monster', entity })),
    { kind: 'player', entity: state.player },
  ].filter(({ entity }) => {
    const p = worldToScreen(entity.x, entity.y);
    const margin = entity.type === 'tree' ? 180 : 100;
    return p.x > -margin && p.x < W + margin && p.y > -margin && p.y < H + margin;
  }).sort((a, b) => a.entity.y - b.entity.y);

  for (const item of entities) {
    if (item.kind === 'prop') drawProp(item.entity);
    if (item.kind === 'monster') drawMonster(item.entity);
    if (item.kind === 'player') drawPlayer();
  }
  drawSkillSpriteFx(); drawSlash(); drawMeteors(); drawThunderStorms(); drawParticles(); drawLootFx(); drawCombatFx();
  if (blenderMode) {
    ctx.fillStyle='rgba(10,24,17,.10)'; ctx.fillRect(0,0,W,H);
  }
  ctx.fillStyle='rgba(4,15,15,.18)';ctx.fillRect(0,0,W,18);ctx.fillRect(0,H-20,W,20);ctx.fillRect(0,0,16,H);ctx.fillRect(W-16,0,16,H);
}

function syncReadout() {
  const player = state.player;
  const direction = directionNames[player.directionIndex];
  const speed = Math.hypot(player.vx, player.vy);
  document.querySelector('#direction-chip').textContent = `${Math.round(player.heading)}° · ${direction.toUpperCase()}`;
  document.querySelector('#scene-coordinates').textContent = `WORLD ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`;
  document.querySelector('#player-position').textContent = `${player.x.toFixed(1)} / ${player.y.toFixed(1)}`;
  document.querySelector('#active-heading').textContent = `${Math.round(player.heading)}°`;
  document.querySelector('#active-rotation').textContent = `${direction}.png`;
  document.querySelector('#player-velocity').textContent = `${speed.toFixed(1)} px/s`;
  document.querySelector('#depth-value').textContent = player.y.toFixed(1);
}



function presentMonsterDeath(enemy) {
  if (enemy.deathPresented) return;
  enemy.deathPresented = true; enemy.dead = true; enemy.anim='death'; enemy.aggressive=false; enemy.tacklePhase=null; enemy.bossAttackPhase=null; state.kills += 1;
  if (enemy.isBoss) {
    if(qaMode!=='combat'){worldSession.bossAlive=false;worldSession.bossSpawnId=null;worldSession.bossNextAt=Date.now()+300000;saveWorldSession();}
    enemy.deathTimer = 3.4; enemy.deathDuration = 3.4; state.shockwaves ??= [];
    state.shockwaves.push({x:enemy.x,y:enemy.y,age:0,duration:.72,maxRadius:128,kind:'boss-death'});
    const deathPalette=['#f5d37a','#d98a57','#c8d99b','#ffffff'];
    for(let i=0;i<44;i++){const a=Math.random()*Math.PI*2,s=45+Math.random()*145;state.particles.push({x:enemy.x,y:enemy.y-10,vx:Math.cos(a)*s,vy:Math.sin(a)*s-65,life:.45+Math.random()*.65,size:2+Math.floor(Math.random()*4),color:deathPalette[i%deathPalette.length]});}
    enemy.deathFrame=Math.floor((state.time*6+enemy.phase)%(bossFrames[enemy.monsterType]?.walk.length||1));enemy.deathBurstDone=false;enemy.bossDeathFxDone=false;
  } else {
    enemy.deathDuration=.55;enemy.deathTimer=.55;enemy.deathBurstDone=true;
    // Sprite dissolves (drawMonster) + a pixel-break burst and a quick ground shock ring.
    state.shockwaves ??= [];
    state.shockwaves.push({x:enemy.x,y:enemy.y,age:0,duration:.34,maxRadius:enemy.elite?58:40,kind:'death-ring'});
    const deathPalette=enemy.elite?['#f0cf78','#d79b55','#fff0b0','#ffffff']:['#d7e8c2','#8eb477','#6f8f62','#ffffff'];
    const count=enemy.elite?58:42;
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=38+Math.random()*105;state.particles.push({x:enemy.x+(Math.random()-.5)*18,y:enemy.y-10-Math.random()*28,vx:Math.cos(a)*s,vy:Math.sin(a)*s-48,life:.42+Math.random()*.46,size:2+Math.floor(Math.random()*4),color:deathPalette[i%deathPalette.length]});}
  }
  if(state.combatTarget===enemy)state.combatTarget=null;
}
function triggerCyclone(targets) {
  const cast=dispatchV2Skill('cyclone');if(!cast.accepted)return;
  state.cycloneTimer = .9;
  state.attackTimer = .72;
  addFloater(state.player, 'CYCLONE! · 3 HIT', '#8eeaff', -50, 1.15);
  for (let hit = 0; hit < 3; hit++) state.cycloneHits.push({ delay: hit * .095, targets: [...targets], hit });
  for (let i=0;i<34;i++) {
    const angle=(i/34)*Math.PI*2, radius=28+Math.random()*88;
    state.particles.push({x:state.player.x+Math.cos(angle)*radius,y:state.player.y+Math.sin(angle)*radius,vx:Math.cos(angle)*90,vy:Math.sin(angle)*90-12,life:.38+Math.random()*.28,size:2+Math.floor(Math.random()*3),color:i%3===0?'#e7fbff':'#77d9ef'});
  }
}

function addFloater(entity, text, color = '#fff', offsetY = -24, scale = 1, options={}) {
  // Combat numbers for the same target form a vertical feed instead of spawning on top of each other.
  const sameTarget=state.floaters.filter(f=>f.entityId===entity.id&&f.life>.12).sort((a,b)=>a.offsetY-b.offsetY);
  // Every new hit owns a distinct row. Dual-wield/main/offhand events can arrive in the same simulation tick,
  // so spacing is based on all still-visible rows rather than animation time.
  for(const f of sameTarget)f.offsetY-=26;
  state.floaters.push({ entityId:entity.id,x:entity.x,y:entity.y,text,color,offsetY,offsetX:options.offsetX??0,scale,life:options.life??1,maxLife:options.life??1,bg:options.bg??null,paddingX:options.paddingX??7,paddingY:options.paddingY??4 });
}
function addSkillCastLabel(skillId){
 const skill=SKILLS_V2[skillId],name=skill?.name||skillLabel(skillId);
 addFloater(state.player,name,'#f7fbff',-68,1.02,{bg:'rgba(12,20,36,.92)',paddingX:10,paddingY:5,life:1.15});
}
function spawnCritBurst(entity){
  const palette=['#fff8c7','#ffe16a','#ffc13d','#ff9f25'];
  for(let i=0;i<22;i++){const a=(Math.PI*2*i/22)+Math.random()*.16,s=48+Math.random()*82;state.particles.push({x:entity.x,y:entity.y-18,vx:Math.cos(a)*s,vy:Math.sin(a)*s-34,life:.34+Math.random()*.28,size:i%4===0?5:i%2===0?4:3,color:palette[i%palette.length]});}
  state.shockwaves??=[];state.shockwaves.push({x:entity.x,y:entity.y-10,age:0,duration:.3,maxRadius:48,kind:'crit'});
}
function burstMonster(monster) {
  const palette = monster.monsterType === 'mushroom' ? ['#c94e45','#f0d3a1','#8a382f','#fff0c5']
    : monster.monsterType === 'thornroot' ? ['#60452f','#8b6a3e','#4d7a42','#77b65a']
    : monster.monsterType.startsWith('mossblob') ? ['#87b85b','#4f7d46','#d9e66d','#294b36']
    : monster.monsterType.startsWith('sporekin') ? ['#b66a91','#d8ad72','#6e466b','#e8d58e']
    : monster.monsterType.startsWith('acorn') ? ['#8b6239','#c39855','#557542','#e0bb72']
    : ['#5d7a42','#3f5936','#8ba85a','#795a35'];
  const count = monster.isBoss ? 76 : 28;
  const power = monster.isBoss ? 185 : 115;
  for (let i=0;i<count;i++) {
    const angle=Math.random()*Math.PI*2, speed=42+Math.random()*power;
    state.particles.push({x:monster.x,y:monster.y-(monster.isBoss?34:18)-Math.random()*(monster.isBoss?50:24),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(monster.isBoss?80:48),life:(monster.isBoss?.75:.38)+Math.random()*(monster.isBoss?.75:.52),size:(monster.isBoss?3:2)+Math.floor(Math.random()*(monster.isBoss?7:5)),color:palette[i%palette.length]});
  }
  if (monster.isBoss) {
    for (let i=0;i<18;i++) {
      const angle=(i/18)*Math.PI*2, speed=150+Math.random()*70;
      state.particles.push({x:monster.x,y:monster.y-38,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-35,life:.85,size:5+Math.floor(Math.random()*4),color:palette[i%palette.length]});
    }
    addFloater(monster, 'BURST!', '#fff0b0', -72, 1.35);
  }
}

function triggerMeteor() {
  const living = monsters.filter((m) => !m.dead);
  if (!living.length) return;
  addFloater(state.player, 'METEOR!', '#ffb45e', -64, 1.2);
  const center = living.reduce((a,m)=>({x:a.x+m.x/living.length,y:a.y+m.y/living.length}),{x:0,y:0});
  const cast=dispatchV2Skill('meteorStorm',undefined,center);if(!cast.accepted)return;
  for (let i=0;i<5;i++) {
    state.meteors.push({x:center.x+(Math.random()-.5)*150,y:center.y+(Math.random()-.5)*120,delay:i*.16+.12,fall:.48,impact:false,life:.7});
  }
}
function updateMeteors(dt) {
  for (const m of state.meteors) {
    if (m.delay > 0) { m.delay-=dt; continue; }
    if (!m.impact) {
      m.fall-=dt;
      if (m.fall<=0) {
        m.impact=true;
        for(let i=0;i<28;i++){const a=Math.random()*Math.PI*2,s=35+Math.random()*105;state.particles.push({x:m.x,y:m.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-55,life:.35+Math.random()*.4,size:2+Math.floor(Math.random()*5),color:i%3?'#ff8a45':'#ffd36a'});}
      }
    } else m.life-=dt;
  }
  state.meteors=state.meteors.filter(m=>!m.impact||m.life>0);
}
function drawMeteors() {
  for(const m of state.meteors){
    if(m.delay>0) continue;
    const p=worldToScreen(m.x,m.y);
    if(!m.impact){
      const t=Math.max(0,m.fall/.48);
      ctx.globalAlpha=.35;ctx.fillStyle='#ff7a3d';ctx.beginPath();ctx.ellipse(p.x,p.y,48,20,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;ctx.fillStyle='#ffd16a';ctx.fillRect(Math.round(p.x+70*t-7),Math.round(p.y-180*t-7),14,14);
      ctx.fillStyle='#ff7040';ctx.fillRect(Math.round(p.x+70*t-4),Math.round(p.y-180*t-4),8,8);
    } else {
      ctx.globalAlpha=Math.max(0,m.life/.7);ctx.strokeStyle='#ffb45e';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(p.x,p.y,70*(1-m.life/.7)+20,28*(1-m.life/.7)+8,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
  }
}

function triggerThunderStorm() {
  if (state.thunderStormCooldown > 0) return;
  const living = monsters.filter((m) => !m.dead && Math.hypot(m.x - state.player.x, m.y - state.player.y) <= 190);
  if (!living.length) return;
  state.thunderStormCooldown = 4.5;
  addFloater(state.player, 'THUNDER STORM!', '#bfe9ff', -64, 1.2);
  const center = living.reduce((a,m)=>({x:a.x+m.x/living.length,y:a.y+m.y/living.length}),{x:0,y:0});
  const cast=dispatchV2Skill('thunderStorm',living[0]);if(!cast.accepted){state.thunderStormCooldown=0;return;}
  for (let i=0;i<5;i++) {
    const target = living[i % living.length];
    const x = target ? target.x : center.x + (Math.random()-.5)*120;
    const y = target ? target.y : center.y + (Math.random()-.5)*90;
    state.thunderStorms.push({x,y,delay:i*.11+.08,life:.32,impact:false,seed:i});
  }
}
function updateThunderStorms(dt) {
  state.thunderStormCooldown = Math.max(0, state.thunderStormCooldown - dt);
  for (const bolt of state.thunderStorms) {
    if (bolt.delay > 0) { bolt.delay -= dt; continue; }
    if (!bolt.impact) {
      bolt.impact = true;
      state.shockwaves ??= [];
      state.shockwaves.push({x:bolt.x,y:bolt.y,age:0,duration:.28,maxRadius:76,kind:'thunder'});
      for(let i=0;i<18;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*85;state.particles.push({x:bolt.x,y:bolt.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,life:.22+Math.random()*.28,size:1+Math.floor(Math.random()*3),color:i%3===0?'#fff58a':'#9de7ff'});}
    } else bolt.life -= dt;
  }
  state.thunderStorms = state.thunderStorms.filter((b)=>!b.impact || b.life>0);
}
function drawThunderStorms() {
  for (const bolt of state.thunderStorms) {
    if (bolt.delay > 0) continue;
    const p=worldToScreen(bolt.x,bolt.y);
    ctx.save();
    if (!bolt.impact) {
      ctx.globalAlpha=.38; ctx.strokeStyle='#bfe9ff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,46,19,0,0,Math.PI*2); ctx.stroke();
    } else {
      const alpha=Math.max(0,bolt.life/.32);
      ctx.globalAlpha=alpha;
      ctx.strokeStyle='#eafaff'; ctx.lineWidth=5;
      ctx.beginPath();
      let x=p.x-10+(bolt.seed%3)*8, y=p.y-230;
      ctx.moveTo(x,y);
      for(let i=1;i<=7;i++){x += (i%2?18:-15)+(bolt.seed%2?3:-3); y=p.y-230+i*32; ctx.lineTo(x,y);}
      ctx.lineTo(p.x,p.y); ctx.stroke();
      ctx.strokeStyle='#75d8ff'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle='rgba(190,240,255,.34)'; ctx.beginPath(); ctx.ellipse(p.x,p.y,58,23,0,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}

function updateCycloneHits(dt) {
  for (const wave of state.cycloneHits) {
    wave.delay -= dt;
    if (wave.delay > 0 || wave.done) continue;
    wave.done = true;
  }
  state.cycloneHits = state.cycloneHits.filter((wave) => !wave.done);
}

function updateCombatFx(dt) {
  for (const p of state.particles) { p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=110*dt; p.life-=dt; }
  state.particles=state.particles.filter(p=>p.life>0);
  for (const f of state.floaters) { f.life-=dt; f.offsetY-=24*dt; }
  state.floaters=state.floaters.filter(f=>f.life>0);
  state.stripFx ??= [];
  for (const fx of state.stripFx) fx.age += dt;
  state.stripFx = state.stripFx.filter(fx => fx.age < fx.duration);
  state.shockwaves ??= [];
  for (const wave of state.shockwaves) wave.age += dt;
  state.shockwaves = state.shockwaves.filter(wave => wave.age < wave.duration);
  state.bossTelegraphs ??= [];
  for (const fx of state.bossTelegraphs) fx.age += dt;
  state.bossTelegraphs = state.bossTelegraphs.filter(fx => fx.age < fx.duration);
  state.attackTelegraphs ??= [];
  for (const fx of state.attackTelegraphs) fx.age += dt;
  state.attackTelegraphs = state.attackTelegraphs.filter(fx => fx.age < fx.duration);
  for(const fx of state.lootFx){fx.age+=dt;if(fx.age<fx.delay){fx.x+=fx.vx*dt;fx.y+=fx.vy*dt;fx.vx*=.94;fx.vy+=75*dt;}else{const t=Math.min(1,(fx.age-fx.delay)/Math.max(.01,fx.duration-fx.delay)),ease=1-Math.pow(1-t,3);fx.x+=(state.player.x-fx.x)*ease*.22;fx.y+=(state.player.y-fx.y)*ease*.22;}}
  state.lootFx=state.lootFx.filter(fx=>fx.age<fx.duration);
}
function drawLootFx(){const colors={white:'#f4f2e8',green:'#6ee787',blue:'#62b5ff',purple:'#c77dff',gold:'#ffd45c'};for(const fx of state.lootFx){const p=worldToScreen(fx.x,fx.y),t=Math.max(0,(fx.age-fx.delay)/(fx.duration-fx.delay)),rare=fx.tier==='purple'||fx.tier==='gold';ctx.save();ctx.globalAlpha=Math.min(1,(fx.duration-fx.age)*5);ctx.shadowColor=colors[fx.tier];ctx.shadowBlur=rare?14:7;ctx.fillStyle=colors[fx.tier];ctx.translate(p.x,p.y-12);ctx.rotate(Math.PI/4);const s=rare?7:5;ctx.fillRect(-s/2,-s/2,s,s);ctx.restore();if(fx.tier==='gold'&&fx.age<fx.delay+.15){ctx.save();ctx.globalAlpha=.35;ctx.fillStyle=colors.gold;ctx.fillRect(p.x-1,p.y-75,2,65);ctx.restore();}}}
function drawCombatFx() {
  if(state.barrierFx){const p=worldToScreen(state.player.x,state.player.y),pulse=1+Math.sin(performance.now()/110)*.035;ctx.save();ctx.globalAlpha=.24+.16*Math.min(1,state.barrierFx.life);ctx.strokeStyle='#8ed8ff';ctx.fillStyle='rgba(90,185,255,.08)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y-22,36*pulse,47*pulse,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
  if (state.cycloneTimer > 0) {
    const p=worldToScreen(state.player.x,state.player.y), progress=1-state.cycloneTimer/.9;
    ctx.save(); ctx.globalAlpha=Math.max(0,state.cycloneTimer/.9); ctx.strokeStyle='#8eeaff'; ctx.lineWidth=3;
    if(cyclonePixelFxSheet){const frame=Math.min(8,Math.floor(Math.min(.999,progress)*9));ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(p.x),Math.round(p.y-10));ctx.scale(1.65,.78);ctx.drawImage(cyclonePixelFxSheet,frame*64,64,64,64,-48,-48,96,96);}else{for(let i=0;i<6;i++){ctx.beginPath();ctx.ellipse(p.x,p.y-8,30+i*10+progress*30,12+i*4,0,progress*Math.PI*4+i*.8,progress*Math.PI*4+i*.8+Math.PI*1.15);ctx.stroke();}}
    ctx.restore();
  }
  for (const telegraph of state.attackTelegraphs ?? []) {
    if (telegraph.type !== 'tackle') continue;
    const start=worldToScreen(telegraph.x,telegraph.y), end=worldToScreen(telegraph.x+telegraph.dx*58,telegraph.y+telegraph.dy*58);
    const progress=Math.min(1,telegraph.age/telegraph.duration), pulse=.55+.45*Math.sin(progress*Math.PI*5);
    ctx.save(); ctx.globalAlpha=.45+.35*pulse; ctx.strokeStyle=telegraph.elite?'#ffd36b':'#ff9b72'; ctx.lineWidth=telegraph.elite?4:3;
    ctx.setLineDash([6,4]); ctx.beginPath(); ctx.moveTo(Math.round(start.x),Math.round(start.y-3)); ctx.lineTo(Math.round(end.x),Math.round(end.y-3)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle=telegraph.elite?'#ffd36b':'#ff9b72'; ctx.beginPath(); ctx.arc(Math.round(start.x),Math.round(start.y-3),telegraph.elite?5:4,0,Math.PI*2); ctx.fill(); ctx.restore();
  }
  for (const telegraph of state.bossTelegraphs ?? []) {
    const p=worldToScreen(telegraph.x,telegraph.y), progress=Math.min(1,telegraph.age/telegraph.duration);
    if (telegraph.type === 'mushroom-slam') {
      const pulse=.72+.28*Math.sin(progress*Math.PI*8), r=telegraph.maxRadius*(.82+.18*progress);
      ctx.save(); ctx.globalAlpha=.45+.35*progress; ctx.strokeStyle=progress>.72?'#f2b36f':'#c88955'; ctx.lineWidth=2;
      ctx.setLineDash([7,5]); ctx.beginPath(); ctx.ellipse(Math.round(p.x),Math.round(p.y),Math.round(r),Math.round(r*.42),0,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=.28*pulse; ctx.fillStyle='#d7a36a'; ctx.beginPath(); ctx.ellipse(Math.round(p.x),Math.round(p.y),Math.round(r*.72),Math.round(r*.3),0,0,Math.PI*2); ctx.fill(); ctx.restore();
    } else if (telegraph.type === 'goblin-stomp') {
      const r=telegraph.maxRadius*(.42+.58*progress);
      ctx.save(); ctx.globalAlpha=.5+.35*progress; ctx.strokeStyle='#d6a55f'; ctx.lineWidth=3; ctx.setLineDash([5,6]);
      ctx.beginPath(); ctx.ellipse(Math.round(p.x),Math.round(p.y),Math.round(r),Math.round(r*.42),0,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]); for(let i=0;i<8;i++){const a=i*Math.PI/4,rx=Math.cos(a)*r*.72,ry=Math.sin(a)*r*.3;ctx.fillRect(Math.round(p.x+rx),Math.round(p.y+ry),4,2);} ctx.restore();
    } else if (telegraph.type === 'goblin-cleave') {
      const angle=Math.atan2(telegraph.dy,telegraph.dx), r=telegraph.maxRadius*(.88+.12*progress);
      ctx.save(); ctx.globalAlpha=.55+.3*progress; ctx.strokeStyle='#e0a45f'; ctx.lineWidth=3; ctx.setLineDash([7,5]);
      ctx.beginPath(); ctx.arc(Math.round(p.x),Math.round(p.y-3),r,angle-.62,angle+.62); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }
  }
  for (const wave of state.shockwaves ?? []) {
    const p=worldToScreen(wave.x,wave.y), progress=wave.age/wave.duration, r=8+(wave.maxRadius-8)*progress;
    ctx.save(); ctx.globalAlpha=Math.max(0,1-progress);
    if (wave.kind==='death-ring') { ctx.globalCompositeOperation='lighter'; ctx.strokeStyle='rgba(235,248,255,.9)'; ctx.lineWidth=2.5; }
    else { ctx.strokeStyle='#8f623b'; ctx.lineWidth=3; }
    ctx.beginPath(); ctx.ellipse(Math.round(p.x),Math.round(p.y),Math.round(r),Math.round(r*.42),0,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
  for (const fx of state.stripFx ?? []) {
    const strip=combatFxStrips.get(fx.id);
    if (!strip?.frames?.length) continue;
    const progress=Math.min(.999,fx.age/Math.max(.001,fx.duration));
    const frame=Math.min(strip.frameCount-1,Math.floor(progress*strip.frameCount));
    const img=strip.frames[frame], p=worldToScreen(fx.x,fx.y), scale=Math.max(1,Math.round(fx.scale||1));
    const dw=strip.frameWidth*scale, dh=strip.frameHeight*scale;
    ctx.save(); ctx.translate(Math.round(p.x),Math.round(p.y)); ctx.rotate(fx.rotation||0);
    if(fx.flipX)ctx.scale(-1,1); ctx.imageSmoothingEnabled=false;
    const ox=fx.anchor==='left-ground-origin'?0:-dw/2;
    const oy=fx.anchor?.includes('ground')?-dh:-dh/2;
    ctx.drawImage(img,Math.round(ox),Math.round(oy),dw,dh); ctx.restore();
  }
  for (const p of state.particles) { const s=worldToScreen(p.x,p.y); ctx.globalAlpha=Math.max(0,p.life/.8); ctx.fillStyle=p.color; ctx.fillRect(Math.round(s.x),Math.round(s.y),p.size,p.size); }
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  for (const f of state.floaters) { const s=worldToScreen(f.x,f.y),x=Math.round(s.x+(f.offsetX??0)),y=Math.round(s.y+f.offsetY); ctx.globalAlpha=Math.max(0,f.life/f.maxLife); ctx.font=`900 ${Math.round(12*f.scale)}px Noto Sans Thai, Noto Sans, Tahoma, sans-serif`;ctx.lineJoin='round';ctx.miterLimit=2;if(f.bg){const m=ctx.measureText(f.text),px=f.paddingX??7,py=f.paddingY??4,h=Math.round(15*f.scale);ctx.fillStyle=f.bg;ctx.beginPath();ctx.roundRect(x-m.width/2-px,y-h-py,m.width+px*2,h+py*2,6);ctx.fill();}ctx.lineWidth=Math.max(2,Math.round(2.5*f.scale));ctx.strokeStyle='rgba(2,4,9,.95)';ctx.strokeText(f.text,x,y);ctx.fillStyle=f.color;ctx.fillText(f.text,x,y); }
  ctx.globalAlpha=1;
}

const heroCombatFrames = new Map();

async function registerHeroCombatAnimation(definition) {
  const directionalFrames = {};
  for (const direction of definition.directions) {
    directionalFrames[direction] = await Promise.all(Array.from({ length: definition.frames }, (_, frame) =>
      loadImage(heroCombatFramePath(definition, direction, frame))
    ));
  }
  heroCombatFrames.set(definition.animationId, directionalFrames);
}

const heroCombatManifest = await fetch('../isometric-player/combat/manifest.json').then((response) => {
  if (!response.ok) throw new Error(`Hero combat manifest failed: HTTP ${response.status}`);
  return response.json();
});
const approvedSwordAttack = heroCombatManifest.animations?.find((animation) =>
  animation.animationId === SWORD_ATTACK_01.animationId && animation.status === 'approved'
);
if (approvedSwordAttack) await registerHeroCombatAnimation(SWORD_ATTACK_01);
const approvedDaggerAttack = heroCombatManifest.animations?.find((animation) =>
  animation.animationId === DAGGER_ATTACK_01.animationId && animation.status === 'approved'
);
if (approvedDaggerAttack) await registerHeroCombatAnimation(DAGGER_ATTACK_01);

function faceWorldTarget(target){if(!target)return;setFacing(target.x-state.player.x,target.y-state.player.y);}
function triggerAttack(target = null) {
  if (state.heroCombat.playback.active) return false;
  const authoritativePlayer=arenaV2.simulation.world.players.get(arenaV2.playerId);
  // Never start a visual swing before the authoritative ASPD cooldown is ready.
  // Otherwise the animation can reach gameplayImpact only for Engine to reject it as attack-cooldown.
  if(authoritativePlayer && arenaV2.simulation.clock.nowMs < authoritativePlayer.nextBasicAttackAtMs) return false;
  if(target){
    state.combatTarget=target;state.target=null;faceWorldTarget(target);
    arenaV2.move({x:0,y:0});state.player.vx=0;state.player.vy=0;
  }
  const remainingAttackMs=authoritativePlayer?Math.max(1,authoritativePlayer.nextBasicAttackAtMs-arenaV2.simulation.clock.nowMs):state.heroCombat.attackIntervalMs;
  beginHeroAttack(state.heroCombat.playback, {
    attackIntervalMs: Math.max(state.heroCombat.attackIntervalMs,remainingAttackMs),
    payload: { target },
  });
  return true;
}

function updateHeroCombat(dt) {
  for(const fx of state.skillSpriteFx)fx.age+=dt;
  state.skillSpriteFx=state.skillSpriteFx.filter(fx=>fx.age<fx.duration);
  for (const fx of state.heroCombat.visualFx) fx.age += dt;
  state.heroCombat.visualFx = state.heroCombat.visualFx.filter((fx) => fx.age < fx.duration);

  const events = updateHeroAttackPlayback(state.heroCombat.playback, dt * 1000);
  for (const event of events) {
    const payload = event.payload ?? {};
    const target = payload.target;
    if (event.type === 'weaponTrail') {
      state.attackTimer = .16;
      state.heroCombat.visualFx.push({
        type: 'weaponTrail', x: state.player.x, y: state.player.y,
        angle: state.player.heading * Math.PI / 180, age: 0, duration: .22,
        melee: state.heroCombat.weaponFamily!=='bow',
      });
    } else if (event.type === 'gameplayImpact' && target && !target.dead) {
      faceWorldTarget(target);
      // A moving target may cross the melee boundary during startup frames. The swing was
      // already authorized in range, so resolve against that committed target instead of
      // turning a valid visible swing into a silent out-of-range rejection.
      const authoritativePlayer=arenaV2.simulation.world.players.get(arenaV2.playerId);
      const authoritativeTarget=arenaV2.simulation.world.monsters.get(target.id);
      const bowMastery=authoritativePlayer?.masteryLevels?.bow??0;
      const committedRange=(authoritativePlayer?.attackRange??58)*(authoritativePlayer?.weaponFamily==='bow'&&bowMastery>=30?1.10:1);
      const impactDistance=authoritativePlayer&&authoritativeTarget?Math.hypot(authoritativeTarget.position.x-authoritativePlayer.position.x,authoritativeTarget.position.y-authoritativePlayer.position.y):0;
      if(authoritativePlayer&&authoritativeTarget&&impactDistance>committedRange){
        const dx=authoritativeTarget.position.x-authoritativePlayer.position.x,dy=authoritativeTarget.position.y-authoritativePlayer.position.y,len=Math.hypot(dx,dy)||1;
        authoritativePlayer.position={x:authoritativeTarget.position.x-dx/len*(committedRange-.5),y:authoritativeTarget.position.y-dy/len*(committedRange-.5)};
      }
      const result = dispatchV2BasicAttack(target);
      payload.impactAccepted = Boolean(result.accepted);
      if (!result.accepted) {
        // A visible swing must never fail silently. Range/cooldown rejection is not a HIT/FLEE miss,
        // so surface the authoritative rejection instead of pretending the attack connected.
        if (result.reason === 'out-of-range') addFloater(target,'OUT OF RANGE','#d9e7ef',-22,.9);
      }
      if (result.accepted) {
        state.damageTimer = .65;
        state.combatPunch.flash = .075;
        state.combatPunch.shake = .12;
        state.combatPunch.hitStop = .042;
        const a=state.player.heading*Math.PI/180;
        for(let i=0;i<14;i++){
          const spread=(Math.random()-.5)*1.15,ang=a+spread,s=75+Math.random()*150;
          state.particles.push({x:target.x,y:target.y-(target.isBoss?30:16),vx:Math.sin(ang)*s,vy:-Math.cos(ang)*s-35,life:.12+Math.random()*.18,size:1+Math.floor(Math.random()*3),color:i%4===0?'#ffffff':i%2===0?'#9ee8ff':'#ffd27a'});
        }
      }
      if (result.accepted && target.dead) state.attackCooldown = Math.min(state.attackCooldown, .12);
    } else if (event.type === 'impactSpark') {
      if (payload.impactAccepted === false) continue;
      const heading = state.player.heading * Math.PI / 180;
      const x = target?.x ?? state.player.x + Math.sin(heading) * 42;
      const y = target?.y ?? state.player.y - Math.cos(heading) * 42;
      spawnStripFx('global-hit-spark', x, y - (target?.isBoss ? 30 : 16), { duration: .18, scale: target?.isBoss ? 1.25 : 1 });
    }
  }
}

function triggerDash(){const p=arenaV2.simulation.world.players.get(arenaV2.playerId);if(!p?.alive)return;let dx=Number(state.keys.has('right'))-Number(state.keys.has('left')),dy=Number(state.keys.has('down'))-Number(state.keys.has('up'));if(!dx&&!dy){const a=state.player.heading*Math.PI/180;const screenX=Math.sin(a),screenY=-Math.cos(a);dx=screenX/(2*ISO_X)+screenY/(2*ISO_Y);dy=-screenX/(2*ISO_X)+screenY/(2*ISO_Y);}const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;const before={x:state.player.x,y:state.player.y},direction=directionNames[state.player.directionIndex],flipX=heroIdleFrames[direction]?.flipX??false;const result=arenaV2.dodge({x:dx,y:dy});if(result?.accepted){presentV2Events(result.events);const after={x:state.player.x,y:state.player.y};for(let i=0;i<4;i++){const t=i/4;state.heroCombat.visualFx.push({type:'dashAfterimage',x:before.x+(after.x-before.x)*t,y:before.y+(after.y-before.y)*t,direction,flipX,age:-i*.025,duration:.20});}}}

const keyNames = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
};

window.addEventListener('keydown', (event) => {
  if (document.activeElement === chatInput) return;
  if(event.code==='KeyC'){event.preventDefault();openCharacterWindow();return;}
  if(event.code==='KeyI'){event.preventDefault();openGameWindow('Inventory');return;}
  if(event.code==='KeyK'){event.preventDefault();openGameWindow('Skills');return;}
  if(event.code==='KeyY'){event.preventDefault();openGameWindow('Craft');return;}
  if(event.code==='KeyM'){event.preventDefault();openGameWindow('Monster Index');return;}
  if(event.code==='KeyP'){event.preventDefault();openGameWindow('Party');return;}
  if(event.code==='KeyG'){event.preventDefault();openGameWindow('Guild');return;}
  if(event.code==='KeyZ'){event.preventDefault();state.manualRest=!state.manualRest;arenaV2.move({x:0,y:0});state.target=null;state.combatTarget=null;state.controlMode='manual';state.autoCombat=false;syncAutoHuntButton();addFloater(state.player,state.manualRest?'REST ×3':'REST OFF',state.manualRest?'#78ef9a':'#aab2ad',-46,.9);return;}
  if(event.code==='Digit1'||event.code==='Digit2'||event.code==='Digit3'){event.preventDefault();castHotbarSkill(Number(event.code.slice(-1))-1);return;}
  if (event.code === 'Space') { event.preventDefault(); if(arenaV2.character.skills.movement)triggerDash(); return; }
  if (event.code === 'KeyQ') { event.preventDefault(); return; }
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { event.preventDefault(); if (state.player.jumpTimer <= 0) state.player.jumpTimer = state.player.jumpDuration; return; }
  if (!keyNames[event.key]) return;
  if(state.manualRest)state.manualRest=false;
  event.preventDefault(); state.keys.add(keyNames[event.key]);
});
window.addEventListener('keyup', (event) => { if (keyNames[event.key]) state.keys.delete(keyNames[event.key]); });
window.addEventListener('blur', () => state.keys.clear());

canvas.addEventListener('pointerdown', (event) => {
  if(state.manualRest)state.manualRest=false;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * W / rect.width;
  const y = (event.clientY - rect.top) * H / rect.height;
  if (y < HORIZON + 8) return;
  let clicked=null,best=Infinity;
  for(const monster of monsters){if(monster.dead)continue;const p=worldToScreen(monster.x,monster.y),d=Math.hypot(x-p.x,y-p.y);if(d<Math.max(24,monster.size*.65)&&d<best){clicked=monster;best=d;}}
  if(clicked){
    // Click-to-attack is chase first: selecting a monster never forces an immediate swing.
    // The manual combat loop walks into authoritative melee range, stops, then calls triggerAttack.
    state.controlMode='manual';state.autoCombat=false;syncAutoHuntButton();
    state.combatTarget=clicked;state.target=null;faceWorldTarget(clicked);
    const dx=clicked.x-state.player.x,dy=clicked.y-state.player.y;
    const authoritativePlayer=arenaV2.simulation.world.players.get(arenaV2.playerId);
    const attackRange=Math.max(1,(authoritativePlayer?.attackRange??58)-2);
    if(Math.hypot(dx,dy)>attackRange)arenaV2.move({x:dx,y:dy});
    else arenaV2.move({x:0,y:0});
    return;
  }
  // Ground click is an explicit cancel/retreat command: immediately release the combat target,
  // then move freely to the clicked destination. The next manual-combat tick must not reacquire it.
  state.combatTarget=null;
  state.target = screenToWorld(x, y);
  state.target.x = Math.max(WORLD.minX + 30, Math.min(WORLD.maxX - 30, state.target.x));
  state.target.y = Math.max(WORLD.minY + 20, Math.min(WORLD.maxY - 20, state.target.y));
});

const debugBindings = [
  ['toggle-grid', 'grid'], ['toggle-pivots', 'pivots'], ['toggle-labels', 'labels'],
  ['toggle-collisions', 'collisions'], ['toggle-depth', 'depth'], ['toggle-range', 'range'],
  ['toggle-hitboxes', 'hitboxes'], ['toggle-composition', 'composition'],
];
for (const [id, key] of debugBindings) {
  document.querySelector(`#${id}`).addEventListener('change', (event) => { state.debug[key] = event.currentTarget.checked; });
}
document.querySelector('#attack-test').addEventListener('click', () => triggerAttack(state.combatTarget || nearestMonster()?.monster || null));
document.querySelector('#debug-hit')?.addEventListener('click', () => debugTrigger('hit'));
document.querySelector('#debug-tackle')?.addEventListener('click', () => debugTrigger('tackle'));
document.querySelector('#debug-boss')?.addEventListener('click', () => debugTrigger('boss'));
document.querySelector('#debug-death')?.addEventListener('click',startDeathOverlay);
document.querySelector('#debug-death')?.addEventListener('click', () => debugTrigger('death'));

let previousTime = performance.now();
let readoutAccumulator = 0;
function frame(now) {
  const rawDt = (now - previousTime) / 1000;
  previousTime = now;
  // A refresh/background-tab resume can produce a large or invalid delta. Skip that
  // simulation step instead of feeding corrupted positions/timers into the prototype.
  const dt = Number.isFinite(rawDt) && rawDt > 0 && rawDt < .25 ? Math.min(.05, rawDt) : 0;
  const punch=state.combatPunch;
  const frozen=punch.hitStop>0;
  if(dt>0){punch.hitStop=Math.max(0,punch.hitStop-dt);punch.flash=Math.max(0,punch.flash-dt);punch.shake=Math.max(0,punch.shake-dt);}
  if (dt > 0 && !frozen) update(dt);
  const baseCameraX=state.camera.x,baseCameraY=state.camera.y;
  if(punch.shake>0){const strength=3.5*Math.min(1,punch.shake/.08);state.camera.x+=(Math.random()-.5)*strength;state.camera.y+=(Math.random()-.5)*strength;}
  render();
  state.camera.x=baseCameraX;state.camera.y=baseCameraY;
  if(punch.flash>0){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(.24,punch.flash*3.2);ctx.fillStyle='#dff8ff';ctx.fillRect(0,0,W,H);ctx.restore();}
  readoutAccumulator += dt;
  if (readoutAccumulator > .08) { syncReadout(); readoutAccumulator = 0; }
  requestAnimationFrame(frame);
}

// Preserve field position across refresh; throttled so movement does not spam storage.
let worldSessionSaveTimer=0;setInterval(()=>{saveWorldSession();},1000);
window.addEventListener('pagehide',saveWorldSession);
if(useForestEngine){
  try{
    const engineScene=forestEngineScene();
    forestEngineSpawn=engineScene.spawn;
    await prepareMapEngine(engineScene,{canvasEl:canvas});
    forestEngineReady=true;
  }catch(error){
    console.error('[Forest1 Map Engine] prepare failed; using legacy renderer.',error);
    forestEngineReady=false;
  }
}
syncReadout();
requestAnimationFrame(frame);
