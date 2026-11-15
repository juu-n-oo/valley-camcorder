"use strict";

(() => {
  const {rgb,mix,times}=Valley;
  const trim=rgb(0x815b3d), oak=rgb(0xb89062), ivory=rgb(0xeee8d9);
  const white=rgb(0xe7eae4), steel=rgb(0xa5aeb0), dark=rgb(0x424344);
  const palettes={
    brick:{paper:0xe6d9d1,wood:0xd0a46e,cabinet:0xbab0a1,tile:0xdbe0da,bath:0xb9a89b,sofa:0x78828e},
    diner:{paper:0xeadfc7,wood:0xd2a16c,cabinet:0xab7856,tile:0xe3e4da,bath:0xc3b19a,sofa:0x8e7d70},
    inn:{paper:0xdedfd4,wood:0xbb936c,cabinet:0xb4ab97,tile:0xd7e0df,bath:0xa2aaa1,sofa:0x728483}
  };

  function planks(a,m,lo,hi,near,far,y,color) {
    a.quad(m.laminate,[[lo,y,near],[lo,y,far],[hi,y,far],[hi,y,near]],color,
      [[lo,near],[lo,far],[hi,far],[hi,near]]);
  }

  function wall(scene,a,height,axis,at,lo,hi,options={}) {
    const m=scene.material;
    const {surface=m.paint,tint=ivory,door,windows=[],thickness=.124,lining,wainscot,wainscotSide=-1,baseboard=true}=options;
    const tile=surface===m.ceramicTile || lining?.surface===m.ceramicTile;
    const alongX=axis==="z", yaw=alongX ? 0 : -Math.PI/2;
    const where=(u,y,offset=0)=>alongX ? [u,y,at+offset] : [at+offset,y,u];
    function piece(mat,start,end,bottom,top,depth,color,offset=0,kind) {
      if(end<=start || top<=bottom) return;
      const length=end-start, span=top-bottom;
      a.box(mat,where((start+end)/2,(bottom+top)/2,offset),
        alongX ? [length,span,depth] : [depth,span,length],color,{kind});
    }
    function slab(start,end,bottom,top) {
      piece(surface,start,end,bottom,top,thickness,tint,0,"wall");
      if(lining) piece(lining.surface,start,end,bottom,top,.016,lining.tint,(lining.side??-1)*(thickness/2+.009));
      if(baseboard && !tile && bottom===0) piece(m.wood,start,end,0,.098,thickness+.027,trim);
      if(wainscot && bottom===0) {
        const offset=wainscotSide*(thickness/2+.012);
        piece(m.wood,start,end,.091,.604,.018,wainscot,offset);
        piece(m.wood,start,end,.585,.634,.036,trim,offset);
      }
    }
    const gaps=windows.map(win=>({...win,bottom:win.bottom??.94,top:win.top??2.11}));
    if(door) gaps.push({center:door.center,width:door.width??1.34,bottom:0,top:2.174,door});
    gaps.sort((a,b)=>a.center-b.center);
    let from=lo;
    for(const {center,width,bottom,top,door,frosted} of gaps) {
      const start=center-width/2,end=center+width/2;
      slab(from,start,0,height);
      slab(start,end,top,height);
      if(door) {
        const {hingeFar=false,slide=0,swing=-1.55,panel="wood",open=false,color}=door;
        const rail=slide ? -thickness/2-.034 : 0;
        for(const u of [start,end]) piece(m.wood,u-.026,u+.026,0,top,.169,oak);
        piece(m.wood,start-.044,end+.044,top-.026,top+.049,.174,oak);
        piece(m.wood,start,end,0,.013,thickness+.021,oak);
        if(slide) for(const y of [.013,2.148]) {
          piece(m.gloss,start+Math.min(0,slide),end+Math.max(0,slide),y,y+.017,.054,steel,rail);
        }
        Valley.lodging.door(scene,a,where(hingeFar ? end-.032 : start+.032,.023,rail),width-.064,
          {yaw:yaw+(hingeFar ? Math.PI : 0),swing,slide,panel,open,color});
      } else {
        slab(start,end,0,bottom);
        const frame=frosted ? white : oak, mid=(top+bottom)/2;
        for(const y of [bottom,top]) piece(m.paint,start-.04,end+.04,y-.029,y+.029,thickness+.078,frame);
        for(const u of [start,center,end]) piece(m.paint,u-.026,u+.026,bottom,top,thickness+.052,frame,0,"wall");
        for(const u of [center-width/4,center+width/4]) {
          Valley.lodging.pane(scene,a,where(u,mid),width/2-.050,top-bottom-.051,{yaw,frosted});
        }
        piece(m.paint,start-.052,end+.052,bottom-.048,bottom-.020,thickness+.127,frame);
      }
      from=end;
    }
    slab(from,hi,0,height);
  }

  function sofa(a,m,x,z,width,tint) {
    a.box(m.wood,[x,.161,z],[width,.32,.67],trim,{radius:.038,kind:"wall"});
    a.box(m.fabric,[x,.477,z+.22],[width-.065,.46,.191],tint,{radius:.061});
    for(const side of [-1,1]) {
      a.box(m.fabric,[x+side*width*.239,.338,z-.050],[width*.449,.142,.458],times(tint,1.08),{radius:.042});
      a.box(m.fabric,[x+side*(width*.5-.081),.393,z],[.161,.278,.630],tint,{radius:.048});
    }
    a.box(m.fabric,[x+width*.267,.461,z+.079],[.279,.224,.092],rgb(0xc9b697),{radius:.045});
  }

  function lowTable(a,m,x,z,width,depth) {
    a.box(m.wood,[x,.272,z],[width,.069,depth],oak,{radius:.026,kind:"wood"});
    for(const side of [-1,1]) for(const end of [-1,1]) {
      a.box(m.wood,[x+side*(width/2-.098),.124,z+end*(depth/2-.088)],[.071,.245,.068],trim,{radius:.013});
    }
    a.box(m.paint,[x,.307,z],[width-.16,.008,depth-.135],rgb(0xded2b8),{radius:.016});
  }

  function furniture(a,m,lo,hi,depth,number) {
    const x=hi-.81,z=depth-1.34, variant=number%2;
    const duvet=rgb(variant ? 0x8994a1 : 0xa48581);
    a.box(m.wood,[x,.070,z],[1.33,.14,1.98],oak,{radius:.023,kind:"wood"});
    a.box(m.fabric,[x,.181,z],[1.29,.124,1.94],white,{radius:.047});
    a.box(m.fabric,[x,.248,z-.24],[1.295,.085,1.38],duvet,{radius:.029});
    a.box(m.fabric,[x,.286,z+.654],[.983,.137,.352],rgb(0xe7ded0),{radius:.060});
    const fabric=[duvet,rgb(0xc3a371),rgb(0xa98d88),rgb(0xb9b4a8)];
    for(let i=0;i<4;i++) a.box(m.fabric,[lo+.413,.050+i*.066,depth-.38],[.668-i*.026,.078,.48-i*.021],
      fabric[i],{radius:.027});
    const quiltWidth=.53,quiltDepth=.36;
    for(let j=0;j<4;j++) for(let i=0;i<6;i++) {
      const u=lo+.412-quiltWidth/2+i*quiltWidth/6,v=depth-.38-quiltDepth/2+j*quiltDepth/4;
      const w=quiltWidth/6-.004,d=quiltDepth/4-.004;
      a.quad(m.fabric,[[u,.289,v],[u,.289,v+d],[u+w,.289,v+d],[u+w,.289,v]],
        fabric[(i+j*3+variant)%fabric.length]);
    }
    const closet=hi-.635;
    a.box(m.wood,[closet,.96,.393],[1.05,1.92,.586],rgb(variant ? 0xb5a18c : 0xd1c4ad),
      {radius:.020,kind:"wall"});
    for(const side of [-1,1]) {
      a.box(m.wood,[closet+side*.258,1.00,.692],[.496,1.79,.034],rgb(variant ? 0xbda48d : 0xd7c9b1),{radius:.011});
      a.box(m.gloss,[closet+side*.064,1.03,.722],[.023,.228,.027],steel,{radius:.010});
    }
    const tv=a.section([hi-.350,0,2.28],-Math.PI/2);
    tv.box(m.wood,[0,.254,0],[.787,.508,.451],trim,{radius:.022,kind:"wall"});
    tv.box(m.wood,[0,.508,0],[.813,.052,.465],oak,{radius:.012});
    for(const y of [.166,.381]) {
      tv.box(m.wood,[0,y,.232],[.738,.183,.034],oak,{radius:.012});
      tv.box(m.gloss,[0,y+.015,.255],[.137,.025,.015],steel,{radius:.008});
    }
    tv.box(m.plain,[0,.746,-.022],[.665,.425,.421],rgb(0x686966),{radius:.069,kind:"wall"});
    tv.box(m.gloss,[0,.764,.185],[.530,.306,.053],rgb(0x333e40),{radius:.049});
    tv.box(m.paint,[0,.583,.190],[.491,.040,.027],steel,{radius:.009});
    tv.oval(m.plain,[.218,.576,.209],[.010,.009,.007],rgb(0x9d503c));
    tv.done();
  }

  function bedroomWall(a,m,bedX,depth,number) {
    const z=depth-.171, motor=rgb(0x5e6566);
    a.box(m.paint,[bedX,2.376,z],[1.146,.237,.205],white,{radius:.030});
    a.box(m.plain,[bedX,2.313,z-.109],[.962,.032,.009],rgb(0x4b514b),{radius:.006});
    a.box(m.gloss,[bedX+.21,2.375,z-.109],[.072,.016,.009],rgb(0x657c65),{radius:.004});
    const x=bedX-.97,y=2.054,fz=depth-.209;
    a.box(m.paint,[x,y-.14,depth-.107],[.088,.293,.085],motor,{radius:.022});
    a.beam(m.gloss,[x,y,depth-.088],[x,y,fz-.071],.044,.049,motor,12);
    for(let i=0;i<3;i++) {
      const angle=i*Math.PI*2/3+.10*number;
      a.beam(m.plain,[x,y,fz-.044],[x+.155*Math.cos(angle),y+.155*Math.sin(angle),fz-.044],.050,.026,motor,8);
    }
    for(let i=0;i<20;i++) {
      const arc=(j,r)=>[x+r*Math.cos(j*Math.PI/10),y+r*Math.sin(j*Math.PI/10),fz-.076];
      a.beam(m.gloss,arc(i,.212),arc(i+1,.212),.006,.006,dark,5);
      a.beam(m.gloss,arc(i,.143),arc(i+1,.143),.003,.003,dark,4);
      a.beam(m.gloss,[x,y,fz-.093],arc(i,.208),.003,.003,dark,4);
    }
    a.oval(m.paint,[x,y,fz-.091],[.046,.046,.022],motor);
    a.beam(m.plain,[x-.027,y-.191,fz],[x-.030,y-.414,fz+.031],.003,.003,dark,5);
  }

  function bathroom(scene,a,height,lo,hi,near,far,tile,floorTint) {
    const m=scene.material, center=(lo+hi)/2, bathHeight=.025;
    a.box(m.ceramicTile,[center,bathHeight/2,(near+far)/2],[hi-lo,bathHeight,far-near],floorTint,
      {kind:"rock",stepBank:"indoorStone"});
    a.quad(m.bathFloor,[[lo+.041,bathHeight+.002,near+.041],[lo+.041,bathHeight+.002,far-.05],
      [hi-.041,bathHeight+.002,far-.05],[hi-.041,bathHeight+.002,near+.041]],floorTint,
      [[lo,near],[lo,far],[hi,far],[hi,near]]);
    a.box(m.ceramicTile,[lo+.080,height/2,(near+far)/2],[.023,height,far-near-.05],tile);
    Valley.lodging.bathroomFixtures(scene,a,lo,near,far,0);
    const sink=lo+.48, mirrorY=1.469, mirrorZ=far-.107;
    a.box(m.wood,[sink,mirrorY,mirrorZ],[.672,.683,.033],rgb(0xa98a56),{radius:.008});
    a.box(m.gloss,[sink,mirrorY,mirrorZ-.019],[.612,.621,.013],rgb(0xb5c3c5),{radius:.008});
    a.box(m.gloss,[sink+.22,1.049,far-.183],[.212,.025,.135],steel,{radius:.009});
    a.oval(m.porcelain,[sink+.237,1.078,far-.182],[.059,.020,.034],rgb(0xdcc7ad));
    const sprayX=hi-.394,sprayZ=near+.123;
    a.beam(m.gloss,[sprayX,.829,sprayZ],[sprayX,1.889,sprayZ],.012,.009,steel,8);
    a.beam(m.gloss,[sprayX,1.889,sprayZ],[sprayX,1.84,sprayZ+.129],.012,.014,steel,10);
    a.oval(m.gloss,[sprayX,1.843,sprayZ+.127],[.067,.064,.028],steel);
    for(let i=0;i<8;i++) {
      const q=i*Math.PI/4;
      a.oval(m.plain,[sprayX+.042*Math.cos(q),1.843+.041*Math.sin(q),sprayZ+.150],[.006,.006,.005],dark);
    }
    a.beam(m.gloss,[sprayX,.84,sprayZ+.019],[sprayX-.068,.469,sprayZ+.019],.009,.008,steel,8);
    a.beam(m.gloss,[sprayX-.068,.469,sprayZ+.019],[sprayX-.235,.492,sprayZ+.017],.009,.008,steel,8);
    a.beam(m.gloss,[sprayX-.235,.492,sprayZ+.017],[sprayX-.268,.910,sprayZ+.023],.009,.010,steel,8);
    a.box(m.gloss,[sprayX-.14,.028,near+.64],[.167,.009,.162],steel,{radius:.005});
    for(let i=0;i<6;i++) a.box(m.plain,[sprayX-.203+i*.025,.034,near+.64],[.009,.006,.133],dark);
    a.box(m.paint,[lo+.873,.139,far-.321],[.214,.266,.240],rgb(0x5f7d91),{radius:.028});
    a.box(m.paint,[lo+.873,.272,far-.321],[.218,.038,.245],white,{radius:.015});
    a.beam(m.porcelain,[lo+.11,.696,near+.49],[lo+.233,.696,near+.49],.048,.048,ivory,14);
  }

  function build(scene,a,{width,depth,height,number,style,facade,facadeTint}) {
    const m=scene.material, palette=palettes[style], paper=rgb(palette.paper), tile=rgb(palette.tile);
    const lo=-width/2,hi=width/2,divider=hi-2.86,bathX=lo+1.95,bathZ=depth-2.33;
    const entry=mix(lo,divider,.62),bedDoor=1.48,bathDoor=bathZ+1.09;
    wall(scene,a,height,"z",0,lo,hi,{tint:rgb(0xe7ded1),lining:{surface:m.wallpaper,tint:paper,side:1},
      wainscot:rgb(style==="diner" ? 0xa48566 : 0xb09372),
      door:{center:entry,width:1.36,open:number%2===1,color:rgb(0xb0885d)}});
    a.label(String(number),"",[entry,2.357,-.083],.47,.205,"wood",Math.PI);
    wall(scene,a,height,"x",divider,0,depth,{surface:m.wallpaper,tint:paper,
      door:{center:bedDoor,width:1.42,panel:"lattice",slide:1.42,open:true}});
    wall(scene,a,height,"z",bathZ,lo,bathX,{surface:m.wallpaper,tint:paper,
      lining:{surface:m.ceramicTile,tint:tile,side:1}});
    wall(scene,a,height,"x",bathX,bathZ,depth,{surface:m.wallpaper,tint:paper,
      lining:{surface:m.ceramicTile,tint:tile},
      door:{center:bathDoor,width:1.04,hingeFar:true,swing:1.55}});
    const exterior={surface:facade,tint:facadeTint,thickness:.168,baseboard:false};
    const bedroomX=(divider+hi)/2,loungeX=(bathX+divider)/2;
    wall(scene,a,height,"z",depth,lo,bathX,{...exterior,lining:{surface:m.ceramicTile,tint:tile},
      windows:[{center:lo+1.34,width:.79,bottom:1.482,top:2.142,frosted:true}]});
    wall(scene,a,height,"z",depth,bathX,divider,{...exterior,lining:{surface:m.wallpaper,tint:paper},
      windows:[{center:loungeX,width:1.45,bottom:.946,top:2.06}]});
    wall(scene,a,height,"z",depth,divider,hi,{...exterior,lining:{surface:m.wallpaper,tint:paper},
      windows:[{center:bedroomX,width:1.55,bottom:.946,top:2.06}]});
    for(const x of [lo+.100,divider-.089,divider+.089,hi-.100]) {
      a.box(m.wood,[x,height-.109,depth/2],[.065,.052,depth-.112],trim);
    }
    for(const z of [.096,depth-.102]) a.box(m.wood,[0,height-.109,z],[width-.142,.052,.064],trim);
    const galley=a.section([lo+.400,0,1.885],Math.PI/2);
    Valley.lodging.kitchen(scene,galley,0,0,0,rgb(palette.cabinet));
    galley.done();

    sofa(a,m,loungeX,depth-.461,Math.min(1.91,divider-bathX-.27),rgb(palette.sofa));
    lowTable(a,m,divider-.70,bathZ-.245,.883,.482);
    const diningTable=divider-.551,decorZ=bathZ-.256;
    a.oval(m.paint,[diningTable,.345,decorZ],[.083,.041,.080],rgb(0x967655));
    a.oval(m.gloss,[diningTable,.380,decorZ],[.075,.013,.076],white);
    furniture(a,m,divider,hi,depth,number);
    bedroomWall(a,m,bedroomX,depth,number);
    for(const x of [bedroomX-.801,bedroomX+.804]) {
      for(let i=0;i<5;i++) a.box(m.fabric,[x+(i-2)*.030,1.523,depth-.190+(i%2)*.021],
        [.061,1.26,.048],rgb(0xe2dcce),{radius:.014});
    }
    bathroom(scene,a,height,lo,bathX,bathZ,depth,tile,rgb(palette.bath));

    Valley.lodging.roomLight(scene,a,0,[lo+.062,divider-.062,.061,bathZ-.061],
      [entry+.769,1.27,.070],0,number%2 ? "cluster" : "cross",
      [[bathX+.062,divider-.062,bathZ-.061,depth-.086]]);
    Valley.lodging.roomLight(scene,a,0,[divider+.062,hi-.062,.061,depth-.086],
      [divider+.071,1.27,bedDoor+.862],Math.PI/2,"strip");
    Valley.lodging.roomLight(scene,a,0,[lo+.069,bathX-.062,bathZ+.061,depth-.086],
      [bathX-.071,1.27,bathDoor-.650],-Math.PI/2,"round");
  }

  Valley.roadSuites={wall,planks,sofa,lowTable,build,floorTint:style=>rgb(palettes[style].wood)};
})();
