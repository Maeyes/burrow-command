// Native Map Editor road masks for Home Builder paths. Each Home Builder
// 64-unit grid tile maps to a 4x4 block of the editor's 16-unit ground cells.
// Placed objects and their original receipts/IDs remain in save data: only
// their visual representation changes from floating decals to baked terrain.
export const HOME_NATIVE_PATHS=Object.freeze({dirtPath:2,stonePath:1});
export const isHomeNativePath=prefab=>Object.hasOwn(HOME_NATIVE_PATHS,prefab);
export function applyHomeNativePathsToArrays({road,water},placedObjects=[],n=160){
 const stamped=new Set();
 for(const path of placedObjects||[]){
  const material=HOME_NATIVE_PATHS[path?.prefab];
  if(!material||!Number.isFinite(path.x)||!Number.isFinite(path.y))continue;
  const i=Math.round(path.x/64),j=Math.round(path.y/64);
  const token=i+','+j;
  if(stamped.has(token))continue;
  stamped.add(token);
  // Native editor maps path cells as road=1 stone, road=2 dirt.
  // Keep existing water a higher-priority terrain layer.
  for(let y=j*4-2;y<=j*4+1;y++)for(let x=i*4-2;x<=i*4+1;x++){
   if(x<0||y<0||x>=n||y>=n)continue;
   const k=y*n+x;
   if(!water?.[k])road[k]=material;
  }
 }
 return road;
}
