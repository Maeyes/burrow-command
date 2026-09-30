import {decorateHud} from './warren-hud.js';
// Burrow Command: a persistent bunny squad defends its warren (Phase 2: individual progression + forge).
// Day: bunnies farm the field around a flag and carry loot home. Night: waves attack the burrow.
// Gold only comes from kills. Real forest monster drops feed the forge and construction. Downed bunnies recover at dawn.
// Progression (docs/BURROW_COMMAND_PROGRESSION_SPEC.md, phase 1): the warren is saved every dawn;
// losing a night is a setback, not game over, and the same wave comes back until it is beaten.
// Each warren level has 5 waves (5 = boss); beating the boss unlocks the warren upgrade.
// Terrain, Blessed Bunny, monster art and FX are the Dimraeth engine's; the rules live here.
import { setRuntimeZoomRange, getRuntimeZoom, setRuntimeZoom, projectRuntimePoint, boot, setRuntimeActors, setRuntimeActorUpdater, setRuntimePlayerVisual, setRuntimePlayerControl, setRuntimeClickHandler, runtimePointerHit, canRuntimeActorStand, runtimeWalkHeight, resolveRuntimeActor, repaintRuntimeRoadFields } from './engine/runtime.js';
import { emptyMap, sceneFromMap } from './scenes/custom.js';
import { findPath, canWalkStraight } from './combat/nav.js';
import { getRoster, monsterPresentation } from './combat/rosters.js';
import { loadBlessedHero } from './combat/hero.js';
import { createSkillFx, BASIC_ATTACK_FX } from './combat/skillfx.js';
import { createMythicCinematic } from './warren-mythic-cinematic.js';
import { createWukongCinematic } from './warren-wukong-cinematic.js';
import { createArthurCinematic } from './warren-arthur-cinematic.js';
import {createPerimeterController} from './warren-perimeter-controller.js';
import { createMythicSkills, WUKONG_CLONE_OFFSETS } from './warren-mythic-skills.js';
import wukongWalkSheet from '../wukong-staff-vfx/assets/walk.png?url';
import wukongHitSheet from '../wukong-staff-vfx/assets/hit.png?url';
import wukongStaffUrl from '../wukong-staff-vfx/assets/wukong-staff-isolated-v1.png?url';
import wukongCombinedStrikeSheet from '../wukong-staff-vfx/assets/wukong-combined-strike-24f.png?url';
import arthurWalkSheet from './assets/mythic/king-arthur/arthur-walk-6f-v4.png?url';
import arthurAttackSheet from './assets/mythic/king-arthur/arthur-attack-4f-v2.png?url';
import arthurGoldenWaveUrl from './assets/mythic/king-arthur/excalibur-golden-wave.png?url';
import {defaultMythic,normalizeMythic,rollMythicOmen,validMythicSquad,defaultMythicSquad,settleMythic,mythicHpMultiplier,mythicAtkMultiplier,mythicBossAttack,MYTHIC_RELICS,MYTHIC_BOSSES} from './warren-mythic.js';
import {archiveProgress,relicIconPath} from './warren-relic-archive.js';
import {renderRelicArchiveHtml} from './warren-relic-ui.js';
import { createFloaters } from './combat/floaters.js';
import { combatFX } from './combat/fx.js';
import { combatSFX } from './combat/sfx.js';
import { towerSprite, magicCartSprite, stoneWallSprite, stoneGateSprite } from './engine/sprites.js';
import { biomeOf } from './engine/biomes.js';
import { fenceRun } from './engine/world.js';
import {PERIMETER_TIERS,perimeterTier,nextPerimeterTier,perimeterFootprint,perimeterBlueprint,perimeterHealth,perimeterMid,nearestPerimeterSection,normalizeGateSelections,toggleGateSelection,gateShouldClose,MAX_CLOSED_GATES,GATE_SIDES} from './warren-perimeter.js';
import { WS } from './engine/state.js';
import { K } from './engine/util.js';
import * as PAL from './engine/palettes.js';
import { CLASS_FAMILIES, LEGACY_SAVE_KEY, SAVE_KEY, bunnyName, expRequired, giveBunnyExp, migrateSave, monsterLoot, addInventory, craftMaterialCount, spendCraftMaterials, defaultBuilds, unlockedTier, minLevelForTier, buildFor, buildCombatBonus, availableRecipes, canCraft, craftGear, craftBatch, enhanceGear, enhanceAll, refineGear, dismantleGear, dismantleSelection, setGearLock, recommendations, grantClassMastery, unlockClassMastery, unlockedMastery, toggleMasteryWeaponSkill, classProgress, defaultProgress, defaultMastery, burrowMonsterGold, shouldDepositLootDirectly, autoEquipBuild, equipBuildItem, equippedGearIds, gearSlot, EQUIPMENT_MASTER_V2, EQUIPMENT_RARITY_STAT_MULTIPLIER, MAX_FIELD_PER_CLASS, fieldSquadCap, fieldClassCap, FIELD_SQUAD_GATES, CLASS_IDS, GEAR_SLOTS, PRIOR_SAVE_KEY, defaultAutoDismantleSettings, settleBatchCraft, constructionMaterialCount, spendConstructionMaterials, warrenConstructionCost, fortificationCost, fortificationCap, fortificationHpBonus, repairAllQuote, repairEverything, CONSTRUCTION_MATERIAL_IDS, constructionRefund } from './warren-progression.js';

const IS_CINEMATIC_PREVIEW=globalThis.location?.hash==='#cinematic-preview';
import { inventoryItemMeta } from '../../src/simulation/itemTagsV2.ts';
import { MONSTERS_V2 as MONSTER_XP } from '../../src/simulation/monsterDataV2.ts';
import { itemLabel, gameIcon, renderSquadHtml, renderForgeHtml, renderHeroHtml, renderInventoryHtml, renderItemDetailHtml } from './warren-ui.js';
import { renderTowerHtml,renderMagicCartHtml, renderMasteryHtml, renderBatchHtml } from './warren-extra-ui.js';
import { selectNightDefenseTarget, chooseRaidGate, nearestClosedGate, assignedGateDefensePost } from './warren-defense-ai.js';
import {renderArmoryHtml,visibleArmoryInventory} from './warren-armory-ui.js';
import {PHASE1_MAX_LEVEL,NIGHT_INVASION_DIRECTIONS,stageForWarren,warrenStageDifficulty,warrenMonsterStats,frontierStage,lureQuote,LURE_MODES} from './warren-phase1.js';
import {renderLureHtml} from './warren-lure-ui.js';
import {NPC_COMMON_PRICES,quoteQuickSell,commitQuickSell} from './warren-quick-sell.js';
import {renderQuickSellHtml} from './warren-quick-sell-ui.js';
import {FORGE_COST,RESOURCE_COST,applyMonsterResourceBonus,castWarrenHeal,BUILDING_LEVEL_MAX,buildingLevelCap} from './warren-village-buildings.js';
import {renderHallBuildingHtml,renderBlacksmithBuildingHtml,renderResourceBuildingHtml} from './warren-building-ui.js';
import {MAGIC_CART_COST,MAGIC_CART_GATES,MAGIC_CART_HP,MAGIC_CART_RANGE,MAGIC_CART_UPGRADE,magicCartCap} from './warren-magic-cart.js';
import {defaultClassSkills,applyBurrowSkillCommand,classSkillQuote,classActiveCores} from './warren-class-cores.js';
import {skillUpgradeKind} from '../../src/simulation/skillCoreService.ts';
import {regenBurrowSp,chooseBurrowCore,resolveBurrowCore,resolveBurrowMovement,resolveBurrowMasteryOnHit,persistBurrowMasteryRuntime} from './warren-core-combat.js';
import {SKILLS_V2} from '../../src/simulation/skills.ts';
import {renderClassCoreHtml} from './warren-class-core-ui.js';
import {BURROW_VERSION,renderGuideHtml,renderPatchNotesHtml,unlocksAtWarrenLevel} from './warren-guide.js';
import {renderWaterfallGuideHtml,shouldShowWaterfallIntro,markWaterfallIntroSeen} from './warren-waterfall-guide.js';
import {HOME_ITEMS,HOME_CATEGORIES,defaultHomeBuilder,snapHome,validateHomePlacement,normalizeHomeBuilder,refundHome} from './warren-home-builder.js';
import {homeArt} from './warren-home-art.js';
import {applyHomeNativePathsToArrays,isHomeNativePath} from './warren-home-paths.js';
import {validateDefensePlacement,DEFENSE_FOOTPRINT} from './warren-defense-placement.js';
import {renderHomeBuilderHtml} from './warren-home-ui.js';
import {createHomeController} from './warren-home-controller.js';
import {HOME_PLOTS,HOME_SIDES,HOME_SIDE_NAMES,HOME_PLOT_COST,HOME_WALL_COST,fullyOwnedSide,homePerimeterBlueprint,homeWallLayoutId,homeOwnedCell,plotForCell,homeWallIntegrity,reconcileHomeWall,HOME_EXPANSION_STAGES,HOME_NORTH_FINAL,homeAtNorthernCliff} from './warren-home-land.js';
import {HOME_TERRAIN_BRUSHES,applyHomeTerrainBrush,normalizeHomeTerrain,validateHomeTerrainBatch,quoteHomeTerrain,deriveHomeRivers,makeHomeWaterfall,applyHomeTerrainToArrays,applyHomeNorthernCliff,isNorthCliffCrest,migrateLegacyNorthCliffSources,deriveHomeNorthCurtains,quoteNewHomeNorthCurtains} from './warren-home-terrain.js';
import {BASE_CRIT_DAMAGE,rollWarrenCrit,rollMasteryProc,hitFeedback} from './warren-hit-feedback.js';

// ---------- rules ----------
const CLASSES = {
  guard: { name: 'ผู้พิทักษ์', icon: '🛡', fam: 'swordShield', cost: 30, hp: 170, atk: 9, range: 46, cd: .9, speed: 92, carry: 6, blurb: 'ถึก ยืนหน้า' },
  archer: { name: 'นักธนู', icon: '🏹', fam: 'bow', cost: 40, hp: 80, atk: 11, range: 200, cd: 1.1, speed: 100, carry: 5, blurb: 'ยิงไกล' },
  scout: { name: 'หน่วยเร็ว', icon: '🗡', fam: 'dagger', cost: 35, hp: 90, atk: 6, range: 42, cd: .5, speed: 145, carry: 14, blurb: 'แบกของเยอะ วิ่งไว' },
  brute: { name: 'นักทุบ', icon: '🔨', fam: 'hammer', cost: 70, hp: 180, atk: 20, range: 50, cd: 1.5, speed: 82, carry: 8, splash: 70, blurb: 'ตีหมู่' },
  axe: { name: 'นักขวาน', icon: '🪓', fam: 'axe', cost: 75, hp: 150, atk: 24, range: 52, cd: 1.5, speed: 84, carry: 8, splash: 50, blurb: 'ตีเกราะแตก' },
  vanguard: { name: 'ดาบใหญ่', icon: '⚔️', fam: 'greatsword', cost: 80, hp: 160, atk: 24, range: 65, cd: 1.45, speed: 84, carry: 7, splash: 65, blurb: 'กวาดศัตรู' },
  mage: { name: 'นักเวท', icon: '🔮', fam: 'staff', cost: 90, hp: 88, atk: 17, range: 205, cd: 1.55, speed: 96, carry: 5, splash: 70, blurb: 'เวทวงกว้าง' },
};
const DAY_S = 80, NIGHT_S = 55, WAVES_PER_LEVEL = 5;
const BURROW_MAX = 500, REPAIR_HP = 60, REPAIR_COST = 12;
// warren level gates: hall HP, squad size, tower count; upgrading needs the level's boss beaten
const LOSS = { hallLeft: .2 }; // after a lost night: Hall remains at 20% HP; banked Gold is preserved
const hallMax = () => BURROW_MAX + (S.warren - 1) * 80 + fortificationHpBonus(S.fortification);
const squadMax = () => fieldSquadCap(S.warren);
const towerMax = () => Math.min(TOWER.max, 2 + S.warren);
const warrenCost = () => warrenConstructionCost(S.warren);
const reinforceCost = () => fortificationCost(S.fortification,S.warren);
// Base monster HP/ATK doubles only when the Warren enters its next 5-level
// region. The existing separate night-wave multiplier still controls each wave.
const levelPower = () => warrenStageDifficulty(S.warren);
// Phase 2: ★ class upgrades are replaced with persistent bunny levels and shared class-build gear.
const HALL = { dmg: 9, cd: 1, range: 300 };
// archer towers: built with gold + materials around the warren; raiders knock them down on the way in
const TOWER = { gold: 70, mats: 8, hp: 270, cd: 1.1, range: 305, max: 6, upgrade: [0,120,320,720,1450], hire: {archer:90,mage:135} };
const TOWER_HP=[270,410,590,820,1120];
const TOWER_RANGE=[305,330,360,395,435],TOWER_HEIGHT=[62,68,75,83,92];
const RESOURCE_POS={x:16.2*64,y:17.4*64},FORGE_POS={x:23.8*64,y:17.2*64},SELL_POS={x:23.2*64,y:23.4*64},CART_POS={x:24.8*64,y:20.8*64};
const T = 64, CENTER = { x: 20 * T, y: 20 * T }, BASE_R = 190;
// All healthy bunnies hunt autonomously across the surrounding forest.
// defenders stand on a ring around the hall, one sector each: melee outside, ranged inside
const RING = { melee: 235, ranged: 175, zone: 250 };

// ---------- map: a clearing with the warren in the middle, forest all around ----------
function buildMap(biome='forest',home=initialHomeBuilder) {
  const n = 160, map = emptyMap('warren', biome);
  const level = new Uint8Array(n * n), road = new Uint8Array(n * n), forest = new Uint8Array(n * n), water = new Uint8Array(n * n);
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = i - 80, dy = j - 80, d = Math.hypot(dx, dy), k = j * n + i;
    const wob = Math.sin(Math.atan2(dy, dx) * 5) * 4 + Math.sin(Math.atan2(dy, dx) * 11 + 1) * 2;
    forest[k] = d > 66 + wob ? 4 : d > 56 + wob ? 3 : d > 30 && rnd() < .004 ? 2 : 1;
    // Keep terrain hazards beyond the maximum automatic 19×19 fence footprint.
    if (Math.hypot(i - 133, j - 36) < 12 + wob * .4) level[k] = 1;
    if (Math.hypot(i - 35, j - 130) < 8 + wob * .3) water[k] = 1;
  }
  // four dirt trails from the warren to the forest edge: the night waves come in along them
  for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let t = 10; t < 76; t++) {
    const cx = 80 + ax * t + Math.round(Math.sin(t * .15) * 3) * ay, cy = 80 + ay * t + Math.round(Math.sin(t * .15) * 3) * ax;
    for (let b = -2; b <= 2; b++) { const i = cx + (ay ? b : 0), j = cy + (ax ? b : 0); if (i >= 0 && j >= 0 && i < n && j < n) { road[j * n + i] = 2; forest[j * n + i] = t > 56 ? 2 : 1; } }
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (Math.hypot(i - 80, j - 80) < 9) road[j * n + i] = 1; // cobbled yard
  applyHomeTerrainToArrays({level,road,forest,water},home.terrainEdits,n);
  applyHomeNativePathsToArrays({road,water},home.placedObjects,n);
  applyHomeNorthernCliff({level,road,forest,water},home,n);
  const enc = a => Array.from(a, v => String.fromCharCode(48 + v)).join('');
  Object.assign(map, { level: enc(level), road: enc(road), forest: enc(forest), water: enc(water), northCliffFixed:true, spawn: { x: 20, y: 22 } });
  const o = (type, x, y, extra = {}) => map.objects.push({ type, x, y, ...extra });
  o('house', 20, 20, { roof: 'green', floors: 2, ridge: 'x' }); // the burrow hall
  o('house', 16.2, 17.4, { roof: 'red', floors: 1, ridge: 'y' }); o('house', 23.8, 17.2, { roof: 'orange', floors: 1, ridge: 'y' });
  o('well', 17.2, 22.6); o('stall', 23.2, 23.4); o('hay', 15.6, 21); o('cart', 24.8, 20.8); o('signpost', 21.6, 24.6);
  for (const [x, y] of [[18, 18], [22, 18], [18, 22.4], [22.4, 22.4], [20, 25], [25, 20], [15, 20], [20, 15]]) o('lantern', x, y);
  // No starter fences: the player constructs an entire perimeter with one button.
  for (const [x, y] of [[28, 12], [31, 26], [11, 29], [9, 12], [27, 33], [33, 17]]) o(biome==='desert'?'cactus':'mushroom', x, y);
  for (const [x, y] of [[26.5, 27], [12, 25], [14, 11], [29, 21], [23, 31]]) o('stump', x, y);
  for (const [x, y] of [[17, 27], [27, 14], [12, 18], [21, 11], [31, 30], [8, 22]]) o('flowers', x, y);
  return map;
}

// ---------- boot ----------
const canvas = document.getElementById('scene'),worldLabels=document.getElementById('worldLabels');
// Load the Warren's biome before starting the engine; a region transition rebuilds only the rendered scene.
const initialWarren=(()=>{for(const key of [SAVE_KEY,PRIOR_SAVE_KEY,LEGACY_SAVE_KEY]){
 try{const raw=JSON.parse(localStorage.getItem(key)||'null');if(raw?.warren)return Math.max(1,Math.floor(raw.warren));}catch{}
}return 1;})();
const initialHomeBuilder=(()=>{
 for(const key of [SAVE_KEY,PRIOR_SAVE_KEY,LEGACY_SAVE_KEY])try{
  const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored){const home=normalizeHomeBuilder(stored.homeBuilder);home.terrainEdits=normalizeHomeTerrain(stored.homeBuilder?.terrainEdits,home);
   const prior=Array.isArray(stored.homeBuilder?.waterfalls)?stored.homeBuilder.waterfalls:[];
   migrateLegacyNorthCliffSources(home,prior);
   for(const w of prior){
    if(w?.type==='north-curtain'||w?.sourceTile?.j===2)continue;
    const result=makeHomeWaterfall(home,w.sourceTile,home.terrainEdits);
    if(result.ok)home.waterfalls.push(result.waterfall);
   }
   home.waterfalls.push(...deriveHomeNorthCurtains(home,home.terrainEdits));
   return home;}
 }catch{}return defaultHomeBuilder();
})();
const currentStage=stageForWarren(initialWarren);
const scene = sceneFromMap(buildMap(currentStage.biome));
const roster = getRoster(currentStage.roster,currentStage.mapId);
const nextStage=frontierStage(initialWarren),frontierRoster=nextStage?getRoster(nextStage.roster,nextStage.mapId):null;
const hero = await loadBlessedHero();
await combatFX.init({ biome: currentStage.biome, mapId: currentStage.mapId });

const loadImage = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const mirrorCache = new Map();
const mirrored = img => { let c = mirrorCache.get(img); if (!c) { c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.translate(img.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0); mirrorCache.set(img, c); } return c; };
async function loadWukongFrames(){
 const sheets=await Promise.all([loadImage(wukongWalkSheet),loadImage(wukongHitSheet)]);
 return sheets.map(sheet=>Array.from({length:4},(_,frame)=>{const cell=sheet.width/4,c=document.createElement('canvas');c.width=cell;c.height=sheet.height;c.getContext('2d').drawImage(sheet,frame*cell,0,cell,sheet.height,0,0,cell,sheet.height);return c;}));
}
const [wukongWalkFrames,wukongHitFrames]=await loadWukongFrames();
async function loadGridFrames(src,columns,rows,scale=1){const sheet=await loadImage(src),cellW=sheet.width/columns,cellH=sheet.height/rows,outW=Math.round(cellW*scale),outH=Math.round(cellH*scale);return Array.from({length:columns*rows},(_,frame)=>{const c=document.createElement('canvas'),sx=frame%columns*cellW,sy=Math.floor(frame/columns)*cellH;c.width=outW;c.height=outH;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(sheet,sx,sy,cellW,cellH,0,0,outW,outH);return c;});}
const wukongCombinedStrikeFrames=await loadGridFrames(wukongCombinedStrikeSheet,6,4,.5),wukongCombinedStrikeFramesLeft=wukongCombinedStrikeFrames.map(mirrored);
const arthurWalkFrames=await loadGridFrames(arthurWalkSheet,6,1),arthurAttackFrames=await loadGridFrames(arthurAttackSheet,4,1);
const arthurGoldenWave=await loadImage(arthurGoldenWaveUrl);
const wukongStaffSource=await loadImage(wukongStaffUrl),wukongStaffSprite=document.createElement('canvas');
wukongStaffSprite.width=360;wukongStaffSprite.height=360;
{const g=wukongStaffSprite.getContext('2d');g.fillStyle='rgba(12,9,5,.56)';g.beginPath();g.ellipse(180,330,31,9,0,0,Math.PI*2);g.fill();g.fillStyle='#62503a';for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r=17+i%2*8;g.fillRect(176+Math.cos(a)*r,326+Math.sin(a)*r*.35,7,5);}g.translate(180,330);g.rotate(78*Math.PI/180);g.scale(.12,.12);g.drawImage(wukongStaffSource,-wukongStaffSource.width*.94,-wukongStaffSource.height/2);}

const monsterArt = new Map();
async function artFor(id,source=roster) {
  if (monsterArt.has(id)) return monsterArt.get(id);
  const p = monsterPresentation(source, id); if (!p) return null;
  p.frames = await Promise.all(Array.from({ length: p.count }, (_, i) => loadImage(p.frameSrc(i))));
  p.framesLeft = p.frames.map(mirrored);
  monsterArt.set(id, p); return p;
}
const normals = roster.pool.filter(id => { const p = monsterPresentation(roster, id); return p && !p.elite && !p.isBoss; });
const elites = roster.pool.filter(id => monsterPresentation(roster, id)?.elite);
const bossId = roster.bossType;
const frontierNormals=frontierRoster?.pool.filter(id=>{const p=monsterPresentation(frontierRoster,id);return p&&!p.elite&&!p.isBoss;})||[];
const frontierElites=frontierRoster?.pool.filter(id=>monsterPresentation(frontierRoster,id)?.elite)||[];
await Promise.all([...normals, ...elites, bossId].filter(Boolean).map(id=>artFor(id,roster)));

// ---------- state ----------
const S = {
  gold: 20, inventory: {}, gear: [], nextGearId: 0, builds: defaultBuilds(), progress:defaultProgress(), mastery:defaultMastery(), classSkills:defaultClassSkills(),coreClass:'guard',reserve:[],forgeLevel:1,resourceLevel:1,resourceGoldBank:0,resourceMatBank:0,dayHealDay:0,nightHealDay:0,sellReserve:300,sellSelected:Object.keys(NPC_COMMON_PRICES),sellConfirm:false,forgeClass: 'guard', modal: null, waterfallGuideSource:null, selectedTower:-1,selectedMagicCart:-1, heroUnitId: null, heroPortrait: hero.animations.idle.south.frames[0]?.src ?? null,
  inventoryFilter: 'All', itemDetailId: null, itemProtect:false, itemTargetClass:'guard', forgeBuildByClass: {},
  armorySlot:'weapon',armoryTab:'craft',armoryRecipe:null,armoryInventoryRarity:'all',armoryNotice:'',refineFeedback:null,
  autoDismantle:defaultAutoDismantleSettings(),armoryInventorySelection:[],batchReport:null,batchExpanded:false,armoryPreserveCraftPosition:false,
  burrow: BURROW_MAX, day: 1, night: false, clock: 0, speed: 1, over: null, batchResults:[],batchFilter:'all',batchSelection:[],batchRecs:[],batchQty:1,batchClass:'guard',batchConfirm:false,
  warren: 1, fortification:0, wave: 1, cleared: false, losses: 0, lureDay:0, // warren level is boss-gated; material-funded fortification is available from day one
  units: [], monsters: [], towers: [],magicCarts:[], movingTower:-1,movingMagicCart:-1, fences: [], gateClosed:[], wallLevel:0, wallPreview:false, building:false,
  homeBuilder:defaultHomeBuilder(),mythic:defaultMythic(),archiveTab:'first',archiveBossId:null,homeOpen:false,homeGroundBusy:false,homeCategory:'paths',homeSelected:'dirtPath',homeRotation:0,homeAction:'place',homeMovingId:null,homeHover:null,homeUndo:null,homeWallPreview:null,homeWallPreviewData:null,homeTerrainBrush:'grass',homeTerrainDraft:null,homeTerrainNotice:'',homeVariant:0,homeLandOpen:false,homeTerrainOpen:false,homeStoredId:null,homePane:'decor',homeHelp:false,homeSelectedId:null,
  queue: [], waveTimer: 0, kills: 0, time: 0, events: [],
};
const later = (sec, fn) => S.events.push({ at: S.time + sec, fn }); // game-clock timer (respects speed/pause)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const standable = (x, y) => { const z = runtimeWalkHeight(x, y); return z !== null && canRuntimeActorStand(x, y, z); };
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const facingTo = (dx, dy) => { const vx = (dx - dy) / 2, vy = (dx + dy) / 4; return DIRS[Math.round(((Math.atan2(vx, -vy) * 180 / Math.PI + 360) % 360) / 45) % 8]; };
const screenLeft = (dx, dy) => dx - dy < 0;

// One capped A* plan per simulation step: an entire night wave must not
// exhaust the browser's main thread trying to route through closed stone walls.
let pathSearchBudget = 1;
let insideSimulation = false, uiDirty = false, lastUiPaint = 0;
const BURROW_PATH_EXPANSIONS = 1200;
function moveToward(e, tx, ty, speed, dt, stop = 0) {
  const dGoal = Math.hypot(tx - e.x, ty - e.y);
  if (dGoal <= stop + .5) { e.moving = false; e.path = null; return true; }
  // straight when the way is clear, otherwise the engine's A* (fences, houses, cliffs); replan now and then
  e.replan = (e.replan ?? 0) - dt;
  const changedGoal=!e.goalP||Math.hypot(e.goalP.x-tx,e.goalP.y-ty)>48;
  // A new nighttime threat overrides yesterday's farm route immediately; do not wait
  // for an existing A* replanning cooldown while a tower is being attacked.
  if (changedGoal || (e.replan <= 0 && ((e.stuck ?? 0) > .25 || !e.path))) {
    if (pathSearchBudget > 0) {
      pathSearchBudget--;
      e.replan = .7 + Math.random() * .5; e.goalP = { x: tx, y: ty };
      if (canWalkStraight(e.x, e.y, tx, ty)) e.path = null;
      else {
        const r = findPath(e.x, e.y, tx, ty, { reach: stop, maxExpansions: BURROW_PATH_EXPANSIONS, skipStraightCheck: true });
        e.path = r?.path?.length ? r.path.slice() : null;
      }
    } else {
      // Keep an existing route, or steer locally while waiting for a plan.
      // A rejected plan must remain eligible next frame, not wait a full second.
      e.replan = Math.min(e.replan, 0);
    }
  }
  let wx = tx, wy = ty;
  if (e.path) { while (e.path.length && Math.hypot(e.path[0].x - e.x, e.path[0].y - e.y) < 14) e.path.shift(); if (e.path.length) { wx = e.path[0].x; wy = e.path[0].y; } else e.path = null; }
  const dx = wx - e.x, dy = wy - e.y, d = Math.hypot(dx, dy) || 1, step = Math.min(e.path ? d : dGoal - stop, speed * dt);
  const ox = e.x, oy = e.y, z = runtimeWalkHeight(e.x, e.y) ?? 0, nx = e.x + dx / d * step, ny = e.y + dy / d * step;
  const ok = (x, y) => { const h = runtimeWalkHeight(x, y); return h !== null && Math.abs(h - z) < 14 && canRuntimeActorStand(x, y, h); };
  // straight, else slide along the obstacle (keep the side that worked), else a random nudge when pinned
  const sd = e.side ?? 1, px = -dy / d * sd, py = dx / d * sd;
  const tries = [[nx, ny], [e.x + (dx / d * .5 + px) * step, e.y + (dy / d * .5 + py) * step], [e.x + px * step, e.y + py * step]];
  if ((e.stuck ?? 0) > .8) { const a = Math.random() * Math.PI * 2; tries.push([e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14]); }
  let moved = false;
  for (const [x, y] of tries) if (ok(x, y)) { e.x = x; e.y = y; moved = true; break; }
  if (!moved) e.side = -sd;
  resolveRuntimeActor(e);
  e.stuck = Math.hypot(e.x - ox, e.y - oy) < step * .3 ? (e.stuck ?? 0) + dt : 0;
  e.moving = true; e.dir = facingTo(dx, dy);
  return false;
}
function separate(list, r) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (a.down || b.down || a.dead || b.dead) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= r || d < .01) continue;
    const push = (r - d) / 2 / d; a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
  }
}

// Separation can push a rabbit into the inside corner formed by two wall colliders.
// Recover to the last clear point (or a nearby clear point) rather than walking in place forever.
function keepActorsOutOfWalls(list,dt=1){
 for(const e of list){
  if(e.down||e.dead)continue;
  resolveRuntimeActor(e);
  if(canWalkStraight(e.x,e.y,e.x,e.y)){e.wallSafeX=e.x;e.wallSafeY=e.y;e.wallPinnedFor=0;continue;}
  e.wallPinnedFor=(e.wallPinnedFor||0)+dt;if(e.wallPinnedFor<.35)continue;
  const candidates=[];
  if(Number.isFinite(e.wallSafeX)&&Number.isFinite(e.wallSafeY))candidates.push([e.wallSafeX,e.wallSafeY]);
  for(const radius of [20,32,48])for(let i=0;i<8;i++){const a=i*Math.PI/4;candidates.push([e.x+Math.cos(a)*radius,e.y+Math.sin(a)*radius]);}
  const spot=candidates.find(([x,y])=>standable(x,y)&&canWalkStraight(x,y,x,y));
  if(spot){[e.x,e.y]=spot;e.path=null;e.replan=0;e.stuck=0;e.wallSafeX=e.x;e.wallSafeY=e.y;}
  e.wallPinnedFor=0;
 }
}

const matCount = () => constructionMaterialCount(S.inventory);
function spendMats(n) { return spendConstructionMaterials(S.inventory, n); }
function spendMatsWithReceipt(n){
 const before=Object.fromEntries(CONSTRUCTION_MATERIAL_IDS.map(id=>[id,S.inventory[id]||0]));
 if(!spendMats(n))return null;
 return Object.fromEntries(CONSTRUCTION_MATERIAL_IDS.map(id=>[id,before[id]-(S.inventory[id]||0)]).filter(([,qty])=>qty>0));
}

// ---------- archer towers ----------
let towerArt = null; // Lv1 placement preview; level-specific art is cached below.
const towerArtByLevel=new Map();
function towerArtFor(level=1){level=Math.max(1,Math.min(5,level));if(!towerArtByLevel.has(level))towerArtByLevel.set(level,towerSprite(28,TOWER_HEIGHT[level-1],PAL.RED));return towerArtByLevel.get(level);}
let magicCartArt = null;
const defenseStructures=()=>[...S.towers,...S.magicCarts];
// Village perimeter lives in warren-perimeter-controller.js.
const perimeterController=createPerimeterController({S,T,toast,save,renderUi,matCount,spendMats,keepActorsOutOfWalls,skillFx:()=>skillFx,floaters:()=>floaters});
const {installFence,rebuildPerimeter,syncGateRuntime,selectGate,upgradePerimeter,hurtPerimeter}=perimeterController;
function placeTower(x, y) {
  if(S.night)return false;
  if (S.towers.length >= towerMax()) return toast(`บ้าน Lv ${S.warren} สร้างได้ ${towerMax()} ป้อม · อัปบ้านเพื่อสร้างเพิ่ม`);
  if (S.gold < TOWER.gold || matCount() < TOWER.mats) return toast(`ต้องใช้ ${TOWER.gold}G + ของ ${TOWER.mats} ชิ้น`);
  const spot=defenseSpot(x,y,'tower');
  if(!spot.ok)return toast(spot.reason),false;
  S.gold -= TOWER.gold; spendMats(TOWER.mats);
  createTower(x, y);
  skillFx?.pillar(x, y, { color: '#ffe27a' }); skillFx?.burst(x, y, { color: '#d9c7a8', count: 20, up: 60 }); combatSFX.playLevelUp({ volume: .35 });
  S.building = false;save();toast('สร้างป้อมธนูแล้ว!'); renderUi();
}
function defenseSpot(x,y,kind='tower',index=-1){
 const defenses=[...S.towers.filter((_,i)=>kind!=='tower'||i!==index).map(t=>({x:t.x,y:t.y,kind:'tower'})),
  ...S.magicCarts.filter((_,i)=>kind!=='magicCart'||i!==index).map(t=>({x:t.x,y:t.y,kind:'magicCart'}))];
 const decorations=S.homeBuilder.placedObjects.map(o=>({...o,radius:HOME_ITEMS[o.prefab]?.radius??0}));
 return validateDefensePlacement({x,y,kind,home:S.homeBuilder,walls:S.fences,defenses,
  colliders:WS.colliders,objects:WS.objects,decorations,
  occupants:[...S.units.filter(u=>!u.down).map(u=>({x:u.x,y:u.y,r:12})),
   ...S.monsters.filter(m=>!m.dead).map(m=>({x:m.x,y:m.y,r:14}))],canStand:standable});
}
function canTowerSpot(x,y,index=-1){return defenseSpot(x,y,'tower',index).ok;}

function createMagicCart(x,y,hp=MAGIC_CART_COST.hp,garrison=null,level=1){
 magicCartArt??=magicCartSprite();
 level=Math.max(1,Math.min(5,Math.floor(level)||1));const maxHp=MAGIC_CART_HP[level-1];
 const cart={x,y,level,hp:Math.max(0,Math.min(maxHp,hp)),maxHp,
  garrison:garrison?{...garrison,cls:'mage',isGarrison:true}:null,cd:0};
 cart.actor={kind:'actor',x:x-8,y:y-8,z:0,r:4,shadow:false,ox:magicCartArt.ox,oy:magicCartArt.oy,getImage:()=>magicCartArt.img,get dead(){return false;},
  drawOverlay(g,{x:sx,y:sy}){const w=46,q=cart.hp/cart.maxHp;g.fillStyle='rgba(10,12,12,.85)';g.fillRect(sx-w/2,sy-88,w,5);
   g.fillStyle=q>.5?'#7ee38a':q>.25?'#ffc94a':'#ff5a4a';g.fillRect(sx-w/2+1,sy-87,(w-2)*q,3);
   g.font='12px system-ui';g.textAlign='center';g.fillStyle='#ead7ff';g.fillText(cart.hp<=0?'⚒ ซ่อม':cart.garrison?'🔮 Lv'+cart.garrison.level:'＋',sx,sy-94);}};
 S.magicCarts.push(cart);return cart;
}
function placeMagicCart(x,y){
 const cap=magicCartCap(S.warren);
 if(S.night||S.warren<15)return false;
 if(S.magicCarts.length>=cap)return toast(`บ้าน Lv ${S.warren} สร้างรถยิงเวทย์ได้ ${cap} คัน`),false;
 if(S.gold<MAGIC_CART_COST.gold||matCount()<MAGIC_CART_COST.materials)return toast(`ต้องใช้ ${MAGIC_CART_COST.gold}G + ของ ${MAGIC_CART_COST.materials} ชิ้น`),false;
 const spot=defenseSpot(x,y,'magicCart');
 if(!spot.ok)return toast(spot.reason),false;
 S.gold-=MAGIC_CART_COST.gold;spendMats(MAGIC_CART_COST.materials);createMagicCart(x,y);
 S.building=false;skillFx?.pillar(x,y,{color:'#c999ff'});combatSFX.playLevelUp?.({volume:.4});save();renderUi();toast('สร้างรถยิงเวทย์แล้ว · คลิกรถเพื่อจ้างนักเวท');return true;
}
function hireMagicCartMage(cart){
 if(S.night||!cart||cart.hp<=0||cart.garrison||S.gold<MAGIC_CART_COST.mageHire)return false;
 S.gold-=MAGIC_CART_COST.mageHire;cart.garrison={cls:'mage',isGarrison:true,name:bunnyName(),level:1,exp:0};
 skillFx?.pillar(cart.x,cart.y,{color:'#bc95ff'});save();renderUi();return true;
}
function upgradeMagicCart(cart){
 if(S.night||!cart||cart.level>=5||S.gold<MAGIC_CART_UPGRADE[cart.level])return false;
 S.gold-=MAGIC_CART_UPGRADE[cart.level];const before=cart.maxHp;
 cart.level++;cart.maxHp=MAGIC_CART_HP[cart.level-1];cart.hp=Math.min(cart.maxHp,cart.hp+cart.maxHp-before);
 skillFx?.pillar(cart.x,cart.y,{color:'#c999ff'});save();renderUi();return true;
}
function canMagicCartSpot(x,y,index=-1){return defenseSpot(x,y,'magicCart',index).ok;}
function relocateMagicCart(index,x,y){
 const cart=S.magicCarts[index];if(S.night||!cart||!canMagicCartSpot(x,y,index))return false;
 cart.x=x;cart.y=y;cart.actor.x=x-8;cart.actor.y=y-8;S.movingMagicCart=-1;S.towerMoveHover=null;
 skillFx?.pillar(x,y,{color:'#c999ff'});save();renderUi();toast('ย้ายรถยิงเวทย์สำเร็จ · ระดับ HP และนักเวทยังอยู่');return true;
}
function beginMagicCartMove(){
 if(S.night||S.selectedMagicCart<0||!S.magicCarts[S.selectedMagicCart])return false;
 S.movingMagicCart=S.selectedMagicCart;S.movingTower=-1;S.building=false;S.modal=null;renderUi();
 toast('เลือกพื้นว่างภายในแนวกำแพง · ห้ามทับวัตถุหรือประตู · Esc ยกเลิก');return true;
}
function updateMagicCarts(dt){
 for(const cart of S.magicCarts){
  if(!cart.garrison||cart.hp<=0)continue;
  const g=cart.garrison,c=CLASSES.mage,st=statsOf('mage',g.level);Object.assign(g,{x:cart.x,y:cart.y,...st});g.hp=Math.min(g.maxHp,g.hp??g.maxHp);
  cart.cd-=dt;if(cart.cd>0)continue;const target=nearestMonster(cart,MAGIC_CART_RANGE[cart.level-1]);if(!target)continue;
  cart.cd=MAGIC_CART_COST.cooldown;const gear=buildCombatBonus(S,'mage',null,g.level),damage=Math.max(1,Math.round((c.atk+(g.level-1)*.9+gear.atk)*1.35));
  skillFx?.play('arcBolt',{from:{x:cart.x,y:cart.y},to:{x:target.x,y:target.y}});
  later(.28,()=>{if(target.dead||cart.hp<=0)return;skillFx?.burst(target.x,target.y,{color:'#b67cff',count:15,up:48});
   for(const m of S.monsters.filter(m=>!m.dead&&dist(m,target)<=MAGIC_CART_COST.splash)){
    m.hp-=damage;floaters?.text(m.x,m.y,damage,{color:'#d4b0ff',size:13});combatFX.playHitSpark(m.x,m.y,{visualScale:m.actor.visualScale});
    if(m.hp<=0)killMonster(m,g);
   }
   if(!target.dead)castMasteryOnBasicHit(g,target);
  });
 }
}
function relocateTower(index,x,y){
 const t=S.towers[index];if(S.night||!t||!Number.isFinite(x)||!Number.isFinite(y))return false;
 const spot=defenseSpot(x,y,'tower',index);
 if(!spot.ok)return toast(spot.reason),false;
 t.x=x;t.y=y;t.actor.x=x-14;t.actor.y=y-14;t.actor.z=runtimeWalkHeight(x,y)??0;t.cd=0;
 S.movingTower=-1;S.towerMoveHover=null;
 skillFx?.pillar(x,y,{color:'#ffe2a2'});
 save();renderUi();toast('ย้ายป้อมสำเร็จ · ระดับ HP และทหารประจำป้อมยังอยู่');return true;
}
function beginTowerMove(){
 if(S.night||S.selectedTower<0||!S.towers[S.selectedTower])return false;
 S.movingTower=S.selectedTower;S.movingMagicCart=-1;S.building=false;S.modal=null;renderUi();
 toast('เลือกพื้นว่างภายในแนวกำแพง · ห้ามทับวัตถุหรือประตู · Esc ยกเลิก');return true;
}
function upgradeForgeBuilding(){
 const cost=FORGE_COST[S.forgeLevel];if(S.night||!cost||S.forgeLevel>=buildingLevelCap(S.warren)||S.gold<cost)return false;
 S.gold-=cost;S.forgeLevel++;save();renderUi();toast('โรงตีเหล็ก Lv '+S.forgeLevel+' · โอกาส Rarity สูงเพิ่มขึ้น');return true;
}
function upgradeResourceBuilding(){
 const cost=RESOURCE_COST[S.resourceLevel];if(S.night||!cost||S.resourceLevel>=buildingLevelCap(S.warren)||S.gold<cost)return false;
 S.gold-=cost;S.resourceLevel++;save();renderUi();toast('โรงผลิตทรัพยากร Lv '+S.resourceLevel+' · ผลิต Gold และวัตถุดิบต่อวินาทีมากขึ้น');return true;
}
function useHallHeal(){
 const result=castWarrenHeal(S,hallMax());if(!result){toast('ใช้ Heal ในช่วงนี้ไปแล้ว · ใช้ได้ครั้งละ 1 ครั้งกลางวันและกลางคืน');return false;}
 for(const {unit,amount} of result.healed){floaters?.text(unit.x,unit.y,'+'+amount,{color:'#84efa9',size:14,lift:45});skillFx?.burst(unit.x,unit.y,{color:'#80eea3',count:8,up:35});}
 skillFx?.pillar(CENTER.x,CENTER.y,{color:'#89f2a5'});
 save();renderUi();toast('Heal ทั้งกองทัพ +'+result.amount+' HP · รักษา '+result.healed.length+' ตัว');return true;
}
function createTower(x, y, hp = TOWER.hp, level=1, garrison=null) {
  const lv=Math.max(1,Math.min(5,level)),maxHp=TOWER_HP[lv-1];
  const art=towerArtFor(lv);towerArt??=towerArtFor(1);
  const t={x,y,hp:Math.min(maxHp,Math.max(0,hp)),maxHp,level:lv,garrison:garrison?{...garrison,isGarrison:true}:null,cd:0};
  t.actor = {
    kind: 'actor', x: x - 14, y: y - 14, z: 0, r: 4, shadow: false, ox: art.ox, oy: art.oy, getImage: () => towerArtFor(t.level).img,
    get dead() { return false; },
    drawOverlay(g, { x: sx, y: sy }) { const w=46,q=t.hp/t.maxHp;
      g.fillStyle='rgba(10,12,12,.85)';g.fillRect(sx-w/2,sy-118,w,5);
      g.fillStyle=q>.5?'#7ee38a':q>.25?'#ffc94a':'#ff5a4a';g.fillRect(sx-w/2+1,sy-117,(w-2)*q,3);
      g.font='12px system-ui';g.textAlign='center';g.fillStyle='#fff3d1';g.fillText(t.hp<=0?'⚒ ซ่อม':t.garrison?CLASSES[t.garrison.cls].icon+' Lv'+t.garrison.level:'＋',sx,sy-124);
    },
  };
  S.towers.push(t); return t;
}
function updateTowers(dt) {
  for(const t of S.towers){
    if(!t.garrison||t.hp<=0)continue;
    const g=t.garrison,c=CLASSES[g.cls];
    const st=statsOf(g.cls,g.level);
    Object.assign(g,{x:t.x,y:t.y,...st});g.hp=Math.min(g.maxHp,g.hp??g.maxHp);
    regenBurrowSp(g,dt);
    t.cd-=dt;if(t.cd>0)continue;
    const m=nearestMonster(t,TOWER_RANGE[t.level-1]);if(!m)continue;
    // Defensive structures use Class Armory + Weapon Mastery only. Skill Cores are field-rabbit abilities.
    t.cd=c.cd*((g.coreValkyrieUntil||0)>S.time?.8:1);
    const gear=buildCombatBonus(S,t.garrison.cls,null,t.garrison.level);
    const damage=Math.max(1,Math.round((c.atk+(t.garrison.level-1)*.9+gear.atk)*((g.coreValkyrieUntil||0)>S.time?1.15:1)));
    skillFx?.play(t.garrison.cls==='mage'?'arcBolt':'shotArrow',{from:{x:t.x,y:t.y},to:{x:m.x,y:m.y}});
    later(.22,()=>{if(m.dead||t.hp<=0)return;m.hp-=damage;floaters?.text(m.x,m.y,damage,{color:t.garrison.cls==='mage'?'#ccacff':'#bfe3ff',size:13});
      combatFX.playHitSpark(m.x,m.y,{visualScale:m.actor.visualScale});
      if(m.hp<=0)killMonster(m,t.garrison);
      else castMasteryOnBasicHit(g,m);
    });
  }
}
function hurtTower(t, dmg) {
  if (t.hp <= 0) return;
  t.hp -= dmg; floaters?.text(t.x, t.y, `-${Math.round(dmg)}`, { color: '#ff9a4a', size: 13, lift: 90 });
  if(t.hp<=0){t.hp=0;combatFX.playBossDeath(t.x,t.y,{visualScale:1});combatSFX.playDeath({volume:.6});toast('สิ่งก่อสร้างป้องกันพัง! ต้องซ่อมตอนกลางวัน');renderUi();}
}

function hireGarrison(t,cls){
 if(S.night||!t||t.hp<=0||t.garrison||!['archer','mage'].includes(cls)||S.gold<TOWER.hire[cls])return false;
 S.gold-=TOWER.hire[cls];
 t.garrison={cls,isGarrison:true,name:bunnyName(),level:1,exp:0};
 skillFx?.pillar(t.x,t.y,{color:cls==='mage'?'#bc95ff':'#e5c475'});save();renderUi();return true;
}
function upgradeTower(t){
 if(S.night||!t||t.level>=5||S.gold<TOWER.upgrade[t.level])return false;
 S.gold-=TOWER.upgrade[t.level];const before=t.maxHp;
 t.level++;t.maxHp=TOWER_HP[t.level-1];t.hp=Math.min(t.maxHp,t.hp+t.maxHp-before);
 const art=towerArtFor(t.level);t.actor.ox=art.ox;t.actor.oy=art.oy;
 skillFx?.pillar(t.x,t.y,{color:'#eacc7c'});save();renderUi();return true;
}
// ---------- bunnies ----------
let unitSeq = 0;
function statsOf(cls,level=1,buildId=cls+'-1') {
  const c=CLASSES[cls], gear=buildCombatBonus(S,cls,buildId,level);
  return {maxHp:Math.round((c.hp+(level-1)*12+gear.maxHp)*mythicHpMultiplier(S.mythic)),atk:Math.round((c.atk+(level-1)*.9+gear.atk)*mythicAtkMultiplier(S.mythic)*10)/10,def:Math.round(gear.def),critBonus:gear.critBonus||0,luk:Math.floor(level/4)};
}
function refreshArmy() {
  for(const u of S.units){const oldMax=u.maxHp||1,oldHp=u.hp;Object.assign(u,statsOf(u.cls,u.level,u.buildId));u.hp=u.down?0:Math.min(u.maxHp,Math.max(1,Math.round(oldHp/oldMax*u.maxHp)));}
}
// each extra bunny of a class costs 20% more: a squad of one kind gets expensive
const priceOf = cls => Math.round(CLASSES[cls].cost * (1 + .2 * S.units.filter(u => u.cls === cls).length));
function recruit(cls, free = false, saved = null) {
  const c = CLASSES[cls], price = priceOf(cls);
  if(!c)return null;
  if(!free&&S.night)return null;
  if(!free&&S.units.filter(u=>u.cls===cls).length>=fieldClassCap(S.warren))return toast(`${c.name} มีครบ ${fieldClassCap(S.warren)} ตัวแล้ว · บ้าน Lv 15 ยกเลิกเพดานต่อคลาส (ทหารป้อมไม่นับ)`);
  if(!free&&S.units.length>=squadMax()){
    const next=FIELD_SQUAD_GATES.find(g=>g.level>S.warren);
    return toast(next?`ทีมเต็ม ${S.units.length}/${squadMax()} · อัป Warren Lv ${next.level} เพื่อเพิ่มโควตา`:`ทีมเต็ม ${squadMax()} ตัวแล้ว`);
  }
  if (!free && S.gold < price) return toast('เงินไม่พอ');
  if (!free) S.gold -= price;
  const a = (unitSeq * 2.4) % (Math.PI * 2),level=saved?.level||1,buildId=saved?.buildId||cls+'-1',st = statsOf(cls,level,buildId);
  const u = { id: ++unitSeq, cls, name:saved?.name||bunnyName(),level,exp:saved?.exp||0,buildId:cls+'-1', r: 12, x: CENTER.x + Math.cos(a) * 120, y: CENTER.y + 150 + Math.sin(a) * 40, hp: st.maxHp, ...st, stance:'farm', carry: { gold: 0, items: {} }, cd: 0, atkUntil: 0, dir: 'south', moving: false, down: false };
  S.units.push(u);
  skillFx?.pillar(u.x, u.y, { color: '#ffd6ec' }); combatSFX.playLevelUp?.({ volume: .3 });
  if(!free)save();
  renderUi(); return u;
}
const carried = u => u.carry.gold + Object.values(u.carry.items).reduce((a,b)=>a+b,0);
function deposit(u) {
  if (!carried(u)) return;
  S.gold += u.carry.gold; addInventory(S.inventory,u.carry.items);
  const count=Object.values(u.carry.items).reduce((a,b)=>a+b,0);
  floaters?.text(u.x, u.y, `+${u.carry.gold}G${count?` +${count} ของ`:''}`, { color: '#ffd45c', size: 14, lift: 60 });
  combatSFX.playPickup(); u.carry = { gold: 0, items: {} }; renderUi();
}
function heroImage(u) {
  const now = performance.now(), fam = CLASSES[u.cls].fam;
  let set, img;
  if (u.down) { set = hero.animations.death[u.dir]; img = set.frames[set.frames.length - 1]; }
  else if (now < u.atkUntil && hero.animations['atk_' + fam]) { set = hero.animations['atk_' + fam][u.dir]; const t = 1 - (u.atkUntil - now) / 375; img = set.frames[Math.min(set.frames.length - 1, Math.floor(t * set.frames.length))]; }
  else if (now < (u.hurtUntil ?? 0)) { set = hero.animations.hurt[u.dir]; img = set.frames[Math.floor((1 - (u.hurtUntil - now) / 360) * set.frames.length) % set.frames.length]; }
  else { set = hero.animations[u.moving ? 'run' : 'idle'][u.dir]; img = set.frames[Math.floor(now / (u.moving ? 80 : 140) + u.id * 3) % set.frames.length]; }
  return { img: set.flipX ? mirrored(img) : img, footY: set.footY };
}
function unitActor(u) {
  return {
    kind: 'actor', get x() { return u.x; }, get y() { return u.y; }, z: 0, r: 12, visualScale: 1,
    get dead() { return false; },
    getImage() { const v = heroImage(u); this.oy = v.footY; return v.img; },
    drawOverlay(g, { x, y }) {
      const w = 30, q = u.hp / u.maxHp;
      if (!u.down) { g.fillStyle = 'rgba(10,12,12,.8)'; g.fillRect(x - w / 2, y - 62, w, 4); g.fillStyle = '#7ee38a'; g.fillRect(x - w / 2 + 1, y - 61, (w - 2) * q, 2); }
      g.font = '11px system-ui'; g.textAlign = 'center'; g.fillStyle = u.down ? '#ff8a8a' : '#fff4cf';
      g.fillText(u.down ? '💤' : CLASSES[u.cls].icon + ' Lv'+u.level, x, y - 66);
      if(!u.down){g.font='9px system-ui';g.fillStyle='#fff4cf';g.fillText(u.name,x,y-77);}
      if (carried(u)) { g.fillStyle = '#ffd45c'; g.fillText('👜' + carried(u), x + 20, y - 40); }
    },
  };
}

// ---------- monsters ----------
let monSeq = 0;
let dragonTrial = null;
let showMythicRewardModal=()=>{};
let mythicPanel=null;
function beginMythicTrial(position,frames,bossId='ancientDragon'){
 const keys=['gold','inventory','progress','mastery','classSkills','kills','time','hallCd'];
 const state=Object.fromEntries(keys.map(k=>[k,structuredClone(S[k])]));
 const units=S.units.map(u=>({u,data:{...u,carry:structuredClone(u.carry)}}));
 const oldMonsters=S.monsters,oldEvents=S.events;
 const squad=validMythicSquad(S.units,S.mythic.selected),fighters=squad.length?squad:S.units.slice(0,7);
 const hp=Math.max(1000,S.warren*1000),atk=mythicBossAttack(S.warren),boss=MYTHIC_BOSSES[bossId]||MYTHIC_BOSSES.ancientDragon,isWukong=bossId==='sunWukong',isArthur=bossId==='kingArthur';
 const m={id:++monSeq,type:bossId+'Trial',bossId,boss:true,trial:true,night:false,elite:false,x:position.x,y:position.y,home:{...position},r:24,hp,maxHp:hp,atk,range:isWukong?72:isArthur?82:100,speed:isWukong?72:isArthur?62:55,cd:1,dead:false,left:false,p:{name:boss.name},specialCd:3,specialIndex:0};
 const spawn=fieldPoint();if(!standable(m.x,m.y)&&spawn){m.x=spawn.x;m.y=spawn.y;m.home={...spawn};}
 m.actor={kind:'actor',isBoss:true,get x(){return m.x+(m.lx||0)},get y(){return m.y+(m.ly||0)},z:0,r:24,visualScale:isWukong?.46:isArthur?.48:1.1,ox:isWukong?305:isArthur?224:192,oy:isWukong?425:isArthur?440:472,get dead(){return m.dead},getImage(){const attacking=(m.castUntil||0)>S.time||performance.now()-(m.lunge||0)<360;if(isArthur){const usingAttack=(m.skillAnimUntil||0)>S.time||attacking,age=Math.max(0,S.time-(m.skillAnimStart||S.time));if(usingAttack){const frame=Math.min(3,Math.floor(age*5));this.visualScale=.45;this.ox=264.5;this.oy=472;return frames.attack[frame]}const frame=Math.floor(performance.now()/125)%6;this.visualScale=.48;this.ox=224;this.oy=440;return frames.walk[frame]}if(!isWukong)return frames[(attacking?4:0)+Math.floor(performance.now()/140)%4];if((m.skillAnimUntil||0)>S.time){const frame=Math.min(23,Math.max(0,Math.floor((S.time-m.skillAnimStart)*30)));this.visualScale=1.1;this.ox=154.5;this.oy=257.5;return frames.combined[frame]}this.visualScale=.46;const frame=Math.floor(performance.now()/140)%4,thisFrames=attacking?frames.hit:frames.walk,anchors=attacking?[[300,864],[330,859],[280,875],[370,872]]:[[305,425],[325,420],[335,423],[330,417]];this.ox=anchors[frame][0];this.oy=anchors[frame][1];return thisFrames[frame]},drawOverlay(g,{x,y}){const barY=y-(isWukong?225:isArthur?215:400);g.fillStyle='#170909';g.fillRect(x-82,barY,164,10);g.fillStyle=isWukong?'#e6b62e':isArthur?'#e9cf68':'#f66a35';g.fillRect(x-81,barY+1,162*Math.max(0,m.hp/m.maxHp),8);g.fillStyle='#ffedb0';g.textAlign='center';g.font='bold 13px system-ui';g.fillText(boss.name.toUpperCase(),x,barY-8)}};
 const staffGround={x:CENTER.x+250,y:CENTER.y+250};
 const staffActor=isWukong?{kind:'actor',x:staffGround.x,y:staffGround.y,z:0,r:8,visualScale:1,ox:180,oy:330,img:wukongStaffSprite,get dead(){return m.dead||m.trialLost}}:null;
 const cloneActors=isWukong?WUKONG_CLONE_OFFSETS.map((offset,index)=>({kind:'actor',get x(){return m.x+offset.x},get y(){return m.y+offset.y},z:0,r:18,visualScale:1.04,ox:154.5,oy:257.5,get dead(){return m.dead||m.trialLost||S.time<(m.cloneStart||Infinity)||S.time>=(m.cloneUntil||0)},getImage(){const frame=Math.min(23,Math.max(0,Math.floor((S.time-m.cloneStart)*30)));return (index===1?frames.combinedLeft:frames.combined)[frame]}})):[];
 dragonTrial={m,bossId,staffActor,cloneActors,state,units,oldMonsters,oldEvents,fighterIds:new Set(fighters.map(u=>u.id)),resolved:false};S.monsters=[m];S.events=[];
 for(const u of S.units){u.mythicReserve=!dragonTrial.fighterIds.has(u.id);u.down=u.mythicReserve;u.hp=u.mythicReserve?0:u.maxHp;u.sp=u.maxSp;u.carry={gold:0,items:{}};u.cd=0;}
 return m;
}
function endDragonTrial(){
 if(!dragonTrial)return;const trial=dragonTrial,completed=trial.m.dead&&!trial.m.trialLost,defeated=!!trial.m.trialLost;dragonTrial=null;trial.m.dead=true;
 Object.assign(S,trial.state);S.monsters=trial.oldMonsters;S.events=trial.oldEvents;
 for(const {u,data} of trial.units){for(const key of Object.keys(u))if(!(key in data))delete u[key];Object.assign(u,data);}
 if(completed||defeated){const result=settleMythic(S.mythic,{won:completed,relicEnabled:true});S.mythic=result.state;S.inventory.optionStone=(S.inventory.optionStone||0)+result.reward.optionStone;S.inventory.reoptionStone=(S.inventory.reoptionStone||0)+result.reward.reoptionStone;refreshArmy();showMythicRewardModal(completed,result.reward,trial.bossId);}
 else toast('ถอนกำลังจาก Mythic Invasion · ไม่ได้รับรางวัล');
 save();renderUi();
}
const updateMythicSkills=createMythicSkills({S,CENTER,dist,later,hurtUnit,arthurGoldenWave,trial:()=>dragonTrial,skillFx:()=>skillFx,floaters:()=>floaters});
function spawnMonster(type, x, y, { night = false, power = 1 } = {}) {
  const p = monsterArt.get(type); if (!p) return;
  const boss = !!p.isBoss, elite = !!p.elite;
  const {hp,atk}=warrenMonsterStats(boss?'boss':elite?'elite':'normal',power);
  const m = { id: ++monSeq, type, p, r: boss ? 22 : 13, x, y, home: { x, y }, hp, maxHp: hp, atk, range: boss ? 70 : 38, cd: 1 + Math.random() * .5, speed: boss ? 60 : elite ? 72 : 78, night, boss, elite, left: false, dead: false };
  m.actor = {
    kind: 'actor', get x() { return m.x + (m.lx ?? 0); }, get y() { return m.y + (m.ly ?? 0); }, z: 0, r: 12,
    visualScale: (boss ? 1.65 : elite ? 2.4 : 2) * (p.scale || 1),
    get dead() { return m.dead; },
    getImage() { const f = m.left ? p.framesLeft : p.frames; return f[Math.floor(performance.now() / 120 + m.id) % f.length]; },
    drawOverlay(g, { x, y }) {
      if (m.dead) return; const w = boss ? 70 : 38, q = m.hp / m.maxHp;
      g.fillStyle = 'rgba(10,12,12,.82)'; g.fillRect(x - w / 2, y - 55, w, 5); g.fillStyle = m.night ? '#ff7a4a' : '#e85b55'; g.fillRect(x - w / 2 + 1, y - 54, (w - 2) * q, 3);
      if (boss) { g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffd45c'; g.fillText(p.name, x, y - 61); }
    },
  };
  S.monsters.push(m); return m;
}
function fieldPoint() {
  const z0 = runtimeWalkHeight(CENTER.x, CENTER.y + 200) ?? 0;
  for (let i = 0; i < 40; i++) {
    const a=Math.random()*Math.PI*2,r=355+Math.random()*520;
    const x=CENTER.x+Math.cos(a)*r,y=CENTER.y+Math.sin(a)*r;
    if (dist({ x, y }, CENTER) < 330) continue; // never inside the warren
    const z = runtimeWalkHeight(x, y); if (z === null || Math.abs(z - z0) > 12 || !canRuntimeActorStand(x, y, z)) continue; // same ground level as the warren
    return { x, y };
  }
  return null;
}
const edgePoints = NIGHT_INVASION_DIRECTIONS.map(({side,ax,ay}) => ({side,x:CENTER.x+ax*1100,y:CENTER.y+ay*1100}));
function killMonster(m, by) {
  if(m.trial){if(m.dead)return;m.dead=true;combatFX.playBossDeath(m.x,m.y,{visualScale:1.4});toast(`ชนะ ${MYTHIC_BOSSES[m.bossId]?.name||'Mythic Boss'}! ปิดหน้าศึกเพื่อรับรางวัล`);return;}
  m.dead = true; S.kills++;
  (m.boss ? combatFX.playBossDeath : combatFX.playNormalDeath).call(combatFX, m.x, m.y, { visualScale: m.actor.visualScale });
  combatSFX.playDeath({ volume: .45 });
  const loot=monsterLoot(m.type,Math.random,1.35);
  // Burrow's own flat region/rank reward; never scale Gold by the home's level or main-game loot range.
  loot.gold=burrowMonsterGold(m.type);
  applyMonsterResourceBonus(S,loot,CONSTRUCTION_MATERIAL_IDS);
  const drops=[{label:`${loot.gold} G`,tier:'gold'},...Object.entries(loot.items).map(([id,q])=>({label:`${itemLabel(id)} ×${q}`,tier:m.elite||m.boss?'blue':'green'}))];
  floaters?.loot(m.x,m.y,drops);
  const u=by&&!by.down?by:null;
  if(u){const def=MONSTER_XP[m.type],enemyLevel=def?.level||1,rank=m.boss?'boss':m.elite?'elite':'normal';
    const baseXp=Math.max(2,Math.round(enemyLevel*(m.boss?12:m.elite?6:2)));
    const xp=Math.max(1,Math.round(baseXp*(u.level>enemyLevel+20?.10:u.level>enemyLevel+10?.45:1)));
    if(giveBunnyExp(u,xp,S.warren*3)){
      if(!u.isGarrison){Object.assign(u,statsOf(u.cls,u.level,u.buildId));u.hp=u.maxHp;floaters?.text(u.x,u.y,`Lv ${u.level}!`,{color:'#ffe27a',size:16});}
    }
    grantClassMastery(S,u.cls,u.level,enemyLevel,rank);
  }
  // Night loot goes straight into storage. Day kills must be delivered by their carrier.
  // Stationary tower garrisons cannot carry loot home; their daytime drops go straight to storage.
  if(shouldDepositLootDirectly(S.night,u)){S.gold+=loot.gold;addInventory(S.inventory,loot.items);renderUi();}
  else {u.carry.gold+=loot.gold;addInventory(u.carry.items,loot.items);}
}

// ---------- combat ----------
// The real BunnySimulation resolves Skill Core + Mod + rarity combat in an isolated
// snapshot. Only an accepted authoritative cast is applied to the Burrow actors.
function castEquippedCore(u,target,skill){
 const result=resolveBurrowCore(S,u,target,S.monsters,skill.id);
 if(!result.accepted)return false;
 const player=result.player;
 u.sp=player.sp;
 u.hp=Math.max(1,Math.min(u.maxHp,player.hp));
 persistBurrowMasteryRuntime(S,u,player);
 u.coreCooldowns??={};
 for(const event of result.events){
  if(event.type==='cooldownStarted'&&SKILLS_V2[event.abilityId]?.kind!=='weapon')
   u.coreCooldowns[event.abilityId]=S.time+event.durationMs/1000;
 }
 u.coreBarrierHp=player.barrierHp||0;u.coreBarrierMaxHp=player.barrierMaxHp||0;
 u.coreBarrierUntil=player.barrierUntilMs?S.time+player.barrierUntilMs/1000:0;
 u.coreBarrierBreakHeal=player.barrierBreakHeal||0;
 u.coreValkyrieUntil=player.valkyrieUntilMs?S.time+player.valkyrieUntilMs/1000:0;
 u.coreCastUntil=S.time+.4;
 const active=S.classSkills?.[u.cls]?.active||[];
 if(active.length)u.nextCoreSlot=(active.indexOf(skill.id)+1)%active.length;
 u.moving=false;u.dir=facingTo(target.x-u.x,target.y-u.y);
 const from={x:u.x,y:u.y},to={x:target.x,y:target.y};
 skillFx?.play(skill.id,{from,to});
 floaters?.text(u.x,u.y,skill.name+'!',{color:'#87efbd',size:14,lift:62});
 combatSFX.playAttack?.({volume:.22});
 for(const event of result.events){
  if(event.type==='skillCast'&&event.skillId!==skill.id){
   const chained=SKILLS_V2[event.skillId];if(chained){
    skillFx?.play(chained.id,{from,to});
    floaters?.text(u.x,u.y,chained.name+'!',{color:'#f3c67b',size:14,lift:67});
   }
  }else if(event.type==='damageDealt'&&event.sourceId===player.id&&event.targetId!==player.id){
   const m=result.enemyById.get(event.targetId);
   if(!m||m.dead)continue;
   const skillLabel=SKILLS_V2[event.effect?.ability||event.effect?.sourceCoreId]?.name||skill.name;
   const v=hitFeedback(event.amount,{kind:event.effect?.origin==='ECHO'?'additional':'normal',critical:event.critical,coreName:skillLabel});
   floaters?.text(m.x,m.y,v.text,{color:v.color,size:v.size,lift:v.lift});
   combatFX.playHitSpark(m.x,m.y,{visualScale:m.actor.visualScale});
  }else if(event.type==='healed'&&event.targetId===player.id){
   floaters?.text(u.x,u.y,'+'+event.amount,{color:'#83f0aa',size:14,lift:46});
  }else if(event.type==='barrierApplied'&&event.entityId===player.id){
   skillFx?.burst(u.x,u.y,{color:'#87efbd',count:14,up:42});
  }else if(event.type==='attackMissed'){
   const m=result.enemyById.get(event.targetId);if(m)floaters?.text(m.x,m.y,'MISS',{color:'#ced8d6',size:13});
  }
 }
 // Snapshot monsters are not shared references: copy the simulation-approved HP and
 // movement back, then fire the existing Burrow kill/loot/EXP exactly once per defeated mob.
 const damagedIds=new Set(result.events.filter(e=>e.type==='damageDealt'&&e.sourceId===player.id&&e.targetId!==player.id).map(e=>e.targetId));
 for(const [id,m] of result.enemyById){
  const resolved=result.world.monsters.get(id);if(!resolved||m.dead)continue;
  m.hp=Math.max(0,resolved.hp);if(damagedIds.has(id)&&!u.isGarrison)m.aggro=u;
  if((resolved.position.x!==m.x-u.x||resolved.position.y!==m.y-u.y)&&!m.boss){
   const x=u.x+resolved.position.x,y=u.y+resolved.position.y;
   if(standable(x,y)&&canWalkStraight(m.x,m.y,x,y)) {m.x=x;m.y=y;}
  }
  if(m.hp<=0)killMonster(m,u);
 }
 if(skill.id==='thorsJudgement'){
  const affected=[...result.enemyById].filter(([id])=>result.world.monsters.get(id)?.judgementUntilMs>0);
  for(const [id,m] of affected){const initial=m.hp;
   later((skill.durationMs||4000)/1000,()=>{
    if(m.dead)return;
    const lost=Math.max(0,initial-m.hp),blast=Math.min(m.hp,Math.round(lost*.30));
    if(blast>0){m.hp-=blast;floaters?.text(m.x,m.y,blast,{color:'#87efbd',size:16,lift:48});if(m.hp<=0)killMonster(m,u);}
   });
  }
 }
 return true;
}
// Weapon Mastery Active skills are separate from Skill Cores. One canonical main-game
// on-hit resolver owns their 25%/fifth-hit/14-hit rules and half-cooldown floors.
function castMasteryOnBasicHit(u,target){
 const result=resolveBurrowMasteryOnHit(S,u,target,S.monsters);
 if(!result.accepted)return false;
 const player=result.player;
 persistBurrowMasteryRuntime(S,u,player); // hit counter and gauge advance even without a proc
 if(!result.events.length)return false;
 u.hp=Math.max(1,Math.min(u.maxHp,player.hp));
 const from={x:u.x,y:u.y},to={x:target.x,y:target.y};
 for(const event of result.events){
  if(event.type==='skillCast'){
   const skill=SKILLS_V2[event.skillId];if(!skill)continue;
   const m=event.targetId?result.enemyById.get(event.targetId):target;
   skillFx?.play(skill.id,{from,to:{x:m?.x??target.x,y:m?.y??target.y}});
   floaters?.text(u.x,u.y,skill.name+'!',{color:'#f3c67b',size:14,lift:63});
  }else if(event.type==='damageDealt'&&event.sourceId===player.id&&event.targetId!==player.id){
   const m=result.enemyById.get(event.targetId);if(!m||m.dead)continue;
   const name=SKILLS_V2[event.effect?.ability]?.name||'MASTERY ACTIVE';
   const display=hitFeedback(event.amount,{critical:event.critical,coreName:name});
   floaters?.text(m.x,m.y,display.text,{
    color:event.critical?'#ffe36f':event.effect?.origin==='ECHO'?'#a98cff':'#f3c67b',
    size:display.size,lift:display.lift});
   combatFX.playHitSpark(m.x,m.y,{visualScale:m.actor.visualScale});
  }else if(event.type==='attackMissed'){
   const m=result.enemyById.get(event.targetId);
   if(m)floaters?.text(m.x,m.y,'MISS',{color:'#ced8d6',size:13});
  }else if(event.type==='healed'&&event.targetId===player.id){
   floaters?.text(u.x,u.y,'+'+event.amount,{color:'#83f0aa',size:14,lift:46});
  }
 }
 const damagedIds=new Set(result.events.filter(e=>e.type==='damageDealt'&&e.sourceId===player.id&&e.targetId!==player.id).map(e=>e.targetId));
 for(const [id,m] of result.enemyById){
  const resolved=result.world.monsters.get(id);if(!resolved||m.dead)continue;
  m.hp=Math.max(0,resolved.hp);
  if(damagedIds.has(id)&&!u.isGarrison)m.aggro=u;
  if((resolved.position.x!==m.x-u.x||resolved.position.y!==m.y-u.y)&&!m.boss){
   const x=u.x+resolved.position.x,y=u.y+resolved.position.y;
   if(standable(x,y)&&canWalkStraight(m.x,m.y,x,y)){m.x=x;m.y=y;}
  }
  if(m.hp<=0)killMonster(m,u);
 }
 return true;
}
function castMovementCore(u,target,c){
 const id=S.classSkills?.[u.cls]?.movement;
 if(!id||S.warren<10||u.down||(u.coreCastUntil||0)>S.time||(u.coreMovementBlockedUntil||0)>S.time)return false;
 const result=resolveBurrowMovement(S,u,target,(x,y)=>{
  const z=runtimeWalkHeight(x,y);
  return z!==null&&canRuntimeActorStand(x,y,z)&&canWalkStraight(u.x,u.y,x,y);
 });
 if(!result.accepted)return false;
 const newX=u.x+result.player.position.x,newY=u.y+result.player.position.y;
 if(Math.hypot(newX-u.x,newY-u.y)<12){u.coreMovementBlockedUntil=S.time+1;return false;}
 u.x=newX;u.y=newY;u.dir=facingTo(target.x-u.x,target.y-u.y);
 u.coreCooldowns??={};
 for(const event of result.events)if(event.type==='cooldownStarted'&&event.abilityId===id)
   u.coreCooldowns[id]=S.time+event.durationMs/1000;
 u.coreCastUntil=S.time+.25;u.moving=true;
 skillFx?.burst(u.x,u.y,{color:id==='blink'?'#bc95ff':'#f9eafc',count:15,up:30});
 floaters?.text(u.x,u.y,result.skill.name+'!',{color:'#e5ceff',size:15,lift:52});
 return true;
}
function strike(u, target) {
  const c=CLASSES[u.cls],now=performance.now();
  u.cd=c.cd*((u.coreValkyrieUntil||0)>S.time?.8:1);u.atkUntil=now+375;u.dir=facingTo(target.x-u.x,target.y-u.y);
  combatSFX.playAttack({volume:.25});
  skillFx?.play(BASIC_ATTACK_FX[c.fam]||'arcBolt',{from:{x:u.x,y:u.y},to:{x:target.x,y:target.y}});
  later(['bow','staff'].includes(c.fam)?.26:.18,()=>{
    if(u.down||target.dead)return;
    const unlocked=S.mastery[u.cls]?.unlocked||[];
    const proc=rollMasteryProc(c.fam,unlocked);

    const deal=(m,ratio=1,{kind='normal',allowCrit=true,coreName=null}={})=>{
      if(!m||m.dead)return;
      const critical=allowCrit&&rollWarrenCrit(u.luk||0,u.critBonus||0);
      const dmg=Math.max(1,Math.round(u.atk*ratio*((u.coreValkyrieUntil||0)>S.time?1.15:1)*(critical?BASE_CRIT_DAMAGE:1)*(.9+Math.random()*.2)));
      m.hp-=dmg;m.aggro=u;
      const feedback=hitFeedback(dmg,{kind,critical,coreName});
      floaters?.text(m.x,m.y,feedback.text,{color:feedback.color,size:feedback.size,lift:feedback.lift});
      combatFX.playHitSpark(m.x,m.y,{visualScale:m.actor.visualScale});
      if(critical)skillFx?.burst(m.x,m.y,{color:'#ffe36f',count:14,up:42});
      combatSFX.playHit({critical,volume:.3});
      if(m.hp<=0)killMonster(m,u);
    };
    // The Greatsword cleave from main-game Mastery is a secondary-target hit,
    // not a multiplier to every swing. Other existing splash classes keep their AoE.
    const hits=c.splash&&c.fam!=='greatsword'
      ?S.monsters.filter(m=>!m.dead&&dist(m,target)<c.splash):[target];
    for(const m of hits){
      if(m.dead)continue;
      deal(m);
    }
    if(proc){
      const follow=proc.kind==='double'?target:
        S.monsters.find(m=>!m.dead&&m!==target&&dist(m,target)<(proc.range||Math.min(210,c.range)));
      if(follow&&!follow.dead){
        skillFx?.burst(follow.x,follow.y,{color:proc.kind==='additional'?'#a98cff':'#9fe8ff',count:8,up:30});
        deal(follow,proc.ratio,{kind:proc.kind,allowCrit:proc.criticalAllowed});
      }
    }
    if(!target.dead)castMasteryOnBasicHit(u,target);
  });
}
function hurtUnit(u, dmg, from) {
  // Tower garrisons do not have a carrier bag or participate in field-unit
  // knockdowns. Old/queued aggro targeting a garrison must damage its tower.
  if (u.isGarrison) {
    const tower=defenseStructures().find(t=>t.garrison===u);
    if(tower)hurtTower(tower,dmg*.7);
    return;
  }
  if (u.down) return;
  let dealt=Math.max(1,Math.round(dmg*90/(90+(u.def||0))));
  if((u.coreBarrierUntil||0)>S.time&&(u.coreBarrierHp||0)>0){
   const absorbed=Math.min(dealt,u.coreBarrierHp);
   u.coreBarrierHp-=absorbed;dealt-=absorbed;
   if(u.coreBarrierHp<=0&&u.coreBarrierBreakHeal){
    const healed=Math.min(u.maxHp-u.hp,u.coreBarrierBreakHeal);
    u.hp+=healed;if(healed>0)floaters?.text(u.x,u.y,'+'+healed,{color:'#83f0aa',size:14});
    u.coreBarrierBreakHeal=0;
   }
  }
  u.hp -= dealt; u.hurtUntil = performance.now() + 360;
  floaters?.text(u.x, u.y, `-${dealt}`, { color: '#ff6b5e', size: 13 });
  if (u.hp <= 0) {
    u.hp = 0; u.down = true; u.moving = false;
    // A fallen carrier loses half its loot; survivors must still deliver theirs to the warren.
    if(u.carry){u.carry.gold=Math.floor(u.carry.gold/2);for(const k in u.carry.items)u.carry.items[k]=Math.floor(u.carry.items[k]/2);}
    toast(`${u.name} ล้มแล้ว! ฟื้นอัตโนมัติตอนเช้า`); combatSFX.playDeath({ volume: .5 }); renderUi();
  }
}
function nearestMonster(p, maxD, filter = () => true) { let b = null, bd = maxD; for (const m of S.monsters) { if (m.dead || !filter(m)) continue; const d = dist(p, m); if (d < bd) { bd = d; b = m; } } return b; }
function nearestUnit(p, maxD) { let b = null, bd = maxD; for (const u of S.units) { if (u.down) continue; const d = dist(p, u); if (d < bd) { bd = d; b = u; } } return b; }

function ringPost(u) {
  const gatePost=assignedGateDefensePost(u,S.units,S.fences,CENTER,T,CLASSES[u.cls].range>100);
  if(gatePost&&standable(gatePost.x,gatePost.y))return gatePost;
  const ring = S.units.filter(x => !x.down);
  const i = Math.max(0, ring.indexOf(u)), a = i / Math.max(1, ring.length) * Math.PI * 2 + .4, r = CLASSES[u.cls].range > 100 ? RING.ranged : RING.melee;
  return { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
}
function farmSpot(u) { // Stable, widely spaced autonomous patrol sectors around the whole village.
  const farmers=S.units.filter(x=>!x.down),i=Math.max(0,farmers.indexOf(u)),a=i/Math.max(1,farmers.length)*Math.PI*2;
  const r=435+(i%3)*75;
  return {x:CENTER.x+Math.cos(a)*r,y:CENTER.y+Math.sin(a)*r};
}
// pick a target, preferring monsters nobody else is already on (claims are counted per tick)
function pickTarget(u, from, maxD, filter) {
  let best = null, bs = Infinity;
  for (const m of S.monsters) {
    if (m.dead || !filter(m) || dist(from, m) > maxD) continue;
    const sc = dist(u, m) + (m.claims ?? 0) * 140;
    if (sc < bs) { bs = sc; best = m; }
  }
  if (best) best.claims = (best.claims ?? 0) + 1;
  return best;
}
function updateUnit(u, dt, i) {
  if (u.down) return;
  regenBurrowSp(u,dt);
  u.cd -= dt;
  const c = CLASSES[u.cls], atHome = dist(u, CENTER) < BASE_R;
  u.masteryRange=c.fam==='bow'&&(S.mastery[u.cls]?.unlocked||[]).includes(30);
  if (atHome && carried(u)) deposit(u);
  if (atHome && !S.night && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .08 * dt); // rest in the warren
  const holdsRing=S.night,post=holdsRing?ringPost(u):{x:CENTER.x+(u.id%5-2)*30,y:CENTER.y+150};
  let target = null, goal = null;
  const dusk = !S.night && S.clock > DAY_S - 7;
  if (dragonTrial&&!dragonTrial.m.dead) target=dragonTrial.m;
  else if (holdsRing) {
    // Intercept nighttime raiders threatening ANY tower or the hall, not only monsters close
    // to this bunny's ring post. Claim penalties spread defenders across incoming lanes.
    target=selectNightDefenseTarget(u,post,S.monsters,defenseStructures(),CENTER);
  }
  else if (dusk || carried(u)>=c.carry||u.hp<u.maxHp*.30) goal=post; // bag full / evening: go home
  else target=pickTarget(u,u,675,m=>!m.night)||pickTarget(u,farmSpot(u),300,m=>!m.night);
  if (target) {
    const d = dist(u, target);
    const core=!dragonTrial&&(u.coreCastUntil||0)<=S.time?chooseBurrowCore(S,u,target,S.monsters):null;
    if(core&&castEquippedCore(u,target,core))return;
    if(!dragonTrial&&d>c.range+95&&castMovementCore(u,target,c))return;
    if (d <= c.range*(u.masteryRange?1.1:1)) { u.moving = false; if (u.cd <= 0) strike(u, target); }
    else moveToward(u, target.x, target.y, c.speed, dt, c.range * .8);
    return;
  }
  if (!goal) goal = holdsRing ? post : farmSpot(u);
  if (moveToward(u, goal.x, goal.y, c.speed * (S.night ? 1.2 : 1), dt, 12)) u.moving = false;
}
function updateMonster(m, dt) {
  if (m.dead) return;
  if(m.trial&&updateMythicSkills(m,dt))return;
  m.cd -= dt; m.lx = m.ly = 0;
  // Garrison spells should draw attacks onto their tower, not its bagless
  // stationary occupant. Discard any such aggro retained by an older tick.
  if(m.aggro?.isGarrison)m.aggro=null;
  let target = m.aggro && !m.aggro.down && dist(m, m.aggro) < 420 ? m.aggro : nearestUnit(m, m.night ? 180 : 150);
  if (!m.night && !target && dist(m, m.home) > 60) { moveToward(m, m.home.x, m.home.y, m.speed * .6, dt); m.left = screenLeft(m.home.x - m.x, m.home.y - m.y); return; }
  if (!m.night && target && dist(target, m.home) > 480) { m.aggro = null; target = null; }
  if (!target && m.night) { // Closed gates on their approach, then walls, towers and Hall.
    const shut=nearestClosedGate(m,S.fences,220,T);
    if(shut&&!canWalkStraight(m.x,m.y,CENTER.x,CENTER.y)){
      const p=perimeterMid(shut,T),d=dist(m,p);m.left=screenLeft(p.x-m.x,p.y-m.y);
      if(d>62){
        // Approach from the OUTSIDE, stopping before the closed gate collider rather than A* routing around it.
        const step=Math.min(m.speed*dt,d-60),x=m.x+(p.x-m.x)/d*step,y=m.y+(p.y-m.y)/d*step;
        const z=runtimeWalkHeight(x,y);
        if(z!==null&&canRuntimeActorStand(x,y,z)){m.x=x;m.y=y;m.stuck=0;}
        else m.stuck=(m.stuck||0)+dt;
      }else if(m.cd<=0){m.cd=1.25;m.lunge=performance.now();
       later(.18,()=>{if(!m.dead&&shut.closed&&dist(m,p)<74)hurtPerimeter(shut,m.atk*.8);});}
      lunge(m);return;
    }
    const nearWall=nearestPerimeterSection(m,S.fences,85);
    // Elites/bosses can break through; normal raiders attack when they get stuck at a wall.
    if(nearWall&&(m.elite||m.boss||(m.stuck??0)>.65)&&
      !canWalkStraight(m.x,m.y,CENTER.x,CENTER.y)){
      const p=perimeterMid(nearWall,T);m.left=screenLeft(p.x-m.x,p.y-m.y);
      if(dist(m,p)>39)moveToward(m,p.x,p.y,m.speed,dt,30);
      else if(m.cd<=0){m.cd=1.25;m.lunge=performance.now();
       later(.18,()=>{if(!m.dead&&dist(m,p)<62)hurtPerimeter(nearWall,m.atk*.8);});}
      lunge(m);return;
    }
    const tw = defenseStructures().filter(t => t.hp > 0 && dist(m, t) < 150).sort((a, b) => dist(m, a) - dist(m, b))[0];
    if (tw) {
      m.left = screenLeft(tw.x - m.x, tw.y - m.y);
      if (dist(m, tw) > 42) moveToward(m, tw.x, tw.y, m.speed, dt, 38);
      else if (m.cd <= 0) { m.cd = 1.3; m.lunge = performance.now(); m.lungeTo = { x: tw.x, y: tw.y }; later(.18, () => { if (!m.dead) hurtTower(tw, m.atk * .7); }); }
      lunge(m); return;
    }
    const gate=chooseRaidGate(m,S.fences,CENTER,T);
    if(gate&&!m.passedGate){
      if(dist(m,gate)<45)m.passedGate=true;
      else {moveToward(m,gate.x,gate.y,m.speed,dt,12);m.left=screenLeft(gate.x-m.x,gate.y-m.y);lunge(m);return;}
    }
    // Never remotely damage the Hall when a raider is stuck OUTSIDE a defensive wall.
    if(dist(m,CENTER)>175){moveToward(m,CENTER.x,CENTER.y,m.speed,dt,150);m.left=screenLeft(CENTER.x-m.x,CENTER.y-m.y);}
    else if(m.cd<=0){m.cd=1.3;S.burrow-=m.atk*.6;floaters?.text(CENTER.x,CENTER.y,`-${Math.round(m.atk*.6)}`,{color:'#ff9a4a',size:15,lift:90});m.lunge=performance.now();combatFX.playTackle(m.x,m.y,{visualScale:m.actor.visualScale});renderUi();}
    lunge(m); return;
  }
  if (!target) { if (Math.random() < dt * .3) m.home = { x: m.home.x + (Math.random() - .5) * 60, y: m.home.y + (Math.random() - .5) * 60 }; return; }
  const d = dist(m, target);
  m.left = screenLeft(target.x - m.x, target.y - m.y);
  if (d > m.range) moveToward(m, target.x, target.y, m.speed, dt, m.range * .8);
  else if (m.cd <= 0) {
    const wukongStrike=m.bossId==='sunWukong',arthurStrike=m.bossId==='kingArthur',mythicStrike=wukongStrike||arthurStrike;
    m.cd=wukongStrike?1.05:arthurStrike?1.18:1.25;m.lunge=performance.now();m.lungeTo={x:target.x,y:target.y};
    if(mythicStrike){
      m.skillAnimStart=S.time;m.skillAnimUntil=S.time+.8;
    }
    later(wukongStrike?.42:arthurStrike?.58:.18,()=>{
      if(!m.dead&&dist(m,target)<m.range+20){
        hurtUnit(target,m.atk,m);combatFX.playTackle(target.x,target.y,{visualScale:mythicStrike?1.35:1});
        if(wukongStrike)skillFx?.burst(target.x,target.y,{color:'#fff4ad',color2:'#ff9d19',count:8,up:38,life:.38});
        if(arthurStrike)skillFx?.burst(target.x,target.y,{color:'#fff7c9',color2:'#4c91e8',count:9,up:42,life:.42});
      }
    });
  }
  lunge(m);
}
function lunge(m) { // short hop toward the target so the attack reads
  const t = (performance.now() - (m.lunge ?? 0)) / 360; if (t > 1) return;
  const to = m.lungeTo ?? CENTER, dx = to.x - m.x, dy = to.y - m.y, d = Math.hypot(dx, dy) || 1, k = (t < .5 ? t * 2 : 2 - t * 2) * 14;
  m.lx = dx / d * k; m.ly = dy / d * k;
}

// ---------- day / night ----------
// Optional daytime encounter: spend only abundant construction materials, never Blueprints or upgrade stones.
async function useLure(mode){
 const quote=lureQuote(S,mode),source=mode==='frontier'?frontierRoster:roster;
 if(S.lureBusy||!quote?.canUse||matCount()<quote.mats||!source){toast('ล่อมอนไม่ได้ · ตรวจสอบเวลาและวัตถุดิบ');return false;}
 const normal=mode==='frontier'?frontierNormals:normals,elite=mode==='frontier'?frontierElites:elites;
 if(!normal.length&&!elite.length)return false;
 const points=[];
 for(let attempts=0;attempts<120&&points.length<quote.count;attempts++){
  const p=fieldPoint();if(p&&points.every(q=>dist(p,q)>65))points.push(p);
 }
 if(points.length<quote.count){toast('พื้นที่รอบหมู่บ้านไม่พอให้ฝูงมอนเกิด · ไม่เสียของ');return false;}
 S.lureBusy=true;renderUi();
 try{await Promise.all([...new Set([...normal,...elite])].map(id=>artFor(id,source)));}
 catch{S.lureBusy=false;renderUi();toast('โหลดภาพมอนสเตอร์ไม่สำเร็จ · ไม่เสียวัตถุดิบ');return false;}
 if(S.night||S.lureDay===S.day||matCount()<quote.mats){S.lureBusy=false;renderUi();return false;}
 if(!spendMats(quote.mats)){S.lureBusy=false;renderUi();return false;}
 S.lureDay=S.day;S.lureBusy=false;S.modal=null;
 for(let i=0;i<points.length;i++){
  const pool=elite.length&&Math.random()<quote.eliteChance?elite:normal.length?normal:elite;
  const id=pool[Math.floor(Math.random()*pool.length)];
  const stagePower=quote.mode==='frontier'?warrenStageDifficulty(frontierStage(S.warren).min):levelPower();
  const m=spawnMonster(id,points[i].x,points[i].y,{power:stagePower*quote.power});if(m)m.lured=true;
 }
 save();renderUi();banner('Threat Lure · '+quote.label,'ล่อมอน '+points.length+' ตัว · ใช้วัตถุดิบ '+quote.mats+' ชิ้น');
 return true;
}

function startNight() {
  S.night = true; S.clock = 0; S.modal=null; S.itemDetailId=null;S.building=false;S.wallPreview=false;S.movingTower=-1;S.movingMagicCart=-1;S.towerMoveHover=null;S.homeOpen=false;S.homeHover=null;S.homeMovingId=null;S.homeWallPreview=null;S.homeWallPreviewData=null;
  syncGateRuntime();
  // once the level's boss is beaten the nights replay wave 4 (farmable) until the warren is upgraded
  const n = S.cleared ? WAVES_PER_LEVEL - 1 : S.wave, boss = n === WAVES_PER_LEVEL && !S.cleared;
  const count = 3 + n * 2 + (S.warren - 1) * 3, power = (1 + (n - 1) * .2) * levelPower();
  S.queue = []; for (let i = 0; i < count; i++) S.queue.push(Math.random() < Math.min(.80,.08 + n * .08 + (S.warren - 1) * .04) && elites.length ? elites[i % elites.length] : normals[i % normals.length]);
  if (boss && bossId) S.queue.splice(Math.floor(S.queue.length / 2), 0, bossId); // the boss comes mid-wave, not after it
  S.nightWave = n; S.wavePower = power; S.waveTimer = 0;
  for (const m of S.monsters) if (!m.night) m.dead = true; // the field empties at dusk
  window.__slice?.setDusk(true);
  banner(`คืนที่ ${S.day} · เวฟ ${S.warren}-${n}`, boss ? `คืนบอส! ชนะแล้วอัปบ้านได้ · มอน ${S.queue.length} ตัว` : `มอนสเตอร์ ${S.queue.length} ตัวกำลังบุกโพรง!`);
  renderUi();
}
function endNight(won) {
  for (const m of S.monsters) m.dead = true;
  S.queue = [];
  if (won) {
    // Survivors keep growing even when the warren level is boss-gated.
    for(const u of S.units)if(!u.down){if(giveBunnyExp(u,12+S.warren*4,S.warren*3)){Object.assign(u,statsOf(u.cls,u.level,u.buildId));u.hp=u.maxHp;}}
    if (S.cleared) banner('รอดแล้ว!', 'บอสของเลเวลนี้แพ้ไปแล้ว · อัปบ้านเมื่อพร้อม 🏠');
    else if (S.wave >= WAVES_PER_LEVEL) { S.cleared = true; banner('ชนะบอสแล้ว! 🎉', `อัปบ้านเป็น Lv ${S.warren + 1} ได้แล้ว`); }
    else { S.wave++; banner('รอดแล้ว!', `คืนพรุ่งนี้ เวฟ ${S.warren}-${S.wave}`); }
  } else {
    S.losses++;
    // a lost night costs something, but the game goes on and the same wave comes back
    const lost=0; // Repeat the SAME boss every night. The setback is repair costs, not lost progression.
    S.burrow=Math.round(hallMax()*LOSS.hallLeft);
    for (const u of S.units) { u.down = true; u.hp = 0; u.moving = false; }
    combatSFX.playDeath({ volume: .7 });
    banner('โพรงแตก…', `เสียค่าซ่อมเท่านั้น · ฟาร์มกลางวันแล้วสู้เวฟ ${S.warren}-${S.cleared ? WAVES_PER_LEVEL - 1 : S.wave} อีกครั้งคืนนี้`);
  }
  S.pendingBanner = true;
  startDay();
  const before=S.mythic.pending;S.mythic=rollMythicOmen(S.mythic,{won,day:S.day,warren:S.warren});
  if(!before&&S.mythic.pending){if(!S.mythic.selected.length)S.mythic.selected=defaultMythicSquad(S.units);save();renderUi();}
  if(!IS_CINEMATIC_PREVIEW&&!before&&S.mythic.pending){banner('เงาของอสูรกายบินผ่าน…','เตรียมตัวให้พร้อม · BOSS ENCOUNTER!');setTimeout(()=>{if(!startPendingMythicCinematic())setTimeout(startPendingMythicCinematic,800);},900);}
}
function startDay() {
  S.night = false; S.clock = 0; S.day++;
  syncGateRuntime();
  for (const m of S.monsters) m.dead = true;
  S.monsters = S.monsters.filter(m => !m.dead);
  for (const u of S.units) { if (u.down) { u.down = false; u.x = CENTER.x + (Math.random() - .5) * 120; u.y = CENTER.y + 150; } u.hp = u.maxHp; u.sp=u.maxSp??u.sp; } // everyone wakes up rested
  window.__slice?.setDusk(false);
  if (!S.pendingBanner) banner(`วันที่ ${S.day}`, 'กระต่ายกระจายตัวออกฟาร์มมอนสเตอร์รอบหมู่บ้านอัตโนมัติ');
  S.pendingBanner = false;
  save(); renderUi();
}
function upgradeWarren() {
  const c = warrenCost();
  if (S.warren>=PHASE1_MAX_LEVEL||!S.cleared || S.night || matCount() < c.mats) return false;
  if(!spendMats(c.mats))return false;
  const oldMap=stageForWarren(S.warren).mapId;
  const before = hallMax(); S.warren++; S.wave = 1; S.cleared = false; S.burrow += hallMax() - before;
  // Banked EXP advances when the village raises each bunny's Lv cap (3 × Warren).
  for(const u of S.units)giveBunnyExp(u,0,S.warren*3);
  for(const tower of defenseStructures())if(tower.garrison)giveBunnyExp(tower.garrison,0,S.warren*3);
  refreshArmy();
  skillFx?.pillar(CENTER.x, CENTER.y, { color: '#ffe27a', count: 40 }); skillFx?.burst(CENTER.x, CENTER.y, { color: '#ffe27a', color2: '#ffffff', count: 40, up: 160, life: 1 });
  combatSFX.playLevelUp();
  const unlocks=unlocksAtWarrenLevel(S.warren),unlockText=unlocks.length?' · ปลดล็อกใหม่: '+unlocks.join(' / '):'';
  banner(`บ้าน Lv ${S.warren}! 🏠`, `ใช้วัตถุดิบ ${c.mats} ชิ้น · ป้อม ${towerMax()} ป้อม · โพรง ${hallMax()} HP${unlockText}`);
  if(unlocks.length)toast(`บ้าน Lv ${S.warren} ปลดล็อก: ${unlocks.join(' · ')}`);
  save(); renderUi();
  if(stageForWarren(S.warren).mapId!==oldMap){toast('เข้าสู่ '+stageForWarren(S.warren).name+' · กำลังเปลี่ยนฉาก');setTimeout(()=>location.reload(),800);}
  return true;
}
// From day one: permanent hall HP upgrades give surplus common materials a useful sink.
// Unlike warren level, fortification does not bypass the five-wave boss gate.
function upgradeFortification(){
 if(S.night||S.fortification>=fortificationCap(S.warren)||matCount()<reinforceCost())return false;
 const cost=reinforceCost();if(!spendMats(cost))return false;
 S.fortification++;S.burrow=Math.min(hallMax(),S.burrow+fortificationHpBonus(1));
 skillFx?.pillar(CENTER.x,CENTER.y,{color:'#b6e9a1'});combatSFX.playLevelUp?.({volume:.4});
 save();renderUi();toast('เสริมฐานสำเร็จ Lv '+S.fortification+' · HP สูงสุด +35 · ใช้วัตถุดิบ '+cost+' ชิ้น');
 return true;
}

// ---------- save / load (localStorage; versioned for later migrations) ----------
// Home Builder lives in warren-home-controller.js.
const homeController=createHomeController({S,T,save,renderUi,toast,buildMap,currentStage,standable,dist,matCount,spendMats,spendMatsWithReceipt,closeMobileDrawer,defenseStructures,rebuildPerimeter,mobileDrawer:()=>mobileDrawer});
const {refreshNativeHomeGround,checkHome,safeHomeArt,homeThumb,homeObjectAt,editSelectedHome,rebuildHomeWorld,restoreHomeWorld,placeHome,moveHome,demolishHome,undoHome,setHomeOpen,buyHomePlot,previewHomeWall,expandHomeWall,homeTerrainContext,paintHomeTerrain,commitHomeTerrain,createHomeWaterfall,restoreRecoveryHome}=homeController;
function save() {
  if(dragonTrial)return;
  const data={v:3,gold:S.gold,burrow:S.burrow,warren:S.warren,fortification:S.fortification,wallLevel:S.wallLevel,wave:S.wave,cleared:S.cleared,day:S.day,kills:S.kills,losses:S.losses,
    inventory:S.inventory,gear:S.gear,nextGearId:S.nextGearId,builds:S.builds,progress:S.progress,mastery:S.mastery,classSkills:S.classSkills,reserve:S.reserve,
    forgeLevel:S.forgeLevel,resourceLevel:S.resourceLevel,resourceGoldBank:S.resourceGoldBank,resourceMatBank:S.resourceMatBank,resourceBonusVersion:1,dayHealDay:S.dayHealDay,nightHealDay:S.nightHealDay,sellReserve:S.sellReserve,sellSelected:S.sellSelected,
    autoDismantle:S.autoDismantle,lureDay:S.lureDay,gateClosed:S.gateClosed,homeBuilder:S.homeBuilder,mythic:S.mythic,
    units:S.units.map(u=>({cls:u.cls,name:u.name,level:u.level,exp:u.exp})),
    towers:S.towers.map(t=>({x:t.x,y:t.y,hp:Math.round(t.hp),level:t.level,garrison:t.garrison?{cls:t.garrison.cls,isGarrison:true,name:t.garrison.name,level:t.garrison.level,exp:t.garrison.exp}:null})),
    magicCarts:S.magicCarts.map(t=>({x:t.x,y:t.y,level:t.level,hp:Math.round(t.hp),garrison:t.garrison?{cls:'mage',isGarrison:true,name:t.garrison.name,level:t.garrison.level,exp:t.garrison.exp}:null})),fences:S.fences};
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));}catch{}
}
function load() {
  let raw=null,old=false;
  try{raw=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
   if(!raw){raw=JSON.parse(localStorage.getItem(PRIOR_SAVE_KEY)||'null');old=!!raw;}
   if(!raw){raw=JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY)||'null');old=!!raw;}
  }catch{}
  const d=migrateSave(raw);if(!d)return false;
  Object.assign(S,{gold:d.gold,inventory:d.inventory,gear:d.gear,nextGearId:d.nextGearId,builds:d.builds,progress:d.progress,mastery:d.mastery,classSkills:d.classSkills,
    reserve:d.reserve,autoDismantle:d.autoDismantle,homeBuilder:d.homeBuilder,mythic:normalizeMythic(raw.mythic),lureDay:d.lureDay,fences:d.fences,gateClosed:d.gateClosed,wallLevel:d.wallLevel,forgeLevel:d.forgeLevel,resourceLevel:d.resourceLevel,resourceGoldBank:d.resourceGoldBank,resourceMatBank:d.resourceMatBank,dayHealDay:d.dayHealDay,nightHealDay:d.nightHealDay,sellReserve:d.sellReserve,sellSelected:d.sellSelected,warren:d.warren,fortification:d.fortification,wave:d.wave,cleared:d.cleared,day:d.day,kills:d.kills,losses:d.losses});
  S.burrow=Math.min(hallMax(),Number.isFinite(d.burrow)?d.burrow:hallMax());
  for(const x of d.units)recruit(x.cls,true,x);
  for(const t of d.towers||[])createTower(t.x,t.y,t.hp,t.level,t.garrison);
  for(const t of d.magicCarts||[])createMagicCart(t.x,t.y,t.hp,t.garrison,t.level);
  refreshArmy();
  if(old||raw.wallLevel===undefined||raw.resourceBonusVersion!==1){save();if(old)try{localStorage.removeItem(LEGACY_SAVE_KEY);localStorage.removeItem(PRIOR_SAVE_KEY);}catch{}}
  return true;
}
addEventListener('beforeunload', () => { if (!S.night && !S.resetting) save(); }); // leaving by day keeps the day's shopping; leaving at night replays from dawn

function tick(dt) {
  if(dragonTrial){
   const m=dragonTrial.m;if(m.dead||m.trialLost)return;
   pathSearchBudget=2;insideSimulation=true;S.time+=dt;
   const due=S.events.filter(e=>e.at<=S.time);S.events=S.events.filter(e=>e.at>S.time);for(const e of due)e.fn();
   const fighters=S.units.filter(u=>dragonTrial.fighterIds.has(u.id));fighters.forEach((u,i)=>updateUnit(u,dt,i));updateMonster(m,dt);separate(fighters,32);keepActorsOutOfWalls(fighters,dt);
   if(fighters.every(u=>u.down)){m.trialLost=true;S.events=[];}
   insideSimulation=false;return;
  }
  if (mythicCinematic?.active||wukongCinematic?.active||arthurCinematic?.active||S.modal==='waterfallGuide') return; // Reading the illustrated update cannot cost a night wave.
  if (S.over) return;
  pathSearchBudget = 1;
  // Let players manage the forge, inventory and hero builds without losing precious daylight.
  // Nighttime combat still advances if they inspect a panel, but changes remain locked.
  if (!S.night && (S.modal || S.itemDetailId || mobileDrawer || S.homeOpen)) return;
  insideSimulation = true;
  dt *= S.speed; S.clock += dt; S.time += dt;
  if (S.events.length) { const due = S.events.filter(e => e.at <= S.time); S.events = S.events.filter(e => e.at > S.time); for (const e of due) e.fn(); }
  if (!S.night) {
    if (S.clock >= DAY_S) startNight();
    const alive = S.monsters.filter(m => !m.dead && !m.night).length, cap = 12 + S.warren * 2;
    if (alive < cap && Math.random() < dt * 1.5) { const p = fieldPoint(); if (p) spawnMonster(Math.random() < .15 && elites.length ? elites[0] : normals[Math.floor(Math.random() * normals.length)], p.x, p.y, { power: levelPower() * (1 + (S.wave - 1) * .06) }); }
  } else {
    S.waveTimer -= dt;
    if (S.queue.length && S.waveTimer <= 0) {
      S.waveTimer = 1.4 / Math.max(1, (S.nightWave + S.warren - 1) * .5);
      const e = edgePoints[Math.floor(Math.random() * edgePoints.length)], type = S.queue.shift();
      // the boss scales with the warren level only, not with the wave index
      for (let t = 0; t < 10; t++) { const x = e.x + (Math.random() - .5) * 160, y = e.y + (Math.random() - .5) * 160; if (standable(x, y)) { spawnMonster(type, x, y, { night: true, power: type === bossId ? levelPower() : S.wavePower }); break; } }
    }
    const left = S.monsters.some(m => m.night && !m.dead);
    if (S.burrow <= 0) endNight(false);
    else if ((S.clock >= NIGHT_S && !left) || (!S.queue.length && !left && S.clock > 8)) endNight(true);
  }
  // the burrow hall has an archer loft: it shoots the nearest raider, day or night
  S.hallCd = (S.hallCd ?? 0) - dt;
  if (S.hallCd <= 0) { const m = nearestMonster(CENTER, HALL.range); if (m) { S.hallCd = HALL.cd; const from = { x: CENTER.x, y: CENTER.y }; skillFx?.play('shotArrow', { from, to: { x: m.x, y: m.y } }); later(.22, () => { if (m.dead) return; m.hp -= HALL.dmg; floaters?.text(m.x, m.y, HALL.dmg, { color: '#bfe3ff', size: 13 }); combatFX.playHitSpark(m.x, m.y, { visualScale: m.actor.visualScale }); if (m.hp <= 0) killMonster(m, null); }); } }
  updateTowers(dt); // Healing Lodge passive removed: the Warren now owns the once-per-phase Heal skill.
  updateMagicCarts(dt);
  for (const m of S.monsters) m.claims = 0;
  S.units.forEach((u, i) => updateUnit(u, dt, i));
  for (const m of S.monsters) updateMonster(m, dt);
  separate(S.units, 32); separate(S.monsters.filter(m => !m.dead), 30);
  keepActorsOutOfWalls(S.units,dt);keepActorsOutOfWalls(S.monsters,dt);
  S.monsters = S.monsters.filter(m => !m.dead || performance.now() - (m.deadAt ??= performance.now()) < 50);
  insideSimulation = false;
}

// ---------- camera: WASD / arrows / drag, the runtime player is an invisible camera rig ----------
const keys = new Set(), cam = { x: CENTER.x + 60, y: CENTER.y + 60 };
addEventListener('keydown', e => {
  if(e.code==='Escape'&&S.homeOpen&&S.homeAction!=='place'&&S.homeAction!=='terrain'){S.homeAction='place';S.homeMovingId=null;S.homeStoredId=null;renderUi();return;}
  if(e.code==='Escape'&&S.homeOpen&&S.homeSelectedId){S.homeSelectedId=null;renderUi();return;}
  if(e.code==='Escape'&&S.homeOpen){setHomeOpen(false);return;}
  // Builder shortcuts: R rotates, Ctrl/Cmd+Z undoes the last placement action.
  if(S.homeOpen&&!S.night&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
   if(e.code==='KeyR'&&!e.ctrlKey&&!e.metaKey&&S.homeSelectedId){const o=S.homeBuilder.placedObjects.find(v=>v.id===S.homeSelectedId);if(o)editSelectedHome({rotation:((o.rotation||0)+1)%4});return;}
   if(e.code==='KeyR'&&!e.ctrlKey&&!e.metaKey){S.homeRotation=(S.homeRotation+1)%4;renderUi();return;}
   if(e.code==='KeyZ'&&(e.ctrlKey||e.metaKey)){e.preventDefault();undoHome();return;}
   if(e.code==='Delete'&&S.homeSelectedId){demolishHome(S.homeSelectedId);return;}
  }
  if(e.code==='Escape'&&(S.movingTower>=0||S.movingMagicCart>=0)){S.movingTower=-1;S.movingMagicCart=-1;S.towerMoveHover=null;renderUi();return;}
  if(e.code==='Escape'&&S.itemDetailId){S.itemDetailId=null;S.itemProtect=false;renderUi();return;}
  if(e.code==='Escape'&&S.modal==='waterfallGuide'){e.preventDefault();closeWaterfallGuide();return;}
  if(e.code==='Escape'&&S.modal){S.modal=null;renderUi();return;}
  if(e.code==='Escape'&&mobileDrawer){closeMobileDrawer();syncMobileControls();return;}
  if(e.code==='Escape'&&S.building){S.building=false;renderUi();return;}
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  keys.add(e.code);
  if(e.code==='Space'){e.preventDefault();cam.x=CENTER.x+60;cam.y=CENTER.y+60;}
});
addEventListener('keyup', e => keys.delete(e.code));
function moveCamera(dt) {
  let sx = 0, sy = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) sy -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) sy += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) sx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) sx += 1;
  if (sx || sy) { const v = 520 * dt; cam.x += (sx + 2 * sy) * v * .5; cam.y += (2 * sy - sx) * v * .5; }
  cam.x = Math.max(200, Math.min(2360, cam.x)); cam.y = Math.max(200, Math.min(2360, cam.y));
}

// Keep the selected class authoritative across Forge, Armory, Inventory and item details.
// A previously clicked bunny must never silently override a newer class-tab selection.
function selectArmoryClass(cls){
  if(!CLASS_IDS.includes(cls))return false;
  S.forgeClass=cls;S.itemTargetClass=cls;
  if(!S.units.some(u=>u.id===S.heroUnitId&&u.cls===cls))
    S.heroUnitId=S.units.find(u=>u.cls===cls)?.id??null;
  return true;
}
function openItemDetail(id){
  if(!S.gear.some(p=>p.id===id))return false;
  S.itemDetailId=id;
  S.itemTargetClass=(S.modal==='batch'?S.batchClass:S.forgeClass)||'guard';
  S.itemProtect=false;
  return true;
}

// Pre-approved batch crafting: the only automatic action is dismantling pieces below the chosen rarity.
function completeArmoryCraft(order){
 if(!order||S.night)return false;
 const result=settleBatchCraft(S,order.recipeId,order.qty,order.cls,order.settings);
 if(!result){toast('Blueprint / Gold / วัตถุดิบไม่พอ หรือ Tier ยังไม่ปลดล็อก');renderUi();return false;}
 S.batchReport=result;
 S.batchResults=[...result.retained,...result.review].map(p=>p.id);
 S.batchClass=order.cls;S.batchFilter='all';S.batchSelection=[];S.batchConfirm=false;S.batchExpanded=false;S.armoryPreserveCraftPosition=true;
 S.armoryTab='craft';S.armorySlot=gearSlot(order.recipeId);S.itemDetailId=null;
 S.armoryNotice='คราฟต์ '+result.made.length+' ชิ้น · เก็บ '+result.retained.length+' · รอพิจารณา '+result.review.length+
  ' · ย่อย '+result.dismantled.length+' · Stone Fragments +'+result.fragments;
 combatSFX.playLevelUp?.({volume:.3});save();renderUi();toast(S.armoryNotice);return true;
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
// Static <img> tags in warren.html use root paths; prefix the deploy base (GitHub Pages: /burrow-command/).
for(const img of document.querySelectorAll('img[src^="/assets/"]'))img.src=import.meta.env.BASE_URL+img.getAttribute('src').slice(1);
const mobileLayout=matchMedia('(max-width:760px), (max-height:500px) and (pointer:coarse)');
let mobileDrawer=null;
// Desktop-only preferences are independent of gameplay saves and never affect the mobile drawer.
const PANEL_PREF_KEY='burrow-panel-collapse-v1';
let panelPrefs={side:false};
try{const saved=JSON.parse(localStorage.getItem(PANEL_PREF_KEY)||'null');if(saved)panelPrefs={side:saved.side===true};}catch{}
function applyPanelPrefs(){
 const desktop=!mobileLayout.matches;
 for(const name of ['side']){
  const el=$(name),button=$(name+'Toggle'),collapsed=desktop&&panelPrefs[name];
  el.classList.toggle('is-collapsed',collapsed);
  button.setAttribute('aria-expanded',String(!collapsed));
  button.textContent=collapsed?(name==='help'?'📘 Guide ▸':'🏠 หมู่บ้าน ▸'):'−';
  button.setAttribute('aria-label',collapsed?'แสดง'+(name==='help'?'คำแนะนำ':'แผงจัดการหมู่บ้าน'):'ซ่อน'+(name==='help'?'คำแนะนำ':'แผงจัดการหมู่บ้าน'));
 }
}
for(const name of ['side'])$(name+'Toggle').addEventListener('click',()=>{
 if(mobileLayout.matches)return;
 panelPrefs[name]=!panelPrefs[name];
 try{localStorage.setItem(PANEL_PREF_KEY,JSON.stringify(panelPrefs));}catch{}
 applyPanelPrefs();
});
applyPanelPrefs();
function closeMobileDrawer(){
 mobileDrawer=null;
 document.body.removeAttribute('data-mobile-drawer');
 $('mobileDrawerScrim').hidden=true;
 $('side').inert=mobileLayout.matches;
 $('shopbox').inert=mobileLayout.matches;
 for(const b of document.querySelectorAll('#mobileDock [data-mobile-open]'))b.setAttribute('aria-pressed','false');
}
function syncMobileControls(){
 if(S.modal&&mobileDrawer)closeMobileDrawer();
 const mobile=mobileLayout.matches;
 $('side').inert=mobile&&mobileDrawer!=='village';
 $('shopbox').inert=mobile&&mobileDrawer!=='recruit';
 $('mobileDrawerScrim').hidden=!mobileDrawer||!mobile;
 for(const b of document.querySelectorAll('#mobileDock [data-mobile-open]')){
  const type=b.dataset.mobileOpen,selected=type===mobileDrawer||(type==='skills'&&['bunnyMenu','mastery','skillCore'].includes(S.modal))||(type==='craft'&&S.modal==='hero')||(type==='sell'&&S.modal==='sell');
  b.setAttribute('aria-pressed',mobile&&selected?'true':'false');
 }
}
function openMobileView(type){
 if(!mobileLayout.matches)return;
 if(type==='village'||type==='recruit'){
  S.modal=null;S.itemDetailId=null;mobileDrawer=type;
  document.body.dataset.mobileDrawer=type;
 }else{
  closeMobileDrawer();
  if(type==='skills'){S.modal='bunnyMenu';}
  else if(type==='hero'||type==='craft'){
   S.armoryTab=type==='craft'?'craft':'inventory';S.modal='hero';
  }else if(type==='sell'){S.sellConfirm=false;S.modal='sell';}
 }
 renderUi();
}
$('mobileDrawerScrim').addEventListener('click',()=>{closeMobileDrawer();syncMobileControls();});
mobileLayout.addEventListener('change',()=>{setRuntimeZoomRange(mobileLayout.matches?.26:.45,1.3);if(!mobileLayout.matches){setRuntimeZoom(getRuntimeZoom());closeMobileDrawer();}syncMobileControls();applyPanelPrefs();});
for(const target of document.querySelectorAll('[data-ui-icon]'))target.innerHTML=gameIcon(target.dataset.uiIcon,'ui',target.textContent);
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove('on'), 2200); }
function banner(title, sub) { const el = $('banner'); el.innerHTML = `<b>${title}</b><span>${sub}</span>`; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function openWaterfallGuide(source='guide'){
  if(S.homeOpen)setHomeOpen(false);
  if(mobileDrawer)closeMobileDrawer();
  S.waterfallGuideSource=source==='intro'?'intro':'guide';
  S.modal='waterfallGuide';
  S.itemDetailId=null;
  renderUi();
  $('waterfallGuidePanel').querySelector('[data-waterfall-guide-close]')?.focus();
}
function closeWaterfallGuide(){
  if(S.modal!=='waterfallGuide')return;
  const source=S.waterfallGuideSource;
  if(source==='intro')markWaterfallIntroSeen();
  S.waterfallGuideSource=null;
  S.modal=source==='guide'?'guide':null;
  renderUi();
  (source==='guide'?$('guidePanel').querySelector('[data-open-waterfall-guide]'):$('help').querySelector('[data-open-guide]'))?.focus();
}
function renderUi() {
  // AoE kills and simultaneous raider wall hits can request dozens of identical
  // UI rebuilds in one frame. Only paint once after that simulation batch.
  if (insideSimulation) { uiDirty = true; return; }
  uiDirty = false; lastUiPaint = performance.now();
  if($('relicLauncherCount'))$('relicLauncherCount').textContent=archiveProgress(S.mythic).first+'/9';
  if($('patchNotesOpen'))$('patchNotesOpen').innerHTML=`<i class="bc-hud-icon" style="--hud-position:0% 50%" aria-hidden="true"></i> Patch Notes v${BURROW_VERSION}`;
  $('homeOpen').disabled=S.night;
  $('homeOpen').classList.toggle('on',S.homeOpen);
  $('homeOpen').textContent=S.homeOpen?'✖ ปิด Home Builder':'🔨 Home Builder';
  S.homeWallVisible=new Set(WS.objects.filter(o=>o.bcFenceId).map(o=>o.bcFenceId)).size;
  const homePanel=$('homePanel');homePanel.hidden=!S.homeOpen||S.night||!!S.modal;
  if(!homePanel.hidden){const scroll=homePanel.scrollTop,catalog=homePanel.querySelector('.bc-home-catalog')?.scrollTop;S.homeMats=matCount();homePanel.innerHTML=renderHomeBuilderHtml(S,{thumb:homeThumb});homePanel.scrollTop=scroll;const next=homePanel.querySelector('.bc-home-catalog');if(next&&catalog)next.scrollTop=catalog;}
  $('gold').textContent=S.gold;
  $('materials').textContent=matCount();
  $('burrow').style.width=`${100*S.burrow/hallMax()}%`;
  $('burrow-t').textContent=`${Math.ceil(S.burrow)} / ${hallMax()}`;
  $('shop').innerHTML=Object.entries(CLASSES).map(([k,c])=>{
    const count=S.units.filter(u=>u.cls===k).length,perClass=fieldClassCap(S.warren),classUnlocked=S.warren>=15,full=!classUnlocked&&count>=perClass,teamFull=S.units.length>=squadMax();
    const status=full?'ครบคลาส '+count+'/'+perClass:teamFull?'ทีมเต็ม':S.night?'รอกลางวัน':S.gold<priceOf(k)?'Gold ไม่พอ':classUnlocked?count+' ตัว':count+'/'+perClass;
    return `<button class="buy" data-buy="${k}" aria-label="จ้าง${c.name} ราคา ${priceOf(k)} Gold · ${status}" ${S.night||S.gold<priceOf(k)||full||teamFull?'disabled':''}>`+
      `<i>${gameIcon(c.fam,'family',c.icon,'bc-class-icon')}</i><span class="bc-buy-label"><b>${c.name}</b><small>${status}</small></span><em>${priceOf(k)} G</em></button>`;
  }).join('');
  $('repair').disabled=S.night||S.gold<REPAIR_COST||(S.burrow>=hallMax()&&defenseStructures().every(t=>t.hp>=t.maxHp));
  $('repair').textContent=`🔧 +${REPAIR_HP} HP (${REPAIR_COST}G)`;
  const repairQuote=repairAllQuote(S,hallMax(),REPAIR_HP,REPAIR_COST);
  $('repairAll').disabled=S.night||!repairQuote.repairs||S.gold<repairQuote.gold;
  $('repairAll').textContent=repairQuote.repairs?`🔧 ซ่อมทั้งหมด (${repairQuote.gold}G)`:'🔧 ซ่อมทั้งหมด · เต็มแล้ว';
  $('repairAll').title=repairQuote.repairs?`โพรง +${repairQuote.hallMissing} HP · ป้อม/รถเวทย์ ${repairQuote.towerCount} จุด · รั้ว +${repairQuote.wallMissing||0} HP · ใช้ ${repairQuote.gold} Gold`:'ไม่มีสิ่งก่อสร้างเสียหาย';
  $('build').disabled=S.night||(S.building!=='tower'&&(S.towers.length>=towerMax()||S.gold<TOWER.gold||matCount()<TOWER.mats));
  $('build').classList.toggle('on',S.building==='tower');
  $('build').textContent=S.building==='tower'?'✖ ยกเลิกการสร้างป้อม':`🏹 ป้อมธนู ${S.towers.length}/${towerMax()} (${TOWER.gold}G + ${TOWER.mats} วัตถุดิบ)`;
  const magicCap=magicCartCap(S.warren),magicNext=MAGIC_CART_GATES.find(g=>g.level>S.warren);
  $('buildMagicCart').disabled=S.night||S.warren<15||(S.building!=='magicCart'&&(S.magicCarts.length>=magicCap||S.gold<MAGIC_CART_COST.gold||matCount()<MAGIC_CART_COST.materials));
  $('buildMagicCart').classList.toggle('on',S.building==='magicCart');
  $('buildMagicCart').textContent=S.building==='magicCart'?'✖ ยกเลิกการสร้างรถยิงเวทย์':S.warren<15?'🔮 รถยิงเวทย์ · ปลดล็อกบ้าน Lv 15':
   `🔮 รถยิงเวทย์ ${S.magicCarts.length}/${magicCap} (${MAGIC_CART_COST.gold}G + ${MAGIC_CART_COST.materials} วัตถุดิบ)${S.magicCarts.length>=magicCap&&magicNext?' · เพิ่มที่ Lv '+magicNext.level:''}`;
  const wc=warrenCost();
  $('upgrade').disabled=S.warren>=PHASE1_MAX_LEVEL||!S.cleared||S.night||matCount()<wc.mats;
  $('upgrade').textContent=S.warren>=PHASE1_MAX_LEVEL?'🏠 Warren Lv 20 · Phase 1 สูงสุดแล้ว':S.cleared?`🏠 อัป Warren → Lv ${S.warren+1} (ใช้วัตถุดิบ ${wc.mats} ชิ้น)`:`🏠 Warren Lv ${S.warren} · ชนะบอสเวฟ ${S.warren}-${WAVES_PER_LEVEL} ก่อนอัปเลเวล`;
  const fc=reinforceCost(),cap=fortificationCap(S.warren);
  $('fortify').disabled=S.night||S.fortification>=cap||matCount()<fc;
  $('fortify').textContent=S.fortification>=cap?`🧱 เสริมฐาน Lv ${S.fortification}/${cap} · เต็มสำหรับ Warren Lv ${S.warren}`:`🧱 เสริมฐาน Lv ${S.fortification}/${cap} → HP +35 (${fc} วัตถุดิบ)`;
  $('squad').innerHTML=renderSquadHtml(S,CLASSES);
  if($('recruitSummary'))$('recruitSummary').textContent=`${S.units.length}/${squadMax()}`;
  $('lureOpen').disabled=S.night||S.lureDay===S.day;
  $('lureOpen').textContent=S.lureDay===S.day?'👾 ล่อมอน · ใช้แล้ววันนี้':'👾 ล่อมอนด้วยวัตถุดิบ';
  const wall=perimeterHealth(S.fences),wallIntegrity=homeWallIntegrity(S.wallLevel,S.homeBuilder,S.fences),next=nextPerimeterTier(S.wallLevel);
  const wallFull=S.wallLevel>=PERIMETER_TIERS.length-1;
  $('fenceBuild').disabled=S.night||wallFull;
  const wallName=S.wallLevel===0?'ยังไม่มีรั้ว':S.wallLevel===1?'รั้วไม้':S.wallLevel===2?'กำแพงหิน':'กำแพงหินเสริม';
  const nextName=next.level===1?'🪵 สร้างรั้วไม้':next.level===2?'🪨 อัปเกรดเป็นกำแพงหิน':`🛡 เสริมกำแพงหิน Lv ${next.level}`;
  const wallFootprint=S.homeBuilder.expandedSides.length?'15×15 + '+S.homeBuilder.expandedSides.map(s=>HOME_SIDE_NAMES[s]).join('/'):'15×15 ช่อง';
  $('fenceBuild').textContent=wallFull?'🛡 กำแพงระดับสูงสุดแล้ว':
    `${nextName} · ${wallFootprint} (${next.cost} วัตถุดิบ)`;
  $('fenceBuild').title=wallFull?'กำแพงถึงระดับสูงสุด แต่ย้ายแนวกำแพงได้ผ่าน Home Builder':
    `อัปเกรดวัสดุกำแพงโดยรักษา Layout ปัจจุบัน · ประตู 3 ด้าน`;
  $('wallStatus').textContent=S.wallLevel?
    `${wallName} Lv ${S.wallLevel} · ${wallFootprint} · กำแพง ${wallIntegrity.actual}/${wallIntegrity.expected} ส่วน · HP ${wall.hp}/${wall.maxHp}${wall.broken?' · พัง '+wall.broken+' ส่วน (กดซ่อมทั้งหมด)':''}`:
    `ยังไม่มีรั้ว · สร้างรั้วไม้ขนาด 15×15 ช่อง พร้อมประตู 3 ด้าน`;
  $('wallStatus').title=S.wallLevel?'ซ่อมรั้วและประตูที่ถูกทุบได้ด้วยปุ่มซ่อมทั้งหมด':'เลื่อนเมาส์มาที่ปุ่มสร้างรั้วเพื่อดูขอบเขต';
  const gates=$('gateControls');gates.hidden=!S.wallLevel;
  if(S.wallLevel){
    const labels={south:'ใต้',east:'ตะวันออก',west:'ตะวันตก'};
    gates.innerHTML=`<small class="gate-caption">🚪 เหนือเป็นรั้วทึบ · เลือกปิดได้ ${MAX_CLOSED_GATES} ฝั่ง (${S.gateClosed.length}/${MAX_CLOSED_GATES}) · กลางวันทุกประตูเปิด</small>`+
      GATE_SIDES.map(side=>{
       const f=S.fences.find(x=>x.kind==='gate'&&x.side===side),selected=S.gateClosed.includes(side),broken=f?.hp<=0;
       const label=broken?'พัง':selected?(S.night?'ปิดอยู่':'ปิดคืนนี้'):'เปิด';
       return `<button data-gate-side="${side}" class="${selected?'selected ':''}${broken?'broken':''}" ${S.night||broken||!selected&&S.gateClosed.length>=MAX_CLOSED_GATES?'disabled':''} title="ประตู${labels[side]} · ${broken?'ต้องซ่อมก่อน':label} · HP ${f?.hp||0}/${f?.maxHp||0}">${labels[side]} · ${label}<small> HP ${f?.hp||0}/${f?.maxHp||0}</small></button>`;
      }).join('');
  }else gates.innerHTML='';
  for(const [type,id,render] of [['hall','hallPanel',()=>renderHallBuildingHtml(S,hallMax(),Math.round(hallMax()*.2))],
    ['blacksmith','blacksmithPanel',()=>renderBlacksmithBuildingHtml(S)],['resource','resourcePanel',()=>renderResourceBuildingHtml(S)],
    ['sell','sellPanel',()=>renderQuickSellHtml(S)],['forge','forgePanel',()=>renderForgeHtml(S,CLASSES)],['hero','heroPanel',()=>renderArmoryHtml(S,CLASSES)],['inventory','inventoryPanel',()=>renderInventoryHtml(S,CLASSES)],['tower','towerPanel',()=>renderTowerHtml(S,CLASSES)],['magicCart','magicCartPanel',()=>renderMagicCartHtml(S,CLASSES)],['mastery','masteryPanel',()=>renderMasteryHtml(S,CLASSES)],['skillCore','skillCorePanel',()=>renderClassCoreHtml(S,CLASSES)],['batch','batchPanel',()=>renderBatchHtml(S,CLASSES)],['lure','lurePanel',()=>renderLureHtml(S,matCount())],['guide','guidePanel',renderGuideHtml],['relicCollection','relicCollectionPanel',()=>renderRelicArchiveHtml(S.mythic,S.archiveTab,S.archiveBossId)],['waterfallGuide','waterfallGuidePanel',()=>renderWaterfallGuideHtml({intro:S.waterfallGuideSource==='intro'})],['patchNotes','patchNotesPanel',renderPatchNotesHtml]]){
    const panel=$(id),scrollSelectors=['.bc-modal-body','.bc-armory-recipes','.bc-recipe-list','.bc-batch-expansion','.bc-master-list'];
    // Combat rewards may update the HUD while the player is reading or scrolling a modal.
    // Preserve BOTH its main scroll and nested recipe list instead of replacing the nodes at scroll=0.
    const scrolls=scrollSelectors.map(sel=>[sel,panel.querySelector(sel)?.scrollTop??0]);
    const craftTop=type==='hero'&&S.armoryPreserveCraftPosition
      ?panel.querySelector('[data-forge-craft]')?.getBoundingClientRect().top:null;
    const coreRecyclingOpen=type==='skillCore'&&panel.querySelector('.bc-core-recycling')?.open;
    panel.hidden=S.modal!==type;
    if(!panel.hidden){
      panel.innerHTML=render();
      if(coreRecyclingOpen)panel.querySelector('.bc-core-recycling')?.setAttribute('open','');
      for(const [sel,top] of scrolls){const el=panel.querySelector(sel);if(el)el.scrollTop=top;}
      if(type==='hero'&&S.armoryPreserveCraftPosition){
        // The report now sits BELOW the craft controls. Keep the Craft button
        // at the same on-screen position after adding the summary/results.
        const craft=panel.querySelector('[data-forge-craft]'),body=panel.querySelector('.bc-modal-body');
        if(craft&&body&&craftTop!=null)body.scrollTop+=craft.getBoundingClientRect().top-craftTop;
        S.armoryPreserveCraftPosition=false;
      }
    }
  }
  $('bunnyMenuPanel').hidden=S.modal!=='bunnyMenu';
  const detail=$('itemDetailPanel');detail.hidden=!S.itemDetailId||S.modal==='hero';
  if(S.itemDetailId){if(S.gear.some(i=>i.id===S.itemDetailId)&&S.modal!=='hero')detail.innerHTML=renderItemDetailHtml(S,S.itemDetailId,CLASSES);else if(!S.gear.some(i=>i.id===S.itemDetailId)){detail.hidden=true;S.itemDetailId=null;}}
  $('modalScrim').hidden=!S.modal&&!S.itemDetailId&&(mythicPanel?.hidden??true);
  syncMobileControls();
  $('forgeOpen').disabled=S.night;
  const movingDefense=S.movingTower>=0||S.movingMagicCart>=0;
  $('towerMoveNotice').hidden=!movingDefense;
  $('mobileTowerMoveNotice').hidden=!movingDefense||!mobileLayout.matches;
  canvas.classList.toggle('tower-move',movingDefense);
  $('masteryOpen').disabled=false;
  $('lureOpen').innerHTML=gameIcon('monster','ui','◇','bc-hud-lure-icon')+' ล่อมอนด้วยวัตถุดิบ';
  decorateHud();
  syncClock();
}
function syncClock() {
  const total = S.night ? NIGHT_S : DAY_S, left = Math.max(0, Math.ceil(total - S.clock));
  const phase=S.night ? `🌙 คืนที่ ${S.day}` : `☀️ วันที่ ${S.day}`;
  const timer=S.night ? `เหลือมอน ${S.queue.length + S.monsters.filter(m => m.night && !m.dead).length}` : `ค่ำใน ${left}s`;
  if($('phase').textContent!==phase)$('phase').textContent=phase;
  if($('timer').textContent!==timer)$('timer').textContent=timer;
  const liveGold=String(Math.floor(S.gold)),liveMats=String(matCount());
  if($('gold').textContent!==liveGold)$('gold').textContent=liveGold;
  if($('materials').textContent!==liveMats)$('materials').textContent=liveMats;
  const wave=`🏠 Lv ${S.warren} · เวฟ ${S.warren}-${S.cleared ? `${WAVES_PER_LEVEL} ✓` : S.wave}`;
  if($('wave').textContent!==wave)$('wave').textContent=wave;
  const bar=$('clockbar');bar.style.width=`${100*Math.min(1,S.clock/total)}%`;
  const mode=S.night?'night':'';if(bar.className!==mode)bar.className=mode;
}
document.body.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if(b.id==='homeOpen'||b.id==='mobileHomeOpen'){setHomeOpen(!S.homeOpen);return;}
  if(b.hasAttribute('data-home-close')){setHomeOpen(false);return;}
  if(b.dataset.homePane){S.homePane=b.dataset.homePane;if(S.homePane!=='terrain'&&['terrain','waterfall'].includes(S.homeAction))S.homeAction='place';if(S.homePane!=='decor'&&['move','recover'].includes(S.homeAction)){S.homeAction='place';S.homeMovingId=null;S.homeStoredId=null;}if(S.homePane!=='land'){S.homeWallPreview=null;S.homeWallPreviewData=null;}renderUi();return;}
  if(b.hasAttribute('data-home-help')){S.homeHelp=!S.homeHelp;renderUi();return;}
  if(b.dataset.homeSelect){S.homeSelectedId=b.dataset.homeSelect;const o=S.homeBuilder.placedObjects.find(v=>v.id===S.homeSelectedId);if(o){cam.x=o.x;cam.y=o.y;}renderUi();return;}
  if(b.hasAttribute('data-home-deselect')){S.homeSelectedId=null;renderUi();return;}
  if(b.hasAttribute('data-home-sel-rotate')){const o=S.homeBuilder.placedObjects.find(v=>v.id===S.homeSelectedId);if(o)editSelectedHome({rotation:((o.rotation||0)+1)%4});return;}
  if(b.hasAttribute('data-home-sel-variant')){const o=S.homeBuilder.placedObjects.find(v=>v.id===S.homeSelectedId);if(o)editSelectedHome({variant:((o.variant||0)+1)%3});return;}
  if(b.dataset.homeCategory){S.homeCategory=b.dataset.homeCategory;renderUi();return;}
  if(b.dataset.homeType){S.homeSelected=b.dataset.homeType;S.homeSelectedId=null;S.homeAction='place';S.homeMovingId=null;S.homeStoredId=null;S.homeVariant=0;renderUi();return;}
  if(b.hasAttribute('data-home-rotate')){S.homeRotation=(S.homeRotation+1)%4;renderUi();return;}
  if(b.hasAttribute('data-home-variant')){S.homeVariant=(S.homeVariant+1)%3;renderUi();return;}
  if(b.dataset.homeMove){const o=S.homeBuilder.placedObjects.find(v=>v.id===b.dataset.homeMove);if(o){S.homeAction='move';S.homeMovingId=o.id;S.homeSelectedId=null;S.homeRotation=o.rotation;S.homeSelected=o.prefab;S.homeVariant=o.variant||0;toast('แตะพื้นที่ใหม่เพื่อย้าย '+HOME_ITEMS[o.prefab].name);}renderUi();return;}
  if(b.dataset.homeDemolish){demolishHome(b.dataset.homeDemolish);return;}
  if(b.hasAttribute('data-home-undo')){undoHome();return;}
  if(b.dataset.homeRecover){const item=S.homeBuilder.recovery.find(o=>o.id===b.dataset.homeRecover&&HOME_ITEMS[o.prefab]);
   if(item){S.homeStoredId=item.id;S.homeAction='recover';S.homeSelected=item.prefab;S.homeVariant=item.variant||0;S.homeRotation=item.rotation||0;toast('เลือกจุดวางใหม่ให้ '+HOME_ITEMS[item.prefab].name);renderUi();}return;}
  if(b.dataset.homePlot){buyHomePlot(b.dataset.homePlot);return;}
  if(b.dataset.homeWallPreview){S.homeWallPreview=S.homeWallPreview===b.dataset.homeWallPreview?null:b.dataset.homeWallPreview;S.homeWallPreviewData=S.homeWallPreview?previewHomeWall(S.homeWallPreview):null;renderUi();return;}
  if(b.dataset.homeWallExpand){expandHomeWall(b.dataset.homeWallExpand);return;}
  if(b.hasAttribute('data-home-wall-rebuild')&&!S.night){rebuildPerimeter();save();renderUi();toast('สร้างกำแพงที่ข้อมูลขาดขึ้นใหม่แล้ว · ส่วนที่ถูกมอนสเตอร์ทุบยังต้องซ่อม');return;}
  if(b.dataset.homeBrush){S.homeAction='terrain';S.homeTerrainBrush=b.dataset.homeBrush;S.homeTerrainDraft??=S.homeBuilder.terrainEdits.map(e=>({...e}));S.homeTerrainNotice='';renderUi();return;}
  if(b.hasAttribute('data-home-terrain-apply')){commitHomeTerrain();return;}
  if(b.hasAttribute('data-home-terrain-cancel')){S.homeTerrainDraft=null;S.homeAction='place';S.homeTerrainNotice='';renderUi();return;}
  if(b.hasAttribute('data-home-waterfall-mode')){S.homeAction='waterfall';S.homeTerrainDraft=null;toast('เลือกจุดต้นน้ำบนเนินที่สร้างเอง; ม่านน้ำตกเหนือใช้พู่กันน้ำแล้วกดยืนยัน');renderUi();return;}
  if(b.dataset.mobileOpen){openMobileView(b.dataset.mobileOpen);return;}
  if(b.hasAttribute('data-mobile-close')){closeMobileDrawer();syncMobileControls();return;}
  if(b.id==='mobileReset'){$('reset').click();return;}
  if(b.dataset.buy)recruit(b.dataset.buy);
  else if(b.id==='forgeOpen'){S.modal='blacksmith';renderUi();}
  else if(b.hasAttribute('data-open-guide')){S.modal='guide';renderUi();}
  else if(b.hasAttribute('data-open-update-news')){openWaterfallGuide('intro');}
  else if(b.hasAttribute('data-open-waterfall-guide')){openWaterfallGuide('guide');}
  else if(b.hasAttribute('data-open-patch-notes')){S.modal='patchNotes';renderUi();}
  else if(b.hasAttribute('data-open-relic-collection')){closeMobileDrawer();S.archiveTab='first';S.archiveBossId=null;S.modal='relicCollection';renderUi();}
  else if(b.dataset.archiveTab){S.archiveTab=b.dataset.archiveTab;S.archiveBossId=null;renderUi();}
  else if(b.dataset.archiveBoss){S.archiveBossId=b.dataset.archiveBoss;renderUi();}
  else if(b.dataset.world){
    if(S.movingTower>=0||S.movingMagicCart>=0){toast('กำลังย้ายสิ่งก่อสร้างป้องกัน · คลิกพื้นว่างหรือกด Esc ก่อน');return;}
    if(b.dataset.world==='sell')S.sellConfirm=false;
    S.modal=b.dataset.world;renderUi();
  }
  else if(b.dataset.worldTower!==undefined){
    if(S.movingTower>=0||S.movingMagicCart>=0){toast('กำลังย้ายสิ่งก่อสร้างป้องกัน · คลิกพื้นว่างหรือกด Esc ก่อน');return;}
    S.selectedTower=Number(b.dataset.worldTower);S.modal='tower';renderUi();
  }
  else if(b.dataset.worldMagicCart!==undefined){
    if(S.movingTower>=0||S.movingMagicCart>=0){toast('กำลังย้ายสิ่งก่อสร้างป้องกัน · คลิกพื้นว่างหรือกด Esc ก่อน');return;}
    S.selectedMagicCart=Number(b.dataset.worldMagicCart);S.modal='magicCart';renderUi();
  }
  else if(b.id==='sellPreview'&&!S.night){S.sellConfirm=true;renderUi();}
  else if(b.id==='sellCancel'){S.sellConfirm=false;renderUi();}
  else if(b.id==='sellConfirm'&&!S.night&&S.sellConfirm){
    const quote=commitQuickSell(S,S.sellReserve,S.sellSelected);S.sellConfirm=false;
    if(quote){save();renderUi();toast('ขาย '+quote.quantity+' ชิ้น · รับ '+quote.gold+' Gold');}
    else{renderUi();toast('ไม่มีของส่วนเกินที่ขายได้');}
  }
  else if(b.id==='cancelTowerMove'||b.id==='mobileCancelTowerMove'){S.movingTower=-1;S.movingMagicCart=-1;S.towerMoveHover=null;renderUi();}
  else if(b.hasAttribute('data-tower-move'))beginTowerMove();
  else if(b.hasAttribute('data-forge-upgrade'))upgradeForgeBuilding();
  else if(b.hasAttribute('data-resource-upgrade'))upgradeResourceBuilding();
  else if(b.hasAttribute('data-hall-heal'))useHallHeal();
  else if(b.hasAttribute('data-hall-upgrade'))upgradeWarren();
  else if(b.hasAttribute('data-hall-fortify'))upgradeFortification();
  else if(b.hasAttribute('data-open-crafting')){S.armoryTab='craft';S.modal='hero';renderUi();}
  else if(b.id==='heroOpen'){S.modal='hero';renderUi();}
  else if(b.id==='lureOpen'&&!S.night){S.modal='lure';renderUi();}
  else if(b.dataset.lure){void useLure(b.dataset.lure);}
  else if(b.id==='inventoryOpen'){S.armoryTab='inventory';S.modal='hero';renderUi();}
  else if(b.id==='masteryOpen'||b.hasAttribute('data-open-mastery-menu')){S.modal='mastery';renderUi();}
  else if(b.id==='skillCoreOpen'||b.hasAttribute('data-open-core-menu')){S.modal='skillCore';renderUi();}
  else if(b.dataset.coreClass){S.coreClass=b.dataset.coreClass;renderUi();}
  else if(b.dataset.skillSalvage){const id=b.dataset.skillSalvage;try{applyBurrowSkillCommand(S,S.coreClass,{type:'salvageSkillItem',itemId:id,qty:1});save();renderUi();toast('ย่อย '+id+' ได้ Shard +1');}catch(e){toast('ย่อยไม่ได้: '+String(e.message||e));}}
  else if(b.dataset.skillExchange){const id=b.dataset.skillExchange;try{applyBurrowSkillCommand(S,S.coreClass,{type:'exchangeShards',itemId:id});save();renderUi();toast('แลก '+id+' สำเร็จ');}catch(e){toast('แลกไม่ได้: '+String(e.message||e));}}
  else if(b.dataset.skillUpgrade){
    const id=b.dataset.skillUpgrade;
    try{
      const kind=skillUpgradeKind(id),quote=classSkillQuote(S,S.coreClass,id);
      if(!kind||!quote)throw Error('invalid-skill-upgrade');
      const before=S.classSkills[S.coreClass]?.coreRarity?.[id]??'normal';
      const command=kind==='modifier'?{type:'upgradeModifier',modifierId:id}:
        kind==='movement'?{type:'upgradeMovementCore',coreId:id}:{type:'upgradeCore',coreId:id};
      applyBurrowSkillCommand(S,S.coreClass,command);
      const after=S.classSkills[S.coreClass]?.coreRarity?.[id]??'normal',success=before!==after;
      const label=kind==='modifier'?'Skill Mod':kind==='movement'?'Movement Core':'Skill Core';
      const msg=success?'✦ '+label+' '+id+' '+before+' → '+after+' สำเร็จ!':
        label+' '+id+' อัปเกรดไม่สำเร็จ · คงระดับ '+before+' (ใช้ Gold และวัสดุแล้ว)';
      S.skillUpgradeFeedback={id,success,text:msg};
      save();renderUi();toast(msg);
    }catch(e){toast('อัปเกรดไม่ได้: '+String(e.message||e));}
  }
  else if(b.dataset.openMastery){S.masteryClass=b.dataset.openMastery;S.modal='mastery';renderUi();}
  else if(b.hasAttribute('data-waterfall-guide-close')){closeWaterfallGuide();}
  else if(b.hasAttribute('data-modal-close')){if(S.modal==='waterfallGuide')closeWaterfallGuide();else{S.modal=null;S.itemDetailId=null;renderUi();}}
  else if(b.hasAttribute('data-item-close')){S.itemDetailId=null;S.itemProtect=false;renderUi();}
  else if(b.dataset.heroUnit){const u=S.units.find(x=>x.id===+b.dataset.heroUnit);if(u){selectArmoryClass(u.cls);S.heroUnitId=u.id;S.modal='hero';renderUi();}}
  else if(b.dataset.openInventory){S.armoryTab='inventory';S.modal='hero';S.itemDetailId=null;renderUi();}
  else if(b.dataset.inventoryFilter){S.inventoryFilter=b.dataset.inventoryFilter;renderUi();}
  else if(b.dataset.openItem){if(openItemDetail(b.dataset.openItem))renderUi();}
  else if(b.dataset.forgeClass){if(selectArmoryClass(b.dataset.forgeClass)){
    S.armoryInventorySelection=[];S.armoryRecipe=null;S.armoryNotice='';S.itemDetailId=null;renderUi();}}
  else if(b.dataset.masteryClass){S.masteryClass=b.dataset.masteryClass;renderUi();}
  else if(b.dataset.masteryActiveLevel){
    const cls=b.dataset.masteryActiveClass||S.masteryClass,level=Number(b.dataset.masteryActiveLevel);
    if(toggleMasteryWeaponSkill(S,cls,level)){
      save();renderUi();toast('อัปเดต Weapon Mastery Active Lv '+level);
    }
  }
  else if(b.dataset.unlockMastery&&!S.night){const r=unlockClassMastery(S,b.dataset.unlockMastery);if(r){save();renderUi();toast('ปลด Mastery Lv '+r.level+' · '+r.milestone.description);}else toast('Mastery ยังไม่ถึงระดับนี้ หรือ Gold ไม่พอ');}
  else if(b.dataset.towerHire&&!S.night){const t=S.towers[S.selectedTower];if(hireGarrison(t,b.dataset.towerHire))toast('จ้าง '+CLASSES[b.dataset.towerHire].name+' ประจำป้อมแล้ว');}
  else if(b.hasAttribute('data-magic-cart-hire')&&!S.night){if(hireMagicCartMage(S.magicCarts[S.selectedMagicCart]))toast('จ้างนักเวทประจำรถยิงเวทย์แล้ว');}
  else if(b.hasAttribute('data-magic-cart-upgrade')&&!S.night){if(upgradeMagicCart(S.magicCarts[S.selectedMagicCart]))toast('เพิ่มความทนทานรถยิงเวทย์แล้ว');}
  else if(b.hasAttribute('data-magic-cart-move')&&!S.night)beginMagicCartMove();
  else if(b.hasAttribute('data-tower-upgrade')&&!S.night){if(upgradeTower(S.towers[S.selectedTower]))toast('เพิ่มความทนทานป้อมแล้ว');}
  else if(b.dataset.armorySlot){
    S.armorySlot=b.dataset.armorySlot;S.armoryRecipe=null;S.itemDetailId=null;S.armoryInventorySelection=[];
    S.armoryTab='craft';S.batchReport=null;renderUi();
  }
  else if(b.dataset.armoryTab){S.armoryTab=b.dataset.armoryTab;S.itemDetailId=null;renderUi();}
  else if(b.dataset.armoryRecipe){S.armoryRecipe=b.dataset.armoryRecipe;renderUi();}
  else if(b.hasAttribute('data-armory-show-results')){
    const panel=$('heroPanel'),body=panel.querySelector('.bc-modal-body'),results=panel.querySelector('.bc-armory-results');
    if(body&&results)body.scrollTop+=results.getBoundingClientRect().top-body.getBoundingClientRect().top-8;
  }
  else if(b.dataset.armoryRarity){S.armoryInventoryRarity=b.dataset.armoryRarity;S.armoryInventorySelection=[];renderUi();}
  else if(b.hasAttribute('data-armory-select-all')&&!S.night){
    const items=visibleArmoryInventory(S).filter(p=>!p.locked);
    const selected=new Set(S.armoryInventorySelection);
    S.armoryInventorySelection=items.length&&items.every(p=>selected.has(p.id))?[]:items.map(p=>p.id);
    renderUi();
  }
  else if(b.hasAttribute('data-armory-dismantle')&&!S.night){
    // Only visible, unlocked and unequipped copies are eligible. The economy layer
    // validates all IDs again atomically before modifying the inventory.
    const selected=new Set(S.armoryInventorySelection),ids=visibleArmoryInventory(S)
      .filter(p=>!p.locked&&selected.has(p.id)).map(p=>p.id);
    if(!ids.length)return;
    const r=dismantleSelection(S,ids);
    if(!r){S.armoryInventorySelection=[];renderUi();return toast('รายการเปลี่ยนแล้ว กรุณาเลือกใหม่');}
    const removed=new Set(ids);
    if(S.batchReport){
      S.batchReport.manualDismantled=[...(S.batchReport.manualDismantled||[]),...S.batchReport.made.filter(p=>removed.has(p.id))];
      S.batchReport.retained=S.batchReport.retained.filter(p=>!removed.has(p.id));
      S.batchReport.review=S.batchReport.review.filter(p=>!removed.has(p.id));
      S.batchReport.fragments+=r.fragments;
    }
    S.batchResults=S.batchResults.filter(id=>!removed.has(id));
    S.batchSelection=S.batchSelection.filter(id=>!removed.has(id));
    if(removed.has(S.itemDetailId))S.itemDetailId=null;
    S.armoryInventorySelection=[];
    S.armoryNotice='ย่อยอุปกรณ์ '+r.count+' ชิ้น · ได้ '+r.fragments+' Stone Fragments';
    save();renderUi();toast(S.armoryNotice);
  }
  else if(b.hasAttribute('data-batch-expanded')){S.batchExpanded=!S.batchExpanded;renderUi();}
  else if(b.dataset.batchFilter){S.batchFilter=b.dataset.batchFilter;renderUi();}
  else if(b.dataset.batchEquip&&!S.night){
    const [cls,id]=b.dataset.batchEquip.split(':'),piece=S.gear.find(p=>p.id===id),slot=piece&&gearSlot(piece.templateId),
      oldId=slot&&buildFor(S,cls)?.gear[slot];
    if(piece&&equipBuildItem(S,cls,null,slot,id)){
      S.armoryNotice='เปลี่ยนอุปกรณ์ให้ '+CLASSES[cls].name+' แล้ว'+(oldId&&oldId!==id?' · อุปกรณ์เก่ากลับเข้าคลังแล้ว':'')+
        ' · Enhance / Refine ของช่องเดิมยังอยู่';
      refreshArmy();save();renderUi();toast(S.armoryNotice);
    }
  }
  else if(b.hasAttribute('data-batch-select-leftovers')&&!S.night){
    const used=equippedGearIds(S),items=S.batchResults.map(id=>S.gear.find(p=>p.id===id)).filter(Boolean),reserved=new Set(recommendations(S,items,S.batchClass).map(r=>r.itemId));
    S.batchSelection=items.filter(p=>!p.locked&&!used.has(p.id)&&!reserved.has(p.id)).map(p=>p.id);S.batchConfirm=false;renderUi();
  }
  else if(b.hasAttribute('data-batch-confirm')&&!S.night){S.batchConfirm=true;renderUi();}
  else if(b.hasAttribute('data-batch-cancel')){S.batchConfirm=false;renderUi();}
  else if(b.hasAttribute('data-batch-dismantle')&&!S.night&&S.batchConfirm){
    const r=dismantleSelection(S,S.batchSelection);
    if(r){
      const chosen=new Set(S.batchSelection);
      if(S.batchReport){
        S.batchReport.manualDismantled=[...(S.batchReport.manualDismantled||[]),...S.batchReport.made.filter(p=>chosen.has(p.id))];
        S.batchReport.retained=S.batchReport.retained.filter(p=>!chosen.has(p.id));
        S.batchReport.review=S.batchReport.review.filter(p=>!chosen.has(p.id));
        S.batchReport.fragments+=r.fragments;
      }
      S.batchResults=S.batchResults.filter(id=>!chosen.has(id));S.batchSelection=[];S.batchConfirm=false;
      save();renderUi();toast('แยก '+r.count+' ชิ้น · ได้ '+r.fragments+' Stone Fragments');
    }
    else toast('รายการเปลี่ยนแล้ว ตรวจสอบใหม่ก่อนแยกชิ้นส่วน');
  }
  // One Class Armory per class: no additional build creation or switching.
  else if(b.id==='forgeAuto'&&!S.night){
    const n=autoEquipBuild(S,S.forgeClass);
    refreshArmy();save();renderUi();toast(n?'จัดอุปกรณ์ให้บิลด์แล้ว':'ยังไม่มีอุปกรณ์ที่เหมาะสม');
  }
  else if(b.dataset.batchQty){S.batchQty=Number(b.dataset.batchQty);renderUi();}
  else if(b.dataset.forgeCraft&&!S.night){
    const id=b.dataset.forgeCraft,qty=S.batchQty||1,cls=S.forgeClass,settings={...S.autoDismantle[cls]};
    if(!availableRecipes(S,cls).some(r=>r.id===id&&gearSlot(id)===(S.armorySlot||'weapon'))||!canCraft(S,id))
      return toast('สูตร / วัตถุดิบ / Tier ไม่ตรงกับช่องที่เลือก');
    const order={recipeId:id,qty,cls,settings};
    completeArmoryCraft(order);
  }
  else if(b.id==='enhanceAll'&&!S.night){
    const r=enhanceAll(S,S.forgeClass);if(r.levels){refreshArmy();save();renderUi();}
    toast(r.levels?`Enhance ${r.levels} ขั้น · ใช้ ${r.gold} Gold`:'Gold / Aetherstone ไม่พอ หรือทุกช่องเต็มแล้ว');
  }
  else if(b.dataset.itemEquip&&!S.night){
    const id=b.dataset.itemEquip,item=S.gear.find(x=>x.id===id),cls=S.itemTargetClass||S.forgeClass;
    const build=buildFor(S,cls),slot=item&&gearSlot(item.templateId),oldId=slot&&build?.gear[slot];
    if(item&&equipBuildItem(S,cls,build?.id,slot,id)){
      selectArmoryClass(cls);S.armorySlot=slot;S.itemDetailId=null;
      S.armoryNotice='ใส่ '+itemLabel(item.templateId)+' ให้ '+CLASSES[cls].name+' แล้ว'+
        (oldId&&oldId!==id?' · อุปกรณ์เก่ากลับเข้าคลังแล้ว':'')+' · ระดับ Enhance / Refine ของช่องยังอยู่';
      refreshArmy();save();renderUi();toast(S.armoryNotice);
    }else toast('อาวุธไม่ตรงคลาส หรือ Tier ยังไม่ปลดล็อก');
  }
  else if(b.dataset.itemUnequip&&!S.night){
    const id=b.dataset.itemUnequip;
    for(const cls of Object.keys(S.builds))for(const build of S.builds[cls])for(const slot of GEAR_SLOTS)
      if(build.gear[slot]===id)build.gear[slot]=null;
    refreshArmy();save();renderUi();toast('ถอดอุปกรณ์แล้ว');
  }
  else if(b.dataset.itemEnhance&&!S.night){
    const upgraded=enhanceGear(S,b.dataset.itemEnhance);
    if(upgraded){refreshArmy();combatSFX.playLevelUp?.({volume:.2});save();renderUi();toast('Enhance สำเร็จ');}
    else toast('Aetherstone / Gold ไม่พอ หรือถึงระดับสูงสุดของบ้านแล้ว');
  }
  else if(b.dataset.itemRefine&&!S.night){
    const refined=refineGear(S,b.dataset.itemRefine,Math.random,S.itemProtect);
    if(refined){
      const item=S.gear.find(p=>p.id===b.dataset.itemRefine);
      const text=refined.success
        ?'✦ Refine ติด! '+itemLabel(item?.templateId)+' +'+refined.before+' → +'+refined.level
        :refined.dropped?'Refine ไม่สำเร็จ · ลดขั้น +'+refined.before+' → +'+refined.level
          :'Refine ไม่สำเร็จ · คงระดับ +'+refined.level;
      S.refineFeedback={itemId:b.dataset.itemRefine,success:refined.success,text};
      S.armoryNotice=text;
      if(refined.success){combatSFX.playLevelUp?.({volume:.3});skillFx?.burst(CENTER.x,CENTER.y,{color:'#ffd27b',count:14,up:80});}
      refreshArmy();save();renderUi();toast(text);
    }else toast('Gold / Astralite / Protection ไม่พอ หรือถึง +15 แล้ว');
  }
  else if(b.dataset.itemDismantle&&!S.night){
    const piece=S.gear.find(x=>x.id===b.dataset.itemDismantle);
    if(piece&&confirm('แยก '+itemLabel(piece.templateId)+'? จะได้รับ Stone Fragment และไม่สามารถกู้คืนได้')){
      const n=dismantleGear(S,piece.id);
      if(n){S.itemDetailId=null;toast('ได้รับ Stone Fragment ×'+n);save();renderUi();}
      else toast('ต้องถอดอุปกรณ์ก่อน');
    }
  }
  else if(b.dataset.rename){
    const u=S.units.find(x=>x.id===+b.dataset.rename);
    if(u){const name=prompt('ตั้งชื่อกระต่าย (1–22 ตัวอักษร)',u.name)?.trim();if(name&&name.length<=22){u.name=name;save();renderUi();}}
  }
  else if (b.dataset.unit) { const u = S.units.find(x => x.id === +b.dataset.unit); if (u && !u.down) { u.stance = u.stance === 'farm' ? 'guard' : 'farm';save(); renderUi(); } }
  else if (b.id === 'repair'&&!S.night&&S.gold>=REPAIR_COST) { // hall first, whatever is left goes to damaged towers
    S.gold -= REPAIR_COST; let left = REPAIR_HP; const add = Math.min(left, hallMax() - S.burrow); S.burrow += add; left -= add;
    for (const t of defenseStructures()) { const a = Math.min(left, t.maxHp - t.hp); t.hp += a; left -= a; if (a) skillFx?.burst(t.x, t.y, { color: '#ffe27a', count: 10, up: 60 }); }
    skillFx?.burst(CENTER.x, CENTER.y, { color: '#ffe27a', count: 18, up: 90 }); save();renderUi();
  }
  else if (b.id === 'repairAll'&&!S.night) {
    const damaged=defenseStructures().filter(t=>t.hp<t.maxHp).map(t=>({x:t.x,y:t.y}));
    const wasBroken=S.fences.filter(f=>f.hp<=0);
    const quote=repairEverything(S,hallMax(),REPAIR_HP,REPAIR_COST);
    if(!quote)return toast('Gold ไม่พอ หรือทุกอาคารเต็มแล้ว');
    for(const wall of wasBroken)installFence(wall);
    if(quote.hallMissing)skillFx?.burst(CENTER.x,CENTER.y,{color:'#ffe27a',count:18,up:90});
    for(const t of damaged)skillFx?.burst(t.x,t.y,{color:'#ffe27a',count:10,up:60});
    save();renderUi();toast(`ซ่อมทั้งหมด · โพรง +${quote.hallMissing} HP · ป้อม ${quote.towerCount} หลัง · รั้ว +${quote.wallMissing||0} HP · ใช้ ${quote.gold}G`);
  }
  else if(b.id==='fenceBuild'&&!S.night)upgradePerimeter();
  else if(b.dataset.gateSide&&!S.night)selectGate(b.dataset.gateSide);
  else if (b.id === 'build'&&!S.night) { S.building = S.building==='tower'?false:'tower'; if(S.building&&mobileDrawer)closeMobileDrawer(); if (S.building) toast('คลิกพื้นในวงสีเหลืองเพื่อวางป้อม'); renderUi(); }
  else if (b.id === 'buildMagicCart'&&!S.night) { S.building = S.building==='magicCart'?false:'magicCart'; if(S.building&&mobileDrawer)closeMobileDrawer(); if(S.building)toast('คลิกพื้นในวงสีเหลืองเพื่อวางรถยิงเวทย์');renderUi(); }
  else if (b.id === 'speed') { S.speed = S.speed === 1 ? 2 : 1; b.textContent = `⏩ x${S.speed}`; }
  else if (b.id === 'skip' && !S.night) S.clock = DAY_S - .1;
  else if (b.id === 'upgrade') upgradeWarren();
  else if (b.id === 'fortify') upgradeFortification();
  else if (b.id === 'reset' && confirm('เริ่มหมู่บ้านใหม่? เซฟเดิมจะหายทั้งหมด')) { try { localStorage.removeItem(SAVE_KEY);localStorage.removeItem(PRIOR_SAVE_KEY);localStorage.removeItem(LEGACY_SAVE_KEY); } catch {} S.resetting = true; location.reload(); }
});

document.body.addEventListener('toggle',e=>{
 if(e.target?.classList?.contains('bc-home-land')){
  if(e.target.querySelector('.bc-home-terrain-tools'))S.homeTerrainOpen=e.target.open;
  else S.homeLandOpen=e.target.open;
 }
},true);

$('modalScrim').addEventListener('click',()=>{if(S.modal==='waterfallGuide'){closeWaterfallGuide();return;}if(S.itemDetailId){S.itemDetailId=null;S.itemProtect=false;}else S.modal=null;renderUi();});

document.body.addEventListener('change',e=>{
  const choice=e.target;
  if(choice?.hasAttribute('data-core-choose')||choice?.hasAttribute('data-mod-choose')||choice?.hasAttribute('data-movement-choose')){
    let command;
    try{
      if(choice.hasAttribute('data-core-choose')){
        const slot=Number(choice.dataset.coreChoose);
        command=choice.value?{type:'equipCore',coreId:choice.value,slot}:{type:'unequipCore',slot};
      }else if(choice.hasAttribute('data-mod-choose')){
        const [slot,modSlot]=choice.dataset.modChoose.split(':').map(Number),coreId=S.classSkills[S.coreClass]?.active?.[slot];
        if(!coreId)throw Error('skill-core-not-equipped');
        command=choice.value?{type:'equipModifier',coreId,modifierId:choice.value,modSlot}:{type:'unequipModifier',coreId,modSlot};
      }else command=choice.value?{type:'equipMovementCore',coreId:choice.value}:{type:'unequipMovementCore'};
      applyBurrowSkillCommand(S,S.coreClass,command);save();renderUi();
    }catch(error){toast('ไม่สามารถสวมใส่: '+String(error.message||error));renderUi();}
    return;
  }
  if(e.target?.hasAttribute('data-auto-enabled')||e.target?.hasAttribute('data-auto-protect')||e.target?.hasAttribute('data-auto-rarity')){
    const prefs=S.autoDismantle[S.forgeClass];
    if(e.target.hasAttribute('data-auto-enabled'))prefs.enabled=e.target.checked;
    if(e.target.hasAttribute('data-auto-protect'))prefs.protectOtherClasses=e.target.checked;
    if(e.target.hasAttribute('data-auto-rarity'))prefs.minRarity=e.target.value;
    save();renderUi();return;
  }
  if(e.target?.id==='sellReserve'){S.sellReserve=Number(e.target.value);S.sellConfirm=false;save();renderUi();return;}
  if(e.target?.dataset?.sellItem){const id=e.target.dataset.sellItem;
    S.sellSelected=e.target.checked?[...new Set([...S.sellSelected,id])]:S.sellSelected.filter(x=>x!==id);
    S.sellConfirm=false;save();renderUi();return;}
  if(e.target?.dataset?.batchLock){if(!S.night){setGearLock(S,e.target.dataset.batchLock,e.target.checked);S.batchSelection=S.batchSelection.filter(id=>id!==e.target.dataset.batchLock);S.armoryInventorySelection=S.armoryInventorySelection.filter(id=>id!==e.target.dataset.batchLock);S.batchConfirm=false;save();renderUi();}return;}
  if(e.target?.dataset?.armorySelect){
    if(!S.night){
      const id=e.target.dataset.armorySelect,eligible=visibleArmoryInventory(S).some(p=>p.id===id&&!p.locked);
      S.armoryInventorySelection=e.target.checked&&eligible
        ?[...new Set([...S.armoryInventorySelection,id])]:S.armoryInventorySelection.filter(x=>x!==id);
      renderUi();
    }
    return;
  }
  if(e.target?.dataset?.batchSelect){if(!S.night){const id=e.target.dataset.batchSelect;
    S.batchSelection=e.target.checked?[...new Set([...S.batchSelection,id])]:S.batchSelection.filter(x=>x!==id);
    S.batchConfirm=false;renderUi();}return;}
  if(e.target?.id==='itemProtect'){S.itemProtect=e.target.checked;renderUi();return;}
  if(e.target?.dataset?.itemClass){S.itemTargetClass=e.target.value;renderUi();return;}
  const id=e.target?.dataset?.unitBuild;if(!id)return;
  const u=S.units.find(x=>x.id===+id);
  if(!u||!S.builds[u.cls].some(b=>b.id===e.target.value))return;
  // Compatibility for pre-migration selectors; only one armory per class now.
  u.buildId=u.cls+'-1';refreshArmy();save();renderUi();
});

// ---------- world objects: farm flag + burrow hall HP ----------
const blank = document.createElement('canvas'); blank.width = blank.height = 1;
// The obsolete hunting flag actor was removed: farmers patrol their own sectors.
const hallActor = { kind: 'actor', x: CENTER.x + 40, y: CENTER.y + 40, z: 0, r: 4, shadow: false, getImage: () => blank,
  drawOverlay(g, { x, y }) { if (S.building||S.movingTower>=0||S.movingMagicCart>=0) drawBuildRing(g); const w = 110, q = S.burrow / hallMax(); g.fillStyle = 'rgba(10,12,12,.85)'; g.fillRect(x - w / 2, y - 150, w, 7); g.fillStyle = q > .5 ? '#7ee38a' : q > .25 ? '#ffc94a' : '#ff5a4a'; g.fillRect(x - w / 2 + 1, y - 149, (w - 2) * q, 5); // Name moved to the clickable world label.
  } };

function drawBuildRing(g){ // preview the ACTUAL enlarged enclosure, not a stale hall-centered radius
 const blueprint=S.wallLevel?S.fences:homePerimeterBlueprint(1,S.homeBuilder);
 g.save();g.setLineDash([8,6]);g.strokeStyle='rgba(255,214,90,.88)';g.lineWidth=2;
 for(const f of blueprint){
  const x=f.x*T,y=f.y*T,xx=x+(f.axis==='x'?(f.len||1)*T:0),yy=y+(f.axis==='y'?(f.len||1)*T:0);
  const a=projectRuntimePoint(x,y,runtimeWalkHeight(x,y)??0),b=projectRuntimePoint(xx,yy,runtimeWalkHeight(xx,yy)??0);
  g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
 }
 if(homeAtNorthernCliff(S.homeBuilder)){
  const x=12.5*T,y=2.5*T,a=projectRuntimePoint(x,y,runtimeWalkHeight(x,y)??0),b=projectRuntimePoint(27.5*T,y,runtimeWalkHeight(27.5*T,y)??0);
  g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
 }
 g.restore();
}
let skillFx = null, floaters = null, edgeLayer = null, edgeBounds = null;
let mythicCinematic = null,wukongCinematic=null,arthurCinematic=null;
function cinematicForBoss(id){return id==='sunWukong'?wukongCinematic:id==='kingArthur'?arthurCinematic:mythicCinematic}
function startPendingMythicCinematic(){return cinematicForBoss(S.mythic.pending?.bossId)?.start()||false;}
const placementTintCache=new WeakMap();
function placementGhost(g,art,p,good){
 if(!art?.img)return;
 let variants=placementTintCache.get(art.img);if(!variants){variants={};placementTintCache.set(art.img,variants);}
 const key=good?'good':'bad';let tinted=variants[key];
 if(!tinted){tinted=document.createElement('canvas');tinted.width=art.img.width;tinted.height=art.img.height;const x=tinted.getContext('2d');
  x.drawImage(art.img,0,0);x.globalCompositeOperation='source-atop';x.fillStyle=good?'rgba(75,255,115,.72)':'rgba(255,67,67,.78)';x.fillRect(0,0,tinted.width,tinted.height);}
 variants[key]=tinted;g.save();g.globalAlpha=.62;g.imageSmoothingEnabled=false;g.drawImage(tinted,Math.round(p.x-art.ox),Math.round(p.y-art.oy));g.restore();
}
function drawRangeRing(g,x,y,range,good=true){
 const z=runtimeWalkHeight(x,y)??0,c=projectRuntimePoint(x,y,z),edge=projectRuntimePoint(x+range,y-range,z),rx=Math.abs(edge.x-c.x);
 g.save();g.strokeStyle=good?'rgba(128,238,154,.92)':'rgba(255,105,94,.9)';g.fillStyle=good?'rgba(100,224,140,.055)':'rgba(255,80,70,.045)';g.lineWidth=1.5;g.setLineDash([7,5]);
 g.beginPath();g.ellipse(c.x,c.y,rx,rx/2,0,0,Math.PI*2);g.fill();g.stroke();g.restore();
}
function drawHomeBuilderOverlay(g){
 if(!S.homeOpen||S.night)return;
 g.save();g.lineWidth=1;g.strokeStyle='rgba(193,241,157,.38)';
 for(let i=8;i<=32;i++)for(let j=2;j<=32;j++){
  if(!homeOwnedCell(S.homeBuilder,i,j)&&!isNorthCliffCrest(S.homeBuilder,i,j))continue;
  const x=i*T,y=j*T,z=runtimeWalkHeight(x,y)??__slice.terrain?.heightAt(x,y)??0;
  const points=[[x-32,y-32],[x+32,y-32],[x+32,y+32],[x-32,y+32]].map(([a,b])=>projectRuntimePoint(a,b,z));
  g.beginPath();points.forEach((p,k)=>k?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.stroke();
 }
 if(S.homeWallPreviewData?.blueprint){
  const proposal=S.homeWallPreviewData;
  g.save();g.strokeStyle=proposal.ok?'#a6f9ad':'#ff8a83';g.lineWidth=3;g.setLineDash([8,5]);
  for(const f of proposal.blueprint){const x=f.x*T,y=f.y*T,ex=x+(f.axis==='x'?(f.len||1)*T:0),ey=y+(f.axis==='y'?(f.len||1)*T:0);
   const a=projectRuntimePoint(x,y,runtimeWalkHeight(x,y)??0),b=projectRuntimePoint(ex,ey,runtimeWalkHeight(ex,ey)??0);
   g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();
  }g.restore();
 }
 if(S.homeTerrainDraft){
  const old=new Map(S.homeBuilder.terrainEdits.map(e=>[e.i+','+e.j,e]));
  for(const edit of S.homeTerrainDraft){const previous=old.get(edit.i+','+edit.j);
   if(previous&&previous.ground===edit.ground&&previous.elevation===edit.elevation&&previous.water===edit.water)continue;
   const x=edit.i*T,y=edit.j*T,z=runtimeWalkHeight(x,y)??__slice.terrain?.heightAt(x,y)??0;
   const corners=[[x-30,y-30],[x+30,y-30],[x+30,y+30],[x-30,y+30]].map(([a,b])=>projectRuntimePoint(a,b,z));
   g.fillStyle=edit.water?'rgba(52,161,218,.52)':edit.elevation?'rgba(195,163,107,.58)':edit.ground==='sand'?'rgba(228,194,115,.4)':edit.ground==='dirt'?'rgba(157,112,70,.42)':'rgba(120,180,98,.42)';
   g.beginPath();corners.forEach((c,k)=>k?g.lineTo(c.x,c.y):g.moveTo(c.x,c.y));g.closePath();g.fill();
  }
 }
 const homeRing=(o,color)=>{
  const def=HOME_ITEMS[o.prefab],c=projectRuntimePoint(o.x,o.y,runtimeWalkHeight(o.x,o.y)??0),rx=Math.max(22,(def?.radius||20)*1.15);
  g.save();g.strokeStyle=color;g.lineWidth=2.5;g.setLineDash([6,4]);g.beginPath();g.ellipse(c.x,c.y,rx,rx/2,0,0,Math.PI*2);g.stroke();g.restore();
 };
 const homeLabel=(point,text,good)=>{
  g.save();g.font='bold 12px system-ui,sans-serif';const w=g.measureText(text).width+14,x=Math.round(point.x-w/2),y=Math.round(point.y+18);
  g.fillStyle=good?'rgba(22,52,30,.92)':'rgba(70,18,18,.92)';g.fillRect(x,y,w,22);g.strokeStyle=good?'#a0f4ac':'#ff8b83';g.lineWidth=1;g.strokeRect(x+.5,y+.5,w-1,21);
  g.fillStyle='#fff';g.textBaseline='middle';g.fillText(text,x+7,y+11);g.restore();
 };
 const selectedHome=S.homeOpen&&S.homeBuilder.placedObjects.find(o=>o.id===S.homeSelectedId);
 if(selectedHome)homeRing(selectedHome,'#ffe27a');
 const hoverObj=S.homeHover&&S.homeAction==='place'?homeObjectAt(S.homeHover.x,S.homeHover.y):null;
 if(hoverObj){
  if(hoverObj.id!==S.homeSelectedId)homeRing(hoverObj,'#bfe9ff');
  const c=projectRuntimePoint(hoverObj.x,hoverObj.y,runtimeWalkHeight(hoverObj.x,hoverObj.y)??0);
  homeLabel(c,'แตะเพื่อเลือก '+(HOME_ITEMS[hoverObj.prefab]?.name||''),true);
 }else if(S.homeHover){
  const h=S.homeHover,move=S.homeAction==='move'?S.homeBuilder.placedObjects.find(o=>o.id===S.homeMovingId):null;
  const type=move?.prefab||S.homeSelected,def=HOME_ITEMS[type],p=snapHome(h.x,h.y);
  if(def){
   const result=S.homeAction==='terrain'?validateHomeTerrainBatch(S.homeBuilder,applyHomeTerrainBrush(S.homeTerrainDraft??S.homeBuilder.terrainEdits,Math.round(p.x/T),Math.round(p.y/T),S.homeTerrainBrush)??[],homeTerrainContext()):
     S.homeAction==='waterfall'?makeHomeWaterfall(S.homeBuilder,{i:Math.round(p.x/T),j:Math.round(p.y/T)},S.homeBuilder.terrainEdits):checkHome(type,p.x,p.y,S.homeRotation,move?.id);
   const affordable=S.homeAction!=='place'||S.gold>=def.gold&&matCount()>=def.mats;
   const good=result.ok&&affordable;
   const point=projectRuntimePoint(p.x,p.y,runtimeWalkHeight(p.x,p.y)??__slice.terrain?.heightAt(p.x,p.y)??0);
   if(S.homeAction==='place'||S.homeAction==='move'||S.homeAction==='recover'){
    if(isHomeNativePath(type)){
     const z=runtimeWalkHeight(p.x,p.y)??0;
     const corners=[[p.x-32,p.y-32],[p.x+32,p.y-32],[p.x+32,p.y+32],[p.x-32,p.y+32]].map(([a,b])=>projectRuntimePoint(a,b,z));
     g.save();g.fillStyle=good?'rgba(110,225,128,.40)':'rgba(236,89,81,.44)';g.strokeStyle=good?'#adf6b8':'#ff8b83';
     g.beginPath();corners.forEach((c,k)=>k?g.lineTo(c.x,c.y):g.moveTo(c.x,c.y));g.closePath();g.fill();g.stroke();g.restore();
    }else placementGhost(g,safeHomeArt(type,S.homeRotation,S.homeVariant),point,good);
   }
   g.strokeStyle=good?'#a0f4ac':'#ff7777';g.fillStyle=good?'rgba(99,220,121,.22)':'rgba(249,81,81,.26)';
   g.lineWidth=2;g.beginPath();g.arc(point.x,point.y,12,0,Math.PI*2);g.fill();g.stroke();
   // Say why before the tap, not after it.
   if(!good)homeLabel(point,result.ok?'Gold หรือวัตถุดิบไม่พอ':(result.reason||'วางไม่ได้'),false);
  }
 }
 g.restore();
}

function drawEdgeArrows(viewport) {
  if (!edgeLayer) { edgeLayer = document.createElement('canvas'); edgeLayer.style.cssText = 'position:absolute;pointer-events:none;z-index:6;background:transparent!important'; canvas.after(edgeLayer); }
  const L = edgeLayer, r = viewport?.rect ?? canvas.getBoundingClientRect();
  const pr = viewport?.parent ?? canvas.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
  if (L.width !== canvas.width || L.height !== canvas.height) { L.width = canvas.width; L.height = canvas.height; }
  const next = [r.left - pr.left, r.top - pr.top, r.width, r.height];
  if (!edgeBounds || next.some((value, i) => value !== edgeBounds[i])) {
    [L.style.left, L.style.top, L.style.width, L.style.height] = next.map(value => `${value}px`);
    edgeBounds = next;
  }
  const g = L.getContext('2d'), W = L.width, H = L.height, pad = 26;
  g.clearRect(0, 0, W, H);
  drawHomeBuilderOverlay(g);
  // The former passive Healing Lodge aura was removed; Heal now belongs to the Warren.
  if(S.wallPreview&&!S.night&&S.wallLevel<PERIMETER_TIERS.length-1&&S.homeBuilder.expandedSides.length){
  g.save();g.strokeStyle='rgba(187,227,175,.95)';g.lineWidth=2.5;g.setLineDash([9,5]);
  for(const f of homePerimeterBlueprint(nextPerimeterTier(S.wallLevel).level,S.homeBuilder)){
   const x=f.x*T,y=f.y*T,ex=x+(f.axis==='x'?(f.len||1)*T:0),ey=y+(f.axis==='y'?(f.len||1)*T:0);
   const p=projectRuntimePoint(x,y,runtimeWalkHeight(x,y)??0),q=projectRuntimePoint(ex,ey,runtimeWalkHeight(ex,ey)??0);
   g.beginPath();g.moveTo(p.x,p.y);g.lineTo(q.x,q.y);g.stroke();
  }
  g.restore();
 }
 if(S.wallPreview&&!S.night&&S.wallLevel<PERIMETER_TIERS.length-1&&!S.homeBuilder.expandedSides.length){
    const radius=nextPerimeterTier(S.wallLevel).radius*T;
    const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dy])=>{
      const x=CENTER.x+dx*radius,y=CENTER.y+dy*radius;
      return projectRuntimePoint(x,y,runtimeWalkHeight(x,y)??0);
    });
    const nextTier=nextPerimeterTier(S.wallLevel);
    g.save();g.strokeStyle=S.wallLevel?'rgba(190,202,211,.94)':'rgba(164,238,162,.94)';g.lineWidth=2.5;g.setLineDash([9,5]);
    g.beginPath();g.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length;i++)g.lineTo(points[i].x,points[i].y);
    g.closePath();g.stroke();g.setLineDash([]);
    g.fillStyle='#ddf4ce';g.strokeStyle='#18291e';g.lineWidth=3;
    g.font='bold 13px system-ui';g.textAlign='center';
    const label=S.wallLevel?`${nextTier.reinforced?'เสริมกำแพงหิน':'เปลี่ยนเป็นกำแพงหิน'} · ขนาดเดิม 15×15 ช่อง`:'สร้างรั้วไม้ · 15×15 ช่อง';
    g.strokeText(label,points[0].x,points[0].y-14);g.fillText(label,points[0].x,points[0].y-14);
    g.restore();
  }
  if((S.building||S.movingTower>=0||S.movingMagicCart>=0)&&S.towerMoveHover){
    const hit=S.towerMoveHover,z=runtimeWalkHeight(hit.x,hit.y)??0,p=projectRuntimePoint(hit.x,hit.y,z),
      isTower=S.movingTower>=0||S.building==='tower',
      good=isTower?canTowerSpot(hit.x,hit.y,S.movingTower):canMagicCartSpot(hit.x,hit.y,S.movingMagicCart);
    const towerLevel=S.movingTower>=0?(S.towers[S.movingTower]?.level||1):1,cartLevel=S.movingMagicCart>=0?(S.magicCarts[S.movingMagicCart]?.level||1):1;
    drawRangeRing(g,hit.x,hit.y,isTower?TOWER_RANGE[towerLevel-1]:MAGIC_CART_RANGE[cartLevel-1],good);
    if(isTower)placementGhost(g,towerArtFor(towerLevel),p,good);
    else {magicCartArt??=magicCartSprite();placementGhost(g,magicCartArt,p,good);}
    g.save();g.strokeStyle=good?'#a9f5a8':'#ff8f7d';g.fillStyle=good?'rgba(140,245,155,.15)':'rgba(255,128,119,.12)';g.lineWidth=2;g.setLineDash([6,4]);
    g.beginPath();g.arc(p.x,p.y,18,0,Math.PI*2);g.fill();g.stroke();g.restore();
  }else if(S.modal==='tower'&&S.towers[S.selectedTower]){
    const t=S.towers[S.selectedTower];drawRangeRing(g,t.x,t.y,TOWER_RANGE[t.level-1]);
  }else if(S.modal==='magicCart'&&S.magicCarts[S.selectedMagicCart]){
    const cart=S.magicCarts[S.selectedMagicCart];drawRangeRing(g,cart.x,cart.y,MAGIC_CART_RANGE[cart.level-1]);
  }
  if (!S.night) return;
  // bucket off-screen raiders by the edge direction they are in, so a wave shows as a few arrows
  const groups = new Map();
  for (const m of S.monsters) {
    if (m.dead || !m.night) continue;
    const p = projectRuntimePoint(m.x, m.y, runtimeWalkHeight(m.x, m.y) ?? 0);
    if (p.x > pad && p.x < W - pad && p.y > pad && p.y < H - pad) continue;
    const a = Math.atan2(p.y - H / 2, p.x - W / 2), key = Math.round(a / (Math.PI / 8));
    const gr = groups.get(key) ?? { a: 0, n: 0, boss: false }; gr.a += a; gr.n++; gr.boss ||= m.boss; groups.set(key, gr);
  }
  const t = performance.now() / 1000;
  for (const gr of groups.values()) {
    const a = gr.a / gr.n, dx = Math.cos(a), dy = Math.sin(a);
    const k = Math.min((W / 2 - pad) / Math.abs(dx || 1e-6), (H / 2 - pad) / Math.abs(dy || 1e-6)), x = W / 2 + dx * k, y = H / 2 + dy * k;
    g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = .75 + Math.sin(t * 6) * .25;
    g.fillStyle = gr.boss ? '#ffd45c' : '#ff5a4a'; g.strokeStyle = 'rgba(20,6,4,.9)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -12); g.lineTo(-4, 0); g.lineTo(-10, 12); g.closePath(); g.stroke(); g.fill();
    g.rotate(-a); g.globalAlpha = 1; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeText(gr.boss ? `บอส +${gr.n}` : gr.n, -dx * 24, -dy * 24 + 4); g.fillStyle = '#fff'; g.fillText(gr.boss ? `บอส +${gr.n}` : gr.n, -dx * 24, -dy * 24 + 4);
    g.restore();
  }
}
let labelTowerCount=-1;
const WORLD_NAMES={hall:'🏠 โพรงกระต่าย',blacksmith:'⚒ โรงตีเหล็ก',resource:'📦 โรงผลิตทรัพยากร',sell:'🛒 รถเข็น · Quick Sell'};
function updateWorldLabels(viewport){
 // During placement all labels remain readable but cannot steal taps/clicks from the map.
 worldLabels.classList.toggle('placement-mode',S.homeOpen||S.building||S.movingTower>=0||S.movingMagicCart>=0);
 const defenseLabelKey=S.towers.length+':'+S.magicCarts.length;
 if(labelTowerCount!==defenseLabelKey){
  labelTowerCount=defenseLabelKey;
  worldLabels.replaceChildren();
  for(const type of ['hall','blacksmith','resource','sell']){
   const b=document.createElement('button');b.type='button';b.className='bc-world-label';
   b.dataset.world=type;b.setAttribute('aria-label','เปิด '+WORLD_NAMES[type]);worldLabels.append(b);
  }
  S.towers.forEach((_,i)=>{
   const b=document.createElement('button');b.type='button';b.className='bc-world-label';
   b.dataset.worldTower=String(i);b.setAttribute('aria-label','เปิดรายละเอียดป้อมธนู '+(i+1));worldLabels.append(b);
  });
  S.magicCarts.forEach((_,i)=>{
   const b=document.createElement('button');b.type='button';b.className='bc-world-label';
   b.dataset.worldMagicCart=String(i);b.setAttribute('aria-label','เปิดรายละเอียดรถยิงเวทย์ '+(i+1));worldLabels.append(b);
  });
 }
 const rect=viewport?.rect??canvas.getBoundingClientRect(),wrap=viewport?.parent??document.getElementById('wrap').getBoundingClientRect();
 const scaleX=rect.width/canvas.width,scaleY=rect.height/canvas.height;
 const staticTargets={hall:{p:CENTER,y:120,name:WORLD_NAMES.hall+' Lv '+S.warren},
  blacksmith:{p:FORGE_POS,y:86,name:WORLD_NAMES.blacksmith+' Lv '+S.forgeLevel},
  resource:{p:RESOURCE_POS,y:86,name:WORLD_NAMES.resource+' Lv '+S.resourceLevel},
  sell:{p:SELL_POS,y:42,name:WORLD_NAMES.sell}};
 for(const b of worldLabels.querySelectorAll('.bc-world-label')){
  const type=b.dataset.world,towerIdx=b.dataset.worldTower,cartIdx=b.dataset.worldMagicCart;
  const target=type?staticTargets[type]:cartIdx!==undefined?{p:S.magicCarts[Number(cartIdx)],y:72,name:'🔮 รถยิงเวทย์ #'+(Number(cartIdx)+1)}:
   {p:S.towers[Number(towerIdx)],y:90,name:'🏹 ป้อมธนู #'+(Number(towerIdx)+1)+' · Lv '+S.towers[Number(towerIdx)].level};
  const label=target.name.replace(/^[\p{Extended_Pictographic}⚒]\uFE0F?\s*/u,'');
  if(b.textContent!==label)b.textContent=label;
  const p=projectRuntimePoint(target.p.x,target.p.y,runtimeWalkHeight(target.p.x,target.p.y)??0);
  const x=rect.left-wrap.left+p.x*scaleX,y=rect.top-wrap.top+(p.y-target.y)*scaleY;
  const visible=x>55&&x<wrap.width-55&&y>30&&y<wrap.height-20;
  b.style.display=visible?'flex':'none';
  if(visible){
   const left=x+'px',top=y+'px';
   if(b.style.left!==left)b.style.left=left;
   if(b.style.top!==top)b.style.top=top;
  }
 }
}

setRuntimePlayerVisual(() => ({ image: null }));
canvas.addEventListener('pointermove',e=>{if(S.building||S.movingTower>=0||S.movingMagicCart>=0||S.homeOpen){const hit=runtimePointerHit(e);if(S.homeOpen)S.homeHover=hit&&hit.idx>=0?{x:hit.x,y:hit.y}:null;else S.towerMoveHover=hit&&hit.idx>=0?{x:hit.x,y:hit.y}:null;}});
canvas.addEventListener('pointerleave',()=>{S.towerMoveHover=null;S.homeHover=null;});
const onWorldTap=(hit,e) => {
  if (S.over || S.modal || S.itemDetailId || !hit || hit.idx < 0) return;
  if(S.homeOpen){if(!S.night){if(S.homeAction==='move'&&S.homeMovingId)moveHome(S.homeMovingId,hit.x,hit.y);else if(S.homeAction==='recover'&&S.homeStoredId)restoreRecoveryHome(hit.x,hit.y);else if(S.homeAction==='terrain')paintHomeTerrain(hit.x,hit.y);else if(S.homeAction==='waterfall')createHomeWaterfall(hit.x,hit.y);else{const found=homeObjectAt(hit.x,hit.y);if(found){S.homeSelectedId=S.homeSelectedId===found.id?null:found.id;S.homePane='decor';renderUi();}else{S.homeSelectedId=null;placeHome(hit.x,hit.y);}}}return;}
  if(S.movingTower>=0){relocateTower(S.movingTower,hit.x,hit.y);return;}
  if(S.movingMagicCart>=0){relocateMagicCart(S.movingMagicCart,hit.x,hit.y);return;}
  if(S.building==='tower'&&!S.night){placeTower(hit.x,hit.y);return;}
  if(S.building==='magicCart'&&!S.night){placeMagicCart(hit.x,hit.y);return;}
  const tower=S.towers.findIndex(t=>dist(t,hit)<64);
  if(tower>=0){S.selectedTower=tower;S.modal='tower';renderUi();return;}
  const cart=S.magicCarts.findIndex(t=>dist(t,hit)<64);
  if(cart>=0){S.selectedMagicCart=cart;S.modal='magicCart';renderUi();return;}
  if(dist(SELL_POS,hit)<78||dist(CART_POS,hit)<62){S.sellConfirm=false;S.modal='sell';renderUi();return;}
  if(dist(RESOURCE_POS,hit)<104){S.modal='resource';renderUi();return;}
  if(dist(FORGE_POS,hit)<104){S.modal='blacksmith';renderUi();return;}
  if(dist(CENTER,hit)<110){S.modal='hall';renderUi();return;}
};
setRuntimeClickHandler(onWorldTap);
// Touch-only gestures. The desktop mouse/wheel handlers in runtime.js are unchanged;
// intercept touch pointerdown before runtime's click handler and dispatch a tap on release.
const mobilePointers=new Map();
let pinchStart=null;
canvas.addEventListener('pointerdown',e=>{
 if(!mobileLayout.matches||e.pointerType!=='touch')return;
 e.preventDefault();e.stopImmediatePropagation();
 canvas.setPointerCapture?.(e.pointerId);
 mobilePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:mobilePointers.size>0});
 if(mobilePointers.size===2){
  const [a,b]=[...mobilePointers.values()];
  a.moved=true;b.moved=true;
  pinchStart={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:getRuntimeZoom()};
 }
},{capture:true});
canvas.addEventListener('pointermove',e=>{
 const p=mobilePointers.get(e.pointerId);if(!p)return;
 e.preventDefault();
 const dx=e.clientX-p.x,dy=e.clientY-p.y;
 p.x=e.clientX;p.y=e.clientY;
 if(mobilePointers.size>=2){
  for(const v of mobilePointers.values())v.moved=true;
  if(mobilePointers.size===2&&pinchStart?.distance>0){
   const [a,b]=[...mobilePointers.values()];
   setRuntimeZoom(pinchStart.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinchStart.distance);
  }
  return;
 }
 if(Math.hypot(p.x-p.startX,p.y-p.startY)>9)p.moved=true;
 if(!p.moved)return;
 const rect=canvas.getBoundingClientRect(),zoom=getRuntimeZoom();
 const sx=-dx*canvas.width/rect.width/zoom,sy=-dy*canvas.height/rect.height/zoom;
 cam.x+=(sx+2*sy)/K;cam.y+=(2*sy-sx)/K;
 cam.x=Math.max(200,Math.min(2360,cam.x));cam.y=Math.max(200,Math.min(2360,cam.y));
});
function finishMobilePointer(e,cancel=false){
 const p=mobilePointers.get(e.pointerId);if(!p)return;
 e.preventDefault();
 const tap=!cancel&&!p.moved&&mobilePointers.size===1&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<10;
 mobilePointers.delete(e.pointerId);
 if(mobilePointers.size<2)pinchStart=null;
 // A remaining finger after pinching must never generate an accidental building tap.
 if(tap)onWorldTap(runtimePointerHit(e),e);
}
canvas.addEventListener('pointerup',e=>finishMobilePointer(e));
canvas.addEventListener('pointercancel',e=>finishMobilePointer(e,true));
let last = performance.now();
setRuntimeActorUpdater(({ player }) => {
  const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now;
  setRuntimePlayerControl(true); moveCamera(dt); player.x = cam.x; player.y = cam.y;
  tick(dt); combatFX.update(dt * S.speed);
  setRuntimeActors([...S.units.filter(u=>!dragonTrial||dragonTrial.fighterIds.has(u.id)).map(u => u.actor ??= unitActor(u)), ...S.monsters.filter(m => !m.dead).map(m => m.actor),...(dragonTrial?.staffActor&&!dragonTrial.staffActor.dead?[dragonTrial.staffActor]:[]),...(dragonTrial?.cloneActors||[]).filter(actor=>!actor.dead), ...S.towers.map(t => t.actor),...S.magicCarts.map(t=>t.actor), hallActor, ...combatFX.getRuntimeActors()]);
  // One layout snapshot for all overlays avoids repeated forced reflow at high mob counts.
  const viewport={rect:canvas.getBoundingClientRect(),parent:worldLabels.parentElement.getBoundingClientRect()};
  mythicCinematic?.update(dt);wukongCinematic?.update(dt);arthurCinematic?.update(dt);
  skillFx?.update(dt); skillFx?.draw(viewport); floaters?.update(dt); floaters?.draw(viewport);
  drawEdgeArrows(viewport);updateWorldLabels(viewport);syncClock();
  if(uiDirty&&now-lastUiPaint>=120)renderUi();
});
skillFx = createSkillFx(canvas); floaters = createFloaters(canvas);
mythicCinematic = createMythicCinematic(canvas,skillFx,CENTER,{onBattle:(position,frames)=>beginMythicTrial(position,frames,'ancientDragon'),onStop:endDragonTrial});
const wukongBattleEntry={x:CENTER.x-220,y:CENTER.y+220};
wukongCinematic=createWukongCinematic({onBattle:()=>beginMythicTrial(wukongBattleEntry,{walk:wukongWalkFrames,hit:wukongHitFrames,combined:wukongCombinedStrikeFrames,combinedLeft:wukongCombinedStrikeFramesLeft},'sunWukong'),onStop:endDragonTrial});
// Use the established left-side approach instead of spawning inside the hall footprint.
const arthurBattleEntry={...wukongBattleEntry};
arthurCinematic=createArthurCinematic({onBattle:()=>beginMythicTrial(arthurBattleEntry,{walk:arthurWalkFrames,attack:arthurAttackFrames},'kingArthur'),onStop:endDragonTrial});
const resumed = load();
if (!resumed) { recruit('guard', true); recruit('archer', true); }
renderUi();
setRuntimeZoomRange(mobileLayout.matches ? .26 : .45, 1.3); // portrait can pinch farther out to see the whole village
// Loading screen: the engine writes stage messages into #loading; turn them into bar progress.
const loadingScreen=$('loadingScreen');
function setLoadingProgress(p){
 if(!loadingScreen)return;
 const v=Math.max(0,Math.min(100,Math.round(p)));
 loadingScreen.style.setProperty('--p',v+'%');loadingScreen.setAttribute('aria-valuenow',v);
}
function loadingProgressFor(text){
 const pct=Number(text.match(/(\d+)%/)?.[1]);
 if(text.includes('วาดพื้น')&&Number.isFinite(pct))return 35+pct*.55;
 if(text.includes('ต้นไม้'))return 15;
 if(text.includes('วางของ'))return 28;
 if(text.includes('cache'))return text.includes('แล้ว')?88:40;
 return null;
}
if(loadingScreen&&$('loading')){
 setLoadingProgress(6);
 new MutationObserver(()=>{const p=loadingProgressFor($('loading')?.textContent||'');if(p!=null)setLoadingProgress(p);})
  .observe($('loading'),{childList:true,characterData:true,subtree:true});
}
await boot(scene, { canvasEl: canvas, loadingEl: $('loading'), playerSprites: null, worldScale: 1.45, zoom: mobileLayout.matches ? .45 : .62 });
// The runtime minimap occupies canvas pixels x=1044..1264, y=16..156.
// Anchor the Relic Collection launcher immediately beneath it, respecting letterboxing.
function alignRelicLauncher(){
  const dock=$('relicLauncher'),rect=canvas.getBoundingClientRect(),scale=rect.width/1280;
  if(!dock)return;
  dock.style.left=(rect.left+1044*scale)+'px';
  dock.style.top=(rect.top+165*scale)+'px';
  dock.style.width=(220*scale)+'px';
}
alignRelicLauncher();addEventListener('resize',alignRelicLauncher);
// Authored fences restore after world placement; live fences use exactly the same engine primitives.
for(const fence of S.fences)installFence(fence);
restoreHomeWorld();
mythicPanel=document.createElement('div');mythicPanel.className='panel bc-modal';mythicPanel.hidden=true;mythicPanel.setAttribute('role','dialog');mythicPanel.setAttribute('aria-modal','true');document.body.append(mythicPanel);
function renderMythicPanel(){
 const pending=S.mythic.pending,boss=MYTHIC_BOSSES[pending?.bossId]||MYTHIC_BOSSES.ancientDragon,chosen=new Set(S.mythic.selected),relic=MYTHIC_RELICS[boss.relic],units=S.units.map(u=>`<label style="display:flex;gap:9px;align-items:center;padding:9px;border:1px solid #52634b;border-radius:8px"><input type="checkbox" data-mythic-unit="${u.id}" ${chosen.has(u.id)?'checked':''}><span>${CLASSES[u.cls]?.icon||'🐰'} ${u.name} · ${CLASSES[u.cls]?.name||u.cls} Lv${u.level}</span></label>`).join('');
 const bossIcon={ancientDragon:'🐲',sunWukong:'🐒',kingArthur:'⚔️'}[boss.id]||'✦';
 mythicPanel.innerHTML=`<header class="bc-modal-header"><div><span>${bossIcon}</span><span><h2>Mythic Invasion</h2><small>${pending?'ลางร้ายปรากฏแล้ว · เตรียมทีมก่อนรับคำท้า':'Mythic Archive และรางวัลสะสม'}</small></span></div><button data-mythic-close>✕</button></header><div class="bc-modal-body"><section class="bc-guide-card"><h3>${pending?boss.name+' · ประตู'+({west:'ตะวันตก',east:'ตะวันออก',south:'ใต้'}[pending.gate]):'ยังไม่มี Mythic Omen'}</h3><p>ศึกนี้ลงได้สูงสุด 7 ตัวและคลาสละ 1 ตัว ป้อม/รถยิงเวทย์ใช้ Armory และ Mastery ได้ แต่กระต่ายจะไม่ใช้ Skill Core</p></section><section class="bc-guide-card"><h3>จัดกองทัพ ${chosen.size}/7</h3><div style="display:grid;gap:7px">${units||'<p>ยังไม่มีกระต่าย</p>'}</div></section><section class="bc-guide-card"><h3>Mythic Archive</h3><p>Option Stone ${S.mythic.optionStones} · Re-option Stone ${S.mythic.reoptionStones} · Essence ${S.mythic.essence}</p><p>${S.mythic.relics[boss.relic]?'✦ '+relic.name+' · '+relic.bonus:'ยังไม่มี Legendary Relic · ชนะมีโอกาสดรอป 20%'}</p></section>${pending?'<button data-mythic-start style="width:100%;min-height:48px">⚔️ รับคำท้าและเริ่ม Invasion</button><button data-mythic-decline style="width:100%;margin-top:8px">ปฏิเสธ Omen</button>':'<p style="opacity:.8">มีโอกาส 15% หลังผ่านคืนปกติ · สุ่ม World Boss ที่เปิดใช้งานในอัตราเท่ากัน</p>'}</div>`;
 mythicPanel.querySelector('[data-mythic-close]').onclick=()=>{mythicPanel.hidden=true;$('modalScrim').hidden=true;};
 mythicPanel.querySelectorAll('[data-mythic-unit]').forEach(x=>x.onchange=()=>{let ids=[...mythicPanel.querySelectorAll('[data-mythic-unit]:checked')].map(x=>+x.dataset.mythicUnit);const valid=validMythicSquad(S.units,ids);if(valid.length!==ids.length){toast('Mythic Squad เลือกได้คลาสละ 1 ตัวเท่านั้น');x.checked=false;}S.mythic.selected=valid.map(u=>u.id);save();renderMythicPanel();});
 mythicPanel.querySelector('[data-mythic-decline]')?.addEventListener('click',()=>{S.mythic.pending=null;S.mythic.selected=[];save();renderMythicPanel();toast('ปฏิเสธ Mythic Omen แล้ว');});
 mythicPanel.querySelector('[data-mythic-start]')?.addEventListener('click',()=>{const team=validMythicSquad(S.units,S.mythic.selected);if(!team.length)return toast('เลือกกระต่ายอย่างน้อย 1 ตัว');mythicPanel.hidden=true;$('modalScrim').hidden=true;if(!startPendingMythicCinematic()){mythicPanel.hidden=false;$('modalScrim').hidden=false;toast('กำลังโหลดเฟรมบอส ลองอีกครั้ง');}});
}
showMythicRewardModal=(won,reward,bossId='ancientDragon')=>{const boss=MYTHIC_BOSSES[bossId]||MYTHIC_BOSSES.ancientDragon;
 const relic=MYTHIC_RELICS[boss.relic],icon=relicIconPath(boss.relic);
 const item=reward.relic?`${icon?`<img src="${icon}" alt="${relic.name}" width="64" height="64" style="image-rendering:pixelated;vertical-align:middle"> `:''}${reward.duplicate?relic.name+' ซ้ำ · แปลงเป็น Essence +1':'✦ NEW! '+relic.name+' · '+relic.bonus}`:
   won?'รอบนี้ยังไม่พบ Legendary Relic · โอกาสดรอป 20%':'Legendary Relic ดรอปเฉพาะเมื่อพิชิตบอส';
 mythicPanel.innerHTML=`<header class="bc-modal-header"><div><span>${won?'🏆':'⚔️'}</span><span><h2>${won?'กำจัด '+boss.name+' สำเร็จ!':'กองทัพพ่ายแพ้'}</h2><small>Mythic Invasion Result</small></span></div><button data-reward-close>✕</button></header>
 <div class="bc-modal-body"><section class="bc-guide-card"><h3>${won?'Victory Rewards':'Participation Rewards'}</h3><p>🔮 Option Stone × ${reward.optionStone}</p><p>♻️ Re-option Stone × ${reward.reoptionStone}</p><p>${item}</p>${won?'<p>🏆 พิชิต '+boss.name+' สะสม '+(S.mythic.defeats[bossId]||0)+' ครั้ง</p>':''}</section>
 <div style="display:flex;gap:9px;flex-wrap:wrap"><button type="button" data-reward-open-archive class="bc-primary" style="flex:1;min-height:46px">✧ ดู Relic Collection</button><button type="button" data-reward-close style="flex:1;min-height:46px">กลับหมู่บ้าน</button></div></div>`;
 mythicPanel.hidden=false;$('modalScrim').hidden=false;
 mythicPanel.querySelectorAll('[data-reward-close]').forEach(b=>b.onclick=()=>{mythicPanel.hidden=true;renderUi();});
 mythicPanel.querySelector('[data-reward-open-archive]').onclick=()=>{mythicPanel.hidden=true;S.archiveTab='first';S.archiveBossId=bossId;S.modal='relicCollection';renderUi();};
};
$('modalScrim').addEventListener('click',()=>{mythicPanel.hidden=true;renderUi();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!mythicPanel.hidden){mythicPanel.hidden=true;$('modalScrim').hidden=true;}});
// Hover/focus shows the NEXT automatic perimeter's actual footprint, without extra controls.
const wallButton=$('fenceBuild');
wallButton.addEventListener('pointerenter',()=>{S.wallPreview=true;});
wallButton.addEventListener('pointerleave',()=>{S.wallPreview=false;});
wallButton.addEventListener('focus',()=>{S.wallPreview=true;});
wallButton.addEventListener('blur',()=>{S.wallPreview=false;});
{ const l = $('loading'); if (l) l.hidden = true; }
if(loadingScreen){setLoadingProgress(100);setTimeout(()=>{loadingScreen.classList.add('done');setTimeout(()=>loadingScreen.remove(),500);},250);}
banner(resumed ? `กลับมาแล้ว · วันที่ ${S.day}` : 'วันที่ 1', resumed ? `บ้าน Lv ${S.warren} · เวฟ ${S.warren}-${S.wave}` : 'กระต่ายฟาร์มเองรอบหมู่บ้าน · คลิกป้อมเพื่อจัดทหารประจำป้อม');
if(!IS_CINEMATIC_PREVIEW&&shouldShowWaterfallIntro()&&!S.mythic.pending)openWaterfallGuide('intro');
if(!IS_CINEMATIC_PREVIEW&&S.mythic.pending)setTimeout(()=>{S.modal=null;renderUi();if(!startPendingMythicCinematic())setTimeout(startPendingMythicCinematic,800);},900);
function startMythicTestBoss(bossId){
 if(!MYTHIC_BOSSES[bossId]||dragonTrial||mythicCinematic?.active||wukongCinematic?.active||arthurCinematic?.active)return false;
 S.mythic={...S.mythic,pending:{bossId,day:S.day,gate:'west'},selected:defaultMythicSquad(S.units)};
 S.modal=null;renderUi();return startPendingMythicCinematic();
}
const mythicTestBoss=$('mythicTestBoss'),mythicTestSummon=$('mythicTestSummon');
if(mythicTestBoss)mythicTestBoss.innerHTML=Object.values(MYTHIC_BOSSES).map(boss=>`<option value="${boss.id}">${boss.name} · ${boss.nameTh}</option>`).join('');
mythicTestSummon?.addEventListener('click',()=>{const started=startMythicTestBoss(mythicTestBoss.value);mythicTestSummon.disabled=started;mythicTestSummon.textContent=started?'✓ อัญเชิญแล้ว':'⚠ เรียกไม่ได้ตอนนี้';setTimeout(()=>{mythicTestSummon.disabled=false;mythicTestSummon.textContent='⚔ อัญเชิญบอส'},1400);});
window.__warren = S; window.__warrenDev = { recruit:(cls)=>recruit(cls,true),spawnMonster:(...args)=>spawnMonster(...args),
  startMythicTestBoss,mythicBosses:MYTHIC_BOSSES,
  masteryOnHit:(u,m)=>castMasteryOnBasicHit(u,m),
  castCore:(u,m,skillId)=>{const skill=classActiveCores(S,u?.cls).find(x=>x.id===skillId);return Boolean(u&&m&&skill&&castEquippedCore(u,m,skill));},
  placeHome,moveHome,demolishHome,undoHome,checkHome,setHomeOpen,rebuildHomeWorld,waitHomeGround:homeController.waitHomeGround,buyHomePlot,previewHomeWall,expandHomeWall,paintHomeTerrain,commitHomeTerrain,createHomeWaterfall,restoreRecoveryHome,
  placeTower, canWalkStraight, canRuntimeActorStand, defenseSpot, upgradePerimeter, hurtPerimeter, rebuildPerimeter, perimeterHealth:()=>perimeterHealth(S.fences), renderUi, save, upgradeWarren, hireGarrison:(index,cls)=>hireGarrison(S.towers[index],cls),upgradeTower:index=>upgradeTower(S.towers[index]),
  beginTowerMove,relocateTower,canTowerSpot,placeMagicCart,hireMagicCartMage,upgradeMagicCart,beginMagicCartMove,relocateMagicCart,canMagicCartSpot,magicCartCap,defensePost:ringPost,upgradeForgeBuilding,upgradeResourceBuilding,useHallHeal,updateWorldLabels,quoteQuickSell:()=>quoteQuickSell(S.inventory,S.sellReserve,S.sellSelected),commitQuickSell:()=>{const q=commitQuickSell(S,S.sellReserve,S.sellSelected);if(q){save();renderUi();}return q;}, craftBatch:(id,n)=>{const pieces=craftBatch(S,id,n);save();renderUi();return pieces;},enhanceAll:cls=>{const r=enhanceAll(S,cls);refreshArmy();save();renderUi();return r;},refineGear:id=>{const r=refineGear(S,id);refreshArmy();save();renderUi();return r;}, craftGear:id=>{const item=craftGear(S,id);refreshArmy();save();renderUi();return item;},enhanceGear:id=>{const r=enhanceGear(S,id);refreshArmy();save();renderUi();return r;},dismantleGear:id=>{const n=dismantleGear(S,id);save();renderUi();return n;},autoEquipBuild:(cls,id)=>{const n=autoEquipBuild(S,cls,id);refreshArmy();save();renderUi();return n;} }; // dev hooks
window.__warrenStep = // dev: fast-forward the simulation (balance tests)
  sec => { for (let t = 0; t < sec && !S.over; t += 1 / 30) { tick(1 / 30); combatFX.update(1 / 30); } renderUi(); };
