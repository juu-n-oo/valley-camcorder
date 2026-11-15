"use strict";

(() => {
  const {Builder,launcher,rgb,mix,smooth,minus,transform,multiply,direction,point}=Valley;
  const carCount=20, turn=2*Math.PI;
  const slotRise=.051, tubeLength=slotRise*carCount, tubeRadius=.101, magazineWidth=.225;
  const carScale=1.12, carLane=.049, topInset=.82, exitDepth=.12;
  const railEntry=topInset-exitDepth;
  const carPitch=-Math.atan2(slotRise,turn*carLane)-.032;
  const mount=[0,-.023,-.292], railStart=[0,.055,-.895], muzzle=[0,.055,-1.515], center=-.713;
  const releasePad=[-.077,.017,-.159];
  const rearPad=[-.017,-.096,-.010];
  const triggerHinge=[.052,-.105,.065];
  const reload={button:.36,grab:.58,clear:.86,toss:1.02,stow:1.12,pocket:1.26,reveal:1.58,pry:1.72,
    capDrop:1.94,align:2.18,insert:2.30,seat:2.59,tap:2.79,end:3.13};
  const inspection={reach:1.38,release:1.83,grab:2.12,clear:2.57,show:2.96,
    motorStart:3.23,motorStop:3.96,alignStart:4.10,align:4.58,seat:4.99,end:5.52};
  const inspectionAmount=time=>smooth(0,.54,time)*(1-smooth(inspection.seat+.045,inspection.end,time));
  const identity=transform([0,0,0]);
  const charcoal=rgb(0x424651), cover=rgb(0x4c505a), dark=rgb(0x292c33), edge=rgb(0x676b74);
  const orange=rgb(0xe87821), rail=rgb(0xfa9739), groove=rgb(0xa74d15);
  const green=rgb(0x7fb541), red=rgb(0xc6372a), clear=rgb(0xb0d2d6);
  const lerpPoint=(a,b,f)=>a.map((value,i)=>mix(value,b[i],f));

  function newMagazine(sealed=true, gaps=[]) {
    const cars=[];
    for(let slot=0;slot<carCount;slot++) {
      if(!gaps.includes(slot)) cars.push({slot,index:slot%6});
    }
    return {cars,steps:0,sealed};
  }

  function rotorShape() {
    const shape=new Builder(), segments=carCount*24;
    const helix=(i,r,height=0)=>{
      const depth=carCount*i/segments, angle=Math.PI+(depth-topInset)*turn;
      return [r*Math.cos(angle),-depth*slotRise+height,r*Math.sin(angle)];
    };
    for(let i=0;i<segments;i++) {
      const j=i+1, inner=.014, outer=tubeRadius-.007;
      shape.quad([helix(i,inner),helix(j,inner),helix(j,outer),helix(i,outer)],orange);
      shape.quad([helix(i,outer,-.004),helix(j,outer,-.004),helix(j,inner,-.004),helix(i,inner,-.004)],groove);
      shape.quad([helix(i,outer),helix(j,outer),helix(j,outer,-.004),helix(i,outer,-.004)],rail);
    }
    shape.cylinder([0,-tubeLength,0],[0,.010,0],.016,.016,orange,24);
    shape.cylinder([0,-.013,0],[0,.013,0],.021,.021,groove,24);
    return shape;
  }

  // These lower-detail meshes let every occupied elevator slot remain visible.
  function elevatorCar(renderer,paint,index) {
    const b=new Builder(), rubber=rgb(0x282c2a), window=rgb(0x2b424c), trim=rgb(0xbdc1b3);
    const width=index===1 ? .036 : .039, length=index===1 ? .069 : .078;
    b.box([0,.014,0],[width,.017,length],paint);
    const baseY=.021, roofY=index===1 ? .038 : .034;
    const a=[-width*.44,baseY,-.018], c=[width*.44,baseY,-.018];
    const d=[width*.35,roofY,-.010], e=[-width*.35,roofY,-.010];
    const f=[-width*.44,baseY,.022], g=[width*.44,baseY,.022];
    const h=[width*.35,roofY,.015], j=[-width*.35,roofY,.015];
    b.quad([e,d,h,j],paint,[0,1,0]);
    b.quad([a,c,d,e],window,[0,.5,-.87]);
    b.quad([g,f,j,h],window,[0,.5,.87]);
    b.quad([f,a,e,j],window,[-.96,.28,0]);
    b.quad([c,g,h,d],window,[.96,.28,0]);
    for(const side of [-1,1]) for(const z of [-.024,.024]) {
      b.cylinder([side*width*.41,.007,z],[side*width*.54,.007,z],.0073,.0073,rubber,8);
      b.cylinder([side*width*.54,.007,z],[side*width*.55,.007,z],.0042,.0042,trim,8);
    }
    b.box([0,.014,-length*.505],[width*.84,.003,.002],trim);
    b.box([0,.014,length*.505],[width*.84,.003,.002],rgb(0xa14c36));
    return renderer.mesh(b);
  }

  function fistFingers(renderer) {
    return [.0106,.0116,.0109,.0091].map((radius,i)=>{
      const z=.037+(i-1.5)*.0185, length=[.040,.045,.042,.034][i];
      const mesh=launcher.makeDigit(renderer,[
        [[0,0,0],radius*.88,radius*.91,1],
        [[length*.43,.011,0],radius,radius,1.02],
        [[length*.83,.009,0],radius*1.02,radius*.99,1.03],
        [[length,-.003,0],radius,radius*.94,1],
        [[length*.92,-.018,0],radius*.87,radius*.90,1.02],
        [[length*.56,-.027,-.002],radius*.80,radius*.82,.99],
        [[length*.15,-.029,-.004],radius*.64,radius*.66,1],
        [[-.005,-.030,-.004],.003,.003,.99]
      ],[[length*.32,-.035,-.005],[-1,0,0],[0,-1,.24],length*.30,radius*1.17]);
      return {mesh,root:[-.084,.055,z]};
    });
  }

  function lidShape() {
    const cap=new Builder(), sides=32;
    cap.box([0,.040,0],[.224,.019,.224],dark,.006);
    cap.box([-.106,.019,.013],[.015,.021,.055],charcoal,.004);
    const rim=(i,outer,y)=>{
      const angle=2*Math.PI*i/sides, x=Math.cos(angle), z=Math.sin(angle);
      const r=outer ? .111/Math.max(Math.abs(x),Math.abs(z)) : tubeRadius+.003;
      return [r*x,y,r*z];
    };
    for(let i=0;i<sides;i++) {
      const j=i+1;
      cap.quad([rim(j,true,-.008),rim(i,true,-.008),rim(i,true,.038),rim(j,true,.038)],charcoal);
      cap.quad([rim(i,true,-.008),rim(j,true,-.008),rim(j,false,-.008),rim(i,false,-.008)],dark);
      cap.quad([rim(i,false,-.008),rim(j,false,-.008),rim(j,false,.035),rim(i,false,.035)],dark);
    }
    return cap;
  }

  function roundedCover(body,y,z,halfWidth,radius) {
    const span=24;
    for(let i=0;i<span;i++) {
      const first=Math.PI*i/span, last=Math.PI*(i+1)/span;
      const rim=(x,a)=>[x,y+radius*Math.sin(a),z+radius*Math.cos(a)];
      const normal=a=>[0,Math.sin(a),Math.cos(a)];
      const a=body.vertex(rim(-halfWidth,first),normal(first),[0,i/span],cover);
      const b=body.vertex(rim(halfWidth,first),normal(first),[1,i/span],cover);
      const c=body.vertex(rim(halfWidth,last),normal(last),[1,(i+1)/span],cover);
      const d=body.vertex(rim(-halfWidth,last),normal(last),[0,(i+1)/span],cover);
      body.indices.push(a,b,c,a,c,d);
      body.triangle([-halfWidth,y,z],rim(-halfWidth,first),rim(-halfWidth,last),charcoal);
      body.triangle([halfWidth,y,z],rim(halfWidth,last),rim(halfWidth,first),charcoal);
    }
  }

  function build(renderer) {
    const body=new Builder(), socket=new Builder(), slide=new Builder(), trigger=new Builder(), boost=new Builder();
    const coupling=new Builder();
    const {get,append}=Valley.blenderAssets;
    append(body,get("charcoal_toy_cover").parts[0].shape,transform([0,0,0]));
    body.box([0,.050,-.458],[.138,.099,.292],charcoal,.0045);
    body.box([0,-.007,-.538],[.146,.074,.320],charcoal,.005);
    body.box([0,-.041,-.534],[.132,.011,.302],dark,.003);
    const shroudFront=-.977, shroudBack=-.595, shroudZ=(shroudFront+shroudBack)*.5;
    const shroudLength=shroudBack-shroudFront;
    const channelZ=(railStart[2]+muzzle[2])*.5, channelLength=railStart[2]-muzzle[2];
    for(const side of [-1,1]) {
      body.box([side*.063,.067,shroudZ],[.011,.083,shroudLength],charcoal,.003,null,4);
      body.box([side*.073,-.009,-.118],[.002,.003,.384],dark,.001);
      body.box([side*.050,.068,channelZ],[.008,.031,channelLength],orange,.002,null,5);
      body.box([side*.050,.083,channelZ],[.004,.002,channelLength-.006],rail,.001,null,4);
    }
    body.box([0,.105,shroudZ],[.137,.009,shroudLength],cover,.003,null,4);
    body.box([0,.028,shroudZ],[.137,.011,shroudLength],charcoal,.003,null,4);
    body.box([0,.066,-.763],[.119,.077,.012],dark,.002);
    body.box([0,.051,channelZ],[.107,.008,channelLength],orange,.003,null,5);
    body.box([0,.046,channelZ],[.090,.004,channelLength-.009],groove,.001,null,4);
    body.box([0,.102,-.554],[.111,.007,.075],charcoal,.002);
    roundedCover(body,.105,-.554,.055,.037);
    body.box([0,.102,-.334],[.145,.002,.005],edge,.001);
    const rearLength=.33, frontLength=.40;
    body.box([0,-.012-rearLength*.5,.040+rearLength*.074],[.084,rearLength,.087],charcoal,.008,[-.149,0,0],7);
    body.box([0,-.041-frontLength*.5,-.594],[.086,frontLength,.098],charcoal,.009,null,8);
    body.box([0,-.046-frontLength,-.594],[.078,.012,.089],dark,.004);
    body.box([releasePad[0]+.004,releasePad[1],releasePad[2]],[.006,.032,.046],dark,.003);
    slide.box(releasePad,[.015,.023,.039],red,.003);
    slide.box([releasePad[0]-.007,releasePad[1]+.005,releasePad[2]],[.003,.004,.031],rgb(0xee6341),.001);
    body.box([rearPad[0],rearPad[1],.002],[.066,.052,.022],dark,.003,[-.149,0,0]);
    trigger.box(rearPad,[.061,.044,.017],green,.003,[-.149,0,0]);
    boost.box([-.009,-.126,-.647],[.061,.052,.014],green,.004);
    socket.cylinder([0,-.012,0],[0,.013,0],.107,.104,dark,32,false);
    socket.cylinder([0,-.013,0],[0,-.009,0],.105,.105,edge,32,false);
    socket.cylinder([0,.011,0],[0,.013,0],.100,.100,dark,24);
    coupling.cylinder([0,-.026,0],[0,.012,0],.021,.025,edge,20);
    coupling.box([0,-.027,0],[.034,.006,.009],charcoal,.002);
    coupling.box([.012,-.031,0],[.010,.002,.006],rail,.001);

    const triggerFinger=launcher.makeDigit(renderer,[
      [[.064,-.118,.091],.012,.012,1],
      [triggerHinge,.014,.013,1.02],
      [[.051,-.089,.034],.012,.011,1.03],
      [[.048,-.085,.004],.011,.011,1.01],
      [[.035,-.088,-.024],.011,.010,1.02],
      [[.013,-.093,-.026],.010,.009,1],
      [[-.009,-.096,-.023],.008,.008,1],
      [[-.020,-.098,-.018],.003,.003,1]
    ],[[-.012,-.088,-.021],[-.94,-.17,.31],[0,.87,-.48],.012,.010]);

    const base=new Builder(), glass=new Builder();
    base.box([0,-tubeLength-.021,0],[magazineWidth,.042,magazineWidth],dark,.006);
    base.box([0,-tubeLength-.042,0],[.211,.008,.211],charcoal,.003);
    base.cylinder([0,-tubeLength+.001,0],[0,-tubeLength+.012,0],tubeRadius+.005,tubeRadius+.004,cover,32,false);
    glass.cylinder([0,-tubeLength,0],[0,.003,0],tubeRadius,tubeRadius,clear,44,false);
    glass.cylinder([0,-.004,0],[0,.004,0],tubeRadius+.003,tubeRadius+.003,clear,44,false);
    for(const side of [-1,1]) {
      glass.box([-.070,-tubeLength*.5,side*.073],[.005,tubeLength,.005],clear,.001);
    }
    return {
      body:renderer.mesh(body,12),socket:renderer.mesh(socket,12),release:renderer.mesh(slide,12),
      trigger:renderer.mesh(trigger,12),boost:renderer.mesh(boost,12),coupling:renderer.mesh(coupling,12),triggerFinger,
      base:renderer.mesh(base,12),
      rotor:renderer.mesh(rotorShape(),12),glass:renderer.mesh(glass,6,[.74,.86,.87,.37]),cap:renderer.mesh(lidShape(),12),
      fist:fistFingers(renderer),
      cars:[0xe4ddc6,0xebae38,0xc24b36,0xb5beb7,0x6fbbc5,0xae467b].map((paint,i)=>elevatorCar(renderer,rgb(paint),i))
    };
  }

  function magazineParts(model,matrix,magazine,progress=0,detail=1) {
    const step=magazine.steps+progress;
    const opaque=[{mesh:model.base,matrix},
      {mesh:model.rotor,matrix:multiply(matrix,transform([0,0,0],0,-(step%1)*turn))}];
    for(const car of magazine.cars) {
      if(car.slot%detail) continue;
      const depth=car.slot+topInset-step;
      if(depth<=exitDepth) continue;
      const pose=transform([-carLane,-depth*slotRise+.003,0],carPitch,0,0,carScale);
      opaque.push({mesh:model.cars[car.index],matrix:multiply(matrix,pose)});
    }
    return {opaque,glass:{mesh:model.glass,matrix}};
  }

  function removalPose(matrix,time,stashing=false) {
    const unlatch=smooth(reload.button,reload.grab,time), pull=smooth(reload.grab,reload.clear,time);
    if(stashing) {
      const tuck=smooth(reload.clear,reload.stow,time);
      const at=lerpPoint([-.093*pull,mount[1]-.057*unlatch-.135*pull,mount[2]+.022*pull],[-.53,-.76,.085],tuck);
      return multiply(matrix,transform(at,.12*pull-.38*tuck,.09*pull+.19*tuck,-.27*pull-.36*tuck));
    }
    const toss=smooth(reload.clear,reload.toss,time);
    return multiply(matrix,transform([-.093*pull-.16*toss,mount[1]-.057*unlatch-.135*pull-.019*toss,mount[2]+.022*pull],
      .12*pull,.09*pull,-.27*pull-.49*toss));
  }

  function insertionPose(matrix,time,uncap) {
    const draw=smooth(reload.pocket,reload.reveal,time);
    const align=smooth(uncap ? reload.capDrop : reload.reveal,reload.align,time);
    const seat=smooth(reload.insert,reload.seat,time);
    const lifted=lerpPoint([-.448,-.68,.121],[-.291,.038,-.214],draw);
    const at=lerpPoint(lifted,[mount[0],mount[1]-.208,mount[2]],align);
    return multiply(matrix,transform(lerpPoint(at,mount,seat),mix(-.34,-.055,draw)*(1-align),
      .21*(1-align),(-.64+.25*draw)*(1-align)));
  }

  function capPose(matrix,time) {
    const pop=smooth(reload.pry,reload.capDrop,time);
    return multiply(insertionPose(matrix,time,true),transform([-.105*pop,.083*pop,.014*pop],
      .34*pop,.27*pop,.94*pop));
  }

  function inspectedMagazine(time,display) {
    const release=smooth(inspection.release,inspection.grab,time);
    const pull=smooth(inspection.grab,inspection.clear,time);
    const seat=smooth(inspection.align,inspection.seat,time);
    const lowered=[0,mount[1]-.057*release-.164*pull,mount[2]];
    const at=lerpPoint(lowered,[-.20,.26,-1.0],display);
    return transform(lerpPoint(at,mount,seat),.08*display,-.16*display,-.37*display);
  }

  function pose(aim,stride,swayX,swayY,{slide,lift,twist},change,time,swim,aspect,_switching,inspecting) {
    const t=change?.time??0, check=inspecting?.time??0;
    const age=t-reload.button;
    const jolt=change?.gesture==="fist" && age>0 ? Math.sin(57*age)*Math.exp(-25*age) : 0;
    const tapped=t-reload.tap;
    const settle=tapped>0 ? Math.sin(63*tapped)*Math.exp(-31*tapped) : 0;
    const service=smooth(0,.29,t)*(1-smooth(reload.tap+.04,reload.end,t));
    const checkBase=smooth(reload.seat,reload.tap,t)*(1-smooth(reload.tap+.038,reload.end,t));
    const inspect=inspectionAmount(check);
    const turnOver=smooth(.42,.91,check)*(1-smooth(1.06,1.47,check));
    const handling=smooth(1.28,inspection.release,check)*(1-smooth(inspection.seat+.045,inspection.end,check));
    const width=Math.min(1,aspect/1.5), sway=mix(1,.33,aim)*(1-Math.max(service*.8,handling*.78));
    const breath=Math.sin(time*1.7), drift=Math.sin(time*1.15+.55), wave=Math.sin(swim.phase)*swim.amount;
    const at=[
      mix(.565*width,0,aim)-.21*service-.65*inspect+.62*handling-.31*checkBase+(drift*.009+swayX*.008+stride*.012)*sway+twist*.028,
      mix(-.254,-.298,aim)+.16*service+.27*inspect+.04*handling+.25*checkBase+(breath*.006+swayY*.008)*sway-slide*.018+wave*.037-.018*jolt+.021*settle,
      mix(-1.062,-.674,aim)-.22*service-.58*inspect+.02*handling-.44*checkBase+slide*.090+wave*.038
    ];
    // The channel's centerline meets the centered sight at a fixed scene distance.
    const depth=14+at[2];
    const pitch=Math.atan2(-at[1]-muzzle[1],Math.hypot(at[0],depth));
    const yaw=Math.atan2(at[0],depth);
    return transform(at,pitch+.17*service+.14*inspect+lift*.142+breath*.010*sway+wave*.046,
      yaw+.58*service+mix(.61,-.29,turnOver)*inspect+.86*handling+swayX*.018*sway+twist*.076,
      mix(.035,0,aim)+.28*service+mix(.80,-.24,turnOver)*inspect-.61*handling+stride*.02*sway-twist*.09+wave*.038+.046*jolt+.57*checkBase);
  }

  function shellParts(model,matrix,rearPress,button,frontPress=rearPress,driveAngle=null) {
    const parts=[{mesh:model.body,matrix},{mesh:model.socket,matrix:multiply(matrix,transform(mount))},
      {mesh:model.release,matrix:multiply(matrix,transform([.009*button,0,0]))},
      {mesh:model.trigger,matrix:multiply(matrix,transform([0,0,.006*rearPress]))},
      {mesh:model.boost,matrix:multiply(matrix,transform([0,0,.006*frontPress]))}];
    if(driveAngle!==null) parts.push({mesh:model.coupling,matrix:multiply(matrix,transform(mount,0,driveAngle))});
    return parts;
  }

  function releasePressure(change) {
    if(!change?.gesture) return 0;
    const {time,gesture}=change;
    const fist=gesture==="fist";
    return smooth(reload.button-(fist ? .023 : .074),reload.button,time)
      *(1-smooth(reload.button+.018,reload.button+(fist ? .066 : .100),time));
  }

  function anchorHand(at,angles,anchor) {
    const rotation=transform([0,0,0],...angles);
    return [...minus(at,direction(rotation,anchor)),...angles];
  }

  function foregripPose(aim) {
    const grip=transform([-.041*aim,-.070+.119*aim,-.641],.07,-.05-.55*aim,.03-.13*aim);
    for(let i=0;i<3;i++) grip[i]*=-1;
    return grip;
  }

  function releaseContact(hand,pad) {
    const {root,tip}=hand.fingers[0];
    return anchorHand(pad,[-.18,.39,.29],root.map((n,i)=>n+tip[i]));
  }

  function inspectSupport(opaque,toy,matrix,time,aim,magazine,display,pressure) {
    const reach=smooth(inspection.reach,inspection.release-.075,time);
    const returnToGrip=smooth(inspection.seat+.065,inspection.end-.018,time);
    if(reach===0 || returnToGrip===1) {
      supportHand(opaque,toy,matrix,null,aim);
      return;
    }
    const hand=toy.support;
    const wrist=point(foregripPose(aim),[.061,-.215,.119]);
    const rest=anchorHand(wrist,[.12,-.22,-.28],[-.143,-.066,.098]);
    const pad=[releasePad[0]-.014+pressure*.008,releasePad[1],releasePad[2]];
    const contact=releaseContact(hand,pad);
    const grip=smooth(inspection.release+.055,inspection.grab,time);
    const at=point(magazine,[-.030,-.265,.042]);
    const holding=[...at,.10+.08*display,-.34-.16*display,-.25-.37*display];
    const pose=lerpPoint(lerpPoint(lerpPoint(rest,contact,reach),holding,grip),rest,returnToGrip);
    const pointing=grip<.58;
    const handModel=pointing ? {...hand,fingers:[hand.fingers[0],...toy.spiral.fist.slice(1)]} : hand;
    launcher.reach(opaque,handModel,multiply(matrix,transform(pose.slice(0,3),...pose.slice(3))),
      mix(.97,.90,grip),0,0,pointing,{pinch:.35*grip*(1-returnToGrip),wristLead:.172});
  }

  function supportHand(opaque,toy,matrix,change,aim) {
    const hand=toy.support;
    if(!change) {
      launcher.hold(opaque,toy,multiply(matrix,foregripPose(aim)),toy.hand,-1);
      return;
    }
    const {time:t,uncap,outgoing,gesture,stashing}=change;
    const releaseAt=stashing ? reload.stow : reload.toss;
    const rest=[.025,-.225,-.579,.12,-.22,-.28];
    const removed=at=>{
      const base=removalPose(identity,at,stashing);
      const handAt=point(base,[-.033,-.183,.021]);
      return [...handAt,.12,-.34,-.21-.55*smooth(reload.grab,releaseAt,at)];
    };
    const inserted=at=>{
      const base=insertionPose(identity,at,uncap);
      const gripShift=smooth(reload.capDrop,reload.insert,at);
      const handAt=point(base,[-.048,-.077-.256*gripShift,.019]);
      return [...handAt,.075,-.42,-.21];
    };
    let pose, grip=.94, pinch=.34, pointing=false, pry=0, flick=0, thumb;
    let handModel=hand, localThumb;
    if(t<reload.grab && gesture) {
      const pressure=releasePressure(change), touch=smooth(0,reload.button,t);
      const pad=[releasePad[0]-.014+pressure*.008,releasePad[1],releasePad[2]];
      const grab=smooth(reload.button+.033,reload.grab,t);
      if(gesture==="fist") {
        const knuckles=[-.029,.055,.034];
        const windup=anchorHand([-.303,.226,-.211],[.44,.26,.74],knuckles);
        const hit=anchorHand(pad,[.10,.13,-.30],knuckles);
        const strike=smooth(.238,reload.button,t);
        pose=lerpPoint(lerpPoint(lerpPoint(rest,windup,smooth(.015,.222,t)),hit,strike),removed(reload.grab),grab);
        if(t<reload.button+.092) handModel={...hand,fingers:toy.spiral.fist};
        grip=1-.06*grab;
        pinch=.22*grab;
      } else if(gesture==="thumb") {
        const thumbTip=[.053,-.022,-.032];
        const flex=transform([-.115,-.014,.079],.08,.18+pressure*.21,.12+pressure*.15);
        const contact=anchorHand(pad,[-.40,.35,1.44],point(flex,thumbTip));
        pose=lerpPoint(lerpPoint(rest,contact,touch),removed(reload.grab),grab);
        grip=mix(.91,.70,touch*(1-grab));
        if(grab<.65) handModel={...hand,fingers:toy.spiral.fist};
        const returnThumb=transform([-.118,-.022,.078],0,-.05,-.09);
        localThumb=Array.from(flex,(value,i)=>mix(returnThumb[i],value,touch*(1-grab)));
      } else {
        const contact=releaseContact(hand,pad);
        pose=lerpPoint(lerpPoint(rest,contact,touch),removed(reload.grab),grab);
        grip=.97;
        if(grab<.65) handModel={...hand,fingers:[hand.fingers[0],...toy.spiral.fist.slice(1)]};
        pointing=true;
      }
    } else if(t<releaseAt && !outgoing.missing) {
      pose=removed(t);
    } else if(t<reload.pocket) {
      pose=lerpPoint(outgoing.missing ? rest : removed(releaseAt),inserted(reload.pocket),
        smooth(outgoing.missing ? 0 : releaseAt,reload.pocket,t));
      grip=.54;
    } else if(t<reload.seat) {
      pose=inserted(t);
      pry=uncap ? smooth(reload.pry-.10,reload.pry+.05,t)*(1-smooth(reload.pry+.14,reload.capDrop,t)) : 0;
      flick=uncap ? smooth(reload.pry+.12,reload.capDrop,t)*(1-smooth(reload.capDrop,reload.align,t)) : 0;
      if(pry>0 || flick>0) {
        const tip=[.053,-.022,-.032], angles=[-.48,.32,.47];
        const cap=capPose(matrix,t);
        const target=point(cap,[-.112,.013,.013]);
        const thumbMatrix=multiply(matrix,transform([0,0,0],...angles));
        thumbMatrix.set(minus(target,direction(thumbMatrix,tip)),12);
        const normalThumb=multiply(matrix,transform(pose.slice(0,3),...pose.slice(3)));
        const root=point(normalThumb,[-.094,-.008,.061]);
        thumbMatrix.set(lerpPoint(root,[thumbMatrix[12],thumbMatrix[13],thumbMatrix[14]],Math.max(pry,flick)),12);
        thumb={mesh:hand.thumb,matrix:thumbMatrix};
      }
    } else {
      const atBase=smooth(reload.seat,reload.tap-.058,t);
      const slap=smooth(reload.tap-.060,reload.tap,t)*(1-smooth(reload.tap,reload.tap+.074,t));
      const restore=smooth(reload.tap+.055,reload.end,t);
      const angles=[-.39,.13,-.82];
      const pad=[-.159,mount[1]-tubeLength-.143+.070*slap,mount[2]+.057];
      const palm=anchorHand(pad,angles,[-.116,-.022,.068]);
      pose=lerpPoint(lerpPoint(inserted(reload.seat),palm,atBase),rest,restore);
      grip=mix(.94,.18,atBase*(1-restore));
      pinch=.34*(1-atBase*(1-restore));
    }
    const handPose=multiply(matrix,transform(pose.slice(0,3),...pose.slice(3)));
    if(localThumb) thumb={mesh:hand.thumb,matrix:multiply(handPose,localThumb)};
    launcher.reach(opaque,handModel,handPose,grip,pry,flick,pointing,
      {pinch,thumb,wristLead:.172});
  }

  function assemble(toy,matrix,mounted,cycle,change,_swim,_motor,motorPress=0,inspecting,aim=0) {
    const model=toy.spiral, t=change?.time??0, check=inspecting?.time??0;
    const testPress=smooth(inspection.motorStart-.13,inspection.motorStart,check)
      *(1-smooth(inspection.motorStop,inspection.motorStop+.12,check));
    const rearPress=inspecting ? testPress : motorPress;
    const button=inspecting ? smooth(inspection.release-.071,inspection.release,check)
      *(1-smooth(inspection.release+.024,inspection.release+.12,check)) : releasePressure(change);
    const driveAngle=inspecting && check>=inspection.clear && check<inspection.seat
      ? turn*4*smooth(inspection.motorStart,inspection.motorStop,check) : null;
    const opaque=shellParts(model,matrix,rearPress,button,inspecting ? 0 : motorPress,driveAngle);
    launcher.hold(opaque,toy,matrix,toy.hand,1,.23*inspectionAmount(check));
    const finger=transform([0,0,0],.17*(1-rearPress),-.16*(1-rearPress));
    finger.set(minus(triggerHinge,direction(finger,triggerHinge)),12);
    opaque.push({mesh:model.triggerFinger,matrix:multiply(matrix,finger)});

    let magazine=mounted.missing ? null : mounted, at=multiply(matrix,transform(mount));
    if(inspecting) {
      const display=smooth(inspection.clear,inspection.show,check)*(1-smooth(inspection.alignStart,inspection.align,check));
      const detached=inspectedMagazine(check,display);
      at=multiply(matrix,detached);
      inspectSupport(opaque,toy,matrix,check,aim,detached,display,button);
    } else supportHand(opaque,toy,matrix,change,aim);

    const releaseAt=change?.stashing ? reload.stow : reload.toss;
    if(change && t<releaseAt && !change.outgoing.missing) {
      magazine=change.outgoing;
      at=removalPose(matrix,t,change.stashing);
    } else if(change && t>=reload.pocket && t<reload.seat) {
      magazine=change.incoming;
      at=insertionPose(matrix,t,change.uncap);
      if(magazine.sealed) opaque.push({mesh:model.cap,matrix:capPose(matrix,t)});
    }
    if(cycle?.feedsCar && cycle.progress>=railEntry) {
      const travel=(cycle.progress-railEntry)/(1-railEntry);
      const at=lerpPoint(railStart,muzzle,travel*travel);
      opaque.push({mesh:toy.cars[mounted.cars[0].index],matrix:multiply(matrix,transform(at,0,0,0,carScale))});
    }
    if(!magazine) return {opaque};
    const parts=magazineParts(model,at,magazine,inspecting ? 0 : cycle?.progress??0);
    opaque.push(...parts.opaque);
    return {opaque,glass:parts.glass};
  }

  function looseLauncher(toy,matrix,mounted,_motor,detail=1) {
    const model=toy.spiral, pose=multiply(matrix,transform([0,0,-center]));
    const opaque=shellParts(model,pose,0,0);
    if(mounted.missing) return {opaque};
    const parts=magazineParts(model,multiply(pose,transform(mount)),mounted,0,detail);
    return {opaque:opaque.concat(parts.opaque),glass:parts.glass};
  }

  Valley.spiral={build,pose,assemble,looseLauncher,newMagazine,magazineParts,removalPose,capPose,
    carCount,carScale,tubeLength,magazineWidth,center,railStart,muzzle,reload,inspection};
})();
