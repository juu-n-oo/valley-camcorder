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
        (0,.610,2.208),(1.494,.058,.111),rgb(0x434b48),.016)
    box(name,"plain","Radiator assembly",(0,.515,2.102),(1.095,.215,.096),black,.018)
    _pill(name,"plain","Molded radiator upper tank",(0,.628,2.112),1.105,.093,.062,
          rgb(0x272c2b),"y",.65)
    _cord(name,"carMetal","Crimped seam beneath the upper radiator tank",
          [(-.548,.605,2.161),(.548,.605,2.161)],.0035,rgb(0x747b72),sides=7)
    for i in range(20):
        x=(i-9.5)*.051
        _cord(name,"plain","Molded upper radiator tank support rib",
              [(x,.611,2.157),(x,.644,2.152),(x,.663,2.125),(x,.649,2.081)],
              .0027,rgb(0x505653),sides=5)
    _cord(name,"carMetal","Pressed upper crossmember edge and central latch step",
          catmull([(-.702,.631,2.243),(-.450,.629,2.249),(-.165,.632,2.249),(-.110,.632,2.272),
                   (.110,.632,2.272),(.165,.632,2.249),(.450,.629,2.249),(.702,.631,2.243)],4),
          .0061,rgb(0x586159),sides=7)
    for i in range(36):
        x=(i-17.5)*.028
        box(name,"carMetal","Fine radiator cooling fin",(x,.532,2.154),(.005,.146,.008),rgb(0x515955),.001)
    for side in (-1,1):
        at=(side*.573,.666,2.154)
        _pill(name,"carMetal","Stamped fore-and-aft radiator isolator bracket",
              (side*.573,.648,2.169),.085,.127,.033,rgb(0x636967),"y",.40)
        lathe(name,"plain","Rubber radiator locating grommet",
              [(0,.027,.027),(.007,.027,.027),(.011,.021,.021),(.011,.009,.009)],
              rgb(0x2b302e),26,at,caps=False)
        lathe(name,"carMetal","Radiator isolator center ring",[(0,.010,.010),(.006,.010,.010)],
              rgb(0x6f756d),16,_add(at,(0,.003,0)),caps=False)
        lathe(name,"carMetal","Radiator isolator bracket hex screw",
              [(0,.008,.008),(.006,.007,.007)],steel,6,(side*.573,.647,2.218))
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

    block=case(name,"carMetal","Tapered transverse DOHC block",
               [(.410,.525,.434,.035,1.606),(.462,.603,.475,.038,1.625),
                (.553,.609,.464,.023,1.621),(.624,.561,.454,.018,1.615),
                (.712,.553,.429,.016,1.602)],rgb(0x555b56))
    block.data.transform(Matrix.Translation((.122,0,0)))
    block["finish_override"]="Cast aluminum"
    for x in (-.147,-.098,.335,.382):
        _cord(name,"carMetal","Exposed cylinder head casting ledge",
              [(x,.635,1.744),(x,.633,1.808),(x,.618,1.854),(x,.585,1.885)],
              .008,rgb(0x81877d),sides=7)
    for x in (-.104,.005,.115,.221,.326):
        lathe(name,"carMetal","Cylinder head mounting washer",
              [(0,.008,.008),(.005,.008,.008),(.009,.006,.006)],steel,10,(x,.638,1.861),"z")
    rocker_top=.823

    def rocker(u,v,d=0):
        x,z=.174+u,1.639+v
        apron=.049*smooth(1.644,1.775,z)*(1-smooth(.234,.386,x))
        shoulder=.031*smooth(.396,.495,x)
        return x,rocker_top-apron-shoulder+d,z

    rocker_edge=_outline([(.293,-.257),(.246,-.264),(.166,-.229),(-.230,-.224),
                          (-.297,-.190),(-.304,-.113),(-.306,.132),(-.288,.143),
                          (.063,.143),(.191,.252),(.253,.259),(.293,.260),
                          (.316,.200),(.319,-.013)],3)
    _bezel(name,"plain","Formed black cam cover and left timing shroud",rocker_edge,rocker,
           [(.963,-.124),(1,-.080),(1,-.011),(.980,0)],black)
    rocker_skin=[(.980*u,.980*v) for u,v in rocker_edge]
    _perforated_surface(name,"plain","Flat rocker deck with sloping front apron",rocker_skin,[],
                        [(u,v) for u in (-.29,-.21,-.13,-.06,.015,.08,.14,.202,.255,.299)
                         for v in (-.23,-.16,-.09,0,.043,.075,.109,.139,.182,.219)],
                        rocker,rgb(0x272b2c),flip=True)
    for i in range(5):
        z=1.534+i*.023
        points=[rocker(x-.174,z-1.639+.020*smooth(.045,.126,-x),.0018)
                for x in (.220,.177,.078,-.018,-.063,-.128)]
        _cord(name,"plain","Long molded rib on cam cover",catmull(points,3),.00225,gray,sides=7)
    for x,z in ((.398,1.489),(.399,1.753),(.206,1.529),(-.057,1.521)):
        at=rocker(x-.174,z-1.639,-.002)
        lathe(name,"carMetal","Recessed black cover screw",[(0,.008,.008),(.003,.009,.009),(.005,.007,.007)],
              rgb(0x666962),20,at)

    oil=rocker(.310-.174,1.479-1.639,-.003)
    badge=rocker(.322-.174,1.580-1.639)
    badge_start=len(records)
    _badge(name,badge,.103,"y",rgb(0x49514d),slot="gloss")
    upright.update((piece,badge[0]) for piece,*_ in records[badge_start:])
    lathe(name,"plain","Knurled black oil filler cap",[(0,.044,.044),(.006,.048,.048),
          (.018,.049,.049),(.025,.044,.044),(.028,.039,.039)],black,36,oil)
    for i in range(18):
        a=i*tau/18
        at=_add(oil,(.0477*cos(a),.015,.0477*sin(a)))
        box(name,"plain","Molded oil cap grip",at,(.006,.012,.005),gray,.0017,-a)
    mark("gloss","ENGINE OIL",_add(oil,(0,.0283,0)),.008,rgb(0x676b62),up=(0,0,-1),rise=.00014)

    # The casting has a shallow lettered deck, a rolled break and a broad vertical face.
    section=((.670,1.737),(.759,1.737),(.782,1.756),(.784,1.760),(.777,1.827),(.774,1.835),
             (.768,1.842),(.757,1.848),(.667,1.865),(.657,1.858),(.657,1.746))
    rows=[[(x,blend(.722,y,t),blend(1.795,z,t)) for y,z in section]
          for x,t in ((-.138,.957),(-.131,1),(.373,1),(.383,.953))]
    casting=rows_mesh(name,"carMetal","DOHC cover with machined deck and upright flange",rows,aluminum,soft=False)
    casting["finish_override"]="Cast aluminum"
    font_path=Path("C:/Windows/Fonts/arialbi.ttf")
    cast_font=bpy.data.fonts.load(str(font_path),check_existing=True) if font_path.exists() else None
    skew=0 if cast_font else .23
    mark("carMetal","DOHC 16 VALVE",(.090,0,1.817),.053,rgb(0xb2b0a2),up=(0,0,-1),
         rise=.0014,width=1.03,font=cast_font,
         project=lambda x,y,z:(x+skew*(1.820-z),.784-.105*(z-1.760)+.0007+y,z))
    box(name,"plain","Dark gasket beneath the cam casting",(.120,.655,1.805),(.534,.013,.126),black,.005)
    flange=box(name,"carMetal","Lower aluminum mounting flange",(.120,.645,1.803),
               (.538,.016,.139),rgb(0x8d9086),.006)
    flange["finish_override"]="Cast aluminum"
    for x in (.146,-.093):
        deep=_outline([(-.019,-.017),(-.021,.020),(-.015,.040),(-.008,.047),(.006,.047),
                      (.016,.034),(.020,.005),(.018,-.018),(.010,-.026),(-.010,-.026)],3)
        def boss(u,v,d):
            return x+u,.685+v,1.848+.180*(.072-v)+d
        rise=_bezel(name,"carMetal","Raised tapered cam-cover bolt boss",deep,boss,
                    [(1,-.004),(1,.001),(.93,.011),(.77,.015)],rgb(0xaaa896),True)
        rise["finish_override"]="Cast aluminum"
        at=boss(0,-.008,.014)
        lathe(name,"carMetal","Round shoulder at cam cover bolt",
              [(0,.014,.014),(.006,.013,.013),(.009,.012,.012),(.009,.009,.009),(.003,.008,.008)],
              rgb(0xa6a48c),24,at,"z",caps=False)
        lathe(name,"carMetal","Recessed cam cover hex bolt",[(0,.0084,.0084),(.005,.0072,.0072)],
              rgb(0x646553),6,_add(at,(0,0,.003)),"z")

    heat=_outline([(-.219,-.106),(-.233,-.054),(-.202,.020),(-.158,.112),(-.124,.142),
                   (.124,.142),(.160,.112),(.211,.013),(.230,-.054),(.214,-.108)],4)
    def shield(u,v,d=0):
        dome=.016*(1-(u/.243)**2)*(1-smooth(.060,.142,v))
        return .126+u,.627-.26*(v+.106)+d+dome,1.961+.78*v
    edge=_bezel(name,"carMetal","Rolled lip of pressed exhaust heat shield",heat,shield,
                [(1,-.015),(1,0),(.974,.009),(.930,.015)],aluminum)
    edge["finish_override"]="Cast aluminum"
    surface=[(.930*u,.930*v) for u,v in heat]
    face=_perforated_surface(name,"carMetal","Tapered stamped exhaust heat shield",surface,[],
                             [(u,v) for u in (-.18,-.12,-.07,0,.07,.12,.18)
                              for v in (-.08,-.06,-.02,.025,.055,.085,.11,.13)],
                             lambda u,v:shield(u,v,.015),aluminum,flip=True)
    face["finish_override"]="Cast aluminum"
    for z,width in ((.055,.147),(.082,.133),(.109,.119)):
        ribs=[shield(u,z-.014*(u/width)**4,.016) for u in (blend(-width,width,t) for t in _range(19))]
        _cord(name,"carMetal","Shallow pressed heat shield rib",ribs,.0035,rgb(0x929488),sides=6)
    mark("carMetal","HOT",(.126,0,1.931),.031,rgb(0x9a9d91),up=(0,0,-1),rise=.00047,
         project=lambda x,y,z:shield(x-.126,(z-1.961)/.78,.0158+y))
    _cord(name,"carMetal","Stamped heat warning border",
          [shield(x,z-.042,.0159) for x,z in _elliptic(.127,.045,.46,36)],
          .00083,rgb(0x96998e),closed=True,sides=5)
    for x in (-.032,.274):
        p=shield(x-.126,-.074,.014)
        lathe(name,"carMetal","Heat shield mounting screw",
              [(0,.009,.009),(.006,.008,.008),(.008,.006,.006)],steel,10,p)
    _cord(name,"gloss","Yellow oil dipstick grip",catmull([(.422,.696,1.920),(.412,.719,1.954),
          (.435,.719,1.967),(.445,.705,1.933)],4),.0045,yellow,closed=True)

    plenum=case(name,"carMetal","Flattened cast intake plenum",
                [(.658,.339,.164,.018,1.236),(.693,.370,.187,.028,1.238),
                 (.762,.364,.181,.026,1.241),(.789,.338,.157,.024,1.246)],rgb(0x92928a))
    plenum.data.transform(Matrix.Translation((.124,0,0)))
    plenum["finish_override"]="Cast aluminum"
    for i in range(4):
        x=.257-i*.088
        runner=_cord(name,"carMetal","Cast intake runner dropping under the plenum",
                     catmull([(x,.720,1.255),(x,.671,1.295),
                              (x,.654,1.369),(x,.626,1.454)],6),.030,rgb(0x85887e),sides=14)
        runner["finish_override"]="Cast aluminum"
    throttle=(-.071,.751,1.232)
    lathe(name,"carMetal","Stepped throttle body and plenum flange",
          [(.010,.049,.048),(-.007,.054,.053),(-.034,.047,.046),(-.059,.034,.033)],
          aluminum,32,throttle,"x")
    for dz in (-.040,.038):
        lathe(name,"carMetal","Throttle housing flange bolt",[(0,.008,.008),(-.012,.007,.007)],
              steel,6,(-.089,.770,1.232+dz),"x")
    _cord(name,"plain","Throttle cable crossing the intake",
          catmull([(.408,.745,1.103),(.395,.788,1.225),(.263,.803,1.230),
                   (.096,.799,1.269),(-.083,.771,1.274)],5),.0038,SEDAN_RUBBER)
    _pill(name,"carMetal","Throttle cable retaining bracket",(.270,.791,1.233),
          .028,.030,.025,steel,"y",.58)
    airbox=(-.411,.759,1.524)
    air_lower=case(name,"plain","Deep air filter box lower shell",
         [(.550,.215,.301,.015,1.526),(.590,.239,.319,.019,1.529),
          (.728,.246,.325,.014,1.527),(.748,.255,.333,.014,1.524)],black)
    air_lower.data.transform(Matrix.Translation((airbox[0],0,0)))
    box(name,"plain","Squared ribbed air cleaner lid",airbox,(.259,.040,.330),rgb(0x252a2a),.010)
    for i in range(7):
        x=airbox[0]+(i-3)*.035
        _cord(name,"gloss","Molded air lid rib with front return",
              [(x,.778,1.374),(x,.780,1.427),(x,.780,1.654),(x,.778,1.679),(x,.750,1.688)],
              .0026,rgb(0x414544),sides=5)
    for x in (-.502,-.321):
        _cord(name,"carMetal","Spring clip securing the filter lid",
              catmull([(x,.716,1.687),(x-.009,.735,1.699),(x,.764,1.691)],4),.0035,steel)
    air=catmull([(-.130,.751,1.232),(-.190,.760,1.248),(-.240,.766,1.303),
                 (-.296,.781,1.375),(-.366,.772,1.438)],5)
    _cord(name,"plain","Curved intake bellows with thick rubber ends",air,.047,SEDAN_RUBBER,sides=18)
    for i in range(1,len(air)-1):
        p=air[i]
        tangent=(Vector(air[i+1])-Vector(air[i-1])).normalized()
        along=tangent.cross(Vector((0,1,0))).normalized()
        up=tangent.cross(along)
        clamp=i in (1,len(air)-2)
        width=.051 if clamp else .0525
        loop=[tuple(Vector(p)+width*(along*cos(a)+up*sin(a))) for a in (j*tau/20 for j in range(20))]
        _cord(name,"carMetal" if clamp else "plain","Intake hose clamp" if clamp else "Bellows fold",
              loop,.0027,SEDAN_ALLOY if clamp else rgb(0x343837),closed=True,sides=5)

    battery=(-.531,.622,1.899)
    housing=(.313,.238,.309)
    box(name,"plain","Light gray ribbed battery case",battery,housing,rgb(0xa7b1b5),.012)
    box(name,"plain","Rectangular black battery lid",(-.531,.756,1.899),(.324,.046,.319),black,.009)
    box(name,"gloss","Battery forward lid joint",(-.531,.780,1.964),(.316,.007,.078),rgb(0x222728),.006)
    box(name,"plain","Recess beneath the battery carry handle",(-.534,.779,1.851),
        (.181,.010,.111),rgb(0x1d2120),.009)
    for i in range(6):
        z=1.775+i*.043
        _cord(name,"plain","Molded ribs in the battery side wall",
              [(-.374,.535,z),(-.373,.628,z),(-.373,.710,z)],.0025,rgb(0x839094))
    handle=[(-.606,.796,1.909),(-.600,.798,1.807),(-.464,.798,1.807),(-.455,.796,1.909)]
    for a,b in zip(handle,handle[1:]):
        _cord(name,"gloss","Flat squared yellow battery carry handle",[a,b],.0078,yellow,sides=4)
    for x,col in ((-.648,rgb(0x907669)),(-.420,rgb(0x8a8371))):
        at=(x,.773,1.785)
        lathe(name,"carMetal","Battery post and clamp",[(0,.018,.018),(.009,.019,.018),
              (.017,.010,.010),(.022,.009,.009)],col,20,at)
        lathe(name,"carMetal","Battery clamp hex nut",[(0,.007,.007),(.005,.007,.007)],
              SEDAN_ALLOY,6,_add(at,(.013,.015,.009)))
        _cord(name,"plain","Insulated battery terminal lead",
              catmull([_add(at,(.006,.013,0)),(x+.004,.779,1.751),
                        (x-.012,.749,1.729),(x-.041,.677,1.704)],5),.007,SEDAN_RUBBER)
    box(name,"plain","Stepped fuse and relay enclosure",(-.629,.687,1.667),(.184,.148,.225),black,.014)
    box(name,"gloss","Fuse and relay cover with flat shoulder",(-.629,.770,1.668),
        (.202,.024,.226),rgb(0x383d3e),.008)
    lathe(name,"plain","Fuse box cap fastener",[(0,.014,.014),(.010,.011,.011)],black,8,(-.643,.781,1.650))

    # Three different service vessels are visible from the bumper.
    tube(name,"plain","Slanted washer filler neck",
         [((.671,.440,2.033),.022,.021),((.657,.531,2.008),.025,.023),
          ((.635,.642,1.985),.028,.027)],rgb(0xc5c9b3),sides=24,density=5)
    lathe(name,"gloss","Blue hinged washer filler cap",
          [(0,.031,.031),(.006,.036,.034),(.013,.033,.031),(.017,.026,.026)],
          rgb(0x28a4d3),30,(.635,.643,1.985))
    _pill(name,"gloss","Washer lid finger tab",(.651,.652,2.015),.029,.019,.009,rgb(0x2c9ab1),"y")
    lathe(name,"plain","Two-tone round power steering reservoir",
          [(.001,.043,.044),(.028,.054,.053),(.090,.054,.053),(.098,.050,.049)],
          rgb(0xb2b99a),32,(.553,.578,1.819))
    lathe(name,"plain","Dark power steering cap with collar",
          [(0,.052,.052),(.006,.055,.055),(.014,.048,.048),(.029,.029,.029),(.033,.026,.026)],
          rgb(0x303b3a),36,(.553,.670,1.819))
    lathe(name,"plain","Round brake servo against the firewall",
          [(.036,.115,.108),(-.019,.115,.111),(-.032,.106,.099),(-.047,.068,.071)],
          rgb(0x313736),44,(-.455,.742,1.151),"z")
    tube(name,"plain","Ivory brake fluid reservoir on master cylinder",
         [((-.468,.671,1.211),.032,.034),((-.463,.719,1.198),.041,.038),
          ((-.461,.756,1.190),.035,.039)],rgb(0xc5c4a6),sides=24,density=5)
    lathe(name,"plain","Ribbed black brake reservoir cap",
          [(0,.029,.030),(.004,.033,.033),(.017,.030,.030),(.019,.026,.026)],
          black,28,(-.461,.757,1.190))
    _cord(name,"plain","S-shaped upper radiator hose",
          catmull([(-.125,.711,1.745),(-.207,.706,1.824),(-.246,.675,1.918),
                   (-.226,.621,2.022),(-.235,.628,2.109)],6),
          .025,SEDAN_RUBBER,sides=16)
    for dx in (0,.030,.060):
        _cord(name,"plain","Short ignition lead at the firewall",
              catmull([(.344-dx,.756,1.324),(.327-dx,.823,1.355),
                        (.244-dx,.834,1.422),(.186-dx,.819,1.498)],5),.0042,SEDAN_RUBBER)
    _cord(name,"carMetal","Shaped air-conditioning hard line at strut tower",
          catmull([(.598,.607,2.045),(.472,.615,2.016),(.448,.735,1.905),
                    (.487,.795,1.460),(.543,.792,1.216)],6),.0059,rgb(0xa9aca2))
    _cord(name,"plain","Engine wiring harness down beside the timing cover",
          catmull([(.387,.751,1.394),(.414,.751,1.587),(.431,.680,1.779),
                   (.420,.608,1.949),(.362,.562,2.069)],6),.009,SEDAN_RUBBER,sides=10)
    _cord(name,"plain","Wrapped wiring run between throttle and front harness",
          catmull([(-.167,.733,1.270),(-.188,.722,1.465),(-.155,.668,1.690),
                   (-.157,.602,1.908),(-.130,.586,2.042),(-.012,.590,2.091)],5),
          .006,rgb(0x242826),sides=8)
    lathe(name,"carMetal","Radiator hose retaining clamp",
          [(-.006,.028,.028),(.006,.028,.028)],steel,20,(-.234,.626,2.090),"z",caps=False)
    lathe(name,"plain","Pressure filler neck molded into tank",
          [(0,.024,.024),(.029,.024,.024)],black,20,(-.224,.642,2.109))
    lathe(name,"carMetal","Pressure filler cap",[(0,.033,.033),(.012,.032,.032)],aluminum,24,(-.224,.671,2.109))
    _pill(name,"gloss","Yellow pressure cap warning",(-.224,.685,2.109),.054,.045,.004,yellow,"y",.84)
    box(name,"gloss","Cooling safety sticker",(.296,.660,2.095),(.106,.002,.041),yellow,.001)
    mark("plain","CAUTION",(.296,.662,2.093),.010,rgb(0x403c27),up=(0,0,-1),rise=.00010)
    _cord(name,"carMetal","Hood prop rod retained in clip",[(.493,.651,2.221),(.342,.652,2.227),
          (-.345,.651,2.212)],.0046,steel)

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
    for side in (-1,1):
        box(name,"plain","Reinforced fixed trunk hinge pocket",(side*.584,.925,-1.850),
            (.074,.093,.064),rgb(0x393d39),.008)
        lathe(name,"carMetal","Trunk hinge pivot pin in body bracket",
              [(-.032,.014,.014),(-.028,.017,.017),(.027,.017,.017),(.034,.012,.012)],
              rgb(0x5f6661),20,(side*.584,.968,-1.850),"x")
    weather=[(0,.683,-2.258),(.388,.685,-2.255),(.568,.692,-2.242),(.655,.732,-2.162),
             (.690,.801,-1.948),(.655,.884,-1.671),(.594,.941,-1.494),(.465,.951,-1.415),
             (0,.951,-1.392)]
    perimeter=weather+[(-x,y,z) for x,y,z in reversed(weather[1:-1])]
    rounded=catmull([perimeter[-1],*perimeter,*perimeter[:2]],4)[4:-5]
    for offset,r,color in ((0,.0069,rgb(0x333731)),(.010,.0032,rgb(0x53574e))):
        _cord(name,"plain","Continuous double trunk opening weather seal",
              [(x+offset*x,.999*y+offset,z-offset*.67) for x,y,z in rounded],
              r,color,sides=9,closed=True)
    _pill(name,"plain","Ribbed trunk threshold",(0,.658,-2.252),1.196,.090,.041,rgb(0x545855),"y",.37)
    for i in range(44):
        x=(i-21.5)*.024
        _cord(name,"gloss","Sill molding small groove",[(x,.681,-2.225),(x,.681,-2.265)],.0014,rgb(0x777a75))
    _pill(name,"carMetal","Trunk latch plate",(0,.683,-2.220),.103,.052,.018,steel,"y")
    _cord(name,"carMetal","Trunk latch loop",[(-.025,.683,-2.224),(-.025,.712,-2.224),
          (.025,.712,-2.224),(.025,.683,-2.224)],.0065,SEDAN_ALLOY)
    _pill(name,"plain","Carpet spare cover pull",(0,.375,-1.991),.130,.030,.012,rgb(0x383a39),"y")
    _pill(name,"carLens","Luggage compartment lamp",(.438,.763,-1.366),.092,.046,.016,rgb(0xb3ab86))
