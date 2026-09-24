export const BAYER_4X4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5] as const;
export function hash2(x:number,y:number){const n=Math.sin(x*127.1+y*311.7)*43758.5453123;return n-Math.floor(n)}
export function valueNoise(x:number,y:number){const xi=Math.floor(x),yi=Math.floor(y),tx=x-xi,ty=y-yi,s=(t:number)=>t*t*(3-2*t);const a=hash2(xi,yi),b=hash2(xi+1,yi),c=hash2(xi,yi+1),d=hash2(xi+1,yi+1);return (a+(b-a)*s(tx))+((c+(d-c)*s(tx))-(a+(b-a)*s(tx)))*s(ty)}
export function fbm(x:number,y:number,octaves=4){let v=0,a=.5,f=1,total=0;for(let i=0;i<octaves;i++){v+=valueNoise(x*f,y*f)*a;total+=a;a*=.5;f*=2}return v/total}
export function bayerLevel(x:number,y:number,value:number,levels:number){const threshold=(BAYER_4X4[(y&3)*4+(x&3)]+.5)/16;return Math.max(0,Math.min(levels-1,Math.floor(value*(levels-1)+threshold)))}
