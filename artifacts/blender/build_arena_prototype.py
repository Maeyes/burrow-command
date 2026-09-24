import bpy, os, math
ROOT=r"C:\bunny-world"; OUT=os.path.join(ROOT,"public","assets","arena"); os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials):bpy.data.materials.remove(m)
def mat(n,c):
 m=bpy.data.materials.new(n);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.82;return m
grass=mat('Arena grass',(.18,.52,.24));soil=mat('Earth sides',(.22,.13,.09));dark=mat('Pine dark',(.07,.28,.15));light=mat('Pine light',(.14,.42,.2));rock=mat('Rock',(.45,.5,.5));water=mat('Water',(.15,.55,.72));wood=mat('Wood',(.28,.14,.06));flower=mat('Flowers',(.9,.65,.12))
def cube(n,l,s,ma,rot=(0,0,0)):
 bpy.ops.mesh.primitive_cube_add(location=l,rotation=rot);o=bpy.context.object;o.name=n;o.scale=s;o.data.materials.append(ma);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
def cone(n,l,r,d,ma):
 bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=0,depth=d,location=l);bpy.context.object.name=n;bpy.context.object.data.materials.append(ma)
def ico(n,l,s,ma):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=l);o=bpy.context.object;o.name=n;o.scale=s;o.data.materials.append(ma);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
cube('arena_base',(0,0,-.55),(6,4.4,.6),soil);cube('walk_ground',(0,0,.08),(5.9,4.3,.12),grass)
# river as decorative back-left strip, leaving large central combat clearing
cube('river',(-3.7,.6,.23),(1.0,3.5,.035),water,rot=(0,0,-.18))
# mountain cluster at back
for x,y,z,s in [(-2.7,3,1.0,1.35),(-1.8,3.25,1.25,1.55),(-.7,3.35,.8,1.1)]:
 ico('mountain',(x,y,z),(s,s*.72,s*1.45),rock)
# trees around perimeter, never central clearing
for i,(x,y) in enumerate([(-5,-3),(-4.5,-2),(-5,2.7),(3.9,3.2),(4.9,2.3),(5,-2.8),(3.9,-3.5)]):
 cube('trunk',(x,y,.75),(.13,.13,.75),wood)
 cone('crown',(x,y,1.75),.75,1.8,dark if i%2 else light)
 cone('crown2',(x,y,2.35),.55,1.45,dark if i%2 else light)
# rocks/bushes composition
for i,(x,y) in enumerate([(-4,-3.6),(-3.3,-3.7),(4.7,.2),(4.4,.6),(2.8,3.7)]):ico('bush',(x,y,.45),(.55,.45,.45),light)
# camp corner
for x in (2.9,3.9):cone('tent',(x,-3.25,.65),.8,1.3,mat('Tent orange',(.78,.34,.08)))
# central combat floor subtle flat stone markers
for x,y in [(-1.5,-.5),(0,1),(1.7,-.4)]:ico('combat_marker',(x,y,.25),(.16,.1,.05),rock)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'artifacts','blender','arena-prototype.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'greenfield-arena.glb'),export_format='GLB',export_apply=True)
print('ARENA_DONE')
