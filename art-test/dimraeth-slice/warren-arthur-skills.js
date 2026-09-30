// Two fast Excalibur casts between Arthur's area attacks.
export const ARTHUR_SKILL_ROTATION=Object.freeze([
 Object.freeze({id:'excalibur',label:'EXCALIBUR',delay:.48,cooldown:1.8,radius:72}),
 Object.freeze({id:'excalibur',label:'EXCALIBUR',delay:.48,cooldown:1.8,radius:72}),
 Object.freeze({id:'bowlingBash',label:'BOWLING BASH',delay:.42,cooldown:2.3,radius:170}),
 Object.freeze({id:'knights',label:'KNIGHTS OF THE ROUND',delay:.7,cooldown:3.2,radius:115}),
]);
export const arthurSkillAt=index=>ARTHUR_SKILL_ROTATION[index%ARTHUR_SKILL_ROTATION.length];
