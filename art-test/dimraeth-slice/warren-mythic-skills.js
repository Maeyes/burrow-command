// Mythic boss attack patterns (Sun Wukong, King Arthur, Ancient Dragon).
// warren.js owns the trial lifecycle; this module only decides and schedules boss skills.
import {arthurSkillAt} from './warren-arthur-skills.js';
export const WUKONG_CLONE_OFFSETS=Object.freeze([{x:-150,y:150},{x:150,y:-150}]);

// ctx.trial/skillFx/floaters are getters: queued hits must see the *current* trial,
// so an attack scheduled before a trial ends never lands afterwards.
export function createMythicSkills(ctx){
 const {S,CENTER,dist,later,hurtUnit,arthurGoldenWave}=ctx,trial=ctx.trial;
 return function updateMythicSkills(m,dt){
 const skillFx=ctx.skillFx(),floaters=ctx.floaters();
 m.specialCd-=dt;if((m.castUntil||0)>S.time)return true;
 if(m.specialCd>0)return false;
 if(m.bossId==='sunWukong'){
  const clones=m.specialIndex++%2===1,live=S.units.filter(u=>!u.down),targets=clones?live.slice(0,3).map(u=>({x:u.x,y:u.y})):[{x:m.x,y:m.y}],radius=clones?82:175,delay=clones?.42:.48;
  m.castUntil=S.time+delay;m.specialCd=clones?7:5;m.skillAnimStart=S.time;m.skillAnimUntil=S.time+.8;
  if(clones){m.cloneStart=S.time;m.cloneUntil=S.time+.82;for(const offset of WUKONG_CLONE_OFFSETS){const p={x:m.x+offset.x,y:m.y+offset.y};skillFx?.ring(p.x,p.y,58,'#fff1a0',.48);skillFx?.pillar(p.x,p.y,{color:'#ffd84d',count:18,life:.7});}}else{skillFx?.play('wukongCyclone',{from:m,follow:()=>({x:m.x,y:m.y}),radius,color:'#ffd84d'});for(let i=0;i<4;i++)later(i*.16,()=>trial()&&!m.dead&&skillFx?.ring(m.x,m.y,80+i*38,'#ffe36b',.68));}
  for(const [i,p] of targets.entries()){skillFx?.ring(p.x,p.y,radius,'#ffd84d',delay+i*.12);later(delay+i*.12,()=>{if(!trial()||m.dead||m.trialLost)return;skillFx?.play('groundSlam',{from:p,to:p,radius});for(const u of S.units)if(!u.down&&dist(u,p)<=radius)hurtUnit(u,m.atk*(clones?1.25:1.5),m);});}
  floaters?.text(m.x,m.y,clones?'CLONE SMASH':'CYCLONE',{color:'#ffe173',size:18,lift:90});return true;
 }
 if(m.bossId==='kingArthur'){
  const skill=arthurSkillAt(m.specialIndex++),excalibur=skill.id==='excalibur',bowling=skill.id==='bowlingBash',live=S.units.filter(u=>!u.down),aim=live.reduce((best,u)=>!best||dist(m,u)<dist(m,best)?u:best,null)||CENTER,target={x:aim.x,y:aim.y},delay=skill.delay,radius=skill.radius;
  m.castUntil=S.time+delay+(bowling?.2:0);m.specialCd=skill.cooldown;m.skillAnimStart=S.time;m.skillAnimUntil=S.time+.85;
  if(excalibur){
   skillFx?.pixelRing(target.x,target.y,72,'#9ed7ff',delay);
   const dx=target.x-m.x,dy=target.y-m.y,length=Math.hypot(dx,dy)||1,direction={x:length===1&&dx===0&&dy===0?1:dx/length,y:dy/length},origin={x:m.x,y:m.y},end={x:m.x+direction.x*1100,y:m.y+direction.y*1100};
   later(delay,()=>{if(!trial()||m.dead||m.trialLost)return;skillFx?.spriteWave(arthurGoldenWave,origin,end,{size:240,life:1.65});});
  }else if(bowling){
   skillFx?.pixelRing(target.x,target.y,radius,'#ffe799',delay);
   for(const [index,offset] of [0,.18].entries())later(delay+offset,()=>{if(!trial()||m.dead||m.trialLost)return;skillFx?.pixelRing(target.x,target.y,radius*(index?1:.7),'#fff4c4',.5);skillFx?.burst(target.x,target.y,{color:'#ffe178',color2:'#90cfff',count:32,size:6,up:95,life:.65});skillFx?.spriteWave(arthurGoldenWave,{x:target.x-60,y:target.y},{x:target.x+60,y:target.y},{size:300,life:.42});for(const u of S.units)if(!u.down&&dist(u,target)<=radius)hurtUnit(u,m.atk*.8,m);});
  }else{
   for(let i=0;i<8;i++){const a=i*Math.PI/4,p={x:target.x+Math.cos(a)*radius,y:target.y+Math.sin(a)*radius*.55};later(i*.055,()=>{if(!trial()||m.dead)return;skillFx?.burst(p.x,p.y,{color:i%2?'#6daeff':'#ffe178',count:7,size:5,speed:34,up:55,life:.5});});}
   skillFx?.pixelRing(target.x,target.y,radius,'#6daeff',delay);
  }
  if(!bowling)later(delay,()=>{if(!trial()||m.dead||m.trialLost)return;skillFx?.pixelRing(target.x,target.y,radius*.72,'#e9f7ff',.42);skillFx?.burst(target.x,target.y,{color:'#fff5bd',color2:'#4289df',count:excalibur?24:18,size:5,up:70,life:.7});for(const u of S.units)if(!u.down&&dist(u,target)<=radius)hurtUnit(u,m.atk*(excalibur?1.75:1.35),m);});
  floaters?.text(m.x,m.y,skill.label,{color:'#ffe799',size:18,lift:95});return true;
 }
 const meteor=m.specialIndex++%2===1,targets=meteor?S.units.filter(u=>!u.down).slice(0,5).map(u=>({x:u.x,y:u.y})):[{x:m.x,y:m.y}];
 const radius=meteor?95:180,delay=meteor?1.35:1;
 m.castUntil=S.time+delay;m.specialCd=meteor?8:6;
 for(const [i,p] of targets.entries()){
  skillFx?.ring(p.x,p.y,radius,'#ff8d40',delay+i*.15);
  later(delay+i*.15,()=>{if(!trial()||m.dead||m.trialLost)return;skillFx?.play(meteor?'meteorStorm':'groundSlam',{from:p,to:p,radius});
   for(const u of S.units)if(!u.down&&dist(u,p)<=radius)hurtUnit(u,m.atk*(meteor?1.8:1.4),m);
  });
 }
 floaters?.text(m.x,m.y,meteor?'METEOR':'GROUND SLAM',{color:'#ffc77a',size:18,lift:95});return true;
 };
}
