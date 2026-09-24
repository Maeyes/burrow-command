import type { LootSourceV2 } from './loot';
import type { EnemyRank } from './mastery';
import { blueprintForLevel, GLOBAL_BLUEPRINT_DROP_CHANCE } from './itemMasterV2';

export interface MonsterDefinitionV2 {
 id:string;name:string;mapId:'forest1'|'forest2'|'desert1'|'desert2'|'mine';level:number;rank:EnemyRank;
 maxHp:number;atk:number;def:number;mdef:number;flee:number;attackRange:number;moveSpeed:number;attackIntervalMs:number;loot:LootSourceV2;
}
type Spec=Omit<MonsterDefinitionV2,'loot'> & {ore:string;material?:[string,number];aether?:[string,number];modifier?:[string,number];core?:[string,number];blueprint?:[string,number];unique?:[string,number];signature?:[string,number];equipmentDrops?:Array<[string,number]>};
const mk=(s:Spec):MonsterDefinitionV2=>{const forest2=s.mapId==='forest2';const blueprintChance=forest2?(s.rank==='boss'?.05:s.rank==='elite'?.04:.03):GLOBAL_BLUEPRINT_DROP_CHANCE;const rankGoldMultiplier=s.rank==='boss'?1.44:s.rank==='elite'?1.2:1;const lateGameGoldScale=s.level<=40?1:Math.max(.55,1-(s.level-40)*(.45/35));const averageGold=6*Math.pow(s.level,1.35)*rankGoldMultiplier*lateGameGoldScale;return{...s,loot:{id:s.id,rank:s.rank,level:s.level,goldMin:Math.max(1,Math.round(averageGold*.8)),goldMax:Math.max(1,Math.round(averageGold*1.2)),oreItemId:s.ore,material:s.material&&{itemId:s.material[0],chance:s.material[1]},aetherstone:s.aether&&{itemId:s.aether[0],chance:s.aether[1]},modifier:s.modifier&&{itemId:s.modifier[0],chance:s.modifier[1]},core:s.core&&{itemId:s.core[0],chance:s.core[1]},blueprint:{itemId:blueprintForLevel(s.level),chance:blueprintChance},unique:s.unique&&{itemId:s.unique[0],chance:s.unique[1]},signatureMaterial:s.signature&&{itemId:s.signature[0],chance:s.signature[1]},equipmentDrops:s.equipmentDrops?.map(([itemId,chance])=>({itemId,chance}))}}};
const MAP_DIFFICULTY:Record<Spec['mapId'],number>={forest1:1,forest2:1.75,desert1:2.8,desert2:4.35,mine:6.5};
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
 n('mossblob1','Stone Mossblob','forest1',3,'normal','copperOre',{material:['livingMoss',.45],aether:['verdantAetherstone',.10],modifier:['lifeDrain',.007]}),
 n('mossblob2','Elite Mossblob','forest1',12,'elite','copperOre',{material:['livingMoss',1],aether:['verdantAetherstone',.30],modifier:['lifeDrain',.07],core:['barrier',.03]}),
 n('mossblob3','Mossblob','forest1',5,'normal','copperOre',{material:['livingMoss',.45],aether:['verdantAetherstone',.10],equipmentDrops:[['forestLeaf',.005]]}),
 n('sporekin1','Poison Spore','forest1',7,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.10],modifier:['lingering',.008],core:['blackHole',.0015]}),
 n('sporekin2','Elite Spore','forest1',14,'elite','copperOre',{material:['brutalSpore',1],aether:['verdantAetherstone',.30],modifier:['lingering',.07],core:['blackHole',.03]}),
 n('sporekin3','Spore','forest1',9,'normal','copperOre',{material:['brutalSpore',.40],aether:['verdantAetherstone',.10],modifier:['lingering',.005],equipmentDrops:[['sporeGoggles',.005],['mushroomCap',.003]]}),
 n('mushroom','Mushroom Brute','forest1',15,'boss','copperOre',{aether:['verdantAetherstone',.40],modifier:['expandedArea',.20],core:['cyclone',.10],signature:['bruteSpore',1],unique:['mushroomBruteUnique',.005],equipmentDrops:[['mossCrown',.08]]}),
 n('acorn1','Elite Acorn Guard','forest2',28,'elite','ironOre',{aether:['verdantAetherstone',.50],modifier:['execution',.07],core:['groundSlam',.03]}),
 n('acorn2','Acorn Guard','forest2',18,'normal','ironOre',{aether:['verdantAetherstone',.18],modifier:['execution',.007]}),
 n('acorn3','Flash Acorn Guard','forest2',22,'normal','ironOre',{aether:['verdantAetherstone',.18],modifier:['execution',.008],core:['groundSlam',.0015]}),
 n('twig1','Elite Twig Imp','forest2',30,'elite','ironOre',{aether:['verdantAetherstone',.50],modifier:['rapidCasting',.07],core:['chainLightning',.03]}),
 n('twig2','Female Twig Imp','forest2',20,'normal','ironOre',{aether:['verdantAetherstone',.18],modifier:['rapidCasting',.008],equipmentDrops:[['luckyTwig',.006]]}),
 n('twig3','Male Twig Imp','forest2',24,'normal','ironOre',{aether:['verdantAetherstone',.18],modifier:['rapidCasting',.008],core:['chainLightning',.0015]}),
 n('thornroot','Thornroot Warden','forest2',30,'boss','ironOre',{aether:['verdantAetherstone',.45],modifier:['lingering',.20],core:['frostNova',.10],signature:['ancientRootHeart',1],unique:['thornrootUnique',.006]}),
 n('duneling3','Duneling','desert1',33,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.10],modifier:['mobileCast',.007]}),
 n('duneling2','Dune Runner','desert1',37,'normal','moonstoneShard',{material:['duneRunnerClaw',.50],aether:['azureAetherstone',.10],modifier:['mobileCast',.009],core:['dash',.002],equipmentDrops:[['desertGoggles',.006]]}),
 n('duneling1','Elite Duneling','desert1',44,'elite','moonstoneShard',{material:['duneRunnerClaw',1],aether:['azureAetherstone',.30],modifier:['mobileCast',.07],core:['dash',.04]}),
 n('cactling1','Cactling Bandit','desert1',35,'normal','moonstoneShard',{material:['cactusSpine',.50],aether:['azureAetherstone',.10],modifier:['combustion',.008],equipmentDrops:[['cactusCrown',.006]]}),
 n('cactling3','Bloom Cactling','desert1',40,'normal','moonstoneShard',{material:['cactusSpine',.45],aether:['azureAetherstone',.10],modifier:['combustion',.009],core:['fireball',.002],equipmentDrops:[['desertScarf',.006]]}),
 n('cactling2','Elite Cactling Bandit','desert1',45,'elite','moonstoneShard',{material:['cactusSpine',1],aether:['azureAetherstone',.30],modifier:['combustion',.08],core:['fireball',.04]}),
 n('dunemaw','Dune Maw','desert1',45,'boss','moonstoneShard',{aether:['azureAetherstone',.40],modifier:['echo',.20],core:['meteorStorm',.10],signature:['duneMawFang',1],unique:['duneMawUnique',.007]}),
 n('dust3','Dust Djinn','desert2',48,'normal','silverOre',{material:['djinnEssence',.50],aether:['azureAetherstone',.12],modifier:['rapidCasting',.01]}),
 n('dust2','Mirage Djinn','desert2',52,'normal','silverOre',{material:['djinnEssence',.50],aether:['azureAetherstone',.12],modifier:['mobileCast',.01],core:['blink',.002]}),
 n('dust1','Elite Dust Djinn','desert2',59,'elite','silverOre',{material:['djinnEssence',1],aether:['azureAetherstone',.35],modifier:['rapidCasting',.08],core:['blink',.04]}),
 n('scarab1','Sunscarab','desert2',50,'normal','silverOre',{material:['sunscarabCarapace',.50],aether:['azureAetherstone',.12],modifier:['chain',.008]}),
 n('scarab2','Solar Scarab','desert2',55,'normal','silverOre',{material:['sunscarabCarapace',.50],aether:['azureAetherstone',.12],modifier:['overcharge',.01],core:['lightningField',.002]}),
 n('scarab3','Elite Sunscarab','desert2',60,'elite','silverOre',{material:['sunscarabCarapace',1],aether:['azureAetherstone',.35],modifier:['chain',.08],core:['lightningField',.04]}),
 n('colossus','Sunforge Colossus','desert2',60,'boss','silverOre',{aether:['azureAetherstone',.45],modifier:['extraStrike',.20],core:['thunderStorm',.10],signature:['sunforgeCore',1],unique:['sunforgeUnique',.008],equipmentDrops:[['sunscarabHelm',.08]]}),
 n('mineGoblin','Mine Goblin','mine',62,'normal','mithrilOre',{material:['goblinIronScrap',.45],aether:['azureAetherstone',.10],modifier:['concentratedForce',.006],equipmentDrops:[['goblinMinerHelm',.006]]}),
 n('goblinAxer','Goblin Axer','mine',66,'normal','mithrilOre',{material:['goblinIronScrap',.55],aether:['azureAetherstone',.10],modifier:['execution',.01],equipmentDrops:[['goblinEyepatch',.006]]}),
 n('skeleton','Skeleton','mine',68,'normal','mithrilOre',{material:['cursedBone',.45],aether:['azureAetherstone',.10],modifier:['bloodPrice',.01],equipmentDrops:[['boneVisor',.006],['boneCharm',.006]]}),
 n('goblinForeman','Goblin Foreman','mine',72,'elite','mithrilOre',{material:['goblinIronScrap',1],aether:['azureAetherstone',.35],modifier:['concentratedForce',.08],core:['warCry',.04],equipmentDrops:[['foremanHelm',.03]]}),
 n('goblinLeader','Goblin Leader','mine',75,'boss','mithrilOre',{aether:['azureAetherstone',.45],modifier:['concentratedForce',.20],core:['bladeRush',.10],signature:['leaderEmblem',1],unique:['goblinLeaderUnique',.008]}),
].map(x=>[x.id,x]));
