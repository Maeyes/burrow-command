// Focused mobile UX regression: independent Bunny/Armory navigation, direct craft,
// and click-safe multi-select salvage of only unlocked/unequipped bag items.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const server=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4331,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[],check=(label,ok)=>{if(!ok)throw Error('FAIL '+label);console.log('PASS '+label)};
try{
 for(const [width,height] of [[360,800],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  const p=await context.newPage();p.setDefaultTimeout(12000);
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(server.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
  await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,{timeout:45000});
  check(width+' unique Bunny and Gear dock icons',await p.locator('#mobileDock [data-mobile-open=skills]').count()===1&&
    await p.locator('#mobileDock [data-mobile-open=craft]').count()===1);
  await p.locator('#mobileDock [data-mobile-open=village]').click();
  check(width+' no duplicate Armory/Mastery controls in village drawer',
    await p.locator('#side .bc-quick-actions').isHidden());
  await p.locator('#mobileDock [data-mobile-open=skills]').click();
  check(width+' Bunny opens only Mastery and Skill Core choices',
    await p.locator('#bunnyMenuPanel').isVisible()&&await p.locator('#bunnyMenuPanel .bc-bunny-menu button').count()===2);
  await p.locator('#bunnyMenuPanel [data-modal-close]').click();
  await p.locator('#mobileDock [data-mobile-open=craft]').click();
  check(width+' Gear opens Armory without redundant Mastery toolbar button',
    await p.locator('#heroPanel').isVisible()&&
    await p.locator('#heroPanel .bc-armory-toolbar [data-open-mastery]').isHidden());
  const itemIds=await p.evaluate(()=>{
    const s=window.__warren;s.gold=50000;
    Object.assign(s.inventory,{tier1Blueprint:25,copperOre:700,livingMoss:700,brutalSpore:700});
    s.forgeClass='archer';s.armorySlot='weapon';s.armoryTab='inventory';
    const ids=Array.from({length:3},()=>window.__warrenDev.craftGear('mosswoodBow')?.id);
    window.__warrenDev.renderUi();return ids;
  });
  check(width+' fixtures crafted without changing real saves',itemIds.every(Boolean));
  await p.locator('#heroPanel [data-batch-lock="'+itemIds[0]+'"]').check();
  check(width+' locked piece cannot be selected for salvage',
    await p.locator('#heroPanel [data-armory-select="'+itemIds[0]+'"]').isDisabled());
  await p.locator('#heroPanel [data-armory-select-all]').click();
  check(width+' Select All skips locked item and selects two others',
    await p.evaluate(ids=>{const s=__warren;return s.armoryInventorySelection.length===2&&!s.armoryInventorySelection.includes(ids[0]);},itemIds));
  const before=await p.evaluate(()=>__warren.inventory.stoneFragment||0);
  await p.locator('#heroPanel [data-armory-dismantle]').click();
  check(width+' one tap salvages both selected pieces and retains locked item',
    await p.evaluate(([ids,previous])=>{
      const s=__warren;return s.gear.length===1&&s.gear[0].id===ids[0]&&s.gear[0].locked&&
        s.inventory.stoneFragment>previous&&s.armoryInventorySelection.length===0;
    },[itemIds,before]));
  await p.locator('#heroPanel [data-armory-tab=craft]').click();
  await p.locator('#heroPanel [data-auto-enabled]').check();
  await p.locator('#heroPanel [data-auto-rarity]').selectOption('rare');
  await p.locator('#heroPanel [data-forge-craft=mosswoodBow]').click();
  check(width+' one-tap auto-dismantle crafting skips extra rule confirmation',
    await p.evaluate(()=>__warren.batchReport?.made.length===1)&&
    await p.locator('#heroPanel [data-auto-confirm]').count()===0);
  check(width+' no page exceptions',errors.length===0);
  await context.close();
 }
}catch(error){console.error(error.stack||error,'PAGE ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
