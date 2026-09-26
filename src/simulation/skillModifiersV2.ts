export interface SkillModifierDefinitionV2 {id:string;name:string;description:string;}
export const SKILL_MODIFIERS_V2:Record<string,SkillModifierDefinitionV2>={
 lifeDrain:{id:'lifeDrain',name:'Life Drain',description:'Heal for 12% of damage dealt by this Skill Core. Barrier: when it breaks, heal 30% of the Barrier size.'},
 lingering:{id:'lingering',name:'Lingering',description:'Skill Core deals +20% total damage. Barrier / Healing Pulse: +20% shield or heal. Valkyrie’s Call: +20% duration.'},
 expandedArea:{id:'expandedArea',name:'Expanded Area',description:'Increase AoE radius by 25%. Barrier / Valkyrie’s Call: +25% duration.'},
 execution:{id:'execution',name:'Execution',description:'Deal +40% damage to enemies below 35% HP. Barrier / Healing Pulse: +40% shield or heal when cast below 35% HP.'},
 rapidCasting:{id:'rapidCasting',name:'Rapid Casting',description:'Reduce Skill Core cooldown by 20%.'},
 mobileCast:{id:'mobileCast',name:'Mobile Cast',description:'Increase cast range by 20% (AoE radius unchanged).'},
 combustion:{id:'combustion',name:'Combustion',description:'Fire Skill Cores deal +30% damage.'},
 echo:{id:'echo',name:'Echo',description:'30% chance for each hit to echo for 50% bonus damage. Rolls separately from Extra Strike. Barrier / Healing Pulse: 30% chance for a 50% bigger shield or heal.'},
 overcharge:{id:'overcharge',name:'Overcharge',description:'Lightning Skill Cores deal +30% damage.'},
 chain:{id:'chain',name:'Chain',description:'Increase AoE radius by 20% and total damage by 10%.'},
 extraStrike:{id:'extraStrike',name:'Extra Strike',description:'Each Skill Core hit has 30% chance to strike again for 50% damage. Rolls separately from Echo.'},
 bloodPrice:{id:'bloodPrice',name:'Blood Price',description:'Skill Core deals +40% damage (Barrier / Healing Pulse: +40% shield or heal), but each cast costs 3% Max HP (never lethal).'},
 concentratedForce:{id:'concentratedForce',name:'Concentrated Force',description:'Single-target Skill Cores deal +35% damage.'},
};
export const skillModifierDefinitions=(ids:readonly string[])=>ids.map(id=>SKILL_MODIFIERS_V2[id]).filter((x):x is SkillModifierDefinitionV2=>Boolean(x));

export function skillModifierCount(ids:readonly string[]|undefined,id:string){
 return (ids??[]).reduce((n,x)=>n+(x===id?1:0),0);
}

/**
 * Duplicate Skill Mods scale the first copy multiplicatively instead of adding another full copy.
 * Example: 20% + duplicate 20% => 20% * 1.20 = 24%.
 */
export function stackedSkillModifierFraction(ids:readonly string[]|undefined,id:string,baseFraction:number){
 const count=skillModifierCount(ids,id);
 if(count<=0)return 0;
 let value=baseFraction;
 for(let i=1;i<count;i++)value*=1+baseFraction;
 return value;
}
