"""Create a fist and finger-counting study from the existing hand asset."""

import argparse
import math
from pathlib import Path
import runpy
import sys

import bpy


ROOT = Path(__file__).resolve().parent
OPEN = ((2, 4, 2), (3, 5, 3), (5, 6, 4), (6, 9, 5))
THUMB_OPEN = (-7, -4, -12)
COUNTS = (
    (40, 53, 5, (2, 1, -2), -3),
    (61, 75, 4, (1, -3, -1), 11),
    (83, 96, 3, (0, -2, 1), 6),
    (104, 117, 2, (-2, 0, 2), 2),
    (125, 144, 1, (-3, 2, 3), -2),
)


def hand_keys(study):
    fist = study["FIST_BENDS"]
    yield 1, "Relax", ((8, 17, 8), (11, 23, 11), (14, 27, 15), (19, 31, 18)), (27, 5, 5), (13, 10), (-4, 0, 3), -6
    yield 9, None, ((26, 39, 22), (35, 49, 30), (44, 62, 41), (54, 69, 48)), (26, 2, 7), (22, 26), (3, 1, 2), 3
    yield 19, "Clench", fist, *study["FIST_THUMB"], (10, 2, 0), 8
    yield 27, "Squeeze", fist, *study["FIST_THUMB"], (12, 2, -1), 11
    yield 29, None, fist, (43,-15,-14), (25,49), (10,1,-1), 9
    yield 33, "Open", ((37, 57, 31), (45, 65, 37), (53, 71, 43), (58, 75, 47)), (28, -13, -10), (24, 36), (7, 1, -2), 5
    for first, last, number, wrist, roll in COUNTS:
        closed = 4-min(number, 4)
        # The reference closes the thumb, then counts down from the index towards the little finger.
        fingers = fist[:closed] + OPEN[closed:]
        if number == 5:
            thumb, hinges = THUMB_OPEN, (4, 7)
        else:
            thumb, hinges = study["TUCKED_THUMB"]
        yield first, str(number), fingers, thumb, hinges, wrist, roll
        eased = tuple((a-.8, b-1, c) if i >= closed else (a+.45, b+.75, c+.7)
                       for i, (a, b, c) in enumerate(fingers))
        yield last, None, eased, thumb, hinges, (wrist[0]-.8, wrist[1], wrist[2]+.7), roll+.9


def animate(scene, rig, study):
    # Keep the driven thumb mechanics and give the count its own action.
    animation = rig.animation_data
    animation.action.use_fake_user = True
    animation.action = None
    bones = rig.pose.bones
    scene.timeline_markers.clear()
    for frame, label, bends, thumb, hinges, wrist, roll in hand_keys(study):
        if label:
            scene.timeline_markers.new(label, frame=frame)
        bones["Forearm"].rotation_euler = (0, math.radians(roll), 0)
        bones["Wrist"].rotation_euler = tuple(map(math.radians, wrist))
        study["pose_fingers"](rig, bends, spread=4.7)
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
            open_fingers = [finger.name for finger in fingers
                            if rig.pose.bones[finger.joints[0]].rotation_euler.x < math.radians(20)]
            thumb_up = rig.pose.bones["Thumb.Base"].rotation_euler.x < math.radians(10)
            if len(open_fingers)+thumb_up != expected or open_fingers != [f.name for f in fingers[4-min(expected,4):]]:
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
    animate(scene, right, study)
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
