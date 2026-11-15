"use strict";

(() => {
  const {Builder,clamp,dot,mix,minus,plus,point,smooth,times,transform,unit}=Valley;
  const durations={surface:[3.8,6.2],fabric:[26,35],wood:[35,47],tree:[44,57]};
  const sourceRange=24, fireLimit=128, visibleLimit=11;
  const combustible=kind=>kind!=="surface";
  const fraction=n=>n-Math.floor(n);
  const distance=(a,b)=>Math.hypot(a[0]-b[0],(a[1]-b[1])*.75,a[2]-b[2]);
  const seedAt=([x,y,z])=>fraction(Math.sin(x*36.71+y*57.32+z*17.95)*17335.94);

  function exposedTimber(road,at) {
    const hit=Valley.roadview.trace(road,plus(at,[0,.072,0]),plus(at,[0,-.067,0]));
    return hit?.fixture?.timber ? hit.fixture : null;
  }

  function boxSurface(box,at) {
    const [u,v]=Valley.roadview.local(box,at[0],at[2]);
    const tall=box.top-box.bottom>.42;
    const faceX=Math.abs(u)-box.hx>Math.abs(v)-box.hz;
    const width=Math.min(.86,(tall && faceX ? box.hz : box.hx)*.86);
    const height=Math.min(1.06,(tall ? (box.top-box.bottom)*.5 : box.hz)*.86);
    let x=clamp(u,-box.hx+width,box.hx-width),z=clamp(v,-box.hz+height,box.hz-height);
    let y=box.top+.009, normal=[0,1,0];
    if(tall) {
      y=clamp(at[1]-.08,box.bottom+height,box.top-height);
      if(faceX) {
        const side=Math.sign(u||1);
        x=side*(box.hx+.009);
        z=clamp(v,-box.hz+width,box.hz-width);
        normal=[side*box.c,0,-side*box.s];
      } else {
        const side=Math.sign(v||1);
        z=side*(box.hz+.009);
        normal=[side*box.s,0,side*box.c];
      }
    }
    return {at:[box.x+box.c*x+box.s*z,y,box.z-box.s*x+box.c*z],normal,width,height};
  }

  function rockSurface(rock,origin) {
    let nearest=null, best=5.7;
    for(const {a,ab,ac,normal} of rock.faces) {
      const at=plus(a,times(plus(ab,ac),1/3));
      if(dot(minus(origin,at),normal)<0) continue;
      const gap=distance(at,origin);
      if(gap>=best) continue;
      const size=Math.min(.40,Math.hypot(...ab)*.18,Math.hypot(...ac)*.18);
      nearest={at:plus(at,times(normal,.010)),normal,width:size,height:size};
      best=gap;
    }
    return nearest;
  }

  function groundSurface(road,x,z,reach,size) {
    const terrain=Valley.world, ground=terrain.height(x,z);
    const deck=Valley.roadview.floor(road,x,z,reach).top;
    const normal=deck>=ground ? [0,1,0] : unit([
      terrain.height(x-.24,z)-terrain.height(x+.24,z),.48,
      terrain.height(x,z-.24)-terrain.height(x,z+.24)
    ]);
    return {at:[x,Math.max(ground,deck)+.013,z],normal,width:size,height:size*.77};
  }

  function candidates(world,site) {
    const {at:origin,normal}=site, [x,y,z]=origin;
    const {road}=world, terrain=Valley.world;
    const spots=new Map();
    function add(at,kind,size,details={}) {
      const range=distance(at,origin);
      if(range>sourceRange || terrain.wetAt(at[0],at[2],at[1]-.025)) return;
      const key=details.structure??at.map(value=>Math.round(value/.86)).join(",");
      if(spots.has(key)) return;
      spots.set(key,{...details,at,key,kind,size,seed:seedAt(at),range});
    }
    for(const {at,kind,size,normal,priority} of site.fireSurfaces) {
      const structure=kind==="wood" && normal[1]>.8 ? exposedTimber(road,at) : null;
      add(at,kind,size,{blastSurface:true,priority,normal,structure,mark:{at,normal,width:size*.76,height:size*1.24}});
    }
    const sideways=[-normal[2],0,normal[0]];
    for(const [out,side,size] of [[.42,-.62,.67],[.88,1.25,.62],[2.25,-1.74,.54],[2.95,1.56,.45]]) {
      const at=plus(plus(origin,times(normal,out)),times(sideways,side));
      const mark=groundSurface(road,at[0],at[2],y+.36,size*1.48);
      add(mark.at,"surface",size,{blastSurface:true,mark});
    }
    for(const tree of world.fireTrees) {
      if(distance(tree.at,origin)>sourceRange) continue;
      const at=plus(tree.at,[0,.25,0]);
      const size=clamp(tree.height*.139,.50,1.21);
      const mark=groundSurface(road,at[0],at[2],at[1]+.07,size*1.32);
      add(at,"tree",size,{tree,mark});
    }
    const {material}=road.interior;
    const softMaterials=new Set([10,11,12,material.fabric,material.wallpaper,material.lobbyPrint]);
    function addProp(prop,priority=false) {
      if(prop.broken || prop.picked || Math.hypot(prop.x-x,prop.z-z)>sourceRange) return;
      const wooden=prop.parts.some(part=>part.material===material.wood || part.material===material.laminate);
      const soft=prop.parts.some(part=>softMaterials.has(part.material));
      const anchor=[0,Math.max(.055,prop.height*(wooden ? .90 : .68)),0];
      add(point(prop.matrix,anchor),wooden ? "wood" : soft ? "fabric" : "surface",
        clamp(Math.max(prop.rx,prop.rz)*.67,.21,.71),{prop,anchor,blastSurface:priority,priority});
    }
    for(const prop of site.reception??[]) addProp(prop,true);
    for(const prop of world.props) addProp(prop);
    for(const box of Valley.roadview.boxesNear(road,x,z,sourceRange)) {
      const mark=boxSurface(box,origin), kind=box.hit==="wood" ? "wood" : "surface";
      if(kind==="surface" && distance(mark.at,origin)>8.8) continue;
      const structure=box.fixture?.timber ? box.fixture : null;
      if(structure && exposedTimber(road,mark.at)!==structure) continue;
      add(mark.at,kind,clamp((box.hx+box.hz)*.43,.25,.67),{mark,normal:mark.normal,structure});
    }
    for(const rock of world.colliders) {
      const {min,max}=rock;
      if(x<min[0]-5.7 || x>max[0]+5.7 || z<min[2]-5.7 || z>max[2]+5.7 || max[1]-min[1]<.15) continue;
      const mark=rockSurface(rock,origin);
      if(mark) add(mark.at,"surface",.35,{mark,normal:mark.normal});
    }
    return [...spots.values()].sort((a,b)=>a.range-b.range);
  }

  function startFire(fires,spot,start) {
    const {kind,seed,structure}=spot;
    const lifetime=mix(...durations[kind],seed);
    const fire={...spot,start,lifetime,tail:combustible(kind) ? 4.1 : 1.7};
    if(structure) fire.collapseAt=start+(structure.kind==="woodStair" ? mix(8,11,seed) : mix(10,14,seed));
    fires.push(fire);
    return fire;
  }

  function ignite(world,site,time,fires) {
    const remaining=Math.min(24,fireLimit-fires.length);
    if(remaining<=0) return;
    const used=new Set(fires.map(fire=>fire.key));
    const nearby=candidates(world,site).filter(spot=>!used.has(spot.key));
    const fuels=nearby.filter(spot=>combustible(spot.kind));
    let count=0;
    function start(spot,delay) {
      if(count>=remaining || used.has(spot.key)) return null;
      used.add(spot.key);
      count++;
      return startFire(fires,spot,time+delay);
    }

    const hard=nearby.filter(spot=>spot.kind==="surface" && spot.range<8.8);
    const surfaces=[...hard.filter(spot=>spot.blastSurface),...hard.filter(spot=>!spot.blastSurface).slice(0,3)];
    for(const spot of surfaces) start(spot,.30+spot.range*.14+spot.seed*.70);

    const first=[
      ...fuels.filter(spot=>spot.priority),
      ...fuels.filter(spot=>spot.blastSurface && !spot.priority),
      ...fuels.filter(spot=>spot.prop && !spot.priority && spot.range<11.2).slice(0,2),
      ...fuels.filter(spot=>!spot.blastSurface && !spot.prop && spot.range<9.2)
    ].slice(0,7);
    const tree=fuels.find(spot=>spot.kind==="tree" && spot.range<15);
    if(tree && !first.includes(tree)) first.push(tree);
    let front=first.map(spot=>start(spot,.62+spot.range*(spot.priority ? .10 : .32)+spot.seed*.69)).filter(Boolean);
    // Later patches are reached by burning neighbours. The brief surface flames do not spread.
    for(let pass=0;pass<2 && front.length && count<remaining;pass++) {
      const neighbours=[];
      for(const spot of fuels) {
        if(used.has(spot.key)) continue;
        let delay=Infinity;
        for(const source of front) {
          const gap=distance(spot.at,source.at);
          if(gap<.92 || gap>(source.kind==="tree" ? 6.9 : 5.2)) continue;
          delay=Math.min(delay,source.start-time+2.8+gap*.57+spot.seed*.68);
        }
        if(Number.isFinite(delay)) neighbours.push({spot,delay});
      }
      neighbours.sort((a,b)=>a.delay-b.delay);
      const next=neighbours.slice(0,4), tree=neighbours.find(({spot})=>spot.kind==="tree");
      if(tree && !next.includes(tree)) next[next.length-1]=tree;
      front=next.map(({spot,delay})=>start(spot,delay)).filter(Boolean);
    }
  }

  function spreadToTimber(world,fires,source,time) {
    const {road}=world, generation=source.timberSpread??0;
    if(fires.length>=fireLimit || generation>=2 || source.prop?.picked) return;
    const origin=source.prop ? point(source.prop.matrix,source.anchor) : source.at;
    if(Valley.world.wetAt(origin[0],origin[2],origin[1]-.022)) return;
    const [x,y,z]=origin;
    const reach=.94+source.size*.62, from=plus(origin,[0,.105,0]);
    const burning=new Set(fires.map(fire=>fire.structure));
    let closest=null, nearest=reach;
    for(const box of Valley.roadview.boxesNear(road,x,z,reach)) {
      const structure=box.fixture, lift=box.top+.016-y;
      if(!structure?.timber || burning.has(structure) || lift<-.74 || lift>1.06) continue;
      const [u,v]=Valley.roadview.local(box,x,z);
      const a=clamp(u,-box.hx+.028,box.hx-.028), b=clamp(v,-box.hz+.028,box.hz-.028);
      const gap=Math.hypot(a-u,lift*.95,b-v);
      if(gap>=nearest) continue;
      const at=[box.x+box.c*a+box.s*b,box.top+.016,box.z-box.s*a+box.c*b];
      if(exposedTimber(road,at)!==structure || Valley.world.wetAt(at[0],at[2],at[1]-.022)) continue;
      if(Valley.roadview.trace(road,from,plus(at,[0,.048,0]))) continue;
      closest={at,key:structure,structure,kind:"wood",size:clamp((box.hx+box.hz)*.56,.54,.86),seed:seedAt(at),
        normal:[0,1,0],timberSpread:generation+1};
      nearest=gap;
    }
    if(closest) {
      startFire(fires,closest,time+.22);
      source.timberCheckAt=Infinity;
    }
  }

  function leaveScorch(scene,fire) {
    if(fire.structure) {
      fire.structure.charred=true;
      return;
    }
    if(fire.prop) {
      fire.prop.charred=true;
      return;
    }
    if(!fire.mark || scene.scorches.has(fire.key)) return;
    const {at,normal,width,height}=fire.mark;
    if(width<.03 || height<.03) return;
    if(fire.tree?.trunk) {
      const {root,tip,base,end,sides}=fire.tree.trunk;
      const fraction=mix(.48,.78,fire.seed);
      const bark=new Builder();
      bark.cylinder([0,0,0],times(minus(tip,root),fraction),base+.009,mix(base,end,fraction)+.009,[1,1,1],sides,false);
      scene.scorches.set(fire.key+":bark",{at:root,matrix:transform(root),mesh:scene.renderer.mesh(bark,scene.material.scorchedBark)});
    }
    if(!scene.scorchMesh) {
      const decal=new Builder();
      decal.quad([[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],[1,1,1],[0,0,1],[[0,0],[1,0],[1,1],[0,1]]);
      scene.scorchMesh=scene.renderer.mesh(decal,scene.material.scorch);
    }
    const matrix=transform(at,-Math.asin(clamp(normal[1],-1,1)),Math.atan2(normal[0],normal[2]));
    for(let i=0;i<3;i++) {
      matrix[i]*=width;
      matrix[i+4]*=height;
    }
    scene.scorches.set(fire.key,{at,matrix,mesh:scene.scorchMesh});
  }

  function update(world,fires,time,collapse) {
    for(let i=fires.length-1;i>=0;i--) {
      const fire=fires[i], age=time-fire.start;
      if(fire.prop?.broken || fire.structure?.broken || age>=fire.lifetime+fire.tail) {
        fires.splice(i,1);
        continue;
      }
      if(!fire.scorched && age>=(fire.structure ? 2.6 : .46)) {
        leaveScorch(world.road.interior,fire);
        fire.scorched=true;
      }
      if(age>=fire.lifetime) continue;
      if(fire.structure && time>=fire.collapseAt) {
        fire.structure.broken=true;
        fires.splice(i,1);
        collapse(fire.structure,fire.at);
      } else if(time>=(fire.timberCheckAt??fire.start+1.65) && (fire.timberSpread??0)<2) {
        fire.timberCheckAt=time+1.18;
        spreadToTimber(world,fires,fire,time);
      }
    }
  }

  function scorchVisuals(scene,cam,output) {
    for(const mark of scene.scorches.values()) {
      if(Math.hypot(...minus(mark.at,cam.at))<47) output.push(mark);
    }
  }

  function strength(fire,age) {
    const {lifetime,kind}=fire;
    if(age<0 || age>=lifetime) return 0;
    if(!combustible(kind)) return smooth(0,.46,age)*(1-smooth(lifetime*.48,lifetime,age));
    return (.24*smooth(0,.70,age)+.76*smooth(.4,lifetime*.31,age))*(1-smooth(lifetime*.66,lifetime,age));
  }

  function visuals(fires,time,cam,output) {
    if(!fires.length) return null;
    const {at:eye,axes,forward,frustum:[horizontal,vertical]}=cam;
    const right=axes.subarray(0,3), up=axes.subarray(3,6), visible=[];
    let light=null, brightest=0;
    for(const fire of fires) {
      const age=time-fire.start;
      if(age<0 || fire.prop?.picked || fire.prop?.broken) continue;
      const at=fire.prop ? point(fire.prop.matrix,fire.anchor) : fire.at;
      if(fire.prop && at[1]<=Valley.world.waterLevel(at[0],at[2])+.02) continue;
      const delta=minus(at,eye), range=Math.hypot(...delta);
      if(range>86) continue;
      const power=strength(fire,age), glow=power*fire.size/(1+range*.12);
      if(glow>brightest && range<24) {
        brightest=glow;
        light=[at[0],at[1]+fire.size*.82,at[2],power*(.23+.05*Math.sin(time*16+fire.seed*53))];
      }
      const radius=fire.tree ? fire.tree.height*.58+2 : fire.size*4.8+1.3;
      const offset=plus(delta,[0,radius*.43,0]), depth=dot(offset,forward);
      if(depth<-radius || Math.abs(dot(offset,right))>depth*horizontal+radius*Math.hypot(1,horizontal)
        || Math.abs(dot(offset,up))>depth*vertical+radius*Math.hypot(1,vertical)) continue;
      visible.push({fire,at,age,power,range});
    }
    visible.sort((a,b)=>a.range-b.range);
    for(const {fire,at,age,power,range} of visible.slice(0,visibleLimit)) {
      const {size,seed,tree,tail}=fire, fuel=combustible(fire.kind);
      function plume(center,alpha,scale,variation,kind,t) {
        if(alpha>.012) output.push({at:center,alpha,size:scale,seed:variation,kind,t,depth:dot(minus(center,eye),forward)});
      }
      if(power>0) {
        const count=range>32 ? 3 : fuel ? 6 : 4;
        for(let i=0;i<count;i++) {
          const variation=fraction(seed+i*.618), phase=fraction(age*(1.15+variation*.48)+i/count);
          const angle=variation*6.283+age*.23;
          const width=size*(.18+power*.50)*(.40+variation*.60);
          const climb=tree ? tree.height*.37*power*(i/count)**1.52 : 0;
          const rise=size*(.32+power*1.42)*phase+climb;
          const lean=tree ? climb/tree.height : 0;
          const center=[at[0]+Math.cos(angle)*width+(tree?.leanX??0)*lean,at[1]+rise,
            at[2]+Math.sin(angle)*width+(tree?.leanZ??0)*lean];
          const alpha=power*(.71+.21*variation)*smooth(0,.16,phase)*(1-smooth(.54,1,phase));
          plume(center,alpha,size*(.45+power*.67)*mix(.56,1.18,phase),variation,3,phase);
        }
      }
      const count=range>34 ? 2 : fuel ? 4 : 2;
      for(let i=0;i<count;i++) {
        const travel=fraction(age/tail+i/count+seed*.2)*tail, t=travel/tail;
        const heat=strength(fire,age-travel-.13);
        if(heat<=0) continue;
        const variation=fraction(seed+i*.367);
        const drift=travel*(.23+.10*Math.sin(at[2]*.12)), away=.11+travel*.30;
        const climb=tree ? tree.height*.24*heat : 0;
        const center=[at[0]+drift+Math.sin(travel+variation*6)*size*.32+(fire.normal?.[0]??0)*away,
          at[1]+size*.56+climb+travel*(fuel ? .97 : .64),at[2]+travel*.14+(variation-.5)*size*.65+(fire.normal?.[2]??0)*away];
        const alpha=heat*smooth(0,.14,t)*(1-smooth(.43,1,t))*(fuel ? .74 : .39);
        plume(center,alpha,size*mix(.72,2.14,t)*(.65+heat*.58),variation,1,t);
      }
    }
    return light;
  }

  Valley.fire={ignite,update,visuals,scorchVisuals};
})();
