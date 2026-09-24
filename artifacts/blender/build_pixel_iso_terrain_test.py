import bpy, math, os
from mathutils import Vector

# Bunny World Blender pixel-isometric terrain experiment.
# Intentionally blocky: orthographic camera, flat materials, hard shadows,
# no anti-aliasing/TAA, low render resolution, nearest-neighbour upscale.

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=1
    return m

grass=mat('grass',(0.10,0.25,0.14)); grass2=mat('grass2',(0.15,0.34,0.18))
dirt=mat('dirt',(0.31,0.22,0.12)); rock=mat('rock',(0.25,0.29,0.25))
trunk=mat('trunk',(0.22,0.13,0.07)); leaf=mat('leaf',(0.08,0.22,0.11)); leaf2=mat('leaf2',(0.12,0.31,0.14))
ruin=mat('ruin',(0.29,0.34,0.28))

def cube(name, loc, scale, material, bevel=0):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    return o

# Square diorama base, deliberately chunky voxel/pixel language
cube('ground',(0,0,-.25),(7,7,.25),grass)
cube('ground_edge',(0,0,-.65),(7.15,7.15,.4),dirt)

# chunky dirt path
for y in range(-6,7):
    x=round(math.sin(y*.7)*1.2)
    cube('path',(x,y,.015),(.72,.72,.025),dirt)
    if y in (-2,2,5): cube('path_wide',(x+1,y,.016),(.72,.72,.026),dirt)

# grass pixel clusters
for x,y in [(-5,-4),(-4,-4),(-5,2),(-3,4),(3,-4),(5,-2),(4,4),(1,5)]:
    for dx,dy,h in [(-.22,0,.22),(0,.05,.34),(.22,-.03,.18)]:
        cube('grass_bit',(x+dx,y+dy,h/2),(.07,.07,h/2),grass2)

# blocky trees
for x,y,s in [(-5,-2,1),(5,1,1.1),(-4,4,.9),(4,5,1),(5,-5,.85),(-5,-5,.9)]:
    cube('trunk',(x,y,.8*s),(.25*s,.25*s,.8*s),trunk)
    cube('leaf',(x,y,1.85*s),(1.0*s,.85*s,.38*s),leaf)
    cube('leaf',(x-.35*s,y+.15*s,2.3*s),(.7*s,.7*s,.35*s),leaf2)
    cube('leaf',(x+.38*s,y-.1*s,2.18*s),(.68*s,.68*s,.32*s),leaf)

# rocks
for x,y,s in [(-2,-4,.7),(3,3,.9),(5,4,.55),(-4,1,.6),(2,-5,.5)]:
    cube('rock',(x,y,.3*s),(.65*s,.5*s,.3*s),rock)
    cube('rock_hi',(x-.12*s,y+.08*s,.62*s),(.42*s,.38*s,.2*s),ruin)

# tiny ruined shrine landmark
cube('shrine_base',(-2.8,2.6,.2),(1.15,.8,.2),ruin)
cube('pillarL',(-3.55,2.6,1.05),(.18,.18,.85),ruin)
cube('pillarR',(-2.05,2.6,.78),(.18,.18,.58),ruin)
cube('lintel',(-2.9,2.6,1.72),(.9,.2,.16),ruin)

# simple bunny marker for scale, not production sprite
white=mat('bunny_white',(.82,.86,.80)); dark=mat('bunny_dark',(.05,.07,.07))
cube('bunny_body',(0,-.5,.55),(.32,.25,.48),white)
cube('bunny_head',(0,-.5,1.18),(.4,.34,.38),white)
cube('earL',(-.18,-.5,1.78),(.10,.11,.35),white); cube('earR',(.18,-.5,1.78),(.10,.11,.35),white)
cube('outfit',(0,-.52,.55),(.34,.27,.24),dark)

# Sun: hard readable shadows
bpy.ops.object.light_add(type='SUN', location=(0,0,8))
sun=bpy.context.object; sun.rotation_euler=(math.radians(35),0,math.radians(-45)); sun.data.energy=2.0; sun.data.angle=0.02

world=bpy.context.scene.world
world.color=(0.015,0.025,0.02)
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(0.015,0.025,0.02,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55

# Standard isometric orthographic camera
bpy.ops.object.camera_add(location=(12,-12,12))
cam=bpy.context.object
cam.data.type='ORTHO'; cam.data.ortho_scale=19
bpy.context.scene.camera=cam

def look_at(obj, target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
look_at(cam,(0,0,.5))

scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=640
scene.render.resolution_y=360
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.render.filepath=os.path.abspath('art-test/blender-pixel-terrain/blender_pixel_iso.png')

# Pixel-first render settings
scene.render.image_settings.color_mode='RGBA'
scene.view_settings.look='AgX - Medium High Contrast'
# Avoid smoothing modifiers and bevels entirely.
for o in bpy.context.scene.objects:
    if hasattr(o,'data') and hasattr(o.data,'polygons'):
        for p in o.data.polygons: p.use_smooth=False

os.makedirs(os.path.dirname(scene.render.filepath), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath('art-test/blender-pixel-terrain/blender_pixel_iso.blend'))
bpy.ops.render.render(write_still=True)
print(scene.render.filepath)
