"""Independent Blender import validation and contact-sheet render for Batch 1 GLBs."""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
GLB_DIR = ROOT / "public" / "assets" / "monsters" / "3d"
OUT_DIR = ROOT / "artifacts" / "blender" / "monsters" / "training_yard"
SLUGS = ["training-straw-dummy", "training-rat", "old-wooden-instructor", "training-yard-guardian"]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.unit_settings.system = "METRIC"


def imported_metrics(path: Path) -> dict:
    reset()
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects = list(set(bpy.data.objects) - before)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    triangles = 0
    corners = []
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    maximum = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    dimensions = maximum - minimum
    roots = [obj.name for obj in objects if obj.parent is None]
    return {
        "load": "pass",
        "bytes": path.stat().st_size,
        "meshCount": len(meshes),
        "triangles": triangles,
        "dimensionsBlenderXYZ": [round(v, 4) for v in dimensions],
        "groundMinZ": round(minimum.z, 5),
        "roots": sorted(roots),
        "materials": sorted({slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}),
        "cameras": sum(obj.type == "CAMERA" for obj in objects),
        "lights": sum(obj.type == "LIGHT" for obj in objects),
        "animations": len(bpy.data.actions),
    }


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_preview():
    reset()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 500
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUT_DIR / "training-yard-monsters-preview.png")
    scene.world = bpy.data.worlds.new("Preview world")
    scene.world.color = (0.10, 0.15, 0.18)

    positions = [-3.2, -1.15, 1.1, 3.55]
    labels = []
    for slug, x in zip(SLUGS, positions):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(GLB_DIR / f"{slug}.glb"))
        imported = list(set(bpy.data.objects) - before)
        roots = [obj for obj in imported if obj.parent is None]
        container = bpy.data.objects.new(f"preview_{slug}", None)
        scene.collection.objects.link(container)
        container.location.x = x
        for root in roots:
            root.parent = container
        labels.append(container)

    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.015))
    ground = bpy.context.object
    mat = bpy.data.materials.new("Preview ground")
    mat.diffuse_color = (0.22, 0.34, 0.20, 1)
    ground.data.materials.append(mat)

    bpy.ops.object.light_add(type="AREA", location=(-4, -4, 7))
    bpy.context.object.data.energy = 1100
    bpy.context.object.data.shape = "DISK"
    bpy.context.object.data.size = 5
    bpy.ops.object.light_add(type="AREA", location=(5, 1, 5))
    bpy.context.object.data.energy = 700
    bpy.context.object.data.color = (0.55, 0.70, 1.0)
    bpy.context.object.data.size = 4

    bpy.ops.object.camera_add(location=(7.4, -11.5, 6.2))
    camera = bpy.context.object
    camera.data.lens = 56
    look_at(camera, (0.2, 0, 0.9))
    scene.camera = camera
    bpy.ops.render.render(write_still=True)


def main():
    report = {slug: imported_metrics(GLB_DIR / f"{slug}.glb") for slug in SLUGS}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "glb-validation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    render_preview()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
