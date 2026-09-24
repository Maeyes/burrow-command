export interface IsoProjectionConfig { isoX:number; isoY:number; screenX:number; screenY:number; cameraX:number; cameraY:number }
export function worldToIsoScreen(x:number,y:number,z:number,c:IsoProjectionConfig){
 const dx=x-c.cameraX,dy=y-c.cameraY;
 return {x:Math.round(c.screenX+(dx-dy)*c.isoX),y:Math.round(c.screenY+(dx+dy)*c.isoY-z)};
}
export function isoScreenToWorld(sx:number,sy:number,c:IsoProjectionConfig){
 const x=sx-c.screenX,y=sy-c.screenY;
 const dx=x/2/c.isoX+y/2/c.isoY,dy=y/2/c.isoY-x/2/c.isoX;
 return {x:c.cameraX+dx,y:c.cameraY+dy};
}
