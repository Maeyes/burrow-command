import json,sys
sys.path.insert(0,__import__('os').path.dirname(__file__))
from gen import build,N
def L1(name,biome,seed,props,fixed=(),liquid=1,road=2,ring=0,groves=(),monsters=14,pool=True,extraHill=None):
    hills=[(42,38,38,1),(36,30,22,2),(126,36,24,1),(125,135,18,1)]
    if extraHill: hills.append(extraHill)
    return dict(name=name,biome=biome,seed=seed,hills=hills,
      rivers=[([(48,12),(52,40),(60,62),(78,80),(96,86),(118,100),(140,104),(159,118)],10),([(128,26),(132,60),(122,98)],6)],
      pools=[(72,76,12)] if pool else [],ring=ring,liquid=liquid,road=road,
      trails=[[(25,150),(25,8)],[(25,90),(112,90),(112,40)],[(25,135),(125,135)]],
      bridges=[(94,110,88,92)],groves=list(groves),props=props,fixed=list(fixed),monsters=monsters,
      spawn={'x':15,'y':33.75})
def transpose(m):
    for k in ('level','water','road','forest','bridge'):
        s=m[k];m[k]=''.join(s[i*N+j] for j in range(N) for i in range(N))
    for o in m['objects']: o['x'],o['y']=o['y'],o['x']
    m['spawn']={'x':m['spawn']['y'],'y':m['spawn']['x']};return m
out=sys.argv[1]
maps={
 'snow2':(L1('snow2','snow',211,[('rock',22),('tree',26),('lantern',6)],groves=[(140,60,10),(60,150,9)]),False),
 'underwater1':(L1('underwater1','underwater',307,[('rock',26),('bush',30),('tree',12)],groves=[(145,70,10),(95,150,10)],fixed=[{'type':'altar','x':8.5,'y':7.5}]),True),
 'underwater2':(L1('underwater2','underwater',419,[('rock',16),('bush',18),('pillar',14)],fixed=[{'type':'altar','x':8.5,'y':7.5},{'type':'pillar','x':6.5,'y':6},{'type':'pillar','x':10.5,'y':6},{'type':'pillar','x':6.5,'y':9.5},{'type':'pillar','x':10.5,'y':9.5},{'type':'portal','x':31,'y':8.5,'id':'atlantis-gate'}]),False),
 'asgard1':(L1('asgard1','asgard',523,[('rock',14),('tree',18),('pillar',8),('lantern',8)],ring=6,groves=[(140,65,9)]),True),
 'asgard2':(L1('asgard2','asgard',631,[('pillar',20),('lantern',12),('rock',10)],road=1,fixed=[{'type':'altar','x':8.5,'y':7.5},{'type':'house','x':31,'y':8.5,'roof':'slate','floors':2},{'type':'portal','x':31,'y':34,'id':'bifrost'}]),False),
}
for name,(cfg,tr) in maps.items():
    m=build(cfg)
    if tr: m=transpose(m)
    json.dump(m,open(f'{out}/{name}.json','w'),separators=(',',':'))
    print('wrote',name)
