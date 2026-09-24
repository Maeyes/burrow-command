import type {GroundScene,Rect} from '../../world-renderer/ground';
import {FOREST1_PROCEDURAL} from './forest1Procedural';

function pathToRects(points:{x:number;y:number}[],width:number):Rect[]{
 const out:Rect[]=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1];
  const distance=Math.hypot(b.x-a.x,b.y-a.y);
  const steps=Math.max(1,Math.ceil(distance/Math.max(24,width*.5)));
  for(let j=0;j<=steps;j++){
   const t=j/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
   out.push({x0:x-width/2,x1:x+width/2,y0:y-width/2,y1:y+width/2});
  }
 }
 return out;
}
export const FOREST1_GROUND_SCENE:GroundScene={
 paths:FOREST1_PROCEDURAL.paths.flatMap(p=>pathToRects(p.points,p.width)),
 plateaus:[],
 plateauHeight:56,
 forestCenter:{x:0,y:100},
 forestRadius:{x:1150,y:1150},
};
