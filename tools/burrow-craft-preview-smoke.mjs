// Data-driven Class Armory recipe previews: desktop and portrait browser regression.
// Uses an isolated Playwright context; never reads or mutates the user's real save.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4343,strictPort:false}});
const browser=await chromium.launch({headless:true});
const check=(name,ok,detail)=>{if(!ok)throw Error('FAIL '+name+' '+JSON.stringify(detail));console.log('PASS '+name);};
const errors=[];
try{
 for(const [width,height] of [[1440,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500});
  const p=await context.newPage();
  p.on('pageerror',e=>errors.push(e.stack||e.message));
  await p.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
  await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:60000});
  await p.evaluate(()=>{
   const s=__warren;
   s.warren=11;s.forgeClass='archer';s.modal='hero';s.armoryTab='craft';s.armorySlot='weapon';s.armoryRecipe=null;s.forgeLevel=3;s.gold=100000;
   Object.assign(s.inventory,{tier1Blueprint:8,copperOre:50,livingMoss:50,brutalSpore:50,tier2Blueprint:8,moonstoneShard:40,duneRunnerClaw:50,cactusSpine:30});
   __warrenDev.renderUi();
  });
  check(width+' recipe picker shows canonical base stats',await p.locator('#heroPanel [data-armory-recipe="thornwoodBow"]').innerText().then(v=>v.includes('ATK +33')&&v.includes('MATK +7')),null);
  await p.locator('#heroPanel [data-armory-recipe="thornwoodBow"]').click();
  let view=await p.locator('#heroPanel .bc-craft-preview').innerText();
  check(width+' selected bow shows T2 / Lv11 / actual stat preview',view.includes('Thornwood Bow')&&view.includes('กระต่าย Lv 11+')&&view.includes('ATK')&&view.includes('+33')&&view.includes('MATK')&&view.includes('+7'),view);
  check(width+' recipe shows required materials below result',await p.locator('#heroPanel .bc-craft-cost').innerText().then(t=>t.includes('Moonstone Shard')&&t.includes('Dune Runner Claw')),null);
  await p.locator('#heroPanel .bc-craft-rarity-details summary').click();
  check(width+' seven rarity rows from canonical multipliers',await p.locator('#heroPanel .bc-craft-rarity-table tbody tr').count()===7,null);
  const chances=await p.locator('#heroPanel .bc-craft-rarity-table tbody tr td:last-child').allTextContents();
  check(width+' current Forge Lv3 raises rarity odds while probabilities sum to ~100%',
   Number(chances[0].replace('%',''))<50&&Math.abs(chances.reduce((sum,c)=>sum+Number(c.replace('%','').replace('<','')),0)-100)<.35,chances);
  await p.evaluate(()=>{
    const s=__warren,piece=__warrenDev.craftGear('mosswoodBow');
    piece.rarity='rare';s.builds.archer[0].gear.weapon=piece.id;__warrenDev.renderUi();
  });
  const compare=await p.locator('#heroPanel .bc-craft-compare').innerText();
  check(width+' selected recipe compares to actually equipped rarity',compare.includes('ที่ใส่อยู่')&&compare.includes('ต่างกัน')&&compare.includes('33')&&compare.includes('24'),compare);
  await p.evaluate(()=>{
   const s=__warren;s.forgeClass='guard';s.armorySlot='armor';s.armoryRecipe='t2DamageArmor';__warrenDev.renderUi();
  });
  const armor=await p.locator('#heroPanel .bc-craft-preview').innerText();
  check(width+' role / set / all armor stats come from item master',
   armor.includes('Damage')&&armor.includes('เซ็ต Body 3 ชิ้น')&&armor.includes('+42')&&armor.includes('+28')&&armor.includes('+120')&&armor.includes('+8'),armor);
  const overflow=await p.evaluate(()=>{
    const el=document.querySelector('#heroPanel .bc-craft-preview'),r=el.getBoundingClientRect(),parent=document.querySelector('#heroPanel .bc-modal-body');
    return {previewWidth:r.width,previewScroll:el.scrollWidth,previewClient:el.clientWidth,parentWidth:parent.clientWidth};
  });
  check(width+' result preview is responsive without content overflow',
   overflow.previewScroll<=overflow.previewClient+3&&overflow.previewWidth<=overflow.parentWidth+3,overflow);
  await context.close();
 }
 check('no uncaught browser error',errors.length===0,errors);
}catch(e){console.error(e.stack||e,'BROWSER ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
