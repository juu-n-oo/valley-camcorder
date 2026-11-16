"""Create a fist and finger-counting study from the existing hand asset."""

import argparse
import math
from pathlib import Path
import runpy
import sys

import bpy


ROOT = Path(__file__).resolve().parent
OPEN = ((2, 4, 2), (3, 5, 3), (5, 6, 4), (6, 9, 5))
FIST = ((69, 90, 52), (75, 94, 59), (77, 95, 61), (77, 95, 61))
SQUEEZE = ((72, 93, 54), (78, 97, 60), (80, 98, 62), (79, 98, 63))
THUMB_OPEN = (-7, -4, -12)
THUMB_TUCKED = (36, 10, 23)
COUNTS = (
    (40, 53, 5, (2, 1, -2), -3),
    (61, 75, 4, (1, -1, -1), 3),
    (83, 96, 3, (0, -1, 1), 4),
    (104, 117, 2, (-2, 0, 2), 2),
    (125, 144, 1, (-3, 2, 3), -2),
)


def hand_keys():
    yield 1, "Relax", ((8, 17, 8), (11, 23, 11), (14, 27, 15), (19, 31, 18)), (27, 5, 5), (13, 10), (-4, 0, 3), -6
    yield 9, None, ((32, 49, 32), (37, 54, 37), (43, 62, 44), (52, 65, 45)), (33, 9, 11), (13, 13), (3, 1, 2), 3
    yield 19, "Clench", FIST, (34, 12, 23), (14, 15), (10, 2, 0), 8
    yield 27, "Squeeze", SQUEEZE, (35, 12, 24), (16, 18), (12, 2, -1), 11
    yield 33, "Open", ((40, 63, 35), (48, 65, 37), (53, 72, 43), (58, 75, 45)), (26, 5, 1), (12, 13), (7, 1, -2), 5
    for first, last, number, wrist, roll in COUNTS:
        extended = min(number, 4)
        fingers = OPEN[:extended] + FIST[extended:]
        thumb = THUMB_OPEN if number == 5 else THUMB_TUCKED
        hinges = (4, 7) if number == 5 else (24, 17)
        yield first, str(number), fingers, thumb, hinges, wrist, roll
        eased = tuple((a-.8, b-1, c) if i < extended else (a+1, b+1.6, c+1)
                       for i, (a, b, c) in enumerate(fingers))
        yield last, None, eased, thumb, hinges, (wrist[0]-.8, wrist[1], wrist[2]+.7), roll+.9


def animate(scene, rig, fingers):
    # Keep the driven thumb mechanics and give the count its own action.
    animation = rig.animation_data
    animation.action.use_fake_user = True
    animation.action = None
    bones = rig.pose.bones
    scene.timeline_markers.clear()
    for frame, label, bends, thumb, hinges, wrist, roll in hand_keys():
        if label:
            scene.timeline_markers.new(label, frame=frame)
        motion = sum(row[0] for row in bends) / 320
        bones["Forearm"].rotation_euler = (0, math.radians(roll), 0)
        bones["Wrist"].rotation_euler = tuple(map(math.radians, wrist))
        bones["Palm"].rotation_euler = (math.radians(2.6*motion), 0, 0)
        for i, (finger, bend) in enumerate(zip(fingers, bends)):
            spread = (i-1.24) * 4.7 * (1-bend[0]/88)
            bones[f"{finger.name}.Metacarpal"].rotation_euler = (
                math.radians((i/3)**1.5*10.8*motion), 0, math.radians(.26*spread))
            for j, name in enumerate(finger.joints):
                bones[name].rotation_euler = (math.radians(bend[j]), 0,
                                              math.radians(spread) if j == 0 else 0)
        bones["Thumb.Base"].rotation_euler = tuple(map(math.radians, thumb))
        for name, degrees in zip(("Thumb.MCP", "Thumb.IP"), hinges):
            bones[name].rotation_euler = (math.radians(degrees), 0, 0)
        for bone in bones:
            if bone.name not in ("Thumb.CMC", "Thumb.Web"):
                bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
    action = animation.action
    action.name = "Fist and finger countdown.R"
    for curve in action.layers[0].strips[0].channelbag(animation.action_slot).fcurves:
        for key in curve.keyframe_points:
            key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
        curve.update()


def camera_for_count(scene, aim):
    camera = scene.camera
    camera.animation_data_clear()
    camera.data.animation_data_clear()
    for frame, position, target, width in (
        (1, (.251, -.057, .568), (.105, .036, .065), .314),
        (27, (.234, -.075, .554), (.105, .037, .065), .303),
        (40, (.174, -.077, .600), (.093, .055, .056), .339),
        (144, (.174, -.077, .600), (.093, .055, .056), .339),
    ):
        camera.location = position
        aim(camera, target)
        camera.data.ortho_scale = width
        camera.keyframe_insert(data_path="location", frame=frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=frame)
        camera.data.keyframe_insert(data_path="ortho_scale", frame=frame)


def verify_counts(scene, rig, fingers):
    for first, last, expected, *_ in COUNTS:
        for frame in range(first, last+1):
            scene.frame_set(frame)
            fingers_up = sum(rig.pose.bones[finger.joints[0]].rotation_euler.x < math.radians(20)
                             for finger in fingers)
            thumb_up = rig.pose.bones["Thumb.Base"].rotation_euler.x < math.radians(10)
            if fingers_up + thumb_up != expected:
                raise RuntimeError(f"Frame {frame}: expected {expected} extended fingers")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "first-person-hands.blend")
    parser.add_argument("--output", type=Path, default=ROOT / "hand-countdown.blend")
    parser.add_argument("--motion", type=Path)
    opts = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    study = runpy.run_path(str(ROOT / "build-first-person-hands.py"))
    bpy.ops.wm.open_mainfile(filepath=str(opts.input.resolve()))
    scene = bpy.context.scene
    scene.name = "Fist and finger countdown"
    scene.frame_start, scene.frame_end = 1, COUNTS[-1][1]
    right = bpy.data.objects["Hand rig.R"]
    left = bpy.data.objects["Hand rig.L"]
    skin = bpy.data.objects["Continuous hand skin.R"]
    for obj in (left, *left.children_recursive):
        obj.hide_render = True
        obj.hide_set(True)
    animate(scene, right, study["FINGERS"][:4])
    camera_for_count(scene, study["aim_object"])
    verify_counts(scene, right, study["FINGERS"][:4])
    study["validate"](skin, right, left, scene)
    scene.frame_set(1)
    study["use_object"](skin)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
    bpy.context.preferences.filepaths.save_version = 0
    opts.output.resolve().parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(opts.output.resolve()), compress=True)
    if opts.motion:
        study["render_motion"](scene, opts.motion)


if __name__ == "__main__":
    main()
