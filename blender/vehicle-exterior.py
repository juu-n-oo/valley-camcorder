"""Body, glazing, lamps and brightwork for the photographed EF Sonata."""

from math import atan2, copysign
from mathutils import Matrix


SEDAN_BODY = (
    (-2.04,.877,.817,.253),(-1.85,.898,.867,.232),(-1.54,.912,.910,.216),
    (-1.28,.909,.932,.207),(-.62,.893,.928,.198),(-.23,.897,.920,.194),
    (.21,.895,.916,.194),(.67,.899,.915,.204),(1.03,.910,.907,.210),
    (1.40,.910,.884,.223),(1.73,.897,.842,.232),(2.015,.868,.785,.253),
)
SEDAN_CABIN = (
    (-1.374,.921,.822),(-1.208,1.067,.789),(-1.015,1.228,.743),
    (-.799,1.361,.699),(-.592,1.425,.666),(-.348,1.452,.654),
    (-.063,1.454,.658),(.197,1.438,.673),(.400,1.393,.702),
    (.562,1.311,.729),(.761,1.151,.775),(.937,1.002,.819),(1.044,.922,.845),
)
SEDAN_PAINT = (1.0,1.0,1.0)
SEDAN_CHROME = rgb(0xc9d0d2)
SEDAN_ALLOY = rgb(0xafb4b2)
SEDAN_BLACK = rgb(0x16191a)
SEDAN_RUBBER = rgb(0x252729)
SEDAN_TRIM = rgb(0x77786f)
SEDAN_LEATHER = rgb(0xc5b69a)
SEDAN_WALNUT = rgb(0x77422a)
SEDAN_CARPET = rgb(0x6d6656)
SEDAN_PAINTS = {"Obsidian black":rgb(0x141719),"Pearl white":rgb(0xe9e8df),"Silver grey":rgb(0x8b9297)}
SEDAN_WHEELS = (-1.405,1.405)
SEDAN_DOORS = {True:(-.211,1.011),False:(-1.229,-.245)}
SEDAN_HOOD = (0,.968,1.053)
SEDAN_TRUNK = (0,.944,-1.360)


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
    arch = .270+.408*sqrt(max(0,1-(distance/.398)**2))
    bottom = max(_profile(SEDAN_BODY,z,3),arch*(1-smooth(.377,.419,distance)))
    crease = .014*exp(-((v-.88)/.086)**2)-.011*exp(-((v-.20)/.13)**2)
    flare = .014*(1-smooth(.35,.57,distance))*(1-v)**4
    x = _width(z)+.032*sin(pi*v)-.062*(1-v)**3+crease+flare
    return (side*x,blend(bottom,_belt(z),v),z)


def _end(front,u,v):
    across = 2*u-1
    sign = 1 if front else -1
    z0 = 2.015 if front else -2.04
    edge_x, edge_y, _ = _side(1,z0,v)
    lower, upper = (.232,.754) if front else (.230,.849)
    y = blend(blend(lower,upper,v),edge_y,abs(across)**2)
    shoulder = (1-abs(across)**2.80)**.66
    roundness = .053*exp(-((v-.36)/.19)**2)-.012*exp(-((v-.62)/.08)**2)
    return (edge_x*across,y,z0+sign*((.301 if front else .295)+roundness)*shoulder)


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
    z = blend(1.037 if front else -1.356,z_end,v)
    across = u*2-1
    x = blend(across*_side(1,z,1)[0],x_end,smooth(.78,1,v))
    shoulder = (1-across*across)*(.048 if front else .029)
    ribs = .008*exp(-((abs(across)-.57)/.086)**2)*sin(pi*v)
    return (x,blend(_belt(z)+shoulder+ribs,y_end,smooth(.60,1,v)),z)


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
            start = 1.025 if front else -1.243
            end = 2.015 if front else -2.04
            _panel(name,"carPaint",("Front" if front else "Rear")+" quarter panel",29,12,
                   lambda u,v:_side(side,blend(start,end,u),v),_paint_tint,flip=(side>0)==front)
            _panel(name,"carPaint","Pressed fender shoulder",6,19,
                   lambda u,v:_deck(front,blend(0,.137,u) if side<0 else blend(.863,1,u),v),
                   SEDAN_PAINT,flip=front)
            axle = 1.405 if front else -1.405
            arc = [_side(side,axle+.410*cos(pi*t),0) for t in _range(35)]
            _cord(name,"plain","Rolled arch sealing flange",[_add(p,(-side*.023,-.006,0)) for p in arc],
                  .014,SEDAN_RUBBER)
            liner = [[(side*x, .309+.358*sin(pi*t), axle+.395*cos(pi*t)) for t in _range(26)]
                     for x in (.655,.813,.892)]
            rows_mesh(name,"plain","Inner wheel liner",liner,rgb(0x262725),caps=False,ring=False)
        _panel(name,"carPaint","Curved rocker below doors",31,5,
               lambda u,v:(side*(.801+.078*sin(pi*v*.75)),blend(.165,.262,v),blend(-1.067,1.008,u)),
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
        z = 1.721
        side_at = _side(side,z,.75)
        _pill(name,"plain","Front wing indicator gasket",_add(side_at,(side*.005,.004,0)),.112,.057,.014,
              SEDAN_RUBBER,"x",.76)
        _pill(name,"carLens","Amber repeater",_add(side_at,(side*.015,.004,0)),.091,.040,.014,
              rgb(0xc9902e),"x",.75)

    _panel(name,"carPaint","One-piece rounded front bumper",43,20,lambda u,v:_end(True,u,v),_paint_tint)
    _panel(name,"carPaint","Rounded rear bumper and valance",43,16,lambda u,v:_end(False,u,v*.67),_paint_tint,flip=True)
    for limit in ((0,.136),(.864,1)):
        _panel(name,"carPaint","Rear corner above bumper",12,12,
               lambda u,v:_end(False,blend(*limit,u),blend(.67,1,v)),_paint_tint,flip=True)

    def face(front,x,y):
        return lambda u,v,offset:_end_point(front,x+u,y+v,offset)
    grille = _elliptic(.694,.150,.53,34)
    _bezel(name,"plain","Deep black radiator grille",grille,face(True,0,.669),[(1,.008),(.94,.021)],SEDAN_BLACK,True)
    _bezel(name,"carMetal","Thin bright grille perimeter",grille,face(True,0,.669),
           [(1,.021),(.995,.028),(.940,.031),(.927,.023)],SEDAN_CHROME)
    for i in range(-4,5):
        x=i*.071
        def slat(u,v):
            y=blend(.611+.015*(x/.32)**2,.729-.013*(x/.32)**2,v)
            inner=x+(u-.5)*(.014+.006*v)+x*.15*(1-v)
            return _end_point(True,inner,y,.023+.014*sin(pi*v))
        _panel(name,"carMetal","Curved grille slat",3,8,slat,SEDAN_CHROME)
    _badge(name,_end_point(True,0,.662,.046),.097,"z",SEDAN_CHROME)

    lower = _elliptic(.807,.145,.49,34)
    _bezel(name,"plain","Lower central opening",lower,face(True,0,.318),[(1,.008),(.92,.013)],SEDAN_BLACK,True)
    for y in (.289,.315,.337):
        _cord(name,"plain","Recessed intake vane",[_end_point(True,blend(-.362,.362,t),y,.018)
              for t in _range(22)],.0053,rgb(0x323637))
    for side in (-1,1):
        fog=_elliptic(.205,.077,.52,24)
        _bezel(name,"plain","Fog light surround",fog,face(True,side*.591,.328),[(1.18,.012),(1.07,.020)],SEDAN_BLACK)
        _bezel(name,"carLens","Ribbed clear fog lamp",fog,face(True,side*.591,.328),
               [(1,.019),(.90,.028),(.76,.031)],rgb(0xa6b4b3),True)
        for i in range(10):
            x=side*.591+(i-4.5)*.014
            _cord(name,"carMetal","Fog lens reflector flute",
                  [_end_point(True,x,.310,.032),_end_point(True,x+.005,.343,.032)],.00085,SEDAN_ALLOY)
    for y,z in ((.432,2.361),(.467,-2.379)):
        box(name,"plain","Existing plate mounting recess",(0,y,z),(.380,.188,.013),SEDAN_RUBBER,.006)
        for side in (-1,1):
            lathe(name,"carMetal","Plate mounting screw",[(-.003,.005,.005),(.003,.005,.005)],
                  SEDAN_ALLOY,10,(side*.155,y+.065,z),axis="z")
    _cord(name,"plain","Backbox outlet pipe",catmull([(-.500,.173,-1.686),(-.533,.170,-1.932),
          (-.562,.177,-2.092),(-.567,.191,-2.242)],4),.027,rgb(0x373936),sides=12)
    lathe(name,"carMetal","Rolled exhaust tip",[(-.030,.027,.029),(0,.032,.034),(.028,.031,.033),(.028,.023,.026)],
          rgb(0x7e8584),22,(-.569,.192,-2.224),axis="z",caps=False)
    box(name,"plain","Recessed underbody floor pan",(0,.166,-.05),(1.32,.080,3.77),SEDAN_BLACK,.028)


def _lids():
    for front in (False,True):
        key="hood" if front else "trunk_lid"
        name=_sedan_asset(key,SEDAN_HOOD if front else SEDAN_TRUNK)
        def skin(u,v,drop=0):
            x,y,z=_deck(front,blend(.140,.860,u),v)
            return (x,y+.002-drop,z)
        _panel(name,"carPaint","Crowned outer panel",24,26,skin,SEDAN_PAINT,flip=front)
        _panel(name,"carPaint","Pressed inner shell",20,18,lambda u,v:skin(u,v,.020),
               rgb(0xb2b1ae),flip=not front)
        for edge in ((0,None),(1,None),(None,0),(None,1)):
            _cord(name,"carPaint","Hemmed panel edge",
                  [skin(t if edge[0] is None else edge[0],t if edge[1] is None else edge[1],.011)
                   for t in _range(21)],.009,SEDAN_PAINT)
        _panel(name,"fabric","Molded underside insulation",11,15,
               lambda u,v:skin(blend(.12,.88,u),blend(.13,.82,v),.027),rgb(0x333435),flip=not front)
        for side in (-1,1):
            _cord(name,"carPaint","Stamped reinforcement rib",
                  [skin(.5+side*blend(.109,.383,t),blend(.09,.94,t),.033) for t in _range(20)],
                  .013,rgb(0x8f9192))
            hinge_z=1.065 if front else -1.385
            _cord(name,"carMetal","Hinge arm",catmull([(side*.487,.822,hinge_z),
                   (side*.487,.862,hinge_z+(.105 if front else -.21)),
                   (side*.469,.901,hinge_z+(.260 if front else -.36))]),
                   .013,rgb(0x666c69))
        if front:
            _bezel(name,"carMetal","Bonnet latch staple",_elliptic(.074,.032,.55,20),
                   lambda x,y,t:_add(_deck(True,.5,.91),(x,y-.049,t)),
                   [(1,-.004),(1,.004),(.70,.004),(.70,-.004)],SEDAN_ALLOY)
            continue
        _panel(name,"carPaint","Decklid vertical face",29,12,
               lambda u,v:_add(_end(False,blend(.139,.861,u),blend(.674,1,v)),(0,0,-.003)),
               SEDAN_PAINT,flip=True)
        _panel(name,"carMetal","Satin bright rear garnish",25,5,
               lambda u,v:_end_point(False,blend(-.608,.608,u),blend(.650,.706,v),.010+.003*sin(pi*v)),
               rgb(0x999b9a),flip=True)
        _cord(name,"carMetal","Bright garnish lip",
              [_end_point(False,blend(-.548,.548,t),.709,.016) for t in _range(27)],.0046,SEDAN_CHROME)
        for i,letter in enumerate("SONATA"):
            _letter(name,"carMetal",letter,_end_point(False,(2.5-i)*.121,.661,.016),.035,SEDAN_CHROME,
                    right=(-1,0,0),rise=.00115)
        _letter(name,"carMetal","GVS",_end_point(False,-.511,.771,.012),.026,SEDAN_CHROME,right=(-1,0,0),rise=.0006)
        _badge(name,_end_point(False,0,.772,.015),.105,"z",SEDAN_CHROME,True)
        lathe(name,"carMetal","Trunk lock bezel",[(0,.012,.012),(.005,.013,.013),(.008,.010,.010)],
              SEDAN_CHROME,18,_end_point(False,-.428,.675,.015),axis="z")
        box(name,"plain","Deck lock keyway",_end_point(False,-.428,.675,.021),(.0034,.011,.002),SEDAN_BLACK)


def _lamp_sample(front,side,u,v):
    if front:
        lower = _profile(((0,.654),(.10,.626),(.41,.623),(.74,.644),(.92,.682),(1,.719)),u,1)
        upper = _profile(((0,.683),(.14,.743),(.43,.779),(.72,.806),(.91,.790),(1,.748)),u,1)
        x = side*blend(.349,.857,u)
    else:
        lower = _profile(((0,.551),(.20,.542),(.77,.541),(1,.585)),u,1)
        upper = _profile(((0,.751),(.12,.805),(.45,.842),(.71,.826),(.91,.748),(1,.619)),u,1)
        x = side*blend(.598,.862,u)
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
                p=_end_point(front,x,y,depth)
                wrap=smooth(.64,1,u)
                flare=.031*wrap if front else .027*wrap
                return (x,y,p[2]+(-flare if front else flare))
            def edge():
                return ([lamp(t,0,.018) for t in _range(23)]+[lamp(1,t,.018) for t in _range(7)][1:]+
                        [lamp(1-t,1,.018) for t in _range(23)][1:]+[lamp(0,1-t,.018) for t in _range(7)][1:-1])
            flip=(side<0)==front
            _panel(socket,"plain","Recessed dual lamp housing",22,11,lambda u,v:lamp(u,v,.009),SEDAN_BLACK,flip)
            _cord(socket,"plain","Lamp perimeter gasket",edge(),.0086,SEDAN_RUBBER,closed=True)
            for t in (.27,.59,.84):
                at=lamp(t,.50,.012)
                outline=_elliptic(.099 if front else .073,.091,.83,20)
                _bezel(socket,"carMetal","Aluminized reflector cup",outline,
                       lambda u,v,d:_add(at,(u,v,(1 if front else -1)*d)),
                       [(1,.002),(.64,-.004),(.22,-.009),(.08,-.010)],SEDAN_ALLOY,True)
            def glass(u,v):
                return lamp(u,v,.019+.019*sin(pi*v)*sin(pi*u)**.6)
            def tint(p,front=front):
                x,y,z=p
                start,width=(.349,.508) if front else (.598,.264)
                u=(abs(x)-start)/width
                if front:
                    base=rgb(0xd19933) if u>=.751 else rgb(0xcbd7d5)
                    fiber=.91+.080*cos(u*62*pi)+.033*cos(y*310)
                else:
                    base=rgb(0xb82c29) if y>.610+u*.005 else rgb(0xc4cbbe if u<.30 else 0xd1922e)
                    fiber=.91+.077*cos(y*345)+.029*sin(u*89)
                return tone(base,fiber)
            limits=[(0,.748),(.751,1)] if front else [(0,1)]
            for i,(a,b) in enumerate(limits):
                _panel(lens,"carLens",("Clear ribbed lens" if i==0 else "Amber turn signal"),
                       39 if i==0 else 14,14,lambda u,v:glass(blend(a,b,u),v),tint,flip,
                       uv=lambda p:(abs(p[0])*34,p[1]*22))
            _cord(lens,"carLens","Lens flange",edge(),.0019,rgb(0x888d84),closed=True)


def _side_glass_point(side,front,u,v):
    lo,hi=SEDAN_DOORS[front]
    if front:
        z=blend(lo+.025+.015*v,hi-.019-.049*v**1.8,u)
    else:
        z=blend(lo+.023+.359*v**2,hi-.028-.013*v,u)
    top,inset=_cabin(z)
    bottom=_belt(z)+.012
    side_x=_side(1,z,1)[0]-.021
    y=blend(bottom,max(bottom+.022,top-.023),v)
    return (side*(blend(side_x,inset-.005,v)+.015*sin(pi*v)),y,z)


def _side_frame(name,side,front):
    def pane(u,v):
        return _side_glass_point(side,front,u,v)
    for label,line in (
        ("Window belt weatherstrip",[pane(u,0) for u in _range(29)]),
        ("Upper window frame",[pane(u,1) for u in _range(31)]),
        ("Door window rear edge",[pane(0,v) for v in _range(17)]),
        ("Door window leading edge",[pane(1,v) for v in _range(17)]),
    ):
        _cord(name,"plain",label,line,.013 if "Upper" in label else .011,SEDAN_RUBBER)
    _cord(name,"carMetal","Polished belt trim",[_add(pane(t,0),(side*.008,-.011,0)) for t in _range(27)],
          .0037,rgb(0xb2b9bb))


def _end_glass_point(front,u,v):
    a,b=(.412,1.041) if front else (-1.374,-.783)
    z=blend(a,b,v)
    y,inset=_cabin(z)
    across=2*u-1
    bow=(1-across*across)*sin(pi*v)
    return (across*(inset-.013),y+.020*(1-across*across),
            z+(1 if front else -1)*.036*bow)


def _green_glass(front):
    def tint(p):
        color=rgb(0x536465) if front else rgb(0x4f6161)
        if front:
            return _lerp(color,rgb(0x344f61),.76*smooth(1.297,1.397,p[1]))
        # Heated rear glass keeps a warmer, narrow tint at each heater wire.
        wire = max(0,cos((p[2]+1.374)*tau/.061))**22
        return _lerp(color,rgb(0x665748),wire*.46)
    return tint


def _roof_and_glazing():
    roof=_sedan_asset("roof")
    def roof_panel(u,v,drop=0):
        z=blend(-.784,.413,v)
        y,w=_cabin(z)
        return ((2*u-1)*w,y+.022*sin(pi*u)**1.56-drop,z)
    _panel(roof,"carPaint","Crowned steel roof",24,33,roof_panel,SEDAN_PAINT,True)
    _panel(roof,"fabric","Felt headliner",16,20,lambda u,v:roof_panel(u,v,.034),rgb(0xa49a84))

    for front in (False,True):
        glass=_sedan_asset("windshield" if front else "back_glass")
        def pane(u,v):
            return _end_glass_point(front,u,v)
        _panel(glass,"carGlass","Compound curved laminated glass" if front else "Heated rear window",
               32,38 if not front else 24,pane,_green_glass(front),True)
        for edge in (0,1):
            line=[pane(t,edge) for t in _range(31)]
            _cord(roof,"plain","Glazing encapsulated seal",line,.010,rgb(0x1d2021))
            _cord(roof,"plain","Glazing side rubber",[pane(edge,t) for t in _range(23)],.011,SEDAN_RUBBER)

    for side in (-1,1):
        rim=[(side*_cabin(z)[1],_cabin(z)[0]+.004,z) for z in (blend(-.783,.413,t) for t in _range(31))]
        _cord(roof,"carPaint","Gutter above doors",rim,.010,SEDAN_PAINT)
        _cord(roof,"plain","Roof ditch rubber",[_add(p,(-side*.013,.004,0)) for p in rim],.004,SEDAN_RUBBER)
        def pillar(front,u,v):
            glass = _side_glass_point(side,front,1 if front else 0,v)
            if front:
                outer = _end_glass_point(True,1 if side>0 else 0,1-.97*v)
            else:
                # Keep the painted C-pillar broad at the belt and narrow at the roof.
                outer = _end_glass_point(False,1 if side>0 else 0,.96*v)
            return _lerp(outer,glass,u)
        _panel(roof,"carPaint","A pillar" if side<0 else "Driver A pillar",9,24,
               lambda u,v:pillar(True,u,v),SEDAN_PAINT,flip=side<0)
        _panel(roof,"carPaint","Sculpted C pillar",11,25,lambda u,v:pillar(False,u,v),SEDAN_PAINT,flip=side>0)
        def midpillar(u,v):
            z=blend(-.260,-.202,u)
            y,inset=_cabin(z)
            belt=_belt(z)
            return (side*blend(_side(1,z,1)[0]-.032,inset-.018,v),blend(belt-.027,y-.016,v),z)
        _panel(roof,"plain","Black B-pillar cover",4,18,midpillar,rgb(0x222525),flip=side>0)
        _cord(roof,"carLeather","Interior pillar trim",[_add(pillar(True,.50,t),(-side*.026,-.012,0))
              for t in _range(23)],.024,SEDAN_TRIM)
    _headliner_details(roof)

    name=_sedan_asset("wipers")
    box(name,"plain","Cowl air tray",(0,.926,1.039),(1.48,.035,.115),SEDAN_BLACK,.012)
    for side in (-1,1):
        for i in range(16):
            x=side*(.17+i*.029)
            box(name,"gloss","Cowl ventilation slots",(x,.946,1.067),(.010,.0026,.039),rgb(0x373a37),.001)
        at=(side*.414,.962,1.024)
        elbow=(side*.324,.996,.987)
        end=(side*.324-.169,1.025,.934)
        tip=(side*.324+.177,1.007,.949)
        lathe(name,"plain","Wiper spindle",[(0,.017,.017),(.011,.015,.015)],SEDAN_BLACK,14,at)
        _cord(name,"plain","Parked wiper arm",[at,elbow],.009,SEDAN_BLACK)
        _cord(name,"plain","Wiper blade with backbone",catmull([end,(side*.321,1.022,.936),tip]),
              .009,rgb(0x262929))


def _doors_and_mirrors():
    for side in (-1,1):
        for front in (False,True):
            suffix=_side_suffix(side,front)
            pivot=_door_pivot(side,front)
            lo,hi=SEDAN_DOORS[front]
            name=_sedan_asset("door_"+suffix,pivot)
            def skin(u,v):
                return _side(side,blend(lo,hi,u),v)
            _panel(name,"carPaint","Curved door skin",26,16,skin,_paint_tint,flip=side>0)
            boundary=([skin(t,0) for t in _range(22)]+[skin(1,t) for t in _range(14)][1:]+
                      [skin(1-t,1) for t in _range(22)][1:]+[skin(0,1-t) for t in _range(14)][1:-1])
            _cord(name,"plain","Stamped edge shadow",[_add(p,(-side*.013,0,0)) for p in boundary],
                  .010,SEDAN_BLACK,closed=True)
            _cord(name,"carPaint","Door shell return",[_add(p,(-side*.029,.003,0)) for p in boundary],
                  .011,SEDAN_PAINT,closed=True)
            z=lo+.196
            x,y,_=_side(side,z,.828)
            recess=_elliptic(.189,.055,.71,30)
            def pull(u,v,d):
                return (x+side*(d-.012*(u/.097)**2),y+v,z+u)
            grip={
                "pull":pull(0,.004,.036),
                "release":(side*.749,_belt((lo+hi)/2)-.155,hi-.16),
                "lock":(side*.844,_belt(lo+.293)+.020,lo+.293),
            }
            ASSETS[name]["anchors"]={key:_add(at,_scale(pivot,-1)) for key,at in grip.items()}
            _bezel(name,"plain","Exterior pull pocket",recess,pull,
                   [(1,.002),(.95,.007),(.83,.012)],SEDAN_BLACK,True)
            _bezel(name,"carPaint","Painted pull handle",_elliptic(.149,.033,.61,28),
                   lambda u,v,d:pull(u,v+.004,d),[(.97,.017),(1,.026),(.83,.036)],SEDAN_PAINT,True)
            _cord(name,"carMetal","Exterior handle bright edge",
                  [pull(blend(-.067,.066,t),.017+sin(pi*t)*.003,.034) for t in _range(18)],
                  .0025,SEDAN_CHROME)
            if front:
                _pill(name,"carMetal","Front door lock cylinder",pull(-.065,-.003,.038),.018,.022,.009,SEDAN_ALLOY,"x")
                _pill(name,"plain","Door keyway",pull(-.065,-.003,.044),.003,.010,.001,SEDAN_BLACK,"x")
            molding=[]
            for t in _range(24):
                z=blend(lo+.036,hi-.033,t)
                x,_,_=_side(side,z,.40)
                molding.append((x+side*.002,.487+sin(pi*t)*.010,z))
            _cord(name,"plain","Raised bodyside molding",molding,.013,SEDAN_RUBBER)
            _cord(name,"carMetal","Trim inset",[_add(p,(side*.012,.005,0)) for p in molding],
                  .0035,SEDAN_CHROME)
            _side_frame(name,side,front)
            _door_card(name,side,front,lo,hi)
            glass=_sedan_asset("side_glass_"+suffix,pivot,"sedan_door_"+suffix)
            _panel(glass,"carGlass","Curved tinted roll-up glass",25,15,
                   lambda u,v:_side_glass_point(side,front,u,v),rgb(0x4a6061),flip=side>0)
            if front:
                _outside_mirror(side,pivot,suffix)


def _outside_mirror(side,pivot,suffix):
    house=_sedan_asset("mirror_housing_"+suffix,pivot,"sedan_door_"+suffix)
    glass=_sedan_asset("mirror_glass_"+suffix,pivot,"sedan_door_"+suffix)
    name="Driver" if side>0 else "Passenger"
    mount=[(side*.854,.926,.883),(side*.868,1.021,.841),(side*.902,.942,.778)]
    _cord(house,"plain",name+" sail panel frame",mount,.020,SEDAN_RUBBER,closed=True)
    mesh(house,"plain",name+" molded sail mounting plate",mount,[(0,1,2)],SEDAN_BLACK,soft=False)
    _cord(house,"plain",name+" mirror stalk",[(side*.864,.946,.817),(side*.944,.965,.812),(side*.987,.976,.816)],
          .029,SEDAN_BLACK,sides=12)
    outline=_outline([(-.106,-.010),(-.093,.030),(-.034,.052),(.061,.045),(.116,.014),
                      (.111,-.025),(.068,-.047),(-.061,-.045)],4)
    def mirror(u,v,d):
        return (side*(1.017+u),.982+v+.09*u,.748+d+.16*u)
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
        return (u,1.253+v,.520+d-.15*v)
    _bezel(house,"plain","Day/night rearview shell",outline,view,
           [(.87,.029),(1,.013),(1,-.009),(.92,-.012),(.89,-.006)],SEDAN_BLACK,True)
    _bezel(glass,"carMetal","Separate rearview mirror glass",outline,view,
           [(.915,-.013),(.890,-.016)],rgb(0x9aabab),True)
    _cord(house,"plain","Windscreen mount",[(-.004,1.271,.541),(0,1.306,.558),(0,1.351,.588)],
          .014,rgb(0x313433),sides=12)
    box(house,"plain","Anti-glare toggle",(0,1.203,.533),(.051,.028,.020),SEDAN_BLACK,.006)
