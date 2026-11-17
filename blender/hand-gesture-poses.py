"""The single-hand section of the Blender gesture study."""

import math
from pathlib import Path
import runpy


MARKERS = (
    (1, "Fist and open"),
    (16, "Squeeze"),
    (37, "Open hand"),
    (43, "Count 1"),
    (59, "Count 2"),
    (72, "Count 3"),
    (85, "Count 4"),
    (99, "Count 5"),
    (113, "Pointing"),
    (124, "Point held"),
)


def gesture_keys(study):
    countdown = runpy.run_path(str(Path(__file__).with_name("build-hand-countdown.py")))
    original = {frame: pose for frame, _, *pose in countdown["hand_keys"](study)}
    # Re-time the same vetted grasp. Play the number poses in ascending order.
    for frame, source in (
        (1, 1), (8, 9), (16, 19), (22, 27), (25, 29), (30, 33), (37, 40), (42, 53),
        (43, 144), (52, 125), (59, 117), (65, 104), (72, 96), (78, 83),
        (85, 75), (91, 61), (99, 53), (112, 40),
    ):
        yield frame, *original[source]

    # The palm rolls as the index straightens toward the indicated spot.
    thumb, hinges = study["FIST_THUMB"]
    yield 117, ((4, 7, 3), (48, 70, 42), (52, 74, 45), (57, 78, 47)), (40, -20, -18), (23, 48), (-1, -9, -9), -10
    yield 124, ((0, 3, 1), (74, 90, 53), (77, 95, 59), (75, 93, 54)), thumb, hinges, (0, -14, -16), -15
    yield 132, ((1, 3, 2), (74, 92, 54), (77, 95, 60), (75, 94, 54)), thumb, hinges, (.7, -15, -16), -16
    yield 138, ((2, 4, 2), (72, 89, 52), (77, 95, 59), (75, 93, 53)), thumb, hinges, (-.5, -14, -15), -14


def animate(rig, study, side=1):
    """Author frames 1–138 on a hand rig and keep its thumb drivers."""
    animation = rig.animation_data
    if animation.action is not None:
        animation.action.use_fake_user = True
        animation.action = None

    bones = rig.pose.bones
    keyed_bones = [bone for bone in bones if bone.name not in ("Thumb.CMC", "Thumb.Web")]
    for frame, bends, thumb, hinges, wrist, roll in gesture_keys(study):
        bones["Forearm"].rotation_euler = (0, math.radians(roll*side), 0)
        bones["Wrist"].rotation_euler = tuple(map(math.radians,(wrist[0],wrist[1]*side,wrist[2]*side)))
        study["pose_fingers"](rig, bends, side, spread=4.7)
        bones["Thumb.Base"].rotation_euler = tuple(map(math.radians,(thumb[0],thumb[1]*side,thumb[2]*side)))
        for name, degrees in zip(("Thumb.MCP", "Thumb.IP"), hinges):
            bones[name].rotation_euler = (math.radians(degrees), 0, 0)
        for bone in keyed_bones:
            bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)

    action = animation.action
    action.name = "Fist, count up and point."+("R" if side>0 else "L")
    for curve in action.layers[0].strips[0].channelbag(animation.action_slot).fcurves:
        for key in curve.keyframe_points:
            key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
        curve.update()
    return action
