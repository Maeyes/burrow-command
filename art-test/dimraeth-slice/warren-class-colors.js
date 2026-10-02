// Every class shares the Blessed Bunny sprite; recolor its magenta scarf/trim per class so
// squads read at a glance. Only saturated, bright magenta pixels below the ears are shifted
// (white fur, pink inner ears and dark outlines stay untouched).
export const CLASS_HUES={guard:215,archer:120,scout:48,brute:28,axe:0,vanguard:272,mage:185};
export const EAR_CUTOFF=0.42; // fraction of the sprite's opaque height treated as ears/head top

const rgbToHsv=(r,g,b)=>{
 const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;
 if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
 return [h,max?d/max:0,max/255];
};
const hsvToRgb=(h,s,v)=>{
 const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
 const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];
};
export const isTrimPixel=(r,g,b)=>{const [h,s,v]=rgbToHsv(r,g,b);return s>=0.5&&v>=0.5&&(h>=300||h<10);};

// Recolors an RGBA buffer in place. Pure so it can be unit tested without a canvas.
export function recolorPixels(data,width,height,hue){
 let top=height,bot=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){if(y<top)top=y;bot=y;}
 if(bot<0)return data;
 const span=bot-top+1;
 for(let y=0;y<height;y++){
  if((y-top)/span<EAR_CUTOFF)continue;
  for(let x=0;x<width;x++){
   const i=(y*width+x)*4;if(!data[i+3])continue;
   const r=data[i],g=data[i+1],b=data[i+2];
   if(!isTrimPixel(r,g,b))continue;
   const [,s,v]=rgbToHsv(r,g,b);[data[i],data[i+1],data[i+2]]=hsvToRgb(hue,s,v);
  }
 }
 return data;
}

// Aura cloak: a soft glow in the class colour hugging the body below the ears, like a cape of light.
// Aura grows with bunny level: faint at Lv1, bright and wide by Lv20+.
export const AURA_TIERS=[{min:1,reach:2.5,alpha:.45},{min:5,reach:3.2,alpha:.7},{min:10,reach:4,alpha:1},{min:20,reach:5,alpha:1.25}];
export const auraTier=level=>{let t=0;AURA_TIERS.forEach((x,i)=>{if((level||1)>=x.min)t=i;});return t;};
export function auraPixels(data,width,height,hue,tier=2){
 const {reach:maxReach,alpha}=AURA_TIERS[tier]??AURA_TIERS[2];
 let top=height,bot=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){if(y<top)top=y;bot=y;}
 if(bot<0)return data;
 const span=bot-top+1,solid=new Uint8Array(width*height);
 for(let i=0;i<width*height;i++)solid[i]=data[i*4+3]>40?1:0;
 const [r,g,b]=hsvToRgb(hue,.75,1);
 for(let y=0;y<height;y++){
  const t=(y-top)/span;if(t<EAR_CUTOFF-.08||y>bot)continue;
  const fade=Math.min(1,(t-(EAR_CUTOFF-.08))/.15); // eases in at the shoulders
  const reach=1.5+(maxReach-1.5)*Math.min(1,Math.max(0,(t-EAR_CUTOFF)/(1-EAR_CUTOFF))); // flares toward the hem
  for(let x=0;x<width;x++){
   const i=y*width+x;if(solid[i])continue;
   let best=99;
   const R=Math.ceil(maxReach);
   for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=width||yy>=height||!solid[yy*width+xx])continue;
    const d=Math.hypot(dx,dy);if(d<best)best=d;
   }
   if(best>reach)continue;
   const a=Math.round(fade*210*alpha*(1-(best-1)/reach));if(a<=0)continue;
   data[i*4]=r;data[i*4+1]=g;data[i*4+2]=b;data[i*4+3]=Math.min(255,a);
  }
 }
 return data;
}

const caches=new Map();
export function classFrame(img,cls,level=1){
 const hue=CLASS_HUES[cls];if(hue==null||!img?.width)return img;
 const tier=auraTier(level),key=cls+':'+tier;
 let cache=caches.get(key);if(!cache){cache=new WeakMap();caches.set(key,cache);}
 let c=cache.get(img);
 if(!c){
  c=document.createElement('canvas');c.width=img.width;c.height=img.height;
  const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  const d=g.getImageData(0,0,c.width,c.height);recolorPixels(d.data,c.width,c.height,hue);auraPixels(d.data,c.width,c.height,hue,tier);g.putImageData(d,0,0);
  cache.set(img,c);
 }
 return c;
}

// Gear sparkles: twinkling stars around bunnies whose class wears Rare+ gear. Colour/count follow the best rarity.
export const SPARKLE_BY_RARITY={rare:{color:'#7fc4ff',count:2},epic:{color:'#d38cff',count:3},legend:{color:'#ffd65c',count:4},mythic:{color:'#ff6b6b',count:5},whiteAscended:{color:'#ffffff',count:6}};
const RANK=['normal','good','rare','epic','legend','mythic','whiteAscended'];
export const bestRarity=list=>list.reduce((best,r)=>RANK.indexOf(r)>RANK.indexOf(best)?r:best,'normal');
export function drawSparkles(g,x,y,rarity,seed,now,scale=1){
 const fx=SPARKLE_BY_RARITY[rarity];if(!fx)return;
 g.save();g.fillStyle=fx.color;g.shadowColor=fx.color;g.shadowBlur=6;
 for(let i=0;i<fx.count;i++){
  const p=((now/1600)+i/fx.count+seed*.137)%1;          // life 0..1, staggered
  const ang=seed*2.3+i*2.4;
  const sx=x+Math.cos(ang+p*1.5)*16*scale,sy=y-(14+p*40)*scale;  // drifts upward around the body
  const tw=Math.sin(p*Math.PI),r=(1.2+tw*2.3)*scale;
  g.globalAlpha=tw*.95;
  g.beginPath();g.moveTo(sx,sy-r*2);g.lineTo(sx+r*.45,sy-r*.45);g.lineTo(sx+r*2,sy);g.lineTo(sx+r*.45,sy+r*.45);
  g.lineTo(sx,sy+r*2);g.lineTo(sx-r*.45,sy+r*.45);g.lineTo(sx-r*2,sy);g.lineTo(sx-r*.45,sy-r*.45);g.closePath();g.fill();
 }
 g.restore();
}
