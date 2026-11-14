"use strict";

(() => {
  const { Builder, rgb, plus, minus, times, dot, cross, unit, mix, smooth, random, transform, multiply, point, direction } = Valley;
  const slot = .086;
  const muzzle = [0,.010,-.666];
  const switchZ = -.503;
  const switchOffset = position => mix(-.026,.026,position);
  const switchTiming = {touch:.235,flip:.318,lift:.388,end:.67};
  const mountZ = -.216;
  const carCount = 5;
  const station = i => -.379-mountZ+i*slot;
  const rollerY = -.024, rollerRadius = .0154, jamFeed = .28;
  const coupling = [0,rollerY,mountZ+station(carCount-1)];
  const triggerHinge = [.052,-.105,.065];
  const sideTravel = -.164;
  const inspection = {pull:1.66,clear:2.13,press:2.63,release:3.56,align:4.10,seat:4.58,end:5.19};
  const reload = {
    grab:.34,lifted:.56,toss:.85,stow:1.07,pocket:1.14,bring:1.23,show:1.63,pry:1.74,capDrop:1.98,
    alignStart:1.98,align:2.19,insert:2.25,seat:2.55,end:2.89
  };
  const uncappedReload = {...reload,alignStart:1.63,align:1.86,insert:1.92,seat:2.22,end:2.56};
  const cartridgeFront = -.208, cartridgeBack = .222;
  const carSpecs = [
    { paint: 0xe4ddc6, roof: 0xf0e9d6, w: .039, l: .075, top: .036, cabin: .034, shift: .003 },
    { paint: 0xebae38, roof: 0xf4bc49, w: .038, l: .069, top: .038, cabin: .039, shift: .001, round: true },
    { paint: 0xb93d2c, roof: 0xc54934, w: .040, l: .078, top: .031, cabin: .038, shift: .003 },
    { paint: 0xa8afad, roof: 0xc3c9c5, w: .039, l: .077, top: .034, cabin: .032, shift: .000 },
    { paint: 0x60b7c5, roof: 0xdeeadf, w: .041, l: .078, top: .035, cabin: .032, shift: .005 },
    { paint: 0xa93675, roof: 0xb34786, w: .040, l: .076, top: .033, cabin: .034, shift: .006, hoodBadge: true }
  ];

  function modelCar(renderer, s) {
    const b = new Builder(), paint = rgb(s.paint), roof = rgb(s.roof);
    const glass = rgb(0x304449), rubber = rgb(0x222525), chrome = rgb(0xc8cfca);
    const w = s.w, l = s.l, t = s.top, r = s.round ? .007 : .004;
    b.box([0,.009,0],[w*.93,.011,l*.94],rubber,.002);
    b.box([0,.015,0],[w,.017,l],paint,r);
    b.box([0,.021,-l*.313],[w*.91,.006,l*.32],paint,.002);
    b.box([0,.020,l*.361],[w*.92,.005,l*.224],paint,.002);
    const lowerX = w*.435, upperX = w*(s.round ? .305 : .353);
    const z0 = s.shift-s.cabin*.58, z1 = s.shift+s.cabin*.58;
    const z2 = s.shift-s.cabin*(s.round ? .23 : .30), z3 = s.shift+s.cabin*(s.round ? .27 : .37);
    const low = .022, high = t-.0015;
    const points = [
      [-lowerX,low,z0],[lowerX,low,z0],[lowerX,low,z1],[-lowerX,low,z1],
      [-upperX,high,z2],[upperX,high,z2],[upperX,high,z3],[-upperX,high,z3]
    ];
    const interpolate = (a,b,f) => a.map((v,i)=>mix(v,b[i],f));
    for (let i=0; i<4; i++) {
      const j = (i+1)%4;
      const [a,c,d,e] = [points[i],points[j],points[j+4],points[i+4]];
      const inset = (x,y) => plus(times(interpolate(a,c,x),1-y),times(interpolate(e,d,x),y));
      b.quad([a,c,d,e],roof);
      const n = unit([
        i === 1 ? 1 : i === 3 ? -1 : 0,
        .4,
        i === 0 ? -1 : i === 2 ? 1 : 0
      ]);
      const window = (start,end,tint) => b.quad([
        inset(start,.16),inset(end,.16),inset(end,.86),inset(start,.86)
      ].map(p=>plus(p,times(n,.00038))),tint,n);
      if (i%2 === 0) {
        window(.11,.89,times(glass,i===0 ? 1.22 : 1.09));
      } else {
        window(.09,.46,glass);
        window(.52,.91,times(glass,1.08));
      }
    }
    b.box([0,high+.0008,(z2+z3)*.5],[upperX*2.04,.0034,z3-z2+.001],roof,.0016);
    for (const z of [-l*.302,l*.303]) {
      for (const side of [-1,1]) {
        const axle = w*.43*side, outer = w*.544*side;
        b.cylinder([axle,.0075,z],[outer,.0075,z],.0074,.0074,rubber,14);
        b.cylinder([outer,.0075,z],[outer+.0006*side,.0075,z],.0045,.0043,chrome,12);
        b.cylinder([outer+.0006*side,.0075,z],[outer+.00085*side,.0075,z],.0026,.0024,rgb(0x697371),10);
      }
    }
    for (const side of [-1,1]) {
      const x = side*w*.324;
      if (s.round) {
        b.ellipsoid([x,.016,-l*.471],[.004,.0042,.002],chrome,null,10,6);
        b.ellipsoid([x,.016,-l*.488],[.0028,.003,.0014],rgb(0xf5efd3),null,10,6);
      } else {
        b.box([x,.017,-l*.503],[.0082,.0047,.0013],rgb(0xf5ead0),.0006);
      }
      b.box([x,.014,l*.503],[.0075,.0037,.0014],rgb(0x813120),.0005);
      b.box([side*w*.504,.018,.009],[.0009,.0012,.0042],chrome,.0002);
    }
    b.box([0,.008,-l*.513],[w*.99,.0024,.0033],chrome,.0007);
    b.box([0,.008,l*.513],[w*.99,.0024,.0033],chrome,.0007);
    b.box([0,.015,-l*.506],[w*.43,.0042,.001],rgb(0x333c38));
    b.box([0,.013,l*.511],[w*.20,.0034,.001],rgb(0xe0d9c5));
    if(s.hoodBadge) {
      b.cylinder([0,.023,-l*.305],[0,.025,-l*.305],.008,.007,rubber,14);
      b.cylinder([0,.025,-l*.305],[0,.026,-l*.305],.005,.0048,chrome,14);
    }
    return renderer.mesh(b);
  }

  function tube(builder, rings, tone, resolution = 14) {
    const control = rings.map(([p,w,d,s])=>[...p,w,d,s]);
    const curve = [];
    for (let i=0; i<control.length-1; i++) {
      const a = control[Math.max(0,i-1)], b = control[i];
      const c = control[i+1], d = control[Math.min(i+2,control.length-1)];
      for (let j=0; j<3; j++) {
        const t = j/3;
        curve.push(b.map((v,k)=>v+.5*t*((c[k]-a[k])+t*(2*a[k]-5*v+4*c[k]-d[k]+t*(3*v-a[k]-3*c[k]+d[k])))));
      }
    }
    curve.push(control.at(-1));
    rings = curve.map(([x,y,z,w,d,s])=>[[x,y,z],Math.max(.001,w),Math.max(.001,d),s]);
    const layers = [];
    for (let i=0; i<rings.length; i++) {
      const [p, width, depth, shade] = rings[i];
      const a = rings[Math.max(0,i-1)][0], b = rings[Math.min(rings.length-1,i+1)][0];
      const axis = unit(minus(b,a));
      const across = unit([axis[2],0,-axis[0]]);
      const up = [
        axis[1]*across[2] - axis[2]*across[1],
        axis[2]*across[0] - axis[0]*across[2],
        axis[0]*across[1] - axis[1]*across[0]
      ];
      const row = [];
      for (let j=0; j<=resolution; j++) {
        const theta = j/resolution*Math.PI*2;
        const x = Math.cos(theta), y = Math.sin(theta);
        const at = plus(p,plus(times(across,width*x),times(up,depth*y)));
        const n = unit(plus(times(across,x/width),times(up,y/depth)));
        row.push(builder.vertex(at,n,[j/resolution,i/(rings.length-1)],times(tone,shade*(.969+y*.031))));
      }
      layers.push(row);
      if (!i) continue;
      for (let j=0; j<resolution; j++) {
        const a = layers[i-1][j], b = layers[i-1][j+1], c = row[j+1], d = row[j];
        builder.indices.push(a,b,c,a,c,d);
      }
    }
  }

  const rightCuff={at:[.061,-.215,.119],axis:unit([-.007,.016,-.008])};
  const leftCuff={at:[-.143,-.066,.098],axis:unit([.023,.031,-.022])};

  function sleeveMesh(renderer) {
    const b=new Builder(), count=24;
    const fabric=rgb(0x576c7b), band=rgb(0x3d5262);
    const profile=[
      [0,.132,.108],[.17,.122,.104],[.36,.103,.090],[.51,.095,.082],
      [.62,.099,.085],[.73,.088,.074],[.82,.073,.062],[.90,.057,.049],
      [.944,.046,.040],[.955,.047,.041],[.969,.048,.042],[.985,.047,.040],[1,.042,.036]
    ];
    const rows=[];
    for(let i=1;i<profile.length;i++) {
      const [t0,w0,d0]=profile[i-1], [t1,w1,d1]=profile[i], steps=Math.max(1,Math.ceil((t1-t0)*29));
      for(let j=0;j<steps;j++) {
        const f=j/steps, blend=smooth(0,1,f);
        rows.push([mix(t0,t1,f),mix(w0,w1,blend),mix(d0,d1,blend)]);
      }
    }
    rows.push(profile.at(-1));
    for(const [i,[t,w,d]] of rows.entries()) for(let j=0;j<=count;j++) {
      const u=j/count, a=u*Math.PI*2, x=Math.cos(a), y=Math.sin(a);
      const fold=1+.037*Math.sin(87*t+2.4*x)*(smooth(.65,.84,t)-smooth(.91,.947,t))+.021*Math.cos(a*3.0+1.2*t);
      const tone=times(t>=.955 ? band : fabric,.95+.062*y+.039*Math.sin(a*2+t*18));
      b.vertex([w*x*fold,d*y*fold,t],unit([x/w,y/d,0]),[u,t],tone);
      if(i && j) {
        const z=i*(count+1)+j;
        b.indices.push(z-count-2,z-count-1,z,z-count-2,z,z-1);
      }
    }
    return renderer.mesh(b,16);
  }

  function forearm(opaque,mesh,matrix,cuff,side,wristLead=.247,elbowOut=0,ik) {
    const axis=unit(direction(matrix,cuff.axis));
    const wrist=plus(point(matrix,cuff.at),times(axis,.019));
    const rest=[side*.36,-.57,-.15];
    const {shoulder,elbow}=ik ? ik(wrist,side) : {shoulder:rest,
      elbow:[mix(rest[0],wrist[0],.39)+side*(.142+elbowOut),mix(rest[1],wrist[1],.42)-.157,mix(rest[2],wrist[2],.48)]};
    const gripLength=Math.min(wristLead,.30*Math.hypot(...minus(wrist,shoulder)));
    const beforeWrist=minus(wrist,times(axis,gripLength));
    let across=unit(direction(matrix,[cuff.axis[2],0,-cuff.axis[0]]));
    if(across[0]<0) across=times(across,-1);
    opaque.push({mesh,handSide:side,effect:{sleeve:[...shoulder,...elbow,...beforeWrist,...wrist,...across],ik:Boolean(ik)}});
  }

  function nailPlate(shape, center, along, outside, length, width, tint) {
    const axis=unit(along), normal=unit(minus(outside,times(axis,dot(outside,axis))));
    const across=cross(normal,axis), start=shape.vertices.length/11;
    const rows=8, cols=8;
    for(let j=0;j<=rows;j++) {
      const u=j/rows, edge=.67+.33*Math.sin(u*Math.PI)**.42;
      const shade=.94+.055*smooth(0,.28,u)+.075*smooth(.78,1,u);
      for(let i=0;i<=cols;i++) {
        const v=i/cols*2-1;
        const ridge=(1-v*v)*.00145+.00078*Math.sin(u*Math.PI);
        const at=plus(center,plus(times(axis,(u-.5)*length),plus(times(across,v*width*.5*edge),times(normal,ridge))));
        shape.vertex(at,unit(plus(normal,times(across,.35*v))),[i/cols,u],times(tint,shade));
        if(j && i) {
          const d=start+j*(cols+1)+i,c=d-1,b=d-cols-1,a=b-1;
          shape.indices.push(a,b,d,a,d,c);
        }
      }
    }
  }

  // Blend the palm, wrist and fingers into one surface for the fixed grip.
  function gripSurface(paths, skin) {
    const origin=[-.083,-.303,-.027], step=.0036, size=[64,75,60];
    const stride=[1,size[0],size[0]*size[1]];
    const field=new Float32Array(stride[2]*size[2]).fill(.04), part=new Float32Array(field.length);
    for(const [rings,blend] of paths) {
      part.fill(.04);
      for(let i=1;i<rings.length;i++) {
        const [a,w0,d0]=rings[i-1], [b,w1,d1]=rings[i];
        const delta=minus(b,a), length=Math.hypot(...delta), axis=times(delta,1/length);
        const side=unit([axis[2],0,-axis[0]]), up=cross(axis,side);
        const reach=Math.max(w0,w1,d0,d1)+blend;
        const lo=origin.map((v,k)=>Math.max(0,Math.floor((Math.min(a[k],b[k])-v-reach)/step)));
        const hi=origin.map((v,k)=>Math.min(size[k]-1,Math.ceil((Math.max(a[k],b[k])-v+reach)/step)));
        for(let z=lo[2];z<=hi[2];z++) for(let y=lo[1];y<=hi[1];y++) {
          const dz=origin[2]+z*step-a[2], dy=origin[1]+y*step-a[1];
          const row=z*stride[2]+y*stride[1];
          for(let x=lo[0];x<=hi[0];x++) {
            const dx=origin[0]+x*step-a[0];
            const along=axis[0]*dx+axis[1]*dy+axis[2]*dz;
            const across=side[0]*dx+side[2]*dz;
            const normal=up[0]*dx+up[1]*dy+up[2]*dz;
            const t=Math.max(0,Math.min(1,along/length)), cap=along-length*t;
            const width=mix(w0,w1,t), depth=mix(d0,d1,t);
            const d=Math.sqrt(across*across+cap*cap+(normal*width/depth)**2)-width;
            part[row+x]=Math.min(part[row+x],d);
          }
        }
      }
      for(let i=0;i<field.length;i++) {
        const a=field[i], b=part[i], fold=Math.max(0,1-Math.abs(a-b)/blend);
        field[i]=Math.min(a,b)-blend*.25*fold*fold;
      }
    }

    const hand=new Builder(), cells=new Int32Array(field.length).fill(-1);
    const corners=Array.from({length:8},(_,i)=>[i&1,(i>>1)&1,i>>2]);
    const offset=corners.map(c=>dot(c,stride));
    const edges=[];
    for(let axis=0;axis<3;axis++) for(let c=0;c<8;c++) {
      if(!(c&(1<<axis))) edges.push([c,c|(1<<axis)]);
    }
    const values=new Float32Array(8);
    for(let z=0;z<size[2]-1;z++) for(let y=0;y<size[1]-1;y++) for(let x=0;x<size[0]-1;x++) {
      const index=x+y*stride[1]+z*stride[2], inside=field[index]<0;
      let crossed=false;
      for(let c=0;c<8;c++) {
        values[c]=field[index+offset[c]];
        crossed ||= (values[c]<0)!==inside;
      }
      if(!crossed) continue;
      const center=[0,0,0], cell=[x,y,z];
      let crossings=0;
      for(const [a,b] of edges) {
        if((values[a]<0)===(values[b]<0)) continue;
        const t=values[a]/(values[a]-values[b]);
        for(let k=0;k<3;k++) center[k]+=mix(corners[a][k],corners[b][k],t);
        crossings++;
      }
      const [u,v,w]=times(center,1/crossings);
      const normal=unit([
        mix(mix(values[1]-values[0],values[3]-values[2],v),mix(values[5]-values[4],values[7]-values[6],v),w),
        mix(mix(values[2]-values[0],values[3]-values[1],u),mix(values[6]-values[4],values[7]-values[5],u),w),
        mix(mix(values[4]-values[0],values[5]-values[1],u),mix(values[6]-values[2],values[7]-values[3],u),v)
      ]);
      const p=origin.map((o,k)=>o+(cell[k]+[u,v,w][k])*step);
      const uv=[.5+Math.atan2(normal[2],normal[0])/(2*Math.PI),(p[1]-origin[1])*1.75];
      const tip=smooth(-.20,-.076,p[1])*(1-smooth(-.029,.072,p[0]));
      const color=[skin[0]*(.99+.055*tip),skin[1]*(.99-.035*tip),skin[2]*(.99-.044*tip)];
      const here=cells[index]=hand.vertex(p,normal,uv,color);
      for(let axis=0;axis<3;axis++) {
        const a=(axis+1)%3,b=(axis+2)%3;
        if(!cell[a] || !cell[b] || (values[1<<axis]<0)===inside) continue;
        const side=cells[index-stride[a]], diagonal=cells[index-stride[a]-stride[b]], end=cells[index-stride[b]];
        if(inside) hand.indices.push(here,side,diagonal,here,diagonal,end);
        else hand.indices.push(here,end,diagonal,here,diagonal,side);
      }
    }
    return hand;
  }

  function gripHand(renderer,firstFinger=0) {
    const nail = new Builder(), paths=[];
    const skin = rgb(0xcd9b83), nailTone = rgb(0xdab0a3);
    paths.push([[
      [[.068,-.242,.129],.034,.029],
      [[.060,-.222,.120],.034,.028],
      [[.049,-.191,.106],.039,.030],
      [[.049,-.159,.099],.044,.033],
      [[.048,-.128,.090],.039,.030],
      [[.040,-.104,.078],.027,.023],
      [[.030,-.092,.065],.014,.013]
    ],.009]);
    for (let i=firstFinger; i<4; i++) {
      const y=[-.103,-.130,-.156,-.181][i], z=[.002,.007,.013,.019][i];
      const radius=[.0126,.0132,.0121,.0103][i], left=[-.054,-.057,-.054,-.050][i];
      paths.push([[
        [[.061,y+.008,.084+i*.004],radius*.88,radius*.95],
        [[.045,y+.001,.048+i*.003],radius,radius],
        [[.024,y-.003,z+.015],radius*.95,radius],
        [[-.005,y-.006,z-.004],radius*.93,radius*.95],
        [[-.034,y-.004,z+.004],radius*.97,radius*.91],
        [[left+.006,y+.001,z+.024],radius*.89,radius*.85],
        [[left,y+.002,z+.037],radius*.77,radius*.82],
        [[left+.003,y,z+.048],radius*.70,radius*.75],
        [[left+.010,y-.004,z+.057],radius*.36,radius*.45]
      ],.006]);
      nailPlate(nail,[left-radius*.65,y+.001,z+.047],[.30,-.18,.93],[-.96,.23,.08],
        radius*1.31,radius*.98,nailTone);
    }
    paths.push([[
      [[.072,-.157,.117],.024,.023],
      [[.063,-.131,.127],.022,.020],
      [[.046,-.109,.129],.019,.017],
      [[.028,-.093,.126],.016,.015],
      [[.010,-.088,.122],.0133,.0125],
      [[-.005,-.088,.115],.013,.0122],
      [[-.019,-.089,.109],.0115,.0106],
      [[-.029,-.093,.104],.0082,.0087],
      [[-.036,-.096,.101],.0033,.0038]
    ],.017]);
    nailPlate(nail,[-.024,-.083,.116],[-.85,-.18,-.49],[-.13,.44,.89],.0178,.014,nailTone);
    const hand=gripSurface(paths,skin);
    return [renderer.mesh(hand,7),renderer.mesh(nail,15)];
  }

  function makeDigit(renderer,rings,nail) {
    const b=new Builder();
    tube(b,rings,rgb(0xcd9b83),17);
    nailPlate(b,...nail,rgb(0xdcb1a4));
    return renderer.mesh(b,7);
  }

  function supportHand(renderer,sleeve) {
    const palm = new Builder();
    const skin = rgb(0xcd9b83), nail = rgb(0xdcb1a4);
    tube(palm,[
      [[-.169,-.098,.122],.033,.028,1.035],
      [[-.144,-.070,.103],.034,.028,.985],
      [[-.119,-.033,.072],.046,.037,1.02],
      [[-.102,.009,.044],.052,.033,1.03],
      [[-.091,.042,.036],.041,.026,1.01],
      [[-.085,.056,.034],.028,.018,.99],
      [[-.080,.060,.029],.004,.004,.97]
    ],skin,28);
    const fingers = [];
    for (let i=0; i<4; i++) {
      const finger = new Builder();
      const length = [.085,.096,.090,.072][i];
      const radius = [.0103,.0115,.0107,.0086][i];
      const z = (i-1.5)*.0185;
      const root = [-.084,.055,.037+z];
      tube(finger,[
        [[0,0,0],radius*.88,radius*.86,1],
        [[length*.25,.020,z*.03],radius,radius*.94,1.03],
        [[length*.45,.023,z*.10],radius*.97,radius*.88,.97],
        [[length*.56,.021,z*.12],radius*.94,radius*.89,1.04],
        [[length*.72,.018,z*.16],radius*.85,radius*.77,.984],
        [[length*.81,.014,z*.17],radius*.83,radius*.81,1.04],
        [[length*.94,.009,z*.18],radius*.67,radius*.61,1.03],
        [[length,.006,z*.18],.002,.002,1.02]
      ],skin,21);
      nailPlate(finger,[length*.868,.0175,z*.18],[.93,-.38,0],[.10,1,.06],
        length*.18,radius*1.13,nail);
      fingers.push({root,tip:[length,.006,z*.18],mesh:renderer.mesh(finger,7)});
    }
    const thumb=makeDigit(renderer,[
      [[-.007,.009,.002],.004,.004,.99],
      [[.004,-.005,-.001],.015,.014,1],
      [[.014,-.018,-.004],.016,.014,1.01],
      [[.032,-.027,-.018],.013,.011,1.03],
      [[.047,-.025,-.028],.010,.009,1.02],
      [[.053,-.022,-.032],.002,.002,1]
    ],[[.044,-.0167,-.026],[.83,.14,-.52],[0,1,.13],.013,.0118]);
    return {palm:renderer.mesh(palm,7),sleeve,fingers,thumb};
  }

  function shell(renderer) {
    const body = new Builder(), trigger = new Builder(), drive = new Builder(), shaft = new Builder(), powerSwitch = new Builder();
    const green = rgb(0x6eaf40), greenDark = rgb(0x417b25), edge = rgb(0x8abd58);
    const yellow = rgb(0xe1b538), orange = rgb(0xec8b41), black = rgb(0x262c2a);
    body.box([0,-.057,-.223],[.149,.027,.497],green,.006);
    body.box([0,-.047,-.221],[.125,.005,.449],edge,.002);
    body.box([0,.019,.072],[.150,.135,.112],green,.010);
    body.box([0,-.051,.061],[.088,.027,.091],green,.005);
    body.box([0,.086,.071],[.106,.003,.066],greenDark,.0015);
    body.box([0,.087,.071],[.099,.0034,.061],edge,.0014);
    body.box([0,.080,-.535],[.149,.059,.211],green,.014);
    body.box([0,.071,-.455],[.144,.040,.052],green,.013);
    body.box([0,-.032,-.539],[.151,.043,.244],green,.007);
    for (const side of [-1,1]) {
      body.box([side*.057,.012,-.543],[.035,.066,.226],green,.005);
      body.box([side*.039,.016,-.539],[.006,.053,.216],black,.002);
      body.box([side*.029,.004,-.628],[.008,.028,.049],yellow,.002);
      body.box([side*.074,.046,-.533],[.003,.002,.195],greenDark,.0007);
      body.box([side*.072,-.060,-.231],[.005,.007,.455],edge,.001);
      body.box([side*.073,-.050,-.228],[.006,.010,.439],green,.002);
      body.box([side*.042,-.047,-.220],[.004,.005,.375],greenDark,.001);
      body.box([side*.040,-.049,-.024],[.020,.010,.045],green,.003);
      body.box([side*.045,.025,-.441],[.014,.072,.024],black,.002);
    }
    body.box([0,-.010,-.516],[.082,.003,.165],rgb(0x151a19),.002);
    body.box([0,-.008,-.633],[.075,.011,.056],yellow,.002);
    body.box([0,.040,-.557],[.083,.013,.165],black,.002);
    body.box([0,.108,-.502],[.101,.004,.053],greenDark,.0015);
    body.box([0,.110,-.503],[.087,.002,.022],black,.0009);
    powerSwitch.box([0,.116,switchZ],[.040,.014,.037],orange,.004);
    for (const x of [-.009,0,.009]) {
      powerSwitch.box([x,.124,-.505],[.003,.003,.021],rgb(0xf7a755),.001);
    }
    body.box([0,.105,-.574],[.050,.0024,.026],greenDark,.001);
    body.box([0,.106,-.574],[.045,.0021,.022],edge,.0009);
    body.box([0,-.151,.057],[.084,.183,.091],green,.008,[-.17,0,0]);
    body.box([0,-.105,-.022],[.054,.013,.079],green,.003,[.05,0,0]);
    body.box([0,-.077,-.060],[.053,.057,.013],green,.003,[-.20,0,0]);
    trigger.box([0,-.074,-.027],[.026,.041,.011],orange,.003,[-.27,0,0]);

    // The raised half-disc stays on the launcher when the cartridge slides away.
    const [,,hubZ]=coupling;
    const hubRadius=.050, hubX=.083;
    const arc=(x,i)=>[x,rollerY+Math.sin(Math.PI*i/24)*hubRadius,hubZ+Math.cos(Math.PI*i/24)*hubRadius];
    for(let i=0;i<24;i++) {
      const a=arc(hubX,i), b=arc(hubX,i+1), c=arc(.073,i+1), d=arc(.073,i);
      body.triangle([hubX,rollerY,hubZ],b,a,green,[1,0,0]);
      body.triangle([.073,rollerY,hubZ],d,c,greenDark,[-1,0,0]);
      body.quad([a,b,c,d],edge);
    }
    body.box([.078,-.037,hubZ],[.011,.026,.101],green,.003);
    body.cylinder([.072,rollerY,hubZ],[.085,rollerY,hubZ],.011,.0095,greenDark,20);
    shaft.cylinder([.021,0,0],[.090,0,0],.0059,.0059,yellow,16);
    shaft.box([.044,.0039,0],[.041,.0056,.006],rgb(0xffdc59),.0013);
    shaft.cylinder([.020,0,0],[.021,0,0],.0048,.0048,rgb(0xa27320),12);
    shaft.box([.092,.0025,0],[.0017,.005,.0016],black,.0004);

    drive.cylinder([-.042,0,0],[.042,0,0],.0133,.0133,rgb(0x7f4490),20);
    for (const side of [-1,1]) {
      drive.cylinder([side*.042,0,0],[side*.046,0,0],.0108,.0098,rgb(0x462c53),14);
    }
    for (let i=0; i<9; i++) {
      const phase = i/9*2*Math.PI;
      const y = Math.cos(phase)*.0132, z = Math.sin(phase)*.0132;
      drive.cylinder([-.036,y,z],[.036,y,z],.00065,.00065,rgb(0x9961a6),5,false);
    }

    // Shallow plastic seams and small pale scuffs catch the soft light.
    const rng = random(841);
    for (let i=0; i<32; i++) {
      const x = (rng()-.5)*.122, y = (rng()-.5)*.105+.019, z = .128;
      const l = .0015+rng()*.004, tilt = (rng()-.5)*2.8;
      if (Math.abs(x) > .069) continue;
      body.box([x,y,z],[.00055,l,.0006],times(edge,.76+rng()*.27),0,[0,0,tilt]);
    }
    for (let i=0; i<19; i++) {
      const z = -.604+rng()*.153, y = .022+rng()*.054;
      body.box([-.075,y,z],[.0006,.00064,.002+rng()*.006],times(edge,.85+rng()*.18),0,[(rng()-.5)*1.3,0,0]);
    }

    return {
      body:renderer.mesh(body,12),drive:renderer.mesh(drive,12),
      trigger:renderer.mesh(trigger,12),powerSwitch:renderer.mesh(powerSwitch,12),shaft:renderer.mesh(shaft,12)
    };
  }

  function cartridge(renderer) {
    const frame = new Builder(), belt = new Builder(), glass = new Builder(), roller = new Builder(), socket = new Builder(), cap = new Builder();
    const black = rgb(0x262b2b), yellow = rgb(0xe1b538), edge = rgb(0x9cb6b2);
    const purple = rgb(0x854199), inset = rgb(0x6b367b);
    const front = cartridgeFront, back = cartridgeBack, wide = .0715, top = .067, bottom = -.042;
    const mid=(front+back)*.5, length=back-front;
    frame.box([0,-.039,mid],[.139,.011,length],black,.0027);
    frame.box([0,-.025,mid],[.120,.016,length],black,.0025);
    cap.box([0,0,0],[.145,.110,.012],purple,.0033);
    cap.box([0,0,-.006],[.121,.088,.0019],inset,.001);
    cap.box([-.054,-.019,.007],[.027,.020,.019],purple,.003);
    frame.box([0,top,back],[.145,.004,.004],edge,.0011);
    frame.box([0,bottom,back],[.145,.004,.004],edge,.0011);
    frame.box([0,top,front],[.145,.004,.004],edge,.0011);
    frame.box([0,bottom,front],[.145,.004,.004],edge,.0011);
    belt.box([0,-.009,mid],[.112,.016,length],rgb(0x2b302d),.004);
    glass.quad([[-wide,top,front],[wide,top,front],[wide,top,back],[-wide,top,back]], [1,1,1],[0,1,0]);
    glass.quad([[-wide,bottom,back],[wide,bottom,back],[wide,top,back],[-wide,top,back]], [1,1,1],[0,0,1]);
    roller.cylinder([-.065,0,0],[.065,0,0],rollerRadius,rollerRadius,yellow,15);
    for (const side of [-1,1]) {
      const x = wide*side;
      frame.box([x,top,mid],[.0034,.0034,length],edge,.001);
      frame.box([x,bottom,mid],[.0028,.004,length],rgb(0x677f7d),.001);
      frame.box([x,(top+bottom)*.5,front],[.004,top-bottom,.0034],edge,.001);
      frame.box([x,(top+bottom)*.5,back],[.003,top-bottom,.003],edge,.001);
      glass.quad([[x,bottom,front],[x,bottom,back],[x,top,back],[x,top,front]], [1,1,1],[side,0,0]);
      roller.cylinder([.064*side,0,0],[.068*side,0,0],.0113,.0102,rgb(0xf1c952),14);
      roller.cylinder([.068*side,0,0],[.069*side,0,0],.0053,.0053,rgb(0x98711f),12);
      for (let i=0; i<3; i++) {
        const a = 2.094*i;
        roller.ellipsoid([.0684*side,Math.cos(a)*.008,Math.sin(a)*.008],[.0012,.0015,.0023],rgb(0xb4892a),[a,0,0],8,5);
      }
    }
    socket.cylinder([.068,0,0],[.072,0,0],.0091,.0088,yellow,18);
    socket.cylinder([.072,0,0],[.0726,0,0],.0069,.0069,black,16);
    return {
      frame: renderer.mesh(frame,12),
      belt: renderer.mesh(belt,9),
      glass: renderer.mesh(glass,6,[.65,.82,.84,.31]),
      roller: renderer.mesh(roller),
      socket: renderer.mesh(socket),
      cap: renderer.mesh(cap,12)
    };
  }

  function build(renderer) {
    const sleeve=sleeveMesh(renderer);
    const triggerFinger=makeDigit(renderer,[
      [[.062,-.115,.089],.012,.012,.99],
      [triggerHinge,.015,.013,1.02],
      [[.044,-.087,.036],.013,.012,1.04],
      [[.036,-.079,.003],.012,.011,1.01],
      [[.027,-.075,-.027],.011,.009,1.01],
      [[.017,-.074,-.041],.009,.008,1.03],
      [[.006,-.076,-.042],.003,.003,1]
    ],[[.012,-.067,-.042],[-.86,-.12,-.43],[.16,.98,0],.012,.010]);
    return {
      ...shell(renderer), cartridge:cartridge(renderer), hand:gripHand(renderer,1), triggerFinger, sleeve,
      support:supportHand(renderer,sleeve), cars:carSpecs.map(s=>modelCar(renderer,s))
    };
  }

  function inspectionPress(t) {
    return smooth(inspection.press-.06,inspection.press,t)*(1-smooth(inspection.release,inspection.release+.11,t));
  }

  function pose(aim, stride, swayX, swayY, { slide,lift,twist }, change, time, swim, aspect, switching, inspecting) {
    const hip = 1-aim;
    const width = Math.min(1,aspect/1.5);
    const x = mix(.316*width,-.008,aim), y = mix(-.194,-.106,aim), z = mix(-.852,-.921,aim);
    const pitch = mix(.28,.010,aim), yaw = mix(.196*width,-.001,aim);
    const sway = mix(1,.46,aim);
    const lateral = .72*Math.sin(time*1.13+.42)+.28*Math.sin(time*2.87+1.1);
    const vertical = .76*Math.sin(time*1.63-.36)+.24*Math.sin(time*3.29+.93);
    const reloadTime = change?.time ?? 0;
    const timing = change?.timing ?? reload;
    const service = smooth(0,.28,reloadTime)*(1-smooth(timing.seat,timing.end,reloadTime));
    const latch = Math.sin(smooth(timing.seat-.045,timing.seat+.09,reloadTime)*Math.PI);
    const expose = switching ? smooth(.015,switchTiming.touch,switching.time)
      *(1-smooth(switchTiming.lift,switchTiming.end,switching.time)) : 0;
    const float = swim.amount*(1-service*.72);
    const surge = Math.sin(swim.phase)*float*mix(.33,1,swim.power);
    const drift = Math.cos(swim.phase)*float*mix(.38,1,swim.power);
    if(inspecting) {
      const t=inspecting.time, turn=smooth(.88,1.58,t);
      const show=smooth(0,.54,t)*(1-smooth(inspection.seat+.07,inspection.end,t));
      const press=inspectionPress(t);
      return transform([
        mix(x,mix(-.06,.235,turn)*width,show),
        mix(y,mix(-.105,-.135,turn),show)-.006*press,
        mix(z,-.91-.06*turn,show)
      ],mix(pitch,.19+.09*turn,show)+.026*press,
        mix(yaw,mix(-.72,1.24,turn),show),
        mix(-.096*hip,mix(-.27,.32,turn),show)-.018*press);
    }
    return transform([
      x+(lateral*.006+swayX*.006+stride*.010)*sway+twist*.028-service*.038+surge*.031+expose*.024,
      y+(vertical*.0046+swayY*.005)*sway-slide*.036-service*.041-latch*.009+float*.042+surge*.027-expose*.043,
      z+vertical*.003*sway+slide*.146-service*.050+drift*.031
    ],pitch+(vertical*.013+swayY*.007)*sway+lift*.243+service*.049-latch*.027+float*.025+surge*.048+expose*.145,
      yaw+(-lateral*.015+swayX*.017-stride*.008)*sway+twist*.072+service*.122+drift*.043+expose*.058,
      -.096*hip+(lateral*.011+stride*.017)*sway-twist*.117-service*.121+surge*.077-expose*.072);
  }

  function cartridgeParts(toy, matrix, ammo, belt, feed = 0, advancing = false) {
    const { frame, glass, roller, socket, belt:track } = toy.cartridge;
    const opaque = [{mesh:frame,matrix},{mesh:track,matrix,belt}];
    for (let i=0; i<carCount; i++) {
      const wheel=multiply(matrix,transform([0,rollerY,station(i)],-belt/rollerRadius));
      opaque.push({mesh:roller,matrix:wheel});
      if(i===carCount-1) opaque.push({mesh:socket,matrix:wheel});
    }
    for (let i=0; i<ammo.length; i++) {
      let z = station(i)-slot*feed;
      if (i === 0 && advancing) z -= .200*smooth(jamFeed,1,feed);
      opaque.push({mesh:toy.cars[ammo[i]],matrix:multiply(matrix,transform([0,.001,z]))});
    }
    return {opaque,glass:{mesh:glass,matrix}};
  }

  function removalPose(poseMatrix, time, stashing = false) {
    const slide = smooth(reload.grab,reload.lifted,time);
    if (stashing) {
      const pocket = smooth(reload.lifted,reload.stow,time);
      return multiply(poseMatrix,transform([
        sideTravel*slide-.236*pocket,-.49*pocket,mountZ+.22*pocket
      ],-.27*pocket,.57*pocket,-.35*pocket));
    }
    const swing = smooth(reload.lifted,reload.toss,time);
    return multiply(poseMatrix,transform([
      sideTravel*slide-.17*swing,.18*swing,mountZ+.085*swing
    ],-.14*swing,-.47*swing,-.40*swing));
  }

  function insertionPose(poseMatrix, time, timing) {
    const rise = smooth(timing.bring,timing.show,time);
    const align = smooth(timing.alignStart,timing.insert,time);
    const slide = 1-smooth(timing.insert,timing.seat,time);
    const display = [mix(-.410,-.210,rise),mix(-.365,.145,rise),mountZ+mix(.193,.124,rise)+.052];
    const side = [sideTravel*slide,0,mountZ];
    const local = transform(display.map((value,i)=>mix(value,side[i],align)),
      .08*(1-align),.70*(1-align),-.163*(1-align));
    return multiply(poseMatrix,local);
  }

  function capPose(poseMatrix, time) {
    const pop = smooth(reload.pry,reload.capDrop,time);
    return multiply(insertionPose(poseMatrix,time,reload),transform([
      -.042*pop,.013+.045*pop,cartridgeFront-.054*pop
    ],-.26*pop,.43*pop,-.74*pop));
  }

  function hold(opaque,toy,matrix,grip=toy.hand,side=1,elbowOut=0) {
    opaque.push(...grip.map(mesh=>({mesh,matrix,handSide:side})));
    forearm(opaque,toy.sleeve,matrix,rightCuff,side,.247,elbowOut);
  }

  function reach(opaque, hand, matrix, grip, pry = 0, flick = 0, pointing = false, {pinch=0,side=-1,thumb,wristLead,curl=0,ik} = {}) {
    opaque.push({mesh:hand.palm,matrix,handSide:side});
    forearm(opaque,hand.sleeve,matrix,leftCuff,side,wristLead,0,ik);
    const open = 1-grip;
    for (const [i,{mesh,root}] of hand.fingers.entries()) {
      const spread=pointing && i===0 ? 0 : open;
      const flex=pointing && i===0 ? 0 : curl*(.85+i*.068);
      opaque.push({mesh,handSide:side,matrix:multiply(matrix,transform(root,0,spread*(i-1.5)*.077,spread*.66-flex-(i===0 ? 0 : pinch*.64)))});
    }
    opaque.push(thumb ? {...thumb,handSide:side} : {mesh:hand.thumb,handSide:side,matrix:multiply(matrix,transform(
      [-.118+.035*pry-.022*flick+.025*pinch+.025*curl,-.022+.024*pry+.054*flick+.027*pinch+.011*curl,
        .078-.007*pry-.028*flick-.016*pinch-.029*curl],
      .13*pry-.22*flick+.34*curl,-open*.26+.72*pry+.13*flick+.37*curl,-open*.48+.31*pry+.21*flick+.52*pinch
    ))});
  }

  function slideSwitch(opaque,hand,poseMatrix,motor) {
    const {time,from}=motor.switching;
    const {touch,flip,lift,end}=switchTiming;
    const away=1-smooth(.016,touch-.024,time)*(1-smooth(lift+.015,end,time));
    const press=smooth(touch-.064,touch,time)*(1-smooth(flip+.021,lift+.025,time));
    const pad=[switchOffset(motor.position)+(from ? .007 : -.007)-away*.24,
      .127+(1-press)*.063-away*.58,switchZ+.003+away*.31];
    const handPose=transform([0,0,0],.12+away*.24,.32-away*.19,-.26+away*.15);
    const {root,tip}=hand.fingers[0];
    handPose.set(minus(pad,direction(handPose,plus(root,tip))),12);
    reach(opaque,hand,multiply(poseMatrix,handPose),mix(.43,.58,press),0,0,true);
  }

  function stroke(opaque, hand, swim, side = -1) {
    const phase = swim.phase+(side===1 ? Math.PI : 0);
    const extension = .5-.5*Math.cos(phase);
    const sweep = Math.sin(phase);
    const recovery = Math.max(0,sweep);
    const matrix = transform([
      side*(.251-.083*extension+.054*sweep),
      -.351+.166*recovery+.047*extension-.23*(1-swim.amount)-.066*(1-swim.power),
      -.600-.456*extension
    ],.11-.36*sweep,side*(.43-.38*extension),side*(.23-.21*sweep));
    if(side>0) for(let i=0;i<3;i++) matrix[i]*=-1;
    reach(opaque,hand,matrix,.37+.19*extension,0,0,false,{side});
  }

  function shellParts(toy,poseMatrix,belt,press,motor,turn=0) {
    const opaque=[{mesh:toy.body,matrix:poseMatrix}];
    opaque.push({mesh:toy.trigger,matrix:multiply(poseMatrix,transform([0,0,.006*press]))});
    opaque.push({mesh:toy.drive,matrix:multiply(poseMatrix,transform([0,.038,-.425],-motor.angle))});
    opaque.push({mesh:toy.powerSwitch,matrix:multiply(poseMatrix,transform([switchOffset(motor.position),0,0]))});
    opaque.push({mesh:toy.shaft,matrix:multiply(poseMatrix,transform(coupling,-belt/rollerRadius+turn))});
    return opaque;
  }

  function looseLauncher(toy,matrix,mounted,motor) {
    const poseMatrix=multiply(matrix,transform([0,0,.260]));
    const opaque=shellParts(toy,poseMatrix,mounted.belt,0,motor);
    if(mounted.missing) return {opaque};
    const cart=cartridgeParts(toy,multiply(poseMatrix,transform([0,0,mountZ])),mounted.cars,mounted.belt,mounted.feed);
    opaque.push(...cart.opaque);
    return {opaque,glass:cart.glass};
  }

  function assemble(toy, poseMatrix, mounted, cycle, change, swim, motor, triggerPress=0, inspecting=null) {
    const t=inspecting?.time ?? 0;
    const belt = mounted.belt+(cycle ? cycle.progress-cycle.start : 0)*slot;
    const testTurn = -2*Math.PI*(smooth(inspection.press,inspection.release,t)
      + smooth(inspection.press+.06,inspection.release-.10,t));
    const press=inspecting ? inspectionPress(t) : triggerPress;
    const opaque = shellParts(toy,poseMatrix,belt,press,motor,testTurn);
    hold(opaque,toy,poseMatrix);
    const finger=transform([0,0,0],0,.086*press);
    finger.set(minus(triggerHinge,direction(finger,triggerHinge)),12);
    opaque.push({mesh:toy.triggerFinger,matrix:multiply(poseMatrix,finger)});
    let cartridge;
    if (inspecting) {
      const slide=smooth(inspection.pull,inspection.clear,t)*(1-smooth(inspection.align,inspection.seat,t));
      const clear=smooth(inspection.clear,inspection.clear+.26,t)*(1-smooth(inspection.align-.31,inspection.align,t));
      const matrix=multiply(poseMatrix,transform([sideTravel*slide-.076*clear,.129*clear,mountZ+.076*clear],
        -.09*clear,-.29*clear,-.21*clear));
      // Move the free cartridge aside in the camera view so it cannot hide the exposed shaft.
      matrix[12]-=.29*clear;
      matrix[13]+=.05*clear;
      cartridge=cartridgeParts(toy,matrix,mounted.cars,mounted.belt,mounted.feed);
      const grip=smooth(inspection.pull-.36,inspection.pull,t)*(1-smooth(inspection.seat,inspection.end,t));
      if(grip>0) {
        const hand=multiply(matrix,transform([-.20*(1-grip),-.34*(1-grip),-.036+.10*(1-grip)],0,.17*(1-grip)));
        reach(opaque,toy.support,hand,grip);
      }
    } else if (!change) {
      const feed = mounted.cars.length && cycle ? cycle.progress : mounted.feed;
      if(!mounted.missing) cartridge = cartridgeParts(toy,multiply(poseMatrix,transform([0,0,mountZ])),mounted.cars,belt,feed,cycle?.powered || cycle?.progress>jamFeed);
      if (motor.switching) slideSwitch(opaque,toy.support,poseMatrix,motor);
      else if (swim.amount > .018) stroke(opaque,toy.support,swim);
    } else {
      const {time,timing,stashing,uncap,outgoing,incoming} = change;
      if (time < (stashing ? timing.stow : timing.toss)) {
        const matrix = removalPose(poseMatrix,time,stashing);
        if(!outgoing.missing) cartridge = cartridgeParts(toy,matrix,outgoing.cars,outgoing.belt,outgoing.feed);
        const approach = 1-smooth(.015,timing.grab-.045,time);
        const hand = multiply(matrix,transform([-.236*approach,-.448*approach,.117*approach],0,.24*approach,-.19*approach));
        reach(opaque,toy.support,hand,smooth(.23,timing.grab,time));
      } else if (!stashing && time < timing.bring-.045) {
        const follow = smooth(timing.toss,timing.bring-.045,time);
        const release = removalPose(poseMatrix,timing.toss);
        const hand = multiply(release,transform([-.221*follow,-.535*follow,.091*follow],.22*follow,.19*follow,-.24*follow));
        reach(opaque,toy.support,hand,1-smooth(timing.toss,timing.toss+.11,time));
      } else if (time >= timing.bring) {
        const matrix = insertionPose(poseMatrix,time,timing);
        cartridge = cartridgeParts(toy,matrix,incoming.cars,incoming.belt,incoming.feed);
        if (uncap && time < timing.capDrop) opaque.push({mesh:toy.cartridge.cap,matrix:capPose(poseMatrix,time)});
        const relax = uncap ? 1-smooth(timing.capDrop,timing.capDrop+.15,time) : 0;
        const pry = smooth(timing.show,timing.pry,time)*relax;
        const flick = smooth(timing.pry,timing.capDrop,time)*relax;
        const gripZ = uncap ? mix(cartridgeFront-.014,-.034,smooth(timing.capDrop+.04,timing.align+.08,time)) : -.034;
        const retreat = smooth(timing.seat+.04,timing.end,time);
        const hand = multiply(matrix,transform([-.263*retreat,-.481*retreat,gripZ+.100*retreat],.14*retreat,.29*retreat,-.22*retreat));
        reach(opaque,toy.support,hand,1-smooth(timing.seat,timing.seat+.17,time),pry,flick);
      }
    }
    if (cartridge) opaque.push(...cartridge.opaque);
    return {opaque,glass:cartridge?.glass,belt};
  }

  function swimmingHands(toy,swim) {
    const opaque=[];
    if(swim.amount>.018) for(const side of [-1,1]) stroke(opaque,toy.support,swim,side);
    return {opaque};
  }

  function throwingHands(toy,age,twoHands) {
    const opaque=[], fall=smooth(.214,.49,age);
    for(const side of twoHands ? [-1,1] : [1]) {
      const matrix=transform([side*mix(.24,.36,fall),mix(-.285,-.87,fall),mix(-.96,-.62,fall)],
        mix(-.36,.49,fall),side*mix(.24,.46,fall),side*mix(.30,.51,fall));
      if(side>0) for(let i=0;i<3;i++) matrix[i]*=-1;
      reach(opaque,toy.support,matrix,mix(.13,.54,fall),0,0,false,{side});
    }
    return opaque;
  }

  function struggle(toy,t,released) {
    const opaque=[];
    if(!released) return opaque;
    for(const side of [-1,1]) {
      const a=t*(side===1 ? 10.2 : 8.7)+side*1.4, b=t*5.4+side;
      const arm=transform([side*(.28+.13*Math.sin(a)), -.39+.22*Math.sin(b)+.08*Math.cos(a*1.61),-.64+.22*Math.cos(a)],
        .31*Math.sin(a)-.37,side*(.36+.39*Math.sin(b)),side*(.31+.46*Math.cos(a)));
      if(side>0) for(let i=0;i<3;i++) arm[i]*=-1;
      reach(opaque,toy.support,arm,.20+.49*(.5+.5*Math.sin(a*1.31)),0,0,false,{side});
    }
    return opaque;
  }

  Valley.launcher = {build,pose,assemble,looseLauncher,swimmingHands,throwingHands,struggle,cartridgeParts,removalPose,capPose,gripHand,hold,reach,makeDigit,
    reload,uncappedReload,switchTiming,inspection,jamFeed,slot,muzzle,carCount};
})();
