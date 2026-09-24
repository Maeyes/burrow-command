# 1) connect raised ground to the main walkable area with straight dirt trails (the engine turns a road that
#    crosses a level edge into a ramp/stair), 2) chain the maps together with configured portals.
import json,sys,os,math
from collections import deque
sys.path.insert(0,os.path.dirname(__file__))
N=160;LEVEL_H=44
STEP={'ramp':4.5,'stone':7,'wood':7}
STYLE={'mine':'wood','city':'stone','asgard':'stone'}
def load(p): return json.load(open(p))
def comps(d):
    lv=[int(c) for c in d['level']];w=[c!='0' for c in d['water']];br=[c!='0' for c in d.get('bridge','0'*N*N)]
    rd=[c!='0' for c in d['road']];F=d['forest']
    fight=[(not w[k] or br[k]) and F[k] not in '34' for k in range(N*N)]
    lab=[-1]*(N*N);sizes=[]
    for s in range(N*N):
        if not fight[s] or lab[s]>=0: continue
        c=len(sizes);lab[s]=c;q=deque([s]);n=0
        while q:
            k=q.popleft();n+=1;i,j=k%N,k//N
            for a,b in((i+1,j),(i-1,j),(i,j+1),(i,j-1)):
                if 0<=a<N and 0<=b<N:
                    m=b*N+a
                    if lab[m]<0 and fight[m] and (lv[m]==lv[k] or (rd[m] and rd[k])): lab[m]=c;q.append(m)
        sizes.append(n)
    return lv,w,rd,fight,lab,sizes
def add_trails(d,log):
    style=d.get('slopeStyle') if d.get('slopeStyle') not in (None,'auto') else STYLE.get(d['biome'],'ramp')
    added=0
    for _ in range(12):
        lv,w,rd,fight,lab,sizes=comps(d)
        main=max(range(len(sizes)),key=lambda c:sizes[c])
        todo=sorted([c for c in range(len(sizes)) if c!=main and sizes[c]>=60],key=lambda c:-sizes[c])
        if not todo: break
        best=None
        for c in todo:
            cells=[k for k in range(N*N) if lab[k]==c]
            for k in cells[::3]:
                i,j=k%N,k//N
                for di,dj in((1,0),(0,1),(-1,0),(0,-1)):   # +x/+y first: risers face the camera
                    si,sj=(0,1) if di else (1,0)
                    # walk inside the component to its edge
                    t=0
                    while True:
                        a,b=i+di*(t+1),j+dj*(t+1)
                        if not(0<=a<N and 0<=b<N): t=None;break
                        if lab[b*N+a]!=c: break
                        t+=1
                    if t is None or t<2: continue
                    ei,ej=i+di*t,j+dj*t;hi=lv[ej*N+ei]
                    li,lj=ei+di,ej+dj;lo_k=lj*N+li
                    if not(0<=li<N and 0<=lj<N) or lv[lo_k]>=hi or w[lo_k]: continue
                    L=math.ceil((hi-lv[lo_k])*LEVEL_H/STEP[style])+4
                    ok=True;run=[]
                    for s in range(-3,L):           # 3 cells up top + ramp run below, 3 wide
                        for o in(-1,0,1):
                            a,b=ei+di*(s+1)+si*o,ej+dj*(s+1)+sj*o
                            if not(0<=a<N and 0<=b<N): ok=False;break
                            m=b*N+a
                            if w[m]: ok=False;break
                            if s>=0 and lv[m]!=lv[lo_k]: ok=False;break
                            if s<0 and lv[m]!=hi: ok=False;break
                            run.append(m)
                        if not ok: break
                    if not ok: continue
                    end=(ej+dj*L)*N+(ei+di*L)
                    if lab[end]!=main and sizes[lab[end]] if lab[end]>=0 else True: 
                        if lab[end]<0 or sizes[lab[end]]<sizes[c]: continue
                    score=(c,0 if di+dj>0 else 1,t)
                    if best is None or score<best[0]: best=(score,run,c)
            if best: break
        if not best:
            log.append(f"  no straight trail found for {len(todo)} raised area(s)");break
        r=list(d['road']);[r.__setitem__(m,'2' if r[m]=='0' else r[m]) for m in best[1]];d['road']=''.join(r)
        # keep objects off the new trail
        cells=set(best[1]);d['objects']=[o for o in d['objects'] if o['type'] in('portal','monster','house','altar') or int(o['y']*4)*N+int(o['x']*4) not in cells]
        added+=1
    return added
def free_tile(d,lab,main,tx,ty):
    best=None
    for r in range(0,60):
        for a in range(-r,r+1):
            for b in (-r,r) if abs(a)!=r else range(-r,r+1):
                x,y=tx+a*.5,ty+b*.5
                if not(2<=x<38 and 2<=y<38): continue
                ok=all(0<=int(y*4)+q<N and 0<=int(x*4)+p<N and lab[(int(y*4)+q)*N+int(x*4)+p]==main and d['road'][(int(y*4)+q)*N+int(x*4)+p]=='0' for p in range(-3,4) for q in range(-3,4))
                if ok and all(math.hypot(o['x']-x,o['y']-y)>2 for o in d['objects']): return round(x,2),round(y,2)
    return None
def main():
    folder=sys.argv[1];chain=sys.argv[2].split(',')
    for idx,name in enumerate(chain):
        p=f'{folder}/{name}.json';d=load(p);log=[]
        before=comps(d);s0=max(before[5])
        n=add_trails(d,log)
        lv,w,rd,fight,lab,sizes=comps(d);mc=max(range(len(sizes)),key=lambda c:sizes[c])
        # portals: drop unconfigured ones, then add prev/next gates
        d['objects']=[o for o in d['objects'] if not(o['type']=='portal' and not o.get('to'))]
        d['objects']=[o for o in d['objects'] if not(o['type']=='portal' and str(o.get('id','')).startswith('to-'))]
        sp=d.get('spawn',{'x':20,'y':20})
        if idx>0:
            t=free_tile(d,lab,mc,sp['x']+3,sp['y']);d['objects'].append({'type':'portal','x':t[0],'y':t[1],'id':f'to-{chain[idx-1]}','to':chain[idx-1],'toPortal':f'to-{name}'})
        if idx<len(chain)-1:
            t=free_tile(d,lab,mc,32,32);d['objects'].append({'type':'portal','x':t[0],'y':t[1],'id':f'to-{chain[idx+1]}','to':chain[idx+1],'toPortal':f'to-{name}'})
        json.dump(d,open(p,'w'),separators=(',',':'))
        print(f"{name}: +{n} trails, walkable {round(s0/N/N*100,1)}% -> {round(max(sizes)/N/N*100,1)}%",*log)
if __name__=='__main__': main()
