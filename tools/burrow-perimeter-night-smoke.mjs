// Actual nighttime raider versus destructible automatic wall. Independent browser save.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4195,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1365,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,yes)=>{if(!yes)throw Error('FAIL '+name);console.log('PASS '+name);};
const ready=()=>page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:60000});
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');await ready();
 await page.evaluate(()=>{__warren.inventory.livingMoss=400;__warrenDev.renderUi();});
 await page.click('#fenceBuild');
 await page.evaluate(()=>__warrenStep(9));
 const start=await page.evaluate(()=>{
  const s=__warren,m=s.monsters.find(m=>!m.dead),f=s.fences.find(f=>f.kind==='fence');
  if(!m)throw Error('No daytime monster spawned for regression');
  const p={x:(f.x+(f.axis==='x'?.5:0))*64,y:(f.y+(f.axis==='y'?.5:0))*64};
  s.units.forEach(u=>u.down=true);s.monsters=s.monsters.filter(x=>x===m);
  s.night=true;s.queue=[];s.clock=0;s.waveTimer=1000;
  Object.assign(m,{x:p.x,y:p.y-24,night:true,elite:true,boss:false,aggro:null,passedGate:false,cd:0,stuck:0,maxHp:1000,hp:1000});
  return {firstHp:f.hp,wallHp:__warrenDev.perimeterHealth().hp,fKey:f.axis+':'+f.x+':'+f.y,
   from:{x:m.x,y:m.y},centerStraight:__warrenDev.canWalkStraight(m.x,m.y,1280,1280)};
 });
 check('elite raider placed just outside a solid wall with direct hall access blocked',start.firstHp===55&&!start.centerStraight);
 await page.evaluate(()=>__warrenStep(2));
 const outcome=await page.evaluate(key=>{
  const f=__warren.fences.find(f=>f.axis+':'+f.x+':'+f.y===key);
  const m=__warren.monsters[0];
  return {firstHp:f.hp,wallHp:__warrenDev.perimeterHealth().hp,night:__warren.night,monster:!!m&&!m.dead,
   distance:m?Math.hypot(m.x-(f.x+(f.axis==='x'?.5:0))*64,m.y-(f.y+(f.axis==='y'?.5:0))*64):null};
 },start.fKey);
 console.log('night raid outcome',JSON.stringify(outcome));
 check('real night AI damages a solid wall while blocked, rather than hitting the Hall remotely',
  outcome.firstHp<start.firstHp&&outcome.wallHp<start.wallHp&&outcome.night===true);
 check('no browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
