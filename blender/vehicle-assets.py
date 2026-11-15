"""Blender surfaces for the parked Sonata and its separately moving panels."""

SEDAN_BODY = (
    (-2.36, .64, .68, .31), (-2.25, .79, .79, .23), (-2.06, .864, .865, .22),
    (-1.69, .908, .908, .20), (-1.25, .902, .926, .193), (-.21, .898, .930, .191),
    (.48, .902, .925, .191), (1.02, .905, .910, .198), (1.43, .899, .873, .22),
    (1.89, .871, .827, .229), (2.16, .824, .769, .252), (2.33, .684, .673, .30),
)
SEDAN_CABIN = (
    (-1.39, .922, .841), (-1.19, 1.083, .806), (-.97, 1.260, .748),
    (-.71, 1.396, .687), (-.46, 1.442, .665), (-.09, 1.457, .657),
    (.19, 1.449, .669), (.47, 1.400, .703), (.66, 1.257, .747),
    (.86, 1.080, .798), (1.047, .927, .857),
)
SEDAN_PAINT = (1, 1, 1)
SEDAN_BLACK = (.093, .102, .108)
SEDAN_LEATHER = rgb(0xc1b197)
SEDAN_WALNUT = rgb(0x80492f)
SEDAN_TRIM = rgb(0x747266)


def _sedan_profile(table, z, column):
    i = next((i for i, entry in enumerate(table) if entry[0] >= z), len(table))
    if i == 0 or i == len(table):
        return table[min(i, len(table)-1)][column]
    a, b, p, n = table[i-1], table[i], table[max(0, i-2)], table[min(i+1, len(table)-1)]
    span = b[0]-a[0]
    t = (z-a[0])/span
    m0 = (b[column]-p[column])*span/(b[0]-p[0])
    m1 = (n[column]-a[column])*span/(n[0]-a[0])
    return blend(a[column], b[column], t*t*(3-2*t)) + t*(1-t)*((1-t)*m0-t*m1)


def _sedan_width(z):
    return _sedan_profile(SEDAN_BODY, z, 1)


def _sedan_belt(z):
    return _sedan_profile(SEDAN_BODY, z, 2)


def _sedan_window(z):
    return _sedan_profile(SEDAN_CABIN, z, 1), _sedan_profile(SEDAN_CABIN, z, 2)


def _sedan_side(side, z, v):
    distance = min(abs(z+1.405), abs(z-1.405))
    arch = .232+.442*sqrt(max(0, 1-(distance/.396)**2))
    bottom = max(_sedan_profile(SEDAN_BODY, z, 3), arch*(1-smooth(.385, .421, distance)))
    shoulder = .012*exp(-((v-.885)/.075)**2)
    lower_door = .011*exp(-((v-.31)/.12)**2)
    return (side*(_sedan_width(z)+.025*sin(pi*v)-.083*(1-v)**2+shoulder+lower_door),
            blend(bottom, _sedan_belt(z), v), z)


def _sedan_deck(z, x, front):
    u = x/_sedan_width(z)
    crown = .044*(1-u*u)
    hood_crease = .010*exp(-((abs(u)-.60)/.12)**2)*sin(pi*smooth(1.04, 2.27, z)) if front else 0
    return _sedan_belt(z)+crown+hood_crease


def _sedan_end(x, front):
    return (2.345 if front else -2.367)+(-.294 if front else .268)*(abs(x)/.89)**2


def _sedan_panel(name, slot, label, columns, rows, point_at, color, *, flip=False):
    points = [point_at(i/columns, j/rows) for j in range(rows+1) for i in range(columns+1)]
    faces = []
    for j in range(rows):
        for i in range(columns):
            start = j*(columns+1)+i
            face = (start, start+1, start+columns+2, start+columns+1)
            faces.append(face[::-1] if flip else face)
    return mesh(name, slot, label, points, faces, color, consistent=False)


def _sedan_local(point, pivot):
    return tuple(value-offset for value, offset in zip(point, pivot))


def _sedan_shell():
    name = asset('sedan_body_shell', 'sedan', hidden=True)
    for side in (-1, 1):
        for front in (False, True):
            end = 1 if front else -1
            label = ('Front' if front else 'Rear') + (' right' if side < 0 else ' left')

            def fender(u, v):
                z = blend(1.019 if front else -1.236, 2.17 if front else -2.18, u)
                x, y, z = _sedan_side(side, z, v)
                wrap = smooth(.49, 1, u)
                return (blend(x, side*.786, wrap),
                        blend(y, blend(.278, .731 if front else .756, v), wrap*.87),
                        blend(z, _sedan_end(side*.786, front)+end*.013*sin(pi*v), wrap))

            def ledge(u, v):
                z0, z1 = (1.03, 2.21) if front else (-2.20, -1.34)
                z = blend(z0, z1, v)
                w = _sedan_width(z)
                x = side*blend(w*(.815 if front else .804)+.009, w, u)
                wrap = (smooth(1.77, z1, z) if front else 1-smooth(z0, -1.81, z))*u*u
                return (blend(x, side*.786, wrap),
                        blend(_sedan_deck(z, x, front), .753 if front else .786, wrap),
                        blend(z, _sedan_end(side*.786, front), wrap))

            _sedan_panel(name, 'carPaint', label+' wheel arch and fender', 34, 14, fender,
                         SEDAN_PAINT, flip=(side > 0) == front)
            _sedan_panel(name, 'carPaint', label+' deck', 8, 26, ledge, SEDAN_PAINT, flip=side > 0)

    for front in (False, True):
        end = 1 if front else -1
        label = 'Front' if front else 'Rear'

        def fascia(u, v):
            x = (u-.5)*1.578
            y = blend(.259+.039*abs(u-.5), (.649+.072*abs(x)) if front else (.724+.022*abs(x)), v)
            return (x, y, _sedan_end(x, front)+end*.023*sin(pi*v))

        def bumper(u, v):
            x = (u-.5)*1.61
            y = (.335 if front else .300)+(v-.5)*.184
            rolled = .048 * sin(pi*v)**1.35 - .007
            return (x, y, _sedan_end(x, front)+end*rolled)

        _sedan_panel(name, 'carPaint', label+' valance', 34, 10, fascia, SEDAN_PAINT, flip=not front)
        _sedan_panel(name, 'carPaint', label+' bumper', 34, 13, bumper, SEDAN_PAINT, flip=not front)


def _sedan_roof():
    name = asset('sedan_roof', 'sedan', hidden=True)
    for slot, drop, color in (('carPaint', 0, SEDAN_PAINT), ('fabric', .041, rgb(0xa6a093))):
        def roof(u, v):
            z = blend(-.725, .471, v)
            y, w = _sedan_window(z)
            return ((2*u-1)*w, y+.031*sin(pi*u)-drop, z)

        _sedan_panel(name, slot, 'Stamped roof' if not drop else 'Cloth headliner',
                     20, 28, roof, color, flip=not drop)


def _sedan_moving_panels():
    for front in (False, True):
        name = asset('sedan_hood' if front else 'sedan_trunk_lid', 'sedan', hidden=True)
        pivot = (0, .968, 1.053) if front else (0, .944, -1.360)
        z0, z1 = (1.047, 2.258) if front else (-2.235, -1.359)

        def cover(u, v, depth=0):
            z = blend(z0, z1, v)
            x = (2*u-1)*_sedan_width(z)*(.815 if front else .804)
            return _sedan_local((x, _sedan_deck(z, x, front)+.003-depth, z), pivot)

        _sedan_panel(name, 'carPaint', 'Pressed exterior', 27, 24, cover, SEDAN_PAINT, flip=True)
        _sedan_panel(name, 'carPaint', 'Inner reinforcing sheet', 16, 16,
                     lambda u, v: cover(u, v, .016), tone(SEDAN_PAINT, .69))
        for side in (-1, 1):
            def stiffener(u, v):
                return cover(.5+side*blend(.110, .350, v)+(u-.5)*.042, blend(.10, .88, v), .026+.007*sin(pi*u))

            _sedan_panel(name, 'carPaint', 'Support crease', 6, 12, stiffener, tone(SEDAN_PAINT, .63))
        if not front:
            _sedan_panel(name, 'carPaint', 'Trunk exterior face', 26, 12,
                         lambda u, v: _sedan_local((blend(-.62, .62, u), blend(.692, .826, v),
                                                   _sedan_end(blend(-.62,.62,u), False)+.018*(1-v)), pivot),
                         SEDAN_PAINT, flip=True)

    for side in (-1, 1):
        for front in (False, True):
            suffix = ('front' if front else 'rear')+'_'+('left' if side > 0 else 'right')
            name = asset('sedan_door_'+suffix, 'sedan', hidden=True)
            lo, hi = (-.211, 1.011) if front else (-1.229, -.245)
            pivot = (side*.858, .325, hi-.023)
            mid = (lo+hi)/2
            _sedan_panel(name, 'carPaint', 'Stamped door exterior', 29, 17,
                         lambda u, v: _sedan_local(_sedan_side(side, blend(lo, hi, u), v), pivot),
                         SEDAN_PAINT, flip=side > 0)
            box(name, 'gloss', 'Molded interior door backing', _sedan_local((side*.80, .563, mid), pivot),
                (.073, .598, hi-lo-.071), SEDAN_TRIM, .034)
            box(name, 'fabric', 'Beige door insert', _sedan_local((side*.766, .697, mid+.035), pivot),
                (.035, .178, (hi-lo)*.71), rgb(0xbab09c), .016)
            box(name, 'carLeather', 'Padded armrest', _sedan_local((side*.750, .592, mid+.012), pivot),
                (.097, .057, (hi-lo)*.73), SEDAN_LEATHER, .022)
            box(name, 'carWood', 'Walnut window switch surround', _sedan_local((side*.736, .630, mid+.118), pivot),
                (.075, .015, .396), SEDAN_WALNUT, .006)
            box(name, 'plain', 'Door pull recess', _sedan_local((side*.727, .632, mid-.143), pivot),
                (.048, .019, .112), SEDAN_BLACK, .008)
            handle_x, handle_y, handle_z = _sedan_side(side, lo+.196, .828)
            box(name, 'carPaint', 'Handle recess', _sedan_local((handle_x+side*.007, handle_y, handle_z), pivot),
                (.035, .061, .187), tone(SEDAN_PAINT, .62), .016)
            box(name, 'carMetal', 'Bright exterior grip',
                _sedan_local((handle_x+side*.029, handle_y+.001, handle_z+.004), pivot),
                (.023, .034, .139), rgb(0xa9b3b4), .010)

            pane = asset('sedan_side_glass_'+suffix, 'sedan', hidden=True)

            def window(u, v):
                z = blend(lo+.039, hi-.031, u)
                top, inset = _sedan_window(z)
                bottom = _sedan_belt(z)-.005
                x = blend(_sedan_width(z)-.020, inset-.003, v)+.015*sin(pi*v)
                return _sedan_local((side*x, blend(bottom, max(bottom+.009, top-.027), v), z), pivot)

            color = lambda p: (blend(.29, .42, smooth(.55, 1.12, p[1])), .434, .449)
            _sedan_panel(pane, 'carGlass', 'Curved safety glass', 24, 12, window, color, flip=side > 0)


def _sedan_glazing_and_lamps():
    for front in (False, True):
        name = asset('sedan_windshield' if front else 'sedan_back_glass', 'sedan', hidden=True)
        lo, hi = (.485, 1.033) if front else (-1.382, -.729)

        def pane(u, v):
            z = blend(lo, hi, v)
            y, inset = _sedan_window(z)
            return ((2*u-1)*(inset-.020), y+.012*sin(pi*u), z)

        blue_band = lambda p: tuple(blend(a, b, smooth(1.24, 1.44, p[1]))
                                    for a,b in zip(rgb(0x61787b), rgb(0x425e70)))
        _sedan_panel(name, 'carGlass', 'Compound curved glazing', 28, 25, pane, blue_band, flip=True)

        for side in (-1, 1):
            suffix = ('front' if front else 'rear')+'_'+('left' if side > 0 else 'right')
            lens = asset('sedan_lamp_'+suffix, 'sedan', hidden=True)

            def lamp(u, v):
                x = side*blend(.356 if front else .596, .832 if front else .856, u)
                arc = sqrt(max(.009, 1-((2*u-1)*.989)**2))
                y = (.624+.056*u if front else .539+.040*u)+.042*(1-arc)+v*(.185 if front else .310)*arc
                z = _sedan_end(x, front)+(1 if front else -1)*(.069+.016*sin(pi*v)+.005*arc)
                return (x, y, z)

            def lens_color(p):
                x, y, _ = p
                u = (abs(x)-(.356 if front else .596))/(.476 if front else .260)
                if front:
                    tint = rgb(0xe5a13d) if u > .735 else rgb(0xd9e2dc)
                    brightness = .93+.066*cos(u*20*pi)
                else:
                    tint = rgb(0xbb282d) if y > .635 else rgb(0xc6c4b6 if u < .28 else 0xd08a2c)
                    brightness = .94+.053*cos(y*32*pi)
                return tone(tint, brightness)

            _sedan_panel(lens, 'carLens', 'Molded fluted lens', 30, 16, lamp, lens_color, flip=(side < 0) == front)


def _sedan_upholstery():
    name = asset('sedan_upholstery', 'sedan', hidden=True)
    leather = lambda p: tone(SEDAN_LEATHER, .96+.015*cos(p[0]*260)*cos(p[2]*198))

    def padded(label, center, size, tilt=0, bolsters=.25, vertical=False):
        x, y, z = center
        w, h, d = (v/2 for v in size)
        rows = []
        for i in range(1, 12):
            ring = []
            f = (i/12)*pi
            for j in range(28):
                a = j*tau/28
                extent = sin(f)**.46
                x0 = w*cos(a)*extent*(.97+.03*sin(f))
                z0 = d*sin(a)*extent
                y0 = h*cos(f)*(1+bolsters*exp(-((abs(x0)/w-.76)/.19)**2)*sin(f))
                if vertical:
                    y0, z0 = z0, y0
                ring.append((x+x0, y+y0*cos(tilt)-z0*sin(tilt), z+z0*cos(tilt)+y0*sin(tilt)))
            rows.append(ring)
        rows_mesh(name, 'carLeather', label, rows, leather)

    for side in (-1, 1):
        x = side*.427
        padded('Contoured front cushion', (x,.384,.164), (.565,.184,.578))
        padded('Contoured front backrest', (x,.698,-.174), (.548,.190,.542), -.21, .40, True)
        padded('Padded front headrest', (x,1.044,-.243), (.295,.162,.205), -.15, .20, True)
        for offset in (-.153, .153):
            def seat_seam(u, v):
                return (x+offset+(u-.5)*.0038, .469+.006*sin(pi*v), blend(-.056, .395, v))

            _sedan_panel(name, 'gloss', 'Cushion stitching', 1, 18, seat_seam, rgb(0x9f917d), flip=True)

            def back_seam(u, v):
                return (x+offset+(u-.5)*.0036, blend(.495, .922, v), blend(-.039,-.121,v)+.002*sin(pi*v))

            _sedan_panel(name, 'gloss', 'Backrest stitching', 1, 18, back_seam, rgb(0xa99a85))

    padded('Rear bench cushion', (0,.393,-.882), (1.465,.183,.615), 0, .14)
    padded('Rear bench backrest', (0,.681,-1.123), (1.432,.211,.490), -.29, .25, True)
    for side in (-1, 1):
        padded('Padded rear headrest', (side*.480,.939,-1.223), (.275,.155,.166), -.29, .12, True)
    padded('Fold-down rear armrest', (0,.544,-.824), (.283,.104,.476), 0, .05)

    dash = asset('sedan_dashboard', 'sedan', hidden=True)
    box(dash, 'carLeather', 'Padded full-width dashboard', (0,.858,.887), (1.584,.212,.385), SEDAN_TRIM, .095)
    box(dash, 'carLeather', 'Driver knee bolster', (.482,.655,.877), (.558,.270,.246), SEDAN_TRIM, .051)
    box(dash, 'carLeather', 'Lower glove compartment trim', (-.503,.559,.887), (.589,.054,.260), SEDAN_TRIM, .015)
    box(dash, 'carLeather', 'Instrument cluster eyebrow', (.455,.906,.739), (.529,.152,.227), rgb(0x69695f), .058)
    box(dash, 'carWood', 'Walnut radio and climate fascia', (0,.732,.762), (.337,.368,.139), SEDAN_WALNUT, .045)
    box(dash, 'carLeather', 'Center tunnel shroud', (0,.363,.214), (.316,.207,.917), SEDAN_TRIM, .039)
    box(dash, 'carWood', 'Automatic selector surround', (0,.477,.364), (.276,.026,.446), SEDAN_WALNUT, .012)


def _sedan_engine_and_boot():
    name = asset('sedan_engine_and_boot', 'sedan', hidden=True)
    aluminum = rgb(0x999c94)
    graphite = rgb(0x343839)
    boot_felt = rgb(0x514e48)
    box(name, 'carMetal', 'Cast transverse engine block', (.125,.580,1.637), (.714,.380,.553), aluminum, .042)
    box(name, 'plain', 'Molded valve cover', (.123,.791,1.622), (.649,.058,.390), graphite, .021)
    box(name, 'carMetal', 'Brushed upper engine plate', (.132,.760,1.806), (.598,.070,.163), aluminum, .019)
    for i in range(4):
        z = 1.578+i*.034
        box(name, 'plain', 'Valve cover reinforcing rib', (.129,.823,z), (.394,.009,.013), rgb(0x515653), .004)
    oil_center = (.311,.823,1.498)
    lathe(name, 'plain', 'Oil filler cap', [(0,.045,.045),(.012,.052,.052),(.033,.051,.051),(.036,.047,.047)],
          SEDAN_BLACK, 24, oil_center)
    for i in range(12):
        angle = i*tau/12
        x = oil_center[0]+.050*cos(angle)
        z = oil_center[2]+.050*sin(angle)
        box(name, 'plain', 'Gripped filler-cap edge', (x,.848,z), (.010,.019,.009), graphite, .003, -angle)
    box(name, 'carMetal', 'Pressed exhaust heat shield', (.131,.624,1.976), (.484,.178,.118), rgb(0xa4a59a), .036)
    for i in range(3):
        box(name, 'carMetal', 'Heat shield pressed seam', (.131,.595+i*.026,2.033), (.359,.009,.012),
            rgb(0x848981), .004)
    box(name, 'plain', 'Air cleaner box', (-.404,.670,1.510), (.295,.188,.339), SEDAN_BLACK, .023)
    for i in range(8):
        box(name, 'gloss', 'Air box cover flutes', (-.529+i*.035,.769,1.518), (.013,.010,.282),
            rgb(0x454845), .003)
    box(name, 'plain', 'Lead-acid battery case', (-.435,.609,1.882), (.316,.233,.315), rgb(0x414b4d), .018)
    box(name, 'plain', 'Battery lid', (-.435,.740,1.882), (.323,.041,.325), SEDAN_BLACK, .014)
    box(name, 'gloss', 'Battery carry handle', (-.427,.765,1.833), (.113,.013,.038), rgb(0xb6a34c), .005)
    for x in (-.489, -.365):
        box(name, 'gloss', 'Battery carry handle mounts', (x,.765,1.871), (.026,.013,.112), rgb(0xb6a34c), .004)
    box(name, 'fabric', 'Carpeted luggage floor', (0,.343,-1.794), (1.416,.059,.884), boot_felt, .023)
    for side in (-1, 1):
        box(name, 'fabric', 'Carpeted luggage quarter trim', (side*.691,.561,-1.799), (.069,.451,.859), boot_felt, .021)
    box(name, 'fabric', 'Spare wheel cover pull', (0,.379,-1.839), (.206,.012,.037), rgb(0x3b3b37), .006)


def _sedan_source_preview():
    scene = bpy.context.scene
    collection = bpy.data.collections.new('Sonata assembly')
    scene.collection.children.link(collection)
    root = bpy.data.objects.new('Sonata preview origin', None)
    collection.objects.link(root)
    root.empty_display_size = .12
    root.location = (-4.10, 0, 0)
    assembly = [(name, (0, 0, 0)) for name in ('sedan_body_shell', 'sedan_roof', 'sedan_upholstery',
                 'sedan_dashboard', 'sedan_engine_and_boot', 'sedan_windshield', 'sedan_back_glass')]
    assembly.extend([('sedan_hood', (0,.968,1.053)), ('sedan_trunk_lid', (0,.944,-1.360))])
    for side in (-1, 1):
        for end, z in (('front', .988), ('rear', -.268)):
            suffix = end+'_'+('left' if side > 0 else 'right')
            pivot = (side*.858,.325,z)
            assembly.extend([('sedan_door_'+suffix, pivot), ('sedan_side_glass_'+suffix, pivot),
                             ('sedan_lamp_'+suffix, (0, 0, 0))])
        for z in (-1.405, 1.405):
            for name in ('sedan_tire', 'sedan_hub'):
                if name in ASSETS:
                    assembly.append((name, (side*.783,.321,z)))
    for name, pivot in assembly:
        for source, slot, paint, uv in ASSETS[name]['records']:
            obj = source.copy()
            collection.objects.link(obj)
            obj.parent = root
            obj.location = blender_point(pivot)
            if name in ('sedan_tire', 'sedan_hub') and pivot[0] < 0:
                obj.rotation_euler.z = pi
            if slot == 'carPaint':
                obj.material_slots[0].link = 'OBJECT'
                obj.material_slots[0].material = material(slot, tone(paint, .46))


def build_vehicles():
    _sedan_shell()
    _sedan_roof()
    _sedan_moving_panels()
    _sedan_glazing_and_lamps()
    _sedan_upholstery()
    _sedan_engine_and_boot()
    _sedan_source_preview()
