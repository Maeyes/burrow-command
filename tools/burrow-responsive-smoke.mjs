// Isolated responsive regression. Writes reference images to the OS temp directory, never into the repo.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const dir=path.join(os.tmpdir(),'burrow-responsive-check');
fs.mkdirSync(dir,{recursive:true});
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4217,strictPort:false}});
const browser=await chromium.launch({headless:true});
const base=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html';
const checks=[];const check=(name,ok,detail='')=>{checks.push({name,ok});if(!ok)throw new Error(name+' '+JSON.stringify(detail));console.log('PASS '+name)};
const ready=page=>page.waitForFunction(()=>window.__warren?.units?.length>=2&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:45000});
const errors=[];
const collect=page=>page.on('pageerror',e=>errors.push(e.message));
const desktop=async()=>{
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 collect(p);await p.goto(base);await ready(p);
 await p.addStyleTag({content:'#scene,#worldLabels,#banner,#toast,#loading,#squad,#shop,#clockbar{visibility:hidden!important} .bc-modal{transition:none!important}'});
 const metrics=await p.evaluate(()=>{
  const ids=['wrap','scene','top','side','shopbox','help','heroPanel','modalScrim','mobileDock'];
  return Object.fromEntries(ids.map(id=>{
   const el=document.getElementById(id);if(!el)return[id,null];
   const r=el.getBoundingClientRect(),s=getComputedStyle(el);
   return[id,{rect:[r.x,r.y,r.width,r.height].map(n=>Math.round(n*100)/100),display:s.display,position:s.position,visibility:s.visibility}];
  }));
 });
 const screenshot=await p.screenshot({animations:'disabled'});
 await p.close();return {metrics,screenshot};
};
try{
 const d=await desktop();
 if(process.argv.includes('--baseline')){
  fs.writeFileSync(path.join(dir,'desktop-baseline.json'),JSON.stringify(d.metrics,null,2));
  fs.writeFileSync(path.join(dir,'desktop-baseline.png'),d.screenshot);
  console.log('Baseline saved to '+dir);
 }else{
  const baseline=JSON.parse(fs.readFileSync(path.join(dir,'desktop-baseline.json')));
  const core=['wrap','scene','top','shopbox','heroPanel','modalScrim']; // Help/side can intentionally collapse on desktop.
  for(const id of core)check('desktop '+id+' geometry unchanged',JSON.stringify(d.metrics[id])===JSON.stringify(baseline[id]),{before:baseline[id],after:d.metrics[id]});
  fs.writeFileSync(path.join(dir,'desktop-after.png'),d.screenshot);
  for(const [width,height] of [[360,800],[390,844]]){
   const p=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});collect(p);
   await p.goto(base);await ready(p);
   const g=await p.evaluate(()=>{
    const dock=document.getElementById('mobileDock'),top=document.getElementById('top'),canvas=document.getElementById('scene');
    return {dock:dock?.getBoundingClientRect().toJSON(),top:top.getBoundingClientRect().toJSON(),canvas:canvas.getBoundingClientRect().toJSON(),scrollWidth:document.documentElement.scrollWidth,innerWidth,drawerHidden:document.getElementById('mobileDrawerScrim').hidden};
   });
   check(width+' mobile dock accessible',g.dock&&g.dock.width>300&&g.dock.y+g.dock.height<=height+1,g);
   check(width+' portrait map covers viewport',g.canvas.height>=height*.95&&g.canvas.width>width,g);
   check(width+' top HUD fits viewport',g.top.x>=0&&g.top.x+g.top.width<=width+1,g);
   check(width+' no body horizontal scroll',g.scrollWidth<=width+1,g);
   await p.screenshot({path:path.join(dir,'mobile-'+width+'.png')});
   await p.locator('#mobileDock [data-mobile-open="village"]').click();
   check(width+' village drawer opens',await p.locator('body').evaluate(e=>e.dataset.mobileDrawer==='village'));
   check(width+' village drawer has no duplicate class/Armory buttons',await p.locator('#side .bc-quick-actions').isHidden()&&
     await p.locator('#mobileDock [data-mobile-open="skills"]').count()===1&&
     await p.locator('#mobileDock [data-mobile-open="craft"]').count()===1);
   check(width+' reset remains accessible inside village drawer',await p.locator('#side #mobileReset').isVisible());
   await p.locator('#mobileDrawerScrim').click({position:{x:15,y:45}});
   check(width+' drawer scrim closes',await p.locator('#mobileDrawerScrim').isHidden());
   await p.locator('#mobileDock [data-mobile-open="recruit"]').click();
   check(width+' recruit drawer opens',await p.locator('body').evaluate(e=>e.dataset.mobileDrawer==='recruit'));
   await p.evaluate(()=>{__warren.gold=25000;__warrenDev.renderUi();});
   await p.locator('#shopbox [data-buy="scout"]').click();
   check(width+' recruit works through drawer',await p.evaluate(()=>__warren.units.some(u=>u.cls==='scout')));
   await p.locator('#mobileDock [data-mobile-open="skills"]').click();
   check(width+' bunny icon opens two-choice ability modal',
     await p.locator('#bunnyMenuPanel').isVisible()&&await p.locator('#bunnyMenuPanel .bc-bunny-menu button').count()===2);
   await p.locator('#bunnyMenuPanel [data-open-mastery-menu]').click();
   check(width+' bunny menu opens existing Mastery',await p.locator('#masteryPanel').isVisible());
   await p.locator('#masteryPanel [data-modal-close]').first().click();
   await p.locator('#mobileDock [data-mobile-open="skills"]').click();
   await p.locator('#bunnyMenuPanel [data-open-core-menu]').click();
   check(width+' bunny menu opens class Skill Core (Lv10 gate)',await p.locator('#skillCorePanel').isVisible()&&
     /Warren Lv 10/.test(await p.locator('#skillCorePanel').innerText()));
   await p.locator('#skillCorePanel [data-modal-close]').first().click();
   await p.locator('#mobileDock [data-mobile-open="craft"]').click();
   check(width+' Armory bottom sheet visible',await p.locator('#heroPanel').isVisible());
   check(width+' Armory does not duplicate the Bunny/Mastery menu',await p.locator('#heroPanel .bc-armory-toolbar [data-open-mastery]').isHidden());
   const sheet=await p.locator('#heroPanel').evaluate(e=>e.getBoundingClientRect().toJSON());
   check(width+' bottom sheet fits portrait',sheet.width<=width+1&&sheet.bottom<=height+1,sheet);
   await p.locator('#heroPanel [data-modal-close]').first().click();
   check(width+' Armory closes',await p.locator('#heroPanel').isHidden());
   await p.locator('#mobileDock [data-mobile-open="craft"]').click();
   check(width+' mobile craft opens shared Armory on craft tab',
      await p.locator('#heroPanel').isVisible()&&await p.evaluate(()=>__warren.armoryTab==='craft'));
   const overflow=await p.locator('#heroPanel').evaluate(el=>({panel:el.scrollWidth-el.clientWidth,body:el.querySelector('.bc-armory-body')?.scrollWidth-el.querySelector('.bc-armory-body')?.clientWidth}));
   check(width+' crafting sheet has no horizontal overflow',overflow.panel<=2&&overflow.body<=2,overflow);
   await p.locator('#heroPanel [data-modal-close]').first().click();
   await p.locator('#mobileDock [data-mobile-open="village"]').click();
   await p.locator('#side [data-world="resource"]').click();
   check(width+' building shortcut opens resource bottom sheet and closes drawer',
      await p.locator('#resourcePanel').isVisible()&&await p.locator('#mobileDrawerScrim').isHidden());
   await p.locator('#resourcePanel [data-modal-close]').click();
   await p.evaluate(()=>{__warren.inventory.livingMoss=2000;__warrenDev.renderUi()});
   await p.locator('#mobileDock [data-mobile-open="village"]').click();
   await p.locator('#side #fenceBuild').click();
   check(width+' village wall action works through mobile drawer',await p.evaluate(()=>__warren.wallLevel===1));
   await p.locator('#side [data-gate-side="south"]').click();
   check(width+' mobile gate closure selection works',await p.evaluate(()=>__warren.gateClosed.includes('south')));
   await p.locator('#side [data-mobile-close]').click();
   await p.locator('#mobileDock [data-mobile-open="sell"]').click();
   check(width+' Quick Sell opens as bottom sheet',await p.locator('#sellPanel').isVisible());
   const beforeSale=await p.evaluate(()=>({gold:__warren.gold,moss:__warren.inventory.livingMoss}));
   await p.locator('#sellPreview').click();
   await p.locator('#sellConfirm').click();
   check(width+' Quick Sell can confirm a sale on mobile',await p.evaluate(b=>__warren.gold>b.gold&&__warren.inventory.livingMoss<b.moss,beforeSale));
   await p.locator('#sellPanel [data-modal-close]').click();
   const openCanvasPoint=await p.evaluate(()=>{
     for(let y=500;y>=280;y-=25)for(let x=100;x<innerWidth-90;x+=25){
       if(document.elementFromPoint(x,y)?.id==='scene')return {x,y};
     }
     return null;
   });
   check(width+' uncovered map region accepts touch',!!openCanvasPoint,openCanvasPoint);
   const startCam=await p.evaluate(()=>({x:__slice.player.x,y:__slice.player.y}));
   const client=await p.context().newCDPSession(p);
   const {x,y}=openCanvasPoint;
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-35,y:y-25,id:1}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-65,y:y-40,id:1}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await p.waitForTimeout(60);
   check(width+' touch drag pans village without opening a building',await p.evaluate(b=>
     Math.hypot(__slice.player.x-b.x,__slice.player.y-b.y)>15&&!__warren.modal,startCam));
   const zoomBefore=await p.evaluate(()=>{const f=__slice.projectRuntimePoint;return f(1500,1280,0).x-f(1280,1280,0).x});
   const x1=width/2-36,x2=width/2+36,py=Math.min(height-170,470);
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:py,id:1},{x:x2,y:py,id:2}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1-24,y:py,id:1},{x:x2+24,y:py,id:2}]});
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const zoomAfter=await p.evaluate(()=>{const f=__slice.projectRuntimePoint;return f(1500,1280,0).x-f(1280,1280,0).x});
   check(width+' pinch zoom adjusts engine scale without accidental modal',zoomAfter>zoomBefore*1.08&&await p.evaluate(()=>!__warren.modal),{before:zoomBefore,after:zoomAfter});
   const placed=await p.evaluate(()=>{
    for(let xx=23;xx<28;xx++)for(let yy=20;yy<28;yy++){
     const old=__warren.towers.length;
     __warrenDev.placeTower(xx*64,yy*64);
     if(__warren.towers.length>old)return true;
    }
    return false;
   });
   check(width+' initial tower can be built',placed);
   await p.evaluate(()=>{__warren.selectedTower=0;__warren.modal='tower';__warrenDev.renderUi()});
   await p.locator('#towerPanel [data-tower-move]').click();
   check(width+' tower moving exposes visible mobile cancel action',await p.locator('#mobileTowerMoveNotice').isVisible());
   await p.locator('#mobileCancelTowerMove').click();
   check(width+' mobile cancel safely stops tower move',await p.evaluate(()=>__warren.movingTower===-1)&&await p.locator('#mobileTowerMoveNotice').isHidden());
   await p.keyboard.press('Space');await p.waitForTimeout(80);
   const target=await p.evaluate(()=>{
    const tower=__warren.towers[0],canvas=document.querySelector('#scene'),r=canvas.getBoundingClientRect();
    for(let xx=22;xx<28;xx++)for(let yy=20;yy<28;yy++){
     const wx=xx*64,wy=yy*64;
     if(Math.hypot(wx-tower.x,wy-tower.y)<120||!__warrenDev.canTowerSpot(wx,wy,0))continue;
     const loc=__slice.projectRuntimePoint(wx,wy,__slice.terrain.walkHeight(wx,wy)??0);
     const x=r.x+loc.x*r.width/canvas.width,y=r.y+loc.y*r.height/canvas.height;
     if(x<35||x>innerWidth-35||y<160||y>innerHeight-145||document.elementFromPoint(x,y)!==canvas)continue;
     return {wx,wy,x,y};
    }
    return null;
   });
   if(target){
    await p.evaluate(()=>{__warren.selectedTower=0;__warren.modal='tower';__warrenDev.renderUi()});
    await p.locator('#towerPanel [data-tower-move]').click();
    await p.waitForTimeout(80);
    const fresh=await p.evaluate(t=>{
      const c=document.querySelector('#scene'),r=c.getBoundingClientRect();
      const loc=__slice.projectRuntimePoint(t.wx,t.wy,__slice.terrain.walkHeight(t.wx,t.wy)??0);
      const x=r.x+loc.x*r.width/c.width,y=r.y+loc.y*r.height/c.height;
      return {x,y,at:document.elementFromPoint(x,y)?.id};
    },target);
    await p.touchscreen.tap(fresh.x,fresh.y);
    check(width+' touch tap repositions the tower',await p.evaluate(t=>
      __warren.movingTower===-1&&Math.hypot(__warren.towers[0].x-t.wx,__warren.towers[0].y-t.wy)<50,target));
   }else console.log('Mobile tower touch target not visible at current zoom; cancel path verified');
   await p.screenshot({path:path.join(dir,'mobile-'+width+'-after.png')});
   await p.close();
  }
  const landscape=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  collect(landscape);await landscape.goto(base);await ready(landscape);
  const geo=await landscape.evaluate(()=>{
    const r=id=>document.getElementById(id).getBoundingClientRect().toJSON();
    return {dock:r('mobileDock'),top:r('top'),scene:r('scene'),scrollWidth:document.documentElement.scrollWidth};
  });
  check('mobile landscape keeps full-width map and accessible compact dock',
    geo.dock.x>=400&&geo.dock.right<=844&&geo.scene.width>=844&&geo.scrollWidth<=844,geo);
  await landscape.locator('#mobileDock [data-mobile-open="village"]').click();
  check('landscape village drawer opens',await landscape.locator('body').evaluate(e=>e.dataset.mobileDrawer==='village'));
  await landscape.locator('#side [data-world="hall"]').click();
  check('landscape building modal stays inside viewport',await landscape.locator('#hallPanel').evaluate(el=>{
    const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1;
  }));
  await landscape.screenshot({path:path.join(dir,'mobile-landscape.png')});
  await landscape.locator('#hallPanel [data-modal-close]').click();
  await landscape.close();
  check('no browser page errors',errors.length===0,errors);
 }
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
