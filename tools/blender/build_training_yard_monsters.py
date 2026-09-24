"""Build Bunny World Training Yard monster assets with local Blender only.

Run with:
  blender --background --python tools/blender/build_training_yard_monsters.py

The script creates one editable .blend and one independently loadable .glb per
monster. Blender is Z-up; the glTF exporter converts the assets to Three.js
Y-up. Every root sits at the world origin and all visible geometry contacts Z=0.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = PROJECT_ROOT / "artifacts" / "blender" / "monsters" / "training_yard"
EXPORT_DIR = PROJECT_ROOT / "public" / "assets" / "monsters" / "3d"


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.78,
             metallic: float = 0.0, emission: tuple[float, float, float, float] | None = None,
             emission_strength: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def root_empty(name: str) -> bpy.types.Object:
    root = bpy.data.objects.new(name, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.18
    root["asset_kind"] = "monster"
    root["ground_contact"] = 0.0
    bpy.context.scene.collection.objects.link(root)
    return root


def finish(obj: bpy.types.Object, name: str, root: bpy.types.Object, mat: bpy.types.Material,
           bevel: float = 0.0, smooth: bool = False) -> bpy.types.Object:
    obj.name = name
    obj.parent = root
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("Soft edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    if smooth and hasattr(obj.data, "polygons"):
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def cube(name: str, root: bpy.types.Object, loc, scale, mat, rotation=(0, 0, 0), bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, root, mat, bevel=bevel)


def sphere(name: str, root: bpy.types.Object, loc, scale, mat, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, root, mat, smooth=True)


def cylinder(name: str, root: bpy.types.Object, loc, radius, depth, mat, vertices=10,
             rotation=(0, 0, 0), bevel=0.025):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    return finish(bpy.context.object, name, root, mat, bevel=bevel)


def cone(name: str, root: bpy.types.Object, loc, r1, r2, depth, mat, vertices=10,
         rotation=(0, 0, 0), bevel=0.015):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rotation)
    return finish(bpy.context.object, name, root, mat, bevel=bevel)


def torus(name: str, root: bpy.types.Object, loc, major, minor, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=16, minor_segments=6,
                                    location=loc, rotation=rotation)
    return finish(bpy.context.object, name, root, mat, smooth=True)


def curve_tube(name: str, root: bpy.types.Object, points, radius, mat):
    curve_data = bpy.data.curves.new(name + "_curve", "CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 1
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = root
    curve_data.materials.append(mat)
    return obj


def add_eye_pair(root, z, y, spacing, eye_mat, glow_mat=None, scale=0.055):
    for side in (-1, 1):
        sphere(f"eye_{'L' if side < 0 else 'R'}", root, (side * spacing, y, z),
               (scale, scale * 0.85, scale * 1.08), eye_mat, 12, 8)
        if glow_mat:
            sphere(f"eye_glow_{'L' if side < 0 else 'R'}", root,
                   (side * spacing, y - scale * 0.2, z + scale * 0.12),
                   (scale * 0.25,) * 3, glow_mat, 8, 6)


def training_straw_dummy():
    root = root_empty("monster_training_straw_dummy")
    wood = material("Wood warm", (0.34, 0.16, 0.07, 1))
    wood_light = material("Wood worn", (0.58, 0.32, 0.13, 1))
    straw = material("Straw", (0.82, 0.58, 0.18, 1))
    cloth = material("Training cloth", (0.58, 0.16, 0.11, 1))
    dark = material("Living marks", (0.07, 0.045, 0.025, 1), roughness=0.55)

    cylinder("base_post", root, (0, 0, 0.42), 0.12, 0.84, wood, 10)
    cylinder("ground_foot", root, (0, 0, 0.08), 0.32, 0.16, wood_light, 10)
    cube("crossbar", root, (0, 0, 0.95), (0.56, 0.075, 0.075), wood_light, bevel=0.045)
    sphere("straw_torso", root, (0, 0, 0.91), (0.31, 0.19, 0.37), straw, 14, 8)
    sphere("straw_head", root, (0, 0, 1.31), (0.24, 0.19, 0.23), straw, 14, 8)
    torus("target_ring", root, (0, -0.185, 0.94), 0.16, 0.027, cloth, rotation=(math.pi / 2, 0, 0))
    sphere("target_center", root, (0, -0.205, 0.94), (0.07, 0.025, 0.07), cloth, 12, 8)
    for side in (-1, 1):
        cone(f"straw_hand_{side}", root, (side * 0.59, 0, 0.94), 0.10, 0.045, 0.25, straw, 9,
             rotation=(0, math.pi / 2, 0))
        cube(f"cloth_strip_{side}", root, (side * 0.42, -0.03, 0.84), (0.08, 0.025, 0.20), cloth,
             rotation=(0, side * 0.12, side * 0.16), bevel=0.018)
    add_eye_pair(root, 1.34, -0.18, 0.085, dark, scale=0.036)
    cone("straw_top", root, (0, 0, 1.55), 0.14, 0.015, 0.28, straw, 9)
    root["motion_profile"] = "bob_sway"
    return root


def training_rat():
    root = root_empty("monster_training_rat")
    fur = material("Rat fur", (0.31, 0.28, 0.34, 1))
    fur_light = material("Rat muzzle", (0.57, 0.49, 0.51, 1))
    pink = material("Rat pink", (0.73, 0.35, 0.42, 1))
    dark = material("Rat eyes", (0.035, 0.025, 0.035, 1), roughness=0.28)
    tooth = material("Rat teeth", (0.92, 0.86, 0.66, 1))

    sphere("body", root, (0, 0, 0.40), (0.42, 0.56, 0.34), fur, 16, 10)
    sphere("head", root, (0, -0.42, 0.55), (0.32, 0.34, 0.29), fur, 16, 10)
    sphere("muzzle", root, (0, -0.69, 0.47), (0.20, 0.18, 0.15), fur_light, 14, 8)
    sphere("nose", root, (0, -0.84, 0.49), (0.065, 0.045, 0.055), pink, 10, 7)
    for side in (-1, 1):
        sphere(f"ear_{side}", root, (side * 0.22, -0.38, 0.80), (0.18, 0.075, 0.21), pink, 14, 8)
        sphere(f"paw_front_{side}", root, (side * 0.21, -0.36, 0.12), (0.14, 0.21, 0.10), fur_light, 12, 7)
        sphere(f"paw_back_{side}", root, (side * 0.28, 0.27, 0.13), (0.19, 0.26, 0.12), fur, 12, 7)
    add_eye_pair(root, 0.63, -0.68, 0.13, dark, scale=0.052)
    for side in (-1, 1):
        cone(f"tooth_{side}", root, (side * 0.045, -0.82, 0.40), 0.025, 0.008, 0.10, tooth, 6,
             rotation=(math.pi, 0, 0), bevel=0.005)
    curve_tube("tail", root, [(0.05, 0.42, 0.30), (0.38, 0.72, 0.27), (0.72, 0.52, 0.23),
                                    (0.83, 0.17, 0.16)], 0.035, pink)
    root["motion_profile"] = "scurry"
    return root


def old_wooden_instructor():
    root = root_empty("monster_old_wooden_instructor")
    old_wood = material("Aged wood", (0.29, 0.13, 0.055, 1))
    cut_wood = material("Cut wood", (0.56, 0.29, 0.10, 1))
    moss = material("Moss", (0.25, 0.38, 0.13, 1))
    rope = material("Rope", (0.56, 0.43, 0.20, 1))
    rune = material("Instructor magic", (0.24, 0.68, 0.72, 1), roughness=0.3,
                    emission=(0.12, 0.64, 0.72, 1), emission_strength=2.2)
    dark = material("Instructor eye sockets", (0.035, 0.025, 0.016, 1), roughness=0.5)

    cylinder("torso", root, (0, 0, 0.82), 0.34, 0.90, old_wood, 10, bevel=0.05)
    cylinder("head", root, (0, -0.02, 1.42), 0.27, 0.36, cut_wood, 10, bevel=0.05)
    cube("brow", root, (0, -0.255, 1.48), (0.27, 0.055, 0.055), old_wood,
         rotation=(0.08, 0, 0), bevel=0.025)
    add_eye_pair(root, 1.43, -0.285, 0.105, dark, rune, scale=0.052)
    torus("chest_rune_ring", root, (0, -0.345, 0.90), 0.16, 0.028, rune, rotation=(math.pi / 2, 0, 0))
    sphere("chest_rune", root, (0, -0.37, 0.90), (0.085, 0.035, 0.085), rune, 12, 8)
    for side in (-1, 1):
        cylinder(f"upper_arm_{side}", root, (side * 0.42, 0, 0.98), 0.105, 0.48, old_wood, 9,
                 rotation=(0, side * 0.18, 0), bevel=0.035)
        cylinder(f"forearm_{side}", root, (side * 0.48, -0.02, 0.59), 0.09, 0.39, cut_wood, 9,
                 rotation=(0, side * 0.13, 0), bevel=0.03)
        sphere(f"hand_{side}", root, (side * 0.50, -0.02, 0.35), (0.13, 0.12, 0.13), cut_wood, 12, 8)
        cylinder(f"leg_{side}", root, (side * 0.17, 0, 0.27), 0.12, 0.45, old_wood, 9, bevel=0.035)
        cube(f"foot_{side}", root, (side * 0.17, -0.07, 0.09), (0.16, 0.24, 0.09), cut_wood, bevel=0.035)
    torus("rope_belt", root, (0, 0, 0.62), 0.34, 0.035, rope)
    for x, z, scale in [(-0.20, 1.13, 1.0), (0.16, 1.05, 0.8), (-0.13, 0.53, 0.75)]:
        sphere(f"moss_{x}_{z}", root, (x, -0.29, z), (0.10 * scale, 0.035, 0.055 * scale), moss, 10, 6)
    root["motion_profile"] = "wooden_master"
    return root


def training_yard_guardian():
    root = root_empty("monster_training_yard_guardian")
    dark_wood = material("Guardian dark wood", (0.20, 0.075, 0.03, 1))
    wood = material("Guardian wood", (0.43, 0.19, 0.065, 1))
    iron = material("Guardian iron", (0.20, 0.23, 0.25, 1), roughness=0.48, metallic=0.72)
    brass = material("Guardian brass", (0.55, 0.32, 0.08, 1), roughness=0.45, metallic=0.5)
    rune = material("Guardian magic", (0.88, 0.43, 0.08, 1), roughness=0.28,
                    emission=(1.0, 0.22, 0.035, 1), emission_strength=2.8)
    dark = material("Guardian eye sockets", (0.025, 0.015, 0.01, 1), roughness=0.4)

    cylinder("body_core", root, (0, 0, 1.05), 0.49, 1.18, dark_wood, 12, bevel=0.065)
    cube("chest_armor", root, (0, -0.37, 1.12), (0.50, 0.12, 0.42), iron, bevel=0.065)
    cylinder("head", root, (0, -0.03, 1.78), 0.35, 0.43, wood, 10, bevel=0.055)
    cube("helmet_brow", root, (0, -0.32, 1.86), (0.38, 0.10, 0.10), iron, bevel=0.035)
    add_eye_pair(root, 1.78, -0.38, 0.14, dark, rune, scale=0.062)
    torus("boss_core_ring", root, (0, -0.51, 1.18), 0.21, 0.038, brass, rotation=(math.pi / 2, 0, 0))
    sphere("boss_core", root, (0, -0.55, 1.18), (0.13, 0.045, 0.13), rune, 14, 8)
    for side in (-1, 1):
        sphere(f"shoulder_{side}", root, (side * 0.60, 0, 1.48), (0.26, 0.30, 0.25), iron, 12, 8)
        cylinder(f"upper_arm_{side}", root, (side * 0.63, 0, 1.08), 0.16, 0.56, dark_wood, 10,
                 rotation=(0, side * 0.12, 0), bevel=0.04)
        cylinder(f"forearm_{side}", root, (side * 0.67, -0.015, 0.63), 0.15, 0.48, wood, 10,
                 rotation=(0, side * 0.08, 0), bevel=0.04)
        sphere(f"fist_{side}", root, (side * 0.69, -0.04, 0.34), (0.22, 0.21, 0.20), iron, 12, 8)
        cylinder(f"leg_{side}", root, (side * 0.25, 0, 0.39), 0.18, 0.56, dark_wood, 10, bevel=0.045)
        cube(f"foot_{side}", root, (side * 0.25, -0.10, 0.12), (0.25, 0.34, 0.12), iron, bevel=0.05)
        cone(f"shoulder_spike_{side}", root, (side * 0.73, 0, 1.73), 0.11, 0.01, 0.32, brass, 8,
             rotation=(0, side * 0.32, 0), bevel=0.012)
    for z in (0.76, 1.45):
        torus(f"reinforcement_{z}", root, (0, 0, z), 0.49, 0.045, iron)
    root["motion_profile"] = "guardian_heavy"
    root["boss"] = True
    return root


BUILDERS = {
    "training-straw-dummy": training_straw_dummy,
    "training-rat": training_rat,
    "old-wooden-instructor": old_wooden_instructor,
    "training-yard-guardian": training_yard_guardian,
}


def scene_metrics(root: bpy.types.Object) -> dict:
    bpy.context.view_layer.update()
    mesh_objects = [obj for obj in root.children_recursive if obj.type == "MESH"]
    triangles = 0
    for obj in mesh_objects:
        depsgraph = bpy.context.evaluated_depsgraph_get()
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    corners = []
    for obj in mesh_objects:
        for corner in obj.bound_box:
            corners.append(obj.matrix_world @ Vector(corner))
    minimum = Vector((min(v.x for v in corners), min(v.y for v in corners), min(v.z for v in corners)))
    maximum = Vector((max(v.x for v in corners), max(v.y for v in corners), max(v.z for v in corners)))
    size = maximum - minimum
    return {
        "triangles": triangles,
        "meshCount": len(mesh_objects),
        "dimensionsBlenderXYZ": [round(size.x, 4), round(size.y, 4), round(size.z, 4)],
        "dimensionsThreeXYZ": [round(size.x, 4), round(size.z, 4), round(size.y, 4)],
        "boundsMinBlender": [round(minimum.x, 4), round(minimum.y, 4), round(minimum.z, 4)],
        "materials": sorted({slot.material.name for obj in mesh_objects for slot in obj.material_slots if slot.material}),
        "root": root.name,
        "origin": [0, 0, 0],
        "animationClips": 0,
    }


def export_asset(slug: str, builder) -> dict:
    reset_scene()
    root = builder()
    root["display_name"] = slug
    metrics = scene_metrics(root)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    blend_path = SOURCE_DIR / f"{slug}.blend"
    glb_path = EXPORT_DIR / f"{slug}.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in root.children_recursive:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_apply=True,
        export_animations=False,
    )
    metrics.update({"blend": str(blend_path), "glb": str(glb_path), "glbBytes": glb_path.stat().st_size})
    return metrics


def main() -> None:
    report = {slug: export_asset(slug, builder) for slug, builder in BUILDERS.items()}
    report_path = SOURCE_DIR / "training-yard-monsters-manifest.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
