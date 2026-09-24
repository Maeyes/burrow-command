import bpy, math, os, json
from mathutils import Vector
ROOT=r"C:\bunny-world"
SRC=os.path.join(ROOT,"artifacts","blender","monsters","greenfield")
OUT=os.path.join(ROOT,"public","assets","monsters","3d")
os.makedirs(SRC,exist_ok=True); os.makedirs(OUT,exist_ok=True)
def clear():
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
 for d in (bpy.data.materials,): 
  for x in list(d): d.remove(x)
def mat(n,c):
 m=bpy.data.materials.new(n); m.diffuse_color=(*c,1); return m
def uv(n,loc,scale,ma,seg=12,rings=8):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc); o=bpy.context.object;o.name=n;o.scale=scale;o.data.materials.append(ma);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def cube(n,loc,scale,ma,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot);o=bpy.context.object;o.name=n;o.scale=scale;o.data.materials.append(ma);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def cone(n,loc,r1,r2,dep,ma,verts=8,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=dep,location=loc,rotation=rot);o=bpy.context.object;o.name=n;o.data.materials.append(ma);return o
def root(n):
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);return o
def parent_all(r):
 for o in bpy.context.scene.objects:
  if o!=r and o.parent is None:o.parent=r
def save_export(slug):
 r=[o for o in bpy.context.scene.objects if o.type=='EMPTY'][0]; parent_all(r)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC,slug+".blend"))
 bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active=r
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,slug+".glb"),export_format='GLB',use_selection=True,export_apply=True)
def eyes(z,y,x=0.22):
 black=mat("Eyes",(0.025,0.02,0.02))
 for s in (-1,1): uv("eye", (s*x,y,z),(0.07,0.05,0.08),black,8,6)
def grass_slime():
 clear();g=mat("Meadow slime",(0.24,0.68,0.19));dk=mat("Leaf dark",(0.08,0.38,0.09));root("monster_greenfield_grass_slime");uv("body",(0,0,0.48),(0.62,0.55,0.48),g);uv("cheek",(0,-0.38,0.35),(0.48,0.24,0.25),g);eyes(.58,-.51,.2)
 for x in (-.25,0,.25): cone("grass",(x,0,.98),.10,0,.38,dk,5,rot=(0.18*x,0,0))
 save_export("greenfield-grass-slime")
def rabbit():
 clear();fur=mat("Vegetable rabbit fur",(0.45,0.31,0.18));leaf=mat("Leaf crown",(0.16,0.62,0.16));root("monster_greenfield_vegetable_rabbit");uv("body",(0,0,.55),(.48,.42,.55),fur);uv("head",(0,-.25,1.08),(.42,.38,.4),fur);eyes(1.16,-.59,.16)
 for x in (-.2,.2): cone("ear",(x,-.02,1.62),.13,.06,.75,fur,8)
 for x in (-.2,0,.2): cone("leaf",(x,-.02,1.48),.14,0,.52,leaf,6,rot=(0,x*1.4,0))
 save_export("greenfield-vegetable-rabbit")
def crow():
 clear();fe=mat("Crow feathers",(0.055,0.07,0.095));be=mat("Beak",(0.9,0.52,0.08));root("monster_greenfield_seed_crow");uv("body",(0,0,.72),(.45,.36,.58),fe);uv("head",(0,-.22,1.22),(.34,.33,.34),fe);cone("beak",(0,-.66,1.18),.18,0,.45,be,6,rot=(math.pi/2,0,0));eyes(1.3,-.49,.14)
 for s in (-1,1): cube("wing",(s*.43,0,.82),(.35,.12,.48),fe,rot=(0,s*.28,s*.18))
 for s in (-1,1): cone("leg",(s*.14,0,.24),.045,.035,.45,be,6)
 save_export("greenfield-seed-crow")
def mushroom():
 clear();stem=mat("Mushroom stem",(0.82,0.68,0.48));cap=mat("Spore cap",(0.62,0.16,0.2));spot=mat("Cap spots",(0.95,0.82,0.56));root("monster_greenfield_walking_mushroom");uv("stem",(0,0,.55),(.36,.32,.55),stem);uv("cap",(0,0,1.22),(.72,.62,.32),cap);eyes(.72,-.31,.14)
 for x,y in ((-.3,-.1),(.28,.08),(0,-.22)):uv("spot",(x,y,1.48),(.11,.08,.05),spot,8,6)
 for s in (-1,1): cone("leg",(s*.2,0,.18),.10,.07,.36,stem,7)
 save_export("greenfield-walking-mushroom")
def king():
 clear();body=mat("King vegetable",(0.18,0.5,0.12));leaf=mat("Royal leaves",(0.08,0.3,0.07));gold=mat("Crown",(0.95,0.66,0.12));root("monster_greenfield_vegetable_king");uv("body",(0,0,.9),(.88,.72,.92),body);uv("head",(0,-.1,1.75),(.72,.64,.65),body);eyes(1.84,-.68,.28)
 for s in (-1,1):uv("fist",(s*.92,-.02,.85),(.35,.34,.38),body)
 for x in (-.42,-.2,0,.2,.42): cone("royal_leaf",(x,0,2.28),.19,0,.7,leaf,7,rot=(0,x*.7,0))
 cube("crown_band",(0,-.02,2.3),(.5,.38,.12),gold)
 for x in (-.38,0,.38):cone("crown_point",(x,-.02,2.58),.15,0,.55,gold,5)
 save_export("greenfield-vegetable-king")
for fn in (grass_slime,rabbit,crow,mushroom,king): fn()
print("BATCH2_GREENFIELD_DONE")
