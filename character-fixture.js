"use strict";

(() => {
  const V=Valley, A=V.animation;
  const {Builder,clamp,mix,plus,minus,point,transform,rgb}=V;
  const x=[1,0,0],y=[0,1,0],z=[0,0,1], cycle=2*Math.PI;

  function fixtureRig() {
    const bones=[];
    const add=(name,parent,translation)=>{
      bones.push({name,parent,translation});
      return bones.length-1;
    };
    const root=add("root",-1,[0,0,0]), pelvis=add("pelvis",root,[0,.977,0]);
    const spine=add("spine",pelvis,[0,.235,0]), chest=add("chest",spine,[0,.235,0]);
    const neck=add("neck",chest,[0,.157,0]), head=add("head",neck,[0,.090,0]);
    const upper=[spine,chest,neck,head], legs=[], arms=[];
    for(const [side,suffix] of [[-1,"L"],[1,"R"]]) {
      const shoulder=add("shoulder"+suffix,chest,[side*.224,.082,0]);
      const elbow=add("elbow"+suffix,shoulder,[0,-.327,.015]);
      const hand=add("hand"+suffix,elbow,[0,-.294,-.015]);
      arms.push([shoulder,elbow,hand]);
      upper.push(shoulder,elbow,hand);
      const hip=add("hip"+suffix,pelvis,[side*.117,-.040,0]);
      const knee=add("knee"+suffix,hip,[0,-.420,-.026]);
      const foot=add("foot"+suffix,knee,[0,-.429,.026]);
      legs.push([hip,knee,foot]);
    }
    return {skeleton:new A.Skeleton(bones),rig:{pelvis,spine,chest,head,upper,legs,arms,ankleHeight:.088}};
  }

  function clipsFor(skeleton,rig) {
    const frames=32, times=Array.from({length:frames+1},(_,i)=>i/frames);
    const styles={
      Walk:{travel:.65,lift:.113,bob:.033,arm:.36},
      Run:{travel:.72,lift:.215,bob:.057,arm:.68},
      Sprint:{travel:.79,lift:.285,bob:.067,arm:.92},
      StrafeLeft:{travel:.49,lift:.105,bob:.025,arm:.21,lateral:-1},
      StrafeRight:{travel:.49,lift:.105,bob:.025,arm:.21,lateral:1},
      Backward:{travel:-.55,lift:.10,bob:.026,arm:-.28},
      TurnLeft:{travel:.14,lift:.099,bob:.022,arm:.15,turn:-1},
      TurnRight:{travel:.14,lift:.099,bob:.022,arm:.15,turn:1}
    };
    const rest=skeleton.rest;
    function buildClip(name,duration,loop,poseAt) {
      const sampled=times.map(p=>poseAt(p,rest.slice()));
      const tracks=[];
      skeleton.bones.forEach((_,bone)=>{
        for(const [path,offset,width] of [["translation",0,3],["rotation",3,4]]) {
          const at=bone*A.stride+offset, values=sampled.flatMap(p=>Array.from(p.subarray(at,at+width)));
          if(values.some((v,i)=>Math.abs(v-rest[at+i%width])>1e-6)) {
            tracks.push({bone,path,times:times.map(t=>t*duration),values});
          }
        }
      });
      return new A.Clip(name,tracks,{duration,loop});
    }
    const pose=new A.Pose(skeleton), pelvis=rig.pelvis*A.stride;
    function rot(local,bone,axis,amount) {
      local.set(A.rotation(axis,amount),bone*A.stride+3);
    }
    const clips={
      Idle:buildClip("Idle",3.2,true,(p,local)=>{
        local[pelvis+1]-=.009+.004*Math.sin(p*cycle);
        rot(local,rig.spine,x,.025*Math.sin(p*cycle));
        rig.arms.forEach(([arm,elbow],i)=>{
          rot(local,arm,z,i ? .103 : -.103);
          rot(local,elbow,x,-.13-.021*Math.sin(p*cycle+i));
        });
        return local;
      }),
      Stop:buildClip("Stop",.38,false,(p,local)=>{
        const arc=Math.sin(p*Math.PI)*(1-p);
        local[pelvis+1]-=.058*arc;
        rot(local,rig.spine,x,-.16*arc);
        return local;
      }),
      Carry:buildClip("Carry",1,true,(p,local)=>{
        rot(local,rig.spine,z,.018*Math.sin(p*cycle));
        rot(local,rig.head,x,.030);
        return local;
      })
    };
    for(const [name,style] of Object.entries(styles)) {
      const {stance}=V.gaitDefaults[name.replace(/Left$|Right$/,"")];
      clips[name]=buildClip(name,1,true,(p,local)=>{
        const {travel,lift,bob,arm,lateral=0,turn=0}=style;
        const running=name==="Run" || name==="Sprint";
        const wave=Math.sin(p*cycle);
        local[pelvis]+=(lateral ? .047 : .035)*wave;
        local[pelvis+1]-=.027+bob*(.5+.5*Math.cos(2*p*cycle));
        rot(local,rig.spine,y,wave*.11+turn*.07);
        rot(local,rig.chest,x,running ? -.11 : -.035);
        rig.arms.forEach(([shoulder,elbow],i)=>{
          const side=i ? 1 : -1, swing=side*Math.cos(p*cycle)*arm;
          const s=A.combine(A.rotation(z,side*.102),A.rotation(x,swing));
          local.set(s,shoulder*A.stride+3);
          rot(local,elbow,x,-.25-(running ? .48 : .05)*(1+side*wave*.45));
        });
        pose.local.set(local);
         pose.update();
        rig.legs.forEach((leg,i)=>{
          const side=i ? 1 : -1, phase=(p+i*.5)%1;
          const stepping=phase>=stance, step=stepping ? (phase-stance)/(1-stance) : phase/stance;
          const blend=stepping ? step*step*(3-2*step) : 1-step;
          const shift=mix(-travel*.50,travel*.50,blend);
          const rise=stepping ? lift*Math.sin(Math.PI*step)**1.45 : 0;
          const target=[side*.118+lateral*shift+turn*side*.12*Math.sin(phase*cycle),rig.ankleHeight+rise,
            lateral ? side*.052 : -shift+side*turn*.054];
          A.solveChain(pose,leg,target,[0,.04,-1],{min:.09,max:2.61});
          pose.worldRotation(leg[2],A.rotation(x,stepping ? .26*Math.sin(2*Math.PI*step) : 0));
           pose.update(leg[2]);
        });
        return pose.local.slice();
      });
    }
    return clips;
  }

  function makeMesh(renderer,skeleton,rig) {
    const bind=skeleton.globals(skeleton.rest), builder=new Builder(), joints=[], weights=[];
    const at=bone=>point(bind[bone],[0,0,0]);
    function part(bone,adjacent,shape,weight=()=>1) {
      const first=builder.vertices.length/11;
      shape(builder);
      for(let i=first;i<builder.vertices.length/11;i++) {
        const w=clamp(weight(builder.vertices[i*11+1]),0,1);
        joints.push(bone,adjacent,0,0);
        weights.push(w,1-w,0,0);
      }
    }
    const coat=rgb(0x267574), sleeves=rgb(0x255e60), cloth=rgb(0x343948), seam=rgb(0x4a5060);
    const skin=rgb(0xc89170), hair=rgb(0x312523), sole=rgb(0x232830), boot=rgb(0x7d6d53);
    part(rig.pelvis,rig.spine,b=>b.ellipsoid([0,1.063,0],[.221,.167,.146],cloth),h=>1-V.smooth(1.03,1.23,h));
    part(rig.spine,rig.chest,b=>{
      b.ellipsoid([0,1.335,0],[.270,.322,.145],coat,null,18,16);
      b.box([-.116,1.401,-.130],[.106,.112,.020],rgb(0x358685),.010);
      b.box([.008,1.357,-.145],[.011,.397,.010],rgb(0x214c4f),.004);
      b.ellipsoid([0,1.577,0],[.121,.067,.103],rgb(0x398181));
    },h=>1-V.smooth(1.25,1.57,h));
    part(rig.head,rig.chest,b=>{
      b.cylinder([0,1.573,0],[0,1.688,0],.069,.064,skin,14);
      b.ellipsoid([0,1.760,0],[.116,.150,.104],skin,null,18,12);
      b.ellipsoid([0,1.836,.018],[.118,.087,.106],hair);
      b.ellipsoid([0,1.748,-.102],[.023,.028,.021],skin,null,12,8);
      for(const side of [-1,1]) {
        b.ellipsoid([side*.111,1.756,.009],[.018,.036,.022],skin,null,10,8);
        b.ellipsoid([side*.041,1.785,-.095],[.017,.009,.008],rgb(0x302623),null,10,8);
      }
    });
    for(const [i,[shoulder,elbow,hand]] of rig.arms.entries()) {
      const armAt=at(shoulder),elbowAt=at(elbow),handAt=at(hand), side=i ? 1 : -1;
      part(shoulder,elbow,b=>{
        b.ellipsoid(armAt,[.096,.108,.105],sleeves);
        b.cylinder(plus(armAt,[0,.025,0]),plus(elbowAt,[0,-.088,0]),.090,.061,sleeves,14,false,12);
      },h=>V.smooth(elbowAt[1]-.068,elbowAt[1]+.081,h));
      part(elbow,shoulder,b=>{
        b.cylinder(plus(elbowAt,[0,.070,0]),handAt,.069,.051,sleeves,14,false,12);
        b.cylinder(plus(handAt,[0,.058,0]),plus(handAt,[0,-.012,0]),.054,.050,rgb(0x1f4148),14);
      },h=>1-V.smooth(elbowAt[1]-.045,elbowAt[1]+.07,h));
      part(hand,elbow,b=>{
        b.ellipsoid(plus(handAt,[0,-.047,-.012]),[.045,.075,.037],skin,null,14,10);
        b.ellipsoid(plus(handAt,[-side*.034,-.045,-.037]),[.023,.043,.022],skin);
      });
    }
    for(const [hip,knee,foot] of rig.legs) {
      const hipAt=at(hip),kneeAt=at(knee),footAt=at(foot);
      part(hip,knee,b=>b.cylinder(plus(hipAt,[0,.092,0]),plus(kneeAt,[0,-.073,0]),.112,.085,cloth,16,false,12),
        h=>V.smooth(kneeAt[1]-.070,kneeAt[1]+.110,h));
      part(knee,hip,b=>{
        b.cylinder(plus(kneeAt,[0,.083,0]),footAt,.087,.065,seam,14,false,12);
        b.cylinder(plus(footAt,[0,.062,0]),footAt,.069,.066,cloth,14);
      },h=>1-V.smooth(kneeAt[1]-.070,kneeAt[1]+.083,h));
      part(foot,knee,b=>{
        const top=plus(footAt,[0,-.023,-.059]);
        b.box(top,[.154,.117,.262],boot,.041);
        b.box(plus(top,[0,-.052,-.004]),[.158,.026,.275],sole,.010);
        for(let i=0;i<3;i++) b.box(plus(top,[0,.059,-.009+i*.026]),[.069,.008,.010],rgb(0xa4997f),.003);
      });
    }
    return renderer.mesh(builder,8,undefined,null,{joints,weights,count:skeleton.joints.length});
  }

  function fixture(renderer) {
    const {skeleton,rig}=fixtureRig();
    const clips=clipsFor(skeleton,rig);
    return {skeleton,rig,clips,meshes:[makeMesh(renderer,skeleton,rig)]};
  }

  function carryObject(renderer,clip,rig) {
    const builder=new Builder(), paint=rgb(0xc89655), trim=rgb(0x83533f);
    builder.box([0,.030,-.015],[.450,.156,.227],paint,.023);
    builder.box([0,.114,-.015],[.458,.038,.232],trim,.013);
    for(const side of [-1,1]) {
      builder.box([side*.241,.046,-.014],[.060,.050,.135],trim,.011);
      builder.box([side*.132,.117,-.130],[.039,.040,.013],rgb(0xd4aa75),.005);
    }
    const mesh=renderer.mesh(builder,8);
    const grips=[[-.244,.051,.012],[.244,.051,.012]];
    return {clip,pose({model,pose,time,response,recoil}) {
      const shoulder=pose.at(rig.arms[0][0]), other=pose.at(rig.arms[1][0]);
      const height=mix(shoulder[1],other[1],.5)-.29;
      const matrix=V.multiply(model,transform([0,height+Math.sin(time*4.7)*.011+response[2]*.17,-.33+recoil[2]],
        clamp(-response[0]*.25+recoil[0],-.18,.18),.025*Math.sin(time*3.1),response[1]*.21+recoil[1]));
      const q=A.decompose(matrix).slice(3,7);
      return {grips:grips.map((p,i)=>({at:point(matrix,p),rotation:A.combine(q,A.rotation(z,i ? -.44 : .44))})),
        parts:[{mesh,matrix}]};
    }};
  }

  function demo(renderer,spawn,event) {
    const asset=fixture(renderer);
    const ground=(x,z)=>{
      const paved=V.practice.paved(x,z);
      return {y:V.practice.height(x,z)+(paved ? .012 : 0),surface:paved ? "rock" : "dirt",stepBank:paved ? "outdoorStone" : undefined};
    };
    const actor=new V.Character(asset.skeleton,asset.rig,asset.clips,{ground,event});
    const tool=carryObject(renderer,asset.clips.Carry,asset.rig);
    const east=Math.PI/2, west=east+Math.PI;
    // Time, lateral position, heading, and lateral velocity at each boundary.
    const path=[[0,-3.5,east,0],[.9,-3.5,east,0],[2.65,-1.6,east,1.65],
      [4.05,2.45,east,3.25],[4.76,3.6,east,0],[5.28,3.6,east,0],[6.28,3.6,west,0],
      [9.95,-3.5,west,0],[10.49,-3.5,west,0],[11.50,-3.5,east+cycle,0],[12.2,-3.5,east+cycle,0]];
    const end=path.at(-1)[0];
    function input(time) {
      const i=path.findIndex(key=>key[0]>time);
      const [start,x0,yaw0,v0]=path[i-1], [finish,x1,yaw1,v1]=path[i];
      const span=finish-start,t=(time-start)/span,t2=t*t,t3=t2*t;
      const x=spawn.x+(2*t3-3*t2+1)*x0+(t3-2*t2+t)*span*v0+(-2*t3+3*t2)*x1+(t3-t2)*span*v1;
      const vx=(6*t2-6*t)*(x0-x1)/span+(3*t2-4*t+1)*v0+(3*t2-2*t)*v1;
      const z=spawn.z-6.8, floor=ground(x,z);
      return {at:[x,floor.y,z],velocity:[vx,0,0],yaw:mix(yaw0,yaw1,V.smooth(0,1,t)),grounded:true};
    }
    let time=0;
    actor.reset(input(0));
    return {
      update(dt) {
        const previous=time;
        time=(time+dt)%end;
        actor.useTool(time>=1.15 && time<8.96 ? tool : null);
        if(previous<3.3 && time>=3.3) actor.toolImpulse({pitch:1.6,roll:.46,slide:.70});
        if(previous<7.0 && time>=7.0) actor.impulse([.58,.2,-.7]);
        actor.update(dt,input(time));
      },
      render() {
        const {parts,weight}=actor.render(asset.meshes);
        // The scripted carry preview starts with the box in the actor's grip.
        return weight===1 ? parts : parts.slice(0,asset.meshes.length);
      }
    };
  }

  V.characterFixture={fixture,carryObject,demo};
})();
