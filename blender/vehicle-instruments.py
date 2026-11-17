"""Meter artwork and center stack traced from the Sonata cabin close-ups."""

_WHITE_PRINT=rgb(0xd3d8cf)
_DARK_SWITCH=rgb(0x252a2b)
_GREEN_DIGIT=rgb(0x95deb0)
_RED_LAMP=rgb(0xe04c37)
_AMBER_LAMP=rgb(0xdcad42)


def _panel_print(name,text,x,y,size,surface,depth,color=_WHITE_PRINT,*,width=1,slot="gloss"):
    _letter(name,slot,text,(x,y,0),size,color,right=(-1,0,0),rise=.00008,width=width,
            project=lambda x,y,z:surface(x,y,depth-z))


def _line_mark(name,label,at,path,w,h,color=_WHITE_PRINT,stroke=.00057,closed=False,slot="gloss"):
    return _cord(name,slot,label,[at(-u*w,v*h) for u,v in path],stroke,color,
                 sides=4,closed=closed)


_SEGMENTS=(
    ((-.35,.5),(.35,.5)),((.42,.46),(.42,.065)),((.42,-.065),(.42,-.46)),
    ((-.35,-.5),(.35,-.5)),((-.42,-.46),(-.42,-.065)),
    ((-.42,.065),(-.42,.46)),((-.34,0),(.34,0))
)
_NUMERAL_SEGMENTS={"0":"012345","1":"12","2":"01346","3":"01236","4":"1256","5":"02356",
                   "6":"023456","7":"012","8":"0123456","9":"012356"}


def _lcd_numbers(name,text,at,width,height,color):
    """The dot and colon occupy the same narrow spacers as the real LCD."""
    advances=[width*.42 if glyph in ".:" else width for glyph in text]
    pen=-sum(advances)/2
    for letter,advance in zip(text,advances):
        x=pen+advance/2
        pen+=advance
        if letter in ".:":
            for v in ((-.46,) if letter=="." else (-.23,.23)):
                p=at(-x,v*height)
                _pill(name,"gloss","LCD punctuation",p,height*.09,height*.09,.0005,color,"z",.55)
            continue
        for segment in _NUMERAL_SEGMENTS[letter]:
            start,end=_SEGMENTS[int(segment)]
            ax,ay=start[0]*width,start[1]*height
            bx,by=end[0]*width,end[1]*height
            d=Vector((bx-ax,by-ay)).normalized()
            radius=height*.057
            normal=Vector((-d.y,d.x))*radius
            a,b=Vector((ax,ay)),Vector((bx,by))
            corners=(a-d*radius,a+normal,b+normal,b+d*radius,b-normal,a-normal)
            points=[at(-(x+p.x+.14*p.y),p.y) for p in corners]
            mesh(name,"gloss","LCD segment",points,[tuple(range(6))],color,soft=False)


def _meter_dial(name,x,y,z,radius,labels,units):
    trim=rgb(0x242825)
    dial=_pill(name,"plain","Recessed instrument dial",(x,y,z),
               2.062*radius,2.062*radius,.0042,trim,"z",1)
    dial["finish_override"]="Matte meter face"
    lathe(name,"plain","Rounded black gauge rim rolled into the dial face",
          [(.001,radius*1.031,radius*1.031),(-.0023,radius*1.024,radius*1.024),
           (-.0038,radius*1.002,radius*1.002),(-.0020,radius*.987,radius*.987)],
          rgb(0x30342e),72,(x,y,z),"z",caps=False)
    # The first and last tick are down to either side of the center caps.
    def polar(t,r,depth=.0032):
        a=3.78-4.40*t
        return (x-r*cos(a),y+r*sin(a),z-depth)
    period=5 if units=="x1000rpm" else 4
    intervals=(len(labels)-1)*period
    for i in range(intervals+1):
        t=i/intervals
        major=i%period==0
        color=rgb(0xb84f3e) if units=="x1000rpm" and t>.819 else rgb(0xb7bfb0)
        _cord(name,"gloss","Long gauge scale tick" if major else "Fine gauge graduation",
              [polar(t,radius*(.847 if major else .89)),polar(t,radius*.955)],
              .00087 if major else .00058,color,sides=4)
    for i,label in enumerate(labels):
        px,py,pz=polar(i/(len(labels)-1),radius*.734)
        _letter(name,"gloss",label,(px,py-.0042,pz-.0005),.0110,rgb(0xc0c6b9),
                right=(-1,0,0),width=.92,rise=.00008)
    _letter(name,"gloss",units,(x,y-radius*.535,z-.0037),.0096,rgb(0xc6cbbd),
            right=(-1,0,0),width=1.01,rise=.00008)
    tx,ty,tz=polar(-.009,radius*.932,.0055)
    direction=Vector((tx-x,ty-y)).normalized()
    width=Vector((-direction.y,direction.x))
    points=[]
    for pos,w in ((-.012,.0024),(.006,.00235),(radius*.902,.00120),(radius*.932,.00055)):
        p=Vector((x,y))+direction*pos
        points.extend((p.x+sign*width.x*w,p.y+sign*width.y*w,tz) for sign in (-1,1))
    mesh(name,"carLens","Tapered vermilion gauge needle",points,
         [(2*i,2*i+1,2*i+3,2*i+2) for i in range(3)],rgb(0xf45429),soft=False)
    _pill(name,"plain","Black pointer hub seated on the dial",(x,y,z-.0063),
          .020,.020,.0103,rgb(0x292c26),"z",1)
    for side in (-1,1):
        at=(x+side*radius*.353,y+.0004,z-.0035)
        _pill(name,"carMetal","Tiny gauge face screw",at,.0049,.0049,.0016,rgb(0x5e6459),"z",1)
        _cord(name,"plain","Screw slot",[_add(at,(dx,0,-.001)) for dx in (-.0015,.0015)],
              .00024,DASH_FACE,sides=4)


def _small_dial(name,side,center):
    x,y,z=center
    dial=_pill(name,"plain","Temperature dial face" if side>0 else "Fuel dial face",center,
               .070,.089,.003,rgb(0x242924),"z",.90)
    dial["finish_override"]="Matte meter face"
    hub=(x+side*.014,y,z-.004)
    for i in range(5):
        t=i/4
        py=blend(y-.034,y+.034,t)
        px=x-side*(.016+.010*sin(pi*t))
        color=rgb(0xc2422d) if i==4 and side>0 else rgb(0xb9bfb0)
        _cord(name,"gloss","Short auxiliary dial tick",[(px,py,z-.004),(px-side*.006,py+.004*(.5-t),z-.004)],
              .0008 if i in (1,3) else .00125,color,sides=4)
    lo,hi=("C","H") if side>0 else ("E","F")
    for letter,dy in ((lo,-.040),(hi,.027)):
        _letter(name,"gloss",letter,(x-side*.007,y+dy,z-.004),.012,DASH_MARK,
                right=(-1,0,0),rise=.00008)
    def mark(u,v):
        return x-.006*side+u,y+.001+v,z-.0041
    if side>0:
        _line_mark(name,"Coolant thermometer",mark,[(.02,.45),(.02,-.05),(-.25,-.14),(-.24,-.33),(.19,-.32),(.19,-.16),(.02,-.05)],.012,.014)
        for dy in (-.0049,-.0070):
            _cord(name,"gloss","Coolant wave",[mark((i-4)*.0014,dy+.0006*sin(i*pi*.50))
                  for i in range(9)],.00041,_WHITE_PRINT,sides=4)
    else:
        _line_mark(name,"Fuel pump icon",mark,[(-.33,-.42),(-.33,.41),(.14,.41),(.14,-.42)],.011,.012,closed=True)
        _line_mark(name,"Fuel pump hose",mark,[(.14,.14),(.31,.08),(.34,-.36),(.45,-.39),(.48,.09),(.30,.35)],.011,.012)
    tip=(x-side*.026,y-.026 if side>0 else y-.034,z-.0057)
    _cord(name,"carLens","Auxiliary pointer",[hub,tip],.0014,rgb(0xe24a29),sides=5)
    _pill(name,"plain","Auxiliary pointer hub",hub,.019,.019,.006,rgb(0x2c3028),"z",1)


def _cluster(name):
    center=(.450,.924,.684)
    outline=_outline([(-.247,-.078),(-.267,-.035),(-.268,.007),(-.242,.047),(-.196,.069),
                      (-.107,.086),(.091,.089),(.199,.074),(.242,.048),(.263,.011),
                      (.262,-.043),(.247,-.081),(.197,-.094),(-.193,-.094)],4)

    def surround(x,y,d):
        return _add(center,(x,y,d+.043*(x/.255)**2))

    _bezel(name,"carLeather","Molded meter visor over the meter mask",outline,surround,
           [(1.060,.018),(1.057,-.019),(1.026,-.058),(.987,-.069),(.951,-.065)],SEDAN_TRIM)
    _bezel(name,"carWood","Thin burl instrument surround",outline,surround,
           [(1.001,-.059),(1,-.069),(.966,-.075),(.943,-.068)],SEDAN_WALNUT)
    def meter_mask(x,y,d):
        return center[0]+x,center[1]+y,.614+.010*(x/.269)**2+d
    mask=_bezel(name,"plain","Full-width matte backing mask behind the four dials",outline,meter_mask,
                [(.959,.012),(.950,.003),(.941,0)],rgb(0x171b18),True)
    mask["finish_override"]="Matte meter face"
    _meter_dial(name,.545,.923,.607,.0795,[str(n) for n in range(9)],"x1000rpm")
    _meter_dial(name,.352,.922,.606,.0800,[str(n) for n in range(0,221,20)],"km/h")
    _small_dial(name,1,(.666,.884,.617))
    _small_dial(name,-1,(.233,.885,.617))

    def panel(x,y,d):
        return x,y,.606-d

    for kind,text,x,y in (("Odometer","148432",.351,.943),("Trip meter","067.1",.351,.899)):
        _pill(name,"plain",kind+" window",panel(x,y,.0022),.048,.010,.003,rgb(0x101411),"z",.49)
        for i,digit in enumerate(text):
            dx=x+(2.5-i)*.0071 if kind=="Odometer" else x+(2-i)*.0070
            box(name,"gloss",kind+" individual digit wheel",panel(dx,y,.0039),(.0065,.0079,.0011),
                rgb(0x626154 if digit=="1" and kind=="Trip meter" else 0x262920),.00045)
            _panel_print(name,digit,dx,y-.0025,.0084,panel,.0047,rgb(0xc6c8ba),width=.90)
    for i,letter in enumerate("PRND32L"):
        y=.972-i*.0154
        outline=_elliptic(.014,.010,.45,24)
        col=rgb(0x54d0a4) if i==0 else rgb(0x333a34)
        _bezel(name,"gloss","Park indicator bezel" if i==0 else "Gear indicator bezel",outline,
               lambda u,v,d:panel(.449+u,y+v,d),[(1,.0036),(.95,.0042),(.79,.0042)],col)
        _panel_print(name,letter,.449,y-.0030,.0093,panel,.0046,col if i==0 else DASH_MARK,width=.90)
    for side in (-1,1):
        x=.448+side*.038
        y=1.001
        points=[panel(x+side*u,y+v,.0034) for u,v in
                ((-.008,-.003),(.002,-.003),(.002,-.006),(.009,0),
                 (.002,.006),(.002,.003),(-.008,.003))]
        mesh(name,"gloss","Green direction indicator",points,[tuple(range(7))],rgb(0x298252),soft=False)

    for text,x,y,col in (("AIR",.569,.861,_RED_LAMP),("BAG",.569,.8545,_RED_LAMP),
                         ("BRAKE",.448,.8525,_RED_LAMP),("CHECK",.366,.859,_AMBER_LAMP),
                         ("ENGINE",.366,.8525,_AMBER_LAMP)):
        _panel_print(name,text,x,y,.0071,panel,.0049,col,width=.93)
    def oil(u,v):
        return panel(.469+u,.855+v,.005)
    _line_mark(name,"Oil pressure warning",oil,[(-.48,.18),(-.31,.11),(-.22,.29),(.18,.29),(.23,.10),
               (.49,.31),(.34,-.09),(.12,-.31),(-.19,-.32),(-.24,-.05),(-.44,-.04)],.016,.009,
               _RED_LAMP,.00051,True)
    def battery(u,v):
        return panel(.422+u,.8547+v,.005)
    _line_mark(name,"Charging system warning",battery,[(-.47,-.35),(-.47,.32),(.47,.32),(.47,-.35)],
               .013,.008,_RED_LAMP,.00053,True)
    for dx in (-.0037,.0037):
        _cord(name,"gloss","Battery terminal",[battery(dx,.0026),battery(dx,.00375)],
              .00067,_RED_LAMP,sides=4)
        _cord(name,"gloss","Battery sign",[battery(dx-.0014,0),battery(dx+.0014,0)],
              .00048,_RED_LAMP,sides=4)
    _cord(name,"gloss","Battery plus",[battery(-.0037,-.0013),battery(-.0037,.0013)],
          .00047,_RED_LAMP,sides=4)
    stem=(.288,.853,.590)
    lathe(name,"plain","Knurled trip-reset stem",[(-.009,.0032,.0032),(-.006,.004,.004),(.016,.0024,.0024)],
          rgb(0x303632),16,stem,"z")


def _switch(name,label,x,y,width,height,*,depth=.030,text=None,size=.0069,shape=.42):
    outline=_elliptic(width,height,shape,26)
    _bezel(name,"plain",label,outline,lambda u,v,d:_dash_face(x+u,y+v,d),
           [(1,depth-.010),(1,depth-.003),(.956,depth),(.887,depth+.0014)],_DARK_SWITCH,True)
    if text:
        _panel_print(name,text,x,y-size*.31,size,_dash_face,depth+.0023)


def _stack_vent_outline():
    return _outline([(-.055,-.036),(-.051,.037),(-.045,.050),(-.010,.052),
                     (.021,.046),(.044,.036),(.055,.016),(.057,-.025),(.049,-.041),(-.034,-.044)],4)


def _stack_vent(name,side,rim):
    x=side*.066
    y=.901

    def face(u,v,d):
        return _dash_face(x+side*u,y+v,d)

    _bezel(name,"plain","Rounded black center outlet case",rim,face,
           [(1,.020),(1,.024),(.989,.032),(.963,.033),(.916,.028)],rgb(0x171c1c))
    _bezel(name,"gloss","Small polished outlet edge",rim,face,
           [(.966,.031),(.958,.034),(.942,.034),(.926,.032)],rgb(0x586361))
    _bezel(name,"plain","Recessed center outlet opening",rim,face,[(.952,.022),(.917,.023)],
           rgb(0x111615),True)
    for u in (-.032,-.015,.007,.025,.042):
        _cord(name,"plain","Recessed vertical airflow guide",[face(u,-.036,.022),face(u,.036,.024)],
              .00165,rgb(0x333936),sides=5)
    for i in range(7):
        v=-.035+i*.0120
        a=-.050
        b=_profile(((-.037,.044),(-.025,.050),(.010,.053),(.028,.042),(.038,.032)),v,1)
        def fin(u,t):
            tx=blend(a,b,u)
            return face(tx,v+blend(-.0016,.0017,t)+.0007*sin(pi*u),.024+.011*sin(pi*t*.67))
        _panel(name,"gloss","Black curved outlet louver",16,4,fin,rgb(0x3a4443),flip=side>0)
    _pill(name,"plain","Fluted airflow thumb tab",face(.004,.007,.041),.036,.010,.006,
          rgb(0x313a39),"z",.54)
    for i in range(11):
        xu=(i-5)*.0029
        _cord(name,"gloss","Vent tab ribs",[face(.004+xu,.004,.044),face(.004+xu,.011,.044)],
              .00055,rgb(0x788180),sides=4)


def _climate_controls(name):
    at=(.109,.792)
    dial=_dash_face(*at,.034)
    lathe(name,"plain","Temperature rotary control",[(-.013,.020,.020),(-.010,.022,.022),(.001,.021,.021)],
          rgb(0x333a39),36,dial,"z")
    lathe(name,"gloss","Knob front chamfer",[(-.014,.019,.019),(-.012,.020,.020)],
          rgb(0x3e4643),36,dial,"z")
    _panel_print(name,"TEMP",.109,.821,.0086,_dash_face,.032)
    for side,c in ((1,rgb(0x315e9b)),(-1,rgb(0xa44033))):
        path=[_dash_face(at[0]+side*(.021+.005*u),at[1]+.018-.005*u,.036)
              for u in _range(9)]
        _cord(name,"gloss","Blue or red temperature limit",path,.0018,c,sides=5)

    display=_outline([(-.074,-.017),(-.072,.015),(-.065,.019),(.066,.019),
                      (.074,.014),(.071,-.017),(.063,-.019),(-.067,-.019)],3)
    def display_face(x,y,d):
        return _dash_face(-.016+x,.793+y,d)
    _bezel(name,"gloss","Raised polished climate LCD surround",display,display_face,
           [(1,.020),(1,.027),(.932,.035),(.889,.037),(.86,.031)],rgb(0x6f5f4e))
    _bezel(name,"plain","Dark green climate display glass",display,display_face,
           [(.873,.032),(.853,.035)],rgb(0x1c2922),True)
    _panel_print(name,"AUTO",.034,.802,.0066,_dash_face,.038,_GREEN_DIGIT)
    _lcd_numbers(name,"24.0",lambda u,v:display_face(.043+u,-.004+v,.038),.00915,.011,_GREEN_DIGIT)
    _panel_print(name,"°C",.000,.790,.0083,_dash_face,.038,_GREEN_DIGIT)
    clock=( -.059,.792 )
    frame=[_dash_face(clock[0]+u,clock[1]+v,.0375) for u,v in
           ((-.020,-.009),(.020,-.009),(.020,.009),(-.020,.009))]
    _cord(name,"gloss","Thin clock frame etched in LCD",frame,.00045,_GREEN_DIGIT,closed=True,sides=4)
    _lcd_numbers(name,"3:57",lambda u,v:_dash_face(clock[0]+u,clock[1]+v,.038),.0086,.0118,_GREEN_DIGIT)
    def airflow(u,v):
        return _dash_face(-.015+u,.793+v,.038)
    _line_mark(name,"LCD seated airflow figure",airflow,[(-.35,-.25),(-.09,-.26),(.04,.05),(.23,.08),
               (.39,.38)],.014,.014,_GREEN_DIGIT,.0009)
    _pill(name,"gloss","LCD airflow figure head",airflow(-.006,.006),.0028,.0028,.0007,_GREEN_DIGIT,"z",1)
    for a in (0,pi/2,pi,3*pi/2):
        _cord(name,"gloss","Four-bladed fan on LCD",[_dash_face(-.032+u*cos(a)-v*sin(a),
              .795+u*sin(a)+v*cos(a),.038) for u,v in ((0,0),(.0029,.0011),(.0042,.0031),(.0019,.0037),(0,0))],
              .00054,_GREEN_DIGIT,sides=4)

    # Two divided rocker shells, with the radiused side nearest the outer edges.
    for x,side,labels in ((.063,1,("AUTO","OFF")),(-.109,-1,("A/C","AMB"))):
        border=_outline([(-.016,-.022),(-.017,.022),(-.005,.023),(.014,.014),
                         (.019,.001),(.017,-.012),(.006,-.022)],3)
        _bezel(name,"gloss","Bright climate rocker edge",border,
               lambda u,v,d:_dash_face(x+side*u,.795+v,d),
               [(1,.026),(1,.033),(.948,.036),(.907,.037)],rgb(0x89877b))
        _bezel(name,"plain","Curved climate dual rocker",border,lambda u,v,d:_dash_face(x+side*u,.795+v,d),
               [(.935,.036),(.906,.039)],_DARK_SWITCH,True)
        _cord(name,"gloss","Thin climate rocker split",
              [_dash_face(x+u,.795,.040) for u in (-.015,.015)],.00062,rgb(0x606865),sides=4)
        for dy,text in zip((.009,-.011),labels):
            _panel_print(name,text,x,.795+dy-.0022,.0078,_dash_face,.041)

    for i,text in enumerate("HMR"):
        x=.029-i*.026
        _switch(name,"Clock adjustment button",x,.758,.016,.0059,depth=.028)
        _panel_print(name,text,x+.012,.756,.0064,_dash_face,.025)

    for x,w,label,caption in ((.105,.063,"Fan speed rocker",None),(.031,.033,"Vent mode","MODE"),
                            (-.005,.029,"Recirculation",None),(-.049,.029,"Front demister","FRONT"),
                            (-.084,.029,"Rear demister","REAR"),(-.126,.024,"Air-quality rocker",None)):
        _switch(name,label,x,.726,w,.032,depth=.030)
        if caption:
            _panel_print(name,caption,x,.7147 if caption!="MODE" else .723,.0062,_dash_face,.033)
    def symbol(x,y,u,v):
        return _dash_face(x+u,y+v,.0334)
    for dx,sign in ((.017,-1),(-.018,1)):
        _line_mark(name,"Fan speed chevron",lambda u,v:symbol(.105+dx,.726,u,v),
                   [(-.4,.30*sign),(0,-.35*sign),(.4,.30*sign)],.009,.009,stroke=.00071)
    for a in (0,pi/2,pi,3*pi/2):
        _cord(name,"gloss","Printed fan blade",[symbol(.105,.726,u*cos(a)-v*sin(a),u*sin(a)+v*cos(a))
              for u,v in ((0,0),(.003,.001),(.0035,.003),(.0023,.004),(.0006,.003),(0,0))],
              .00062,_WHITE_PRINT,sides=4)
    _line_mark(name,"Recirculation car outline",lambda u,v:symbol(-.005,.726,u,v),
               [(-.48,-.23),(-.48,.01),(-.24,.10),(-.11,.32),(.29,.32),
                (.38,.17),(.49,.03),(.49,-.22)],.017,.010,closed=True)
    _line_mark(name,"Recirculation loop arrow",lambda u,v:symbol(-.005,.726,u,v),
               [(-.28,-.05),(.04,-.09),(.22,.06),(.06,.17),(-.10,.09),(.06,.07)],.014,.010)
    for x,is_front in ((-.049,True),(-.084,False)):
        path=([(-.31,-.30),(-.49,.29),(0,.43),(.49,.29),(.31,-.30)] if is_front else
              [(-.43,-.32),(-.43,.36),(.43,.36),(.43,-.32)])
        _line_mark(name,"Defogger outline",lambda u,v:symbol(x,.731,u,v),path,.013,.009,closed=True)
        for dx in (-.0028,0,.0028):
            _cord(name,"gloss","Defogger heat lines",[symbol(x,.731,dx+u,v) for u,v in
                  ((0,-.0034),(-.0006,-.0013),(.0006,.0011),(0,.0032))],
                  .00042,_WHITE_PRINT,sides=4)
    _panel_print(name,"A",-.126,.724,.0085,_dash_face,.033)
    _cord(name,"gloss","Air-quality circle",
          [symbol(-.126,.727,.005*cos(t),.005*sin(t)) for t in (tau*i/22 for i in range(22))],
          .00051,_WHITE_PRINT,closed=True,sides=4)
    for i in range(4):
        _cord(name,"plain","Air quality sensor slots",[_dash_face(x,.704-i*.0024,.023) for x in (-.136,-.116)],
              .0006,rgb(0x38291e),sides=4)


def _radio(name):
    case=_outline([(-.128,-.043),(-.127,.038),(-.111,.053),(.103,.053),(.126,.041),
                   (.130,-.031),(.112,-.053),(-.103,-.052)],4)
    def panel(u,v,d):
        return _dash_face(u,.641+v,d)
    _bezel(name,"plain","Rounded OEM cassette radio faceplate",case,panel,
           [(1,.014),(1,.025),(.984,.028),(.955,.033)],rgb(0x242929))
    tape=_outline([(-.048,-.008),(-.046,.007),(.046,.007),(.049,-.005),(.041,-.008)],3)
    _perforated_surface(name,"plain","Cassette radio face with slotted loading port",
                        _offset_outline(case,(0,0),.955),[_offset_outline(tape,(0,-.001))],
                        [(x,y) for x in (blend(-.119,.119,u) for u in _range(28))
                         for y in (-.044,-.031,-.012,.011,.028,.043)],
                        lambda x,y:panel(x,y,.033),rgb(0x242929),flip=True)
    _cord(name,"gloss","Curved receiver face joint",
          [panel(x,blend(-.012,-.020,smooth(-.07,.10,x))+.005*sin(pi*u),.034)
           for x,u in ((blend(-.123,.126,t),t) for t in _range(31))],
          .00076,rgb(0x141a19),sides=4)
    lcd_outline=_elliptic(.155,.027,.34,42)
    _bezel(name,"plain","Dark radio LCD border",lcd_outline,lambda x,y,d:panel(x+.009,y+.028,d),
           [(1,.035),(1,.037),(.927,.039)],rgb(0x131a16),True)
    _bezel(name,"gloss","Yellow-green radio LCD",lcd_outline,lambda x,y,d:panel(x+.009,y+.028,d),
           [(.925,.039),(.895,.041)],rgb(0x9c9c6a),True)
    _panel_print(name,"FM1",.053,.667,.0125,_dash_face,.043,rgb(0x242c22),width=.88)
    _lcd_numbers(name,"89.1",lambda u,v:panel(-.014+u,.0275+v,.043),.0094,.0105,rgb(0x2e3528))
    _lcd_numbers(name,"1",lambda u,v:panel(-.049+u,.032+v,.043),.0074,.007,rgb(0x323928))
    for text,x,y in (("ST",.053,.677),("CH",-.048,.663)):
        _panel_print(name,text,x,y,.0056,_dash_face,.043,rgb(0x30362a))
    _panel_print(name,"HYUNDAI",.067,.687,.0080,_dash_face,.039,width=1.02)
    _panel_print(name,"CASSETTE / FM-AM TUNER RECEIVER",.003,.688,.0053,_dash_face,.039,width=.96)
    _panel_print(name,"disc",-.105,.673,.007,_dash_face,.036)
    _panel_print(name,"DIGITAL AUDIO",-.105,.669,.0039,_dash_face,.036,width=.90)
    _bezel(name,"plain","Full-depth tape insertion recess",tape,lambda x,y,d:panel(x,y-.001,d),
           [(1,.032),(1,.042),(.94,.044),(.894,.039),(.87,.023)],rgb(0x191e1d))
    _bezel(name,"plain","Cassette slot black dust flap",tape,lambda x,y,d:panel(x,y-.001,d),
           [(.884,.025),(.87,.027)],rgb(0x0c100f),True)
    _cord(name,"carMetal","Lower tape slot chamfer",[panel(-.045,-.007,.043),panel(.045,-.007,.043)],
          .0012,rgb(0x8b938a),sides=5)
    _panel_print(name,"FULL LOGIC CONTROL",0,.643,.0040,_dash_face,.029,rgb(0x777461))

    _switch(name,"Tune and disc selector",.103,.660,.030,.031,depth=.040,shape=.39)
    for txt,y,size in (("+",.667,.0080),("TUNE",.659,.0072),("DISC",.651,.0064),("−",.643,.0075)):
        _panel_print(name,txt,.103,y,size,_dash_face,.043)
    for x in (.078,.102):
        knob=_dash_face(x,.632,.042)
        lathe(name,"gloss","Concentric tone rotary adjuster",[(-.005,.0063,.0063),(-.003,.0074,.0074),
              (.003,.0076,.0076)],rgb(0x363f3e),20,knob,"z")
    _panel_print(name,"BASS / BAL · PULL · FADE / TREB",.087,.641,.0047,_dash_face,.038,width=.91)
    for x,text in ((.036,"FM·AM"),(-.002,"TAPE"),(-.041,"CDCHG")):
        _switch(name,"Receiver source selector",x,.621,.035,.012,depth=.041,text=text,size=.0062,shape=.52)
    for i,(legend,sub) in enumerate(zip("123456",("","REW","|<<",">>|","FF","RPT"))):
        x=.043-i*.0271
        y=.602+.004*smooth(0,5,i)
        _switch(name,"Preset or transport button "+legend,x,y,.023,.018,depth=.041,shape=.78)
        _panel_print(name,legend,x,y-.0007,.0079,_dash_face,.044)
        if sub:
            _panel_print(name,sub,x,y-.006,.0048,_dash_face,.044,width=.89)
    _switch(name,"Cassette eject button",-.071,.642,.021,.011,depth=.040,text="▲",size=.0068,shape=.87)
    _switch(name,"Equalizer button",-.102,.641,.019,.011,depth=.040,text="EQ",size=.0068,shape=.90)
    volume=_dash_face(.099,.600,.045)
    lathe(name,"plain","Large volume knob with outer socket",
          [(-.011,.020,.020),(-.008,.021,.021),(.006,.022,.022),(.009,.020,.020)],
          rgb(0x2b3334),32,volume,"z")
    for i in range(32):
        a=tau*i/32
        p=_add(volume,(.0204*cos(a),.0204*sin(a),0))
        _cord(name,"gloss","Knurled volume knob grip",[_add(p,(0,0,z)) for z in (-.006,.004)],
              .00081,rgb(0x3f4746),sides=4)
    _panel_print(name,"ON",.123,.619,.0054,_dash_face,.042)
    _panel_print(name,"VOL",.123,.613,.0056,_dash_face,.042)


def _center_stack(name):
    outline=_outline([(-.137,-.209),(-.151,.094),(-.147,.172),(-.114,.200),(-.074,.213),
                      (.073,.213),(.122,.196),(.149,.164),(.152,.092),(.137,-.201),
                      (.111,-.229),(-.111,-.229)],4)
    def center(u,v,d):
        return _dash_face(u,.750+v,d)
    _bezel(name,"carLeather","Molded dash surround joined to walnut stack",
           outline,center,[(1.067,-.058),(1.044,-.010),(1.028,.009),(1.006,.016),(.984,.013)],
           rgb(0x827e6f))
    _bezel(name,"carWood","Glossy curved walnut center bezel",outline,center,
           [(1,-.023),(1,.010),(.992,.019),(.965,.025)],SEDAN_WALNUT)
    vent=_stack_vent_outline()
    outlets=[[(side*(.066+x*.974),.151+y*.974) for x,y in vent] for side in (-1,1)]
    _perforated_surface(name,"carWood","Burl face with both recessed air outlet apertures",
                        _offset_outline(outline,(0,0),.965),outlets,
                        [(x,y) for x in (blend(-.141,.141,t) for t in _range(30))
                         for y in (blend(-.215,.202,t) for t in _range(39))],
                        lambda x,y:center(x,y,.025),SEDAN_WALNUT,flip=True)
    _bezel(name,"gloss","Fine rolled center bezel edge",outline,center,
           [(1.004,.012),(.999,.016),(.993,.019)],rgb(0x928373))
    for y in (.835,.753,.704,.584):
        _cord(name,"gloss","Fine center panel molding break",
              [_dash_face(x,y-.0027*(x/.144)**2,.0248) for x in (blend(-.142,.142,t) for t in _range(24))],
              .00096,rgb(0x423022),sides=4)
    for side in (-1,1):
        _stack_vent(name,side,vent)
    _switch(name,"Hazard button",0,.900,.027,.057,depth=.032)
    _line_mark(name,"Red hazard triangle",lambda u,v:_dash_face(u,.902+v,.036),
               [(-.43,-.29),(.43,-.29),(0,.45)],.019,.018,rgb(0xd75742),.00145,True,"carLens")
    _climate_controls(name)
    _radio(name)
    _pill(name,"plain","Recess behind ash tray",(0,.546,.621),.192,.072,.016,SEDAN_BLACK,"z",.49)
    cap=(-.096,.598,.608)
    lathe(name,"carMetal","Polished lighter socket ring",
          [(.012,.021,.021),(.004,.025,.025),(-.005,.024,.024),(-.009,.018,.018)],
          SEDAN_ALLOY,32,cap,"z",caps=False)
    box(name,"plain","Glovebox liner rear wall",(-.474,.672,1.002),(.520,.173,.027),rgb(0x383731),.010)
    for side in (-1,1):
        x=-.474+side*.251
        box(name,"carLeather","Fixed glovebox cavity jamb",(x,.669,.913),
            (.027,.162,.179),rgb(0x59574d),.009)
        _pill(name,"carLeather","Fixed glovebox hinge pin housing",(x,.592,.842),
              .039,.039,.035,rgb(0x6b6353),"x",.81)
        lathe(name,"carMetal","Glovebox captive hinge pin",[(0,.007,.007),(.032,.007,.007)],
              rgb(0x62605a),12,(x-.016,.589,.841),"x")
