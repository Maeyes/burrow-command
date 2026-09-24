const MAP_MODULES=import.meta.glob('../maps/*.json',{eager:true,import:'default'});
const mapByName=new Map(Object.entries(MAP_MODULES).map(([path,data])=>[data?.name||path.split('/').pop().replace(/\.json$/,''),data]));

export function mapDataByName(name){return mapByName.get(String(name||''))||null;}
export function availableZoneNames(){return [...mapByName.keys()].sort();}

function portalRadiusWorld(portal){return Math.max(34,Number(portal?.radius??portal?.r??52));}
export function findPortal(scene,id){return (scene?.portals||[]).find(p=>p.id===id)||null;}
export function activePortalAt(scene,player){
  if(!scene||!player)return null;
  let best=null,bestD=Infinity;
  for(const p of scene.portals||[]){
    if(!p.id||!p.to||!p.toPortal)continue;
    const d=Math.hypot(player.x-p.x,player.y-p.y);
    if(d<=portalRadiusWorld(p)&&d<bestD){best=p;bestD=d;}
  }
  return best;
}

/**
 * Single client/server seam for every zone transfer.
 * A future server implementation can replace this function without changing callers.
 */
export async function requestZoneTransfer({fromMap,portalId,scene,player}){
  const portal=findPortal(scene,portalId);
  if(!portal||!portal.to||!portal.toPortal)return{denied:true,reason:'Portal is not configured'};
  if(!player||Math.hypot(player.x-portal.x,player.y-portal.y)>portalRadiusWorld(portal))return{denied:true,reason:'Player is not standing in the portal'};
  const targetData=mapDataByName(portal.to);
  if(!targetData)return{denied:true,reason:`Target map "${portal.to}" does not exist`};
  const targetPortal=(targetData.objects||[]).find(o=>o.type==='portal'&&o.id===portal.toPortal);
  if(!targetPortal)return{denied:true,reason:`Target portal "${portal.toPortal}" does not exist in ${portal.to}`};
  return{map:portal.to,spawn:{x:targetPortal.x*64,y:targetPortal.y*64,portalId:targetPortal.id},fromMap,portalId};
}
