"use strict";

(() => {
  const {Builder,dot,mix,minus,plus,point,random,rgb,smooth,times,transform}=Valley;
  const {storeyHeight}=Valley.roadLayout;
  const buildings=new Set(["brick","diner","inn","info","shop","shelter"]);
  const wood=rgb(0xa18769), darkWood=rgb(0x70523e), ivory=rgb(0xdbd9c9);
  const zinc=rgb(0x9b9d93), iron=rgb(0x494e49), red=rgb(0xa14636), chipped=rgb(0x3b3029);
  const rng=random(18651), furniture=new WeakMap();
  const clearView={data:new Float32Array(0),exposure:0,light:[0,0,0,0]};
  const burstLife=10.5;
  const alarmDelay=.56, sprayDelay=1.12;
  const sprayRandom=random(20963);
  const drops=Array.from({length:84},(_,i)=>{
    const angle=sprayRandom()*Math.PI*2, spread=mix(.16,1,sprayRandom()**.45);
    return {x:Math.cos(angle)*spread,z:Math.sin(angle)*spread,start:(i+.5)/95,
      fall:mix(.55,.93,sprayRandom()),size:mix(.013,.038,sprayRandom()),alpha:mix(.47,.92,sprayRandom())};
  });

  function build(scene,a,b,height) {
    if(!buildings.has(b.style)) return null;
    const m=scene.material, {fixture,model,body}=Valley.lodging;
    const x=-b.w/2, z=.52, span=Math.min(6.5,b.d-1.86), normal=[-Math.cos(a.yaw),0,Math.sin(a.yaw)];
    const outside=a.at([x-.78,0,z]), ground=height(outside[0],outside[2])-b.y;
    const foot=Math.max(-.09,ground)+.083;
    const pad=foot-ground+.028;
    const tankColor=b.style==="brick" || b.style==="shelter" ? rgb(0xbdbeb5) : rgb(0xd5ceba);
    const stand=fixture(scene,a,"serviceStand",[x-.78,foot-pad/2,z],0,model(scene,part=>{
      part(m.rock).box([0,0,0],[.99,pad,.98],rgb(0x92918a),.028);
    }));
    body(scene,stand,[0,0,0],[.99,pad,.98],"rock",0,"rock");

    const tank=fixture(scene,a,"tank",[x-.78,foot,z],-Math.PI/2,model(scene,part=>{
      const shell=part(m.paint), rail=part(m.gloss), r=.345;
      shell.cylinder([0,.243,0],[0,1.092,0],r,r,tankColor,28);
      shell.ellipsoid([0,1.089,0],[r,.177,r],tankColor,null,28,12);
      shell.ellipsoid([0,.247,0],[r,.179,r],tankColor,null,28,12);
      shell.cylinder([0,.019,0],[0,.108,0],.266,.266,iron,24);
      for(let i=0;i<3;i++) {
        const t=i*Math.PI*2/3,u=Math.cos(t),v=Math.sin(t);
        rail.box([u*.216,.087,v*.216],[.075,.148,.054],zinc,.009,[0,-t,0]);
      }
      for(let i=0;i<20;i++) {
        const rim=j=>[Math.cos(j*Math.PI/10)*.243,1.343,Math.sin(j*Math.PI/10)*.243];
        rail.cylinder(rim(i),rim(i+1),.017,.017,tankColor,7);
      }
      for(const u of [-.220,.220]) rail.cylinder([u,1.199,0],[u,1.342,0],.020,.020,tankColor,9);
      shell.box([0,.744,.349],[.290,.155,.014],ivory,.006);
      const strokes=[
        [[-.093,.756],[.014,.086]],[[-.075,.719],[.049,.014]],
        [[-.028,.756],[.013,.086]],[[-.006,.792],[.047,.014]],
        [[.012,.774],[.013,.041]],[[-.006,.755],[.047,.013]],
        [[.061,.792],[.056,.014]],[[.039,.756],[.013,.086]],
        [[.061,.719],[.056,.014]],[[.083,.739],[.013,.050]],[[.070,.757],[.031,.013]]
      ];
      for(const [[u,v],[w,h]] of strokes) shell.box([u,v,.359],[w,h,.007],red,.002);
      shell.cylinder([0,.585,0],[0,.618,0],r+.003,r+.003,rgb(0xa98464),28);
    }));
    tank.hits=0;
    body(scene,tank,[0,.688,0],[.70,1.37,.70],"tank");

    const fittings=fixture(scene,a,"serviceFittings",[x,0,z],0,model(scene,part=>{
      const skin=part(m.paint), metal=part(m.gloss), grille=part(m.plain);
      const condenserZ=-1.54, face=-.527;
      skin.box([-.318,.482,condenserZ],[.392,.622,1.024],ivory,.027);
      grille.cylinder([face-.008,.486,condenserZ-.084],[face-.009,.486,condenserZ-.084],.253,.253,iron,24);
      const hub=[face-.024,.486,condenserZ-.084];
      for(let i=0;i<5;i++) {
        const t=i*Math.PI*2/5, y=.131*Math.cos(t), w=.131*Math.sin(t);
        grille.ellipsoid([hub[0],hub[1]+y,hub[2]+w],[.008,.116,.041],zinc,[t+.34,0,0],12,6);
      }
      metal.ellipsoid(hub,[.021,.052,.052],zinc,null,14,8);
      for(const r of [.103,.151,.194,.234,.256]) for(let i=0;i<28;i++) {
        const p=j=>[face-.036,hub[1]+Math.cos(j*Math.PI/14)*r,hub[2]+Math.sin(j*Math.PI/14)*r];
        metal.cylinder(p(i),p(i+1),.0041,.0041,zinc,5);
      }
      for(let i=0;i<7;i++) grille.box([face-.007,.30+i*.048,condenserZ+.344],[.012,.014,.139],iron,.002);
      for(const w of [-.37,.37]) metal.box([-.302,.140,condenserZ+w],[.49,.075,.071],zinc,.006);
      const meter=[-.152,1.49,1.08];
      skin.box(meter,[.159,.313,.289],zinc,.026);
      grille.box([-.235,1.545,1.081],[.016,.077,.192],iron,.008);
      for(let i=0;i<4;i++) skin.box([-.246,1.546,1.016+i*.042],[.008,.036,.022],ivory,.003);
      metal.cylinder([-.237,1.425,1.08],[-.247,1.425,1.08],.025,.025,zinc,12);
      for(const [tint,diameter,points] of [
        [rgb(0xc1a249),.023,[[-.138,1.64,1.08],[-.138,2.28,1.08],[-.138,2.28,.29],[-.105,2.28,.29]]],
        [zinc,.019,[[-.144,1.343,1.079],[-.144,1.204,1.079],[-.192,1.204,.661],[-.456,1.287,.081],[-.752,foot+1.239,0]]],
        [ivory,.034,[[-.223,.631,condenserZ+.49],[-.196,.883,condenserZ+.59],[-.139,1.064,condenserZ+.64],
          [-.130,1.95,condenserZ+.64],[-.086,1.95,condenserZ+.64]]]
      ]) {
        for(let i=1;i<points.length;i++) metal.cylinder(points[i-1],points[i],diameter,diameter,tint,11);
        for(const p of points.slice(1,-1)) metal.ellipsoid(p,[diameter,diameter,diameter],tint,null,9,6);
      }
    }));
    body(scene,fittings,[-.320,.482,-1.54],[.46,.63,1.035],"metal");
    body(scene,fittings,[-.15,1.49,1.08],[.18,.32,.30],"metal");

    const debris=scene.blastDebris??=Array.from({length:7},(_,i)=>{
      const b=new Builder();
      if(i>=5) {
        b.box([0,0,0],[i===5 ? .54 : .27,.081,i===5 ? .92 : 1.28],i===5 ? wood : darkWood,.013,[0,.19,0]);
        b.triangle([-.21,.039,-.37],[.18,.04,-.38],[-.09,.041,-.53],darkWood);
        return scene.renderer.mesh(b,m.wood);
      }
      const tint=rgb([0x938575,0xb7a99a,0x7f7066,0xc4bbac,0x6a716d][i]);
      const p=[[-.47,-.12,-.29],[.35,-.23,-.20],[.44,.09,.24],[-.28,.17,.33],[.08,.34,-.13],[-.11,-.32,.06]];
      for(let j=0;j<4;j++) {
        b.triangle(p[j],p[(j+1)%4],p[4],tint);
        b.triangle(p[(j+1)%4],p[j],p[5],times(tint,.86));
      }
      return scene.renderer.mesh(b,i<3 ? m.plaster : m.gloss);
    });
    return {x,z,span,foot,ground,tank,fittings,stand,normal,debris,building:b,stairs:[],blastRadius:b.storeys>1 ? 24 : 16.8,
      at:a.at([x-.66,foot+.71,z]),destroyed:false,pending:false,fireAt:null,alarms:[],sprinklers:[]};
  }

  function wallProfile(bottom,top,half) {
    const levels=[0,.12,.24,.43,.62,.78,.91,1].map(t=>mix(bottom,top,t));
    const edges=[[-.79,-.93,-.84,-.92,-.86,-.72,-.57,-.41],[.85,.97,.89,.95,.85,.91,.65,.44]]
      .map(row=>row.map(edge=>edge*half));
    return {levels,edges};
  }

  function drawChippedSides(part,m,facade,tint,half,{levels,edges}) {
    for(const [index,side] of [[0,-1],[1,1]]) {
      const outer=side*half, row=edges[index];
      for(let i=1;i<levels.length;i++) {
        const y=levels[i-1], next=levels[i], u=row[i-1], v=row[i];
        for(const face of [-1,1]) {
          const q=face*.083;
          const corners=[[q,y,outer],[q,y,u],[q,next,v],[q,next,outer]];
          if(side!==face) corners.reverse();
          part(facade).quad(corners,times(tint,i%3===1 ? .81 : .94));
          const lip=Math.min(Math.abs(outer-u),Math.abs(outer-v))*.77;
          part(m.rock).quad([[q+face*.001,y,u],[q+face*.001,y,u+side*lip],
            [q+face*.001,next,v+side*lip],[q+face*.001,next,v]],times(chipped,i%2 ? .86 : 1.16));
        }
        part(m.rock).quad([[-.084,y,u],[.084,y,u],[.084,next,v],[-.084,next,v]],times(chipped,.86+i*.064));
      }
    }
  }

  function edgeBodies(scene,rim,half,{levels,edges}) {
    for(const [index,side] of [[0,-1],[1,1]]) for(let i=1;i<levels.length;i++) {
      const edge=side*Math.min(Math.abs(edges[index][i-1]),Math.abs(edges[index][i]));
      Valley.lodging.body(scene,rim,[0,(levels[i-1]+levels[i])/2,(edge+side*half)/2],
        [.174,levels[i]-levels[i-1],half-Math.abs(edge)],"rock");
    }
  }

  function wall(scene,a,site,facade,tint,h) {
    const {fixture,model,body}=Valley.lodging, m=scene.material;
    const {x,z,span}=site, bottom=.145, top=h-.255, half=span/2;
    a.box(facade,[x,bottom/2,z],[.166,bottom,span],tint,{kind:"rock"});
    a.box(facade,[x,(top+h)/2,z],[.166,h-top,span],tint,{kind:"wall"});
    a.box(m.wood,[x,h-.08,z],[.181,.17,span],rgb(0x6f4935));
    const position=[x,0,z];
    const intact=fixture(scene,a,"wallPanel",position,0,model(scene,part=>{
      part(facade).box([0,(bottom+top)/2,0],[.166,top-bottom,span],tint);
      part(m.wood).box([0,.22,0],[.184,.16,span],tint);
      part(m.plaster).box([0,.11,0],[.191,.22,span],rgb(0xb0a697));
      part(m.wood).box([0,h-.21,0],[.179,.138,span],tint);
      part(m.wood).box([.089,.363,0],[.022,.655,span],wood);
      part(m.wood).box([.111,.703,0],[.046,.067,span],darkWood);
    }));
    body(scene,intact,[0,(bottom+top)/2,0],[.166,top-bottom,span],"rock");
    const profile=wallProfile(bottom,top,half);
    const step=[.48,site.foot-site.ground+.036,Math.min(2.1,span*.53)];
    const sill=[-.208,site.foot-step[1]/2,0];
    const rim=fixture(scene,a,"brokenWall",position,0,model(scene,part=>{
      drawChippedSides(part,m,facade,tint,half,profile);
      part(m.rock).box([.007,bottom+.007,0],[.187,.021,span*.76],times(chipped,1.28),.008);
      part(m.rock).box(sill,step,times(chipped,1.48),.036);
      for(let i=0;i<30;i++) {
        const side=i%2===0 ? -1 : 1;
        const u=mix(.43,1.12,rng())*half*side, x=mix(-.63,.66,rng());
        const y=x<0 ? Math.max(site.ground,-.08) : .035;
        part(m.rock).box([x,y+mix(.027,.094,rng()),u],[mix(.16,.46,rng()),mix(.10,.21,rng()),mix(.13,.44,rng())],
          times(tint,mix(.34,.69,rng())),.033,[mix(-.4,.4,rng()),rng()*6.28,mix(-.45,.45,rng())]);
      }
    }));
    edgeBodies(scene,rim,half,profile);
    body(scene,rim,sill,step,"rock",0,"rock");
    rim.broken=true;
    const wallKind=facade===m.wood ? "wood" : "surface";
    const fireSurfaces=[-1,1].flatMap(side=>[
      {at:a.at([x-.087,.58,z+side*(half-.29)]),kind:wallKind,size:.69,normal:site.normal},
      {at:a.at([x-.087,h-.40,z+side*half*.72]),kind:wallKind,size:.64,normal:site.normal}
    ]);
    Object.assign(site,{intact,rim,fireSurfaces,breach:a.at([x,1.12,z])});
  }

  function breakableStructure(scene,a,type,origin,draw) {
    const boxes=[];
    const meshes=Valley.lodging.model(scene,part=>draw({
      at:a.at,yaw:a.yaw,
      box(material,at,size,tint,{radius=0,yaw=0,kind,stair=0,stepBank}={}) {
        part(material).box(minus(at,origin),size,tint,radius,yaw ? [0,yaw,0] : null);
        if(kind) boxes.push({at,size,yaw,kind,stair,stepBank});
      },
      beam(material,from,to,start,end,tint,sides) {
        part(material).cylinder(minus(from,origin),minus(to,origin),start,end,tint,sides);
      },
      quad(material,vertices,tint,uv) {
        part(material).quad(vertices.map(at=>minus(at,origin)),tint,null,uv);
      }
    }));
    const item=Valley.lodging.fixture(scene,a,type,origin,0,meshes);
    if(type==="woodFloor" || type==="woodStair") item.timber=[];
    for(const {at,size,yaw,kind,stair,stepBank} of boxes) {
      const bounds=scene.collider(...a.at(at),size,a.yaw+yaw,kind,kind,0,stair,stepBank);
      bounds.fixture=item;
      if(kind==="wood") item.timber?.push(bounds);
    }
    return item;
  }

  function timberFloor(scene,a,[lo,hi,near,far],top,tint,{thickness=.158,ceiling=false}={}) {
    const m=scene.material, columns=Math.ceil((hi-lo)/3.8), rows=Math.ceil((far-near)/3.8);
    const depth=(far-near)/rows, width=(hi-lo)/columns;
    const wood=rgb(0xa98a68), lining=rgb(0xe0ddd2);
    for(let row=0;row<rows;row++) for(let column=0;column<columns;column++) {
      const x0=lo+column*width, z0=near+row*depth, x=x0+width/2, z=z0+depth/2;
      breakableStructure(scene,a,"woodFloor",[x,top,z],target=>{
        target.box(m.wood,[x,top-thickness/2,z],[width,thickness,depth],wood,{kind:"wood",stepBank:"indoorWood"});
        if(ceiling) target.box(m.paint,[x,top-thickness-.002,z],[width,.012,depth],lining);
        Valley.roadSuites.planks(target,m,x0,x0+width,z0,z0+depth,top+.007,tint);
      });
    }
  }

  function breakableStair(scene,a,site,origin,draw) {
    site.stairs.push(breakableStructure(scene,a,"serviceStair",origin,draw));
  }

  function upperWall(scene,a,site,h,exterior) {
    const {fixture,model,body}=Valley.lodging, m=scene.material;
    const {x,z,span,building}=site, front=building.d/2, half=span*.35;
    const {surface,tint}=exterior, lo=z-half, hi=z+half;
    const wall=Valley.roadSuites.wall;
    wall(scene,a,h,"x",x,-front,lo,exterior);
    wall(scene,a,h,"x",x,hi,front,exterior);
    const origin=[x,0,z], windows=[{center:0,width:1.90,bottom:1.17,top:2.20}];
    const intact=breakableStructure(scene,a,"wallPanel",origin,target=>
      wall(scene,target,h,"x",x,lo,hi,{...exterior,windows}));
    const bottom=.115, top=h-.235, profile=wallProfile(bottom,top,half);
    const strips=[[bottom/2,bottom],[(top+h)/2,h-top]];
    const rim=fixture(scene,a,"brokenWall",origin,0,model(scene,part=>{
      drawChippedSides(part,m,surface,tint,half,profile);
      for(const [y,height] of strips) part(surface).box([0,y,0],[.166,height,2*half],tint);
    }));
    edgeBodies(scene,rim,half,profile);
    for(const [y,height] of strips) body(scene,rim,[0,y,0],[.166,height,2*half],"rock");
    rim.broken=true;
    const landing=a.at([x+1.43,.036,z+half+.89]);
    site.upperWall={intact,rim,breach:a.at([x,1.12,z]),landing};
    const wallKind=surface===m.wood ? "wood" : "surface";
    for(const side of [-1,1]) {
      site.fireSurfaces.push({at:a.at([x-.087,.94,z+side*(half+.63)]),kind:wallKind,size:.63,normal:site.normal});
    }
    site.fireSurfaces.push({at:landing,kind:"wood",size:.56,normal:[0,1,0],priority:true});
  }

  function mountFireSystem(scene,a,site,zones,road) {
    const m=scene.material, b=site.building;
    const {floor,local}=Valley.roadview;
    const ceiling=level=>level*storeyHeight+2.60;
    const alarmCase=rgb(0xa93d31), alarmLens=rgb(0xc36154), deflector=rgb(0xb79d66);
    if(!scene.fireLens) {
      const shape=new Builder();
      shape.ellipsoid([0,0,0],[.064,.025,.064],rgb(0xff7664),null,16,7);
      scene.fireLens=scene.renderer.mesh(shape,m.emissive);
    }
    for(let level=0;level<b.storeys;level++) {
      const locations=b.storeys>1 && level===0 ? [[1.6,b.d*.24],[-b.w*.31,b.d*.13]] : [[.96,0]];
      for(const [x,z] of locations) {
        const y=ceiling(level);
        a.beam(m.paint,[x,y-.03,z],[x,y+.008,z],.109,.109,ivory,18);
        a.beam(m.paint,[x,y-.085,z],[x,y-.028,z],.085,.101,alarmCase,18);
        a.oval(m.gloss,[x,y-.086,z],[.062,.023,.062],alarmLens);
        const at=a.at([x,y-.094,z]);
        site.alarms.push({at,matrix:transform(at,0,a.yaw),mesh:scene.fireLens});
      }
    }

    for(const zone of zones) {
      const [x,z]=local(b,zone.at[0],zone.at[2]), [hx,,hz]=zone.size;
      const level=Math.floor((zone.at[1]-b.y)/storeyHeight), y=ceiling(level);
      const alongX=hx>=hz, half=alongX ? hx : hz, cross=alongX ? hz : hx;
      const count=half>=3.8 ? 2 : 1;
      for(let i=0;i<count;i++) {
        const offset=count===1 ? Math.min(.53,half*.38) : half*(i===0 ? -.42 : .42);
        const u=x+(alongX ? offset : 0), v=z+(alongX ? 0 : offset);
        a.beam(m.gloss,[u,y-.031,v],[u,y+.003,v],.052,.057,zinc,14);
        a.beam(m.gloss,[u,y-.099,v],[u,y-.027,v],.021,.022,zinc,10);
        a.beam(m.gloss,[u,y-.106,v],[u,y-.096,v],.043,.043,deflector,14);
        const at=a.at([u,y-.108,v]);
        const surface=floor(road,at[0],at[2],at[1]-.17).top;
        const bottom=Math.max(b.y+level*storeyHeight,surface)+.035;
        site.sprinklers.push({at,bottom,spread:Math.min(1.56,.85*Math.min(half-Math.abs(offset),cross))});
      }
    }
  }

  function bind(site,scene,a,first,road) {
    site.items=scene.items.slice(first.items);
    site.monitors=scene.monitors.slice(first.monitors);
    for(const item of site.items) item.service=site;
    mountFireSystem(scene,a,site,scene.zones.slice(first.zones),road);
  }

  function disable(site,time,radius) {
    site.destroyed=true;
    site.fireAt=time;
    site.tank.broken=site.fittings.broken=site.intact.broken=site.stand.broken=true;
    site.rim.broken=false;
    const collapsed=[{at:site.fittings.at,kind:"metal"}];
    if(site.upperWall) {
      const {intact,rim,breach}=site.upperWall;
      intact.broken=true;
      rim.broken=false;
      collapsed.push({at:breach,kind:"wall"});
    }
    for(const item of site.stairs) {
      item.broken=true;
      collapsed.push({at:item.at,kind:"stairs"});
    }
    for(const door of site.items) {
      if(door.broken || door.kind!=="door" || door.window) continue;
      const at=door.bounds.center, range=Math.hypot(...minus(at,site.at));
      const nearUpper=site.upperWall && at[1]<site.building.y+2*storeyHeight && range<8.4;
      if((at[1]>site.building.y+3.35 && !nearUpper) || range>radius*.66) continue;
      door.broken=true;
      collapsed.push({at,kind:"door"});
    }
    for(const item of site.items) if(item.kind==="burner") Valley.lodging.extinguish(item);
    const lights=site.items.filter(item=>item.kind==="light");
    lights.sort((a,b)=>Math.hypot(...minus(a.lampAt,site.at))-Math.hypot(...minus(b.lampAt,site.at)));
    for(const lamp of lights.slice(0,Math.max(1,Math.ceil(lights.length*.4)))) {
      lamp.failed=true;
      lamp.on=false;
      lamp.value=0;
    }
    for(const tv of site.monitors) tv.powerLost=true;
    return collapsed;
  }

  function fireSound(services,at,yaw,time) {
    const alarm={level:0,pan:0},spray={level:0,pan:0};
    const right=[Math.cos(yaw),0,Math.sin(yaw)];
    function hear(source,mix,near,far,volume) {
      const offset=minus(source.at,at), distance=Math.hypot(offset[0],offset[1]*1.65,offset[2]);
      const level=volume*(1-smooth(near,far,distance));
      if(level<=mix.level) return;
      mix.level=level;
      mix.pan=dot(offset,right)/Math.max(2,distance)*.80;
    }
    for(const site of services) {
      if(site.fireAt===null || time-site.fireAt<alarmDelay) continue;
      const b=site.building, [u,v]=Valley.roadview.local(b,at[0],at[2]);
      if(Math.abs(u)>b.w/2+38 || Math.abs(v)>b.d/2+38) continue;
      const inside=Math.abs(u)<b.w/2+.09 && Math.abs(v)<b.d/2+.09
        && at[1]>=b.y-.05 && at[1]<b.y+b.storeys*storeyHeight;
      for(const source of site.alarms) hear(source,alarm,2,inside ? 23 : 37,inside ? 1 : .30);
      if(time-site.fireAt<sprayDelay) continue;
      for(const source of site.sprinklers) hear(source,spray,1.7,inside ? 12 : 8,inside ? 1 : .22);
    }
    return {alarm,spray};
  }

  function fireVisuals(services,time,view,objects,cloud) {
    const {at:eye,forward,axes,frustum:[horizontal,vertical]}=view;
    const right=axes.subarray(0,3), up=axes.subarray(3,6);
    const horizontalMargin=Math.hypot(1,horizontal), verticalMargin=Math.hypot(1,vertical);
    for(const site of services) {
      const age=time-site.fireAt;
      if(site.fireAt===null || age<alarmDelay) continue;
      const {x,z,w,d}=site.building;
      if(Math.hypot(eye[0]-x,eye[2]-z)>Math.hypot(w,d)*.5+30) continue;
      const blink=(age-alarmDelay)%1.16;
      if(blink<.17) objects.push(...site.alarms);
      const active=age-sprayDelay;
      if(active<0) continue;
      for(const head of site.sprinklers) {
        const [x,y,z]=head.at, distance=Math.hypot(x-eye[0],y-eye[1],z-eye[2]);
        if(distance>25 || Math.abs(y-eye[1])>4.6) continue;
        const height=y-head.bottom;
        const offset=[x-eye[0],y-height*.5-eye[1],z-eye[2]];
        const depth=dot(offset,forward), extent=Math.hypot(head.spread,height*.5)+.18;
        if(Math.abs(dot(offset,right))>depth*horizontal+extent*horizontalMargin
          || Math.abs(dot(offset,up))>depth*vertical+extent*verticalMargin) continue;
        for(let i=0;i<drops.length;i+=distance>13 ? 3 : 1) {
          const drop=drops[i], elapsed=active-drop.start;
          if(elapsed<0) continue;
          const phase=elapsed%(drop.fall+.17), t=Math.min(phase/drop.fall,1);
          const reach=head.spread*t*(1.23-.23*t);
          const px=x+drop.x*reach,pz=z+drop.z*reach;
          if(t<1) {
            const py=y-height*t*(.48+.52*t), speed=height*(.48+1.04*t)/drop.fall;
            const drift=head.spread*(1.23-.46*t)/drop.fall;
            cloud.push(px,py,pz,.71,.84,.95,drop.alpha,drop.size,drop.x*drift,-speed,drop.z*drift,1);
          } else if(i%3===0) {
            const splash=(phase-drop.fall)/.17;
            const py=head.bottom+.095*splash*(1-splash)*4;
            cloud.push(px+drop.x*splash*.065,py,pz+drop.z*splash*.065,
              .80,.90,.97,drop.alpha*(1-splash)*.59,drop.size*.91,0,0,0,0);
          }
        }
      }
    }
  }

  function tableSet(scene,a,x,z,plate=true) {
    const {compile,make,supportOn}=Valley.props, m=scene.material;
    if(!furniture.has(scene)) {
      const panel=new Builder(), legs=new Builder(), chair=new Builder(), crockery=new Builder();
      panel.box([0,.721,0],[1.61,.089,.82],wood,.027);
      for(const end of [-1,1]) {
        for(const side of [-1,1]) legs.box([end*.670,.349,side*.306],[.083,.699,.083],darkWood,.012);
        panel.box([end*.632,.613,0],[.071,.166,.702],darkWood,.009);
        chair.box([end*.142,.202,-.143],[.048,.404,.049],darkWood,.009);
        chair.box([end*.142,.202,.143],[.048,.404,.049],darkWood,.009);
      }
      chair.box([0,.421,0],[.405,.080,.395],wood,.025);
      crockery.ellipsoid([0,.023,0],[.119,.027,.112],ivory,null,22,9);
      crockery.ellipsoid([.007,.042,0],[.098,.009,.093],rgb(0xc7c5b0),null,20,8);
      furniture.set(scene,{
        table:compile(scene.renderer,[{shape:panel,material:m.wood,group:"top"},{shape:legs,material:m.wood,group:"legs"}]),
        stool:compile(scene.renderer,[{shape:chair,material:m.wood}]),
        plate:compile(scene.renderer,[{shape:crockery,material:m.porcelain}])
      });
    }
    const mesh=furniture.get(scene);
    const spawn=(parts,kind,u,v,rx,rz,height)=>{
      const prop=make(parts,kind,...a.at([u,.012,v]),a.yaw,rx,rz,height);
      scene.props.push(prop);
      return prop;
    };
    const table=spawn(mesh.table,"table",x,z,.805,.408,.765);
    table.surface={top:.7655,rx:.80,rz:.40};
    for(const u of [-.53,.53]) {
      for(const v of [-.66,.66]) spawn(mesh.stool,"chair",x+u,z+v,.20,.20,.462).mass=1.15;
      if(plate) {
        const p=spawn(mesh.plate,"plate",x+u,z,.12,.12,.049);
        supportOn(p,table,[u,.77,-.04],a.yaw);
      }
    }
  }

  function burst(site,time) {
    const {at}=site;
    const puffs=[];
    for(const [kind,count,delay,life,force,size] of [
      [0,37,.24,[.51,1.24],[3.6,12.6],[.51,1.68]],
      [1,56,.81,[4.2,9.2],[2.4,6.6],[.77,2.42]],
      [2,30,.38,[1.55,5.6],[3.8,9.4],[.52,1.52]]
    ]) for(let i=0;i<count;i++) {
      const turn=rng()*Math.PI*2, spread=mix(...force,rng()), seed=rng();
      const rise=kind===2 ? mix(-.28,.71,rng()) : mix(.64,kind===1 ? 3.51 : 6.22,rng());
      const velocity=[Math.cos(turn)*spread,rise,Math.sin(turn)*spread];
      const origin=plus(at,[Math.cos(turn)*seed*.46,kind===2 ? -.48 : (rng()-.42)*.79,Math.sin(turn)*seed*.46]);
      puffs.push({kind,origin,velocity,start:time+rng()*delay,life:mix(...life,rng()),size:mix(...size,rng()),seed});
    }
    for(let i=0;i<24;i++) {
      const turn=(i+(rng()-.5)*.54)*Math.PI/12, x=Math.cos(turn), z=Math.sin(turn);
      const force=mix(8.6,14.7,rng());
      puffs.push({kind:2,origin:plus(at,[x*.7,-.61,z*.7]),velocity:[x*force,mix(.08,.72,rng()),z*force],
        start:time+mix(.06,.19,rng()),life:mix(2.5,4.6,rng()),size:mix(.48,1.31,rng()),seed:rng()});
    }
    const nearby=site.upperWall ? [site.upperWall.breach,site.upperWall.landing] : [];
    for(const prop of site.reception??[]) {
      if(!prop.broken && !prop.picked) nearby.push(point(prop.matrix,[0,prop.height*.85,0]));
    }
    for(const center of nearby) for(let i=0;i<12;i++) {
      const turn=rng()*Math.PI*2, speed=mix(.72,2.94,rng());
      puffs.push({kind:2,origin:plus(center,[(rng()-.5)*.83,(rng()-.5)*.40,(rng()-.5)*.92]),
        velocity:[Math.cos(turn)*speed,mix(.22,1.22,rng()),Math.sin(turn)*speed],start:time+mix(.07,.30,rng()),
        life:mix(1.55,3.35,rng()),size:mix(.48,.98,rng()),seed:rng()});
    }
    return {at,time,puffs};
  }

  function visuals(bursts,fires,time,cam) {
    if(!bursts.length && !fires.length) return clearView;
    const visible=[];
    let light=null, exposure=0;
    for(const event of bursts) {
      const offset=minus(event.at,cam.at), distance=Math.hypot(...offset), age=time-event.time;
      if(distance>108) continue;
      const flash=(1-smooth(.035,.43,age))*(event.flash??1.13);
      if(flash>0) {
        const facing=distance<.8 ? 1 : smooth(-.35,.63,dot(offset,cam.forward)/distance);
        exposure=Math.max(exposure,flash*(1-smooth(2,38,distance))*mix(.32,1,facing));
        if(!light || distance<light.distance) light={at:event.at,flash,distance};
      }
      for(const puff of event.puffs) {
        const age=time-puff.start, t=age/puff.life;
        if(t<0 || t>=1) continue;
        const {kind,origin,velocity,seed}=puff;
        const drift=(1-Math.exp(-age*(kind===0 ? 2.0 : .90)))/(kind===0 ? 2.0 : .90);
        const at=plus(origin,times(velocity,drift));
        at[1]+=kind===1 ? age*.47 : 0;
        const size=puff.size*mix(kind===0 ? .63 : .45,kind===0 ? 2.2 : 2.62,smooth(0,.83,t));
        const alpha=smooth(0,kind===0 ? .066 : .14,t)*(1-smooth(.35,1,t))*(kind===2 ? .48 : .84);
        const depth=dot(minus(at,cam.at),cam.forward);
        if(depth>-size) visible.push({at,alpha,size,seed,kind,t,depth});
      }
    }
    const fireLight=Valley.fire.visuals(fires,time,cam,visible);
    visible.sort((a,b)=>b.depth-a.depth);
    const data=new Float32Array(visible.length*9);
    for(const [i,{at,alpha,size,seed,kind,t}] of visible.entries()) data.set([...at,size,alpha,seed,t,kind,seed*6.28+t*(seed-.5)],i*9);
    return {data,exposure,light:light ? [...light.at,light.flash] : fireLight??clearView.light};
  }

  Valley.utilities={build,wall,upperWall,breakableStair,breakableStructure,timberFloor,bind,disable,fireSound,fireVisuals,tableSet,burst,burstLife,visuals};
})();
