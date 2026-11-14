"use strict";

(() => {
  const {clamp,mix,smooth,plus,minus,times,dot,cross,unit,transform,direction,point,multiply}=Valley;
  const {decompose,lerpPose,matrix:compose,FixedStep,spring,twoBone}=Valley.animation;
  const lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  const translation=m=>[m[12],m[13],m[14]];
  const axis=(m,i)=>[m[i],m[i+1],m[i+2]];
  const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const toView=(cam,p)=>{
    const delta=minus(p,cam.at);
    return [dot(delta,axis(cam.toWorld,0)),dot(delta,axis(cam.toWorld,4)),dot(delta,axis(cam.toWorld,8))];
  };
  function ease(t) {
    t=clamp(t,0,1);
    return t*t*t*(t*(t*6-15)+10);
  }
  const arc=t=>Math.sin(Math.PI*t);

  function interpolate(a,b,t,raise=0) {
    if(t===0 && !raise) return a;
    if(t===1 && !raise) return b;
    const pose=lerpPose(Float32Array.from(decompose(a)),Float32Array.from(decompose(b)),t,new Float32Array(10));
    pose[1]+=raise;
    return compose(pose);
  }

  function inputFor(player) {
    const c=Math.cos(player.yaw),s=Math.sin(player.yaw), grounded=player.grounded && !player.seat && !player.swim.active;
    return [player.yaw,player.pitch,grounded ? c*player.vx+s*player.vz : 0,grounded ? s*player.vx-c*player.vz : 0];
  }
  const atRest=[0,0,0];

  class Motion {
    constructor() {this.reset();}

    reset() {
      this.input=null;
      this.fixed=new FixedStep();
      this.alpha=0;
      this.phase=0;
      this.spring={value:Array(7).fill(0),velocity:Array(7).fill(0)};
      this.previous=this.spring.value.slice();
      this.contact={value:atRest.slice(),velocity:atRest.slice(),previous:atRest.slice()};
    }

    impact(right,down,back) {
      const velocity=this.contact.velocity;
      velocity[0]=clamp(velocity[0]+right,-1.4,1.4);
      velocity[1]=clamp(velocity[1]-down,-2.1,2.1);
      velocity[2]=clamp(velocity[2]+back,-1.4,1.4);
    }

    advance(dt,player,stepAction,load=0) {
      const next=inputFor(player), previous=this.input??next;
      if(!this.input) {
        this.spring.value[0]=this.previous[0]=next[0];
        this.spring.value[1]=this.previous[1]=next[1];
      }
      next[0]=previous[0]+angle(next[0]-previous[0]);
      this.input=next;
      this.alpha=this.fixed.advance(dt,(step,fraction)=>{
        const [yaw,pitch,side,forward]=lerp(previous,next,fraction);
        const speed=Math.hypot(side,forward);
        const walk=smooth(.15,2.62,speed), run=smooth(2.79,4.78,speed);
        this.phase+=speed*step*4.7;
        this.previous=this.spring.value.slice();
        spring(this.spring.value,this.spring.velocity,[yaw,pitch,side,forward,walk,run,this.phase],mix(24,15,load),.91,step);
        const {value,velocity,previous:priorContact}=this.contact;
        for(let i=0;i<3;i++) priorContact[i]=value[i];
        spring(value,velocity,atRest,20,.91,step);
        stepAction(step);
      });
    }

    sample() {
      const [yaw,pitch,side,forward,walk,run,phase]=lerp(this.previous,this.spring.value,this.alpha);
      const contact=lerp(this.contact.previous,this.contact.value,this.alpha);
      return {yaw:angle((this.input?.[0]??0)-yaw),pitch:(this.input?.[1]??0)-pitch,side,forward,contact,
        walk:clamp(walk,0,1),run:clamp(run,0,1),phase};
    }
  }

  function gripFor(prop,cam) {
    const at=translation(prop.matrix);
    const eye=minus(cam.at,at);
    const x=dot(eye,unit(axis(prop.matrix,0)))/Math.max(prop.rx,.09);
    const z=dot(eye,unit(axis(prop.matrix,8)))/Math.max(prop.rz,.09);
    const normal=Math.abs(x)>Math.abs(z) ? [Math.sign(x),0,0] : [0,0,Math.sign(z)||1];
    const lateral=[normal[2],0,-normal[0]], two=!prop.small || prop.kind==="crt";
    const rx=prop.surface?.rx??prop.rx, rz=prop.surface?.rz??prop.rz;
    const reach=normal[0] ? rx : rz, span=lateral[0] ? rx : rz;
    const load=clamp((prop.mass+.85*Math.max(prop.rx,prop.rz))/7.7,0,1);
    const table=prop.kind==="table" || prop.kind==="desk", chair=prop.kind==="chair";
    const y=table ? (prop.surface?.top || prop.height)-.010 : chair ? Math.min(.64,prop.height*.50)
      : prop.kind==="tube" ? .071 : prop.height*(prop.kind==="crt" ? .24 : .58);
    const width=two ? Math.min(span*(chair ? .84 : .73),.37) : 0;
    const depth=table ? reach+.006 : reach*(chair ? .78 : prop.kind==="crt" ? .82 : .94);
    const center=plus(times(normal,depth+(prop.small && !two ? .012 : 0)),[0,y,0]);
    const contacts=prop.gripAnchors ?? (two ? [-1,1] : [1]).map(side=>{
      const p=plus(center,times(lateral,side*width));
      if(prop.kind==="tube") p[normal[0] ? 0 : 2]*=.81;
      return {side,at:p,normal};
    });
    const facing=contacts[0].normal;
    return {two:contacts.length>1,load,center:lerp(contacts[0].at,contacts.at(-1).at,.5),contacts,
      yaw:-Math.atan2(facing[0],facing[2])};
  }

  function carryPose(prop,grip,motion,cam,player,swing=0) {
    const {two,load,yaw}=grip, wave=Math.sin(motion.phase), stride=motion.walk*(1+motion.run*.43);
    const large=Math.max(prop.rx,prop.rz), lag=clamp(motion.yaw,-.56,.56), lift=clamp(motion.pitch,-.40,.40);
    const depth=two ? .82+Math.min(.24,large*.23) : .55+Math.min(.11,large*.25);
    const bob=wave*stride*mix(.017,.009,load);
    const track=transform(cam.at,player.pitch*.67,-player.yaw);
    const target=point(track,plus([
      (two ? .021 : .23)-lag*mix(.14,.27,load)-.011*motion.side+.012*wave*stride+.11*swing,
      (two ? -.48 : -.34)-load*.19-lift*.21+bob+.13*swing,
      -depth+.014*motion.forward-.21*swing
    ],motion.contact));
    const pitch=player.pitch*.22-lift*.52-.29*swing;
    const heading=-player.yaw+yaw-lag*mix(.42,.71,load);
    const roll=-lag*.29+.017*wave*stride-.014*motion.side+.14*swing;
    const matrix=Valley.props.matrixAt(prop,target,pitch,heading,roll).slice();
    matrix.set(minus(target,direction(matrix,grip.center)),12);
    return matrix;
  }

  function handPose(at,forward,up,side,contact,scale=.94) {
    const x=unit(forward), z=unit(cross(x,up)), y=cross(z,x);
    const matrix=new Float32Array([...times(x,scale),0,...times(y,scale),0,...times(z,side*scale),0,0,0,0,1]);
    matrix.set(minus(at,direction(matrix,contact)),12);
    return matrix;
  }

  const palmContact=[-.043,.052,.036], wristContact=[-.143,-.066,.098];

  function freeHand(cam,side,motion) {
    const walk=motion.walk, run=motion.run, swing=Math.sin(motion.phase*.50+side*Math.PI*.50)*walk;
    const at=point(cam.toWorld,plus([side*(.33-.045*run)-motion.yaw*.14,
      -.392+.073*run+swing*(.043+run*.065)+Math.abs(motion.side)*.008-motion.pitch*.12,
      -.55-swing*(.092+run*.062)+.035*motion.forward/5],motion.contact));
    const lag=transform([0,0,0],-clamp(motion.pitch,-.30,.30),clamp(motion.yaw,-.34,.34),motion.side*.016);
    const basis=multiply(cam.toWorld,lag);
    return handPose(at,direction(basis,[-side*.18,mix(.21,.55,run),-1]),
      direction(basis,[side*.23,1,.08]),side,wristContact);
  }

  function propContact(prop,matrix,contact,drape=0) {
    let local=Valley.props.bendPoint(prop,contact.at);
    if(prop.kind==="tube" && drape) {
      const slack=1-smooth(.14,.58,prop.air), span=clamp((.52-local[2]/prop.rz)/1.51,0,1);
      const hang=span*span*(3-2*span)*slack*drape, scaleY=Math.max(.10,Math.hypot(...axis(matrix,4)));
      local=[local[0]*(1-.37*hang),local[1]-.46*hang/scaleY,local[2]+prop.rz*.54*hang];
    }
    return point(matrix,local);
  }

  function propHand(prop,matrix,contact,drape) {
    const at=propContact(prop,matrix,contact,drape);
    const normal=unit(direction(matrix,contact.normal)), up=unit(axis(matrix,4));
    if(prop.kind==="table" || prop.kind==="desk") {
      return handPose(at,plus(times(normal,-1),times(up,.34)),up,contact.side,palmContact);
    }
    if(prop.small && prop.kind!=="crt") {
      return handPose(at,plus(times(normal,-.25),times(up,.93)),normal,contact.side,palmContact,.91);
    }
    return handPose(at,plus(times(normal,-1),times(up,-.16)),up,contact.side,palmContact);
  }

  function fixtureHand(hand,item,contact,side) {
    const {at,normal,up,pointing}=Valley.lodging.gripPose(item,contact);
    const index=hand.fingers[0], pin=pointing ? plus(index.root,index.tip) : palmContact;
    return handPose(at,plus(times(normal,-1),times(up,-.10)),up,side,pin,.91);
  }

  function handBlend(from,to,side,t,raise=0) {
    if(side>0) return interpolate(from,to,t,raise);
    const a=from.slice(), b=to.slice();
    for(let i=8;i<11;i++) {a[i]*=-1;b[i]*=-1;}
    const matrix=interpolate(a,b,t,raise).slice();
    for(let i=8;i<11;i++) matrix[i]*=-1;
    return matrix;
  }

  function solveArm(wrist,side,viewSlope=0) {
    let shoulder=[side*.277,-.424,-.088];
    let upper=.395, lower=.411, offset=minus(wrist,shoulder);
    let length=Math.hypot(...offset), heading=length>1e-6 ? times(offset,1/length) : [0,-.4,-Math.sqrt(.84)];
    const distance=clamp(length,.055,upper+lower-.012);
    shoulder=plus(shoulder,times(heading,length-distance));
    // On long reaches keep the shoulder below frame and preserve the segment proportions.
    if(viewSlope && shoulder[1]>shoulder[2]*viewSlope-.14) {
      shoulder[1]=shoulder[2]*viewSlope-.14;
      offset=minus(wrist,shoulder);
      length=Math.hypot(...offset);
      heading=unit(offset);
      const stretch=Math.max(1,(length+.012)/(upper+lower));
      upper*=stretch;
      lower*=stretch;
    } else length=distance;
    // This continuous frame points down/out at rest and keeps the pole off the wrist axis.
    const forward=unit([heading[0],heading[1],Math.min(-.12,heading[2])]);
    const right=unit(cross(forward,[0,1,0])), down=cross(forward,right);
    const pole=plus(times(right,side*.78),down);
    const {middle:elbow}=twoBone(shoulder,wrist,upper,lower,pole,{min:.001,max:3.04});
    return {shoulder,elbow};
  }

  function drawHand(out,toy,cam,matrix,side,grip,{pointing=false,curl=.29,pinch=.22}={}) {
    const local=matrix.slice();
    // Rotate each world-space hand axis into the current view, including the reflected left mesh.
    for(let i=0;i<12;i+=4) {
      const v=axis(matrix,i);
      local.set([dot(v,axis(cam.toWorld,0)),dot(v,axis(cam.toWorld,4)),dot(v,axis(cam.toWorld,8))],i);
    }
    local.set(toView(cam,translation(matrix)),12);
    const arm=[];
    Valley.launcher.reach(arm,toy.support,local,grip,0,0,pointing,{side,pinch:pinch*grip,curl:curl*grip,
      ik:(wrist,side)=>solveArm(wrist,side,cam.frustum[1])});
    for(const part of arm) out.push({...part,matrix:part.matrix ? multiply(cam.toWorld,part.matrix) : cam.toWorld});
  }

  function canReach(world,cam,at,prop,allowSupport) {
    const delta=minus(at,cam.at), distance=Math.hypot(...delta);
    if(distance>2.6 || dot(delta,cam.forward)<.055) return false;
    const end=plus(cam.at,times(delta,Math.max(0,1-.075/distance)));
    const clear=hit=>!hit || (allowSupport && hit.normal[1]>.64 && Math.hypot(...minus(at,hit.at))<.24);
    return clear(Valley.world.traceShot(world,cam.at,end,false)) && clear(Valley.props.trace(world,cam.at,end,1,prop));
  }

  function gripCenter(prop,matrix,grip,drape=0) {
    return lerp(propContact(prop,matrix,grip.contacts[0],drape),propContact(prop,matrix,grip.contacts.at(-1),drape),.5);
  }

  function carryBounds(prop) {
    const rx=Math.max(prop.rx,...prop.parts.map(p=>Math.max(Math.abs(p.min?.[0]??0),Math.abs(p.max?.[0]??0))));
    const rz=Math.max(prop.rz,...prop.parts.map(p=>Math.max(Math.abs(p.min?.[2]??0),Math.abs(p.max?.[2]??0))));
    const bottom=Math.min(0,...prop.parts.map(p=>p.min?.[1]??0));
    const top=Math.max(prop.surface?.top??prop.height,...prop.parts.map(p=>p.max?.[1]??0));
    return {rx,rz,bottom,top};
  }

  function containCarry(world,cam,matrix,bounds,feet) {
    const {rx,rz,bottom,top}=bounds;
    const center=point(matrix,[0,mix(bottom,top,.52),0]);
    const range=Math.hypot(...minus(center,cam.at))+Math.hypot(rx,rz)+.11;
    const boxes=Valley.roadview.boxesNear(world.road,cam.at[0],cam.at[2],range);
    let retreat=0, rise=0, closest=-Infinity;
    for(const x of [-rx,rx]) for(const z of [-rz,rz]) {
      const foot=point(matrix,[x,bottom,z]);
      const crown=point(matrix,[x,top,z]);
      closest=Math.max(closest,-dot(minus(foot,cam.at),cam.forward),-dot(minus(crown,cam.at),cam.forward));
      const floor=Math.max(Valley.world.height(foot[0],foot[2]),
        Valley.roadview.floor(world.road,foot[0],foot[2],feet+.14).top);
      rise=Math.max(rise,floor+.019-foot[1]);
      const corner=point(matrix,[x,mix(bottom,top,.52),z]), ray=minus(corner,cam.at);
      for(const box of boxes) {
        if(box.kind!=="wall" || box.bottom>=Math.max(cam.at[1],corner[1])+.10
          || box.top<=Math.min(cam.at[1],corner[1])-.10) continue;
        const hit=Valley.roadview.hitBox(box,cam.at,ray,1,.024);
        if(hit) {
          const approach=dot(hit.normal,cam.forward);
          if(approach<-.15) retreat=Math.max(retreat,dot(minus(corner,hit.at),hit.normal)/approach);
        }
      }
    }
    rise=Math.min(rise,.47);
    const limit=Math.max(0,-closest+cam.forward[1]*rise-.085);
    return [Math.min(retreat,limit),rise];
  }

  class Hands {
    constructor() {
      this.motion=new Motion();
      this.reset();
    }

    reset() {
      this.motion.reset();
      this.action=null;
      this.grip=null;
      this.matrix=null;
      this.clearance=[0,0];
    }

    get busy() {return this.action!==null;}
    get useSide() {
      return this.action?.kind==="use" ? this.action.side : this.action?.fixtureSide;
    }

    impact(right,down,back) {
      this.motion.impact(right,down,back);
    }

    poseHeldArms(parts,viewSlope,aim) {
      const {yaw,pitch,side,forward,walk,run,phase,contact}=this.motion.sample();
      const amount=mix(1,.30,aim);
      for(const {effect,handSide} of parts) {
        const sleeve=effect?.sleeve;
        if(!sleeve) continue;
        const rest=sleeve.slice(0,3), elbow=sleeve.slice(3,6), wrist=sleeve.slice(9,12);
        const shoulder=plus(rest,times(plus([
          clamp(-yaw*.19+side*.004,-.036,.036),
          clamp(pitch*.19+Math.sin(phase*.5)*walk*.019,-.034,.034),
          clamp(forward*.004+Math.cos(phase*.5+handSide)*run*.014,-.029,.029)
        ],contact),amount));
        shoulder[1]=Math.min(shoulder[1],Math.max(rest[1],shoulder[2]*viewSlope-.12));
        const upper=minus(elbow,rest), lower=minus(wrist,elbow);
        const {middle}=twoBone(shoulder,wrist,Math.hypot(...upper),Math.hypot(...lower),upper,{min:.001,max:3.10});
        for(let i=0;i<3;i++) {
          sleeve[i]=shoulder[i];
          sleeve[i+3]=middle[i];
        }
      }
    }

    reach(world,cam,prop,stowing) {
      const grip=gripFor(prop,cam);
      const at=gripCenter(prop,prop.matrix,grip);
      if(this.busy || !this.reachable(world,cam,prop,prop.matrix,false,grip)) return false;
      const distance=Math.hypot(...minus(cam.at,at));
      const delay=stowing ? .15 : 0, duration=delay+mix(.25,.46,smooth(.45,2.28,distance))+.048*grip.load;
      this.action={kind:"reach",prop,grip,age:0,delay,duration};
      return true;
    }

    reachable(world,cam,prop,matrix,allowSupport=false,grip=this.grip) {
      return grip && grip.contacts.every(c=>canReach(world,cam,propContact(prop,matrix,c),prop,allowSupport));
    }

    lower(prop,plan,after) {
      if(!this.grip || !this.matrix || (this.busy && this.action.kind!=="grab")) return false;
      const {load}=this.grip;
      this.action={kind:"lower",prop,plan,after,from:this.matrix,age:0,duration:mix(.35,.55,load),rest:null};
      return true;
    }

    use(item,cam,carrying,launcherVisible) {
      if(!item.grip || this.busy || (carrying && this.grip?.two)) return false;
      const face=Valley.lodging.gripSide(item,cam.at), {at}=Valley.lodging.gripPose(item,face);
      const side=carrying || launcherVisible || toView(cam,at)[0]<-.20 ? -1 : 1;
      this.action={kind:"use",item,face,side,age:0,started:null,
        duration:mix(.16,.26,smooth(.54,2.1,Math.hypot(...minus(at,cam.at))))};
      return true;
    }

    used(item) {
      if(this.action?.kind==="use" && this.action.item===item) this.action.started=this.action.age;
    }

    cancelUse(item) {
      if(this.action?.kind==="use" && this.action.item===item) this.action.cancelled=true;
    }

    detach(prop,after,drape=0) {
      if(this.grip && this.matrix) {
        const poses=this.grip.contacts.map(c=>({side:c.side,matrix:propHand(prop,this.matrix,c,drape),grip:.94}));
        this.action={kind:"release",poses,age:0,duration:.26,after};
      } else this.action=null;
      this.grip=null;
      this.matrix=null;
      this.clearance=[0,0];
    }

    interrupt() {
      this.action=null;
    }

    update(dt,{world,cam,player,keys,time,ripples,swing,take,place,use,miss,hand}) {
      const action=this.action;
      if(action?.kind==="lower") action.rest=Valley.props.placement(world,action.prop,action.plan,time,ripples);
      this.motion.advance(dt,player,dt=>{
        if(!this.action) return;
        const action=this.action;
        action.age+=dt;
        const {kind,age,duration,prop}=action, arrived=age+1e-8>=duration;
        if(kind==="reach") {
          if(prop.picked || prop.broken || prop.flight || prop.occupied || (!player.grounded && !player.swim.active)) {
            this.releaseReach(action,cam);
          } else if(arrived) {
            const from=prop.matrix;
            if(!this.reachable(world,cam,prop,from,false,action.grip)) {
              this.releaseReach(action,cam);
              return;
            }
            take(prop);
            if(player.carried!==prop) {
              this.action=null;
              return;
            }
            this.grip=action.grip;
            this.grip.bounds=carryBounds(prop);
            this.matrix=from;
            this.action={kind:"grab",from,age:Math.max(0,age-duration),duration:mix(.26,.48,this.grip.load)};
          }
        } else if(kind==="grab") {
          if(arrived) this.action=null;
        } else if(kind==="lower") {
          const goal=action.rest?.matrix, at=goal && gripCenter(prop,goal,this.grip);
          const reachable=at && Math.hypot(...minus(cam.at,at))<2.66 && toView(cam,at)[2]<-.062;
          if(!reachable || (arrived && !this.reachable(world,cam,prop,goal,true))) {
            this.action={kind:"grab",from:this.matrix,age:0,duration:.25,drape:this.drape()};
            miss();
          } else if(arrived) {
            place(prop,action.plan,action.rest);
            this.matrix=goal;
            this.detach(prop,action.after);
          }
        } else if(kind==="use") {
          const {item,face,side,started}=action;
          const {at}=Valley.lodging.gripPose(item,face);
          const inView=toView(cam,at)[2]<-.053 && Math.hypot(...minus(cam.at,at))<2.65;
          const done=started!==null && arrived && age-started>=.12 && !item.ignition
            && (item.value===Number(item.on) || age-started>.80);
          if(action.cancelled || !inView || item.broken || done || (started===null && item.kind==="door" && !keys.has("KeyE"))) {
            const pose=this.usePose(action,cam,hand);
            this.action={kind:"release",poses:[pose],fixtureSide:side,age:0,duration:.25};
          } else if(started===null && item.kind!=="door" && arrived) {
            use(item);
          }
        } else if(arrived) {
          this.action=null;
          action.after?.();
        }
      },this.grip?.load);
      const carry=player.carried && this.grip;
      if(carry) this.matrix=this.carryMatrix(world,cam,player,swing,dt);
    }

    get age() {return this.action.age+this.motion.fixed.remainder;}

    drape() {
      const action=this.action;
      if(action?.kind==="grab") return mix(action.drape??0,1,ease(this.age/action.duration));
      if(action?.kind==="lower") return 1-ease(this.age/action.duration);
      return 1;
    }

    carryMatrix(world,cam,player,swing,dt) {
      const prop=player.carried, grip=this.grip, action=this.action;
      const goal=carryPose(prop,grip,this.motion.sample(),cam,player,swing);
      const correction=containCarry(world,cam,goal,grip.bounds,player.feet);
      this.clearance=this.clearance.map((value,i)=>Math.max(correction[i],mix(value,correction[i],1-Math.exp(-dt*13))));
      const offset=plus(times(cam.forward,-this.clearance[0]),[0,this.clearance[1],0]);
      goal.set(plus(translation(goal),offset),12);
      if(action?.kind==="grab") return interpolate(action.from,goal,ease(this.age/action.duration));
      if(action?.kind==="lower" && action.rest) {
        const t=ease(this.age/action.duration);
        return interpolate(action.from,action.rest.matrix,t,arc(t)*mix(.11,.18,grip.load));
      }
      return goal;
    }

    reachHands(action,cam) {
      const {prop,grip,delay,duration}=action, motion=this.motion.sample();
      const t=ease((this.age-delay)/(duration-delay));
      return grip.contacts.map(c=>({
        side:c.side,grip:mix(.21,.94,smooth(.62,1,t)),
        matrix:handBlend(freeHand(cam,c.side,motion),propHand(prop,prop.matrix,c),c.side,t,arc(t)*.08)
      }));
    }

    releaseReach(action,cam) {
      this.action={kind:"release",poses:this.reachHands(action,cam),age:0,duration:.23};
    }

    usePose(action,cam,hand) {
      const {item,face,side,duration}=action, t=ease(this.age/duration);
      const target=fixtureHand(hand,item,face,side);
      const pointing=Boolean(item.grip.pointing);
      return {side,pointing,matrix:handBlend(freeHand(cam,side,this.motion.sample()),target,side,t,arc(t)*.055),
        grip:mix(.25,pointing ? .78 : .95,smooth(.55,1,this.age/duration))};
    }

    render(toy,cam,player,allowFree) {
      const action=this.action, motion=this.motion.sample(), out=[], hands=new Map();
      if(allowFree && !(action?.kind==="reach" && this.age<action.delay)) {
        for(const side of [-1,1]) {
          if(this.grip?.contacts.some(c=>c.side===side)) continue;
          hands.set(side,{side,matrix:freeHand(cam,side,motion),grip:mix(.24,.55,motion.run)});
        }
      }
      if(player.carried && this.grip && this.matrix) {
        const prop=player.carried, drape=this.drape();
        out.push(...Valley.props.partsAt(prop,this.matrix,drape));
        for(const c of this.grip.contacts) hands.set(c.side,{side:c.side,matrix:propHand(prop,this.matrix,c,drape),grip:.94});
      }
      if(action?.kind==="reach" && this.age>=action.delay) {
        for(const pose of this.reachHands(action,cam)) hands.set(pose.side,pose);
      } else if(action?.kind==="use") {
        hands.set(action.side,this.usePose(action,cam,toy.support));
      } else if(action?.kind==="release") {
        const t=ease(this.age/action.duration);
        const open=smooth(0,.56,t);
        for(const pose of action.poses) {
          hands.set(pose.side,{...pose,
            matrix:handBlend(pose.matrix,freeHand(cam,pose.side,motion),pose.side,t,.045*arc(t)),
            grip:mix(pose.grip,mix(.24,.55,motion.run),open)});
        }
      }
      for(const {matrix,side,grip,pointing} of hands.values()) drawHand(out,toy,cam,matrix,side,grip,{pointing});
      return out;
    }
  }

  Valley.firstPerson={Hands,translation};
})();
