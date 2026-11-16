"""Embossing traced from the developed sidewall of reference photo 27."""

# Points are in the two flattened strips used for tracing, with y down.
# Each letter has a separate outline and optional counters.
_SOLUS_KH16 = (
    (((35,19),(57,12),(139,8),(148,34),(88,38),(72,44),(78,55),(113,61),
      (139,69),(159,85),(179,117),(184,138),(173,150),(65,159),(54,132),
      (117,128),(133,121),(129,111),(105,104),(79,100),(58,92),(44,78),
      (31,54),(27,33)), ()),
    (((158,18),(187,8),(229,6),(255,13),(282,32),(308,59),(329,93),(337,120),
      (333,137),(318,150),(291,155),(251,151),(222,138),(199,115),
      (174,77),(158,43)),
     (((209,44),(226,38),(246,40),(263,51),(279,69),(295,96),(299,111),
       (292,121),(272,122),(255,117),(242,103),(226,83),(212,59)),)),
    (((327,26),(370,29),(389,88),(400,106),(416,111),(464,111),(483,138),
      (410,140),(380,134),(361,116),(350,92)), ()),
    (((472,45),(515,50),(529,90),(538,109),(552,113),(566,110),(569,95),
      (553,50),(595,52),(609,86),(616,107),(613,125),(600,137),(578,145),
      (546,143),(523,133),(506,116),(492,92)), ()),
    (((634,54),(659,50),(745,50),(756,76),(680,76),(671,79),(676,84),
      (725,89),(745,96),(760,109),(765,125),(760,136),(749,145),(724,150),
      (634,150),(630,125),(710,125),(720,121),(713,114),(671,111),(647,104),
      (629,93),(619,76),(620,64)), ()),
    (((835,57),(854,57),(851,83),(877,58),(903,58),(870,94),(896,128),
      (871,130),(849,103),(846,130),(825,130)), ()),
    (((913,58),(934,59),(928,84),(954,84),(960,60),(985,60),(970,130),
      (948,131),(951,105),(925,105),(921,131),(900,132)), ()),
    (((998,74),(1029,62),(1047,62),(1033,130),(1011,131),(1019,87),(998,93)), ()),
    (((1080,64),(1109,61),(1120,65),(1114,82),(1092,81),(1080,84),(1077,96),
      (1095,91),(1111,96),(1117,108),(1114,122),(1102,132),(1081,136),(1064,132),
      (1055,122),(1054,104),(1062,81),(1071,70)),
     (((1075,110),(1083,106),(1094,108),(1094,116),(1086,120),(1076,117)),)),
)

_KUMHO = (
    (((24,69),(78,68),(74,98),(128,62),(183,65),(124,101),(180,132),
      (126,138),(72,107),(69,138),(18,137)), ()),
    (((197,63),(247,65),(244,99),(251,116),(274,119),(292,112),(298,65),
      (350,64),(345,106),(337,128),(311,137),(274,141),(231,137),(207,125),
      (195,107)), ()),
    (((374,68),(429,69),(457,105),(484,70),(548,71),(539,145),(490,144),
      (496,101),(463,143),(439,142),(412,106),(405,140),(361,138)), ()),
    (((572,69),(620,69),(616,96),(665,96),(676,63),(727,60),(707,152),
      (656,154),(660,120),(612,120),(605,151),(554,151)), ()),
    (((761,77),(794,60),(833,53),(883,54),(922,67),(940,87),(940,108),
      (920,136),(894,156),(856,166),(817,165),(783,152),(761,134),(751,106)),
     (((799,97),(817,84),(840,79),(869,81),(886,91),(890,102),(880,116),
       (863,130),(837,136),(816,132),(799,122),(793,110)),)),
)


def _tire_lettering(name, sidewall):
    # Developed x is circumferential distance. Projecting both bevel and face
    # onto the fitted sidewall keeps the letters attached through its crown.
    radius = .273

    def inset_loop(loop, inset):
        signed_area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(loop,loop[1:]+loop[:1]))
        offset = inset if signed_area > 0 else -inset
        inset_points = []
        for i,point in enumerate(loop):
            here = Vector(point)
            edge = (here-Vector(loop[i-1])).normalized()
            next_edge = (Vector(loop[(i+1)%len(loop)])-here).normalized()
            normal = Vector((-edge.y-next_edge.y,edge.x+next_edge.x)).normalized()
            miter = max(.40,normal.dot(Vector((-edge.y,edge.x))))
            inset_points.append(tuple(here+normal*(offset/miter)))
        return inset_points

    for label, glyphs, dimensions, angles, band in (
        ("SOLUS KH16",_SOLUS_KH16,(1170,172),(-1.04,.62),(.290,.248)),
        ("KUMHO",_KUMHO,(980,172),(2.35,3.66),(.290,.254)),
    ):
        def developed(loop):
            return [(radius*blend(*angles,x/dimensions[0]),blend(*band,y/dimensions[1])) for x,y in loop]

        def at(s,rise_radius,relief):
            a = -s/radius
            return sidewall(rise_radius)+relief, rise_radius*cos(a), rise_radius*sin(a)

        for outer,holes in glyphs:
            footprint = (developed(outer),*[developed(hole) for hole in holes])
            crown = tuple(inset_loop(loop,.00044 if i==0 else -.00044) for i,loop in enumerate(footprint))
            for base,top in zip(footprint,crown):
                rows_mesh(name,"carTire",label+" molded relief bevel",
                          [[at(s,r,d) for s,r in loop] for loop,d in
                           ((base,-.00018),(base,.00038),(top,.00155))],
                              rgb(0x303132),caps=False)
            left,right=min(s for s,r in crown[0]),max(s for s,r in crown[0])
            bottom,top=min(r for s,r in crown[0]),max(r for s,r in crown[0])
            columns=max(1,round((right-left)/.005))
            rows=max(1,round((top-bottom)/.005))
            samples=[(blend(left,right,u),blend(bottom,top,v))
                     for u in _range(columns+2) for v in _range(rows+2)
                     if 0<u<1 and 0<v<1]
            _perforated_surface(name,"carTire",label+" molded sidewall lettering",crown[0],crown[1:],
                                samples,lambda s,r:at(s,r,.00155),rgb(0x2d2e2e))
