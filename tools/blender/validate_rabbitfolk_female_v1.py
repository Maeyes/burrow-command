"""Independently re-import, inspect, and render Rabbitfolk Female V1."""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "artifacts" / "blender" / "characters" / "rabbitfolk_female_v1"
GLB = ASSET_DIR / "rabbitfolk_female_v1.glb"
REPORT = ASSET_DIR / "rabbitfolk_female_v1_validation.json"
PREVIEW_DIR = ASSET_DIR / "previews"


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


clear()
bpy.ops.import_scene.gltf(filepath=str(GLB))

roots = [obj for obj in bpy.context.scene.objects if obj.parent is None]
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
cameras = [obj for obj in bpy.context.scene.objects if obj.type == "CAMERA"]
lights = [obj for obj in bpy.context.scene.objects if obj.type == "LIGHT"]
generic_names = [obj.name for obj in meshes if obj.name.startswith(("Cube", "Sphere", "Cylinder", "BezierCurve"))]

world_points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
minimum = Vector((min(p.x for p in world_points), min(p.y for p in world_points), min(p.z for p in world_points)))
maximum = Vector((max(p.x for p in world_points), max(p.y for p in world_points), max(p.z for p in world_points)))

depsgraph = bpy.context.evaluated_depsgraph_get()
triangles = 0
negative_scale_objects = []
for obj in meshes:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    triangles += len(mesh.loop_triangles)
    evaluated.to_mesh_clear()
    if obj.scale.x < 0 or obj.scale.y < 0 or obj.scale.z < 0:
        negative_scale_objects.append(obj.name)

materials = sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material})
required_prefixes = ["Body_", "Head_", "Face_", "Ear_", "Hair_", "Outfit_"]
missing_component_groups = [prefix for prefix in required_prefixes if not any(obj.name.startswith(prefix) for obj in meshes)]
animation_count = sum(len(data.nla_tracks) for data in bpy.data.objects if data.animation_data)

result = {
    "result": "pass",
    "glb": str(GLB),
    "glbBytes": GLB.stat().st_size,
    "roots": [obj.name for obj in roots],
    "meshObjects": len(meshes),
    "triangles": triangles,
    "materials": materials,
    "materialCount": len(materials),
    "dimensionsImportedBlenderXYZ": [round(value, 4) for value in maximum - minimum],
    "groundMinZ": round(minimum.z, 5),
    "armatures": len(armatures),
    "animations": animation_count,
    "camerasInGlb": len(cameras),
    "lightsInGlb": len(lights),
    "genericObjectNames": generic_names,
    "negativeScaleObjects": negative_scale_objects,
    "missingComponentGroups": missing_component_groups,
}

if [obj.name for obj in roots] != ["Rabbitfolk_Female"]:
    result["result"] = "fail"
if abs(minimum.z) > 0.002 or not meshes or not materials or generic_names or negative_scale_objects or missing_component_groups:
    result["result"] = "fail"
if armatures or cameras or lights or animation_count:
    result["result"] = "fail"

REPORT.write_text(json.dumps(result, indent=2), encoding="utf-8")

# Cameras and lights are added only to this disposable validation scene, never to the source or GLB.
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
bpy.context.scene.render.engine = "BLENDER_WORKBENCH"
bpy.context.scene.display.shading.light = "STUDIO"
bpy.context.scene.display.shading.studio_light = "paint.sl"
bpy.context.scene.display.shading.color_type = "MATERIAL"
bpy.context.scene.display.shading.show_shadows = True
bpy.context.scene.display.shading.show_cavity = True
bpy.context.scene.display.shading.cavity_type = "BOTH"
bpy.context.scene.display.shading.curvature_ridge_factor = 1.5
bpy.context.scene.display.shading.curvature_valley_factor = 1.0
bpy.context.scene.display.shading.background_type = "VIEWPORT"
bpy.context.scene.display.shading.background_color = (0.055, 0.075, 0.10)
bpy.context.scene.render.resolution_x = 720
bpy.context.scene.render.resolution_y = 900
bpy.context.scene.render.resolution_percentage = 100
bpy.context.scene.render.image_settings.file_format = "PNG"
bpy.context.scene.render.film_transparent = False

bpy.ops.object.camera_add()
camera = bpy.context.object
camera.name = "Validation_Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.95
bpy.context.scene.camera = camera

views = {
    "front": ((0, -6.0, 1.35), (0, 0, 1.30)),
    "back": ((0, 6.0, 1.35), (0, 0, 1.30)),
    "left": ((-6.0, 0, 1.35), (0, 0, 1.30)),
    "three-quarter": ((4.5, -5.2, 2.35), (0, 0, 1.28)),
    "isometric": ((4.8, -5.5, 4.2), (0, 0, 1.20)),
}
for name, (position, target) in views.items():
    camera.location = position
    look_at(camera, target)
    bpy.context.scene.render.filepath = str(PREVIEW_DIR / f"rabbitfolk_female_v1_{name}.png")
    bpy.ops.render.render(write_still=True)

print(json.dumps(result, indent=2))
if result["result"] != "pass":
    raise RuntimeError("Rabbitfolk Female V1 validation failed")
