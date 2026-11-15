"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const meshBundle = require("./mesh-bundle.cjs");
const {exportInteractions,exportFixtureRecordings} = require("./interactions-export.cjs");
const { createCanvas } = require("@napi-rs/canvas");
const sharp = require("sharp");

const root = path.resolve(__dirname, "../..");
const interactionsOnly=process.argv[2]==="--interactions";
const destination = process.argv[2] && !interactionsOnly ? path.resolve(process.argv[2]) : path.join(root,"unity","Assets","Valley","Source");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const context = vm.createContext({ atob, document: { createElement: () => createCanvas(1, 1) } });
function load(file) { vm.runInContext(read(file), context, {filename:file}); }
const scripts = Array.from(read("index.html").matchAll(/<script defer src="([^"]+)"/g), m => m[1]);
for (const file of scripts) {
  if (file === "game.js") break;
  if (!/^(?:animation|character|movement-sound|first-person|spiral|rifle)/.test(file)) load(file);
}
const V = vm.runInContext("Valley", context);
const spawn = vm.runInContext("((terrain)=>(" + read("game.js").match(/const spawn = (\{[^\r\n]+\});/)[1] + "))(Valley.world)", context);
const names = ["Meshes", "Textures", "Recorded"];
const scratch = path.join(root,".tmp");
fs.mkdirSync(scratch,{recursive:true});
const out=fs.mkdtempSync(path.join(scratch,"unity-export-"));
process.on("exit",()=>{
  for(const name of names){
    const group=path.join(out,name);
    if(!fs.existsSync(group))continue;
    for(const file of fs.readdirSync(group))fs.unlinkSync(path.join(group,file));
    fs.rmdirSync(group);
  }
  const manifest=path.join(out,"World.json");
  if(fs.existsSync(manifest))fs.unlinkSync(manifest);
  fs.rmdirSync(out);
});
for (const name of names) fs.mkdirSync(path.join(out, name), {recursive:true});

const known = new Map();
const meshes = [];
const renderer = {
  mesh(shape, material) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i=0;i<shape.vertices.length;i+=11) {
      for (let k=0;k<3;k++) {
        min[k]=Math.min(min[k],shape.vertices[i+k]);
        max[k]=Math.max(max[k],shape.vertices[i+k]);
      }
    }
    return {shape,material,bounds:{min,max}};
  },
  texture: canvas => canvas
};

function meshId(mesh) {
  if (known.has(mesh)) return known.get(mesh);
  if (!mesh.shape.indices.length) return -1;
  const id = meshes.length;
  known.set(mesh,id);
  meshes.push(mesh);
  return id;
}
const meshIds = list => list.map(meshId).filter(id=>id>=0);
const pos = list => Array.from(list, value=>Math.round(value*100000)/100000);
const matrix = item => pos(item.matrix);
const world = V.world.build(renderer);
const layout = world.road.layout;
console.log("World geometry captured. Preparing facilities and collisions.");

const objects = [];
const owners = new Map();
const sourceFixtures = [];
function fixture(item) {
  const meshes = meshIds(item.meshes);
  if (item.broken || (!meshes.length && !item.use)) return;
  const { kind, grip } = item;
  const entry = {
    kind, label:item.car ? "Sonata " + (item.label || kind) : kind,
    meshes, matrix:matrix(item), swing:item.swing || 0, slide:item.slide || 0,
    pitch:item.pitch||0, travel:item.move ? pos(item.move) : null,
    open:item.value >= .5, locked:!!item.locked || (kind==="carDoor" && !!item.car?.locked)
      || (kind==="carLid" && item.latch<1),
    grip:grip?.at ? pos(grip.at) : null, useSize:item.use ? [item.use.hx*2,item.use.top-item.use.bottom,item.use.hz*2] : null,
    on:!!item.on, hp:item.hp||0, car:item.car ? world.road.interior.vehicles.indexOf(item.car) : -1
  };
  if (item.base) entry.closed = pos(item.base);
  owners.set(item, objects.length);
  objects.push(entry);
  sourceFixtures.push(item);
}
for (const item of world.road.interior.items) fixture(item);
for (const [index,item] of sourceFixtures.entries()) {
  objects[index].parent=owners.get(item.parent)??-1;
  objects[index].door=owners.get(item.door)??-1;
  objects[index].pane=owners.get(item.pane)??-1;
}
const portable = new Set(["chair","table","tube","cup","box","flask","crt","plate","cushion","tumbler","jar","bowl",
  "pitcher","tray","pot","utensils","pamphlet","document","key","ledger","ashtray","lighter"]);
for (const item of world.props) {
  if (item.picked || item.broken) continue;
  const meshes = meshIds(item.parts.map(part=>part.mesh));
  if (!meshes.length) continue;
  owners.set(item,objects.length);
  objects.push({kind:item.kind,label:item.kind,meshes,matrix:matrix(item),portable:portable.has(item.kind),
    mass:item.mass || 1,size:[item.rx*2,item.height,item.rz*2], small:!!item.small, car:-1, door:-1, pane:-1,
    parent:owners.get(item.installed?.parent)??-1, grip:item.gripAnchors?.[0] ? pos(item.gripAnchors[0].at) : null});
}

const resources=path.join(path.dirname(destination),"Resources");
exportInteractions(path.join(resources,"ValleyMap"),V,world,sourceFixtures,owners);
exportFixtureRecordings(root,path.join(resources,"ValleyFixtureAudio"));
if(interactionsOnly) process.exit(0);

const unique = new Set(Array.from(world.road.cells.values()).flat());
const boxes = [...unique].filter(box=>!box.noWalk && !box.fixture?.broken && box.top>box.bottom).map(box=>({
  at:pos([box.x,(box.top+box.bottom)*.5,box.z]), size:pos([box.hx*2,box.top-box.bottom,box.hz*2]),
  yaw:Math.atan2(box.s,box.c), owner:owners.get(box.fixture)??-1,
  bank:box.stepBank || (box.kind==="wood" ? "outdoorWood" : box.kind==="rock" ? "outdoorStone" : "indoorStone"),
  stair:box.stair||0
}));

function proxy(kind, rows) {
  const tiles = new Map();
  for (const {faces,min,max} of rows) {
    const x=(min[0]+max[0])/2, z=(min[2]+max[2])/2;
    if(!V.roadLayout.within(x,z))continue;
    const key=[Math.floor(x/36),Math.floor(z/36)].join("/");
    if (!tiles.has(key)) tiles.set(key, new V.Builder());
    const shape=tiles.get(key);
    for (const {a,ab,ac} of faces) shape.triangle(a,V.plus(a,ab),V.plus(a,ac));
  }
  return [...tiles.values()].map(shape=>meshId(renderer.mesh(shape,kind)));
}

const ranges = V.roadLayout.bounds, practice = V.practice.bounds;
const stone=proxy(2,world.colliders), trunks=proxy(3,world.woodColliders);
const solids=meshIds(world.solid), water=meshIds(world.water), glass=meshIds(world.road.glass);
const toy=V.launcher.build(renderer);
const motor= { powered:true,position:1,angle:0,switching:null,pending:false };
const loadout = V.launcher.resting ? V.launcher.resting(toy) :
  V.launcher.looseLauncher(toy,V.transform([0,0,0]),{cars:[0,1,2,3,4],belt:0},motor,1);
const launcher = {
  parts:loadout.opaque.map(part=>({mesh:meshId(part.mesh),matrix:pos(part.matrix??V.transform([0,0,0]))})),
  glass:loadout.glass ? [{mesh:meshId(loadout.glass.mesh),matrix:pos(loadout.glass.matrix)}] : [],
  cars:meshIds(toy.cars)
};
const sleeve=meshId(renderer.mesh(V.blenderAssets.get("sleeve").parts[0].shape,16));
const practiceScene=world.road.practice;
const rangeTargets=practiceScene.targets.map(({x,y,z,yaw,radius,travel})=>({at:[x,y,z],yaw,radius,travel}));
const targetFaces=meshIds([practiceScene.ready,practiceScene.marked]);
const data={
  format:1, solids, water, glass, stone, trunks, objects, boxes, launcher, sleeve, rangeTargets, targetFaces,
  spawn:[spawn.x,V.world.height(spawn.x,spawn.z),spawn.z,spawn.yaw,spawn.pitch],
  rangeSpawn:[V.practice.spawn.x,V.practice.height(V.practice.spawn.x,V.practice.spawn.z),V.practice.spawn.z],
  rangeBounds:[practice.left,practice.right,practice.far,practice.near],
  fieldBounds:[ranges.left,ranges.right,ranges.far,ranges.near],
  limits:V.roadLayout.barriers.map(({q,side,minimumZ})=>({x:q.x,z:q.z,nx:q.nx,nz:q.nz,side,minZ:minimumZ??-5000})),
  weir:V.roadLayout.weir,
  bridges:[layout.bridge,layout.lowerBridge].map(bridge=>[bridge.x,bridge.y,bridge.z]),
  landmarks:layout.buildings.map(({id,name,x,y,z,yaw})=>({id,name,at:[x,y,z],yaw})),
  river:Array.from({length:241},(_,i)=>{
    const z=-520+i*5;
    return {z,left:V.roadLayout.bank(z,-1),right:V.roadLayout.bank(z,1)};
  })
};
fs.writeFileSync(path.join(out,"World.json"), JSON.stringify(data));

const groups = [];
const batchBudget=260000;
let group=[],vertices=0;
for (let id=0;id<meshes.length;id++) {
  const mesh=meshes[id], size=mesh.shape.vertices.length/11;
  if(group.length && vertices+size>batchBudget) { groups.push(group); group=[]; vertices=0; }
  group.push(id);vertices+=size;
}
if(group.length) groups.push(group);

const meshFolder=path.join(out,"Meshes");
let total=0;
for(const [i,ids] of groups.entries()) {
  const name="Meshes-"+String(i).padStart(3,"0")+".valleymesh";
  const payload=meshBundle(meshes,ids);
  fs.writeFileSync(path.join(meshFolder,name),payload);
  total+=payload.length;
}

const image = uri => sharp(Buffer.from(uri.split(",")[1],"base64"));
const textureFile = name => path.join(out,"Textures",name+".png");
async function splitAtlas(uri, names) {
  const src=image(uri), {width,height}=await src.metadata(), w=width/2, h=height/2;
  if(!Number.isInteger(w)||!Number.isInteger(h))throw Error("Invalid Valley texture atlas dimensions");
  await Promise.all(names.map((name,i)=>src.clone().extract({
    left:i%2*w,top:Math.floor(i/2)*h,width:w,height:h
  }).png().toFile(textureFile(name))));
}
async function writeTextures() {
  const textures=context.ValleyTextures;
  await Promise.all([
    splitAtlas(textures.location,["Gravel","Granite","ForestFloor","Bark"]),
    splitAtlas(textures.finishes,["Timber","Plaster","Brick","Ceramic"]),
    splitAtlas(textures.camcorder,["Canvas","Vinyl","Skin","Plastic"])
  ]);
  const leaves=await image(textures.foliage).resize(1024,512).ensureAlpha().raw().toBuffer();
  let holes=false, solid=false;
  for(let i=3;i<leaves.length;i+=4) {
    holes ||= leaves[i]<40;
    solid ||= leaves[i]>220;
  }
  if(!holes||!solid)throw Error("The summer canopy needs both foliage pixels and cutouts");
  await sharp(leaves,{raw:{width:1024,height:512,channels:4}}).png().toFile(textureFile("Leaves"));
  fs.writeFileSync(textureFile("RoadSigns"),renderer.roadLabels.toBuffer("image/png"));
}

function writeClip(name, src, sourceFrame, frames) {
  let offset=12, format, data;
  while(offset+8<=src.length) {
    const tag=src.toString("ascii",offset,offset+4), size=src.readUInt32LE(offset+4);
    const range=src.subarray(offset+8,offset+8+size);
    if(tag==="fmt ") format=range;
    if(tag==="data") data=range;
    offset+=8+size+(size%2);
  }
  if(!format||!data||format.readUInt16LE(0)!==1) throw Error("Expected PCM audio for "+name);
  const alignment=format.readUInt16LE(12);
  const clip=data.subarray(sourceFrame*alignment,(sourceFrame+frames)*alignment);
  const header=Buffer.alloc(28+format.length);
  header.write("RIFF",0);header.writeUInt32LE(header.length+clip.length-8,4);
  header.write("WAVEfmt ",8);header.writeUInt32LE(format.length,16);
  format.copy(header,20);header.write("data",20+format.length);header.writeUInt32LE(clip.length,24+format.length);
  fs.writeFileSync(path.join(out,"Recorded",name+".wav"),Buffer.concat([header,clip]));
}
const banks=["movement","outdoorStone","outdoorWood","indoorStone","dirtLeaf","woodStair","stoneStair","breathing","grass","lawn"];
for(const name of banks) {
  const bank=V[name+"Audio"];
  if(!bank)continue;
  const audio=Buffer.from(bank.wav,"base64");
  for(const [kind,samples] of Object.entries(bank.clips)) {
    samples.slice(0,5).forEach(([frame,length],i)=>writeClip(kind+"-"+i,audio,frame,length));
  }
}
for(const [kind,encoded] of Object.entries(V.supplyAudio??{})){
  const src=Buffer.from(encoded.split(",").at(-1),"base64");
  if(src.toString("ascii",0,4)==="RIFF")fs.writeFileSync(path.join(out,"Recorded","supply-"+kind+".wav"),src);
}

writeTextures().then(()=>{
  // Keep the previous Unity source intact until geometry, images and recordings are all encoded.
  for(const name of names) {
    const from=path.join(out,name), to=path.join(destination,name);
    fs.mkdirSync(to,{recursive:true});
    const files=fs.readdirSync(from), next=new Set(files);
    for(const file of files) fs.renameSync(path.join(from,file),path.join(to,file));
    if(name!=="Meshes")continue;
    for(const file of fs.readdirSync(to)){
      if(/^Meshes-\d{3}\.valleymesh$/.test(file)&&!next.has(file)) {
        fs.unlinkSync(path.join(to,file));
        if(fs.existsSync(path.join(to,file+".meta")))fs.unlinkSync(path.join(to,file+".meta"));
      }
    }
  }
  fs.renameSync(path.join(out,"World.json"),path.join(destination,"World.json"));
  console.log(`Exported ${meshes.length} meshes across ${groups.length} bundles (${(total/1e6).toFixed(1)} MB), ${objects.length} fixtures and props, and ${boxes.length} collision boxes.`);
}).catch(error=>{console.error(error);process.exitCode=1;});
