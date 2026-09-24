import bpy, math
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name,color,metallic=0.0,emit=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.metallic=metallic; m.roughness=.68
    if emit:
        m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Emission Color'].default_value=(*emit,1); bs.inputs['Emission Strength'].default_value=4
    return m
shadow=material('Shadow',(0.006,0.008,0.012)); eye=material('Eye',(0.75,.92,1),emit=(.65,.88,1))

# voxel unit=.10; build rounded volumes from many cubes
def vc(name,x,y,z,sx,sy,sz,mat=shadow):
    bpy.ops.mesh.primitive_cube_add(location=(x,y,z)); o=bpy.context.object; o.name=name
    o.scale=(sx/2,sy/2,sz/2); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mat); return o

def ellipsoid(name,cx,cy,cz,rx,ry,rz,step=.10):
    n=0
    for ix in range(math.floor(-rx/step),math.ceil(rx/step)+1):
      x=ix*step
      for iy in range(math.floor(-ry/step),math.ceil(ry/step)+1):
       y=iy*step
       for iz in range(math.floor(-rz/step),math.ceil(rz/step)+1):
        z=iz*step
        if (x/rx)**2+(y/ry)**2+(z/rz)**2 <= 1.03:
         vc(f'{name}.{n:04}',cx+x,cy+y,cz+z,step*.98,step*.98,step*.98); n+=1

# compact chibi silhouette
ellipsoid('Head',0,0,1.72,.57,.47,.53,.11)
ellipsoid('Body',0,.03,.88,.39,.31,.49,.11)
ellipsoid('Hip',0,.02,.52,.34,.29,.25,.11)
# tapered ears, stacked voxel ellipsoids
for side in (-1,1):
    x=.25*side
    for i,(z,rx,ry) in enumerate([(2.15,.18,.16),(2.35,.17,.145),(2.55,.145,.13),(2.73,.115,.11),(2.87,.075,.085)]):
        ellipsoid(f'Ear{side}.{i}',x + side*(i*.018),.02,z,rx,ry,.19,.10)
# arms angled slightly outward as voxel clusters
for side in (-1,1):
    for i in range(4):
        ellipsoid(f'Arm{side}.{i}',side*(.34+.055*i),-.01,1.08-.13*i,.14,.13,.18,.10)
# legs and big feet
for side in (-1,1):
    ellipsoid(f'Leg{side}',side*.20,.02,.30,.16,.17,.24,.10)
    ellipsoid(f'Foot{side}',side*.22,-.16,.10,.24,.32,.14,.10)
# tiny tail for back silhouette
ellipsoid('Tail',0,.34,.76,.18,.18,.18,.10)
# eyes on camera-facing/front (-Y)
for x in (-.205,.205):
    vc('Eye',x,-.475,1.78,.105,.045,.105,eye)

# floor
floorMat=material('Floor',(.035,.04,.05))
vc('Floor',0,0,-.10,6,6,.08,floorMat)

# camera setup helper
def camera(name,loc):
    bpy.ops.object.camera_add(location=loc); c=bpy.context.object; c.name=name; c.data.type='ORTHO'; c.data.ortho_scale=3.75
    c.rotation_euler=(Vector((0,0,1.35))-c.location).to_track_quat('-Z','Y').to_euler(); return c
cam=camera('IsoCamera',(4.6,-6.4,4.6)); bpy.context.scene.camera=cam

# lighting
bpy.ops.object.light_add(type='AREA',location=(-3,-4,6)); key=bpy.context.object; key.data.energy=1050; key.data.size=4
bpy.ops.object.light_add(type='AREA',location=(4,1,4)); fill=bpy.context.object; fill.data.energy=500; fill.data.size=3

sc=bpy.context.scene; sc.render.engine='BLENDER_EEVEE'; sc.render.resolution_x=512; sc.render.resolution_y=512; sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG'; sc.world.color=(.012,.014,.02)
base='C:/bunny-world/art-test/shadow-bunny-voxel-poc/'
bpy.ops.wm.save_as_mainfile(filepath=base+'shadow_bunny_model_v2.blend')

# render iso
sc.render.filepath=base+'shadow_bunny_v2_iso.png'; bpy.ops.render.render(write_still=True)
# front
cam.location=(0,-7,1.55); cam.rotation_euler=(Vector((0,0,1.35))-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=base+'shadow_bunny_v2_front.png'; bpy.ops.render.render(write_still=True)
# 3/4 lower angle
cam.location=(4.8,-6.5,3.1); cam.rotation_euler=(Vector((0,0,1.35))-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=base+'shadow_bunny_v2_34.png'; bpy.ops.render.render(write_still=True)
print('SHADOW_BUNNY_V2_DONE')
