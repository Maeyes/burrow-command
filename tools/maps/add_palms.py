# Plant palms along the shores of a map's water (oases, rivers): land cells 2-5 cells from water, off roads.
import json,sys,math,random
N=160
def plant(path,count,seed):
    d=json.load(open(path));W=d['water'];R=d['road'];L=d['level'];B=d.get('bridge','0'*N*N)
    wet=[k for k in range(N*N) if W[k]!='0']
    dist=[99]*(N*N)
    from collections import deque
    q=deque(wet)
    for k in wet: dist[k]=0
    while q:
        k=q.popleft();i,j=k%N,k//N
        for a,b in((i+1,j),(i-1,j),(i,j+1),(i,j-1)):
            if 0<=a<N and 0<=b<N and dist[b*N+a]>dist[k]+1: dist[b*N+a]=dist[k]+1;q.append(b*N+a)
    rnd=random.Random(seed);cand=[k for k in range(N*N) if 2<=dist[k]<=5 and R[k]=='0' and B[k]=='0' and 6<k%N<N-6 and 6<k//N<N-6]
    rnd.shuffle(cand);objs=d['objects'];added=0
    for k in cand:
        x,y=round((k%N+.5)/4,2),round((k//N+.5)/4,2)
        # same level as the nearest water so palms stand on the shore, not on a cliff top
        if all(math.hypot(o['x']-x,o['y']-y)>(2.2 if o['type']=='palm' else 1.2) for o in objs):
            objs.append({'type':'palm','x':x,'y':y});added+=1
            if added>=count: break
    json.dump(d,open(path,'w'),separators=(',',':'));print(path.split('/')[-1],'palms +',added)
for name,n,s in[('desert1',18,11),('desert2',18,22)]: plant(f'../../art-test/dimraeth-slice/maps/{name}.json',n,s)
