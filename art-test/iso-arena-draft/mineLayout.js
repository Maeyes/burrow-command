// Underground Mine visual/layout plan.
// Dungeon-only scene data. No combat FX, hero FX, balancing, or global-system changes.

export const MINE_PALETTE = {
  ground: '#242628',
  edge: '#111315',
  back: '#080a0b',
  patch: '#303235',
  patchHi: '#46494c',
  trail: '#40382f',
  trailHi: '#66503a',
  clearing: '#292b2d',
  landmark: '#322b24',
};

export const MINE_PROPS = [
  // Entrance / working mine
  {type:'mineWall',x:-610,y:-390,size:1.35,seed:301},
  {type:'mineWall',x:-330,y:-455,size:1.15,seed:302},
  {type:'mineRock',variant:'large',x:-530,y:-220,size:1.12,seed:303},
  {type:'mineCart',x:-315,y:-185,size:1.0,seed:304},
  {type:'timber',x:-455,y:-65,size:1.08,seed:305},
  {type:'torch',x:-590,y:-105,size:1.0,seed:306},
  {type:'torch',x:-275,y:-255,size:.95,seed:307},

  // Contested depths
  {type:'mineWall',x:390,y:-430,size:1.28,seed:311},
  {type:'mineRock',variant:'medium',x:500,y:-235,size:1.0,seed:312},
  {type:'timber',x:335,y:-115,size:1.15,seed:313},
  {type:'rail',x:110,y:-55,size:1.15,seed:314},
  {type:'rail',x:205,y:40,size:1.15,seed:315},
  {type:'torch',x:410,y:-180,size:1.0,seed:316},
  {type:'torch',x:145,y:25,size:.95,seed:317},

  // Abandoned deep mine
  {type:'mineWall',x:-610,y:330,size:1.34,seed:321},
  {type:'mineRock',variant:'large',x:-390,y:500,size:1.18,seed:322},
  {type:'brokenTimber',x:-235,y:335,size:1.05,seed:323},
  {type:'rail',x:-105,y:400,size:1.2,seed:324},
  {type:'mineCart',x:35,y:505,size:.95,seed:325},
  {type:'torch',x:-470,y:275,size:.9,seed:326,dim:true},

  // Leader chamber threshold / chamber framing
  {type:'mineWall',x:500,y:310,size:1.42,seed:331},
  {type:'mineWall',x:650,y:500,size:1.3,seed:332},
  {type:'timber',x:390,y:410,size:1.2,seed:333},
  {type:'mineRock',variant:'large',x:600,y:160,size:1.1,seed:334},
  {type:'torch',x:365,y:300,size:1.08,seed:335},
  {type:'torch',x:585,y:390,size:1.08,seed:336},
];

export const MINE_ZONES = [
  {id:'working-mine',label:'GOBLIN MINE',x:-395,y:-215,rx:220,ry:135,roster:['goblinWorker','goblinDigger','oreMole','emeraldMole']},
  {id:'contested-depths',label:'CONTESTED DEPTHS',x:235,y:-115,rx:230,ry:145,roster:['goblinDigger','skeletonWorker','ironMole','sapphireMole']},
  {id:'abandoned-deep-mine',label:'ABANDONED DEEP MINE',x:-230,y:380,rx:235,ry:145,roster:['skeletonDigger','skeletonMiner','rubyMole','goblinForeman']},
  {id:'leader-chamber',label:'GOBLIN LEADER CHAMBER',x:465,y:405,rx:220,ry:140,roster:[],boss:'goblinLeader'},
];

export const MINE_SPAWNS = [
  {zone:'working-mine',monster:'goblinWorker',x:-500,y:-240,ambient:'mining'},
  {zone:'working-mine',monster:'oreMole',x:-380,y:-145,ambient:'dig'},
  {zone:'working-mine',monster:'goblinDigger',x:-285,y:-285},
  {zone:'working-mine',monster:'emeraldMole',x:-455,y:-345,ambient:'carry'},

  {zone:'contested-depths',monster:'skeletonWorker',x:105,y:-145,ambient:'mining'},
  {zone:'contested-depths',monster:'goblinDigger',x:245,y:-225},
  {zone:'contested-depths',monster:'ironMole',x:350,y:-95},
  {zone:'contested-depths',monster:'sapphireMole',x:195,y:25},

  {zone:'abandoned-deep-mine',monster:'skeletonDigger',x:-365,y:330},
  {zone:'abandoned-deep-mine',monster:'rubyMole',x:-175,y:455},
  {zone:'abandoned-deep-mine',monster:'skeletonMiner',x:-290,y:520},
  {zone:'abandoned-deep-mine',monster:'goblinForeman',x:-65,y:330,ambient:'hammering'},

  {zone:'leader-chamber',monster:'goblinLeader',x:475,y:415,boss:true},
];
