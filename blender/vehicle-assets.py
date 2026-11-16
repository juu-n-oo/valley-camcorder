"""Assemble the editable Sonata, with the same part origins as the game."""

SEDAN_TINT = "Sonata finish"


def _linear(value):
    return value/12.92 if value<=.04045 else ((value+.055)/1.055)**2.4


def _finish(slot,paint=None):
    title="Sonata | "+(paint or slot)
    if title in bpy.data.materials:
        return bpy.data.materials[title]
    mat=bpy.data.materials.new(title)
    mat.use_nodes=True
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    principled=nodes.get("Principled BSDF")
    output=nodes.get("Material Output")
    attribute=nodes.new("ShaderNodeVertexColor")
    attribute.layer_name=SEDAN_TINT
    links.new(attribute.outputs["Color"],principled.inputs["Base Color"])
    rough,metallic={
        "carPaint":(.19,.31),"carGlass":(.09,0),"carLens":(.17,.12),"carMetal":(.29,.81),
        "carWood":(.23,0),"carLeather":(.47,0),"carTire":(.73,0),"fabric":(.91,0),
        "gloss":(.38,.08),"plain":(.64,0)
    }.get(slot,(.53,0))
    principled.inputs["Roughness"].default_value=rough
    principled.inputs["Metallic"].default_value=metallic
    if slot in ("carPaint","carWood","carLens","carGlass"):
        principled.inputs["Coat Weight"].default_value=.73 if slot=="carPaint" else .42
        principled.inputs["Coat Roughness"].default_value=.13 if slot=="carPaint" else .18
    if slot=="carPaint":
        variant=SEDAN_PAINTS[paint or "Obsidian black"]
        mat.diffuse_color=(*map(_linear,variant),1)
        tint=nodes.new("ShaderNodeMixRGB")
        tint.blend_type="MULTIPLY"
        tint.inputs[0].default_value=1
        tint.inputs[2].default_value=mat.diffuse_color
        links.new(attribute.outputs["Color"],tint.inputs[1])
        links.new(tint.outputs[0],principled.inputs["Base Color"])
    if slot=="carGlass":
        transparent=nodes.new("ShaderNodeBsdfTransparent")
        transparent.inputs["Color"].default_value=(.83,.94,.94,1)
        mix=nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value=.26
        links.new(transparent.outputs[0],mix.inputs[1])
        links.new(principled.outputs[0],mix.inputs[2])
        links.new(mix.outputs[0],output.inputs["Surface"])
        mat.surface_render_method='DITHERED'
        mat.diffuse_color=(.20,.31,.33,.38)
    if slot in ("carPaint","carWood","carLeather","carTire","fabric","carLens"):
        coord=nodes.new("ShaderNodeTexCoord")
        noise=nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value={"carPaint":910,"carWood":42,"carLeather":615,
            "carTire":540,"fabric":370,"carLens":370}.get(slot,120)
        noise.inputs["Detail"].default_value=2
        links.new(coord.outputs["Object"],noise.inputs["Vector"])
        if slot=="carWood":
            roots=nodes.new("ShaderNodeTexNoise")
            roots.inputs["Scale"].default_value=14
            roots.inputs["Detail"].default_value=3.7
            roots.inputs["Roughness"].default_value=.74
            roots.inputs["Distortion"].default_value=2.7
            links.new(coord.outputs["Object"],roots.inputs["Vector"])
            burl=nodes.new("ShaderNodeTexNoise")
            burl.inputs["Scale"].default_value=10
            burl.inputs["Detail"].default_value=4
            burl.inputs["Roughness"].default_value=.68
            burl.inputs["Distortion"].default_value=1.9
            links.new(roots.outputs["Color"],burl.inputs["Vector"])
            grain=nodes.new("ShaderNodeValToRGB")
            grain.color_ramp.elements[0].position=.21
            grain.color_ramp.elements[0].color=(.28,.19,.14,1)
            grain.color_ramp.elements[1].position=.77
            grain.color_ramp.elements[1].color=(1,.83,.65,1)
            links.new(burl.outputs["Fac"],grain.inputs["Fac"])
            tint=nodes.new("ShaderNodeMixRGB")
            tint.blend_type="MULTIPLY"
            tint.inputs[0].default_value=.89
            links.new(grain.outputs["Color"],tint.inputs[1])
            links.new(attribute.outputs["Color"],tint.inputs[2])
            links.new(tint.outputs[0],principled.inputs["Base Color"])
        bump=nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value={"carPaint":.08,"carWood":.11,"carLens":.10}.get(slot,.22)
        bump.inputs["Distance"].default_value=.0012 if slot in ("fabric","carLeather","carTire") else .00035
        links.new(noise.outputs["Fac"],bump.inputs["Height"])
        links.new(bump.outputs["Normal"],principled.inputs["Normal"])
    return mat


def _original_plates():
    """Include the existing green registration in the editable Blender preview."""
    name=_sedan_asset("registration_preview")
    ASSETS[name]["source_only"]=True
    ink=rgb(0xf0edd6)
    font_path=Path("C:/Windows/Fonts/malgun.ttf")
    font=bpy.data.fonts.load(str(font_path),check_existing=True) if font_path.exists() else None
    for f,y,z in ((1,.432,2.373),(-1,.467,-2.391)):
        _pill(name,"gloss","Existing green registration plate",(0,y,z),.342,.171,.005,rgb(0x467651),"z",.29)
        _cord(name,"gloss","Original ivory registration border",
              [(x,y+h,z+f*.003) for x,h in _elliptic(.320,.151,.25,34)],
              .0012,rgb(0xc4c3a5),closed=True,sides=4)
        if font:
            _letter(name,"gloss","대전00",(0,y+.023,z+f*.0034),.040,ink,right=(f,0,0),font=font)
            _letter(name,"gloss","가 0000",(0,y-.051,z+f*.0034),.074,ink,right=(f,0,0),font=font)


def _finalize_parts():
    for model in ASSETS.values():
        if "sedan" not in model:
            continue
        at=model["sedan"]["at"]
        for i,(obj,slot,paint,uv) in enumerate(model["records"]):
            data=obj.data
            attribute=data.color_attributes.new(name=SEDAN_TINT,type='FLOAT_COLOR',domain='POINT')
            colors=[]
            for v in data.vertices:
                c=paint(game_point(v.co)) if callable(paint) else paint
                colors.extend((*map(_linear,c),1))
            attribute.data.foreach_set("color",colors)
            obj.data.materials[0]=_finish(slot)
            if not callable(paint):
                obj.color=(*map(_linear,paint),1)
            if any(at):
                data.transform(Matrix.Translation(blender_point(_scale(at,-1))))
                # Color and UV recipes are authored in the complete assembly's space.
                world_color=(lambda p,paint=paint,at=at:paint(_add(p,at))) if callable(paint) else paint
                world_uv=(lambda p,uv=uv,at=at:uv(_add(p,at))) if uv else None
                model["records"][i]=(obj,slot,world_color,world_uv)
            obj["part_origin"]=at


def _assemble():
    scene=bpy.context.scene
    library=bpy.data.collections.new("Sonata assembly")
    scene.collection.children.link(library)
    models={name:model for name,model in ASSETS.items() if "sedan" in model}
    loose={"sedan_tire","sedan_hub","sedan_door_lock","sedan_lighter","sedan_ashtray"}
    def empty(group,label,parent,at):
        node=bpy.data.objects.new(label,None)
        group.objects.link(node)
        node.parent=parent
        node.location=blender_point(at)
        node.empty_display_size=.078
        return node
    def parts(group,model,parent,finish):
        for source,slot,_,_ in model["records"]:
            obj=source.copy()
            group.objects.link(obj)
            obj.parent=parent
            if slot=="carPaint":
                obj.material_slots[0].link='OBJECT'
                obj.material_slots[0].material=_finish(slot,finish)
    for i,finish in enumerate(SEDAN_PAINTS):
        group=bpy.data.collections.new(f"EF Sonata | {finish}")
        library.children.link(group)
        root=empty(group,finish,None,(-4.10-i*2.97,0,0))
        anchors={}
        for name,model in models.items():
            if name in loose:
                continue
            pose=model["sedan"]
            parent=pose["parent"]
            offset=pose["at"]
            if parent:
                offset=_add(offset,_scale(models[parent]["sedan"]["at"],-1))
            anchor=empty(group,name.removeprefix("sedan_").replace("_"," ").title(),anchors.get(parent,root),offset)
            anchors[name]=anchor
            parts(group,model,anchor,finish)
        for side in (-1,1):
            for z in SEDAN_WHEELS:
                axle=empty(group,"Wheel",root,(side*.783,.321,z))
                if side<0:
                    axle.rotation_euler.z=pi
                for name in ("sedan_tire","sedan_hub"):
                    parts(group,models[name],axle,finish)
            for front in (False,True):
                lo,_=SEDAN_DOORS[front]
                door=anchors["sedan_door_"+_side_suffix(side,front)]
                at=(side*.844,_belt(lo+.293)+.020,lo+.293)
                lock=empty(group,"Door lock",door,_add(at,_scale(_door_pivot(side,front),-1)))
                parts(group,models["sedan_door_lock"],lock,finish)
        ash=empty(group,"Removable tray",anchors["sedan_ashtray_drawer"],(0,-.014,.058))
        parts(group,models["sedan_ashtray"],ash,finish)
        lighter=empty(group,"Removable lighter",root,(-.096,.579,.613))
        parts(group,models["sedan_lighter"],lighter,finish)
        if i==0:
            joints=[("sedan_hood",0,-1.02),("sedan_trunk_lid",0,1.07),
                    ("sedan_glove_box",0,-1.05),("sedan_console_lid",0,-1.16)]
            joints.extend(("sedan_door_"+_side_suffix(side,front),2,-side*1.25)
                          for side in (-1,1) for front in (False,True))
            for label,axis,angle in joints:
                node=anchors[label]
                node.keyframe_insert(data_path="rotation_euler",index=axis,frame=1)
                node.rotation_euler[axis]=angle
                node.keyframe_insert(data_path="rotation_euler",index=axis,frame=65)
            drawer=anchors["sedan_ashtray_drawer"]
            drawer.keyframe_insert(data_path="location",index=1,frame=1)
            drawer.location.y+=.173
            drawer.keyframe_insert(data_path="location",index=1,frame=65)
    scene.timeline_markers.new("Sonata closed",frame=1)
    scene.timeline_markers.new("Sonata doors, bonnet, boot and storage open",frame=65)
    scene.frame_set(1)
    return library


def build_vehicles():
    for file in ("vehicle-exterior.py","vehicle-cabin.py","vehicle-mechanical.py"):
        source=ROOT/"blender"/file
        exec(compile(source.read_text(encoding="utf-8"),str(source),"exec"),globals())
    _body_shell()
    _lids()
    _roof_and_glazing()
    _doors_and_mirrors()
    _lamps()
    _inside_mirror()
    _upholstery()
    _dashboard()
    _cabin_storage()
    _wheel_models()
    _engine_and_boot()
    _original_plates()
    _finalize_parts()
    _assemble()
