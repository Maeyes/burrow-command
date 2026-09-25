import { describe, expect, it } from 'vitest';
import { BunnySimulation } from './engine';
import type { MonsterEntity, PlayerEntity } from './entities';
import { addMonster, addPlayer, createWorldState } from './world';
import { SKILLS_V2, skillSpCostV2 } from './skills';
import { createInitialCharacterV2, type CharacterStateV2 } from './character';
import { applyEquipmentCommand, PROTECTION_RECIPES_V2 } from './equipmentService';

const player=(sp:number):PlayerEntity=>({
  id:'p1',kind:'player',position:{x:0,y:0},hp:500,maxHp:500,alive:true,sp,maxSp:100,
  stats:{level:30,str:10,agi:1,vit:10,int:10,dex:30,luk:1},weaponFamily:'staff',weaponAtk:0,weaponMatk:50,equipmentDef:0,equipmentMdef:0,
  hitBonus:0,fleeBonus:0,critBonusPercent:0,equipmentAspd:0,attackRange:200,moveSpeed:6,dodgeDistance:3,dodgeCooldownMs:1200,nextDodgeAtMs:0,
  lastClientSequence:0,nextBasicAttackAtMs:0,cooldowns:{},skillEntitlements:{active:['fireball'],passive:[],weaponSkills:[],modifiersByActive:{}},
});
const target=():MonsterEntity=>({id:'m1',kind:'monster',position:{x:10,y:0},hp:1e6,maxHp:1e6,alive:true,level:1,atk:0,matk:0,def:0,mdef:0,hit:0,flee:0,critChance:0,attackRange:2,moveSpeed:0,attackIntervalMs:1e9,nextBasicAttackAtMs:1e12,isElite:false,isBoss:false});
const cast=(sp:number)=>{const w=createWorldState('forest1');addPlayer(w,player(sp));addMonster(w,target());const sim=new BunnySimulation(w,()=>.5);return{r:sim.dispatch({type:'castSkill',playerId:'p1',skillId:'fireball',targetId:'m1',clientSequence:1}),p:w.players.get('p1')!};};

describe('Skill Core SP cost',()=>{
  it('scales with cooldown and is zero for weapon skills and movement',()=>{
    expect(skillSpCostV2(SKILLS_V2.fireball)).toBe(6);
    expect(skillSpCostV2(SKILLS_V2.bowlingBash)).toBe(0);
    expect(skillSpCostV2(SKILLS_V2.dash)).toBe(0);
  });
  it('spends SP on cast and refuses when SP is short',()=>{
    const ok=cast(50);expect(ok.r.accepted).toBe(true);expect(ok.p.sp).toBe(44);
    const short=cast(5);expect(short.r.accepted).toBe(false);expect(short.r.reason).toBe('insufficient-sp');
  });
});

describe('refine protection crafting',()=>{
  it('turns 10 fragments + gold into a Lv1 protection, and 10 Lv1 into a Lv2',()=>{
    let s:CharacterStateV2={...createInitialCharacterV2('c'),gold:10000,inventory:{stoneFragment:25}};
    s=applyEquipmentCommand(s,{type:'craftProtection',level:1,qty:2}).state;
    expect(s.inventory).toMatchObject({stoneFragment:5,refineProtectionLv1:2});expect(s.gold).toBe(10000-2*PROTECTION_RECIPES_V2[1].gold);
    expect(()=>applyEquipmentCommand(s,{type:'craftProtection',level:2})).toThrow('insufficient-item');
  });
});
