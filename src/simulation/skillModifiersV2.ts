export interface SkillModifierDefinitionV2 {id:string;name:string;description:string;}
export const SKILL_MODIFIERS_V2:Record<string,SkillModifierDefinitionV2>={
 lifeDrain:{id:'lifeDrain',name:'Life Drain',description:'Heal for 5% of damage dealt by this Skill Core.'},
 lingering:{id:'lingering',name:'Lingering',description:'Skill Core deals +20% total damage.'},
 expandedArea:{id:'expandedArea',name:'Expanded Area',description:'Increase AoE radius by 25%.'},
 execution:{id:'execution',name:'Execution',description:'Deal +25% damage to enemies below 30% HP.'},
 rapidCasting:{id:'rapidCasting',name:'Rapid Casting',description:'Reduce Skill Core cooldown by 20%.'},
 mobileCast:{id:'mobileCast',name:'Mobile Cast',description:'Increase cast range by 20% (AoE radius unchanged).'},
 combustion:{id:'combustion',name:'Combustion',description:'Fire Skill Cores deal +30% damage.'},
 echo:{id:'echo',name:'Echo',description:'20% chance for each hit to echo for 50% bonus damage.'},
 overcharge:{id:'overcharge',name:'Overcharge',description:'Lightning Skill Cores deal +30% damage.'},
 chain:{id:'chain',name:'Chain',description:'Increase AoE radius by 20% and total damage by 10%.'},
 extraStrike:{id:'extraStrike',name:'Extra Strike',description:'Each Skill Core hit has 20% chance to strike again for 50% damage.'},
 concentratedForce:{id:'concentratedForce',name:'Concentrated Force',description:'Single-target Skill Cores deal +35% damage.'},
};
export const skillModifierDefinitions=(ids:readonly string[])=>ids.map(id=>SKILL_MODIFIERS_V2[id]).filter((x):x is SkillModifierDefinitionV2=>Boolean(x));
