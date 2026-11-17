"""Create the female hand pair from the approved editable hand study."""

import argparse
from math import radians
from pathlib import Path
import runpy
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parent


def smooth(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def hand_profile(points, side, fingers):
    """Reshape the skeleton, skin and every corrective key in the same space."""
    x, y, z = points.T
    radial = side * x
    from_wrist = y + .003
    width = .856 + .045 * smooth(-.010, .071, y) + .045 * smooth(.101, .159, y)
    depth = .828 + .060 * smooth(-.012, .068, y) + .049 * smooth(.097, .155, y)
    length = from_wrist * (.965 - .045 * smooth(-.028, .046, from_wrist))
    length += .023 * (from_wrist - .094) * smooth(.090, .126, from_wrist)

    # The palmar pads keep their shape as the wrist and first web narrow.
    thenar = smooth(.021, .049, radial) * np.exp(-((y - .052) / .027)**2)
    new_x = radial * width - .0013 * thenar
    new_y = length - .003
    new_z = z * depth - .00055 * thenar * smooth(.005, .019, z)

    # Taper the phalanges around their own joint axes. A whole-hand scale
    # would shrink the spacing between the fingers along with the pads.
    for finger, tip_breadth in zip(fingers[:4], (.069, .061, .077, .085)):
        center_x, center_y, center_z = np.array(finger.points).T
        dx = radial - np.interp(y, center_y, center_x)
        dz = z - np.interp(y, center_y, center_z)
        near = 1 - smooth(.010, .016, np.abs(dx))
        distal = smooth(center_y[0] + .012, center_y[2], y)
        taper = tip_breadth * near * distal
        new_x -= taper * dx
        new_z -= taper * .75 * dz

    thumb_x, thumb_y, thumb_z = np.array(fingers[-1].points).T
    dy = y - np.interp(radial, thumb_x, thumb_y)
    dz = z - np.interp(radial, thumb_x, thumb_z)
    distal = smooth(.051, .075, radial) * (1 - smooth(.012, .024, np.abs(dy)))
    new_z -= .058 * distal * dz
    new_y -= .066 * distal * dy
    return np.column_stack((side * new_x, new_y, new_z))


def reshape_mesh(mesh, side, fingers):
    attributes = [mesh.vertices]
    if mesh.shape_keys:
        attributes.extend(key.data for key in mesh.shape_keys.key_blocks)
    for vertices in attributes:
        coordinates = np.empty((len(vertices), 3), dtype=np.float32)
        vertices.foreach_get("co", coordinates.ravel())
        adjusted = hand_profile(coordinates.astype(np.float64), side, fingers)
        vertices.foreach_set("co", adjusted.astype(np.float32).ravel())
    mesh.update()


def reshape_bones(rig, side, study):
    study["use_object"](rig)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = rig.data.edit_bones
    placements = {}
    for bone in bones:
        points = np.array((bone.head, bone.tail, bone.head + .01 * bone.z_axis))
        head, tail, roll_reference = hand_profile(points, side, study["FINGERS"])
        placements[bone.name] = (head, tail, Vector(roll_reference - head))
    for name, (head, tail, roll) in placements.items():
        bone = bones[name]
        bone.head, bone.tail = head, tail
        bone.align_roll(roll)
    bpy.ops.object.mode_set(mode="OBJECT")


def shape_nails(rig, skin, fingers, suffix):
    surface = BVHTree.FromPolygons([v.co for v in skin.data.vertices],
                                  [face.vertices for face in skin.data.polygons])
    for finger in fingers:
        nail = bpy.data.objects[f"{finger.name} nail.{suffix}"]
        bone = rig.data.bones[finger.joints[-1]]
        start = bone.head_local
        axes = bone.matrix_local.to_3x3()
        lateral, along, palm = [axes.col[i].copy().normalized() for i in range(3)]
        color = nail.data.color_attributes["Nail tone"]
        for vertex in nail.data.vertices:
            relative = vertex.co - start
            t = (relative.dot(along) / bone.length - .20) / .74
            oval = 1 - .15 * smooth(.67, 1, t) - .05 * (1 - smooth(0, .23, t))
            across = relative.dot(lateral) * oval
            sample = start + along * relative.dot(along) + lateral * across
            hit, normal, _, _ = surface.ray_cast(sample - .033 * palm, palm, .066)
            if hit is None or (hit - vertex.co).length > .004:
                raise RuntimeError(f"{nail.name}: nail outline left its fingertip")
            lift = min(.00039, max(.00007, (vertex.co - hit).dot(normal)))
            vertex.co = hit + normal * lift
            red, green, blue, alpha = color.data[vertex.index].color
            color.data[vertex.index].color = (red + .019, green + .012, blue + .012, alpha)
        nail.data.update()


def allow_fist_clearance(rig, side):
    # Ease only strong thumb opposition so its pad clears the index knuckle.
    path = rig.pose.bones["Thumb.CMC"].path_from_id("rotation_euler")
    roll = rig.animation_data.drivers.find(path, index=1).driver
    start, span = radians(22), radians(6)
    amount = side * radians(1.5)
    roll.expression = f"y+({amount})*min(1,max(0,(-y*({side})-{start})/{span}))"


def prepare_pair(scene, study):
    scene.name = "Female hands | Articulation"
    hands = []
    for suffix, side, label in (("R", 1, "Right hand"), ("L", -1, "Left hand")):
        rig = bpy.data.objects[f"Hand rig.{suffix}"]
        skin = bpy.data.objects[f"Continuous hand skin.{suffix}"]
        for part in rig.children_recursive:
            if part.type == "MESH":
                reshape_mesh(part.data, side, study["FINGERS"])
        reshape_bones(rig, side, study)
        allow_fist_clearance(rig, side)
        shape_nails(rig, skin, study["FINGERS"], suffix)
        # The slimmer thenar pad allows more inward swing at the spacebar.
        rig["Typing thumb minimum yaw"] = -14.0
        group = scene.collection.children[label]
        group.asset_mark()
        group.asset_data.description = f"{label} of the female pair with deform rig, skin corrections and nails."
        hands.append(rig)

    nail_material = bpy.data.materials["Nails · translucency and free edge"]
    nail_material.name = "Natural oval nails · translucent nail bed"
    nail_material.diffuse_color = (.54, .324, .275, 1)
    guide = bpy.data.texts["Hand pose guide"]
    guide.write("\nFEMALE HAND PAIR\n"
                "This study derives from the approved first-person hand file. "
                "Each hand has an independent skeleton and follows the same pose controls.\n"
                "The hand collections can be appended independently.\n")
    scene.frame_set(28)
    study["use_object"](bpy.data.objects["Continuous hand skin.R"])
    return hands


def export_rest_hands(hands, directory):
    directory.mkdir(parents=True, exist_ok=True)
    for label, rig in zip(("right", "left"), hands):
        rig.animation_data.action = None
        rig.location = -rig.data.bones["Wrist"].head_local
        rig.rotation_euler = (0, 0, 0)
        for bone in rig.pose.bones:
            bone.rotation_euler = (0, 0, 0)
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        for part in rig.children_recursive:
            if not part.name.startswith("Cuff preview."):
                part.select_set(True)
        bpy.context.view_layer.update()
        bpy.ops.export_scene.fbx(filepath=str(directory / f"female-hand-{label}.fbx"),
                                 use_selection=True, object_types={"ARMATURE", "MESH"},
                                 add_leaf_bones=False, use_mesh_modifiers=False,
                                 bake_anim=False, path_mode="STRIP")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "first-person-hands.blend")
    parser.add_argument("--output", type=Path, default=ROOT / "female-first-person-hands.blend")
    parser.add_argument("--fbx-directory", type=Path,
                        help="Export one skinned FBX per hand in its wrist-centered rest pose.")
    options = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    source, output = options.input.resolve(), options.output.resolve()
    if source == output:
        parser.error("Choose a separate output for the female hand pair.")
    study = runpy.run_path(str(ROOT / "build-first-person-hands.py"))
    bpy.ops.wm.open_mainfile(filepath=str(source))
    hands = prepare_pair(bpy.context.scene, study)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    if options.fbx_directory:
        export_rest_hands(hands, options.fbx_directory.resolve())


if __name__ == "__main__":
    main()
