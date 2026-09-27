// End-to-end browser check: weapon skills earned from paid Mastery milestones use
// the main-game on-hit engine, have their own slots, and persist the per-tier toggles.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const srv=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4333,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];
const check=(name,ok,detail)=>{if(!ok)throw Error('FAIL '+name+' '+JSON.stringify(detail));console.log('PASS '+name)};
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(srv.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:45000});
 await p.evaluate(()=>{
  const s=__warren;s.gold=100000;s.mastery.archer={level:31,xp:0,unlocked:[10,20,30]};s.warren=9;
  s.masteryClass='archer';s.coreClass='archer';__warrenDev.renderUi();
 });
 await p.locator('#masteryOpen').click();
 await p.locator('#masteryPanel [data-mastery-class=archer]').click();
 check('real Lv10 / Lv20 / Lv30 Archer actives appear separately from milestones',
  await p.locator('#masteryPanel [data-mastery-active-level]').count()===3&&
  (await p.locator('#masteryPanel').innerText()).includes('Power Shot')&&
  (await p.locator('#masteryPanel').innerText()).includes('Piercing Volley')&&
  (await p.locator('#masteryPanel').innerText()).includes('Skyfall Barrage'));
 await p.locator('#masteryPanel [data-mastery-active-level="10"]').click();
 check('paid Lv10 Mastery skill can be disabled without losing its unlock',
  await p.evaluate(()=>__warren.mastery.archer.disabledWeaponSkills.includes(10)&&
   __warren.mastery.archer.unlocked.includes(10)));
 await p.locator('#masteryPanel [data-mastery-active-level="10"]').click();
 check('Lv10 skill re-enables independently of all Skill Core slots',
  await p.evaluate(()=>!__warren.mastery.archer.disabledWeaponSkills.includes(10)&&
   __warren.classSkills.archer.active.every(x=>!x)));
 const before=await p.evaluate(()=>{
  const s=__warren,u=s.units.find(x=>x.cls==='archer');
  const m=__warrenDev.spawnMonster('mossblob1',u.x+60,u.y,{power:120});
  if(!m)return{spawned:false};
  const hp=m.hp;
  const original=Math.random;Math.random=()=>.1;
  try{const fired=__warrenDev.masteryOnHit(u,m);
    return{spawned:true,fired,skillHits:u.weaponProc?.hits,readyAt:u.weaponProc?.readyAt?.powerShot,
     targetHp:m.hp,beforeHp:hp,time:s.time};
  }finally{Math.random=original;}
 });
 check('main-game Power Shot procs on a basic hit without duplicate Burrow basic damage',
  before.spawned&&before.fired&&before.skillHits===1&&before.readyAt>before.time&&
  before.targetHp<before.beforeHp,before);
 await p.locator('#masteryPanel [data-mastery-active-level="20"]').click();
 await p.evaluate(()=>__warrenDev.save());
 await p.reload();
 await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:45000});
 check('earned Mastery slots and disabled Lv20 flag survive an actual reload',
  await p.evaluate(()=>{
   const m=__warren.mastery.archer;
   return m.unlocked.includes(10)&&m.unlocked.includes(20)&&m.unlocked.includes(30)&&
    !m.disabledWeaponSkills.includes(10)&&m.disabledWeaponSkills.includes(20);
  }));
 const field=await p.evaluate(()=>{
  const s=__warren,u=s.units.find(x=>x.cls==='archer');
  s.monsters=[];u.cd=0;
  const m=__warrenDev.spawnMonster('thornBoar3',u.x+60,u.y,{power:120});
  const random=Math.random;Math.random=()=>.1;
  try{__warrenStep(3);}finally{Math.random=random;}
  return{spawned:Boolean(m),hits:u.weaponProc?.hits||0,
   cooldown:u.weaponProc?.readyAt?.powerShot||0,time:s.time,before:m?.maxHp,after:m?.hp};
 });
 check('actual autonomous Archer basic attacks trigger main-game Mastery actives in the field',
  field.spawned&&field.hits>=1&&field.cooldown>0&&field.after<field.before,field);
 await p.locator('#skillCoreOpen').click();
 await p.locator('#skillCorePanel [data-core-class=archer]').click();
 const coreText=await p.locator('#skillCorePanel').innerText();
 check('Skill Core screen displays all three independent learned Mastery weapon skills',
  ['Power Shot','Piercing Volley','Skyfall Barrage'].every(x=>coreText.includes(x))&&
  coreText.includes('Weapon Mastery Active'));
 await p.locator('#skillCorePanel [data-open-mastery=archer]').click();
 check('Mastery management link opens the correct class directly',
  await p.locator('#masteryPanel').isVisible()&&
  await p.locator('#masteryPanel [data-mastery-active-level="20"]').isEnabled());
 check('no page errors',errors.length===0,errors);
}catch(e){console.error(e.stack||e,'BROWSER ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>srv.httpServer.close(resolve));}
