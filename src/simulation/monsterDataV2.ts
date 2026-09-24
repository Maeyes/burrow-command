import type { LootSourceV2 } from './loot';
import type { EnemyRank } from './mastery';
import { blueprintForLevel, GLOBAL_BLUEPRINT_DROP_CHANCE } from './itemMasterV2';

export interface MonsterDefinitionV2 {
 id:string;name:string;mapId:'forest1'|'forest2'|'desert1'|'desert2'|'mine'|'magma1'|'magma2';level:number;rank:EnemyRank;
 maxHp:number;atk:number;def:number;mdef:number;flee:number;attackRange:number;moveSpeed:number;attackIntervalMs:number;loot:LootSourceV2;
}
type Spec=Omit<MonsterDefinitionV2,'loot'> & {ore:string;material?:[string,number];aether?:[string,number];modifier?:[string,number];core?:[string,number];blueprint?:[string,number];unique?:[string,number];signature?:[string,number];equipmentDrops?:Array<[string,number]>};
// Drop tuning (2026-09-24): no-use-case drops (signature/unique) removed, every remaining
// drop raised. Specs keep the authored base rates; these multipliers apply on top.
export const DROP_TUNING_V2={material:1.3,aether:1.5,modifier:1.5,core:2,equipment:1.5} as const;
const tuned=(roll:[string,number]|undefined,k:number,rank:EnemyRank,scaleBoss=true)=>roll&&{itemId:roll[0],chance:Math.min(1,roll[1]*(rank==='boss'&&!scaleBoss?1:k))};
const mk=(s:Spec):MonsterDefinitionV2=>{const forest2=s.mapId==='forest2';const blueprintChance=forest2?(s.rank==='boss'?.10:s.rank==='elite'?.08:.06):GLOBAL_BLUEPRINT_DROP_CHANCE;const rankGoldMultiplier=s.rank==='boss'?1.44:s.rank==='elite'?1.2:1;const lateGameGoldScale=s.level<=40?1:Math.pow(1.03,s.level-40);const averageGold=6*Math.pow(s.level,1.35)*rankGoldMultiplier*lateGameGoldScale;const T=DROP_TUNING_V2;return{...s,loot:{id:s.id,rank:s.rank,level:s.level,goldMin:Math.max(1,Math.round(averageGold*.8)),goldMax:Math.max(1,Math.round(averageGold*1.2)),oreItemId:s.ore,material:tuned(s.material,T.material,s.rank),aetherstone:tuned(s.aether,T.aether,s.rank),modifier:tuned(s.modifier,T.modifier,s.rank),
 // Boss cores already have pity (pity.ts); only normal/elite core rates are doubled.
 core:tuned(s.core,T.core,s.rank,false),blueprint:{itemId:blueprintForLevel(s.level),chance:blueprintChance},equipmentDrops:s.equipmentDrops?.map(([itemId,chance])=>({itemId,chance:Math.min(1,chance*T.equipment)}))}}};
const MAP_DIFFICULTY:Record<Spec['mapId'],number>={forest1:1,forest2:1.75,desert1:2.8,desert2:4.35,mine:6.5,magma1:8.5,magma2:11};
const n=(id:string,name:string,mapId:Spec['mapId'],level:number,rank:EnemyRank,ore:string,extra:Partial<Spec>={}):MonsterDefinitionV2=>{
 // Map progression is exponential: every new region is a meaningful combat step rather than
 // reusing one flat stat block. Forest 1 remains the onboarding anchor.
 const mapScale=MAP_DIFFICULTY[mapId];
 const levelScale=Math.pow(1.018,Math.max(0,level-3));
 const rankHp=rank==='boss'?5.0:rank==='elite'?2.25:1;
 const rankAtk=rank==='boss'?1.75:rank==='elite'?1.35:1;
 const rankDefense=rank==='boss'?1.8:rank==='elite'?1.4:1;
 const baseHp=106,baseAtk=12,baseDef=7,baseMdef=3;
 return mk({id,name,mapId,level,rank,ore,
  maxHp:Math.round(baseHp*mapScale*levelScale*rankHp),
  atk:Math.round(baseAtk*Math.pow(mapScale,.72)*Math.pow(levelScale,.55)*rankAtk),
  def:Math.round(baseDef*Math.pow(mapScale,.82)*Math.pow(levelScale,.7)*rankDefense),
  mdef:Math.max(3,Math.round(baseMdef*Math.pow(mapScale,.86)*Math.pow(levelScale,.72)*rankDefense)),
  flee:85+level*2+Math.round((mapScale-1)*4),
  attackRange:rank==='boss'?62:rank==='elite'?48:42,moveSpeed:rank==='boss'?52:68,attackIntervalMs:rank==='boss'?1100:850,...extra});
};
export const MONSTERS_V2:Record<string,MonsterDefinitionV2>=Object.fromEntries([
 n('mossblob1','Stone Mossblob','forest1',1,'normal','copperOre',{material:['livingMoss',.45],aether:['verdantAetherstone',.10],modifier:['lifeDrain',.007]}),
 n('barkBeetle3','Mossback Beetle','forest1',3,'normal','copperOre',{material:['livingMoss',.45],aether:['verdantAetherstone',.10],modifier:['lifeDrain',.007]}),
 n('barkBeetle2','Bark Beetle','forest1',6,'normal','copperOre',{material:['livingMoss',.45],aether:['verdantAetherstone',.10],modifier:['lingering',.008],core:['barrier',.0015]}),
 n('barkBeetle1','Elite Bark Beetle','forest1',9,'elite','copperOre',{material:['livingMoss',1],aether:['verdantAetherstone',.30],modifier:['lifeDrain',.07],core:['barrier',.03]}),
 n('mossblob2','Elite Mossblob','forest1',7,'elite','copperOre',{material:['livingMoss',1],aether:['verdantAetherstone',.30],modifier:['lifeDrain',.07],core:['barrier',.03]}),
 n('mossblob3','Mossblob','forest1',2,'normal','copperOre',{material:['livingMoss',.45],aether:['verdantAetherstone',.10],equipmentDrops:[['forestLeaf',.005]]}),
 n('sporekin1','Poison Spore','forest1',4,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.10],modifier:['lingering',.008],core:['blackHole',.0015]}),
 n('sporekin2','Elite Spore','forest1',8,'elite','copperOre',{material:['brutalSpore',1],aether:['verdantAetherstone',.30],modifier:['lingering',.07],core:['blackHole',.03]}),
 n('sporekin3','Spore','forest1',5,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.10],modifier:['lingering',.005],equipmentDrops:[['sporeGoggles',.005],['mushroomCap',.003]]}),
 n('mushroom','Mushroom Brute','forest1',10,'boss','copperOre',{aether:['verdantAetherstone',.40],modifier:['expandedArea',.20],core:['cyclone',.10],equipmentDrops:[['mossCrown',.08]]}),
 n('thornBoar3','Bristle Boar','forest2',13,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.18],modifier:['execution',.008]}),
 n('thornBoar2','Thorn Boar','forest2',16,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.18],modifier:['execution',.008],core:['groundSlam',.0015]}),
 n('thornBoar1','Elite Thorn Boar','forest2',17,'elite','copperOre',{material:['brutalSpore',1],aether:['verdantAetherstone',.50],modifier:['execution',.07],core:['groundSlam',.03]}),
 n('acorn1','Elite Acorn Guard','forest2',18,'elite','copperOre',{material:['livingMoss',1],aether:['verdantAetherstone',.50],modifier:['execution',.07],core:['groundSlam',.03]}),
 n('acorn2','Acorn Guard','forest2',11,'normal','copperOre',{material:['livingMoss',.40],aether:['verdantAetherstone',.18],modifier:['execution',.007]}),
 n('acorn3','Flash Acorn Guard','forest2',14,'normal','copperOre',{material:['livingMoss',.40],aether:['verdantAetherstone',.18],modifier:['execution',.008],core:['groundSlam',.0015]}),
 n('twig1','Elite Twig Imp','forest2',19,'elite','copperOre',{material:['brutalSpore',1],aether:['verdantAetherstone',.50],modifier:['rapidCasting',.07],core:['chainLightning',.03]}),
 n('twig2','Female Twig Imp','forest2',12,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.18],modifier:['rapidCasting',.008],equipmentDrops:[['luckyTwig',.006]]}),
 n('twig3','Male Twig Imp','forest2',15,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.18],modifier:['rapidCasting',.008],core:['chainLightning',.0015]}),
 n('thornroot','Thornroot Warden','forest2',20,'boss','copperOre',{aether:['verdantAetherstone',.45],modifier:['lingering',.20],core:['frostNova',.10]}),
 n('mirageJackal3','Dune Jackal','desert1',23,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.10],modifier:['mobileCast',.008]}),
 n('mirageJackal2','Mirage Jackal','desert1',25,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.10],modifier:['mobileCast',.009],core:['dash',.002]}),
 n('mirageJackal1','Elite Mirage Jackal','desert1',27,'elite','moonstoneShard',{material:['duneRunnerClaw',1],aether:['azureAetherstone',.30],modifier:['mobileCast',.07],core:['dash',.04]}),
 n('duneling3','Duneling','desert1',21,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.10],modifier:['mobileCast',.007]}),
 n('duneling2','Dune Runner','desert1',24,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.10],modifier:['mobileCast',.009],core:['dash',.002],equipmentDrops:[['desertGoggles',.006]]}),
 n('duneling1','Elite Duneling','desert1',28,'elite','moonstoneShard',{material:['duneRunnerClaw',1],aether:['azureAetherstone',.30],modifier:['mobileCast',.07],core:['dash',.04]}),
 n('cactling1','Cactling Bandit','desert1',22,'normal','moonstoneShard',{material:['cactusSpine',.50],aether:['azureAetherstone',.10],modifier:['combustion',.008],equipmentDrops:[['cactusCrown',.006]]}),
 n('cactling3','Bloom Cactling','desert1',26,'normal','moonstoneShard',{material:['cactusSpine',.45],aether:['azureAetherstone',.10],modifier:['combustion',.009],core:['fireball',.002],equipmentDrops:[['desertScarf',.006]]}),
 n('cactling2','Elite Cactling Bandit','desert1',29,'elite','moonstoneShard',{material:['cactusSpine',1],aether:['azureAetherstone',.30],modifier:['combustion',.08],core:['fireball',.04]}),
 n('dunemaw','Dune Maw','desert1',30,'boss','moonstoneShard',{aether:['azureAetherstone',.40],modifier:['echo',.20],core:['meteorStorm',.10]}),
 n('sandScorpion1','Sand Scorpion','desert2',33,'normal','moonstoneShard',{material:['cactusSpine',.50],aether:['azureAetherstone',.12],modifier:['chain',.009],core:['lightningField',.002]}),
 n('sandScorpion2','Elite Sand Scorpion','desert2',37,'elite','moonstoneShard',{material:['cactusSpine',1],aether:['azureAetherstone',.35],modifier:['chain',.08],core:['lightningField',.04]}),
 n('dust3','Dust Djinn','desert2',31,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.12],modifier:['rapidCasting',.01]}),
 n('dust2','Mirage Djinn','desert2',34,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.12],modifier:['mobileCast',.01],core:['blink',.002]}),
 n('dust1','Elite Dust Djinn','desert2',38,'elite','moonstoneShard',{material:['duneRunnerClaw',1],aether:['azureAetherstone',.35],modifier:['rapidCasting',.08],core:['blink',.04]}),
 n('scarab1','Sunscarab','desert2',32,'normal','moonstoneShard',{material:['cactusSpine',.50],aether:['azureAetherstone',.12],modifier:['chain',.008]}),
 n('scarab2','Solar Scarab','desert2',36,'normal','moonstoneShard',{material:['cactusSpine',.50],aether:['azureAetherstone',.12],modifier:['overcharge',.01],core:['lightningField',.002]}),
 n('scarab3','Elite Sunscarab','desert2',39,'elite','moonstoneShard',{material:['cactusSpine',1],aether:['azureAetherstone',.35],modifier:['chain',.08],core:['lightningField',.04]}),
 n('colossus','Sunforge Colossus','desert2',40,'boss','moonstoneShard',{aether:['azureAetherstone',.45],modifier:['extraStrike',.20],core:['thunderStorm',.10],equipmentDrops:[['sunscarabHelm',.08]]}),
 // Mine roster (PixelLab 2026-09-24): moles, goblin workers, skeleton workers.
 n('emeraldMole','Emerald Mole','mine',41,'normal','mithrilOre',{material:['goblinIronScrap',.45],aether:['azureAetherstone',.10],modifier:['concentratedForce',.006]}),
 n('goblinWorker','Goblin Worker','mine',42,'normal','mithrilOre',{material:['goblinIronScrap',.45],aether:['azureAetherstone',.10],modifier:['concentratedForce',.006],equipmentDrops:[['goblinMinerHelm',.006]]}),
 n('oreMole','Ore Mole','mine',42,'normal','mithrilOre',{material:['goblinIronScrap',.50],aether:['azureAetherstone',.10],modifier:['execution',.008]}),
 n('goblinDigger','Goblin Digger','mine',43,'normal','mithrilOre',{material:['goblinIronScrap',.55],aether:['azureAetherstone',.10],modifier:['execution',.01],equipmentDrops:[['goblinEyepatch',.006]]}),
 n('skeletonWorker','Skeleton Worker','mine',44,'normal','mithrilOre',{material:['cursedBone',.45],aether:['azureAetherstone',.10],modifier:['bloodPrice',.01],equipmentDrops:[['boneVisor',.006]]}),
 n('ironMole','Iron Mole','mine',44,'normal','mithrilOre',{material:['goblinIronScrap',.50],aether:['azureAetherstone',.10],modifier:['concentratedForce',.008]}),
 n('sapphireMole','Sapphire Mole','mine',45,'normal','mithrilOre',{material:['cursedBone',.45],aether:['azureAetherstone',.12],modifier:['overcharge',.01],core:['warCry',.002]}),
 n('skeletonDigger','Skeleton Digger','mine',46,'normal','mithrilOre',{material:['cursedBone',.50],aether:['azureAetherstone',.10],modifier:['bloodPrice',.01],equipmentDrops:[['boneCharm',.006]]}),
 n('rubyMole','Ruby Mole','mine',47,'elite','mithrilOre',{material:['goblinIronScrap',1],aether:['azureAetherstone',.35],modifier:['execution',.08],core:['bladeRush',.04]}),
 n('skeletonMiner','Skeleton Miner','mine',47,'elite','mithrilOre',{material:['cursedBone',1],aether:['azureAetherstone',.35],modifier:['bloodPrice',.08],core:['warCry',.04]}),
 n('goblinForeman','Goblin Foreman','mine',48,'elite','mithrilOre',{material:['goblinIronScrap',1],aether:['azureAetherstone',.35],modifier:['concentratedForce',.08],core:['warCry',.04],equipmentDrops:[['foremanHelm',.03]]}),
 n('goblinLeader','Goblin Leader','mine',50,'boss','mithrilOre',{aether:['azureAetherstone',.45],modifier:['concentratedForce',.20],core:['bladeRush',.10]}),
 // Magma roster (PixelLab 2026-09-24). Levels follow the planned 10-per-map layout;
 // the older maps are remapped to it separately.
 n('emberImp','Ember Imp','magma1',51,'normal','obsidianOre',{material:['magmaCore',.45],aether:['azureAetherstone',.12],modifier:['combustion',.01]}),
 n('fireDrake','Fire Drake','magma1',52,'normal','obsidianOre',{material:['drakeScale',.45],aether:['azureAetherstone',.12],modifier:['lingering',.01],core:['fireball',.002]}),
 n('cinderImp','Cinder Imp','magma1',53,'normal','obsidianOre',{material:['magmaCore',.50],aether:['azureAetherstone',.12],modifier:['rapidCasting',.01],equipmentDrops:[['impHorns',.006]]}),
 n('scorchwing','Scorchwing','magma1',54,'normal','obsidianOre',{material:['drakeScale',.45],aether:['azureAetherstone',.12],modifier:['overcharge',.01]}),
 n('emberDrake','Ember Drake','magma1',55,'normal','obsidianOre',{material:['drakeScale',.50],aether:['azureAetherstone',.12],modifier:['lingering',.01],equipmentDrops:[['drakeFang',.006]]}),
 n('ashwing','Ashwing','magma1',55,'normal','obsidianOre',{material:['magmaCore',.45],aether:['azureAetherstone',.12],modifier:['combustion',.01],core:['meteorStorm',.002]}),
 n('blazeImp','Blaze Imp','magma1',56,'elite','obsidianOre',{material:['magmaCore',1],aether:['azureAetherstone',.35],modifier:['combustion',.08],core:['fireball',.04]}),
 n('eliteFireDrake','Elite Fire Drake','magma1',57,'elite','obsidianOre',{material:['drakeScale',1],aether:['azureAetherstone',.35],modifier:['lingering',.08],core:['fireball',.04]}),
 n('eliteScorchwing','Elite Scorchwing','magma1',58,'elite','obsidianOre',{material:['drakeScale',1],aether:['azureAetherstone',.35],modifier:['overcharge',.08],core:['meteorStorm',.04]}),
 n('ignaroth','Ignaroth, the Red Wyrm','magma1',60,'boss','obsidianOre',{aether:['azureAetherstone',.45],modifier:['echo',.20],core:['meteorStorm',.10],equipmentDrops:[['dragonCrest',.08]]}),
 n('cinderColt','Cinder Colt','magma2',61,'normal','obsidianOre',{material:['drakeScale',.45],aether:['azureAetherstone',.12],modifier:['mobileCast',.01],core:['dash',.002]}),
 n('fireLizard','Fire Lizard','magma2',62,'normal','obsidianOre',{material:['drakeScale',.45],aether:['azureAetherstone',.12],modifier:['chain',.01],equipmentDrops:[['emberGoggles',.006]]}),
 n('fireGolem','Fire Golem','magma2',63,'normal','obsidianOre',{material:['magmaCore',.45],aether:['azureAetherstone',.12],modifier:['concentratedForce',.01]}),
 n('flameColt','Flame Colt','magma2',64,'normal','obsidianOre',{material:['drakeScale',.50],aether:['azureAetherstone',.12],modifier:['mobileCast',.01]}),
 n('emberLizard','Ember Lizard','magma2',65,'normal','obsidianOre',{material:['drakeScale',.50],aether:['azureAetherstone',.12],modifier:['chain',.01]}),
 n('magmaGolem','Magma Golem','magma2',65,'normal','obsidianOre',{material:['magmaCore',.50],aether:['azureAetherstone',.12],modifier:['extraStrike',.01],core:['groundSlam',.002],equipmentDrops:[['magmaKnuckle',.006]]}),
 n('eliteCinderColt','Elite Cinder Colt','magma2',66,'elite','obsidianOre',{material:['drakeScale',1],aether:['azureAetherstone',.35],modifier:['mobileCast',.08],core:['dash',.04]}),
 n('lavaLizard','Lava Lizard','magma2',67,'elite','obsidianOre',{material:['drakeScale',1],aether:['azureAetherstone',.35],modifier:['chain',.08],core:['fireball',.04]}),
 n('infernalGolem','Infernal Golem','magma2',68,'elite','obsidianOre',{material:['magmaCore',1],aether:['azureAetherstone',.35],modifier:['extraStrike',.08],core:['groundSlam',.04],equipmentDrops:[['obsidianMask',.03]]}),
 n('darkDragonKnight','Dark Dragon Knight','magma2',70,'boss','obsidianOre',{aether:['azureAetherstone',.45],modifier:['bloodPrice',.20],core:['bladeRush',.10],equipmentDrops:[['knightsHelm',.08]]}),
].map(x=>[x.id,x]));
