"use strict";

(() => {
  const {Builder,rgb,times,minus,unit,camera}=Valley;
  const white=rgb(0xf3eee1), brass=rgb(0xb49b64), metal=rgb(0x777d7b), black=rgb(0x292d2e);
  const palettes={
    brick:{base:0xc6a1a3,wood:0x896647,sill:0xb99162,frame:0x343e3e,floor:[0x3b3c3b,0xdad6c9],sign:"wood"},
    diner:{base:0xc9b9a6,wood:0x805137,sill:0xa69980,frame:0x4d4238,floor:[0x928a80,0xa29a8c],sign:"blue"},
    inn:{base:0x423b39,wood:0x684438,sill:0x574446,frame:0x302b2a,floor:[0xbfb8ae,0xcdc6b9],sign:"wood"}
  };

  const keyColors=[0x3b6968,0x963f44,0x75614c,0x4e617c];

  function printAtlas(renderer,rooms) {
    const {fonts}=Valley.roadSigns;
    const canvas=document.createElement("canvas");
    canvas.width=512;
    canvas.height=1024;
    const g=canvas.getContext("2d");
    const covers=[["화양구곡","#246970"],["계곡 산책로","#426545"],["민박 안내","#8b463d"]];
    for(let i=0;i<6+rooms.length;i++) {
      g.save();
      g.translate(i%4*128,Math.floor(i/4)*256);
      g.fillStyle=i>=6 ? `#${keyColors[(i-6)%keyColors.length].toString(16)}` : "#eae5d4";
      g.fillRect(0,0,128,256);
      g.textAlign="center";
      if(i<3) {
        const [title,ink]=covers[i];
        g.fillStyle=ink;
        g.fillRect(0,10,128,62);
        g.fillStyle="#f3e9cb";
        g.font=`bold 22px ${fonts.print}`;
        g.fillText(title,64,42,119);
        g.font=`12px ${fonts.numbers}`;
        g.fillText("HWAYANG VALLEY",64,61);
        g.fillStyle="#b8c5ae";
        g.fillRect(6,80,116,95);
        for(let j=0;j<3;j++) {
          g.fillStyle=["#7d9383","#566f5f",ink][j];
          g.beginPath();
          g.moveTo(6,151+j*8);
          for(let k=0;k<8;k++) g.lineTo(6+k*16.6,123+j*9+18*Math.cos(k*1.42+j*.9));
          g.lineTo(122,175);g.lineTo(6,175);g.fill();
        }
        g.strokeStyle="#c8d8cc";g.lineWidth=3;
        g.beginPath();g.moveTo(111,146);g.quadraticCurveTo(32,150,57,162);g.lineTo(23,174);g.stroke();
      } else if(i<6) {
        g.fillStyle="#394945";g.font=`bold 17px ${fonts.print}`;
        g.fillText(["객실 이용 안내","숙박 명부","예약 확인"][i-3],64,36);
        g.strokeStyle="#9a9c8a";g.strokeRect(12,54,104,161);
        for(let y=67;y<213;y+=13) g.fillRect(13,y,102,.8);
        for(const x of [41,87]) g.fillRect(x,54,.8,161);
      } else {
        g.strokeStyle="#eee4c4";g.lineWidth=3;g.strokeRect(9,17,110,222);
        g.fillStyle="#f0e8d5";g.font=`bold 37px ${fonts.numbers}`;
        g.fillText(String(rooms[i-6]),64,149);
      }
      if(i<3) {
        g.fillStyle="#57564e";
        for(let y=190;y<=227;y+=9) g.fillRect(13,y,66+y%22,1.4);
      }
      g.restore();
    }
    return renderer.texture(canvas,false);
  }

  function printing(mesh,id,points) {
    const u=id%4*.25, v=1-Math.floor(id/4)*.25;
    mesh.quad(points,[1,1,1],null,[[u+.003,v-.247],[u+.247,v-.247],[u+.247,v-.003],[u+.003,v-.003]]);
  }

  function flatPrint(mesh,id,x,y,z,w,d) {
    printing(mesh,id,[[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2],[x-w/2,y,z-d/2]]);
  }

  function assets(scene,rooms) {
    if(scene.receptionModels) return scene.receptionModels;
    scene.renderer.lobbyPrint=printAtlas(scene.renderer,rooms);
    const m=scene.material;
    function model(draw) {
      const shapes=new Map();
      draw(material=>{
        if(!shapes.has(material)) shapes.set(material,new Builder());
        return shapes.get(material);
      });
      return Valley.props.compile(scene.renderer,Array.from(shapes,([material,shape])=>({material,shape})));
    }
    const prints=Array.from({length:6},(_,id)=>model(part=>{
      const leaflet=id<3, ledger=id===4;
      const w=leaflet ? .119 : ledger ? .303 : .211, d=leaflet ? .219 : .282, y=ledger ? .025 : .008;
      part(m.paint).box([0,y*.39,0],[w,y*.78,d],ledger ? rgb(0x847455) : white,.002);
      flatPrint(part(m.lobbyPrint),id,0,y,0,w-.004,d-.004);
      if(ledger) part(m.wood).box([-w*.46,y*.57,0],[.015,y,d+.013],rgb(0x754e45),.005);
    }));
    const keys=rooms.map((_,i)=>model(part=>{
      const key=part(m.gloss), tag=part(m.paint);
      key.box([-.041,.006,.003],[.055,.006,.011],brass,.001);
      key.box([-.061,.006,.011],[.016,.006,.012],brass,.001);
      key.ellipsoid([-.016,.008,.004],[.016,.005,.014],brass,null,14,7);
      for(let j=0;j<10;j++) {
        const p=k=>[.009+Math.cos(k*Math.PI/5)*.010,.009,Math.sin(k*Math.PI/5)*.010];
        key.cylinder(p(j),p(j+1),.0018,.0018,metal,6,false);
      }
      tag.box([.046,.007,0],[.054,.012,.044],rgb(keyColors[i%keyColors.length]),.004);
      flatPrint(part(m.lobbyPrint),6+i,.046,.014,0,.050,.040);
    }));
    const propAsset=name=>Valley.props.compile(scene.renderer,Valley.blenderAssets.shapes(name,m));
    const bell=propAsset("lodge_reception_bell"), phone=propAsset("lodge_reception_phone");
    const crt=model(part=>{
      const shell=part(m.paint), vents=part(m.plain), screen=part(m.cctv);
      shell.box([0,.207,-.042],[.571,.413,.417],rgb(0x434847),.057);
      shell.box([0,.226,.173],[.552,.402,.096],rgb(0x727674),.032);
      vents.box([0,.246,.220],[.465,.319,.013],black,.012);
      const across=14, down=10, rows=[];
      for(let j=0;j<=down;j++) {
        const v=j/down, y=v*2-1;
        rows.push(Array.from({length:across+1},(_,i)=>{
          const u=i/across,x=u*2-1;
          return screen.vertex([x*.222*(1-.047*y**6),.245+y*.149,.227+.013*(1-.5*(x*x+y*y))],
            unit([x*.085,y*.081,1]),[u,v]);
        }));
      }
      for(let j=1;j<=down;j++) for(let i=1;i<=across;i++) {
        const a=rows[j-1][i-1],b=rows[j-1][i],c=rows[j][i],d=rows[j][i-1];
        screen.indices.push(a,b,c,a,c,d);
      }
      for(let i=0;i<6;i++) vents.box([-.210+i*.012,.069,.218],[.006,.027,.004],black,.001);
      for(let i=0;i<4;i++) shell.box([.108+i*.026,.068,.222],[.016,.016,.013],rgb(0x9a9a90),.003);
      part(m.emissive).box([.064,.068,.224],[.009,.006,.006],rgb(0x719e48),.002);
    });
    const chair=model(part=>{
      const cloth=part(m.fabric), frame=part(m.plain), pad=rgb(0x4f6564);
      cloth.box([0,.446,0],[.49,.091,.465],pad,.047);
      cloth.box([0,.70,.185],[.461,.394,.100],times(pad,1.09),.047,[-.11,0,0]);
      frame.cylinder([0,.083,0],[0,.417,0],.043,.029,black,10);
      frame.cylinder([0,.42,.141],[0,.646,.204],.026,.022,black,10);
      for(let i=0;i<5;i++) {
        const u=i*Math.PI*.4,x=Math.cos(u)*.232,z=Math.sin(u)*.232;
        frame.cylinder([0,.104,0],[x,.050,z],.023,.019,black,8);
        frame.ellipsoid([x,.028,z],[.028,.028,.033],black,null,10,6);
      }
    });
    scene.receptionModels={model,prints,keys,bell,phone,crt,chair};
    return scene.receptionModels;
  }

  function build(scene,a,style,{wall,lo,hi,front,h,edge,near,rooms}) {
    const m=scene.material, styleColors=palettes[style];
    const wood=rgb(styleColors.wood), trim=rgb(styleColors.frame), base=rgb(styleColors.base);
    const sillColor=rgb(styleColors.sill), mid=(lo+hi)/2, width=hi-lo;
    const sill=1.105, head=1.965, span=width/2;
    const paneTint=rgb(0x98b2ae);
    const {model,prints,keys,bell,phone,crt,chair}=assets(scene,rooms), physics=Valley.props;
    function box(mat,x,y,z,w,h,d,tint,radius=0,kind) {
      a.box(mat,[x,y,z],[w,h,d],tint,{radius,kind});
    }
    function spawn(parts,kind,at,yaw,rx,rz,height,surface) {
      const prop=physics.make(parts,kind,...a.at(at),a.yaw+yaw,rx,rz,height);
      if(surface) prop.surface=surface;
      scene.props.push(prop);
      return prop;
    }
    function supported(parts,kind,surface,x,z,yaw,rx,rz,height,pitch=0) {
      const prop=spawn(parts,kind,[0,0,0],0,rx,rz,height);
      physics.supportOn(prop,surface,[x,surface.surface.top+.004+rz*Math.sin(pitch),z],surface.yaw+yaw,pitch);
      return prop;
    }

    const cladding=style==="diner" ? m.ceramicTile : style==="inn" ? m.wood : m.paint;
    box(cladding,wall,sill/2,mid,.224,sill,width,base,.006,"wall");
    box(m.wood,wall,(head+h)/2,mid,.158,h-head,width,wood,.008,"wall");
    for(const z of [lo+.037,hi-.037]) box(m.wood,wall,h/2,z,.266,h,.075,wood,.009,"wall");
    for(const y of [sill+.016,head-.022]) {
      a.blender("lodge_window_channel",[wall,y,mid],{turn:-Math.PI/2,scale:[width-.08,.032,.158],tint:{paint:trim}});
    }
    for(const z of [lo+.076,hi-.078,mid]) {
      const end=z!==mid, x=end ? wall : wall+.039, depth=end ? .143 : .075, wide=end ? .042 : .033;
      const center=[x,(sill+head)/2,z];
      a.blender("lodge_window_channel_upright",center,{turn:-Math.PI/2,scale:[wide,head-sill,depth],tint:{paint:trim}});
      if(end) a.body(center,[depth,head-sill,wide],"wall");
    }
    box(m.paint,wall-.131,.086,mid,.043,.168,width-.053,trim,.007);
    a.label("안내실","INFORMATION",[wall-.089,2.323,mid],1.37,.52,styleColors.sign,-Math.PI/2);
    a.label("객실 요금","체크인 · 체크아웃",[wall-.140,1.778,lo-.335],.477,.532,"stone",-Math.PI/2);
    a.label("화양구곡","계곡 산책로",[wall-.124,1.782,hi+.21],.344,.436,"green",-Math.PI/2);

    if(style==="diner") {
      const tiles=[0xcec3b5,0xbda48b,0xc6a6a0,0xb0b2ac];
      const columns=Math.round(width/.267);
      for(let col=0;col<columns;col++) for(let row=0;row<4;row++) {
        const d=(width-.10)/columns,z=lo+.05+(col+.5)*d,y=.226+row*.229;
        const tint=rgb(tiles[(col*7+row*11)%tiles.length]);
        box(m.gloss,wall-.118,y,z,.013,.223,d-.006,tint,.004);
        if((col+row*3)%5===1) for(const r of [.045,.076,.101]) for(let i=0;i<12;i++) {
          const ring=j=>[wall-.127,y+r*Math.cos(j*Math.PI/6),z+r*Math.sin(j*Math.PI/6)];
          a.beam(m.gloss,ring(i),ring(i+1),.0028,.0028,times(tint,.72),4);
        }
      }
    } else {
      for(let z=lo+.18;z<hi-.12;z+=style==="inn" ? .48 : width-.36) {
        box(m.wood,wall-.124,.57,z,.028,.87,.039,wood,.004);
      }
    }

    const clearHeight=head-sill-.068;
    Valley.lodging.pane(scene,a,[wall+.040,sill+.036+clearHeight/2,mid+span/2-.038],span-.121,clearHeight,
      {yaw:-Math.PI/2,tint:paneTint});
    Valley.lodging.door(scene,a,[wall-.043,sill+.029,lo+.080],span-.080,
      {yaw:-Math.PI/2,height:clearHeight+.018,slide:span-.162,panel:"glass",color:trim,glassTint:paneTint,window:true});

    const stop=near-.012, start=-front+.078, floorStart=wall-.53;
    a.box(m.paint,[(floorStart+edge)/2,.004,(start+stop)/2],[edge-floorStart,.021,stop-start],rgb(0x757269),
      {kind:"rock",stepBank:"indoorStone"});
    const tile=style==="brick" ? .40 : .49;
    for(let x=floorStart,col=0;x<edge-.073;x+=tile,col++) for(let z=start,row=0;z<stop;z+=tile,row++) {
      const x1=Math.min(x+tile-.007,edge-.073),z1=Math.min(z+tile-.007,stop);
      if(x1<=x || z1<=z) continue;
      a.quad(m.gloss,[[x,.017,z],[x,.017,z1],[x1,.017,z1],[x1,.017,z]],
        times(rgb(styleColors.floor[(col+row)%2]),.96+.044*Math.cos(col*3.71+row*2.17)));
    }

    const shelf=spawn(model(part=>{
      part(style==="brick" ? m.wood : m.gloss).box([0,sill-.028,0],[width+.10,.056,.57],sillColor,.018);
      part(m.wood).box([0,sill-.064,.17],[width+.12,.038,.252],wood,.014);
      const holder=part(m.gloss);
      for(const x of [-.989,-.769,-.548]) {
        holder.cylinder([x,sill,.139],[x,sill+.19,.048],.006,.006,metal,7);
      }
      holder.cylinder([-.987,sill+.19,.048],[-.548,sill+.19,.048],.006,.006,metal,7);
      holder.box([-.769,sill+.012,.142],[.465,.024,.014],metal,.003);
    }),"sill",[wall-.032,0,mid],-Math.PI/2,width/2+.05,.285,sill,{top:sill,rx:width/2+.05,rz:.285});
    for(const [i,x,z,yaw,pitch] of [[0,-.87,.10,.07,1.13],[1,-.66,.10,-.09,1.13],[2,.81,.176,.14,0]]) {
      supported(prints[i],"pamphlet",shelf,x,z,yaw,.060,.111,.009,pitch);
    }
    supported(bell,"bell",shelf,.225,.191,0,.054,.054,.061);
    supported(prints[3],"document",shelf,.55,.126,-.14,.106,.142,.009);

    const deskX=(wall+edge)*.5+.42, deskZ=-front+.83, top=.772;
    const desk=spawn(model(part=>{
      const b=part(m.wood);
      b.box([0,top-.034,0],[1.67,.068,.74],wood,.016);
      b.box([.56,.356,-.021],[.408,.712,.62],times(wood,.83),.017);
      for(let i=0;i<3;i++) {
        const y=.151+i*.219;
        b.box([.56,y,.302],[.381,.196,.042],times(wood,1.17),.009);
        part(m.gloss).box([.56,y+.023,.332],[.129,.019,.023],brass,.007);
      }
      for(const z of [-.287,.287]) b.box([-.73,.354,z],[.068,.707,.069],wood,.007);
      b.box([-.15,.596,-.302],[1.24,.219,.042],times(wood,.91),.009);
    }),"desk",[deskX,0,deskZ],0,.835,.37,top,{top,rx:.835,rz:.37});
    const tv=supported(crt,"crt",desk,.39,-.106,-.63,.285,.251,.433);
    supported(phone,"phone",desk,-.59,-.154,.13,.108,.094,.082);
    supported(prints[4],"ledger",desk,-.26,.034,-.24,.152,.144,.027);
    supported(prints[5],"document",desk,.13,.224,.28,.105,.143,.009);
    supported(prints[1],"pamphlet",desk,-.614,.175,-.29,.060,.111,.009);
    spawn(chair,"chair",[deskX-.30,0,deskZ+1.02],.30,.260,.249,.904);

    const backWidth=edge-wall-.10, backX=(wall+edge)*.5;
    box(style==="inn" ? m.paint : m.wallpaper,backX,1.776,-front+.086,backWidth,1.71,.018,
      rgb(style==="brick" ? 0xdfc7c5 : 0xdcd2bb));
    box(m.wood,backX,.924,-front+.104,backWidth,.051,.036,wood,.004);
    const keyX=wall+1.13, keyZ=-front+.184, keyY=1.185;
    const columns=4, cellW=.265, cellH=.236;
    const rackW=columns*cellW+.043, rackH=Math.ceil(rooms.length/columns)*cellH+.044;
    const rack=spawn(model(part=>{
      const b=part(m.wood);
      b.box([0,rackH/2,-.115],[rackW,rackH,.052],times(wood,.81),.006);
      for(let x=0;x<=columns;x++) b.box([(x-columns/2)*cellW,rackH/2,0],[.033,rackH,.258],wood,.004);
      for(let y=0;y<rackH;y+=cellH) b.box([0,y+.025,0],[rackW,.037,.262],wood,.005);
      for(const [i] of rooms.entries()) {
        const x=(i%columns+.5-columns/2)*cellW,y=Math.floor(i/columns)*cellH;
        b.box([x,y+.060,.126],[cellW-.041,.044,.021],times(wood,1.11),.005);
        part(m.gloss).cylinder([x+.009,y+.122,-.088],[x+.009,y+.122,.065],.004,.004,brass,8);
      }
    }),"rack",[keyX,keyY,keyZ],0,rackW/2,.132,rackH,{top:.044,rx:rackW/2-.034,rz:.125});
    for(const [i,number] of rooms.entries()) {
      const x=(i%columns+.5-columns/2)*cellW,y=Math.floor(i/columns)*cellH;
      const key=spawn(keys[i],"key",[keyX,keyY,keyZ],0,.076,.027,.014);
      physics.supportOn(key,rack,[x,y+.118,.057],rack.yaw,1.35);
      a.label(String(number),"",[keyX+x,keyY+y+.066,keyZ+.137],.130,.055,"wood");
    }
    a.label("객실 열쇠","ROOM KEYS",[keyX,keyY+rackH+.139,keyZ-.086],.83,.198,"wood");

    tv.cameras=[
      [[-.67,2.45,front-.44],[.80,1.20,mid-.13]],
      [[3.25,2.19,front+1.71],[-.28,1.19,front+.87]]
    ].map(([at,to])=>{
      const ray=minus(to,at), yaw=Math.atan2(ray[0],ray[2]);
      a.box(m.paint,at,[.128,.109,.237],white,{yaw,radius:.013});
      const lens=[at[0]+Math.sin(yaw)*.127,at[1]-.018,at[2]+Math.cos(yaw)*.127];
      a.oval(m.gloss,lens,[.041,.035,.038],black);
      const origin=a.at(lens), vector=unit(minus(a.at(to),origin));
      return camera(origin,Math.atan2(vector[0],-vector[2]),Math.asin(vector[1]),64,4/3);
    });
    scene.monitors.push(tv);
    return [shelf,desk];
  }

  Valley.reception={build};
})();
