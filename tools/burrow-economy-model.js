// Read-only economy audit: imports the actual game catalogs, never player saves.
import {MONSTERS_V2} from '../src/simulation/monsterDataV2.ts';
import {UNIVERSAL_ORE_CHANCE,UNIVERSAL_ASTRALITE_CHANCE} from '../src/simulation/loot.ts';
import {getRoster,monsterPresentation} from '../art-test/dimraeth-slice/combat/rosters.js';
import {PHASE1_STAGES,LURE_MODES,frontierStage} from '../art-test/dimraeth-slice/warren-phase1.js';
import {burrowMonsterGold,CONSTRUCTION_MATERIAL_IDS,CRAFT_RECIPES_V2,gearSlot} from '../art-test/dimraeth-slice/warren-progression.js';
import {NPC_COMMON_PRICES} from '../art-test/dimraeth-slice/warren-quick-sell.js';
import {BURROW_REFINE_SUCCESS,BURROW_REFINE_FAIL_DROP_CHANCE,burrowRefineGoldCost} from '../art-test/dimraeth-slice/warren-progression.js';
import {REFINE_SAFE_FLOORS,astraliteCost,enhancementRequirement} from '../src/simulation/equipmentV2.ts';

export const DROP_MULTIPLIER=1.35;
// Expected first-passage costs with failed attempts, stays, downgrade and safe floors.
export function refineExpectations(baseGoldCost=120){
 let edge={attempts:0,gold:0,stones:0},total={attempts:0,gold:0,stones:0};const result=[];
 for(let current=0;current<15;current++){
  const p=BURROW_REFINE_SUCCESS[current],down=REFINE_SAFE_FLOORS.includes(current)?0:(1-p)*BURROW_REFINE_FAIL_DROP_CHANCE;
  edge={attempts:(1+down*edge.attempts)/p,gold:(burrowRefineGoldCost(current+1,baseGoldCost)+down*edge.gold)/p,stones:(astraliteCost(current+1)+down*edge.stones)/p};
  for(const key of Object.keys(total))total[key]+=edge[key];
  result.push({target:current+1,...total});
 }
 return result;
}
export function expectedLoot(id,level){
 const m=MONSTERS_V2[id];if(!m)throw Error('Missing monster '+id);
 const s=m.loot,items={},drops=[];
 const add=(kind,r)=>{if(!r)return;const chance=Math.min(1,r.chance*DROP_MULTIPLIER),quantity=((r.min??1)+(r.max??r.min??1))/2;
  items[r.itemId]=(items[r.itemId]??0)+chance*quantity;drops.push({kind,id:r.itemId,chance,quantity});};
 add('ore',{itemId:s.oreItemId,chance:UNIVERSAL_ORE_CHANCE});
 add('astralite',{itemId:'astraliteStone',chance:UNIVERSAL_ASTRALITE_CHANCE});
 for(const key of ['material','aetherstone','modifier','core','blueprint','unique','signatureMaterial'])add(key,s[key]);
 for(const r of s.equipmentDrops??[])add('equipment',r);
 const gold=burrowMonsterGold(id); // Burrow-only rank/region table, no Warren-level scaling or main-game Gold.
 return {id,name:m.name,rank:m.rank,level:m.level,gold,items,drops};
}
export function pools(stage){const r=getRoster(stage.roster,stage.mapId);return {
 normal:r.pool.filter(id=>{const p=monsterPresentation(r,id);return p&&!p.elite&&!p.isBoss;}),
 elite:r.pool.filter(id=>monsterPresentation(r,id)?.elite),boss:r.bossType};}
const empty=()=>({gold:0,items:{}});
function add(out,loot,weight){out.gold+=loot.gold*weight;for(const [id,n] of Object.entries(loot.items))out.items[id]=(out.items[id]??0)+n*weight;return out;}
function mix(ids,level){const out=empty();for(const id of ids)add(out,expectedLoot(id,level),1/ids.length);return out;}
function metrics(loot){return {...loot,common:CONSTRUCTION_MATERIAL_IDS.reduce((n,id)=>n+(loot.items[id]??0),0),
 saleValue:Object.entries(NPC_COMMON_PRICES).reduce((n,[id,p])=>n+(loot.items[id]??0)*p,0)};}
export function auditEconomy(){
 const monsters=[],levels=[];
 for(const stage of PHASE1_STAGES){const p=pools(stage);
  for(const id of [...p.normal,...p.elite,p.boss].filter(Boolean))monsters.push({...expectedLoot(id,stage.min),map:stage.mapId,warren:stage.min});
  for(let level=stage.min;level<=stage.max;level++){
   const day=metrics(add(add(empty(),mix(p.normal,level),.85),expectedLoot(p.elite[0],level),.15));
   const nights=[];
   for(let wave=1;wave<=5;wave++){const count=3+wave*2+(level-1)*3,q=Math.min(.8,.08+wave*.08+(level-1)*.04),loot=empty();
    for(let i=0;i<count;i++){add(loot,expectedLoot(p.normal[i%p.normal.length],level),1-q);add(loot,expectedLoot(p.elite[i%p.elite.length],level),q);}
    if(wave===5&&p.boss)add(loot,expectedLoot(p.boss,level),1);
    nights.push({wave,count:count+(wave===5&&p.boss?1:0),eliteChance:q,...metrics(loot)});
   }
   const lure=[];
   for(const [mode,c] of Object.entries(LURE_MODES)){const target=mode==='frontier'?frontierStage(level):stage;if(!target)continue;
    const lp=pools(target),loot=metrics(add(add(empty(),mix(lp.normal,level),c.count*(1-c.eliteChance)),mix(lp.elite,level),c.count*c.eliteChance));
    lure.push({mode,cost:c.mats,map:target.mapId,count:c.count,...loot});}
   levels.push({level,map:stage.mapId,day,nights,lure});
  }
 }
 const recipes=Object.entries(CRAFT_RECIPES_V2).filter(([id,r])=>r.available&&gearSlot(id)&&Number(id.match(/^t(\d)/)?.[1]??0)<=2)
  .map(([id,r])=>({id,...r})).filter(r=>['tier1Blueprint','tier2Blueprint'].includes(r.blueprintId));
 return {assumptions:{dropMultiplier:DROP_MULTIPLIER,gold:'Fixed Burrow region/rank table, Forest I (Normal 5, Elite 15, Boss 50) plus 20% of that baseline per successive map, no Warren-level multiplier or main-game Gold roll.',workshop:'Base rewards before 1/2/3% bonus; add bonus only to gold and common mats.',day:'85% uniformly selected normal, 15% FIRST elite. Spawn mixture, not observed kill mixture.',night:'All queued enemies successfully spawn and die. No losses, repair spending or failed nights modeled.',scenarios:'Illustrative 10/25/50 day kills, 75% delivery, wave 3 fully cleared. Not measured days to unlock.',lure:'All spawned monsters killed and delivered; no displaced normal farming accounted for.'},monsters,levels,recipes,
  refinement:refineExpectations(),enhancement:[1,5,10,20,40,80,120].map(target=>({target,gold:Array.from({length:target},(_,i)=>enhancementRequirement(120,i+1).gold).reduce((a,b)=>a+b,0)}))};
}
