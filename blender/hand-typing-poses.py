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
LOW = np.radians((-7, -24, 6, 8))
HIGH = np.radians((59, 24, 73, 59))


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


def fingertip(parent, link, pad, angles):
    pitch, spread, middle, tip = angles
    matrix = parent
    for basis, (bend, yaw) in zip(link, ((pitch, spread), (middle, 0), (tip, 0))):
        matrix = matrix @ basis @ Euler((bend, 0, yaw), "XYZ").to_matrix().to_4x4()
    transform = np.asarray(matrix, dtype=float)
    points = pad @ transform[:3, :3].T + transform[:3, 3]
    lowest = points[:, 2].min()
    bottom = points[points[:, 2] <= lowest + .0010]
    return np.array((bottom[:, 0].mean(), bottom[:, 1].mean(), lowest))


def reach(rig, finger, pad, target):
    bones = joints(rig, finger)
    parent = rig.matrix_world @ bones[0].parent.matrix
    links = [b.parent.bone.matrix_local.inverted() @ b.bone.matrix_local for b in bones]
    base = np.array((bones[0].rotation_euler.x, bones[0].rotation_euler.z,
                     bones[1].rotation_euler.x, bones[2].rotation_euler.x))
    angles = base.copy()
    goal = np.asarray(target)[[0, 2]]
    reach_delta = target[1] - fingertip(parent, links, pad, base)[1]
    # The near and far rows use different arch shapes, while the wrist
    # remains above the keyboard and carries the forward reach.
    angles[2] -= np.clip(reach_delta * 6, -.12, .12)
    angles[3] -= np.clip(reach_delta * 3, -.06, .06)
    epsilon = .002
    damping = np.eye(2) * .000025
    for _ in range(14):
        tip = fingertip(parent, links, pad, angles)[[0, 2]]
        error = goal - tip
        if np.linalg.norm(error) < .00035:
            break
        jacobian = np.column_stack([
            (fingertip(parent, links, pad, angles + step)[[0, 2]] - tip) / epsilon
            for step in np.eye(4)[:2] * epsilon
        ])
        move = np.linalg.solve(jacobian.T @ jacobian + damping,
                               jacobian.T @ error + damping @ (base[:2] - angles[:2]))
        angles[:2] = np.clip(angles[:2] + np.clip(move, -.21, .21), LOW[:2], HIGH[:2])
    pitch, spread, middle, tip = angles
    bones[0].rotation_euler = (pitch, 0, spread)
    bones[1].rotation_euler.x = middle
    bones[2].rotation_euler.x = tip


def pad_points(skin, indices):
    bpy.context.view_layer.update()
    evaluated = skin.evaluated_get(bpy.context.evaluated_depsgraph_get())
    world = evaluated.matrix_world
    return [world @ evaluated.data.vertices[index].co for index in indices]


def align_pad(rig, skin, bone, indices, target):
    points = pad_points(skin, indices)
    lowest = min(point.z for point in points)
    # Correct the active finger rather than lowering the neighboring fingers.
    for _ in range(4):
        if abs(lowest - target[2]) < .00018:
            break
        angles = bone.rotation_euler
        angles.x += .007
        slope = (min(point.z for point in pad_points(skin, indices)) - lowest) / .007
        change = (target[2] - lowest) / min(-.029, slope)
        angles.x += max(-.14, min(.14, change)) - .007
        angles.x = min(float(HIGH[0]), max(float(LOW[0]), angles.x))
        points = pad_points(skin, indices)
        lowest = min(point.z for point in points)
    bottom = [point for point in points if point.z <= lowest + .0006]
    contact = sum(bottom, Vector()) / len(bottom)
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
    rig.pose.bones["Thumb.Base"].rotation_euler = tuple(map(math.radians, (8, -14 * side, 20 * side)))
    rig.pose.bones["Thumb.MCP"].rotation_euler.x = math.radians(16)
    rig.pose.bones["Thumb.IP"].rotation_euler.x = math.radians(13)


def key_pose(rig, frame):
    for path in ("location", "rotation_euler"):
        rig.keyframe_insert(data_path=path, frame=frame, group="Keyboard placement")
    for bone in rig.pose.bones:
        if bone.name not in ("Thumb.CMC", "Thumb.Web"):
            bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=bone.name)


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
        animation = rig.animation_data
        animation.action.name = "Gesture studies."+label
        for curve in animation.action.layers[0].strips[0].channelbag(animation.action_slot).fcurves:
            for key in curve.keyframe_points:
                if key.co.x == FIRST - 1:
                    key.interpolation = "CONSTANT"
                elif key.co.x >= FIRST:
                    key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
            curve.update()
    return tuple((frame, row, column) for frame, _, _, row, column in EVENTS)
