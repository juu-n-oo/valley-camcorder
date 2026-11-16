"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const meshBundle=require("./mesh-bundle.cjs");

function exportInteractions(folder,V,world,items,owners) {
  const meshes=[], known=new Map();
  const unit=mesh=>{
    if(!known.has(mesh)){known.set(mesh,meshes.length);meshes.push(mesh);}
    return known.get(mesh);
  };
  const pack=rows=>rows?.map(unit)??[];
  const index=item=>owners.get(item)??-1;
  const allBoxes=new Set(Array.from(world.road.cells.values()).flat());
  function breach(item) {
    if(!item) return null;
    return {at:Array.from(item.matrix),meshes:pack(item.meshes),
      boxes:[...allBoxes].filter(box=>box.fixture===item && !box.noWalk).map(box=>({
        at:[box.x,(box.top+box.bottom)*.5,box.z],
        size:[box.hx*2,box.top-box.bottom,box.hz*2],yaw:Math.atan2(box.s,box.c)
      }))};
  }
  const fixtures=items.flatMap((item,id)=>{
    const {kind,use,grip,plumbing,lampAt,flameAt,sparkAt,effects,flow,flowAt}=item;
    if(!use && !plumbing && !lampAt) return [];
    const label=kind==="door" && item.window ? "WINDOW" : item.side??"";
    return [{id,label,valve:index(item.valve),
      useAt:use ? [use.x,(use.top+use.bottom)*.5,use.z] : null,
      useSize:use ? [use.hx*2,use.top-use.bottom,use.hz*2] : null,
      lampAt,flameAt,sparkAt,flowAt,flame:pack(effects?.flames),spark:pack(effects?.sparks),flow:pack(flow),
      leakAt:plumbing?.at,leakVelocity:plumbing?.velocity,remnant:pack(plumbing?.remnant),grip:grip?.at}];
  });
  const services=world.road.services.map(site=>{
    const lights=site.items.filter(item=>item.kind==="light").sort((a,b)=>distance(a.lampAt,site.at)-distance(b.lampAt,site.at));
    return {radius:site.blastRadius,at:site.at,tank:index(site.tank),
      collapse:[site.tank,site.stand,site.fittings,site.intact,site.upperWall?.intact,...site.stairs].map(index).filter(id=>id>=0),
      fixtures:site.items.map(index).filter(id=>id>=0),
      lights:lights.slice(0,Math.max(1,Math.ceil(lights.length*.4))).map(index).filter(id=>id>=0),
      monitors:site.monitors.map(index).filter(id=>id>=0), fragments:pack(site.debris),
      alarms:site.alarms.map(alarm=>({at:alarm.at,mesh:unit(alarm.mesh)})),
      sprinklers:site.sprinklers.map(({at,bottom,spread})=>({at,bottom,spread})),
      surfaces:site.fireSurfaces.map(({at,normal,kind,size,priority})=>({at,normal,kind,size,priority:!!priority})),
      reception:(site.reception??[]).map(index).filter(id=>id>=0),
      breaches:[site.rim,site.upperWall?.rim].filter(Boolean).map(breach)
    };
  });
  const debris={glass:pack(world.road.interior.shards.glass),ceramic:pack(world.road.interior.shards.ceramic)};
  const floor=footingMap(V,world);
  const monitors=world.road.interior.monitors.filter(item=>index(item)>=0).map(item=>({id:index(item),views:item.cameras.map(
    camera=>({at:camera.at,forward:camera.forward}))}));
  const tents=world.tents.filter(item=>index(item)>=0).map(item=>({id:index(item),...item.entry,
    ramp:item.ramp?[item.ramp.start,item.ramp.end,item.ramp.landing,item.ramp.width,item.ramp.base]:null}));
  const props=world.props.filter(item=>index(item)>=0 && (item.support||item.installed||item.surface||item.fragile||item.kind==="tube"))
    .map(item=>({id:index(item),parent:index(item.installed?.parent??item.support?.table),mounted:!!item.installed,
      surface:item.surface?[item.surface.top,item.surface.rx,item.surface.rz]:null,fragile:!!item.fragile,health:item.hp??0,
      air:item.air??0}));
  const wheels=items.filter(item=>item.tire&&index(item.hub)>=0)
    .map(item=>({id:index(item),hub:index(item.hub)}));
  const vehicles=world.road.interior.vehicles.map(({at,yaw})=>({at,yaw}));
  const trees=(world.fireTrees??[]).filter(({at,trunk})=>trunk && services.some(site=>distance(at,site.at)<24))
    .map(({at,height,trunk})=>{
      const {root,tip,base,end,sides}=trunk;
      const bark=new V.Builder(), cap=.67;
      bark.cylinder([0,0,0],V.times(V.minus(tip,root),cap),base+.009,V.mix(base,end,cap)+.009,
        V.rgb(0x292621),sides,false);
      return {at,root,height,mesh:unit({shape:bark,material:38})};
    });
  const places=locationData(V,world.road.layout);
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,"Fixtures.json"),
    JSON.stringify({fixtures,services,debris,floor,monitors,tents,props,wheels,vehicles,trees,places}).replaceAll('},{"id":','},\n{"id":'));
  fs.writeFileSync(path.join(folder,"Parts.valleymesh"),meshBundle(meshes,meshes.map((_,i)=>i)));
  console.log(`Exported ${fixtures.length} fixture links, ${services.length} service sites, and ${meshes.length} effects meshes.`);
}

function locationData(V,layout) {
  const rooms=layout.buildings.map(b=>({name:b.name,at:[b.x,b.y,b.z],yaw:b.yaw,width:b.w,depth:b.d,storeys:b.storeys}));
  const bridges=[layout.bridge,layout.lowerBridge].map(b=>({name:b.name,at:[b.x,b.y,b.z],yaw:b.yaw,
    width:b.span,depth:b.half*2,storeys:1}));
  const zones=layout.zones.map(([x,z,rx,rz,name])=>({name,at:[x,0,z],width:rx*2,depth:rz*2}));
  const names=[["main","HWAYANGDONG ROAD"],["approach","BRIDGE APPROACH"],["foot","AMSEOJAE TRAIL"],
    ["beyond","SOUTH CROSSING"],["templeRoad","CHAEUNAM ROAD"],["crossTrail","FOREST TRAIL"]];
  const routes=names.map(([route,name])=>{
    const path=layout[route], count=Math.ceil((path.max-path.min)/2)+1;
    const points=Array.from({length:count},(_,i)=>{
      const {x,z}=path.at(V.mix(path.min,path.max,i/(count-1)));
      return [x,-z];
    }).flat();
    return {name,radius:path.half+.3,points};
  });
  return {level:V.roadLayout.storeyHeight,rooms,bridges,zones,routes};
}

function footingMap(V,world) {
  const {left,right,far,near}=V.roadLayout.bounds;
  const step=2.5, width=Math.ceil((right-left)/step)+1,height=Math.ceil((near-far)/step)+1;
  const labels=["dirtLeaf","outdoorStone","asphalt","outdoorWood","indoorStone","grass","lawn"];
  const samples=Buffer.alloc(width*height);
  for(let row=0;row<height;row++) for(let col=0;col<width;col++) {
    const x=left+col*step,z=far+row*step;
    if(!V.roadLayout.within(x,z)) continue;
    const footing=V.world.footing(world,x,z,V.world.height(x,z));
    let label=footing.stepBank;
    if(!label && footing.kind==="sand") {
      const grass=V.world.grassContact(world,x,z);
      if(grass.touch>.13) label=grass.tall>.13 ? "grass" : "lawn";
    }
    if(footing.kind==="rock" && !label) label="outdoorStone";
    const index=labels.indexOf(label);
    if(index>0) samples[row*width+col]=index;
  }
  return {left,far,step,width,height,labels,values:samples.toString("base64")};
}

function distance(a,b) {
  return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
}

function exportFixtureRecordings(root,destination) {
  const context=vm.createContext({Valley:{}});
  for(const file of ["brittle-audio.js","blast-audio.js"])
    vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
  const {brittleAudio,explosionAudio}=context.Valley;
  fs.mkdirSync(destination,{recursive:true});
  for(const [label,clips] of Object.entries({...brittleAudio,blast:explosionAudio})) {
    for(const [i,source] of clips.entries()) {
      const wav=Buffer.from(source,"base64");
      if(wav.toString("ascii",0,4)!=="RIFF") throw Error("Invalid fixture recording "+label);
      fs.writeFileSync(path.join(destination,label+"-"+i+".wav"),wav);
    }
  }
}

module.exports={exportInteractions,exportFixtureRecordings};
