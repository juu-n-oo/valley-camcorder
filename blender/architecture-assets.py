"""Architecture and period fixtures for the valley buildings."""


def architecture_timber(point):
    x, y, z = point
    grain = .018 * sin(77*x + 2.7*sin(11*y)) + .014 * sin(146*x + 8*z)
    finish = .95 + grain - .038*exp(-46*(y+.44)**2)
    return (.99*finish, .97*finish, .94*finish)


def architecture_profile(name, slot, label, profile, color, upright=False):
    rows = [[(-y,x,z) if upright else (x,y,z) for y,z in profile] for x in (-.5,.5)]
    return rows_mesh(name, slot, label, rows, color, soft=False)


def architecture_rim(name, slot, label, width, height, depth, y, z, color):
    """A separate fitted molding around a recessed wood panel."""
    rows = []
    for inset, edge in ((0, -.02), (.013, .31), (.029, .49), (.062, -.22), (.073, -.42)):
        rx, ry = width/2-inset, height/2-inset
        order = [(-1, -1), (1, -1), (1, 1), (-1, 1)][::1 if z>0 else -1]
        rows.append([(s*rx, y+t*ry, z+(edge*depth if z>0 else -edge*depth)) for s,t in order])
    return rows_mesh(name, slot, label, rows, color, caps=False, soft=False, consistent=False)


def architecture_upholstery(name, label, at, size, color, wrinkled=.014):
    x, y, z = at
    w, h, d = size
    rows = []
    for t, scale in [(-.50, .80), (-.45, .92), (-.32, .99), (-.06, 1), (.26, .99),
                     (.42, .93), (.49, .81), (.50, .66), (.50, .38)]:
        ring = []
        for i in range(20):
            q = tau * i / 20
            u, v = cos(q), sin(q)
            a = (1 if u >= 0 else -1)*abs(u)**.52
            b = (1 if v >= 0 else -1)*abs(v)**.52
            pinch = 1 - wrinkled * (sin(5*q+t*7) + .6*cos(11*q-t*12))
            ring.append((x+a*w*.5*scale*pinch, y+(t + wrinkled*sin(3*q+t*4))*h,
                         z+b*d*.5*scale*pinch))
        rows.append(ring)
    rows_mesh(name, "fabric", label, rows, color)
    welt = rows[3]
    rows_mesh(name, "fabric", label+" piped seam",
              [[(px+cos(i*tau/6)*.0027*(px-x)/w, py+sin(i*tau/6)*.0027,
                 pz+cos(i*tau/6)*.0027*(pz-z)/d) for i in range(6)] for px,py,pz in [*welt,welt[0]]],
              tone(color, .65), caps=False)


def build_architecture():
    timber = (.97, .96, .94)
    casing = [(-.50,-.43),(.48,-.43),(.50,-.29),(.46,.33),(.36,.44),(.17,.47),(.11,.39),
              (-.29,.43),(-.45,.49),(-.50,.32)]
    track = [(-.5,-.50),(.45,-.50),(.50,-.42),(.50,.44),(.42,.50),(.28,.50),(.24,.37),(.05,.37),
             (.01,.49),(-.18,.49),(-.21,.35),(-.40,.35),(-.45,.47),(-.50,.43)]
    for suffix, upright in (("",False),("_upright",True)):
        name = asset("lodge_casing"+suffix, "Valley buildings")
        architecture_profile(name,"wood","Stepped wood casing",casing,architecture_timber,upright)
        name = asset("lodge_window_channel"+suffix, "Valley buildings")
        architecture_profile(name,"paint","Extruded window track",track,(.95,.95,.93),upright)
        for y in (-.30,.16):
            center, size = ((-y,0,.373),(.068,.99,.018)) if upright else ((0,y,.373),(.99,.068,.018))
            box(name,"paint","Dark track recess",center,size,(.58,.59,.56))

    name = asset("lodge_stone_sill", "Valley buildings")
    def weathered_sill(p):
        x,y,z=p
        v=.88+.065*sin(23*x+6*z)+.022*cos(73*x+19*z)
        return (v, v*.99, v*.96)
    architecture_profile(name, "plaster", "Sloped cast stone sill and drip edge",
                         [(-.50,-.49),(.38,-.49),(.50,-.18),(.39,.31),(.23,.48),(-.11,.50),
                          (-.34,.49),(-.36,.42),(-.42,.42),(-.47,.49),(-.50,.45)], weathered_sill)

    name = asset("lodge_gutter", "Valley buildings")
    architecture_profile(name,"paint","Rolled galvanized rain gutter",
                         [(.26,-.49),(.13,-.48),(-.31,-.38),(-.47,-.15),(-.50,.18),(-.32,.42),(.14,.49),
                          (.19,.45),(.15,.40),(-.30,.35),(-.41,.15),(-.39,-.13),(-.23,-.30),(.16,-.41)],
                         (.93,.94,.90))

    name = asset("lodge_panel_door", "Valley fixtures")
    for x in (-.431,.431):
        box(name,"wood","Solid stile",(x,0,0),(.138,1,.98),architecture_timber,.013)
    for y,h in ((-.449,.102),(-.062,.074),(.447,.106)):
        box(name,"wood","Mortised rail",(0,y,0),(.727,h,.983),architecture_timber,.014)
    for y,h in ((-.263,.308),(.190,.444)):
        box(name,"wood","Recessed floating panel",(0,y,0),(.713,h,.51),(.90,.87,.84),.024)
        for z in (-.34,.34):
            architecture_rim(name,"wood","Beveled panel molding",.736,h+.032,.295,y,z,timber)

    name = asset("lodge_lattice_door", "Valley fixtures")
    box(name,"paint","Pressed paper infill",(0,.030,0),(.895,.877,.38),rgb(0xdad3b8),.007)
    for x in (-.465,.465):
        box(name,"wood","Lattice stile",(x,0,0),(.070,1,1),architecture_timber,.009)
    for y,h in ((-.457,.086),(.47,.06),(-.369,.050)):
        box(name,"wood","Lattice rail",(0,y,0),(.868,h,.99),architecture_timber,.006)
    for z in (-.37,.37):
        for i in range(-4,5):
            box(name,"wood","Wood lattice vertical",(i*.093,.044,z),(.014,.832,.21),timber)
        for y in (-.314,-.246,-.147,.018,.183,.315,.397):
            box(name,"wood","Wood lattice horizontal",(0,y,z),(.868,.011,.22),timber)

    name = asset("lodge_sofa", "Valley furniture")
    walnut, cloth = rgb(0x7b573c), (.94,.94,.92)
    box(name,"wood","Rounded frame",(0,.161,0),(1,.247,.611),walnut,.032)
    for x in (-.42,.42):
        for z in (-.237,.237):
            box(name,"wood","Wooden foot",(x,.042,z),(.080,.084,.095),tone(walnut,.67),.010)
        architecture_upholstery(name,"Padded sofa arm",(x,.387,0),(.164,.257,.612),cloth)
    for x in (-.198,.198):
        architecture_upholstery(name,"Seat cushion",(x,.331,-.035),(.395,.144,.478),tone(cloth,1.07))
        architecture_upholstery(name,"Back cushion",(x,.534,.208),(.404,.352,.238),cloth,.025)
    architecture_upholstery(name,"Upholstered backrest",(0,.510,.252),(.91,.390,.152),tone(cloth,.84))

    name = asset("lodge_tabletop", "Valley furniture")
    box(name,"wood","Joined tabletop",(0,-.487,0),(1,.973,1),architecture_timber,.024)
    for z in (-.166,.165):
        box(name,"wood","Joined board seam",(0,-.001,z),(.944,.002,.003),(.75,.72,.67))
    for z in (-.481,.481):
        box(name,"wood","Rounded hardwood edging",(0,-.602,z),(.974,.266,.034),timber,.013)

    name = asset("lodge_coffee_table", "Valley furniture")
    box(name,"wood","Clear lacquered table top",(0,.270,0),(1,.070,1),rgb(0xb78b5a),.024)
    box(name,"wood","Recessed parquet top",(0,.305,0),(.846,.014,.821),rgb(0xcba578),.004)
    for x in (-.411,.411):
        for z in (-.383,.383):
            lathe(name,"wood","Turned hardwood leg",[(.002,.020,.020),(.025,.031,.030),(.082,.036,.033),
                  (.142,.025,.025),(.194,.033,.033),(.247,.040,.038)],walnut,14,(x,0,z))
    for z in (-.386,.386):
        box(name,"wood","Inset table apron",(0,.202,z),(.813,.067,.083),walnut,.009)

    name = asset("lodge_dining_chair", "Valley furniture")
    for s in (-1,1):
        x=s*.158
        rows_mesh(name,"wood","Tapered front leg",
                  [[(x+a*r,y,-.148+b*r) for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
                   for y,r in ((0,.016),(.025,.018),(.34,.024),(.40,.025))],rgb(0xb08a5f),soft=False)
        rows_mesh(name,"wood","Swept hardwood back stile",
                  [[(x+a*r,y,z+b*r) for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
                   for y,z,r in ((0,.160,.017),(.127,.150,.020),(.391,.157,.025),(.662,.189,.022),(.841,.214,.019))],
                  rgb(0xad8050),soft=False)
        box(name,"wood","Side stretcher",(x,.168,.004),(.042,.039,.287),walnut,.007)
    box(name,"wood","Seat frame",(0,.385,0),(.398,.052,.394),walnut,.015)
    for y,z,h in ((.540,.183,.032),(.645,.200,.043),(.789,.212,.089)):
        box(name,"wood","Rounded backrest slat",(0,y,z),(.339,h,.057),rgb(0xbf9767),.012)
    architecture_upholstery(name,"Woven dining seat",(0,.429,-.007),(.377,.076,.361),rgb(0x494641))

    name = asset("lodge_air_conditioner", "Valley fixtures")
    white, plastic = rgb(0xe0dfd0), rgb(0xc1c2b7)
    box(name,"paint","Aged ABS housing",(0,.002,.007),(1.135,.229,.195),white,.032)
    box(name,"paint","Slightly bowed front cover",(0,.032,-.087),(1.067,.159,.053),white,.022)
    box(name,"plain","Dark vent recess",(0,-.064,-.100),(.967,.060,.022),rgb(0x51554f),.008)
    for y,z in ((-.086,-.109),(-.066,-.112),(-.046,-.110)):
        box(name,"paint","Adjustable horizontal louver",(0,y,z),(.939,.009,.017),plastic,.003)
    for x in (-.34,-.17,0,.17,.34):
        box(name,"paint","Vent septum",(x,-.067,-.112),(.007,.050,.008),plastic)
    box(name,"gloss","Display bezel",(.309,.040,-.115),(.150,.033,.012),rgb(0x626955),.005)
    for i in range(4):
        box(name,"emissive" if i==0 else "paint","Status light",(.273+i*.025,.040,-.121),(.008,.006,.003),
            rgb(0x95a964 if i==0 else 0x454e43),.001)

    name = asset("lodge_exterior_light", "Valley fixtures")
    box(name,"paint","Ceiling-light canopy",(0,.091,0),(.172,.168,.138),rgb(0x524e43),.018)
    box(name,"paint","Stamped rim",(0,.001,0),(.407,.038,.251),rgb(0x8b8170),.022)
    box(name,"porcelain","Prismatic milk-glass shade",(0,-.036,0),(.376,.065,.227),rgb(0xe1d2ac),.023)
    for x in (-.164,-.142,-.120,-.098,-.076,-.054,-.032,-.010,.012,.034,.056,.078,.100,.122,.144,.166):
        box(name,"porcelain","Diffuser rib",(x,-.067,0),(.007,.010,.191),rgb(0xd6c6a4),.003)

    name = asset("lodge_onggi", "Valley furnishings")
    def glaze(p):
        x,y,z=p
        v=.91+.045*sin(100*y+5*x)*cos(31*x+14*z)+.08*sin(11*y+4*z)
        return (v, .98*v, .93*v)
    lathe(name,"gloss","Wheel-thrown glazed jar",[(.001,.067,.068),(.012,.079,.080),(.046,.105,.106),
          (.089,.114,.115),(.124,.108,.109),(.146,.084,.085),(.155,.072,.073),(.166,.078,.078),
          (.173,.077,.077),(.176,.067,.067),(.166,.064,.064),(.146,.061,.061),(.102,.084,.085),(.025,.065,.065)],
          glaze,40)
    lathe(name,"plain","Dark interior base",[(.024,.064,.064),(.025,.065,.065)],rgb(0x322923),24)

    name = asset("lodge_reception_phone", "Valley fixtures")
    green, trim = rgb(0x68746a), rgb(0x464e48)
    rows_mesh(name,"paint","Wedge-shaped phone base",
              [[(x,y,z) for x,z in [(-w,-d),(w,-d),(w,d),(-w,d)]]
               for y,w,d in ((.003,.098,.090),(.009,.106,.092),(.040,.104,.091),(.051,.092,.081))],green)
    box(name,"plain","Handset cradle",(-.067,.049,0),(.065,.009,.155),trim,.004)
    tube(name,"paint","Curved receiver",[((-.069,.062,-.086),.019,.022),((-.069,.061,-.066),.033,.020),
         ((-.067,.064,-.038),.026,.012),((-.067,.070,0),.019,.010),((-.067,.064,.039),.023,.011),
         ((-.069,.061,.064),.032,.019),((-.069,.059,.085),.021,.018)],trim,14,2)
    for row in range(4):
        for col in range(3):
            box(name,"paint","Rounded keypad button",(.003+col*.027,.053,-.023+row*.022),
                (.016,.011,.016),rgb(0xc7c8b5),.003)
    box(name,"paint","Paper number insert",(.040,.052,-.059),(.062,.005,.018),rgb(0x9c9f86),.003)
    for i in range(5):
        box(name,"plain","Ringer slot",(.087,.049,.066-i*.005),(.013,.002,.002),trim)

    name = asset("lodge_reception_bell", "Valley fixtures")
    lathe(name,"plain","Weighted rubber foot",[(.002,.051,.051),(.006,.055,.055),(.016,.052,.052),
          (.020,.045,.045)],rgb(0x373733),24)
    lathe(name,"gloss","Spun brass dome",[(.018,.047,.047),(.022,.048,.048),(.025,.047,.047),
          (.035,.041,.041),(.044,.032,.032),(.050,.020,.020),(.052,.011,.011)],rgb(0xaf9963),32)
    lathe(name,"gloss","Spring plunger",[(.048,.005,.005),(.057,.005,.005),(.058,.011,.011),
          (.062,.011,.011),(.063,.009,.009)],rgb(0xaaa89a),16)
