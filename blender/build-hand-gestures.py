"""Stage four gesture studies using the existing first-person hands."""

import argparse
import math
from collections import defaultdict
from pathlib import Path
import runpy
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
TYPING_START = 139
KEY_PITCH = .019
KEY_TOP = .025
KEY_TRAVEL = .0025
KEY_ROWS = (
    ("Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Bk", "Del"),
    ("Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\", "Pg"),
    ("Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Ent", "↵", "End"),
    ("Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Shift", "↑", "Home", "Fn"),
    ("Ctrl", "Fn", "Win", "Alt", "", "", "", "", "", "", "Alt", "←", "↓", "→", "Ctrl"),
)


def stage_visibility(obj, first, last):
    # Move the entire prop below the studio floor outside its shot.
    for frame, height in ((1, -1), (first-1, -1), (first, 0), (last, 0), (last+1, -1)):
        obj.location.z = height
        obj.keyframe_insert(data_path="location", index=2, frame=frame)


def rounded_box(study, collection, name, dimensions, location, material, bevel):
    x, y, z = (extent*.5 for extent in dimensions)
    box = study["mesh"](name, (
        (-x,-y,-z), (x,-y,-z), (x,y,-z), (-x,y,-z),
        (-x,-y,z), (x,-y,z), (x,y,z), (-x,y,z),
    ), ((3,2,1,0), (4,5,6,7), (0,1,5,4), (1,2,6,5),
        (2,3,7,6), (3,0,4,7)), collection)
    box.location = location
    box.data.materials.append(material)
    fillet = box.modifiers.new("Rounded edges", "BEVEL")
    fillet.width = bevel
    fillet.segments = 3
    return box


def key_legend(collection, key, title, lettering):
    text = bpy.data.curves.new(f"Key legend {title}", "FONT")
    text.body = title
    text.size = .0048 if len(title) == 1 else .00335
    text.align_x = text.align_y = "CENTER"
    text.materials.append(lettering)
    label = bpy.data.objects.new(f"{key.name} legend", text)
    collection.objects.link(label)
    label.parent = key
    label.location.z = .00313


def keyboard(scene, study, strokes):
    collection = study["building_collection"](scene, "Typing keyboard")
    root = bpy.data.objects.new("Keyboard staging", None)
    collection.objects.link(root)
    make = study["material"]
    body = make("Keyboard housing", (.049,.057,.068), .53)[0]
    cap = make("Graphite keys", (.125,.139,.154), .58)[0]
    accent = make("Dark modifier keys", (.072,.085,.104), .6)[0]
    legend = make("Key legends", (.79,.82,.84), .74)[0]
    top = make("Desk surface", (.082,.101,.120), .86)[0]
    rounded_box(study, collection, "Typing desk", (.66,.42,.061), (0,-.068,-.024), top, .008).parent = root
    rounded_box(study, collection, "Keyboard case", (.329,.111,.013),
                (.005,-.003,.013), body, .0038).parent = root
    keys = {}
    for row, titles in enumerate(KEY_ROWS):
        offset = (0,.00475,.0095,.01425,0)[row]
        for col, title in enumerate(titles):
            if row == 4 and 4 <= col <= 9:
                continue
            x = (col-7)*KEY_PITCH + offset
            y = .035 - row*KEY_PITCH
            name = f"Key {row}-{col} {title}"
            key = rounded_box(study, collection, name, (.0167,.0164,.006),
                              (x,y,KEY_TOP-.003), cap if len(title) == 1 else accent, .0013)
            key.parent = root
            keys[row,col] = key
            key_legend(collection, key, title, legend)
    space = rounded_box(study, collection, "Space bar", (6*KEY_PITCH-.0023,.0164,.006),
                        (-.5*KEY_PITCH,-.041,KEY_TOP-.003), accent, .0013)
    space.parent = root
    for col in range(4,10):
        keys[4,col] = space

    keyframes = defaultdict(dict)
    for frame, row, col in strokes:
        key = keys[row,col]
        for offset, depth in ((-2,0),(0,KEY_TRAVEL),(2,0)):
            entry = keyframes[key]
            entry[frame+offset] = max(depth,entry.get(frame+offset,0))
    for key, frames in keyframes.items():
        for frame, depth in sorted(frames.items()):
            key.location.z = KEY_TOP-.003-depth
            key.keyframe_insert(data_path="location", index=2, frame=frame)
        action = key.animation_data
        for curve in action.action.layers[0].strips[0].channelbag(action.action_slot).fcurves:
            for keyframe in curve.keyframe_points:
                keyframe.handle_left_type = keyframe.handle_right_type = "AUTO_CLAMPED"
    stage_visibility(root, TYPING_START, scene.frame_end)


def pointing_target(scene, study, right):
    scene.frame_set(125)
    posed = right.evaluated_get(bpy.context.evaluated_depsgraph_get())
    finger = posed.pose.bones["Index.DIP"]
    tip = posed.matrix_world @ finger.tail
    direction = (posed.matrix_world.to_3x3() @ (finger.tail-finger.head)).normalized()
    center = tip + direction*.060
    collection = study["building_collection"](scene, "Pointing target")
    parent = bpy.data.objects.new("Pointing prop staging", None)
    collection.objects.link(parent)
    blue = study["material"]("Blue ceramic", (.053,.32,.39), .38)[0]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=.015, location=center)
    ball = bpy.context.object
    ball.name = "Ceramic target"
    for group in list(ball.users_collection):
        group.objects.unlink(ball)
    collection.objects.link(ball)
    ball.parent = parent
    ball.data.materials.append(blue)
    for face in ball.data.polygons:
        face.use_smooth = True
    stage_visibility(parent, 113, 138)
    return center


def shot(scene, collection, study, name, frame, position, target, scale):
    data = bpy.data.cameras.new(name)
    data.type = "ORTHO"
    data.ortho_scale = scale
    camera = bpy.data.objects.new(name, data)
    collection.objects.link(camera)
    camera.location = position
    study["aim_object"](camera, target)
    scene.timeline_markers.new(name, frame=frame).camera = camera
    return camera


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT/"first-person-hands.blend")
    parser.add_argument("--output", type=Path, default=ROOT/"hand-gestures.blend")
    parser.add_argument("--motion", type=Path)
    options = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    study = runpy.run_path(str(ROOT/"build-first-person-hands.py"))
    gestures = runpy.run_path(str(ROOT/"hand-gesture-poses.py"))
    typing = runpy.run_path(str(ROOT/"hand-typing-poses.py"))
    bpy.ops.wm.open_mainfile(filepath=str(options.input.resolve()))
    scene = bpy.context.scene
    scene.name = "Hand gesture studies"
    scene.frame_start, scene.frame_end = 1, 210
    scene.render.fps = 24
    scene.timeline_markers.clear()
    right, left = (bpy.data.objects[f"Hand rig.{side}"] for side in ("R","L"))
    gestures["animate"](right, study)
    left.rotation_euler = (0,0,math.radians(11))
    gestures["animate"](left, study, -1)
    strokes = typing["animate"](scene, right, left, study)
    for part in left.children_recursive:
        part.hide_render = False
        part.keyframe_insert(data_path="hide_render", frame=1)
        part.hide_render = True
        part.keyframe_insert(data_path="hide_render", frame=113)
        part.hide_render = False
        part.keyframe_insert(data_path="hide_render", frame=TYPING_START)
    keyboard(scene, study, strokes)
    target = pointing_target(scene, study, right)
    cameras = study["building_collection"](scene, "Gesture cameras")
    for obj in list(scene.objects):
        if obj.type == "CAMERA":
            bpy.data.objects.remove(obj, do_unlink=True)
    first = shot(scene, cameras, study, "Fist and release", 1,
                 (.012,-.088,.68), (-.011,.030,.053), .525)
    shot(scene, cameras, study, "Count 1 to 5", 43,
         (.009,-.085,.69), (-.009,.048,.054), .519)
    shot(scene, cameras, study, "Index pointing", 113,
         (.222,-.105,.54), (.105,target.y*.5-.008,.059), .358)
    shot(scene, cameras, study, "Typing", TYPING_START,
         (.095,-.239,.532), (.006,-.046,.024), .465)
    for frame, label in gestures["MARKERS"]:
        scene.timeline_markers.new(label, frame=frame)
    scene.camera = first
    scene.frame_set(1)
    study["use_object"](bpy.data.objects["Continuous hand skin.R"])
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
    bpy.context.preferences.filepaths.save_version = 0
    options.output.resolve().parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(options.output.resolve()), compress=True)
    if options.motion:
        study["render_motion"](scene, options.motion)


if __name__ == "__main__":
    main()
