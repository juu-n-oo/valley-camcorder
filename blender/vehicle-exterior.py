"""Body, glazing, lamps and brightwork for the photographed EF Sonata."""

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
        fender_crown=.038*exp(-((abs(across)-.840)/.109)**2)*(1-smooth(.945,1,abs(across)))
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


def _badge(name,at,width,axis,color,reverse=False):
    """Beveled oval and tapered, connected strokes traced from the deck emblem."""
    sign = -1 if reverse else 1

    def point(u,v,d):
        xyz = (u*sign*width,v*width,d*width*sign) if axis=="z" else (u*sign*width,d*width,-v*width)
        return _add(at,xyz)

    ring=_elliptic(1,.490,1,60)
    _bezel(name,"carMetal","Beveled oval insignia",ring,point,
           [(1,-.015),(1,.004),(.982,.018),(.955,.020),(.919,.009),(.912,-.010)],color)
    emblem=_outline([(-.341,-.148),(-.292,-.057),(-.241,.023),(-.169,.144),
                     (-.149,.220),(-.053,.224),(-.105,.125),(-.120,.084),
                     (-.111,.059),(-.082,.050),(-.023,.058),(.067,.091),(.110,.124),
                     (.149,.212),(.230,.201),(.221,.164),(.178,.075),(.127,-.018),
                     (.075,-.111),(.060,-.223),(-.032,-.231),(.005,-.143),
                     (.017,-.092),(-.003,-.066),(-.041,-.069),(-.108,-.093),
                     (-.167,-.131),(-.222,-.184),(-.255,-.200)],3)
    _bezel(name,"carMetal","Connected slanted H insignia",emblem,point,
           [(1,-.013),(1,.002),(.984,.015),(.959,.020)],color,True)


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
            girth=(.028 if bright else .012)*blend(.74,1,smooth(0,.42,v))
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
                y=blend(.735 if i==0 else .047,.947,v)
                return slat(blend(.118,.882,u),y,.0019-.0012*edge**3)
            _panel(name,"carMetal","Beveled chrome grille insert",8,22,brightwork,SEDAN_CHROME)
    emblem_seat=_bezel(name,"plain","Oval grille emblem seat",_elliptic(.103,.051,1,50),
                      lambda u,v,d:_end_point(True,u,.617+v,d),
                      [(.79,-.045),(.972,-.022),(.973,-.013)],rgb(0x0a0c0d),True)
    emblem_seat["finish_override"]="Grille plastic"
    _badge(name,_end_point(True,0,.617,-.008),.099,"z",SEDAN_CHROME)

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
        _panel(name,"carMetal","Satin bright rear garnish",25,5,
               lambda u,v:_end_point(False,blend(-.604,.604,u),blend(.657,.728,v),.010+.003*sin(pi*v)),
               rgb(0x999b9a),flip=True)
        _cord(name,"carMetal","Bright garnish lip",
               [_end_point(False,blend(-.548,.548,t),.728,.016) for t in _range(32)],.0034,SEDAN_CHROME)
        def on_garnish(x,y,z):
            crown=.003*sin(pi*(y-.657)/.071)
            return _end_point(False,x,y,.0114+crown-z)
        for i,letter in enumerate("SONATA"):
            _letter(name,"carMetal",letter,((2.5-i)*.126,.679,0),.039,SEDAN_CHROME,
                    right=(-1,0,0),rise=.00115,width=.67,project=on_garnish)
        _letter(name,"carMetal","GVS",(-.514,.805,0),.031,SEDAN_CHROME,right=(-1,0,0),rise=.0006,
                width=.77,project=lambda x,y,z:_end_point(False,x,y,.0043-z))
        _badge(name,_end_point(False,0,.807,.015),.103,"z",SEDAN_CHROME,True)
        lathe(name,"carMetal","Trunk lock bezel",[(0,.012,.012),(.005,.013,.013),(.008,.010,.010)],
              SEDAN_CHROME,18,_end_point(False,-.428,.690,.015),axis="z")
        box(name,"plain","Deck lock keyway",_end_point(False,-.428,.690,.021),(.0034,.011,.002),SEDAN_BLACK)


# Inner-to-outer sections on the fender, from the full and close reference views.
# The cosine parameter keeps the lens corners round at the front-facing ends.
_LAMP_SPANS = {True:(.5135,.9102),False:(.587,.872)}
_LAMP_EDGES = {
    True: (
        (0,.595,.599),(.025,.578,.637),(.09,.563,.670),(.17,.556,.697),(.29,.554,.718),
        (.44,.558,.739),(.60,.561,.755),(.73,.567,.764),(.84,.579,.766),
        (.93,.606,.759),(.976,.645,.726),(1,.678,.684),
    ),
    False: (
        (0,.663,.765),(.038,.658,.788),(.09,.655,.815),(.17,.655,.853),(.29,.657,.885),
        (.44,.660,.909),(.60,.662,.920),(.73,.663,.911),(.84,.665,.882),
        (.93,.674,.833),(.976,.704,.783),(1,.740,.750),
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


def _lamp_cutout(front,side):
    edge=[_lamp_sample(front,side,u,v) for u,v in _panel_border(37,7)]
    cx,cy=_lamp_sample(front,side,.50,.50)
    return [(blend(cx,x,.973),blend(cy,y,.973)) for x,y in edge]


def _lamp_surface(front,side,u,v,depth):
    x,y=_lamp_sample(front,side,u,v)
    wrap=.088*smooth(.876,.919,abs(x)) if front else 0
    _,_,z=_end_point(front,x,y,-wrap)
    if front and wrap>0 and z<SEDAN_BODY[-1][0]:
        x=side*max(abs(x),abs(_side_height(side,z,y)[0])+.0012)
    normal_x=smooth(.822,.915,abs(x))*.72
    return (x+side*normal_x*depth,y,z+(1 if front else -1)*(1-normal_x*.66)*depth)


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
        return _profile(((0,.637),(.132,.632),(.335,.631),(.445,.636),
                         (.573,.647),(.692,.667),(.805,.692),(.902,.731),(1,.761)),v,1)

    def lens_depth(u,v):
        return .003+.018*(sin(pi*v)*sin(pi*u))**.52

    def pane(u,v):
        flute=.00021*sin(tau*(53*u-.40*(v-.43)**2))*sin(pi*u)**.54
        return surface(u,v,lens_depth(u,v)+flute)

    def silver(p):
        u,v=_lens_uv(True,p)
        slant=v+.33*(u-.43)**2
        bands=.127*exp(-((slant-.173)/.065)**2)-.164*exp(-((slant-.28)/.064)**2)
        bands+=.116*exp(-((slant-.56)/.11)**2)-.235*exp(-((slant-.77)/.113)**2)
        prism=.085*cos(tau*(53*u-.40*(v-.43)**2))*(.47+.53*sin(pi*v))
        return tone(rgb(0xbfc9c6),.94+bands+prism)

    def amber(p):
        u,v=_lens_uv(True,p)
        prism=.11*cos(tau*(56*u+.29*v))+.084*cos(tau*(10*v+.52*u))
        glint=.21*exp(-((v-.28)/.17)**2)
        return tone(rgb(0xf5a70c),.91+prism+glint)

    for label,tint,columns,color in (
        ("Fluted clear headlight cover","Clear",110,silver),
        ("Wraparound amber signal cover","Amber",68,amber),
    ):
        def across(u,v):
            edge=split(v)
            return blend(edge,1,u) if tint=="Amber" else blend(0,edge,u)

        _optical_panel(name,label,tint,columns,32,lambda u,v:pane(across(u,v),v),color,flip)

        def reflector(u,v):
            u=blend(.021,.996,u)
            v=blend(.018,.982,v)
            x=across(u,v)
            cup=sin(pi*u)**.77*sin(pi*v)**.70
            if tint=="Clear":
                cup*=.5+.5*cos(tau*(v-.22))**2
            facet=(.5+.5*cos(tau*(33*u+.28*v)))**4
            return surface(x,v,lens_depth(x,v)-.005-.024*cup-.0034*facet)

        reflector_part=_panel(socket,"carMetal",tint+" pressed and faceted headlamp reflector",
                              92 if tint=="Clear" else 64,32,reflector,color,flip)
        if tint=="Amber":
            reflector_part["finish_override"]="Amber reflector"
    _cord(name,"carLens","Molded clear to amber lens join",
          [pane(split(v),v) for v in _range(41)],.00063,rgb(0xb89863),sides=4)


def _rear_lamp_lenses(socket,name,surface,flip):
    def split(u):
        _,bottom=_lamp_sample(False,1,u,0)
        _,top=_lamp_sample(False,1,u,1)
        y=.733+.009*smooth(.70,1,u)
        return max(.025,min(.975,(y-bottom)/(top-bottom)))

    def lens_depth(u,v):
        return .003+.016*(sin(pi*v)*sin(pi*u))**.50

    def pane(u,v,offset=0):
        return surface(u,v,lens_depth(u,v)+offset)

    def lower(u,v,offset=0):
        return pane(u,split(u)*v,offset)

    arch_profile=((0,.52),(.0456,.7724),(.1036,.8606),(.1781,.8901),(.2722,.9061),
                  (.3624,.9228),(.4589,.9216),(.551,.9018),(.6347,.8858),(.7071,.8733),
                  (.7688,.8517),(.8171,.8114),(.8495,.734),(.8724,.6262),(.895,.4871),(.916,.3556),(1,.18))

    def arch(u):
        _,base=_lamp_sample(False,1,u,0)
        _,top=_lamp_sample(False,1,u,1)
        return blend(base,top,max(split(u),_profile(arch_profile,u,1)))

    def red(p):
        u,v=_lens_uv(False,p)
        y=p[1]
        border=arch(u)
        thin=.20*exp(-((y-border)/.0019)**2)
        outer=.25*smooth(border-.001,border+.016,y)+.09*smooth(.765,.945,u)
        groove=.060*cos(tau*(y*74+.28*u))+.034*cos(tau*y*164)
        return tone(rgb(0xd8180f),.94-outer-thin+groove)

    def amber(p):
        u,v=_lens_uv(False,p)
        cell=cos(tau*(u*36+.26*v))*cos(tau*(p[1]*125))
        rail=.12*cos(tau*p[1]*227)*smooth(.76,.99,u)
        return tone(rgb(0xfc9c0d),.93+.15*cell+rail-.12*smooth(.83,1,u))

    _optical_panel(name,"Red stop lamp cover and side return","Red",96,40,
                   lambda u,v:pane(u,blend(split(u),1,v)),red,flip)
    _optical_panel(name,"Amber return and stepped prism cover","Amber",78,23,
                   lambda u,v:lower(blend(.327,1,u),v),amber,flip)

    def stop_reflector(u,v):
        u=blend(.011,.908,u)
        _,bottom=_lamp_sample(False,1,u,0)
        _,top=_lamp_sample(False,1,u,1)
        y=blend(bottom+(top-bottom)*split(u),arch(u),v)
        stripe=.00047*cos(tau*y*128)
        return pane(u,(y-bottom)/(top-bottom),-.0052-.008*sin(pi*v)+stripe)

    stop_back=_panel(socket,"carMetal","Recessed arcuate red stop-lamp reflector",88,48,stop_reflector,
                     lambda p:tone(rgb(0xe83723),.92+.076*cos(tau*p[1]*83)),flip)
    stop_back["finish_override"]="Red reflector"
    red_back=_panel(socket,"carMetal","Red wraparound return backing",60,24,
                    lambda u,v:pane(u,blend(split(u),1,v),-.013),rgb(0xaa2419),flip)
    red_back["finish_override"]="Red reflector"
    amber_back=_panel(socket,"carMetal","Wraparound amber lens reflector prisms",76,24,
                      lambda u,v:lower(blend(.328,.978,u),blend(.06,.95,v),
                                        -.0059-.0017*cos(tau*24*u)*cos(tau*9*v)),amber,flip)
    amber_back["finish_override"]="Amber reflector"

    frame=[(0,0),(.327,0),(.327,1),(0,1)]
    cutouts=[]
    for i in range(3):
        start=.070+i*.298
        stop=start+.222
        cutouts.append([(.026,start),(.306,start),(.306,stop),(.026,stop)])
        def reverse_prism(p):
            return tone(rgb(0xbdc1ba),.89+.20*cos(tau*p[0]*169)+.16*cos(tau*p[1]*132+p[0]*29))
        _optical_panel(name,f"Clear reverse lamp bar {i+1}","Clear",55,9,
                       lambda u,v:lower(blend(.026,.306,u),blend(start,stop,v),.0009),
                       reverse_prism,flip)
        _panel(socket,"carMetal","Faceted silver reverse-lamp insert",50,9,
               lambda u,v:lower(blend(.027,.305,u),blend(start,stop,v),
                                 -.0016-.0021*cos(tau*u*15)*sin(pi*v)),reverse_prism,flip)
    _perforated_surface(name,"carLens","Amber frame with three reverse bar openings",frame,cutouts,
                        [(u,v) for u in (.011,.317) for v in _range(24) if 0<v<1],
                        lambda u,v:lower(u,v,-.00015),rgb(0xbb700b),flip)

    _cord(name,"carLens","Red molded bottom lens bead",
          [lower(u,.015) for u in _range(61)],.0024,rgb(0x9e1511),sides=5)
    _cord(name,"carLens","Red to amber glass joint",
          [pane(u,split(u)) for u in _range(62)],.00125,rgb(0xa20e08),sides=5)


def _lamps():
    for front in (False,True):
        for side in (-1,1):
            suffix=_side_suffix(side,front)
            socket=_sedan_asset("lamp_socket_"+suffix)
            lens=_sedan_asset("lamp_"+suffix)
            def surface(u,v,depth):
                return _lamp_surface(front,side,u,v,depth)
            edge=_panel_border(66,12)
            flip=(side<0)==front
            _panel(socket,"plain","Deep lamp socket",32,17,
                   lambda u,v:surface(u,v,-.031),rgb(0x141819),flip)
            rows_mesh(socket,"plain","Lamp housing wall and perimeter seal",
                      [[surface(u,v,depth) for u,v in edge] for depth in (-.031,-.014,-.003,.002)],
                      rgb(0x151819),caps=False)
            _cord(socket,"plain","Thin black lamp gasket",[surface(u,v,.0017) for u,v in edge],
                  .0024,rgb(0x121718),closed=True,sides=5)
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
