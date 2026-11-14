"use strict";

(() => {
  const { Builder, clamp, mix, rgb, unit, cross, minus, times, transform, point } = Valley;
  const TAU = 2*Math.PI;
  const metal = 0, fabric = 10, vinyl = 11, plastic = 12;
  const ink = rgb(0x222725), aluminium = rgb(0xc3c7bc), binding = rgb(0xd9ddcb);
  const parts = (...materials) => materials.map(material=>({material,shape:new Builder()}));

  function surface(shape, width, height, sample, paint, flip = 1, repeat = [1,1]) {
    const start = shape.vertices.length/11;
    shape.clothCharts?.push({start,width,height});
    for (let j=0; j<=height; j++) {
      const v = j/height;
      for (let i=0; i<=width; i++) {
        const u = i/width, e = .001;
        const du = minus(sample(Math.min(1,u+e),v),sample(Math.max(0,u-e),v));
        const dv = minus(sample(u,Math.min(1,v+e)),sample(u,Math.max(0,v-e)));
        const normal = unit(times(cross(du,dv),flip));
        const tint = typeof paint === "function" ? paint(u,v) : paint;
        shape.vertex(sample(u,v),normal,[u*repeat[0],v*repeat[1]],tint);
      }
    }
    for (let j=0; j<height; j++) {
      for (let i=0; i<width; i++) {
        const a = start+j*(width+1)+i, b = a+width+1;
        shape.indices.push(a,a+1,b+1,a,b+1,b);
      }
    }
  }

  function line(shape, at, steps, radius, color) {
    let a = at(0);
    for (let i=1; i<=steps; i++) {
      const b = at(i/steps);
      shape.cylinder(a,b,radius,radius,color,6,false);
      a = b;
    }
  }

  function umbrella(colors, radius = 1.27, lean = 0) {
    const model = parts(fabric,metal,metal);
    const [{shape:cloth},{shape:frame},{shape:pole}] = model;
    cloth.clothCharts=[];
    model[2].name="pole";
    const poleHeight = 2.12, panels = 8;
    const crown = transform([0,poleHeight,0],0,0,lean);
    const canopy = (panel,u,v) => {
      const a = TAU*(panel+u)/panels;
      const fullness = 1-.041*Math.sin(u*Math.PI);
      const reach = radius*v*fullness;
      const y = -.38*Math.pow(v,.83)-.031*Math.sin(Math.PI*u)*v*v;
      return point(crown,[Math.cos(a)*reach,y,Math.sin(a)*reach]);
    };
    for (let i=0; i<panels; i++) {
      const color = rgb(colors[i%colors.length]);
      surface(cloth,10,12,(u,v)=>canopy(i,u,mix(.006,1,v)),color,1,[1.3,2.4]);
      surface(cloth,10,2,(u,v)=>{
        const p=canopy(i,u,1);
        return [p[0]*mix(1,.989,v),p[1]-v*(.053+.018*Math.sin(Math.PI*u)),p[2]*mix(1,.989,v)];
      },times(color,.93),1,[1.3,.17]);
      line(frame,v=>canopy(i,0,mix(.032,1,v)),12,.0066,times(binding,.75));
      line(frame,u=>{
        const p=canopy(i,u,1);
        return [p[0]*.989,p[1]-.053-.018*Math.sin(Math.PI*u),p[2]*.989];
      },10,.004,binding);
      const hub=point(crown,[0,-.37,0]);
      const end=canopy(i,0,.79);
      frame.cylinder(hub,[end[0],end[1]-.03,end[2]],.0061,.0044,aluminium,7,false);
    }
    pole.cylinder([0,-.11,0],point(crown,[0,.042,0]),.027,.022,rgb(0xe1e2d0),16,true,26);
    pole.cylinder([0,-.015,0],[0,.88,0],.033,.031,rgb(0xd3d6cb),14,true,13);
    pole.cylinder([0,.87,0],[0,.96,0],.040,.032,rgb(0xaaa99b),14,true,2);
    pole.ellipsoid(point(crown,[0,.045,0]),[.029,.021,.028],binding,null,12,7);
    return model;
  }

  function chair(color) {
    const model=parts(fabric,metal,plastic);
    const [{shape:cloth},{shape:tube},{shape:trim}]=model;
    cloth.clothCharts=[];
    const main=rgb(color), hem=rgb(0x29292a);
    const seat=(u,v)=>[(u-.5)*.515,.432+.036*Math.cos(v*Math.PI)-.064*Math.sin(u*Math.PI)*Math.sin(v*Math.PI),
      mix(-.247,.225,v)+.021*Math.sin(u*Math.PI)*Math.cos(v*Math.PI)];
    const back=(u,v)=>[(u-.5)*(.505+v*.018),mix(.419,.987,v)-.027*Math.sin(u*Math.PI)*v,
      .228+.152*v+.069*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)];
    const colorAt=(u,v)=>(u<.097||u>.903||v<.045||v>.96) ? hem : times(main,.88+.16*Math.sin(u*Math.PI)*Math.sin(v*Math.PI));
    surface(cloth,16,14,seat,colorAt,-1,[1.8,1.7]);
    surface(cloth,16,16,back,colorAt,-1,[1.8,2.2]);
    for(const side of [-1,1]) {
      const x=side*.270;
      tube.cylinder([x,-.045,-.283],[x,.952,.365],.015,.012,ink,10,true,15);
      tube.cylinder([x,-.052,.315],[x,.464,-.258],.014,.011,ink,10,true,10);
      tube.cylinder([x,.037,-.274],[x,.641,-.269],.010,.010,ink,9,true,8);
      tube.cylinder([x,.269,.065],[x,.269,.099],.024,.024,aluminium,10);
      trim.box([x,.633,-.047],[.048,.020,.437],hem,.008,[.035,0,0]);
      trim.box([x,-.032,-.282],[.048,.032,.050],hem,.008);
      trim.box([x,-.032,.315],[.048,.032,.050],hem,.008);
      line(cloth,v=>seat(side<0 ? .015 : .985,v),16,.0076,hem);
      line(cloth,v=>back(side<0 ? .018 : .982,v),16,.008,hem);
    }
    for(const side of [-1,1]) {
      tube.cylinder([side*.268,-.024,-.252],[-side*.266,.426,-.243],.010,.009,ink,9,true,9);
      tube.cylinder([side*.264,-.029,.291],[-side*.267,.594,.276],.010,.009,ink,9,true,11);
    }
    line(cloth,u=>back(u,.99),18,.0074,hem);
    line(cloth,u=>seat(u,.015),18,.0074,hem);
    return model;
  }

  function moldedPanel(shape,[x,y,z],[w,h,d],top,edge) {
    for(const side of [-1,1]) {
      surface(shape,29,18,(u,v)=>[x+(u-.5)*w,y+side*h*.5,z+(v-.5)*d],side>0 ? top : edge,-side,[2.6,1.7]);
      surface(shape,29,3,(u,v)=>[x+(u-.5)*w,y+(v-.5)*h,z+side*d*.5],edge,side,[2.6,.18]);
      surface(shape,18,3,(u,v)=>[x+side*w*.5,y+(v-.5)*h,z+(u-.5)*d],edge,-side,[1.7,.18]);
    }
  }

  function picnicTable() {
    const [top]=parts(plastic);
    const mold=top.shape, model=[top];
    top.group="top";
    const blue=rgb(0x216dae), pale=rgb(0x318ac7), dark=rgb(0x1d4773);
    moldedPanel(mold,[0,.665,0],[1.16,.064,.72],pale,blue);
    for (const side of [-1,1]) {
      const [bench,frame,feet]=parts(plastic,metal,plastic);
      bench.group="bench"+side;
      frame.group=feet.group="frame"+side;
      model.push(bench,frame,feet);
      const legs=frame.shape;
      moldedPanel(bench.shape,[0,.366,.584*side],[1.12,.052,.246],pale,blue);
      mold.box([0,.636,.332*side],[1.10,.021,.037],dark,.004);
      for (const x of [-.443,.443]) {
        legs.box([x,.465,.21*side],[.032,.41,.034],aluminium,.004,[-.24*side,0,0],8);
        legs.box([x,.147,.591*side],[.034,.37,.031],aluminium,.005,[.19*side,0,0],8);
        legs.box([x,.084,.348*side],[.038,.034,.547],aluminium,.003,null,9);
        legs.cylinder([x,.11,.524*side],[x,.372,.389*side],.012,.012,aluminium,8,true,6);
        feet.shape.box([x,-.027,.638*side],[.055,.040,.054],dark,.008);
      }
    }
    mold.box([0,.633,0],[.083,.031,.693],dark,.004);
    const [brace]=parts(metal);
    brace.group="brace";
    brace.shape.cylinder([-.48,.102,0],[.48,.102,0],.021,.021,aluminium,10,true,15);
    model.push(brace);
    return model;
  }

  function cup(tint) {
    const model=parts(plastic);
    const [{shape}]=model, color=rgb(tint);
    shape.cylinder([0,0,0],[0,.104,0],.030,.043,color,22,false);
    shape.cylinder([0,.018,0],[0,.102,0],.028,.039,times(color,.77),22,false);
    shape.cylinder([0,0,0],[0,.012,0],.030,.031,times(color,.87),20);
    shape.cylinder([0,.100,0],[0,.106,0],.043,.044,times(color,1.07),22,false);
    return model;
  }

  function lunchBox() {
    const model=parts(plastic), [{shape}]=model;
    shape.box([0,.058,0],[.295,.114,.208],rgb(0xcfd4d1),.020);
    shape.box([0,.122,0],[.306,.022,.218],rgb(0xedecdd),.009);
    shape.box([0,.067,.113],[.050,.043,.015],rgb(0x9bb7b9),.006);
    return model;
  }

  function flask() {
    const model=parts(plastic,metal);
    const [{shape:shell},{shape:cap}]=model, body=rgb(0xa0afb2), lid=rgb(0x474c50);
    shell.cylinder([0,0,0],[0,.222,0],.052,.054,body,24);
    shell.cylinder([0,.015,0],[0,.028,0],.055,.054,times(body,.81),24,false);
    shell.cylinder([0,.205,0],[0,.233,0],.055,.050,lid,22);
    cap.cylinder([0,.230,0],[0,.258,0],.051,.048,rgb(0xd3d5ce),24);
    return model;
  }

  function duffelBag() {
    const model=parts(fabric,metal), [{shape:cloth},{shape:zipper}]=model;
    const canvas=rgb(0x46574f), end=rgb(0x33443e), webbing=rgb(0x242c29), ochre=rgb(0xd3ae62);
    function shell(u,v,lift=0) {
      const a=v*TAU, taper=.38+.62*Math.sin(Math.PI*u)**.38;
      const folds=1+.024*Math.sin(a*5+u*19)+.019*Math.cos(a*9-u*16);
      return [mix(-.49,.49,u),Math.max(.014,.161+(.184*taper*folds+lift)*Math.cos(a)),
        (.252*taper*folds+lift)*Math.sin(a)];
    }
    surface(cloth,36,30,(u,v)=>shell(u,v),(u,v)=>times(canvas,.89+.15*Math.cos(v*TAU)+.05*Math.sin(u*31)), -1,[2.45,2.0]);
    for(const u of [0,1]) {
      surface(cloth,26,5,(v,t)=>{
        const edge=shell(u,v);
        return [edge[0]+(u===0 ? -1 : 1)*.039*(1-t*t),mix(.16,edge[1],t),edge[2]*t];
      },end,u===0 ? -1 : 1,[1.4,1.2]);
    }
    for(const u of [.095,.905]) line(cloth,v=>shell(u,v,.003),31,.0044,end);
    for(const u of [.274,.727]) {
      surface(cloth,4,30,(x,v)=>shell(u+(x-.5)*.051,v,.006),webbing,-1,[.21,2.1]);
      for(const side of [-1,1]) line(cloth,v=>shell(u+side*.022,v,.007),29,.0013,times(canvas,.82));
    }
    for(const side of [-1,1]) {
      const loop=t=>[mix(-.224,.223,t),.322+.110*Math.sin(t*Math.PI),side*(.126-.064*Math.sin(t*Math.PI))];
      line(cloth,loop,24,.013,webbing);
      line(cloth,t=>loop(mix(.36,.64,t)),8,.019,times(webbing,1.17));
    }
    line(cloth,t=>shell(mix(.05,.95,t),.026,.007),35,.012,end);
    for(let i=0;i<36;i++) {
      const p=shell(mix(.066,.934,i/35),.026,.014);
      zipper.box(p,[.013,.003,.013],rgb(i%2 ? 0xa89b77 : 0xc1b490),.0008);
    }
    const slide=shell(.82,.026,.019);
    zipper.box(slide,[.040,.009,.023],rgb(0xaaa38a),.002);
    cloth.box([slide[0]+.038,slide[1]-.001,slide[2]+.008],[.059,.010,.021],ochre,.003,[0,-.19,0]);
    surface(cloth,8,5,(u,v)=>shell(mix(.365,.632,u),mix(.159,.226,v),.008),
      (u,v)=>u<.08 || u>.92 || v<.12 || v>.86 ? end : ochre,-1);
    return model;
  }

  function doorWidth(entry,y) {
    const arch=clamp((y-entry.spring)/(entry.height-entry.spring),0,1);
    return entry.width*Math.sqrt(1-arch*arch);
  }

  function tent(lowerHex, upperHex, edgeHex, wide, long, tall) {
    const model=parts(fabric,metal,metal,fabric,plastic);
    model[1].name="frame";
    model[3].name=model[4].name="interior";
    const [{shape:cloth},{shape:frame},{shape:pegs},{shape:lining},{shape:gear}]=model;
    cloth.clothCharts=[];
    const lower=rgb(lowerHex), upper=rgb(upperHex), piping=rgb(edgeHex);
    const anodized=rgb(0x828c8b);
    const base=.022, crown=Math.PI*.499, front=.90, panels=7;
    const entry={wide,long,tall,height:Math.min(1.27,tall-.12),spring:.86,width:Math.min(.57,wide*.55),floor:.043};
    const archTop=Math.asin((entry.height-base)/tall)/crown;
    const canopy=(angle,v,lo,hi)=>{
      const t=v*crown, seam=Math.sin(Math.PI*(angle-lo)/(hi-lo))*Math.sin(Math.PI*v);
      const swell=Math.cos(t)*(1-.021*seam);
      return [wide*Math.sin(angle)*swell,base+tall*Math.sin(t)-.017*seam,-long*Math.cos(angle)*swell];
    };
    const doorAngle=v=>Math.asin(clamp(doorWidth(entry,base+tall*Math.sin(v*crown))/(wide*Math.cos(v*crown)),0,Math.sin(front-.045)));
    const color=v=>v<.48 ? lower : upper;
    function pole(angle) {
      const rib=v=>{
        const [x,y,z]=canopy(angle,v,angle,angle+1);
        return [x*1.024,y+.018,z*1.024];
      };
      line(frame,v=>rib(mix(.012,.990,v)),23,.019,anodized);
      for(const v of [.17,.54]) frame.cylinder(rib(v-.016),rib(v+.016),.024,.024,aluminium,8);
    }
    for(let i=0;i<panels;i++) {
      const lo=front+i*(TAU-2*front)/panels, hi=front+(i+1)*(TAU-2*front)/panels;
      const panel=(u,v)=>canopy(mix(lo,hi,u),v,lo,hi);
      surface(cloth,13,22,panel,(_u,v)=>color(v),-1,[1.9,2.5]);
      line(pegs,v=>panel(0,v),21,.0083,piping);
      line(pegs,u=>panel(u,.018),13,.009,times(piping,.65));
      if (i%2===0) {
        pole(lo);
        const a=panel(0,.34), ground=panel(0,0);
        const stake=[ground[0]*1.20,-.12,ground[2]*1.20];
        pegs.cylinder(a,stake,.0048,.0048,rgb(0xa39e79),6,false);
        pegs.cylinder([stake[0],-.10,stake[2]],[stake[0]*1.009,.033,stake[2]*1.009],.012,.008,aluminium,7);
      }
    }
    const frontPanel=(angle,v)=>canopy(angle,v,-front,front);
    surface(cloth,24,10,(u,v)=>frontPanel(mix(-front,front,u),mix(archTop,1,v)),
      (_u,v)=>color(mix(archTop,1,v)),-1,[1.9,1.15]);
    line(pegs,v=>frontPanel(-front,v),21,.0083,piping);
    pole(-front);
    for(const side of [-1,1]) {
      const wing=(u,v)=>frontPanel(side*mix(doorAngle(v*archTop),front,u),v*archTop);
      surface(cloth,12,21,wing,(_u,v)=>color(v*archTop),-side,[1.9,1.65]);
      line(pegs,v=>wing(0,v),27,.0148,piping);
      line(pegs,u=>wing(u,.012),12,.009,times(piping,.67));
      line(cloth,v=>{
        const p=wing(0,mix(.04,.66,v));
        return [p[0]+side*.029,p[1],p[2]-.019];
      },16,.022,times(lower,.82));
    }
    pegs.ellipsoid([0,base+tall,0],[.030,.013,.030],piping,null,12,7);

    const groundsheet=rgb(0x5a5751);
    const mid=lining.vertex([0,entry.floor,0],[0,1,0],[.5,.5],groundsheet);
    const edge=[];
    for(let i=0;i<=56;i++) {
      const a=i*TAU/56, x=Math.sin(a), z=Math.cos(a);
      edge.push(lining.vertex([x*wide*.992,entry.floor,z*long*.992],[0,1,0],[.5+x*.95,.5+z*.92],times(groundsheet,.88)));
      if(i) lining.indices.push(mid,edge[i-1],edge[i]);
    }
    const pad=rgb(0x647b5a), quilt=rgb(0x848558), pillow=rgb(0xb9ad91);
    lining.box([-wide*.43,.083,long*.16],[wide*.54,.079,long*1.17],pad,.034);
    lining.box([-wide*.43,.132,-long*.068],[wide*.51,.041,long*.69],quilt,.016);
    lining.ellipsoid([-wide*.43,.151,long*.575],[wide*.195,.053,long*.147],pillow,null,24,12);
    for(let i=0;i<5;i++) {
      const z=long*(i*.108-.326);
      lining.cylinder([-wide*.66,.152,z],[-wide*.20,.152,z],.0036,.0036,times(quilt,.72),6,false);
    }
    lining.box([wide*.42,.072,long*.19],[wide*.39,.057,long*.91],rgb(0x7b5952),.025);
    lining.cylinder([wide*.25,.108,long*.58],[wide*.62,.108,long*.58],.071,.071,rgb(0x5d727c),19);
    const lx=wide*.37, lz=long*.746;
    gear.cylinder([lx,.048,lz],[lx,.084,lz],.078,.072,rgb(0x323c37),18);
    gear.cylinder([lx,.082,lz],[lx,.211,lz],.055,.055,rgb(0xd7bd87),20);
    gear.cylinder([lx,.210,lz],[lx,.247,lz],.069,.043,rgb(0x303c38),18);
    return {model,entry};
  }

  function inflatable(shape, radius, thickness, height, sx, sz, paint, center = [0,0,0], sides = 92) {
    surface(shape,sides,30,(u,v)=>{
      const a=u*TAU, b=v*TAU;
      const crease=1+.017*Math.sin(a*7+b*2)+.009*Math.sin(a*19-b*5);
      const spread=radius+thickness*Math.cos(b)*crease;
      return [center[0]+Math.cos(a)*spread*sx,center[1]+height*Math.sin(b)*crease,center[2]+Math.sin(a)*spread*sz];
    },paint,-1,[2.8,1.6]);
  }

  function tube(style) {
    const model=parts(vinyl,plastic);
    const [{shape:body},{shape:fittings}]=model;
    const types={
      pink:[0xc13274,0xeb75aa,0xf6e6d1,0xeac256],
      yellow:[0xd9a83c,0xf1cf57,0xece7af,0xf6e59b],
      mint:[0x308e8f,0x77bba5,0xd5ed94,0xeff2bb]
    };
    const [base,upper,petal,center]=types[style].map(rgb);
    const radius=.388, thick=.133;
    inflatable(body,radius,thick,.119,1,1,(u,v)=>{
      if (Math.sin(v*TAU)<0) return base;
      const x=((u*7+.5)%1-.5)*1.34, y=(v-.25)*3.0;
      const a=Math.atan2(y,x), d=Math.hypot(x,y);
      if (style==="pink") {
        if (d<.071) return center;
        if (d<.174+.065*Math.cos(a*5)) return petal;
      }
      if (style==="mint" && Math.abs(Math.sin(u*TAU*6+.12))>.91) return petal;
      return upper;
    });
    line(body,t=>[Math.cos(t*TAU)*.521,-.012,Math.sin(t*TAU)*.521],80,.0034,times(base,.82));
    fittings.cylinder([-.329,.066,.296],[-.329,.103,.296],.017,.013,upper,10);
    fittings.box([-.329,.098,.296],[.028,.011,.024],petal,.004);
    return model;
  }

  function boatTube() {
    const model=parts(vinyl,plastic);
    const [{shape:hull},{shape:trim}]=model;
    const deep=rgb(0x245fa7), sky=rgb(0x41a4d3), pale=rgb(0xe9e7c8);
    const yellow=rgb(0xf0c444), red=rgb(0xac3640);
    inflatable(hull,.431,.164,.137,.89,1.32,(u,v)=>{
      const crest=Math.sin(v*TAU);
      if(crest<.06) return deep;
      if(crest>.56 && Math.abs(Math.sin(u*TAU))<.74) return pale;
      if(crest>.32 && Math.sin(u*TAU)<-.79) return red;
      return sky;
    });
    hull.ellipsoid([0,-.013,.061],[.254,.059,.346],yellow,[0,0,0],22,12);
    hull.ellipsoid([0,.214,.460],[.236,.296,.121],sky,[-.12,0,0],24,16);
    hull.ellipsoid([0,.237,.353],[.190,.235,.035],rgb(0x57b7d8),[-.10,0,0],20,12);
    for (const h of [.129,.186,.246,.305]) {
      hull.ellipsoid([0,h,.331+(h-.20)*.12],[.139,.012,.021],times(sky,.90),null,14,7);
    }
    trim.box([0,.114,-.481],[.385,.075,.244],red,.036);
    trim.box([0,.139,-.502],[.296,.031,.160],rgb(0xc65a59),.013);
    trim.cylinder([0,.152,-.459],[0,.244,-.443],.028,.019,ink,14);
    inflatable(trim,.104,.020,.020,1,1,()=>yellow,[0,.247,-.443],38);
    for(const a of [0,TAU/3,2*TAU/3]) {
      trim.cylinder([0,.247,-.443],[Math.cos(a)*.107,.247,-.443+Math.sin(a)*.107],.009,.008,yellow,8);
    }
    trim.cylinder([0,.248,-.443],[0,.264,-.443],.033,.031,red,12);
    return model;
  }

  function build(renderer, ground, bank) {
    const prefabs=new Map(), shadows=[], blocks=[], props=[];
    const {compile,make}=Valley.props;
    const tarp=umbrella([0xac434c,0x198958,0x198958,0x3d69b3,0x3d69b3,0xd7ad3b,0xd7ad3b,0xac434c],1.32);
    const dark=umbrella([0x30303a,0x282933,0x373644,0x322733,0x692e36,0x353440,0x2b2b37,0x333341],1.06,-.31);
    const farShade=umbrella([0x4275a7,0xcfcaae,0x4275a7,0xcfcaae],1.02,.06);
    const yellow=chair(0xe5b739), navy=chair(0x315b75), charcoal=chair(0x383b3b);
    const blueTable=picnicTable();
    const food=lunchBox(), tea=flask(), yellowCup=cup(0xd7ba61), paleCup=cup(0xd2d1a0);
    const lime=tent(0x255ca1,0xa7c956,0x373e4a,1.18,1.16,1.42);
    const family=tent(0x607884,0xb8c77e,0x48544e,1.47,1.43,1.53);
    const red=tent(0x434d60,0x9e4952,0x495556,1.06,1.21,1.40);

    function set(kind,model,x,z,yaw,[rx,rz,height],shade,y=ground(x,z)) {
      if(!prefabs.has(model)) prefabs.set(model,compile(renderer,model));
      const prop=make(prefabs.get(model),kind,x,y,z,yaw,rx,rz,height,props.length*.73);
      props.push(prop);
      if(kind==="umbrella") blocks.push({x,z,rx:.052,rz:.052,top:y+height,owner:prop});
      if(shade) shadows.push({x:x+shade[0]*.32,z:z+shade[1]*.28,rx:shade[0],rz:shade[1],strength:shade[2]});
      return prop;
    }

    function setTent({model,entry},x,z,yaw,shade) {
      const matrix=transform([x,0,z],0,yaw);
      let groundTop=ground(x,z);
      for(const radius of [.52,1]) {
        for(let i=0;i<12;i++) {
          const a=i*TAU/12, [px,,pz]=point(matrix,[radius*entry.wide*Math.sin(a),0,radius*entry.long*Math.cos(a)]);
          groundTop=Math.max(groundTop,ground(px,pz));
        }
      }
      const tent=set("tent",model,x,z,yaw,[entry.wide,entry.long,entry.tall+.028],shade,groundTop+.006);
      tent.entry=entry;
      const start=-entry.long-.66, landing=-entry.long+.015;
      const [stepX,,stepZ]=point(matrix,[0,0,start]);
      tent.ramp={start,landing,end:-entry.long*.81,width:entry.width*.83,base:ground(stepX,stepZ)+.022};
      const step=new Builder();
      surface(step,8,16,(u,v)=>{
        const dx=(u*2-1)*tent.ramp.width, dz=mix(start,tent.ramp.end,v);
        const [px,,pz]=point(matrix,[dx,0,dz]);
        return [dx,Math.max(ground(px,pz)+.012,rampHeight(tent,dz)+.004)-tent.y,dz];
      },rgb(0x4d5657),-1,[1.2,1.45]);
      tent.parts=tent.parts.concat(compile(renderer,[{shape:step,material:fabric,name:"interior"}]));
    }

    function setOnTable(table,kind,model,x,z,size) {
      const local=[x,.698,z];
      const [px,y,pz]=point(table.matrix,local);
      const item=set(kind,model,px,pz,table.yaw,size,null,y);
      item.support={table,local,yaw:0};
    }

    const w=bank(12.55,-1)+.69;
    const nearTable=set("table",blueTable,w,12.55,.12,[.62,.74,.86]);
    setOnTable(nearTable,"box",food,-.241,-.104,[.154,.111,.135]);
    setOnTable(nearTable,"cup",yellowCup,.254,.14,[.045,.045,.107]);
    setOnTable(nearTable,"cup",paleCup,.088,-.180,[.045,.045,.107]);
    setOnTable(nearTable,"flask",tea,.376,-.205,[.055,.055,.259]);
    set("umbrella",tarp,w+.034,12.53,.10,[1.43,1.43,2.20],[1.28,1.12,.36]);
    set("chair",yellow,w-.98,13.29,-1.18,[.31,.40,1.02]);
    set("chair",yellow,w+.97,13.36,2.16,[.31,.40,1.02]);
    set("chair",charcoal,w+.29,11.45,Math.PI,[.32,.40,1.02]);
    set("umbrella",dark,w-2.27,11.05,-.26,[1.20,1.20,2.20],[.96,.85,.25]);
    set("chair",navy,w-2.12,12.21,.81,[.31,.40,1.02]);
    set("chair",yellow,bank(16.24,-1)-1.68,16.24,-.15,[.31,.40,1.02]);
    const bagZ=16.10, bagX=bank(bagZ,-1)-3.28;
    const supplyBag=set("supply",duffelBag(),bagX,bagZ,.23,[.54,.27,.45],[.61,.34,.31]);
    setTent(lime,bank(7.16,-1)-3.44,7.16,-1.14,[1.34,1.26,.39]);
    setTent(family,bank(2.87,-1)-3.85,2.87,-1.36,[1.61,1.55,.42]);
    setTent(red,bank(-3.28,-1)-3.62,-3.28,-1.67,[1.21,1.30,.32]);

    const e=bank(-1.18,1)+2.95;
    setTent(red,e+1.94,-2.15,1.37,[1.16,1.27,.34]);
    const farTable=set("table",blueTable,e,-.62,-.16,[.62,.74,.70]);
    setOnTable(farTable,"cup",paleCup,.31,.17,[.045,.045,.107]);
    setOnTable(farTable,"box",food,-.22,.12,[.154,.111,.135]);
    set("umbrella",farShade,e-.12,-.62,.31,[1.10,1.10,2.20],[1.06,.96,.28]);
    set("chair",navy,e+1.03,.20,-2.09,[.31,.40,1.02]);
    set("chair",yellow,e-.90,.47,1.11,[.31,.40,1.02]);

    const made={
      boat:boatTube(),pink:tube("pink"),yellow:tube("yellow"),mint:tube("mint")
    };
    for (const [kind,z,side,d,yaw,phase] of [
      ["boat",14.60,-1,1.13,-.90,.35],["pink",16.47,-1,2.45,.29,1.88],
      ["yellow",6.19,-1,3.35,-.18,2.53],["mint",1.65,-1,1.87,.66,3.25],
      ["pink",-6.07,1,2.65,1.15,1.06],["yellow",1.81,1,3.61,.3,3.72],
      ["mint",-18.65,-1,3.25,-.81,4.43],["pink",9.42,-1,.78,.42,2.9]
    ]) {
      set("tube",made[kind],bank(z,side)-side*d,z,yaw,kind==="boat" ? [.55,.81,.54] : [.53,.53,.24]);
      props.at(-1).phase=phase;
    }
    return {props,shadows,blocks,supplyBag,tents:props.filter(prop=>prop.entry)};
  }

  function tentLocal(tent,x,z) {
    const dx=x-tent.x, dz=z-tent.z, m=tent.matrix;
    return [m[0]*dx+m[2]*dz,m[8]*dx+m[10]*dz];
  }

  function inside(tents,x,z) {
    return tents.find(tent=>{
      if(tent.collapse) return false;
      const [u,v]=tentLocal(tent,x,z), {wide,long}=tent.entry;
      return (u/wide)**2+(v/long)**2<1;
    });
  }

  function nearDoor(tents,x,z) {
    return tents.some(tent=>{
      if(tent.collapse) return false;
      const [u,v]=tentLocal(tent,x,z), {long,width}=tent.entry;
      return Math.abs(u)<width+.31 && v<-.81*long && v>-long-1.02;
    });
  }

  function rampHeight(tent,z) {
    const {start,landing,base}=tent.ramp;
    return mix(base,tent.y+tent.entry.floor,clamp((z-start)/(landing-start),0,1));
  }

  function floorHeight(tents,x,z) {
    let floor=-Infinity;
    for(const tent of tents) {
      const [u,v]=tentLocal(tent,x,z), {wide,long}=tent.entry;
      const {start,end,width}=tent.ramp;
      if((u/wide)**2+(v/long)**2<1) floor=Math.max(floor,tent.y+tent.entry.floor);
      if(v>=start && v<=end && Math.abs(u)<=width) floor=Math.max(floor,rampHeight(tent,v));
    }
    return floor;
  }

  function canStep(tents,fromX,fromZ,x,z,eyeHeight,low) {
    for(const tent of tents) {
      if(tent.collapse) continue;
      const {wide,long,tall,floor}=tent.entry, [u,v]=tentLocal(tent,x,z);
      if((u/(wide+.17))**2+(v/(long+.17))**2>=1) continue;
      const r2=(u/wide)**2+(v/long)**2, [oldU,oldV]=tentLocal(tent,fromX,fromZ);
      if(r2>=1 && r2>(oldU/wide)**2+(oldV/long)**2) continue;
      if(!low) return false;
      const head=floor+eyeHeight+.063;
      const roof=.022+tall*Math.sqrt(Math.max(0,1-r2));
      if(head+.044<roof) continue;
      if(v<-.13 && Math.abs(u)<doorWidth(tent.entry,head)-.125) continue;
      return false;
    }
    return true;
  }

  Valley.camp={build,inside,nearDoor,canStep,floorHeight};
})();
