"use strict";

(() => {
  const {clamp,mix,plus,minus,times,dot,cross,unit,multiply}=Valley;
  const stride=10;
  const identity=[0,0,0,1];
  const fields={translation:[0,3],rotation:[3,4],scale:[7,3]};
  const wrap=(value,length)=>((value%length)+length)%length;
  const normalize=q=>times(q,1/(Math.hypot(...q)||1));
  const quatDot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
  const conjugate=([x,y,z,w])=>[-x,-y,-z,w];

  function rotation(axis,radians) {
    return [...times(unit(axis),Math.sin(radians*.5)),Math.cos(radians*.5)];
  }

  function fromTo(a,b) {
    const from=unit(a),to=unit(b), cosine=dot(from,to);
    if(cosine<-.9999) return rotation(cross(from,Math.abs(from[0])<.8 ? [1,0,0] : [0,1,0]),Math.PI);
    return normalize([...cross(from,to),1+cosine]);
  }

  function rotate([x,y,z,w],v) {
    const q=[x,y,z], t=times(cross(q,v),2);
    return plus(v,plus(times(t,w),cross(q,t)));
  }

  function combine([x,y,z,w],[a,b,c,d]) {
    return [w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c];
  }

  function slerp(a,b,t) {
    let cosine=quatDot(a,b);
    if(cosine<0) {
      cosine=-cosine;
      b=times(b,-1);
    }
    if(cosine>.9995) return normalize(a.map((n,i)=>mix(n,b[i],t)));
    const angle=Math.acos(clamp(cosine,-1,1)), divisor=Math.sin(angle);
    return plus(times(a,Math.sin((1-t)*angle)/divisor),times(b,Math.sin(t*angle)/divisor));
  }

  function matrix([tx,ty,tz,x,y,z,w,sx,sy,sz],out=new Float32Array(16)) {
    out.set([
      sx*(1-2*(y*y+z*z)),sx*2*(x*y+w*z),sx*2*(x*z-w*y),0,
      sy*2*(x*y-w*z),sy*(1-2*(x*x+z*z)),sy*2*(y*z+w*x),0,
      sz*2*(x*z+w*y),sz*2*(y*z-w*x),sz*(1-2*(x*x+y*y)),0,tx,ty,tz,1
    ]);
    return out;
  }

  function inverse(m) {
    const a=[m[0],m[1],m[2]], b=[m[4],m[5],m[6]], c=[m[8],m[9],m[10]], t=[m[12],m[13],m[14]];
    const u=cross(b,c), v=cross(c,a), w=cross(a,b), determinant=dot(a,u);
    if(Math.abs(determinant)<1e-10) throw new Error("Singular joint transform.");
    return new Float32Array([u[0],v[0],w[0],0,u[1],v[1],w[1],0,u[2],v[2],w[2],0,
      -dot(u,t),-dot(v,t),-dot(w,t),determinant].map(n=>n/determinant));
  }

  function decompose(m) {
    const sx=Math.hypot(m[0],m[1],m[2]), sy=Math.hypot(m[4],m[5],m[6]), sz=Math.hypot(m[8],m[9],m[10]);
    const a=[m[0],m[1],m[2]], b=[m[4],m[5],m[6]], c=[m[8],m[9],m[10]];
    const x=dot(a,cross(b,c))<0 ? -sx : sx;
    if(!x || !sy || !sz) throw new Error("Joint matrix has a zero scale.");
    const [r00,r10,r20]=times(a,1/x), [r01,r11,r21]=times(b,1/sy), [r02,r12,r22]=times(c,1/sz);
    const sizes=[1+r00-r11-r22,1-r00+r11-r22,1-r00-r11+r22,1+r00+r11+r22];
    const k=sizes.indexOf(Math.max(...sizes)), r=.5*Math.sqrt(sizes[k]), s=.25/r;
    const q=[
      [r,(r10+r01)*s,(r20+r02)*s,(r21-r12)*s],
      [(r10+r01)*s,r,(r12+r21)*s,(r02-r20)*s],
      [(r20+r02)*s,(r12+r21)*s,r,(r10-r01)*s],
      [(r21-r12)*s,(r02-r20)*s,(r10-r01)*s,r]
    ][k];
    return [m[12],m[13],m[14],...normalize(q),x,sy,sz];
  }

  class Skeleton {
    constructor(bones,{joints=bones.map((_,i)=>i),inverseBinds}={}) {
      this.bones=bones;
      this.joints=joints;
      this.rest=new Float32Array(bones.length*stride);
      this.names=new Map();
      this.order=[];
      this.children=bones.map(()=>[]);
      const visited=new Uint8Array(bones.length);
      const visit=i=>{
        if(visited[i]===1) throw new Error("Cyclic skeleton.");
        if(visited[i]===2) return;
        visited[i]=1;
        const bone=bones[i], parent=bone.parent??-1;
        if(!Number.isInteger(parent) || parent < -1 || parent>=bones.length) throw new Error("Invalid joint parent.");
        if(parent>=0) visit(parent);
        if(parent>=0) this.children[parent].push(i);
        if(bone.name && !this.names.has(bone.name)) this.names.set(bone.name,i);
        this.rest.set(bone.matrix ? decompose(bone.matrix) : [
          ...(bone.translation??[0,0,0]),...normalize(bone.rotation??identity),...(bone.scale??[1,1,1])
        ],i*stride);
        visited[i]=2;
        this.order.push(i);
      };
      bones.forEach((_,i)=>visit(i));
      if(joints.some(i=>!bones[i]) || new Set(joints).size!==joints.length) throw new Error("Invalid skin joint order.");
      if(inverseBinds && inverseBinds.length!==joints.length) throw new Error("Invalid inverse-bind matrix count.");
      const bind=inverseBinds ? null : this.globals(this.rest);
      this.inverseBinds=inverseBinds??joints.map(i=>inverse(bind[i]));
    }

    index(name) {
      const i=typeof name==="string" ? this.names.get(name) : name;
      if(!Number.isInteger(i) || !this.bones[i]) throw new Error("Unknown joint: "+name);
      return i;
    }

    joint(i,pose,out,rotations,local) {
      matrix(pose.subarray(i*stride,(i+1)*stride),local);
      const parent=this.bones[i].parent??-1;
      if(parent<0) out[i].set(local);
      else multiply(out[parent],local,out[i]);
      if(rotations) {
        const q=pose.subarray(i*stride+3,i*stride+7);
        rotations[i]=parent<0 ? Array.from(q) : combine(rotations[parent],q);
      }
    }

    globals(pose,out=this.bones.map(()=>new Float32Array(16)),rotations=null,local=new Float32Array(16)) {
      for(const i of this.order) this.joint(i,pose,out,rotations,local);
      return out;
    }

    palette(globals,out=new Float32Array(this.joints.length*16)) {
      this.joints.forEach((i,j)=>multiply(globals[i],this.inverseBinds[j],out.subarray(j*16,(j+1)*16)));
      return out;
    }
  }

  class Pose {
    constructor(skeleton) {
      this.skeleton=skeleton;
      this.local=skeleton.rest.slice();
      this.world=skeleton.bones.map(()=>new Float32Array(16));
      this.rotations=new Array(skeleton.bones.length);
      this.scratch=new Float32Array(16);
      this.update();
    }

    update(from) {
      if(from===undefined) this.skeleton.globals(this.local,this.world,this.rotations,this.scratch);
      else {
        this.skeleton.joint(from,this.local,this.world,this.rotations,this.scratch);
        for(const i of this.skeleton.children[from]) this.update(i);
      }
    }

    at(index) {
      const m=this.world[index];
      return [m[12],m[13],m[14]];
    }

    worldRotation(index,q,weight=1) {
      const parent=this.skeleton.bones[index].parent??-1;
      const local=parent<0 ? q : combine(conjugate(this.rotations[parent]),q);
      const offset=index*stride+3;
      this.local.set(slerp(this.local.subarray(offset,offset+4),local,weight),offset);
    }

    aim(index,child,target,weight=1) {
      const start=this.at(index), before=minus(this.at(child),start), after=minus(target,start);
      if(Math.hypot(...before)<1e-6 || Math.hypot(...after)<1e-6) return;
      this.worldRotation(index,combine(fromTo(before,after),this.rotations[index]),weight);
    }
  }

  function lerpPose(a,b,t,out) {
    for(let i=0;i<a.length;i+=stride) {
      for(const offset of [0,1,2,7,8,9]) out[i+offset]=mix(a[i+offset],b[i+offset],t);
      out.set(slerp(a.subarray(i+3,i+7),b.subarray(i+3,i+7),t),i+3);
    }
    return out;
  }

  class Clip {
    constructor(name,tracks,{duration,loop=true,events=[]}={}) {
      this.name=name;
      this.loop=loop;
      const end=tracks.reduce((latest,track)=>Math.max(latest,track.times.at(-1)??0),0);
      this.duration=duration??end;
      if(!Number.isFinite(this.duration) || this.duration<end) throw new Error("Invalid animation duration.");
      this.events=[...events].sort((a,b)=>a.time-b.time);
      if(this.events.some(e=>!Number.isFinite(e.time) || e.time<0 || e.time>this.duration)) throw new Error("Invalid animation event.");
      this.tracks=tracks.map(track=>{
        const field=fields[track.path], interpolation=track.interpolation??"LINEAR";
        if(!field || !["LINEAR","STEP","CUBICSPLINE"].includes(interpolation)) throw new Error("Unsupported animation track.");
        const [offset,size]=field, cubic=interpolation==="CUBICSPLINE";
        if(!Number.isInteger(track.bone) || track.bone<0 || !track.times.length
          || track.times.some((t,i)=>!Number.isFinite(t) || t<0 || (i && t<=track.times[i-1]))
          || track.values.length!==track.times.length*size*(cubic ? 3 : 1)
          || track.values.some(v=>!Number.isFinite(v))) throw new Error("Invalid animation samples.");
        return {...track,times:Float32Array.from(track.times),values:Float32Array.from(track.values),
          start:track.bone*stride+offset,size,interpolation,cubic};
      });
    }

    sample(time,rest,out) {
      const t=this.loop && this.duration ? wrap(time,this.duration) : clamp(time,0,this.duration);
      out.set(rest);
      for(const track of this.tracks) {
        const {times,values,start,size,cubic,path,interpolation}=track;
        let left=0,right=times.length-1;
        if(t<=times[0]) right=0;
        else if(t>=times[right]) left=right;
        else while(right-left>1) {
          const middle=(left+right)>>1;
          if(t<times[middle]) right=middle;
          else left=middle;
        }
        const a=(cubic ? left*3+1 : left)*size, b=(cubic ? right*3+1 : right)*size;
        if(left===right || interpolation==="STEP") {
          for(let k=0;k<size;k++) out[start+k]=values[a+k];
          if(path==="rotation") out.set(normalize(out.subarray(start,start+4)),start);
          continue;
        }
        const span=times[right]-times[left], f=(t-times[left])/span;
        if(cubic) {
          const f2=f*f, f3=f2*f;
          for(let k=0;k<size;k++) out[start+k]=(2*f3-3*f2+1)*values[a+k]+(f3-2*f2+f)*span*values[a+size+k]
            +(-2*f3+3*f2)*values[b+k]+(f3-f2)*span*values[b-size+k];
          if(path==="rotation") out.set(normalize(out.subarray(start,start+4)),start);
        } else if(path==="rotation") {
          out.set(slerp(values.subarray(a,a+4),values.subarray(b,b+4),f),start);
        } else {
          for(let k=0;k<size;k++) out[start+k]=mix(values[a+k],values[b+k],f);
        }
      }
      return out;
    }

    emit(from,to,notify) {
      if(to<=from || this.duration<=0) return;
      const first=this.loop ? Math.floor(from/this.duration) : 0;
      const last=this.loop ? Math.floor(to/this.duration) : 0;
      for(let cycle=first;cycle<=last;cycle++) for(const event of this.events) {
        const time=cycle*this.duration+event.time;
        if(time>from && time<=to) notify(event);
      }
    }
  }

  class Mixer {
    constructor(skeleton) {
      this.rest=skeleton.rest;
      this.sample=new Float32Array(this.rest.length);
      this.sum=new Float32Array(this.rest.length/stride);
      this.coverage=new WeakMap();
    }

    evaluate(layers,out) {
      out.set(this.rest);
      this.sum.fill(0);
      for(const {clip,time,weight=1,mask,mode} of layers) {
        if(mode==="additive" || mode==="override" || weight<=0) continue;
        clip.sample(time,this.rest,this.sample);
        for(let i=0;i<this.sum.length;i++) {
          const w=weight*(mask?.[i]??1);
          if(w<=0) continue;
          this.sum[i]+=w;
          this.blend(out,i,w/this.sum[i],false);
        }
      }
      for(let i=0;i<this.sum.length;i++) {
        const restWeight=1-this.sum[i];
        if(restWeight>0 && restWeight<1) {
          const start=i*stride, q=start+3;
          for(const offset of [0,1,2,7,8,9]) out[start+offset]=mix(out[start+offset],this.rest[start+offset],restWeight);
          out.set(slerp(out.subarray(q,q+4),this.rest.subarray(q,q+4),restWeight),q);
        }
      }
      for(const mode of ["override","additive"]) {
        for(const layer of layers) {
          const {clip,time,weight=1,mask}=layer;
          if(layer.mode!==mode || weight<=0) continue;
          clip.sample(time,this.rest,this.sample);
          let coverage=this.coverage.get(clip);
          if(!coverage) {
            coverage=new Uint8Array(this.sum.length);
            for(const track of clip.tracks) coverage[track.bone]|=track.path==="translation" ? 1 : track.path==="rotation" ? 2 : 4;
            this.coverage.set(clip,coverage);
          }
          for(let i=0;i<this.sum.length;i++) {
            const w=weight*(mask?.[i]??1);
            if(w>0 && coverage[i]) this.blend(out,i,clamp(w,0,1),mode==="additive",coverage[i]);
          }
        }
      }
      return out;
    }

    blend(out,i,w,additive,channels=7) {
      const start=i*stride, q=start+3, a=out.subarray(q,q+4), b=this.sample.subarray(q,q+4);
      for(const offset of [0,1,2,7,8,9]) {
        if(!(channels & (offset<3 ? 1 : 4))) continue;
        const k=start+offset;
        out[k]=additive ? out[k]+(this.sample[k]-this.rest[k])*w : mix(out[k],this.sample[k],w);
      }
      if(!(channels & 2)) return;
      const delta=additive ? combine(conjugate(this.rest.subarray(q,q+4)),b) : null;
      out.set(additive ? normalize(combine(a,slerp(identity,delta,w))) : slerp(a,b,w),q);
    }
  }

  function spring(value,velocity,target,frequency,damping,dt) {
    for(let i=0;i<target.length;i++) {
      velocity[i]+=dt*(frequency*frequency*(target[i]-value[i])-2*damping*frequency*velocity[i]);
      value[i]+=dt*velocity[i];
    }
  }

  class FixedStep {
    constructor(rate=120) {
      this.dt=1/rate;
      this.remainder=0;
    }

    advance(seconds,update) {
      const frame=clamp(seconds,0,.10);
      let next=this.dt-this.remainder;
      for(;next<=frame+1e-9;next+=this.dt) update(this.dt,clamp(next/Math.max(frame,1e-9),0,1));
      this.remainder=clamp(frame+this.dt-next,0,this.dt);
      return this.remainder/this.dt;
    }
  }

  function twoBone(start,target,upper,lower,pole,{min=.05,max=2.78}={}) {
    const delta=minus(target,start), raw=Math.hypot(...delta);
    const heading=raw>1e-8 ? times(delta,1/raw) : [0,0,-1];
    const limit=angle=>Math.sqrt(upper*upper+lower*lower+2*upper*lower*Math.cos(angle));
    const length=clamp(raw,Math.max(1e-5,limit(max)),limit(min));
    let bend=minus(pole,times(heading,dot(pole,heading)));
    if(Math.hypot(...bend)<.001) bend=cross(heading,Math.abs(heading[1])<.9 ? [0,1,0] : [1,0,0]);
    const along=(upper*upper-lower*lower+length*length)/(2*length);
    const middle=plus(start,plus(times(heading,along),times(unit(bend),Math.sqrt(Math.max(0,upper*upper-along*along)))));
    return {middle,end:plus(start,times(heading,length))};
  }

  function solveChain(pose,[upper,lower,end],target,pole,limits) {
    const start=pose.at(upper), mid=pose.at(lower), tip=pose.at(end);
    const lengthA=Math.hypot(...minus(mid,start)), lengthB=Math.hypot(...minus(tip,mid));
    if(lengthA<1e-5 || lengthB<1e-5) return;
    const chain=twoBone(start,target,lengthA,lengthB,pole,limits);
    pose.aim(upper,lower,chain.middle);
    pose.update(upper);
    pose.aim(lower,end,chain.end);
    pose.update(lower);
  }

  Valley.animation={stride,identity,rotation,combine,conjugate,slerp,fromTo,rotate,matrix,inverse,decompose,lerpPose,wrap,
    Skeleton,Pose,Clip,Mixer,spring,FixedStep,twoBone,solveChain};
})();
