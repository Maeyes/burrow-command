// Whispering Forest I: Bunny World's first leveling field, authored on the shared map engine.
import { T, smooth, inRect } from '../engine/util.js';
import { SLATE } from '../engine/palettes.js';

const R4 = (x0, x1, y0, y1, extra = {}) => ({ x0: x0 * T, x1: x1 * T, y0: y0 * T, y1: y1 * T, ...extra });
const P = (x, y, extra = {}) => ({ x: x * T, y: y * T, ...extra });

export default function forestScene() {
  // Production field layout: broad combat ground first, scenery second.
  // Elevated terrain hugs the north/west perimeter instead of cutting the field into corridors.
  // Forest II-inspired landscape language: water is a major composition element, while
  // the raised land stays around the perimeter so the interior remains a combat field.
  const northRidge=(x,y)=>y < 8.6*T + Math.sin(x*.0045)*38;
  const westRidge=(x,y)=>x < 4.2*T + Math.sin(y*.004)*30 && y < 26*T;
  const waterfallHill=(x,y)=>x>25*T&&x<36*T&&y<10*T+Math.sin(x*.006)*24;
  // Local stepped hills create 2–3-tier landmarks without turning the whole field into corridors.
  const hillTier=(x,y)=>{
    const tx=x/T,ty=y/T;
    const d1=((tx-8.5)/5.2)**2+((ty-12.5)/4.6)**2;
    const d2=((tx-27)/4.6)**2+((ty-32.5)/4.0)**2;
    const d=Math.min(d1,d2);
    return d<.18?96:d<.48?64:d<1?32:0;
  };
  return {
    id: 'forest1', title: 'WHISPERING FOREST I',
    terrain: {
      height:(x,y)=>Math.max(northRidge(x,y)||westRidge(x,y)||waterfallHill(x,y)?48:0,hillTier(x,y)),
      // Overlook access is optional; the main leveling loop stays on the broad low field.
      stairs:[
        {x0:9.5*T,x1:11*T,y0:3.5*T,y1:3.5*T+6*16,dir:'-y',from:0,to:48},
        // West stepped hill: every tier has an explicit route up.
        {x0:11.4*T,x1:12.6*T,y0:12.0*T,y1:13.5*T,dir:'-x',from:0,to:32},
        {x0:9.9*T,x1:11.1*T,y0:11.5*T,y1:13.0*T,dir:'-x',from:32,to:64},
        {x0:8.3*T,x1:9.5*T,y0:11.0*T,y1:12.5*T,dir:'-x',from:64,to:96},
        // South-east stepped hill: same rule — visible hill means reachable hill.
        {x0:29.8*T,x1:31.0*T,y0:32.0*T,y1:33.5*T,dir:'-x',from:0,to:32},
        {x0:28.5*T,x1:29.7*T,y0:31.5*T,y1:33.0*T,dir:'-x',from:32,to:64},
        {x0:27.0*T,x1:28.2*T,y0:31.0*T,y1:32.5*T,dir:'-x',from:64,to:96},
      ],
      // Forest II is the water-composition reference: a broad headwater falls from the hill,
      // opens into a visible lowland pool, then narrows into an east-side river. Water is
      // prominent without splitting the central combat field into tiny islands.
      rivers:[
        {pts:[[30*T,-5*T],[30*T,3*T],[29.5*T,7*T],[30*T,10*T],[31*T,13*T],[32*T,16*T]],width:[72,104],depth:12},
        {pts:[[32*T,16*T],[34*T,19*T],[35*T,24*T],[34*T,29*T],[35*T,35*T],[34*T,42*T],[35*T,46*T]],width:[66,92],depth:10},
        // Smaller edge streams make water visible from several parts of the field without
        // cutting through the main combat pockets.
        {pts:[[-4*T,31*T],[2*T,30*T],[5*T,32*T],[8*T,36*T],[10*T,44*T]],width:[38,54],depth:8},
        {pts:[[12*T,-4*T],[13*T,2*T],[16*T,4*T],[20*T,5*T]],width:[34,48],depth:8},
        {pts:[[42*T,8*T],[38*T,10*T],[37*T,14*T],[39*T,18*T],[43*T,20*T]],width:[36,50],depth:8},
      ],
      waterMask:(x,y)=>{
        const dx=(x/T-31.5)/4.2,dy=(y/T-17.2)/3.0;
        return dx*dx+dy*dy<1;
      },
      waterDepth:12,
    },
    // Forest I uses worn earth/grass trails rather than constructed stone roads.
    paved: [],
    // Forest I is an adventure field, not a farm/home scene. Keep authored landmarks sparse.
    buildings: [],
    plots: [],
    camps: [P(11.5, 29.5)],
    yards: [],
    crates: [],
    logs: [{ x: 11.5*T-62, y:29.5*T-28, w:52,d:15,h:10 }],
    lanterns: [P(11.2,28.6),P(27.5,12.5),P(29.5,31)],
    // Central-south arrival opens into several large combat pockets.
    spawn: P(20, 31),
    gameplay: {
      mapId:'forest1',
      fieldPopulation:36,
      bossId:'mushroom',
      // Keep the authoritative onboarding distribution aligned with the Arena simulation.
      spawnPool:['mossblob1','mossblob1','mossblob1','mossblob3','mossblob3','sporekin1','sporekin1','sporekin3','mossblob2','sporekin2'],
      spawnMargin:90,
      minHeroDistance:90,
    },
    // Dense-looking perimeter + lighter interior keeps ~70–80% of the field traversable.
    baseDensity: (x,y) => {
      const edge=Math.min(x,y,40*T-x,40*T-y);
      const edgeForest=1-smooth(1.5*T,7*T,edge);
      const pocketNoise=.10*Math.sin(x*.006)*Math.sin(y*.005);
      return .24+edgeForest*.52+pocketNoise;
    },
    densNoise: .28,
    scatter: { trees:.72, treeStep:104, treeStepY:88, undergrowth:.42, bushStep:50, bushStepY:44 },
    worn: 1,
    cliffStyle: 'natural', // forest escarpment: earth + boulders, no masonry
  };
}
