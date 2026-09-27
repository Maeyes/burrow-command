// Browser integration test: this must exercise the actual Burrow combat loop, not
// just render a Skill Core UI or call the main game test simulator in isolation.
import {preview} from 'vite';
import {chromium} from '../artifacts/img2threejs/BunnyWorldHero/node_modules/playwright/index.mjs';
const srv=await preview({configFile:'vite.warren.config.ts',preview:{host:'127.0.0.1',port:4332,strictPort:false}});
const browser=await chromium.launch({headless:true});
const errors=[];
const check=(name,ok,detail)=>{if(!ok)throw Error('FAIL '+name+' '+JSON.stringify(detail));console.log('PASS '+name)};
try{
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(srv.resolvedUrls.local[0]+'art-test/dimraeth-slice/warren.html');
 await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:45000});
 await p.evaluate(()=>{
  const s=__warren;s.warren=20;s.gold=50000;
  Object.assign(s.inventory,{fireball:3,lifeDrain:2,dash:1});
  const u=__warrenDev.recruit('mage');
  u.level=30;u.atk=190;u.maxHp=300;u.hp=50;u.sp=120;u.maxSp=120;
  __warrenDev.renderUi();
 });
 await p.locator('#skillCoreOpen').click();
 await p.locator('#skillCorePanel [data-core-class=mage]').click();
 check('Mage sees genuine main-game Fireball and real Mod items',
  await p.locator('#skillCorePanel [data-core-choose="0"] option[value=fireball]').count()===1);
 await p.locator('#skillCorePanel [data-core-choose="0"]').selectOption('fireball');
 check('actual UI equips Fireball for mage',await p.evaluate(()=>__warren.classSkills.mage.active[0]==='fireball'));
 await p.locator('#skillCorePanel [data-mod-choose="0:0"]').selectOption('lifeDrain');
 check('Lv20 Mod 1 equips actual Life Drain',await p.evaluate(()=>__warren.classSkills.mage.modifiersByActive.fireball?.[0]==='lifeDrain'));
 await p.locator('#skillCorePanel .bc-core-recycling summary').click();
 await p.locator('#skillCorePanel [data-skill-salvage=fireball]').click();
 check('Skill Core surplus uses the main salvage service for exactly one Core Shard',await p.evaluate(()=>
  __warren.inventory.fireball===2&&__warren.inventory.coreShard===1));
 await p.evaluate(()=>{__warren.inventory.coreShard=3;__warrenDev.renderUi()});
 // The upgraded UI intentionally keeps the recycling section expanded on re-render.
 if(!(await p.locator('#skillCorePanel .bc-core-recycling').evaluate(el=>el.open)))
  await p.locator('#skillCorePanel .bc-core-recycling summary').click();
 await p.locator('#skillCorePanel [data-skill-exchange=fireball]').click();
 check('discovered Core exchanges the original three shards for one physical copy',
  await p.evaluate(()=>__warren.inventory.fireball===3&&__warren.inventory.coreShard===0));
 await p.locator('#skillCorePanel [data-movement-choose]').selectOption('dash');
 check('main-game Dash occupies the separate movement slot',await p.evaluate(()=>__warren.classSkills.mage.movement==='dash'));
 await p.locator('#skillCorePanel [data-modal-close]').click();
 const manual=await p.evaluate(()=>{
  const s=__warren,u=s.units.find(x=>x.cls==='mage');
  const m=__warrenDev.spawnMonster('mossblob1',u.x+80,u.y,{power:100});
  if(!m)return{spawned:false};
  u.sp=100;u.hp=50;
  const before={hp:m.hp,sp:u.sp,health:u.hp};
  const realRandom=Math.random;Math.random=()=>.5;
  let accepted;
  try{accepted=__warrenDev.castCore(u,m,'fireball');}finally{Math.random=realRandom;}
  return{spawned:true,accepted,before,after:{hp:m.hp,sp:u.sp,health:u.hp},cooldown:u.coreCooldowns?.fireball||0,time:s.time};
 });
 check('the real combat function applies Skill Core damage, SP, cooldown and Life Drain',
  manual.spawned&&manual.accepted&&manual.after.hp<manual.before.hp&&manual.after.sp<manual.before.sp&&
  manual.after.health>manual.before.health&&manual.cooldown>manual.time,manual);
 // UI choices must survive save/load; a new daytime session re-equips the exact saved
 // core and does not duplicate reserved inventory items.
 await p.evaluate(()=>{__warren.modal='skillCore';__warrenDev.save()});
 await p.reload();
 await p.waitForFunction(()=>window.__warrenDev&&window.__warren?.units?.length>=2,null,{timeout:45000});
 check('class Core, Mod and Movement survive save/reload together',
   await p.evaluate(()=>__warren.classSkills.mage.active[0]==='fireball'&&
     __warren.classSkills.mage.modifiersByActive.fireball?.[0]==='lifeDrain'&&
     __warren.classSkills.mage.movement==='dash'));
 const auto=await p.evaluate(()=>{
  const s=__warren,u=s.units.find(x=>x.cls==='mage');
  let m=null;
  for(const id of ['dust2','dust1','mossblob1','sporekin1'])if(!m)m=__warrenDev.spawnMonster(id,u.x+70,u.y,{power:100});
  u.hp=u.maxHp;u.sp=100;u.coreCooldowns={};u.coreCastUntil=0;
  return{unitId:u.id,monsterId:m?.id,hp:m?.hp};
 });
 check('field threat created for autonomous Skill Core cast',Boolean(auto.monsterId),auto);
 await p.waitForFunction(({unitId,monsterId,hp})=>{
  const s=__warren,u=s.units.find(x=>x.id===unitId),m=s.monsters.find(x=>x.id===monsterId);
  return Boolean(u?.coreCooldowns?.fireball&&u.coreCooldowns.fireball>s.time&&m&&m.hp<hp);
 },auto,{timeout:12000});
 check('ordinary field AI triggers equipped main-game Fireball itself',true);
 check('no browser exceptions',errors.length===0,errors);
 await p.close();
}catch(e){console.error(e.stack||e,'PAGE ERRORS',JSON.stringify(errors));process.exitCode=1;}
finally{await browser.close();await new Promise(resolve=>srv.httpServer.close(resolve));}
