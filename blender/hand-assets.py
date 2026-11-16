"""Continuous skin and a deformation rig for the first-person support hand."""

from math import exp


def build_hands():
    name = asset("support_hand", "First person")
    group = ASSETS[name]
    thumb_root = (-.118, -.022, .043)
    digits = []
    skin = []

    def translated(root, offset):
        return tuple(a + b for a, b in zip(root, offset))

    def smooth_step(start, end, value):
        t = max(0, min(1, (value-start)/(end-start)))
        return t*t*(3-2*t)

    def surface_uv(p):
        return (.5 + p[2]*7, .47 + p[0]*2.8 + p[1]*1.8)

    # Build intersecting anatomical volumes, then fuse the webbing and palm into one surface.
    palm = [
        ((-.177,-.111,.123), .027,.023), ((-.148,-.075,.103), .030,.023),
        ((-.120,-.035,.076), .036,.024), ((-.102,.002,.052), .045,.024),
        ((-.094,.032,.039), .044,.021), ((-.088,.051,.038), .040,.016),
        ((-.080,.058,.038), .035,.010), ((-.076,.061,.038), .021,.006),
    ]
    pads = (
        ("Thenar eminence", [
            ((-.143,-.061,.086),.015,.012), ((-.126,-.039,.063),.020,.012),
            ((-.114,-.017,.041),.019,.014), ((-.101,.004,.029),.018,.012),
            ((-.090,.016,.027),.014,.010), ((-.083,.022,.023),.007,.0055),
        ]),
        ("Hypothenar eminence", [
            ((-.134,-.049,.093),.016,.011), ((-.118,-.017,.073),.016,.012),
            ((-.104,.014,.062),.017,.013), ((-.096,.034,.058),.014,.012),
            ((-.092,.048,.059),.009,.008),
        ]),
    )
    for label, profile in (("Palm and wrist", palm), *pads):
        skin.append(tube(name, "skin", label, profile, skin_color, sides=32, density=4))

    for i, (label, length, radius) in enumerate(zip(
        ("Index", "Middle", "Ring", "Little"), (.085,.096,.090,.072), (.0096,.0103,.0096,.0085)
    )):
        z = (i-1.5)*.0185
        root = (-.084,.055,.037+z)
        finger = [
            ((-.009,-.006,0),1.03,.95), ((.003,.003,0),.94,1),
            ((length*.17,.015,z*.02),.91,.96), ((length*.29,.021,z*.05),.94,.84),
            ((length*.395,.0221,z*.09),.99,.91), ((length*.47,.0225,z*.11),.92,.80),
            ((length*.57,.021,z*.13),.82,.75), ((length*.722,.0175,z*.16),.89,.82),
            ((length*.79,.015,z*.17),.77,.71), ((length*.885,.0106,z*.18),.74,.70),
            ((length*.957,.0079,z*.18),.54,.55), ((length,.006,z*.18),.16,.17),
        ]
        pivots = [translated(root, finger[j][0]) for j in (4,7,11)]
        digits.append((label, root, pivots, radius))
        skin.append(tube(name, "skin", label + " and fingertip pad", [
            (translated(root,p), radius*w, radius*d) for p,w,d in finger
        ], skin_color, sides=28, density=4))
        nail(name, translated(root, (length*.877,.0168,z*.18)), (.93,-.38,0),
             (.10,1,.06), length*.159, radius*1.17, "gloss")

    thumb = [
        ((-.015,-.006,.016),.013,.015), ((-.005,.003,.005),.015,.014),
        ((.008,-.009,-.003),.014,.012), ((.019,-.021,-.011),.012,.0115),
        ((.032,-.027,-.031),.011,.0105), ((.042,-.026,-.042),.0097,.009),
        ((.050,-.023,-.049),.006,.006), ((.054,-.022,-.052),.002,.002),
    ]
    digits.append(("Thumb", thumb_root, [translated(thumb_root, thumb[j][0]) for j in (3,4,7)], .013))
    skin.append(tube(name, "skin", "Thumb and fingertip pad",
                     [(translated(thumb_root,p), w, d) for p,w,d in thumb], skin_color, sides=32, density=4))
    nail(name, translated(thumb_root,(.045,-.019,-.045)), (.69,.17,-.71),
         (0,1,.13), .0125,.0121, "gloss")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in skin:
        obj.select_set(True)
    body = skin[0]
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    body.name = "Continuous skin and digit webbing"
    body.data.remesh_voxel_size = .00125
    bpy.ops.object.voxel_remesh()
    relax = body.modifiers.new("Smooth digit webs", "SMOOTH")
    relax.factor, relax.iterations = .61,7
    apply(body, relax)
    reduce = body.modifiers.new("First-person triangle budget", "DECIMATE")
    reduce.ratio = .154
    apply(body, reduce)
    for face in body.data.polygons:
        face.use_smooth = True

    # The bind landmarks match the runtime's grip anchors and legacy index-tip contact.
    segments = []
    for label, root, pivots, radius in digits:
        distance = 0
        chain = []
        for start, end in zip((root,*pivots),pivots):
            a = Vector(start)
            length = (Vector(end)-a).length
            chain.append((a, (Vector(end)-a)/length, length, distance))
            distance += length
        segments.append((chain, radius))

    def digit_tracks(p):
        pos = Vector(p)
        for i,(chain,radius) in enumerate(segments):
            best = (float("inf"),i,0)
            for start,axis,length,accumulated in chain:
                delta = pos-start
                distance = delta.dot(axis)
                bounded = max(0,min(length,distance))
                offset = (delta-axis*bounded).length_squared/(radius*radius)
                if offset < best[0]:
                    best = (offset,i,accumulated + (distance if accumulated == 0 and distance < 0 else bounded))
            yield best

    def weights(p):
        closest, neighbour, *_ = sorted(digit_tracks(p))
        other_weight=1-smooth_step(.07,.64,neighbour[0]-closest[0])
        groups=[]
        for (score,i,at),proximity in ((closest,1),(neighbour,other_weight)):
            chain,radius=segments[i]
            if i!=closest[1] and closest[2]>segments[closest[1]][1]*1.4:
                continue
            rise=smooth_step(-radius*.45,radius*1.25,at)*proximity
            rise*=1-smooth_step(1.65,3.25,score)
            overlap=radius*.78
            middle=smooth_step(chain[1][3]-overlap,chain[1][3]+overlap,at)
            tip=smooth_step(chain[2][3]-overlap,chain[2][3]+overlap,at)
            groups.append((1+3*i,rise,(1-middle,middle-tip,tip)))
        strength=max(row[1] for row in groups)
        if strength<.00001:
            return ((0,1),)
        total=sum(row[1] for row in groups)
        values=[(0,1-strength)]
        for start,rise,blend in groups:
            values.extend((start+j,value*rise*strength/total) for j,value in enumerate(blend))
        strongest=[entry for entry in sorted(values,key=lambda value:value[1],reverse=True)[:4]
                   if entry[1]>.00001]
        scale=sum(value for _,value in strongest)
        return tuple((joint,value/scale) for joint,value in strongest)

    def skin_variation(p):
        x,y,z = p
        noise = sin(x*818+y*476)*sin(z*683-y*253) + sin(x*346-z*523)*.43
        hues = sin(x*53-z*34)*.019 + sin(y*101+z*71)*.014
        warm = smooth_step(.011,.068,y)*.027
        return (SKIN[0]*.96+warm+hues+.0045*noise,
                SKIN[1]*.945+hues*.58+.004*noise,
                SKIN[2]*.935-warm*.63+hues*.17+.004*noise)

    def skin_tone(p):
        x,y,_ = p
        _, i, at = min(digit_tracks(p))
        chain, radius = segments[i]
        folds = sum(exp(-((at-s[3])/(radius*.20))**2) for s in chain[1:])
        crease = folds*.021*smooth_step(.012,.050,y)*smooth_step(-.12,.015,x)
        return tuple(c-crease*scale for c,scale in zip(skin_variation(p),(1,1,.66)))

    skin_material = material("skin",SKIN).copy()
    skin_material.name = "Hand skin · tint, pores and subsurface"
    skin_material.use_nodes = True
    tree = skin_material.node_tree
    shader = tree.nodes.get("Principled BSDF")
    shader.inputs["Subsurface Weight"].default_value = .09
    shader.inputs["Subsurface Scale"].default_value = .004
    shader.inputs["Roughness"].default_value = .49
    skin_input = tree.nodes.new("ShaderNodeVertexColor")
    skin_input.layer_name = "Skin Tint"
    tree.links.new(skin_input.outputs["Color"],shader.inputs["Base Color"])
    pores = tree.nodes.new("ShaderNodeTexNoise")
    pores.inputs["Scale"].default_value = 150
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .11
    bump.inputs["Distance"].default_value = .00018
    tree.links.new(pores.outputs["Fac"],bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"],shader.inputs["Normal"])

    def apply_skin_material(obj, shade):
        tint = obj.data.color_attributes.new(name="Skin Tint",type="FLOAT_COLOR",domain="POINT")
        for vertex in obj.data.vertices:
            tint.data[vertex.index].color = (*shade(game_point(vertex.co)),1)
        obj.data.materials.clear()
        obj.data.materials.append(skin_material)

    apply_skin_material(body,skin_tone)
    records = [(body,"skin",skin_tone,surface_uv)]
    records.extend(r for r in group["records"] if r[1] == "gloss")
    group["records"] = records
    group["skin"] = {"count":16, "weights":weights}
    right = ASSETS["right_grip"]
    for i,(obj,slot,paint,uv) in enumerate(right["records"]):
        if slot == "skin":
            apply_skin_material(obj,skin_variation)
            right["records"][i] = (obj,slot,skin_variation,uv)

    armature = bpy.data.armatures.new("First-person hand bones")
    rig = bpy.data.objects.new("Support hand rig", armature)
    group["collection"].objects.link(rig)
    rig.show_in_front = True
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    wrist = armature.edit_bones.new("Wrist")
    wrist.head = blender_point((-.173,-.103,.124))
    wrist.tail = blender_point((-.084,.054,.037))
    names = [wrist.name]
    for label,root,pivots,radius in digits:
        parent = wrist
        for i,(start,end) in enumerate(zip((root,*pivots),pivots)):
            bone = armature.edit_bones.new(f"{label}.{i+1:02}")
            bone.head, bone.tail = blender_point(start), blender_point(end)
            bone.align_roll(blender_point((0,0,1)))
            bone.parent = parent
            bone.use_connect = i > 0
            parent = bone
            names.append(bone.name)
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj,*_ in records:
        vertex_groups = [obj.vertex_groups.new(name=bone) for bone in names]
        for vertex in obj.data.vertices:
            for index, weight in weights(game_point(vertex.co)):
                if weight > 0:
                    vertex_groups[index].add([vertex.index],weight,"REPLACE")
        bind = obj.modifiers.new("Hand deformation", "ARMATURE")
        bind.object = rig
        bind.use_deform_preserve_volume = True

    for label, *_ in digits:
        for i, flex in enumerate((.30,.62,.49)):
            finger = rig.pose.bones[f"{label}.{i+1:02}"]
            finger.rotation_mode = "XYZ"
            for frame, angle in ((1,0),(20,flex*(.62 if label == "Thumb" else 1)),(37,0)):
                finger.rotation_euler.z = -angle
                finger.keyframe_insert(data_path="rotation_euler", frame=frame, group=label)
    if rig.animation_data and rig.animation_data.action:
        rig.animation_data.action.name = "Reach, close, release"
    bpy.context.scene.frame_set(1)
