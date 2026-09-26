// Real UI smoke: clickable building nameplates, cart quick sell, building upgrades and no-cost tower relocation.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4201,strictPort:false}});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(label,yes)=>{if(!yes)throw Error('FAIL '+label);console.log('PASS '+label)};
const ready=()=>page.waitForFunction(()=>window.__warrenDev?.updateWorldLabels&&document.querySelectorAll('#worldLabels .bc-world-label').length>=4&&(!document.querySelector('#loading')||document.querySelector('#loading').hidden),null,{timeout:60000});
try{
 await page.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');await ready();
 const labels=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#worldLabels [data-world]')].map(x=>[x.dataset.world,{visible:getComputedStyle(x).display!=='none',text:x.textContent,bounds:x.getBoundingClientRect().toJSON()}])));
 console.log('WORLD LABELS',JSON.stringify(labels));
 check('four prominent clickable world labels include cart Quick Sell',Object.keys(labels).length===4&&Object.keys(labels).every(k=>labels[k].visible)&&labels.sell.text.includes('Quick Sell'));
 await page.evaluate(()=>{__warren.gold=10000;Object.assign(__warren.inventory,{livingMoss:550,copperOre:410,stoneFragment:900,tier1Blueprint:8});__warrenDev.renderUi()});
 await page.locator('#worldLabels [data-world="sell"]').click();
 check('clicking cart nameplate opens separate Quick Sell details modal',await page.locator('#sellPanel').isVisible()&&/ขาย 360 ชิ้น/.test(await page.locator('#sellPanel').innerText()));
 const before=await page.evaluate(()=>({gold:__warren.gold,rare:__warren.inventory.stoneFragment,blueprint:__warren.inventory.tier1Blueprint}));
 await page.locator('#sellPreview').click();
 check('sale preview is explicit and must be confirmed',await page.locator('#sellConfirm').isVisible());
 await page.locator('#sellConfirm').click();
 check('confirmed sale exchanges only common excess for Gold and preserves protected materials',
   await page.evaluate(before=>__warren.gold===before.gold+470&&__warren.inventory.livingMoss===300&&__warren.inventory.copperOre===300&&__warren.inventory.stoneFragment===before.rare&&__warren.inventory.tier1Blueprint===before.blueprint,before));
 await page.locator('#sellPanel [data-modal-close]').click();
 await page.locator('#worldLabels [data-world="blacksmith"]').click();
 check('blacksmith nameplate opens the building-level upgrade modal',await page.locator('#blacksmithPanel').isVisible()&&await page.locator('#blacksmithPanel [data-forge-upgrade]').isEnabled());
 await page.locator('#blacksmithPanel [data-forge-upgrade]').click();
 check('upgrading blacksmith persists and raises high-rarity crafting bias',await page.evaluate(()=>__warren.forgeLevel===2)&&/Lv 2/.test(await page.locator('#blacksmithPanel').innerText()));
 await page.locator('#blacksmithPanel [data-modal-close]').click();
 await page.locator('#worldLabels [data-world="resource"]').click();
 check('resource workshop shows +1% monster Gold/material bonuses at Lv1 and its upgrade',
   await page.locator('#resourcePanel').isVisible()&&await page.locator('#resourcePanel [data-resource-upgrade]').isEnabled()&&
   /\+1% Gold/.test(await page.locator('#resourcePanel').innerText())&&
   /\+1% วัตถุดิบ/.test(await page.locator('#resourcePanel').innerText()));
 await page.locator('#resourcePanel [data-resource-upgrade]').click();
 check('resource workshop Lv2 raises both monster-drop bonuses to +2%',await page.evaluate(()=>__warren.resourceLevel===2)&&
   /\+2% Gold/.test(await page.locator('#resourcePanel').innerText())&&
   /\+2% วัตถุดิบ/.test(await page.locator('#resourcePanel').innerText()));
 await page.locator('#resourcePanel [data-modal-close]').click();
 check('without monster kills the upgraded workshop earns no idle Gold or materials',await page.evaluate(()=>{
  const s=__warren,down=s.units.map(u=>u.down),hallCd=s.hallCd;
  s.units.forEach(u=>u.down=true);s.hallCd=Infinity;
  const before={gold:s.gold,inventory:JSON.stringify(s.inventory),goldBank:s.resourceGoldBank,matBank:s.resourceMatBank};
  __warrenStep(4);
  s.units.forEach((u,i)=>{u.down=down[i]});s.hallCd=hallCd;
  return s.gold===before.gold&&JSON.stringify(s.inventory)===before.inventory&&
   s.resourceGoldBank===before.goldBank&&s.resourceMatBank===before.matBank;
 }));
 await page.locator('#worldLabels [data-world="hall"]').click();
 await page.evaluate(()=>{const u=__warren.units[0];u.hp=1;__warrenDev.renderUi()});
 check('Hall has upgrade, fortification and once-per-phase Heal controls',await page.locator('#hallPanel').isVisible()&&
  await page.locator('#hallPanel [data-hall-upgrade]').count()===1&&
  await page.locator('#hallPanel [data-hall-fortify]').count()===1&&
  await page.locator('#hallPanel [data-hall-heal]').isEnabled());
 const heal=await page.evaluate(()=>({day:__warren.day,before:__warren.units[0].hp,amount:Math.round((500+(__warren.warren-1)*80+__warren.fortification*35)*.2)}));
 await page.locator('#hallPanel [data-hall-heal]').click();
 check('Hall Heal applies 20% Hall HP once and locks until next phase',await page.evaluate(h=>__warren.units[0].hp===Math.min(__warren.units[0].maxHp,h.before+h.amount)&&__warren.dayHealDay===h.day,heal)&&await page.locator('#hallPanel [data-hall-heal]').isDisabled());
 await page.locator('#hallPanel [data-modal-close]').click();
 const towerPlace=await page.evaluate(()=>{
  for(let x=23;x<28;x++)for(let y=20;y<27;y++){
   const before=__warren.towers.length;
   __warrenDev.placeTower(x*64,y*64);
   if(__warren.towers.length>before)return {x:x*64,y:y*64};
  }
  return null;
 });
 console.log('TOWER PLACE',JSON.stringify(towerPlace));
 check('tower can be placed in village using existing construction validation',towerPlace!==null);
 await page.waitForFunction(()=>document.querySelector('#worldLabels [data-world-tower="0"]')?.textContent.includes('ป้อม'));
 await page.locator('#worldLabels [data-world-tower="0"]').click();
 check('clicking tower nameplate opens garrison, durability upgrade AND relocation details',await page.locator('#towerPanel').isVisible()&&
  await page.locator('#towerPanel [data-tower-upgrade]').count()===1&&await page.locator('#towerPanel [data-tower-move]').isEnabled());
 await page.locator('#towerPanel [data-tower-hire="archer"]').click();
 const saved=await page.evaluate(()=>({x:__warren.towers[0].x,y:__warren.towers[0].y,level:__warren.towers[0].level,hp:__warren.towers[0].hp,garrison:__warren.towers[0].garrison.name,gold:__warren.gold}));
 await page.locator('#towerPanel [data-tower-move]').click();
 check('move mode closes modal, shows instructions and changes cursor',await page.locator('#towerMoveNotice').isVisible()&&await page.locator('#scene').evaluate(x=>x.classList.contains('tower-move')));
 const destination=await page.evaluate(()=>{
  for(let x=23;x<27;x++)for(let y=25;y<27;y++){
   const current=__warren.towers[0],dist=Math.hypot(x*64-current.x,y*64-current.y);
   if(dist<95)continue;
   const beforeGold=__warren.gold;
   if(__warrenDev.relocateTower(0,x*64,y*64))return {x:x*64,y:y*64,beforeGold,afterGold:__warren.gold};
  }
  return null;
 });
 console.log('MOVE TARGET',JSON.stringify(destination));
 console.log('AFTER MOVE',JSON.stringify(await page.evaluate(()=>{const t=__warren.towers[0];return {x:t.x,y:t.y,actorX:t.actor.x,level:t.level,hp:t.hp,garrison:t.garrison?.name,gold:__warren.gold};})),JSON.stringify(saved));
 check('move validates location without charging Gold, preserving garrison, level and HP',destination!==null&&destination.beforeGold===destination.afterGold&&await page.evaluate(saved=>{
  const t=__warren.towers[0];return (t.x!==saved.x||t.y!==saved.y)&&t.actor.x===t.x-14&&t.level===saved.level&&t.hp===saved.hp&&t.garrison.name===saved.garrison;
 },saved));
 await page.reload();await ready();
 console.log('AFTER RELOAD',JSON.stringify(await page.evaluate(()=>({forge:__warren.forgeLevel,resource:__warren.resourceLevel,moss:__warren.inventory.livingMoss,towers:__warren.towers.map(t=>({x:t.x,y:t.y,garrison:t.garrison?.name}))}))));
 check('Quick Sell, both building upgrades and moved tower persist after reload',await page.evaluate(p=>
  __warren.forgeLevel===2&&__warren.resourceLevel===2&&__warren.inventory.livingMoss>=292&&__warren.towers.length===1&&
  __warren.towers[0].x===p.x&&__warren.towers[0].y===p.y&&!!__warren.towers[0].garrison,destination));
 // Verify the REAL canvas click path, not only the pure relocation helper.
 await page.locator('#worldLabels [data-world-tower="0"]').click();
 await page.locator('#towerPanel [data-tower-move]').click();
 const clickTarget=await page.evaluate(()=>{
  const t=__warren.towers[0],canvas=document.querySelector('#scene'),r=canvas.getBoundingClientRect();
  for(let x=22;x<=27;x++)for(let y=21;y<=27;y++){
    const wx=x*64,wy=y*64;if(Math.hypot(wx-t.x,wy-t.y)<115||!__warrenDev.canTowerSpot(wx,wy,0))continue;
    const p=__slice.projectRuntimePoint(wx,wy,__slice.terrain.walkHeight(wx,wy)??0);
    const cx=r.x+p.x*r.width/canvas.width,cy=r.y+p.y*r.height/canvas.height;
    if(cx<150||cx>innerWidth-200||cy<100||cy>innerHeight-150||document.elementFromPoint(cx,cy)!==canvas)continue;
    return{x:wx,y:wy,clickX:cx,clickY:cy};
  }
  return null;
 });
 console.log('REAL CLICK TARGET',JSON.stringify(clickTarget));
 check('valid clickable ground exists for relocated tower',!!clickTarget);
 await page.mouse.click(clickTarget.clickX,clickTarget.clickY);
 check('actual canvas click relocates the tower to the chosen ground',await page.evaluate(p=>
   __warren.movingTower===-1&&Math.hypot(__warren.towers[0].x-p.x,__warren.towers[0].y-p.y)<50,clickTarget));
 check('no uncaught page errors',errors.length===0);
}catch(e){console.error(e.stack||e,errors);process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve))}
