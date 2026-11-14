"use strict";

(() => {
  const {clamp,mix,smooth,minus,unit,point,direction,transform}=Valley;
  const A=Valley.animation;
  const up=[0,1,0], forward=[0,0,-1], right=[1,0,0];
  const gaitDefaults={Walk:{stride:1.18,stance:.62},Run:{stride:1.90,stance:.42},Sprint:{stride:2.44,stance:.35},
    Strafe:{stride:.86,stance:.63},Backward:{stride:.93,stance:.63},Turn:{frequency:1.10,stance:.63}};
  const movingGaits=["Walk","Run","Sprint","Strafe","Backward","Turn"];
  const locomotionStates=["Idle",...movingGaits,"Stop"];
  const standingLeg={min:.08,max:2.72};
  const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const lerp=(a,b,t)=>a.map((n,i)=>mix(n,b[i],t));
  const turn=(pose,bone,axis,angle)=> {
    const offset=bone*A.stride+3;
    pose.set(A.combine(pose.subarray(offset,offset+4),A.rotation(axis,angle)),offset);
  };
  const fitFloor=(at,ground,height)=>{
    const normal=ground.normal??up;
    return [at[0],ground.y+height/Math.max(normal[1],.45),at[2]];
  };

  class Character {
    constructor(skeleton,rig,clips,{ground,event=()=>{},gaits={}}={}) {
      this.skeleton=skeleton;
      this.rig=rig;
      this.ankleHeight=rig.ankleHeight??.088;
      this.clips=clips;
      this.ground=ground??(()=>({y:0,normal:up}));
      this.event=event;
      this.gaits=Object.fromEntries(movingGaits.map(name=>{
        const gait={...gaitDefaults[name],...gaits[name]};
        if(!(gait.stance>0 && gait.stance<1) || !(gait[name==="Turn" ? "frequency" : "stride"]>0)) {
          throw new Error("Invalid gait settings for "+name+".");
        }
        return [name,gait];
      }));
      this.pose=new A.Pose(skeleton);
      this.drawPose=new A.Pose(skeleton);
      this.mixer=new A.Mixer(skeleton);
      this.skins=new Float32Array(skeleton.joints.length*16);
      this.upperMask=skeleton.bones.map((_,i)=>Number(rig.upper.includes(i)));
      this.layers=[];
      this.targetWeights={};
      this.reset({at:[0,0,0],yaw:0,velocity:[0,0,0],grounded:true});
    }

    reset(input) {
      this.fixed=new A.FixedStep();
      this.input={...input,at:input.at.slice(),velocity:input.velocity.slice()};
      this.frame={at:this.input.at,yaw:input.yaw,grounded:input.grounded!==false};
      this.previousFrame=this.frame;
      this.previous=this.skeleton.rest.slice();
      this.pose.local.set(this.previous);
      this.pose.update();
      this.weights={Idle:1,Walk:0,Run:0,Sprint:0,Strafe:0,Backward:0,Turn:0,Stop:0};
      this.time=this.phase=this.toolWeight=this.toolTime=this.lift=0;
      this.previousToolWeight=this.previousToolTime=0;
      this.motion=[0,0,0];
      this.acceleration=[0,0,0];
      this.speed=[0,0,0];
      this.response=[0,0,0];
      this.responseVelocity=[0,0,0];
      this.previousResponse=[0,0,0];
      this.toolResponse=[0,0,0];
      this.toolVelocity=[0,0,0];
      this.previousToolResponse=[0,0,0];
      this.action=this.activeTool=null;
      this.feet=this.rig.legs.map(()=>({anchor:null,amount:0,planted:false,previousAnchor:null,previousAmount:0}));
      this.stopAge=1;
      this.strafeDirection=.5;
      this.turnDirection=.5;
      this.moving=false;
      this.state="Idle";
      this.alpha=0;
    }

    impulse(worldVelocity) {
      const [x,y,z]=direction(transform([0,0,0],0,this.frame.yaw),worldVelocity);
      this.responseVelocity[0]=clamp(this.responseVelocity[0]-z*3.4,-5.4,5.4);
      this.responseVelocity[1]=clamp(this.responseVelocity[1]+x*2.7,-5.1,5.1);
      this.responseVelocity[2]=clamp(this.responseVelocity[2]-y*.75-Math.hypot(x,z)*.36,-1.8,1.8);
    }

    useTool(action) {
      this.action=action;
    }

    toolImpulse({pitch=0,roll=0,slide=0}={}) {
      this.toolVelocity[0]=clamp(this.toolVelocity[0]+pitch,-6,6);
      this.toolVelocity[1]=clamp(this.toolVelocity[1]+roll,-5,5);
      this.toolVelocity[2]=clamp(this.toolVelocity[2]+slide,-4,4);
    }

    update(seconds,input) {
      const before=this.input;
      this.alpha=this.fixed.advance(seconds,(dt,fraction)=>{
        const at=lerp(before.at,input.at,fraction), yaw=before.yaw+wrapAngle(input.yaw-before.yaw)*fraction;
        this.tick(dt,{at,yaw,velocity:lerp(before.velocity,input.velocity,fraction),grounded:input.grounded!==false});
      });
      this.input={...input,at:input.at.slice(),velocity:input.velocity.slice()};
    }

    tick(dt,input) {
      this.previous.set(this.pose.local);
      this.previousFrame=this.frame;
      this.frame=input;
      this.time+=dt;
      const basis=transform([0,0,0],0,input.yaw);
      const [side,,depth]=direction(basis,input.velocity), advance=-depth;
      const turnRate=wrapAngle(input.yaw-this.previousFrame.yaw)/dt;
      const speed=Math.hypot(side,advance), stopped=speed<.18;
      this.stopAge=speed>.30 ? 0 : this.stopAge+dt;
      const pace=!input.grounded || stopped ? 0 : smooth(.10,.72,speed);
      const strafe=smooth(.20,.84,Math.abs(side)/Math.max(speed,.01));
      const back=advance<0 ? (1-strafe)*smooth(.15,.8,-advance) : 0;
      const run=smooth(1.65,3.25,speed), sprint=smooth(3.80,5.25,speed);
      const turning=input.grounded ? (1-pace)*smooth(.24,1.38,Math.abs(turnRate)) : 0;
      const stopping=input.grounded && stopped ? (1-turning)*(1-smooth(0,.32,this.stopAge)) : 0;
      const forwardWeight=pace*(1-strafe-back);
      const target=this.targetWeights;
      target.Idle=1-pace-turning-stopping;
      target.Walk=forwardWeight*(1-run);
      target.Run=forwardWeight*run*(1-sprint);
      target.Sprint=forwardWeight*run*sprint;
      target.Strafe=pace*strafe;
      target.Backward=pace*back;
      target.Turn=turning;
      target.Stop=stopping;
      this.state="Idle";
      const gaitBlend=1-Math.exp(-dt*13);
      for(const name of locomotionStates) {
        this.weights[name]=mix(this.weights[name],target[name],gaitBlend);
        if(target[name]>target[this.state]) this.state=name;
      }

      let travel=0, stance=0, stanceWeight=0;
      for(const name of movingGaits) {
        const gait=this.gaits[name];
        if(gait.stride) travel+=gait.stride*target[name];
        stance+=gait.stance*this.weights[name];
        stanceWeight+=this.weights[name];
      }
      const frequency=(travel>1e-6 ? pace*pace*speed/travel : 0)+turning*this.gaits.Turn.frequency;
      const moving=pace+turning>.16;
      // Lift the first foot on departure, instead of dragging both idle anchors.
      if(moving && !this.moving) this.phase=Math.ceil(this.phase)+Math.min(.93,this.gaits.Walk.stance+.06);
      this.moving=moving;
      const oldPhase=this.phase;
      this.phase+=frequency*dt;
      const lean=[clamp((advance-this.speed[1])/dt,-11,11)*.017,
        clamp((side-this.speed[2])/dt,-11,11)*.017,clamp(turnRate*.065,-.21,.21)];
      this.speed=[speed,advance,side];
      A.spring(this.motion,this.acceleration,lean,14,.89,dt);
      this.previousResponse=this.response.slice();
      A.spring(this.response,this.responseVelocity,[0,0,0],13,.91,dt);
      this.previousToolResponse=this.toolResponse.slice();
      A.spring(this.toolResponse,this.toolVelocity,[0,0,0],22,.90,dt);

      this.previousToolWeight=this.toolWeight;
      this.previousToolTime=this.toolTime;
      if(this.activeTool!==this.action && this.toolWeight<.001) {
        this.activeTool=this.action;
        this.previousToolWeight=this.toolWeight=0;
        this.previousToolTime=this.toolTime=0;
      }
      const holding=this.activeTool && this.activeTool===this.action;
      this.toolWeight=mix(this.toolWeight,Number(Boolean(holding)),1-Math.exp(-dt*15));
      const fade=1-Math.exp(-dt*14);
      this.strafeDirection=mix(this.strafeDirection,smooth(-.24,.24,side),fade);
      this.turnDirection=mix(this.turnDirection,smooth(-.28,.28,turnRate),fade);
      if(this.activeTool) this.toolTime+=dt;
      const layers=this.layers;
      layers.length=0;
      for(const name of locomotionStates) {
        const w=this.weights[name];
        if(w<.0001) continue;
        if(name==="Strafe" || name==="Turn") {
          const direction=name==="Strafe" ? this.strafeDirection : this.turnDirection;
          for(const [suffix,weight] of [["Left",w*(1-direction)],["Right",w*direction]]) {
            const clip=this.clips[name+suffix]??this.clips[name];
            if(clip && weight>.0001) layers.push({clip,time:this.phase*clip.duration,weight});
          }
        } else {
          const clip=this.clips[name];
          if(clip) layers.push({clip,time:name==="Idle" ? this.time : name==="Stop" ? this.stopAge : this.phase*clip.duration,weight:w});
        }
      }
      if(this.activeTool?.clip) {
        layers.push({clip:this.activeTool.clip,time:this.toolTime,weight:this.toolWeight,mask:this.activeTool.mask??this.upperMask,
          mode:this.activeTool.additive===false ? "override" : "additive"});
      }
      if(holding && this.action.clip) this.action.clip.emit(this.previousToolTime,this.toolTime,event=>this.event({...event,at:input.at}));
      const local=this.mixer.evaluate(layers,this.pose.local);
      const [pitch,roll,yaw]=this.motion, [hitPitch,hitRoll,hitDrop]=this.response;
      const root=this.rig.pelvis*A.stride;
      local[root+1]+=clamp(hitDrop,-.14,.08);
      const [toolPitch,toolRoll]=this.toolResponse;
      turn(local,this.rig.spine,right,clamp(pitch+hitPitch+toolPitch*.25,-.35,.35));
      turn(local,this.rig.spine,forward,clamp(-roll+hitRoll+toolRoll*.22,-.31,.31));
      turn(local,this.rig.spine,up,yaw);
      turn(local,this.rig.head,right,-.29*(pitch+hitPitch));
      turn(local,this.rig.head,forward,-.34*(hitRoll-roll));
      this.pose.update();

      const model=transform(input.at,0,-input.yaw);
      const cycle=this.phase%1;
      stance=stanceWeight>.001 ? stance/stanceWeight : gaitDefaults.Walk.stance;
      for(const [i,leg] of this.rig.legs.entries()) {
        const foot=this.feet[i], ankle=point(model,this.pose.at(leg[2]));
        foot.previousAnchor=foot.anchor;
        foot.previousAmount=foot.amount;
        const ground=input.grounded ? this.ground(ankle[0],ankle[2],ankle[1]) : null;
        const planted=Boolean(ground && (!moving || (cycle+i*.5)%1<stance));
        if(planted && (!foot.planted || !foot.anchor)) {
          foot.anchor={at:fitFloor(ankle,ground,this.ankleHeight),normal:ground.normal??up,yaw:input.yaw};
          if(moving && !foot.planted && this.phase>oldPhase) {
            this.event({name:"footstep",side:i,at:[ankle[0],ground.y,ankle[2]],speed,
              surface:ground.surface??"dirt",stepBank:ground.stepBank});
          }
        }
        foot.planted=planted;
        foot.amount=mix(foot.amount,Number(planted),1-Math.exp(-dt*(planted ? 68 : 40)));
        if(foot.amount>.90 && planted) foot.amount=1;
        if(!input.grounded || (!planted && foot.amount<.012)) {
          foot.anchor=null;
          foot.amount=0;
        }
      }
      const targets=this.feet.map(foot=>foot.planted ? foot.anchor?.at : null);
      const drop=this.pelvisDrop(this.pose,model,targets);
      this.lift=mix(this.lift,drop,1-Math.exp(-dt*(drop>this.lift ? 55 : 16)));
      local[root+1]-=this.lift;
    }

    pelvisDrop(pose,model,targets) {
      let drop=0;
      for(const [i,leg] of this.rig.legs.entries()) {
        const target=targets[i];
        if(!target) continue;
        const [hip,knee,ankle]=leg.map(j=>pose.at(j));
        const origin=point(model,hip), maximum=Math.hypot(...minus(knee,hip))+Math.hypot(...minus(ankle,knee))-.012;
        const side=Math.hypot(origin[0]-target[0],origin[2]-target[2]);
        const height=origin[1]-target[1]-Math.sqrt(Math.max(.01,maximum*maximum-side*side));
        drop=Math.max(drop,clamp(height,0,.19));
      }
      return drop;
    }

    applyFeet(pose,model,inverse,yaw,alpha) {
      if(!this.frame.grounded) return;
      const feet=this.rig.legs.map((leg,i)=>{
        const foot=this.feet[i], ankle=point(model,pose.at(leg[2]));
        const ground=this.ground(ankle[0],ankle[2],ankle[1]);
        const anchor=foot.anchor??foot.previousAnchor;
        if(!ground && !anchor) return null;
        const weight=mix(foot.previousAmount,foot.amount,alpha);
        const surface=ground ? fitFloor(ankle,ground,this.ankleHeight) : ankle;
        let target=[ankle[0],Math.max(ankle[1],surface[1]),ankle[2]];
        if(anchor) {
          const prior=foot.previousAnchor??anchor;
          target=lerp(target,lerp(prior.at,anchor.at,alpha),weight);
        }
        return {leg,target,anchor,weight,side:i};
      });
      const drop=this.pelvisDrop(pose,model,feet.map(foot=>foot?.target));
      if(drop>0) {
        pose.local[this.rig.pelvis*A.stride+1]-=drop;
        pose.update(this.rig.pelvis);
      }
      for(const foot of feet) {
        if(!foot) continue;
        const {leg,target,anchor,weight,side}=foot;
        A.solveChain(pose,leg,point(inverse,target),this.rig.kneePoles?.[side]??[0,.10,-1],this.rig.kneeLimits??standingLeg);
        if(anchor && weight>.001) {
          const slope=A.fromTo(up,unit(direction(inverse,anchor.normal)));
          const q=A.combine(slope,A.rotation(up,-wrapAngle(anchor.yaw-yaw)));
          pose.worldRotation(leg[2],q,weight);
          pose.update(leg[2]);
        }
      }
    }

    applyTool(pose,inverse,yaw,tool,weight) {
      if(!tool?.grips || weight<.0001) return;
      this.rig.arms.forEach((chain,i)=>{
        const grip=tool.grips[i];
        if(!grip) return;
        const local=point(inverse,grip.at), wrist=lerp(pose.at(chain[2]),local,weight);
        const pole=this.rig.elbowPoles?.[i]??[i ? .73 : -.73,-1,.31];
        A.solveChain(pose,chain,wrist,pole,this.rig.elbowLimits??{min:.10,max:2.64});
        if(grip.rotation) {
          pose.worldRotation(chain[2],A.combine(A.rotation(up,yaw),grip.rotation),weight);
          pose.update(chain[2]);
        }
      });
    }

    render(meshes) {
      const alpha=this.alpha;
      A.lerpPose(this.previous,this.pose.local,alpha,this.drawPose.local);
      this.drawPose.update();
      const at=lerp(this.previousFrame.at,this.frame.at,alpha);
      const yaw=this.previousFrame.yaw+wrapAngle(this.frame.yaw-this.previousFrame.yaw)*alpha;
      const model=transform(at,0,-yaw), inverse=A.inverse(model);
      this.applyFeet(this.drawPose,model,inverse,yaw,alpha);
      const weight=smooth(0,.96,mix(this.previousToolWeight,this.toolWeight,alpha));
      const tool=this.activeTool?.pose?.({model,pose:this.drawPose,weight,time:mix(this.previousToolTime,this.toolTime,alpha),
        response:lerp(this.previousResponse,this.response,alpha),recoil:lerp(this.previousToolResponse,this.toolResponse,alpha)});
      this.applyTool(this.drawPose,inverse,yaw,tool,weight);
      this.skeleton.palette(this.drawPose.world,this.skins);
      const parts=meshes.map(mesh=>({mesh,matrix:model,palette:this.skins}));
      if(tool?.parts) parts.push(...tool.parts);
      return {model,pose:this.drawPose,parts,weight,grips:tool?.grips};
    }
  }

  Valley.Character=Character;
  Valley.gaitDefaults=gaitDefaults;
})();
