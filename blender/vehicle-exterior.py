"""Body, glazing, lamps and brightwork for the photographed EF Sonata."""

from functools import cache
from math import asin, atan2, copysign
from mathutils import Matrix
from mathutils.geometry import delaunay_2d_cdt


# Longitudinal stations matched against the low front and both rear reference views.
# The axle centers stay fixed so that the build measures body contours against the rims.
SEDAN_BODY = (
    (-2.131,.879,.867,.278),(-1.988,.904,.916,.245),(-1.72,.926,.963,.233),
    (-1.36,.929,.972,.226),(-.95,.925,.969,.217),(-.34,.925,.956,.214),
    (.20,.924,.943,.216),(.68,.928,.934,.221),(1.03,.935,.919,.228),
    (1.40,.931,.877,.231),(1.73,.911,.829,.241),(1.953,.869,.784,.266),
)
SEDAN_CABIN = (
    (-1.851,.949,.792),(-1.69,1.048,.782),(-1.45,1.220,.735),
    (-1.19,1.347,.680),(-1.062,1.382,.656),(-.67,1.415,.639),
    (-.35,1.423,.633),(-.10,1.417,.646),(.16,1.388,.675),(.276,1.361,.694),
    (.43,1.266,.730),(.57,1.152,.775),(.712,1.029,.812),(.819,.942,.838),
)
SEDAN_COWL = .819
SEDAN_REAR_GLASS = -1.851
SEDAN_ROOF = (-1.062,.276)
SEDAN_PAINT = (1.0,1.0,1.0)
SEDAN_CHROME = rgb(0xc9d0d2)
SEDAN_ALLOY = rgb(0xafb4b2)
SEDAN_BLACK = rgb(0x16191a)
SEDAN_RUBBER = rgb(0x252729)
SEDAN_TRIM = rgb(0x77786f)
SEDAN_LEATHER = rgb(0xc5b69a)
SEDAN_WALNUT = rgb(0x77422a)
SEDAN_CARPET = rgb(0x958b73)
SEDAN_PAINTS = {"Obsidian black":rgb(0x0a0b0d),"Pearl white":rgb(0xe9e8df),"Silver grey":rgb(0x8b9297)}
SEDAN_WHEELS = (-1.405,1.405)
SEDAN_DOORS = {True:(-.270,1.011),False:(-1.272,-.295)}
SEDAN_HOOD = (0,.962,.902)
SEDAN_TRUNK = (0,.969,-1.850)
SEDAN_PLATES = ((True,.477,2.233),(False,.438,-2.385))


def _profile(table, at, column):
    end = next((i for i, row in enumerate(table) if row[0] >= at), len(table))
    if end == 0 or end == len(table):
        return table[min(end, len(table)-1)][column]
    a, b = table[end-1:end+1]
    p, n = table[max(0,end-2)], table[min(end+1,len(table)-1)]
    span = b[0]-a[0]
    t = (at-a[0])/span
    m = (b[column]-p[column])*span/(b[0]-p[0])
    k = (n[column]-a[column])*span/(n[0]-a[0])
    return blend(a[column],b[column],t*t*(3-2*t)) + t*(1-t)*((1-t)*m-t*k)


def _width(z):
    return _profile(SEDAN_BODY,z,1)


def _belt(z):
    return _profile(SEDAN_BODY,z,2)


def _cabin(z):
    return _profile(SEDAN_CABIN,z,1), _profile(SEDAN_CABIN,z,2)


def _side(side,z,v):
    distance = min(abs(z-axle) for axle in SEDAN_WHEELS)
    arch = .309+.362*sqrt(max(0,1-(distance/.364)**2))
    bottom = max(_profile(SEDAN_BODY,z,3),arch*(1-smooth(.355,.380,distance)))
    y = blend(bottom,_belt(z),v)
    t = max(0,min(1,(y-.21)/max(.06,_belt(z)-.21)))
    shoulder = .010*exp(-((t-.82)/.10)**2)-.004*exp(-((t-.97)/.039)**2)
    crease = .0036*exp(-((t-.67)/.040)**2)
    flare = .004*(1-smooth(.33,.51,distance))*(1-v)**5
    top_edge=max(0,(t-.944)/.056)
    fillet=.016*(1-sqrt(max(0,1-top_edge*top_edge)))
    x = _width(z)+.012*sin(pi*t)-.079*(1-t)**2.8+shoulder+crease+flare-fillet
    return (side*x,y,z)


def _side_height(side,z,y):
    bottom = _side(side,z,0)[1]
    height = _belt(z)-bottom
    return _side(side,z,max(0,min(1,(y-bottom)/height)))


@cache
def _fascia_edge(front,v):
    return _side(1,SEDAN_BODY[-1 if front else 0][0],v)


def _end(front,u,v):
    across = 2*u-1
    sign = 1 if front else -1
    edge_x,edge_y,z0=_fascia_edge(front,v)
    lower, upper = (.246,.706) if front else (.312,.895)
    y = blend(blend(lower,upper,v),edge_y,abs(across)**2)
    shoulder = (1-abs(across)**2.85)**.51
    if front:
        fender_crown=.044*exp(-((abs(across)-.840)/.109)**2)*(1-smooth(.945,1,abs(across)))
        y += fender_crown*smooth(.57,1,v)
        depth = .199+.068*exp(-((v-.48)/.36)**2)-.043*v**4
        depth -= .127*smooth(.355,.735,abs(across))*smooth(.51,.83,v)
    else:
        lamp_shoulder=.045*exp(-((abs(across)-.825)/.157)**2)*(1-smooth(.922,1,abs(across)))
        y += lamp_shoulder*smooth(.62,1,v)
        depth = .199+.072*exp(-((v-.44)/.24)**2)-.025*smooth(.58,.70,v)
        depth += .014*exp(-((v-.563)/.064)**2)-.054*(1-smooth(.015,.25,v))
        x = edge_x*across
        registration=(1-smooth(.200,.268,abs(x)))*smooth(.313,.345,y)*(1-smooth(.539,.584,y))
        depth=blend(depth,.271,registration)
    return (edge_x*across,y,z0+sign*depth*shoulder)


def _end_point(front,x,y,offset=0):
    """Place a fascia insert on the same stamped surface as the bumper."""
    low,high=0,1
    for _ in range(12):
        v=(low+high)*.5
        edge=_fascia_edge(front,v)[0]
        u=max(0,min(1,(x/edge+1)*.5))
        _,height,z=_end(front,u,v)
        if height<y:
            low=v
        else:
            high=v
    return (x,y,z+(offset if front else -offset))


def _deck(front,u,v):
    x_end,y_end,z_end = _end(front,u,1)
    across = u*2-1
    crown = 1-across*across
    seam = SEDAN_COWL+.074*crown if front else SEDAN_REAR_GLASS-.036*crown
    z = blend(seam,z_end,v)
    x = blend(across*_side(1,z,1)[0],x_end,smooth(.72,1,v))
    shoulder = crown*(.026 if front else .021)
    ridge = .012*exp(-((abs(across)-.63)/.105)**2)*sin(pi*v)
    weight = smooth(.52 if front else .48,1,v)
    return (x,blend(_belt(z)+shoulder+ridge,y_end,weight),z)


def _panel(name,slot,label,columns,rows,sample,color,flip=False,uv=None):
    points = [sample(i/columns,j/rows) for j in range(rows+1) for i in range(columns+1)]
    faces = []
    for j in range(rows):
        for i in range(columns):
            a = j*(columns+1)+i
            face = (a,a+1,a+columns+2,a+columns+1)
            faces.append(face[::-1] if flip else face)
    return mesh(name,slot,label,points,faces,color,consistent=False,uv=uv)


def _panel_border(columns, rows):
    return ([(i/columns,0) for i in range(columns)] +
            [(1,j/rows) for j in range(rows)] +
            [(1-i/columns,1) for i in range(columns)] +
            [(0,1-j/rows) for j in range(rows)])


def _inside_loop(point, loop):
    x,y = point
    inside = False
    ax,ay = loop[-1]
    for bx,by in loop:
        if (ay > y) != (by > y) and x < ax+(bx-ax)*(y-ay)/(by-ay):
            inside = not inside
        ax,ay = bx,by
    return inside


def _perforated_surface(name, slot, label, outer, openings, samples, project, color, flip=False):
    """Triangulate the sheet up to the cut edges, including nonconvex stampings."""
    points, edges = [], []
    for loop in (outer,*openings):
        start = len(points)
        points.extend(Vector(p) for p in loop)
        edges.extend((start+i,start+(i+1)%len(loop)) for i in range(len(loop)))
    points.extend(Vector(p) for p in samples)
    points, _, triangles, *_ = delaunay_2d_cdt(points,edges,[],0,1.e-7,False)
    faces = []
    for triangle in triangles:
        center = tuple(sum(points[index][axis] for index in triangle)/3 for axis in range(2))
        if _inside_loop(center,outer) and not any(_inside_loop(center,hole) for hole in openings):
            faces.append(tuple(reversed(triangle)) if flip else tuple(triangle))
    used = sorted({vertex for face in faces for vertex in face})
    indices = {vertex:i for i,vertex in enumerate(used)}
    return mesh(name,slot,label,[project(*points[i]) for i in used],
                [tuple(indices[i] for i in face) for face in faces],color,consistent=False)


def _perforated_panel(name, slot, label, columns, rows, sample, project, openings, color, flip=False):
    outer = [sample(u,v) for u,v in _panel_border(columns,rows)]
    points = (sample(i/columns,j/rows) for j in range(1,rows) for i in range(1,columns))
    return _perforated_surface(name,slot,label,outer,openings,points,project,color,flip)


def _fascia_panel(name, label, front, u_span, v_span, openings, color, *, columns=65, rows=25, offset=0):
    def section(u,v):
        return _end(front,blend(*u_span,u),blend(*v_span,v))[:2]
    return _perforated_panel(name,"carPaint",label,columns,rows,section,
                             lambda x,y:_end_point(front,x,y,offset),openings,color,flip=not front)


def _add(a,b):
    return tuple(x+y for x,y in zip(a,b))


def _lerp(a,b,t):
    return tuple(blend(x,y,t) for x,y in zip(a,b))


def _scale(a,s):
    return tuple(x*s for x in a)


def _range(count):
    return (i/(count-1) for i in range(count))


def _elliptic(w,h,roundness=1,count=32):
    return [(copysign(abs(cos(a))**roundness,cos(a))*w/2,
             copysign(abs(sin(a))**roundness,sin(a))*h/2)
            for a in (tau*i/count for i in range(count))]


def _outline(points,count=3):
    return catmull([points[-1],*points,*points[:2]],count)[count:-1-count]


def _offset_outline(outline, center, scale=1):
    x,y = center
    return [(x+u*scale,y+v*scale) for u,v in outline]


def _bezel(name,slot,label,outline,project,levels,color,caps=False):
    rows = [[project(u*scale,v*scale,depth) for u,v in outline] for scale,depth in levels]
    return rows_mesh(name,slot,label,rows,color,caps=caps)


def _cord(name,slot,label,points,radius,color,*,sides=7,closed=False):
    if sides==7 and radius<.004:
        sides=4 if radius<.0015 else 5
    line = [Vector(p) for p in points]
    rows = []
    for i,p in enumerate(line):
        tangent = line[(i+1)%len(line) if closed else min(i+1,len(line)-1)]-line[i-1 if closed else max(0,i-1)]
        tangent.normalize()
        reference = Vector((0,1,0)) if abs(tangent.y)<.86 else Vector((0,0,1))
        across = tangent.cross(reference).normalized()
        up = tangent.cross(across).normalized()
        rows.append([tuple(p+radius*(across*cos(a)+up*sin(a))) for a in (tau*k/sides for k in range(sides))])
    if closed:
        rows.append(rows[0])
    return rows_mesh(name,slot,label,rows,color,caps=not closed)


def _pill(name,slot,label,at,width,height,depth,color,axis="z",shape=.53):
    if axis == "z":
        def project(x,y,d):
            return _add(at,(x,y,d))
    elif axis == "y":
        def project(x,y,d):
            return _add(at,(x,d,y))
    else:
        def project(x,y,d):
            return _add(at,(d,y,x))
    count=12 if max(width,height)<.077 else 18 if max(width,height)<.20 else 24
    return _bezel(name,slot,label,_elliptic(width,height,shape,count),project,
                  [(.76,-depth/2),(1,-depth*.28),(1,depth*.21),(.77,depth/2)],color,True)


def _letter(name,slot,body,at,size,color,*,right=(1,0,0),up=(0,1,0),font=None,rise=.00025,width=1,
            project=None):
    """Convert lettering to editable meshes so all engine exports carry the same marks."""
    curve = bpy.data.curves.new(body,'FONT')
    curve.body,curve.size,curve.align_x = body,size,'CENTER'
    curve.resolution_u = 4 if size>.021 else 2
    curve.extrude = rise if rise>=.00028 else 0
    if font:
        curve.font=font
    source = bpy.data.objects.new(body,curve)
    bpy.context.scene.collection.objects.link(source)
    evaluated = source.evaluated_get(bpy.context.evaluated_depsgraph_get())
    geometry = evaluated.to_mesh()
    normal = tuple(Vector(right).cross(Vector(up)))
    points = [_add(at,_add(_scale(right,v.co.x*width),_add(_scale(up,v.co.y),_scale(normal,v.co.z))))
              for v in geometry.vertices]
    if project:
        points = [project(*point) for point in points]
    faces = [tuple(face.vertices) for face in geometry.polygons]
    evaluated.to_mesh_clear()
    bpy.data.objects.remove(source,do_unlink=True)
    bpy.data.curves.remove(curve)
    if faces:
        return mesh(name,slot,body,points,faces,color,soft=False,consistent=False)


# The factory badge has four openings. Trace the openings directly so the
# oval and the inclined H meet with the same narrow radii as the photographed part.
_BADGE_OPENINGS=(
    ((-.460,.003),(-.449,.052),(-.403,.104),(-.343,.145),(-.269,.176),(-.185,.195),
     (-.173,.183),(-.206,.136),(-.247,.077),(-.285,.011),(-.319,-.061),
     (-.342,-.112),(-.365,-.126),(-.406,-.096),(-.448,-.046)),
    ((-.102,.092),(-.088,.151),(-.054,.203),(.021,.206),(.104,.203),(.184,.185),(.243,.159),
     (.243,.143),(.194,.098),(.140,.065),(.077,.041),(.007,.029),(-.047,.035),(-.090,.057)),
    ((-.244,-.143),(-.196,-.107),(-.136,-.072),(-.075,-.048),(-.013,-.035),(.049,-.040),
     (.081,-.064),(.093,-.104),(.081,-.154),(.051,-.202),(-.024,-.205),(-.106,-.200),
     (-.181,-.185),(-.231,-.167)),
    ((.169,-.172),(.173,-.155),(.204,-.103),(.240,-.045),(.275,.022),(.310,.085),
     (.340,.123),(.374,.114),(.418,.078),(.447,.032),(.455,-.011),
     (.435,-.063),(.388,-.109),(.322,-.146),(.244,-.177),(.183,-.185)),
)


def _badge(name,at,width,axis,color,reverse=False,*,slot="carMetal",slope=0,project=None):
    sign=-1 if reverse else 1

    def point(u,v,depth):
        x,y,d=u*sign*width,v*width,depth*width
        if project:
            return project(x,y,d)
        if axis=="y":
            return _add(at,(x,d,-y))
        return _add(at,(x,y,sign*d+slope*y))

    rim=_elliptic(1,.478,1,96)
    openings=[_outline(points,4) for points in _BADGE_OPENINGS]
    body=[rim,*openings]
    top=[]
    finish="Polished emblem" if slot=="carMetal" else "Embossed emblem"
    for i,loop in enumerate(body):
        cx,cy=(sum(p[j] for p in loop)/len(loop) for j in (0,1))

        def edge(scale,depth):
            return [point(blend(cx,u,scale),blend(cy,v,scale),depth) for u,v in loop]

        shoulder=1 if i==0 else -1
        sides=rows_mesh(name,slot,"Rounded edge of Hyundai emblem",
                       [edge(1,-.018),edge(1,.005),
                        edge(1-.012*shoulder,.016),edge(1-.028*shoulder,.022)],color,caps=False)
        sides["finish_override"]=finish
        top.append([(blend(cx,u,1-.028*shoulder),blend(cy,v,1-.028*shoulder)) for u,v in loop])
    crown=_perforated_surface(name,slot,"One-piece Hyundai H and oval with four through openings",
                              top[0],top[1:],[],lambda u,v:point(u,v,.022),color,flip=reverse)
    crown["finish_override"]=finish


def _sedan_asset(key,at=(0,0,0),parent=None):
    name=asset("sedan_"+key,"Parked sedan",hidden=True)
    ASSETS[name]["sedan"]={"at":at,"parent":parent}
    return name


def _side_suffix(side,front):
    return ("front" if front else "rear")+"_"+("left" if side>0 else "right")


def _door_pivot(side,front):
    return (side*.858,.325,SEDAN_DOORS[front][1]-.023)


def _door_edges(front,v):
    split = -.2825+.029*(1-v)**2-.008*sin(pi*v)
    if front:
        return split+.0025, SEDAN_DOORS[True][1]+.010*smooth(.68,1,v)-.014*(1-v)**2
    rear_edge = SEDAN_DOORS[False][0]+.201*(1-smooth(.01,.86,v))+.012*sin(pi*v)
    return rear_edge, split-.0025


def _paint_tint(p):
    return tone(SEDAN_PAINT,.87+.13*smooth(.20,.54,p[1]))


def _body_shell():
    name = _sedan_asset("body_shell")
    for side in (-1,1):
        fuel_outline = _elliptic(.165,.126,.36,36)
        fuel_center = (-1.689,.809)
        for front in (False,True):
            end = SEDAN_BODY[-1 if front else 0][0]
            def quarter(u,v):
                edge = _door_edges(front,v)[1 if front else 0]
                start = edge+(.0055 if front else -.0045)
                return _side(side,blend(start,end,u),v)
            if front or side>0:
                def quarter_profile(u,v):
                    _,y,z=quarter(u,v)
                    return z,y
                label="Front wing with wraparound lamp opening" if front else "Rear wing with stamped fuel opening"
                if front:
                    aperture=[(z,y) for _,y,z in (_lamp_surface(True,side,blend(.76,1,u),v,0)
                                                  for u,v in _panel_border(39,9))]
                else:
                    aperture=_offset_outline(fuel_outline,fuel_center)
                _perforated_panel(name,"carPaint",label,56,25,quarter_profile,
                                  lambda z,y:_side_height(side,z,y),
                                  [aperture],_paint_tint,flip=side>0)
            else:
                _panel(name,"carPaint",("Front" if front else "Rear")+" quarter panel",52,22,
                       quarter,_paint_tint,flip=(side>0)==front)
            _panel(name,"carPaint","Pressed fender shoulder",10,30,
                   lambda u,v:_deck(front,blend(0,.117,u) if side<0 else blend(.883,1,u),v),
                   SEDAN_PAINT,flip=front)
            axle = SEDAN_WHEELS[1 if front else 0]
            arc = [_side(side,axle+.366*cos(pi*t),0) for t in _range(39)]
            rows_mesh(name,"carPaint","Rolled sheet-metal edge of wheel opening",
                      [[_add(p,(-side*inset,drop,0)) for p in arc]
                       for inset,drop in ((.001,.001),(.006,-.004),(.017,-.004),(.025,.002))],
                      _paint_tint,caps=False,ring=False)
            liner = [[(side*x, .309+.353*sin(pi*t), axle+.358*cos(pi*t)) for t in _range(33)]
                     for x in (.658,.784,.891)]
            rows_mesh(name,"plain","Inner wheel liner",liner,rgb(0x262725),caps=False,ring=False)
        _panel(name,"carPaint","Curved rocker below doors",31,5,
               lambda u,v:(side*(.809+.037*sin(pi*v*.7)),blend(.197,.253,v),blend(-1.075,1.041,u)),
               _paint_tint,flip=side>0)
        _cord(name,"plain","Continuous door aperture seal",
              [(side*.844,.246,z) for z in (-1.17,-.45,.29,1.02)],.015,SEDAN_RUBBER)
        def sill(u,v):
            height=.246+.020*sin(pi*u)*sin(pi*v)**.33
            return side*blend(.758,.865,u),height,blend(-1.146,.976,v)
        _panel(name,"plain","Warm gray molded door sill scuff plate",12,45,sill,rgb(0x727771),flip=side>0)
        for u in (.18,.31,.79,.90):
            _cord(name,"plain","Lengthwise ribs in sill scuff plate",
                  [_add(sill(u,v),(0,.0012,0)) for v in _range(25)],.00089,rgb(0x646962),sides=4)
        if side>0:
            def fuel(u,v,depth):
                z,y=fuel_center[0]+u,fuel_center[1]+v
                return _add(_side_height(side,z,y),(depth,0,0))
            _bezel(name,"carPaint","Hemmed edge of filler aperture",fuel_outline,fuel,
                   [(1,0),(.984,-.0025),(.952,-.006)],SEDAN_PAINT)
            _bezel(name,"plain","Sealed filler pocket",fuel_outline,fuel,
                   [(.968,-.006),(.939,-.012)],SEDAN_BLACK,True)
            _bezel(name,"carPaint","Flush filler flap",fuel_outline,fuel,
                   [(.939,-.008),(.939,-.002),(.916,0)],SEDAN_PAINT,True)
        for start,end,height,label in ((1.798,1.953,.535,"Front bumper wing seam"),
                                       (-1.791,-2.131,.636,"Rear bumper quarter seam")):
            line=[_add(_side_height(side,blend(start,end,t),height+.006*sin(pi*t)),(-side*.0004,0,0))
                  for t in _range(34)]
            _cord(name,"plain",label,line,.0013,SEDAN_BLACK,sides=4)
        z = 1.071
        side_at = _side_height(side,z,.695)
        _pill(name,"plain","Front wing indicator gasket",_add(side_at,(side*.005,.004,0)),.082,.042,.012,
              SEDAN_RUBBER,"x",.76)
        _pill(name,"carLens","Amber repeater",_add(side_at,(side*.013,.004,0)),.066,.031,.012,
              rgb(0xdd8e16),"x",.75)

    _front_fascia(name)
    rear_lamps = [_lamp_cutout(False,side) for side in (-1,1)]
    plate_recess = _elliptic(.427,.207,.44,46)
    _fascia_panel(name,"Rounded rear bumper and valance",False,(0,1),(0,.612),
                  [*rear_lamps,_offset_outline(plate_recess,(0,.438))],_paint_tint,rows=24)
    def plate_pocket(u,v,depth):
        return _end_point(False,u,.438+v,depth)
    _bezel(name,"carPaint","Rolled edge of the rear registration recess",plate_recess,plate_pocket,
           [(1,0),(.980,-.006),(.945,-.018)],SEDAN_PAINT)
    _bezel(name,"plain","Dark backing in rear registration recess",plate_recess,plate_pocket,
           [(.950,-.017),(.926,-.032)],rgb(0x101112),True)
    for limit in ((0,.116),(.884,1)):
        _fascia_panel(name,"Rear quarter around lamp",False,limit,(.616,1),
                      rear_lamps,_paint_tint,columns=14,rows=18)
    _cord(name,"plain","Bumper to quarter-panel seam",
          [_add(_end(False,t,.614),(0,0,.001)) for t in _range(84)],.0015,rgb(0x101212),sides=4)
    for front,y,z in SEDAN_PLATES:
        sign=1 if front else -1
        box(name,"plain","Existing plate mounting recess",(0,y,z-sign*.010),(.366,.181,.015),SEDAN_RUBBER,.005)
        for side in (-1,1):
            lathe(name,"carMetal","Plate mounting screw",[(-.003,.005,.005),(.003,.005,.005)],
                  SEDAN_ALLOY,10,(side*.155,y+.065,z),axis="z")
    exhaust=(-.551,.237,-2.181)
    lathe(name,"carMetal","Seamed oval rear silencer",
          [(.252,.082,.048),(.226,.117,.058),(-.116,.116,.058),(-.148,.087,.050)],
          rgb(0x66645b),34,(-.530,.270,-1.829),"z")
    for z in (-1.619,-1.953):
        lathe(name,"plain","Crimped steel muffler shell seam",[(0,.107,.056),(.0048,.116,.060),(.010,.112,.058)],
              rgb(0x414039),32,(-.530,.270,z),"z",caps=False)
    _cord(name,"plain","Bent tail pipe upstream of rolled mouth",
          catmull([(-.532,.260,-1.935),(-.563,.252,-2.016),(-.560,.243,-2.071),
                   (-.550,.238,-2.099)],5),
          .022,rgb(0x474740),sides=17)
    # The opening returns into the outlet wall, leaving a visible bore.
    lathe(name,"carMetal","Rounded lip at recessed exhaust outlet",
          [(.086,.023,.021),(.039,.024,.021),(.009,.026,.022),(-.013,.027,.023),(-.020,.026,.022),
           (-.021,.023,.019),(-.018,.021,.018),(-.007,.021,.018)],rgb(0x69685e),
          36,exhaust,"z",caps=False)
    bore=lathe(name,"plain","Dark heat stained exhaust bore",
               [(-.018,.021,.018),(0,.021,.018),(.082,.020,.019)],rgb(0x10120f),32,
               exhaust,"z",caps=False)
    bore["finish_override"]="Sooted exhaust"
    box(name,"plain","Pressed rear crossmember above silencer",(0,.421,-1.925),
        (1.48,.083,.128),rgb(0x272923),.014)
    _cord(name,"carMetal","Muffler hanger rod",[(-.459,.286,-1.919),(-.410,.298,-1.925),
          (-.404,.326,-1.941)],.0068,rgb(0x5f594d),sides=8)
    _pill(name,"plain","Rubber exhaust isolation hanger",(-.405,.343,-1.940),
          .035,.052,.018,rgb(0x23241f),"z",.49)
    _cord(name,"carMetal","Welded upper exhaust hanger",[(-.404,.364,-1.941),(-.426,.388,-1.933)],
          .0068,rgb(0x5f594d),sides=8)
    box(name,"plain","Recessed underbody floor pan",(0,.216,-.12),(1.32,.066,3.54),SEDAN_BLACK,.028)
    _jamb_hardware(name)


def _jamb_hardware(name):
    for side in (-1,1):
        for z,y in ((-.287,.561),(-1.205,.575)):
            x=side*.792
            box(name,"carPaint","Pressed inner door jamb",(x,.577,z),(.050,.514,.082),SEDAN_PAINT,.014)
            _pill(name,"carMetal","Zinc-plated striker mounting plate",(side*.820,y,z),
                  .047,.096,.009,rgb(0x969c99),"x",.47)
            for tilt in (-1,1):
                bolt=(side*.827,y+tilt*.033,z-tilt*.009)
                lathe(name,"carMetal","Recessed striker fastener",[(0,.0066,.0066),(side*.0027,.0062,.0062)],
                      rgb(0xb3b9b7),16,bolt,"x")
                _cord(name,"plain","Fastener drive recess",
                      [_add(bolt,(side*.0032,dy,dz)) for dy,dz in ((-.002,-.002),(.002,.002))],
                      .00082,rgb(0x383b3c),sides=4)
            loop=catmull([(side*.823,y-.019,z),(side*.838,y-.015,z+.002),
                          (side*.843,y,z+.005),(side*.838,y+.015,z+.002),(side*.823,y+.019,z)],4)
            _cord(name,"carMetal","Rounded door latch striker loop",loop,.0038,SEDAN_ALLOY,sides=9)


def _front_fascia(name):
    grille = _outline([(-.411,.030),(-.394,.060),(-.340,.075),(-.245,.080),(0,.086),
                       (.245,.080),(.340,.075),(.394,.060),(.411,.030),(.399,-.025),
                       (.356,-.052),(.245,-.065),(0,-.073),(-.245,-.065),(-.356,-.052),(-.399,-.025)],4)
    lower = _outline([(-.478,.043),(-.450,.064),(-.265,.063),(0,.058),(.265,.063),
                       (.450,.064),(.478,.043),(.465,-.030),(.420,-.050),(0,-.061),
                       (-.420,-.050),(-.465,-.030)],4)
    fog = _outline([(-.107,.028),(-.104,-.015),(-.081,-.041),(-.037,-.047),
                    (.066,-.042),(.104,-.023),(.117,.003),(.108,.031),(.062,.043),
                    (-.054,.040)],3)
    grille_y=.622
    openings = [_offset_outline(grille,(0,grille_y)),_offset_outline(lower,(0,.325))]
    openings.extend([(side*(.596+x),.331+y) for x,y in fog] for side in (-1,1))
    openings.extend(_lamp_cutout(True,side) for side in (-1,1))
    _fascia_panel(name,"Molded front bumper with grille and lamp openings",True,(0,1),(0,1),
                  openings,_paint_tint,columns=72,rows=31)

    for outline, y, label in ((grille,grille_y,"Upper radiator grille"),(lower,.325,"Lower air intake")):
        def opening(u,v,depth):
            return _end_point(True,u,y+v,depth)
        _bezel(name,"carPaint",label+" rolled paint lip",outline,opening,
               [(1,0),(.995,-.002),(.979,-.006),(.961,-.013)],SEDAN_PAINT)
        duct=_bezel(name,"plain",label+" inner duct",outline,opening,
                    [(.956,-.017),(.927,-.034),(.905,-.072),(.864,-.083)],rgb(0x0a0c0e))
        duct["finish_override"]="Grille plastic"
        back=_bezel(name,"plain",label+" backing",outline,opening,
                    [(.866,-.083),(.854,-.087)],rgb(0x090b0d),True)
        back["finish_override"]="Grille plastic"

    for i in range(-6,7):
        bright = i%2==0
        x=i*.054
        full_height=1-.25*(x/.349)**4
        bottom=grille_y-full_height*.064
        top=grille_y+full_height*.071
        heel=_end_point(True,x,bottom,-.045)[2]
        brow=_end_point(True,x,top,-.038)[2]
        ridge=blend(heel,brow,.51)+.021
        depth_profile=((0,heel),(.30,blend(heel,ridge,.69)),(.51,ridge),
                       (.575,ridge-.001),(1,brow))

        def slat(u,v,depth=0):
            y=blend(bottom,top,v)
            angle=x*(.024*smooth(0,.56,v)-.021)
            girth=(.024 if bright else .011)*blend(.74,1,smooth(0,.42,v))
            x_at=x+angle+(u-.50)*girth
            return x_at,y,_profile(depth_profile,v,1)+depth

        fin=_panel(name,"plain","Bent black grille blade",4,18,slat,rgb(0x171a1c))
        fin["finish_override"]="Grille plastic"
        for edge in (0,1):
            wall=_panel(name,"plain","Deep side of grille blade",3,18,lambda u,v:slat(edge,v,-.040*u),
                        rgb(0x121519),flip=edge==0)
            wall["finish_override"]="Grille plastic"
        if bright:
            def brightwork(u,v):
                edge=abs(2*u-1)
                y=blend(.754 if i==0 else .073,.936,v)
                return slat(blend(.158,.842,u),y,.0019-.0012*edge**3)
            _panel(name,"carMetal","Beveled chrome grille insert",8,22,brightwork,SEDAN_CHROME)
    emblem_at=_end_point(True,0,.617,-.010)

    def emblem_mount(u,v,d):
        return _add(emblem_at,(u,v,d-.138*v))

    emblem_seat=_bezel(name,"plain","Low oval grille emblem seat",_elliptic(.108,.058,1,60),
                      emblem_mount,[(.79,-.031),(.970,-.009),(.970,-.003),(1,.0008)],
                      rgb(0x0d1011),True)
    emblem_seat["finish_override"]="Grille plastic"
    _badge(name,emblem_mount(0,0,.0013),.099,"z",SEDAN_CHROME,slope=-.138)

    for y in (.563,.578):
        rail=_cord(name,"plain","Dark lower grille reinforcement",
                   [_end_point(True,blend(-.347,.347,t),y+.010*(2*t-1)**2,-.059) for t in _range(46)],
                   .0032,rgb(0x101315))
        rail["finish_override"]="Grille plastic"

    for y in (.297,.329):
        _cord(name,"plain","Recessed lower air vane",[_end_point(True,blend(-.423,.423,t),y,-.040)
              for t in _range(39)],.0029,rgb(0x171b1d))
    for side in (-1,1):
        def fog_seat(u,v,depth):
            return _end_point(True,side*(.596+u),.331+v,depth)
        _bezel(name,"carPaint","Curved fog lamp pocket",fog,fog_seat,
               [(1,0),(.976,-.005),(.938,-.018)],SEDAN_PAINT)
        _bezel(name,"plain","Fog lamp seal",fog,fog_seat,
               [(.939,-.018),(.868,-.029),(.839,-.039)],SEDAN_BLACK)
        _bezel(name,"carMetal","Shallow fog lamp reflector cup",fog,fog_seat,
               [(.864,-.030),(.81,-.033),(.60,-.047),(.24,-.053)],rgb(0xbdc7c0),True)
        clear=_bezel(name,"carLens","Clear inset fog lamp cover",fog,fog_seat,
                     [(.862,-.028),(.809,-.025),(.65,-.023)],rgb(0xa4b2ae),True)
        clear["optical_cover"]="Clear"
        for i in range(13):
            x=(i-6)*.012
            half_height=.026*sqrt(1-(x/.099)**2)
            _cord(name,"carMetal","Fog reflector fluting",
                  [fog_seat(x,-half_height,-.038),fog_seat(x+.004,half_height,-.036)],
                  .00059,SEDAN_ALLOY,sides=4)


def _lids():
    for front in (False,True):
        key="hood" if front else "trunk_lid"
        name=_sedan_asset(key,SEDAN_HOOD if front else SEDAN_TRUNK)
        hinge=ASSETS[name]["sedan"]["at"]
        latch=_deck(front,.50,.959)
        ASSETS[name]["anchors"]={"hinge":hinge,"latch":_add(latch,_scale(hinge,-1))}
        def skin(u,v,drop=0):
            x,y,z=_deck(front,blend(.120,.880,u),v)
            return (x,y+.002-drop,z)
        _panel(name,"carPaint","Crowned outer panel",24,26,skin,SEDAN_PAINT,flip=front)
        _panel(name,"carPaint","Pressed inner shell",20,18,lambda u,v:skin(u,v,.020),
               rgb(0xb2b1ae),flip=not front)
        for edge in ((0,None),(1,None),(None,0),(None,1)):
            def hem(u,v):
                x,y,z=skin(u if edge[0] is None else edge[0],u if edge[1] is None else edge[1])
                tuck=(.006 if front else -.0035)*sin(pi*v)
                return x,y-v*.020,z-tuck
            _panel(name,"carPaint","Folded panel hem",24,7,hem,SEDAN_PAINT,
                   flip=(edge in ((0,None),(None,1)))==front)
        _panel(name,"fabric","Molded underside insulation",11,15,
               lambda u,v:skin(blend(.12,.88,u),blend(.13,.82,v),.027),rgb(0x333435),flip=not front)
        for side in (-1,1):
            _cord(name,"carPaint","Stamped reinforcement rib",
                  [skin(.5+side*blend(.109,.383,t),blend(.09,.94,t),.033) for t in _range(20)],
                  .013,rgb(0x8f9192))
            hinge_z=SEDAN_HOOD[2]+.008 if front else SEDAN_TRUNK[2]+.015
            _cord(name,"carMetal","Hinge arm",catmull([(side*.487,.822,hinge_z),
                   (side*.487,.862 if front else .836,hinge_z+(.105 if front else -.13)),
                   (side*.469,.901 if front else .851,hinge_z+(.260 if front else -.29))]),
                   .013,rgb(0x666c69))
        if front:
            _bezel(name,"carMetal","Bonnet latch staple",_elliptic(.074,.032,.55,20),
                   lambda x,y,t:_add(_deck(True,.5,.91),(x,y-.049,t)),
                   [(1,-.004),(1,.004),(.70,.004),(.70,-.004)],SEDAN_ALLOY)
            continue
        _fascia_panel(name,"Decklid vertical face between the lamps",False,(.119,.881),(.619,1),
                      [_lamp_cutout(False,side) for side in (-1,1)],SEDAN_PAINT,columns=32,rows=14,offset=.003)
        inner_lamp=_lamp_cutout(False,1)

        def garnish_edge(y):
            crossings=[blend(a[0],b[0],(y-a[1])/(b[1]-a[1]))
                       for a,b in zip(inner_lamp,inner_lamp[1:]+inner_lamp[:1])
                       if (a[1]>y)!=(b[1]>y)]
            return min(crossings,default=.626)-.0067

        def garnish(u,v):
            y=blend(.663,.731,v)
            limit=garnish_edge(y)
            return _end_point(False,blend(-limit,limit,u),y,.008+.003*sin(pi*v))

        _panel(name,"carMetal","Satin garnish ending inside the tail seals",39,11,garnish,
               rgb(0x999b9a),flip=True)
        for side in (-1,1):
            def garnish_return(u,v):
                y=blend(.663,.731,v)
                return _end_point(False,side*garnish_edge(y),y,blend(.002,.008+.003*sin(pi*v),u))

            _panel(name,"carMetal","Folded outer end of trunk garnish",4,17,
                   garnish_return,rgb(0x747875),flip=side<0)
        _cord(name,"carMetal","Bright garnish lip",
               [_end_point(False,blend(-.541,.541,t),.731,.014) for t in _range(40)],.0023,SEDAN_CHROME)
        def on_garnish(x,y,z):
            crown=.003*sin(pi*(y-.657)/.071)
            return _end_point(False,x,y,.0114+crown-z)
        for i,letter in enumerate("SONATA"):
            _letter(name,"carMetal",letter,((2.5-i)*.126,.679,0),.039,SEDAN_CHROME,
                    right=(-1,0,0),rise=.00115,width=.67,project=on_garnish)
        _letter(name,"carMetal","GVS",(-.514,.805,0),.031,SEDAN_CHROME,right=(-1,0,0),rise=.0006,
                width=.77,project=lambda x,y,z:_end_point(False,x,y,.0043-z))
        _badge(name,(0,0,0),.103,"z",SEDAN_CHROME,True,
               project=lambda x,y,d:_end_point(False,x,.807+y,.0016+d))
        lathe(name,"carMetal","Trunk lock bezel",[(0,.012,.012),(.005,.013,.013),(.008,.010,.010)],
              SEDAN_CHROME,18,_end_point(False,-.428,.690,.015),axis="z")
        box(name,"plain","Deck lock keyway",_end_point(False,-.428,.690,.021),(.0034,.011,.002),SEDAN_BLACK)


# The sections run from the grille or deck lid out towards the quarter panel.
# They are shared by the lens casting, gasket and painted openings.
_LAMP_SPANS={True:(.519,.911),False:(.591,.874)}
_LAMP_EDGES={
    True:(
        (0,.615,.632),(.025,.596,.650),(.09,.565,.678),(.17,.557,.701),(.29,.555,.719),
        (.44,.558,.741),(.60,.561,.757),(.73,.567,.767),(.84,.578,.770),
        (.93,.604,.761),(.976,.637,.733),(1,.659,.704),
    ),
    False:(
        (0,.675,.757),(.038,.665,.783),(.09,.659,.821),(.17,.657,.857),(.29,.656,.893),
        (.44,.658,.911),(.60,.660,.919),(.73,.662,.911),(.84,.666,.887),
        (.93,.677,.842),(.976,.701,.798),(1,.726,.758),
    ),
}


def _rounded_lens_parameter(u):
    return 2*asin(sqrt(max(0,min(1,u))))/pi


_LAMP_PROFILES = {
    front: tuple((_rounded_lens_parameter(u),bottom,top) for u,bottom,top in edge)
    for front,edge in _LAMP_EDGES.items()
}


def _lamp_sample(front,side,u,v):
    at=_rounded_lens_parameter(u)
    lower=_profile(_LAMP_PROFILES[front],at,1)
    upper=_profile(_LAMP_PROFILES[front],at,2)
    return side*blend(*_LAMP_SPANS[front],u),blend(lower,upper,v)


def _lamp_border(columns,rows):
    return [(.5-.5*cos(pi*u),v) for u,v in _panel_border(columns,rows)]


def _lamp_cutout_point(front,side,u,v):
    x,y=_lamp_sample(front,side,u,v)
    cx,cy=_lamp_sample(front,side,.5,.5)
    return blend(cx,x,.981),blend(cy,y,.981)


def _lamp_cutout(front,side):
    return [_lamp_cutout_point(front,side,u,v) for u,v in _lamp_border(57,10)]


def _lamp_surface(front,side,u,v,depth):
    x,y=_lamp_sample(front,side,u,v)
    x_offset=abs(x)
    wrap=.076*smooth(.886,.917,x_offset) if front else 0.0
    _,_,z=_end_point(front,x,y,-wrap)
    if front and wrap>0:
        sidewall=abs(_side_height(side,min(z,SEDAN_BODY[-1][0]),y)[0])+.0007
        transition=smooth(.887,.911,x_offset)*smooth(1.959,1.920,z)
        x=side*blend(x_offset,max(x_offset,sidewall),transition)
    turn=.86*smooth(.816 if front else .792,.933 if front else .900,x_offset)
    return x+side*turn*depth,y,z+(1 if front else -1)*sqrt(1-turn*turn)*depth


def _lens_uv(front,p):
    a,b=_LAMP_SPANS[front]
    u=max(0,min(1,(abs(p[0])-a)/(b-a)))
    bottom=_lamp_sample(front,1,u,0)[1]
    top=_lamp_sample(front,1,u,1)[1]
    return u,max(0,min(1,(p[1]-bottom)/(top-bottom)))


def _optical_panel(name,label,tint,columns,rows,sample,color,flip):
    pane=_panel(name,"carLens",label,columns,rows,sample,color,flip)
    pane["optical_cover"]=tint


def _headlamp_lenses(socket,name,surface,flip):
    def split(v):
        return _profile(((0,.635),(.132,.628),(.335,.624),(.445,.628),
                         (.573,.639),(.692,.657),(.805,.682),(.902,.718),(1,.756)),v,1)

    def crown(u,v):
        return .0028+.024*(sin(pi*v)*sin(pi*u))**.57

    def flutes(u,v):
        # The lens has distinct prism fields above and below the molded steps.
        step=smooth(.25,.355,v)-.54*smooth(.60,.73,v)
        sweep=46*u-1.55*(v-.28)**2+.34*sin(pi*v)
        strength=.42+.58*smooth(.34,.57,u)
        return sin(tau*(sweep+step))*strength

    def pane(u,v):
        return surface(u,v,crown(u,v)+.00011*flutes(u,v)*sin(pi*u)**.57)

    def reflector_band(u,v):
        return v+.165*(u-.38)**2-.049*u

    def silver(p):
        u,v=_lens_uv(True,p)
        row=reflector_band(u,v)
        highlight=.165*exp(-((row-.148)/.026)**2)+.092*exp(-((row-.382)/.056)**2)
        highlight+=.120*exp(-((row-.660)/.060)**2)+.081*exp(-((row-.935)/.045)**2)
        trough=.122*exp(-((row-.234)/.052)**2)+.135*exp(-((row-.522)/.063)**2)
        trough+=.137*exp(-((row-.798)/.036)**2)*smooth(.04,.45,u)
        prism=.071*flutes(u,v)*(.58+.42*sin(pi*v))
        return tone(rgb(0xb7c1be),.973+highlight-trough+prism)

    def amber(p):
        u,v=_lens_uv(True,p)
        upper=smooth(.47,.79,v)
        slant=v+.104*(u-.71)+.047*sin(pi*u)
        cells=cos(tau*(51*u-.73*slant))*(.47+.53*cos(tau*(10*slant+.16*u))**2)
        step=.147*exp(-((slant-.385)/.080)**2)-.115*exp(-((slant-.516)/.068)**2)
        sparkle=.151*exp(-((u-.867)/.08)**2-((v-.59)/.195)**2)
        return tone(rgb(0xf6a40b),.98+.152*cells+step+.061*upper+sparkle)

    for label,tint,columns,color in (
        ("Compound clear headlamp lens with three prism fields","Clear",112,silver),
        ("Fluted wraparound amber indicator lens","Amber",76,amber),
    ):
        def across(u,v):
            edge=split(v)
            return blend(edge,1,u) if tint=="Amber" else blend(0,edge,u)

        _optical_panel(name,label,tint,columns,36,lambda u,v:pane(across(u,v),v),color,flip)

        def reflector(u,v):
            u=blend(.009,.995,u)
            v=blend(.018,.983,v)
            x=across(u,v)
            cup=sin(pi*u)**.72*sin(pi*v)**.63
            if tint=="Clear":
                row=reflector_band(x,v)
                cup*=.34+.57*exp(-((row-.615)/.17)**2)+.39*exp(-((row-.302)/.132)**2)
                facets=.0024*(.52+.48*cos(tau*(29*u+.45*sin(pi*v))))**4
            else:
                facets=.0035*(.53+.47*cos(tau*(42*u-.33*v))*cos(tau*9*v))**4
            return surface(x,v,crown(x,v)-.0059-.026*cup-facets)

        reflector_part=_panel(socket,"carMetal",tint+" stamped multi-section lamp reflector",
                              95 if tint=="Clear" else 70,38,reflector,color,flip)
        if tint=="Amber":
            reflector_part["finish_override"]="Amber reflector"

    # Thin raised break lines in the clear prism trays keep the large silver
    # fields readable when the car is viewed close up in the parking area.
    for level,left,right in ((.146,.084,.585),(.344,.066,.605),(.574,.190,.604)):
        def rail(t):
            u=blend(left,right,t)
            v=level-.165*(u-.38)**2+.049*u
            return surface(u,v,crown(u,v)-.0095-.004*sin(pi*t))

        _cord(socket,"carMetal","Pressed horizontal headlamp prism shoulder",
              [rail(t) for t in _range(52)],.00115,rgb(0xd5d9cf),sides=5)
    _cord(name,"carLens","Fine clear-to-amber optical divider",
          [pane(split(v),v) for v in _range(54)],.00080,rgb(0xbba377),sides=5)


def _rear_lamp_lenses(socket,name,surface,flip):
    def height(u,v):
        return _lamp_sample(False,1,u,v)[1]

    def split(u):
        lower,upper=height(u,0),height(u,1)
        y=_profile(((0,.721),(.118,.728),(.252,.733),(.379,.737),(.640,.739),
                    (.767,.740),(.876,.739),(.929,.741),(.978,.750),(1,.750)),u,1)
        return max(.025,min(.975,(y-lower)/(upper-lower)))

    def pane(u,v,offset=0):
        dome=.003+.016*(sin(pi*v)*sin(pi*u))**.50
        return surface(u,v,dome+offset)

    def lower(u,v,offset=0):
        return pane(u,split(u)*v,offset)

    inner_arc=((0,.541),(.055,.825),(.166,.817),(.292,.867),(.417,.902),
               (.536,.896),(.636,.875),(.748,.846),(.824,.760),
               (.853,.568),(.879,.397),(.911,.270),(1,.195))

    def arc(u):
        return max(split(u),_profile(inner_arc,u,1))

    def red(p):
        u,v=_lens_uv(False,p)
        y=p[1]
        border=height(u,arc(u))
        outline=.248*exp(-((y-border)/.0023)**2)
        shoulder=.162*smooth(border-.001,border+.021,y)+.128*smooth(.820,.924,u)
        ribs=.056*cos(tau*(y*92+.64*u))+.019*cos(tau*y*214)
        micro=.043*cos(tau*77*u)*cos(tau*(y*151+.19*u))
        red_base=_lerp(rgb(0xe51712),rgb(0xbd110f),smooth(.525,.933,v)*.47)
        return tone(red_base,1.01-outline-shoulder+ribs+micro)

    def amber(p):
        u,v=_lens_uv(False,p)
        return_grid=cos(tau*(126*p[1]+.45*u))
        column=cos(tau*(39*u+.28*sin(pi*v)))
        roll=smooth(.795,.962,u)
        return tone(rgb(0xfba20b),.97+.16*column*return_grid+.097*return_grid*roll-.047*roll)

    def clear_end(t):
        return blend(.382,.409,t)

    _optical_panel(name,"Arched red tail lens with wraparound return","Red",100,44,
                   lambda u,v:pane(u,blend(split(u),1,v)),red,flip)
    _optical_panel(name,"Fresnel amber indicator and rounded outer return","Amber",82,25,
                   lambda u,v:lower(blend(clear_end(v),1,u),v),amber,flip)

    def reflector(u,v):
        u=blend(.008,.894,u)
        y=blend(split(u),arc(u),v)
        ribs=.00065*cos(tau*height(u,y)*114)
        spread=sin(pi*v)*sin(pi*u)
        return pane(u,y,-.0058-.0085*spread+ribs)

    stop=_panel(socket,"carMetal","Inset arched prismatic red stop lamp reflector",94,48,
                reflector,red,flip)
    stop["finish_override"]="Red reflector"
    red_return=_panel(socket,"carMetal","Dark red outer stop lamp shoulder reflector",60,28,
                       lambda u,v:pane(u,blend(split(u),1,v),-.021+.013*smooth(.76,1,u)),
                       rgb(0xaf1a13),flip)
    red_return["finish_override"]="Red reflector"
    amber_back=_panel(socket,"carMetal","Reflector with separate amber prism cells",76,26,
                      lambda u,v:lower(blend(clear_end(v),.991,u),blend(.037,.965,v),
                                        -.0063-.0019*cos(tau*29*u)*cos(tau*12*v)),amber,flip)
    amber_back["finish_override"]="Amber reflector"

    def keyway(u,v,offset=0):
        return lower(u*clear_end(v),v,offset)

    openings=[]
    for i in range(3):
        start=.074+i*.301
        end=start+.215
        gap=blend(.084,.060,i/2)
        openings.append([(gap,start),(.963,start),(.963,end),(gap,end)])

        def reverse_prism(p):
            u,_=_lens_uv(False,p)
            prism=.18*cos(tau*(u*62+.6*sin(p[1]*131)))+.128*cos(tau*p[1]*185)
            return tone(rgb(0xbac1ba),.91+prism)

        _optical_panel(name,f"Clear reverse lamp prism bar {i+1}","Clear",53,11,
                       lambda u,v:keyway(blend(gap,.963,u),blend(start,end,v),.0004),
                       reverse_prism,flip)
        _panel(socket,"carMetal","Faceted silver backing for reverse lamp bar",47,11,
               lambda u,v:keyway(blend(gap,.963,u),blend(start,end,v),
                                  -.0026-.0018*cos(tau*u*17)*sin(pi*v)),reverse_prism,flip)
    _perforated_surface(name,"carLens","Amber frame between the three clear reverse bars",
                        [(0,0),(1,0),(1,1),(0,1)],openings,
                        [(u,v) for u in (.029,.982) for v in _range(32) if 0<v<1],
                        lambda u,v:keyway(u,v,-.00012),rgb(0xd08710),flip)
    _cord(name,"carLens","Red molded strip along lower tail lens",
          [lower(u,.012) for u in _range(75)],.0018,rgb(0x9a170e),sides=5)
    _cord(name,"carLens","Horizontal joint from red tail to lower optics",
          [pane(u,split(u)) for u in _range(78)],.0011,rgb(0xb11209),sides=5)


def _lamps():
    for front in (False,True):
        for side in (-1,1):
            suffix=_side_suffix(side,front)
            socket=_sedan_asset("lamp_socket_"+suffix)
            lens=_sedan_asset("lamp_"+suffix)
            def surface(u,v,depth):
                return _lamp_surface(front,side,u,v,depth)
            edge=_lamp_border(70,16)
            flip=(side<0)==front
            _panel(socket,"plain","Deep lamp socket",32,17,
                   lambda u,v:surface(u,v,-.031),rgb(0x141819),flip)
            rows_mesh(socket,"plain","Lamp housing wall and perimeter seal",
                      [[surface(u,v,depth) for u,v in edge] for depth in (-.031,-.014,-.003,.002)],
                      rgb(0x151819),caps=False)
            def sealed_edge(u,v):
                x,y=_lamp_cutout_point(front,side,u,v)
                inset=.0028
                if front:
                    inset+=.093*smooth(.868,.912,abs(x))
                return _end_point(front,x,y,-inset)

            rows_mesh(socket,"plain","Hidden return behind stamped lamp opening",
                      [[sealed_edge(u,v) for u,v in edge],
                       [surface(u,v,-.011) for u,v in edge],
                       [surface(u,v,-.001) for u,v in edge]],rgb(0x141817),caps=False)
            _cord(socket,"plain","Thin black lamp gasket",[surface(u,v,.0011) for u,v in edge],
                  .0028,rgb(0x141715),closed=True,sides=6)
            if front:
                _headlamp_lenses(socket,lens,surface,flip)
            else:
                _rear_lamp_lenses(socket,lens,surface,flip)
            rim=rgb(0xadb3a9) if front else rgb(0xb3241b)
            _cord(lens,"carLens","Fine rim of the lens casting",[surface(u,v,.0029) for u,v in edge],
                  .00125,rim,closed=True,sides=4)


def _side_glass_point(side,front,u,v):
    lo,hi=SEDAN_DOORS[front]
    if front:
        z=blend(lo+.022-.074*v,.786-.041*v**1.7,u)
    else:
        z=blend(lo+.019+.405*(.67*v**2+.33*v**5),hi-.020-.068*v,u)
    top,inset=_cabin(z)
    bottom=_belt(z)+.012
    side_x=_side(1,z,1)[0]-.021
    y=blend(bottom,max(bottom+.022,top-.023),v)
    return (side*(blend(side_x,inset-.006,v)+.025*sin(pi*v)**1.25),y,z)


def _side_frame(name,side,front):
    def pane(u,v):
        return _side_glass_point(side,front,u,v)
    for label,line in (
        ("Window belt weatherstrip",[pane(u,0) for u in _range(29)]),
        ("Upper window frame",[pane(u,1) for u in _range(31)]),
        ("Door window rear edge",[pane(0,v) for v in _range(17)]),
        ("Door window leading edge",[pane(1,v) for v in _range(17)]),
    ):
        _cord(name,"plain",label,line,.008 if "Upper" in label else .007,SEDAN_RUBBER)
    _cord(name,"carMetal","Polished belt trim",[_add(pane(t,0),(side*.006,-.007,0)) for t in _range(31)],
          .0026,rgb(0xa9acab))


def _end_glass_point(front,u,v):
    a,b=(SEDAN_ROOF[1],SEDAN_COWL) if front else (SEDAN_REAR_GLASS,SEDAN_ROOF[0])
    z=blend(a,b,v)
    y,inset=_cabin(z)
    across=2*u-1
    crown=1-across*across
    lower = v if front else 1-v
    # The lower corners curl inboard. The center of each pane bows towards its deck.
    corner=.024*smooth(.80,1,abs(across))*smooth(.83,1,lower)
    bow=crown*(.022*sin(pi*v)+(.071 if front else .035)*lower**2)
    return (across*(inset-.018-corner),y+.013*crown+corner*.54,
            z+(1 if front else -1)*(bow-corner))


def _green_glass(front):
    def tint(p):
        color=rgb(0x475e5b) if front else rgb(0x3c4b4b)
        if front:
            return _lerp(color,rgb(0x344f61),.76*smooth(1.297,1.397,p[1]))
        return color
    return tint


def _rear_glass_heater(glass,pane):
    def inside(u,v):
        return _add(pane(u,v),(0,-.00085,.00057))

    copper=rgb(0xaa7449)
    first,last=.086,.909
    for i,at in enumerate(blend(first,last,t) for t in _range(12)):
        wire=_panel(glass,"carGlass",f"Rear demister trace {i+1:02}",44,1,
                    lambda u,v:inside(blend(.051,.949,u),at+(v-.5)*.00126),copper,True)
        wire["finish_override"]="Rear demister print"
    for offset in (.051,.949):
        bus=_panel(glass,"carGlass","Screen-printed edge busbar",1,42,
                   lambda u,v:inside(offset+(u-.5)*.0046,blend(first-.009,last+.006,v)),
                   rgb(0x855336),True)
        bus["finish_override"]="Rear demister print"
        contact=_panel(glass,"carGlass","Rear window heater terminal contact",1,4,
                       lambda u,v:inside(offset+(u-.5)*.013,blend(.047,.081,v)),
                       rgb(0x775e42),True)
        contact["finish_override"]="Rear demister print"


def _glazing_pane(front):
    glass=_sedan_asset("windshield" if front else "back_glass")
    def pane(u,v):
        return _end_glass_point(front,u,v)
    _panel(glass,"carGlass","Compound curved laminated glass" if front else "Heated rear window",
           32,24 if front else 38,pane,_green_glass(front),True)
    if not front:
        _rear_glass_heater(glass,pane)


def _roof_height(x,z):
    crown,width=_cabin(z)
    t=max(-1,min(1,x/width))
    return crown+.018*cos(pi*t*.5)**1.62


def _windshield_normal(u,v):
    across=Vector(_end_glass_point(True,u+.0005,v))-Vector(_end_glass_point(True,u-.0005,v))
    down=Vector(_end_glass_point(True,u,v+.0005))-Vector(_end_glass_point(True,u,v-.0005))
    return down.cross(across).normalized()


def _roof_and_glazing():
    roof=_sedan_asset("roof")

    def roof_panel(u,v,drop=0):
        z=blend(*SEDAN_ROOF,v)
        x=(2*u-1)*_cabin(z)[1]
        return x,_roof_height(x,z)-drop,z

    _panel(roof,"carPaint","Crowned steel roof",36,42,roof_panel,SEDAN_PAINT,True)
    _panel(roof,"fabric","Felt headliner",32,39,lambda u,v:roof_panel(u,v,.034),rgb(0xa49a84))

    def header(u,v):
        back=roof_panel(u,.982,.034)
        front=Vector(_end_glass_point(True,u,.085))-.0025*_windshield_normal(u,.085)
        return _add(_lerp(back,front,v),(0,-.009*sin(pi*v),0))

    _panel(roof,"fabric","Front headliner return to windshield",36,12,header,rgb(0xa49a84))

    for front in (False,True):
        _glazing_pane(front)
        def pane(u,v):
            return _end_glass_point(front,u,v)
        for edge in (0,1):
            line=[pane(t,edge) for t in _range(31)]
            _cord(roof,"plain","Glazing encapsulated seal",line,.006,rgb(0x1d2021))
            _cord(roof,"plain","Glazing side rubber",[pane(edge,t) for t in _range(33)],.0065,SEDAN_RUBBER)
        deck_edge=1 if front else 0
        _panel(roof,"plain","Glazing to deck sealed return",34,6,
               lambda u,v:_lerp(pane(u,deck_edge),_deck(front,blend(.055,.945,u),0),v),
               rgb(0x222626),flip=front)

    for side in (-1,1):
        rim=[(side*_cabin(z)[1],_cabin(z)[0]+.003,z) for z in (blend(*SEDAN_ROOF,t) for t in _range(41))]
        _cord(roof,"carPaint","Gutter above doors",rim,.0044,SEDAN_PAINT)
        _cord(roof,"plain","Roof ditch rubber",[_add(p,(-side*.012,.002,0)) for p in rim],.0026,SEDAN_RUBBER)
        edge = 1 if side>0 else 0
        def a_pillar(u,v):
            outer = _end_glass_point(True,edge,v)
            z = blend(SEDAN_ROOF[1]-.030,.745,v)
            y,x = _cabin(z)
            inner = (side*(x-.006),y-.023,z)
            return _add(_lerp(outer,inner,u),(side*.006*sin(pi*u),.005*sin(pi*u),0))
        def c_pillar(u,v):
            outer = _end_glass_point(False,edge,v)
            inner = _side_glass_point(side,False,0,v)
            crown=sin(pi*u)*sin(pi*v)**1.09
            return _add(_lerp(outer,inner,u),(side*.019*crown,.005*crown,0))
        _panel(roof,"carPaint","A pillar" if side<0 else "Driver A pillar",9,24,
               a_pillar,SEDAN_PAINT,flip=side>0)
        _panel(roof,"carPaint","Quarter panel between rear glass and door",18,33,
               c_pillar,SEDAN_PAINT,flip=side>0)
        for front, footing in ((True,lambda u:a_pillar(u,1)),(False,lambda u:c_pillar(u,0))):
            def pillar_heel(u,v):
                start=footing(u)
                return _lerp(start,_side(side,start[2],1),v)
            _panel(roof,"carPaint",("Front" if front else "Rear")+" pillar heel into the beltline",18,5,
                   pillar_heel,SEDAN_PAINT,flip=(side<0)!=front)

        def rear_pillar_return(u,v):
            corner=c_pillar(0,0)
            heel=_lerp(corner,_side(side,corner[2],1),u)
            deck=_deck(False,blend(.055 if side<0 else .945,edge,u),0)
            return _lerp(heel,deck,v)

        _panel(roof,"carPaint","Closed rear pillar to quarter return",17,7,
               rear_pillar_return,SEDAN_PAINT,flip=side<0)

        def midpillar(u,v):
            return _lerp(_side_glass_point(side,False,1,v),_side_glass_point(side,True,0,v),u)
        _panel(roof,"plain","Black B-pillar cover",7,24,midpillar,rgb(0x212324),flip=side>0)
        post=_outline([(-.065,.258),(-.062,.803),(-.067,1.206),(-.104,1.326),
                       (-.067,1.365),(.056,1.365),(.056,1.221),(.025,.946),
                       (.054,.868),(.047,.267)],4)

        def pillar_trim(z,y,depth):
            outer=blend(.839,.704,smooth(.817,1.362,y))
            return side*(outer-depth),y,-.263+z

        _bezel(roof,"carLeather","Interior B-pillar trim into the roof and sill",post,pillar_trim,
               [(1,-.020),(1,.012),(.969,.028),(.915,.036)],rgb(0x888172),True)
        for front in (False,True):
            z0,z1 = (SEDAN_ROOF[0],-.365) if not front else (-.322,SEDAN_ROOF[1])
            def gutter(u,v):
                z=blend(z0,z1,u)
                y,x=_cabin(z)
                return (side*(x-.005*v),y-.023*v,z)
            _panel(roof,"carPaint","Painted roof edge over door glass",19,4,gutter,SEDAN_PAINT,flip=side<0)
        pillar_path=[a_pillar(.50,t) for t in _range(28)]
        tube(roof,"carLeather","Padded inner A-pillar molding",
             [(_add(p,(-side*.019,-.013,0)),.024,.019) for p in pillar_path],
             SEDAN_TRIM,sides=9,density=1)
        at=_add(a_pillar(.50,.855),(-side*.038,-.028,-.009))
        _pill(roof,"carLeather","A-pillar tweeter mounting flange",at,.043,.048,.021,
              rgb(0x6f7164),"x",.74)
        _pill(roof,"plain","Inset A-pillar tweeter grille",_add(at,(-side*.010,0,-.002)),
              .031,.035,.005,rgb(0x3a3d38),"x",.78)
    _headliner_details(roof)

    _cowl_wipers()


def _cowl_wipers():
    name=_sedan_asset("wipers")
    def glass(u,v,offset):
        return tuple(Vector(_end_glass_point(True,u,v))+offset*_windshield_normal(u,v))

    def cowl(u,v):
        x=blend(-.763,.763,u)
        return x,.932-.028*(abs(x)/.763)**1.7+.007*sin(pi*v),.830+.073*v+.035*(1-(x/.763)**2)

    _panel(name,"plain","Cowl grille below windshield seal",46,11,cowl,rgb(0x272b29),True)
    for side in (-1,1):
        for i in range(19):
            u=.5+side*(.119+.0181*i)
            _cord(name,"gloss","Narrow molded cowl vent slot",
                  [_add(cowl(u+t*.005,blend(.124,.750,t)),(0,.0017,0)) for t in _range(7)],
                  .0023,rgb(0x171b19),sides=5)
    for start,end,pivot in ((.462,.861,.870),(.107,.489,.509)):
        glass_x=_end_glass_point(True,pivot,1)[0]
        at=_add(cowl(.50+glass_x/1.526,.48),(0,-.002,0))
        lathe(name,"plain","Wiper spindle gaiter",
              [(0,.014,.014),(.007,.014,.014),(.011,.010,.010)],rgb(0x252928),26,at)
        lathe(name,"gloss","Pressed wiper spindle cap",
              [(0,.010,.010),(.005,.009,.009)],rgb(0x363b37),20,_add(at,(0,.010,0)))
        def blade(t,h=0):
            u=blend(start,end,t)
            v=.988-.027*sin(pi*t*.91)-.006*t
            return glass(u,v,h)
        root=_add(at,(0,.014,-.004))
        fold=_add(glass(end-.047,.942,.017),(0,.004,0))
        link=blade(.545,.015)
        tube(name,"plain","Tapered stamped wiper arm and return spring cover",
             [(root,.0082,.0060),(fold,.0072,.0043),(link,.0038,.0042)],rgb(0x252a27),sides=8,density=5)
        _cord(name,"plain","Continuous rubber squeegee resting on glass",[blade(t,.0016) for t in _range(59)],
              .0025,rgb(0x161918),sides=8)
        _cord(name,"gloss","Steel blade carrier spine",[blade(t,.0043) for t in _range(57)],
              .0034,rgb(0x303632),sides=7)
        for a,b,flange in ((.027,.30,.006),(.29,.55,.011),(.54,.79,.011),(.78,.976,.006)):
            bow=[blade(blend(a,b,t),.0045+flange*sin(pi*t)**.61) for t in _range(11)]
            _cord(name,"plain","Bow of the articulated wiper bridge",bow,.0032,rgb(0x292e2a),sides=7)
        _pill(name,"plain","Central wiper arm adapter",blade(.545,.014),.044,.025,.011,
              rgb(0x252b27),"y",.46)
        for t in (.071,.27,.72,.929):
            _pill(name,"plain","Blade bridge clip",blade(t,.006),.016,.018,.006,rgb(0x343934),"y",.64)


def _doors_and_mirrors():
    for side in (-1,1):
        for front in (False,True):
            suffix=_side_suffix(side,front)
            pivot=_door_pivot(side,front)
            lo,hi=SEDAN_DOORS[front]
            name=_sedan_asset("door_"+suffix,pivot)
            def skin(u,v):
                return _side(side,blend(*_door_edges(front,v),u),v)
            def profile(u,v):
                _,y,z=skin(u,v)
                return z,y
            handle_z=lo+(.180 if front else .177)
            handle_y=.817 if front else .840
            recess=_elliptic(.209,.066,.81,42)
            _perforated_panel(name,"carPaint","Pressed door skin with handle well",46,23,profile,
                              lambda z,y:_side_height(side,z,y),
                              [_offset_outline(recess,(handle_z,handle_y))],_paint_tint,flip=side>0)
            boundary=[skin(u,v) for u,v in _panel_border(32,20)]
            rows_mesh(name,"carPaint","Folded door perimeter",
                      [[_add(p,(-side*depth,0,0)) for p in boundary] for depth in (0,.004,.021)],
                      SEDAN_PAINT,caps=False)
            _cord(name,"plain","Perimeter weather seal",[_add(p,(-side*.024,.001,0)) for p in boundary],
                  .004,SEDAN_BLACK,closed=True,sides=5)
            def pull(u,v,d):
                return _add(_side_height(side,handle_z+u,handle_y+v),(side*d,0,0))
            grip={
                "pull":pull(0,.007,.016),
                "release":(side*.749,_belt((lo+hi)/2)-.155,hi-.16),
                "lock":(side*.844,_belt(lo+.293)+.020,lo+.293),
            }
            ASSETS[name]["anchors"]={key:_add(at,_scale(pivot,-1)) for key,at in grip.items()}
            ASSETS[name]["anchors"]["hinge"]=pivot
            _bezel(name,"carPaint","Rounded stamped lip of door-handle well",recess,pull,
                   [(1,0),(.980,-.004),(.926,-.013),(.826,-.022)],SEDAN_PAINT)
            _bezel(name,"plain","Shadow in recessed door pull",recess,pull,
                   [(.828,-.021),(.780,-.024)],rgb(0x101314),True)
            _bezel(name,"carPaint","Painted pull handle",_elliptic(.177,.032,.60,40),
                   lambda u,v,d:pull(u,v+.006,d),[(.94,-.004),(1,.007),(.92,.015),(.81,.017)],
                   SEDAN_PAINT,True)
            _cord(name,"carMetal","Exterior handle bright edge",
                  [pull(blend(-.074,.073,t),.018+sin(pi*t)*.002,.014) for t in _range(25)],
                  .0013,SEDAN_CHROME,sides=5)
            if front:
                _pill(name,"carMetal","Front door lock cylinder",pull(-.068,-.001,.016),.014,.018,.006,SEDAN_ALLOY,"x")
                _pill(name,"plain","Door keyway",pull(-.068,-.001,.020),.003,.009,.001,SEDAN_BLACK,"x")
            start,end=lo+(.033 if front else .227),hi-(.173 if front else .020)
            def trim(u,v,depth):
                z=(start+end)*.5+u
                return _add(_side_height(side,z,.553-.012*z+v),(side*depth,0,0))
            _bezel(name,"plain","Black bodyside molding",_elliptic(end-start,.032,.28,52),trim,
                   [(1,0),(1,.004),(.980,.008),(.943,.009)],rgb(0x191b1e),True)
            _bezel(name,"carMetal","Inset bright bodyside strip",_elliptic((end-start)*.969,.009,.28,44),
                   lambda u,v,d:trim(u,v+.006,d),[(1,.0090),(.976,.0113),(.943,.0115)],SEDAN_CHROME,True)
            _side_frame(name,side,front)
            _door_card(name,side,front,lo,hi)
            glass=_sedan_asset("side_glass_"+suffix,pivot,"sedan_door_"+suffix)
            _panel(glass,"carGlass","Curved tinted roll-up glass",25,15,
                   lambda u,v:_side_glass_point(side,front,u,v),rgb(0x3b5251),flip=side>0)
            if front:
                _outside_mirror(side,pivot,suffix)


def _outside_mirror(side,pivot,suffix):
    house=_sedan_asset("mirror_housing_"+suffix,pivot,"sedan_door_"+suffix)
    glass=_sedan_asset("mirror_glass_"+suffix,pivot,"sedan_door_"+suffix)
    name="Driver" if side>0 else "Passenger"
    mount=[(side*.891,.940,.842),(side*.849,1.010,.806),(side*.917,.949,.735)]
    _cord(house,"plain",name+" sail panel frame",mount,.011,SEDAN_RUBBER,closed=True)
    mesh(house,"plain",name+" molded sail mounting plate",mount,[(0,1,2)],SEDAN_BLACK,soft=False)
    _cord(house,"plain",name+" mirror stalk",[(side*.897,.951,.790),(side*.952,.973,.778),(side*.992,.985,.771)],
          .024,SEDAN_BLACK,sides=12)
    outline=_outline([(-.109,-.037),(-.113,-.003),(-.104,.038),(-.076,.056),(-.028,.054),
                      (.054,.041),(.105,.016),(.126,-.007),(.115,-.031),(.076,-.045),
                      (-.039,-.050),(-.085,-.046)],5)
    def mirror(u,v,d):
        return (side*(1.024+u),.989+v+.047*u,.716+d+.141*u+.0047*(u/.124)**2)
    _bezel(house,"carPaint",name+" contoured mirror cap",outline,mirror,
           [(1,-.006),(1,.028),(.942,.057),(.742,.081),(.39,.093)],SEDAN_PAINT,True)
    _bezel(house,"plain",name+" glass mount and dark cavity",outline,mirror,
           [(1,.008),(1,-.006),(.983,-.014),(.936,-.018),(.908,-.010)],SEDAN_BLACK,True)
    pane=_bezel(glass,"carMetal",name+" shallow convex mirror with polished edge",outline,mirror,
                [(.936,-.018),(.919,-.020),(.902,-.022),(.71,-.024),(.40,-.026)],rgb(0x929c9c),True)
    pane["finish_override"]="Mirror glass"
    font_path=Path("C:/Windows/Fonts/malgun.ttf")
    font=bpy.data.fonts.load(str(font_path),check_existing=True) if font_path.exists() else None
    warning=_letter(glass,"gloss" if side<0 else "carMetal",
                    "사물이 거울에 보이는 것보다 가까이 있음" if font else "OBJECTS IN MIRROR",
                    (0,-.032,0),.0049,rgb(0xa7aaa2),right=(-1,0,0),font=font,rise=.00005,
                    project=lambda x,y,z:mirror(side*x,y,-.027+z))
    if warning:
        warning["finish_override"]="Mirror lettering"


def _mirror_frit(name):
    def glass(u,v):
        return tuple(Vector(_end_glass_point(True,u,v))-.00095*_windshield_normal(u,v))

    def extent(t):
        return blend(.072,.047,t)

    def printed(u,v):
        return glass(.5+(2*u-1)*extent(v),blend(.033,.202,v))

    ink=rgb(0x262a2a)
    _panel(name,"plain","Windshield ceramic frit behind bonded mirror",26,31,printed,ink)
    points,faces=[],[]
    for i in range(9):
        radius=blend(.00105,.00034,i/8)
        bottom=[(.5+(j-16)*.00308,.204+i*.0044) for j in range(33)]
        sides=[(.5+side*(extent(t)+(i+1)*.00245),blend(.036,.200,t))
               for side in (-1,1) for t in _range(19)]
        for x,v in bottom+sides:
            start=len(points)
            points.extend(glass(x+radius*cos(a),v+radius*2.05*sin(a))
                          for a in (tau*k/8 for k in range(8)))
            faces.append(tuple(range(start,start+8)))
    mesh(name,"plain","Fading dots at mirror frit edge",points,faces,ink,soft=False,consistent=False)


def _inside_mirror():
    house=_sedan_asset("rearview_housing")
    glass=_sedan_asset("rearview_glass")
    _mirror_frit(house)
    outline=_outline([(-.109,-.026),(-.116,-.017),(-.113,.021),(-.102,.030),
                      (.100,.030),(.113,.022),(.117,-.017),(.109,-.026),
                      (.086,-.031),(-.087,-.031)],5)

    def view(u,v,depth):
        return u,1.243+v,.348-.153*v+depth

    _bezel(house,"plain","Molded black day/night mirror housing",outline,view,
           [(.79,.023),(.949,.018),(1,.005),(1,-.007),(.977,-.014),
            (.923,-.014),(.905,-.011)],rgb(0x202421))
    coordinates=[view(u*.916,v*.916,-.0128) for u,v in outline]
    prism=mesh(glass,"carMetal","Flat reflecting face of the mirror prism",coordinates,
               [tuple(range(len(coordinates)))],rgb(0xa9ada8),soft=False,consistent=False)
    prism["finish_override"]="Mirror glass"
    _bezel(house,"plain","Mirror prism backing",outline,view,
           [(.919,-.0105),(.889,.016)],rgb(0x252929),True)

    def shoe(u,v,depth):
        return tuple(Vector(_end_glass_point(True,.50+u,.158+v))-
                     depth*_windshield_normal(.50+u,.158+v))

    # The adhesive face crosses the windshield surface to close the joint in every export.
    _bezel(house,"plain","Bonded windshield mirror button",_elliptic(.027,.078,.56,40),shoe,
           [(1,-.0010),(1,.004),(.97,.009),(.78,.014)],rgb(0x242826),True)
    button=shoe(0,0,.012)
    ball=view(-.002,.009,.018)
    _pill(house,"plain","Ball socket set into back of mirror",ball,.034,.035,.033,
          rgb(0x282c28),"z",.88)
    tube(house,"plain","Tapered mirror stalk from windshield button to swivel",
         [(button,.018,.013),(shoe(0,0,.025),.016,.010),
          ((-.002,1.284,.369),.0088,.0096),(ball,.0093,.011)],
         rgb(0x242824),sides=12,density=5)
    _pill(house,"plain","Anti-glare lever hinge",view(0,-.024,.002),.026,.023,.020,
          rgb(0x232622),"z",.59)
    _pill(house,"plain","Day/night anti-glare thumb lever",view(0,-.037,-.004),.027,.025,.010,
          rgb(0x292c28),"z",.46)
