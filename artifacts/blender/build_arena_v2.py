import bpy, os, math
ROOT=r"C:\bunny-world"; OUT=os.path.join(ROOT,"public","assets","arena"); os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
def mat(n,c):
 m=bpy.data.materials.new(n);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=1.0;b.inputs['Specular IOR Level'].default_value=.12;return m
G=mat('grass',(0.22,.55,.27));G2=mat('grass_dark',(.12,.36,.2));S=mat('soil',(.28,.18,.12));W=mat('water',(.18,.58,.72));R=mat('stone',(.48,.53,.5));T=mat('trunk',(.3,.17,.08));P=mat('pine',(.08,.34,.18));P2=mat('pine_light',(.16,.48,.23));O=mat('camp_orange',(.82,.4,.08));Y=mat('warm_detail',(.95,.7,.16))
def cube(n,l,s,m,rot=0):
 bpy.ops.mesh.primitive_cube_add(location=l,rotation=(0,0,rot));o=bpy.context.object;o.name=n;o.scale=s;o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
def cone(n,l,r,d,m,v=6):
 bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r,radius2=0,depth=d,location=l);o=bpy.context.object;o.name=n;o.data.materials.append(m)
def ico(n,l,s,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=l);o=bpy.context.object;o.name=n;o.scale=s;o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
# square diorama base
cube('diorama_earth',(0,0,-.62),(5.6,5.6,.7),S);cube('walk_ground',(0,0,.08),(5.48,5.48,.1),G)
# pixel-ish stepped back landmark
for i,(x,z,sx,sy) in enumerate([(-2.9,.65,1.2,1.05),(-2.0,1.15,1.1,.95),(-1.0,.75,.8,.7)]): cube('cliff_block',(x,3.9,z),(sx,sy,z+.35),R)
# river diagonal-ish block strip on left/back
for x,y in [(-4.5,2.8),(-3.9,2.2),(-3.3,1.6),(-2.7,1.0)]: cube('river_tile',(x,y,.2),(.72,.72,.035),W,math.pi/4)
# perimeter trees, central arena intentionally empty
for i,(x,y) in enumerate([(-4.7,-3.7),(-4.6,-2.2),(-4.8,.2),(-4.1,4.1),(1.6,4.65),(3.3,4.4),(4.65,3.4),(4.75,-2.9),(3.7,-4.45)]):
 cube('trunk',(x,y,.9),(.18,.18,.82),T);cone('tree_low',(x,y,1.8),.95,1.9,P if i%2 else P2);cone('tree_high',(x,y,2.75),.7,1.65,P if i%2 else P2)
# corner bushes/rocks
for x,y in [(-3.7,-4.4),(-2.9,-4.55),(4.35,-.4),(4.55,.25),(2.7,4.55)]: ico('cluster',(x,y,.38),(.48,.42,.35),G2)
for x,y in [(-4.4,1.25),(3.9,3.2),(4,-3.9)]: ico('rock',(x,y,.3),(.4,.32,.28),R)
# camp storytelling back-right
for x in (2.7,3.65): cone('tent',(x,-4.05,.62),.72,1.25,O,4)
cube('camp_log',(2.7,-3.15,.28),(.55,.12,.12),T,.12);cube('camp_log',(3.2,-3.15,.28),(.55,.12,.12),T,-.12)
# central combat clearing is intentionally unmarked; composition creates the arena naturally
# tiny gold flowers at perimeter
for x,y in [(-1.8,4.65),(4.4,1.3),(-3.4,-4.4)]: ico('flower',(x,y,.3),(.08,.08,.08),Y)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'artifacts','blender','arena-prototype-v2.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'greenfield-arena-v2.glb'),export_format='GLB',export_apply=True)
print('ARENA_V2_DONE')
