import { describe, expect, it } from 'vitest';
import { ArenaV2Adapter } from './arenaAdapter';
import { blockChanceForPlayer } from './engine';
import { createInitialCharacterV2 } from './character';
import { EQUIPMENT_MASTER_V2 } from './itemMasterV2';

describe('mastery loadout runtime bridge',()=>{
  it('recomputes all seven weapon innates immediately on equip, dual-wield, pairing and swaps without Mastery slots',()=>{
    const character=createInitialCharacterV2('innate-live');
    const ids=['t1OffhandDagger','t1Shield','copperrootHammer','mosswoodSword','sporewoodScepter','sporewoodWand','mosswoodAxe','mosswoodBow'];
    for(const templateId of ids){
      const t=EQUIPMENT_MASTER_V2[templateId];
      character.equipment.instances[templateId]={id:templateId,templateId,slot:t.slot,offhandType:t.offhandType,
        rarity:'normal',affixes:[],baseGoldCost:100,baseCombat:t.baseCombat,requiredLevel:1};
    }
    character.equipment.refinementBySlot.offhand=15;
    const adapter=new ArenaV2Adapter({zoneId:'forest1',player:{x:0,y:0},monsters:[],character,random:()=>.5});
    const p=adapter.simulation.world.players.get(adapter.playerId)!;
    const equip=(id:string)=>adapter.equipmentCommand({type:'equip',equipmentId:id});
    expect(p.weaponFamily).toBe('dagger');
    expect(p.equipmentAspd).toBeCloseTo(6); // 3 baseline +3 innate.
    expect(p.critBonusPercent).toBeCloseTo(3);
    expect(p.critDamageMultiplier).toBeCloseTo(1.06);
    expect(p.masteryPassives).toEqual([]);

    equip('t1OffhandDagger');
    expect(p.equipmentAspd).toBeCloseTo(8.5); // 3 base +4.5 dual innate +1 offhand +5 refine milestone.
    expect(p.critBonusPercent).toBeCloseTo(4.5);
    expect(p.critDamageMultiplier).toBeCloseTo(1.09);
    adapter.equipmentCommand({type:'unequip',slot:'offhand'});
    expect(p.equipmentAspd).toBeCloseTo(6);
    expect(p.critBonusPercent).toBeCloseTo(3);
    equip('t1Shield'); // Starter dagger keeps its innate and a shield always gives +5% Block.
    expect(blockChanceForPlayer(p)).toBeCloseTo(.11); // +5% innate shield +6% +15 refine.
    expect(p.equipmentAspd).toBeCloseTo(6);
    adapter.equipmentCommand({type:'unequip',slot:'offhand'});
    expect(blockChanceForPlayer(p)).toBe(0);

    const baseHp=p.maxHp,baseDef=p.equipmentDef;
    equip('copperrootHammer');
    expect(p.weaponFamily).toBe('hammer');
    expect(p.maxHp).toBeGreaterThan(baseHp);
    expect(p.equipmentDef).toBeGreaterThan(baseDef);
    expect(p.equipmentAspd).toBeCloseTo(3);

    equip('mosswoodSword');
    expect(p.weaponFamily).toBe('greatsword');
    expect(p.innatePhysicalAttackMultiplier).toBeCloseTo(1.05);
    expect(p.maxHp).toBe(baseHp);

    equip('sporewoodScepter');
    expect(p.weaponFamily).toBe('swordShield');
    expect(p.innatePhysicalAttackMultiplier).toBeCloseTo(1.035);
    expect(blockChanceForPlayer(p)).toBe(0);
    equip('t1Shield');
    expect(blockChanceForPlayer(p)).toBeCloseTo(.11); // innate shield +5% and slot refine +15 -> +6%.
    expect(p.innateBlockChanceBonus).toBeCloseTo(.05);
    equip('sporewoodWand');
    expect(p.weaponFamily).toBe('staff');
    expect(p.weaponMatk).toBeGreaterThan(0);
    expect(blockChanceForPlayer(p)).toBeCloseTo(.11); // shield innate remains active with Staff.
    expect(p.innatePhysicalAttackMultiplier).toBe(1); // One-handed sword innate removed on swap.

    equip('mosswoodAxe'); // Two-handed equip auto-removes the shield.
    expect(p.weaponFamily).toBe('axe');
    expect(p.hasShieldEquipped).toBe(false);
    expect(p.innatePhysicalArmorPenetration).toBeCloseTo(.10);
    expect(p.innatePhysicalLifeSteal).toBeCloseTo(.02);
    expect(blockChanceForPlayer(p)).toBe(0);

    equip('mosswoodBow');
    expect(p.weaponFamily).toBe('bow');
    expect(p.hitBonus).toBe(5);
    expect(p.innatePhysicalAttackMultiplier).toBeCloseTo(1.05);
    expect(p.innatePhysicalArmorPenetration).toBe(0);
    expect(p.innatePhysicalLifeSteal).toBe(0);
    expect(p.masteryPassives).toEqual([]);
  });
  it('updates equipped shield refinement Block and installed Mastery on the live player',()=>{
    const character=createInitialCharacterV2('shield-player');
    character.weaponMastery.swordShield.level=40;
    character.equipment.instances['shield-eq']={id:'shield-eq',templateId:'t1Shield',slot:'offhand',offhandType:'shield',rarity:'normal',affixes:[],baseGoldCost:100};
    character.equipment.equippedBySlot.offhand='shield-eq';
    character.equipment.refinementBySlot.offhand=15;
    const adapter=new ArenaV2Adapter({zoneId:'forest1',player:{x:0,y:0},monsters:[],character});
    const live=()=>adapter.simulation.world.players.get(adapter.playerId)!;
    expect(live().hasShieldEquipped).toBe(true);
    expect(live().shieldBlockChanceBonus).toBeCloseTo(.06);
    expect(blockChanceForPlayer(live())).toBeCloseTo(.11);
    adapter.masteryLoadoutCommand({type:'togglePassive',family:'swordShield',milestoneId:'guard'});
    expect(blockChanceForPlayer(live())).toBeCloseTo(.19);
    adapter.masteryLoadoutCommand({type:'togglePassive',family:'swordShield',milestoneId:'perfectGuard'});
    expect(blockChanceForPlayer(live())).toBeCloseTo(.23);
  });
  it('refreshes authoritative passive and on-hit entitlements from loadout commands',()=>{
    const character=createInitialCharacterV2('c');
    character.weaponMastery.dagger.level=10;
    character.weaponMastery.greatsword.level=20;
    character.weaponMastery.axe.level=30;
    const adapter=new ArenaV2Adapter({zoneId:'forest1',player:{x:0,y:0},monsters:[{id:'m',x:20,y:0,hp:100,maxHp:100,dead:false}],character,random:()=>.99});
    adapter.masteryLoadoutCommand({type:'togglePassive',family:'dagger',milestoneId:'doubleAttack'});
    adapter.masteryLoadoutCommand({type:'equipActive',level:10,family:'dagger'});
    adapter.masteryLoadoutCommand({type:'equipActive',level:20,family:'greatsword'});
    adapter.masteryLoadoutCommand({type:'equipActive',level:30,family:'axe'});
    const player=adapter.simulation.world.players.get(adapter.playerId)!;
    expect(player.masteryPassives).toEqual(['dagger:doubleAttack']);
    expect(player.skillEntitlements.weaponSkills).toEqual(['crossSlash','crescentBreak','ravagerArc']);
  });
});
