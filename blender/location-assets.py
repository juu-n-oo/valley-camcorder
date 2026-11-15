"""Author the riverbank's materials, rock shelves, and tree trunks in Blender."""
import struct
import zlib

import numpy as np


def location_materials():
    size = 384
    rng = np.random.default_rng(20010818)
    y, x = np.mgrid[:size, :size].astype(np.float32)
    x /= size
    y /= size

    def field(nx, ny, dx=0, dy=0):
        lattice = rng.random((ny, nx), dtype=np.float32)
        u, v = (x + dx) * nx, (y + dy) * ny
        i, j = np.floor(u).astype(int), np.floor(v).astype(int)
        u, v = u - i, v - j
        u, v = u*u*(3-2*u), v*v*(3-2*v)
        a = blend(lattice[j % ny, i % nx], lattice[j % ny, (i+1) % nx], u)
        b = blend(lattice[(j+1) % ny, i % nx], lattice[(j+1) % ny, (i+1) % nx], u)
        return blend(a, b, v)

    def palette(low, high, t):
        return blend(np.array(low), np.array(high), np.clip(t, 0, 1)[..., None])

    def relief(depth, scale):
        return ((np.roll(depth, -1, axis=1) - depth) * .66
                + (np.roll(depth, -1, axis=0) - depth) * .74) * scale

    def bed(base, count, min_radius, max_radius, leaves):
        surface = base.copy()
        depth = field(48, 73) * .075
        for _ in range(count):
            cx, cy = rng.integers(0, size, 2)
            radius = rng.uniform(min_radius, max_radius)
            range_ = int(np.ceil(radius + 1))
            side = np.arange(-range_, range_ + 1)
            u, v = np.meshgrid(side, side)
            heading = rng.uniform(0, tau)
            a = (u*np.cos(heading) + v*np.sin(heading)) / radius
            b = (v*np.cos(heading) - u*np.sin(heading)) / (radius*rng.uniform(.20 if leaves else .55, .86))
            edge = np.clip((1-a*a-b*b) * radius * .78, 0, 1)
            if not np.any(edge):
                continue
            target = np.ix_((cy+side) % size, (cx+side) % size)
            shade = (.17*a-.10*b + .055*rng.standard_normal(a.shape)) * edge
            if leaves:
                vein = np.exp(-np.abs(b)*32) * .15 + np.exp(-np.abs(np.sin(a*18+b*5))*13) * .075
                color = palette((.22,.13,.067),(.50,.36,.182),rng.uniform(.0,.95))
                color = color*(.83+shade+vein)[..., None]
            else:
                color = palette((.27,.238,.183),(.68,.638,.536),rng.uniform(.05,1.0))
                color = color*(.97+shade)[..., None]
            surface[target] = blend(surface[target], color, edge[..., None])
            depth[target] = np.maximum(depth[target], edge*rng.uniform(.16,.50))
        return surface, depth

    sand_base = palette((.329,.268,.182),(.59,.502,.365),field(7,9)*.54+field(52,47)*.46)
    gravel, gravel_depth = bed(sand_base, 7600, 1.05, 7.0, False)
    gravel += relief(gravel_depth,.065)[...,None]

    drift = field(5,8)*.035
    rolling = field(8,11,drift,drift)
    grains = field(178,153)*.59 + field(48,91)*.41
    mineral = palette((.444,.425,.378),(.784,.749,.680),rolling*.60+grains*.40)
    band = 1-np.clip(np.abs(np.sin(tau*(y*5+x+drift*11)))*5,0,1)
    wet_joint = band*field(5,14)*.24
    crystals = (grains>.76)*.088-(grains<.28)*.094
    granite_depth = .42+rolling*.24+grains*.14-wet_joint
    granite = mineral*(1-wet_joint[...,None])+(crystals+relief(granite_depth,.22))[...,None]

    soil_base = palette((.144,.103,.069),(.313,.239,.157),field(12,15)*.62+field(79,85)*.38)
    litter, litter_depth = bed(soil_base, 1710, 2.5, 14.5, True)
    litter += relief(litter_depth,.060)[...,None]

    bend = (field(7,6)-.5)*.043
    fissures = field(61,6,bend,0)*.52+field(37,8,bend,-bend)*.48
    cracks = np.clip((.31-fissures)*7,0,1)
    grain = field(129,35,bend*.59,0)
    moss = np.clip((field(8,12)*.72+grain*.28-.55)*2.5,0,1)
    bark_depth = .31+fissures*.40+grain*.14-cracks*.24
    bark = palette((.218,.181,.133),(.415,.352,.267),fissures*.69+grain*.31)
    bark *= (1-cracks*.29)[...,None]
    bark += moss[...,None]*np.array([-.018,.027,-.017])+relief(bark_depth,.17)[...,None]

    wood_phase = x*36+field(9,5)*.73+field(17,11)*.29
    knot_shadow = np.zeros((size,size), np.float32)
    for cx,cy,radius in ((.21,.28,.095),(.73,.83,.060),(.49,.57,.056)):
        dx,dy=(x-cx+.5)%1-.5,(y-cy+.5)%1-.5
        distance=np.hypot(dx,dy*.36)
        knot_shadow += np.exp(-(distance/radius)**2*6)
        wood_phase += np.exp(-(distance/radius)**2*3)*np.sign(dx)*.84
    wood_lines = np.sin(tau*wood_phase)*.45+.55*field(114,25)
    wood_depth = .38+wood_lines*.18+field(63,14)*.15
    wood = palette((.51,.358,.214),(.85,.704,.502),.54+wood_lines*.44+field(12,7)*.24)
    wood *= (1-.25*knot_shadow)[...,None]
    wood += relief(wood_depth,.065)[...,None]

    trowel = field(15,7)*.47+field(29,15)*.20+field(141,132)*.33
    pores = np.clip((field(98,137)-.68)*3.8,0,1)
    plaster_depth = .49+.15*trowel-.19*pores
    plaster = palette((.66,.633,.582),(.88,.849,.778),trowel)
    plaster *= (1-.11*pores)[...,None]

    clay_wear=field(7,9)*.32+field(27,35)*.31+field(100,108)*.37
    firing=field(23,117)*.52+field(90,21)*.48
    clay_depth=.44+.34*clay_wear-.18*firing
    brick=palette((.39,.281,.219),(.78,.592,.451),clay_wear*.72+firing*.29)
    brick+=relief(clay_depth,.11)[...,None]

    clouds=field(12,13)*.47+field(27,23)*.34+field(60,71)*.19
    marble = np.exp(-np.abs(np.sin(tau*(x*2.0-y+clouds*.24)))*22)
    tile_depth = .49+clouds*.09
    ceramic=palette((.66,.651,.578),(.89,.884,.811),clouds)+marble[...,None]*.029

    ground = (gravel, granite, litter, bark)
    finishes = (wood, plaster, brick, ceramic)
    names = ("River gravel", "Fissured granite", "Forest litter", "Pine bark",
             "Lacquered timber", "Aged plaster", "Fired clay", "Glazed ceramic")
    colors = (*ground,*finishes)
    depths = (gravel_depth, granite_depth, litter_depth, bark_depth,
              wood_depth, plaster_depth, clay_depth, tile_depth)

    def atlas(tiles):
        sheet=np.concatenate([np.concatenate(tiles[:2],axis=1), np.concatenate(tiles[2:],axis=1)])
        return b64encode(location_png(sheet)).decode("ascii")

    (ROOT/"location-textures.js").write_text(
        '// Generated by Blender from blender/location-assets.py.\n'
        '"use strict";\n\n'
        'globalThis.ValleyTextures.location = "data:image/png;base64,' + atlas(ground) + '";\n'
        'globalThis.ValleyTextures.finishes = "data:image/png;base64,' + atlas(finishes) + '";\n',
        encoding="utf-8")

    authored = {}
    for name, color, depth in zip(names, colors, depths):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.diffuse_color = (*np.mean(color, axis=(0,1)), 1)
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        surface = nodes.get("Principled BSDF")
        surface.inputs["Roughness"].default_value = {"Lacquered timber":.42, "Glazed ceramic":.24}.get(name,.84)
        coordinates = nodes.new("ShaderNodeTexCoord")
        for label, data in ((name, color), (name+" relief", np.repeat(depth[...,None],3,axis=2))):
            tile = bpy.data.images.new(label, width=size, height=size)
            bytes_ = location_png(data)
            tile.pack(data=bytes_, data_len=len(bytes_))
            tile.source = 'FILE'
            texture = nodes.new("ShaderNodeTexImage")
            texture.image = tile
            links.new(coordinates.outputs["UV"], texture.inputs["Vector"])
            if label == name:
                links.new(texture.outputs["Color"], surface.inputs["Base Color"])
            else:
                tile.colorspace_settings.name = "Non-Color"
                bump = nodes.new("ShaderNodeBump")
                bump.inputs["Strength"].default_value = .32
                bump.inputs["Distance"].default_value = .018
                links.new(texture.outputs["Color"], bump.inputs["Height"])
                links.new(bump.outputs["Normal"], surface.inputs["Normal"])
        authored[name] = mat
    return authored


def location_png(color):
    data = np.clip(np.rint(color*255),0,255).astype(np.uint8)
    height, width = data.shape[:2]

    def chunk(kind, value):
        return (struct.pack(">I",len(value)) + kind + value
                + struct.pack(">I",zlib.crc32(kind+value)))

    pixels = data.reshape(height, width*3)
    delta = pixels.copy()
    delta[:,3:] -= pixels[:,:-3]
    scanlines = b"".join(b"\1"+row.tobytes() for row in delta)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR",struct.pack(">IIBBBBB",width,height,8,2,0,0,0))
            + chunk(b"IDAT",zlib.compress(scanlines, 9)) + chunk(b"IEND",b""))


def assign_location_material(obj, material, uv):
    obj.data.materials[0] = material
    layer = obj.data.uv_layers.new(name="Surface UV")
    for loop in obj.data.loops:
        p = game_point(obj.data.vertices[loop.vertex_index].co)
        layer.data[loop.index].uv = uv(p)


def finish_architecture():
    for name, group in ASSETS.items():
        if not name.startswith("lodge_"):
            continue
        for obj,slot,_,_ in group["records"]:
            if slot not in ("wood","plaster"):
                continue
            finish="Lacquered timber" if slot=="wood" else "Aged plaster"
            assign_location_material(obj,bpy.data.materials[finish],lambda p:(p[0]*1.7+p[2]*1.5,p[1]*1.5+p[2]*.5))


def build_location():
    materials = location_materials()
    for index, phase in enumerate((.74, 2.32, 5.9)):
        name = asset(f"river_shelf_{index}", "Hwayang riverbank")
        contour = [(-1,-.64),(-.77,-.97),(.30,-1),(.83,-.84),(1,-.30),
                   (.91,.44),(.66,.63),(.43,.91),(-.31,1),(-.79,.82),(-.97,.31)]
        rows = []
        for y, spread in [(-1,.71),(-.76,.93),(-.24,1),(.20,.97),(.34,.88),(.60,.92),(.91,.82),(1,.60)]:
            row = []
            for i, (x,z) in enumerate(contour):
                ripple = .07*sin(i*3.7+phase)+.044*cos(i*2.2+y)
                row.append((x*(spread+ripple)+y*.08, y+(x*.14-z*.09)+.071*sin(i*3.2+phase),
                            z*(spread-ripple*.47)-y*.05))
            rows.append(row)

        def tint(p):
            x,y,z=p
            t=.92-.19*exp(-((y-.22-.13*x)/.15)**2)+.045*cos(9*x+6*z)
            return (t,t+.011,t-.016)

        shelf = rows_mesh(name,"rock","Water-worn granite shelves",rows,tint)
        assign_location_material(shelf,materials["Fissured granite"],lambda p:(p[0]*.34+.5,p[2]*.38+.5))
        proxy = asset(name+"_collision","Hwayang riverbank",hidden=True)
        rows_mesh(proxy,"rock","Granite shelf collision",[rows[i] for i in (0,2,5,7)],(1,1,1))

    for index, phase in enumerate((.92, 3.63)):
        name = asset(f"river_pine_{index}", "Hwayang riverbank")
        rows = []
        for y, radius in [(0,1.14),(.04,1.07),(.13,.83),(.32,.77),(.52,.70),(.73,.47),(.91,.28),(1,.15)]:
            row = []
            for i in range(9):
                a = tau*i/9
                ridges = .13*sin(a*4+phase) + .10*cos(a*3+y*5+phase)
                root = .59*max(0,cos(a*4+phase))*(1-smooth(.0,.14,y))
                r = radius+ridges*radius+root
                row.append((r*cos(a)+.19*sin(y*7+phase)*y,y,r*sin(a)+.14*sin(y*8+phase)*y))
            rows.append(row)

        def bark_uv(p):
            from math import atan2
            x,y,z=p
            return atan2(z,x)/tau+.5,y

        trunk = rows_mesh(name,"bark","Pine trunk with root buttresses",rows,(.93,.96,.94),caps=False,uv=bark_uv)
        # Split the longitudinal seam so bark grain stays narrow on either side.
        ASSETS[name]["uv_seams"] = True
        assign_location_material(trunk,materials["Pine bark"],bark_uv)

    samples = (("River gravel","river_gravel_sample"),("Forest litter","forest_litter_sample"),
               ("Lacquered timber","timber_sample"),("Aged plaster","plaster_sample"),
               ("Fired clay","clay_sample"),("Glazed ceramic","ceramic_sample"))
    for label,key in samples:
        material_sample = asset(key,"Material swatches")
        uv = lambda p: (p[0]+.5,p[2]+.5)
        obj = mesh(material_sample,"preview",label,[(-.5,0,-.5),(.5,0,-.5),(.5,0,.5),(-.5,0,.5)],
                   [(0,3,2,1)],(1,1,1),uv=uv)
        assign_location_material(obj,materials[label],uv)
        ASSETS[material_sample]["source_only"] = True
