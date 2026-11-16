"""Body, glazing, lamps and brightwork for the photographed EF Sonata."""

from math import atan2, copysign
from mathutils import Matrix


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
    shoulder = .011*exp(-((t-.80)/.13)**2)
    flare = .007*(1-smooth(.33,.53,distance))*(1-v)**5
    x = _width(z)+.012*sin(pi*t)-.083*(1-t)**2.8+shoulder+flare
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
        depth -= .145*exp(-((abs(across)-.66)/.233)**2)*smooth(.50,.79,v)
    else:
        depth = .199+.072*exp(-((v-.44)/.24)**2)-.025*smooth(.58,.70,v)
        x = edge_x*across
        depth -= .032*(1-smooth(.175,.207,abs(x)))*(1-smooth(.083,.111,abs(y-.438)))
    return (edge_x*across,y,z0+sign*depth*shoulder)


def _end_point(front,x,y,offset=0):
    """Place a fascia insert on the same stamped surface as the bumper."""
    v = .5
    for _ in range(4):
        edge = _end(front,1,v)[0]
        u = max(0,min(1,(x/edge+1)/2))
        lo, hi = _end(front,u,0)[1],_end(front,u,1)[1]
        v = max(0,min(1,(y-lo)/(hi-lo)))
    _, _, z = _end(front,u,v)
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


def _paint_tint(p):
    return tone(SEDAN_PAINT,.87+.13*smooth(.20,.54,p[1]))


def _body_shell():
    name = _sedan_asset("body_shell")
    for side in (-1,1):
        for front in (False,True):
            start = 1.021 if front else -1.280
            end = SEDAN_BODY[-1 if front else 0][0]
            _panel(name,"carPaint",("Front" if front else "Rear")+" quarter panel",48,16,
                   lambda u,v:_side(side,blend(start,end,u),v),_paint_tint,flip=(side>0)==front)
            _panel(name,"carPaint","Pressed fender shoulder",10,30,
                   lambda u,v:_deck(front,blend(0,.117,u) if side<0 else blend(.883,1,u),v),
                   SEDAN_PAINT,flip=front)
            axle = SEDAN_WHEELS[1 if front else 0]
            arc = [_side(side,axle+.366*cos(pi*t),0) for t in _range(39)]
            _cord(name,"plain","Rolled arch sealing flange",[_add(p,(-side*.026,-.005,0)) for p in arc],
                  .008,SEDAN_RUBBER)
            liner = [[(side*x, .309+.353*sin(pi*t), axle+.358*cos(pi*t)) for t in _range(33)]
                     for x in (.658,.784,.891)]
            rows_mesh(name,"plain","Inner wheel liner",liner,rgb(0x262725),caps=False,ring=False)
        _panel(name,"carPaint","Curved rocker below doors",31,5,
               lambda u,v:(side*(.809+.037*sin(pi*v*.7)),blend(.197,.253,v),blend(-1.075,1.041,u)),
               _paint_tint,flip=side>0)
        _cord(name,"plain","Continuous door aperture seal",
              [(side*.844,.246,z) for z in (-1.17,-.45,.29,1.02)],.015,SEDAN_RUBBER)
        fuel_z = -1.675
        if side>0:
            def fuel(x,y,depth):
                z=fuel_z+x
                skin_x,_,_=_side(side,z,max(.0,min(1,(.763+y-_side(side,z,0)[1])/(_belt(z)-_side(side,z,0)[1]))))
                return (skin_x+depth,.763+y,z)
            seal=_elliptic(.168,.142,.34,28)
            _bezel(name,"plain","Fuel door recess",seal,fuel,[(1,.002),(.92,.004)],SEDAN_BLACK)
            _bezel(name,"carPaint","Flush filler door",seal,fuel,[(.94,.005),(.86,.008)],SEDAN_PAINT,True)
        z = 1.071
        side_at = _side_height(side,z,.695)
        _pill(name,"plain","Front wing indicator gasket",_add(side_at,(side*.005,.004,0)),.082,.042,.012,
              SEDAN_RUBBER,"x",.76)
        _pill(name,"carLens","Amber repeater",_add(side_at,(side*.013,.004,0)),.066,.031,.012,
              rgb(0xdd8e16),"x",.75)

    _panel(name,"carPaint","One-piece rounded front bumper",65,29,lambda u,v:_end(True,u,v),_paint_tint)
    _panel(name,"carPaint","Rounded rear bumper and valance",65,22,lambda u,v:_end(False,u,v*.612),_paint_tint,flip=True)
    for limit in ((0,.116),(.884,1)):
        _panel(name,"carPaint","Rear corner above bumper",12,18,
               lambda u,v:_end(False,blend(*limit,u),blend(.616,1,v)),_paint_tint,flip=True)
    _cord(name,"plain","Bumper to quarter-panel seam",
          [_end(False,t,.614) for t in _range(84)],.003,rgb(0x101212))

    def face(front,x,y):
        return lambda u,v,offset:_end_point(front,x+u,y+v,offset)
    grille = _outline([(-.392,.020),(-.362,.062),(-.261,.074),(0,.078),(.261,.074),
                       (.362,.062),(.392,.020),(.370,-.040),(.302,-.056),(0,-.060),
                       (-.302,-.056),(-.370,-.040)],4)
    project_grille = face(True,0,.636)
    _bezel(name,"plain","Deep black grille insert",grille,project_grille,
           [(1,.006),(.956,.010),(.90,.012)],rgb(0x111517),True)
    _bezel(name,"plain","Painted dark grille perimeter",grille,project_grille,
           [(1,.007),(1,.017),(.959,.021),(.944,.016)],rgb(0x16191a))
    for i in range(-6,7):
        x=i*.053
        height = 1-.25*(x/.355)**4
        def slat(u,v,tip=0):
            y=.640+height*blend(-.043,.063,v)
            bend=.015*(1-v)-.017*sin(pi*v)
            inner=x+bend+(u-.5)*(.019+.005*v)
            return _end_point(True,inner,y,.016+.017*sin(pi*v)+tip)
        _panel(name,"plain","Black vertical radiator fin",3,10,slat,rgb(0x202325))
        if i%2==0:
            _panel(name,"carMetal","Silver fin leading face",3,10,
                   lambda u,v:slat(blend(.37,.96,u),blend(.57 if i==0 else .04,.97,v),.004),SEDAN_CHROME)
    _badge(name,_end_point(True,0,.635,.043),.096,"z",SEDAN_CHROME)

    lower = _elliptic(.862,.125,.43,38)
    _bezel(name,"plain","Recessed lower air inlet",lower,face(True,0,.325),
           [(1,.003),(.952,.008),(.89,.010)],rgb(0x060708),True)
    for y in (.304,.337):
        _cord(name,"plain","Set-back horizontal intake vane",[_end_point(True,blend(-.363,.363,t),y,.012)
              for t in _range(32)],.0026,rgb(0x171919))
    for side in (-1,1):
        fog=_elliptic(.212,.073,.46,30)
        _bezel(name,"plain","Inset fog light surround",fog,face(True,side*.595,.330),[(1.15,.006),(1.04,.013)],SEDAN_BLACK)
        _bezel(name,"carLens","Ribbed clear fog lamp",fog,face(True,side*.595,.330),
               [(1,.012),(.92,.019),(.73,.021)],rgb(0x9da7a4),True)
        for i in range(10):
            x=side*.595+(i-4.5)*.014
            _cord(name,"carMetal","Fog lens reflector flute",
                  [_end_point(True,x,.314,.022),_end_point(True,x+.005,.342,.022)],.00085,SEDAN_ALLOY)
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
        _panel(name,"carPaint","Decklid vertical face",29,12,
               lambda u,v:_add(_end(False,blend(.119,.881,u),blend(.619,1,v)),(0,0,-.003)),
               SEDAN_PAINT,flip=True)
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
        lower = _profile(((0,.685),(.15,.666),(.65,.664),(.90,.675),(1,.713)),u,1)
        upper = _profile(((0,.759),(.14,.848),(.38,.901),(.57,.915),(.78,.881),(.92,.816),(1,.724)),u,1)
        x = side*blend(.590,.877,u)
    y=blend(lower,upper,v)
    return x,y


def _lamps():
    for front in (False,True):
        for side in (-1,1):
            suffix=_side_suffix(side,front)
            socket=_sedan_asset("lamp_socket_"+suffix)
            lens=_sedan_asset("lamp_"+suffix)
            def lamp(u,v,depth):
                x,y=_lamp_sample(front,side,u,v)
                if front:
                    depth += .006*smooth(.46,.90,u)
                    depth -= .094*smooth(.868,.914,abs(x))
                else:
                    depth += .010*(1-smooth(.73,1,u))
                p = _end_point(front,x,y,depth)
                if front and p[2]<SEDAN_BODY[-1][0]:
                    # Seat the outer lens just outside the adjoining wing.
                    outer = abs(_side_height(side,p[2],y)[0])+.003
                    p = (side*max(abs(x),outer), y, p[2])
                return p
            def edge():
                return ([lamp(t,0,.012) for t in _range(32)]+[lamp(1,t,.012) for t in _range(7)][1:]+
                        [lamp(1-t,1,.012) for t in _range(32)][1:]+[lamp(0,1-t,.012) for t in _range(7)][1:-1])
            flip=(side<0)==front
            _panel(socket,"plain","Recessed dual lamp housing",30,13,lambda u,v:lamp(u,v,.006),SEDAN_BLACK,flip)
            _cord(socket,"plain","Narrow lens gasket",edge(),.005,SEDAN_RUBBER,closed=True)
            for t in (.29,.59,.83):
                x,y,_=lamp(t,.50,.008)
                outline=_elliptic(.079 if front else .059,.072,.83,20)
                _bezel(socket,"carMetal","Aluminized reflector cup",outline,
                       lambda u,v,d:_end_point(front,x+u,y+v,.005+d),
                       [(1,.003),(.64,.001),(.22,-.005),(.08,-.008)],SEDAN_ALLOY,True)
            def glass(u,v):
                return lamp(u,v,.013+.016*sin(pi*v)*sin(pi*u)**.6)
            def tint(p,front=front):
                x,y,_=p
                start,width=(.502,.412) if front else (.590,.287)
                u=(abs(x)-start)/width
                if front:
                    base=rgb(0xe9a12c) if u>=.705 else rgb(0xcbd3cd)
                    ribs=.067*cos(u*81*pi)+.026*cos(y*340)
                    bands=.10*exp(-((y-blend(.605,.686,u))/.013)**2)*(1-smooth(.67,.73,u))
                    fiber=.92+ribs-bands
                else:
                    base=rgb(0xd0241e) if y>.734+u*.005 else rgb(0xc4c9bf if u<.31 else 0xec9c12)
                    fiber=.92+.071*cos(y*422)+.031*cos(u*149)*cos(y*238)
                return tone(base,fiber)
            limits=[(0,.703),(.705,1)] if front else [(0,1)]
            for i,(a,b) in enumerate(limits):
                _panel(lens,"carLens",("Clear ribbed lens" if i==0 else "Amber turn signal"),
                       52 if i==0 else 18,25,lambda u,v:glass(blend(a,b,u),v),tint,flip,
                       uv=lambda p:(abs(p[0])*34,p[1]*22))
            _cord(lens,"carLens","Co-molded lens edge",edge(),.0015,rgb(0x777c75),closed=True)


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
        _cord(roof,"carPaint","Gutter above doors",rim,.006,SEDAN_PAINT)
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
            return _add(_lerp(outer,inner,u),(side*.026*sin(pi*u)*sin(pi*v)**.5,.010*sin(pi*u),0))
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
        _cord(roof,"carLeather","Interior pillar trim",[_add(a_pillar(.46,t),(-side*.027,-.012,0))
              for t in _range(23)],.024,SEDAN_TRIM)
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
                return _side(side,blend(lo,hi,u),v)
            _panel(name,"carPaint","Curved door skin",43,22,skin,_paint_tint,flip=side>0)
            boundary=([skin(t,0) for t in _range(22)]+[skin(1,t) for t in _range(14)][1:]+
                      [skin(1-t,1) for t in _range(22)][1:]+[skin(0,1-t) for t in _range(14)][1:-1])
            _cord(name,"plain","Stamped edge shadow",[_add(p,(-side*.013,0,0)) for p in boundary],
                  .006,SEDAN_BLACK,closed=True)
            _cord(name,"carPaint","Door shell return",[_add(p,(-side*.029,.003,0)) for p in boundary],
                  .008,SEDAN_PAINT,closed=True)
            z=lo+(.180 if front else .177)
            x,y,_=_side_height(side,z,.811 if front else .833)
            recess=_elliptic(.212,.066,.75,36)
            def pull(u,v,d):
                return (x+side*(d-.009*(u/.105)**2),y+v,z+u)
            grip={
                "pull":pull(0,.006,.025),
                "release":(side*.749,_belt((lo+hi)/2)-.155,hi-.16),
                "lock":(side*.844,_belt(lo+.293)+.020,lo+.293),
            }
            ASSETS[name]["anchors"]={key:_add(at,_scale(pivot,-1)) for key,at in grip.items()}
            ASSETS[name]["anchors"]["hinge"]=pivot
            _bezel(name,"plain","Exterior pull pocket",recess,pull,
                   [(1,.002),(.95,.006),(.83,.008)],rgb(0x171a1b),True)
            _bezel(name,"carPaint","Painted pull handle",_elliptic(.170,.033,.65,32),
                   lambda u,v,d:pull(u,v+.005,d),[(.96,.012),(1,.021),(.84,.026)],SEDAN_PAINT,True)
            _cord(name,"carMetal","Exterior handle bright edge",
                  [pull(blend(-.073,.070,t),.017+sin(pi*t)*.004,.026) for t in _range(21)],
                  .0019,SEDAN_CHROME)
            if front:
                _pill(name,"carMetal","Front door lock cylinder",pull(-.070,-.001,.027),.014,.018,.006,SEDAN_ALLOY,"x")
                _pill(name,"plain","Door keyway",pull(-.070,-.001,.031),.003,.009,.001,SEDAN_BLACK,"x")
            molding=[]
            for t in _range(33):
                z=blend(lo+(.035 if front else .213),hi-(.173 if front else .031),t)
                height=.559-.013*z-.006*abs(2*t-1)**8
                x,y,_=_side_height(side,z,height)
                molding.append((x+side*.002,y,z))
            _cord(name,"plain","Flush bodyside rub strip",molding,.009,SEDAN_RUBBER)
            _cord(name,"carMetal","Trim inset",[_add(p,(side*.008,.004,0)) for p in molding],
                  .0028,SEDAN_CHROME)
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
