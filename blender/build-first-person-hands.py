"""Build the standalone, anatomically articulated first-person hands in Blender.

Run with Blender's Python in background mode. Dimensions are in metres.
"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parent
UP = Vector((0, 0, 1))
WRIST = Vector((0, -.003, 0))
VOXEL = .00074
THUMB_ROLL = (-12, -27, -37)
THUMB_CONTROL = "Thumb.Base"
THUMB_SWING = (-37, 58)
THUMB_LIFT = (-14, 5, 1.32)


@dataclass(frozen=True)
class Finger:
    name: str
    points: tuple
    radii: tuple
    base: tuple

    @property
    def joints(self):
        labels = ("CMC", "MCP", "IP") if self.name == "Thumb" else ("MCP", "PIP", "DIP")
        return tuple(f"{self.name}.{label}" for label in labels)

    @property
    def lengths(self):
        return tuple((b-a).length for a, b in zip(self.points, self.points[1:]))


def finger(name, points, radii, base):
    return Finger(name, tuple(Vector(p) for p in points), radii, Vector(base))


# The open reference shows a broad middle row, a lower little-finger knuckle,
# curved fingertips, and a substantial pad at the base of the thumb.
FINGERS = (
    finger("Index", ((.030,.097,-.0001),(.0348,.133,.0013),(.037,.1541,.0035),(.0388,.172,.0059)),
           (.011,.0085,.0076,.0070), (.016,.024,-.0004)),
    finger("Middle", ((.0087,.102,-.0016),(.0099,.1442,-.0005),(.0108,.1665,.0027),(.0115,.185,.0061)),
           (.0113,.0091,.0079,.0073), (.004,.022,-.001)),
    finger("Ring", ((-.013,.0965,-.0013),(-.0175,.135,.0003),(-.021,.1566,.0031),(-.0251,.174,.0065)),
           (.01065,.0087,.0074,.0069), (-.011,.021,-.0012)),
    finger("Little", ((-.033,.084,-.0006),(-.045,.114,.0021),(-.052,.132,.0043),(-.060,.147,.0068)),
           (.00970,.00755,.0065,.0060), (-.022,.018,-.0008)),
    finger("Thumb", ((.0165,.0270,.0057),(.0458,.0572,.0110),(.0650,.0713,.0145),(.0843,.0814,.0172)),
           (.0190,.0126,.0105,.0090), (.011,.013,.0010)),
)


def clamp(value, low=0, high=1):
    return min(high, max(low, value))


def smooth(low, high, value):
    t = clamp((value-low)/(high-low))
    return t*t*(3-2*t)


def mix(a, b, blend):
    return a+(b-a)*blend


def mesh(name, vertices, faces, collection):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    return obj


def use_object(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def catmull(points, i, t):
    a, b, c, d = (points[max(0, min(i+j, len(points)-1))] for j in (-1, 0, 1, 2))
    return tuple(
        q+.5*t*((r-p)+t*((2*p-5*q+4*r-s)+t*(3*(q-r)+s-p)))
        for p, q, r, s in zip(a, b, c, d)
    )


def volume(name, sections, collection, samples=4, sides=40, rounding=1.0, reference=UP):
    """Closed sweep with independent lateral, palmar and dorsal radii."""
    rings = [catmull(sections, i, j/samples) for i in range(len(sections)-1) for j in range(samples)]
    rings.append(sections[-1])
    vertices, faces = [], []
    for i, row in enumerate(rings):
        source, target = Vector(rings[max(0,i-1)][:3]), Vector(rings[min(len(rings)-1,i+1)][:3])
        center = Vector(row[:3])
        tangent = (target-source).normalized()
        right = tangent.cross(reference).normalized()
        if len(row)>6:
            right = Quaternion(tangent,math.radians(row[6])) @ right
        normal = right.cross(tangent).normalized()
        for j in range(sides):
            cosine, sine = math.cos(j*math.tau/sides), math.sin(j*math.tau/sides)
            across = math.copysign(abs(cosine)**rounding, cosine)
            height = math.copysign(abs(sine)**rounding, sine)
            at = center+right*(max(.0001,row[3])*across)+normal*(max(.0001,row[4 if sine>=0 else 5])*height)
            vertices.append(at)
    for i in range(len(rings)-1):
        for j in range(sides):
            a, b = i*sides+j, i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend((tuple(reversed(range(sides))),tuple(range(len(vertices)-sides,len(vertices)))))
    obj = mesh(name, vertices, faces, collection)
    recalculate(obj.data)
    return obj


def recalculate(data):
    editable = bmesh.new()
    editable.from_mesh(data)
    bmesh.ops.recalc_face_normals(editable, faces=list(editable.faces))
    editable.to_mesh(data)
    editable.free()


def digit_volume(spec, collection):
    a, b, c, d = spec.points
    r0, r1, r2, tip = spec.radii
    direction = (b-a).normalized()
    start = a-direction*.013
    root = ((start,r0*.78,r0*.83,r0*.82),)
    if spec.name == "Index":
        # Begin inside the palm and ease into the radial knuckle without a flat cap at the web.
        start = a-direction*.022+Vector((-.005,0,-.0017))
        root = ((start,r0*.59,r0*.69,r0*.65),
                (start.lerp(a,.57),r0*.81,r0*.90,r0*.81))
    profiles = (*root,
        (a, r0, r0*.94, r0*.85),
        (a.lerp(b,.48)+Vector((0,0,.0008)),r0*.91,r0*.98,r0*.77),
        (b-(b-a).normalized()*.005,r1*.96,r1*.91,r1*.89),
        (b,r1*1.035,r1*.91,r1*1.015),
        (b.lerp(c,.46),r1*.91,r1*.88,r1*.78),
        (c,r2*1.02,r2*.91,r2*.91),
        (c.lerp(d,.49)+Vector((0,0,.00075)),tip*1.01,tip*1.015,tip*.72),
        (c.lerp(d,.75),tip*.88,tip*.89,tip*.66),
        (c.lerp(d,.91),tip*.65,tip*.68,tip*.55),
        (c.lerp(d,.978),tip*.36,tip*.41,tip*.33),
        (d,tip*.10,tip*.13,tip*.12),
    )
    return volume(spec.name, [(*p,x,palm,back) for p,x,palm,back in profiles], collection,
                  samples=4,sides=32,rounding=.86)


def thumb_volume(collection):
    a,b,c,d = FINGERS[-1].points
    shape = (
        (a.lerp(WRIST,.48),.0140,.0133,.0123,-6),
        (a,.0169,.0160,.0140,-10),
        (a.lerp(b,.42)+Vector((.001,0,.0006)),.0162,.0141,.0128,-13),
        (a.lerp(b,.73),.0139,.0121,.0110,-19),
        (b,.0115,.0109,.0107,-24),
        (b.lerp(c,.53),.0105,.0101,.0096,-30),
        (c,.0102,.0100,.0096,-34),
        (c.lerp(d,.38),.0105,.0106,.0082,-37),
        (c.lerp(d,.70),.0092,.0097,.0077,-37),
        (c.lerp(d,.90),.0068,.0072,.0068,-37),
        (c.lerp(d,.976),.0034,.0038,.0038,-37),
        (d,.0008,.0012,.0011,-37),
    )
    return volume("Thumb metacarpal, knuckle and pad", [(*p,w,h,l,r) for p,w,h,l,r in shape],
                  collection,samples=5,sides=42,rounding=.93)


def sculpt(collection):
    palm = volume("Palm and wrist volume", (
        (-.002,-.113,0,.0300,.0215,.0190),
        (-.002,-.089,-.002,.0313,.023,.0204),
        (-.002,-.056,-.002,.0297,.0206,.0193),
        (-.001,-.031,-.001,.0297,.0187,.0176),
        (0,-.007,-.0006,.0294,.0167,.0150),
        (-.001,.008,0,.0322,.0180,.0162),
        (-.001,.031,.0003,.0377,.0194,.0172),
        (-.001,.055,0,.0420,.0182,.0170),
        (-.001,.073,-.0006,.0417,.0167,.0149),
        (-.0005,.087,-.0015,.0380,.0148,.0133),
        (.0033,.096,-.0021,.0326,.0124,.0110),
        (.006,.102,-.0026,.0219,.0087,.0084),
        (.006,.107,-.0025,.012,.0049,.0050),
    ), collection, rounding=.81)
    # Preserve the lower little knuckle and a shallow curve along the thumb side.
    for vertex in palm.data.vertices:
        p = vertex.co
        p.y -= .0085*smooth(.015,.037,-p.x)*smooth(.069,.100,p.y)
        p.x -= .0026*smooth(.020,.041,p.x)*gaussian(p.y-.072,.019)
    pieces = [
        volume("Thenar", (
            (.010,.004,.005,.0107,.0072,.0070),
            (.018,.021,.007,.0150,.0123,.0120),
            (.024,.038,.0081,.0155,.0121,.0118),
            (.031,.053,.0070,.0132,.0098,.0093),
            (.032,.065,.0048,.0098,.0071,.0068),
            (.030,.077,.0022,.0050,.0040,.0042),
        ), collection, sides=36),
        volume("Hypothenar", (
            (-.015,.001,.004,.0103,.0076,.0082),
            (-.023,.017,.007,.0140,.0109,.0096),
            (-.028,.036,.0084,.0130,.0116,.0110),
            (-.031,.052,.0075,.0118,.0100,.0106),
            (-.031,.067,.0045,.0098,.0075,.0096),
            (-.029,.077,.0007,.0068,.0049,.0077),
        ), collection,sides=32),
        # Start the saddle inside the palm so its end cap cannot appear as a
        # step on the back of the thumb when the skin bends.
        volume("Thumb-index web saddle", (
            (.025,.026,-.0023,.0040,.0038,.0043),
            (.033,.037,-.0019,.0067,.0046,.0074),
            (.039,.048,-.0012,.0081,.0058,.0081),
            (.0435,.057,-.0003,.0082,.0052,.0062),
            (.045,.065,.0005,.0074,.0043,.0048),
            (.043,.073,.0000,.0066,.0039,.0040),
            (.039,.080,-.0005,.0056,.0033,.0034),
            (.033,.087,-.0010,.0040,.0028,.0029),
        ), collection,samples=5,sides=40),
        thumb_volume(collection),
    ]
    for spec in FINGERS[:4]:
        pieces.append(digit_volume(spec, collection))
    for (a,b), rise in zip(zip(FINGERS[:3], FINGERS[1:4]), (.0048,.0036,.0007)):
        center = a.points[0].lerp(b.points[0],.50)-Vector((0,.005,.0013))
        lateral = (a.points[0].x-b.points[0].x)*.5
        pieces.append(volume(f"{a.name}–{b.name} web saddle", (
            (*(center-Vector((0,.008,0))),lateral+.0022,.0062,.0062),
            (*center,lateral+.0010,.0056,.0056),
            (*(center+Vector((0,rise,0))),lateral*.62,.0027,.0031),
        ), collection, sides=28))

    # One watertight skin with a shared web between adjoining anatomical forms.
    use_object(palm)
    for part in pieces:
        part.select_set(True)
    bpy.ops.object.join()
    palm.data.remesh_voxel_size = VOXEL
    palm.data.use_remesh_preserve_volume = True
    bpy.ops.object.voxel_remesh()
    relax = palm.modifiers.new("Relax the sculpted surface", "SMOOTH")
    relax.factor, relax.iterations = .59, 10
    bpy.ops.object.modifier_apply(modifier=relax.name)
    blend_junctions = palm.vertex_groups.new(name="Palm and finger junctions")
    for vertex in palm.data.vertices:
        p = vertex.co
        web = gaussian(p.y-.090,.015)*.72
        thenar = gaussian(p.x-.043,.018)*gaussian(p.y-.057,.025)
        index_root = gaussian(p.x-.034,.009)*gaussian(p.y-.091,.010)
        blend_junctions.add([vertex.index],max(web,thenar,index_root),"REPLACE")
    blend = palm.modifiers.new("Blend the palm pads and webbing", "SMOOTH")
    blend.vertex_group = blend_junctions.name
    blend.factor, blend.iterations = .72,30
    bpy.ops.object.modifier_apply(modifier=blend.name)
    palm.vertex_groups.clear()
    form_dorsal_surface(palm.data)
    reducer = palm.modifiers.new("Hand topology density", "DECIMATE")
    reducer.ratio = .225
    bpy.ops.object.modifier_apply(modifier=reducer.name)
    recalculate(palm.data)
    for face in palm.data.polygons:
        face.use_smooth = True
    palm.name = "Continuous hand skin.R"
    palm.data.name = "Hand skin · palm pads and fingers.R"
    return palm


def form_dorsal_surface(data):
    for vertex in data.vertices:
        p = vertex.co
        dorsal = 1-smooth(-.014,-.005,p.z)
        if not dorsal or not -.018<p.y<.105:
            continue
        relief = 0
        planar = Vector((p.x,p.y,0))
        for spec in FINGERS[:4]:
            knuckle = Vector((*spec.points[0][:2],0))
            source = Vector((*spec.base[:2],0))
            along,distance = closest_segment(planar,source,knuckle)
            relief += .00097*gaussian(distance,.00265)*math.sin(math.pi*along)**1.6
            relief += .00186*gaussian((planar-knuckle).length,.0051)
        p.z -= relief*dorsal


def closest_segment(p, a, b, stretch=1):
    line = b-a
    t = clamp((p-a).dot(line)/line.length_squared)
    delta = p-a-line*t
    if len(delta)==3:
        delta.z *= stretch
    return t, delta.length


def track(p, spec):
    lengths = spec.lengths
    tangent = (spec.points[1]-spec.points[0]).normalized()
    coordinate = (p-spec.points[0]).dot(tangent)
    if coordinate < 0:
        px = p-spec.points[0]-tangent*coordinate
        px.z *= .66
        return coordinate, px.length
    mark, best = 0, (0, math.inf)
    for i, (a,b) in enumerate(zip(spec.points,spec.points[1:])):
        t, distance = closest_segment(p,a,b,.66)
        if distance < best[1]:
            best = mark+t*lengths[i], distance
        mark += lengths[i]
    return best


def weights(p):
    wrist = smooth(-.031,-.006,p.y)
    palm = smooth(-.009,.027,p.y)
    result = {"Forearm":1-wrist, "Wrist":wrist*(1-palm), "Palm":wrist*palm}
    if p.y < -.010:
        return result
    candidates = []
    for spec in FINGERS[:4]:
        mark, distance = track(p,spec)
        strength = smooth(-.051,-.007,mark)*smooth(.033,.072,p.y)
        score = distance/(spec.radii[0]+.001)
        candidates.append((score, mark, strength, spec))
    candidates.sort(key=lambda row:row[0]+(1-row[2])*1.72)
    score, mark, strength, _ = candidates[0]
    # Blend neighbouring fingers across their bases before placing the thumb.
    influences = []
    best = score+(1-strength)*1.72
    for distance,at,gain,spec in candidates[:2 if mark<.017 else 1]:
        proximity = 1-smooth(.07,.49,distance+(1-gain)*1.72-best)
        amount = gain*proximity*(1-smooth(1.18,2.5,distance))
        if amount>.0001:
            influences.append((amount,at,spec))
    if influences:
        strength = max(row[0] for row in influences)
        denominator = sum(row[0] for row in influences)
        for name in result:
            result[name] *= 1-strength
        for amount,at,spec in influences:
            influence = strength*amount/denominator
            l0, l1, _ = spec.lengths
            transitions = (smooth(-.008,.008,at),smooth(l0-.006,l0+.006,at),
                           smooth(l0+l1-.0045,l0+l1+.0045,at))
            result[f"{spec.name}.Metacarpal"] = influence*(1-transitions[0])
            for name, w in zip(spec.joints, (transitions[0]-transitions[1],transitions[1]-transitions[2],transitions[2])):
                result[name] = influence*w

    thumb = FINGERS[-1]
    at, _ = track(p,thumb)
    # The first web runs diagonally into the palm. A continuous falloff keeps
    # its rim attached even when the thumb crosses the index metacarpal.
    across = p.x-.45*(p.y-.060)
    attach = smooth(.010,.063,across)*smooth(.004,.030,p.y)*smooth(-.028,.000,at)
    # Dorsal skin over the base stays with the first web. The shaft skin
    # farther out can follow the thumb independently of the metacarpal fold.
    dorsal = (1-smooth(-.007,.010,p.z))*(1-smooth(.045,.063,p.x))
    attach *= 1-.60*dorsal
    web = .42*4*attach*(1-attach)*gaussian(p.y-.064,.024)
    for name in result:
        result[name] *= (1-attach)*(1-web)
    l0,l1,_ = thumb.lengths
    hinge = smooth(.039,.058,across)
    proximal = smooth(l0-.008,l0+.009,at)*hinge
    distal = smooth(l0+l1-.0055,l0+l1+.0055,at)*hinge
    result["Thumb.CMC"] = attach*(1-web)*(1-proximal)
    result["Thumb.MCP"] = attach*(1-web)*(proximal-distal)
    result["Thumb.IP"] = attach*(1-web)*distal
    result["Thumb.Web"] = web
    return result


def steer_thumb(rig, side):
    control = rig.pose.bones[THUMB_CONTROL]
    base = rig.pose.bones["Thumb.CMC"]
    lo, hi = map(math.radians, THUMB_SWING)
    low, start, ratio = THUMB_LIFT
    swing = f"min({hi},max({lo},z*{side}))"
    raise_base = f"{math.radians(low)}+{ratio}*max(0,{swing}-{math.radians(start)})"
    for index, (channels, expr) in enumerate((
        ("xz", f"max(x,{raise_base})"),
        ("y", "y"),
        ("z", f"{side}*({swing})"),
    )):
        driver = base.driver_add("rotation_euler",index).driver
        driver.type = "SCRIPTED"
        for channel in channels:
            var = driver.variables.new()
            var.name = channel
            var.type = "SINGLE_PROP"
            var.targets[0].id = rig
            axis = "xyz".index(channel)
            var.targets[0].data_path = control.path_from_id("rotation_euler")+f"[{axis}]"
        driver.expression = expr


def make_rig(collection, side):
    suffix = "R" if side > 0 else "L"
    data = bpy.data.armatures.new("Anatomical hand skeleton."+suffix)
    rig = bpy.data.objects.new("Hand rig."+suffix, data)
    collection.objects.link(rig)
    rig.show_in_front = True
    data.display_type = "OCTAHEDRAL"
    use_object(rig)
    bpy.ops.object.mode_set(mode="EDIT")

    def add(name, head, tail, parent=None, connected=False, roll=0):
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = mirror(head,side), mirror(tail,side)
        normal = Quaternion((Vector(tail)-Vector(head)).normalized(),math.radians(roll)) @ UP
        bone.align_roll(mirror(normal,side))
        if parent:
            bone.parent = data.edit_bones[parent]
            bone.use_connect = connected
        return bone

    add("Forearm",(0,-.113,0),WRIST)
    add("Wrist",WRIST,(0,.023,0),"Forearm",True)
    add("Palm",(0,.023,0),(.0005,.087,0),"Wrist",True)
    for spec in FINGERS:
        parent = "Palm"
        if spec.name != "Thumb":
            parent = f"{spec.name}.Metacarpal"
            add(parent,spec.base,spec.points[0],"Palm")
        for i, (name,head,tail) in enumerate(zip(spec.joints,spec.points,spec.points[1:])):
            add(name,head,tail,parent,i>0 or spec.name!="Thumb",
                THUMB_ROLL[i] if spec.name=="Thumb" else 0)
            parent = name
    thumb_root,thumb_knuckle,*_ = FINGERS[-1].points
    add(THUMB_CONTROL,thumb_root,thumb_knuckle,"Palm",roll=THUMB_ROLL[0]).use_deform = False
    add("Thumb.Web",thumb_root,thumb_knuckle,"Palm",roll=THUMB_ROLL[0])
    bpy.ops.object.mode_set(mode="OBJECT")

    hand_bones = data.collections.new("Forearm, wrist and palm")
    fingers = data.collections.new("Finger joints")
    thumb = data.collections.new("Thumb opposition")
    tissue = data.collections.new("Skin deformation")
    for pose in rig.pose.bones:
        pose.rotation_mode = "XYZ"
        name = pose.name
        limits = None
        if name in {"Wrist", "Palm", "Forearm"} or name.endswith("Metacarpal"):
            hand_bones.assign(pose.bone)
            if name == "Wrist":
                limits = ((-57,70),(-24,24),(-28,28))
            elif name != "Forearm":
                limits = ((-12,22),(-14,14),(-13,13))
        elif name=="Thumb.Web":
            tissue.assign(pose.bone)
            follow = pose.constraints.new("COPY_ROTATION")
            follow.name = "Follow a fraction of the thumb base lift"
            follow.target = rig
            follow.subtarget = "Thumb.CMC"
            follow.target_space = follow.owner_space = "LOCAL"
            follow.use_y = follow.use_z = False
            follow.influence = .23
        elif name==THUMB_CONTROL:
            thumb.assign(pose.bone)
            pose.lock_location = pose.lock_scale = (True,True,True)
            swing = THUMB_SWING if side>0 else (-THUMB_SWING[1],-THUMB_SWING[0])
            limits = ((-25,64),(-53,53),swing)
        elif name.startswith("Thumb"):
            if name.endswith("CMC"):
                tissue.assign(pose.bone)
                limits = ((-25,64),(-53,53),(-58,58))
            elif name.endswith("MCP"):
                thumb.assign(pose.bone)
                limits = ((-12,69),(-5,5),(-8,8))
            else:
                thumb.assign(pose.bone)
                limits = ((-15,80),(0,0),(0,0))
                pose.lock_rotation = (False,True,True)
        else:
            fingers.assign(pose.bone)
            limits = ((-22,96),(-12,12),(-29,29)) if name.endswith("MCP") else ((-12,111),(-4,4),(-6,6))
        if limits:
            locked = pose.constraints.new("LIMIT_ROTATION")
            locked.name = "Anatomical range"
            locked.owner_space = "LOCAL"
            locked.use_transform_limit = True
            for axis,(low,high) in zip("xyz",limits):
                setattr(locked,"use_limit_"+axis,True)
                setattr(locked,"min_"+axis,math.radians(low))
                setattr(locked,"max_"+axis,math.radians(high))
    steer_thumb(rig,side)
    tissue.is_visible = False
    rig["Joint convention"] = "Local X is flexion. The thumb CMC also rotates and opposes on Y and Z."
    rig["Pose review"] = "Frames 39 and 49 show the thumb hinges. Frame 80 shows the fist and frame 95 shows a palm tuck."
    return rig


def mirror(p, side):
    return Vector((p[0]*side,p[1],p[2]))


def bind(obj, rig):
    deform = obj.modifiers.new("Hand deformation", "ARMATURE")
    deform.object = rig
    deform.use_deform_preserve_volume = True
    obj.parent = rig


def skin_weights(source, rig):
    groups = [source.vertex_groups.new(name=bone.name) for bone in rig.data.bones if bone.use_deform]
    indices = {group.name:group.index for group in groups}
    values = np.zeros((len(source.data.vertices),len(groups)),dtype=np.float32)
    coordinates = np.empty((len(values),3),dtype=np.float32)
    source.data.vertices.foreach_get("co",coordinates.ravel())
    for vertex in source.data.vertices:
        for name,influence in weights(vertex.co).items():
            values[vertex.index,indices[name]] = influence

    # Diffuse the bind weights across the actual skin graph. Finger webs should
    # deform with both neighbours, and the fleshy CMC transition must not crease
    # along the boundary where the closest capsule switches from palm to thumb.
    edges = np.empty((len(source.data.edges),2),dtype=np.int32)
    source.data.edges.foreach_get("vertices",edges.ravel())
    a,b = edges.T
    neighborhood = np.concatenate((a,b))
    neighbors = np.concatenate((b,a))
    edge_weight = 1/np.maximum(.0006,np.linalg.norm(coordinates[a]-coordinates[b],axis=1))
    edge_weight = np.tile(edge_weight,2)
    totals = np.bincount(neighborhood,edge_weight,minlength=len(values))
    edge_weight = (edge_weight/totals[neighborhood]).astype(np.float32)
    width = coordinates[:,0]
    depth = coordinates[:,1]
    web = np.exp(-.5*((depth-.093)/.019)**2)
    thumb = np.exp(-.5*(((width-.040)/.020)**2+((depth-.065)/.025)**2))
    smoothing = (.27+.58*np.maximum(web,thumb))[:,None]
    for _ in range(24):
        average = np.zeros_like(values)
        np.add.at(average,neighborhood,values[neighbors]*edge_weight[:,None])
        values += smoothing*(average-values)
    for vertex,row in enumerate(values):
        strongest = np.argsort(row)[-6:]
        selected = [j for j in strongest if row[j]>.00018]
        total = float(sum(row[j] for j in selected))
        for j in selected:
            groups[j].add([vertex],float(row[j])/total,"REPLACE")
    bind(source,rig)
    relax = source.modifiers.new("Soften joint folds","CORRECTIVE_SMOOTH")
    relax.factor,relax.iterations = .64,13
    relax.smooth_type = "LENGTH_WEIGHTED"
    web_group = source.vertex_groups.new(name="First web surface")
    for vertex in source.data.vertices:
        x,y,z = vertex.co
        amount = gaussian(x-.037,.013)*gaussian(y-.072,.016)*(.57+.43*(1-smooth(-.003,.009,z)))
        if amount>.015:
            web_group.add([vertex.index],amount,"REPLACE")
    fold = source.modifiers.new("Round the compressed first web","SMOOTH")
    fold.vertex_group = web_group.name
    fold.factor,fold.iterations = .76,27


PALM_LINES = (
    ((.033,.089),(.024,.082),(.015,.071),(.010,.053),(.009,.035),(.014,.018),(.020,.008)),
    ((-.036,.066),(-.027,.078),(-.013,.081),(.002,.077),(.016,.074),(.030,.081)),
    ((-.035,.050),(-.024,.060),(-.011,.065),(.002,.063),(.017,.057),(.028,.062)),
    ((.025,.014),(.032,.020),(.037,.027),(.041,.036)),
    ((-.025,.021),(-.021,.032),(-.015,.044),(-.008,.049)),
)


def gaussian(value, scale):
    return math.exp(-.5*(value/scale)**2)


def skin_attributes(obj):
    data = obj.data
    color = data.color_attributes.new("Skin tone", "FLOAT_COLOR", "POINT")
    crease = data.attributes.new("Crease relief", "FLOAT", "POINT")
    lines = []
    for path in PALM_LINES:
        points = [Vector(pair) for pair in path]
        lines.append([Vector(catmull(points,i,t/3)) for i in range(len(points)-1) for t in range(3)]+[points[-1]])
    for v in data.vertices:
        p = v.co
        palmar = smooth(.001,.011,p.z)
        warmth = .014*math.sin(p.x*54+p.y*34)+.011*math.sin(p.y*117-p.z*93)
        fold, pad, knuckle = 0, 0, 0
        if -.023<p.y<.015:
            # The wrist folds wrap across the palmar side and fade toward the edges.
            across = p.x/.030
            wrist = palmar*(1-smooth(.53,.93,abs(across)))
            for offset,width,depth in ((.0031,.00105,.59),(-.0037,.00102,.46),(-.0091,.00094,.26)):
                curve = offset + .0030*across**2 + .0012*across
                fold += wrist*gaussian(p.y-curve,width)*depth
        if -.025<p.y<.100:
            flat = Vector((p.x,p.y))
            for i,line in enumerate(lines):
                distance = min(closest_segment(flat,a,b)[1] for a,b in zip(line,line[1:]))
                fade = smooth(0,.007,(flat-line[0]).length)*smooth(0,.007,(flat-line[-1]).length)
                fold += palmar*gaussian(distance,.00113 if i<3 else .00079)*fade*(.82 if i<3 else .26)
        if p.y>.064 or p.x>.033:
            near = min(FINGERS,key=lambda spec:track(p,spec)[1])
            at, off = track(p,near)
            l0,l1,l2 = near.lengths
            supported = smooth(-.004,.004,at)*(1-smooth(.010,.016,off))
            if near.name=="Thumb":
                supported *= smooth(.042,.057,p.x)
            for joint,width in ((l0,.00106),(l0+l1,.00092)):
                fold += palmar*supported*(gaussian(at-joint,width)*.62+
                    gaussian(at-joint+.0018,width*.63)*.21)
                fold += (1-palmar)*supported*gaussian(at-joint-.001,width*.86)*.15
                knuckle += (1-palmar)*supported*gaussian(at-joint,.0044)*.48
            pad = palmar*supported*smooth(l0+l1,l0+l1+l2*.93,at)
        crease.data[v.index].value = clamp(fold)
        amount = palmar*(.22 if p.y<-.001 else .92)
        back = (.347,.195,.143)
        palm = (.457,.241,.183)
        shade = (.099,.059,.047)
        channels = [mix(a,b,amount)+warmth-(.013*knuckle if i>0 else .004*knuckle)
                    for i,(a,b) in enumerate(zip(back,palm))]
        dorsal_detail = (1-palmar)*gaussian(p.y-.034,.064)*(1-smooth(.071,.106,p.y))
        vessel = dorsal_detail*gaussian(p.x+.011-.007*math.sin(p.y*72),.0022)
        channels[0] -= .017*vessel
        channels[2] += .009*vessel
        channels[0] += pad*.060
        channels[1] -= pad*.012
        color.data[v.index].color = (*(clamp(c-clamp(fold)*d) for c,d in zip(channels,shade)),1)
        if fold>.055 and v.normal.z>.25:
            p.z -= .00016*clamp(fold)*v.normal.z
    data.color_attributes.active_color = color
    data.update()


def material(name, diffuse, rough):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*diffuse,1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*diffuse,1)
    shader.inputs["Roughness"].default_value = rough
    return mat,shader


def skin_material():
    mat, shader = material("Skin · warm dermis and palmar creases",(.397,.226,.167),.52)
    nodes,links = mat.node_tree.nodes, mat.node_tree.links
    shader.inputs["Subsurface Weight"].default_value = .108
    shader.inputs["Subsurface Radius"].default_value = (1,.49,.27)
    shader.inputs["Subsurface Scale"].default_value = .006
    shader.inputs["IOR"].default_value = 1.43
    shader.inputs["Specular IOR Level"].default_value = .27
    tone = nodes.new("ShaderNodeVertexColor")
    tone.layer_name = "Skin tone"
    tone.location = (-620,230)
    pore = nodes.new("ShaderNodeTexNoise")
    pore.inputs["Scale"].default_value = 218
    pore.inputs["Detail"].default_value = 2.2
    pore.inputs["Roughness"].default_value = .62
    pore.location = (-760,-200)
    coordinates = nodes.new("ShaderNodeTexCoord")
    coordinates.location = (-960,-200)
    links.new(coordinates.outputs["Generated"],pore.inputs["Vector"])
    complexion = nodes.new("ShaderNodeTexNoise")
    complexion.inputs["Scale"].default_value = 32
    complexion.inputs["Detail"].default_value = 3.1
    complexion.location = (-780,505)
    links.new(coordinates.outputs["Generated"],complexion.inputs["Vector"])
    depth = nodes.new("ShaderNodeMapRange")
    depth.inputs["To Min"].default_value = .88
    depth.inputs["To Max"].default_value = 1.06
    depth.location = (-590,505)
    links.new(complexion.outputs["Fac"],depth.inputs["Value"])
    variation = nodes.new("ShaderNodeMixRGB")
    variation.blend_type = "MULTIPLY"
    variation.inputs[0].default_value = 1
    variation.location = (-310,430)
    links.new(tone.outputs["Color"],variation.inputs[1])
    links.new(depth.outputs["Result"],variation.inputs[2])
    links.new(variation.outputs[0],shader.inputs["Base Color"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.location = (-280,190)
    rough.inputs["To Min"].default_value = .45
    rough.inputs["To Max"].default_value = .58
    links.new(pore.outputs["Fac"],rough.inputs["Value"])
    links.new(rough.outputs["Result"],shader.inputs["Roughness"])
    pore_bump = nodes.new("ShaderNodeBump")
    pore_bump.inputs["Strength"].default_value = .27
    pore_bump.inputs["Distance"].default_value = .00021
    pore_bump.location = (-520,-210)
    links.new(pore.outputs["Fac"],pore_bump.inputs["Height"])
    crease = nodes.new("ShaderNodeAttribute")
    crease.attribute_name = "Crease relief"
    crease.location = (-590,-420)
    carved = nodes.new("ShaderNodeBump")
    carved.invert = True
    carved.inputs["Strength"].default_value = .36
    carved.inputs["Distance"].default_value = .00044
    carved.location = (-255,-160)
    links.new(crease.outputs["Fac"],carved.inputs["Height"])
    links.new(pore_bump.outputs["Normal"],carved.inputs["Normal"])
    links.new(carved.outputs["Normal"],shader.inputs["Normal"])
    return mat


def nail_material():
    mat, shader = material("Nails · translucency and free edge",(.57,.351,.29),.31)
    shader.inputs["Coat Weight"].default_value = .19
    shader.inputs["Coat Roughness"].default_value = .29
    shader.inputs["Subsurface Weight"].default_value = .09
    shader.inputs["Subsurface Scale"].default_value = .0024
    tint = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    tint.layer_name = "Nail tone"
    tint.location = (-320,210)
    mat.node_tree.links.new(tint.outputs["Color"],shader.inputs["Base Color"])
    return mat


def nails(skin, rig, polish, collection):
    vertices = [v.co for v in skin.data.vertices]
    surface = BVHTree.FromPolygons(vertices,[polygon.vertices for polygon in skin.data.polygons])
    for spec in FINGERS:
        start,end = spec.points[-2:]
        tangent = (end-start).normalized()
        pad = Quaternion(tangent,math.radians(THUMB_ROLL[-1])) @ UP if spec.name=="Thumb" else UP
        side = tangent.cross(pad).normalized()
        length = (end-start).length
        radius = spec.radii[-1]
        vertices,colors,faces = [],[],[]
        rows,columns = 19,19
        for j in range(rows):
            t = j/(rows-1)
            width = radius*(.78 if spec.name=="Thumb" else .81)
            width *= mix(.58,1,smooth(0,.22,t))*mix(1,.58,smooth(.81,1,t))
            for i in range(columns):
                q = i/(columns-1)*2-1
                along = length*(mix(.20,.944,t)+.095*(1-t)*q*q-.072*t*q*q)
                sample = start+tangent*along+side*(q*width)
                hit,normal,_,_ = surface.ray_cast(sample-pad*.033,pad,.066)
                if hit is None:
                    raise RuntimeError(f"Nail {spec.name} missed the dorsal skin")
                edge = smooth(0,.18,min(t,1-t))*smooth(0,.22,1-abs(q))
                vertices.append(hit+normal*mix(-.00008,.00037,edge))
                pink = (.421,.248,.196)
                white = (.583,.463,.363)
                free = smooth(.88,.99,t)*mix(.83,1,1-abs(q))
                moon = gaussian(t-.22,.12)*gaussian(q,.4)*.26
                border = smooth(.68,1,abs(q))*(1-free)*.28
                tint = [mix(c,light,free+moon*(1-free))-border*shadow
                        for c,light,shadow in zip(pink,white,(.09,.072,.059))]
                colors.append((*tint,1))
        for j in range(rows-1):
            for i in range(columns-1):
                at = j*columns+i
                faces.append((at,at+1,at+columns+1,at+columns))
        nail = mesh(spec.name+" nail.R",vertices,faces,collection)
        if nail.data.polygons[0].normal.dot(pad)>0:
            bm = bmesh.new()
            bm.from_mesh(nail.data)
            bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
            bm.to_mesh(nail.data)
            bm.free()
        color = nail.data.color_attributes.new("Nail tone","FLOAT_COLOR","POINT")
        for item,tint in zip(color.data,colors):
            item.color = tint
        nail.data.materials.append(polish)
        joint = nail.vertex_groups.new(name=spec.joints[-1])
        joint.add(list(range(len(vertices))),1,"REPLACE")
        bind(nail,rig)
        for face in nail.data.polygons:
            face.use_smooth = True
        yield nail


def mirrored(original, rig, collection):
    left = original.copy()
    left.data = original.data.copy()
    left.name = original.name.removesuffix(".R")+".L"
    left.data.name = original.data.name.removesuffix(".R")+".L"
    collection.objects.link(left)
    for vertex in left.data.vertices:
        vertex.co.x *= -1
    bm = bmesh.new()
    bm.from_mesh(left.data)
    bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
    bm.to_mesh(left.data)
    bm.free()
    left.parent = rig
    left.modifiers["Hand deformation"].object = rig
    return left


def drive_fold(key, rig, joint, start, span):
    driver = key.driver_add("value").driver
    driver.type = "SCRIPTED"
    variable = driver.variables.new()
    variable.name = "bend"
    variable.type = "SINGLE_PROP"
    variable.targets[0].id = rig
    variable.targets[0].data_path = rig.pose.bones[joint].path_from_id("rotation_euler")+"[0]"
    driver.expression = f"min(1,max(0,(bend-{start})/{span}))"


def flex_creases(skin, rig, side):
    skin.shape_key_add(name="Rest skin", from_mix=False)
    for spec in FINGERS:
        for j in (1, 2):
            joint = spec.joints[j]
            center = spec.points[j]
            tangent = (spec.points[j+1]-spec.points[j-1]).normalized()
            roll = THUMB_ROLL[j] if spec.name == "Thumb" else 0
            inward = Quaternion(tangent, math.radians(roll)) @ UP
            key = skin.shape_key_add(name=f"{joint} palmar compression", from_mix=False)
            for vertex in skin.data.vertices:
                offset = mirror(vertex.co, side)-center
                along = offset.dot(tangent)
                if abs(along) > .007 or offset.length > spec.radii[j]*1.26:
                    continue
                face = smooth(.0015, .0060, offset.dot(inward))
                crease = .00039*gaussian(along+.0006,.0012)
                shoulder = .00012*gaussian(along-.0021,.0014)
                if face > 0:
                    key.data[vertex.index].co += mirror(inward, side)*(face*(shoulder-crease))
            drive_fold(key,rig,joint,.32,.92)

    pad = skin.shape_key_add(name="Palmar pad compression under the little finger", from_mix=False)
    for vertex in skin.data.vertices:
        x,y,z = mirror(vertex.co,side)
        amount = gaussian(x+.0245,.007)*gaussian(y-.085,.008)*smooth(.006,.010,z)
        pad.data[vertex.index].co.z -= .00065*amount
    drive_fold(pad,rig,"Little.MCP",.99,.26)


FIST_BENDS = ((69,90,52),(75,94,59),(77,95,61),(75,96,66))
FIST_THUMB = ((50.7,-28.1,-19.4),(25.9,52.3))
TUCKED_THUMB = ((40,-21,-17),(53,63))
FIST_METACARPAL_YAW = (4,1,-1.5,-6.25)
FIST_METACARPAL_CUP = (7.5,6.54,6.51,10.59)
FIST_KNUCKLE_YAW = (-8.5,-5,-3.25,1.25)


POSES = (
    (1,"Relaxed",((8,17,8),(11,23,11),(14,27,15),(19,31,18)),(27,5,5),(13,10),(-6,0,4),-13),
    (28,"Open",((1,2,1),(2,4,2),(4,6,4),(6,10,5)),(-7,-4,-12),(4,7),(2,0,-2),-2),
    (39,"Thumb knuckle bends",((2,4,1),(3,4,2),(5,8,5),(8,11,5)),(-5,-3,-11),(34,9),(3,1,-3),8),
    (49,"Thumb tip curls",((3,5,2),(5,7,3),(8,11,6),(12,15,8)),(-3,-2,-10),(35,46),(5,1,-4),16),
    (54,"Thumb lifts",((5,9,5),(9,15,8),(16,23,12),(23,35,19)),(18,4,-6),(29,31),(6,1,-3),21),
    (59,"Fingers begin to close",((10,21,11),(17,31,18),(27,46,26),(39,57,35)),(28,9,9),(27,27),(7,2,-2),23),
    (69,"Thumb crosses the curled fingers",((53,75,42),(65,83,49),(70,90,56),(72,91,62)),(43,-6,-10),(24,34),(10,3,1),19),
    (80,"Closed fist",FIST_BENDS,*FIST_THUMB,(11,3,2),12),
    (86,"Squeeze",FIST_BENDS,*FIST_THUMB,(12,4,1),10),
    (95,"Thumb folds across palm",((3,4,2),(3,5,3),(5,5,4),(7,8,5)),*TUCKED_THUMB,(1,2,-2),7),
    (100,"Hold thumb fold",((3,4,2),(3,5,3),(5,5,4),(7,8,5)),*TUCKED_THUMB,(0,1,-2),4),
    (104,"Thumb leaves palm",((4,5,3),(4,6,4),(6,7,5),(9,11,6)),(33,-23,-9),(48,57),(-1,2,-3),6),
    (112,"Pinch",((72.5,20,33.5),(29,63,25),(39,69,34),(47,73,41)),(38,-1.5,15),(9,7),(-7,3,-4),8),
    (126,"Pinch holds",((72.5,20,33.5),(29,63,25),(39,69,34),(47,73,41)),(38,-1.5,15),(9,7),(-8,2,-4),-7),
    (148,"Rounded grip",((42,61,27),(46,68,29),(50,73,35),(55,76,38)),(35,12,16),(28,25),(6,-3,2),-17),
    (167,"Uncurl",((9,12,5),(12,14,8),(18,19,10),(22,25,13)),(7,5,-9),(6,9),(-2,-2,2),-28),
    (180,"Release",((8,17,8),(11,23,11),(14,27,15),(19,31,18)),(27,5,5),(13,10),(-6,0,4),-14),
)


def pose_fingers(rig, bends, side=1, spread=2.2, pinch=False):
    cup = sum(bend[0] for bend in bends)/304
    rig.pose.bones["Palm"].rotation_euler.x = math.radians(cup*2.6)
    for i,(spec,bend) in enumerate(zip(FINGERS[:4],bends)):
        clench = 0 if pinch else smooth(22,69,bend[0])
        splay = (i-1.24)*spread*(1-clamp(cup))
        meta = rig.pose.bones[f"{spec.name}.Metacarpal"]
        meta.rotation_euler = (
            math.radians(mix((i/3)**1.5*10.8*cup,FIST_METACARPAL_CUP[i],clench)),
            0,
            math.radians(mix(splay*.26,FIST_METACARPAL_YAW[i],clench)*side),
        )
        yaw = 15 if pinch and not i else mix(splay,FIST_KNUCKLE_YAW[i],clench)
        for j,name in enumerate(spec.joints):
            rig.pose.bones[name].rotation_euler = (
                math.radians(bend[j]),0,math.radians(yaw*side) if not j else 0)


def animate(scene, rig, side, add_labels=False):
    for frame,label,bends,thumb,thumb_tip,wrist,swivel in POSES:
        if add_labels:
            scene.timeline_markers.new(label,frame=frame)
        for bone in rig.pose.bones:
            if bone.name != "Thumb.CMC":
                bone.rotation_euler = (0,0,0)
        rig.pose.bones["Forearm"].rotation_euler.y = math.radians(swivel*side)
        rig.pose.bones["Wrist"].rotation_euler = tuple(math.radians(v) for v in (wrist[0],wrist[1]*side,wrist[2]*side))
        pose_fingers(rig,bends,side,5.4 if (28<=frame<=49 or 95<=frame<=104) else 2.2,
                     pinch=frame in (112,126))
        rig.pose.bones[THUMB_CONTROL].rotation_euler = tuple(math.radians(v) for v in (thumb[0],thumb[1]*side,thumb[2]*side))
        rig.pose.bones["Thumb.MCP"].rotation_euler.x = math.radians(thumb_tip[0])
        rig.pose.bones["Thumb.IP"].rotation_euler.x = math.radians(thumb_tip[1])
        for pose in rig.pose.bones:
            if pose.name not in ("Thumb.CMC","Thumb.Web"):
                pose.keyframe_insert(data_path="rotation_euler",frame=frame,group=pose.name)
    # Lift the thumb away from the index knuckle before both uncurl.
    for name, angles in ((THUMB_CONTROL,(46,-17*side,-15*side)),
                         ("Thumb.MCP",(25,0,0)),("Thumb.IP",(53,0,0))):
        pose = rig.pose.bones[name]
        pose.rotation_euler = tuple(map(math.radians,angles))
        pose.keyframe_insert(data_path="rotation_euler",frame=88,group=pose.name)
    animation = rig.animation_data
    animation.action.name = "Hand pose study."+("R" if side>0 else "L")
    for curve in animation.action.layers[0].strips[0].channelbag(animation.action_slot).fcurves:
        for key in curve.keyframe_points:
            key.handle_left_type = key.handle_right_type = "AUTO_CLAMPED"
        curve.update()


def building_collection(scene,name):
    result = bpy.data.collections.new(name)
    scene.collection.children.link(result)
    return result


def sleeve(rig, side, collection, fabric):
    cuff = volume("Cuff preview."+("R" if side>0 else "L"), (
        (-.002*side,-.119,-.002,.0343,.026,.024),
        (-.002*side,-.112,-.001,.0341,.026,.0241),
        (-.002*side,-.084,-.001,.0336,.0253,.0233),
        (-.002*side,-.061,-.001,.0318,.0230,.0224),
        (-.002*side,-.056,-.001,.0316,.0223,.0215),
        (-.002*side,-.053,-.001,.0317,.0221,.0216),
        (-.002*side,-.049,-.001,.0312,.0220,.0212),
    ), collection,sides=48,rounding=.88)
    cuff.data.materials.append(fabric)
    group = cuff.vertex_groups.new(name="Forearm")
    group.add(list(range(len(cuff.data.vertices))),1,"REPLACE")
    bind(cuff,rig)
    for face in cuff.data.polygons:
        face.use_smooth = True


def aim_object(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def studio(scene, collection):
    def camera_shot(name, keys):
        data = bpy.data.cameras.new(name)
        data.type = "ORTHO"
        camera = bpy.data.objects.new(name,data)
        collection.objects.link(camera)
        for frame, at, look, width in keys:
            camera.location = at
            aim_object(camera, look)
            data.ortho_scale = width
            camera.keyframe_insert(data_path="location", frame=frame)
            camera.keyframe_insert(data_path="rotation_euler", frame=frame)
            data.keyframe_insert(data_path="ortho_scale", frame=frame)
        return camera

    wide = camera_shot("Full hand review", (
        (1,(.002,-.080,.61),(-.015,.043,.045),.515),
        (28,(.022,-.075,.60),(-.014,.043,.042),.515),
        (180,(.002,-.080,.62),(-.015,.043,.041),.515),
    ))
    detail = camera_shot("Thumb and fist close-up", (
        (34,(.166,-.094,.59),(.106,.066,.060),.314),
        (54,(.192,-.104,.52),(.115,.069,.065),.306),
        (80,(.141,-.130,.56),(.103,.046,.069),.269),
        (95,(.165,-.123,.56),(.104,.068,.064),.313),
        (124,(.223,-.090,.51),(.111,.073,.064),.307),
        (150,(.194,-.108,.55),(.108,.064,.063),.305),
        (168,(.184,-.109,.56),(.107,.066,.059),.315),
    ))
    scene.camera = wide
    for name, frame, camera in (("Both hands",1,wide),("Thumb close-up",34,detail),("Both hands return",171,wide)):
        scene.timeline_markers.new(name,frame=frame).camera = camera
    floor = mesh("Studio backdrop",[(-3,-3,-.06),(3,-3,-.06),(3,3,-.06),(-3,3,-.06)],[(0,1,2,3)],collection)
    floor.data.materials.append(material("Slate",(.025,.035,.049),.88)[0])
    for name,center,power,radius,color in (
        ("Key",(-.33,.36,.53),9.6,.45,(1,.88,.79)),
        ("Fill",(.34,-.16,.41),5.3,.42,(.86,.92,1)),
        ("Rim",(.19,.35,.22),3.9,.29,(.73,.86,1)),
    ):
        data = bpy.data.lights.new(name,"AREA")
        data.energy,data.shape,data.size,data.color = power,"DISK",radius,color
        lamp = bpy.data.objects.new(name,data)
        collection.objects.link(lamp)
        lamp.location = center
        aim_object(lamp,(0,.052,.03))
    scene.world = bpy.data.worlds.new("Studio environment")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (.10,.13,.18,1)
    background.inputs["Strength"].default_value = .25
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x,scene.render.resolution_y = 1480,1110
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.28


def thumb_palm_patches(skin):
    names = {group.index: group.name for group in skin.vertex_groups}
    thumb, palm = set(), set()
    for vertex in skin.data.vertices:
        x, y, z = vertex.co
        phalanges = sum(link.weight for link in vertex.groups
                        if names[link.group] in ("Thumb.MCP", "Thumb.IP"))
        if x > .048 and phalanges > .58:
            thumb.add(vertex.index)
        if z > .004 and -.042 < x < .045 and .017 < y < .103 and phalanges < .25:
            palm.add(vertex.index)
    skin.data.calc_loop_triangles()
    triangles = [tuple(face.vertices) for face in skin.data.loop_triangles]
    patches = tuple([face for face in triangles if region.issuperset(face)]
                    for region in (thumb, palm))
    if not all(patches):
        raise RuntimeError("Could not find the thumb and palmar skin patches")
    return patches


def validate(skin, right, left, scene):
    # Check the editable skin and its deformed surface through the whole motion.
    bm = bmesh.new()
    bm.from_mesh(skin.data)
    if any(not edge.is_manifold for edge in bm.edges):
        raise RuntimeError("Skin is not watertight")
    bm.verts.ensure_lookup_table()
    seen = {bm.verts[0]}
    pending = list(seen)
    while pending:
        point = pending.pop()
        for edge in point.link_edges:
            v = edge.other_vert(point)
            if v not in seen:
                seen.add(v)
                pending.append(v)
    if len(seen)!=len(bm.verts):
        raise RuntimeError(f"Skin has {len(bm.verts)-len(seen)} disconnected vertices")
    bm.free()
    roles = {g.index:0 for g in skin.vertex_groups if right.data.bones.get(g.name)}
    for vertex in skin.data.vertices:
        deform = [g for g in vertex.groups if g.group in roles]
        if not deform or len(deform)>6 or abs(sum(g.weight for g in deform)-1)>.0003:
            raise RuntimeError("Skin weights are not normalized")
        for link in deform:
            roles[link.group] += 1
    if min(roles.values())<14 or any(sum(b.use_deform for b in rig.data.bones)!=23 for rig in (right,left)):
        raise RuntimeError("A deform joint is missing or has insufficient weights")
    edge = np.empty((len(skin.data.edges),2),dtype=np.int32)
    coordinates = np.empty((len(skin.data.vertices),3),dtype=np.float32)
    skin.data.edges.foreach_get("vertices",edge.ravel())
    skin.data.vertices.foreach_get("co",coordinates.ravel())
    a,b = edge.T
    length = np.linalg.norm(coordinates[a]-coordinates[b],axis=1)
    mask = length>.0009
    thumb_patch, palm_patch = thumb_palm_patches(skin)
    labels = {frame: label for frame, label, *_ in POSES}
    for frame in range(scene.frame_start, scene.frame_end+1):
        scene.frame_set(frame)
        posed = skin.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
        label = labels.get(frame, f"frame {frame}")
        if len(posed.vertices)!=len(skin.data.vertices):
            raise RuntimeError(f"Invalid skin at {label}")
        posed.vertices.foreach_get("co",coordinates.ravel())
        if not np.isfinite(coordinates).all():
            raise RuntimeError(f"Invalid skin at {label}")
        points = [vertex.co.copy() for vertex in posed.vertices]
        thumb = BVHTree.FromPolygons(points, thumb_patch, all_triangles=True)
        palm = BVHTree.FromPolygons(points, palm_patch, all_triangles=True)
        if thumb.overlap(palm):
            raise RuntimeError(f"Thumb skin intersects the palm at {label}")
        if frame in labels:
            changes = np.linalg.norm(coordinates[a]-coordinates[b],axis=1)[mask]/length[mask]
            if np.quantile(changes,.99)>2.25:
                raise RuntimeError(f"Excessive skin stretching at {label}")
    print(f"Validated {len(skin.data.vertices):,} vertices, 22 anatomical deform bones and a thumb web support per hand.",flush=True)
    print(f"Checked thumb–palm surface clearance on all {scene.frame_end-scene.frame_start+1} frames.",flush=True)


def configure_workspace(scene, hand):
    scene.frame_set(28)
    use_object(hand)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                view = area.spaces.active
                view.overlay.show_floor = False
                view.overlay.show_axis_x = view.overlay.show_axis_y = False
                view.overlay.show_extras = False
                view.shading.color_type = "MATERIAL"
                view.region_3d.view_distance = .43
                view.region_3d.view_location = (0,.028,.044)
                view.region_3d.view_rotation = Quaternion((1,0,0),.18)
                view.region_3d.view_perspective = "ORTHO"
                view.clip_start = .001
    guide = bpy.data.texts.new("Hand pose guide")
    guide.write("FIRST-PERSON HANDS\n\n"
                "The right palm and left dorsal hand are displayed side by side at real scale.\n"
                "The timeline shows separate thumb bends, a compact fist, a palm tuck and fingertip opposition.\n"
                "Select Hand rig.R or Hand rig.L in the Outliner and enter Pose Mode to edit individual joints.\n"
                "Rotate Thumb.Base for opposition. It raises the metacarpal as you swing the thumb in toward the palm.\n"
                "Local X bends the independent Thumb.MCP and Thumb.IP hinges. Thumb.Web distributes the skin fold.\n"
                "The studio and removable preview cuffs are organized in their own collections.\n")


def render_motion(scene, filename):
    output = filename.resolve()
    output.parent.mkdir(parents=True,exist_ok=True)
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = 7
    scene.render.resolution_x = 896
    scene.render.resolution_y = 672
    scene.render.resolution_percentage = 100
    settings = scene.render.image_settings
    settings.media_type = "VIDEO"
    settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.filepath = str(output)
    bpy.ops.render.render(animation=True)
    if not output.is_file() or output.stat().st_size<10000:
        raise RuntimeError("The hand study video was not written")
    print(f"Saved hand motion to {output}",flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,default=ROOT/"first-person-hands.blend")
    parser.add_argument("--preview",type=Path)
    parser.add_argument("--preview-scale",type=int,default=100)
    parser.add_argument("--samples",type=int,default=48)
    parser.add_argument("--pose",choices=("open","thumb","closed","tuck","pinch","grip"),action="append")
    parser.add_argument("--motion",type=Path,help="Render the animated study as an MP4")
    parser.add_argument("--from-saved",action="store_true",help="Render the saved study at --output")
    opts = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    if opts.from_saved:
        if not opts.motion:
            parser.error("--from-saved requires --motion")
        bpy.ops.wm.open_mainfile(filepath=str(opts.output.resolve()))
        render_motion(bpy.context.scene,opts.motion)
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "First-person hand study"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "CENTIMETERS"
    scene.frame_end = POSES[-1][0]
    scene.render.fps = 24
    right_collection = building_collection(scene,"Right hand")
    left_collection = building_collection(scene,"Left hand")
    costume = building_collection(scene,"Preview cuffs")
    stage = building_collection(scene,"Review lighting and camera")
    skin, polish = skin_material(),nail_material()
    right, left = make_rig(right_collection,1),make_rig(left_collection,-1)
    right_skin = sculpt(right_collection)
    right_skin.data.materials.append(skin)
    skin_attributes(right_skin)
    skin_weights(right_skin,right)
    parts = [right_skin,*nails(right_skin,right,polish,right_collection)]
    left_skin = mirrored(right_skin,left,left_collection)
    for obj in parts[1:]:
        mirrored(obj,left,left_collection)
    flex_creases(right_skin,right,1)
    flex_creases(left_skin,left,-1)
    fabric = material("Indigo woven cuffs",(.034,.055,.073),.83)[0]
    sleeve(right,1,costume,fabric)
    sleeve(left,-1,costume,fabric)
    right.location = (.089,-.006,.050)
    right.rotation_euler.z = math.radians(-10)
    left.location = (-.138,.001,.054)
    left.rotation_euler = (0,math.pi,math.radians(9))
    animate(scene,right,1,True)
    animate(scene,left,-1)
    studio(scene,stage)
    validate(right_skin,right,left,scene)
    configure_workspace(scene,right_skin)
    bpy.context.preferences.filepaths.save_version = 0
    opts.output.resolve().parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(opts.output.resolve()),compress=True)
    if opts.preview:
        folder = opts.preview.resolve()
        folder.mkdir(parents=True,exist_ok=True)
        scene.cycles.samples = opts.samples
        scene.render.resolution_percentage = opts.preview_scale
        for frame,name in ((28,"hands-open"),(49,"hands-thumb"),(80,"hands-closed"),(95,"hands-tuck"),
                           (112,"hands-pinch"),(148,"hands-grip")):
            if opts.pose and name.removeprefix("hands-") not in opts.pose:
                continue
            scene.frame_set(frame)
            scene.render.filepath = str(folder/(name+".png"))
            bpy.ops.render.render(write_still=True)
    if opts.motion:
        render_motion(scene,opts.motion)


if __name__=="__main__":
    main()
