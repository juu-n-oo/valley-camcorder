"use strict";

(() => {
  const {Builder,rgb,times}=Valley;
  const oak=rgb(0xb68b59), honey=rgb(0xc39b68), walnut=rgb(0x694b34);
  const white=rgb(0xe4e3d6), pale=rgb(0xe9e2d2), steel=rgb(0xa6b1b0), charcoal=rgb(0x444745);
  const models=new WeakMap();

  function furniture(scene) {
    if(models.has(scene)) return models.get(scene);
    const m=scene.material, {basin}=Valley.lodging, {compile}=Valley.props;
    const mesh=(...parts)=>compile(scene.renderer,parts);
    function piece(material,draw,group) {
      const shape=new Builder();
      draw(shape);
      return {material,shape,group};
    }

    function table(length,depth,top,metal=false) {
      const topPart=piece(metal ? m.gloss : m.wood,b=>{
        b.box([0,top-.041,0],[length,.082,depth],metal ? steel : honey,.024);
        if(!metal) for(const z of [-depth*.165,depth*.165]) {
          b.box([0,top+.0006,z],[length-.061,.0012,.004],times(walnut,.94));
        }
      },"top");
      const supports=[-1,1].map(end=>piece(metal ? m.gloss : m.wood,b=>{
        const tint=metal ? steel : oak;
        for(const side of [-1,1]) {
          b.box([end*(length/2-.125),(top-.078)/2,side*(depth/2-.104)],[.079,top-.078,.077],tint,.010);
        }
        b.box([end*(length/2-.14),top-.136,0],[.077,.105,depth-.18],tint,.007);
      },end<0 ? "frame-left" : "frame-right"));
      const rails=piece(metal ? m.gloss : m.wood,b=>{
        if(metal) b.box([0,.265,0],[length-.095,.041,depth-.071],steel,.012);
        else for(const side of [-1,1]) {
          b.box([0,top-.126,side*(depth/2-.092)],[length-.19,.092,.057],oak,.009);
        }
      },"frame-rails");
      return {parts:mesh(topPart,...supports,rails),rx:length/2,rz:depth/2,height:top};
    }

    const chair={
      rx:.23,rz:.232,height:.87,
      parts:mesh(piece(m.wood,b=>{
        for(const side of [-1,1]) {
          b.box([side*.158,.207,-.148],[.046,.414,.047],oak,.010);
          b.box([side*.159,.431,.162],[.049,.856,.048],oak,.012,[-.072,0,0]);
          b.box([side*.156,.178,.012],[.045,.047,.307],oak,.009);
        }
        b.box([0,.388,0],[.397,.055,.390],walnut,.021);
        for(const y of [.538,.641,.773]) b.box([0,y,.174+(y-.52)*.13],[.339,y>.75 ? .101 : .040,.040],honey,.014);
      }),piece(m.fabric,b=>{
        b.box([0,.434,-.008],[.376,.073,.362],charcoal,.034);
      }))
    };
    const cushion={
      rx:.211,rz:.211,height:.068,
      parts:mesh(piece(m.fabric,b=>{
        b.box([0,.030,0],[.408,.056,.408],rgb(0x687869),.024);
        b.box([0,.057,0],[.377,.014,.376],rgb(0x7b8975),.008);
        for(const x of [-.112,.112]) b.box([x,.065,0],[.004,.001,.349],rgb(0x697b66));
      }))
    };

    function item(kind,rx,rz,height,material,draw,fragile,hp) {
      return [kind,{parts:mesh(piece(material,draw)),rx,rz,height,fragile,hp}];
    }
    const dishes=Object.fromEntries([
      item("plate",.140,.140,.040,m.porcelain,b=>{
        basin(b,[0,0,0],[[.001,.064,.064],[.011,.091,.091],[.024,.129,.129],[.035,.141,.141],
          [.039,.135,.135],[.034,.120,.120],[.017,.088,.088],[.016,0,0]],white);
      },"ceramic",.57),
      item("bowl",.098,.098,.079,m.porcelain,b=>{
        basin(b,[0,0,0],[[.002,.044,.044],[.017,.061,.061],[.052,.085,.085],[.075,.096,.096],
          [.079,.093,.093],[.075,.087,.087],[.046,.071,.071],[.020,0,0]],rgb(0xe3e8dd));
        b.cylinder([0,.006,0],[0,.008,0],.047,.048,rgb(0x8d9b8a),24);
      },"ceramic",.64),
      item("tumbler",.042,.042,.107,m.gloss,b=>{
        basin(b,[0,0,0],[[.001,.031,.031],[.013,.033,.033],[.104,.041,.041],[.107,.040,.040],
          [.104,.037,.037],[.015,.029,.029],[.013,0,0]],rgb(0xafc7c5));
      },"glass",.40),
      item("jar",.062,.062,.130,m.gloss,b=>{
        b.cylinder([0,.003,0],[0,.104,0],.058,.054,rgb(0xa86d49),22);
        b.cylinder([0,.104,0],[0,.129,0],.059,.060,rgb(0x81633f),22);
        b.box([0,.060,.058],[.068,.047,.009],rgb(0xe6d7a7),.005);
      },"glass",.53),
      item("pitcher",.079,.077,.225,m.gloss,b=>{
        b.cylinder([0,.003,0],[0,.188,0],.066,.073,rgb(0xa0b9b4),26);
        b.cylinder([0,.185,0],[0,.211,0],.076,.074,rgb(0x6d898b),26);
        b.ellipsoid([0,.214,0],[.060,.010,.063],rgb(0x7b9899),null,18,8);
        b.box([.055,.199,.015],[.046,.024,.056],rgb(0x6d898b),.007);
      },"glass",.71),
      item("tray",.181,.111,.034,m.gloss,b=>{
        b.box([0,.015,0],[.355,.026,.213],steel,.023);
        for(const side of [-1,1]) {
          b.box([side*.161,.029,0],[.022,.013,.192],steel,.006);
          b.box([0,.029,side*.092],[.304,.013,.019],steel,.006);
        }
      }),
      item("pot",.151,.123,.169,m.gloss,b=>{
        b.cylinder([0,.004,0],[0,.132,0],.108,.118,steel,28);
        b.ellipsoid([0,.132,0],[.120,.026,.120],steel,null,24,8);
        b.cylinder([0,.149,0],[0,.169,0],.032,.036,charcoal,14);
        for(const side of [-1,1]) b.box([side*.128,.092,0],[.054,.021,.065],charcoal,.010);
      }),
      item("utensils",.105,.037,.017,m.gloss,b=>{
        b.ellipsoid([.075,.010,-.020],[.031,.008,.019],steel,null,18,7);
        b.cylinder([-.093,.008,-.020],[.052,.008,-.020],.005,.004,steel,9);
        for(const z of [.012,.029]) b.cylinder([-.098,.008,z],[.095,.008,z],.004,.0026,steel,8);
      })
    ]);
    const result={high:table(1.89,.80,.742),low:table(1.68,.75,.306),pass:table(2.13,.66,.907,true),chair,cushion,dishes};
    models.set(scene,result);
    return result;
  }

  function build(scene,a,{lo,hi,near,far,height,style}) {
    const m=scene.material, lodging=Valley.lodging, suites=Valley.roadSuites, assets=furniture(scene);
    const width=hi-lo, middle=(lo+hi)/2, kitchen=near+2.90, platform=far-4.34;
    const tile=rgb(style==="inn" ? 0x999d91 : 0x979f9e);
    const panel=rgb(style==="brick" ? 0xaf916b : 0xb59a76);
    const floor=rgb(style==="inn" ? 0xc6996c : 0xcf9f67);
    const westWindow={center:kitchen+1.49,width:1.60,bottom:1.06,top:2.11};
    const eastWindow={center:far-1.48,width:2.03,bottom:1.01,top:2.13};
    for(const [x,slide,window] of [[lo,1.98,westWindow],[hi,-1.98,eastWindow]]) {
      suites.wall(scene,a,height,"x",x,near,far,{tint:pale,
        door:{center:.03,width:2.02,slide,panel:"lattice",open:true},windows:[window],wainscot:panel,
        wainscotSide:x===lo ? 1 : -1});
      a.box(m.wood,[x,height-.104,(near+far)/2],[.102,.058,far-near],walnut);
    }
    a.label("식당","DINING",[hi+.087,2.377,.03],.98,.248,"wood",Math.PI/2);
    a.label("식당","DINING",[lo-.087,2.377,.03],.98,.248,"wood",-Math.PI/2);
    a.label("객실","STAIRS",[lo+.087,2.377,.03],.98,.248,"wood",Math.PI/2);
    a.box(m.paint,[lo+.073,1.76,platform-.33],[.045,.95,2.04],rgb(0x999485),{radius:.010});
    a.label("차림표","",[lo+.098,1.76,platform-.33],2.00,.91,"menu",Math.PI/2);
    a.label("주방","KITCHEN",[hi-.082,2.20,kitchen+.60],.74,.24,"wood",-Math.PI/2);
    a.label("좌식 마루","FLOOR SEATING",[hi-.082,1.89,platform+.39],.87,.29,"wood",-Math.PI/2);

    const top=.145;
    a.box(m.ceramicTile,[middle,.009,(near+platform)/2],[width-.142,.021,platform-near],tile,
      {kind:"rock",stepBank:"indoorStone"});
    a.quad(m.diningFloor,[[lo+.074,.021,near+.003],[lo+.074,.021,platform-.003],
      [hi-.074,.021,platform-.003],[hi-.074,.021,near+.003]],tile,
      [[lo,near],[lo,platform],[hi,platform],[hi,near]]);
    a.box(m.wood,[middle,top/2,(platform+far)/2],[width-.133,top,far-platform],oak,
      {kind:"wood",stepBank:"indoorWood"});
    suites.planks(a,m,lo+.069,hi-.069,platform+.006,far-.005,top+.006,floor);
    a.box(m.wood,[middle,.472,far-.018],[width-.129,.735,.037],panel);
    a.box(m.wood,[middle,.835,far-.035],[width-.123,.065,.067],walnut,{radius:.006});
    a.box(m.wood,[middle,top-.011,platform-.018],[width-.138,.045,.079],walnut,
      {radius:.009,kind:"wood",stepBank:"indoorWood"});
    for(const x of [lo+.47,hi-.47]) {
      a.box(m.wood,[x,top+.234,platform+.086],[.75,.067,.094],oak,{radius:.012});
      for(const u of [-.326,0,.326]) a.box(m.wood,[x+u,top+.124,platform+.086],[.057,.252,.063],oak,{radius:.006});
    }

    function spawn(kind,model,x,y,z,yaw=0) {
      const prop=Valley.props.make(model.parts,kind,...a.at([x,y,z]),a.yaw+yaw,model.rx,model.rz,model.height);
      if(model.fragile) Object.assign(prop,{fragile:model.fragile,hp:model.hp});
      scene.props.push(prop);
      return prop;
    }

    function table(model,x,y,z,yaw) {
      const prop=spawn("table",model,x,y,z,yaw);
      prop.surface={top:model.height,rx:model.rx-.014,rz:model.rz-.016};
      return prop;
    }
    function place(kind,table,x,z,yaw=0) {
      const prop=spawn(kind,assets.dishes[kind],0,0,0);
      Valley.props.supportOn(prop,table,[x,table.surface.top+.004,z],table.yaw+yaw);
    }

    const highZ=kitchen+1.62, nearSeat=platform-1.13;
    for(const [i,[x,z,low]] of [
      [lo+1.16,highZ,false],[hi-1.17,highZ,false],[hi-1.17,nearSeat,false],
      [lo+1.17,platform+1.02,true],[lo+1.17,far-1.16,true],[hi-1.17,far-1.16,true]
    ].entries()) {
      const model=low ? assets.low : assets.high, y=low ? top+.009 : .024;
      const setting=table(model,x,y,z,Math.PI/2), seat=low ? assets.cushion : assets.chair;
      for(const offset of [-.47,.47]) for(const side of [-1,1]) {
        const placeX=x+side*(low ? .627 : .665),placeZ=z+offset;
        spawn(low ? "cushion" : "chair",seat,placeX,y,placeZ,Math.PI/2+(side<0 ? Math.PI : 0));
      }
      place("plate",setting,-.53,-.126,.1);
      place("bowl",setting,.49,.137,-.1);
      place("bowl",setting,-.23,.154,.2);
      place("tumbler",setting,-.44,.186);
      place("utensils",setting,.47,-.137,.18);
      place(i%2 ? "jar" : "pitcher",setting,.055,-.115);
    }

    const serving=table(assets.pass,lo+1.31,.024,kitchen,0);
    serving.mass=8.4;
    place("tray",serving,-.765,.056,.12);
    place("pot",serving,-.31,-.116);
    place("plate",serving,.16,.049);
    place("bowl",serving,.51,-.109);
    place("tumbler",serving,.39,.177);
    place("jar",serving,.83,.097);

    const range=lo+1.52, wallZ=near+.398, sinkX=hi-.99, sinkTop=.886;
    a.box(m.paint,[middle,height/2,near+.035],[width-.128,height-.021,.023],rgb(0xe1e1d6));
    lodging.kitchen(scene,a,range,wallZ,0,rgb(style==="diner" ? 0xa27551 : 0xb1a18b));
    a.box(m.gloss,[sinkX,.405,wallZ],[1.73,.778,.621],steel,{radius:.013,kind:"wall",hit:"metal"});
    for(const side of [-1,1]) {
      a.box(m.gloss,[sinkX+side*.618,sinkTop,wallZ],[.505,.053,.657],steel,{radius:.008,kind:"wall",hit:"metal"});
      a.box(m.gloss,[sinkX,sinkTop,wallZ+side*.275],[.745,.053,.105],steel,{radius:.008,kind:"wall",hit:"metal"});
      a.box(m.gloss,[sinkX+side*.412,.423,wallZ+.323],[.761,.64,.029],rgb(0xaeb7b3),{radius:.009});
      a.box(m.gloss,[sinkX+side*.412,.666,wallZ+.345],[.174,.025,.022],charcoal,{radius:.008});
    }
    a.box(m.ceramicTile,[sinkX,1.174,near+.084],[1.84,.54,.033],white);
    lodging.sink(scene,a,sinkX,wallZ,sinkTop);
    const hoodX=range+.634;
    a.box(m.gloss,[hoodX,1.855,near+.372],[.786,.172,.548],steel,{radius:.027});
    a.box(m.gloss,[hoodX,2.255,near+.209],[.383,.661,.293],rgb(0x9fa9a8),{radius:.016});
    a.box(m.plain,[hoodX,1.765,near+.381],[.638,.017,.414],charcoal,{radius:.003});
    for(const y of [1.553,1.996]) {
      a.box(m.gloss,[sinkX,y,near+.205],[1.69,.047,.355],steel,{radius:.008,kind:"wall",hit:"metal"});
      const shelf=Valley.props.make([],"shelf",...a.at([sinkX,y+.0235,near+.208]),a.yaw,.845,.1775,0);
      shelf.surface={top:0};
      for(const [x,kind] of [[-.62,"plate"],[-.30,"bowl"],[-.016,"bowl"],[.26,"tumbler"],[.50,"tumbler"]]) {
        place(kind,shelf,x,.017);
      }
    }
    a.label("조리대","PREP",[sinkX,1.83,near+.115],.61,.213,"blue");

    const fan=[middle,height-.198,kitchen+1.34];
    a.beam(m.gloss,[fan[0],height-.02,fan[2]],fan,.032,.027,steel,12);
    a.oval(m.gloss,fan,[.125,.068,.125],rgb(0x725f4b));
    for(const i of [0,1,2]) {
      const angle=i*Math.PI*2/3+.37;
      a.box(m.wood,[fan[0]+Math.sin(angle)*.379,fan[1]-.005,fan[2]+Math.cos(angle)*.379],
        [.168,.030,.595],walnut,{yaw:angle,radius:.017});
    }
    for(const z of [kitchen+.31,platform-.16,far-.83]) {
      a.box(m.wood,[middle,height-.056,z],[width-.195,.077,.108],oak);
    }
    const light=(rect,x,z,yaw,shape)=>lodging.roomLight(scene,a,0,rect,[x,1.261,z],yaw,shape);
    light([lo+.064,hi-.063,near+.065,kitchen-.10],hi-.073,kitchen-.67,-Math.PI/2,"strip");
    light([lo+.064,hi-.063,kitchen-.10,platform-.058],hi-.073,1.26,-Math.PI/2,"cross");
    light([lo+.064,hi-.063,platform-.058,far],hi-.073,platform+.27,-Math.PI/2,"strip");
  }

  Valley.roadDining={build};
})();
