// Burrow Command local browser bot. Modes: --smoke, --migration, --balance, --idle.
// Never deploys, pushes, edits maps or accesses external hosts.
import {preview} from 'vite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const BALANCE_STATE=path.join(os.tmpdir(),'burrow-command-balanced-bot-state.json');
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';

const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4177,strictPort:false}});
const result=[],errors=[];
let browser=null;
const verify=(name,ok,details={})=>{
 const v={name,ok:!!ok,...details};result.push(v);
 if(!ok)throw Error(name+' '+JSON.stringify(details));
};
async function newGame(){
 const context=await browser.newContext({viewport:{width:1440,height:900},
  ...(process.argv.includes('--balance-resume')&&fs.existsSync(BALANCE_STATE)?{storageState:BALANCE_STATE}:{})});
 const page=await context.newPage();
 page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));
 const failed=[];page.on('response',r=>{if(r.status()>=400&&failed.length<15)failed.push([r.status(),r.url()]);});
 page.on('requestfailed',r=>{if(failed.length<15)failed.push(['network',r.url(),r.failure()?.errorText]);});
 console.log('BOT: open game');
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html',{waitUntil:'domcontentloaded'});
 console.log('BOT: wait for game boot');
 try{await page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:12000});}
 catch(e){console.log('BOOT DIAG',JSON.stringify(await page.evaluate(()=>({url:location.href,title:document.title,ready:document.readyState,
  hasWarren:!!window.__warren,loading:document.querySelector('#loading')?.outerHTML?.slice(0,800),scripts:[...document.scripts].map(s=>s.src),
  root:document.body?.innerText?.slice(0,300)}))));console.log('HTTP FAILURES',JSON.stringify(failed));throw e;}
 console.log('BOT: game ready');
 return {context,page};
}
const snap=page=>page.evaluate(()=>{
 const s=window.__warren;
 return {day:s.day,warren:s.warren,wave:s.wave,night:s.night,losses:s.losses,cleared:s.cleared,
 gold:s.gold,kills:s.kills,gear:s.gear.length,units:s.units.length,
 materials:Object.entries(s.inventory).filter(([id])=>['livingMoss','brutalSpore','copperOre'].includes(id)).reduce((n,[,v])=>n+v,0),
 blueprints:s.inventory.tier1Blueprint||0,
 levels:s.units.map(u=>u.level),mastery:Object.fromEntries(Object.entries(s.mastery).map(([cls,v])=>[cls,v.level])),
 towers:s.towers.map(t=>({hp:t.hp,level:t.level,cls:t.garrison?.cls||null}))};
});
async function step(page,n=5){
 // Five 5-second ticks per evaluated chunk: below handoff's maximum of 25.
 await page.evaluate(n=>{for(let i=0;i<n;i++)window.__warrenStep(5);},n);
}
async function smoke(){
 const {context,page}=await newGame();
 verify('seven classes',await page.locator('[data-buy]').count()===7);
 verify('no hunting flag',await page.evaluate(()=>!('flag' in window.__warren)&&!document.querySelector('#help').textContent.includes('ย้ายจุดล่า')));
 verify('no bunny level cap',await page.evaluate(()=>{
   const s=window.__warren;s.units[0].exp=1000; // XP calculation is separately tested at module level.
   return s.warren===1&&s.units[0].level===1;
 }));
 verify('three main windows plus mastery',await page.locator('#heroOpen,#inventoryOpen,#forgeOpen,#masteryOpen').count()===4);
 verify('initial roster is one Guardian and one Archer',await page.evaluate(()=>{
  const units=window.__warren.units;return units.length===2&&units.filter(u=>u.cls==='guard').length===1&&units.filter(u=>u.cls==='archer').length===1;
 }));
 await page.evaluate(()=>{const s=window.__warren;
  s.gold=25000;Object.assign(s.inventory,{tier1Blueprint:80,copperOre:400,livingMoss:400,brutalSpore:400,verdantAetherstone:100,astraliteStone:100});
  window.__warrenDev.renderUi();
 });
 verify('one-per-class limit blocks a second Guardian even when Gold is sufficient',await page.locator('[data-buy="guard"]').isDisabled());
 await page.click('#forgeOpen');
 await page.click('#forgePanel [data-forge-class="archer"]');
 await page.click('#forgePanel [data-batch-qty="10"]');
 await page.click('#forgePanel [data-forge-craft="mosswoodBow"]');
 verify('batch modal shows ten actual rolls',await page.locator('#batchPanel .bc-batch-card').count()===10);
 verify('batch rarity filtering',await page.locator('#batchPanel [data-batch-filter]').count()>1);
 const first=await page.locator('#batchPanel [data-batch-lock]').first().getAttribute('data-batch-lock');
 await page.locator('#batchPanel [data-batch-lock="'+first+'"]').check();
 verify('locking piece persists in inventory state',await page.evaluate(id=>window.__warren.gear.find(p=>p.id===id)?.locked,first));
 const choice=await page.locator('#batchPanel [data-batch-equip]').first().getAttribute('data-batch-equip');
 await page.click('#batchPanel [data-batch-equip="'+choice+'"]');
 const [cls,id]=choice.split(':');
 verify('player-chosen class equips recommended piece',await page.evaluate(([cls,id])=>{
  return Object.values(window.__warren.builds[cls][0].gear).includes(id);
 },[cls,id]));
 await page.click('#batchPanel [data-open-item="'+id+'"]');
 verify('equipped item has both upgrade controls',await page.locator('#itemDetailPanel [data-item-enhance]').count()===1&&await page.locator('#itemDetailPanel [data-item-refine]').count()===1);
 await page.click('#itemDetailPanel [data-item-enhance="'+id+'"]');
 verify('enhance belongs to CLASS SLOT',await page.evaluate(cls=>window.__warren.progress[cls].weapon.enhance===1,cls));
 await page.click('#itemDetailPanel [data-item-refine="'+id+'"]');
 verify('manual refine belongs to CLASS SLOT',await page.evaluate(cls=>window.__warren.progress[cls].weapon.refine===1,cls));
 await page.click('#itemDetailPanel [data-item-close]');
 await page.click('#batchPanel [data-batch-select-leftovers]');
 const selected=await page.evaluate(()=>window.__warren.batchSelection.slice());
 if(selected.length){
  await page.click('#batchPanel [data-batch-confirm]');
  verify('salvage confirmation lists exact selected items',await page.locator('#batchPanel .bc-batch-confirm').isVisible());
  await page.click('#batchPanel [data-batch-dismantle]');
  verify('selected salvage only; locked and equipped pieces survive',await page.evaluate(([locked,equipped,selected])=>{
   const s=window.__warren;return s.gear.some(p=>p.id===locked)&&s.gear.some(p=>p.id===equipped)&&selected.every(x=>!s.gear.some(p=>p.id===x));
  },[first,id,selected]));
 }
 await page.click('#batchPanel [data-modal-close]');
 await page.click('#heroOpen');
 verify('hero uses Blessed Bunny image',await page.locator('#heroPanel .bc-bunny-sprite').evaluate(x=>x.complete&&x.naturalWidth>0));
 await page.locator('#heroPanel [data-forge-class="'+cls+'"]').click();
 await page.click('#heroPanel #enhanceAll');
 verify('Enhance All Max exists and upgrades slot',await page.evaluate(cls=>window.__warren.progress[cls].weapon.enhance>=1,cls));
 await page.click('#heroPanel [data-modal-close]');
 await page.click('#masteryOpen');
 verify('mastery shows seven weapon-family milestones',await page.locator('#masteryPanel .bc-master-step').count()===5);
 await page.evaluate(()=>{window.__warren.mastery.guard.level=10;window.__warren.mastery.guard.xp=500;window.__warrenDev.renderUi();});
 await page.click('#masteryPanel [data-mastery-class="guard"]');
 await page.click('#masteryPanel [data-unlock-mastery="guard"]');
 verify('gold mastery unlock + milestone',await page.evaluate(()=>window.__warren.mastery.guard.unlocked.includes(10)));
 await page.click('#masteryPanel [data-modal-close]');
 await page.evaluate(()=>{const s=window.__warren;
  for(const [x,y] of [[1510,1370],[1070,1370],[1360,1050],[1140,1000]]){
   const n=s.towers.length;window.__warrenDev.placeTower(x,y);if(s.towers.length>n)break;
  }
 });
 verify('can build a tower at real standable location',await page.evaluate(()=>window.__warren.towers.length>0));
 await page.evaluate(()=>{window.__warren.selectedTower=0;window.__warren.modal='tower';window.__warrenDev.renderUi();});
 await page.click('#towerPanel [data-tower-hire="mage"]');
 verify('tower recruits one mage, separate from one-per-class field cap',await page.evaluate(()=>window.__warren.towers[0].garrison?.cls==='mage'));
 await page.click('#towerPanel [data-tower-upgrade]');
 verify('tower upgrade increases HP but not damage',await page.evaluate(()=>window.__warren.towers[0].level===2&&window.__warren.towers[0].maxHp===410));
 await page.click('#towerPanel [data-modal-close]');
 await page.evaluate(()=>{window.__warren.modal='lodge';window.__warrenDev.renderUi();});
 await page.click('#lodgePanel [data-lodge-upgrade]');
 verify('Healing Lodge upgrade',await page.evaluate(()=>window.__warren.healingLevel===2));
 await page.click('#lodgePanel [data-modal-close]');
 await page.evaluate(()=>{window.__warren.night=true;window.__warren.selectedTower=0;window.__warren.modal='tower';window.__warrenDev.renderUi();});
 verify('night blocks repair, construction, recruitment and tower upgrades',await page.evaluate(()=>{
  const s=window.__warren;
  return document.querySelector('#repair').disabled&&document.querySelector('#build').disabled&&
   [...document.querySelectorAll('[data-buy]')].every(b=>b.disabled)&&document.querySelector('[data-tower-upgrade]').disabled&&
   window.__warrenDev.upgradeTower(0)===false&&window.__warrenDev.hireGarrison(0,'archer')===false;
 }));
 await page.evaluate(()=>{window.__warren.night=false;window.__warren.modal=null;window.__warrenDev.save();window.__warrenDev.renderUi();});
 await page.reload();await page.waitForFunction(()=>window.__warren?.gear?.length>0,null,{timeout:150000});
 verify('v3 save/reload keeps tower/garrison/slot upgrades, mastery and item locks',await page.evaluate(id=>{
  const s=window.__warren;return s.towers[0].garrison?.cls==='mage'&&s.healingLevel===2&&s.mastery.guard.unlocked.includes(10)&&
    s.gear.some(p=>p.id===id&&p.locked)&&s.progress.archer.weapon.enhance>=1;
 },first));
 verify('all main-game icons actually load',await page.locator('#heroOpen img').evaluate(x=>x.complete&&x.naturalWidth>0));
 await context.close();
}
async function classSwitch(){
 const {context,page}=await newGame();
 const ids=await page.evaluate(()=>{
   const s=window.__warren;s.gold=25000;
   Object.assign(s.inventory,{tier1Blueprint:60,copperOre:400,livingMoss:400,brutalSpore:400});
   const armor=window.__warrenDev.craftGear('t1Armor');
   const spare=window.__warrenDev.craftGear('t1Armor');
   const bow=window.__warrenDev.craftGear('mosswoodBow');
   return {armor:armor?.id,spare:spare?.id,bow:bow?.id};
 });
 verify('class-switch setup has both shared armor and archer-only bow',!!ids.armor&&!!ids.spare&&!!ids.bow,{ids});
 const guard=await page.evaluate(()=>window.__warren.units.find(u=>u.cls==='guard')?.id);
 await page.click('#squad [data-hero-unit="'+guard+'"]');
 verify('the previously opened bunny belongs to Guardian',await page.evaluate(()=>window.__warren.forgeClass==='guard'));
 await page.click('#heroPanel [data-forge-class="archer"]');
 await page.click('#heroPanel [data-open-inventory="equipment"]');
 verify('inventory visibly highlights the currently selected Archer',
   await page.locator('#inventoryPanel [data-forge-class="archer"]').getAttribute('class')==='active'&&
   (await page.locator('#inventoryPanel .bc-modal-header').innerText()).includes('นักธนู'));
 await page.click('#inventoryPanel [data-forge-class="guard"]');
 await page.click('#inventoryPanel [data-forge-class="archer"]');
 await page.click('#inventoryPanel [data-open-item="'+ids.armor+'"]');
 verify('Archer stays selected when opening armor after previously inspecting Guardian',
   await page.locator('#itemDetailPanel [data-item-class]').inputValue()==='archer'&&
   (await page.locator('#itemDetailPanel [data-item-equip]').innerText()).includes('นักธนู'));
 await page.click('#itemDetailPanel [data-item-equip="'+ids.armor+'"]');
 verify('shared armor equips to Archer rather than stale Guardian',
   await page.evaluate(id=>{const s=window.__warren;return s.builds.archer[0].gear.armor===id&&
     s.builds.guard[0].gear.armor!==id&&s.forgeClass==='archer';},ids.armor));
 await page.click('#itemDetailPanel [data-item-close]');
 await page.click('#inventoryPanel [data-open-item="'+ids.spare+'"]');
 await page.locator('#itemDetailPanel [data-item-class]').selectOption('guard');
 verify('explicitly choosing Guardian only changes the open item detail',
   await page.locator('#itemDetailPanel [data-item-class]').inputValue()==='guard'&&
   await page.evaluate(()=>window.__warren.forgeClass==='archer'));
 await page.click('#itemDetailPanel [data-item-close]');
 await page.click('#inventoryPanel [data-open-item="'+ids.spare+'"]');
 verify('reopening an item resets the default to the active Archer class',
   await page.locator('#itemDetailPanel [data-item-class]').inputValue()==='archer');
 await page.click('#itemDetailPanel [data-item-close]');
 await page.click('#inventoryPanel [data-modal-close]');
 await page.click('#forgeOpen');
 await page.click('#forgePanel [data-forge-class="guard"]');
 await page.click('#forgePanel [data-forge-class="archer"]');
 await page.click('#forgePanel [data-batch-qty="10"]');
 await page.click('#forgePanel [data-forge-craft="mosswoodBow"]');
 const batchId=await page.locator('#batchPanel [data-open-item]').first().getAttribute('data-open-item');
 await page.click('#batchPanel [data-open-item="'+batchId+'"]');
 verify('batch-craft item detail inherits selected Archer and enables its weapon',
   await page.locator('#itemDetailPanel [data-item-class]').inputValue()==='archer'&&
   await page.locator('#itemDetailPanel [data-item-equip="'+batchId+'"]').isEnabled());
 await context.close();
}

async function migration(){
 const {context,page}=await newGame();
 await page.evaluate(()=>{
  window.__warren.resetting=true;
  localStorage.removeItem('burrow-command-save-v3');
  localStorage.setItem('burrow-command-save-v2',JSON.stringify({v:2,gold:100,warren:3,wave:5,day:12,kills:23,
   inventory:{copperOre:30},gear:[],builds:{},units:[{cls:'guard',level:8,name:'Old hero'},{cls:'guard',level:7},{cls:'guard',level:6}],towers:[]}));
 });
 await page.reload();await page.waitForFunction(()=>window.__warren?.day===12,null,{timeout:150000});
 verify('v2->v3 migration preserves overleveled hero and spare recruit',await page.evaluate(()=>{
  const s=window.__warren;return s.warren===3&&s.units.find(x=>x.name==='Old hero').level===8&&
   s.units.filter(x=>x.cls==='guard').length===1&&s.reserve.length===2&&!!localStorage.getItem('burrow-command-save-v3');
 }));
 await context.close();
}
async function defense(){
 const {context,page}=await newGame();
 const details=await page.evaluate(()=>{
  const s=window.__warren;s.gold=500;s.inventory.livingMoss=25;s.inventory.brutalSpore=25;s.inventory.copperOre=25;
  for(const [x,y] of [[1510,1370],[1070,1370],[1360,1050]]){
   const n=s.towers.length;window.__warrenDev.placeTower(x,y);
   if(s.towers.length>n)break;
  }
  if(!s.towers.length)return {error:'no standable tower location'};
  s.clock=79.95;window.__warrenStep(.1); // starts nighttime; field mobs are cleared
  for(let i=0;i<14&&!s.monsters.some(m=>m.night&&!m.dead);i++)window.__warrenStep(.12);
  const m=s.monsters.find(m=>m.night&&!m.dead);
  if(!m)return {error:'night monster did not spawn'};
  const t=s.towers[0];
  // Put a live raider outside the original 250px ring sector, approaching this tower.
  m.x=t.x+270;m.y=t.y+150;m.home={x:m.x,y:m.y};
  for(const other of s.monsters)if(other!==m)other.dead=true;
  s.queue=[];
  const previous=s.units.map(u=>({dist:Math.hypot(u.x-m.x,u.y-m.y),x:u.x,y:u.y}));
  window.__warrenStep(.15);
  const units=s.units.map((u,i)=>({
   name:u.name,oldDistance:previous[i].dist,distance:Math.hypot(u.x-m.x,u.y-m.y),
   goalDistance:u.goalP?Math.hypot(u.goalP.x-m.x,u.goalP.y-m.y):null,
   moving:u.moving,down:u.down
  }));
  return {tower:{x:t.x,y:t.y,hp:t.hp},monster:{x:m.x,y:m.y,dead:m.dead},units,night:s.night};
 });
 verify('night defense setup: live raider near an un-garrisoned tower',!!details.tower&&details.night&&!details.monster.dead,{details});
 verify('bunnies actively target tower attackers beyond their former ring sector',
  details.units.some(u=>!u.down&&u.goalDistance!==null&&u.goalDistance<50),{details});
 const battle=await page.evaluate(()=>{
  const s=window.__warren,m=s.monsters.find(m=>m.night&&!m.dead),initialHp=m?.hp;
  if(!m)return {error:'raider disappeared before engagement'};
  for(const u of s.units){u.atkUntil=0;u.cd=0;}
  let steps=0;
  for(;steps<45&&!m.dead;steps++)window.__warrenStep(.2);
  return {steps,initialHp,remainingHp:m.hp,dead:m.dead,
   defendersAttacked:s.units.some(u=>u.atkUntil>0),
   towerHp:s.towers[0]?.hp,night:s.night};
 });
 verify('field bunnies actually strike the tower attacker instead of waiting for tower damage',
  battle.defendersAttacked&&(battle.remainingHp<battle.initialHp||battle.dead),{battle});
 await context.close();
}

async function bossRetry(){
 const {context,page}=await newGame();
 await page.evaluate(()=>{
  const s=window.__warren;s.warren=1;s.wave=5;s.cleared=false;s.day=8;s.gold=155;s.burrow=0;s.night=true;s.queue=[];s.clock=2;
  window.__warrenStep(1);
 });
 const lost=await snap(page);
 verify('boss loss keeps identical wave and gold, only repair debt',lost.wave===5&&lost.warren===1&&lost.day===9&&lost.gold===155&&lost.losses===1,{lost});
 await page.evaluate(()=>{window.__warren.clock=79.9;window.__warrenStep(1);});
 const retry=await snap(page);
 verify('automatic rematch repeats boss the NEXT night',retry.night&&retry.wave===5&&await page.evaluate(()=>window.__warren.nightWave===5),{retry});
 await context.close();
}
async function balance(idle=false,days=15,saveProgress=false){
 const {context,page}=await newGame();
 let state;
 for(let day=0;day<days;day++){
  if(!idle)await page.evaluate(d=>{
   const s=window.__warren;
   if(s.night)return;
   if(s.cleared)document.querySelector('#upgrade')?.click();
   if(!document.querySelector('#repair').disabled)document.querySelector('#repair').click();
   // Bot spends only actual loot/Gold, prioritizing equipment and major mastery unlocks.
   if(s.gear.length<2&&s.gold>160&&(s.inventory.tier1Blueprint||0)>0){
    const piece=window.__warrenDev.craftGear(s.gear.length?'t1Armor':'mosswoodBow');
    if(piece){window.__warrenDev.autoEquipBuild('archer');window.__warrenDev.autoEquipBuild('guard');}
   }
   let masteryUnlocks=0;
   for(const cls of Object.keys(s.mastery)){
    const m=s.mastery[cls];
    if(masteryUnlocks||![10,20,30,40,50].includes(m.level)||m.unlocked.includes(m.level)||s.gold<200)continue;
    document.getElementById('masteryOpen')?.click();
    document.querySelector('#masteryPanel [data-mastery-class="'+cls+'"]')?.click();
    const unlock=document.querySelector('#masteryPanel [data-unlock-mastery="'+cls+'"]');
    const before=s.gold;
    if(unlock&&!unlock.disabled){unlock.click();if(s.gold<before)masteryUnlocks++;}
    document.querySelector('#masteryPanel [data-modal-close]')?.click();
   }
   if(s.towers.length<1&&s.gold>155){
    for(const [x,y] of [[1510,1370],[1070,1370],[1360,1050]]){const n=s.towers.length;window.__warrenDev.placeTower(x,y);if(s.towers.length>n)break;}
   }
   for(let i=0;i<s.towers.length;i++){
    if(!s.towers[i].garrison&&s.gold>185)window.__warrenDev.hireGarrison(i,d%2?'mage':'archer');
   }
   let newRecruits=0;
   for(const cls of ['archer','guard','mage','brute','vanguard','axe','scout']){
    if(newRecruits>=2)break;
    const b=document.querySelector('[data-buy="'+cls+'"]');
    if(b&&!b.disabled&&s.gold>180){const before=s.units.length;b.click();if(s.units.length>before)newRecruits++;}
   }
  },day);
  // Simulate a full day/night, in handoff-approved chunks (<=25 per evaluate).
  await step(page,5);await step(page,5);await step(page,5);await step(page,5);await step(page,5);
  state=await snap(page);console.log(idle?'IDLE':'BALANCE',day,JSON.stringify(state));
  if(saveProgress){await page.evaluate(()=>window.__warrenDev.save());await context.storageState({path:BALANCE_STATE});console.log('BALANCE CHECKPOINT',JSON.stringify(state));}
  if((!idle&&state.cleared)||(idle&&state.losses))break;
 }
 verify(idle?'idle bot eventually loses night':'reasonable bot survives to boss or improves',
  idle?state.losses>0:state.kills>=(saveProgress?5:25)&&state.units>=2,{state});
 if(idle)verify('idle loss retains village and retries same wave',state.warren===1&&state.wave>=1,{state});
 if(saveProgress){await page.evaluate(()=>window.__warrenDev.save());await context.storageState({path:BALANCE_STATE});
  console.log('BALANCE SAVED',BALANCE_STATE,JSON.stringify(state));}
 await context.close();
}
try{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-dev-shm-usage']});
 const mode=process.argv.find(a=>a.startsWith('--'))||'--smoke';
 if(mode==='--smoke')await smoke();
 else if(mode==='--migration')await migration();
 else if(mode==='--class-switch')await classSwitch();
 else if(mode==='--boss')await bossRetry();
 else if(mode==='--defense')await defense();
 else if(mode==='--balance')await balance(false);
 else if(mode==='--balance-start'){if(fs.existsSync(BALANCE_STATE))fs.unlinkSync(BALANCE_STATE);await balance(false,2,true);}
 else if(mode==='--balance-resume')await balance(false,1,true);
 else if(mode==='--idle')await balance(true);
 verify('no browser runtime exceptions',!errors.length,{errors});
 console.log('BOT PASS',JSON.stringify(result));
}catch(e){console.error('BOT FAIL',String(e),JSON.stringify(result),'ERRORS',JSON.stringify(errors.slice(0,10)));process.exitCode=1;
}finally{if(browser)await browser.close();await new Promise(r=>server.httpServer.close(r));}
