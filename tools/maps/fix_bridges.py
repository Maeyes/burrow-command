# Make every painted bridge patch reach dry land at both ends (+2 cells), along its long axis.
import json,sys,glob,os
N=160
def fix(p):
    d=json.load(open(p));B0=d.get('bridge','0'*N*N);B=list(B0);W=d['water'];R=list(d['road'])
    seen=set();changed=0
    for s in range(N*N):
        if B0[s]=='0' or s in seen: continue
        st=[s];seen.add(s);cells=[]
        while st:
            k=st.pop();cells.append(k);i,j=k%N,k//N
            for a,b in((i+1,j),(i-1,j),(i,j+1),(i,j-1)):
                m=b*N+a
                if 0<=a<N and 0<=b<N and B0[m]!='0' and m not in seen: seen.add(m);st.append(m)
        xs=[k%N for k in cells];ys=[k//N for k in cells];x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
        alongX=(x1-x0)>=(y1-y0)
        c=(y0+y1)//2 if alongX else (x0+x1)//2   # deck centre line
        def wet_row(t): return W[(c*N+t) if alongX else (t*N+c)]!='0'
        lo,hi=(x0,x1) if alongX else (y0,y1)
        for _ in range(12):
            if lo>0 and wet_row(lo): lo-=1
        for _ in range(12):
            if hi<N-1 and wet_row(hi): hi+=1
        lo=max(0,lo-2);hi=min(N-1,hi+2)
        for t in range(lo,hi+1):
            for q in (range(y0,y1+1) if alongX else range(x0,x1+1)):
                k=(q*N+t) if alongX else (t*N+q)
                if B[k]=='0': B[k]='1';changed+=1
                if R[k]=='0' and W[k]=='0': R[k]='2'
    d['bridge']=''.join(B);d['road']=''.join(R);json.dump(d,open(p,'w'),separators=(',',':'))
    return changed
for p in sorted(glob.glob(sys.argv[1])):
    n=fix(p)
    if n: print(os.path.basename(p),'bridge cells +',n)
