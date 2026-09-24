// Valley + BunnySimulation prototype.
// Dimraeth owns terrain/rendering. BunnySimulation owns combat/HP/monster AI.
import { boot, teardown, setRuntimeActors, setRuntimeActorUpdater, setRuntimePlayerVisual, canRuntimeActorStand, runtimeWalkHeight, projectRuntimePoint, moveRuntimePlayerToward, setRuntimePlayerControl } from './engine/runtime.js';
import { sceneFromMap } from './scenes/custom.js';
import valleyScene from './scenes/valley.js';
import defaultForest2Map from './maps/forest2.json';
import { chooseRosterId, getRoster, monsterPresentation } from './combat/rosters.js';
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
import { beginHeroAttack, cancelHeroAttack, createHeroAttackPlayback, updateHeroAttackPlayback } from '../iso-arena-draft/heroCombat.js';

const loadImage=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error(`Failed to load image: ${src}`));i.src=src;});
const sliceSheet=(img,count)=>{
  const frameWidth=Math.floor(img.width/count),out=[];
  for(let i=0;i<count;i++){const c=document.createElement('canvas');c.width=frameWidth;c.height=img.height;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(img,i*frameWidth,0,frameWidth,img.height,0,0,frameWidth,img.height);out.push(c);}
  return out;
};

const blessedHero=await loadBlessedHero();
const playback=createHeroAttackPlayback(blessedHero.attackDefinition('dagger','south'));
let facing='south',combatTarget=null,lastTargetSample=null,chaseStuck=0,lastKnownLevel=1;

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
let mapFileName=requestedFile||persistentCharacter.currentMapId||'forest2';
if(!mapDataByName(mapFileName))mapFileName='forest2';
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
  presentations.set(monsterType,p);
}

const monsterViews=spots.map(([tx,ty,monsterType],i)=>{
  const p=presentations.get(monsterType);
  return{id:`${gameplayMapId}-m${i}`,monsterType,x:tx*64,y:ty*64,hp:1,maxHp:1,dead:false,elite:!!p?.elite,isBoss:!!p?.isBoss};
});
const playerView={x:scene.spawn.x,y:scene.spawn.y};
const sim=new ArenaV2Adapter({zoneId:gameplayMapId,player:playerView,monsters:monsterViews,character:persistentCharacter,walkableContains:({x,y})=>{const z=runtimeWalkHeight(x,y);return z!==null&&canRuntimeActorStand(x,y,z);},onReward:(_reward,character)=>{persistentCharacter={...character,currentMapId:gameplayMapId};saveCharacter(persistentCharacter);combatSFX.playPickup();}});
const actors=monsterViews.map((view,i)=>{
  const p=presentations.get(view.monsterType);
  return{
    kind:'actor',view,monsterType:view.monsterType,name:p.name,x:view.x,y:view.y,z:0,r:12,dead:false,
    visualScale:p.isBoss?1.65:(p.kind==='sheet'?(p.elite?2.68:2.15):2),
    getImage(){const f=p.frames;return f[Math.floor(performance.now()/120+i)%f.length];},
    drawOverlay(g,{x:sx,y:sy}){if(this.dead)return;const v=this.view,w=42,q=Math.max(0,v.hp/v.maxHp);g.fillStyle='rgba(10,12,12,.82)';g.fillRect(sx-w/2,sy-55,w,5);g.fillStyle='#e85b55';g.fillRect(sx-w/2+1,sy-54,(w-2)*q,3);g.font='10px system-ui';g.textAlign='center';g.fillStyle='#fff4cf';g.fillText(this.name,sx,sy-61);}
  };
});
setRuntimeActors(actors);

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
  setRuntimePlayerControl(Boolean(combatTarget));
  combatFX.update(dt);
  blessedHero.update(dt);
  syncWarpPrompt(player);

  if(combatTarget){player.target=null;
  if(!playback.active){
    const dx=combatTarget.x-player.x,dy=combatTarget.y-player.y,d=Math.hypot(dx,dy);
    const attackRange=Math.max(1,simPlayer?.attackRange??58),chaseStopRange=Math.max(1,attackRange*.7);
    // A targeted passive mob stops wandering (it has 'noticed' the hero) so the swing can't miss.
    const simMonster=sim.simulation.world.monsters.get(combatTarget.id);if(simMonster&&!simMonster.targetPlayerId){simMonster.roamTarget=undefined;simMonster.nextRoamAtMs=sim.simulation.clock.nowMs+800;}
    // Swing as soon as the target is inside attack range (with a small margin for monster drift);
    // only walk closer while it is out of range. Walking stops at chaseStopRange so we end up well inside.
    if(d<=attackRange-3){player.moving=false;player.target=null;lastTargetSample=null;chaseStuck=0;startAttack(player,combatTarget);}
    else{
      const before=d;
      moveRuntimePlayerToward(combatTarget.x,combatTarget.y,Math.min(Math.max(0,d-chaseStopRange),125*dt));
      const after=Math.hypot(combatTarget.x-player.x,combatTarget.y-player.y);
      // blocked (tree/rock/cliff between us): give up instead of running on the spot
      chaseStuck=after<before-.5?0:chaseStuck+dt;
      if(chaseStuck>1.2){cancelCombat();chaseStuck=0;}
    }
  }}

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
  const events=sim.step(dt*1000);
  presentCombatEvents(events);
  for(const a of actors){const v=a.view;a.x=v.x;a.y=v.y;a.dead=v.dead;}
  setRuntimeActors([...actors,...combatFX.getRuntimeActors()]);
  syncHud();syncDeathOverlay();
});

let deathUntil=0;
function pushRewardLine(text){const feed=document.getElementById('reward-feed');if(!feed)return;const line=document.createElement('div');line.textContent=text;feed.prepend(line);setTimeout(()=>line.remove(),5000);while(feed.children.length>6)feed.lastElementChild?.remove();}
function appendWorldChat(text,{system=false}={}){const log=document.getElementById('chat-log');if(!log)return;const line=document.createElement('p');line.textContent=text;if(system)line.className='system';log.appendChild(line);while(log.children.length>40)log.firstElementChild?.remove();log.scrollTop=log.scrollHeight;}
function presentCombatEvents(events){for(const event of events||[]){if(event.type==='damageDealt'&&event.targetId===sim.playerId&&event.amount>0)blessedHero.hurt();if(event.type==='entityDefeated'&&event.entityId===sim.playerId){blessedHero.die();deathUntil=performance.now()+10000;const o=document.getElementById('death-overlay');if(o)o.hidden=false;combatSFX.playDeath();cancelCombat();}if(event.type==='entityRespawned'&&event.entityId===sim.playerId){blessedHero.respawn();deathUntil=0;const o=document.getElementById('death-overlay');if(o)o.hidden=true;}if(event.type==='entityDefeated'&&event.entityId!==sim.playerId){combatSFX.playDeath({volume:0.5});const target=monsterViews.find(v=>v.id===event.entityId),actor=actors.find(a=>a.view.id===event.entityId);if(target){const fxOptions={visualScale:actor?.visualScale??1};target.isBoss?combatFX.playBossDeath(target.x,target.y,fxOptions):combatFX.playNormalDeath(target.x,target.y,fxOptions);}pushRewardLine('Monster defeated');}}}
function syncDeathOverlay(){const o=document.getElementById('death-overlay'),v=document.getElementById('death-seconds'),ring=document.querySelector('.death-countdown .progress');if(!o||!v)return;if(!deathUntil){o.hidden=true;return;}const remain=Math.max(0,deathUntil-performance.now()),left=Math.ceil(remain/1000);v.textContent=String(left);if(ring)ring.style.strokeDashoffset=String(264*(1-remain/10000));if(remain<=0){deathUntil=0;o.hidden=true;}}
function bindChat(){const input=document.getElementById('chat-input');if(!input)return;window.addEventListener('keydown',e=>{if(e.code!=='Enter')return;if(document.activeElement===input){e.preventDefault();e.stopImmediatePropagation();const msg=input.value.trim();if(msg){appendWorldChat(`Bunny: ${msg}`);input.value='';}input.blur();return;}if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;e.preventDefault();e.stopImmediatePropagation();input.focus();},true);}
bindChat();

function syncHud(){
  const ui=document.getElementById('game-ui');if(ui)ui.hidden=false;
  const p=sim.simulation.world.players.get(sim.playerId),c=sim.character;
  const set=(sel,v)=>{const el=document.querySelector(sel);if(el)el.textContent=v;};
  const width=(sel,v)=>{const el=document.querySelector(sel);if(el)el.style.width=`${Math.max(0,Math.min(100,v))}%`;};
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
 body.querySelector('[data-craft-now]')?.addEventListener('click',()=>{const r=CRAFT_UI_RECIPES.find(x=>x.id===selected?.id);if(!r)return;const qty=craftUi.batch||1,recipe={templateId:r.id,slot:r.slot,blueprintId:r.blueprintId,oreId:r.oreId,oreQty:r.oreQty,materials:r.materials,gold:r.gold,baseGoldCost:r.baseGoldCost,baseCombat:r.baseCombat,offhandType:r.offhandType,setId:r.setId,requiredLevel:r.requiredLevel,available:r.available};try{const need=[[r.blueprintId,1],[r.oreId,r.oreQty],...r.materials.map(m=>[m.itemId,m.qty])];if(need.find(([id,n])=>(c.inventory[id]??0)<n*qty)||c.gold<r.gold*qty){showUiError(`Materials/Gold insufficient for ×${qty}`);return;}for(let i=0;i<qty;i++)sim.equipmentCommand({type:'craft',recipe});renderCraftWindow();}catch(error){showUiError(String(error?.message||error));}});
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
function renderWeaponMastery(target){const c=sim.character,families=Object.keys(MASTERY_NAMES);if(!masteryUi.selected||!c.weaponMastery[masteryUi.selected])masteryUi.selected=families[0];const selected=masteryUi.selected,m=c.weaponMastery[selected]||{level:1,xp:0},milestones=WEAPON_MASTERY_MILESTONES[selected]||[];if(!masteryUi.milestone||!milestones.some(x=>x.id===masteryUi.milestone))masteryUi.milestone=(milestones.filter(x=>m.level>=x.level).at(-1)||milestones[0])?.id;const detail=milestones.find(x=>x.id===masteryUi.milestone)||milestones[0],unlocked=detail&&m.level>=detail.level;target.innerHTML=`<div class="mastery-layout"><section class="mastery-panel"><div class="mastery-panel-head"><strong>WEAPON MASTERY</strong><span>LV PROGRESS</span></div><div class="mastery-progress-list">${families.map(f=>{const x=c.weaponMastery[f]||{level:1,xp:0},max=x.level>=50?0:masteryXpRequired(x.level),pct=x.level>=50?100:Math.min(100,max?x.xp/max*100:0);return `<button class="mastery-progress-card ${f===selected?'active':''}" data-mastery-family="${f}"><span class="mastery-family-glyph">${iconHtml(f,'family',MASTERY_GLYPHS[f])}</span><span class="mastery-family-info"><b>${MASTERY_NAMES[f]}</b><small>Lv ${x.level}</small><i><em style="width:${pct}%"></em></i><small class="mastery-xp">${x.level>=50?'MAX':Math.floor(x.xp)+' / '+max+' XP'}</small></span></button>`}).join('')}</div></section><section class="mastery-panel mastery-milestone-panel"><div class="mastery-panel-head"><strong>${MASTERY_NAMES[selected]}</strong><span>MILESTONES</span></div><div class="mastery-milestone-grid">${milestones.map(x=>`<button class="mastery-milestone ${m.level>=x.level?'unlocked':'locked'} ${x.id===masteryUi.milestone?'selected':''}" data-milestone="${x.id}"><span class="mastery-level-tag">Lv ${x.level}</span><span class="mastery-milestone-glyph">${iconHtml(selected+'_'+x.id,'mastery',MASTERY_GLYPHS[selected])}</span></button>`).join('')}</div>${detail?`<div class="mastery-detail-card ${unlocked?'unlocked':'locked'}"><strong>${MASTERY_MILESTONE_NAMES[detail.id]||detail.id}</strong><span>${unlocked?'UNLOCKED':'LOCKED · LV '+detail.level}</span><p>${detail.description}</p></div>`:''}</section></div>`;target.querySelectorAll('[data-mastery-family]').forEach(b=>b.onclick=()=>{masteryUi.selected=b.dataset.masteryFamily;masteryUi.milestone=null;renderSkillsHub();});target.querySelectorAll('[data-milestone]').forEach(b=>b.onclick=()=>{masteryUi.milestone=b.dataset.milestone;renderSkillsHub();});}
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
function gearTile(item,c,equipped=false,emptySlot=''){if(!item)return `<button class="rpg-gear-tile empty" data-empty-slot="${emptySlot}"><span class="gear-glyph">＋</span></button>`;const slot=equipped&&emptySlot?emptySlot:item.slot,enhance=c.equipment.enhancementBySlot?.[slot]??0,refine=c.equipment.refinementBySlot?.[slot]??0,select=batchDestroyUi.active&&!equipped,checked=select&&batchDestroyUi.selected.has(item.id);return `<button class="rpg-gear-tile rarity-${item.rarity} ${equipped?'equipped':''} ${checked?'batch-selected':''}" data-id="${item.id}">${select?`<span class="batch-check">${checked?'✓':'○'}</span>`:''}${equipped?`<span class="enhance-mark">+${enhance}</span><span class="refine-mark">+${refine}</span>`:''}<span class="gear-glyph">${iconHtml(item.templateId,'equipment',gearGlyph(item.slot))}</span></button>`;}
function equippedSlotForItem(item,c){return Object.entries(c.equipment.equippedBySlot).find(([,id])=>id===item.id)?.[0]??item.slot;}
function masterRefinementCard(c){const gear=equipmentCombatTotals(c),levels=Object.entries(c.equipment.equippedBySlot).filter(([,id])=>Boolean(id)).map(([slot])=>c.equipment.refinementBySlot?.[slot]??0),active=gear.masterRefinement,next=active<5?5:active<10?10:active<15?15:null,target=next??15,count=levels.filter(x=>x>=target).length,bonus=active===15?'ATK +800 · MATK +800 · HP +1500 · SP +500':active===10?'ATK +400 · MATK +400 · HP +900 · SP +300':active===5?'ATK +200 · MATK +200 · HP +500 · SP +200':'Refine 6 equipped slots to +5';return `<div class="master-refinement-card ${active?'active':'inactive'}"><div class="master-refinement-top"><span class="master-refinement-badge">${active?'+'+active:'—'}</span><div><strong>MASTER REFINEMENT</strong><small>${active?'Tier +'+active+' active':'Inactive'}</small></div><b>${next?`${Math.min(count,6)}/6 slots ≥ +${next}`:'MAXIMUM'}</b></div><div class="master-refinement-bonus">${bonus}</div>${next?`<div class="master-refinement-track"><i style="width:${Math.min(100,count/6*100)}%"></i></div>`:''}</div>`;}
function itemDetailHtml(item,c,equipped){const slot=equipped?equippedSlotForItem(item,c):item.slot,enhance=c.equipment.enhancementBySlot?.[slot]??0,refine=c.equipment.refinementBySlot?.[slot]??0,base=item.baseCombat||{},mult=equipmentRarityStatMultiplier(item.rarity),template=EQUIPMENT_MASTER_V2[item.templateId],name=template?.name||prettyItem(item.templateId),stats=Object.entries(base).filter(([,v])=>Number(v)).map(([k,v])=>`<div><span>${({maxHp:'HP',maxSp:'SP'}[k]||k.toUpperCase())}</span><b>+${Math.round(Number(v)*mult)}</b></div>`).join('')||'<div><span>Base Stats</span><b>—</b></div>',set=item.setId?CRAFT_SET_BY_ID.get(item.setId):null,setCount=set?Math.min(set.requiredPieces,equippedSetCount(item.setId,c)):0;return `<div class="equip-inspect"><div class="equip-inspect-preview">${gearTile(item,c,equipped)}</div><div class="equip-inspect-title"><h2>${name}</h2><span class="tier-chip">T${template?.tier??'?'} · ${prettyItem(item.slot)}</span></div><div class="craft-tags"><span>Lv ${item.requiredLevel??1}+</span><span class="rarity-label rarity-${item.rarity}">${item.rarity.toUpperCase()}</span></div><div class="craft-stat-box equip-stat-box"><h3>ITEM STATS</h3>${stats}</div><div class="equip-option-box"><h3>OPTIONS</h3><p>${item.affixes?.length?item.affixes.join(' · '):'No bonus options'}</p></div>${set?`<div class="equipment-set-status ${setCount>=set.requiredPieces?'set-active':'set-inactive'}"><div><strong>${name.split(' ')[0]} Set</strong><b>${setCount}/${set.requiredPieces}</b></div>${set.effect.map(x=>`<p>◆ ${x}</p>`).join('')}</div>`:''}${equipped?`<div class="equip-progression"><div><span>ENHANCEMENT</span><b>+${enhance}</b></div><div><span>REFINEMENT</span><b>+${refine}</b></div></div>`:''}<div class="rpg-detail-actions">${equipped?`<button data-open-upgrade="${item.id}" data-upgrade-mode="enhance">ENHANCE</button><button data-open-upgrade="${item.id}" data-upgrade-mode="refine">REFINE</button><button data-open-upgrade="${item.id}" data-upgrade-mode="option">OPTION</button><button data-unequip="${slot}">UNEQUIP</button>`:`<button data-equip-now="${item.id}">EQUIP</button><button data-destroy="${item.id}">DESTROY</button>`}</div></div>`;}
function upgradeHtml(item,c,mode='enhance'){const slot=equippedSlotForItem(item,c),enhance=c.equipment.enhancementBySlot?.[slot]??0,refine=c.equipment.refinementBySlot?.[slot]??0,next=enhance+1,category=progressionCategory(slot,item.offhandType);let req=null;try{if(next<=c.level)req=enhancementRequirement(item.baseGoldCost,next)}catch{}const target=refine+1,rate=refine<15?Math.round(REFINE_SUCCESS[refine]*100):0,need=refine<15?astraliteCost(target):0,have=c.inventory.astraliteStone??0,tabs=`<div class="upgrade-module-tabs"><button data-switch-upgrade="enhance" class="${mode==='enhance'?'active':''}">ENHANCE</button><button data-switch-upgrade="refine" class="${mode==='refine'?'active':''}">REFINE</button><button data-switch-upgrade="option" class="${mode==='option'?'active':''}">OPTION</button></div>`;let body=mode==='refine'?`<section class="upgrade-module"><h3>REFINE</h3><div class="upgrade-level">+${refine} <i>→</i> +${Math.min(target,15)}</div><p>Success ${rate}%<br>Astralite ${have} / ${need}</p><button data-refine="${slot}" ${refine<15&&have>=need?'':'disabled'}>REFINE</button></section>`:mode==='option'?`<section class="upgrade-module option-module"><h3>OPTIONS</h3><div class="current-options">${item.affixes?.length?item.affixes.map((a,i)=>`<span><b>${i+1}</b>${prettyItem(a)}</span>`).join(''):'<p>No options yet</p>'}</div><div class="option-module-actions"><button data-add-option="${item.id}">ADD OPTION</button><button data-reoption="${item.id}" ${item.affixes?.length?'':'disabled'}>RE-OPTION</button></div></section>`:`<section class="upgrade-module"><h3>ENHANCE</h3><div class="upgrade-level">+${enhance} <i>→</i> +${Math.min(next,120)}</div><p>${enhance>=120?'Maximum enhancement':next>c.level?`Requires Hero Lv. ${next}`:req?`${prettyItem(req.stoneId)} ×${req.stoneQty}<br>Gold ${req.gold}`:'Unavailable'}</p><button data-enhance="${slot}" ${req&&enhance<120?'':'disabled'}>ENHANCE</button></section>`;return `<button class="rpg-back" data-back-detail="${item.id}">‹ ITEM DETAIL</button><div class="upgrade-title"><strong>${prettyItem(item.templateId)}</strong><span>${prettyItem(slot)} · ${category}</span></div>${tabs}<div class="upgrade-module-host">${body}</div>`;}
function equipmentAction(command){try{const result=sim.equipmentCommand(command);if(command.type==='refine')showRefineResult(result.refineSuccess===true);renderEquipmentUi();}catch(e){showUiError(String(e?.message||e));}}
function showRefineResult(success){let t=document.querySelector('.equipment-result-toast');if(!t){t=document.createElement('div');t.className='equipment-result-toast';document.body.append(t)}t.className=`equipment-result-toast ${success?'success':'fail'} show`;t.innerHTML=success?'<strong>REFINE SUCCEEDED!</strong><span>Refinement level increased</span>':'<strong>REFINE FAILED</strong><span>Refinement did not succeed</span>';clearTimeout(showRefineResult.timer);showRefineResult.timer=setTimeout(()=>t.classList.remove('show'),1400);}
function bindEquipmentActionButtons(root=document.getElementById('game-window-body')){root.querySelectorAll('[data-equip-now]').forEach(b=>b.onclick=()=>equipmentAction({type:'equip',equipmentId:b.dataset.equipNow}));root.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>equipmentAction({type:'unequip',slot:b.dataset.unequip}));root.querySelectorAll('[data-destroy]').forEach(b=>b.onclick=()=>{if(confirm('Destroy this gear? This cannot be undone.'))equipmentAction({type:'dismantle',equipmentId:b.dataset.destroy})});root.querySelectorAll('[data-open-upgrade]').forEach(b=>b.onclick=()=>{const item=sim.character.equipment.instances[b.dataset.openUpgrade];root.querySelector('.rpg-detail-panel').innerHTML=upgradeHtml(item,sim.character,b.dataset.upgradeMode);bindEquipmentActionButtons(root)});root.querySelectorAll('[data-switch-upgrade]').forEach(b=>b.onclick=()=>{const item=sim.character.equipment.instances[equipmentUi.selectedId];root.querySelector('.rpg-detail-panel').innerHTML=upgradeHtml(item,sim.character,b.dataset.switchUpgrade);bindEquipmentActionButtons(root)});root.querySelectorAll('[data-back-detail]').forEach(b=>b.onclick=()=>{const item=sim.character.equipment.instances[b.dataset.backDetail];root.querySelector('.rpg-detail-panel').innerHTML=itemDetailHtml(item,sim.character,true);bindEquipmentActionButtons(root)});root.querySelectorAll('[data-enhance]').forEach(b=>b.onclick=()=>equipmentAction({type:'enhance',slot:b.dataset.enhance}));root.querySelectorAll('[data-refine]').forEach(b=>b.onclick=()=>equipmentAction({type:'refine',slot:b.dataset.refine}));root.querySelectorAll('[data-add-option]').forEach(b=>b.onclick=()=>equipmentAction({type:'addOption',equipmentId:b.dataset.addOption}));root.querySelectorAll('[data-reoption]').forEach(b=>b.onclick=()=>equipmentAction({type:'reoption',equipmentId:b.dataset.reoption,lockedIndexes:[]}));}
function renderEquipmentUi(){const body=document.getElementById('game-window-body'),c=sim.character,tabs=['Gear','Crafting Mat','Upgrading Mat','Blueprint','Skill Core','Quest','Misc'],equippedIds=new Set(Object.values(c.equipment.equippedBySlot).filter(Boolean)),inventoryGear=Object.values(c.equipment.instances).filter(x=>!equippedIds.has(x.id));body.innerHTML=`<div class="rpg-equipment-shell"><div class="rpg-equip-side"><div class="rpg-screen-title"><strong>GEAR</strong><span>Equipment</span></div><div class="rpg-character-stage"><div class="gear-column left">${['hat','mouth','main','cape','accessoryLeft'].map(slot=>gearTile(c.equipment.instances[c.equipment.equippedBySlot[slot]],c,true,slot)).join('')}</div><div class="character-silhouette"><span>🐰</span><strong>${c.name}</strong><small>LV. ${c.level}</small>${masterRefinementCard(c)}</div><div class="gear-column right">${['face','armor','offhand','shoes','accessoryRight'].map(slot=>gearTile(c.equipment.instances[c.equipment.equippedBySlot[slot]],c,true,slot)).join('')}</div></div><div class="rpg-detail-panel"></div></div><div class="rpg-inventory-side"><div class="rpg-screen-title"><strong>INVENTORY</strong><span>${inventoryGear.length} gear · ${c.gold} G</span></div><div class="inventory-tabs">${tabs.map(t=>`<button data-tab="${t}" class="${equipmentUi.tab===t?'active':''}">${t}</button>`).join('')}</div>${equipmentUi.tab==='Gear'?`<div class="gear-filters"><div class="gear-filter-row"><span>TIER</span>${['all','1','2','3','4','5'].map(t=>`<button data-gear-tier="${t}" class="${equipmentUi.tier===t?'active':''}">${t==='all'?'ALL':'T'+t}</button>`).join('')}</div><div class="gear-filter-row"><span>PART</span>${GEAR_SLOT_FILTERS.map(([id,label])=>`<button data-gear-slot="${id}" class="${equipmentUi.slot===id?'active':''}">${label}</button>`).join('')}</div></div>`:''}<div class="inventory-grid"></div></div></div>`;const grid=body.querySelector('.inventory-grid');if(equipmentUi.tab==='Gear'){const visible=inventoryGear.filter(gearMatchesFilter);grid.innerHTML=visible.length?visible.map(x=>gearTile(x,c)).join(''):'<div class="inventory-empty">No gear matches these filters</div>'}else{const entries=Object.entries(c.inventory).filter(([id])=>inventoryCategory(id)===equipmentUi.tab);grid.innerHTML=entries.length?entries.map(([id,q])=>`<button class="rpg-item-tile" data-item-info="${id}"><span class="item-glyph">${iconHtml(id,'item','◆')}</span><strong>${prettyItem(id)}</strong><b>${q}</b></button>`).join(''):'<div class="inventory-empty">No items in this category</div>'}body.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{equipmentUi.tab=b.dataset.tab;equipmentUi.selectedId=null;renderEquipmentUi()});body.querySelectorAll('[data-gear-tier]').forEach(b=>b.onclick=()=>{equipmentUi.tier=b.dataset.gearTier;renderEquipmentUi()});body.querySelectorAll('[data-gear-slot]').forEach(b=>b.onclick=()=>{equipmentUi.slot=b.dataset.gearSlot;renderEquipmentUi()});body.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>{equipmentUi.selectedId=el.dataset.id;const item=c.equipment.instances[equipmentUi.selectedId];body.querySelector('.rpg-detail-panel').innerHTML=itemDetailHtml(item,c,equippedIds.has(item.id));bindEquipmentActionButtons(body)});body.querySelectorAll('[data-item-info]').forEach(el=>el.onclick=()=>{const id=el.dataset.itemInfo,modal=document.getElementById('equipment-detail-modal');modal.innerHTML=`<button class="rpg-modal-close">×</button><div class="equipment-detail-card"><div class="rpg-detail-head"><strong>${prettyItem(id)}</strong><small>×${c.inventory[id]??0}</small></div><p class="item-description">${itemInfo(id)}</p></div>`;modal.hidden=false;bindDetailModalClose(modal)});body.querySelectorAll('[data-empty-slot]').forEach(el=>el.onclick=()=>openGameWindow('Craft'));bindEquipmentActionButtons(body);}

function openBasicWindow(name){
  const win=document.getElementById('game-window'),title=document.getElementById('game-window-title'),body=document.getElementById('game-window-body');
  if(!win||!title||!body)return;win.hidden=false;title.textContent=name;
  const c=sim.character,p=sim.simulation.world.players.get(sim.playerId);
  if(name==='Inventory'){renderEquipmentUi();return;}
  if(name==='Skills'){renderSkillsHub();return;}
  if(name==='Craft'){renderCraftWindow();return;}
  if(name==='Monster Index'){const names=roster.pool.map(id=>roster.displayName(id));const boss=roster.bossType?roster.displayName(roster.bossType):null;body.innerHTML=`<p><b>${roster.title} · ${roster.id.toUpperCase()} ROSTER</b></p><p>${names.join(' · ')}</p>${boss?`<p><b>Boss:</b> ${boss}</p>`:''}`;return;}
}
function openCharacterWindow(){
  const win=document.getElementById('game-window'),title=document.getElementById('game-window-title'),body=document.getElementById('game-window-body');if(!win||!title||!body)return;
  const c=sim.character,p=sim.simulation.world.players.get(sim.playerId),s=c.stats;win.hidden=false;title.textContent='CHARACTER STATUS';
  const details={ATK:Math.round((p?.weaponAtk??0)+s.str+s.str*s.str/100+s.dex/5+s.luk/3),MATK:Math.round((p?.weaponMatk??0)+s.int+s.int*s.int/100+s.dex/5+s.luk/3),DEF:Math.round((p?.equipmentDef??0)+s.vit/2),MDEF:Math.round((p?.equipmentMdef??0)+s.int/2+s.vit/4),HIT:Math.round(p?.hit??0),FLEE:Math.round(p?.flee??0),HP:Math.round(p?.maxHp??0)};
  body.innerHTML=`<p>Lv. ${c.level} · Status Point: <b>${c.unspentStatPoints}</b></p><div class="character-status-columns"><section><h3>STATUS</h3>${['str','agi','vit','int','dex','luk'].map(k=>`<div class="stat-row"><span><strong>${k.toUpperCase()}</strong><b>${s[k]}</b></span></div>`).join('')}</section><section><h3>DETAIL STATUS</h3>${Object.entries(details).map(([k,v])=>`<div class="detail-stat-row"><span>${k}</span><b>${v}</b></div>`).join('')}</section></div>`;
}
function bindProductionUi(){
  document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>openBasicWindow(b.dataset.window)));
  document.getElementById('character-hud')?.addEventListener('click',openCharacterWindow);
  document.getElementById('game-window-close')?.addEventListener('click',()=>{document.getElementById('game-window').hidden=true;});
  window.addEventListener('keydown',e=>{if(e.code==='KeyI')openBasicWindow('Inventory');if(e.code==='KeyK')openBasicWindow('Skills');if(e.code==='KeyY')openBasicWindow('Craft');if(e.code==='KeyM')openBasicWindow('Monster Index');if(e.key==='Escape'){const detail=document.getElementById('equipment-detail-modal');if(detail&&!detail.hidden){closeDetailModal();return;}const w=document.getElementById('game-window');if(w)w.hidden=true;}});
}
bindProductionUi();
const sfxToggle=document.getElementById('sfx-toggle');
function syncSfxToggle(){if(!sfxToggle)return;sfxToggle.innerHTML=`${combatSFX.enabled?'🔊':'🔇'}<span>${combatSFX.enabled?'Sound':'Muted'}</span>`;sfxToggle.title=combatSFX.enabled?'Mute sound':'Enable sound';}
sfxToggle?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();combatSFX.toggle();syncSfxToggle();});
syncSfxToggle();
syncHotbar();
const warpPrompt=document.createElement('div');warpPrompt.id='warp-prompt';warpPrompt.hidden=true;warpPrompt.style.cssText='position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:50;padding:8px 14px;background:rgba(10,14,18,.9);border:1px solid #d9bd72;border-radius:6px;color:#fff4cf;font:600 14px system-ui;pointer-events:none';document.body.appendChild(warpPrompt);
let nearbyPortal=null,zoneTransferBusy=false;
function syncWarpPrompt(player){nearbyPortal=activePortalAt(scene,player);warpPrompt.hidden=!nearbyPortal;if(nearbyPortal)warpPrompt.textContent=`Warp to ${nearbyPortal.to} [E]`;}
async function performWarp(){if(zoneTransferBusy||!nearbyPortal||!window.__slice)return;zoneTransferBusy=true;cancelCombat();const result=await requestZoneTransfer({fromMap:gameplayMapId,portalId:nearbyPortal.id,scene,player:window.__slice.player});if(result.denied){showUiError(result.reason);zoneTransferBusy=false;return;}combatSFX.playWarp();persistentCharacter={...sim.character,currentMapId:result.map};saveCharacter(persistentCharacter);combatFX.teardown();setRuntimeActors([]);setRuntimeActorUpdater(null);teardown();const url=new URL(location.href);url.searchParams.set('map','forest-combat');if(import.meta.env.DEV)url.searchParams.set('file',result.map);else url.searchParams.delete('file');sessionStorage.setItem('bunny-world-zone-spawn',JSON.stringify(result.spawn));location.replace(url);}
window.addEventListener('keydown',e=>{if((e.code==='KeyE'||e.code==='Enter')&&nearbyPortal){e.preventDefault();performWarp();}});
document.querySelectorAll('[data-hotbar-slot]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.skillId;if(!id)return;try{sim.castSkill(id,combatTarget?.id);}catch(e){showUiError(String(e?.message||e));}}));
document.querySelector('[data-hotbar-movement]')?.addEventListener('click',()=>{const id=sim.character.skills.movement;if(!id)return;try{sim.castSkill(id,undefined,undefined,{x:1,y:0});}catch(e){showUiError(String(e?.message||e));}});

function cancelCombat(){combatTarget=null;lastTargetSample=null;cancelHeroAttack(playback);setRuntimePlayerControl(false);syncHud();}
window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))cancelCombat();});
const canvas=document.getElementById('scene');
canvas.addEventListener('pointerdown',e=>{
  const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*canvas.width/rect.width,y=(e.clientY-rect.top)*canvas.height/rect.height;
  let hit=null,best=Infinity;
  for(const a of actors){if(a.dead)continue;const p=projectRuntimePoint(a.x,a.y,a.z),d=Math.hypot(x-p.x,y-p.y);if(d<72&&d<best){hit=a;best=d;}}
  if(hit){
    if(combatTarget?.id!==hit.view.id){cancelHeroAttack(playback);lastTargetSample=null;}
    combatTarget=hit.view;setRuntimePlayerControl(true);e.preventDefault();
  }else if(combatTarget){cancelCombat();}
});

window.__combat={sim,playback,actors,fx:combatFX,sfx:combatSFX,rosterId,roster,mapId:gameplayMapId,routeId,get target(){return combatTarget;},requestZoneTransfer:performWarp};
const pendingSpawn=(()=>{try{const v=JSON.parse(sessionStorage.getItem('bunny-world-zone-spawn')||'null');sessionStorage.removeItem('bunny-world-zone-spawn');return v;}catch{return null;}})();
if(pendingSpawn){scene.spawn={x:pendingSpawn.x,y:pendingSpawn.y};playerView.x=pendingSpawn.x;playerView.y=pendingSpawn.y;}
persistentCharacter={...sim.character,currentMapId:gameplayMapId};saveCharacter(persistentCharacter);
await boot(scene,{canvasEl:canvas,loadingEl:document.getElementById('loading'),playerSprites:null,playerScale:1,worldScale:1.45,zoom:1});
