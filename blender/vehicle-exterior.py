"""Body, glazing, lamps and brightwork for the photographed EF Sonata."""

from math import atan2, copysign
from mathutils import Matrix
from mathutils.geometry import delaunay_2d_cdt


# Longitudinal stations matched against the low front and both rear reference views.
# The axle centers stay fixed so that the build measures body contours against the rims.
SEDAN_BODY = (
    (-2.131,.879,.867,.278),(-1.988,.904,.916,.245),(-1.72,.926,.963,.233),
    (-1.36,.929,.972,.226),(-.95,.925,.969,.217),(-.34,.925,.956,.214),
    (.20,.924,.943,.216),(.68,.928,.934,.221),(1.03,.935,.919,.228),
    (1.40,.931,.877,.231),(1.73,.911,.810,.241),(1.953,.869,.745,.266),
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
SEDAN_CARPET = rgb(0x6d6656)
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


def _end(front,u,v):
    across = 2*u-1
    sign = 1 if front else -1
    z0 = SEDAN_BODY[-1 if front else 0][0]
    edge_x, edge_y, _ = _side(1,z0,v)
    lower, upper = (.246,.706) if front else (.312,.895)
    y = blend(blend(lower,upper,v),edge_y,abs(across)**2)
    shoulder = (1-abs(across)**2.85)**.51
    if front:
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
        edge=_end(front,1,v)[0]
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


def _letter(name,slot,body,at,size,color,*,right=(1,0,0),up=(0,1,0),font=None,rise=.00025):
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
    points = [_add(at,_add(_scale(right,v.co.x),_add(_scale(up,v.co.y),_scale(normal,v.co.z))))
              for v in geometry.vertices]
    faces = [tuple(face.vertices) for face in geometry.polygons]
    evaluated.to_mesh_clear()
    bpy.data.objects.remove(source,do_unlink=True)
    bpy.data.curves.remove(curve)
    if faces:
        return mesh(name,slot,body,points,faces,color,soft=False,consistent=False)


def _badge(name,at,width,axis,color,reverse=False):
    """The skewed H inside the oval, on the grille, deck and steering hub."""
    sign = -1 if reverse else 1
    def point(u,v):
        xyz = (u*sign*width,v*width,0) if axis=="z" else (u*sign*width,0,-v*width)
        return _add(at,xyz)
    _cord(name,"carMetal","Oval badge", [point(.49*cos(tau*t),.233*sin(tau*t)) for t in _range(43)][:-1],
          width*.025,color,closed=True)
    for stroke in [[(-.304,-.136),(-.186,-.121),(-.098,.166)],
                   [(.104,-.163),(.207,.106),(.252,.142)],
                   [(-.165,-.022),(-.062,.026),(.088,.042),(.159,.077)]]:
        _cord(name,"carMetal","Slanted H",catmull([point(u,v) for u,v in stroke],3),width*.042,color)


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
            if not front and side>0:
                def quarter_profile(u,v):
                    _,y,z=quarter(u,v)
                    return z,y
                _perforated_panel(name,"carPaint","Rear quarter panel with stamped fuel opening",50,24,
                                  quarter_profile,
                                  lambda z,y:_side_height(side,z,y),
                                  [_offset_outline(fuel_outline,fuel_center)],_paint_tint,flip=True)
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
    _cord(name,"plain","Backbox outlet pipe",catmull([(-.504,.236,-1.70),(-.533,.236,-1.932),
          (-.554,.232,-2.040),(-.557,.234,-2.152)],4),.024,rgb(0x373936),sides=12)
    lathe(name,"carMetal","Rolled exhaust tip",[(-.030,.027,.029),(0,.032,.034),(.028,.031,.033),(.028,.023,.026)],
          rgb(0x555b5b),22,(-.558,.234,-2.146),axis="z",caps=False)
    box(name,"plain","Recessed underbody floor pan",(0,.216,-.12),(1.32,.066,3.54),SEDAN_BLACK,.028)


def _front_fascia(name):
    grille = _outline([(-.405,.027),(-.391,.062),(-.332,.078),(-.235,.080),(0,.082),
                       (.235,.080),(.332,.078),(.391,.062),(.405,.027),(.380,-.037),
                       (.336,-.057),(.240,-.068),(0,-.071),(-.240,-.068),(-.336,-.057),(-.380,-.037)],4)
    lower = _outline([(-.478,.043),(-.450,.064),(-.265,.063),(0,.058),(.265,.063),
                       (.450,.064),(.478,.043),(.465,-.030),(.420,-.050),(0,-.061),
                       (-.420,-.050),(-.465,-.030)],4)
    fog = _elliptic(.223,.091,.52,36)
    grille_y=.622
    openings = [_offset_outline(grille,(0,grille_y)),_offset_outline(lower,(0,.325))]
    openings.extend(_offset_outline(fog,(side*.596,.331)) for side in (-1,1))
    openings.extend(_lamp_cutout(True,side) for side in (-1,1))
    _fascia_panel(name,"Molded front bumper with grille and lamp openings",True,(0,1),(0,1),
                  openings,_paint_tint,columns=72,rows=31)

    for outline, y, label in ((grille,grille_y,"Upper radiator grille"),(lower,.325,"Lower air intake")):
        def opening(u,v,depth):
            return _end_point(True,u,y+v,depth)
        _bezel(name,"carPaint",label+" rolled paint lip",outline,opening,
               [(1,0),(.992,-.002),(.974,-.009),(.955,-.017)],SEDAN_PAINT)
        _bezel(name,"plain",label+" inner duct",outline,opening,
               [(.956,-.017),(.927,-.034),(.905,-.072),(.864,-.083)],rgb(0x0a0c0e))
        _bezel(name,"plain",label+" backing",outline,opening,
               [(.866,-.083),(.854,-.087)],rgb(0x090b0d),True)

    for i in range(-6,7):
        x=i*.052
        full_height=1-.24*(x/.345)**4
        bottom=grille_y-full_height*.059
        top=grille_y+full_height*.068
        heel=_end_point(True,x,bottom,-.034)[2]
        brow=_end_point(True,x,top,-.026)[2]
        ridge=blend(heel,brow,.48)+.014
        depth_profile=((0,heel),(.30,blend(heel,ridge,.65)),(.49,ridge),
                       (.66,blend(ridge,brow,.37)),(1,brow))
        def slat(u,v,depth=0):
            y=blend(bottom,top,v)
            offset=.004*abs(x)*v-.011*(1-v)
            x_at=x+offset+(u-.50)*(.013 if i%2 else .023)
            return x_at,y,_profile(depth_profile,v,1)+depth
        _panel(name,"plain","Recessed molded grille fin",4,12,slat,rgb(0x25292a))
        for edge in (0,1):
            _panel(name,"plain","Deep side of grille fin",3,12,lambda u,v:slat(edge,v,-.035*u),
                   rgb(0x121519),flip=edge==0)
        if i%2==0:
            _panel(name,"carMetal","Formed chrome grille insert",4,10,
                   lambda u,v:slat(blend(.16,.88,u),blend(.69 if i==0 else .10,.94,v),.0007),
                   SEDAN_CHROME)
    _bezel(name,"plain","Oval grille medallion backing",_elliptic(.115,.063,.82,36),
           lambda u,v,d:_end_point(True,u,.622+v,d),
           [(.98,-.035),(1,-.024),(.91,-.011)],rgb(0x101415),True)
    _badge(name,_end_point(True,0,.622,-.006),.095,"z",SEDAN_CHROME)

    for y in (.297,.329):
        _cord(name,"plain","Recessed lower air vane",[_end_point(True,blend(-.423,.423,t),y,-.040)
              for t in _range(39)],.0029,rgb(0x171b1d))
    for side in (-1,1):
        def fog_seat(u,v,depth):
            return _end_point(True,side*.596+u,.331+v,depth)
        _bezel(name,"carPaint","Curved fog lamp pocket",fog,fog_seat,
               [(1,0),(.976,-.005),(.938,-.018)],SEDAN_PAINT)
        _bezel(name,"plain","Fog lamp seal",fog,fog_seat,
               [(.939,-.018),(.868,-.029),(.839,-.039)],SEDAN_BLACK)
        _bezel(name,"carLens","Clear inset fog lens",fog,fog_seat,
               [(.865,-.029),(.819,-.026),(.65,-.023)],rgb(0xa3b0ae),True)
        for i in range(13):
            x=(i-6)*.012
            half_height=.026*sqrt(1-(x/.099)**2)
            _cord(name,"carMetal","Fog reflector fluting",
                  [fog_seat(x,-half_height,-.0238),fog_seat(x+.004,half_height,-.0238)],
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
            _cord(name,"carPaint","Hemmed panel edge",
                  [skin(t if edge[0] is None else edge[0],t if edge[1] is None else edge[1],.011)
                   for t in _range(25)],.0045,SEDAN_PAINT)
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
        _panel(name,"carMetal","Satin bright rear garnish",25,5,
               lambda u,v:_end_point(False,blend(-.604,.604,u),blend(.657,.728,v),.010+.003*sin(pi*v)),
               rgb(0x999b9a),flip=True)
        _cord(name,"carMetal","Bright garnish lip",
               [_end_point(False,blend(-.548,.548,t),.728,.016) for t in _range(32)],.0034,SEDAN_CHROME)
        for i,letter in enumerate("SONATA"):
            _letter(name,"carMetal",letter,_end_point(False,(2.5-i)*.126,.678,.016),.038,SEDAN_CHROME,
                    right=(-1,0,0),rise=.00115)
        _letter(name,"carMetal","GVS",_end_point(False,-.514,.791,.012),.031,SEDAN_CHROME,right=(-1,0,0),rise=.0006)
        _badge(name,_end_point(False,0,.807,.015),.103,"z",SEDAN_CHROME,True)
        lathe(name,"carMetal","Trunk lock bezel",[(0,.012,.012),(.005,.013,.013),(.008,.010,.010)],
              SEDAN_CHROME,18,_end_point(False,-.428,.690,.015),axis="z")
        box(name,"plain","Deck lock keyway",_end_point(False,-.428,.690,.021),(.0034,.011,.002),SEDAN_BLACK)


def _lamp_sample(front,side,u,v):
    if front:
        # Edge positions obtained by projecting the outline of the photographed lens onto the fascia.
        span = blend(.502,.914,u)
        lower = _profile(((.502,.612),(.515,.588),(.549,.568),(.617,.561),(.720,.560),
                          (.795,.564),(.852,.578),(.883,.600),(.903,.638),(.914,.690)),span,1)
        upper = _profile(((.502,.620),(.511,.649),(.534,.687),(.586,.707),(.686,.716),
                          (.778,.723),(.847,.732),(.880,.731),(.901,.719),(.914,.695)),span,1)
        x = side*span
    else:
        lower = _profile(((0,.667),(.16,.662),(.68,.662),(.88,.671),(.97,.692),(1,.723)),u,1)
        upper = _profile(((0,.756),(.13,.833),(.33,.899),(.53,.917),(.69,.908),(.86,.868),
                          (.96,.805),(1,.731)),u,1)
        x = side*blend(.590,.877,u)
    y=blend(lower,upper,v)
    return x,y


def _lamp_cutout(front,side):
    edge=[_lamp_sample(front,side,u,v) for u,v in _panel_border(37,7)]
    cx,cy=_lamp_sample(front,side,.50,.50)
    return [(blend(cx,x,.973),blend(cy,y,.973)) for x,y in edge]


def _lamp_surface(front,side,u,v,depth):
    x,y=_lamp_sample(front,side,u,v)
    wrap=.092*smooth(.868,.914,abs(x)) if front else 0
    _,_,z=_end_point(front,x,y,-wrap)
    if front and wrap>0 and z<SEDAN_BODY[-1][0]:
        x=side*max(abs(x),abs(_side_height(side,z,y)[0])+.0012)
    normal_x=smooth(.822,.915,abs(x))*.72
    return (x+side*normal_x*depth,y,z+(1 if front else -1)*(1-normal_x*.66)*depth)


def _headlamp_lenses(name,surface,flip):
    def split(v):
        return .661+.089*v-.020*sin(pi*v)

    def pane(u,v):
        polish=.002+.014*(sin(pi*v)*sin(pi*u))**.5
        flutes=.00054*sin(tau*(39*u+.07*v))*sin(pi*u)**.52
        return surface(u,v,polish+flutes)

    def glass_color(p):
        x,y,_=p
        ramp=(abs(x)-.502)/.412
        reflectors=.105*cos(tau*(y*27-.56*ramp))+.041*cos(tau*y*69)
        wide_cup=.060*exp(-((ramp-.39)/.25)**2-((y-.651)/.041)**2)
        prism=.030*cos(tau*(y*121+ramp*7))
        return tone(rgb(0xc1ceca),.91+reflectors+wide_cup+prism)

    for amber,label,steps,color in (
        (False,"Fluted silver headlamp optic",100,glass_color),
        (True,"Curved amber corner optic",45,lambda p:tone(rgb(0xf09b13),
             .88+.073*cos(p[1]*440)+.029*cos(p[0]*535+p[1]*79))),
    ):
        def section(u,v):
            boundary=split(v)
            return pane(blend(boundary,1,u) if amber else blend(0,boundary,u),v)
        _panel(name,"carLens",label,steps,28,section,color,flip)
    _cord(name,"carLens","Fine seam between clear and amber optics",
          [pane(split(v),v) for v in _range(30)],.0007,rgb(0xa68f62),sides=4)


def _rear_lamp_lenses(name,surface,flip):
    def split(u):
        _,bottom=_lamp_sample(False,1,u,0)
        _,top=_lamp_sample(False,1,u,1)
        return max(.02,min(.98,(.736+.009*smooth(.64,1,u)-bottom)/(top-bottom)))

    def pane(u,v):
        polish=.002+.015*(sin(pi*v)*sin(pi*u))**.49
        _,y=_lamp_sample(False,1,u,v)
        texture=.00038*cos(y*920)*sin(pi*u)
        return surface(u,v,polish+texture)

    def lower(u,v):
        return pane(u,split(u)*v)

    _panel(name,"carLens","Red stop-lamp lens with horizontal ribs",82,36,
           lambda u,v:pane(u,blend(split(u),1,v)),
           lambda p:tone(rgb(0xdb2019),.91+.087*cos(p[1]*516)+.031*cos(p[0]*305)),flip)
    _panel(name,"carLens","Amber indicator with square prism cells",54,17,
           lambda u,v:lower(blend(.345,1,u),v),
           lambda p:tone(rgb(0xf6a11b),.92+.08*cos(p[1]*409)*cos(p[0]*539)+.028*cos(p[0]*268)),flip)
    for i in range(3):
        start=i/3+.029
        end=(i+1)/3-.030
        _panel(name,"carLens",f"Clear reversing lens rib {i+1}",24,5,
               lambda u,v:lower(blend(.028,.329,u),blend(start,end,v)),
               lambda p:tone(rgb(0xd2d7d0),.92+.098*cos(p[0]*721)+.041*cos(p[1]*698)),flip)
        if i<2:
            _panel(name,"carLens","Amber carrier between reversing lens ribs",20,3,
                   lambda u,v:lower(blend(.028,.329,u),blend(end,(i+1)/3+.029,v)),
                   rgb(0xe6a942),flip)
    _panel(name,"carLens","Narrow amber lens joint",3,19,lambda u,v:lower(blend(.329,.345,u),v),
           rgb(0xdd9024),flip)
    _cord(name,"carLens","Red lens molded lower bead",
          [lower(u,.018) for u in _range(50)],.0020,rgb(0xa3211c),sides=4)
    _cord(name,"carLens","Glazed edge between red and lower lenses",
          [pane(u,split(u)) for u in _range(50)],.00105,rgb(0xa62216),sides=4)


def _lamps():
    for front in (False,True):
        for side in (-1,1):
            suffix=_side_suffix(side,front)
            socket=_sedan_asset("lamp_socket_"+suffix)
            lens=_sedan_asset("lamp_"+suffix)
            def surface(u,v,depth):
                return _lamp_surface(front,side,u,v,depth)
            edge=_panel_border(42,8)
            flip=(side<0)==front
            _panel(socket,"plain","Deep lamp socket",32,17,
                   lambda u,v:surface(u,v,-.031),rgb(0x141819),flip)
            rows_mesh(socket,"plain","Lamp housing wall and perimeter seal",
                      [[surface(u,v,depth) for u,v in edge] for depth in (-.031,-.014,-.003,.002)],
                      rgb(0x151819),caps=False)
            _cord(socket,"plain","Thin black lamp gasket",[surface(u,v,.0017) for u,v in edge],
                  .0024,rgb(0x121718),closed=True,sides=5)
            for t,w,h in ((.264,.097,.072),(.55,.101,.079),(.81,.071,.059)):
                if not front:
                    w,h=w*.76,h*.83
                opening=_elliptic(w,h,.78,28)
                _,center_y=_lamp_sample(front,side,t,.53)
                def reflector(u,v,d):
                    across=max(.012,min(.988,t+u/(.412 if front else .287)))
                    _,bottom=_lamp_sample(front,side,across,0)
                    _,top=_lamp_sample(front,side,across,1)
                    height=max(.06,min(.94,(center_y+v-bottom)/(top-bottom)))
                    return surface(across,height,-.024+d)
                _bezel(socket,"carMetal","Shaped reflector behind lamp",opening,
                       reflector,
                       [(1,.002),(.96,0),(.74,-.009),(.33,-.019),(.22,-.023)],SEDAN_ALLOY,True)
            if front:
                _headlamp_lenses(lens,surface,flip)
            else:
                _rear_lamp_lenses(lens,surface,flip)
            rim=rgb(0xc3c7bb) if front else rgb(0xb3241b)
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
        # Heated rear glass keeps a warmer, narrow tint at each heater wire.
        wire = max(0,cos((p[2]-SEDAN_REAR_GLASS)*tau/.061))**22
        return _lerp(color,rgb(0x665748),wire*.46)
    return tint


def _roof_and_glazing():
    roof=_sedan_asset("roof")
    def roof_panel(u,v,drop=0):
        z=blend(*SEDAN_ROOF,v)
        y,w=_cabin(z)
        return ((2*u-1)*w,y+.018*sin(pi*u)**1.62-drop,z)
    _panel(roof,"carPaint","Crowned steel roof",36,42,roof_panel,SEDAN_PAINT,True)
    _panel(roof,"fabric","Felt headliner",16,20,lambda u,v:roof_panel(u,v,.034),rgb(0xa49a84))

    for front in (False,True):
        glass=_sedan_asset("windshield" if front else "back_glass")
        def pane(u,v):
            return _end_glass_point(front,u,v)
        _panel(glass,"carGlass","Compound curved laminated glass" if front else "Heated rear window",
               32,38 if not front else 24,pane,_green_glass(front),True)
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
        def midpillar(u,v):
            return _lerp(_side_glass_point(side,False,1,v),_side_glass_point(side,True,0,v),u)
        _panel(roof,"plain","Black B-pillar cover",7,24,midpillar,rgb(0x212324),flip=side>0)
        for front in (False,True):
            z0,z1 = (SEDAN_ROOF[0],-.365) if not front else (-.322,SEDAN_ROOF[1])
            def gutter(u,v):
                z=blend(z0,z1,u)
                y,x=_cabin(z)
                return (side*(x-.005*v),y-.023*v,z)
            _panel(roof,"carPaint","Painted roof edge over door glass",19,4,gutter,SEDAN_PAINT,flip=side<0)
        _cord(roof,"carLeather","Interior pillar trim",[_add(a_pillar(.46,t),(-side*.034,-.019,0))
              for t in _range(23)],.018,SEDAN_TRIM)
    _headliner_details(roof)

    name=_sedan_asset("wipers")
    box(name,"plain","Cowl air tray",(0,.933,.895),(1.48,.024,.086),SEDAN_BLACK,.010)
    for side in (-1,1):
        for i in range(16):
            x=side*(.17+i*.029)
            box(name,"gloss","Cowl ventilation slots",(x,.947,.912),(.009,.0026,.031),rgb(0x373a37),.001)
        def wiped(u,v):
            return _add(_end_glass_point(True,u,v),(0,.010,.016))
        at=wiped(.50+side*.251,.997)
        elbow=wiped(.51+side*.177,.938)
        blade=[wiped(blend(.50+side*.189-.127,.50+side*.189+.123,t),.928+.025*t)
               for t in _range(21)]
        lathe(name,"plain","Wiper spindle",[(0,.013,.013),(.009,.011,.011)],SEDAN_BLACK,14,at)
        _cord(name,"plain","Parked wiper arm",[at,elbow],.006,SEDAN_BLACK)
        _cord(name,"plain","Wiper blade with backbone",blade,.0065,rgb(0x262929))


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
    outline=_outline([(-.106,-.010),(-.093,.030),(-.034,.052),(.061,.045),(.116,.014),
                      (.111,-.025),(.068,-.047),(-.061,-.045)],4)
    def mirror(u,v,d):
        return (side*(1.021+u),.987+v+.09*u,.717+d+.16*u)
    _bezel(house,"carPaint",name+" contoured mirror cap",outline,mirror,
           [(1,-.004),(1,.027),(.91,.059),(.67,.084),(.35,.095)],SEDAN_PAINT,True)
    _bezel(house,"plain",name+" glass mount and dark cavity",outline,mirror,
           [(1,.007),(1,-.005),(.993,-.015),(.902,-.017),(.865,-.012)],SEDAN_BLACK,True)
    _bezel(glass,"carMetal",name+" convex reflecting glass",outline,mirror,
           [(.897,-.018),(.855,-.023),(.53,-.028)],rgb(0x879b9f),True)
    if side<0:
        _letter(glass,"gloss","OBJECTS IN MIRROR",mirror(.003,-.033,-.029),.0044,rgb(0xa9bbb9),
                right=(-1,0,0),rise=.00006)


def _inside_mirror():
    house=_sedan_asset("rearview_housing")
    glass=_sedan_asset("rearview_glass")
    outline=_outline([(-.135,-.022),(-.118,.031),(.114,.031),(.135,-.022),(.109,-.038),(-.108,-.038)],4)
    def view(u,v,d):
        return (u,1.201+v,.390+d-.15*v)
    _bezel(house,"plain","Day/night rearview shell",outline,view,
           [(.87,.029),(1,.013),(1,-.009),(.92,-.012),(.89,-.006)],SEDAN_BLACK,True)
    _bezel(glass,"carMetal","Separate rearview mirror glass",outline,view,
           [(.915,-.013),(.890,-.016)],rgb(0x9aabab),True)
    _cord(house,"plain","Windscreen mount",[(-.004,1.220,.417),(0,1.249,.420),(0,1.286,.427)],
          .014,rgb(0x313433),sides=12)
    box(house,"plain","Anti-glare toggle",(0,1.154,.406),(.051,.012,.026),SEDAN_BLACK,.006)
