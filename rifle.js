"use strict";

(() => {
  const {Builder,launcher,rgb,plus,minus,times,cross,unit,mix,smooth,transform,multiply,direction,point}=Valley;
  const carCount=6;
  const slot=launcher.slot;
  const carOrder=[5,0,1,2,3,4];
  const muzzle=[0,.017,-1.525];
  const center=-.531;
  const port={x:.068,y:.030,z:-.273,width:.116,height:.054,travel:-.123};
  const trackX=.027, trackY=port.y-.018;
  const station=i=>port.z-slot*(carCount-1-i);
  const throat=[port.x+.041,trackY,port.z];
  const motorButton={at:[-.012,-.116,-.503],travel:.0072};
  const thumbHinge=[-.075,-.153,-.531];
  const rearHandle={at:[0,-.151,.057],size:[.084,.183,.091],pitch:-.17};
  const beltFace=point(transform(rearHandle.at,rearHandle.pitch),[0,.052,-rearHandle.size[2]*.5]);
  const beltSwitchPose=transform(beltFace,rearHandle.pitch);
  const beltSwitchTravel=.0052;
  const indexHinge=[.062,-.102,.079];
  const reload={
    slideStart:.338,slideEnd:.47,openEnd:.51,pickup:.19,gatherEnd:.43,present:.087,push:.188,seat:.337,insertEnd:.417,
    stashEnd:.28,closeStart:.195,latch:.337,closeEnd:.575,cancelEnd:.385
  };
  const inspection={open:1.61,opened:1.94,shut:3.07,latched:3.39,end:4.32};
  const foregrip={pad:[.023,-.111,-.613],pitch:.11,yaw:.18,roll:-.19,grip:.90,pinch:.49};
  const pocket=[-.485,.434,.172];
  const hazard=rgb(0xe7b526), black=rgb(0x28272a);
  const purple=rgb(0x746788), edge=rgb(0x8c819e), seam=rgb(0x4b405c);
  const red=rgb(0xc03931), green=rgb(0x74c74a), dark=rgb(0x28232d);

  function decals(b,at,u,v,polygon,slope,period,phase=0) {
    const normal=cross(u,v);
    const value=p=>p[0]+p[1]*slope+phase;
    function clip(polygon,bound,sign) {
      const result=[];
      for(let i=0;i<polygon.length;i++) {
        const a=polygon[i], c=polygon[(i+1)%polygon.length];
        const da=(value(a)-bound)*sign, dc=(value(c)-bound)*sign;
        if(da>=0) result.push(a);
        if((da>=0)!==(dc>=0)) result.push(a.map((n,k)=>mix(n,c[k],da/(da-dc))));
      }
      return result;
    }
    const local=([s,t])=>plus(plus(at,times(u,s)),plus(times(v,t),times(normal,.00036)));
    const extent=polygon.map(value);
    for(let x=period*Math.floor(Math.min(...extent)/period);x<Math.max(...extent);x+=period) {
      const band=clip(clip(polygon,x,1),x+period*.51,-1).map(local);
      for(let i=1;i<band.length-1;i++) b.triangle(band[0],band[i],band[i+1],black);
    }
  }

  const rect=(w,low,high)=>[[-w*.5,low],[w*.5,low],[w*.5,high],[-w*.5,high]];

  function collar(b,x,z) {
    const count=48, radius=.044, low=-.027, high=.084;
    const rows=[[0,.895,-.72],[.062,1,-.26],[.45,1,0],[.83,1,0],[.94,1,.26],[1,.895,.72]];
    const rings=rows.map(([t,r,bevel])=>Array.from({length:count+1},(_,i)=>{
      const a=i/count*Math.PI*2+t*.89;
      return {at:[x+radius*r*Math.cos(a),mix(low,high,t),z+radius*r*Math.sin(a)],
        normal:unit([Math.cos(a),bevel,Math.sin(a)]),uv:[i/count,t]};
    }));
    for(let i=0;i<count;i++) {
      const color=Math.floor(i/6)%2 ? black : hazard;
      for(let j=1;j<rings.length;j++) {
        const a=rings[j-1], c=rings[j];
        const face=[a[i+1],a[i],c[i],c[i+1]].map(p=>b.vertex(p.at,p.normal,p.uv,color));
        b.indices.push(face[0],face[1],face[2],face[0],face[2],face[3]);
      }
    }
    b.cylinder([x,low,z],[x,high,z],radius*.895,radius*.895,hazard,count);
    const cap=Array.from({length:count},(_,i)=>{
      const a=i/count*Math.PI*2;
      return [radius*.894*Math.cos(a),radius*.894*Math.sin(a)];
    });
    decals(b,[x,high,z],[1,0,0],[0,0,-1],cap,.58,.049,.006);
  }

  function stockPad(b) {
    const y=.026,z=.405,width=.041,height=.133,length=.110;
    for(const side of [-1,1]) {
      const x=side*.067;
      b.box([x,y,z],[width,height,length],hazard,.008);
      const face=[x+side*width*.5,y,z], along=[0,0,-side], up=[0,1,0];
      const half=height*.5-.008;
      decals(b,face,along,up,rect(length-.015,0,half),side*.62,.059,.011);
      decals(b,face,along,up,rect(length-.015,-half,0),-side*.62,.059,.011);
      decals(b,[x,y+height*.5,z],[1,0,0],[0,0,-1],rect(width-.014,-.048,.048),side*.39,.055);
    }
    b.box([0,y,z+.046],[.148,.128,.023],hazard,.007);
    decals(b,[0,y,z+.0575],[1,0,0],[0,1,0],rect(.134,-.056,.056),.69,.057,.019);
    b.box([0,-.096,z+.038],[.156,.117,.041],seam,.009);
    b.box([0,-.106,z+.057],[.139,.087,.010],purple,.005);
  }

  function section(z,w,low,high,bevel,slant=0) {
    const x=w*.5, b=bevel;
    return [[-x+b,low],[x-b,low],[x,low+b],[x,high-b],[x-b,high],[-x+b,high],[-x,high-b],[-x,low+b]]
      .map(([x,y])=>[x,y,z+slant*(y-low)/(high-low)]);
  }

  function skin(b,from,to,tint,omit=-1) {
    const shades=[.83,.91,.98,1.06,1.06,1.09,1,.90];
    for(let i=0;i<from.length;i++) {
      if(i===omit) continue;
      const j=(i+1)%from.length, face=[from[i],from[j],to[j],to[i]];
      b.quad(face,times(tint,shades[i]),null,face.map(([x,y,z])=>[.50+x*2.6+y*2.2,(z+1.48)*.51]));
    }
  }

  function cap(b,ring,color) {
    for(let i=1;i<ring.length-1;i++) b.triangle(ring[0],ring[i],ring[i+1],color);
  }

  function housing(body) {
    const nose=section(-1.392,.094,-.022,.081,.005,.107);
    const mouth=section(-1.386,.077,-.014,.066,.003,.094);
    const inside=section(-1.178,.077,-.014,.066,.003);
    const front=section(-.632,.115,-.032,.080,.006);
    skin(body,nose,front,purple);
    skin(body,mouth,nose,edge);
    skin(body,inside,mouth,dark);
    cap(body,inside.slice().reverse(),dark);

    const low=-.052, high=.079, bevel=.008, portWidth=port.x*2;
    const forward=section(-.490,portWidth,low,high,bevel);
    const near=section(port.z-port.width*.5,portWidth,low,high,bevel);
    const far=section(port.z+port.width*.5,portWidth,low,high,bevel);
    const rear=section(.123,portWidth,low,high,bevel);
    const heel=section(.158,.127,-.055,.075,.008);
    skin(body,front,forward,purple);
    skin(body,forward,near,purple);
    skin(body,near,far,purple,2);
    skin(body,far,rear,purple);
    skin(body,rear,heel,purple);
    cap(body,heel,purple);
    const bottom=port.y-port.height*.5, top=port.y+port.height*.5, x=port.x;
    for(const [from,to] of [[low+bevel,bottom],[top,high-bevel]]) {
      body.quad([[x,from,near[2][2]],[x,to,near[2][2]],[x,to,far[2][2]],[x,from,far[2][2]]],purple,[1,0,0]);
    }
    const opening=rect(port.width,bottom,top).map(([d,y])=>[x,y,port.z-d]);
    const recess=opening.map(([x,y,z])=>[x-.103,y,z]);
    for(const i of [0,2,3]) {
      const j=(i+1)%opening.length;
      body.quad([opening[i],opening[j],recess[j],recess[i]],i===0 ? seam : dark);
    }
    cap(body,recess,dark);
    body.box([0,-.055,-.377],[.112,.031,.465],seam,.008);
    body.box([0,-.062,.051],[.118,.045,.196],purple,.008);
  }

  function build(renderer) {
    const body=new Builder(), door=new Builder(), switchCap=new Builder(), button=new Builder(), track=new Builder();
    housing(body);
    const exitBack=-1.179, exitLength=exitBack-muzzle[2], exitCenter=(muzzle[2]+exitBack)*.5;
    body.box([0,-.009,exitCenter],[.072,.008,exitLength],green,.002);
    for(const s of [-1,1]) {
      body.box([s*.0335,.001,exitCenter],[.005,.013,exitLength],green,.0018);
      body.box([s*.0335,.0073,exitCenter],[.003,.0017,exitLength-.014],times(green,1.12),.0006);
      body.box([s*.056,.017,.245],[.021,.030,.295],purple,.006,[.056,0,-s*.04]);
      body.box([s*.056,.005,.243],[.016,.005,.265],seam,.001,[.056,0,0]);
      collar(body,s*.054,-.578);
      body.cylinder([s*.067,.032,.091],[s*.073,.032,.091],.022,.022,seam,32);
      body.cylinder([s*.072,.032,.091],[s*.077,.032,.091],.019,.0175,hazard,32);
      body.cylinder([s*.077,.032,.091],[s*.078,.032,.091],.012,.0115,times(hazard,1.055),28);
    }
    stockPad(body);
    body.box(rearHandle.at,rearHandle.size,purple,.008,[rearHandle.pitch,0,0]);
    body.box([0,-.150,-.556],[.081,.211,.092],purple,.009,[-.035,0,0]);
    for(const z of [.057,-.556]) {
      body.box([0,-.242,z+.009],[.084,.014,.088],seam,.005);
      for(const side of [-1,1]) {
        body.box([side*.039,-.183,z+.014],[.005,.087,.059],seam,.0025);
        for(let i=0;i<3;i++) body.box([side*.042,-.166-i*.017,z+.013],[.0025,.0038,.041],purple,.001);
      }
    }
    body.box([-.012,-.116,-.506],[.043,.049,.008],seam,.004);
    button.box(motorButton.at,[.034,.039,.016],green,.003);
    button.box([-.012,-.110,-.495],[.025,.003,.0018],times(green,1.15),.0006);
    body.box(beltFace,[.043,.051,.0046],seam,.002,[rearHandle.pitch,0,0]);
    switchCap.box([0,0,-.0045],[.033,.041,.0085],green,.0026);
    switchCap.box([0,.011,-.0084],[.024,.003,.0018],times(green,1.14),.0006);
    const front=station(0)-.058, back=port.z+port.width*.5;
    const trayCenter=(front+back)*.5, trayLength=back-front;
    track.box([trackX,trackY-.006,trayCenter],[.061,.010,trayLength],rgb(0x51515c),.002);
    for(const side of [-1,1]) {
      body.box([trackX+side*.027,trackY+.001,trayCenter],[.004,.004,trayLength],times(edge,.81),.0012);
    }
    body.box([trackX,trackY+.002,back-.003],[.059,.006,.006],edge,.0016);
    body.cylinder([0,.078,.098],[0,.085,.098],.034,.032,red,28);
    body.cylinder([0,.083,.098],[0,.154,.098],.0085,.0075,red,18);
    const outer=[[-.037,.147],[.037,.147],[0,.203]], inner=[[-.012,.160],[.012,.160],[0,.181]];
    const atZ=([x,y],z)=>[x,y,z];
    for(let i=0;i<3;i++) {
      const j=(i+1)%3;
      const [a,b,c,d]=[outer[i],outer[j],inner[j],inner[i]];
      body.quad([a,b,c,d].map(p=>atZ(p,.107)),red,[0,0,1]);
      body.quad([b,a,d,c].map(p=>atZ(p,.090)),red,[0,0,-1]);
      body.quad([atZ(a,.090),atZ(b,.090),atZ(b,.107),atZ(a,.107)],red);
      body.quad([atZ(d,.107),atZ(c,.107),atZ(c,.090),atZ(d,.090)],red);
    }
    body.cylinder([0,.080,-1.249],[0,.085,-1.249],.010,.0085,red,18);
    body.cylinder([0,.084,-1.249],[0,.132,-1.249],.0045,.0025,red,16);
    door.box([port.x+.001,port.y,port.z],[.006,port.height-.001,port.width-.001],seam,.002);
    door.box([port.x+.004,port.y,port.z],[.002,port.height-.006,port.width-.006],edge,.0015);
    door.box([port.x+.0055,port.y,port.z+.036],[.002,.028,.008],seam,.001);
    door.box([port.x+.0065,port.y,port.z+.039],[.002,.023,.003],purple,.001);
    const gripThumb=launcher.makeDigit(renderer,[
      [[-.097,-.165,-.548],.010,.009,.96],
      [[-.083,-.158,-.539],.017,.014,.98],
      [thumbHinge,.017,.014,1.02],
      [[-.061,-.145,-.513],.015,.012,1.01],
      [[-.047,-.133,-.493],.012,.010,.98],
      [[-.036,-.126,-.486],.0105,.009,1.05],
      [[-.023,-.122,-.486],.0093,.008,1.04],
      [[-.014,-.121,-.486],.0065,.006,1.03],
      [[-.009,-.122,-.487],.002,.002,.98]
    ],[[-.023,-.119,-.477],[.98,.15,.05],[0,.20,1],.015,.013]);
    const pressIndex=launcher.makeDigit(renderer,[
      [[.064,-.106,.092],.012,.011,.97],
      [indexHinge,.014,.013,1.02],
      [[.063,-.101,.052],.0135,.012,1.04],
      [[.059,-.102,.025],.012,.011,1.01],
      [[.055,-.104,.005],.011,.010,.98],
      [[.043,-.107,-.012],.0105,.009,1.03],
      [[.024,-.109,-.017],.010,.009,1.03],
      [[.009,-.109,-.014],.009,.0085,1.02],
      [[-.004,-.109,-.012],.008,.007,.99],
      [[-.014,-.109,-.011],.003,.003,.98]
    ],[[.004,-.106,-.021],[-.97,-.05,.18],[0,.18,-1],.015,.011]);
    return {
      body:renderer.mesh(body,12), door:renderer.mesh(door,12),
      beltSwitch:renderer.mesh(switchCap,12), button:renderer.mesh(button,12), track:renderer.mesh(track,9),
      rearGrip:launcher.gripHand(renderer,1), gripThumb, pressIndex
    };
  }

  const lerpPoint=(a,b,t)=>a.map((n,i)=>mix(n,b[i],t));
  const tab=door=>[port.x+.010,port.y+.002,port.z+.036+port.travel*door];
  const doorHand=door=>({pad:tab(door),pitch:.10,yaw:.21,roll:-2.12,grip:.85,pinch:.35});
  const pocketHand={pad:pocket,pitch:.16,yaw:.23,roll:-2.20,grip:.69,pinch:.89};
  const readyHand={...pocketHand,pad:[.224,.159,port.z+.146],roll:-2.10,grip:.80,pinch:.66};
  const palmCars=[
    {offset:[-.027,.027,.057],pitch:.15,yaw:.64,roll:.10},
    {offset:[-.077,.042,.076],pitch:.23,yaw:.68,roll:-.18},
    {offset:[-.114,.076,.033],pitch:-.12,yaw:.38,roll:.28}
  ];
  function blendHand(a,b,t) {
    return {pad:lerpPoint(a.pad,b.pad,t),pitch:mix(a.pitch,b.pitch,t),yaw:mix(a.yaw,b.yaw,t),
      roll:mix(a.roll,b.roll,t),grip:mix(a.grip,b.grip,t),pinch:mix(a.pinch,b.pinch,t)};
  }

  // The hand leaves the grip on the left, clears the top, then reaches the door on the right.
  function approachDoor(progress,door) {
    const target=doorHand(door);
    const route=[
      foregrip,
      {...foregrip,pad:[-.176,-.146,-.644]},
      {...target,pad:[-.176,.175,-.591]},
      {...target,pad:[.153,.156,port.z+.027]},
      target
    ];
    const segment=progress*(route.length-1);
    const step=Math.min(route.length-2,Math.floor(segment));
    return blendHand(route[step],route[step+1],smooth(0,1,segment-step));
  }

  function aroundEdge(from,to,progress) {
    const clear={...to,pad:[.160,.229,mix(from.pad[2],to.pad[2],.42)]};
    return progress<.44 ? blendHand(from,clear,smooth(0,.44,progress)) : blendHand(clear,to,smooth(.44,1,progress));
  }

  function loadingTravel(change,time) {
    return (port.z-station(change.slot)+slot)*smooth(reload.push,reload.seat,time);
  }

  const feeding=change=>change?.phase==="insert" && change.beltLoading && change.time>=reload.push && change.time<reload.seat;
  const inspectHatch=t=>smooth(inspection.opened-.06,inspection.opened+.23,t)
    *(1-smooth(inspection.shut-.19,inspection.shut,t));

  function service(change,inspecting) {
    if(inspecting) {
      const t=inspecting.time;
      const tilt=smooth(.65,1.52,t)*(1-smooth(inspection.latched,inspection.end,t));
      const door=smooth(inspection.open,inspection.opened,t)*(1-smooth(inspection.shut,inspection.latched,t));
      const reach=smooth(.72,inspection.open,t)*(1-smooth(inspection.latched,inspection.end,t));
      const check=inspectHatch(t);
      const hand=approachDoor(reach,door);
      hand.pad=plus(hand.pad,[.042*check,.090*check,-.096*check]);
      return {tilt,door,hand};
    }
    if(!change) return {tilt:0,door:0,hand:foregrip};
    const {phase,time}=change;
    const {slideStart,slideEnd,pickup,gatherEnd,present,push,seat,insertEnd,closeStart,latch,closeEnd,cancelEnd}=reload;
    if(phase==="open") {
      const tilt=smooth(.02,.42,time), door=smooth(slideStart,slideEnd,time);
      const approach=smooth(.018,slideStart,time);
      return {tilt,door,approach,hand:approachDoor(approach,door)};
    }
    if(phase==="gather") {
      const holding=time>=pickup;
      const hand=holding ? aroundEdge(pocketHand,readyHand,smooth(pickup,gatherEnd,time))
        : aroundEdge(change.hand,pocketHand,smooth(0,pickup,time));
      return {tilt:1,door:1,hand,batch:holding ? change.batch : null,next:0};
    }
    if(phase==="insert") {
      const take=smooth(0,present,time), align=smooth(present,push-.054,time);
      const enter=smooth(push-.058,push,time), press=smooth(push,seat,time);
      const depth=change.beltLoading ? 0 : 1-change.slot/(carCount-1);
      const outside=lerpPoint([.196,.126,port.z+.129],throat,align);
      const at=lerpPoint(outside,[trackX,trackY,mix(port.z,station(change.slot),press)],enter);
      const yaw=.64*(1-align);
      const contact=direction(transform([0,0,0],0,yaw),[.028,.028,.017]);
      const grasp=blendHand(readyHand,{...readyHand,pad:plus(outside,contact),pinch:.62},take);
      // Only the pointing fingertip enters the port. Its push is longer when the channel has more room.
      const release=smooth(seat,insertEnd,time);
      const pushHand={
        pad:[port.x+.018-.013*enter-.010*press*depth,port.y+.003,port.z+.038-(.021+.045*depth)*press],
        pitch:.10,yaw:.34+.16*depth*press,roll:-2.08+.11*depth*press,grip:.81,pinch:.34
      };
      const hand=blendHand(blendHand(grasp,pushHand,smooth(push-.054,push+.020,time)),readyHand,release);
      const rearPress=change.beltLoading ? smooth(push-.04,push,time)*(1-smooth(seat,seat+.055,time)) : 0;
      return {tilt:1,door:1,hand,rearPress,batch:change.batch,next:change.next,car:time<seat ? {at,yaw,take} : null};
    }
    const {from,stash}=change;
    if(from.door===0) {
      const settle=smooth(0,cancelEnd,time);
      return {tilt:from.tilt*(1-settle),door:0,hand:approachDoor(from.approach*(1-settle),0)};
    }
    const closing=time-stash;
    const door=from.door*(1-smooth(closeStart,latch,closing));
    const tilt=from.tilt*(1-smooth(latch-.025,closeEnd,closing));
    const rearPress=(from.rearPress??0)*(1-smooth(0,.055,time));
    if(closing<0) {
      const retract=from.car && from.car.at[0]<throat[0] ? .12 : 0;
      const clearHand=retract ? {...from.hand,pad:lerpPoint(from.hand.pad,plus(throat,[.028,.028,.017]),smooth(.042,retract,time))}
        : from.hand;
      const hand=aroundEdge(clearHand,pocketHand,smooth(retract,stash,time));
      const at=retract ? lerpPoint(lerpPoint(from.car.at,[trackX,trackY,port.z],smooth(0,.063,time)),throat,smooth(.063,retract,time))
        : from.car?.at;
      const car=from.car ? {...from.car,at,take:from.car.take*(1-smooth(retract,retract+.086,time))} : null;
      return {tilt,door,hand,rearPress,batch:from.batch,next:from.next,car};
    }
    let hand=approachDoor(1-smooth(latch,closeEnd,closing),door);
    if(closing<closeStart && from.approach===undefined) {
      hand=aroundEdge(stash ? pocketHand : from.hand,doorHand(door),smooth(0,closeStart,closing));
    }
    return {tilt,door,hand,rearPress};
  }

  function pose(aim,stride,swayX,swayY,{slide,lift,twist},change,time,swim,aspect,_switching,inspecting) {
    const {tilt}=service(change,inspecting);
    const width=Math.min(1,aspect/1.5), sway=mix(1,.43,aim)*(1-tilt*.66);
    const float=swim.amount*(1-tilt*.80), wave=Math.sin(swim.phase)*float;
    const lateral=Math.sin(time*1.16+.50), breath=Math.sin(time*1.71-.26);
    const t=inspecting?.time ?? 0;
    const scan=smooth(0,.46,t)*(1-smooth(.64,1.46,t));
    const check=inspectHatch(t);
    const at=[
      mix(.356*width,0,aim)-tilt*.095-scan*.17+(lateral*.007+swayX*.006+stride*.012)*sway+twist*.025,
      mix(-.251,-.168,aim)+scan*.14+(breath*.005+swayY*.006)*sway-slide*.033+float*.042+wave*.029,
      mix(-.901,-.540,aim)+tilt*.064-scan*.14+slide*.121+wave*.028
    ];
    const pitch=mix(mix(.202,.028,aim)+tilt*.188+scan*.05,.79,check)
      +(breath*.011+swayY*.007)*sway+lift*.219+wave*.044;
    const yaw=mix(mix(.172*width,0,aim)+tilt*.192+scan*.41,-.54,check)
      +(-lateral*.016+swayX*.017)*sway+twist*.061;
    const roll=mix(mix(-.062,0,aim)+tilt*1.585-scan*.28,.54,check)
      +(lateral*.010+stride*.015)*sway-twist*.102+wave*.056;
    const matrix=transform(at,pitch,yaw,roll);
    if(check>0) {
      // Keep the loading bay in view while the hand is clear of the open hatch.
      const framed=minus([.025*width,.055,-.59],direction(matrix,[port.x,port.y,port.z]));
      matrix.set(lerpPoint(at,framed,check),12);
    }
    return matrix;
  }

  function shellParts(model,matrix,door,frontPress,rearPress,belt) {
    const pressedAt=point(beltSwitchPose,[0,0,beltSwitchTravel*rearPress]);
    return [
      {mesh:model.body,matrix},
      {mesh:model.door,matrix:multiply(matrix,transform([0,0,port.travel*door]))},
      {mesh:model.beltSwitch,matrix:multiply(matrix,transform(pressedAt,rearHandle.pitch))},
      {mesh:model.button,matrix:multiply(matrix,transform([0,0,-motorButton.travel*frontPress]))},
      {mesh:model.track,matrix,belt}
    ];
  }

  function assemble(toy,matrix,mounted,cycle,change,_swim,_motor,motorPress=0,inspecting=null) {
    const view=service(change,inspecting);
    const servicing=change || inspecting;
    const frontPress=servicing ? 0 : smooth(0,1,motorPress);
    const rearPress=view.rearPress??frontPress;
    const model=toy.rifle;
    const opaque=shellParts(model,matrix,view.door,frontPress,rearPress,mounted.belt+(cycle?.progress??0)*slot);
    launcher.hold(opaque,toy,matrix,model.rearGrip);
    const finger=transform([0,0,0],0,.077*rearPress);
    finger.set(minus(indexHinge,direction(finger,indexHinge)),12);
    opaque.push({mesh:model.pressIndex,matrix:multiply(matrix,finger)});
    const {pad,pitch,yaw,roll,grip,pinch}=view.hand;
    const left=transform([0,0,0],pitch,yaw,roll);
    const {root,tip}=toy.support.fingers[0];
    left.set(minus(pad,direction(left,plus(root,tip))),12);
    let thumb;
    if(!servicing) {
      const flex=transform([0,0,0],0,.13*frontPress);
      flex.set(minus(thumbHinge,direction(flex,thumbHinge)),12);
      thumb={mesh:model.gripThumb,matrix:multiply(matrix,flex)};
    }
    const wristLead=servicing ? mix(.247,.142,view.tilt) : undefined;
    launcher.reach(opaque,toy.support,multiply(matrix,left),grip,0,0,true,{pinch,thumb,wristLead});
    if(view.door>.05) {
      // Occupy the tray from the front so firing frees space at the loading hatch.
      for(const [i,index] of mounted.cars.entries()) {
        const seat=transform([trackX,trackY,station(i)]);
        opaque.push({mesh:toy.cars[index],matrix:multiply(matrix,seat)});
      }
    }
    if(view.batch) {
      for(let i=view.next;i<view.batch.length;i++) {
        const {offset,pitch,yaw,roll}=palmCars[i], palm=point(left,offset);
        const car=i===view.next ? view.car : null, take=car?.take??0;
        const at=car ? lerpPoint(palm,car.at,take) : palm;
        const pose=transform(at,pitch*(1-take),mix(yaw,car?.yaw??yaw,take),roll*(1-take));
        opaque.push({mesh:toy.cars[view.batch[i]],matrix:multiply(matrix,pose)});
      }
    }
    return {opaque};
  }

  function looseLauncher(toy,matrix,mounted) {
    return {opaque:shellParts(toy.rifle,multiply(matrix,transform([0,0,-center])),0,0,0,mounted.belt)};
  }

  Valley.rifle={build,pose,assemble,looseLauncher,service,feeding,loadingTravel,reload,inspection,slot,center,muzzle,carCount,carOrder,batchSize:palmCars.length};
})();
