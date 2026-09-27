// End-to-end: one fixed 15×15 footprint, wood → stone → reinforced stone, collision/HP/persistence.
// Uses an isolated Playwright browser context; never touches a real player's saved village.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4194,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(label,yes)=>{if(!yes)throw Error('FAIL '+label);console.log('PASS '+label);};
const ready=()=>page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:60000});
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');await ready();
 check('starts without manually placed or decorative starter fences',await page.evaluate(()=>
  __warren.wallLevel===0&&__warren.fences.length===0&&!__slice.WS.scene.objects?.some(o=>o.kind==='fence')));
 check('button offers a 15×15 fence for one-click build',/15×15/.test(await page.locator('#fenceBuild').innerText()));
 await page.evaluate(()=>{__warren.inventory.livingMoss=2000;__warren.gold=10000;__warrenDev.renderUi();});
 await page.locator('#fenceBuild').hover();
 check('hover shows a 15×15 footprint preview',await page.evaluate(()=>__warren.wallPreview===true));
 await page.click('#fenceBuild');
 check('single click builds the north wall and three selectable gates around 15×15 village',await page.evaluate(()=>
  __warren.wallLevel===1&&__warren.fences.length===54&&__warren.fences.filter(f=>f.kind==='gate').length===3)&&
  /15×15/.test(await page.locator('#wallStatus').innerText()));
 check('night defense posts distribute rabbits across distinct gate lanes',await page.evaluate(()=>{
  const posts=__warren.units.map(__warrenDev.defensePost);
  return new Set(posts.map(p=>p.gate)).size===Math.min(3,__warren.units.length)&&
   new Set(posts.map(p=>Math.round(p.x)+':'+Math.round(p.y))).size===posts.length;
 }));
 check('first fence does not touch the authored houses or impassable terrain',await page.evaluate(()=>{
   const scene=__slice.WS.scene,parts=__warren.fences;
   return parts.every(f=>{
    const a={x:f.x*64,y:f.y*64},b={x:(f.x+(f.axis==='x'?f.len:0))*64,y:(f.y+(f.axis==='y'?f.len:0))*64};
    const buildings=scene.buildings||[];
    const houseOverlap=buildings.some(h=>[0,.5,1].some(t=>{
     const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
     return x>h.x0-12&&x<h.x1+12&&y>h.y0-12&&y<h.y1+12;
    }));
    return !houseOverlap&&[a,b,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}].every(p=>__slice.terrain.walkHeight(p.x,p.y)!==null);
   });
  }));
 check('every solid wall has HP and live collider while open arches are passable',await page.evaluate(()=>{
  const parts=__warren.fences,colliders=__slice.WS.colliders,objects=__slice.WS.objects;
  return parts.filter(f=>f.kind==='fence').every(f=>f.hp===55&&f.maxHp===55&&colliders.some(c=>c.bcFenceId===f.axis+':'+f.x+':'+f.y))
   &&parts.filter(f=>f.kind==='gate').every(f=>!colliders.some(c=>c.bcFenceId===f.axis+':'+f.x+':'+f.y)&&objects.some(o=>o.kind==='gate'&&o.bcFenceId===f.axis+':'+f.x+':'+f.y))
   &&__warrenDev.canWalkStraight(20*64,27*64,20*64,29*64);
 }));
 check('rabbit pinned at a wall corner recovers to a clear walkable point',await page.evaluate(()=>{
  const u=__warren.units[0],corner=__warren.fences.find(f=>f.kind==='fence'&&f.axis==='x');
  u.wallSafeX=20*64;u.wallSafeY=20*64;u.x=corner.x*64;u.y=corner.y*64;u.path=null;u.stuck=1;
  __warrenStep(1);
  return __warrenDev.canWalkStraight(u.x,u.y,u.x,u.y)&&Math.hypot(u.x-corner.x*64,u.y-corner.y*64)>10;
 }));
 const broken=await page.evaluate(()=>{
  const first=__warren.fences.find(f=>f.kind==='fence'),id=first.axis+':'+first.x+':'+first.y;
  __warrenDev.hurtPerimeter(first,999);
  return {id,broken:__slice.WS.colliders.every(c=>c.bcFenceId!==id),missing:__warrenDev.perimeterHealth().maxHp-__warrenDev.perimeterHealth().hp};
 });
 check('damaged wall opens a breach and reduces shared wall HP',broken.broken&&broken.missing===55);
 await page.click('#repairAll');
 check('Repair All also fixes destroyed wall and its collision',await page.evaluate(id=>
  __warrenDev.perimeterHealth().broken===0&&__slice.WS.colliders.some(c=>c.bcFenceId===id),broken.id));
 await page.click('#fenceBuild');
 const invalidTerrain=()=>page.evaluate(()=>__warren.fences.filter(f=>{
  const a={x:f.x*64,y:f.y*64},b={x:(f.x+(f.axis==='x'?f.len:0))*64,y:(f.y+(f.axis==='y'?f.len:0))*64};
  return [a,b,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}].some(p=>__slice.terrain.walkHeight(p.x,p.y)===null);
 }).length);
 const bad2=await invalidTerrain();check('stone upgrade retains the safe 15×15 footprint',bad2===0);
 check('Lv 2 replaces wood with stone and upgrades HP without changing any wall coordinates',await page.evaluate(()=>{
  const f=__warren.fences,objects=__slice.WS.objects.filter(o=>o.bcFenceId),colliders=__slice.WS.colliders.filter(c=>c.bcFenceId);
  return __warren.wallLevel===2&&f.length===54&&f.filter(p=>p.kind==='gate').length===3&&
   f.every(p=>p.material==='stone'&&p.maxHp===(p.kind==='gate'?360:85))&&
   objects.every(o=>o.wallMaterial==='stone'&&!o.reinforced)&&
   objects.filter(o=>o.editorPrefab==='stoneWall').length===51&&
   objects.filter(o=>o.editorPrefab==='stoneWall').every(o=>o.kind==='sprite'&&o.img?.width>0&&o.img?.height>0)&&
   objects.filter(o=>o.editorPrefab==='stoneGate').length===3&&
   objects.filter(o=>o.editorPrefab==='stoneGate').every(o=>o.kind==='gate'&&o.editorStoneSprite?.img?.width>0)&&
   new Set(f.filter(p=>p.kind==='fence').map(p=>p.axis+':'+p.x+':'+p.y)).size===51&&
   new Set(colliders.map(c=>c.bcFenceId)).size===51;
 })&&/15×15/.test(await page.locator('#wallStatus').innerText())&&/กำแพงหิน/.test(await page.locator('#wallStatus').innerText()));
 const stoneIds=await page.evaluate(()=>__warren.fences.map(f=>f.axis+':'+f.x+':'+f.y));
 await page.click('#fenceBuild');
 check('Lv 3 reinforces the SAME stone-wall positions and retains only one collider per segment',await page.evaluate(ids=>{
  const f=__warren.fences,objects=__slice.WS.objects.filter(o=>o.bcFenceId),colliders=__slice.WS.colliders.filter(c=>c.bcFenceId);
  return __warren.wallLevel===3&&f.length===54&&f.map(p=>p.axis+':'+p.x+':'+p.y).every((id,i)=>id===ids[i])&&
   f.every(p=>p.material==='stone'&&p.reinforced&&p.maxHp===(p.kind==='gate'?500:125))&&
   objects.every(o=>o.wallMaterial==='stone'&&o.reinforced)&&
   objects.filter(o=>o.editorPrefab==='stoneWall').length===51&&
   objects.filter(o=>o.editorPrefab==='stoneGate').length===3&&
   new Set(colliders.map(c=>c.bcFenceId)).size===51;
 },stoneIds)&&/15×15/.test(await page.locator('#wallStatus').innerText()));
 const bad3=await invalidTerrain();check('reinforced stone remains on walkable 15×15 terrain',bad3===0);
 await page.reload();await ready();
 check('reinforced 15×15 stone wall, HP and material survive reload',await page.evaluate(()=>
  __warren.wallLevel===3&&__warren.fences.length===54&&
  __warren.fences.every(f=>f.material==='stone'&&f.reinforced)&&
  __slice.WS.objects.filter(o=>o.editorPrefab==='stoneGate').length===3&&
  __slice.WS.objects.filter(o=>o.editorPrefab==='stoneWall').length===51&&
  __warrenDev.perimeterHealth().hp===__warrenDev.perimeterHealth().maxHp));
 await page.evaluate(()=>{__warren.warren=11;__warrenDev.save();});
 await page.reload();await ready();
 check('Desert biome transition retains perimeter, HP and live colliders',await page.evaluate(()=>
  __slice.WS.scene.biome==='desert'&&__warren.wallLevel===3&&__warren.fences.length===54&&
  __warrenDev.perimeterHealth().hp===__warrenDev.perimeterHealth().maxHp&&__slice.WS.colliders.some(c=>c.bcFenceId)));
 check('no uncaught browser errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
