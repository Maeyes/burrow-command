// Urgent UI regressions for desktop/mobile. No changes to real player saves.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4221,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];const check=(label,ok,detail)=>{if(!ok)throw Error('FAIL '+label+(detail?' '+JSON.stringify(detail):''));console.log('PASS '+label)};
const url=server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html';
const ready=p=>p.waitForFunction(()=>window.__warrenDev&&(!document.getElementById('loading')||document.getElementById('loading').hidden),null,{timeout:45000});
const start=async opts=>{const p=await browser.newPage(opts);p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await ready(p);return p};
try{
 const p=await start({viewport:{width:1440,height:900}});
 await p.locator('#helpToggle').click();
 await p.locator('#sideToggle').click();
 check('desktop Guide and Village manager collapse independently',await p.evaluate(()=>
  document.getElementById('help').classList.contains('is-collapsed')&&
  document.getElementById('side').classList.contains('is-collapsed')&&
  document.getElementById('side').querySelector('#build').getClientRects().length===0));
 await p.reload();await ready(p);
 check('desktop collapse preferences survive reload',await p.evaluate(()=>
  document.getElementById('help').classList.contains('is-collapsed')&&
  document.getElementById('side').classList.contains('is-collapsed')));
 await p.locator('#helpToggle').click();await p.locator('#sideToggle').click();
 check('both panels expand and original actions are accessible',await p.locator('#side #build').isVisible()&&await p.locator('#help #reset').isVisible());
 await p.evaluate(()=>{__warren.gold=100000;Object.assign(__warren.inventory,{livingMoss:900,astraliteStone:99,copperOre:900,brutalSpore:900,tier1Blueprint:80});__warrenDev.renderUi()});
 await p.locator('#build').click();
 const overlay=await p.evaluate(()=>{
  __warrenDev.updateWorldLabels();
  const b=document.querySelector('#worldLabels [data-world=resource]');
  const r=b.getBoundingClientRect();
  return{building:__warren.building,opacity:getComputedStyle(b).opacity,pointer:getComputedStyle(b).pointerEvents,
   top:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.className};
 });
 check('building mode makes all floating nameplates click-through',overlay.building&&overlay.pointer==='none'&&Number(overlay.opacity)<.5,overlay);
 await p.locator('#build').click();
 await p.locator('#skillCoreOpen').click();
 check('class Skill Core is reachable on desktop and locked until Warren 10',
  await p.locator('#skillCorePanel').isVisible()&&await p.locator('#skillCorePanel [data-core-choose="0"]').isDisabled());
 await p.evaluate(()=>{__warren.warren=10;__warren.inventory.piercingShot=1;__warrenDev.renderUi()});
 await p.locator('#skillCorePanel [data-core-class=archer]').click();
 await p.locator('#skillCorePanel [data-core-choose="0"]').selectOption('piercingShot');
 check('real main-game Piercing Shot equips for Archer at Warren Lv10',await p.evaluate(()=>__warren.classSkills.archer.active[0]==='piercingShot'));
 await p.locator('#skillCorePanel [data-modal-close]').click();
 await p.reload();await ready(p);
 check('main-game class Core survives save migration',await p.evaluate(()=>__warren.classSkills.archer.active[0]==='piercingShot'));
 await p.evaluate(()=>{__warren.gold=100000;Object.assign(__warren.inventory,{livingMoss:900,astraliteStone:99,copperOre:900,brutalSpore:900,tier1Blueprint:80});__warrenDev.renderUi()});
 const gear=await p.evaluate(()=>__warrenDev.craftGear('mosswoodBow'));
 check('crafts test bow for refine and scroll scenarios',!!gear,gear);
 await p.evaluate(id=>{
   __warren.forgeClass='archer';__warren.armorySlot='weapon';
   __warren.builds.archer[0].gear.weapon=id;__warren.armoryTab='craft';__warren.modal='hero';
   __warrenDev.renderUi();
 },gear.id);
 const sc=await p.evaluate(()=>{
  const el=document.querySelector('#heroPanel .bc-armory-body');
  el.scrollTop=Math.min(350,el.scrollHeight-el.clientHeight);
  return{top:el.scrollTop,height:el.scrollHeight,client:el.clientHeight};
 });
 check('desktop Armory can actually scroll',sc.top>=100,sc);
 await p.evaluate(()=>{for(let i=0;i<9;i++)__warrenDev.renderUi();});
 const scAfter=await p.locator('#heroPanel .bc-armory-body').evaluate(el=>el.scrollTop);
 check('re-rendering active craft does not reset desktop scroll',Math.abs(scAfter-sc.top)<=2,{before:sc,after:scAfter});
 await p.locator('#heroPanel [data-armory-tab=upgrade]').last().click();
 const ref=await p.locator('#heroPanel [data-item-refine]').count();
 check('refine UI is accessible in same Armory dialog',ref>0);
 const quote=await p.locator('#heroPanel .bc-refine-card').innerText();
 check('refine displays additional Gold cost',/\d[\d,.]* G/.test(quote),quote);
 const before=await p.evaluate(()=>({gold:__warren.gold,stone:__warren.inventory.astraliteStone}));
 await p.locator('#heroPanel [data-item-refine]').last().click();
 check('refine transaction consumes Gold and Astralite',await p.evaluate(b=>
  __warren.gold<b.gold&&__warren.inventory.astraliteStone<b.stone,before));
 await p.locator('#heroPanel [data-modal-close]').click();
 await p.close();
 for(const [width,height] of [[360,800],[390,844]]){
  const m=await start({viewport:{width,height},isMobile:true,hasTouch:true});
  await m.locator('#mobileDock [data-mobile-open=village]').click();
  await m.evaluate(()=>{__warren.gold=10000;__warren.inventory.livingMoss=900;__warrenDev.renderUi()});
  await m.locator('#side #build').click();
  check(width+' building action closes mobile village drawer for tapping the map',
    await m.locator('#mobileDrawerScrim').isHidden()&&await m.evaluate(()=>__warren.building===true));
  check(width+' floating nameplates are click-through in mobile placement mode',
    await m.evaluate(()=>{__warrenDev.updateWorldLabels();return [...document.querySelectorAll('.bc-world-label')].every(e=>getComputedStyle(e).pointerEvents==='none')}));
  await m.locator('#mobileDock [data-mobile-open=village]').click();
  await m.locator('#side #build').click();
  await m.locator('#mobileDock [data-mobile-open=craft]').click();
  const scroll=await m.evaluate(()=>{
   const el=document.querySelector('#heroPanel .bc-armory-body');
   el.scrollTop=Math.min(200,el.scrollHeight-el.clientHeight);return el.scrollTop;
  });
  check(width+' craft can scroll',scroll>50,scroll);
  await m.evaluate(()=>{for(let i=0;i<12;i++)__warrenDev.renderUi();});
  const after=await m.locator('#heroPanel .bc-armory-body').evaluate(el=>el.scrollTop);
  check(width+' craft scroll remains stable on repeated re-renders',Math.abs(scroll-after)<=2,{before:scroll,after});
  await m.locator('#heroPanel [data-modal-close]').click();
  await m.close();
 }
 check('no uncaught browser errors',errors.length===0,errors);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}finally{await browser.close();await new Promise(ok=>server.httpServer.close(ok));}
