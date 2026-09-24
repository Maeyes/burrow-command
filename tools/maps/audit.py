import json,sys,glob,os
from collections import deque
N=160
def audit(path):
    d=json.load(open(path)); L=d['level'];W=d['water'];R=d['road'];F=d['forest'];B=d.get('bridge','0'*N*N)
    lv=[int(c) for c in L]; w=[c!='0' for c in W]; lava=W.count('2'); br=[c!='0' for c in B]
    land=[not w[k] or br[k] for k in range(N*N)]
    # waterfalls: water->water with level drop along any 4-dir
    falls=0; cliffs=0
    for j in range(N):
        for i in range(N):
            k=j*N+i
            for di,dj in((1,0),(0,1),(-1,0),(0,-1)):
                a,b=i+di,j+dj
                if 0<=a<N and 0<=b<N:
                    m=b*N+a
                    if lv[k]>lv[m]:
                        if w[k] and w[m]: falls+=1
                        elif not w[k]: cliffs+=1
    levels={x:lv.count(x) for x in set(lv)}
    dense=[F[k] in '34' for k in range(N*N)]
    fight=[land[k] and not dense[k] for k in range(N*N)]
    # connectivity: same level or road/stair between levels (diff 1)
    road=[c!='0' for c in R]
    seen=[False]*(N*N); best=0
    for s in range(N*N):
        if not fight[s] or seen[s]: continue
        q=deque([s]);seen[s]=True;cnt=0
        while q:
            k=q.popleft();cnt+=1;i,j=k%N,k//N
            for di,dj in((1,0),(0,1),(-1,0),(0,-1)):
                a,b=i+di,j+dj
                if 0<=a<N and 0<=b<N:
                    m=b*N+a
                    if seen[m] or not fight[m]:continue
                    if lv[m]==lv[k] or ((road[m] and road[k])):
                        seen[m]=True;q.append(m)
        best=max(best,cnt)
    objs={}
    for o in d.get('objects',[]): objs[o['type']]=objs.get(o['type'],0)+1
    tot=N*N
    return dict(name=d.get('name'),biome=d.get('biome'),roster=d.get('roster',''),levels=levels,water=round(sum(w)/tot*100,1),lava=lava,falls=falls,cliffEdges=cliffs,roadCells=sum(road),bridge=sum(br),dense=round(sum(dense)/tot*100,1),fight=round(sum(fight)/tot*100,1),fightConnected=round(best/tot*100,1),objs=objs,spawn=d.get('spawn'))
if __name__=='__main__':
    for p in sorted(glob.glob(sys.argv[1])):
        r=audit(p);print(os.path.basename(p),r)
