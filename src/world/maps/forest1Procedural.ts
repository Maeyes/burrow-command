import type { ProceduralMapGeometry,WorldRect } from '../../world-renderer/mapGeometry';

export interface ForestPath {points:{x:number;y:number}[];width:number}
export interface Forest1ProceduralMap {id:'forest1';seed:number;geometry:ProceduralMapGeometry;paths:ForestPath[];spawn:{x:number;y:number};eventSocket:{x:number;y:number}}

const bounds:WorldRect={x:-1200,y:-1200,width:2400,height:2400};

export const FOREST1_PROCEDURAL:Forest1ProceduralMap={
 id:'forest1',
 seed:1101,
 geometry:{bounds,plateaus:[],structures:[],obstacles:[]},
 paths:[
  {width:70,points:[{x:-210,y:1120},{x:-180,y:760},{x:-40,y:520},{x:30,y:270},{x:-80,y:80},{x:-15,y:-125},{x:10,y:-335}]},
  {width:64,points:[{x:22,y:275},{x:260,y:310},{x:520,y:360},{x:900,y:380}]},
 ],
 spawn:{x:0,y:760},
 eventSocket:{x:0,y:0},
};
