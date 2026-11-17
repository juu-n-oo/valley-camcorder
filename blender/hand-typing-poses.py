"""Animate the first-person rigs over a keyboard with 19 mm key spacing."""

import math

import bpy
import numpy as np
from mathutils import Euler, Vector


FIRST = 139
LAST = 210
PITCH = .019
KEY_TOP = .025
KEY_TRAVEL = .0025
ROW_Y = (.035, .016, -.003, -.022, -.041)
ROW_OFFSET = (0, .00475, .0095, .01425, 0)
EVENTS = (
    (143, "L", "Index", 2, 4), (147, "R", "Index", 2, 7),
    (152, "L", "Middle", 2, 3), (156, "R", "Middle", 2, 8),
    (161, "L", "Ring", 1, 2), (165, "R", "Ring", 1, 10),
    (170, "L", "Index", 3, 4), (174, "R", "Index", 3, 7),
    (179, "L", "Little", 2, 1), (183, "R", "Little", 2, 10),
    (188, "L", "Middle", 1, 3), (192, "R", "Middle", 1, 8),
    (198, "L", "Middle", 3, 3), (202, "R", "Index", 3, 6),
)

HOVER = ((13, 31, 18), (16, 33, 19), (18, 32, 18), (19, 31, 15))
LOW = np.radians((-7, -24, 6, 4))
HIGH = np.radians((59, 24, 73, 55))
THUMB_CHANNELS = ("Thumb.Base", "Thumb.MCP", "Thumb.IP")
THUMB_REST = np.radians((18, -15, 17, 12, 10))
THUMB_PRESS = np.radians((26, -15, 8, 12, 11))
THUMB_LOW = np.radians((4, -37, 4, 3, 2))
THUMB_HIGH = np.radians((39, 11, 37, 43, 35))
SPACE_TAPS = ((162, "L", 4, 5), (166, "R", 4, 7))
SPACE_PAD_OFFSET = -.0027


def key_center(row, column):
    return (column - 7) * PITCH + ROW_OFFSET[row], ROW_Y[row]


def joints(rig, finger):
    return tuple(rig.pose.bones[label] for label in finger.joints)


def finger_pad(rig, skin, finger):
    """Cache the distal surface in the last joint's coordinate system."""
    last = rig.pose.bones[finger.joints[-1]].bone
    bone_from_rest = last.matrix_local.inverted()
    group = skin.vertex_groups[last.name].index
    indices, points = [], []
    for vertex in skin.data.vertices:
        if any(g.group == group and g.weight >= .94 for g in vertex.groups):
            point = bone_from_rest @ vertex.co
            if point.y >= last.length * .51:
                indices.append(vertex.index)
                points.append(tuple(point))
    if len(points) < 15:
        raise RuntimeError(f"Missing distal skin for {rig.name} {finger.name}")
    return tuple(indices), np.array(points[::3])


def contact_transform(parent, links, pad, rotations):
    matrix = parent
    for basis, angles in zip(links, rotations):
        matrix = matrix @ basis @ Euler(angles, "XYZ").to_matrix().to_4x4()
    transform = np.asarray(matrix, dtype=float)
    points = pad @ transform[:3, :3].T + transform[:3, 3]
    lowest = points[:, 2].min()
    weights = np.exp(-(points[:, 2] - lowest) / .00047)
    center = np.average(points, axis=0, weights=weights)
    center[2] = lowest
    return center


def placement_chain(rig, bones):
    return (rig.matrix_world @ bones[0].parent.matrix,
            [bone.parent.bone.matrix_local.inverted() @ bone.bone.matrix_local for bone in bones])


def solve_contact(measure, target, preferred, low, high, initial=None):
    target = np.asarray(target)
    angles = preferred.copy() if initial is None else initial.copy()
    epsilon = .003
    steps = np.eye(len(angles)) * epsilon
    penalty = .000008
    damping = np.eye(len(angles)) * penalty

    def cost(angles, residual):
        return residual @ residual + penalty * np.sum((preferred - angles)**2)

    for _ in range(16):
        tip = measure(angles)
        error = target - tip
        if np.linalg.norm(error) < .00028:
            break
        jacobian = np.column_stack([(measure(angles + step) - tip) / epsilon for step in steps])
        move = np.linalg.solve(jacobian.T @ jacobian + damping,
                               jacobian.T @ error + damping @ (preferred - angles))
        move = np.clip(move, -.20, .20)
        current = cost(angles, error)
        # A bounded step prevents a close thumb from snapping into a distant pose.
        for scale in (1, .5, .25, .125):
            candidate = np.clip(angles + scale * move, low, high)
            if cost(candidate, target - measure(candidate)) < current:
                angles = candidate
                break
        else:
            break
    return angles


def reach(rig, finger, pad, target):
    bones = joints(rig, finger)
    parent, links = placement_chain(rig, bones)
    base = np.array((bones[0].rotation_euler.x, bones[0].rotation_euler.z,
                     bones[1].rotation_euler.x, bones[2].rotation_euler.x))

    def measure(angles):
        pitch, spread, middle, tip = angles
        return contact_transform(parent, links, pad, ((pitch, 0, spread), (middle, 0, 0), (tip, 0, 0)))

    pitch, spread, middle, tip = solve_contact(measure, target, base, LOW, HIGH)
    bones[0].rotation_euler = (pitch, 0, spread)
    bones[1].rotation_euler.x = middle
    bones[2].rotation_euler.x = tip


def pad_points(skin, indices):
    bpy.context.view_layer.update()
    evaluated = skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
    world = evaluated.matrix_world
    return [world @ evaluated.data.vertices[index].co for index in indices]


def fit_pad_height(skin, bone, indices, height, limits):
    points = pad_points(skin, indices)
    lowest = min(point.z for point in points)
    # Refine the articulated estimate with the evaluated skin and its modifier stack.
    for _ in range(4):
        if abs(lowest - height) < .00018:
            break
        angles = bone.rotation_euler
        angles.x += .007
        slope = (min(point.z for point in pad_points(skin, indices)) - lowest) / .007
        change = (height - lowest) / min(-.012, slope)
        angles.x += max(-.14, min(.14, change)) - .007
        angles.x = min(limits[1], max(limits[0], angles.x))
        points = pad_points(skin, indices)
        lowest = min(point.z for point in points)
    bottom = [point for point in points if point.z <= lowest + .0006]
    return sum(bottom, Vector()) / len(bottom)


def align_pad(rig, skin, bone, indices, target):
    contact = fit_pad_height(skin, bone, indices, target[2], (LOW[0], HIGH[0]))
    rig.location.x += target[0] - contact.x
    rig.location.y += target[1] - contact.y


def hover(rig, fingers, side, row, shift, effort):
    row_reach = (ROW_Y[row] - ROW_Y[2]) * .59
    rig.location = ((.041 if side > 0 else -.081) + shift, -.155 + row_reach,
                    .085 - .0011 * effort)
    rig.rotation_euler = (0, math.pi, 0)
    for bone in rig.pose.bones:
        if bone.name != "Thumb.CMC":
            bone.rotation_euler = (0, 0, 0)
    for finger, angles in zip(fingers, HOVER):
        for bone, degree in zip(joints(rig, finger), angles):
            bone.rotation_euler.x = math.radians(degree)
    rig.pose.bones["Forearm"].rotation_euler.y = math.radians(side * (effort - .5) * 1.1)
    rig.pose.bones["Wrist"].rotation_euler.x = math.radians(.4 + 1.1 * effort)



def key_pose(rig, frame):
    for path in ("location", "rotation_euler"):
        rig.keyframe_insert(data_path=path, frame=frame, group="Keyboard placement")
    for bone in rig.pose.bones:
        if bone.name in ("Thumb.CMC", "Thumb.Web") or (bone.name in THUMB_CHANNELS and frame >= FIRST):
            continue
        bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)


def place_thumb(scene, rig, skin, thumb, side, study, tap):
    indices, pad = finger_pad(rig, skin, thumb)
    bones = joints(rig, thumb)
    control, knuckle, tip = (rig.pose.bones[name] for name in THUMB_CHANNELS)
    lift, start, gain = study["THUMB_LIFT"]
    lift, start = math.radians(lift), math.radians(start)
    press_frame, row, column = tap
    x, y = key_center(row, column)
    previous = THUMB_REST
    for frame in range(FIRST, LAST + 1):
        scene.frame_set(frame)
        parent, links = placement_chain(rig, bones)

        def measure(angles):
            pitch, roll, yaw, middle, end = angles
            pitch = max(pitch, lift + gain * max(0, yaw - start))
            return contact_transform(parent, links, pad,
                                     ((pitch, roll * side, yaw * side), (middle, 0, 0), (end, 0, 0)))

        # The idle thumb stays near the space bar when the wrist advances.
        rest = measure(THUMB_REST)
        rest[0] -= .0016 * side
        rest[1] -= np.clip(.34 * (rig.location.y + .151), -.005, .006)
        rest[2] += .0015
        contact = np.array((x, y + SPACE_PAD_OFFSET, KEY_TOP - KEY_TRAVEL + .0003))
        phase = max(0, 1 - abs(frame - press_frame) / 3)
        phase = phase * phase * (3 - 2 * phase)
        target = rest + (contact - rest) * phase
        preferred = THUMB_REST + (THUMB_PRESS - THUMB_REST) * phase
        solved = solve_contact(measure, target, preferred, THUMB_LOW, THUMB_HIGH, initial=previous)
        pitch, roll, yaw, middle, end = solved
        control.rotation_euler = (pitch, roll * side, yaw * side)
        knuckle.rotation_euler = (middle, 0, 0)
        tip.rotation_euler = (end, 0, 0)
        if frame == press_frame:
            fit_pad_height(skin, knuckle, indices, target[2], (THUMB_LOW[3], THUMB_HIGH[3]))
            solved[3] = knuckle.rotation_euler.x
        for bone in (control, knuckle, tip):
            bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)
        previous = solved


def animate(scene, right, left, study):
    """Append typing and return (frame, row, column) strikes for the keys."""
    fingers = study["FINGERS"][:4]
    by_name = {finger.name: finger for finger in fingers}
    for side, label, rig in ((1, "R", right), (-1, "L", left)):
        scene.frame_set(FIRST - 1)
        key_pose(rig, FIRST - 1)
        skin = bpy.data.objects["Continuous hand skin." + label]
        pads = {name: finger_pad(rig, skin, finger) for name,finger in by_name.items()}
        scene.frame_set(FIRST)
        hover(rig, fingers, side, 2, 0, 0)
        key_pose(rig, FIRST)
        for frame, hand, name, row, column in EVENTS:
            if hand != label:
                continue
            x, y = key_center(row, column)
            reference = (.041 if side > 0 else -.081)-side*by_name[name].points[0].x
            shift = max(-.007, min(.007, (x - reference) * .26))
            indices, pad = pads[name]
            for offset, height, effort in ((-3, .033, 0), (-1, .0254, .44),
                                           (0, KEY_TOP - KEY_TRAVEL + .0003, 1),
                                           (1, .0244, .45), (2, .0303, .10)):
                scene.frame_set(frame + offset)
                hover(rig, fingers, side, row, shift, effort)
                bpy.context.view_layer.update()
                target = (x, y, height)
                reach(rig, by_name[name], pad, target)
                # Finger pad curvature and the skin's final smoothing slightly
                # change contact from the articulated bone estimate.
                align_pad(rig, skin, joints(rig, by_name[name])[0], indices, target)
                key_pose(rig, frame + offset)
        for frame in (LAST - 4, LAST):
            scene.frame_set(frame)
            hover(rig, fingers, side, 2, 0, 0)
            key_pose(rig, frame)
        tap = next((frame, row, column) for frame, hand, row, column in SPACE_TAPS if hand == label)
        place_thumb(scene, rig, skin, study["FINGERS"][-1], side, study, tap)
        animation = rig.animation_data
        animation.action.name = "Gesture studies."+label
        for curve in animation.action.layers[0].strips[0].channelbag(animation.action_slot).fcurves:
            for key in curve.keyframe_points:
                if key.co.x == FIRST - 1:
                    key.interpolation = "CONSTANT"
                elif key.co.x >= FIRST:
                    key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
            curve.update()
    finger_strokes = tuple((frame, row, column) for frame, _, _, row, column in EVENTS)
    return finger_strokes + tuple((frame, row, column) for frame, _, row, column in SPACE_TAPS)
