"use strict";

(() => {
  const { Builder, rgb, clamp, smooth, random, mix, times, plus, minus, transform } = Valley;
  const origin={x:1320,y:4.16,z:128},halfWidth=32,halfLength=28;
  const paving=[[0,16,6.3,21],[-22,1.3,4.6,34.2],[20,1.3,5.2,36],[-.7,-16,29,3.6]];
  const bounds={
    left:origin.x-halfWidth,right:origin.x+halfWidth,far:origin.z-halfLength,near:origin.z+halfLength
  };
  const contains=(x,z)=>x>=bounds.left && x<=bounds.right && z>=bounds.far && z<=bounds.near;
  const inScene=(x,z)=>Math.abs(x-origin.x)<=84 && Math.abs(z-origin.z)<=84;
  const paved=(x,z)=>contains(x,z) && paving.some(([px,pz,w,d])=>
    Math.abs(x-origin.x-px)<=w/2 && Math.abs(z-origin.z-pz)<=d/2);
  function height(x,z) {
    const u=x-origin.x,v=z-origin.z;
    const edge=Math.max(Math.abs(u)-halfWidth-1,Math.abs(v)-halfLength-1);
    return origin.y+smooth(0,42,edge)*(7+4*Math.cos(u*.104+v*.081)+3*Math.sin(v*.136-u*.092));
  }

  const at=(x,y,z)=>[origin.x+x,origin.y+y,origin.z+z];
  const spawn={x:origin.x,z:origin.z+22.5,yaw:0,pitch:-.042};
  const supply={x:origin.x-3.66,y:origin.y,z:origin.z+23.4};
  const targetDesigns=[
    [0,1.26,12.2,0,.55,0],
    [-24.9,1.42,6.6,.46,.49,0],
    [-17.4,2.74,-4.7,.17,.46,0],
    [-24.6,1.37,-18.6,.38,.50,0],
    [1.3,1.47,-20.1,0,.49,2.75],
    [14.6,1.52,2.2,-.27,.53,0],
    [23.4,1.32,-17.1,-.40,.46,0],
    [17.6,1.35,18.3,-.76,.48,1.76]
  ];

  function buildSupplyCrate(renderer,area,m) {
    const width=.92, depth=.65, height=.60, board=.012;
    const kraft=rgb(0xc29762), sideKraft=rgb(0xb98d59);
    const box=area(supply.x,supply.y,supply.z);
    const wall={kind:"wall"};
    for(const side of [-1,1]) {
      box.box(m.plaster,[0,height/2,side*(depth-board)/2],[width,height,board],kraft,wall);
      box.box(m.plaster,[side*(width-board)/2,height/2,0],[board,height,depth-2*board],sideKraft,wall);
    }
    box.box(m.plaster,[0,board,0],[width-2*board,board,depth-2*board],rgb(0x9c7045));
    box.box(m.plain,[0,board*1.5+.001,0],[width-2*board,.002,.005],rgb(0x815b36));
    box.box(m.plaster,[-width/2+.026,height/2,depth/2+.001],[.014,height,.002],sideKraft);
    box.done();

    function flap(span,length,taped) {
      const mesh=new Builder();
      mesh.box([0,0,length/2],[span,board,length],rgb(0xcaa471),.0015);
      if(taped) mesh.box([0,board/2+.001,length-.015],[span-.006,.002,.03],rgb(0xe5d1a7));
      return renderer.mesh(mesh,m.plaster);
    }
    const outer=flap(width-.008,depth/2-.004,true);
    const inner=flap(depth-2*board-.008,.29,false);
    const {x,y,z}=supply, lower=y+height+board*.56, upper=lower+board+.003;
    return {open:0,flaps:[
      {mesh:outer,at:[x,upper,z-depth/2],yaw:0,outer:true,angle:Math.PI+.27},
      {mesh:outer,at:[x,upper,z+depth/2],yaw:Math.PI,outer:true,angle:Math.PI+.38},
      {mesh:inner,at:[x-width/2,lower,z],yaw:Math.PI/2,outer:false,angle:Math.PI-.09},
      {mesh:inner,at:[x+width/2,lower,z],yaw:-Math.PI/2,outer:false,angle:Math.PI+.14}
    ]};
  }

  function updateSupplyCrate(scene,dt,resupplying) {
    const rate=resupplying ? 1/.61 : -1/.43;
    scene.crate.open=clamp(scene.crate.open+rate*dt,0,1);
  }

  function build(renderer,{area,material:m,boundedMesh,boulder,stoneColliders,trees,stairs}) {
    const rng=random(44194),ground=new Builder();
    const pale=rgb(0xbdb19a),wood=rgb(0xa48765),post=rgb(0x73573e),dark=rgb(0x50473e);
    const blue=rgb(0x547884),maroon=rgb(0x90563f),amber=rgb(0xe0ad55);
    for(let z=-84;z<=84;z+=3) for(let x=-84;x<=84;x+=3) {
      const [px,,pz]=at(x,0,z),y=height(px,pz);
      const n=Valley.unit([height(px-.4,pz)-height(px+.4,pz),.8,height(px,pz-.4)-height(px,pz+.4)]);
      const tint=.91+.087*rng();
      ground.vertex([px,y,pz],n,[smooth(0,14,Math.max(Math.abs(x)-25,Math.abs(z)-22)),0],[tint,tint,tint]);
      const i=ground.vertices.length/11-1;
      if(x>-84 && z>-84) ground.indices.push(i-58,i-1,i-57,i-57,i-1,i);
    }
    const landscape=boundedMesh(renderer,ground,1);
    const yard=area(origin.x,origin.y,origin.z);
    for(const side of [-1,1]) {
      yard.box(m.wood,[side*halfWidth,.72,0],[.12,.12,halfLength*2],wood,{kind:"wall"});
      yard.box(m.wood,[0,.72,side*halfLength],[halfWidth*2,.12,.12],wood,{kind:"wall"});
      for(let z=-halfLength;z<=halfLength;z+=3.5) {
        yard.box(m.wood,[side*halfWidth,.54,z],[.13,1.10,.16],post,{radius:.015});
      }
      for(let x=-halfWidth;x<=halfWidth;x+=3.2) {
        yard.box(m.wood,[x,.54,side*halfLength],[.16,1.10,.13],post,{radius:.015});
      }
    }
    for(const [x,z,w,d] of paving) {
      yard.quad(m.paving,[[x-w/2,.012,z-d/2],[x-w/2,.012,z+d/2],[x+w/2,.012,z+d/2],[x+w/2,.012,z-d/2]],
        pale,[[0,0],[0,d],[w,d],[w,0]]);
    }
    // Picnic shelters and low timber features leave a loop around the raised walkway.
    for(const [x,z,yaw] of [[-6,1.5,.39],[6.2,-9.8,-.34],[-5.4,-11.2,-.61],[24.4,10.6,.59]]) {
      const [px,py,pz]=at(x,0,z),rack=area(px,py,pz,yaw);
      for(const y of [.23,.66,1.02]) rack.box(m.wood,[0,y,0],[3.4,.35,.40],times(wood,.86+rng()*.25),
        {radius:.067,kind:"wall"});
      for(const dx of [-1.40,1.40]) rack.box(m.wood,[dx,.60,.23],[.15,1.20,.19],post,{radius:.017});
      rack.done();
    }

    // Small granite islands divide the open yard while keeping the surrounding walkways connected.
    const islands=yard.mesh(m.rock);
    const granite=rgb(0xb0a998),moss=rgb(0x7e8262);
    for(const [x,z,rx,rz,h] of [[-10.4,-5.5,2.42,1.76,1.10],[6.9,6.9,2.18,1.75,.65],
      [10.9,-4.4,1.72,1.67,.92],[-27.0,-4.6,1.87,2.38,.74],[27.8,-7.5,1.84,2.18,1.09]]) {
      boulder(islands,rng,at(x,h*.23,z),[rx,h*.66,rz],rng()*1.8,granite,.12,stoneColliders);
      boulder(islands,rng,at(x+rx*.70,.14,z+rz*.38),[rx*.48,h*.35,rz*.54],rng(),moss,.10,stoneColliders);
      for(let i=0;i<22;i++) {
        const angle=rng()*6.28,r=mix(.86,1.26,rng());
        const px=x+Math.cos(angle)*rx*r,pz=z+Math.sin(angle)*rz*r;
        const blade=mix(.08,.35,rng());
        const tint=times(rgb(i%3 ? 0x637343 : 0x9c8e5c),mix(.82,1.16,rng()));
        yard.triangle(m.plain,[px-.026,.008,pz],[px+.033,.008,pz+.024],
          [px+Math.cos(angle)*blade*.42,blade,pz+Math.sin(angle)*blade*.40],tint);
      }
    }

    const deck=area(origin.x-16.5,origin.y,origin.z);
    deck.box(m.wood,[0,1.52,0],[4.08,.22,15.9],wood,{kind:"wood",stepBank:"outdoorWood"});
    for(let z=-7.9;z<7.9;z+=.27) {
      deck.box(m.wood,[0,1.627,z],[4.08,.036,.246],times(wood,.81+rng()*.26),{radius:.009});
    }
    for(const side of [-1,1]) {
      stairs(deck,0,side*12.32,0,side*7.83,2.64,0,1.63,m.wood,"outdoorWood");
      deck.box(m.wood,[side*1.97,2.36,0],[.11,.106,15.86],post,{kind:"wall"});
      for(const z of [-7.82,-5.24,-2.64,0,2.64,5.24,7.82]) {
        deck.box(m.wood,[side*1.97,1.15,z],[.16,2.47,.19],post,{radius:.019,kind:"wall"});
      }
    }
    deck.done();

    const shed=area(origin.x+17.7,origin.y,origin.z+.65);
    shed.box(m.wood,[0,.071,0],[9.2,.142,11.9],wood,{kind:"wood",stepBank:"outdoorWood"});
    for(const side of [-1,1]) {
      shed.quad(m.tile,[[0,3.48,-6.57],[0,3.48,6.57],[side*5.09,2.67,6.57],[side*5.09,2.67,-6.57]],
        blue,[[0,0],[0,13.14],[5.1,13.14],[5.1,0]]);
      for(const z of [-5.52,.2,5.52]) {
        shed.box(m.wood,[side*4.24,1.38,z],[.22,2.76,.23],post,{radius:.018,kind:"wall"});
      }
      shed.box(m.wood,[side*4.24,2.65,0],[.29,.22,12.2],wood);
      shed.box(m.wood,[side*3.80,.53,-2.69],[.61,.10,4.11],wood,{radius:.018,kind:"wall"});
    }
    for(let z=-5.64;z<=5.66;z+=1.25) shed.box(m.wood,[0,2.63,z],[8.71,.107,.15],dark);
    shed.done();

    const crate=buildSupplyCrate(renderer,area,m);
    const targets=targetDesigns.map(([x,y,z,yaw,radius,travel],id)=>{
      const [px,py,pz]=at(x,y,z),baseY=id===2 ? 1.63 : id===5 ? .142 : 0;
      const stand=area(px,origin.y,pz,yaw);
      const width=travel ? travel+.82 : .36;
      stand.box(m.wood,[0,y-.08,-.17],[width*2,.104,.16],post,{radius:.018});
      for(const x of [-width,width]) {
        stand.box(m.wood,[x,(baseY+y)*.5,-.18],[.093,y-baseY,.112],post,{radius:.012,kind:"wall"});
        stand.box(m.rock,[x,baseY+.036,-.18],[.27,.072,.25],pale,{radius:.018});
      }
      stand.done();
      return {x:px,y:py,z:pz,yaw,radius,travel,id,hitAt:null,s:Math.sin(yaw),c:Math.cos(yaw)};
    });
    yard.done();

    for(let i=0;i<82;i++) {
      const angle=2*Math.PI*i/82,band=mix(1.08,1.85,rng());
      const [x,,z]=at(Math.cos(angle)*halfWidth*band,0,Math.sin(angle)*halfLength*band);
      if(!contains(x,z)) trees(x,z,mix(4.5,10.4,rng()),rng);
    }
    function disc(colors) {
      const b=new Builder();
      for(const [radius,halfDepth,color] of [[1,.026,colors[0]],[.76,.029,colors[1]],[.49,.032,colors[2]],[.235,.035,colors[3]]]) {
        b.cylinder([0,0,-halfDepth],[0,0,halfDepth],radius,radius,color,36,true);
      }
      return renderer.mesh(b,m.plain);
    }
    return {landscape,targets,crate,ready:disc([dark,amber,pale,maroon]),marked:disc([post,blue,pale,rgb(0x7fa477)])};
  }

  function center(target,time) {
    const t=target.hitAt??time;
    const shift=target.travel*Math.sin(t*1.21+target.id*.82);
    return [target.x+target.c*shift,target.y,target.z-target.s*shift];
  }

  function trace(scene,from,to,limit,time) {
    const delta=minus(to,from);
    let best=null;
    for(const target of scene.targets) {
      if(target.hitAt!==null) continue;
      const p=center(target,time),{s,c,radius}=target;
      const approach=delta[0]*s+delta[2]*c;
      if(Math.abs(approach)<1e-7) continue;
      const fraction=((p[0]-from[0])*s+(p[2]-from[2])*c)/approach;
      if(fraction<0 || fraction>limit) continue;
      const at=plus(from,times(delta,fraction));
      const across=(at[0]-p[0])*c-(at[2]-p[2])*s;
      if(Math.hypot(across,at[1]-p[1])>radius) continue;
      limit=fraction;
      const side=approach<0 ? 1 : -1;
      best={type:"practice",target,fraction,at,normal:[side*s,0,side*c]};
    }
    return best;
  }

  function view(scene,time) {
    const models=scene.targets.map(target=>{
      const active=target.hitAt===null,p=center(target,time);
      const hinge=active ? 0 : smooth(0,.32,time-target.hitAt)*.83;
      return {mesh:active ? scene.ready : scene.marked,matrix:transform(p,hinge,target.yaw,0,target.radius)};
    });
    for(const flap of scene.crate.flaps) {
      // The outer flaps fold back first to clear the inner pair.
      const phase=flap.outer ? smooth(0,.65,scene.crate.open) : smooth(.37,1,scene.crate.open);
      models.push({mesh:flap.mesh,matrix:transform(flap.at,-flap.angle*phase,flap.yaw)});
    }
    return models;
  }

  Valley.practice={bounds,contains,inScene,height,paved,spawn,supply,build,trace,view,updateSupplyCrate};
})();
