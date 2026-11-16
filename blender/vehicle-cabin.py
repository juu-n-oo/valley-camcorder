"""Upholstery, instruments and moving cabin parts modeled from the close-ups."""

DASH_FACE = rgb(0x252a29)
DASH_MARK = rgb(0xcbd1bd)
DASH_LCD = rgb(0x9ac394)
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
    _bezel(name,"carLeather","Molded grey door card",shell,board,
           [(.992,-.07),(1,-.024),(.978,.011),(.962,.029)],SEDAN_TRIM,True)
    cloth=_outline([(-.418,.114),(-.394,.227),(.197,.220),(.285,.165),(.292,.10),
                    (.259,.073),(-.369,.076)],4)
    _bezel(name,"fabric","Rounded cloth door insert",cloth,board,
           [(1,.033),(.975,.043),(.913,.052)],CABIN_BEIGE,True)
    armrest=_outline([(-.436,-.023),(-.426,.042),(-.114,.038),(.258,.051),
                      (.389,.076),(.416,.048),(.407,.006),(.276,-.026)],4)
    _bezel(name,"carLeather","Swept padded handrest",armrest,board,
           [(1,.054),(.975,.089),(.94,.104)],SEDAN_LEATHER,True)
    z0=mid-.074
    def controls(u,v,d):
        return (side*(.746+u),.628+.080*(v+.07)+d,z0+v)
    control=_outline([(-.031,-.192),(.025,-.202),(.036,-.158),(.035,.242),(.015,.288),
                      (-.029,.272),(-.040,.198)],4) if front else _elliptic(.076,.374,.36,28)
    _bezel(name,"carWood","Burl veneer switch plate",control,controls,
           [(1,-.013),(1,-.003),(.91,.001)],SEDAN_WALNUT,True)
    _pill(name,"plain","Recessed pull well",controls(-.0003,-.111,.001),.065,.126,.010,SEDAN_BLACK,"y",.60)
    positions=[(-.011,.040),(.016,.044),(-.011,.094),(.016,.097)] if front and side>0 else [(0,.089)]
    for i,(u,v) in enumerate(positions):
        at=controls(u,v,.006)
        _pill(name,"plain","Window rocker switch",at,.022,.037,.009,rgb(0x242928),"y",.45)
        box(name,"gloss","Chrome switch edge",_add(at,(0,.0048,-.012)),(.019,.0015,.0024),SEDAN_ALLOY)
        if i==0 and side>0 and front:
            _letter(name,"gloss","AUTO",_add(at,(0,.0051,.003)),.006,DASH_MARK,
                    right=(1,0,0),up=(0,0,-1),rise=.00009)
    if front and side>0:
        lathe(name,"plain","Mirror directional pad",[(-.004,.022,.022),(.002,.023,.023),(.008,.020,.020)],
              SEDAN_BLACK,20,controls(0,.192,.005))
        for v in (-.010,.010):
            box(name,"gloss","Mirror direction marker",controls(0,.192+v,.014),(.004,.0018,.004),DASH_MARK)
        _pill(name,"plain","Window inhibit rocker",controls(0,.245,.005),.019,.030,.008,SEDAN_BLACK,"y")

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

    pocket_z=mid-.10
    pocket=_elliptic(span*.55,.112,.44,30)
    _bezel(name,"plain","Lower map pocket inner wall",pocket,
           lambda u,v,d:(side*(.797-d),.418+v,pocket_z+u),[(1,0),(.88,.016)],SEDAN_BLACK,True)
    lip=[(side*(.759-.007*sin(pi*t)),.387+.022*cos(2*pi*t),pocket_z+span*.266*(2*t-1))
         for t in _range(24)]
    _cord(name,"carLeather","Map pocket molded lip",lip,.024,SEDAN_TRIM)
    at=(side*.780,.441,hi-(.215 if front else .189))
    speaker=_elliptic(.207,.170,1,36)
    def grille(u,v,d):
        return _add(at,(-side*d,v,u))
    _bezel(name,"carLeather","Door speaker rim",speaker,grille,
           [(1.105,0),(1.04,.016),(1,.018),(.94,.017)],SEDAN_TRIM)
    # Narrow concentric ridges carry the shadow of perforated pressed metal.
    _bezel(name,"plain","Dark perforated speaker screen",speaker,grille,
           [(.94,.013),(.83,.017),(.51,.021)],rgb(0x3b3d38),True)
    for r in (.29,.42,.57,.73,.85):
        _cord(name,"gloss","Pressed speaker grille", [grille(x*r,y*r,.021) for x,y in speaker[::2]],
              .0008,rgb(0x5a5a50),closed=True,sides=4)
    _pill(name,"carLens","Door courtesy lamp",(side*.772,.349,lo+.136),.110,.039,.019,
          rgb(0xa0382c),"x",.49)
    _pill(name,"carMetal","Safety latch fork",(side*.879,.635,lo+.006),.024,.041,.019,SEDAN_ALLOY,"z",.55)
    for y in (.601,.668):
        lathe(name,"carMetal","Latch mounting bolt",[(0,.005,.005),(-.004,.005,.005)],
              SEDAN_ALLOY,8,(side*.878,y,lo+.003),"z")


def _headliner_details(roof):
    for side in (-1,1):
        x=side*.319
        _pill(roof,"fabric","Molded sun visor",(x,1.373,.359),.505,.186,.034,CABIN_BEIGE,"y",.46)
        _pill(roof,"carLeather","Vanity cover",(x,1.354,.322),.167,.071,.009,CABIN_BEIGE,"y",.41)
        _cord(roof,"carMetal","Sun visor hinge rod",[(x+side*.206,1.381,.435),
              (x+side*.234,1.378,.429),(x+side*.241,1.373,.409)],.0074,SEDAN_ALLOY)
        handle=[(side*.615,1.358,-.215),(side*.596,1.335,-.190),(side*.593,1.329,-.030),
                (side*.616,1.349,-.001)]
        _cord(roof,"carLeather","Roof grab handle",catmull(handle,5),.013,CABIN_BEIGE,sides=12)
    _pill(roof,"carLeather","Overhead map light console",(0,1.373,.295),.280,.245,.055,CABIN_BEIGE,"y",.49)
    _pill(roof,"plain","Sunglasses lid perimeter",(0,1.343,.354),.192,.096,.011,SEDAN_TRIM,"y",.46)
    _pill(roof,"carLeather","Sunglasses compartment lid",(0,1.335,.354),.184,.088,.011,CABIN_BEIGE,"y",.46)
    _letter(roof,"gloss","PUSH",(0,1.329,.372),.014,rgb(0x878176),
            right=(-1,0,0),up=(0,0,-1),rise=.00018)
    for x in (-.061,.061):
        _pill(roof,"carLens","Map lamp lens",(x,1.343,.227),.081,.065,.020,rgb(0xb6bab0),"y",.62)
        _pill(roof,"carLeather","Map lamp button",(x,1.335,.269),.044,.021,.018,CABIN_BEIGE,"y",.6)


def _upholstery():
    name=_sedan_asset("upholstery")
    fabric = rgb(0xaba08c)
    def seat_foam(label,at,size,angle=0,back=False,color=SEDAN_LEATHER):
        w,h,d=(x/2 for x in size)
        rings=[]
        for t in list(_range(16))[1:-1]:
            sine=sin(pi*t)
            ring=[]
            for i in range(32):
                a=tau*i/32
                x=w*copysign(abs(cos(a))**.70,cos(a))*sine**.50
                z=d*copysign(abs(sin(a))**.66,sin(a))*sine**.50
                y=h*cos(pi*t)
                if back:
                    y,z=z,y
                ring.append(_add(at,(x,y*cos(angle)-z*sin(angle),z*cos(angle)+y*sin(angle))))
            rings.append(ring)
        return rows_mesh(name,"carLeather",label,rings,color)

    def cushion(label,x,z,width,depth,front):
        def top(u,v):
            t=2*u-1
            span=width*.5*(.88+.12*sin(pi*v)**.64)
            doming=.021*max(0,1-t*t)+.015*sin(pi*v)
            bolsters=.022*exp(-((abs(t)-.75)/.168)**2)*sin(pi*v)**.6
            return (x+span*t,.447+doming+bolsters+.018*(v-.5),
                    z+depth*(v-.5)-.023*t*t*(.4 if front else 1))
        def inside(p):
            t=abs(2*(p[0]-x)/width)
            mottled=.98+.020*cos(p[0]*520)*cos(p[2]*430)
            return tone(SEDAN_LEATHER,mottled*(1-.034*(1-smooth(.60,.67,t))))
        _panel(name,"carLeather",label+" perforated panel",31,25,top,inside,True)
        seat_foam(label+" rounded cushion sides",(x,.398,z),(width,.171,depth),.025,color=SEDAN_LEATHER)
        for u in (.183,.191,.799,.807):
            _cord(name,"gloss","Double stitched cushion seam",[_add(top(u,t),(0,.0010,0))
                  for t in _range(31)],.00085,rgb(0xa8987f),sides=5)
        _cord(name,"carLeather","Front cushion piping",[top(t,.99) for t in _range(31)],
              .0035,rgb(0xb2a386))

    for side in (-1,1):
        x=side*.426
        cushion("Driver" if side>0 else "Passenger",x,.149,.539,.582,True)
        seat_foam("Front contoured backrest",(x,.702,-.181),(.546,.175,.537),-.19,True)
        seat_foam("Front headrest",(x,1.060,-.238),(.282,.143,.202),-.17,True)
        for dx in (-.078,.078):
            _cord(name,"carMetal","Headrest steel guide",[(x+dx,.921,-.245),(x+dx,1.004,-.240)],
                  .009,SEDAN_ALLOY)
        for dx in (-.156,-.149,.149,.156):
            line=catmull([(x+dx,.500,-.083),(x+dx*.94,.635,-.095),
                         (x+dx*.91,.791,-.118),(x+dx*.84,.911,-.179)],4)
            _cord(name,"gloss","Front backrest sewn seam",line,.00094,rgb(0xb1a286),sides=5)
        _pill(name,"carLeather","Seatback map pocket",(x,.625,-.265),.359,.172,.025,rgb(0xb4a58d),"z",.46)
        _cord(name,"gloss","Elastic pocket seam",[(x-.163,.697,-.285),(x,.679,-.291),(x+.163,.697,-.285)],
              .0024,rgb(0x988e7c))
        for dx in (-.167,.167):
            box(name,"plain","Seat track",(x+dx,.268,.146),(.045,.043,.526),rgb(0x393a37),.006)
        box(name,"carLeather","Height-adjuster base",(x+side*.022,.339,.127),(.466,.118,.517),CABIN_BEIGE,.048)
        for z in (.157,.320):
            outline=[((.036+.004*cos(a*6))*cos(a),(.036+.004*cos(a*6))*sin(a))
                     for a in (tau*k/36 for k in range(36))]
            _bezel(name,"carLeather","Scalloped seat adjuster",outline,
                   lambda u,v,d:(x+side*(.254+d),.352+v,z+u),
                   [(.89,0),(1,.008),(1,.021),(.77,.028)],CABIN_BEIGE,True)
            _pill(name,"plain","Seat adjuster spindle",(x+side*.282,.352,z),.013,.013,.005,rgb(0x807966),"x")
        _pill(name,"carLeather","Seat slide handle",(x+side*.265,.345,-.051),.123,.048,.032,CABIN_BEIGE,"x",.47)
        _pill(name,"plain","Front buckle receiver",(x-side*.269,.450,.017),.037,.091,.048,SEDAN_TRIM,"x",.65)
        box(name,"carLens","Seat belt release button",(x-side*.267,.494,.017),(.027,.008,.033),rgb(0xa54b3e),.002)
        box(name,"fabric","Carpet floor mat",(x,.247,.636),(.461,.018,.420),SEDAN_CARPET,.012)
        box(name,"fabric","Rear footwell mat",(x,.240,-.456),(.461,.020,.348),SEDAN_CARPET,.013)
        for i in range(9):
            box(name,"plain","Ribbed mat heel pad",(x,.260,.480+i*.010),(.195,.003,.004),rgb(0x5f5a4e),.001)
        belt=catmull([(side*.711,1.284,-.253),(side*.756,1.188,-.264),(side*.754,.887,-.296),
                      (side*.736,.579,-.306),(side*.688,.289,-.321)],5)
        rows_mesh(name,"fabric","B-pillar seatbelt",[
            [_add(p,(0,0,-.023)),_add(p,(0,0,.023))] for p in belt],rgb(0x7a7467),ring=False,caps=False)
        _pill(name,"carLeather","Seatbelt adjustable shoulder guide",(side*.721,1.217,-.256),.057,.077,.028,
              CABIN_BEIGE,"x",.48)
        _pill(name,"carMetal","Seatbelt tongue",(side*.751,.912,-.281),.048,.038,.007,SEDAN_ALLOY,"x",.57)

    cushion("Rear bench",0,-.879,1.429,.557,False)
    seat_foam("Shaped rear squab",(0,.684,-1.148),(1.450,.196,.485),-.28,True)
    for side in (-1,1):
        seat_foam("Rear integrated headrest",(side*.480,.935,-1.222),(.278,.146,.174),-.27,True)
        for x in (side*.302,side*.503):
            _cord(name,"gloss","Rear seat stitch",catmull([(x,.511,-1.023),(x,.668,-1.028),
                   (x,.836,-1.070),(x,.905,-1.137)],4),.0010,rgb(0x9d9074),sides=5)
        belt=catmull([(side*.708,1.116,-1.126),(side*.670,.962,-1.112),
                      (side*.547,.754,-1.062),(side*.395,.491,-1.008)],5)
        rows_mesh(name,"fabric","Rear diagonal seatbelt",[
            [_add(p,(-.021,0,0)),_add(p,(.021,0,0))] for p in belt],rgb(0x817b6f),ring=False,caps=False)
        _pill(name,"carMetal","Rear seatbelt slider",(side*.547,.757,-1.054),.048,.025,.006,SEDAN_ALLOY,"z")
    seat_foam("Folded-down center armrest",(0,.540,-.819),(.289,.103,.426),.036,color=fabric)
    _cord(name,"carLeather","Rear armrest stitched bound edge",
          [(x,.576,z) for x,z in rounded_armrest()],.0018,rgb(0xa99b82),closed=True)
    box(name,"fabric","Rear parcel shelf",(0,.971,-1.266),(1.448,.053,.239),rgb(0x777468),.017)


def rounded_armrest():
    return [(x,z) for x,_,z in rounded_rect(.260,.372,.053,0,-.814)]


def _dash_face(x,y,depth=0):
    profile=((.50,.604),(.62,.626),(.75,.646),(.84,.642),(.885,.649),(.930,.669),(.986,.726))
    return (x,y,_profile(profile,y,1)+.018*(abs(x)/.75)**4-depth)


def _dash_button(name,x,y,w,h,text="",scale=.010,depth=.018):
    at=_dash_face(x,y,depth)
    _pill(name,"plain","Inset "+(text or "blank")+" switch",at,w,h,.016,DASH_FACE)
    if text:
        _letter(name,"gloss",text,_add(at,(0,-scale*.32,-.009)),scale,DASH_MARK,
                right=(-1,0,0),rise=.00008)


def _vent(name,x,y,width,height,outer=False):
    outline=_elliptic(width,height,.37,28)
    def face(u,v,d):
        return _dash_face(x+u,y+v,d)
    _bezel(name,"carLeather" if outer else "carWood","Rounded vent insert",outline,face,
           [(1,.008),(.97,.017),(.88,.019)],SEDAN_TRIM if outer else SEDAN_WALNUT,True)
    _bezel(name,"plain","Black vent recess",outline,face,[(.89,.020),(.85,.024)],SEDAN_BLACK,True)
    _bezel(name,"carMetal","Fine vent lip",outline,face,[(.90,.022),(.891,.025),(.864,.025)],rgb(0x929c98))
    for i in range(6):
        offset=(i-2.5)*height*.126
        half=width*.386*(1-.18*abs(offset/height))
        _cord(name,"carMetal" if outer else "gloss","Molded horizontal vent louver",
              [face(half*(2*t-1),offset+.003*sin(pi*t),.026) for t in _range(10)],
              .0026,rgb(0x9ca197 if outer else 0x6b7777))
    for t in (-.26,-.1,.10,.26):
        _cord(name,"plain","Vertical vent guide",[face(t*width,-height*.348,.023),face(t*width,height*.345,.024)],
              .0018,rgb(0x363b38))
    _pill(name,"plain","Vent thumb wheel",face(width*.07,-.003,.032),width*.26,.013,.006,DASH_FACE)


def _gauge(name,at,radius,labels,unit_text,small=False):
    x,y,z=at
    _pill(name,"plain","Black gauge face",at,radius*2.05,radius*2.10,.007,rgb(0x252a27),"z",1)
    _cord(name,"gloss","Matte instrument bezel",
          [(x+radius*cos(tau*t),y+radius*sin(tau*t),z-.004) for t in list(_range(41))[:-1]],
          .0027,rgb(0x3e443e),closed=True)
    def polar(at,r):
        angle=3.853-4.564*at
        return (x-r*cos(angle),y+r*sin(angle),z-.006)
    intervals=(len(labels)-1)*(4 if small else 5)
    for i in range(intervals+1):
        t=i/intervals
        major=i%(4 if small else 5)==0
        color=rgb(0xaa4836) if (unit_text=="x1000rpm" and t>.84) else DASH_MARK
        _cord(name,"gloss","Gauge graduation", [polar(t,radius*(.81 if major else .86)),polar(t,radius*.938)],
              .00115 if major else .0007,color,sides=4)
    for i,label in enumerate(labels):
        at=polar(i/(len(labels)-1),radius*.710)
        _letter(name,"gloss",label,_add(at,(0,-.004,-.0008)),.010 if small else .0104,DASH_MARK,
                right=(-1,0,0),rise=.00010)
    if unit_text:
        _letter(name,"gloss",unit_text,(x,y-radius*.54,z-.006),.010,DASH_MARK,right=(-1,0,0),rise=.00009)
    zero=polar(.06 if small else 0,radius*.888)
    tip=tuple(zero)
    root=(x,y,z-.009)
    p=(y-tip[1],tip[0]-x)
    ratio=.0027/max(.001,sqrt(p[0]*p[0]+p[1]*p[1]))
    offset=(p[0]*ratio,p[1]*ratio,0)
    mesh(name,"carLens","Orange mechanical needle",[_add(root,offset),tip,_add(root,_scale(offset,-1))],
         [(0,1,2)],rgb(0xd34127),soft=False,consistent=False)
    _pill(name,"plain","Needle hub cap",(x,y,z-.010),.023 if small else .029,.023 if small else .029,
          .010,rgb(0x313733),"z",1)


def _cluster(name):
    at=(.450,.925,.682)
    outline=_outline([(-.241,-.076),(-.252,-.012),(-.222,.053),(-.139,.082),(.057,.086),
                      (.209,.072),(.248,.025),(.229,-.064),(.185,-.077)],4)
    def cluster(u,v,d):
        return _add(at,(u,v,d+.073*(u/.255)**2))
    _bezel(name,"carLeather","Hooded meter surround",outline,cluster,
           [(1.1,.048),(1.06,.008),(1.05,-.046),(.95,-.057)],SEDAN_TRIM,True)
    _bezel(name,"carWood","Walnut instrument trim",outline,cluster,
           [(1,-.060),(.989,-.074),(.94,-.075),(.92,-.062)],SEDAN_WALNUT)
    _bezel(name,"plain","Recessed instrument panel",outline,cluster,
           [(.94,-.058),(.92,-.064)],rgb(0x171c19),True)
    _gauge(name,(.550,.929,.614),.077,[str(i) for i in range(9)],"x1000rpm")
    _gauge(name,(.354,.930,.613),.077,[str(i) for i in range(0,221,20)],"km/h")
    _gauge(name,(.660,.899,.636),.034,["C","H"],"",True)
    _gauge(name,(.239,.900,.638),.036,["E","F"],"",True)
    _pill(name,"plain","Mechanical odometer display",(.348,.945,.606),.051,.015,.004,rgb(0x161a18))
    for i in range(6):
        box(name,"gloss","Odometer digit drum",(.371-i*.009,.945,.605),(.008,.012,.002),rgb(0x363a33),.0008)
    _letter(name,"gloss","148432",(.348,.941,.603),.011,DASH_MARK,right=(-1,0,0),rise=.0001)
    for i,glyph in enumerate("PRND32L"):
        y=.966-i*.016
        _letter(name,"gloss",glyph,(.455,y,.606),.010,DASH_LCD if i==0 else DASH_MARK,right=(-1,0,0),rise=.00010)
    for text,x,color in (("AIR BAG",.554,rgb(0xb95343)),("BRAKE",.438,rgb(0xb95343)),
                          ("CHECK ENGINE",.348,rgb(0xb59d4a))):
        _letter(name,"gloss",text,(x,.856,.610),.0065,color,right=(-1,0,0),rise=.0001)
    for side in (-1,1):
        x=.454+side*.067
        arrow=[(x-side*.008,.993,.601),(x+side*.006,.993,.601),
               (x+side*.006,.997,.601),(x+side*.012,.990,.601),
               (x+side*.006,.983,.601),(x+side*.006,.988,.601),(x-side*.008,.988,.601)]
        mesh(name,"gloss","Cluster indicator arrow",arrow,[tuple(range(7))],rgb(0x41764d),soft=False)


def _steering(name):
    center=(.430,.820,.515)
    def wheel(u,v,d=0):
        return _add(center,(u,v,d-.336*v))
    rim=[wheel(.180*cos(tau*t),.181*sin(tau*t)) for t in list(_range(65))[:-1]]
    _cord(name,"carLeather","Leather-wrapped steering rim",rim,.0185,rgb(0x878578),closed=True,sides=12)
    _cord(name,"gloss","Inner rim stitching",[wheel(.165*cos(tau*t),.165*sin(tau*t),-.010)
          for t in list(_range(47))[:-1]],.00125,rgb(0x6c685d),closed=True,sides=5)
    for side in (-1,1):
        tube(name,"carLeather","Horizontal casting spoke",[(wheel(side*.063,.020,.005),.025,.035),
             (wheel(side*.110,.021,.006),.020,.028),(wheel(side*.163,.014,-.001),.014,.017)],
             rgb(0x848074),sides=9,density=5)
        tube(name,"carLeather","Swept lower casting spoke",[(wheel(side*.052,-.030,.007),.022,.025),
             (wheel(side*.068,-.080,.004),.021,.021),(wheel(side*.102,-.136,0),.017,.019)],
             rgb(0x848074),sides=9,density=5)
    pad=_outline([(-.096,.030),(-.078,.062),(.012,.073),(.091,.056),(.091,.005),(.057,-.038),
                  (.051,-.071),(-.046,-.074),(-.071,-.034)],4)
    _bezel(name,"carLeather","Soft four-spoke airbag cover",pad,wheel,
           [(1,.035),(1.04,.015),(.97,-.019),(.89,-.029)],rgb(0x838275),True)
    _badge(name,wheel(0,.024,-.032),.070,"z",rgb(0x8d8c7a),True)
    for text,v,size in (("SRS",-.023,.014),("AIRBAG",-.039,.009)):
        _letter(name,"carLeather",text,wheel(0,v,-.031),size,rgb(0x777669),right=(-1,0,0),
                up=(0,.952,-.305),rise=.00060)
    _cord(name,"gloss","Airbag tear line",[wheel(-.049,-.011,-.030),wheel(.049,-.011,-.030)],.0013,
          rgb(0x767569))
    _pill(name,"carLeather","Steering column enclosure",(.430,.803,.610),.215,.135,.221,SEDAN_TRIM)
    for side in (-1,1):
        a=wheel(side*.071,-.001,.080)
        b=wheel(side*.184,.029,.090)
        _cord(name,"plain","Turn or wiper stalk",[a,b],.010,SEDAN_BLACK,sides=10)
        _pill(name,"plain","Ribbed stalk knob",b,.044,.029,.028,rgb(0x272b27),"z",.67)
        _letter(name,"gloss","OFF",_add(b,(0,-.004,-.017)),.0065,DASH_MARK,right=(-1,0,0),rise=.00009)
    key_at=(.296,.756,.668)
    lathe(name,"carMetal","Ignition bezel",[(-.009,.019,.019),(-.007,.022,.022),(0,.022,.022)],
          SEDAN_ALLOY,24,key_at,axis="z",caps=False)
    _pill(name,"plain","Ignition key recess",key_at,.031,.031,.011,SEDAN_BLACK,"z",1)
    _cord(name,"carMetal","Cut ignition key",[key_at,(.300,.751,.629)],.0044,SEDAN_ALLOY,sides=5)
    _pill(name,"plain","Key bow",(.302,.737,.625),.033,.027,.010,SEDAN_BLACK)
    _cord(name,"carMetal","Split key ring",[(.304+.017*cos(tau*t),.716+.017*sin(tau*t),.620)
          for t in list(_range(25))[:-1]],.0018,SEDAN_CHROME,closed=True)
    _pill(name,"carLeather","Leather key fob",(.298,.682,.623),.023,.049,.011,rgb(0x64442c))
    for x,w in ((.367,.048),(.522,.077)):
        _pill(name,"plain","Brake or throttle rubber pedal",(x,.313,.768),w,.096,.027,SEDAN_RUBBER)
        for i in range(5):
            _cord(name,"gloss","Pedal anti-slip ridge",[(x-w*.36,.280+i*.012,.752),(x+w*.36,.280+i*.012,.752)],
                  .0012,rgb(0x42443c))


def _center_stack(name):
    outline=_outline([(-.154,-.209),(-.164,.110),(-.154,.183),(-.091,.215),(.088,.215),
                       (.149,.182),(.167,.109),(.154,-.196),(.122,-.230),(-.120,-.232)],4)
    def center(u,v,d):
        return _dash_face(u,.757+v,d)
    _bezel(name,"carWood","Burlwood center stack",outline,center,[(1,-.017),(1,.010),(.961,.020)],SEDAN_WALNUT,True)
    _bezel(name,"carMetal","Console bright perimeter",outline,center,[(1.008,.010),(1.002,.015),(.987,.015)],
           rgb(0xa19783))
    for x in (-.077,.077):
        _vent(name,x,.901,.119,.113)
    _dash_button(name,0,.905,.028,.059)
    hazard=[_dash_face(-.008,.896,.027),_dash_face(.008,.896,.027),_dash_face(0,.912,.030)]
    _cord(name,"carLens","Red hazard triangle",hazard,.0017,rgb(0xcf4b37),closed=True)
    for y in (.829,.754,.703,.599):
        _cord(name,"gloss","Panel seam",[_dash_face(lerp_x,.0+y,.021) for lerp_x in (-.145,-.07,0,.07,.145)],
              .0017,rgb(0x3d2519))
    _pill(name,"plain","Climate LCD housing",_dash_face(-.023,.788,.021),.161,.046,.019,DASH_FACE)
    _pill(name,"gloss","Tinted green climate display",_dash_face(-.024,.789,.033),.138,.033,.007,rgb(0x233a29))
    _letter(name,"gloss","24.0°C   3:57",_dash_face(-.023,.782,.038),.016,DASH_LCD,right=(-1,0,0),rise=.00011)
    _letter(name,"gloss","AUTO",_dash_face(.025,.798,.038),.007,DASH_LCD,right=(-1,0,0),rise=.00008)
    _letter(name,"gloss","TEMP",_dash_face(.115,.815,.031),.008,DASH_MARK,right=(-1,0,0),rise=.00008)
    _pill(name,"plain","Temperature rotary dial",_dash_face(.114,.787,.032),.043,.043,.024,DASH_FACE,"z",1)
    for x,color in ((.139,rgb(0x466c9d)),(.090,rgb(0x9e4530))):
        _cord(name,"gloss","Temperature range color mark",[_dash_face(x,.803,.031),_dash_face(x,.807,.031)],
              .0018,color)
    for x,y,s in ((.067,.800,"AUTO"),(.067,.775,"OFF"),(-.122,.799,"A/C"),(-.122,.774,"AMB")):
        _dash_button(name,x,y,.032,.019,s,.0068)
    for i,text in enumerate(("MODE","RECIRC","FRONT","REAR","A")):
        _dash_button(name,.120-i*.055,.736,.047,.028,text,.0076)
    for i,text in enumerate("HMR"):
        _dash_button(name,.017-i*.045,.759,.021,.009,text,.0048)

    radio=_dash_face(0,.650,.017)
    _pill(name,"plain","Cassette receiver bezel",radio,.284,.103,.022,rgb(0x252928),"z",.53)
    _pill(name,"gloss","Amber FM LCD",_dash_face(-.002,.672,.032),.161,.024,.007,rgb(0x8e9467),"z",.36)
    _letter(name,"gloss","FM1    89.1",_dash_face(-.002,.665,.037),.015,rgb(0x303930),right=(-1,0,0),rise=.00010)
    _letter(name,"gloss","HYUNDAI  CASSETTE / FM-AM TUNER RECEIVER",
            _dash_face(0,.689,.033),.0057,DASH_MARK,right=(-1,0,0),rise=.00008)
    _pill(name,"plain","Cassette loading slot",_dash_face(0,.645,.034),.153,.023,.013,rgb(0x111513),"z",.43)
    _cord(name,"carMetal","Tape slot guide",[_dash_face(-.065,.638,.041),_dash_face(.065,.638,.041)],.0017,
          rgb(0x626b62))
    for i,text in enumerate(("FM-AM","TAPE","CDCHG")):
        _dash_button(name,.056-i*.054,.628,.045,.012,text,.0067,.032)
    for i in range(6):
        _dash_button(name,.070-i*.029,.612,.023,.013,str(i+1),.007,.030)
    for x,y,s in ((.112,.667,"TUNE"),(-.112,.669,"DISC"),(-.109,.647,"EQ")):
        _dash_button(name,x,y,.035,.017,s,.0065,.032)
    volume=_dash_face(.113,.615,.036)
    lathe(name,"plain","Knurled radio volume knob",[(-.014,.020,.020),(-.010,.022,.022),(.002,.021,.021)],
          DASH_FACE,24,volume,axis="z")
    for i in range(18):
        a=i*tau/18
        x,y=volume[0]+.021*cos(a),volume[1]+.021*sin(a)
        _cord(name,"gloss","Volume grip groove",[(x,y,volume[2]-.010),(x,y,volume[2]-.003)],.0009,rgb(0x51544d))
    _letter(name,"gloss","VOL",_dash_face(.113,.637,.038),.0067,DASH_MARK,right=(-1,0,0),rise=.00008)
    _pill(name,"plain","Ashtray recess",_dash_face(.016,.541,.019),.209,.092,.037,SEDAN_BLACK,"z",.49)
    cap=_dash_face(-.096,.588,.032)
    lathe(name,"carMetal","Cigarette lighter socket",[(.009,.024,.024),(.005,.026,.026),(-.005,.025,.025),(-.008,.020,.020)],
          SEDAN_ALLOY,24,cap,axis="z",caps=False)
    box(name,"plain","Glove box opening",(-.477,.676,.842),(.518,.177,.041),SEDAN_BLACK,.018)
    for x in (-.674,.670):
        _vent(name,x,.870,.103,.110,True)


def _tunnel(name):
    profiles=[(.267,.282,.815,.083,.239),(.345,.325,.859,.090,.222),
              (.451,.315,.844,.092,.209),(.480,.288,.834,.090,.209)]
    case(name,"carLeather","Molded center tunnel",profiles,SEDAN_TRIM)
    cont=_outline([(-.134,-.213),(-.138,.150),(-.111,.247),(.093,.241),(.129,.177),
                   (.137,-.171),(.091,-.229),(-.081,-.231)],4)
    def tray(u,v,d):
        return (u,.466+.139*(v+.12)**2+d,.344+v)
    _bezel(name,"carWood","Shaped walnut gear console",cont,tray,[(1,-.008),(1,.008),(.946,.016)],SEDAN_WALNUT,True)
    _pill(name,"plain","Automatic selector gate",(.020,.486,.284),.112,.235,.016,DASH_FACE,"y",.48)
    _pill(name,"gloss","Sliding shifter seal",(-.011,.497,.304),.051,.192,.006,rgb(0x585c55),"y",.46)
    for i,label in enumerate("PRND32L"):
        color=rgb(0xc9a23d) if i==1 else rgb(0x65a868) if i==2 else DASH_MARK
        _letter(name,"gloss",label,(.051,.499,.373-i*.028),.014,color,right=(1,0,0),up=(0,0,-1),rise=.00010)
    _pill(name,"carLens","Park selection witness",(.072,.500,.369),.007,.007,.003,rgb(0xb7462b),"y")
    _cord(name,"carMetal","Bright shifter stem",[(-.012,.491,.365),(-.008,.549,.373),(-.006,.616,.393)],
          .010,SEDAN_CHROME,sides=11)
    knob=_outline([(-.033,-.039),(-.041,.007),(-.034,.043),(.006,.053),
                   (.037,.035),(.039,.007),(.028,-.031),(.016,-.051)],4)
    _bezel(name,"plain","Automatic shift lever head",knob,
           lambda x,y,d:(-.006+x,.619+y,.392+d+.20*y),
           [(.81,.028),(1,.014),(1,-.011),(.87,-.033)],rgb(0x242928),True)
    _pill(name,"gloss","Shifter thumb release",(.026,.620,.411),.026,.029,.014,rgb(0x313630),"x",.62)
    for i in range(3):
        x=.081-i*.055
        _pill(name,"plain","Console rocker button",(x,.494,.527),.041,.041,.013,DASH_FACE,"y",.42)
    _letter(name,"gloss","ECT",(.026,.503,.533),.010,DASH_MARK,right=(1,0,0),up=(0,0,-1),rise=.00010)
    _letter(name,"gloss","HOLD",(.026,.503,.520),.007,DASH_MARK,right=(1,0,0),up=(0,0,-1),rise=.00010)
    _pill(name,"plain","Small coin and accessory port",(0,.490,.621),.168,.073,.016,DASH_FACE,"y",.55)
    _pill(name,"plain","Capped accessory socket",(.021,.505,.631),.034,.034,.012,SEDAN_BLACK,"y",1)
    _letter(name,"gloss","12V",(.021,.512,.635),.007,rgb(0x7d8575),right=(1,0,0),up=(0,0,-1),rise=.00010)
    _cord(name,"carLeather","Padded handbrake grip",catmull([(.116,.471,.018),(.125,.494,.125),(.134,.532,.237)]),
          .024,SEDAN_TRIM,sides=11)
    _pill(name,"carMetal","Handbrake release tip",(.135,.535,.245),.018,.019,.015,SEDAN_ALLOY)
    box(name,"carLeather","Armrest storage base",(0,.411,-.120),(.270,.192,.316),SEDAN_TRIM,.026)
    box(name,"plain","Visible center storage well",(0,.510,-.118),(.219,.028,.259),DASH_FACE,.011)
    _pill(name,"plain","Rear ash holder",(0,.382,-.285),.139,.081,.026,SEDAN_BLACK,"z",.50)


def _dashboard():
    name=_sedan_asset("dashboard")
    cross_section=[(.747,.687),(.818,.654),(.882,.661),(.930,.695),(.956,.771),
                   (.956,.934),(.936,1.011),(.848,1.049),(.747,1.023),(.708,.831)]
    rows=[]
    for t in _range(25):
        x=(2*t-1)*.817
        taper=smooth(.61,.82,abs(x))
        rows.append([(x,y-.034*taper,z+.021*taper) for y,z in cross_section])
    rows_mesh(name,"carLeather","Sculpted full-width padded dashboard",rows,SEDAN_TRIM)
    box(name,"carLeather","Left driver knee bolster",(.469,.659,.842),(.581,.188,.278),SEDAN_TRIM,.037)
    box(name,"carLeather","Passenger glove box lower trim",(-.484,.571,.855),(.604,.055,.294),SEDAN_TRIM,.016)
    for side in (-1,1):
        for i in range(12):
            x=side*(.249+i*.033)
            box(name,"plain","Windscreen demister slot",(x,.947,.961),(.018,.004,.043),rgb(0x44463d),.001)
    _cluster(name)
    _steering(name)
    _center_stack(name)
    _tunnel(name)
    foot=_sedan_asset("footwells")
    box(foot,"fabric","Carpet over footwell floor",(0,.208,-.105),(1.555,.035,2.36),SEDAN_CARPET,.014)


def _cabin_storage():
    name=_sedan_asset("glove_box",(-.474,.589,.841))
    at=(-.474,.682,.829)
    _pill(name,"carLeather","Rounded glovebox drawer face",at,.525,.180,.045,SEDAN_TRIM,"z",.44)
    _pill(name,"plain","Inset glovebox latch cup",(-.474,.713,.802),.111,.034,.012,rgb(0x4d5047))
    _pill(name,"carLeather","Glovebox pull lever",(-.474,.706,.795),.083,.017,.011,CABIN_BEIGE)
    _pill(name,"plain","Glovebox lock disc",(-.472,.714,.794),.014,.014,.004,SEDAN_BLACK,"z",1)
    box(name,"carLeather","Glove compartment tray",(-.474,.651,.933),(.469,.020,.180),rgb(0x55554c),.008)
    for side in (-1,1):
        box(name,"carLeather","Glove compartment side stop",(-.474+side*.221,.675,.930),(.023,.078,.152),
            rgb(0x65635a),.008)
    box(name,"gloss","Glovebox manual insert",(-.476,.665,.930),(.173,.004,.080),rgb(0xc7c5b7),.002)
    for i in range(4):
        box(name,"plain","Glove compartment label stripe",(-.480,.668,.906+i*.013),(.134,.0005,.0026),
            rgb(0x73786f))
    name=_sedan_asset("console_lid",(0,.509,-.270))
    _pill(name,"fabric","Padded center armrest lid",(0,.545,-.123),.275,.328,.064,CABIN_BEIGE,"y",.37)
    _pill(name,"carWood","Armrest release strip",(0,.523,.031),.114,.046,.035,SEDAN_WALNUT,"y",.52)
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
    _letter(name,"gloss","▱",(0,.015,-.043),.012,DASH_MARK,right=(-1,0,0),rise=.0001)
    name=_sedan_asset("door_lock")
    _pill(name,"plain","Domed lock button",(0,-.007,0),.032,.076,.032,SEDAN_BLACK,"y",.51)
    _pill(name,"carLens","Visible lock dot",(0,.008,-.008),.015,.026,.005,rgb(0x974c3b),"y",.60)
