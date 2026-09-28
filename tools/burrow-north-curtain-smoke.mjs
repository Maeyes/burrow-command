// Real end-to-end northern curtain: paid annex, 15 paintable cliff-crest tiles,
// one connected curtain, physical face continuity at left/right caps, save/load,
// then removal/splitting without touching the user's browser profile.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4277,strictPort:false}});
const browser=await chromium.launch({headless:true}),errors=[];
const assert=(label,ok)=>{if(!ok)throw new Error('FAIL '+label);console.log('PASS '+label);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 const url=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html';
 const ready=()=>page.waitForFunction(()=>window.__warrenDev&&window.__slice?.terrain&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:55000});
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();
 if(await page.locator('#waterfallGuidePanel').isVisible())await page.locator('#waterfallGuidePanel [data-waterfall-guide-close]').first().click();
 const unlocked=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.gold=999999;s.inventory.livingMoss=999999;d.setHomeOpen(true);
  d.upgradePerimeter();d.upgradePerimeter();
  const south=[1,2,3].map(i=>d.buyHomePlot('north'+i)),north=d.expandHomeWall('north');
  const upper=[1,2,3].map(i=>d.buyHomePlot('northUpper'+i)),last=d.expandHomeWall('northUpper');
  return {south,north,upper,last,walls:s.fences.length,gates:s.fences.filter(f=>f.kind==='gate').length};
 });
 assert('two paid north expansions join the full level-3 cliff',unlocked.south.every(Boolean)&&unlocked.upper.every(Boolean)&&unlocked.north&&unlocked.last&&unlocked.walls===59&&unlocked.gates===3);
 const painted=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.homeAction='terrain';s.homeTerrainBrush='water';
  const results=[];for(let x=13;x<=27;x++)for(const y of [2,3,4]){
   const ok=d.paintHomeTerrain(x*64,y*64);results.push({x,y,ok,reason:s.homeTerrainNotice});
  }
  return {all:results.every(r=>r.ok),failed:results.filter(r=>!r.ok),count:s.homeTerrainDraft?.length,notice:s.homeTerrainNotice,
    before:s.homeBuilder.waterfalls.length,currency:s.gold};
 });
 if(!painted.all||painted.count!==45||painted.before!==0){
  console.log('PAINT DIAGNOSTIC',JSON.stringify(painted));
  console.log('NEAR WALLS',JSON.stringify(await page.evaluate(()=>__warren.fences.filter(f=>{
   const x=f.x+(f.axis==='x'?(f.len||1)/2:0),y=f.y+(f.axis==='y'?(f.len||1)/2:0);
   return Math.hypot(13-x,4-y)<1||Math.hypot(27-x,4-y)<1;
  }).map(f=>({x:f.x,y:f.y,axis:f.axis,len:f.len,kind:f.kind})))));
 }
 assert('all 15 crest tiles including left/right cap accept water and downhill basins',painted.all&&painted.count===45&&painted.before===0);
 const nav=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:55000});
 const did=await page.evaluate(()=>__warrenDev.commitHomeTerrain());await nav;await ready();
 assert('terrain confirmation triggers one rebake with automatic curtain',did);
 const baked=await page.evaluate(()=>{
  const s=__warren,t=__slice.terrain;
  const byX=Array.from({length:15},(_,k)=>{
   const i=k+13,x=i*64;return {i,high:t.heightAt(x,2*64),low:t.heightAt(x,3*64),
     topWater:t.matAt(x,2*64),basinWater:t.matAt(x,3*64),
     falls:t.falls.filter(f=>Math.abs(f.x-x)<30&&Math.abs(f.y-160)<1.5).length};
  });
  return {groups:s.homeBuilder.waterfalls.map(w=>({type:w.type,width:w.sourceTiles?.length,caps:w.faceTiles?.map(c=>c.cap)})),byX,
    grassTop:t.matAt(12*64,2*64),wallCount:s.fences.length};
 });
 assert('save holds exactly one fifteen-tile curtain and left/right caps',baked.groups.length===1&&baked.groups[0].type==='north-curtain'&&baked.groups[0].width===15&&baked.groups[0].caps[0]==='left'&&baked.groups[0].caps[14]==='right');
 assert('actual native water/cliff faces are continuous across all fifteen owned tiles',baked.byX.every(x=>x.high-x.low>130&&x.topWater===2&&x.basinWater===2&&x.falls>=3));
 assert('natural northern crest outside purchased source does not generate a dirt pedestal',baked.grassTop!==2&&baked.wallCount===59);
 await page.evaluate(()=>__warrenDev.save());await page.reload({waitUntil:'domcontentloaded'});await ready();
 assert('full curtain and normal cliff collision survive save/load',await page.evaluate(()=>__warren.homeBuilder.waterfalls.length===1&&__warren.homeBuilder.waterfalls[0].sourceTiles.length===15&&__slice.terrain.falls.filter(f=>Math.abs(f.y-160)<1.5).length>=60));
 const split=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;d.setHomeOpen(true);s.homeAction='terrain';s.homeTerrainBrush='erase';
  const erased=d.paintHomeTerrain(20*64,2*64);
  return {erased,notice:s.homeTerrainNotice,preview:s.homeTerrainDraft?.length};
 });
 assert('crest water can be erased independently without modifying natural level-3 rock',split.erased&&split.preview===44);
 const nav2=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:55000});
 await page.evaluate(()=>__warrenDev.commitHomeTerrain());await nav2;await ready();
 const after=await page.evaluate(()=>{
  const s=__warren,t=__slice.terrain;
  return {groups:s.homeBuilder.waterfalls.map(w=>w.sourceTiles.map(s=>s.i)),
   dry:t.matAt(20*64,2*64),high:t.heightAt(20*64,2*64),left:t.matAt(19*64,2*64),right:t.matAt(21*64,2*64)};
 });
 assert('removing one crest tile splits curtain into two runs with natural dry rock between',after.groups.length===2&&after.groups[0].at(-1)===19&&after.groups[1][0]===21&&after.dry!==2&&after.high===132&&after.left===2&&after.right===2);
 assert('zero browser errors after long curtain paint, reload and partial removal',errors.length===0);
 await page.close();
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
