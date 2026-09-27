// Browser-only 27 Sep Night 94 diagnosis. Isolated context: does not read the user's real save.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4336,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];
try {
 const p=await browser.newPage({viewport:{width:1490,height:860}});
 p.on('pageerror',e=>errors.push(e.stack||e.message));
 p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await p.waitForFunction(()=>window.__warrenDev&&window.__slice&&window.__warren?.units?.length>=2,null,{timeout:50000});
 await p.evaluate(()=>{let s=__warren;s.warren=11;s.day=94;s.gold=100000;__warrenDev.save();});
 await p.reload();
 await p.waitForFunction(()=>window.__warrenDev&&window.__slice&&window.__warren?.units?.length>=2,null,{timeout:50000});
 const setup=await p.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  s.gold=100000;s.inventory.livingMoss=100000;s.inventory.brutalSpore=100000;
  for(let i=0;i<3;i++)d.upgradePerimeter();
  const center={x:1280,y:1280};
  for(let i=0;i<6;i++){
    const a=(i+.5)*Math.PI/3;
    d.placeTower(center.x+Math.cos(a)*300,center.y+Math.sin(a)*300);
  }
  for(let i=0;i<s.towers.length;i++)d.hireGarrison(i,i%2?'mage':'archer');
  for(const cls of ['guard','archer','scout','brute','axe','vanguard','mage']){
    while(s.units.filter(u=>u.cls===cls).length<2)d.recruit(cls);
    s.mastery[cls]={level:31,xp:0,unlocked:[10,20,30]};
  }
  s.classSkills.mage.active=['chainLightning','thunderStorm',null];
  s.classSkills.archer.active=['piercingShot',null,null];
  for(const u of s.units){u.level=30;u.hp=u.maxHp;u.atk*=1.5;u.sp=100;}
  s.day=94;s.wave=4;s.gateClosed=['south','east'];s.clock=79.95;
  __warrenStep(.1);
  s.queue=[];s.waveTimer=999;s.clock=0;s.night=true;s.speed=2;
  for(let i=0;i<65;i++){let a=i*Math.PI*2/65,r=540+(i%4)*25;
    d.spawnMonster(['duneling1','cactling1','mirageJackal1'][i%3],center.x+Math.cos(a)*r,center.y+Math.sin(a)*r,{night:true,power:4});
  }
  return {level:s.warren,day:s.day,night:s.night,units:s.units.length,towers:s.towers.length,monsters:s.monsters.length,wall:s.wallLevel,closed:s.gateClosed,startGameTime:s.time};
 });
 const cdp=await p.context().newCDPSession(p);
 await cdp.send('Performance.enable');
 const baseline=await cdp.send('Performance.getMetrics');
 await p.evaluate(()=>{
   window.__freezeDiag={frames:0,largest:0,gt100:0,samples:[],last:performance.now(),start:performance.now()};
   (function run(now){const d=__freezeDiag,dt=now-d.last;d.last=now;d.frames++;d.largest=Math.max(d.largest,dt);if(dt>100)d.gt100++;
     if(d.frames%60===0)d.samples.push({elapsed:Math.round((now-d.start)/1000),clock:Math.round(__warren.clock),monsters:__warren.monsters.filter(x=>!x.dead).length,fx:__slice.actors.filter(x=>x.fx).length,events:__warren.events.length,objects:__slice.WS.objects.length,colliders:__slice.WS.colliders.length,mem:performance.memory?.usedJSHeapSize});
     requestAnimationFrame(run);
   })(performance.now());
 });
 await p.waitForTimeout(18000);
 const result=await Promise.race([p.evaluate(()=>({...__freezeDiag,now:performance.now(),day:__warren.day,clock:__warren.clock,gameTime:__warren.time,monsters:__warren.monsters.filter(m=>!m.dead).length})),new Promise(r=>setTimeout(()=>r({hung:true}),6000))]);
 const metrics=await cdp.send('Performance.getMetrics');
 const wanted=['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents','LayoutCount','RecalcStyleCount'];
 const filter=m=>Object.fromEntries(m.metrics.filter(x=>wanted.includes(x.name)).map(x=>[x.name,x.value]));
 console.log(JSON.stringify({setup,result,before:filter(baseline),after:filter(metrics),errors},null,2));
 if(errors.length||result.hung||result.frames<100||result.gameTime-setup.startGameTime<20){
   console.error('FAIL hard freeze or simulation clock stall',{errors,setup,result});
   process.exitCode=1;
 }else console.log('PASS: 18s real-browser late wave, game time advances >20s, zero page errors');
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
