import bpy, math, os
ROOT=r"C:\bunny-world"; SRC=os.path.join(ROOT,"artifacts","blender","monsters","windwood"); OUT=os.path.join(ROOT,"public","assets","monsters","3d")
os.makedirs(SRC,exist_ok=True); os.makedirs(OUT,exist_ok=True)
def clear():
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
 for m in list(bpy.data.materials): bpy.data.materials.remove(m)
def mat(n,c):
 m=bpy.data.materials.new(n);m.use_nodes=True;m.diffuse_color=(*c,1);b=m.node_tree.nodes.get('Principled BSDF')
 if b:b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.78
 return m
def uv(n,l,s,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=l);o=bpy.context.object;o.name=n;o.scale=s;o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def cone(n,l,r1,r2,d,m,rot=(0,0,0),v=7):
 bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r1,radius2=r2,depth=d,location=l,rotation=rot);o=bpy.context.object;o.name=n;o.data.materials.append(m);return o
def cube(n,l,s,m,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(location=l,rotation=rot);o=bpy.context.object;o.name=n;o.scale=s;o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o
def root(n):o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);return o
def eyes(z,y,x=.2):
 e=mat("Eyes",(0.02,.025,.03))
 for q in (-1,1):uv("eye",(q*x,y,z),(.065,.045,.075),e)
def finish(slug):
 r=next(o for o in bpy.context.scene.objects if o.type=='EMPTY')
 for o in bpy.context.scene.objects:
  if o!=r and o.parent is None:o.parent=r
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC,slug+".blend"));bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=r
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,slug+".glb"),export_format='GLB',use_selection=True,export_apply=True)
def wolf():
 clear();f=mat("Wind wolf fur",(.18,.23,.27));l=mat("Wind markings",(.38,.55,.58));root("monster_windwood_sharpfang_wolf");uv("body",(0,0,.62),(.68,.9,.5),f);uv("head",(0,-.72,.9),(.48,.48,.48),f);uv("muzzle",(0,-1.08,.78),(.3,.3,.23),l);eyes(.98,-1.12,.18)
 for x in (-.24,.24):cone("ear",(x,-.68,1.38),.16,0,.48,f)
 for x in (-.35,.35):cone("fang",(x*.45,-1.28,.67),.06,0,.25,mat("Fang",(.9,.88,.72)),rot=(math.pi,0,0))
 finish("windwood-sharpfang-wolf")
def hawk():
 clear();f=mat("Gale hawk",(.26,.31,.34));a=mat("Wind feather",(.52,.7,.7));be=mat("Beak",(.9,.58,.12));root("monster_windwood_gale_hawk");uv("body",(0,0,.8),(.42,.35,.62),f);uv("head",(0,-.24,1.32),(.34,.32,.32),f);cone("beak",(0,-.65,1.28),.16,0,.4,be,rot=(math.pi/2,0,0));eyes(1.38,-.51,.14)
 for s in (-1,1):cube("wing",(s*.52,0,.9),(.48,.1,.35),a,rot=(0,s*.25,s*.28))
 finish("windwood-gale-hawk")
def bandit():
 clear();fur=mat("Bandit fur",(.28,.2,.14));cloth=mat("Forest cloth",(.12,.28,.14));mask=mat("Mask",(.08,.09,.08));root("monster_windwood_rookie_bandit");uv("body",(0,0,.72),(.48,.38,.68),cloth);uv("head",(0,-.12,1.42),(.38,.35,.4),fur);cube("mask",(0,-.34,1.47),(.34,.08,.12),mask);eyes(1.5,-.43,.15)
 for s in (-1,1):uv("arm",(s*.48,0,.78),(.16,.16,.45),fur)
 cone("club",(.65,-.05,.72),.08,.06,1.05,mat("Wood weapon",(.3,.17,.08)),rot=(0,0,-.35))
 finish("windwood-rookie-bandit")
def guardian():
 clear();wood=mat("Ancient wood",(.22,.14,.07));moss=mat("Ancient moss",(.16,.38,.16));root("monster_windwood_ancient_wood_guardian");cube("trunk",(0,0,.9),(.52,.42,.9),wood);uv("crown",(0,0,1.72),(.72,.6,.5),moss);eyes(1.62,-.52,.2)
 for s in (-1,1):cube("branch_arm",(s*.7,0,.95),(.42,.15,.16),wood,rot=(0,s*.18,s*.15))
 for x in (-.35,0,.35):cone("crown_branch",(x,0,2.18),.14,.04,.72,wood,6 if False else (0,0,0))
 finish("windwood-ancient-wood-guardian")
def boss():
 clear();f=mat("Windfang fur",(.12,.17,.22));w=mat("Storm markings",(.28,.64,.7));bone=mat("Fangs",(.92,.88,.7));root("monster_windwood_windfang_lord");uv("body",(0,0,1.0),(1.0,1.25,.78),f);uv("head",(0,-.95,1.55),(.72,.7,.68),f);uv("muzzle",(0,-1.48,1.38),(.46,.38,.32),w);eyes(1.68,-1.56,.28)
 for x in (-.38,.38):cone("ear",(x,-.9,2.2),.22,0,.68,f)
 for x in (-.22,.22):cone("fang",(x,-1.82,1.2),.09,0,.42,bone,rot=(math.pi,0,0))
 for s in (-1,1):uv("shoulder",(s*1.0,-.05,1.2),(.42,.48,.52),w)
 finish("windwood-windfang-lord")
for fn in (wolf,hawk,bandit,guardian,boss): fn()
print("WINDWOOD_BATCH_DONE")
