"""Upholstery, instruments and moving cabin parts modeled from the close-ups."""

DASH_FACE = rgb(0x252a29)
DASH_MARK = rgb(0xcbd1bd)
CABIN_BEIGE = rgb(0xb6ac99)


def _door_card(name,side,front,lo,hi):
    mid=(lo+hi)/2
    span=hi-lo
    def board(u,v,d):
        z=mid+u*span
        x=.811-.024*exp(-((v+.032)/.12)**2)-.018*d/.045
        return (side*x,.594+v,z)
    shell=_outline([(-.47,-.21),(-.47,.267),(-.36,.294),(.36,.282),(.47,.239),
                     (.46,-.108),(.34,-.242),(-.34,-.255)],4)
    pocket=_outline([(-.347,-.039),(-.369,-.011),(-.360,.027),(-.319,.045),(-.226,.039),
                     (.090,.026),(.211,.040),(.252,.057),(.279,.047),(.278,.014),
                     (.237,-.020),(.173,-.040),(-.245,-.045)],4)
    map_opening=[(u,v-.170) for u,v in pocket]
    _bezel(name,"carLeather","Molded grey door card",shell,board,
           [(.992,-.07),(1,-.024),(.978,.011),(.962,.029)],SEDAN_TRIM)
    _perforated_surface(name,"carLeather","Door card with integrated storage opening",
                        _offset_outline(shell,(0,0),.962),[map_opening],
                        [(x,y) for x in (blend(-.447,.450,t) for t in _range(27))
                         for y in (blend(-.229,.269,t) for t in _range(23))],
                        lambda u,v:board(u,v,.029),SEDAN_TRIM,flip=side<0)
    def shoulder_roll(u,v):
        z=blend(lo+.062,hi-.055,u)
        edge_x,edge_y,_=_side(side,z,1)
        inner=board((z-mid)/span,.239,.031)
        outer=(edge_x-side*.050,edge_y+.013,z)
        return _add(_lerp(inner,outer,v),(0,.019*sin(pi*v),0))

    _panel(name,"carLeather","Padded door top joining the molded card and window ledge",
           38,10,shoulder_roll,SEDAN_TRIM,flip=side>0)
    _cord(name,"plain","Inner window waist seal",
          [shoulder_roll(u,1) for u in _range(38)],.0044,SEDAN_RUBBER)
    def map_pocket(u,v,d):
        return board(u,v-.170,d)
    _bezel(name,"carLeather","Return around recessed map pocket",pocket,map_pocket,
           [(1,.029),(.975,.030),(.934,.016),(.925,.007)],rgb(0x66675d))
    _bezel(name,"plain","Deep lower map pocket liner",pocket,map_pocket,
           [(.926,.007),(.911,-.006)],rgb(0x303630),True)
    cloth=_outline([(-.401,.113),(-.416,.156),(-.412,.197),(-.386,.219),(-.314,.229),
                    (.105,.226),(.186,.215),(.244,.192),(.277,.155),(.288,.112),
                    (.257,.082),(.178,.071),(-.308,.072),(-.369,.085)],5)
    _bezel(name,"fabric","Rounded cloth door insert",cloth,board,
           [(1,.033),(.975,.043),(.913,.052)],CABIN_BEIGE,True)
    z0=mid-.058
    def controls(u,v,d):
        return (side*(.741+u),.642+.091*v-.22*u*u+d,z0+v)
    pad=_outline([(-.058,-span*.335),(.009,-span*.358),(.058,-span*.321),(.064,-span*.229),
                   (.056,span*.271),(.025,span*.334),(-.043,span*.349),(-.061,span*.293)],4)
    _bezel(name,"fabric","Long cloth-covered door armrest",pad,controls,
           [(.882,-.054),(1,-.034),(1,-.012),(.965,-.005)],CABIN_BEIGE,True)
    control=_outline([(-.038,-.187),(.025,-.202),(.039,-.173),(.039,.211),(.028,.266),
                      (-.022,.276),(-.042,.236)],4) if front else _elliptic(.079,.367,.38,32)
    pull=_offset_outline(_elliptic(.056,.120,.49,40),(0,-.109 if front else -.077))
    _bezel(name,"carWood","Glossy burl inset around switches",control,controls,
           [(1,-.012),(1,-.004),(.977,.001)],SEDAN_WALNUT)
    _perforated_surface(name,"carWood","Burl switch panel with recessed hand pull",
                        _offset_outline(control,(0,0),.977),[pull],
                        [(x,z) for x in (-.032,-.019,0,.019,.032) for z in
                         (blend(-.177,.246 if front else .17,t) for t in _range(19))],
                        lambda x,z:controls(x,z,.001),SEDAN_WALNUT,flip=side>0)
    _bezel(name,"plain","Recessed black door pull cup",pull,controls,
           [(1,.002),(.990,-.001),(.955,-.007),(.871,-.014)],rgb(0x202727),True)
    _bezel(name,"gloss","Rolled edge of door pull",pull,controls,
           [(1,.002),(.96,.0027),(.927,.0007)],rgb(0x494a41))

    positions=[(-.016,.041),(.015,.041),(-.016,.094),(.015,.094)] if front and side>0 else [(0,.068)]
    for i,(u,v) in enumerate(positions):
        at=controls(u,v,.006)
        _pill(name,"plain","Individual sculpted power window rocker",at,.025,.038,.009,rgb(0x252a2a),"y",.43)
        box(name,"gloss","Window switch bright finger ridge",_add(at,(0,.0048,-.011)),(.020,.0015,.0025),
            rgb(0x707b77),.001)
        mark=[controls(u+x,v+z,.011) for x,z in
              ((-.0045,-.002),(-.0045,.004),(.0035,.004),(.005,-.002))]
        _cord(name,"gloss","Power window outline",mark,.00040,DASH_MARK,closed=True,sides=4)
        if i==0 and side>0 and front:
            _letter(name,"gloss","AUTO",_add(at,(0,.0051,-.006)),.0055,DASH_MARK,
                    right=(1,0,0),up=(0,0,-1),rise=.00009)
    if front and side>0:
        lathe(name,"plain","Round four-way mirror control",
              [(-.004,.0215,.025),(.002,.022,.025),(.007,.019,.021)],
              SEDAN_BLACK,32,controls(0,.190,.005))
        for angle in (0,pi/2,pi,3*pi/2):
            coords=[]
            for x,z in ((.013,0),(.007,.0028),(.007,-.0028)):
                coords.append(controls(x*cos(angle)-z*sin(angle),.190+x*sin(angle)+z*cos(angle),.0123))
            mesh(name,"gloss","Mirror control direction arrow",coords,[(0,1,2)],DASH_MARK,soft=False)
        _pill(name,"plain","Left-right mirror selection toggle",controls(0,.249,.005),.019,.013,.006,SEDAN_BLACK,"y")
        for dx,txt in ((.015,"L"),(-.015,"R")):
            _letter(name,"gloss",txt,controls(dx,.252,.0025),.0049,DASH_MARK,
                    up=(0,0,-1),rise=.00007)
        for gx in (-.014,.014):
            _pill(name,"plain","Lock or window inhibit switch",controls(gx,-.009,.006),.021,.027,.009,
                  rgb(0x232929),"y",.46)
        _letter(name,"gloss","LOCK",controls(-.014,-.013,.0108),.0043,DASH_MARK,up=(0,0,-1),rise=.00007)
        _letter(name,"gloss","WIN",controls(.014,-.013,.0108),.0043,DASH_MARK,up=(0,0,-1),rise=.00007)

    x=side*.776
    z=hi-.16
    y=_belt(mid)-.154
    handle=_outline([(-.065,-.020),(-.064,.024),(-.030,.032),(.035,.030),(.066,.010),
                     (.061,-.021),(.022,-.026)],4)
    def release(u,v,d):
        return (x-side*d,y+v,z+u)
    _bezel(name,"carLeather","Door-release escutcheon",handle,release,
           [(1,.001),(1,.012),(.91,.019),(.81,.017)],CABIN_BEIGE)
    _bezel(name,"plain","Recessed release cup",handle,release,[(.83,.008),(.79,.014)],SEDAN_BLACK,True)
    _bezel(name,"carMetal","Interior pull trigger",_elliptic(.091,.022,.49,24),
           lambda u,v,d:release(u,v-.007,d),[(1,.018),(1,.024),(.78,.033)],rgb(0x939a90),True)
    _pill(name,"carLens","Red lock witness",release(.036,.019,.024),.017,.008,.003,rgb(0xac483a),"x")

    lip=[map_pocket(blend(-.332,.251,t),-.025+.043*(2*t-1)**4,.048) for t in _range(36)]
    _cord(name,"carLeather","Rounded molded lower storage lip",lip,.0090,SEDAN_TRIM,sides=9)
    at=(side*.780,.441,hi-(.215 if front else .189))
    speaker=_elliptic(.207,.170,1,36)
    def grille(u,v,d):
        return _add(at,(-side*d,v,u))
    _bezel(name,"carLeather","Door speaker rim",speaker,grille,
           [(1.105,0),(1.04,.016),(1,.018),(.94,.017)],SEDAN_TRIM)
    outer=[(x*.937,y*.937) for x,y in speaker]
    def grille_face(u,v):
        return grille(u,v,.020+.0045*(1-(u/.104)**2-(v/.086)**2))
    def screen_color(p):
        q=p[2]-at[2]
        r=p[1]-at[1]
        cells=cos(tau*(q*226+r*112))*cos(tau*r*226)
        return tone(rgb(0x505349),.93-.26*smooth(.45,.88,cells))
    screen=_perforated_surface(name,"plain","Fine perforated speaker mesh",outer,[],
                               [(x*.0030,y*.0030) for x in range(-32,33) for y in range(-29,30)],
                               grille_face,screen_color,flip=side<0)
    screen["finish_override"]="Speaker mesh"
    _pill(name,"carLens","Door courtesy lamp",(side*.772,.349,lo+.136),.110,.039,.019,
          rgb(0xa0382c),"x",.49)
    _pill(name,"carMetal","Safety latch fork",(side*.879,.635,lo+.006),.024,.041,.019,SEDAN_ALLOY,"z",.55)
    for y in (.601,.668):
        lathe(name,"carMetal","Latch mounting bolt",[(0,.005,.005),(-.004,.005,.005)],
              SEDAN_ALLOY,8,(side*.878,y,lo+.003),"z")
    if front:
        x,z=side*.795,hi-.132
        y=_belt(z)-.019
        _pill(name,"plain","Shallow side-window defog outlet",(x,y,z),.036,.106,.009,
              rgb(0x4c5148),"y",.41)
        for i in range(6):
            dz=(i-2.5)*.0141
            _cord(name,"gloss","Side-window defog opening",
                  [(x-side*.010,y+.0044,z+dz),(x+side*.010,y+.0049,z+dz+.0023)],
                  .0017,rgb(0x202622),sides=4)


def _headliner_details(roof):
    for side in (-1,1):
        x=side*.319
        visor=_outline([(-.247,-.083),(-.246,.058),(-.216,.093),(-.093,.095),(.205,.078),
                        (.240,.062),(.246,-.055),(.219,-.086),(-.180,-.096)],4)
        def folded(u,v,d):
            return x+side*u,1.327+d-.12*v-.038*u, .205+v
        _bezel(roof,"fabric","Soft board of folded sun visor",visor,folded,
               [(1,.014),(1,.004),(.978,-.010),(.896,-.017)],rgb(0xb9ae98),True)
        _cord(roof,"fabric","Seamed edge of the wrapped sun visor",
              [folded(u*.974,v*.977,-.009) for u,v in visor],.0011,rgb(0x9f9784),closed=True,sides=5)
        if side<0:
            _pill(roof,"carLeather","Inset passenger vanity cover",folded(-.055,-.016,-.015),
                  .146,.061,.007,CABIN_BEIGE,"y",.40)
        hinge=[folded(.212,.075,.005),folded(.242,.069,.008),folded(.248,.059,.019)]
        _cord(roof,"carMetal","Folded visor hinge rod",hinge,.0062,rgb(0xa7a79a),sides=9)
        clip=folded(-.204,.054,-.002)
        _pill(roof,"carLeather","Sun visor inner retaining clip",clip,.035,.022,.022,
              rgb(0xa79f8b),"y",.52)
        for label,at in (("Outer visor hinge flange",hinge[-1]),("Inner visor clip base",clip)):
            px,py,pz=at
            z=min(pz,.268)
            height=_roof_height(px,z)-.028
            _cord(roof,"carLeather",label,[at,(px,height,z)],.0136,rgb(0xa59b85),sides=9)
        handle=[(side*.615,1.358,-.215),(side*.596,1.335,-.190),(side*.593,1.329,-.030),
                (side*.616,1.349,-.001)]
        _cord(roof,"carLeather","Shaped roof grab handle",catmull(handle,5),.0125,CABIN_BEIGE,sides=12)
        for at in (handle[0],handle[-1]):
            px,py,pz=at
            end=_roof_height(px,pz)-.025
            _pill(roof,"carLeather","Recessed grab handle mounting boss",
                  (px,(py+end)*.5,pz),.045,.043,end-py+.012,rgb(0xa9a18e),"y",.49)
    def console_headliner(u,v,d):
        z=.146+v
        return u,_roof_height(u,z)-.034-d,z

    _bezel(roof,"carLeather","Map light console flange seated against headliner",
           _elliptic(.266,.223,.53,44),console_headliner,
           [(.98,-.005),(1,.002),(.977,.014),(.915,.022)],rgb(0xa9a08e),True)
    _pill(roof,"carLeather","Rounded molded overhead console",(0,1.342,.148),.268,.239,.059,
          rgb(0xb4aa95),"y",.54)
    well=_outline([(-.108,-.046),(-.103,.044),(-.076,.058),(.077,.058),(.103,.042),
                    (.108,-.040),(.085,-.056),(-.086,-.057)],4)
    def glasses(x,z,d):
        return x,1.314-d-.036*z,.100+z
    _bezel(roof,"plain","Recess around sunglasses door",well,glasses,[(1,0),(1,.006),(.962,.007)],
           rgb(0x625e51),True)
    _bezel(roof,"carLeather","Contour of push-release sunglasses lid",well,glasses,
           [(.934,.003),(.943,.008),(.898,.012)],rgb(0xb3a893),True)
    _letter(roof,"gloss","PUSH",glasses(0,-.018,.013),.0106,rgb(0x7f776a),
            right=(-1,0,0),up=(0,0,-1),rise=.00016)
    lamp=_outline([(-.105,-.030),(-.103,.025),(-.075,.040),(.071,.040),(.103,.023),
                    (.108,-.025),(.083,-.039),(-.082,-.041)],4)
    def lamp_face(x,z,d):
        return x,1.314-d+.102*z,.210+z
    _bezel(roof,"gloss","Overhead lamp surround",lamp,lamp_face,[(1,0),(1,.005),(.954,.008)],
           rgb(0x8b8a7d))
    reflector=_bezel(roof,"carLens","Prismatic overhead lamp cover",lamp,lamp_face,
                     [(.954,.007),(.932,.010),(.881,.014)],rgb(0xc5c8bd),True)
    reflector["optical_cover"]="Clear"
    _bezel(roof,"gloss","Silver map light backing",lamp,lamp_face,
           [(.905,.003),(.888,.005)],rgb(0xa9ac9e),True)
    for x in (-.052,.052):
        _pill(roof,"carLeather","Individual map light switch",lamp_face(x,-.017,.013),
              .044,.027,.012,rgb(0xb1a692),"y",.46)
        for i in range(8):
            offset=x+(i-3.5)*.0097
            _cord(roof,"gloss","Map light molded flutes",[lamp_face(offset,t,.0118) for t in (-.005,.027)],
                  .00037,rgb(0xb0b7b2),sides=4)


def _stitch(name,label,sample,normal,color=rgb(0xb6a68a)):
    """Short stitches sit on the same molded surface as the leather."""
    points=[Vector(sample(t)) for t in _range(45)]
    length=sum((b-a).length for a,b in zip(points,points[1:]))
    count=max(1,round(length/.0051))
    vertices,faces=[],[]
    normal=Vector(normal)
    for i in range(count):
        a=Vector(sample((i+.09)/count))+normal*.00062
        b=Vector(sample((i+.70)/count))+normal*.00062
        across=(b-a).cross(normal).normalized()*.00042
        start=len(vertices)
        vertices.extend((a-across,a+across,b+across,b-across))
        faces.append((start,start+1,start+2,start+3))
    mesh(name,"gloss",label,vertices,faces,color,soft=False)


def _seat_skin(name,label,sample,back,sections,normal):
    """The center strip and bolsters share all of their seam positions."""
    for i,(left,right,perforated) in enumerate(sections):
        uv=(lambda p:(16+p[0],p[2 if normal[1]>0 else 1])) if perforated else None
        obj=_panel(name,"carLeather",label+(" perforated insert" if perforated else " smooth bolster"),
                   17 if perforated else 11,33,lambda u,v:sample(blend(left,right,u),v),
                   rgb(0xc7b99e) if perforated else rgb(0xcec1a6),flip=normal[1]>0,uv=uv)
        if perforated:
            obj["finish_override"]="Perforated cushion" if normal[1]>0 else "Perforated backrest"
        if i:
            _cord(name,"carLeather","Tan leather welt in panel join",
                  [_add(sample(left,t),_scale(normal,.00032)) for t in _range(35)],
                  .00075,rgb(0xada186),sides=5)
            for inset in (-.009,.009):
                _stitch(name,"Two sewn rows along seat panel",lambda t:sample(left+inset,t),normal)
    edge=_panel_border(32,34)
    def round_edge(u,v,t):
        front=Vector(sample(u,v))
        inside=Vector(sample(blend(.018,.982,u),blend(.019,.981,v)))
        outward=(front-inside).normalized()
        ease=(1-cos(pi*t))*.5
        fullness=.019 if normal[1]>0 else .024
        return front.lerp(Vector(back(u,v)),ease)+outward*(fullness*sin(pi*t))
    rows_mesh(name,"carLeather",label+" rounded edge and piping allowance",
              [[round_edge(u,v,t) for u,v in edge] for t in _range(9)],rgb(0xc9bba0),caps=False)
    _panel(name,"carLeather",label+" reverse cover",25,23,back,rgb(0xbeb198),
           flip=normal[1]<=0)


def _upholstery():
    name=_sedan_asset("upholstery")
    sections=((0,.183,False),(.183,.817,True),(.817,1,False))

    def cushion(label,center,width,depth,wide=False):
        cx,cz=center
        def top(u,v):
            x=2*u-1
            span=width*.5*(.85+.15*sin(pi*v)**.56)
            crown=.025*(1-x*x)+.018*sin(pi*v)
            rise=.026*exp(-((abs(x)-.76)/.167)**2)*sin(pi*v)**.58
            nose=.039*x*x*smooth(.56,1,v)
            return cx+span*x,.447+crown+rise+.018*v-.019*v**10,cz+depth*(v-.5)-nose
        def base(u,v):
            x,y,z=top(u,v)
            return blend(cx,x,.925),.369+.015*(1-v),blend(cz,z,.949)
        cuts=((0,.095,False),(.095,.354,True),(.354,.646,False),(.646,.905,True),(.905,1,False)) if wide else sections
        _seat_skin(name,label,top,base,cuts,(0,1,0))
        for v in (.875,.889):
            _stitch(name,label+" seam across curved forward edge",lambda t:top(t,v),(0,1,0))

    for side in (-1,1):
        x=side*.427
        cushion("Driver seat cushion" if side>0 else "Passenger seat cushion",(x,.148),.545,.588)

        def front(u,v):
            dx=2*u-1
            width=.267*(.95+.05*sin(pi*v)-.17*v**4)
            y=.453+.472*v-.063*dx*dx*smooth(.70,1,v)
            bolster=.046*exp(-((abs(dx)-.75)/.179)**2)*sin(pi*v)**.62
            lumbar=.024*exp(-((v-.335)/.253)**2)*(1-dx*dx)
            z=-.086-.158*v+lumbar+bolster-.011*v**14
            return x+width*dx,y,z

        def reverse(u,v):
            px,py,pz=front(u,v)
            return blend(x,px,.956),py-.003,pz-(.096+.033*sin(pi*v))

        _seat_skin(name,"Contoured front backrest",front,reverse,sections,(0,0,1))
        for v in (.767,.780):
            _stitch(name,"Horizontal seam over the backrest insert",
                    lambda t:front(blend(.183,.817,t),v),(0,0,1))

        head=_outline([(-.113,-.066),(-.130,-.039),(-.133,.030),(-.107,.075),(-.067,.087),
                       (.062,.088),(.108,.072),(.131,.035),(.130,-.029),(.111,-.063),
                       (.064,-.073),(-.069,-.073)],4)
        def headrest(u,v,d):
            gather=.004*cos(u*214)*exp(-((v+.065)/.012)**2)
            return x+u,1.032+v,-.270+d-.23*v+gather
        _bezel(name,"carLeather","Wrapped tapered front headrest",head,headrest,
               [(.67,-.088),(.83,-.084),(.953,-.070),(1,-.046),(1,.032),
                (.966,.054),(.914,.068),(.73,.074)],rgb(0xc9bba1),True)
        for offset in (-.0031,.0031):
            seam=[headrest(u*.988,v*.989,offset-.034) for u,v in head]
            _cord(name,"carLeather","Headrest sewn perimeter",seam,.00085,rgb(0xb1a388),
                  sides=4,closed=True)
        for dx in (-.079,.079):
            _cord(name,"carMetal","Steel headrest post",[(x+dx,.903,-.286),(x+dx,.987,-.276)],
                  .0074,SEDAN_ALLOY,sides=10)
            _pill(name,"carLeather","Headrest post collar",(x+dx,.916,-.285),.023,.025,.007,CABIN_BEIGE,"y")

        def pocket(u,v):
            p=reverse(blend(.153,.847,u),blend(.156,.534,v))
            fullness=.012*sin(pi*u)*sin(pi*v)+.007*v
            return _add(p,(0,-.010*sin(pi*u)*v,-fullness))
        _panel(name,"carLeather","Rounded seatback pocket",17,16,pocket,rgb(0xc1b49c),True)
        _cord(name,"carLeather","Elastic upper pocket rim",[pocket(u,1) for u in _range(27)],
              .00225,rgb(0xa49a85),sides=5)
        _stitch(name,"Seatback pocket bottom stitch",lambda t:pocket(t,.025),(0,0,-1))
        box(name,"plain","Seat pan under the front cushion",(x,.359,.148),
            (.471,.039,.506),rgb(0x474740),.014)
        for dx in (-.170,.170):
            box(name,"plain","Stamped sliding seat rail",(x+dx,.270,.148),(.044,.040,.512),rgb(0x383a37),.006)
            for z in (-.041,.327):
                box(name,"carMetal","Pressed mount between seat pan and slider",(x+dx,.319,z),
                    (.045,.088,.068),rgb(0x55544b),.006)
                box(name,"plain","Bolted floor rail foot",(x+dx,.258,z+.028),
                    (.064,.020,.088),rgb(0x393b34),.004)
                lathe(name,"carMetal","Hex seat rail floor fastener",[(0,.008,.008),(.005,.008,.008)],
                      rgb(0x777568),6,(x+dx,.269,z+.062))
        base=_outline([(-.250,-.051),(-.250,.024),(-.226,.060),(.168,.060),(.239,.038),
                       (.257,.003),(.218,-.035),(-.176,-.056)],4)
        _bezel(name,"carLeather","Sculpted seat base side molding",base,
               lambda u,v,d:(x+side*(.237+d),.346+v,.148+u),
               [(1,-.019),(1,.016),(.961,.022)],rgb(0xb7ad94),True)
        if side>0:
            for z in (.136,.306):
                outline=[((.031+.005*cos(a*5))*cos(a),(.031+.005*cos(a*5))*sin(a))
                         for a in (tau*k/60 for k in range(60))]
                def adjust(u,v,d):
                    return x+side*(.257+d),.348+v,z+u
                _bezel(name,"carLeather","Five-lobe driver's seat adjustment wheel",outline,adjust,
                       [(.87,-.006),(1,.001),(1,.015),(.913,.021),(.736,.026)],rgb(0xc3b89e),True)
                lathe(name,"carLeather","Rounded adjustment center with recess",
                      [(0,.013,.013),(.003,.013,.013),(.003,.006,.006),(.001,.005,.005)],
                      rgb(0xafa58d),22,adjust(0,0,.026),"x",caps=False)
                for i in range(5):
                    angle=(i+.5)*tau/5
                    for shift in (-.090,-.030,.030,.090):
                        u,v=.031*cos(angle+shift),.031*sin(angle+shift)
                        _cord(name,"carLeather","Flute on adjustment wheel",[adjust(u,v,d) for d in (.007,.017)],
                              .00061,rgb(0xa99f88),sides=4)
            _pill(name,"carLeather","Driver seat recline release",
                  (x+side*.271,.353,-.047),.118,.041,.027,rgb(0xc4bba2),"x",.43)
        else:
            _pill(name,"carLeather","Passenger recline pivot at seat base",(x+side*.256,.384,-.068),
                  .041,.038,.021,rgb(0xa59d8a),"x",.84)
            _pill(name,"carLeather","Passenger seat recline lever",(x+side*.275,.385,-.046),
                  .079,.032,.024,rgb(0xb9af97),"x",.61)
        if side>0:
            root=_add(front(.982,.392),(-.003,0,-.045))
            _pill(name,"carLeather","Manual lumbar lever mounting collar",root,.025,.026,.019,
                  rgb(0xaa9f87),"x",.85)
            tube(name,"carLeather","Curved driver lumbar lever",
                 [(root,.010,.014),(_add(root,(.014,.014,-.014)),.009,.008),
                  (_add(root,(.021,.043,-.028)),.010,.007)],rgb(0xc0b69b),sides=10,density=4)
        front_bar=[(x-.133,.307,.405),(x-.138,.296,.464),(x+.135,.296,.460),(x+.142,.311,.402)]
        _cord(name,"plain","Bent slide release under seat",catmull(front_bar,4),.0061,rgb(0x292c2a),sides=8)
        receiver=(x-side*.277,.445,.007)
        _pill(name,"carLeather","Front seat-belt buckle receiver",receiver,.038,.087,.047,CABIN_BEIGE,"x",.62)
        _pill(name,"carLens","Red buckle release",_add(receiver,(0,.040,0)),.024,.029,.008,
              rgb(0xb75546),"y",.42)
        _letter(name,"gloss","PRESS",_add(receiver,(0,.0446,.003)),.0042,rgb(0xc98675),
                up=(0,0,-1),rise=.00007)
        box(name,"fabric","Bound carpet front mat",(x,.266,.629),(.459,.017,.414),SEDAN_CARPET,.008)
        box(name,"fabric","Bound carpet rear mat",(x,.265,-.456),(.461,.016,.348),SEDAN_CARPET,.007)
        for j in range(10):
            z=.480+j*.009
            box(name,"plain","Molded mat heel-pad rib",(x,.275,z),(.185,.0027,.0038),rgb(0x655b50),.001)
        belt=catmull([(side*.710,1.282,-.254),(side*.753,1.188,-.264),(side*.751,.871,-.290),
                      (side*.736,.567,-.308),(side*.684,.290,-.324)],6)
        rows_mesh(name,"fabric","B-pillar woven front belt",
                  [[_add(p,(0,0,-.021)),_add(p,(0,0,.021))] for p in belt],
                  rgb(0x968c7e),ring=False,caps=False)
        _pill(name,"carLeather","Seat belt height-adjustment plate inset in B-pillar trim",
              (side*.734,1.193,-.261),.068,.132,.037,rgb(0x938c79),"x",.55)
        _pill(name,"carLeather","Adjustable upper seatbelt guide",(side*.716,1.216,-.255),
              .053,.072,.031,CABIN_BEIGE,"x",.50)
        _pill(name,"carMetal","Seatbelt tongue",(side*.751,.905,-.277),.048,.037,.007,SEDAN_ALLOY,"x",.57)

    cushion("Broad rear seat cushion",(0,-.872),1.42,.548,True)

    def rear(u,v):
        t=2*u-1
        x=.709*t*(1-.025*v*v)
        headrest=.102*exp(-((abs(x)-.489)/.168)**2)*v**4
        y=.460+.429*v+headrest-.024*t*t
        z=-1.067-.162*v+.022*sin(pi*v)+.025*exp(-((abs(t)-.88)/.140)**2)
        return x,y,z

    def rear_reverse(u,v):
        x,y,z=rear(u,v)
        return .991*x,y-.015,z-.101

    _seat_skin(name,"Rear backrest with integrated head restraints",rear,rear_reverse,
               ((0,.093,False),(.093,.35,True),(.35,.65,False),(.65,.907,True),(.907,1,False)),
               (0,0,1))
    for side in (-1,1):
        anchor=(side*.711,1.010,-1.316)
        _pill(name,"carLeather","Rear shoulder belt guide on pillar",anchor,
              .059,.044,.025,rgb(0xaaa18f),"z",.53)

        def belt_edge(t,edge=0):
            x=side*blend(.658,.376,t)+edge*.018
            v=blend(.986,.112,t)+side*edge*.014
            u=.5+.5*x/(.709*(1-.025*v*v))
            return _add(rear(u,v),(0,0,.011+.005*(1-t)))

        belt_rows=[]
        for t in _range(11):
            row=[]
            for edge in (-1,1):
                top=_add(anchor,(edge*.018,-.006*side*edge,.012))
                end=belt_edge(0,edge)
                p=tuple(blend(a,b,t) for a,b in zip(top,end))
                row.append(_add(p,(0,0,.013*sin(pi*t))))
            belt_rows.append(row)
        belt_rows.extend([[belt_edge(i/31,edge) for edge in (-1,1)] for i in range(1,32)])
        rows_mesh(name,"fabric","Rear outboard diagonal seat belt",
                  belt_rows,rgb(0x9b9283),ring=False,caps=False)
        _pill(name,"carMetal","Rear belt tongue",_add(belt_edge(.67),(0,0,.004)),
              .046,.025,.006,SEDAN_ALLOY,"z")
        _pill(name,"carLeather","Rear buckle receiver",(side*.349,.481,-.908),.047,.035,.017,CABIN_BEIGE,"y")
        _pill(name,"carLens","Rear buckle red release",(side*.356,.498,-.903),.022,.021,.007,
              rgb(0xb3533d),"y",.47)
    arm=_outline([(-.145,-.186),(-.141,.183),(-.110,.205),(.112,.205),(.143,.181),
                  (.149,-.168),(.113,-.208),(-.113,-.208)],4)
    def rest(u,v,d):
        return u,.536+d-.035*v,-.839+v
    _bezel(name,"carLeather","Folded down rear leather armrest",arm,rest,
           [(.887,-.053),(1,-.030),(1,.034),(.943,.052)],rgb(0xc6b89c),True)
    _cord(name,"carLeather","Raised armrest binding",[rest(x*.938,z*.938,.052) for x,z in arm],
          .00125,rgb(0xaf9f84),sides=5,closed=True)
    _pill(name,"fabric","Shaped rear parcel shelf",(0,.942,-1.479),1.518,.421,.033,
          rgb(0x45443f),"y",.46)
    for side in (-1,1):
        _pill(name,"plain","Rear shelf speaker",(side*.508,.961,-1.462),.217,.130,.008,
              rgb(0x353733),"y",.59)


def _dash_face(x,y,depth=0):
    profile=((.50,.604),(.62,.626),(.75,.646),(.84,.642),(.885,.649),(.930,.669),(.986,.726))
    return (x,y,_profile(profile,y,1)+.018*(abs(x)/.75)**4-depth)


_DASH_WIDTH=.817
_DASH_FASCIA=((.737,.695),(.787,.667),(.840,.659),(.887,.667),(.922,.696),(.948,.747))
_DASH_RETURN=((.949,.784),(.929,.867),(.899,.931),(.851,.979),(.744,1.011),(.716,.821))
_DASH_END_OUTLET=_outline([(-.032,-.047),(-.037,-.034),(-.036,.031),(-.032,.049),
                           (-.017,.059),(.019,.056),(.034,.048),(.038,.033),
                           (.033,-.038),(.022,-.053),(-.018,-.055)],4)


def _dash_skin(x,y,z):
    taper=smooth(.61,.82,abs(x))
    sweep=.010*exp(-((x+.479)/.27)**2)
    return x,y-.031*taper+sweep*(1-smooth(.886,.951,y)),z+.026*taper


def _dash_fascia(x,y,depth=0):
    return _dash_skin(x,y,_profile(_DASH_FASCIA,y,1)+depth)


def _dash_outer_vent(side,u,v,depth=0):
    x=side*(.762+u+.080*v)
    return _dash_fascia(x,.867+v,depth)


def _end_dash_vent(name,side):
    role="Driver" if side>0 else "Passenger"
    face=lambda u,v,d:_dash_outer_vent(side,u,v,d)
    ring=_DASH_END_OUTLET
    _bezel(name,"carLeather",role+" edge vent flanged into dashboard",ring,face,
           [(1.080,.001),(1.060,-.003),(1,-.005),(.919,-.005),(.874,.004)],rgb(0x959486))
    _bezel(name,"plain",role+" airflow duct and recessed seat",ring,face,
           [(.884,.002),(.855,.010),(.781,.032),(.716,.039)],rgb(0x222622),True)
    for i in range(5):
        v=-.020+i*.014
        half=.0285-.0019*abs(i-2)
        section=((-.0024,.016),(.0016,.016),(.0024,.003),(.0013,-.0031),
                 (-.0008,-.0035),(-.0025,.0014))
        rows=[[face(blend(-half,half,u),v+h+.0016*sin(pi*u),depth) for h,depth in section]
              for u in _range(15)]
        rows_mesh(name,"carLeather","Molded horizontal "+role.lower()+" vent louver",rows,rgb(0x9d9b8c))
    for u in (-.019,.019):
        _cord(name,"plain","Vent linkage seated in the duct",
              [face(u,-.037,.038),face(u,-.028,.016),face(u,.038,.016),face(u,.045,.034)],
              .0024,rgb(0x484a41))
    wheel=face(-.006,-.038,-.0028)
    _pill(name,"plain","Recessed end vent thumbwheel seat",face(-.006,-.038,.0015),
          .035,.013,.011,rgb(0x41423b),"z",.52)
    _pill(name,"carLeather","Ribbed end vent control",wheel,.027,.0089,.008,
          rgb(0xa3a18d),"z",.72)
    for i in range(9):
        u=-.006+(i-4)*.0024
        _cord(name,"gloss","Fine thumbwheel ridge",[face(u,v,-.0072) for v in (-.041,-.036)],
              .00048,rgb(0x6f7063),sides=4)


def _dash_shell(name):
    count=48

    def section(u,v):
        return blend(-_DASH_WIDTH,_DASH_WIDTH,u),blend(_DASH_FASCIA[0][0],_DASH_FASCIA[-1][0],v)

    holes=[[(side*(.762+.980*u+.080*.980*v),.867+.980*v) for u,v in _DASH_END_OUTLET]
           for side in (-1,1)]
    _perforated_panel(name,"carLeather","Padded dashboard with two outer vent apertures",count,28,
                      section,_dash_fascia,holes,rgb(0x858578),flip=True)
    profile=(_DASH_FASCIA[-1],*_DASH_RETURN,_DASH_FASCIA[0])
    rows_mesh(name,"carLeather","Wrapped top and underside of the padded dash",
              [[_dash_skin(blend(-_DASH_WIDTH,_DASH_WIDTH,u),y,z) for y,z in profile]
               for u in _range(count+1)],rgb(0x858578),ring=False,caps=False)

    for side in (-1,1):
        x=side*_DASH_WIDTH
        end_trace=[_dash_fascia(x,y) for _,y in (section(0,t) for t in _range(29))]
        end_trace.extend(_dash_skin(x,y,z) for y,z in _DASH_RETURN)
        perimeter=[(z,y) for _,y,z in end_trace]
        duct_center=(.819,.844)
        duct=_elliptic(.073,.069,.85,42)

        def end(z,y):
            return x,y,z

        _perforated_surface(name,"carLeather","Dashboard end face and door-demister opening",perimeter,
                            [_offset_outline(duct,duct_center)],[],end,rgb(0x7f7d6f),flip=side>0)

        def duct_face(u,v,d):
            return side*(_DASH_WIDTH+d),duct_center[1]+v,duct_center[0]+u

        _bezel(name,"plain","Recessed round door demister port",duct,duct_face,
               [(1,0),(1.015,.003),(.930,.004),(.772,.001),(.698,-.015)],rgb(0x292d29))
        _bezel(name,"plain","Shadowed back of door demister port",duct,duct_face,
               [(.697,-.015),(.635,-.020)],rgb(0x151917),True)
        _pill(name,"carLeather","Round blanking cap at top of dash end face",
              (side*(_DASH_WIDTH+.001),.895,.802),.032,.032,.004,rgb(0x919082),"x",1)
        _end_dash_vent(name,side)


def _steering(name):
    center=(.430,.818,.517)
    vinyl=rgb(0x909084)
    emboss=rgb(0x7e7f73)
    def wheel(u,v,d=0):
        return _add(center,(u,v,d-.268*v))
    rings=[]
    for a in (tau*t for t in _range(91)):
        palm=1+.17*exp(-((abs(cos(a))-.92)/.24)**2)-.09*max(0,sin(a))
        row=[]
        for n in range(14):
            b=tau*n/14
            radial=.174+palm*.0158*cos(b)
            row.append(wheel(radial*cos(a),radial*sin(a),.016*sin(b)))
        rings.append(row)
    rows_mesh(name,"carLeather","Rounded molded steering rim with thumb relief",rings,vinyl,caps=False)

    for side in (-1,1):
        arm=_outline([(.065,.040),(.102,.036),(.156,.022),(.175,.018),(.173,-.009),
                      (.145,-.012),(.104,-.019),(.066,-.038)],4)
        _bezel(name,"carLeather","Molded upper spoke",arm,lambda x,y,d:wheel(side*x,y,d),
               [(1,.022),(1,.008),(.986,-.007),(.945,-.014)],vinyl,True)
        lower=_outline([(.049,-.042),(.079,-.041),(.085,-.060),(.089,-.097),
                        (.114,-.135),(.098,-.151),(.075,-.154),(.054,-.114),(.044,-.079)],4)
        _bezel(name,"carLeather","Slim lower steering spoke",lower,lambda x,y,d:wheel(side*x,y,d),
               [(1,.022),(1,.008),(.975,-.012),(.936,-.019)],vinyl,True)
        _cord(name,"gloss","Lower steering spoke joint",
              [wheel(side*x,y,-.020) for x,y in ((.050,-.067),(.060,-.068),(.071,-.067),(.080,-.061))],
              .00068,rgb(0x51564f),sides=4)
    pad=_outline([(-.087,.033),(-.072,.051),(-.036,.061),(0,.066),(.045,.061),(.082,.046),
                  (.090,.028),(.081,.001),(.063,-.028),(.057,-.062),(.042,-.077),
                  (-.043,-.077),(-.057,-.063),(-.065,-.027),(-.078,.004)],4)
    _bezel(name,"carLeather","Soft four-spoke airbag cover",pad,wheel,
           [(1,.025),(1.017,.009),(.986,-.023),(.959,-.029),(.895,-.031)],vinyl,True)
    _badge(name,wheel(0,.026,-.032),.055,"z",emboss,True,slot="carLeather",slope=-.268)
    for text,v,size in (("SRS",-.030,.0123),("AIRBAG",-.0368,.0073)):
        _letter(name,"carLeather",text,wheel(0,v,-.0314),size,emboss,right=(-1,0,0),
                up=(0,.966,-.259),rise=.00039,width=1.12)
    _cord(name,"carLeather","Shallow horizontal airbag cover crease",
          [wheel(blend(-.035,.035,t),-.016+.0013*sin(pi*t),-.0318) for t in _range(19)],.00081,emboss,sides=5)
    _line_mark(name,"Embossed horn",lambda u,v:wheel(u,-.004+v,-.0322),
               [(-.41,.28),(-.17,.13),(.24,.20),(.34,.32),(.34,-.32),(.16,-.19),(-.15,-.16),(-.41,-.22)],
               .010,.0048,emboss,.00042,True,"carLeather")
    _pill(name,"carLeather","Split steering column enclosure",(.430,.793,.602),.192,.105,.214,SEDAN_TRIM)
    for side in (-1,1):
        a=wheel(side*.070,-.004,.062)
        b=wheel(side*.175,.029,.070)
        _cord(name,"plain","Turn or wiper stalk",catmull([a,wheel(side*.115,.013,.073),b],4),
              .0087,SEDAN_BLACK,sides=12)
        _pill(name,"plain","Molded end of column stalk",b,.044,.027,.029,rgb(0x282d29),"z",.65)
        for d in (-.015,.014):
            pivot=_add(b,(d,0,0))
            lathe(name,"gloss","Rotating collar on stalk",[(-.003,.012,.013),(.003,.012,.013)],
                  rgb(0x454e4a),20,pivot,"x",caps=False)
        for j,txt in enumerate(("OFF","INT","LO") if side<0 else ("OFF","ON")):
            _letter(name,"gloss",txt,_add(b,(side*(j*.013-.014),-.003,-.0154)),.0049,DASH_MARK,
                    right=(-1,0,0),rise=.00008,width=.95)
    key_at=(.294,.753,.665)
    lathe(name,"carMetal","Ignition bezel",[(-.009,.019,.019),(-.007,.022,.022),(0,.022,.022)],
          SEDAN_ALLOY,24,key_at,axis="z",caps=False)
    _pill(name,"plain","Ignition key recess",key_at,.031,.031,.011,SEDAN_BLACK,"z",1)
    for txt,dx,dy in (("LOCK",.008,.012),("ACC",-.004,.015),("ON",-.012,.009),("START",-.015,-.004)):
        _letter(name,"gloss",txt,_add(key_at,(dx,dy,-.0092)),.0032,rgb(0x9fa89a),right=(-1,0,0),
                rise=.00008,width=.88)
    _cord(name,"carMetal","Cut ignition key",[key_at,(.300,.751,.629)],.0044,SEDAN_ALLOY,sides=5)
    _pill(name,"plain","Key bow",(.302,.737,.625),.033,.027,.010,SEDAN_BLACK)
    _cord(name,"carMetal","Split key ring",[(.304+.017*cos(tau*t),.716+.017*sin(tau*t),.620)
          for t in list(_range(25))[:-1]],.0018,SEDAN_CHROME,closed=True)
    _pill(name,"carLeather","Leather key fob",(.298,.682,.623),.023,.049,.011,rgb(0x64442c))
    for label,x,w,h in (("Brake",.521,.085,.060),("Accelerator",.362,.046,.110)):
        pivot=(x,.581,.801)
        box(name,"plain",label+" under-dash pivot bracket",pivot,(.046,.083,.092),rgb(0x43443d),.006)
        tube(name,"plain",label+" pedal arm from pivot to pad",[
            (pivot,.013,.012),((x,.455,.838),.012,.009),((x,.311,.780),.013,.010)
        ],rgb(0x343630),sides=8,density=5)
        _pill(name,"plain",label+" textured rubber pad",(x,.310,.769),w,h,.025,SEDAN_RUBBER)
        for t in _range(6):
            y=.310+blend(-h*.34,h*.34,t)
            _cord(name,"gloss","Pedal anti-slip ridge",[(x-w*.36,y,.755),(x+w*.36,y,.755)],
                  .0012,rgb(0x42443c))


def _tunnel(name):
    profiles=[(.267,.282,.815,.083,.239),(.345,.325,.859,.090,.222),
              (.451,.315,.844,.092,.209),(.480,.288,.834,.090,.209)]
    case(name,"carLeather","Molded center tunnel",profiles,SEDAN_TRIM)
    console=_outline([(-.135,-.213),(-.137,.137),(-.124,.230),(-.094,.257),(.094,.256),
                      (.126,.222),(.138,.115),(.137,-.171),(.101,-.232),(-.094,-.233)],4)
    def tray(u,v,d):
        return (u,.478+.156*(v+.13)**2+.015*smooth(.15,.257,v)+d,.344+v)
    oval=_elliptic(.146,.231,.47,44)
    gate=_offset_outline(oval,(.003,-.064))
    _bezel(name,"carWood","Rounded walnut console perimeter",console,tray,
           [(1,-.010),(1,.006),(.959,.014)],SEDAN_WALNUT)
    _perforated_surface(name,"carWood","Walnut gear trim with a real gate opening",
                        _offset_outline(console,(0,0),.959),[gate],
                        [(x,z) for z in (blend(-.210,.239,t) for t in _range(27))
                         for x in (-.123,-.094,-.057,0,.057,.094,.123)],
                        lambda u,v:tray(u,v,.014),SEDAN_WALNUT,flip=True)
    _bezel(name,"plain","Rounded selector plate in walnut opening",gate,tray,
           [(1,.010),(1,.016),(.970,.019),(.943,.019)],rgb(0x242a2a),True)
    slide=_offset_outline(_elliptic(.066,.193,.47,38),(-.026,-.058))
    _bezel(name,"gloss","Recessed straight automatic selector channel",slide,tray,
           [(1,.018),(1,.021),(.92,.023),(.85,.019)],rgb(0x151b1b),True)
    _bezel(name,"plain","Sliding black strip around shifter stalk",slide,tray,
           [(.846,.021),(.818,.023),(.784,.024)],rgb(0x3e4545),True)
    _cord(name,"gloss","Gear position strip bright edge",
          [tray(.024,blend(-.159,.026,v),.0197) for v in _range(29)],
          .00079,rgb(0x424b49),sides=5)
    for i,label in enumerate("PRND32L"):
        color=rgb(0xc9a23d) if i==1 else rgb(0x65a868) if i==2 else DASH_MARK
        _letter(name,"gloss",label,tray(.045,.012-i*.0267,.0206),.0126,color,
                right=(-1,0,0),up=(0,0,1),rise=.00008)
    _pill(name,"carLens","Small red park position marker",tray(.062,.014,.021),.007,.004,.0023,
          rgb(0xc34d3b),"y",.61)
    stem_base=tray(-.028,.021,.025)
    _pill(name,"plain","Dark ring at selector stem",stem_base,.039,.032,.009,DASH_FACE,"y",.82)
    stalk=[stem_base,(-.027,.542,.373),(-.025,.586,.386),(-.024,.611,.394)]
    _cord(name,"carMetal","Bright tubular selector stem",catmull(stalk,5),
          .0111,SEDAN_CHROME,sides=16)
    _pill(name,"carMetal","Lower handle chrome collar",(-.024,.590,.390),.027,.022,.017,
          SEDAN_ALLOY,"y",.84)
    knob=_outline([(-.021,-.050),(-.032,-.014),(-.038,.023),(-.029,.047),(-.009,.058),
                   (.016,.054),(.034,.040),(.034,.015),(.024,-.019),(.010,-.051)],5)
    def handle(x,y,d):
        return -.024+x,.643+y,.389+d+.19*y
    grip=_bezel(name,"plain","Tapered dimpled shift lever head",knob,handle,
                [(.84,.030),(.952,.021),(1,.006),(1,-.012),(.892,-.032),(.73,-.041)],
                rgb(0x252a2a),True)
    grip["finish_override"]="Grained shift knob"
    _pill(name,"plain","Circular thumb release seat",(.007,.641,.373),.030,.038,.011,
          rgb(0x161b1b),"x",.84)
    _pill(name,"gloss","Side-facing thumb release button",(.017,.641,.372),.022,.031,.017,
          rgb(0x363c3a),"x",.76)
    for i in range(3):
        x=.092-i*.052
        _pill(name,"plain","Individual console rocker",tray(x,.147,.020),.036,.047,.013,
              rgb(0x252c2a),"y",.38)
        _cord(name,"gloss","Rocker lower shoulder",
              [tray(x+u,.128,.026) for u in (-.013,.013)],.0011,rgb(0x464e48),sides=4)
    _letter(name,"gloss","ECT",tray(.040,.155,.027),.0085,DASH_MARK,right=(-1,0,0),up=(0,0,1),rise=.00008)
    _letter(name,"gloss","HOLD",tray(.040,.135,.027),.0064,DASH_MARK,right=(-1,0,0),up=(0,0,1),rise=.00008)
    _pill(name,"plain","Rectangular two-well coin pocket",tray(-.077,.157,.018),.066,.050,.010,
          rgb(0x1c2421),"y",.40)
    _cord(name,"gloss","Raised divider between coin slots",
          [tray(-.077,v,.024) for v in (.136,.179)],.00165,rgb(0x4a5147),sides=5)
    _pill(name,"plain","Power outlet housing",(0,.516,.610),.128,.049,.021,rgb(0x312b24),"z",.47)
    _pill(name,"plain","Round snap-on accessory power outlet cap",(.014,.514,.592),.033,.033,.016,
          rgb(0x222824),"z",1)
    for text,y in (("POWER",.516),("OUTLET",.509)):
        _letter(name,"gloss",text,(.014,y,.5835),.005,rgb(0x7d8575),right=(-1,0,0),rise=.00008)
    brake=[(.113,.463,.017),(.126,.486,.118),(.137,.517,.223)]
    tube(name,"carLeather","Molded tan parking brake grip",[(brake[0],.022,.023),
         (brake[1],.024,.022),(brake[2],.019,.018)],rgb(0x989481),sides=14,density=4)
    _pill(name,"carMetal","Parking brake release button",(.138,.520,.239),.017,.017,.016,rgb(0xa6a599))
    box(name,"carLeather","Armrest storage base",(0,.411,-.120),(.270,.192,.316),SEDAN_TRIM,.026)
    box(name,"plain","Visible center storage well",(0,.510,-.118),(.219,.028,.259),DASH_FACE,.011)
    _pill(name,"plain","Rear ash receiver surround",(0,.382,-.287),.126,.079,.027,SEDAN_BLACK,"z",.50)
    _pill(name,"gloss","Recessed rear ash receiver handle",(0,.398,-.302),.073,.011,.007,
          rgb(0x50544a),"z",.46)


def _dashboard():
    name=_sedan_asset("dashboard")
    _dash_shell(name)
    _dash_bulkhead(name)
    knee=_outline([(-.296,-.053),(-.290,.038),(-.243,.079),(.229,.087),(.286,.050),
                    (.291,-.041),(.233,-.064),(-.235,-.064)],4)
    _bezel(name,"carLeather","Tapered driver knee bolster",knee,
           lambda u,v,d:(.470+u,.655+v,.695+d+.075*(u/.310)**2-.20*v),
           [(1,.127),(1,.035),(.980,.012),(.938,.002)],SEDAN_TRIM,True)
    _pill(name,"carLeather","Lower glovebox fascia",(-.480,.560,.927),.574,.052,.145,
          rgb(0x707162),"z",.48)
    _pill(name,"plain","Driver lower dash cover seam",(.548,.614,.708),.191,.043,.008,rgb(0x444840),"z",.43)
    _pill(name,"carLeather","Driver lower dash service cover",(.548,.614,.701),.179,.034,.008,
          rgb(0x787a6e),"z",.49)
    for side in (-1,1):
        for i in range(12):
            x=side*(.249+i*.033)
            box(name,"plain","Windscreen demister slot",(x,.929,.866),(.018,.004,.043),rgb(0x44463d),.001)
        outline=_outline([(.342,.230),(.377,.309),(.544,.418),(.686,.581),
                          (.936,.735),(.986,.635),(.985,.280),(.941,.228)],4)
        _bezel(name,"carLeather","Molded outer front footwell kick panel",outline,
               lambda z,y,d:(side*(.807-.029*smooth(.240,.590,y)-d),y,z),
               [(1,-.017),(1,0),(.980,.009),(.944,.011)],rgb(0x7b786b),True)
    _cluster(name)
    _steering(name)
    _center_stack(name)
    _tunnel(name)

    def footrest(u,v,d):
        return .688+u,.338+v*.82+d,.836+v*.57-d*.57
    shape=_elliptic(.082,.179,.52,38)
    _bezel(name,"plain","Molded rubber driver footrest",shape,footrest,
           [(1,-.020),(1,-.003),(.94,.001),(.90,.004)],rgb(0x333330),True)
    for i in range(10):
        v=(i-4.5)*.014
        _cord(name,"gloss","Rib across driver footrest",
              [footrest(u,v,.005) for u in (-.027,0,.027)],.00155,rgb(0x494743),sides=5)


def _footwells():
    foot=_sedan_asset("footwells")
    def carpet(u,v):
        x=blend(-.811,.811,u)
        z=blend(-1.279,1.096,v)
        sill=.010*smooth(.662,.811,abs(x))
        toe=.223*smooth(.820,1.096,z)
        return x,.258-sill+toe,z
    _panel(foot,"fabric","Fitted carpet following sill and toe board",36,64,carpet,SEDAN_CARPET,flip=True)


def _dash_bulkhead(name):
    def firewall(u,v):
        side=2*u-1
        y=blend(.428,.929,v)-.008*side*side
        z=blend(1.082,.891,smooth(.30,1,v))+.017*(1-side*side)
        return side*blend(.783,.907,smooth(.14,.80,v)),y,z

    _panel(name,"plain","Stamped firewall and cowl behind the dash",40,25,firewall,
           rgb(0x363832),flip=True)
    for side in (-1,1):
        def jamb(u,v):
            edge=firewall(0 if side<0 else 1,v)
            brace=(side*blend(.800,.897,v),edge[1],blend(.955,.825,v))
            return _lerp(edge,brace,u)

        _panel(name,"carLeather","Inner A-pillar return behind the door hinge",
               10,24,jamb,rgb(0x686859),flip=side<0)


def _glove_box():
    name=_sedan_asset("glove_box",(-.474,.589,.841))
    flap=_outline([(-.258,-.055),(-.256,.059),(-.237,.077),(.221,.077),(.252,.064),
                    (.258,-.052),(.226,-.079),(-.225,-.079)],4)
    def glove_face(x,y,d):
        return -.474+x,.677+y,.712+.051*(x/.27)**2-.53*y+d
    trim=rgb(0x828375)
    pocket=_elliptic(.110,.038,.39,34)
    face_samples=[(blend(-.251,.251,u),blend(-.075,.075,v)) for u in _range(29) for v in _range(14)]
    _bezel(name,"carLeather","Radiused glovebox edge",flap,glove_face,
           [(1,.007),(1,.003),(.985,-.002),(.951,-.007)],trim)
    _perforated_surface(name,"carLeather","Radiused glovebox front panel",
                        _offset_outline(flap,(0,0),.951),[_offset_outline(pocket,(0,.038))],face_samples,
                        lambda u,v:glove_face(u,v,-.007),trim,flip=True)
    _perforated_surface(name,"carLeather","Glovebox molded back",flap,[],face_samples,
                        lambda u,v:glove_face(u,v,.007),rgb(0x706e61))
    def latch(u,v,d):
        return glove_face(u,.038+v,d)
    pivot=ASSETS[name]["sedan"]["at"]
    ASSETS[name]["anchors"]={"hinge":pivot,"pull":_add(latch(0,0,-.019),_scale(pivot,-1))}
    _bezel(name,"plain","Glovebox handle recess",pocket,latch,
           [(1,-.007),(1,-.011),(.93,-.012),(.84,-.011)],rgb(0x4d5047),True)
    _bezel(name,"carLeather","Contour of glove box pull lever",pocket,latch,
           [(.73,-.011),(.75,-.018),(.65,-.019)],rgb(0x8e8b7b),True)
    _pill(name,"plain","Glovebox lock key slot",latch(0,.005,-.021),
          .011,.012,.003,SEDAN_BLACK,"z",1)
    def tray(u,v,depth=0):
        # Rotate the open tray back around the hinge and recess it behind the curved door.
        dy=.532+.40*v+depth-pivot[1]
        dz=.691+v-pivot[2]
        return (-.474+u,pivot[1]+dy*cos(1.05)-dz*sin(1.05),
                pivot[2]+dy*sin(1.05)+dz*cos(1.05)+.044)
    outline=_outline([(-.237,.086),(-.238,.201),(-.217,.216),(.217,.216),(.238,.201),
                      (.237,.086),(.156,.044),(.085,.024),(-.087,.024),(-.158,.045)],3)
    _bezel(name,"carLeather","Open glove compartment tray floor",outline,tray,
           [(1,-.008),(1,-.004),(.972,0)],rgb(0x525047),True)
    for side in (-1,1):
        x=pivot[0]+side*.228
        knuckle=[(x,.601,.728),(x,.582,.758),(x,.574,.804),(x,.589,.841)]
        tube(name,"carLeather","Glovebox hinge arm from panel into pivot",
             [(p,.012,.009) for p in knuckle],rgb(0x6d6657),sides=10,density=4)
        lathe(name,"carLeather","Glovebox rotating hinge knuckle",
              [(-.015,.010,.010),(.015,.010,.010)],rgb(0x5f584d),16,(x,.589,.841),"x")
    wall=((.075,-.005),(.208,-.010),(.210,.073),(.188,.086),(.132,.057),(.079,.013))
    for side in (-1,1):
        rows_mesh(name,"carLeather","Shaped triangular glovebox side retainer",
                  [[tray(side*u,v,d) for v,d in wall] for u in (.225,.237)],rgb(0x666256),soft=False)
        _cord(name,"plain","Rubber latch stop inside glovebox",
              [tray(side*.223,v,.067) for v in (.172,.196)],.006,rgb(0x363530),sides=8)
    _panel(name,"gloss","Printed glovebox insert",14,8,
           lambda u,v:tray(blend(-.126,.102,u),blend(.040,.125,v),.0011),rgb(0xcccabf),flip=True)
    for i in range(6):
        width=.095 if i<5 else .067
        _cord(name,"plain","Glovebox insert text rule",
              [tray(u,.054+i*.011,.0015) for u in (-width-.012,.014,width-.012)],
              .00054,rgb(0x64675e),sides=4)


def _cabin_storage():
    name=_sedan_asset("console_lid",(0,.509,-.270))
    top=_outline([(-.134,-.132),(-.133,.132),(-.099,.168),(.103,.169),(.134,.135),
                  (.137,-.135),(.098,-.168),(-.100,-.166)],4)
    def arm(u,v,d):
        return u,.545+d-.025*v,-.121+v
    _bezel(name,"fabric","Rounded cloth-covered armrest lid",top,arm,
           [(.91,-.032),(1,-.008),(1,.018),(.963,.034)],rgb(0xbeb39e),True)
    _cord(name,"fabric","Trim seam along center armrest",
          [arm(u*.96,v*.96,.031) for u,v in top],.00094,rgb(0xa79d89),closed=True,sides=5)
    _pill(name,"carWood","Burlwood armrest latch insert",arm(0,.158,-.002),.119,.032,.025,
          SEDAN_WALNUT,"y",.58)
    name=_sedan_asset("ashtray_drawer",(0,.540,.626))
    _pill(name,"carWood","Tucked-in ash drawer face",(0,.547,.601),.188,.077,.039,SEDAN_WALNUT,"z",.44)
    _pill(name,"carMetal","Drawer fingernail ledge",(0,.549,.576),.084,.013,.010,rgb(0x85867b))
    box(name,"plain","Ash drawer tray pocket",(0,.516,.677),(.172,.022,.100),DASH_FACE,.007)
    name=_sedan_asset("ashtray")
    box(name,"carMetal","Removable stamped ashtray tub",(0,.014,0),(.158,.023,.086),rgb(0x626963),.005)
    for side in (-1,1):
        box(name,"carMetal","Raised ashtray rim",(side*.072,.031,0),(.012,.029,.086),SEDAN_ALLOY,.004)
        box(name,"carMetal","Raised ashtray rim",(0,.031,side*.038),(.147,.029,.011),SEDAN_ALLOY,.004)
    for i in range(3):
        _cord(name,"plain","Pressed cigarette rests",[(-.051+i*.038,.041,.030),(-.051+i*.038,.041,.044)],
              .0029,rgb(0x50554f))
    name=_sedan_asset("lighter")
    lathe(name,"carMetal","Removable lighter steel sleeve",[(-.017,.014,.014),(.016,.013,.013),(.023,.009,.009)],
          SEDAN_ALLOY,20,(0,.019,0),"z")
    lathe(name,"plain","Black cigarette lighter handle",[(-.042,.019,.019),(-.038,.021,.021),(-.017,.019,.019)],
          DASH_FACE,22,(0,.019,0),"z")
    def lighter(x,y):
        return x,.019+y,-.0437
    _line_mark(name,"Lighter cigarette pictogram",lighter,
               [(-.44,-.20),(.37,-.20),(.37,-.04),(-.44,-.04)],.017,.015,DASH_MARK,.00055,True)
    _line_mark(name,"Lighter smoke pictogram",lighter,[(.34,.041),(.15,.15),(.24,.33),(.21,.45)],
               .016,.013,DASH_MARK,.00052)
    name=_sedan_asset("door_lock")
    _pill(name,"plain","Domed lock button",(0,-.007,0),.032,.076,.032,SEDAN_BLACK,"y",.51)
    _pill(name,"carLens","Visible lock dot",(0,.008,-.008),.015,.026,.005,rgb(0x974c3b),"y",.60)
