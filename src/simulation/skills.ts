import type { CombatWeaponFamily } from '../systems/combatMath';

export type SkillScaling = 'physicalAttack' | 'magicalAttack';
export type DefenseType = 'def' | 'mdef' | 'ignore';
export type AccuracyRule = 'normal' | 'alwaysHit';

export interface SkillDefinitionV2 {
  id: string;
  name: string;
  kind: 'active' | 'movement' | 'passive' | 'weapon';
  scaling?: SkillScaling;
  coefficient?: number;
  flatPower?: number;
  hitCount?: number;
  defenseType?: DefenseType;
  canCrit?: boolean;
  accuracy?: AccuracyRule;
  element?: 'physical'|'fire'|'cold'|'lightning'|'wind'|'neutral';
  cooldownMs?: number;
  range?: number;
  radius?: number;
  targeting?: 'target'|'selfArea'|'targetArea'|'groundArea';
  movementDistance?: number;
  healMaxHpFraction?: number;
  compatibleWeaponFamilies?: CombatWeaponFamily[];
  auto?: {
    canAutoUse: boolean;
    minimumEnemyCount?: number;
    preferredRange?: number;
    reserveForEliteBoss?: boolean;
    minimumExpectedTargets?: number;
  };
}

export const SKILLS_V2: Record<string, SkillDefinitionV2> = {
  cyclone:{id:'cyclone',targeting:'selfArea',radius:105,name:'Cyclone',kind:'active',scaling:'physicalAttack',coefficient:1.35,hitCount:3,defenseType:'def',canCrit:true,accuracy:'normal',element:'wind',cooldownMs:5000,auto:{canAutoUse:true,minimumEnemyCount:3,minimumExpectedTargets:3}},
  thunderStorm:{id:'thunderStorm',targeting:'targetArea',range:240,radius:115,name:'Thunder Storm',kind:'active',scaling:'magicalAttack',coefficient:1.4,hitCount:3,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'lightning',cooldownMs:6000,auto:{canAutoUse:true,minimumEnemyCount:3,minimumExpectedTargets:3}},
  meteorStorm:{id:'meteorStorm',targeting:'groundArea',range:260,radius:125,name:'Meteor Storm',kind:'active',scaling:'magicalAttack',coefficient:1.5,hitCount:3,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'fire',cooldownMs:8000,auto:{canAutoUse:true,minimumEnemyCount:4,minimumExpectedTargets:3}},
  dash:{id:'dash',name:'Dash',kind:'movement',movementDistance:130,cooldownMs:3500,auto:{canAutoUse:true}},
  blink:{id:'blink',name:'Blink',kind:'movement',movementDistance:190,cooldownMs:5000,auto:{canAutoUse:true}},
  barrier:{id:'barrier',name:'Barrier',kind:'active',cooldownMs:12000,auto:{canAutoUse:true,reserveForEliteBoss:true}},
  warCry:{id:'warCry',name:'War Cry',kind:'active',cooldownMs:12000,auto:{canAutoUse:true,minimumEnemyCount:2}},
  frostNova:{id:'frostNova',targeting:'selfArea',radius:100,name:'Frost Nova',kind:'active',scaling:'magicalAttack',coefficient:1.2,hitCount:1,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'cold',cooldownMs:6500,auto:{canAutoUse:true,minimumEnemyCount:2}},
  chainLightning:{id:'chainLightning',targeting:'targetArea',range:220,radius:125,name:'Chain Lightning',kind:'active',scaling:'magicalAttack',coefficient:1.45,hitCount:1,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'lightning',cooldownMs:4500,auto:{canAutoUse:true,minimumEnemyCount:2}},
  fireball:{id:'fireball',name:'Fireball',kind:'active',scaling:'magicalAttack',coefficient:1.35,hitCount:1,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'fire',cooldownMs:3000,auto:{canAutoUse:true}},
  piercingShot:{id:'piercingShot',name:'Piercing Shot',kind:'active',scaling:'physicalAttack',coefficient:1.6,hitCount:1,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:4500,compatibleWeaponFamilies:['bow'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  groundSlam:{id:'groundSlam',targeting:'selfArea',radius:90,name:'Ground Slam',kind:'active',scaling:'physicalAttack',coefficient:1.5,hitCount:1,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:5500,auto:{canAutoUse:true,minimumEnemyCount:2}},
  bladeRush:{id:'bladeRush',name:'Blade Rush',kind:'active',scaling:'physicalAttack',coefficient:1.8,hitCount:3,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:7000,auto:{canAutoUse:true,reserveForEliteBoss:true}},
  iceLance:{id:'iceLance',name:'Ice Lance',kind:'active',scaling:'magicalAttack',coefficient:1.6,hitCount:1,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'cold',cooldownMs:4000,auto:{canAutoUse:true}},
  healingPulse:{id:'healingPulse',name:'Healing Pulse',kind:'active',cooldownMs:10000,healMaxHpFraction:0.2,auto:{canAutoUse:true}},
  blackHole:{id:'blackHole',targeting:'selfArea',radius:260,name:'Black Hole',kind:'active',scaling:'magicalAttack',coefficient:1.25,hitCount:4,defenseType:'mdef',canCrit:false,accuracy:'normal',element:'neutral',cooldownMs:10000,auto:{canAutoUse:true,minimumEnemyCount:3,minimumExpectedTargets:3}},
  lightningField:{id:'lightningField',targeting:'groundArea',range:240,radius:120,name:'Lightning Field',kind:'active',scaling:'magicalAttack',coefficient:1.35,hitCount:5,defenseType:'mdef',canCrit:false,accuracy:'normal',element:'lightning',cooldownMs:9000,auto:{canAutoUse:true,minimumEnemyCount:3}},
  flameTrail:{id:'flameTrail',targeting:'selfArea',radius:95,name:'Flame Trail',kind:'active',scaling:'magicalAttack',coefficient:1.25,hitCount:5,defenseType:'mdef',canCrit:false,accuracy:'normal',element:'fire',cooldownMs:8500,auto:{canAutoUse:true,minimumEnemyCount:2}},

  bowlingBash:{id:'bowlingBash',name:'Bowling Bash',kind:'weapon',targeting:'targetArea',range:72,radius:72,scaling:'physicalAttack',coefficient:1.45,hitCount:2,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:4500,compatibleWeaponFamilies:['greatsword'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  crescentBreak:{id:'crescentBreak',name:'Crescent Break',kind:'weapon',targeting:'selfArea',radius:100,scaling:'physicalAttack',coefficient:2.1,hitCount:1,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:7000,compatibleWeaponFamilies:['greatsword'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  vanguardTempest:{id:'vanguardTempest',name:'Vanguard Tempest',kind:'weapon',targeting:'selfArea',radius:125,scaling:'physicalAttack',coefficient:3.6,hitCount:5,defenseType:'def',canCrit:true,accuracy:'normal',element:'wind',cooldownMs:18000,compatibleWeaponFamilies:['greatsword'],auto:{canAutoUse:true,reserveForEliteBoss:true,minimumExpectedTargets:2}},
  crossSlash:{id:'crossSlash',name:'Cross Slash',kind:'weapon',targeting:'target',range:64,scaling:'physicalAttack',coefficient:1.55,hitCount:2,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:3500,compatibleWeaponFamilies:['dagger'],auto:{canAutoUse:true}},
  shadowFlurry:{id:'shadowFlurry',name:'Shadow Flurry',kind:'weapon',targeting:'target',range:68,scaling:'physicalAttack',coefficient:2.35,hitCount:5,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:6500,compatibleWeaponFamilies:['dagger'],auto:{canAutoUse:true,reserveForEliteBoss:true}},
  phantomBlades:{id:'phantomBlades',name:'Phantom Blades',kind:'weapon',targeting:'selfArea',radius:110,scaling:'physicalAttack',coefficient:3.75,hitCount:7,defenseType:'def',canCrit:true,accuracy:'normal',element:'wind',cooldownMs:17000,compatibleWeaponFamilies:['dagger'],auto:{canAutoUse:true,reserveForEliteBoss:true}},
  cleavingStrike:{id:'cleavingStrike',name:'Cleaving Strike',kind:'weapon',targeting:'targetArea',range:72,radius:78,scaling:'physicalAttack',coefficient:1.7,hitCount:1,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:4500,compatibleWeaponFamilies:['axe'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  executionersSweep:{id:'executionersSweep',name:"Executioner's Sweep",kind:'weapon',targeting:'selfArea',radius:105,scaling:'physicalAttack',coefficient:2.45,hitCount:2,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:7500,compatibleWeaponFamilies:['axe'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  ravagerArc:{id:'ravagerArc',name:'Ravager Arc',kind:'weapon',targeting:'selfArea',radius:135,scaling:'physicalAttack',coefficient:4.0,hitCount:3,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:19000,compatibleWeaponFamilies:['axe'],auto:{canAutoUse:true,reserveForEliteBoss:true}},
  crushingImpact:{id:'crushingImpact',name:'Crushing Impact',kind:'weapon',targeting:'targetArea',range:70,radius:65,scaling:'physicalAttack',coefficient:1.85,hitCount:1,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:5000,compatibleWeaponFamilies:['hammer'],auto:{canAutoUse:true}},
  earthbreaker:{id:'earthbreaker',name:'Earthbreaker',kind:'weapon',targeting:'selfArea',radius:115,scaling:'physicalAttack',coefficient:2.6,hitCount:2,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:8000,compatibleWeaponFamilies:['hammer'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  cataclysm:{id:'cataclysm',name:'Cataclysm',kind:'weapon',targeting:'selfArea',radius:145,scaling:'physicalAttack',coefficient:4.2,hitCount:3,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:20000,compatibleWeaponFamilies:['hammer'],auto:{canAutoUse:true,reserveForEliteBoss:true}},
  powerShot:{id:'powerShot',name:'Power Shot',kind:'weapon',targeting:'target',range:260,scaling:'physicalAttack',coefficient:1.75,hitCount:1,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:4000,compatibleWeaponFamilies:['bow'],auto:{canAutoUse:true,preferredRange:180}},
  piercingVolley:{id:'piercingVolley',name:'Piercing Volley',kind:'weapon',targeting:'targetArea',range:280,radius:95,scaling:'physicalAttack',coefficient:2.35,hitCount:3,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:7000,compatibleWeaponFamilies:['bow'],auto:{canAutoUse:true,minimumEnemyCount:2,preferredRange:190}},
  skyfallBarrage:{id:'skyfallBarrage',name:'Skyfall Barrage',kind:'weapon',targeting:'groundArea',range:300,radius:140,scaling:'physicalAttack',coefficient:3.9,hitCount:7,defenseType:'def',canCrit:true,accuracy:'normal',element:'physical',cooldownMs:19000,compatibleWeaponFamilies:['bow'],auto:{canAutoUse:true,reserveForEliteBoss:true,minimumExpectedTargets:2}},
  arcBolt:{id:'arcBolt',name:'Arc Bolt',kind:'weapon',targeting:'target',range:240,scaling:'magicalAttack',coefficient:1.65,hitCount:1,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'lightning',cooldownMs:3500,compatibleWeaponFamilies:['staff'],auto:{canAutoUse:true,preferredRange:170}},
  arcCascade:{id:'arcCascade',name:'Arc Cascade',kind:'weapon',targeting:'targetArea',range:250,radius:110,scaling:'magicalAttack',coefficient:2.3,hitCount:4,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'lightning',cooldownMs:7000,compatibleWeaponFamilies:['staff'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  astralVolley:{id:'astralVolley',name:'Astral Volley',kind:'weapon',targeting:'groundArea',range:280,radius:135,scaling:'magicalAttack',coefficient:3.85,hitCount:6,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'neutral',cooldownMs:18000,compatibleWeaponFamilies:['staff'],auto:{canAutoUse:true,reserveForEliteBoss:true,minimumExpectedTargets:2}},
  radiantBurst:{id:'radiantBurst',name:'Radiant Burst',kind:'weapon',targeting:'targetArea',range:220,radius:80,scaling:'magicalAttack',coefficient:1.6,hitCount:1,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'neutral',cooldownMs:4000,compatibleWeaponFamilies:['swordShield'],auto:{canAutoUse:true}},
  gravityPulse:{id:'gravityPulse',name:'Gravity Pulse',kind:'weapon',targeting:'selfArea',radius:115,scaling:'magicalAttack',coefficient:2.25,hitCount:2,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'neutral',cooldownMs:7500,compatibleWeaponFamilies:['swordShield'],auto:{canAutoUse:true,minimumEnemyCount:2}},
  astralDominion:{id:'astralDominion',name:'Astral Dominion',kind:'weapon',targeting:'selfArea',radius:145,scaling:'magicalAttack',coefficient:3.95,hitCount:5,defenseType:'mdef',canCrit:true,accuracy:'normal',element:'neutral',cooldownMs:19000,compatibleWeaponFamilies:['swordShield'],auto:{canAutoUse:true,reserveForEliteBoss:true}},
};
