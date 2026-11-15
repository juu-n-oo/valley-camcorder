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
      monitors:site.monitors.map(index).filter(id=>id>=0),
      breaches:[site.rim,site.upperWall?.rim].filter(Boolean).map(breach)
    };
  });
  const debris={glass:pack(world.road.interior.shards.glass),ceramic:pack(world.road.interior.shards.ceramic)};
  const floor=footingMap(V,world);
  const monitors=world.road.interior.monitors.filter(item=>index(item)>=0).map(item=>({id:index(item),views:item.cameras.map(
    camera=>({at:camera.at,forward:camera.forward}))}));
  const tents=world.tents.filter(item=>index(item)>=0).map(item=>({id:index(item),...item.entry}));
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,"Fixtures.json"),
    JSON.stringify({fixtures,services,debris,floor,monitors,tents}).replaceAll('},{"id":','},\n{"id":'));
  fs.writeFileSync(path.join(folder,"Parts.valleymesh"),meshBundle(meshes,meshes.map((_,i)=>i)));
  console.log(`Exported ${fixtures.length} fixture links, ${services.length} service sites, and ${meshes.length} effects meshes.`);
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
