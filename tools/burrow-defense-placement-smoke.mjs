// Defense-placement and zoomed wall rendering regression. Separate browser save.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4234,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[],check=(label,ok)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label);};
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await page.waitForFunction(()=>window.__warrenDev&&window.__slice?.WS?.ground&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:55000});
 const land=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  s.gold=999999;s.inventory.livingMoss=999999;
  d.upgradePerimeter();d.upgradePerimeter();
  const unexpanded=d.canTowerSpot(30*64,16*64);
  const plots=[1,2,3].map(i=>d.buyHomePlot('east'+i));
  const wall=d.expandHomeWall('east');
  const spots=[];
  for(let x=29;x<=31;x++)for(let y=14;y<=26;y++){
   if(d.canTowerSpot(x*64,y*64)&&Math.hypot((x-20)*64,(y-20)*64)>520)spots.push({x:x*64,y:y*64});
  }
  return {unexpanded,plots,wall,spots,count:s.fences.length};
 });
 check('land outside the current wall is ineligible until paid expansion',land.unexpanded===false&&land.plots.every(Boolean)&&land.wall);
 check('expanded east contains legal building spots beyond old radius 520',land.spots.length>0&&land.count===64);
 const built=await page.evaluate(spot=>{
  const s=__warren,d=__warrenDev,old=s.gold;
  d.placeTower(spot.x,spot.y);
  return {count:s.towers.length,paid:s.gold<old,canOverlap:d.canTowerSpot(spot.x,spot.y),cartOverlap:d.canMagicCartSpot(spot.x,spot.y)};
 },land.spots[0]);
 check('tower builds beyond 520 and reserves its own footprint',built.count===1&&built.paid&&!built.canOverlap&&!built.cartOverlap);
 const cart=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;s.warren=20;
  const spots=[];
  for(let x=29;x<=31;x++)for(let y=14;y<=26;y++)if(d.canMagicCartSpot(x*64,y*64))spots.push({x:x*64,y:y*64});
  const chosen=spots[0];
  const old=s.gold;
  if(chosen)d.placeMagicCart(chosen.x,chosen.y);
  const cart=s.magicCarts[0];
  return {placed:!!cart,paid:s.gold<old,chosen,firstSpot:cart&&d.canTowerSpot(cart.x,cart.y)};
 });
 check('magic siege cart uses the same expanded footprint and overlap rules',cart.placed&&cart.paid&&!cart.firstSpot);
 const move=await page.evaluate(()=>{
  const s=__warren,d=__warrenDev;
  const start={...s.towers[0]},candidates=[];
  for(let x=29;x<=31;x++)for(let y=14;y<=26;y++)if(d.canTowerSpot(x*64,y*64,0)&&Math.hypot(x*64-start.x,y*64-start.y)>80)candidates.push({x:x*64,y:y*64});
  if(!candidates.length)return {moved:false};
  const candidate=candidates[0],ok=d.relocateTower(0,candidate.x,candidate.y);
  return {moved:ok,at:Math.hypot(s.towers[0].x-candidate.x,s.towers[0].y-candidate.y)<1,level:s.towers[0].level};
 });
 check('tower relocation preserves its level and works throughout annex',move.moved&&move.at&&move.level===1);
 const overlap=await page.evaluate(()=>{
  const d=__warrenDev,s=__warren;let candidate=null;
  for(let x=29;x<=31;x++)for(let y=14;y<=26;y++)if(!candidate&&d.canTowerSpot(x*64,y*64))candidate={x:x*64,y:y*64};
  if(!candidate)return {checked:false};
  const fake={kind:'sprite',box:{x0:candidate.x-5,x1:candidate.x+5,y0:candidate.y-5,y1:candidate.y+5}};
  __slice.WS.objects.push(fake);
  const invalid=!d.canTowerSpot(candidate.x,candidate.y)&&!d.canMagicCartSpot(candidate.x,candidate.y);
  __slice.WS.objects.pop();
  return {checked:true,invalid};
 });
 check('both defense types reject overlap with existing world objects',overlap.checked&&overlap.invalid);
 await page.evaluate(()=>__slice.WS&&document.querySelector('#scene').dispatchEvent(new WheelEvent('wheel',{deltaY:120,cancelable:true})));
 await page.evaluate(()=>__slice.WS&&document.querySelector('#scene').dispatchEvent(new WheelEvent('wheel',{deltaY:120,cancelable:true})));
 await page.evaluate(()=>__slice.WS&&document.querySelector('#scene').dispatchEvent(new WheelEvent('wheel',{deltaY:120,cancelable:true})));
 // One camera assignment (no WASD, no repeated panning) positions the expanded
 // wall partly outside the PRE-zoom canvas while it is still inside the real view.
 await page.evaluate(()=>{__slice.cam.x+=350;__warren.building='tower';__warrenDev.renderUi();});
 const paints=await page.evaluate(async()=>{
  const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d'),objects=__slice.WS.objects;
  const imgs=new Set(objects.filter(o=>o.bcFenceId).map(o=>o.kind==='sprite'?o.img:o.editorStoneSprite?.img).filter(Boolean));
  let painted=0,zoomOnly=0;const original=ctx.drawImage;ctx.drawImage=function(img,...args){
   if(imgs.has(img)){
    painted++;
    const [x,y]=args;
    if((x+img.width<0||x>canvas.width||y+img.height<0||y>canvas.height)&&
       x+img.width>canvas.width/2-canvas.width/(2*.47)&&x<canvas.width/2+canvas.width/(2*.47)&&
       y+img.height>canvas.height/2-canvas.height/(2*.47)&&y<canvas.height/2+canvas.height/(2*.47))zoomOnly++;
   }
   return original.call(this,img,...args);
  };
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  ctx.drawImage=original;
  return {painted,zoomOnly,sections:objects.filter(o=>o.bcFenceId).length,stoneSources:imgs.size};
 });
 check('stone wall images paint while camera stays still and zoomed out',paints.sections===64&&paints.stoneSources>0&&paints.painted>20);
 check('wall pieces outside pre-zoom bounds render inside the zoomed viewport without WASD',paints.zoomOnly>0);
 check('no browser crashes while building, moving or drawing zoomed walls',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await page?.close();await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
