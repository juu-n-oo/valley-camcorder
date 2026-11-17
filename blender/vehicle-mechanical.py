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


def _bay_band(name, label, at, direction, radius, width, color):
    axis=Vector(direction).normalized()
    reference=Vector((0,1,0)) if abs(axis.y)<.88 else Vector((0,0,1))
    across=axis.cross(reference).normalized()
    up=axis.cross(across)
    center=Vector(at)
    rows=[]
    for end,edge in ((-.5,-.0015),(-.38,0),(.38,0),(.5,-.0015)):
        rows.append([tuple(center+axis*(end*width)+(radius+edge)*(across*cos(a)+up*sin(a)))
                     for a in (j*tau/20 for j in range(20))])
    return rows_mesh(name,"carMetal",label,rows,color,caps=False)


def _bay_side_pans(name):
    # The shock towers sit in folded sheet metal with a recessed engine-mount
    # pocket on the timing side, distinct from the painted fender flanges.
    outline=_outline([(.445,1.230),(.457,1.323),(.436,1.408),(.419,1.521),
                      (.452,1.610),(.499,1.635),(.516,1.782),(.550,1.932),
                      (.642,2.059),(.741,2.079),(.767,1.818),(.756,1.509),
                      (.735,1.299),(.693,1.147),(.598,1.153)],3)
    opening=_offset_outline(_elliptic(.231,.232,1,38),(.592,1.467))
    spot_welds=[(.741,1.385),(.744,1.513),(.750,1.646),(.751,1.757),
                (.736,1.872),(.701,1.996),(.482,1.590),(.481,1.282)]
    for side in (-1,1):
        def pan(x,z):
            shelf=smooth(.621,.744,x)
            saddle=exp(-((x-.592)/.156)**2-((z-1.468)/.208)**2)
            pocket=(.063 if side>0 else .034)*exp(-((x-.575)/.113)**2-((z-1.730)/.088)**2)
            surface=.683+.062*shelf+.043*saddle-.055*smooth(1.735,2.067,z)-pocket
            return side*x,surface,z

        surface=_perforated_surface(name,"carMetal","Pressed steel fender apron with an open strut seat",
                                    outline,[opening],[(x,z) for x in
                                    (blend(.42,.77,t) for t in _range(21)) for z in
                                    (blend(1.17,2.059,t) for t in _range(33))],
                                    pan,rgb(0x333837),flip=side>0)
        surface["finish_override"]="Painted bay steel"
        _cord(name,"carMetal","Folded apron lip",
              [_add(pan(x,z),(0,.0025,0)) for x,z in outline],
              .004,rgb(0x4a504e),sides=7,closed=True)
        _cord(name,"plain","Molded fender edge bonnet seal",
              catmull([(side*.721,.750,1.108),(side*.747,.755,1.433),
                        (side*.752,.748,1.767),(side*.716,.681,2.071)],7),
              .0064,SEDAN_RUBBER,sides=9)
        at=(side*.592,.714,1.467)
        turret=lathe(name,"carMetal","Stamped strut tower with raised concentric lip",
                     [(-.022,.135,.135),(.006,.135,.135),(.016,.121,.121),
                      (.024,.112,.112),(.021,.101,.101),(.036,.098,.098),
                      (.043,.091,.091)],rgb(0x4c514f),48,at)
        turret["finish_override"]="Painted bay steel"
        lathe(name,"carMetal","Central black strut dome with rolled outer shoulder",
              [(-.007,.074,.074),(.004,.076,.076),(.013,.071,.071),
               (.023,.060,.060),(.036,.046,.046),(.041,.031,.031),(.042,.020,.020)],
              rgb(0x2d3231),40,_add(at,(0,.038,0)))
        for i in range(3):
            a=i*tau/3+.44
            p=_add(at,(.090*cos(a),.036,.090*sin(a)))
            lathe(name,"carMetal","Strut plate washer and hex nut",
                  [(0,.011,.011),(.003,.011,.011),(.005,.0075,.0075),
                   (.012,.0075,.0075),(.014,.0062,.0062)],rgb(0x777a6c),12,p)
            lathe(name,"carMetal","Strut stud end",[(0,.0035,.0035),(.005,.0035,.0035)],
                  rgb(0x928b75),10,_add(p,(0,.012,0)))
        for x,z in spot_welds:
            p=pan(x,z)
            lathe(name,"carMetal","Small round apron spot weld",
                  [(-.001,.006,.006),(.002,.0044,.0044),(.0027,.003,.003)],rgb(0x666c66),11,p)
        for x,z in ((.730,1.166),(.699,1.344),(.477,1.548),(.713,1.932)):
            p=_add(pan(x,z),(0,.0025,0))
            lathe(name,"plain","Recessed apron access plug",
                  [(0,.009,.009),(.0025,.008,.008),(.003,.005,.005)],rgb(0x242826),14,p)

    rail_outline=_outline([(-.098,-.074),(.095,-.068),(.115,-.024),(.093,.068),
                           (.046,.082),(-.091,.077),(-.110,.038)],3)
    rail=lambda x,z,d:(.566+x,.656+.063*smooth(-.019,.108,x)+d,1.761+z)
    _bezel(name,"carMetal","Pressed side-engine mount pocket and flange",rail_outline,rail,
           [(1,-.022),(1,0),(.936,.009),(.827,.011),(.704,-.030)],rgb(0x474e4b))
    _bezel(name,"plain","Dark inset below timing-side mount",rail_outline,rail,
           [(.706,-.031),(.692,-.039)],rgb(0x181c1a),True)
    mount=(.502,.641,1.767)
    lathe(name,"carMetal","Rounded transverse motor mount sleeve",
          [(-.054,.047,.047),(-.029,.056,.053),(.017,.056,.053),(.037,.044,.044)],
          rgb(0x4b504c),30,mount,"x")
    lathe(name,"plain","Bonded rubber motor mount isolation ring",
          [(0,.037,.036),(.007,.035,.034),(.009,.015,.015)],
          rgb(0x222624),28,_add(mount,(.036,0,0)),"x")
    for x,z in ((.628,1.708),(.641,1.795),(.478,1.729),(.474,1.820)):
        lathe(name,"carMetal","Engine mount flange bolt",
              [(0,.009,.009),(.004,.009,.009),(.010,.0068,.0068)],rgb(0x878981),12,
              rail(x-.566,z-1.761,.006))


def _bay_cooling_and_hydraulic_lines(name):
    alloy=rgb(0xa5a69a)
    zinc=rgb(0x999e90)
    rubber=rgb(0x242a29)

    # The main molded hose joins the alloy outlet on the head to the tank.
    outlet=(-.152,.712,1.766)
    lathe(name,"carMetal","Cast thermostat outlet shoulder",
          [(-.036,.033,.033),(-.027,.039,.037),(-.009,.036,.036),
           (.008,.030,.030),(.030,.026,.026)],alloy,28,outlet,"x")
    for y,z in ((.736,1.739),(.677,1.796)):
        lathe(name,"carMetal","Thermostat housing flange bolt",
              [(-.013,.0065,.0065),(0,.0065,.0065)],zinc,8,(-.177,y,z),"x")
    hose=[(-.176,.708,1.779),(-.218,.686,1.821),(-.264,.655,1.898),
          (-.265,.625,1.969),(-.231,.608,2.015),(-.221,.621,2.055),
          (-.235,.634,2.111)]
    tube(name,"plain","S-shaped upper radiator hose from head outlet to tank",
         [(p,r,r*.96) for p,r in zip(hose,(.026,.028,.031,.031,.027,.025,.024))],
         rubber,sides=20,density=7)
    for p,adjacent in ((hose[0],hose[1]),(hose[-1],hose[-2])):
        axis=Vector(adjacent)-Vector(p)
        at=Vector(p)+.008*axis.normalized()
        _bay_band(name,"Screw clamp at radiator hose joint",at,axis,.029,.011,zinc)
        box(name,"carMetal","Hose clamp screw saddle",_add(at,(.020,.022,0)),
            (.013,.009,.015),alloy,.0018)
    _cord(name,"plain","Lower radiator return hose below the fan",
          catmull([(-.511,.484,2.101),(-.406,.448,2.052),(-.323,.424,2.042),
                   (-.235,.426,1.936),(-.170,.490,1.800)],6),
          .019,rubber,sides=14)
    _cord(name,"plain","Small coolant bypass hose at thermostat",
          catmull([(-.159,.687,1.746),(-.201,.668,1.700),(-.218,.648,1.600),
                   (-.190,.682,1.504),(-.138,.690,1.434)],6),
          .0071,rubber,sides=9)
    overflow=(-.575,.620,2.086)
    _cord(name,"plain","Overflow hose from radiator filler neck to reserve bottle",
          catmull([(-.247,.657,2.109),(-.329,.650,2.087),(-.410,.628,2.090),
                   (-.527,.635,2.098),overflow],5),
          .0048,rgb(0x373d37),sides=8)
    lathe(name,"plain","Coolant reserve bottle tucked ahead of the battery",
          [(0,.036,.046),(.019,.048,.048),(.066,.046,.043),(.095,.026,.029),
           (.130,.018,.018)],rgb(0x9c9b87),29,(-.575,.485,2.085))
    lathe(name,"plain","Dark cap on the reserve-bottle filler neck",
          [(0,.027,.027),(.008,.028,.028),(.011,.024,.024)],rgb(0x303432),29,overflow)
    for x in (-.023,.023):
        _pill(name,"plain","Finger tab on coolant reserve cap",_add(overflow,(x,.006,0)),
              .018,.014,.007,rgb(0x343935),"y",.52)

    # The A/C liquid and suction paths cross by the washer neck. The aluminum
    # sections stop at rolled crimps where the flexible sections begin.
    liquid=[(.393,.745,1.117),(.398,.731,1.176),(.459,.716,1.207),
            (.478,.749,1.246),(.520,.740,1.292),(.484,.689,1.533),
            (.479,.633,1.782),(.464,.615,1.961)]
    suction=[(.422,.737,1.092),(.469,.708,1.122),(.504,.702,1.164),
             (.504,.731,1.221),(.547,.714,1.290),(.526,.677,1.463),
             (.504,.634,1.716),(.491,.608,1.975)]
    _pill(name,"plain","Firewall seal at the paired A/C pipe penetrations",
          (.410,.739,1.105),.095,.059,.026,rgb(0x252a28),"z",.40)
    for label,route,radius in (("A/C liquid hardline with stepped firewall bends",liquid,.0043),
                               ("A/C return hardline down timing side",suction,.0067)):
        _cord(name,"carMetal",label,catmull(route,6),radius,alloy,sides=11)
        for index in (0,3,7):
            along=Vector(route[min(index+1,7)])-Vector(route[max(index-1,0)])
            _bay_band(name,"Swaged aluminum A/C hose ferrule",route[index],along,
                      radius+.0036,.021,zinc)
    front_coupling=(.480,.616,1.986)
    _cord(name,"plain","Reinforced rubber A/C suction section across the accessory drive",
          catmull([suction[-1],front_coupling,(.418,.602,1.999),(.355,.569,2.028),
                   (.315,.526,2.052),(.294,.495,2.094)],5),
          .0101,rgb(0x353936),sides=11)
    branch=[liquid[-1],(.501,.594,2.075),(.533,.600,2.101),(.544,.613,2.077),
            (.544,.612,2.027),(.575,.596,2.009),(.642,.536,2.052)]
    _cord(name,"carMetal","Looped front A/C condenser pipe by the washer filler",
          catmull(branch,5),.0057,rgb(0xb8b8a8),sides=10)
    for at,color in (((.489,.615,2.036),rgb(0xc5a950)),
                     ((.398,.746,1.160),rgb(0x969486))):
        lathe(name,"carMetal","A/C service port collar",[(0,.008,.008),(.019,.008,.008)],
              zinc,12,_add(at,(0,-.010,0)))
        lathe(name,"gloss","Knurled service port cap",[(0,.009,.009),(.010,.009,.009),(.012,.007,.007)],
              color,18,_add(at,(0,.006,0)))

    steering_lines=(
        ("Power steering reservoir feed to the accessory pump",
         [(.556,.602,1.819),(.554,.584,1.860),(.517,.570,1.901),
          (.464,.576,1.884),(.433,.582,1.847)],.013),
        ("Power steering return below the reservoir mounting band",
         [(.589,.622,1.803),(.602,.627,1.843),(.614,.590,1.895),
          (.607,.531,1.945),(.552,.527,2.071)],.0095),
    )
    for label,route,radius in steering_lines:
        _cord(name,"plain",label,catmull(route,6),radius,rubber,sides=11)
        _bay_band(name,"Crimp on power steering hose",route[1],
                  Vector(route[2])-Vector(route[0]),radius+.002,.010,zinc)
    _cord(name,"carMetal","Formed lower steering return pipe",
          catmull([(.552,.527,2.071),(.524,.512,2.115),(.461,.479,2.126),
                   (.273,.473,2.129),(.198,.458,2.159)],5),
          .0062,rgb(0x747d73),sides=9)
    _bay_band(name,"Power steering bottle bracket",(.553,.639,1.819),(0,1,0),.056,.011,
              rgb(0x585e58))

    brake=(-.468,.678,1.203)
    lathe(name,"carMetal","Master cylinder casting beneath ivory fluid reservoir",
          [(-.063,.030,.031),(-.040,.042,.033),(-.007,.037,.028),
           (.044,.032,.027),(.074,.021,.021)],rgb(0x767b73),33,brake,"z")
    _bay_band(name,"Pressed rim around the black brake booster",
              (-.455,.742,1.155),(0,0,1),.111,.011,rgb(0x424945))
    for x,z,s in ((-.479,1.218,-1),(-.444,1.247,1)):
        at=(x,.683,z)
        lathe(name,"carMetal","Master cylinder brake line union",
              [(0,.0065,.0065),(.008,.0060,.0060)],zinc,8,at)
        _cord(name,"carMetal","Brake hardline descending onto bulkhead",
              catmull([_add(at,(0,.005,0)),(x+s*.031,.701,z+.020),
                        (x-.039,.642,z-.014),(x-.084,.628,1.159),
                        (x-.177,.622,1.122),(x-.221,.568,1.145)],6),
              .0026,rgb(0x8e8b78),sides=8)
    _pill(name,"plain","Double brake line pass-through on lower firewall",
          (-.681,.571,1.122),.076,.054,.041,rgb(0x2d332f),"z",.58)
    _cord(name,"plain","Braided vacuum hose from intake to brake booster",
          catmull([(-.060,.765,1.212),(-.099,.820,1.178),(-.223,.824,1.084),
                   (-.352,.815,1.098),(-.411,.818,1.106),(-.484,.814,1.181)],7),
          .0088,rubber,sides=11)
    _bay_band(name,"Brake booster vacuum hose ferrule",(-.483,.815,1.173),
              (-.073,-.004,.075),.012,.009,zinc)

    _cord(name,"plain","Breather elbow between cam cover and intake manifold",
          catmull([(.226,.808,1.424),(.229,.786,1.390),(.230,.750,1.368),
                   (.257,.722,1.338),(.240,.723,1.282)],6),
          .0085,rgb(0x252a28),sides=10)
    for p,axis in (((.226,.800,1.415),(0,-.52,-.53)),((.244,.723,1.291),(-.3,0,-.8))):
        _bay_band(name,"Breather hose spring band",p,axis,.011,.008,rgb(0x808578))


def _bay_loom(name, label, controls, radius):
    from bisect import bisect_right

    spine=[Vector(p) for p in catmull(controls,6)]
    distance=[0.]
    for a,b in zip(spine,spine[1:]):
        distance.append(distance[-1]+(b-a).length)
    samples=max(8,int(distance[-1]/.0024))
    conduit=[]
    for step in range(samples+1):
        s=distance[-1]*step/samples
        end=min(bisect_right(distance,s),len(spine)-1)
        t=(s-distance[end-1])/(distance[end]-distance[end-1])
        p=spine[end-1].lerp(spine[end],t)
        crest=.5+.5*cos(tau*s/.0065)
        radius_here=radius*(.86+.14*crest)
        conduit.append((p,radius_here,radius_here))
    tube(name,"plain",label,conduit,rgb(0x292e2c),sides=8,density=1)


def _bay_electrical(name):
    near_coil=(.342,.743,1.373)
    box(name,"plain","Ignition coil assembly behind the timing cover",near_coil,
        (.085,.051,.102),rgb(0x292d2c),.008)
    box(name,"carMetal","Stamped bracket beneath ignition coils",(.347,.718,1.371),
        (.104,.009,.112),rgb(0x535750),.003)
    for i in range(4):
        at=(.329+.013*i,.764,1.407-.019*i)
        end=(.273-.090*i,.807,1.430)
        _cord(name,"plain","Individual high-tension lead into rear cam-cover well",
              catmull([at,_add(at,(-.009,.022,.023)),(end[0]+.040,.817,1.387),end],6),
              .0043,SEDAN_RUBBER,sides=9)
        lathe(name,"plain","Ignition lead molded terminal boot",
              [(-.006,.0085,.0085),(0,.009,.009),(.008,.0062,.0062)],rgb(0x242826),16,end)

    sensor=(-.112,.761,1.276)
    fan_plug=(.352,.612,2.088)
    fuse_plug=(-.552,.693,1.668)
    block_plug=(-.165,.616,1.865)
    _bay_loom(name,"Corrugated main harness between throttle and lower engine",
              [sensor,(-.154,.739,1.315),(-.195,.675,1.445),(-.178,.662,1.632),
               (-.162,.640,1.773),block_plug],.0085)
    _bay_loom(name,"Corrugated branch crossing the front of the radiator",
              [block_plug,(-.172,.559,1.966),(-.108,.546,2.029),(.131,.565,2.034),
               (.264,.584,2.032),fan_plug],.0068)
    _bay_loom(name,"Split fuse loom secured to inner apron",
              [fuse_plug,(-.537,.629,1.732),(-.446,.623,1.803),(-.370,.650,1.938),
               (-.344,.604,2.041),(-.263,.572,2.031),(-.172,.559,1.966)],.0072)
    _bay_loom(name,"Rear loom into intake and ignition connectors",
              [(.401,.743,1.255),(.418,.732,1.329),(.393,.729,1.388),
               (.275,.731,1.361),(.128,.709,1.369),(-.042,.714,1.300),sensor],.0069)
    for at,angle in ((sensor,-.48),(fan_plug,.20),(fuse_plug,-.22),(block_plug,.17),((.396,.752,1.270),.30)):
        box(name,"plain","Keyed rectangular engine wiring connector",at,(.029,.019,.039),
            rgb(0x363a36),.003,angle)
        box(name,"gloss","Raised locking tab on connector",_add(at,(0,.011,-.007)),
            (.013,.005,.015),rgb(0x565b50),.0015,angle)
    for dx,color in ((-.004,rgb(0xa64330)),(.003,rgb(0x627c65))):
        _cord(name,"gloss","Colored wire at radiator fan connector",
              [_add(fan_plug,(dx,.002,-.008)),(.327+dx,.619,2.068),
               (.315+dx,.603,2.047)],.0014,color,sides=6)
    for p in ((-.181,.656,1.672),(-.372,.647,1.932),(.179,.576,2.037),(.374,.728,1.384)):
        _bay_band(name,"Chassis clip supporting corrugated loom",p,(0,.25,1),.0105,.007,
                  rgb(0x5d5f54))

    positive=(-.420,.788,1.785)
    negative=(-.648,.788,1.785)
    box(name,"plain","Rubber guard at positive battery clamp",
        _add(positive,(.006,.005,-.013)),(.051,.021,.047),rgb(0x303331),.005)
    _cord(name,"plain","Battery positive lead to fuse enclosure",
          catmull([positive,(-.397,.772,1.747),(-.435,.722,1.727),
                   (-.494,.706,1.725),fuse_plug],7),
          .0076,rgb(0x252826),sides=11)
    at=(-.708,.708,1.867)
    _cord(name,"plain","Short battery negative lead to apron ground lug",
          catmull([negative,(-.672,.788,1.785),(-.704,.772,1.810),
                   (-.725,.753,1.843),at],6),
          .0067,rgb(0x282d2b),sides=11)
    lathe(name,"carMetal","Apron ground cable eyelet and hex screw",
          [(0,.010,.010),(.003,.010,.010),(.009,.0068,.0068)],
          rgb(0x94988a),12,at)


def _bay_transmission_detail(name):
    casework=case(name,"carMetal","Exposed ribbed transmission side casting",
                  [(.404,.273,.340,.040,1.713),(.462,.281,.325,.040,1.740),
                   (.544,.249,.275,.035,1.765),(.598,.183,.204,.029,1.769),
                   (.625,.114,.166,.022,1.774)],rgb(0x676e66))
    casework.data.transform(Matrix.Translation((-.220,0,0)))
    casework["finish_override"]="Cast aluminum"
    for z in (1.699,1.742,1.785,1.828,1.871):
        _cord(name,"carMetal","Raised stiffener on transmission casing",
              [(-.334,.472,z),(-.324,.535,z),(-.299,.576,z),(-.268,.611,z)],
              .0035,rgb(0x7b8075),sides=6)
    for z in (1.715,1.845):
        lathe(name,"carMetal","Transmission casting hex flange bolt",
              [(0,.010,.010),(.005,.009,.009),(.010,.007,.007)],rgb(0x95958a),
              12,(-.218,.622,z))
    dipstick=(-.318,.665,1.959)
    _cord(name,"plain","Transmission dipstick tube seated in case",
          catmull([(-.287,.471,1.814),(-.321,.535,1.860),
                   (-.326,.601,1.908),dipstick],5),.0068,rgb(0x363b37),sides=9)
    ring=_outline([(-.017,-.011),(-.019,.013),(-.009,.022),(.009,.022),
                   (.019,.014),(.019,-.010),(.010,-.018),(-.011,-.018)],3)
    _cord(name,"gloss","Red automatic-transmission dipstick loop",
          [_add(dipstick,(dx,.009+dz*.53,dz)) for dx,dz in ring],
          .0045,rgb(0xb83520),sides=8,closed=True)


def _fit_bay_parts(records, upright, fixed):
    # Intake and battery sit farther forward in photo 24 than the cylinder
    # head. Remap all mating parts together so their joints remain seated.
    head=((1.072,0),(1.236,.042),(1.448,.034),(1.600,-.009),
          (1.839,-.066),(1.941,-.008),(2.052,.023),(2.153,0))
    right_side=((1.182,0),(1.281,.022),(1.511,.073),(1.831,.068),
                (1.965,.061),(2.076,.026),(2.149,0))
    placement=Matrix.Translation(blender_point((0,.029,.056)))@Matrix.Diagonal((-.979,.886,.889,1))
    for component,*_ in records:
        if component in fixed:
            component.data.transform(placement)
            component.data.flip_normals()
            continue
        center=upright.get(component)
        for vertex in component.data.vertices:
            x,y,z=game_point(vertex.co)
            if center is not None:
                x=2*center-x
            core=exp(-((x-.119)/.372)**6)
            intake=exp(-((x+.467)/.286)**6)
            along=z+core*_profile(head,z,1)+intake*_profile(right_side,z,1)
            side=(.027*core*smooth(1.37,1.74,z)*(1-smooth(1.95,2.120,z))+
                  .019*intake*exp(-((z-1.547)/.174)**2))
            vertex.co=blender_point((-.979*(x+side),.029+.886*y,.056+.889*along))
        if center is None:
            component.data.flip_normals()
        component.data.update()


def _boot_liners(name):
    from mathutils.noise import noise

    felt=rgb(0x4f5050)
    # The fitted liner sweeps from the bite of the wheel housing into the sill.
    # The removable floor mat follows the lower edge of the same profile.
    profile=((-2.227,.593,.640,.687),(-2.101,.624,.682,.743),
             (-1.944,.597,.680,.810),(-1.776,.522,.658,.871),
             (-1.638,.461,.629,.917),(-1.536,.454,.583,.940),(-1.411,.472,.519,.944))
    def carpet_height(x,z):
        crown=1-(x/_profile(profile,z,1))**2
        return .351+.002*crown+.007*smooth(-1.52,-1.411,z)

    def floor(u,v):
        z=blend(profile[0][0],profile[-1][0],v)
        x=(2*u-1)*_profile(profile,z,1)
        return x,carpet_height(x,z),z

    floor_base=_panel(name,"fabric","Molded carpet under the removable boot mat",26,29,floor,felt,True)
    floor_base["finish_override"]="Flecked luggage carpet"
    stations=((-2.199,.562),(-2.131,.602),(-2.033,.600),(-1.934,.568),
              (-1.820,.523),(-1.714,.469),(-1.592,.428),(-1.456,.428),(-1.436,.405))
    def mat(u,v):
        z=blend(stations[0][0],stations[-1][0],v)
        x=(2*u-1)*_profile(stations,z,1)
        return x,carpet_height(x,z)+.0046+.0014*sin(pi*u)*sin(pi*v),z
    def carpet_tone(p):
        x,y,z=p
        flecks=noise(Vector((67*x,67*y,67*z)))
        mottling=noise(Vector((8*x,8*y,8*z)))
        return tone(rgb(0x65676a),.98+.12*flecks+.058*mottling)
    cover=_panel(name,"fabric","Removable shaped speckled spare-wheel carpet",36,46,mat,carpet_tone,True)
    cover["finish_override"]="Flecked luggage carpet"
    edge=[mat(u,v) for u,v in _panel_border(32,43)]
    loop=[*edge,edge[0]]
    rows_mesh(name,"fabric","Carpet mat edge seated on the load floor",
              [[(x,carpet_height(x,z)-.0007,z) for x,_,z in loop],loop],
              rgb(0x494b4b),caps=False)
    _cord(name,"fabric","Bound edge of the spare-wheel carpet",edge,
          .0024,rgb(0x47494a),sides=7,closed=True)
    _cord(name,"plain","Woven pull loop on forward spare wheel cover",
          catmull([(-.033,.370,-1.451),(-.024,.386,-1.432),(0,.391,-1.429),
                   (.024,.386,-1.432),(.033,.370,-1.451)],4),
          .0041,rgb(0x353632),sides=7)

    for side in (-1,1):
        def liner(u,v):
            z=blend(profile[0][0],profile[-1][0],u)
            inner=_profile(profile,z,1)
            upper=_profile(profile,z,2)
            fender=exp(-((z+1.661)/.208)**2)
            bulge=.071*fender*sin(pi*v)**1.4 + .015*sin(pi*v)
            radius=blend(inner,upper,v)-bulge
            y=blend(floor(0,u)[1]-.005,_profile(profile,z,3),v)
            return side*radius,y,z

        corner=_panel(name,"fabric","Molded side carpet over rounded luggage wheel housing",
                      42,18,liner,felt,flip=side<0)
        corner["finish_override"]="Flecked luggage carpet"
        _cord(name,"plain","Luggage side liner tucked under opening seal",
              [liner(u,1) for u in _range(42)],.0038,rgb(0x303330),sides=7)

    def bulkhead(u,v):
        x=(2*u-1)*blend(.470,.561,v)
        y=blend(.356,.888,v)
        z=-1.425-.017*cos(pi*u*2)*sin(pi*v)**2+.041*v
        return x,y,z
    panel=_panel(name,"fabric","Recessed carpeted bulkhead behind rear seat",36,24,
                 bulkhead,rgb(0x494a4a),True)
    panel["finish_override"]="Flecked luggage carpet"


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
    _pill(name,"plain","Pressed engine compartment floor",(0,.327,1.676),1.443,1.147,.089,rgb(0x161a19),"y",.40)
    firewall=box(name,"carMetal","Black stamped firewall behind the intake",(0,.649,1.073),
                 (1.496,.398,.061),rgb(0x2b302e),.014)
    firewall["finish_override"]="Painted bay steel"
    curve=[(x,.851+.011*(1-(x/.750)**2),1.058+.038*(1-(x/.750)**2))
           for x in (blend(-.748,.748,t) for t in _range(40))]
    _cord(name,"carMetal","Rolled firewall flange below cowl",curve,.0074,rgb(0x3f4643),sides=10)
    _cord(name,"plain","Firewall flange weather seal",
          [_add(p,(0,.008,-.004)) for p in curve],.0048,SEDAN_RUBBER,sides=8)
    at=(.212,.777,1.103)
    _pill(name,"gloss","Stamped identification plate on firewall",at,
          .165,.035,.005,rgb(0x303735),"z",.35)
    for x in (-.070,.070):
        lathe(name,"carMetal","Identification plate rivet",[(0,.003,.003),(.002,.0025,.0025)],
              rgb(0x737971),10,_add(at,(x,.008,.003)),"z")
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
    _bay_side_pans(name)
    fixed={obj for obj,*_ in records}

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

    accessory=(.443,.557,1.906)
    lathe(name,"carMetal","Cast accessory housing with concentric end shoulders",
          [(-.053,.042,.043),(-.037,.057,.053),(.012,.059,.054),
           (.034,.051,.048),(.041,.038,.035)],rgb(0x737971),32,accessory,"x")
    _bay_band(name,"Steel accessory case seam",_add(accessory,(.014,0,0)),(1,0,0),
              .057,.008,rgb(0x4d534f))
    for i in range(9):
        a=i*tau/9
        dy,dz=.052*cos(a),.049*sin(a)
        _cord(name,"carMetal","Raised cast rib around accessory housing",
              [(.407,accessory[1]+dy,accessory[2]+dz),
               (.472,accessory[1]+dy,accessory[2]+dz)],.003,rgb(0x858980),sides=6)
    for y,z,radius in ((.541,1.812,.042),(.525,1.967,.038),(.449,1.827,.049)):
        lathe(name,"plain","Recessed drive pulley",[(0,radius,radius),(.012,radius,radius),
              (.017,radius*.82,radius*.82),(.019,radius*.54,radius*.54)],
              rgb(0x2c302c),27,(.487,y,z),"x")
    belt=catmull([(.497,.579,1.802),(.497,.550,1.995),(.497,.499,2.001),
                  (.497,.410,1.856),(.497,.407,1.797),(.497,.473,1.781),
                  (.497,.579,1.802)],4)
    _cord(name,"plain","Curved black drive belt under timing cover",
          belt[:-1],.0065,rgb(0x1d2220),sides=6,closed=True)
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
           [(.963,-.124),(1,-.080),(1,-.011),(.980,0)],rgb(0x171d1c))
    rocker_skin=[(.980*u,.980*v) for u,v in rocker_edge]
    _perforated_surface(name,"plain","Flat rocker deck with sloping front apron",rocker_skin,[],
                        [(u,v) for u in (-.29,-.21,-.13,-.06,.015,.08,.14,.202,.255,.299)
                         for v in (-.23,-.16,-.09,0,.043,.075,.109,.139,.182,.219)],
                        rocker,rgb(0x191e1d),flip=True)
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
    edge["finish_override"]="Pressed heat shield"
    surface=[(.930*u,.930*v) for u,v in heat]
    face=_perforated_surface(name,"carMetal","Tapered stamped exhaust heat shield",surface,[],
                             [(u,v) for u in (-.18,-.12,-.07,0,.07,.12,.18)
                              for v in (-.08,-.06,-.02,.025,.055,.085,.11,.13)],
                             lambda u,v:shield(u,v,.015),aluminum,flip=True)
    face["finish_override"]="Pressed heat shield"
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
                 (.762,.364,.181,.026,1.241),(.789,.338,.157,.024,1.246)],rgb(0x82837a))
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
    lathe(name,"carMetal","Stamped throttle cable quadrant",
          [(0,.022,.022),(.007,.023,.023),(.011,.021,.021),(.013,.010,.010)],
          rgb(0x767d70),26,(-.083,.747,1.269),"x")
    _bay_band(name,"Throttle return spring collar",(-.108,.750,1.273),(1,0,0),
              .013,.018,rgb(0x8f8b73))
    airbox=(-.411,.759,1.524)
    air_lower=case(name,"plain","Deep air filter box lower shell",
         [(.550,.215,.301,.015,1.526),(.590,.239,.319,.019,1.529),
          (.728,.246,.325,.014,1.527),(.748,.255,.333,.014,1.524)],black)
    air_lower.data.transform(Matrix.Translation((airbox[0],0,0)))
    box(name,"plain","Squared ribbed air cleaner lid",airbox,(.259,.040,.330),rgb(0x1b211f),.010)
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
    lathe(name,"plain","Airbox molded outlet shoulder beneath bellows",
          [(-.034,.045,.046),(-.006,.050,.049),(.014,.043,.044)],
          rgb(0x262a28),30,(-.362,.756,1.411),"z")
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
    box(name,"plain","Rectangular black battery lid",(-.531,.756,1.899),(.324,.046,.319),rgb(0x202422),.009)
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
    hold_down=(-.532,.505,1.925)
    box(name,"carMetal","Battery tray front flange and raised clamp",
        hold_down,(.347,.036,.258),rgb(0x474d48),.012)
    for x in (-.674,-.385):
        lathe(name,"carMetal","Battery tray anchor washer",
              [(0,.012,.012),(.004,.012,.012),(.010,.007,.007)],
              rgb(0x747c6e),14,(x,.531,2.036))
    for x in (-.636,-.579,-.529,-.477,-.427):
        _pill(name,"plain","Shallow embossed service symbol on battery lid",
              (x,.784,1.979),.022,.022,.0016,rgb(0x333632),"y",.65)
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
    _bay_cooling_and_hydraulic_lines(name)
    _bay_electrical(name)
    _bay_transmission_detail(name)
    lathe(name,"plain","Pressure filler neck molded into tank",
          [(0,.024,.024),(.029,.024,.024)],black,20,(-.224,.642,2.109))
    lathe(name,"carMetal","Pressure filler cap",[(0,.033,.033),(.012,.032,.032)],aluminum,24,(-.224,.671,2.109))
    _pill(name,"gloss","Yellow pressure cap warning",(-.224,.685,2.109),.054,.045,.004,yellow,"y",.84)
    box(name,"gloss","Cooling safety sticker",(.296,.660,2.095),(.106,.002,.041),yellow,.001)
    mark("plain","CAUTION",(.296,.662,2.093),.010,rgb(0x403c27),up=(0,0,-1),rise=.00010)
    _cord(name,"carMetal","Hood prop rod retained in clip",[(.493,.651,2.221),(.342,.652,2.227),
          (-.345,.651,2.212)],.0046,steel)
    latch=(0,.647,2.230)
    box(name,"carMetal","Stamped front bonnet latch reinforcement",latch,
        (.142,.020,.095),rgb(0x505650),.010)
    _bezel(name,"carMetal","Raised U-shaped bonnet latch jaw",
           _outline([(-.034,-.018),(-.038,.023),(-.024,.029),(-.017,.010),
                     (.012,.009),(.025,.031),(.039,.027),(.039,-.018)],3),
           lambda x,z,d:_add(latch,(x,.009+d,z)),[(1,0),(1,.012),(.93,.017)],
           rgb(0x373d39),True)
    for x in (-.054,.054):
        lathe(name,"carMetal","Bonnet latch flange screw",
              [(0,.008,.008),(.007,.006,.006)],steel,10,_add(latch,(x,.011,.012)))
    _cord(name,"plain","Bonnet release cable retained along front tie bar",
          catmull([(.030,.661,2.232),(.109,.649,2.213),(.287,.651,2.198),
                   (.513,.661,2.179),(.645,.690,2.133)],5),
          .0028,rgb(0x2a302c),sides=7)

    _fit_bay_parts(records,upright,fixed)
    cheek=_outline([(-.025,-.044),(.025,-.044),(.020,-.015),
                    (.013,.009),(-.001,.013),(-.014,.009),(-.023,-.013)],3)
    for side in (-1,1):
        at=(side*.487,SEDAN_HOOD[1],SEDAN_HOOD[2])
        box(name,"carMetal","Body-side bonnet hinge bracket seated on cowl",
            _add(at,(0,-.041,.008)),(.061,.034,.052),rgb(0x3c443e),.006)
        for flange in (-1,1):
            _bezel(name,"carMetal","Bonnet hinge clevis cheek next to knuckle",cheek,
                   lambda z,y,d:_add(at,(flange*(.023+d),y,z)),
                   [(1,-.003),(1,.002),(.915,.005)],rgb(0x525950),True)
        lathe(name,"carMetal","Fixed pin on the actual bonnet hinge axis",
              [(-.025,.008,.008),(-.019,.010,.010),(.019,.010,.010),(.025,.008,.008)],
              rgb(0x545b53),24,at,"x")

    _boot_liners(name)
    _pill(name,"plain","Inset behind rear upper trim cover",(0,.757,-1.391),.151,.073,.013,
          rgb(0x393831),"z",.38)
    _pill(name,"gloss","Small tan upper boot bulkhead flap",(0,.756,-1.402),.140,.064,.012,
          rgb(0x7b725c),"z",.45)
    _pill(name,"plain","Flush latch on the boot bulkhead flap",(0,.782,-1.408),.051,.009,.004,
          rgb(0x555045),"z",.46)
    def rear_sill(u,v):
        across=2*u-1
        return (across*blend(.593,.620,v),blend(.350,.646,v),
                blend(-2.231,-2.259,v)+.012*across**4)
    return_trim=_panel(name,"fabric","Carpeted vertical return from load floor to rear threshold",
                       34,11,rear_sill,rgb(0x454649))
    return_trim["finish_override"]="Flecked luggage carpet"
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
    _pill(name,"carLens","Luggage compartment lamp",(.438,.763,-1.366),.092,.046,.016,rgb(0xb3ab86))
