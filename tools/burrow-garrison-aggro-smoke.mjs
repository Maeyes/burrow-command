// Regression for the Night-94 hard lock: tower garrison spell aggro cannot be a field-unit target.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4341,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];
const check=(name,ok,details)=>{if(!ok)throw Error('FAIL '+name+' '+JSON.stringify(details));console.log('PASS '+name)};
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 p.on('pageerror',e=>errors.push(e.stack||e.message));
 p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await p.waitForFunction(()=>window.__warrenDev&&window.__slice&&window.__warren?.units?.length>=2,null,{timeout:50000});
 await p.evaluate(()=>{__warren.warren=11;__warren.gold=100000;__warrenDev.save()});
 await p.reload();
 await p.waitForFunction(()=>window.__warrenDev&&window.__slice&&window.__warren?.units?.length>=2,null,{timeout:50000});
 const outcome=await p.evaluate(()=>{
   const s=__warren,d=__warrenDev,C={x:1280,y:1280};
   s.gold=100000;s.inventory.livingMoss=10000;s.inventory.brutalSpore=10000;
   for(const angle of [.5,1.5,2.5,3.5,4.5,5.5]){if(s.towers.length)break;d.placeTower(C.x+Math.cos(angle*Math.PI/3)*300,C.y+Math.sin(angle*Math.PI/3)*300);}
   const tower=s.towers[0];if(!tower)return{reason:'no-tower'};
   d.hireGarrison(0,'mage');
   const mage=tower.garrison;
   mage.level=22;s.classSkills.mage.active[0]='chainLightning';s.day=94;s.night=true;s.waveTimer=999;s.queue=[];s.clock=0;s.burrow=100000;
   __warrenStep(.04); // initialize the garrison's combat stats and coordinates
   const m=d.spawnMonster('duneling1',tower.x+35,tower.y,{night:true,power:100});
   if(!m)return{reason:'monster-not-spawned'};
   const orig=Math.random;Math.random=()=>.1;
   let cast;
   try{cast=d.castCore(mage,m,'chainLightning');}finally{Math.random=orig;}
   const aggroAfterCast=m.aggro===mage;
   // Simulate an older pending monster target surviving a migration/frame boundary.
   m.aggro=mage;
   const oldHp=tower.hp;
   __warrenStep(2.7); // legacy code threw when lethal retaliation read mage.carry.gold
   return{cast,aggroAfterCast,aggroAfterStep:m.aggro===mage,clock:s.clock,night:s.night,damagedTower:tower.hp<oldHp,monsterAlive:!m.dead,mageHasBag:Boolean(mage.carry)};
 });
 check('Mage garrison and raider fixture initialized',!outcome.reason&&outcome.mageHasBag===false,outcome);
 check('authoritative Core cast accepted',outcome.cast===true,outcome);
 check('tower Core does not aggro its bagless occupant',outcome.aggroAfterCast===false,outcome);
 check('legacy garrison aggro discarded and simulation advances',outcome.aggroAfterStep===false&&outcome.clock>2&&outcome.night,outcome);
 check('no uncaught browser exception',errors.length===0,errors);
}catch(e){console.error(e.stack||e,'BROWSER ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
