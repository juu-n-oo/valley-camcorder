"""Build the editable Blender asset library and publish its meshes for the game."""
from array import array
from base64 import b64encode
from math import cos, exp, pi, sin, sqrt, tau
from pathlib import Path
from random import Random
from sys import byteorder

import bmesh
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
ASSETS = {}
MATERIALS = {}
SKIN = (0.80, 0.61, 0.52)
NAIL = (0.85, 0.69, 0.64)


def rgb(hex_color):
    return tuple(((hex_color >> shift) & 255) / 255 for shift in (16, 8, 0))


def tone(color, factor):
    return tuple(channel * factor for channel in color)


def blend(a, b, t):
    return a + (b - a) * t


def smooth(a, b, value):
    t = min(1, max(0, (value - a) / (b - a)))
    return t * t * (3 - 2 * t)


def blender_point(p):
    x, y, z = p
    return (x, -z, y)


def game_point(p):
    x, y, z = p
    return (x, z, -y)


def material(slot, color):
    key = (slot, tuple(round(v, 3) for v in color))
    if key not in MATERIALS:
        mat = bpy.data.materials.new(f"{slot} {' '.join(f'{x:.2f}' for x in color)}")
        mat.diffuse_color = (*[min(1, x) for x in color], 1)
        mat.roughness = {"steel": .32, "gloss": .29, "porcelain": .26, "skin": .48, "body": .32}.get(slot, .68)
        mat.metallic = .72 if slot in ("steel", "carMetal") else 0
        MATERIALS[key] = mat
    return MATERIALS[key]


def asset(name, family, hidden=False):
    collection = bpy.data.collections.new(name.replace("_", " ").title())
    ASSETS[name] = {"collection": collection, "family": family, "records": [], "hidden": hidden}
    bpy.context.scene.collection.children.link(collection)
    return name


def mesh(name, slot, label, points, faces, color, *, soft=True, uv=None, consistent=True):
    group = ASSETS[name]
    data = bpy.data.meshes.new(label)
    data.from_pydata([blender_point(p) for p in points], [], faces)
    data.update()
    if consistent:
        editor = bmesh.new()
        editor.from_mesh(data)
        bmesh.ops.recalc_face_normals(editor, faces=list(editor.faces))
        editor.to_mesh(data)
        editor.free()
    obj = bpy.data.objects.new(label, data)
    group["collection"].objects.link(obj)
    for face in data.polygons:
        face.use_smooth = soft
    obj.data.materials.append(material(slot, color if not callable(color) else color(points[0])))
    group["records"].append((obj, slot, color, uv))
    obj["game_asset"] = name
    obj["material_slot"] = slot
    return obj


def apply(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def bevel(obj, width, segments=3):
    mod = obj.modifiers.new("Soft edges", "BEVEL")
    mod.width, mod.segments = width, segments
    mod.limit_method = 'ANGLE'
    apply(obj, mod)
    normals = obj.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True
    apply(obj, normals)


def box(name, slot, label, center, size, color, radius=0, yaw=0):
    x, y, z = center
    w, h, d = (n / 2 for n in size)
    points = [(x + u*cos(yaw) + v*sin(yaw), y+t, z-u*sin(yaw)+v*cos(yaw))
              for t in (-h, h) for u, v in ((-w, -d), (w, -d), (w, d), (-w, d))]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    obj = mesh(name, slot, label, points, faces, color, soft=bool(radius))
    if radius:
        bevel(obj, radius)
    return obj


def rows_mesh(name, slot, label, rows, color, *, caps=True, ring=True, uv=None, soft=True, consistent=True):
    width = len(rows[0])
    faces = []
    for i in range(len(rows) - 1):
        a, b = i*width, (i+1)*width
        for j in range(width if ring else width-1):
            k = (j + 1) % width
            faces.append((a+j, a+k, b+k, b+j))
    if caps:
        faces.extend([tuple(reversed(range(width))), tuple(range((len(rows)-1)*width, len(rows)*width))])
    return mesh(name, slot, label, [p for row in rows for p in row], faces, color,
                uv=uv, soft=soft, consistent=consistent)


def lathe(name, slot, label, sections, color, sides=48, center=(0, 0, 0), axis="y", caps=True):
    x, y, z = center
    rows = []
    for position, w, d in sections:
        angles = (tau*j/sides for j in range(sides))
        if axis == "y":
            rows.append([(x+w*cos(a), y+position, z+d*sin(a)) for a in angles])
        elif axis == "x":
            rows.append([(x+position, y+w*cos(a), z+d*sin(a)) for a in angles])
        else:
            rows.append([(x+w*cos(a), y+d*sin(a), z+position) for a in angles])
    return rows_mesh(name, slot, label, rows, color, caps=caps)


def catmull(points, samples=3):
    out = []
    for i in range(len(points)-1):
        a, b = points[max(0,i-1)], points[i]
        c, d = points[i+1], points[min(len(points)-1,i+2)]
        for j in range(samples):
            t = j/samples
            out.append(tuple(v+.5*t*((w-u)+t*(2*u-5*v+4*w-x+t*(3*v-u-3*w+x)))
                             for u,v,w,x in zip(a,b,c,d)))
    return [*out, points[-1]]


def tube(name, slot, label, specification, color, sides=24, density=3, uv=None):
    control = [(*p, w, d) for p, w, d in specification]
    curve = catmull(control, density)
    rows = []
    for i, (*xyz, width, depth) in enumerate(curve):
        p = Vector(xyz)
        along = Vector(curve[min(i+1,len(curve)-1)][:3])-Vector(curve[max(i-1,0)][:3])
        along.normalize()
        across = Vector((along.z, 0, -along.x))
        if across.length_squared < .0001:
            across = Vector((1,0,0))
        across.normalize()
        up = along.cross(across)
        rows.append([tuple(p + across*max(.0004,width)*cos(a) + up*max(.0004,depth)*sin(a))
                     for a in (tau*j/sides for j in range(sides))])
    return rows_mesh(name, slot, label, rows, color, uv=uv)


def rounded_rect(w, d, r, y, z=0):
    return [(x*(w/2-r)+r*cos(a), y, z+v*(d/2-r)+r*sin(a))
            for (x,v),start in zip(((1,1),(-1,1),(-1,-1),(1,-1)),(0,pi/2,pi,3*pi/2))
            for a in (start+pi*i/10 for i in range(6))]


def case(name, slot, label, profile, color):
    rows = [rounded_rect(w,d,r,y,z) for y,w,d,r,z in profile]
    return rows_mesh(name, slot, label, rows, color)


def rocks():
    for kind, seed, angularity, crease in [("ledge",252,.31,.17),("river",431,.04,.06),
                                           ("weathered",893,.17,.12),("cleft",127,.25,.14)]:
        rng = Random(seed)
        name = asset("granite_"+kind,"Valley rock")
        count = 14
        angles = [tau*i/count + rng.uniform(-.11,.11) for i in range(count)]
        shape = [(rng.uniform(.91,1.13), rng.uniform(-.12,.13), rng.uniform(-.10,.10)) for _ in angles]
        levels = [(-1,.63),(-.83,.86),(-.58,1),(-.30,.96),(-.20,.96-crease),
                  (-.09,1),(.20,.94),(.51,.89),(.63,.87-crease*.55),(.73,.87),(.91,.72),(1,.48)]
        if kind=="river":
            levels = [(-1,.61),(-.77,.84),(-.39,.99),(.0,1),(.36,.92),(.66,.78),(.91,.55),(1,.28)]
        rows = []
        for y, wide in levels:
            row = []
            for i, (a,(bias, lean, offset)) in enumerate(zip(angles, shape)):
                cut = 1 + angularity*(.55*sin(a*5+seed*.042) + .30*cos(a*8+.7*y))
                x = cos(a)*wide*bias*cut
                z = sin(a)*wide*bias*(1+offset+angularity*.35*sin(a*4+y))
                h = y + lean*(.3+.7*abs(y)) + .08*x - .039*z + .024*sin(i*3+y*5)
                row.append((x+.043*y,h,z))
            rows.append(row)
        rx = max(abs(p[0]) for row in rows for p in row)
        rz = max(abs(p[2]) for row in rows for p in row)
        top = max(p[1] for row in rows for p in row)
        rows = [[(x/rx, y/top, z/rz) for x,y,z in row] for row in rows]

        def paint(p):
            x, y, z = p
            seams = exp(-((y+.18+.08*x)/.064)**2) + .57*exp(-((y-.64+.1*z)/.064)**2)
            stripe = .05*sin(x*19+z*8) + .05*sin(x*37-z*13)
            mottling = .041*sin(x*7+y*18+z*10) + .038*cos(x*21+z*25)
            damp = smooth(.82,.12,y) * .07
            light = .96 + stripe + mottling - damp - .19*seams
            moss = smooth(.45,.91,sin(x*3+z*8)*sin(y*5-z*3))*smooth(-.18,.65,y)
            return (light-.10*moss, light-.048*moss, light-.16*moss)

        surface = rows_mesh(name,"rock","Fractured granite",rows,paint)
        proxy_name = asset(name+"_collision","Valley rock",hidden=True)
        proxy = surface.copy()
        proxy.data = surface.data.copy()
        proxy.name = "Granite collision"
        ASSETS[proxy_name]["collection"].objects.link(proxy)
        ASSETS[proxy_name]["records"].append((proxy,"rock",(1,1,1),None))
        reduced = proxy.modifiers.new("Collision simplification","DECIMATE")
        reduced.ratio = .31 if kind=="river" else .21
        apply(proxy,reduced)


def cliff_faces():
    outline=[(-1,-.62),(-.98,-.26),(-.94,.09),(-.99,.43),(-.85,.73),
             (-.62,.94),(.12,1),(.70,.88),(1,.43),(.99,-.36),(.62,-.90),(-.55,-1)]
    levels=[(-1,.88),(-.86,1),(-.58,1.012),(-.28,1),(-.18,.970),(-.15,.990),
            (.17,.987),(.39,.954),(.61,.932),(.76,.902),(.88,.857),(.970,.765),(1,.66)]
    for index in range(3):
        rng=Random(1811+index*513)
        name=asset(f"cliff_face_{index}","Unyeongdam cliff")
        facets=[(rng.uniform(-.055,.048),rng.uniform(-.09,.095),rng.uniform(-.040,.040)) for _ in outline]
        rows=[]
        for y,wide in levels:
            row=[]
            for i,((x,z),(dx,dz,dent)) in enumerate(zip(outline,facets)):
                cut=(.017*sin(y*9+i*1.7)+dent)*smooth(-.86,.6,y)
                off=.11*y+.018*sin(y*6+index)
                top_break=(.085*sin(i*1.74+index)-.029*cos(i*3.4)) if y>.85 else .018*sin(i*1.01+y)
                row.append(((x+dx)*wide+cut+off,y+top_break,(z+dz)*wide))
            rows.append(row)
        ymax=max(p[1] for row in rows for p in row)
        rows=[[(x,y/ymax,z) for x,y,z in row] for row in rows]
        def rock_tint(p):
            x,y,z=p
            dark=exp(-((z+.36+.034*y)/.105)**2)+.7*exp(-((z-.31+.09*y)/.124)**2)
            ledge=exp(-((y+.155+.041*z)/.043)**2)
            weather=.12*sin(13*x+31*z+2*y)+.04*cos(47*z+13*x)
            wet=.18*(1-smooth(-.96,-.55,y))
            shade=1.15+weather-.16*dark-.13*ledge-wet
            pink=.054*sin(27*z+2.1*y)*smooth(-.80,.8,y)
            moss=.12*smooth(.58,.93,sin(3*x+9*z)*cos(9*y+11*z))*smooth(.01,.90,y)
            return (shade+pink-.06*moss,shade*.979-.07*moss,shade*.942-pink*.26-.25*moss)
        stone=rows_mesh(name,"rock","Tall fractured granite face",rows,rock_tint)
        proxy_name=asset(name+"_collision","Unyeongdam cliff",hidden=True)
        proxy=stone.copy()
        proxy.data=stone.data.copy()
        proxy.name="Unyeongdam collision"
        ASSETS[proxy_name]["collection"].objects.link(proxy)
        ASSETS[proxy_name]["records"].append((proxy,"rock",(1,1,1),None))
        reduction=proxy.modifiers.new("Collision simplification","DECIMATE")
        reduction.ratio=.35
        apply(proxy,reduction)


def lodging_details():
    name=asset("clay_eave_tile","Lodge and temple roofs")
    # Curved clay roof tile closed around its hollow edge, with a rolled lip.
    rows=[]
    for z,taper in [(-.5,.93),(-.44,1),(-.31,1),(.18,.97),(.41,.93),(.5,.88)]:
        curve=[]
        for r,vertical,angles in [(.50,1,range(17)),(.42,.79,range(16,-1,-1))]:
            for i in angles:
                a=.12+(pi-.24)*i/16
                curve.append((cos(a)*r*taper,.54*sin(a)*vertical,z))
        rows.append(curve)
    rows_mesh(name,"tile","Fired clay eave tile",rows,
              lambda p:tone((.98,.97,.95),.86+.14*sin(p[2]*8+p[0]*7)+.10*p[1]))

    name=asset("room_crt","Lodge room")
    case(name,"paint","Molded television enclosure",[
        (.029,.494,.349,.058,-.026),(.049,.605,.415,.079,-.023),(.155,.662,.438,.070,-.021),
        (.370,.652,.415,.064,-.026),(.445,.613,.380,.065,-.030)],rgb(0x666b68))
    box(name,"plain","Recessed picture bezel",[0,.248,.197],[.553,.347,.056],rgb(0x414544),.041)
    rows=[]
    for j in range(17):
        y=2*j/16-1
        rows.append([(.244*(2*i/24-1)*(1-.068*y**8), .259+y*.143,.217+.032*(1-.54*y*y-.60*(2*i/24-1)**2))
                     for i in range(25)])
    rows_mesh(name,"gloss","Convex smoked tube glass",rows,
              lambda p:tone(rgb(0x435050),1+.15*p[1]),caps=False,ring=False)
    box(name,"paint","Under-screen control strip",[0,.074,.211],[.500,.039,.024],rgb(0x8e9287),.009)
    for i in range(5):
        box(name,"plain","Tiny channel keys",[.106+i*.026,.071,.226],[.018,.015,.008],rgb(0x4b4e48),.002)
    for i in range(12):
        box(name,"plain","Louver cut",[ -.194+i*.014,.074,.226],[.008,.012,.003],rgb(0x4d4b44),.0008)
    box(name,"emissive","Standby LED",[.072,.072,.225],[.008,.006,.005],rgb(0x9c593b),.0014)

    name=asset("guest_quilt","Lodge room")
    for part,cy,d,w,h,z,color in [
        ("Folded quilt",.249,1.38,1.295,.092,-.24,(1,1,1)),
        ("Cotton pillow",.290,.351,.982,.134,.654,rgb(0xe9decc))]:
        rows=[]
        is_quilt=part=="Folded quilt"
        for i in range(33):
            t=i/32
            v=t*2-1
            end=1-.135*abs(v)**11
            pz=z+d*.5*v
            ring=[]
            for j in range(30):
                a=tau*j/30
                u=cos(a)
                x=w*.5*u*end
                padding=.82+.18*sin(pi*t)**.45
                folded=sin(17*pi*t+2.6*u)*.004 + sin(14*u-8*t)*.0035
                if is_quilt:
                    seams=sum(exp(-((u-offset)/.033)**2) for offset in (-.61,-.20,.23,.62))
                    folded-=.0045*seams*max(0,sin(a))
                y=cy+sin(a)*h*.5*padding+folded
                ring.append((x,y,pz))
            rows.append(ring)
        slot="fabric" if is_quilt else "linen"
        rows_mesh(name,slot,part,rows,color,uv=lambda p:((.5+p[0])*1.6,(.5+p[2])*2.6))


def toy_exteriors():
    name=asset("green_toy_cover","Mini-car toy exteriors")
    green=rgb(0x6eaf40)
    case(name,"body","Green molded back shell",[
        (-.048,.131,.102,.009,.072),(-.040,.147,.111,.010,.072),(.059,.150,.113,.012,.072),
        (.077,.145,.109,.012,.072),(.088,.131,.098,.011,.072)],green)
    box(name,"body","Inset service lid",[0,.088,.071],[.103,.0045,.065],rgb(0x5a9632),.0018)
    for side in (-1,1):
        box(name,"body","Mold joining line",[side*.074,.013,.073],[.0014,.0015,.097],
            rgb(0x57922f),.0003)
    for i in range(4):
        box(name,"body","Low lid ribs",[-.033+i*.021,.091,.071],[.0021,.0023,.035],rgb(0x80b651),.0005)

    name=asset("violet_toy_cover","Mini-car toy exteriors")
    rows=[]
    for z,w,lo,hi,bevel_size in [(-1.392,.094,-.022,.081,.005),(-1.352,.096,-.022,.081,.006),
                (-1.22,.098,-.024,.081,.006),(-.78,.111,-.031,.080,.006),(-.632,.115,-.032,.080,.006)]:
        a=w/2
        rows.append([(-a+bevel_size,lo,z),(a-bevel_size,lo,z),(a,lo+bevel_size,z),(a,hi-bevel_size,z),
                     (a-bevel_size,hi,z),(-a+bevel_size,hi,z),(-a,hi-bevel_size,z),(-a,lo+bevel_size,z)])
    coat=rows_mesh(name,"body","Violet molded outer toy shell",rows,
                   lambda p:tone(rgb(0x746788),.90+.33*(p[1]+.022)+.026*sin(23*p[2]+99*p[0])),caps=False)
    for poly in coat.data.polygons:
        poly.use_smooth=False

    name=asset("charcoal_toy_cover","Mini-car toy exteriors")
    case(name,"body","Dark molded toy enclosure",[
        (-.006,.137,.403,.009,-.121),(.006,.151,.423,.008,-.121),
        (.088,.152,.423,.008,-.121),(.104,.139,.411,.010,-.121)],rgb(0x424651))
    box(name,"body","Beveled top cover",[0,.106,-.213],[.151,.026,.239],rgb(0x4c505a),.0045)
    for side in (-1,1):
        box(name,"body","Side seam",[side*.0765,.075,-.124],[.0014,.0020,.374],rgb(0x525760),.0004)


def bridge_pier():
    name = asset("bridge_baluster","Bridge")
    profile = [(-.50,.94,.90,.112,0),(-.47,1,1,.115,0),(-.38,.94,.92,.097,0),
               (-.33,.77,.77,.085,0),(-.28,.66,.65,.075,0),(.16,.62,.60,.077,0),
               (.29,.75,.73,.084,0),(.36,.96,.96,.100,0),(.46,1,1,.104,0),(.50,.90,.88,.100,0)]
    case(name,"plaster","Weathered cast concrete",profile,
         lambda p:tone(rgb(0xb8b3a1), .90+.05*sin(p[0]*11+p[2]*5)+.045*sin(p[1]*37+p[2]*12)+.045*p[1]))


def kitchen():
    name = asset("range_body","Lodge kitchen")
    enamel = rgb(0xd6caaa)
    def patina(p):
        x,y,z=p
        grime=smooth(.30,.97,sin(13*x+27*z)*sin(41*x-8*z))*smooth(.074,.036,y)
        return (enamel[0]-.18*grime,enamel[1]-.19*grime,enamel[2]-.21*grime)

    case(name,"paint","Rolled ivory enamel chassis",[
        (.038,.661,.516,.024,.009),(.042,.689,.543,.022,.012),(.053,.705,.555,.020,.012),
        (.137,.724,.575,.021,.012),(.158,.735,.588,.022,.012)],patina)
    case(name,"steel","Brushed and rolled top",[
        (.155,.735,.587,.024,.011),(.159,.749,.602,.024,.011),(.168,.758,.611,.027,.011),
        (.176,.752,.603,.025,.011),(.182,.735,.587,.024,.011)],rgb(0xbac2be))
    box(name,"plain","Recessed front escutcheon",[0,.097,.300],[.690,.108,.022],rgb(0x30312e),.012)
    for x in (-.31,.31):
        for z in (-.238,.238):
            box(name,"plain","Rubber foot",[x,.033,z],[.052,.025,.051],rgb(0x33322c),.008)

    name = asset("range_grate","Lodge kitchen")
    iron = rgb(0x343532)
    base = [( .181,.260,.268,.041,0),(.186,.281,.283,.042,0),
            (.199,.275,.280,.046,0),(.203,.261,.266,.041,0)]
    case(name,"plain","Enamel spill tray",base,rgb(0x454541))
    lathe(name,"steel","Burner well and silver rim",[(.201,.102,.102),(.208,.101,.101),(.215,.089,.089),(.221,.084,.084)],
          rgb(0x888979),sides=44)
    lathe(name,"plain","Cast iron burner cap",[(.215,.069,.069),(.221,.067,.067),(.226,.061,.061),(.228,.052,.052)],
          rgb(0x484542),sides=44)
    for i in range(4):
        a = pi/4 + i*pi/2
        x,z=cos(a),sin(a)
        box(name,"plain","Raised trivet foot",[x*.123,.225,z*.123],[.031,.051,.046],iron,.005,pi/2-a)
        box(name,"plain","Tapered trivet arm",[x*.095,.244,z*.095],[.030,.020,.086],rgb(0x3d3b35),.004,pi/2-a)
    lathe(name,"porcelain","Ceramic igniter",[(.198,.008,.008),(.218,.0063,.0063),(.227,.005,.005)],
          rgb(0xe5dcc3),sides=16,center=(.058,0,-.064))

    name=asset("range_knob","Lodge kitchen")
    lathe(name,"plain","Dark backing ring",[( -.010,.044,.044),(-.005,.045,.045),(.001,.041,.041)],
          rgb(0x272825),sides=40,axis="z")
    lathe(name,"paint","Ivory Bakelite dial",[( -.004,.038,.038),(.004,.039,.039),(.020,.037,.037),(.028,.033,.033)],
          rgb(0xe4ddc5),sides=40,axis="z")
    box(name,"paint","Molded grip",[0,0,.027],[.018,.059,.019],enamel,.006)
    box(name,"gloss","Worn index mark",[0,.020,.037],[.004,.012,.0015],rgb(0x817969),.0005)

    name=asset("kitchen_sink","Lodge kitchen")
    sections=[(-.092,.040,.039),(-.086,.220,.111),(-.074,.271,.146),(-.035,.331,.189),
              (.008,.367,.213),(.025,.381,.224),(.032,.376,.221),(.031,.361,.211),
              (.023,.342,.197),(.002,.316,.181),(-.043,.254,.143),(-.072,.189,.099),
              (-.077,.056,.040),(-.077,.002,.002)]
    lathe(name,"steel","Deep drawn kitchen bowl",sections,rgb(0xb6bdbc),sides=64)
    lathe(name,"plain","Dark drain cup",[(-.078,.024,.024),(-.075,.025,.025),(-.072,.023,.023)],
          rgb(0x424643),sides=24,center=(0,0,.014))
    lathe(name,"steel","Drain ring",[(-.075,.030,.030),(-.073,.030,.030),(-.072,.024,.024)],
          rgb(0xc9cec7),sides=32,center=(0,0,.014),caps=False)


def bathroom():
    name = asset("toilet","Lodge bathroom")
    warm=rgb(0xe4e2d5)
    lathe(name,"porcelain","Flared porcelain pedestal",
          [(.006,.156,.162),(.018,.163,.166),(.038,.156,.160),(.115,.121,.142),(.221,.122,.147),
           (.270,.149,.178),(.308,.156,.183)],warm,center=(0,0,.025))
    lathe(name,"porcelain","Egg-shaped vitreous bowl",
          [(.230,.107,.136),(.260,.169,.186),(.323,.190,.212),(.398,.209,.239),(.454,.217,.250),
           (.474,.215,.248),(.482,.205,.236),(.477,.174,.199),(.443,.166,.192),(.399,.152,.170),
           (.336,.112,.132),(.302,.072,.095),(.303,.006,.014)],warm,sides=64,center=(0,0,.046))
    lathe(name,"porcelain","Rounded separate seat ring",
          [(.471,.209,.240),(.485,.208,.237),(.500,.200,.230),(.505,.186,.212),(.499,.174,.200),
           (.482,.172,.197),(.471,.176,.204)],rgb(0xf3ebd9),sides=64,center=(0,0,.049),caps=False)
    case(name,"porcelain","Cistern",
         [(.456,.376,.143,.037,-.204),(.480,.419,.174,.043,-.206),(.618,.430,.180,.043,-.206),
          (.775,.423,.173,.036,-.207)],rgb(0xe9e7db))
    box(name,"porcelain","Cistern lid",[0,.794,-.207],[.439,.038,.192],rgb(0xf0ecde),.016)
    box(name,"porcelain","Raised lid",[0,.632,-.122],[.365,.347,.045],rgb(0xece5d7),.022)
    case(name,"gloss","Chrome handle",[(.686,.046,.032,.015,-.103),(.712,.055,.030,.014,-.103)],
         rgb(0xbec8c7))
    box(name,"gloss","Flush lever",[.159,.749,-.106],[.040,.020,.034],rgb(0xaeb7b8),.006)
    lathe(name,"plain","Water in bowl",[(.345,.093,.108),(.349,.089,.104)],rgb(0x829c9c),sides=40,center=(0,0,.065))

    name=asset("bathroom_basin","Lodge bathroom")
    lathe(name,"porcelain","Pedestal",
          [(.007,.096,.101),(.020,.105,.106),(.065,.089,.093),(.260,.072,.079),
           (.500,.082,.089),(.654,.093,.096),(.684,.114,.103)],warm,center=(0,0,-.066))
    lathe(name,"porcelain","Glazed basin",
          [(.647,.081,.092),(.677,.168,.132),(.711,.225,.173),(.762,.266,.209),(.814,.284,.222),
           (.833,.280,.218),(.839,.268,.207),(.835,.251,.190),(.818,.233,.179),
           (.783,.193,.146),(.725,.129,.083),(.710,.030,.026),(.709,.003,.003)],rgb(0xe6e5da),sides=64)
    lathe(name,"gloss","Drain",[(.708,.028,.028),(.713,.028,.028),(.714,.023,.023)],
          rgb(0xaab5b1),sides=28,center=(0,0,.013))
    tube(name,"gloss","Curved mixer spout",[
        ((0,.828,-.129),.033,.030),((0,.885,-.130),.022,.020),((0,.913,-.092),.020,.018),
        ((0,.908,-.028),.017,.016),((0,.882,-.019),.016,.015)],rgb(0xb9c7c5),sides=20)


def wheel():
    name=asset("sedan_tire","Parked sedan")
    profile=[(-.118,.240),(-.117,.271),(-.101,.294),(-.078,.308),(-.059,.318),(-.043,.319),
             (-.029,.316),(-.020,.319),(.006,.319),(.015,.316),(.026,.319),(.058,.319),
             (.074,.315),(.093,.304),(.111,.285),(.120,.264),(.120,.240),(.104,.226),(-.103,.226)]
    n=96
    rows=[]
    for row,(x,r) in enumerate(profile):
        points=[]
        for j in range(n):
            a=tau*j/n
            shoulder=max(0,1-abs(x)/.085)
            ribs=(.5+.5*cos(a*32+8*x+row*.16))**10
            rr=r-.0042*ribs*shoulder
            points.append((x,cos(a)*rr,sin(a)*rr))
        rows.append(points)
    rows.append(rows[0])
    rows_mesh(name,"carTire","Tread, shoulders and molded sidewalls",rows,
              lambda p:tone(rgb(0x2b2b2b), .91+.11*sin(p[1]*42+p[2]*21)+.10*smooth(.23,.31,sqrt(p[1]**2+p[2]**2))),
              caps=False)
    name=asset("sedan_hub","Parked sedan")
    alloy=rgb(0xaab5ba)
    lathe(name,"carMetal","Cast aluminum rim",[(.107,.162,.162),(.124,.193,.193),(.137,.199,.199),
          (.141,.194,.194),(.139,.183,.183),(.119,.176,.176)],alloy,sides=64,axis="x",caps=False)
    lathe(name,"plain","Brake backing plate",[(.067,.167,.167),(.079,.166,.166)],rgb(0x3d403d),sides=44,axis="x")
    lathe(name,"carMetal","Wheel hub",[(.091,.072,.072),(.126,.074,.074),(.147,.065,.065),(.151,.052,.052)],
          rgb(0xc2cac9),sides=36,axis="x")
    for i in range(5):
        center=tau*i/5
        spoke=[]
        for x,r,wide in [(.136,.048,.41),(.136,.068,.38),(.125,.113,.28),(.122,.156,.22),(.133,.187,.19)]:
            spoke.append([(x,r*cos(center+wide*k/3),r*sin(center+wide*k/3)) for k in range(-3,4)])
        face=rows_mesh(name,"carMetal","Sculpted alloy spoke",spoke,alloy,caps=False,ring=False)
        solid=face.modifiers.new("Cast spoke thickness","SOLIDIFY")
        solid.thickness=.026
        apply(face,solid)
        bevel(face,.004)
    for i in range(4):
        t=tau*i/4
        xy=(0,.047*cos(t),.047*sin(t))
        lathe(name,"plain","Recessed lug",[(.145,.010,.010),(.151,.010,.010)],rgb(0x4f5551),sides=12,axis="x",center=xy)
        lathe(name,"carMetal","Lug nut",[(.150,.0058,.0058),(.155,.0055,.0055)],rgb(0xc6c8be),sides=6,axis="x",center=xy)


def crate():
    width, depth, height, board = .92, .65, .60, .012
    name=asset("supply_carton","Range supply")
    kraft=rgb(0xc49b65)
    def fiber(p):
        x,y,z=p
        shipping_wear=smooth(.85,1,sin(33*x-17*z)*cos(12*y+40*z))*.16
        return tone(kraft,.86+.15*y/height+.045*sin(27*x+11*y)-shipping_wear)
    for side in (-1,1):
        box(name,"cardboard","Paperboard end wall",[0,height/2,side*(depth-board)/2],
            [width,height,board],fiber,.002)
        box(name,"cardboard","Paperboard long wall",[side*(width-board)/2,height/2,0],
            [board,height,depth-2*board],fiber,.002)
    box(name,"cardboard","Folded bottom",[0,board,0],[width-2*board,board,depth-2*board],rgb(0xae824d),.001)
    box(name,"cardboard","Glued seam",[-.427,.30,.326],[.018,.597,.002],rgb(0xb8925d),.0005)
    for i in range(22):
        tick=.064-.0057*i
        length=.021+.011*(i%4)
        box(name,"cardboard","Shipping mark",[.303+tick,.106,.3265],[.0018,length,.0011],rgb(0x826844))
    for kind,span,length,tape in [("outer",width-.008,depth/2-.004,True),("inner",depth-2*board-.008,.29,False)]:
        name=asset("carton_flap_"+kind,"Range supply")
        box(name,"cardboard","Scored folding flap",[0,0,length/2],[span,board,length],kraft,.0017)
        box(name,"cardboard","Hinge score",[0,.0057,.007],[span-.012,.0017,.006],rgb(0xac8356),.0004)
        if tape:
            box(name,"cardboard","Strip of yellowed tape",[0,board/2+.001,length-.015],[span-.006,.0018,.029],rgb(0xe6d2ad),.0005)
        for j in range(34):
            x=span*(j/33-.5)*.982
            box(name,"cardboard","Corrugation shadow",[x,-.0005,length-.0007],[span*.013,.004,.0018],rgb(0xa98157))


def duffel():
    name=asset("canvas_duffel","Valley supply")
    canvas, piping, strap = rgb(0x4b5b52),rgb(0x384840),rgb(0x2d3531)
    def shell(u,v,lift=0):
        a=tau*v
        taper=.37+.63*sin(pi*u)**.39
        crease=.027*sin(a*6+u*18)+.025*cos(a*10-u*12)+.019*sin(41*u+a*4)
        return (blend(-.51,.51,u),max(.009,.162+(.174*taper*(1+crease)+lift)*cos(a)),
                (.248*taper*(1+crease)+lift)*sin(a))
    rows=[[shell(i/38,j/44) for j in range(44)] for i in range(39)]
    rows_mesh(name,"fabric","Folded nylon shell",rows,
              lambda p:tone(canvas,.90+.12*sin(p[1]*6)+.044*sin(p[0]*22-p[2]*9)),
              uv=lambda p:((p[0]+.54)*2.6, .5+p[1]*4+p[2]*3))
    for u in (.085,.916):
        tube(name,"fabric","Rolled end seam",[(shell(u,i/37,.004),.005,.004) for i in range(38)],piping,sides=10,density=1)
    for u in (.283,.710):
        band=[[shell(u+(i/4-.5)*.049,j/36,.009) for j in range(36)] for i in range(5)]
        rows_mesh(name,"fabric","Dark carrying webbing",band,strap,caps=False,
                  uv=lambda p:((p[0]+.54)*9,p[1]*6+p[2]*5))
    for side in (-1,1):
        curve=[((blend(-.232,.232,j/16),.307+sin(pi*j/16)*.120,
                 side*(.13-.055*sin(pi*j/16))),.012,.005) for j in range(17)]
        tube(name,"fabric","Padded carrying loop",curve,strap,sides=12)
    zipper= lambda u,lift: shell(u,.028,lift)
    tube(name,"fabric","Zipper tape",[(zipper(i/35,.008),.012,.004) for i in range(1,35)],piping,sides=12,density=1)
    for j in range(45):
        p=zipper(blend(.067,.932,j/44),.014)
        box(name,"gloss","Aged brass zipper tooth",p,[.0098,.0028,.0115],rgb(0xc7b88c))
    p=zipper(.86,.020)
    box(name,"gloss","Zipper slider",p,[.040,.009,.021],rgb(0xa8aa97),.0035)
    box(name,"fabric","Cloth pull tab",[p[0]+.038,p[1],p[2]+.005],[.049,.008,.019],rgb(0xb49a69),.003)
    patch=[[shell(blend(.36,.59,i/7),blend(.16,.225,j/5),.012) for j in range(6)] for i in range(8)]
    rows_mesh(name,"fabric","Woven maker patch",patch,rgb(0xae945f),caps=False,ring=False)


def cars():
    designs=[
        (.039,.075,.036,.034,.003,0xe4ddc6,0xf0e9d6),(.038,.069,.038,.039,.001,0xebae38,0xf4bc49),
        (.040,.078,.031,.038,.003,0xb93d2c,0xc54934),(.039,.077,.034,.032,0,0xa8afad,0xc3c9c5),
        (.041,.078,.035,.032,.005,0x60b7c5,0xdeeadf),(.040,.076,.033,.034,.006,0xa93675,0xb34786)]
    rubber, chrome, glass = rgb(0x28302e),rgb(0xc9cfca),rgb(0x394f55)
    for i,(w,l,t,cab,shift,paint,roof) in enumerate(designs):
        name=asset(f"minicar_{i}","Die-cast cars")
        frame=rgb(paint)
        case(name,"body","Cast lower pan",[ (.003,w*.92,l*.90,.003,0),(.009,w*.96,l*.94,.003,0),
              (.011,w*.94,l*.96,.003,0)],rubber)
        case(name,"body","Die-cast shell and fenders",[
            (.008,w*.93,l*.96,.004,0),(.012,w*1.012,l*.998,.0048,0),
            (.019,w*.990,l*.992,.0044,0),(.024,w*.88,l*.94,.004,0)],frame)
        case(name,"body","Hood sculpt",[ (.020,w*.90,l*.31,.003,-l*.318),(.024,w*.84,l*.30,.0028,-l*.311),
              (.026,w*.73,l*.235,.0023,-l*.328)],tone(frame,1.036))
        top=.003 + t
        case(name,"body","Windows and cabin",[(.022,w*.86,cab*1.126,.002,shift),
             (.025,w*.84,cab*1.08,.003,shift), (top-.003,w*(.65 if i in (1,2) else .71),cab*(.68 if i!=4 else .87),.003,shift+.001)],glass)
        case(name,"body","Painted roof",[(top-.0036,w*.69,cab*.71,.003,shift+.001),
             (top-.001,w*.69,cab*.70,.003,shift+.001),(top,w*.59,cab*.64,.003,shift+.001)],rgb(roof))
        for side in (-1,1):
            x=side*w*.417
            box(name,"body","B-pillar",[x*.91,.028,shift+.004],[.0018,max(.003,top-.027),.0031],frame,.0006)
            box(name,"body","Recessed door pull",[x*1.17,.019,shift+.005],[.0012,.0015,.0049],chrome,.0004)
            for z in (-l*.302,l*.303):
                tire=(x,.0075,z)
                stops=[(0,.0067,.0067),(side*.0014,.0074,.0074),(side*.0046,.0074,.0074),(side*.0058,.0066,.0066)]
                lathe(name,"body","Rubber racing tire",stops,rubber,sides=20,center=tire,axis="x")
                lathe(name,"body","Bright wheel insert",[(side*.0057,.0047,.0047),(side*.0062,.0044,.0044),
                      (side*.00665,.0034,.0034)],chrome,sides=16,center=tire,axis="x")
            x=side*w*.335
            box(name,"body","Headlamp lens",[x,.017,-l*.495],[.008,.0039,.0024],rgb(0xeee5c8),.0011)
            box(name,"body","Red rear lens",[x,.014,l*.497],[.0075,.00345,.0019],rgb(0x982c23),.0008)
        box(name,"body","Dark radiator trim",[0,.016,-l*.500],[w*.413,.0042,.0021],rubber,.0009)
        box(name,"body","Front chrome lip",[0,.010,-l*.503],[w*.92,.0026,.0024],chrome,.0006)
        box(name,"body","Rear plate",[0,.012,l*.510],[w*.19,.0030,.0009],rgb(0xe0d8bd),.0004)


def skin_color(p):
    x, y, z = p
    reds=.045*sin(x*36-y*14+z*27)
    return (SKIN[0]+reds*.5, SKIN[1]+reds*.16, SKIN[2]-reds*.18)


def nail(name,center,along,outside,length,width,slot="skin"):
    normal=Vector(outside).normalized()
    axis=Vector(along).normalized()
    normal=(normal-axis*normal.dot(axis)).normalized()
    across=normal.cross(axis)
    rows=[]
    for i in range(10):
        u=i/9
        row=[]
        for j in range(13):
            v=j/6-1
            edge=.77+.23*sin(pi*u)**.48
            ridge=.0016*(1-v*v)+.00062*sin(pi*u)
            row.append(tuple(Vector(center)+axis*((u-.5)*length)+across*(width*.5*v*edge)+normal*ridge))
        rows.append(row)
    rows_mesh(name,slot,"Translucent curved nail",rows,NAIL,caps=False,ring=False)


def hands():
    name=asset("open_palm","First person")
    tube(name,"skin","Palm, knuckles and wrist",[
        ((-.171,-.102,.123),.031,.027),((-.146,-.071,.103),.033,.027),
        ((-.119,-.033,.072),.043,.034),((-.102,.010,.046),.047,.032),
        ((-.092,.035,.039),.042,.027),((-.085,.054,.033),.035,.022),
        ((-.077,.061,.030),.014,.010)],skin_color,sides=36,
        uv=lambda p:(.5+p[2]*6, .5+p[1]*3+p[0]*2.1))

    for i,length in enumerate([.085,.096,.090,.072]):
        radius=[.0103,.0115,.0107,.0086][i]
        z=(i-1.5)*.0185
        name=asset(f"finger_{i}","First person")
        tube(name,"skin","Three phalanges",[
            ((-.006,-.001,0),radius*.83,radius*.81),((.006,.005,0),radius*.91,radius*.89),
            ((length*.22,.018,z*.03),radius,radius*.96),((length*.384,.022,z*.08),radius*1.02,radius*.92),
            ((length*.47,.0225,z*.11),radius*.88,radius*.84),((length*.57,.021,z*.13),radius*.86,radius*.80),
            ((length*.69,.019,z*.15),radius*.90,radius*.86),((length*.766,.016,z*.17),radius*.77,radius*.76),
            ((length*.875,.0117,z*.18),radius*.76,radius*.69),((length*.957,.0079,z*.18),radius*.57,radius*.54),
            ((length,.006,z*.18),.0019,.0021)],skin_color,sides=28,uv=lambda p:(.5+p[2]*22,p[0]/length))
        nail(name,[length*.876,.0173,z*.18],[.93,-.38,0],[.10,1,.06],length*.161,radius*1.11)
        ASSETS[name]["bones"]=[(0,0,0),(length*.395,.0221,z*.09),(length*.722,.0175,z*.16),(length,.006,z*.18)]

    name=asset("thumb","First person")
    tube(name,"skin","Opposable thumb",[
        ((-.008,.008,.002),.006,.005),((.004,-.006,-.001),.014,.013),
        ((.014,-.018,-.004),.015,.013),((.032,-.027,-.018),.013,.0115),
        ((.047,-.025,-.028),.0096,.0085),((.053,-.022,-.032),.0025,.002)],skin_color,sides=28)
    nail(name,[.044,-.017,-.026],[.83,.14,-.52],[0,1,.13],.013,.0115)
    name=asset("right_grip","First person")
    palm=[
        ((.068,-.242,.129),.033,.028),((.060,-.222,.120),.034,.027),
        ((.049,-.191,.106),.038,.030),((.049,-.159,.099),.043,.033),
        ((.048,-.128,.090),.038,.030),((.040,-.104,.078),.027,.022),
        ((.030,-.092,.065),.014,.013)]
    skin_objects=[tube(name,"skin","Firing hand palm and wrist",palm,skin_color,sides=28)]
    for i in range(1,4):
        y=[-.103,-.130,-.156,-.181][i]
        z=[.002,.007,.013,.019][i]
        radius=[.0126,.0132,.0121,.0103][i]
        left=[-.054,-.057,-.054,-.050][i]
        points=[((.061,y+.008,.084+i*.004),.88,.95),((.045,y+.001,.048+i*.003),1,1),
                ((.024,y-.003,z+.015),.95,1),((-.005,y-.006,z-.004),.93,.95),
                ((-.034,y-.004,z+.004),.97,.91),((left+.006,y+.001,z+.024),.89,.85),
                ((left,y+.002,z+.037),.77,.82),((left+.003,y,z+.048),.70,.75),
                ((left+.010,y-.004,z+.057),.36,.45)]
        finger=tube(name,"skin","Curled grip finger",[(p,w*radius,d*radius) for p,w,d in points],skin_color)
        skin_objects.append(finger)
        nail(name,[left-radius*.63,y+.001,z+.047],[.30,-.18,.93],[-.96,.23,.08],radius*1.31,radius*.98,"gloss")
    skin_objects.append(tube(name,"skin","Thenar pad and closed thumb",[
        ((.072,-.157,.117),.023,.022),((.063,-.131,.127),.021,.019),
        ((.046,-.109,.129),.018,.017),((.028,-.093,.126),.016,.0145),
        ((.010,-.088,.122),.013,.0122),((-.005,-.088,.115),.013,.012),
        ((-.019,-.089,.109),.0113,.0104),((-.029,-.093,.104),.0084,.0085),
        ((-.036,-.096,.101),.0034,.0038)],skin_color))
    nail(name,[-.024,-.083,.116],[-.85,-.18,-.49],[-.13,.44,.89],.0178,.0135,"gloss")
    for obj in skin_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=skin_objects[0]
    bpy.ops.object.join()
    body=bpy.context.object
    body.data.remesh_voxel_size=.00155
    bpy.ops.object.voxel_remesh()
    relax=body.modifiers.new("Smooth skin transitions","SMOOTH")
    relax.factor,relax.iterations=.56,4
    apply(body,relax)
    reduce=body.modifiers.new("Viewmodel triangle budget","DECIMATE")
    reduce.ratio=.115
    apply(body,reduce)
    for face in body.data.polygons:
        face.use_smooth=True
    group=ASSETS[name]
    group["records"]=[(body,"skin",skin_color,lambda p:(.5+p[0]*6, .04-p[1]*3.4))]+[
        r for r in group["records"] if r[1]=="gloss"]

    name=asset("sleeve","First person")
    profile=catmull([(0,.132,.108),(.17,.122,.104),(.36,.103,.090),(.51,.095,.082),(.62,.099,.085),
         (.73,.088,.074),(.82,.073,.062),(.90,.057,.049),(.944,.046,.040),(.955,.047,.041),
         (.976,.048,.043),(1,.042,.036)],4)
    rows=[]
    for t,w,d in profile:
        ring=[]
        for a in (tau*j/60 for j in range(60)):
            crease=.040*cos(9*a+71*t)*sin(pi*t)**2
            pinch=.037*sin(3*a-91*t)*smooth(.64,.85,t)*(1-smooth(.9,.958,t))
            rib=.035*cos(a*30)*smooth(.945,.968,t)
            full=1+crease+pinch+rib
            ring.append((w*cos(a)*full,d*sin(a)*full,t))
        rows.append(ring)
    def textile(p):
        x,y,z=p
        base=rgb(0x3c5261 if z>=.953 else 0x516875)
        return tone(base,.97+.065*sin(z*27+x*29)+.047*cos(y*27-z*14))
    rows_mesh(name,"sleeve","Folded jacket and ribbed cuff",rows,textile,caps=False,
              uv=lambda p:((.5+p[0]*3)%1,p[2]))


def bone_weights(name,p):
    _,secondary,distal,_ = ASSETS[name]["bones"]
    x=p[0]
    fore=smooth(secondary[0]-.008,secondary[0]+.008,x)
    tip=smooth(distal[0]-.006,distal[0]+.008,x)
    return (1-fore, max(0,fore-tip), tip, 0)


def rig_finger(name):
    group=ASSETS[name]
    skeleton=bpy.data.armatures.new("Finger anatomy")
    rig=bpy.data.objects.new("Phalanx controls",skeleton)
    group["collection"].objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    chain=("proximal","middle","distal")
    previous=None
    for i,bone_name in enumerate(chain):
        bone=skeleton.edit_bones.new(bone_name)
        bone.head=blender_point(group["bones"][i])
        bone.tail=blender_point(group["bones"][i+1])
        if previous:
            bone.parent=previous
            bone.use_connect=True
        previous=bone
    bpy.ops.object.mode_set(mode='OBJECT')
    rig.select_set(False)
    for obj,*_ in group["records"]:
        vertices=[obj.vertex_groups.new(name=b) for b in chain]
        for v in obj.data.vertices:
            for group_index,weight in enumerate(bone_weights(name,game_point(v.co))[:3]):
                if weight:
                    vertices[group_index].add([v.index],weight,'REPLACE')
        mod=obj.modifiers.new("Articulated fingers","ARMATURE")
        mod.object=rig
    for i,bone_name in enumerate(chain):
        pose=rig.pose.bones[bone_name]
        pose.rotation_mode='XYZ'
        for frame,angle in [(1,0),(19,(0,.27,.44)[i]),(38,0)]:
            pose.rotation_euler.z=angle
            pose.keyframe_insert("rotation_euler",frame=frame)


def encode(typecode, values):
    data=array(typecode,values)
    if byteorder!="little":
        data.byteswap()
    return b64encode(data.tobytes()).decode("ascii")


def export_models():
    from json import dumps

    depsgraph=bpy.context.evaluated_depsgraph_get()
    definitions={}
    for name,group in ASSETS.items():
        merged={}
        skinned="bones" in group
        for obj,slot,paint,uv in group["records"]:
            target=merged.setdefault(slot,{"vertices":[],"triangles":[],"weights":[]})
            evaluated=obj.evaluated_get(depsgraph)
            data=evaluated.to_mesh()
            data.calc_loop_triangles()
            lookup={}
            for triangle in data.loop_triangles:
                for loop_id in triangle.loops:
                    loop=data.loops[loop_id]
                    p=game_point(data.vertices[loop.vertex_index].co)
                    norm=game_point(data.corner_normals[loop_id].vector)
                    values=(*p,*norm,*(uv(p) if uv else (p[0]*3+.5,p[2]*3+.5)),*(paint(p) if callable(paint) else paint))
                    values=tuple(round(x,6) for x in values)
                    if values not in lookup:
                        lookup[values]=len(target["vertices"])//11
                        target["vertices"].extend(values)
                        if skinned:
                            target["weights"].extend(bone_weights(name,p))
                    target["triangles"].append(lookup[values])
            evaluated.to_mesh_clear()
        exported=[]
        for slot,data in merged.items():
            obj={"slot":slot,"vertices":encode("f",data["vertices"]),"indices":encode("I",data["triangles"])}
            if skinned:
                obj["weights"]=encode("f",data["weights"])
            exported.append(obj)
        definition={"parts":exported}
        if skinned:
            definition["pivots"]=group["bones"][1:3]
        definitions[name]=definition
        print(f"{name}: {sum(len(data['triangles'])//3 for data in merged.values())} triangles")
    lines=[f"  {dumps(name)}: {dumps(value,separators=(',',':'))}" for name,value in definitions.items()]
    (ROOT/"blender-models.js").write_text(
        "// Generated by Blender from blender/build-assets.py. Edit the Blender source to rebuild.\n"
        '"use strict";\n\nglobalThis.ValleyBlenderModels = {\n'+",\n".join(lines)+"\n};\n",encoding="utf-8")


def arrange_source():
    scene=bpy.context.scene
    scene.name="Valley Camcorder Models"
    families={}
    for group in ASSETS.values():
        family=group["family"]
        if family not in families:
            families[family]=bpy.data.collections.new(family)
            scene.collection.children.link(families[family])
        collection=group["collection"]
        scene.collection.children.unlink(collection)
        families[family].children.link(collection)
        if group["hidden"]:
            collection.hide_viewport=True
            collection.hide_render=True
    for i,(name,group) in enumerate((pair for pair in ASSETS.items() if not pair[1]["hidden"])):
        origin=bpy.data.objects.new(group["collection"].name,None)
        group["collection"].objects.link(origin)
        origin.empty_display_size=.075
        for obj in list(group["collection"].objects):
            if obj!=origin:
                obj.parent=origin
        origin.location=(4.1*(i%7),-4.1*(i//7),0)
    scene.unit_settings.system="METRIC"
    scene.frame_set(1)
    prefs=bpy.context.preferences.filepaths
    prefs.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"blender"/"valley-assets.blend"),compress=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rocks()
    cliff_faces()
    bridge_pier()
    lodging_details()
    kitchen()
    bathroom()
    wheel()
    crate()
    duffel()
    cars()
    toy_exteriors()
    hands()
    export_models()
    for name,group in ASSETS.items():
        if "bones" in group:
            rig_finger(name)
    arrange_source()


if __name__=="__main__":
    main()
