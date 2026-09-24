"""Build the editable Rabbitfolk Female V1 character and export a clean GLB.

Run with:
  blender --background --python tools/blender/build_rabbitfolk_female_v1.py

The script creates only character-asset outputs under artifacts/blender/characters.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "artifacts" / "blender" / "characters" / "rabbitfolk_female_v1"
BLEND_PATH = OUT / "rabbitfolk_female_v1.blend"
GLB_PATH = OUT / "rabbitfolk_female_v1.glb"
MANIFEST_PATH = OUT / "rabbitfolk_female_v1_manifest.json"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0:
                datablocks.remove(block)


def material(name, color, roughness=0.72, metallic=0.0):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.use_nodes = True
    bsdf = value.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return value


def collection(name):
    value = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(value)
    return value


def move_to_collection(obj, target):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)


def finish(obj, name, target, parent, mat=None, bevel=0.0):
    obj.name = name
    if obj.data:
        obj.data.name = f"{name}_Mesh"
    move_to_collection(obj, target)
    obj.parent = parent
    if mat is not None:
        obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Edge_Soften", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    if hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def uv(name, location, scale, target, parent, mat, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, target, parent, mat)


def rounded_box(name, location, scale, target, parent, mat, rotation=(0, 0, 0), bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, target, parent, mat, bevel)


def cylinder_between(name, start, end, radius, target, parent, mat, vertices=16, bevel=0.012):
    a, b = Vector(start), Vector(end)
    delta = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=delta.length, location=(a + b) / 2)
    obj = bpy.context.object
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, target, parent, mat, bevel)


def tapered_shell(name, levels, target, parent, mat, segments=20, phase=0.0):
    """Create an elliptical ring-based shell: levels are (z, rx, ry, x, y)."""
    vertices = []
    for z, rx, ry, cx, cy in levels:
        for index in range(segments):
            angle = phase + index * math.tau / segments
            vertices.append((cx + math.cos(angle) * rx, cy + math.sin(angle) * ry, z))
    faces = []
    faces.append(tuple(range(segments - 1, -1, -1)))
    for ring in range(len(levels) - 1):
        offset = ring * segments
        next_offset = (ring + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((offset + index, offset + nxt, next_offset + nxt, next_offset + index))
    top = (len(levels) - 1) * segments
    faces.append(tuple(top + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def ribbon_panel(name, points, thickness, target, parent, mat, bevel=0.012):
    """Create a solid stylized cloth panel from four front-facing corner points."""
    front = [(x, y - thickness / 2, z) for x, y, z in points]
    back = [(x, y + thickness / 2, z) for x, y, z in points]
    vertices = front + back
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("Cloth_Edge_Soften", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    return obj


def ear_mesh(name, side, target, parent, outer_mat, inner_mat):
    # Eight-sided rings create deformation-friendly transverse loops for later ear rigging.
    centers = [
        (0.125 * side, 0.015, 1.915),
        (0.155 * side, 0.030, 2.080),
        (0.185 * side, 0.045, 2.285),
        (0.205 * side, 0.060, 2.465),
        (0.205 * side, 0.065, 2.565),
    ]
    widths = [0.090, 0.115, 0.105, 0.065, 0.012]
    depths = [0.060, 0.072, 0.060, 0.040, 0.012]
    vertices = []
    ring_segments = 8
    for (cx, cy, cz), width, depth in zip(centers, widths, depths):
        for index in range(ring_segments):
            angle = index * math.tau / ring_segments
            vertices.append((cx + math.cos(angle) * width, cy + math.sin(angle) * depth, cz))
    faces = [tuple(range(ring_segments - 1, -1, -1))]
    for ring in range(len(centers) - 1):
        for index in range(ring_segments):
            nxt = (index + 1) % ring_segments
            a = ring * ring_segments + index
            b = ring * ring_segments + nxt
            c = (ring + 1) * ring_segments + nxt
            d = (ring + 1) * ring_segments + index
            faces.append((a, b, c, d))
    faces.append(tuple((len(centers) - 1) * ring_segments + i for i in range(ring_segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    ear = bpy.data.objects.new(name, mesh)
    target.objects.link(ear)
    ear.parent = parent
    ear.data.materials.append(outer_mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True

    # A separate inset panel makes the inner ear replaceable and readable at game distance.
    inner_points = [
        (0.130 * side, -0.054, 1.995),
        (0.175 * side, -0.060, 2.115),
        (0.185 * side, -0.052, 2.405),
        (0.198 * side, -0.044, 2.495),
    ]
    inner_widths = [0.035, 0.060, 0.045, 0.008]
    verts = []
    for point, width in zip(inner_points, inner_widths):
        verts.extend([(point[0] - width, point[1], point[2]), (point[0] + width, point[1], point[2])])
    faces = [(0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6)]
    inner_mesh = bpy.data.meshes.new(f"{name}_Inner_Mesh")
    inner_mesh.from_pydata(verts, [], faces)
    inner_mesh.update()
    inner = bpy.data.objects.new(f"{name}_Inner", inner_mesh)
    target.objects.link(inner)
    inner.parent = parent
    inner.data.materials.append(inner_mat)
    solidify = inner.modifiers.new("Inner_Ear_Thickness", "SOLIDIFY")
    solidify.thickness = 0.008
    bevel = inner.modifiers.new("Inner_Ear_Soften", "BEVEL")
    bevel.width = 0.006
    bevel.segments = 2
    return ear, inner


def hair_lock(name, points, radii, target, parent, mat):
    curve = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = 0.045
    curve.bevel_resolution = 3
    curve.resolution_u = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate, radius in zip(spline.bezier_points, points, radii):
        point.co = coordinate
        point.radius = radius
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    target.objects.link(obj)
    obj.parent = parent
    curve.materials.append(mat)
    return obj


def add_rig_and_dual_dagger_animations(root):
    rig_col = collection("RFV1_Rig")
    weapon_col = collection("RFV1_Weapons")
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "Rabbitfolk_Rig"
    move_to_collection(arm, rig_col)
    arm.data.name = "Rabbitfolk_RigData"
    arm.show_in_front = True
    edit = arm.data.edit_bones
    edit.remove(edit[0])

    def bone(name, head, tail, parent=None):
        b = edit.new(name); b.head = head; b.tail = tail
        if parent: b.parent = edit.get(parent)
        return b

    bone("root", (0,0,0.02), (0,0,0.18))
    bone("hips", (0,0,0.60), (0,0,0.78), "root")
    bone("spine", (0,0,0.78), (0,0,1.02), "hips")
    bone("chest", (0,0,1.02), (0,0,1.14), "spine")
    bone("neck", (0,0,1.14), (0,0,1.20), "chest")
    bone("head", (0,0,1.20), (0,0,1.50), "neck")
    for side, suffix in ((-1,"L"),(1,"R")):
        bone(f"upper_arm.{suffix}", (0.20*side,0,1.03), (0.395*side,-0.005,0.84), "chest")
        bone(f"forearm.{suffix}", (0.395*side,-0.005,0.84), (0.535*side,-0.012,0.70), f"upper_arm.{suffix}")
        bone(f"hand.{suffix}", (0.535*side,-0.012,0.70), (0.63*side,-0.02,0.66), f"forearm.{suffix}")
        bone(f"thigh.{suffix}", (0.125*side,0.02,0.65), (0.13*side,0.015,0.38), "hips")
        bone(f"shin.{suffix}", (0.13*side,0.015,0.38), (0.135*side,0.015,0.16), f"thigh.{suffix}")
        bone(f"foot.{suffix}", (0.135*side,0.015,0.16), (0.135*side,-0.20,0.08), f"shin.{suffix}")
        bone(f"weapon_socket.{suffix}", (0.60*side,-0.02,0.67), (0.60*side,-0.18,0.67), f"hand.{suffix}")
    bone("ear.L", (-0.11,0,1.50), (-0.13,0,1.90), "head")
    bone("ear.R", (0.11,0,1.50), (0.13,0,1.90), "head")
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.parent = root

    # The character is built from separate rigid components. Bone-parent those components so
    # armature animation actually moves the visible body instead of only moving invisible bones.
    groups = {
        "head": ("Head_", "Face_", "Hair_"),
        "ear.L": ("Ear_L",), "ear.R": ("Ear_R",),
        "upper_arm.L": ("Body_UpperArm_L",), "upper_arm.R": ("Body_UpperArm_R",),
        "forearm.L": ("Body_Forearm_L", "Body_Elbow_L"), "forearm.R": ("Body_Forearm_R", "Body_Elbow_R"),
        "hand.L": ("Body_Hand_L", "Body_Thumb_L"), "hand.R": ("Body_Hand_R", "Body_Thumb_R"),
        "thigh.L": ("Body_Thigh_L",), "thigh.R": ("Body_Thigh_R",),
        "shin.L": ("Body_Shin_L", "Body_Knee_L"), "shin.R": ("Body_Shin_R", "Body_Knee_R"),
        "foot.L": ("Body_RabbitFoot_L", "Body_ToePad_L"), "foot.R": ("Body_RabbitFoot_R", "Body_ToePad_R"),
        "spine": ("Body_Torso", "Outfit_Tunic", "Outfit_ChestInset", "Outfit_Collar"),
        "hips": ("Body_Pelvis", "Body_Tail", "Outfit_WaistSash", "Outfit_SashEmblem", "Outfit_Skirt"),
        "upper_arm.L": ("Body_UpperArm_L", "Outfit_Shoulder_L", "Outfit_Sleeve_L"),
        "upper_arm.R": ("Body_UpperArm_R", "Outfit_Shoulder_R", "Outfit_Sleeve_R"),
        "forearm.L": ("Body_Forearm_L", "Body_Elbow_L", "Outfit_ForearmCuff_L"),
        "forearm.R": ("Body_Forearm_R", "Body_Elbow_R", "Outfit_ForearmCuff_R"),
        "thigh.L": ("Body_Thigh_L", "Outfit_Legging_L"), "thigh.R": ("Body_Thigh_R", "Outfit_Legging_R"),
        "foot.L": ("Body_RabbitFoot_L", "Body_ToePad_L", "Outfit_RabbitBoot_L", "Outfit_BootSole_L", "Outfit_AnkleBand_L"),
        "foot.R": ("Body_RabbitFoot_R", "Body_ToePad_R", "Outfit_RabbitBoot_R", "Outfit_BootSole_R", "Outfit_AnkleBand_R"),
    }
    for bone_name, prefixes in groups.items():
        for obj in list(root.children_recursive):
            if obj.type != "MESH" or not obj.name.startswith(prefixes):
                continue
            world = obj.matrix_world.copy()
            obj.parent = arm
            obj.parent_type = "BONE"
            obj.parent_bone = bone_name
            obj.matrix_world = world

    metal = material("DaggerMetal", (0.55,0.68,0.78), 0.32)
    grip = material("DaggerGrip", (0.08,0.11,0.15), 0.72)
    for side, suffix in ((-1,"L"),(1,"R")):
        holder = bpy.data.objects.new(f"Weapon_Dagger_{suffix}", None); weapon_col.objects.link(holder)
        holder.parent=arm; holder.parent_type="BONE"; holder.parent_bone=f"weapon_socket.{suffix}"
        # Reverse-grip rogue stance: dagger sits inside the fist and blade runs back along forearm.
        holder.rotation_euler = (math.radians(8), 0, math.radians(-10 * side))
        holder.location = (0, 0.015, -0.005)
        rounded_box(f"Weapon_DaggerBlade_{suffix}", (0,-0.16,0), (0.032,0.18,0.018), weapon_col, holder, metal, bevel=0.012)
        rounded_box(f"Weapon_DaggerGuard_{suffix}", (0,0,0), (0.070,0.022,0.022), weapon_col, holder, metal, bevel=0.010)
        rounded_box(f"Weapon_DaggerGrip_{suffix}", (0,0.075,0), (0.025,0.080,0.025), weapon_col, holder, grip, bevel=0.010)

    def make_action(name, frames, keys):
        act = bpy.data.actions.new(name)
        # Blender 4.4+/5.x actions use layered slots. Assigning the action first makes
        # PoseBone.keyframe_insert create a channelbag/slot that the glTF exporter can see.
        arm.animation_data_create()
        arm.animation_data.action = act
        for frame, poses in keys.items():
            for bn, rot in poses.items():
                pb = arm.pose.bones[bn]
                pb.rotation_mode = "XYZ"
                pb.rotation_euler = rot
                pb.keyframe_insert("rotation_euler", frame=frame, group=bn)
        # Blender 5.x layered Actions no longer expose Action.fcurves directly.
        # PoseBone keyframes still export correctly; keep the action alive for NLA/glTF.
        act.use_fake_user = True
        arm.animation_data.action = None

    # Living chibi locomotion: subtle breathing/weight shift, then a low rogue run.
    make_action("dagger_idle",48,{
        1:{"hips":(0,0,-0.035),"spine":(-0.015,0,0.025),"chest":(0.025,0,-0.02),"head":(-0.015,0,0.015),"upper_arm.L":(0.18,-0.08,-0.42),"forearm.L":(-0.18,0,-0.08),"upper_arm.R":(0.18,0.08,0.42),"forearm.R":(-0.18,0,0.08)},
        12:{"hips":(0.018,0,0.015),"spine":(-0.005,0,-0.018),"chest":(0.045,0,0.018),"head":(-0.025,0,-0.012),"upper_arm.L":(0.15,-0.06,-0.39),"forearm.L":(-0.22,0,-0.06),"upper_arm.R":(0.15,0.06,0.39),"forearm.R":(-0.22,0,0.06)},
        24:{"hips":(0,0,0.035),"spine":(0.012,0,-0.025),"chest":(0.012,0,0.02),"head":(0.008,0,-0.015),"upper_arm.L":(0.20,-0.08,-0.43),"forearm.L":(-0.16,0,-0.08),"upper_arm.R":(0.20,0.08,0.43),"forearm.R":(-0.16,0,0.08)},
        36:{"hips":(-0.015,0,-0.012),"spine":(-0.004,0,0.015),"chest":(0.04,0,-0.015),"head":(-0.02,0,0.01),"upper_arm.L":(0.16,-0.06,-0.40),"forearm.L":(-0.21,0,-0.06),"upper_arm.R":(0.16,0.06,0.40),"forearm.R":(-0.21,0,0.06)},
        48:{"hips":(0,0,-0.035),"spine":(-0.015,0,0.025),"chest":(0.025,0,-0.02),"head":(-0.015,0,0.015),"upper_arm.L":(0.18,-0.08,-0.42),"forearm.L":(-0.18,0,-0.08),"upper_arm.R":(0.18,0.08,0.42),"forearm.R":(-0.18,0,0.08)}})
    make_action("dagger_run",24,{
        1:{"hips":(0.10,0,0.08),"spine":(0.13,0,-0.06),"chest":(0.10,0,0.12),"head":(-0.08,0,-0.05),"upper_arm.L":(0.58,-0.12,-0.52),"forearm.L":(-0.52,0,-0.12),"upper_arm.R":(-0.38,0.10,0.48),"forearm.R":(-0.38,0,0.10),"thigh.L":(0.58,0,0),"shin.L":(-0.45,0,0),"thigh.R":(-0.48,0,0),"shin.R":(0.58,0,0)},
        7:{"hips":(-0.05,0,0),"spine":(0.10,0,0),"chest":(0.08,0,0),"head":(-0.05,0,0),"thigh.L":(0.05,0,0),"shin.L":(0.28,0,0),"thigh.R":(-0.05,0,0),"shin.R":(0.28,0,0)},
        13:{"hips":(0.10,0,-0.08),"spine":(0.13,0,0.06),"chest":(0.10,0,-0.12),"head":(-0.08,0,0.05),"upper_arm.L":(-0.38,-0.10,-0.48),"forearm.L":(-0.38,0,-0.10),"upper_arm.R":(0.58,0.12,0.52),"forearm.R":(-0.52,0,0.12),"thigh.L":(-0.48,0,0),"shin.L":(0.58,0,0),"thigh.R":(0.58,0,0),"shin.R":(-0.45,0,0)},
        19:{"hips":(-0.05,0,0),"spine":(0.10,0,0),"chest":(0.08,0,0),"head":(-0.05,0,0),"thigh.L":(-0.05,0,0),"shin.L":(0.28,0,0),"thigh.R":(0.05,0,0),"shin.R":(0.28,0,0)},
        24:{"hips":(0.10,0,0.08),"spine":(0.13,0,-0.06),"chest":(0.10,0,0.12),"head":(-0.08,0,-0.05),"upper_arm.L":(0.58,-0.12,-0.52),"forearm.L":(-0.52,0,-0.12),"upper_arm.R":(-0.38,0.10,0.48),"forearm.R":(-0.38,0,0.10),"thigh.L":(0.58,0,0),"shin.L":(-0.45,0,0),"thigh.R":(-0.48,0,0),"shin.R":(0.58,0,0)}})

    # Dual-dagger combo uses anticipation -> fast contact -> overshoot -> recovery.
    make_action("dagger_attack_01",16,{
        1:{"hips":(0.08,0,-0.30),"spine":(0.10,0,-0.22),"chest":(0.06,0,-0.42),"head":(-0.05,0,0.20),"upper_arm.R":(-0.58,0.18,0.82),"forearm.R":(-0.72,0,0.30),"upper_arm.L":(0.28,-0.12,-0.45),"forearm.L":(-0.35,0,-0.12),"thigh.L":(0.18,0,0),"thigh.R":(-0.12,0,0)},
        4:{"hips":(0.16,0,-0.48),"spine":(0.18,0,-0.35),"chest":(0.10,0,-0.62),"head":(-0.08,0,0.28),"upper_arm.R":(-0.78,0.22,1.05),"forearm.R":(-0.88,0,0.42)},
        7:{"hips":(-0.04,0,0.34),"spine":(0.03,0,0.42),"chest":(-0.02,0,0.82),"head":(0.02,0,-0.25),"upper_arm.R":(0.38,-0.16,-1.12),"forearm.R":(-0.18,0,-0.48),"upper_arm.L":(0.18,-0.08,-0.25)},
        10:{"hips":(-0.02,0,0.42),"spine":(0.02,0,0.35),"chest":(0.02,0,0.62),"head":(0.02,0,-0.18),"upper_arm.R":(0.28,-0.10,-0.82),"forearm.R":(-0.12,0,-0.30)},
        16:{"hips":(0,0,0),"spine":(0,0,0),"chest":(0.025,0,0),"head":(-0.015,0,0),"upper_arm.L":(0.18,-0.08,-0.42),"forearm.L":(-0.18,0,-0.08),"upper_arm.R":(0.18,0.08,0.42),"forearm.R":(-0.18,0,0.08)}})
    make_action("dagger_attack_02",16,{
        1:{"hips":(0.05,0,0.34),"spine":(0.08,0,0.28),"chest":(0.04,0,0.48),"head":(-0.04,0,-0.22),"upper_arm.L":(-0.55,-0.18,-0.85),"forearm.L":(-0.70,0,-0.32),"upper_arm.R":(0.24,0.10,0.36),"forearm.R":(-0.30,0,0.10)},
        4:{"hips":(0.14,0,0.50),"spine":(0.16,0,0.38),"chest":(0.08,0,0.66),"head":(-0.07,0,-0.28),"upper_arm.L":(-0.76,-0.22,-1.08),"forearm.L":(-0.86,0,-0.44)},
        7:{"hips":(-0.05,0,-0.36),"spine":(0.02,0,-0.44),"chest":(-0.02,0,-0.84),"head":(0.02,0,0.26),"upper_arm.L":(0.40,0.16,1.15),"forearm.L":(-0.16,0,0.48),"upper_arm.R":(0.16,0.08,0.24)},
        10:{"hips":(-0.02,0,-0.44),"spine":(0.02,0,-0.36),"chest":(0.02,0,-0.64),"head":(0.02,0,0.18),"upper_arm.L":(0.30,0.10,0.84),"forearm.L":(-0.10,0,0.30)},
        16:{"hips":(0,0,0),"spine":(0,0,0),"chest":(0.025,0,0),"head":(-0.015,0,0),"upper_arm.L":(0.18,-0.08,-0.42),"forearm.L":(-0.18,0,-0.08),"upper_arm.R":(0.18,0.08,0.42),"forearm.R":(-0.18,0,0.08)}})
    make_action("dagger_attack_03",22,{
        1:{"hips":(0.16,0,-0.18),"spine":(0.18,0,-0.12),"chest":(0.14,0,-0.22),"head":(-0.10,0,0.08),"upper_arm.L":(-0.40,-0.22,-0.78),"forearm.L":(-0.62,0,-0.24),"upper_arm.R":(-0.40,0.22,0.78),"forearm.R":(-0.62,0,0.24),"thigh.L":(0.20,0,0),"thigh.R":(0.20,0,0)},
        5:{"hips":(0.24,0,-0.30),"spine":(0.26,0,-0.18),"chest":(0.20,0,-0.34),"head":(-0.13,0,0.12),"upper_arm.L":(-0.68,-0.28,-1.00),"forearm.L":(-0.82,0,-0.35),"upper_arm.R":(-0.68,0.28,1.00),"forearm.R":(-0.82,0,0.35)},
        9:{"hips":(-0.08,0,0.05),"spine":(-0.02,0,0.02),"chest":(-0.08,0,0.04),"head":(0.04,0,-0.02),"upper_arm.L":(0.42,0.08,0.98),"forearm.L":(-0.05,0,0.42),"upper_arm.R":(0.42,-0.08,-0.98),"forearm.R":(-0.05,0,-0.42),"thigh.L":(-0.10,0,0),"thigh.R":(-0.10,0,0)},
        13:{"hips":(-0.04,0,0.10),"spine":(0.02,0,0.08),"chest":(0.02,0,0.14),"head":(0.02,0,-0.06),"upper_arm.L":(0.30,0.05,0.72),"forearm.L":(-0.10,0,0.28),"upper_arm.R":(0.30,-0.05,-0.72),"forearm.R":(-0.10,0,-0.28)},
        22:{"hips":(0,0,0),"spine":(0,0,0),"chest":(0.025,0,0),"head":(-0.015,0,0),"upper_arm.L":(0.18,-0.08,-0.42),"forearm.L":(-0.18,0,-0.08),"upper_arm.R":(0.18,0.08,0.42),"forearm.R":(-0.18,0,0.08)}})
    arm.animation_data.action = None
    # Export each named action explicitly through NLA. This avoids Blender 5.x action-slot
    # discovery differences and guarantees five independent glTF animation clips.
    for action_name in ("dagger_idle", "dagger_run", "dagger_attack_01", "dagger_attack_02", "dagger_attack_03"):
        act = bpy.data.actions[action_name]
        track = arm.animation_data.nla_tracks.new()
        track.name = action_name
        strip = track.strips.new(action_name, 1, act)
        strip.action_frame_start = 1
    return arm


def build_character():
    reset_scene()
    OUT.mkdir(parents=True, exist_ok=True)

    skin = material("Skin", (0.94, 0.76, 0.68), 0.76)
    inner_ear = material("InnerEar", (0.82, 0.45, 0.53), 0.82)
    hair = material("HairSilver", (0.86, 0.91, 0.96), 0.63)
    eye_white = material("EyeWhite", (0.96, 0.98, 1.0), 0.42)
    eye_dark = material("EyeBlueDark", (0.07, 0.16, 0.24), 0.38)
    outfit_blue = material("OutfitBlue", (0.34, 0.67, 0.82), 0.72)
    outfit_light = material("OutfitLight", (0.82, 0.93, 0.96), 0.76)
    outfit_accent = material("OutfitAccent", (0.12, 0.30, 0.45), 0.68)
    boot_dark = material("BootDark", (0.10, 0.18, 0.24), 0.82)

    root = bpy.data.objects.new("Rabbitfolk_Female", None)
    bpy.context.scene.collection.objects.link(root)
    root["asset_name"] = "Rabbitfolk Female V1"
    root["asset_version"] = "1.1-chibi-eyes"
    root["pose"] = "A-pose"
    root["forward_blender"] = "-Y"
    root["intended_use"] = "future rigging, equipment and real-time animation"

    body_col = collection("RFV1_Body")
    head_col = collection("RFV1_Head")
    face_col = collection("RFV1_Face_Details")
    ears_col = collection("RFV1_Ears")
    hair_col = collection("RFV1_Hair")
    outfit_col = collection("RFV1_Outfit")
    accessory_col = collection("RFV1_Accessories")

    # True chibi foundation: oversized head, compact torso, narrow shoulders and short limbs.
    tapered_shell("Body_Torso", [
        (0.72, 0.205, 0.145, 0, 0.01),
        (0.84, 0.220, 0.150, 0, 0.00),
        (1.02, 0.255, 0.158, 0, 0.00),
        (1.10, 0.225, 0.145, 0, 0.00),
    ], body_col, root, skin)
    tapered_shell("Body_Pelvis", [
        (0.61, 0.205, 0.150, 0, 0.02),
        (0.70, 0.230, 0.160, 0, 0.02),
        (0.77, 0.205, 0.145, 0, 0.01),
    ], body_col, root, skin)
    cylinder_between("Body_Neck", (0, 0, 1.08), (0, 0, 1.14), 0.060, body_col, root, skin, 20, 0.008)

    # A-pose limbs use multiple ringed segments at all future deformation joints.
    for side, suffix in ((-1, "L"), (1, "R")):
        shoulder = (0.235 * side, 0.0, 1.00)
        elbow = (0.395 * side, -0.005, 0.84)
        wrist = (0.535 * side, -0.012, 0.70)
        cylinder_between(f"Body_UpperArm_{suffix}", shoulder, elbow, 0.072, body_col, root, skin, 16, 0.014)
        uv(f"Body_Elbow_{suffix}", elbow, (0.078, 0.072, 0.078), body_col, root, skin, 20, 12)
        cylinder_between(f"Body_Forearm_{suffix}", elbow, wrist, 0.064, body_col, root, skin, 16, 0.012)
        hand = uv(f"Body_Hand_{suffix}", (0.585 * side, -0.020, 0.665), (0.082, 0.060, 0.095), body_col, root, skin, 20, 12)
        hand.rotation_euler[1] = math.radians(16 * side)
        uv(f"Body_Thumb_{suffix}", (0.555 * side, -0.062, 0.670), (0.032, 0.026, 0.048), body_col, root, skin, 16, 10)

        hip = (0.125 * side, 0.02, 0.65)
        knee = (0.130 * side, 0.015, 0.38)
        ankle = (0.135 * side, 0.015, 0.16)
        cylinder_between(f"Body_Thigh_{suffix}", hip, knee, 0.105, body_col, root, skin, 18, 0.016)
        uv(f"Body_Knee_{suffix}", knee, (0.108, 0.100, 0.105), body_col, root, skin, 20, 12)
        cylinder_between(f"Body_Shin_{suffix}", knee, ankle, 0.080, body_col, root, skin, 18, 0.014)
        uv(f"Body_RabbitFoot_{suffix}", (0.135 * side, -0.105, 0.100), (0.130, 0.215, 0.100), body_col, root, skin, 24, 14)
        uv(f"Body_ToePad_{suffix}", (0.135 * side, -0.245, 0.080), (0.120, 0.105, 0.070), body_col, root, skin, 20, 12)

    # Chibi graphic face: large round head, short lower face, huge low-set dark-blue eyes.
    head = uv("Head_Base", (0, -0.006, 1.34), (0.285, 0.235, 0.275), head_col, root, skin, 32, 20)
    for side, suffix in ((-1, "L"), (1, "R")):
        uv(f"Face_EyeBacking_{suffix}", (0.095 * side, -0.235, 1.335), (0.075, 0.012, 0.094), face_col, root, eye_white, 20, 12)
        uv(f"Face_Iris_{suffix}", (0.095 * side, -0.246, 1.330), (0.065, 0.010, 0.084), face_col, root, eye_dark, 20, 12)
        uv(f"Face_EyeHighlight_{suffix}", (0.075 * side, -0.255, 1.362), (0.013, 0.004, 0.018), face_col, root, eye_white, 12, 8)
        uv(f"Face_EyeHighlightSmall_{suffix}", (0.113 * side, -0.255, 1.310), (0.006, 0.003, 0.008), face_col, root, eye_white, 10, 6)
        rounded_box(f"Face_UpperLid_{suffix}", (0.095 * side, -0.258, 1.398), (0.072, 0.006, 0.009), face_col, root, hair,
                    rotation=(0, 0, math.radians(2 * side)), bevel=0.007)
    uv("Face_Nose", (0, -0.247, 1.245), (0.010, 0.008, 0.009), face_col, root, inner_ear, 14, 8)
    hair_lock("Face_Mouth", [(-0.014, -0.249, 1.210), (0, -0.252, 1.207), (0.014, -0.249, 1.210)], [0.10, 0.08, 0.10], face_col, root, eye_dark)
    bpy.data.objects["Face_Mouth"].data.bevel_depth = 0.0035

    ear_l, ear_l_inner = ear_mesh("Ear_L", -1, ears_col, root, hair, inner_ear)
    ear_r, ear_r_inner = ear_mesh("Ear_R", 1, ears_col, root, hair, inner_ear)
    # Ear generator was authored for the taller V1; move the complete ear pairs down onto the chibi skull.
    for ear_part in (ear_l, ear_l_inner, ear_r, ear_r_inner):
        ear_part.location.z -= 0.34

    # Hair rebuilt around the lower/larger chibi head.
    uv("Hair_BackMass", (0, 0.105, 1.28), (0.290, 0.185, 0.315), hair_col, root, hair, 28, 18)
    uv("Hair_Crown", (0, 0.005, 1.515), (0.270, 0.205, 0.135), hair_col, root, hair, 28, 16)
    for side, suffix in ((-1, "L"), (1, "R")):
        hair_lock(f"Hair_SideLock_{suffix}", [(0.215 * side, -0.10, 1.50), (0.260 * side, -0.12, 1.28), (0.235 * side, -0.10, 1.02)], [1.40, 1.15, 0.45], hair_col, root, hair)
        hair_lock(f"Hair_RearLock_{suffix}", [(0.190 * side, 0.15, 1.46), (0.260 * side, 0.18, 1.20), (0.205 * side, 0.15, 0.92)], [1.45, 1.20, 0.45], hair_col, root, hair)
    hair_lock("Hair_RearCenter", [(0, 0.19, 1.48), (0, 0.23, 1.18), (0, 0.18, 0.88)], [1.60, 1.35, 0.50], hair_col, root, hair)
    hair_lock("Hair_Fringe_L", [(-0.18, -0.15, 1.55), (-0.10, -0.225, 1.48), (-0.045, -0.235, 1.39)], [1.15, 0.88, 0.30], hair_col, root, hair)
    hair_lock("Hair_Fringe_R", [(0.17, -0.15, 1.55), (0.11, -0.225, 1.48), (0.135, -0.232, 1.39)], [1.12, 0.85, 0.30], hair_col, root, hair)
    hair_lock("Hair_Fringe_Center", [(0.015, -0.18, 1.57), (-0.010, -0.240, 1.50), (-0.020, -0.242, 1.43)], [0.85, 0.65, 0.22], hair_col, root, hair)

    # Compact chibi outfit follows the rebuilt body rather than the old tall silhouette.
    tapered_shell("Outfit_Tunic", [
        (0.70, 0.225, 0.160, 0, 0.005),
        (0.82, 0.235, 0.165, 0, 0.000),
        (1.00, 0.270, 0.170, 0, 0.000),
        (1.09, 0.240, 0.150, 0, 0.000),
    ], outfit_col, root, outfit_blue)
    ribbon_panel("Outfit_ChestInset", [(-0.10, -0.170, 1.02), (0.10, -0.170, 1.02), (0.075, -0.178, 0.82), (-0.075, -0.178, 0.82)],
                 0.018, outfit_col, root, outfit_light, 0.010)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.082, minor_radius=0.016, major_segments=24, minor_segments=8,
                                    location=(0, 0, 1.105))
    finish(bpy.context.object, "Outfit_Collar", outfit_col, root, outfit_light)
    rounded_box("Outfit_WaistSash", (0, 0, 0.765), (0.245, 0.165, 0.042), outfit_col, root, outfit_accent, bevel=0.025)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.046, minor_radius=0.014, major_segments=20, minor_segments=8,
                                    location=(0, -0.180, 0.765), rotation=(math.pi / 2, 0, 0))
    finish(bpy.context.object, "Outfit_SashEmblem", accessory_col, root, outfit_light)

    # Wider short skirt gives the reference-like doll silhouette.
    ribbon_panel("Outfit_SkirtFront", [(-0.245, -0.13, 0.75), (0.245, -0.13, 0.75), (0.275, -0.215, 0.49), (-0.275, -0.215, 0.49)],
                 0.035, outfit_col, root, outfit_blue, 0.018)
    ribbon_panel("Outfit_SkirtBack", [(0.245, 0.13, 0.75), (-0.245, 0.13, 0.75), (-0.275, 0.21, 0.50), (0.275, 0.21, 0.50)],
                 0.035, outfit_col, root, outfit_light, 0.018)
    for side, suffix in ((-1, "L"), (1, "R")):
        ribbon_panel(f"Outfit_SkirtSide_{suffix}", [
            (0.225 * side, -0.08, 0.75), (0.280 * side, 0.08, 0.74),
            (0.315 * side, 0.09, 0.51), (0.275 * side, -0.10, 0.48),
        ], 0.030, outfit_col, root, outfit_light, 0.015)
        uv(f"Outfit_Shoulder_{suffix}", (0.245 * side, 0, 0.99), (0.100, 0.100, 0.095), outfit_col, root, outfit_light, 20, 12)
        cylinder_between(f"Outfit_Sleeve_{suffix}", (0.285 * side, 0, 0.95), (0.390 * side, -0.005, 0.84), 0.087,
                         outfit_col, root, outfit_blue, 18, 0.018)
        cylinder_between(f"Outfit_ForearmCuff_{suffix}", (0.420 * side, -0.008, 0.81), (0.485 * side, -0.010, 0.745), 0.075,
                         outfit_col, root, outfit_light, 18, 0.014)
        cylinder_between(f"Outfit_Legging_{suffix}", (0.125 * side, 0.02, 0.60), (0.135 * side, 0.015, 0.22), 0.110,
                         outfit_col, root, outfit_light, 18, 0.012)
        uv(f"Outfit_RabbitBoot_{suffix}", (0.135 * side, -0.115, 0.100), (0.140, 0.225, 0.110), outfit_col, root, outfit_blue, 24, 14)
        rounded_box(f"Outfit_BootSole_{suffix}", (0.135 * side, -0.125, 0.035), (0.137, 0.215, 0.035), outfit_col, root, boot_dark, bevel=0.025)
        cylinder_between(f"Outfit_AnkleBand_{suffix}", (0.135 * side, 0.015, 0.15), (0.135 * side, 0.015, 0.22), 0.112,
                         outfit_col, root, outfit_accent, 18, 0.012)

    # Small species-defining tail; separate so future outfits can hide or replace it.
    uv("Body_Tail", (0, 0.220, 0.66), (0.105, 0.100, 0.105), body_col, root, hair, 20, 14)

    # Apply export-facing modifiers and curve conversion while retaining semantic objects.
    bpy.context.view_layer.objects.active = None
    for obj in list(bpy.context.scene.objects):
        if obj.type == "CURVE":
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
            obj.select_set(False)
        elif obj.type == "MESH":
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            obj.select_set(False)

    # Recalculate outward normals and ensure every transform is export-safe.
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        obj.select_set(False)

    # Bevels can extend a few millimetres below their construction plane. Shift
    # component data—not the root transform—so the canonical root remains at
    # the origin while the evaluated character rests exactly on Z=0.
    world_corners = [obj.matrix_world @ Vector(corner) for obj in root.children_recursive if obj.type == "MESH" for corner in obj.bound_box]
    ground_offset = -min(corner.z for corner in world_corners)
    if abs(ground_offset) > 1e-6:
        for obj in root.children_recursive:
            if obj.type == "MESH":
                for vertex in obj.data.vertices:
                    vertex.co.z += ground_offset

    # Add the reusable humanoid rig, dual-dagger sockets/assets and first combat animation set.
    armature = add_rig_and_dual_dagger_animations(root)
    root["asset_version"] = "1.2-dual-dagger-rig"

    # Scene contains the asset only: no camera/lights/reference meshes.
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene["asset_forward"] = "Blender -Y; glTF +Z after axis conversion"
    bpy.context.scene["ground_level"] = 0.0

    generic = [obj.name for obj in bpy.context.scene.objects if obj.name.startswith(("Cube", "Sphere", "Cylinder", "BezierCurve"))]
    if generic:
        raise RuntimeError(f"Generic object names remain: {generic}")

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in root.children_recursive:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_animations=True,
        export_nla_strips=True,
        export_animation_mode='NLA_TRACKS',
    )

    depsgraph = bpy.context.evaluated_depsgraph_get()
    bounds = [Vector(corner) for obj in root.children_recursive if obj.type == "MESH" for corner in obj.bound_box]
    world_bounds = [obj.matrix_world @ Vector(corner) for obj in root.children_recursive if obj.type == "MESH" for corner in obj.bound_box]
    min_v = Vector((min(v.x for v in world_bounds), min(v.y for v in world_bounds), min(v.z for v in world_bounds)))
    max_v = Vector((max(v.x for v in world_bounds), max(v.y for v in world_bounds), max(v.z for v in world_bounds)))
    triangles = 0
    for obj in root.children_recursive:
        if obj.type == "MESH":
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            evaluated.to_mesh_clear()
    manifest = {
        "asset": "Rabbitfolk Female V1",
        "blend": str(BLEND_PATH),
        "glb": str(GLB_PATH),
        "glbBytes": GLB_PATH.stat().st_size,
        "root": root.name,
        "pose": "A-pose",
        "forwardBlender": "-Y",
        "groundMinZ": round(min_v.z, 4),
        "dimensionsBlenderXYZ": [round(v, 4) for v in (max_v - min_v)],
        "triangles": triangles,
        "meshObjects": sum(1 for obj in root.children_recursive if obj.type == "MESH"),
        "materials": sorted({slot.material.name for obj in root.children_recursive if obj.type == "MESH" for slot in obj.material_slots if slot.material}),
        "armatures": 1,
        "animationClips": 5,
        "cameras": 0,
        "lights": 0,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    build_character()
