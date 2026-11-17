"""Rotating assemblies, positive tire markings and visible engine-bay hardware."""


def _wheel_models():
    tire=_sedan_asset("tire")
    outer_sidewall=[(.099,.301),(.115,.284),(.127,.267),(.133,.245),
                    (.129,.221),(.119,.200),(.108,.191)]
    sections=[(-.106,.195),(-.121,.231),(-.117,.266),(-.105,.293),(-.088,.310),
              (-.072,.317),(-.062,.314),(-.054,.319),(-.034,.319),(-.026,.314),
              (-.018,.319),(.009,.319),(.019,.314),(.026,.319),(.049,.319),
              (.058,.314),(.067,.319),(.082,.315),*outer_sidewall,(-.103,.191)]
    count=61*8
    shape=[]
    for x,r in sections:
        tread=1-smooth(.102,.116,abs(x))
        points=[]
        for i in range(count):
            a=tau*i/count
            s=min(1.15,abs(x)/.104)
            phase=a*61+5.1*s-3.7*s*s+.82*sin(pi*s)
            channel=(.5+.5*cos(phase))**5
            sipe=(.5+.5*cos(phase+pi+.42*s))**9
            radius=r-tread*(.0038*channel+.00125*sipe)
            points.append((x,cos(a)*radius,sin(a)*radius))
        shape.append(points)

    shoulder=tuple((r,x) for x,r in reversed(outer_sidewall))
    def sidewall(r):
        for (r0,x0),(r1,x1) in zip(shoulder,shoulder[1:]):
            if r <= r1:
                return blend(x0,x1,max(0,(r-r0)/(r1-r0)))
        return shoulder[-1][1]

    def rubber(p):
        x,y,z=p
        a=atan2(z,y)
        r=sqrt(y*y+z*z)
        s=min(1.15,abs(x)/.104)
        tread=(.5+.5*cos(a*61+5.1*s-3.7*s*s+.82*sin(pi*s)))**5
        stain=.96+.045*sin(a*47)+.09*smooth(.270,.319,r)-.30*tread*(1-smooth(.102,.116,abs(x)))
        return tone(rgb(0x222323),stain)
    rows_mesh(tire,"carTire","Molded directional tread and curved sidewalls",shape+[shape[0]],rubber,caps=False,
              uv=lambda p:(atan2(p[2],p[1])/(tau)+.50,p[0]*4+.5))
    for r,w in ((.237,.00066),(.291,.00084),(.294,.00053)):
        _cord(tire,"carTire","Fine sidewall mold line",[(sidewall(r),r*cos(a),r*sin(a)) for a in
              (i*tau/108 for i in range(108))],w,rgb(0x2e3030),closed=True,sides=4)
    _tire_lettering(tire,sidewall)
    for text,a,r,size,step in (
        ("KH16  P205/65R15",1.43,.226,.011,.058),
        ("RADIAL TUBELESS",-1.57,.225,.007,.046),
    ):
        for i,glyph in enumerate(text):
            if glyph==" ":
                continue
            angle=a+((len(text)-1)/2-i)*step
            ca,sa=cos(angle),sin(angle)
            _letter(tire,"carTire",glyph,(sidewall(r)+.0005,r*ca,r*sa),size,rgb(0x292a29),
                    right=(0,sa,-ca),up=(0,ca,sa),rise=.00055)

    wheel=_sedan_asset("hub")
    alloy=rgb(0xbec2bc)
    lathe(wheel,"carMetal","Polished rolled rim lip",
          [(.105,.179,.179),(.115,.200,.200),(.126,.205,.205),(.135,.205,.205),(.142,.200,.200),
           (.145,.193,.193),(.141,.186,.186),(.123,.183,.183),(.106,.185,.185)],
          SEDAN_ALLOY,sides=88,axis="x",caps=False)
    lathe(wheel,"plain","Wheel barrel",[(.035,.178,.178),(.119,.183,.183)],rgb(0x454743),64,axis="x",caps=False)
    lathe(wheel,"carMetal","Visible brake rotor",[(.060,.138,.138),(.070,.141,.141),(.076,.135,.135)],
          rgb(0x737570),48,axis="x")
    _pill(wheel,"plain","Cast brake caliper",(.089,.090,-.079),.109,.049,.051,rgb(0x625c4d),"x",.58)

    # The seven openings and the four counterbores belong to one cast wheel face.
    windows=[]
    window_shape=_outline([(.108,0),(.113,-.013),(.132,-.030),(.157,-.044),(.176,-.048),
                           (.184,-.035),(.188,-.015),(.187,.017),(.180,.039),(.169,.046),
                           (.147,.039),(.126,.026),(.112,.010)],4)
    for i in range(7):
        angle=tau*i/7-.099
        c,s=cos(angle),sin(angle)
        window=[(c*r-s*t,s*r+c*t) for r,t in window_shape]
        windows.append((window,(c*.158,s*.158)))
    bolt_circle=[(.054*cos(tau*i/4+.344),.054*sin(tau*i/4+.344)) for i in range(4)]
    counterbore=_elliptic(.031,.031,1,32)
    outer=_elliptic(.389,.389,1,112)
    bores=[_offset_outline(counterbore,center) for center in bolt_circle]
    samples=[(0,0)]+[(r*cos(a),r*sin(a)) for r in (.021,.036,.074,.088,.112,.143,.170,.189)
                     for a in (tau*i/98 for i in range(98))]

    def face(y,z,inset=0):
        r=sqrt(y*y+z*z)
        x=.143+.009*(1-(r/.195)**1.25)+.0044*exp(-((r-.120)/.042)**2)
        return x+inset,y,z

    _perforated_surface(wheel,"carMetal","Continuous cast seven-spoke wheel face",outer,
                        [*(window for window,_ in windows),*bores],samples,face,alloy)
    for outline,(cy,cz) in windows:
        def wall(y,z,scale,depth):
            return face(blend(cy,y,scale),blend(cz,z,scale),depth)
        rows_mesh(wheel,"carMetal","Rounded alloy window wall",
                  [[wall(y,z,scale,depth) for y,z in outline]
                   for scale,depth in ((1,0),(.966,-.003),(.914,-.009),(.855,-.018),(.841,-.024))],
                  rgb(0xb2b8b4),caps=False)
    lathe(wheel,"carMetal","Center cap bright ring",[(.151,.027,.027),(.157,.027,.027),(.159,.024,.024)],
          rgb(0x98958a),48,axis="x",caps=False)
    lathe(wheel,"plain","Inset center cap",[(.154,.024,.024),(.157,.023,.023),(.158,.021,.021)],
          rgb(0x303232),48,axis="x")
    for cy,cz in bolt_circle:
        def seat(y,z,depth):
            return face(cy+y,cz+z,depth)
        _bezel(wheel,"carMetal","Machined recess for lug nut",counterbore,seat,
               [(1,0),(.970,-.003),(.808,-.011),(.759,-.024)],rgb(0x777a72))
        where=(0,cy,cz)
        lathe(wheel,"plain","Shadow inside lug bore",[(.126,.013,.013),(.132,.012,.012)],
              rgb(0x302f29),24,where,"x")
        lathe(wheel,"carMetal","Recessed hex wheel nut",[(.128,.008,.008),(.143,.0075,.0075),(.147,.0055,.0055)],
              rgb(0xb9b4a5),6,where,"x")
    _cord(wheel,"plain","Rubber tire valve stem",[(.138,-.162,-.095),(.151,-.158,-.090),
          (.165,-.150,-.084)],.0048,SEDAN_RUBBER)
    _pill(wheel,"carMetal","Valve tip",(.165,-.150,-.084),.007,.008,.008,rgb(0x6d7068),"x")
    _pill(wheel,"carMetal","Clip-on wheel balance weight",(.136,.156,.117),.012,.015,.022,
          rgb(0x82847a),"x",.47)


def _engine_and_boot():
    name=_sedan_asset("engine_and_boot")
    records=ASSETS[name]["records"]
    upright={}

    def mark(slot,text,at,size,color,**options):
        label=_letter(name,slot,text,at,size,color,**options)
        if label:
            upright[label]=at[0]

    black=rgb(0x292e2d)
    steel=rgb(0x767b76)
    aluminum=rgb(0xa9aaa0)
    yellow=rgb(0xd5ba40)
    gray=rgb(0x414543)
    _pill(name,"plain","Pressed engine compartment floor",(0,.327,1.676),1.443,1.147,.089,black,"y",.40)
    box(name,"gloss","Insulated firewall",(0,.647,1.076),(1.497,.395,.062),rgb(0x454943),.016)
    box(name,"carMetal","Dark stamped upper radiator crossmember",
        (0,.621,2.125),(1.494,.065,.128),rgb(0x434b48),.019)
    box(name,"plain","Radiator assembly",(0,.508,2.155),(1.095,.190,.103),black,.020)
    for i in range(36):
        x=(i-17.5)*.028
        box(name,"carMetal","Fine radiator cooling fin",(x,.531,2.211),(.005,.140,.008),rgb(0x515955),.001)
    for side in (-1,1):
        at=(side*.573,.653,2.144)
        lathe(name,"plain","Rubber radiator locating grommet",
              [(0,.027,.027),(.007,.027,.027),(.011,.021,.021),(.011,.009,.009)],
              rgb(0x2b302e),26,at,caps=False)
        lathe(name,"carMetal","Radiator isolator center ring",[(0,.010,.010),(.006,.010,.010)],
              rgb(0x6f756d),16,_add(at,(0,.003,0)),caps=False)
    for side in (-1,1):
        x=side*.668
        _pill(name,"carMetal","Painted rolled fender flange",(x,.745,1.611),.124,1.035,.076,
              rgb(0x414b47),"y")
        lathe(name,"carMetal","Stamped strut tower",[(.000,.149,.149),(.034,.149,.149),(.082,.107,.107),(.091,.086,.086)],
              rgb(0x505a53),40,(side*.595,.689,1.486))
        lathe(name,"plain","Suspension top hat",[(0,.075,.075),(.016,.068,.068),(.041,.046,.046)],
              black,24,(side*.595,.769,1.486))
        for i in range(3):
            a=i*tau/3+.27
            lathe(name,"carMetal","Strut mounting nut",[(0,.011,.011),(.016,.010,.010)],
                  aluminum,6,(side*.595+.092*cos(a),.767,1.486+.092*sin(a)))
        _cord(name,"plain","Engine bay weather strip",[(side*.720,.759,1.11),(side*.742,.769,1.612),
              (side*.685,.706,2.069)],.010,SEDAN_RUBBER)

    box(name,"carMetal","Transverse DOHC block",(.128,.577,1.627),(.717,.352,.572),steel,.051)
    rocker_top=.823
    case(name,"plain","Sculpted transverse rocker cover",[(.713,.651,.439,.050,1.636),
         (.764,.655,.428,.052,1.620),(.798,.603,.392,.053,1.616),
         (rocker_top,.575,.377,.056,1.611)],black)
    cover=_outline([(-.313,-.036),(-.264,-.088),(.215,-.088),(.321,-.055),(.317,.073),(-.283,.077)],3)
    _bezel(name,"carMetal","Bright 16-valve cover casting",cover,
           lambda u,v,d:(.122+u,.775+d-.16*v,1.830+v),
           [(1,-.022),(1,.001),(.94,.014)],aluminum,True)
    mark("carMetal","DOHC 16 VALVE",(.120,0,1.858),.049,rgb(0x939488),
         up=(0,0,-1),rise=.00088,width=1.07,
         project=lambda x,y,z:(x,.7894-.16*(z-1.830)+y,z))
    oil=(.152,rocker_top-.003,1.479)
    # The molded mark sits just ahead of the filler cap on the outer shoulder.
    badge=(oil[0]+.012,rocker_top,oil[2]+.101)
    badge_start=len(records)
    _badge(name,badge,.103,"y",rgb(0x49514d),slot="gloss")
    upright.update((piece,badge[0]) for piece,*_ in records[badge_start:])
    for i in range(5):
        z=1.558+i*.032
        _cord(name,"plain","Valve cover ribs",[(.026,.825,z),(-.047,.826,z),(-.144,.823,z+.011)],.0043,gray)
    for x,z in ((-.134,1.686),(.310,1.676),(-.144,1.522),(.280,1.503)):
        lathe(name,"carMetal","Valve cover retaining nut",[(0,.010,.010),(.011,.009,.009)],aluminum,6,(x,.807,z))
    lathe(name,"plain","Oil filler cap",[(0,.047,.047),(.009,.051,.051),(.021,.049,.049),(.027,.044,.044)],
          black,24,oil)
    for i in range(10):
        a=i*tau/10
        at=_add(oil,(.048*cos(a),.017,.048*sin(a)))
        box(name,"plain","Cross-hatched cap grips",at,(.012,.012,.010),gray,.002,-a)
    mark("gloss","ENGINE OIL",_add(oil,(0,.0273,0)),.008,rgb(0x79786a),up=(0,0,-1),rise=.00014)

    heat=_outline([(-.245,-.046),(-.220,-.101),(.209,-.103),(.246,-.047),(.211,.077),(.133,.118),
                   (-.155,.120),(-.225,.047)],4)
    def shield(u,v,d):
        return (.127+u,.665-.48*v+d,1.969+v)
    _bezel(name,"carMetal","Pressed exhaust heat shield",heat,shield,
           [(1,-.014),(1,.006),(.91,.046),(.75,.057)],rgb(0x9c9f94),True)
    for z in (.026,.056,.089):
        _cord(name,"carMetal","Heat shield pressed ridge", [shield(lerp_u,z+.008*(lerp_u/.18)**2,.048)
              for lerp_u in (-.163,-.103,0,.103,.163)],.005,rgb(0x8e9488))
    mark("carMetal","HOT",(.127,0,1.924),.035,rgb(0x82877e),up=(0,0,-1),rise=.00046,
         project=lambda x,y,z:shield(x-.127,z-1.969,.0579+y))
    _cord(name,"carMetal","Stamped heat warning border",
          [shield(x,z-.044,.0583) for x,z in _elliptic(.118,.049,.43,32)],
          .00082,rgb(0x898c81),closed=True,sides=5)
    _cord(name,"gloss","Yellow oil dipstick grip",catmull([(.422,.696,1.920),(.412,.719,1.954),
          (.435,.719,1.967),(.445,.705,1.933)],4),.0045,yellow,closed=True)
    for x in (-.05,.306):
        lathe(name,"carMetal","Heat shield screw",[(0,.009,.009),(.009,.008,.008)],steel,6,(x,.713,1.944))

    box(name,"carMetal","Cast intake plenum",(.087,.720,1.260),(.550,.141,.147),rgb(0x868c85),.043)
    for i in range(4):
        x=.291-i*.138
        _cord(name,"carMetal","Rounded intake runner",catmull([(x,.728,1.244),(x,.709,1.348),
              (x,.666,1.369),(x,.630,1.467)],4),.030,rgb(0x878b80),sides=10)
    box(name,"plain","Air cleaner lower case",(-.426,.649,1.513),(.294,.205,.350),black,.023)
    box(name,"plain","Air cleaner cover",(-.426,.764,1.510),(.308,.044,.352),black,.015)
    for i in range(8):
        x=-.551+i*.035
        _cord(name,"gloss","Air box molding fins",[(x,.780,1.372),(x,.793,1.420),(x,.791,1.658)],.004,gray)
    air=catmull([(-.403,.779,1.399),(-.340,.798,1.290),(-.220,.803,1.230),(-.167,.793,1.253)],6)
    _cord(name,"plain","Rubber air intake elbow",air,.054,SEDAN_RUBBER,sides=15)
    for i in range(1,len(air)-1):
        p=air[i]
        tangent=(Vector(air[i+1])-Vector(air[i-1])).normalized()
        along=tangent.cross(Vector((0,1,0))).normalized()
        up=tangent.cross(along)
        width=.060 if i not in (1,len(air)-2) else .062
        loop=[tuple(Vector(p)+width*(along*cos(a)+up*sin(a))) for a in (j*tau/16 for j in range(16))]
        _cord(name,"carMetal" if i in (1,len(air)-2) else "plain","Intake elbow ring",loop,.0036,
              SEDAN_ALLOY if i in (1,len(air)-2) else gray,closed=True,sides=4)

    box(name,"plain","Off-white molded battery case",(-.447,.604,1.864),(.311,.239,.316),
        rgb(0x909388),.022)
    box(name,"plain","Battery black lid",(-.447,.739,1.864),(.320,.061,.326),black,.017)
    box(name,"gloss","Battery lid parting line",(-.447,.713,1.864),(.312,.008,.326),rgb(0x3c3f36),.010)
    for i in range(5):
        z=1.746+i*.058
        _cord(name,"plain","Molded white ribs in battery wall",[(-.291,.548,z),(-.290,.687,z)],
              .0029,rgb(0x7a7c73),sides=5)
    _cord(name,"gloss","Yellow battery handle",catmull([(-.517,.767,1.905),(-.518,.783,1.825),
          (-.399,.783,1.825),(-.393,.767,1.905)],3),.010,yellow,sides=7)
    for x,col in ((-.535,rgb(0x907669)),(-.363,rgb(0x9a4b37))):
        lathe(name,"carMetal","Battery terminal and clamp",[(0,.017,.017),(.018,.015,.015),(.022,.010,.010)],
              col,12,(x,.760,1.958))
        _cord(name,"plain","Battery circuit protection cable",catmull([(x,.775,1.959),(x-.064,.749,2.048),
              (x-.117,.700,2.084)],5),.008,SEDAN_RUBBER)
        lathe(name,"carMetal","Battery clamp hex nut",[(0,.007,.007),(.005,.007,.007)],
              SEDAN_ALLOY,6,(x+.014,.780,1.958))
    box(name,"plain","Fuse and relay cover",(-.630,.690,1.625),(.162,.149,.198),rgb(0x414442),.018)
    mark("gloss","FUSE  RELAY",(-.630,.767,1.622),.012,rgb(0x75796a),up=(0,0,-1),rise=.00018)
    for x,z,w,col in ((.606,1.923,.128,rgb(0x368694)),(.582,1.752,.143,rgb(0x696f5d)),
                      (-.537,1.189,.107,rgb(0x313830))):
        _pill(name,"gloss","Molded fluid reservoir",(x,.655,z),w,.116,.166,rgb(0xbfc2a1),"y",.68)
        lathe(name,"plain","Fluted fluid reservoir lid",[(0,.032,.032),(.010,.036,.036),(.023,.031,.031)],
              col,20,(x,.733,z))
    _cord(name,"plain","Upper radiator hose",catmull([(-.228,.692,1.812),(-.179,.661,1.967),
          (-.135,.643,2.053),(.012,.638,2.110)],4),.022,SEDAN_RUBBER,sides=12)
    for i in range(5):
        _cord(name,"plain","Wrapped control harness",catmull([( .431-i*.013,.768,1.448),
              (.493-i*.012,.797,1.289),(.412-i*.007,.789,1.133),(.235-i*.026,.798,1.109)],3),
              .005,SEDAN_RUBBER)
    lathe(name,"carMetal","Pressure filler cap",[(0,.033,.033),(.012,.032,.032)],aluminum,24,(-.224,.660,2.137))
    _pill(name,"gloss","Yellow pressure cap warning",(-.224,.674,2.137),.054,.045,.004,yellow,"y",.84)
    box(name,"gloss","Cooling safety sticker",(.296,.659,2.134),(.106,.002,.041),yellow,.001)
    mark("plain","CAUTION",(.296,.661,2.132),.010,rgb(0x403c27),up=(0,0,-1),rise=.00010)
    _cord(name,"carMetal","Hood prop rod retained in clip",[(.493,.679,2.135),(.342,.681,2.126),
          (-.345,.681,2.099)],.0046,steel)

    # Reference 24 places the battery and intake on the right looking into the
    # bay from the bumper. Move the labels with their castings without reversing them.
    bay=Matrix.Translation(blender_point((0,.029,.056))) @ Matrix.Diagonal((-.979,.886,.889,1))
    mirror_x=Matrix.Diagonal((-1,1,1,1))
    for component,*_ in records:
        if component in upright:
            center=Matrix.Translation((2*upright[component],0,0))
            component.data.transform(bay @ center @ mirror_x)
        else:
            component.data.transform(bay)
            component.data.flip_normals()

    felt=rgb(0x555454)
    _pill(name,"fabric","Full shaped trunk carpet",(0,.343,-1.796),1.402,.912,.053,felt,"y",.37)
    box(name,"fabric","Lined rear seat bulkhead",(0,.586,-1.351),(1.390,.446,.068),felt,.022)
    _pill(name,"plain","Inset behind rear upper trim cover",(0,.757,-1.391),.151,.073,.013,
          rgb(0x393831),"z",.38)
    _pill(name,"gloss","Small tan upper boot bulkhead flap",(0,.756,-1.402),.140,.064,.012,
          rgb(0x7b725c),"z",.45)
    _pill(name,"plain","Flush latch on the boot bulkhead flap",(0,.782,-1.408),.051,.009,.004,
          rgb(0x555045),"z",.46)
    for side in (-1,1):
        _pill(name,"fabric","Trunk liner over wheel housing",(side*.608,.490,-1.677),.271,.437,.266,
              felt,"y",.46)
        _pill(name,"fabric","Molded trunk liner side wall",(side*.679,.549,-1.770),.840,.385,.085,felt,"x",.41)
    box(name,"fabric","Rear wall trunk trim",(0,.486,-2.213),(1.369,.265,.089),felt,.020)
    _pill(name,"plain","Ribbed trunk threshold",(0,.658,-2.252),1.196,.090,.041,rgb(0x545855),"y",.37)
    for i in range(44):
        x=(i-21.5)*.024
        _cord(name,"gloss","Sill molding small groove",[(x,.681,-2.225),(x,.681,-2.265)],.0014,rgb(0x777a75))
    _pill(name,"carMetal","Trunk latch plate",(0,.683,-2.220),.103,.052,.018,steel,"y")
    _cord(name,"carMetal","Trunk latch loop",[(-.025,.683,-2.224),(-.025,.712,-2.224),
          (.025,.712,-2.224),(.025,.683,-2.224)],.0065,SEDAN_ALLOY)
    _pill(name,"plain","Carpet spare cover pull",(0,.375,-1.991),.130,.030,.012,rgb(0x383a39),"y")
    _pill(name,"carLens","Luggage compartment lamp",(.438,.763,-1.366),.092,.046,.016,rgb(0xb3ab86))
