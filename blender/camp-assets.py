"""Period camping tableware in the sizes used by the game's grip and collision anchors."""


def build_camp_details():
    for name, hex_color in (("camp_cup_yellow",0xd7ba61),("camp_cup_cream",0xd2d1a0)):
        asset(name,"Camping tableware")
        color=rgb(hex_color)
        profile=[(.004,.029,.029),(.004,.031,.031),(.012,.031,.031),(.017,.0298,.0298),
                 (.026,.032,.032),(.080,.039,.039),(.100,.042,.042),(.104,.044,.044),
                 (.107,.043,.043),(.107,.0405,.0405),(.104,.0395,.0395),(.022,.027,.027),
                 (.018,.020,.020),(.018,.002,.002)]
        lathe(name,"plastic","Rolled rim and hollow molded cup",profile,color,40)
        for y in (.025,.029,.033):
            r=.031+.12*y
            lathe(name,"plastic","Shallow reinforcement bead",[(y-.001,r-.0034,r-.0034),(y,r-.0027,r-.0027),
                                                              (y+.001,r-.0034,r-.0034)],tone(color,.93),36,caps=False)

    name=asset("camp_lunch_box","Camping tableware")
    case(name,"plastic","Pressed reusable food container",
         [(.001,.251,.177,.028,0),(.009,.267,.188,.028,0),(.036,.278,.194,.028,0),
          (.098,.295,.208,.030,0),(.108,.293,.207,.030,0)],rgb(0xcfd4d1))
    case(name,"plastic","Smoky fitted lid",
         [(.104,.306,.217,.029,0),(.110,.309,.219,.029,0),(.123,.306,.216,.028,0),
          (.131,.289,.201,.028,0),(.133,.267,.182,.028,0)],rgb(0xe7e6d9))
    case(name,"plastic","Recessed panel in lid",
         [(.132,.209,.123,.018,0),(.136,.195,.110,.018,0)],rgb(0xdadbd2))
    for side in (-1,1):
        box(name,"plastic","Fold-down snap latch",(0,.090,side*.109),(.061,.047,.018),rgb(0x9bb3b1),.006)
        box(name,"plastic","Latch grip lip",(0,.071,side*.120),(.054,.013,.010),rgb(0x8daba9),.003)

    name=asset("camp_flask","Camping tableware")
    body=rgb(0xa0afb2)
    lathe(name,"plastic","Rolled insulated shell",
          [(.004,.045,.045),(.009,.052,.052),(.017,.054,.054),(.027,.054,.054),(.040,.052,.052),
           (.166,.0529,.0529),(.202,.0536,.0536),(.213,.0498,.0498),(.226,.044,.044)],body,40)
    lathe(name,"plastic","Dark base and threaded joint",
          [(.001,.044,.044),(.007,.053,.053),(.017,.055,.055),(.027,.054,.054)],rgb(0x666d70),36)
    lathe(name,"plastic","Stopper and knurled collar",
          [(.207,.049,.049),(.214,.055,.055),(.230,.053,.053),(.234,.048,.048)],rgb(0x474c50),44)
    lathe(name,"steel","Brushed steel drinking cap",
          [(.228,.049,.049),(.231,.052,.052),(.236,.052,.052),(.250,.051,.051),
           (.256,.048,.048),(.258,.044,.044)],rgb(0xc6ccca),44)
