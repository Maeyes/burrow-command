// Real browser regression for the last north annex and the map-edge cliff.
// Isolated Playwright context; never opens or mutates the user's real save.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4224,strictPort:false}});
const browser=await chromium.launch({headless:true}),errors=[];
const check=(name,pass)=>{if(!pass)throw Error('FAIL '+name);console.log('PASS '+name);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 const url=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html';
 const ready=()=>page.waitForFunction(()=>window.__warrenDev&&window.__slice?.terrain&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 await page.goto(url);await ready();
 const before=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.gold=999999;s.inventory.livingMoss=999999;
  d.setHomeOpen(true);d.upgradePerimeter();d.upgradePerimeter(); // actual stone sprite
  const early=d.buyHomePlot('northUpper1');
  const purchased=[1,2,3].map(n=>d.buyHomePlot('north'+n));
  const first=d.expandHomeWall('north');
  return {early,first,purchased,count:s.fences.length,top:s.fences.filter(f=>f.kind==='fence'&&f.axis==='x'&&f.y===7.5).length};
 });
 check('upper plots are gated by the original northern annex',!before.early&&before.purchased.every(Boolean));
 check('first north expansion retains fifteen north-wall segments',before.first&&before.count===64&&before.top===15);
 const final=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  const bought=[1,2,3].map(n=>d.buyHomePlot('northUpper'+n));
  const preview=d.previewHomeWall('northUpper');
  const complete=d.expandHomeWall('northUpper');
  const northParts=s.fences.filter(f=>f.kind==='fence'&&f.axis==='x'&&f.y<=7.5);
  const ends=s.fences.filter(f=>f.axis==='y'&&f.y===2.5).map(f=>f.x);
  const visible=new Set(__slice.WS.objects.filter(o=>o.bcFenceId).map(o=>o.bcFenceId)).size;
  const foot=s.homeBuilder.wallLayoutId;
  return {bought,preview:preview?.ok,complete,count:s.fences.length,northParts:northParts.length,ends,visible,foot,gates:s.fences.filter(f=>f.kind==='gate').map(f=>f.side)};
 });
 check('second five-tile north strip is separately purchased and validated',final.bought.every(Boolean)&&final.preview&&final.complete);
 check('final north boundary removes wall rather than duplicating it',final.count===59&&final.northParts===0&&final.ends.includes(12.5)&&final.ends.includes(27.5));
 check('cliff replaces north wall with exactly three surviving S/E/W gates',final.visible===59&&final.gates.sort().join(',')==='east,south,west');
 const render=await page.evaluate(async()=>{
  const ctx=document.getElementById('scene').getContext('2d'),original=ctx.drawImage;
  const stone=new Set(__slice.WS.objects.filter(o=>o.bcFenceId&&o.kind==='sprite').map(o=>o.img));
  let draws=0;
  ctx.drawImage=function(img,...args){if(stone.has(img))draws++;return original.call(this,img,...args);};
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  ctx.drawImage=original;
  return {draws,spriteSources:stone.size};
 });
 check('stationary camera paints the new stone walls without WASD',render.spriteSources>0&&render.draws>12);
 const cliffs=await page.evaluate(()=>{
  const t=__slice.terrain,d=__warrenDev,x=20*64;
  const high=t.heightAt(x,2*64),low=t.heightAt(x,3*64);
  return {high,low,blocked:!d.canRuntimeActorStand(x,2*64,low),gates:__warren.fences.filter(f=>f.kind==='gate').length};
 });
 check('map-edge level-3 cliff physically blocks crossing at the north end',cliffs.high>cliffs.low+30&&cliffs.blocked&&cliffs.gates===3);
 const painted=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.homeAction='terrain';s.homeTerrainBrush='water';
  const results=[2,3,4,5].map(y=>d.paintHomeTerrain(20*64,y*64));
  return {results,draft:s.homeTerrainDraft?.length,notice:s.homeTerrainNotice};
 });
 check('user can paint crest water, basin and river in the final north annex',painted.results.every(Boolean)&&painted.draft===4);
 const navigation=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:45000});
 await page.evaluate(()=>__warrenDev.commitHomeTerrain());await navigation;await ready();
 check('new cliff footprint and the three gates persist after terrain rebake',await page.evaluate(()=>
  __warren.homeBuilder.expandedSides.includes('northUpper')&&__warren.fences.length===59&&__warren.fences.filter(f=>f.kind==='gate').length===3));
 const fall=await page.evaluate(()=>({fall:__warren.homeBuilder.waterfalls[0]}));
 check('committing crest and basin automatically creates a structured natural curtain',fall.fall?.type==='north-curtain'&&fall.fall.sourceTiles.length===1&&fall.fall.riverPath.length>=2);
 await page.reload();await ready();
 const water=await page.evaluate(()=>{
  const s=__warren,t=__slice.terrain,x=20*64;
  return {saved:s.homeBuilder.waterfalls.length,high:t.heightAt(x,2*64),below:t.heightAt(x,3*64),
    falls:t.falls.filter(f=>Math.abs(f.x-x)<70&&Math.abs(f.y-160)<30).length,
    walls:s.fences.length,visible:new Set(__slice.WS.objects.filter(o=>o.bcFenceId).map(o=>o.bcFenceId)).size};
 });
 check('saved cliff waterfall is baked into the real terrain mesh',water.saved===1&&water.high>water.below+30&&water.falls>0);
 check('reloading does not recreate the removed north wall',water.walls===59&&water.visible===59);
 check('browser reports no uncaught runtime errors',errors.length===0);
 await page.close();
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
