export type RGB=readonly [number,number,number];
export function hexRgb(hex:string):RGB{const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
export const FOREST_PALETTE={
 grass:['#28441d','#365e22','#4a7a2a','#639631','#83b03d','#a6c950'].map(hexRgb),
 dirt:['#46301f','#634329','#80593a','#9e7550','#bd9669'].map(hexRgb),
 cobble:['#3a3834','#58544c','#767064','#948c7d','#b2a998'].map(hexRgb),
 mortar:hexRgb('#2b2926'),
 cliff:['#25242b','#35343d','#47454f','#5c5a63','#77747b','#908c90'].map(hexRgb),
 bush:['#172f1b','#244a25','#35662f','#4d853a','#6ea647','#98c65a'].map(hexRgb),
} as const;
export function clampLevel(n:number,max:number){return Math.max(0,Math.min(max,n))}
