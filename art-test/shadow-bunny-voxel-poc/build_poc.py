import bpy, math
from mathutils import Vector

# Clear
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Materials
def mat(name, color, metallic=0.0, emission=None):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.metallic=metallic
    m.roughness=.55
    if emission:
        m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value=(*color,1)
        bs.inputs['Emission Color'].default_value=(*emission,1)
        bs.inputs['Emission Strength'].default_value=3
    return m
black=mat('Shadow',(0.008,0.01,0.014))
white=mat('Eyes',(0.8,0.95,1.0), emission=(0.65,0.9,1.0))
steel=mat('Greatsword',(0.18,0.24,0.3),.65)
edge=mat('BladeGlow',(0.12,0.65,1.0),.2, emission=(0.08,0.55,1.0))

def cube(name, loc, scale, material, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if parent: o.parent=parent
    return o

root=bpy.data.objects.new('ShadowBunny_ROOT',None); bpy.context.collection.objects.link(root)
body=cube('Body',(0,0,1.25),(.42,.30,.55),black,root)
head=cube('Head',(0,0,2.0),(.55,.42,.48),black,root)
earL=cube('Ear.L',(-.25,0,2.78),(.18,.18,.72),black,head); earL.rotation_euler[1]=math.radians(-7)
earR=cube('Ear.R',(.25,0,2.78),(.18,.18,.72),black,head); earR.rotation_euler[1]=math.radians(7)
for x in (-.2,.2): cube('Eye',(x,-.43,2.08),(.055,.035,.06),white,head)
legL=cube('Leg.L',(-.22,0,.55),(.18,.22,.40),black,root)
legR=cube('Leg.R',(.22,0,.55),(.18,.22,.40),black,root)
cube('Foot.L',(-.25,-.13,.16),(.26,.38,.14),black,legL)
cube('Foot.R',(.25,-.13,.16),(.26,.38,.14),black,legR)
armL=cube('Arm.L',(-.48,-.02,1.35),(.15,.16,.42),black,root)
armR=cube('Arm.R',(.48,-.02,1.35),(.15,.16,.42),black,root)

# sword parent pivot
sword=bpy.data.objects.new('Greatsword_ROOT',None); bpy.context.collection.objects.link(sword); sword.parent=root
blade=cube('Blade',(0,-.12,2.0),(.13,.07,1.35),steel,sword)
cube('BladeEdge',(.14,-.12,2.0),(.025,.075,1.30),edge,sword)
cube('Guard',(0,-.12,.68),(.48,.10,.10),steel,sword)
cube('Grip',(0,-.12,.35),(.09,.09,.35),black,sword)

# initial pose
sword.location=(.58,-.15,.72); sword.rotation_euler=(math.radians(10),math.radians(-12),math.radians(-22))
armR.rotation_euler[1]=math.radians(-25); armL.rotation_euler[1]=math.radians(20)

# animate root body and sword: anticipation -> slash -> impact -> follow-through -> recover
for f in (1,12,18,22,34,46):
    root.rotation_euler=(0,0,0); root.location=(0,0,0)
    sword.rotation_euler=(0,0,0)
    if f==1:
        sword.rotation_euler=(math.radians(10),math.radians(-12),math.radians(-22))
    elif f==12:
        root.rotation_euler[2]=math.radians(20); root.location.z=-.10
        sword.rotation_euler=(math.radians(-20),math.radians(-10),math.radians(-115))
    elif f==18:
        root.rotation_euler[2]=math.radians(-18); root.location=(0,-.08,.05)
        sword.rotation_euler=(math.radians(15),math.radians(5),math.radians(35))
    elif f==22:
        root.rotation_euler[2]=math.radians(-28); root.location=(0,-.14,-.08)
        sword.rotation_euler=(math.radians(20),math.radians(8),math.radians(82))
    elif f==34:
        root.rotation_euler[2]=math.radians(-10)
        sword.rotation_euler=(math.radians(10),0,math.radians(55))
    else:
        sword.rotation_euler=(math.radians(10),math.radians(-12),math.radians(-22))
    root.keyframe_insert('rotation_euler',frame=f); root.keyframe_insert('location',frame=f)
    sword.keyframe_insert('rotation_euler',frame=f)

# interpolation: bezier, fast impact
# Blender 5.x layered Actions: keep default interpolation for this disposable POC.

# floor
floor=cube('Floor',(0,0,-.08),(4,4,.05),mat('FloorMat',(0.035,.04,.05)))
# camera
bpy.ops.object.camera_add(location=(6,-8,6.3))
cam=bpy.context.object; cam.name='IsoCamera'; bpy.context.scene.camera=cam
cam.data.type='ORTHO'; cam.data.ortho_scale=5.5

def track(obj,pt):
    obj.rotation_euler=(Vector(pt)-obj.location).to_track_quat('-Z','Y').to_euler()
track(cam,(0,0,1.4))
# lights
bpy.ops.object.light_add(type='AREA', location=(3,-4,7)); bpy.context.object.data.energy=900; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=5
bpy.ops.object.light_add(type='AREA', location=(-4,1,4)); bpy.context.object.data.energy=500; bpy.context.object.data.size=4

sc=bpy.context.scene
sc.frame_start=1; sc.frame_end=46; sc.render.engine='BLENDER_EEVEE'
sc.render.resolution_x=512; sc.render.resolution_y=512; sc.render.resolution_percentage=100
sc.render.image_settings.file_format='PNG'
sc.render.film_transparent=False
sc.world.color=(.012,.015,.022)
sc.render.filepath='C:/bunny-world/art-test/shadow-bunny-voxel-poc/preview.png'
sc.frame_set(18)
bpy.ops.wm.save_as_mainfile(filepath='C:/bunny-world/art-test/shadow-bunny-voxel-poc/shadow_bunny_greatsword_poc.blend')
bpy.ops.render.render(write_still=True)
print('POC_CREATED')
