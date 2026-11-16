"use strict";

const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {gzipSync}=require("node:zlib");
const meshBundle=require("./mesh-bundle.cjs");
const root=path.resolve(__dirname,"../..");
const destination=process.argv[2] || path.join(root,"unity/Assets/Valley/Resources/ValleyDemo");
const context=vm.createContext({atob});
for(const file of ["render.js","animation.js","character.js","practice.js","character-fixture.js"])
  vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context,{filename:file});
const V=vm.runInContext("Valley",context);
const A=V.animation;
const renderer={mesh:(shape,material,_tint,_uv,skin)=>({shape,material,skin})};
const asset=V.characterFixture.fixture(renderer);
const skeleton=asset.skeleton;
const bind=skeleton.globals(skeleton.rest);
const rate=30,duration=12.2,frames=Math.round(duration*rate);
function reflected(pose) {
  const [x,y,z,qx,qy,qz,qw,sx,sy,sz]=pose;
  return [x,y,-z,-qx,-qy,qz,qw,sx,sy,sz];
}
const bones=skeleton.bones.map(({name,parent},i)=>({name,parent,rest:reflected(skeleton.rest.subarray(i*10,(i+1)*10))}));
const events=[];
let frame=0;
let cargo;
const demo=V.characterFixture.demo(renderer,V.practice.spawn,event=>{
  if(event.at && event.name==="footstep")
    events.push({frame,run:event.speed>=2.3,bank:event.stepBank??"dirtLeaf",at:[event.at[0],event.at[1],-event.at[2]]});
});
const values=Buffer.alloc(frames*(bones.length+2)*10*4);
let offset=0;
function write(pose) {
  for(const number of pose) {
    if(!Number.isFinite(number)) throw Error("Invalid rig frame "+frame);
    offset=values.writeFloatLE(number,offset);
  }
}
const absent=[0,0,0,0,0,0,1,0,0,0];
for(frame=0;frame<frames;frame++) {
  const [body,box]=demo.render();
  if(box) cargo=box.mesh;
  write(reflected(A.decompose(body.matrix)));
  write(box ? reflected(A.decompose(box.matrix)) : absent);
  const globals=bind.map((matrix,index)=>V.multiply(body.palette.subarray(index*16,(index+1)*16),matrix));
  for(const [i,bone] of bones.entries()) {
    const matrix=bone.parent<0 ? globals[i] : V.multiply(A.inverse(globals[bone.parent]),globals[i]);
    write(reflected(A.decompose(matrix)));
  }
  demo.update(1/rate);
}
if(!cargo) throw Error("The character preview never picked up its box");
if(!events.length) throw Error("The character preview never emitted a foot contact");
const body=asset.meshes[0], {joints,weights}=body.skin;
const skin=Buffer.alloc(joints.length*6);
for(let i=0;i<joints.length;i++) {
  skin.writeUInt16LE(joints[i],i*6);
  skin.writeFloatLE(weights[i],i*6+2);
}
fs.mkdirSync(destination,{recursive:true});
fs.writeFileSync(path.join(destination,"Models.valleymesh"),meshBundle([body,cargo],[0,1]));
fs.writeFileSync(path.join(destination,"Motion.bytes"),gzipSync(Buffer.concat([skin,values])));
fs.writeFileSync(path.join(destination,"Rig.json"),JSON.stringify({bones,frames,rate,events}));
console.log(`Converted ${frames} frames and ${bones.length} joints from the original character demo. ${events.length} foot contacts.`);
