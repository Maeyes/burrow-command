import bpy, os, math
from mathutils import Vector
SRC=os.path.abspath('artifacts/blender/worlds/bunny-world-map.blend')
OUT=os.path.abspath('art-test/blender-pixel-terrain/blender_world_crop.png')
bpy.ops.wm.open_mainfile(filepath=SRC)
scene=bpy.context.scene
mins=Vector((1e9,1e9,1e9)); maxs=Vector((-1e9,-1e9,-1e9)); found=False
for o in scene.objects:
    if o.type!='MESH' or o.hide_render: continue
    for c in o.bound_box:
        w=o.matrix_world @ Vector(c)
        mins.x=min(mins.x,w.x); mins.y=min(mins.y,w.y); mins.z=min(mins.z,w.z)
        maxs.x=max(maxs.x,w.x); maxs.y=max(maxs.y,w.y); maxs.z=max(maxs.z,w.z); found=True
if not found: mins=Vector((-7,-8,0)); maxs=Vector((7,8,4))
center=(mins+maxs)*.5; span=max(maxs.x-mins.x,maxs.y-mins.y); crop=max(12.0,min(span*.42,22.0))
bpy.ops.object.camera_add(location=(center.x+crop*.75,center.y-crop*.75,center.z+crop*.72))
cam=bpy.context.object; cam.data.type='ORTHO'; cam.data.ortho_scale=crop
cam.rotation_euler=((center-cam.location).to_track_quat('-Z','Y').to_euler()); scene.camera=cam
if not any(o.type=='LIGHT' for o in scene.objects):
    bpy.ops.object.light_add(type='SUN', location=(center.x,center.y,center.z+10))
    sun=bpy.context.object; sun.rotation_euler=(math.radians(35),0,math.radians(-45)); sun.data.energy=2.0
scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=640; scene.render.resolution_y=360; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.filepath=OUT
for o in scene.objects:
    if o.type=='MESH':
        for p in o.data.polygons: p.use_smooth=False
os.makedirs(os.path.dirname(OUT),exist_ok=True); bpy.ops.render.render(write_still=True)
print('bounds',tuple(round(v,2) for v in mins),tuple(round(v,2) for v in maxs),'crop',crop); print(OUT)
