import os,sys,json
from PIL import Image, ImageDraw
D=sys.argv[1]
fam=[("greatsword",["bowlingBash","crescentBreak","vanguardTempest"]),("dagger",["crossSlash","shadowFlurry","phantomBlades"]),("axe",["cleavingStrike","executionersSweep","ravagerArc"]),("hammer",["crushingImpact","earthbreaker","cataclysm"]),("bow",["powerShot","piercingVolley","skyfallBarrage"]),("staff",["arcBolt","arcCascade","astralVolley"]),("swordShield",["radiantBurst","gravityPulse","astralDominion"])]
ok=True; rows=[]
print(f"{'id':18} size mode  transp% borderOpaque cornersA bbox         colors")
for f,ids in fam:
    for i in ids:
        im=Image.open(f"{D}/{i}.png"); mode=im.mode; size=im.size
        rgba=im.convert("RGBA"); px=rgba.load(); w,h=size
        a=[px[x,y][3] for y in range(h) for x in range(w)]
        transp=sum(1 for v in a if v==0)/len(a)*100
        border=[px[x,y][3] for x in range(w) for y in (0,h-1)]+[px[x,y][3] for y in range(h) for x in (0,w-1)]
        bo=sum(1 for v in border if v>0)
        corners=[px[0,0][3],px[w-1,0][3],px[0,h-1][3],px[w-1,h-1][3]]
        bbox=rgba.getchannel('A').point(lambda v:255 if v>0 else 0).getbbox()
        partial=sum(1 for v in a if 0<v<255)
        cols=len({px[x,y][:3] for y in range(h) for x in range(w) if px[x,y][3]>0})
        issues=[]
        if size!=(64,64):issues.append('size')
        if mode!='RGBA':issues.append('mode')
        if transp<25:issues.append('lowTransparency')
        if bo>6:issues.append('edgeClip?')
        if any(corners):issues.append('corner')
        if partial>0:issues.append(f'{partial}semi-alpha')
        ok&=not [x for x in issues if not x.endswith('semi-alpha')]
        print(f"{i:18} {str(size):8}{mode:5} {transp:5.1f} {bo:6}      {corners}  {str(bbox):13} {cols:4}  {' '.join(issues)}")
S=4;C=64*S;sheet=Image.new("RGB",(3*C,7*(C+16)),(60,62,74));d=ImageDraw.Draw(sheet)
for r,(f,ids) in enumerate(fam):
    for c,i in enumerate(ids):
        im=Image.open(f"{D}/{i}.png").convert("RGBA").resize((C,C),Image.NEAREST);x,y=c*C,r*(C+16)
        sheet.paste(im,(x,y+16),im);d.text((x+4,y+2),f"{f} Lv{(c+1)*10}  {i}",fill=(255,255,255))
sheet.save(f"{D}_sheet.png");print("hard-check pass:",ok)
