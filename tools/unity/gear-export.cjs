"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const meshBundle = require("./mesh-bundle.cjs");

const root = path.resolve(__dirname, "../..");
const output = process.argv[2] || path.join(root, "unity/Assets/Valley/Resources/ValleyGear");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const context = vm.createContext({atob});
for (const file of ["render.js", "blender-models.js", "blender-assets.js", "launcher.js", "rifle.js", "spiral.js", "practice.js"])
  vm.runInContext(read(file), context, {filename: file});
const V = vm.runInContext("Valley", context);
const {launcher, rifle, spiral, practice, transform, multiply, point} = V;
const identity = transform([0,0,0]);
const motionless = {slide:0,lift:0,twist:0};
const stillWater = {amount:0,power:0,phase:0};
const rate = 30;
const zero = [0,0,0,0,0,1,0,1,0,0];
const meshes = [];
const ids = new Map();
const renderer = {mesh: (shape, material) => ({shape, material})};
function id(mesh) {
  if (!mesh) return -1;
  if (!ids.has(mesh)) {
    if (!mesh.shape.indices.length) throw Error("Empty equipment mesh");
    ids.set(mesh, meshes.length);
    meshes.push(mesh);
  }
  return ids.get(mesh);
}

// Both the world and equipment imports reflect across Z. Store position, forward,
// up and uniform scale so Unity can interpolate rotations as quaternions.
const round = value => Math.round(value*100000)/100000;
function pose(matrix) {
  if (!matrix) return zero;
  const scale = Math.hypot(matrix[4],matrix[5],matrix[6]);
  return [matrix[12],matrix[13],-matrix[14],
    -matrix[8]/scale,-matrix[9]/scale,matrix[10]/scale,
    matrix[4]/scale,matrix[5]/scale,-matrix[6]/scale,scale].map(round);
}

function relative(parent,matrix) {
  if (!matrix) return null;
  const inverse = new Float32Array([
    parent[0],parent[4],parent[8],0,
    parent[1],parent[5],parent[9],0,
    parent[2],parent[6],parent[10],0,
    0,0,0,1
  ]);
  inverse.set(point(inverse,[-parent[12],-parent[13],-parent[14]]),12);
  return multiply(inverse,matrix);
}

const toy = launcher.build(renderer);
toy.rifle = rifle.build(renderer);
toy.spiral = spiral.build(renderer);
const carIds = toy.cars.map(id);
const colors = [0,1,2,3,4];
const pistol = {cars:colors,belt:0,feed:0};
const long = {cars:rifle.carOrder.slice(),belt:0};
const smg = spiral.newMagazine(false);
const motor = {powered:true,position:1,angle:0,switching:null};
const stages = values => values.map(([time,sound])=>({time,sound})).sort((a,b)=>a.time-b.time);
const axisPoint = ([x,y,z]) => [x,y,-z];

function createGear(kind, model, shell, mounted, grip, cartView, cap, speed, drag, reach) {
  const slotCount = model.carCount;
  const magazine = cartView ? [...cartView.opaque.filter(part=>!toy.cars.includes(part.mesh) &&
    !toy.spiral.cars.includes(part.mesh)),cartView.glass] : [];
  const slots = cartView ? cartView.opaque.filter(part=>toy.cars.includes(part.mesh) ||
    toy.spiral.cars.includes(part.mesh)).map(part=>pose(part.matrix)) : [];
  const clips = [];
  function sample(t, settings) {
    const {aim=0, reload=null, inspect=null, cycle=null, movingMotor=motor, press=0, loaded=mounted}=settings(t);
    const root = model.pose(aim,0,0,0,motionless,reload,0,stillWater,4/3,movingMotor?.switching,inspect);
    const parts = model.assemble(toy,root,loaded,cycle,reload,stillWater,movingMotor,press,inspect,aim);
    const part = mesh=>parts.opaque.find(item=>item.mesh===mesh)?.matrix;
    const hand = parts.opaque.find(item=>item.handSide===-1 && item.mesh!==toy.sleeve);
    const palm = hand ? multiply(hand.matrix,transform([-.066,-.012,.032])) : null;
    const looseCar = kind==="rifle" && reload?.batch ? part(toy.cars[reload.batch[0]]) : null;
    return [pose(root),pose(relative(root,palm)),pose(relative(root,parts.glass?.matrix)),
      pose(relative(root,cap && part(cap))),pose(relative(root,looseCar)),
      ...shell.map(mesh=>pose(relative(root,part(mesh))))];
  }
  function bake(name, duration, settings, marks=[]) {
    const frames = Math.max(1,Math.ceil(duration*rate)+1);
    const samples = [];
    for (let i=0;i<frames;i++) samples.push(...sample(i*duration/Math.max(1,frames-1),settings).flat());
    clips.push({name,duration,frames,marks:stages(marks),samples});
  }

  bake("hip",0,()=>({}));
  bake("aim",0,()=>({aim:1}));
  bake("fire",1,t=>({cycle:{start:0,end:1,progress:t,powered:true,feedsCar:true},
    movingMotor:{...motor,angle:14*t},press:1}));
  if (kind==="pistol") {
    const {inspection:s,switchTiming:m} = launcher;
    bake("inspect",s.end,t=>({inspect:{time:t}}),[[s.pull,"release"],[s.press,"motor-start"],
      [s.release,"motor-stop"],[s.align,"slide"],[s.seat,"seat"]]);
    for(const powered of [true,false]) {
      const from=Number(powered);
      bake(powered ? "powerOff" : "powerOn",m.end,t=>({movingMotor:{...motor,powered,
        position:V.mix(from,1-from,V.smooth(m.touch,m.flip,t)),switching:{time:t,from}}}),[[m.flip,"power"]]);
    }
    const start=launcher.jamFeed;
    bake("jam",1,t=>({cycle:{start:0,end:start,progress:start*t,powered:false,feedsCar:false},
      movingMotor:{...motor,powered:false,position:0},press:1}));
  }
  if (kind==="smg") {
    const {inspection:s} = spiral;
    bake("inspect",s.end,t=>({inspect:{time:t}}),[[s.release,"release"],[s.clear,"slide"],
      [s.motorStart,"motor-start"],[s.motorStop,"motor-stop"],[s.align,"slide"],[s.seat,"seat"]]);
  }
  if (kind!=="rifle") {
    for(const stashing of [false,true]) for(const uncap of [false,true]) {
      const timing = kind==="pistol" && !uncap ? launcher.uncappedReload : model.reload;
      const name = (stashing?"stow":"discard")+(uncap?"Sealed":"Open");
      const marks=[[timing.button??timing.grab,"release"],[stashing?timing.stow:timing.toss,stashing?"stash":"discard"],
        [timing.pocket,"pocket"],[timing.insert,"slide"],[timing.seat,"mount"]];
      if(uncap) marks.push([timing.capDrop,"cap"]);
      if(timing.tap) marks.push([timing.tap,"tap"]);
      const outgoing={...mounted,cars:stashing?mounted.cars:[]};
      bake(name,timing.end,t=>({reload:{time:t,timing,stashing,uncap,outgoing,
        incoming:{...mounted,sealed:uncap && t<timing.capDrop},gesture:"index"}}),marks);
    }
  }
  if (kind==="rifle") {
    const s=rifle.inspection, r=rifle.reload;
    const open = {phase:"open",time:r.openEnd};
    const gather = {phase:"gather",time:r.gatherEnd,hand:rifle.service(open).hand,batch:[0]};
    const insert = {phase:"insert",time:r.insertEnd,slot:0,beltLoading:true,batch:[0],next:1};
    const close = {phase:"close",time:0,end:r.closeEnd,from:rifle.service(insert),stash:0};
    const empty = {cars:[],belt:0};
    bake("inspect",s.end,t=>({inspect:{time:t}}),[[s.open,"slide"],[s.shut,"slide"],[s.latched,"latch"]]);
    bake("open",r.openEnd,t=>({reload:{...open,time:t}}),[[r.slideStart,"slide"],[r.slideEnd,"release"]]);
    bake("gather",r.gatherEnd,t=>({reload:{...gather,time:t},loaded:empty}),[[r.pickup,"pocket"]]);
    bake("close",r.closeEnd,t=>({reload:{...close,time:t}}),[[r.closeStart,"slide"],[r.latch,"latch"]]);
    for(let slot=0;slot<slotCount;slot++) {
      bake("insert"+slot,r.insertEnd,t=>({reload:{...insert,time:t,slot,next:Number(t>=r.seat),beltLoading:false},
        loaded:empty}),[[r.push,"slide"],[r.seat,"load"]]);
    }
    for(let slot=0;slot<2;slot++) {
      bake("belt"+slot,r.insertEnd,t=>({reload:{...insert,time:t,slot,next:Number(t>=r.seat)},loaded:empty}),
        [[r.push,"slide"],[r.seat,"load"]]);
    }
    const held=rifle.assemble(toy,identity,long,null,open,stillWater,null);
    slots.push(...held.opaque.filter(part=>toy.cars.includes(part.mesh)).map(part=>pose(part.matrix)));
  }
  return {kind,capacity:slotCount,shell:shell.map(id),cap:id(cap),clips,
    muzzle:axisPoint(model.muzzle),railStart:model.railStart ? axisPoint(model.railStart) : null,
    grip,speed,drag,reach,scale:model.carScale??1.47,
    looseCars:(kind==="smg" ? toy.spiral.cars : toy.cars).map(id),
    magazine:magazine.map(part=>({mesh:id(part.mesh),at:pose(part.matrix)})),slots:slots.flat()};
}

const model = toy.rifle, spool = toy.spiral;
const gears = [
  createGear("rifle",rifle,[model.body,model.door,model.beltSwitch,model.button,model.track],long,
    [.023,-.157,-.049],null,null,90.4,.0034,92),
  createGear("pistol",launcher,[toy.body,toy.trigger,toy.drive,toy.powerSwitch,toy.shaft],pistol,
    [.029,-.135,-.029],launcher.cartridgeParts(toy,identity,colors,0),toy.cartridge.cap,35.6,.0089,34),
  createGear("smg",spiral,[spool.body,spool.socket,spool.release,spool.trigger,spool.boost,spool.coupling],smg,
    [.025,-.179,-.032],spiral.magazineParts(spool,identity,smg),spool.cap,66.5,.0056,0)
];

const {meshes:asset} = V.blenderAssets;
const crate = {
  at:axisPoint([practice.supply.x,practice.supply.y,practice.supply.z]),
  sides:[-1,1,-1,1].map((side,i)=>{
    const outer=i<2;
    const name=outer?"carton_flap_outer":"carton_flap_inner";
    const hinge=outer ? [0,.62172,side*.325] : [side*.46,.60672,0];
    const yaw=outer ? (side<0 ? 0 : Math.PI) : -side*Math.PI/2;
    return {mesh:id(asset(renderer,name,{cardboard:46,tape:46})[0]),at:pose(transform(hinge,0,yaw)),angle:[.27,.38,-.09,.14][i]+Math.PI};
  })
};

const result = {carIds,gears,crate};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,"Meshes.valleymesh"),meshBundle(meshes,meshes.map((_,i)=>i)));
// Keep one motion per line so changes to timings and sampled poses remain local in diffs.
fs.writeFileSync(path.join(output,"Equipment.json"),JSON.stringify(result,null,0).replaceAll('},{"name":','},\n{"name":'));
console.log(`Exported ${meshes.length} equipment meshes and ${gears.reduce((count,gear)=>count+gear.clips.length,0)} action clips.`);
