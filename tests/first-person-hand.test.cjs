const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = vm.createContext({atob});
for (const file of ["render", "animation", "blender-models", "blender-assets", "launcher", "first-person"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file + ".js"), "utf8"), context, {filename: file + ".js"});
}
const V = vm.runInContext("Valley", context);
const distance = (a,b) => Math.hypot(...V.minus(a,b));
const renderer = {mesh: (builder, material, tint, uv, skin) => ({builder,skin})};
const fingers = [.085,.096,.090,.072].map((length,i)=>{
  const z=(i-1.5)*.0185;
  const name="finger_"+i;
  return {root:[-.084,.055,.037+z],tip:[length,.006,z*.18],pivots:V.blenderAssets.get(name).pivots};
});
const hand = {fingers,bindFingers:fingers,skin:[{}],sleeve:{}};
const cam = {at:[0,1.6,0],forward:[0,0,-1],toWorld:V.transform([0,1.6,0]),frustum:[0,0]};

test("a fully extended index reaches the fixture anchor with a continuous skin palette", () => {
  const at=[-.52,1.37,-.91];
  V.lodging={gripSide:()=>0,gripPose:()=>({at,normal:[0,0,1],up:[0,1,0],pointing:true})};
  const hands=new V.firstPerson.Hands();
  assert.ok(hands.use({grip:{pointing:true}},cam,false,false));
  hands.action.age=hands.action.duration;
  const pose=hands.usePose(hands.action,cam,hand);
  const parts=[];
  V.launcher.reach(parts,hand,pose.matrix,pose.grip,0,0,false,pose.fingers);
  const skinned=parts.find(part=>part.mesh===hand.skin[0]);
  assert.equal(skinned.palette.length,16*16);
  assert.ok(skinned.palette.every(Number.isFinite));
  const tip=V.plus(fingers[0].root,fingers[0].tip);
  const dist=distance(at,V.point(skinned.matrix,V.point(skinned.palette.subarray(48,64),tip)));
  assert.ok(dist<2e-6, String(dist));
  assert.ok(skinned.palette.subarray(64).some((n,i)=>Math.abs(n-Number(i%16%5===0))>.01));
});

test("fingers close before pickup, stay at their grip when carried, and relax smoothly at 30, 60 and 120 FPS", () => {
  const stageTimes=[];
  for(const fps of [30,60,120]) {
    const prop={kind:"cup",small:true,rx:.065,rz:.062,height:.16,mass:.26,parts:[],
      matrix:V.transform([.32,1.03,-.83])};
    const rest=V.transform([.27,.94,-.92]);
    V.world={traceShot:()=>null,height:()=>0};
    V.roadview={boxesNear:()=>[],floor:()=>({top:0})};
    V.props={trace:()=>null,bendPoint:(_prop,at)=>at,partsAt:()=>[],placement:()=>({matrix:rest}),
      matrixAt:(_prop,...args)=>V.transform(...args)};
    const player={grounded:true,swim:{active:false},yaw:0,pitch:0,vx:0,vz:0,feet:0,carried:null};
    const hands=new V.firstPerson.Hands();
    const step=1/fps;
    let pickup, placement;
    const input={world:{},cam,player,keys:new Set(),swing:0,
      take:prop=>{player.carried=prop;pickup=input.time;},
      place:()=>{player.carried=null;placement=input.time;},
      miss:()=>assert.fail("clear placement"),time:0};
    assert.ok(hands.reach(input.world,cam,prop,false));
    const reaching=hands.action, grip=reaching.grip;
    reaching.age=reaching.duration*.4;
    const opened=hands.reachHands(reaching,cam)[0];
    reaching.age=reaching.duration;
    const closed=hands.reachHands(reaching,cam)[0];
    reaching.age=0;
    assert.ok(closed.grip>opened.grip+.6);
    assert.ok(closed.fingers.pinch>opened.fingers.pinch+.2);
    assert.ok(distance(V.point(closed.matrix,[-.043,.052,.036]),V.point(prop.matrix,grip.contacts[0].at))<1e-6);
    const tick=()=>{
      input.time+=step;
      hands.update(step,input);
      const scene=hands.render({support:hand},cam,player,true);
      assert.ok(scene.every(part=>part.matrix.every(Number.isFinite)));
      return scene;
    };
    let carrying;
    for(let frame=0;frame<fps;frame++) carrying=tick();
    assert.equal(player.carried,prop);
    const carried=carrying.find(part=>part.mesh===hand.skin[0] && part.handSide===1);
    assert.ok(distance(V.point(carried.matrix,[-.043,.052,.036]),V.point(hands.matrix,grip.contacts[0].at))<1e-6);
    assert.ok(hands.lower(prop,{},()=>{}));
    while(player.carried && input.time<2) tick();
    assert.ok(placement && hands.action.kind==="release");
    const released=hands.action.poses[0];
    assert.ok(distance(V.point(released.matrix,[-.043,.052,.036]),V.point(rest,grip.contacts[0].at))<1e-6);
    for(let frame=0;frame<fps/2;frame++) tick();
    assert.equal(hands.action,null);
    stageTimes.push([pickup,placement]);
  }
  for(const [pickup,placement] of stageTimes.slice(1)) {
    assert.ok(Math.abs(pickup-stageTimes[0][0])<=1/30+1e-9);
    assert.ok(Math.abs(placement-stageTimes[0][1])<=1/30+1e-9);
  }
});

test("the Blender asset assigns renderable skin and nail vertices to all 16 joints", () => {
  const mesh=V.blenderAssets.get("support_hand");
  assert.deepEqual(Array.from(mesh.parts,part=>part.slot),["skin","gloss"]);
  const used=new Set();
  for(const {shape,joints,weights} of mesh.parts) {
    const vertices=shape.vertices.length/11;
    assert.equal(joints.length,vertices*4);
    assert.equal(weights.length,vertices*4);
    for(let i=0;i<weights.length;i+=4) {
      assert.ok(Math.abs(weights[i]+weights[i+1]+weights[i+2]+weights[i+3]-1)<2e-6);
      for(let j=i;j<i+4;j++) {
        assert.ok(joints[j]<16 && weights[j]>=0);
        if(weights[j]>.25) used.add(joints[j]);
      }
    }
  }
  assert.equal(used.size,16);
  assert.ok(V.blenderAssets.meshes(renderer,"support_hand").every(part=>part.skin.count===16));
});
