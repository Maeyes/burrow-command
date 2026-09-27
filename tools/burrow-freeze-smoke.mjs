// Repro harness for late-game Warren frame pressure. No player saves are read or changed.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const srv=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4334,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 const p=await browser.newPage({viewport:{width:1490,height:860}});
 p.on('pageerror',e=>errors.push(e.stack||e.message));
 p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(srv.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await p.waitForFunction(()=>window.__warrenDev&&window.__slice&&window.__warren?.units?.length>=2,null,{timeout:60000});
 await p.evaluate(()=>{const s=window.__warren;s.warren=11;s.day=94;s.gold=100000;window.__warrenDev.save();});
 await p.reload();
 await p.waitForFunction(()=>window.__warrenDev&&window.__slice&&window.__warren?.units?.length>=2,null,{timeout:60000});
 const report=await p.evaluate(()=>{
  const s=window.__warren,dev=window.__warrenDev;
  s.gold=100000;s.day=94;s.warren=11;s.wave=4;s.burrow=100000;s.night=true;s.clock=0;s.queue=[];s.waveTimer=999;
  // Match the reported save: full stone perimeter with two nighttime gates shut.
  s.night=false;s.inventory.livingMoss=100000;s.inventory.brutalSpore=100000;
  for(let tier=0;tier<3;tier++)dev.upgradePerimeter();
  s.gateClosed=['south','east'];s.clock=79.95;window.__warrenStep(.1);
  s.queue=[];s.waveTimer=999;s.clock=0;s.night=true;
  const classes=['guard','archer','scout','brute','axe','vanguard','mage'];
  for(const cls of classes)while(s.units.filter(u=>u.cls===cls).length<2)dev.recruit(cls);
  for(const cls of classes){s.mastery[cls]={level:31,xp:0,unlocked:[10,20,30]};}
  s.classSkills.mage.active[0]='chainLightning';s.classSkills.archer.active[0]='skyfallBarrage';
  for(const u of s.units){u.level=30;u.hp=u.maxHp;}
  for(let i=0;i<40;i++){
    const a=i*Math.PI*2/40,r=540+i%3*24;
    dev.spawnMonster(['duneling1','cactling1'][i%2],1280+Math.cos(a)*r,1280+Math.sin(a)*r,{night:true,power:4});
  }
  const startStats={units:s.units.length,monsters:s.monsters.length,actors:window.__slice.actors.length,wallLevel:s.wallLevel,closedGates:s.gateClosed.length};
  const runs=[];
  for(let i=0;i<4;i++){
    const before=performance.now();window.__warrenStep(1);const after=performance.now();
    runs.push({ms:Math.round(after-before),monsters:s.monsters.filter(m=>!m.dead).length,events:s.events.length,fx:window.__slice.actors.filter(a=>a.fx).length});
  }
  const u0=performance.now();for(let i=0;i<20;i++)dev.renderUi();const ui20=performance.now()-u0;
  return{startStats,runs,ui20:Math.round(ui20),end:{day:s.day,night:s.night,monsters:s.monsters.length}};
 });
 const frames=await p.evaluate(()=>new Promise(resolve=>{
   const marks=[],stats=[];let last=performance.now(),start=last;
   function raf(now){marks.push(now-last);last=now;
     if(Math.floor((now-start)/1000)>stats.length)stats.push({second:stats.length+1,live:__warren.monsters.filter(m=>!m.dead).length,actors:__slice.actors.length,events:__warren.events.length});
     if(now-start<4500)requestAnimationFrame(raf);
     else resolve({frames:marks.length,meanFrameMs:Math.round(marks.reduce((a,b)=>a+b,0)/marks.length),maxFrameMs:Math.round(Math.max(...marks)),over100ms:marks.filter(n=>n>100).length,stats});
   }requestAnimationFrame(raf);
 }));
 const session=await p.context().newCDPSession(p);
 await session.send('Profiler.enable');await session.send('Profiler.setSamplingInterval',{interval:1000});await session.send('Profiler.start');
 await p.waitForTimeout(3600);
 const {profile}=await session.send('Profiler.stop');
 const nodesById=new Map(profile.nodes.map(x=>[x.id,x]));
 const counts=new Map();for(const id of profile.samples||[]){const n=nodesById.get(id),f=n?.callFrame;if(!f)continue;const key=(f.functionName||'[anonymous]')+' '+(f.url||'').split('/').pop()+':'+f.lineNumber;counts.set(key,(counts.get(key)||0)+1);}
 const hot=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,22).map(([name,samples])=>({name,samples}));
 console.log(JSON.stringify({report,frames,hot,errors},null,2));
 if(report.startStats.units!==14||report.startStats.monsters<40||report.startStats.wallLevel!==3||report.startStats.closedGates!==2)
   throw new Error('Late-wave fixture drifted: '+JSON.stringify(report.startStats));
 if(frames.frames<30||frames.maxFrameMs>1800)
   throw new Error('Late-wave frame hang detected: '+JSON.stringify(frames));
 if(errors.length)throw new Error('Browser errors: '+JSON.stringify(errors));
 console.log('PASS late-wave 14-bunny/40-raider closed-stone-wall simulation and responsive frames');
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>srv.httpServer.close(resolve));}
