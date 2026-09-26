// Three-gate perimeter: two selectable closures at dusk, one guaranteed opening, and destructible doors.
// Uses an isolated Playwright profile. Never touches the player's saved village.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4198,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
const ready=()=>page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:60000});
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');await ready();
 await page.evaluate(()=>{__warren.inventory.livingMoss=500;__warren.gold=10000;__warrenDev.renderUi();});
 await page.click('#fenceBuild');
 await page.click('#fenceBuild'); // Lv2 must use the SAME stoneWall/stoneGate sprites as the editor.
 check('three selectable approaches; north stays a continuous solid wall',await page.evaluate(()=>{
  const f=__warren.fences;
  return f.filter(x=>x.kind==='gate').map(x=>x.side).join(',')==='south,west,east'&&
   f.filter(x=>x.axis==='x'&&x.y===12.5).length===15&&
   f.every(x=>x.material==='stone')&&
   __slice.WS.objects.filter(o=>o.editorPrefab==='stoneGate').length===3&&
   __slice.WS.objects.filter(o=>o.editorPrefab==='stoneWall').length===51&&
   document.querySelectorAll('#gateControls button[data-gate-side]').length===3;
 }));
 await page.click('[data-gate-side="south"]');
 await page.click('[data-gate-side="east"]');
 check('player selects up to two sides to close while retaining one open',await page.evaluate(()=>
  __warren.gateClosed.join(',')==='south,east'&&document.querySelector('[data-gate-side="west"]').disabled&&
  __warren.fences.filter(f=>f.kind==='gate'&&f.closed).length===0));
 await page.reload();await ready();
 check('door selection survives reload, daytime gates all passable',await page.evaluate(()=>
  __warren.gateClosed.join(',')==='south,east'&&
  __warren.fences.filter(f=>f.kind==='gate').every(f=>!f.closed&&
   !__slice.WS.colliders.some(c=>c.bcFenceId===f.axis+':'+f.x+':'+f.y))));
 await page.evaluate(()=>{__warren.clock=79.95;__warrenStep(1);});
 check('dusk closes selected gates but keeps the third open with live nav colliders',await page.evaluate(()=>{
  const f=__warren.fences.filter(f=>f.kind==='gate');
  return __warren.night&&f.filter(f=>f.closed).length===2&&
   f.every(g=>__slice.WS.objects.some(o=>o.kind==='gate'&&o.editorPrefab==='stoneGate'&&o.editorStoneSprite?.img?.width>0&&
    o.bcFenceId===g.axis+':'+g.x+':'+g.y&&o.closed===g.closed))&&
   f.every(g=>__slice.WS.colliders.some(c=>c.bcFenceId===g.axis+':'+g.x+':'+g.y)===g.closed)&&
   !__warrenDev.canWalkStraight(1280,1720,1280,1800)&&
   __warrenDev.canWalkStraight(770,1280,635,1280);
 }));
 const setup=await page.evaluate(()=>{
  const s=__warren,monster=s.monsters.find(m=>!m.dead&&m.night);
  if(!monster)throw Error('No night raider available');
  const gate=s.fences.find(f=>f.kind==='gate'&&f.side==='south');
  const p={x:(gate.x+gate.len/2)*64,y:gate.y*64};
  s.units.forEach(u=>{u.down=true;u.hp=0;});
  s.monsters=[monster];s.queue=[];s.waveTimer=999;
  Object.assign(monster,{x:p.x,y:p.y+125,night:true,aggro:null,passedGate:false,cd:0,stuck:0,hp:9999,maxHp:9999,atk:16});
  return {startHp:gate.hp,hallHp:s.burrow,position:p};
 });
 await page.evaluate(()=>__warrenStep(6));
 const result=await page.evaluate(()=>{
  const g=__warren.fences.find(f=>f.side==='south');
  return {hp:g.hp,monster:__warren.monsters[0]?.dead,hallHp:__warren.burrow};
 });
 check('real raider reaches the closed gate and attacks it without remotely damaging Hall',
  result.hp<setup.startHp&&result.hallHp===setup.hallHp&&result.monster===false);
 await page.evaluate(()=>{const m=__warren.monsters[0];m.atk=2000;m.cd=0;});
 await page.evaluate(()=>__warrenStep(3));
 check('raider smashes selected gate and removes its collider, creating a passable breach',
  await page.evaluate(()=>{
   const g=__warren.fences.find(f=>f.side==='south'),id=g.axis+':'+g.x+':'+g.y;
   return g.hp===0&&!__slice.WS.colliders.some(c=>c.bcFenceId===id)&&
    __warrenDev.canWalkStraight(1280,1720,1280,1800);
  }));
 await page.evaluate(()=>{__warren.monsters.forEach(m=>m.dead=true);__warren.queue=[];__warren.waveTimer=1000;__warrenStep(.6);});
 check('dawn automatically reopens surviving doors; planned next-night closures remain selected',
  await page.evaluate(()=>!__warren.night&&__warren.gateClosed.join(',')==='south,east'&&
    __warren.fences.filter(f=>f.kind==='gate').every(g=>!g.closed)));
 await page.click('#repairAll');
 check('Repair All restores destroyed gate HP and visible open daytime arch',
  await page.evaluate(()=>{
   const g=__warren.fences.find(f=>f.side==='south');
   return g.hp===g.maxHp&&!g.closed&&
    __slice.WS.objects.some(o=>o.kind==='gate'&&o.editorPrefab==='stoneGate'&&o.editorStoneSprite?.img?.width>0&&
     o.bcFenceId===g.axis+':'+g.x+':'+g.y);
  }));
 check('no uncaught page errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
