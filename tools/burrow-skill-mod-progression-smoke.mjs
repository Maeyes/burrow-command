// Skill Core progression + equipped-Mod persistence + main-game Mod upgrade browser regression.
// Levels 30 are injected to test future Warren gates (Phase 1 gameplay currently ends at 20).
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const srv=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4336,strictPort:false}});
const browser=await chromium.launch({headless:true});
const check=(name,ok,detail)=>{if(!ok)throw Error('FAIL '+name+' '+JSON.stringify(detail));console.log('PASS '+name)};
const errors=[];
try{
 for(const [width,height,mobile] of [[1440,900,false],[390,844,true]]){
  const c=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
  const p=await c.newPage();p.setDefaultTimeout(13000);
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(srv.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
  await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:45000});
  await p.evaluate(()=>{
   const s=__warren;s.warren=10;s.gold=200000;
   Object.assign(s.inventory,{fireball:2,iceLance:1,cyclone:1,lifeDrain:7,rapidCasting:1,
    echo:1,lingering:1,extraStrike:1,expandedArea:1,dash:1});
   __warrenDev.renderUi();
  });
  if(mobile)await p.locator('#mobileDock [data-mobile-open=skills]').click();
  if(mobile)await p.locator('#bunnyMenuPanel [data-open-core-menu]').click();
  else await p.locator('#skillCoreOpen').click();
  await p.locator('#skillCorePanel [data-core-class=mage]').click();
  const root='#skillCorePanel ';
  check(width+' Lv10 unlocks Core 1 AND both Mods; locks Core 2/3',await p.locator(root+'[data-core-choose="0"]').isEnabled()&&
    await p.locator(root+'[data-core-choose="1"]').isDisabled()&&
    await p.locator(root+'[data-core-choose="2"]').isDisabled()&&
    await p.locator(root+'[data-mod-choose="0:0"]').isDisabled()&& // no Core equipped yet
    await p.locator(root+'[data-mod-choose="0:1"]').isDisabled());
  await p.locator(root+'[data-core-choose="0"]').selectOption('fireball');
  check(width+' Lv10 both Mod selectors activate as soon as Core 1 is equipped',
    await p.locator(root+'[data-mod-choose="0:0"]').isEnabled()&&
    await p.locator(root+'[data-mod-choose="0:1"]').isEnabled());
  await p.locator(root+'[data-mod-choose="0:0"]').selectOption('lifeDrain');
  await p.locator(root+'[data-mod-choose="0:1"]').selectOption('rapidCasting');
  check(width+' both equipped Mods stay visible and selected through UI rebuild',
    await p.locator(root+'[data-mod-choose="0:0"]').inputValue()==='lifeDrain'&&
    await p.locator(root+'[data-mod-choose="0:1"]').inputValue()==='rapidCasting');
  check(width+' main-game Mod rarity upgrade costs six duplicates and Gold at Lv10',
    await p.locator(root+'[data-skill-upgrade=lifeDrain]').isEnabled()&&
    (await p.locator(root+'[data-core-slot="0"]').innerText()).includes('6/6'));
  await p.locator(root+'[data-skill-upgrade=lifeDrain]').click();
  check(width+' upgrade Mod succeeds without unequipping either installed Mod',
   await p.evaluate(()=>{
    const s=__warren;return s.inventory.lifeDrain===1&&s.gold===190000&&
     s.classSkills.mage.coreRarity.lifeDrain==='good'&&
     JSON.stringify(s.classSkills.mage.modifiersByActive.fireball)==='["lifeDrain","rapidCasting"]';
   }));
  check(width+' upgrade result is explicitly shown and selectors are still correct',
    (await p.locator(root+'.bc-core-upgrade-feedback').innerText()).includes('สำเร็จ')&&
    await p.locator(root+'[data-mod-choose="0:0"]').inputValue()==='lifeDrain'&&
    await p.locator(root+'[data-mod-choose="0:1"]').inputValue()==='rapidCasting');
  await p.evaluate(()=>{__warren.warren=20;__warrenDev.renderUi()});
  check(width+' Lv20 unlocks Core 2 with two Mods but not Core 3',
    await p.locator(root+'[data-core-choose="1"]').isEnabled()&&
    await p.locator(root+'[data-core-choose="2"]').isDisabled());
  await p.locator(root+'[data-core-choose="1"]').selectOption('iceLance');
  await p.locator(root+'[data-mod-choose="1:0"]').selectOption('echo');
  await p.locator(root+'[data-mod-choose="1:1"]').selectOption('lingering');
  await p.locator(root+'[data-core-class=guard]').click();
  await p.locator(root+'[data-core-class=mage]').click();
  check(width+' class switching does not detach Core 1/2 or any equipped Mod',
    await p.evaluate(()=>{
      const x=__warren.classSkills.mage;return JSON.stringify(x.active.slice(0,2))==='["fireball","iceLance"]'&&
       JSON.stringify(x.modifiersByActive.fireball)==='["lifeDrain","rapidCasting"]'&&
       JSON.stringify(x.modifiersByActive.iceLance)==='["echo","lingering"]';
    }));
  await p.evaluate(()=>{__warren.warren=30;__warrenDev.renderUi()});
  await p.locator(root+'[data-core-choose="2"]').selectOption('cyclone');
  await p.locator(root+'[data-mod-choose="2:0"]').selectOption('extraStrike');
  await p.locator(root+'[data-mod-choose="2:1"]').selectOption('expandedArea');
  check(width+' Lv30 unlocks third complete Core + two Mods',
   await p.evaluate(()=>{
    const x=__warren.classSkills.mage;return x.active[2]==='cyclone'&&
     JSON.stringify(x.modifiersByActive.cyclone)==='["extraStrike","expandedArea"]';
   }));
  await p.evaluate(()=>{__warren.warren=10;__warrenDev.save();__warrenDev.renderUi()});
  check(width+' returning to Lv10 locks, but does not erase, saved higher-slot gear',
    await p.locator(root+'[data-core-choose="1"]').isDisabled()&&
    await p.locator(root+'[data-core-choose="1"]').inputValue()==='iceLance'&&
    await p.locator(root+'[data-mod-choose="2:1"]').inputValue()==='expandedArea');
  await p.reload();
  await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:45000});
  check(width+' all three equipped Core/Mod combinations and upgraded Mod survive save reload',
    await p.evaluate(()=>{
      const s=__warren,x=s.classSkills.mage;
      return s.warren===10&&x.active.join(',')==='fireball,iceLance,cyclone'&&
       x.modifiersByActive.fireball[0]==='lifeDrain'&&x.modifiersByActive.fireball[1]==='rapidCasting'&&
       x.modifiersByActive.iceLance[0]==='echo'&&x.modifiersByActive.iceLance[1]==='lingering'&&
       x.modifiersByActive.cyclone[0]==='extraStrike'&&x.modifiersByActive.cyclone[1]==='expandedArea'&&
       x.coreRarity.lifeDrain==='good';
    }));
  check(width+' no browser exceptions',errors.length===0,errors);
  await c.close();
 }
}catch(e){console.error(e.stack||e,'PAGE ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>srv.httpServer.close(resolve));}
