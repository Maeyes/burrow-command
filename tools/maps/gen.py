import json,math,random,sys
N=160
def blobmask(cx,cy,r,seed,amp=.2):
    rnd=random.Random(seed);ph=[rnd.random()*6.28 for _ in range(4)]
    def inside(i,j):
        a=math.atan2(j-cy,i-cx);d=math.hypot(i-cx,j-cy)
        rr=r*(1+amp*(.5*math.sin(2*a+ph[0])+.3*math.sin(3*a+ph[1])+.2*math.sin(5*a+ph[2])))
        return d<=rr
    return inside
def seg_cells(p,q,w):
    out=set();(x0,y0),(x1,y1)=p,q;L=max(1,int(math.hypot(x1-x0,y1-y0)*2))
    for t in range(L+1):
        x=x0+(x1-x0)*t/L;y=y0+(y1-y0)*t/L
        for i in range(int(x-w),int(x+w)+2):
            for j in range(int(y-w),int(y+w)+2):
                if 0<=i<N and 0<=j<N and math.hypot(i-x,j-y)<=w/2: out.add((i,j))
    return out
def rect(i0,i1,j0,j1): return {(i,j) for i in range(i0,i1+1) for j in range(j0,j1+1)}
def build(cfg):
    lv=[[0]*N for _ in range(N)];wt=[[0]*N for _ in range(N)];rd=[[0]*N for _ in range(N)];fr=[[0]*N for _ in range(N)];br=[[0]*N for _ in range(N)]
    for k,(cx,cy,r,l) in enumerate(cfg['hills']):
        f=blobmask(cx,cy,r,cfg['seed']+k)
        for j in range(N):
            for i in range(N):
                if f(i,j) and lv[j][i]<l: lv[j][i]=l
    water=set()
    for pts,w in cfg['rivers']:
        for a,b in zip(pts,pts[1:]):
            ww=w
            water|=seg_cells(a,b,ww)
    for (cx,cy,r) in cfg.get('pools',[]):
        f=blobmask(cx,cy,r,cfg['seed']+50,.15);water|={(i,j) for i in range(N) for j in range(N) if f(i,j)}
    if cfg.get('ring'):
        rw=cfg['ring'];water|={(i,j) for i in range(N) for j in range(N) if min(i,j,N-1-i,N-1-j)<rw+2*math.sin(i*.13+j*.07)}
    for i,j in water: wt[j][i]=cfg.get('liquid',1)
    for pts in cfg['trails']:
        for a,b in zip(pts,pts[1:]):
            for i,j in seg_cells(a,b,3): rd[j][i]=cfg.get('road',2)
    for r_ in cfg['bridges']:
        for i,j in rect(*r_): br[j][i]=1; rd[j][i]=cfg.get('road',2)
    # remove road on water without bridge
    for j in range(N):
        for i in range(N):
            if wt[j][i] and not br[j][i]: rd[j][i]=0
    rnd=random.Random(cfg['seed'])
    # forest: dense frame on the far (top) edges, sparse clumps
    for j in range(N):
        for i in range(N):
            if min(i,j)<4: fr[j][i]=4
            elif min(i,j,N-1-i,N-1-j)<9: fr[j][i]=2
    for cx,cy,r in cfg.get('groves',[]):
        f=blobmask(cx,cy,r,cfg['seed']+99)
        for j in range(N):
            for i in range(N):
                if f(i,j): fr[j][i]=3 if cfg.get('groveDense') else 2
    for j in range(N):
        for i in range(N):
            if rd[j][i] or wt[j][i]: fr[j][i]=1 if fr[j][i] else 0
    objs=[]
    def free(ti,tj,rad=2):
        i,j=int(ti*4),int(tj*4)
        for a in range(i-rad,i+rad+1):
            for b in range(j-rad,j+rad+1):
                if not(0<=a<N and 0<=b<N) or wt[b][a] or rd[b][a] or br[b][a]: return False
        return True
    def scatter(t,n,extra=None,area=None):
        c=0;tries=0
        while c<n and tries<5000:
            tries+=1;ti=rnd.uniform(3,37);tj=rnd.uniform(3,37)
            if area and not area(ti,tj): continue
            if free(ti,tj) and all(math.hypot(o['x']-ti,o['y']-tj)>1.6 for o in objs):
                o={'type':t,'x':round(ti,2),'y':round(tj,2)};o.update(extra or {});objs.append(o);c+=1
    for t,n in cfg['props']: scatter(t,n)
    for o in cfg.get('fixed',[]): objs.append(dict(o))
    scatter('monster',cfg.get('monsters',14),area=lambda ti,tj:min(ti,tj,40-ti,40-tj)>4)
    enc=lambda g:''.join(str(g[j][i]) for j in range(N) for i in range(N))
    return {'version':2,'name':cfg['name'],'biome':cfg['biome'],'roster':'','n':N,'cell':16,
            'level':enc(lv),'water':enc(wt),'road':enc(rd),'forest':enc(fr),'bridge':enc(br),
            'spawn':cfg['spawn'],'objects':objs}
