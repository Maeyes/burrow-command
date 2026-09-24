export interface WorldRect {x:number;y:number;width:number;height:number;heightZ?:number;blocksMovement?:boolean}
export interface WorldCircle {x:number;y:number;radius:number;blocksMovement?:boolean}
export interface ProceduralMapGeometry {bounds:WorldRect;plateaus:WorldRect[];structures:WorldRect[];obstacles:(WorldRect|WorldCircle)[]}
export function pointInRect(x:number,y:number,r:WorldRect,margin=0){return x>=r.x-margin&&x<=r.x+r.width+margin&&y>=r.y-margin&&y<=r.y+r.height+margin}
export function pointBlockedByGeometry(x:number,y:number,map:ProceduralMapGeometry,margin=0){
 return [...map.structures,...map.obstacles].some(o=>'radius'in o?Math.hypot(x-o.x,y-o.y)<=o.radius+margin:pointInRect(x,y,o,margin));
}
export function canSpawnAt(x:number,y:number,map:ProceduralMapGeometry,margin=24){return pointInRect(x,y,map.bounds)&&!pointBlockedByGeometry(x,y,map,margin)}
