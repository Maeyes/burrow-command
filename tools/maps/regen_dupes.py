# Rebuild the two maps that were byte-for-byte copies of another map (magma1 = snow1, desert2 = mine).
import json,sys,os
sys.path.insert(0,os.path.dirname(__file__))
from gen import build
from make import L2,transpose
out=sys.argv[1]
maps={
 'magma1':(L2('magma1','magma',733,[('rock',24),('lantern',10),('bush',10)]),False),
 'desert2':(L2('desert2','desert',839,[('rock',20),('tree',14),('pillar',4)],fixed=[{'type':'altar','x':19,'y':10}]),True),
}
for name,(cfg,tr) in maps.items():
    m=build(cfg)
    if tr: m=transpose(m)
    if name=='desert2': m['roster']='desert'
    json.dump(m,open(f'{out}/{name}.json','w'),separators=(',',':'));print('rebuilt',name)
