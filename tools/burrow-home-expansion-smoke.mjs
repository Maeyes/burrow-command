import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4206,strictPort:false}});
const browser=await chromium.launch({headless:true}),errors=[];
const check=(name,ok)=>{if(!ok)throw Error('FAIL '+name);console.log('PASS '+name);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',err=>errors.push('desktop:'+err.message));
 const url=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html';
 await page.goto(url);await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 const initial=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.gold=999999;s.inventory.livingMoss=999999;
  d.setHomeOpen(true);d.upgradePerimeter();
  const beforeCount=s.fences.length;
  const initialGateCount=s.fences.filter(f=>f.kind==='gate').length;
  const bought=['south1','south2','south3'].map(id=>d.buyHomePlot(id));
  const oldWall=s.fences.find(f=>f.kind==='gate'&&f.side==='south').y;
  const candidate=d.previewHomeWall('south');
  const expanded=d.expandHomeWall('south');
  const newSouth=s.fences.find(f=>f.kind==='gate'&&f.side==='south').y;
  const gates=s.fences.filter(f=>f.kind==='gate').length;
  const visible=new Set(__slice.WS.objects.filter(o=>o.bcFenceId).map(o=>o.bcFenceId)).size;
  return {bought,beforeCount,initialGateCount,oldWall,newSouth,gates,visible,count:s.fences.length,validPreview:candidate?.ok,expanded,layout:s.homeBuilder.wallLayoutId};
 });
 check('purchased plots do not move wall until separate paid expansion',initial.bought.every(Boolean)&&initial.oldWall===27.5&&initial.validPreview);
 check('south wall relocation preserves exactly three functional gates',initial.expanded&&initial.newSouth===32.5&&initial.gates===3&&initial.layout.includes('south'));
 check('expanding south grows live and rendered wall sections from 54 to 64',initial.beforeCount===54&&initial.count===64&&initial.visible===64);
 const growth=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  for(const id of ['east1','east2','east3','west1','west2','west3','north1','north2','north3'])d.buyHomePlot(id);
  const east=d.expandHomeWall('east'),west=d.expandHomeWall('west'),north=d.expandHomeWall('north');
  const gates=s.fences.filter(f=>f.kind==='gate');
  const visible=new Set(__slice.WS.objects.filter(o=>o.bcFenceId).map(o=>o.bcFenceId)).size;
  return {east,west,north,gates:gates.map(f=>[f.side,f.x,f.y]),count:s.fences.length,visible,layout:s.homeBuilder.wallLayoutId};
 });
 check('four-side irregular layout is built with purchased parcels only',growth.east&&growth.west&&growth.north&&growth.count===94&&growth.visible===94);
 check('S/E/W gates remain after north becomes a solid rear wall',growth.gates.length===3&&growth.gates.some(g=>g[0]==='east'&&g[1]===32.5)&&growth.gates.some(g=>g[0]==='west'&&g[1]===7.5)&&growth.gates.some(g=>g[0]==='south'&&g[2]===32.5));
 const house=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  s.homeSelected='farmerHouse';s.homeCategory='houses';s.homeVariant=2;
  let choice=null;
  for(let i=13;i<=27&&!choice;i++)for(let j=28;j<=32&&!choice;j++)if(d.checkHome('farmerHouse',i*64,j*64).ok)choice=[i*64,j*64];
  const added=choice&&d.placeHome(...choice);
  return {added,choice,count:s.homeBuilder.placedObjects.length,variant:s.homeBuilder.placedObjects[0]?.variant};
 });
 check('modular house has selectable saved roof variant and legal full footprint',house.added&&house.variant===2);
 const painted=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.homeAction='terrain';s.homeTerrainBrush='raise';
  for(const x of [19,20,21])if(!d.paintHomeTerrain(x*64,9*64))return {error:s.homeTerrainNotice,where:'hill'};
  s.homeTerrainBrush='water';
  for(const [x,y] of [[20,9],[20,10],[20,11],[20,12]])if(!d.paintHomeTerrain(x*64,y*64))return {error:s.homeTerrainNotice,where:'river'};
  return {draft:s.homeTerrainDraft.length,committedBefore:s.homeBuilder.terrainEdits.length};
 });
 check('north hill and source-to-river path validate together',painted.draft===6&&painted.committedBefore===0);
 const navigation=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:45000});
 await page.evaluate(()=>__warrenDev.commitHomeTerrain());
 await navigation;
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 const ground=await page.evaluate(()=>{
  const s=__warren;
  const terrain=window.__slice?.terrain;
  return {edits:s.homeBuilder.terrainEdits.length,level:terrain?.walkHeight(19*64,9*64),basin:terrain?.walkHeight(19*64,10*64),river:s.homeBuilder.rivers.length,house:s.homeBuilder.placedObjects[0]?.prefab,gates:s.fences.filter(f=>f.kind==='gate').length};
 });
 check('terrain and hills are rebaked into the actual engine after save/reload',ground.edits===6&&ground.level!==null&&ground.level>ground.basin);
 check('plots, wall layout, modular house and river survive scene rebake',ground.house==='farmerHouse'&&ground.river===1&&ground.gates===3);
 const waterfall=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;d.setHomeOpen(true);
  s.gold=999999;s.inventory.livingMoss=999999;s.homeAction='waterfall';
  const applied=d.createHomeWaterfall(20*64,9*64);
  d.save();
  return {applied,entry:s.homeBuilder.waterfalls[0],paid:s.gold<999999};
 });
 check('structured waterfall requires real cliff/basin/river and charges resources',waterfall.applied&&waterfall.entry?.cliffTiles.length===3&&waterfall.entry?.basinTiles.length===1&&waterfall.paid);
 await page.reload();
 await page.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 check('waterfall metadata and purchases survive reload',await page.evaluate(()=>__warren.homeBuilder.waterfalls.length===1&&__warren.homeBuilder.ownedPlots.length===13&&__warren.homeBuilder.expandedSides.length===4));
 check('all 94 wall sections are restored and visible after scene reload',await page.evaluate(()=>__warren.fences.length===94&&new Set(__slice.WS.objects.filter(o=>o.bcFenceId).map(o=>o.bcFenceId)).size===94));
 const corruption=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  const surviving=s.fences.find(f=>f.kind==='fence');
  surviving.hp=0;
  s.fences.splice(12,5);
  d.setHomeOpen(true);
  return {count:s.fences.length,button:!!document.querySelector('#homePanel [data-home-wall-rebuild]')};
 });
 check('builder flags a partial 89/94 live-wall record and offers a recovery action',corruption.count===89&&corruption.button);
 await page.locator('#homePanel [data-home-wall-rebuild]').click();
 const recoveredWall=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  const result={count:s.fences.length,broken:s.fences.filter(f=>f.hp<=0).length,
   visible:new Set(__slice.WS.objects.filter(o=>o.bcFenceId).map(o=>o.bcFenceId)).size};
  d.setHomeOpen(false);return result;
 });
 check('one-click repair restores missing sections but never heals broken wall HP',recoveredWall.count===94&&recoveredWall.broken===1&&recoveredWall.visible===93);
 const siege=await page.evaluate(()=>{
  const s=__warren;s.clock=79.9;const before=s.time;
  __warrenStep(.5);const started=s.night;
  __warrenStep(20);
  return {started,advanced:s.time>before+18,gates:s.fences.filter(f=>f.kind==='gate').length,allFinite:s.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)),walls:s.fences.length};
 });
 check('expanded walls support a live night wave without frame abort or invalid bunny positions',siege.started&&siege.advanced&&siege.gates===3&&siege.allFinite&&siege.walls>54);
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.on('pageerror',err=>errors.push('mobile:'+err.message));
 await mobile.goto(url);await mobile.waitForFunction(()=>window.__warrenDev&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
 await mobile.locator('[data-mobile-open="village"]').click();await mobile.locator('#mobileHomeOpen').click();
 await mobile.locator('.bc-home-land summary').first().click();
 check('mobile plot sheet and terrain tab fit viewport',await mobile.locator('#homePanel').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
 check('mobile shows distinct plot purchase buttons',await mobile.locator('#homePanel [data-home-plot="south1"]').count()===1);
 await mobile.locator('.bc-home-land summary').nth(1).click();
 check('mobile brush palette is accessible by tap',await mobile.locator('#homePanel [data-home-brush="water"]').count()===1);
 check('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
