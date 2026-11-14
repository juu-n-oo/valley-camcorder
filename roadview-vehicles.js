"use strict";

(() => {
  const {Builder,clamp,mix,smooth,rgb,plus,minus,times,dot,cross,unit,multiply,transform,point,direction}=Valley;
  const metal=rgb(0xb4bab9), rubber=rgb(0x242627), black=rgb(0x181d20);
  const leather=rgb(0xc3b59a), upholstery=rgb(0xa09783), trim=rgb(0x706e62), carpet=rgb(0x4d4c49);
  const walnut=rgb(0x7e4730), glass=rgb(0x597375), chrome=rgb(0xa9b4b8);
  const wheelRadius=.319, wheelHeight=.321, wheelStations=[-1.405,1.405], wheelX=.783;
  const bodyProfile=[
    [-2.36,.64,.68,.31],[-2.25,.79,.79,.23],[-2.06,.864,.865,.22],[-1.69,.908,.908,.20],
    [-1.25,.902,.926,.193],[-.21,.898,.930,.191],[.48,.902,.925,.191],[1.02,.905,.910,.198],
    [1.43,.899,.873,.22],[1.89,.871,.827,.229],[2.16,.824,.769,.252],[2.33,.684,.673,.30]
  ];
  const cabinProfile=[
    [-1.39,.922,.841],[-1.19,1.083,.806],[-.97,1.260,.748],[-.71,1.396,.687],[-.46,1.442,.665],
    [-.09,1.457,.657],[.19,1.449,.669],[.47,1.400,.703],[.66,1.257,.747],[.86,1.080,.798],[1.047,.927,.857]
  ];

  function profile(table,z,column) {
    const i=table.findIndex(row=>row[0]>=z);
    if(i===0) return table[0][column];
    if(i<0) return table.at(-1)[column];
    const a=table[i-1],b=table[i],p=table[i-2]??a,n=table[i+1]??b;
    const span=b[0]-a[0], t=(z-a[0])/span;
    const m0=(b[column]-p[column])*span/(b[0]-p[0]),m1=(n[column]-a[column])*span/(n[0]-a[0]);
    return mix(a[column],b[column],t*t*(3-2*t))+t*(1-t)*((1-t)*m0-t*m1);
  }

  const shoulder=z=>profile(bodyProfile,z,2);
  const width=z=>profile(bodyProfile,z,1);
  const windowTop=z=>profile(cabinProfile,z,1);
  const windowInset=z=>profile(cabinProfile,z,2);

  function surface(b,nu,nv,sample,tint,flip=false) {
    const start=b.vertices.length/11;
    for(let j=0;j<=nv;j++) for(let i=0;i<=nu;i++) {
      const u=i/nu,v=j/nv,epsilon=.0003;
      const du=minus(sample(clamp(u+epsilon,0,1),v),sample(clamp(u-epsilon,0,1),v));
      const dv=minus(sample(u,clamp(v+epsilon,0,1)),sample(u,clamp(v-epsilon,0,1)));
      const n=unit(cross(du,dv));
      b.vertex(sample(u,v),flip ? times(n,-1) : n,[u,v],typeof tint==="function" ? tint(u,v) : tint);
    }
    for(let j=0;j<nv;j++) for(let i=0;i<nu;i++) {
      const a=start+j*(nu+1)+i,b0=a+1,d=a+nu+1,c=d+1;
      if(flip) b.indices.push(a,c,b0,a,d,c);
      else b.indices.push(a,b0,c,a,c,d);
    }
  }

  function curve(b,sample,count,radius,color) {
    for(let i=0;i<count;i++) b.cylinder(sample(i/count),sample((i+1)/count),radius,radius,color,6,false);
  }

  function sidePoint(side,z,v) {
    const distance=Math.min(...wheelStations.map(w=>Math.abs(w-z)));
    const cut=.232+.442*Math.sqrt(Math.max(0,1-(distance/.396)**2));
    const bottom=Math.max(profile(bodyProfile,z,3),cut*(1-smooth(.385,.421,distance)));
    const bulge=.025*Math.sin(Math.PI*v)-.083*(1-v)**2;
    return [side*(width(z)+bulge),mix(bottom,shoulder(z),v),z];
  }

  const upperDeck=(z,u)=>shoulder(z)+.045*(1-u*u);
  const lidEdge=(z,front)=>width(z)*(front ? .815 : .804);
  const corner=(x,front)=>(front ? 2.345 : -2.367)+(front ? -.294 : .268)*(Math.abs(x)/.89)**2;

  function plate(b,front,signs) {
    const side=front ? 1 : -1,w=.342,h=.171,z=front ? 2.373 : -2.391,y=front ? .432 : .467;
    const uv=signs.uv("대전00","가 0000",w,h,"plate");
    b.quad([[-side*w/2,y-h/2,z],[side*w/2,y-h/2,z],[side*w/2,y+h/2,z],[-side*w/2,y+h/2,z]],rgb(0xf2f0df),null,uv);
  }

  function shell(part,m,paint,signs) {
    const skin=part(m.carPaint), seals=part(m.plain), trimMesh=part(m.carMetal);
    for(const side of [-1,1]) {
      for(const front of [false,true]) {
        surface(skin,35,12,(u,v)=>{
          const end=front ? 1 : -1, seam=front ? 1.019 : -1.236, edge=front ? 2.17 : -2.18;
          const p=sidePoint(side,mix(seam,edge,u),v);
          const join=smooth(.49,1,u);
          const rimY=mix(.278,front ? .731 : .756,v);
          return [mix(p[0],side*.786,join),mix(p[1],rimY,join*.87),
            mix(p[2],corner(side*.786,front)+end*.013*Math.sin(v*Math.PI),join)];
        },paint,(side>0)===front);
        const z0=front ? 1.03 : -2.20,z1=front ? 2.21 : -1.34;
        surface(skin,6,26,(u,v)=>{
          const z=mix(z0,z1,v), x=side*mix(lidEdge(z,front)+.009,width(z),u);
          const end=(front ? smooth(1.77,z1,z) : 1-smooth(z0,-1.81,z)) * u*u;
          const tip=side*.786;
          return [mix(x,tip,end),mix(upperDeck(z,x/width(z)),front ? .753 : .786,end),mix(z,corner(tip,front),end)];
        },paint,side>0);
      }
      for(const axle of wheelStations) {
        curve(seals,t=>{
          const a=mix(.06,Math.PI-.06,t), z=axle+.398*Math.cos(a), p=sidePoint(side,z,0);
          return [p[0]-side*.016,p[1]-.017,z];
        },23,.023,rubber);
      }
      seals.box([side*.793,.200,-.103],[.170,.122,2.18],times(paint,.48),.032);
      seals.box([side*.733,.273,-.098],[.131,.044,2.17],rubber,.013);
    }
    for(const front of [false,true]) {
      surface(skin,38,9,(u,v)=>{
        const x=(u-.5)*1.578;
        const y=mix(.259+.039*Math.abs(u-.5),front ? .649+.072*Math.abs(x) : .724+.022*Math.abs(x),v);
        const z=.023*Math.sin(Math.PI*v);
        return [x,y,corner(x,front)+(front ? z : -z)];
      },paint,!front);
      const low=front ? .335 : .300;
      surface(skin,36,13,(u,v)=>{
        const x=(u-.5)*1.61, y=low+(v-.5)*.184;
        const r=.041*Math.sin(v*Math.PI)-.007;
        return [x,y,corner(x,front)+(front ? r : -r)];
      },paint,!front);
      seals.box([0,front ? .433 : .465,front ? 2.361 : -2.378],[.385,.197,.016],rubber,.023);
      plate(part(m.label),front,signs);
    }
    seals.box([0,.598,2.309],[.704,.143,.073],black,.036);
    for(const y of [.532,.667]) curve(trimMesh,t=>{
      const x=mix(-.327,.327,t);
      return [x,y,corner(x,true)+.027];
    },19,.009,chrome);
    for(let i=-5;i<=5;i++) {
      const x=i*.057;
      trimMesh.box([x,.599,corner(x,true)+.032],[.019,.112,.026],chrome,.009,[.16,0,-i*.021]);
    }
    curve(seals,t=>{
      const x=mix(-.375,.375,t);
      return [x,.314,corner(x,true)+.041];
    },20,.032,black);
    for(const x of [-.579,.579]) {
      seals.box([x,.343,corner(x,true)+.035],[.235,.074,.043],black,.025);
      trimMesh.box([x,.343,corner(x,true)+.057],[.171,.046,.017],rgb(0xafb6ad),.015);
      part(m.carLens).ellipsoid([Math.sign(x)*.909,.716,1.758],[.011,.026,.058],rgb(0xc28b3b),null,16,8);
    }
    badge(trimMesh,[0,.602,2.372],false);
    badge(trimMesh,[0,.763,-2.348],true);
    surface(trimMesh,26,5,(u,v)=>{
      const x=(u-.5)*1.155;
      return [x,mix(.610,.668,v),corner(x,false)-.034-.004*Math.sin(v*Math.PI)];
    },chrome,true);
    part(m.label).quad([[.244,.623,-2.381],[-.244,.623,-2.381],[-.244,.662,-2.381],[.244,.662,-2.381]],
      rgb(0xe1ded9),null,signs.uv("SONATA","",.488,.039,"carBadge"));
    seals.cylinder([-.615,.225,-2.19],[-.615,.225,-2.355],.037,.037,black,13);
    trimMesh.cylinder([-.615,.225,-2.353],[-.615,.225,-2.383],.044,.043,metal,15,false);
    seals.box([0,.169,0],[1.42,.11,4.26],black,.052);
  }

  function badge(b,at,rear) {
    curve(b,t=>plus(at,[.049*Math.cos(t*2*Math.PI),.022*Math.sin(t*2*Math.PI),0]),24,.0038,chrome);
    const line=pts=>{for(let i=1;i<pts.length;i++) b.cylinder(plus(at,pts[i-1]),plus(at,pts[i]),.004,.004,chrome,6);};
    const z=rear ? -.001 : .001;
    line([[-.023,-.014,z],[-.007,.017,z]]);
    line([[.004,-.016,z],[.021,.015,z]]);
    line([[-.015,-.003,z],[.015,.005,z]]);
  }

  function roof(part,m,paint) {
    const skin=part(m.carPaint), lining=part(m.fabric);
    for(const [b,drop,color,reverse] of [[skin,0,paint,false],[lining,.049,rgb(0xa5a294),true]]) {
      surface(b,16,26,(u,v)=>{
        const z=mix(-.725,.471,v), x=(2*u-1)*windowInset(z);
        return [x,windowTop(z)+.030*Math.sin(u*Math.PI)-drop,z];
      },color,!reverse);
    }
    for(const side of [-1,1]) {
      curve(skin,t=>{
        const z=mix(-1.375,1.04,t);
        return [side*(windowInset(z)+.010),windowTop(z)+.004,z];
      },37,.024,paint);
      curve(part(m.plain),t=>{
        const z=-.234;
        return [mix(sidePoint(side,z,1)[0]-.024,side*windowInset(z),t),mix(.731,windowTop(z),t),z];
      },4,.034,rubber);
      lining.box([side*.637,1.367,-.05],[.048,.029,.219],upholstery,.014);
      lining.box([side*.315,1.353,.346],[.501,.032,.170],upholstery,.014,[.09,0,0]);
    }
    lining.box([0,1.392,.328],[.258,.067,.243],trim,.023);
    part(m.gloss).box([0,1.351,.214],[.184,.028,.057],rgb(0xd2cbb4),.012);
  }

  function endGlass(part,m,front) {
    const lo=front ? .485 : -1.382,hi=front ? 1.033 : -.729;
    const sample=(u,v)=>{
      const z=mix(lo,hi,v), x=(u*2-1)*(windowInset(z)-.020);
      return [x,windowTop(z)+.012*Math.sin(u*Math.PI),z];
    };
    surface(part(m.carGlass),16,19,sample,glass,true);
    const edge=part(m.plain);
    for(const u of [0,1]) curve(edge,v=>sample(u,v),20,.011,rubber);
    for(const v of [0,1]) curve(edge,u=>sample(u,v),20,.010,rubber);
    if(!front) for(let i=1;i<=9;i++) {
      curve(part(m.gloss),u=>plus(sample(mix(.032,.968,u),i/10),[0,.0016,0]),12,.00085,rgb(0x715543));
    }
  }

  function wipers(part,m) {
    for(const side of [-1,1]) {
      const a=[side*.414,.954,1.019], b=[side*.322,1.017,.952], c=[side*.322-.183,1.039,.929],d=[side*.322+.185,1.004,.971];
      part(m.plain).cylinder(a,b,.009,.008,rubber,7);
      part(m.plain).cylinder(c,d,.012,.010,black,7);
    }
  }

  function lid(part,m,paint,front,pivot) {
    const z0=front ? 1.047 : -2.235,z1=front ? 2.258 : -1.359;
    const sample=(u,v)=>{
      const z=mix(z0,z1,v), x=(2*u-1)*lidEdge(z,front);
      return minus([x,upperDeck(z,x/width(z))+.003,z],pivot);
    };
    surface(part(m.carPaint),26,25,sample,paint,true);
    surface(part(m.carPaint),26,25,(u,v)=>plus(sample(u,v),[0,-.016,0]),times(paint,.67));
    for(const u of [0,1]) curve(part(m.plain),v=>plus(sample(u,v),[0,-.013,0]),17,.012,black);
    for(const v of [0,1]) curve(part(m.carPaint),u=>plus(sample(u,v),[0,-.014,0]),19,.015,paint);
    const dark=part(m.fabric), end=front ? z1 : z0;
    dark.box(minus([0,upperDeck((end+pivot[2])*.5,0)-.025,(end+pivot[2])*.5],pivot),
      [.97,.014,front ? .75 : .54],carpet,.006,[front ? .14 : -.13,0,0]);
    if(!front) {
      const face=(u,v)=>{
        const x=mix(-.62,.62,u), y=mix(.692,.826,v);
        return minus([x,y,corner(x,false)+.018*(1-v)],pivot);
      };
      surface(part(m.carPaint),27,12,face,paint,true);
    }
  }

  function doorSkin(part,m,paint,{side,lo,hi,pivot}) {
    const b=part(m.carPaint), skin=part(m.gloss), hard=part(m.plain), cloth=part(m.fabric);
    const sample=(u,v)=>minus(sidePoint(side,mix(lo,hi,u),v),pivot);
    surface(b,31,18,sample,paint,side>0);
    for(const u of [0,1]) curve(hard,v=>plus(sample(u,v),[-side*.012,0,0]),14,.009,black);
    for(const v of [0,1]) curve(hard,u=>plus(sample(u,v),[-side*.012,0,0]),21,.009,black);
    const mid=(lo+hi)*.5, x=side*.862, y=shoulder(mid);
    const local=p=>minus(p,pivot);
    skin.box(local([x-side*.062,.563,mid]),[.073,.598,hi-lo-.071],trim,.035);
    cloth.box(local([side*.799,.699,mid+.035]),[.041,.196,(hi-lo)*.716],upholstery,.020);
    skin.box(local([side*.777,.589,mid+.012]),[.116,.064,(hi-lo)*.748],upholstery,.024);
    part(m.carWood).box(local([side*.743,.630,mid+.118]),[.062,.015,.39],walnut,.006);
    for(let i=0;i<(side>0 && hi>.50 ? 4 : 1);i++) {
      hard.box(local([side*.745,.641,mid+.217-i*.056]),[.035,.014,.030],black,.006);
    }
    const handle=sidePoint(side,lo+.196,.828);
    skin.box(local(plus(handle,[side*.007,0,0])),[.034,.061,.187],times(paint,.57),.016);
    part(m.carMetal).box(local(plus(handle,[side*.029,.001,.004])),[.020,.035,.137],chrome,.010);
    hard.box(local([side*.795,y-.155,hi-.16]),[.017,.058,.124],black,.008);
    part(m.carMetal).box(local([side*.780,y-.151,hi-.16]),[.016,.024,.090],chrome,.008);
    hard.cylinder(local([side*.785,.442,hi-.20]),local([side*.762,.442,hi-.20]),.113,.111,black,18);
    skin.cylinder(local([side*.762,.442,hi-.20]),local([side*.759,.442,hi-.20]),.099,.097,trim,18);
    hard.box(local([side*.784,.425,mid-.12]),[.025,.070,.43],rgb(0x45443c),.009);
    part(m.carLens).box(local([side*.774,.336,lo+.119]),[.017,.033,.110],rgb(0x932b28),.008);
    for(const z of [lo+.036,hi-.027]) {
      curve(hard,t=>local([
        mix(side*(width(z)-.024),side*windowInset(z),t),mix(shoulder(z),windowTop(z),t),z
      ]),7,.017,black);
    }
    curve(hard,t=>{
      const z=mix(lo+.036,hi-.026,t);
      return local([side*windowInset(z),windowTop(z)-.012,z]);
    },29,.013,black);
    part(m.carMetal).box(local([side*.909,.458,mid]),[.017,.021,(hi-lo)*.96],chrome,.006);
  }

  function sideGlass(part,m,{side,lo,hi,pivot}) {
    surface(part(m.carGlass),24,10,(u,v)=>{
      const z=mix(lo+.039,hi-.031,u), bottom=shoulder(z)-.005, top=Math.max(bottom+.009,windowTop(z)-.027);
      const x=mix(width(z)-.020,windowInset(z)-.003,v)+.015*Math.sin(v*Math.PI);
      return minus([side*x,mix(bottom,top,v),z],pivot);
    },glass,side>0);
  }

  function sideMirror(part,m,side,pivot,paint,face) {
    const [x,y,z]=[side*1.009,.979,.791];
    if(!face) {
      part(m.plain).box(minus([side*.895,.952,.814],pivot),[.119,.105,.142],rubber,.020);
      part(m.carPaint).ellipsoid(minus([x,y,z+.020],pivot),[.128,.064,.095],paint,[0,side*.14,0],21,10);
      part(m.plain).box(minus([x,y,z-.063],pivot),[.219,.102,.055],black,.019);
    } else {
      part(m.carMetal).box(minus([x,y+.001,z-.101],pivot),[.197,.087,.009],rgb(0x9cabb0),.004,[0,-side*.075,0]);
    }
  }

  function lamps(part,m,front,side,socket) {
    const sample=(u,v)=>{
      const s=2*u-1, x=side*(mix(front ? .356 : .596,front ? .832 : .856,u));
      const arc=Math.sqrt(Math.max(.009,1-(s*.989)**2));
      const bottom=front ? .624+.056*u : .539+.040*u;
      const y=bottom+.042*(1-arc)+v*(front ? .185 : .310)*arc;
      const z=corner(x,front)+(front ? 1 : -1)*(.069+.015*Math.sin(v*Math.PI)-(socket ? .020 : 0));
      return [x,y,z];
    };
    surface(part(socket ? m.plain : m.carLens),20,16,sample,(u,v)=>{
      if(socket) return black;
      if(front) return u>.735 ? rgb(0xe5a13d) : rgb(0xd9e2dc);
      return v>.28 ? rgb(0xbb282d) : u<.28 ? rgb(0xc6c4b6) : rgb(0xd08a2c);
    },(side<0)===front);
    if(socket) for(const u of [.38,.65]) {
      const p=sample(u,.51);
      part(m.carMetal).ellipsoid(p,[.039,.040,.016],metal,null,13,7);
    }
  }

  function wheels(part,m,tire) {
    if(tire) {
      const stops=[[-.118,.247],[-.113,.283],[-.086,.307],[-.055,.319],[.067,.319],[.092,.310],[.113,.287],[.120,.247]];
      const b=part(m.carTire);
      for(let i=1;i<stops.length;i++) {
        const [a,r]=stops[i-1],[c,s]=stops[i];
        b.cylinder([a,0,0],[c,0,0],r,s,rubber,40,false);
      }
      b.cylinder([.120,0,0],[.121,0,0],.247,.246,rubber,40);
      for(const r of [.252,.282]) {
        curve(b,t=>[.119,r*Math.cos(t*Math.PI*2),r*Math.sin(t*Math.PI*2)],36,.0035,rgb(0x333538));
      }
      return;
    }
    const b=part(m.carMetal), dark=part(m.plain);
    b.cylinder([.113,0,0],[.133,0,0],.205,.199,metal,36,false);
    b.cylinder([.133,0,0],[.138,0,0],.199,.181,chrome,36,false);
    b.cylinder([.138,0,0],[.108,0,0],.181,.160,metal,36,false);
    dark.cylinder([.058,0,0],[.079,0,0],.165,.165,rgb(0x383d3b),30);
    b.cylinder([.105,0,0],[.146,0,0],.061,.050,metal,24);
    for(let i=0;i<6;i++) {
      const angle=i*Math.PI/3;
      const spoke=(u,v)=>{
        const a=angle+(u-.5)*mix(.56,.258,v)-.12*v, radius=mix(.049,.190,v);
        return [.131-.016*Math.sin(v*Math.PI),radius*Math.cos(a),radius*Math.sin(a)];
      };
      surface(b,6,5,spoke,metal,true);
    }
    for(let i=0;i<5;i++) {
      const a=i*Math.PI*2/5,y=.044*Math.cos(a),z=.044*Math.sin(a);
      dark.cylinder([.144,y,z],[.149,y,z],.009,.009,black,9);
      b.cylinder([.149,y,z],[.151,y,z],.0058,.0058,chrome,7);
    }
  }

  function seats(part,m) {
    const soft=part(m.carLeather), stitching=part(m.gloss), frames=part(m.plain);
    for(const side of [-1,1]) {
      const x=side*.427;
      soft.box([x,.379,.169],[.568,.191,.566],leather,.081,null,6);
      soft.box([x,.690,-.181],[.539,.537,.181],leather,.086,[.20,0,0],6);
      soft.ellipsoid([x,1.048,-.243],[.144,.107,.079],leather,[.17,0,0],24,12);
      for(const dx of [-.077,.077]) {
        part(m.carMetal).cylinder([x+dx,.899,-.242],[x+dx,1.002,-.242],.011,.011,metal,9);
      }
      for(const dx of [-.154,.154]) {
        stitching.box([x+dx,.475,.17],[.006,.004,.451],times(leather,.72),.002);
        stitching.box([x+dx,.719,-.087],[.006,.372,.006],times(leather,.74),.002,[.20,0,0]);
        frames.box([x+dx,.285,.127],[.054,.054,.538],black,.008);
      }
      frames.box([x-side*.276,.435,-.021],[.038,.109,.045],black,.007,[.21,0,0]);
      part(m.carLens).box([x-side*.274,.489,-.009],[.031,.010,.035],rgb(0xa33a30),.004);
      for(const z of [-.002,.107]) {
        soft.cylinder([x+side*.260,.354,z],[x+side*.303,.354,z],.037,.031,upholstery,14);
      }
    }
    soft.box([0,.392,-.881],[1.462,.187,.610],leather,.081,null,6);
    soft.box([0,.674,-1.137],[1.442,.493,.211],leather,.076,[.29,0,0],8);
    for(const side of [-1,1]) {
      soft.box([side*.478,.945,-1.231],[.275,.156,.146],leather,.055);
      stitching.box([side*.231,.484,-.868],[.009,.005,.435],times(leather,.69),.002);
      stitching.box([side*.691,.737,-1.115],[.041,.633,.021],rgb(0x8d8375),.005,[.31,0,side*.21]);
    }
    soft.box([0,.545,-.825],[.287,.103,.475],leather,.047);
    stitching.box([0,.298,.268],[.21,.041,1.22],carpet,.017);
    for(const x of [-.44,.44]) {
      stitching.box([x,.258,.62],[.486,.020,.314],rgb(0x4d4940),.014);
      stitching.box([x,.258,-.465],[.471,.020,.278],rgb(0x514d43),.014);
    }
  }

  function dashboard(part,m,signs) {
    const dash=part(m.carLeather), d=part(m.plain), w=part(m.carWood), alloy=part(m.carMetal), decal=part(m.label);
    dash.box([0,.861,.889],[1.568,.208,.387],trim,.095,null,10);
    dash.box([.482,.655,.877],[.558,.270,.246],trim,.051);
    dash.box([-.503,.559,.887],[.589,.054,.260],trim,.015);
    d.box([-.470,.674,.879],[.552,.187,.018],black,.008);
    dash.box([.455,.906,.739],[.529,.152,.227],rgb(0x69695f),.058);
    function fascia(text,sub,x,y,z,w,h,style) {
      decal.quad([[x+w/2,y-h/2,z],[x-w/2,y-h/2,z],[x-w/2,y+h/2,z],[x+w/2,y+h/2,z]],
        rgb(0xd9d5c3),null,signs.uv(text,sub,w,h,style));
    }
    fascia("SPEEDOMETER","",.449,.911,.622,.437,.105,"carDials");
    w.box([0,.732,.769],[.335,.369,.132],walnut,.045,[.11,0,0],6);
    for(const x of [-.088,.088,-.686,.686]) {
      const y=Math.abs(x)>.2 ? .844 : .858;
      d.box([x,y,.689],[.130,.081,.041],black,.016);
      for(let i=-2;i<=2;i++) alloy.box([x,y+i*.013,.666],[.105,.0036,.009],metal,.001);
    }
    part(m.carLens).box([0,.852,.665],[.031,.052,.013],rgb(0x9a2624),.008);
    fascia("AUTO    3:59","",.021,.780,.667,.185,.042,"carRadio");
    fascia("FM1   89.1","",0,.705,.671,.231,.046,"carRadio");
    for(let i=-3;i<=3;i++) d.box([i*.038,.658,.675],[.031,.016,.016],black,.006);
    d.cylinder([.120,.780,.684],[.120,.780,.665],.021,.020,black,14);
    d.box([.095,.598,.647],[.051,.050,.017],black,.011);
    alloy.cylinder([.095,.598,.638],[.095,.598,.631],.021,.020,metal,14);
    d.box([0,.512,.636],[.209,.096,.030],black,.010);
    dash.box([0,.363,.214],[.316,.207,.917],trim,.039,null,8);
    w.box([0,.477,.364],[.276,.026,.446],walnut,.017);
    d.box([.044,.497,.340],[.115,.014,.219],black,.006);
    for(let i=0;i<5;i++) part(m.gloss).box([.084,.506,.413-i*.029],[.010,.002,.009],rgb(i===0 ? 0xb49b41 : 0xaaa69a));
    alloy.cylinder([.028,.489,.372],[.028,.611,.387],.012,.013,metal,13);
    d.ellipsoid([.028,.632,.391],[.041,.055,.039],black,[.23,0,0],15,8);
    const brakeA=[.125,.478,.084],brakeB=[.143,.541,.230];
    d.cylinder(brakeA,brakeB,.020,.023,black,13);
    alloy.cylinder(brakeB,[.145,.547,.243],.013,.013,metal,10);
    d.box([0,.488,-.118],[.240,.013,.326],black,.010);
    const wheel=[.434,.816,.529];
    curve(dash,t=>plus(wheel,[.182*Math.cos(t*Math.PI*2),.181*Math.sin(t*Math.PI*2),-.063*Math.sin(t*Math.PI*2)]),44,.020,trim);
    dash.box(wheel,[.198,.153,.068],trim,.033,[.29,0,0]);
    for(const [x,y] of [[-.150,.010],[.150,.010],[-.094,-.127],[.094,-.127]]) {
      dash.cylinder(wheel,plus(wheel,[x,y,-y*.34]),.028,.023,trim,11);
    }
    badge(alloy,plus(wheel,[0,.017,-.041]),true);
    d.cylinder([.410,.805,.581],[.284,.811,.629],.011,.011,black,10);
    d.cylinder([.470,.806,.583],[.588,.817,.631],.011,.011,black,10);
    for(const x of [.369,.522]) d.box([x,.322,.755],[.074,.114,.030],black,.007,[.33,0,0]);
  }

  function compartments(part,m,kind) {
    if(kind==="glove box") {
      part(m.carLeather).box([0,.092,0],[.528,.184,.039],trim,.017);
      part(m.plain).box([0,.128,-.023],[.102,.044,.010],black,.010);
      part(m.carMetal).box([0,.124,-.031],[.073,.016,.010],metal,.004);
      part(m.plain).box([0,.081,.080],[.467,.021,.154],carpet,.009);
      for(const side of [-1,1]) part(m.plain).box([side*.224,.103,.066],[.019,.054,.135],black,.006);
    } else if(kind==="console") {
      part(m.carLeather).box([0,.024,.149],[.282,.071,.326],upholstery,.030);
      part(m.carWood).box([0,.011,.302],[.113,.042,.032],walnut,.009);
    } else {
      part(m.carWood).box([0,0,0],[.198,.081,.039],walnut,.018);
      part(m.carMetal).box([0,.015,-.026],[.089,.010,.011],metal,.004);
      part(m.plain).box([0,-.028,.055],[.186,.016,.121],black,.006);
    }
  }

  function engineAndTrunk(part,m) {
    const d=part(m.plain),alloy=part(m.carMetal),foil=part(m.gloss),cloth=part(m.fabric);
    d.box([0,.336,1.636],[1.447,.069,1.156],black,.019);
    d.box([0,.633,1.062],[1.489,.416,.064],rubber,.013);
    d.box([0,.575,2.132],[1.420,.142,.107],black,.019);
    for(let i=0;i<17;i++) alloy.box([-.604+i*.071,.650,2.122],[.011,.008,.090],rgb(0x686c67),.002);
    for(const side of [-1,1]) {
      alloy.box([side*.705,.542,1.651],[.109,.439,1.142],rgb(0x585d58),.021);
      alloy.ellipsoid([side*.598,.726,1.499],[.158,.065,.158],rgb(0x747776),null,23,9);
      d.cylinder([side*.598,.748,1.499],[side*.598,.795,1.499],.071,.058,rubber,18);
      for(let i=0;i<3;i++) {
        const a=i*2*Math.PI/3;
        alloy.cylinder([side*.598+Math.cos(a)*.111,.756,1.499+Math.sin(a)*.111],
          [side*.598+Math.cos(a)*.111,.775,1.499+Math.sin(a)*.111],.014,.012,metal,6);
      }
    }
    alloy.box([.125,.579,1.638],[.714,.391,.553],rgb(0x999b93),.041);
    d.box([.123,.785,1.624],[.653,.061,.375],rubber,.020);
    alloy.box([.132,.737,1.803],[.603,.071,.166],metal,.019);
    for(let i=0;i<6;i++) d.box([.125,.822,1.543+i*.029],[.554,.008,.012],rgb(0x444747),.004);
    d.cylinder([.312,.817,1.504],[.312,.849,1.504],.052,.049,rubber,16);
    alloy.box([.132,.627,1.973],[.478,.188,.116],rgb(0x9b9c90),.041,[.13,0,0]);
    for(let i=0;i<4;i++) {
      const x=-.107+i*.148;
      alloy.cylinder([x,.699,1.286],[x,.774,1.340],.032,.038,metal,9);
    }
    d.box([-.404,.670,1.510],[.295,.188,.339],rubber,.023);
    for(let i=0;i<8;i++) foil.box([-.529+i*.035,.769,1.518],[.013,.010,.282],rgb(0x454845),.003);
    d.box([-.435,.609,1.882],[.316,.233,.315],rgb(0x414b4d),.018);
    d.box([-.435,.740,1.882],[.323,.041,.325],black,.014);
    for(const [x,tint] of [[-.533,0x9a3f31],[-.344,0x5d6566]]) {
      alloy.cylinder([x,.758,1.958],[x,.784,1.958],.023,.020,rgb(tint),12);
    }
    foil.box([-.427,.764,1.833],[.111,.007,.114],rgb(0xb5a23c),.003);
    const intake=t=>[-.35+.40*t,.770+.048*Math.sin(Math.PI*t),1.376-.062*Math.sin(Math.PI*t)];
    curve(d,intake,14,.052,rubber);
    for(let i=1;i<13;i++) {
      const a=intake(i/14);
      d.cylinder(a,plus(a,[.009,0,0]),.060,.059,rgb(0x373c3b),13,false);
    }
    curve(d,t=>[.440-.485*t,.631+.064*Math.sin(t*Math.PI),1.725+.381*t],12,.020,rubber);
    curve(d,t=>[-.548-.081*Math.sin(t*Math.PI),.763-.104*t,1.955-.772*t],12,.012,black);
    for(const [x,z,cap] of [[.601,1.916,0x3d879f],[-.528,1.201,0x373a35]]) {
      foil.box([x,.630,z],[.142,.163,.164],rgb(0xb5ba9c),.025);
      d.cylinder([x,.705,z],[x,.740,z],.037,.034,rgb(cap),13);
    }
    cloth.box([0,.343,-1.794],[1.416,.059,.884],carpet,.023);
    cloth.box([0,.576,-1.319],[1.408,.486,.061],carpet,.021,[.07,0,0]);
    for(const side of [-1,1]) {
      cloth.box([side*.693,.567,-1.790],[.066,.463,.869],carpet,.020);
      cloth.ellipsoid([side*.616,.474,-1.666],[.145,.180,.245],carpet,null,18,9);
    }
    cloth.box([0,.495,-2.244],[1.355,.303,.078],carpet,.019);
    d.box([0,.697,-2.247],[1.285,.039,.067],rubber,.013);
    alloy.box([0,.725,-2.235],[.104,.016,.057],metal,.006);
    cloth.box([0,.380,-1.818],[.230,.010,.061],rgb(0x383838),.005);
    foil.box([.491,.748,-1.359],[.102,.025,.044],rgb(0xd5bd83),.007);
  }

  function mirrorInside(part,m,face) {
    if(face) {
      part(m.carMetal).box([0,1.249,.520],[.246,.068,.011],rgb(0xabb4b4),.005,[.09,0,0]);
    } else {
      part(m.plain).box([0,1.251,.539],[.275,.092,.032],black,.016,[.09,0,0]);
      part(m.plain).cylinder([0,1.300,.548],[0,1.354,.584],.019,.015,black,12);
    }
  }

  const origin=[0,0,0];
  const axes=[[1,0,0],[0,1,0],[0,0,1]];
  const opening=swing=>({swing,value:0,on:false});
  const localVector=(matrix,p)=>axes.map(axis=>{
    const basis=direction(matrix,axis);
    return dot(p,basis)/dot(basis,basis);
  });
  const localPoint=(matrix,p)=>localVector(matrix,minus(p,[matrix[12],matrix[13],matrix[14]]));
  const worldNormal=(matrix,n)=>unit(axes.reduce((sum,axis,i)=>{
    const basis=direction(matrix,axis);
    return plus(sum,times(basis,n[i]/dot(basis,basis)));
  },[0,0,0]));

  function traceLocal(item,from,delta,limit) {
    const start=localPoint(item.matrix,from), travel=localVector(item.matrix,delta), end=plus(start,times(travel,limit));
    const hit=Valley.world.meshHit(item.shapes,start,end,travel,limit,"vehicle",true);
    if(!hit) return null;
    return {fraction:hit.fraction,at:point(item.matrix,hit.at),normal:worldNormal(item.matrix,hit.normal)};
  }

  function makeAssets(scene) {
    const cache=new Map();
    return (key,draw,{ray=[],dent=false,accessory=false}={})=>{
      if(cache.has(key)) return cache.get(key);
      const materials=new Map();
      draw(material=>{
        if(!materials.has(material)) materials.set(material,new Builder());
        return materials.get(material);
      });
      const meshes=[],shapes=[],pieces=[];
      let skin=null;
      for(const [material,b] of materials) {
        const mesh=scene.renderer.mesh(b,material);
        meshes.push(mesh);
        if(accessory) {
          const {min,max}=Valley.world.meshCollider(b,0);
          pieces.push({mesh,material,min,max,vertices:new Float32Array(b.vertices),indices:new Uint32Array(b.indices)});
        }
        if(!ray.includes(material)) continue;
        const geometry={vertices:new Float32Array(b.vertices),indices:new Uint32Array(b.indices)};
        const collider=Valley.world.meshCollider(geometry,0);
        if(dent && material===scene.material.carPaint) skin={mesh,geometry,index:shapes.length};
        shapes.push(collider);
      }
      cache.set(key,{meshes,shapes,skin,pieces});
      return cache.get(key);
    };
  }

  function box(car,item,center,size,{walk=true,kind="wall",ray=false,follow=true}={}) {
    const at=point(item.matrix,center);
    const bounds=car.scene.collider(...at,size,car.yaw,kind,"vehicle",follow ? 2.45 : 0);
    bounds.fixture=item;
    bounds.noWalk=!walk;
    bounds.noTrace=!ray;
    if(ray) bounds.trace=(from,delta,limit)=>{
      for(let axis=0;axis<3;axis++) {
        const end=from[axis]+delta[axis]*limit, mid=bounds.center[axis], r=bounds.rayExtent[axis];
        if(Math.min(from[axis],end)>mid+r || Math.max(from[axis],end)<mid-r) return null;
      }
      return traceLocal(item,from,delta,limit);
    };
    item.boxes.push({bounds,center});
    if(ray) updateExtent(bounds,item.matrix);
    return bounds;
  }

  function updateExtent(bounds,matrix) {
    const [x,y,z]=bounds.half;
    bounds.rayExtent=axes.map((_,i)=>Math.abs(matrix[i])*x+Math.abs(matrix[i+4])*y+Math.abs(matrix[i+8])*z+.14);
  }

  function part(car,kind,asset,options={}) {
    const item={kind,car,at:car.at,matrix:car.matrix,boxes:[],pivot:origin,...options,
      meshes:asset?.meshes??[],shapes:asset?.shapes.slice()??[],skin:asset?.skin};
    car.parts.push(item);
    car.scene.items.push(item);
    syncPart(item);
    if(item.shapes.length) {
      const lo=axes.map((_,i)=>Math.min(...item.shapes.map(shape=>shape.min[i])));
      const hi=axes.map((_,i)=>Math.max(...item.shapes.map(shape=>shape.max[i])));
      item.bounds=box(car,item,times(plus(lo,hi),.5),plus(minus(hi,lo),[.026,.026,.026]),{walk:false,ray:true});
    }
    return item;
  }

  function syncPart(item) {
    const {car,pivot,parent,turn=0,move}=item;
    const t=smooth(0,1,item.value??0);
    const moveBy=move ? times(move,t) : origin;
    const pitch=(item.pitch??0)*t, yaw=turn+(item.swing??0)*t;
    const offset=item.wheelDrop ? plus(pivot,[0,-item.wheelDrop,0]) : pivot;
    const local=transform(plus(offset,moveBy),pitch,yaw);
    if(item.tire) local[5]=1-item.wheelDrop/wheelRadius;
    item.matrix=multiply(parent?.matrix??car.matrix,local);
    item.at=point(item.matrix,item.center??origin);
    const worldYaw=Math.atan2(item.matrix[8],item.matrix[10]);
    for(const {bounds,center} of item.boxes) {
      Valley.roadview.moveBox(bounds,point(item.matrix,center),worldYaw);
      if(bounds.trace) updateExtent(bounds,item.matrix);
      if(item.tire && !bounds.noWalk) {
        bounds.top-=item.wheelDrop;
        bounds.bottom+=item.wheelDrop;
      }
    }
    if(item.use) Valley.roadview.moveBox(item.use,point(item.matrix,item.useAt),worldYaw);
  }

  function handle(item,at,size,options={}) {
    const useAt=options.useAt??at;
    Object.assign(item,{useAt,grip:{at,top:options.top,pointing:options.pointing,
      normal:options.normal??[0,0,-1]},action:options.action??item.kind});
    item.use=Valley.roadview.boxAt(point(item.matrix,useAt),size,Math.atan2(item.matrix[8],item.matrix[10]));
    item.localUse=Valley.roadview.boxAt(useAt,size,0);
    item.useTrace=(from,delta,limit)=>Valley.roadview.hitBox(item.localUse,localPoint(item.matrix,from),
      localVector(item.matrix,delta),limit,.015);
    return item;
  }

  function doorParts(car,asset,side,front) {
    const lo=front ? -.211 : -1.229, hi=front ? 1.011 : -.245, z=hi-.023;
    const pivot=[side*.858,.325,z], m=car.scene.material, {paint,color}=car;
    const data={side,lo,hi,pivot}, key=side+"/"+Number(front);
    const local=p=>minus(p,pivot);
    const door=part(car,"carDoor",asset(color+" door "+key,p=>doorSkin(p,m,paint,data),{ray:[m.carPaint],dent:true}),
      {pivot,...opening(-side*1.25),center:local([side*.882,.605,(lo+hi)*.5])});
    door.solid=box(car,door,local([side*.869,.577,(lo+hi)*.5]),[.146,.668,hi-lo]);
    const pull=plus(sidePoint(side,lo+.200,.828),[side*.031,0,0]);
    handle(door,local(pull),[.115,.126,.236],{normal:[side,0,0],action:"door"});
    const pane=part(car,"glass",asset("side pane "+key,p=>sideGlass(p,m,data),{ray:[m.carGlass]}),
      {parent:door,door,hp:.44,transparent:true,center:local([side*.775,1.080,(lo+hi)*.5])});
    box(car,pane,local([side*.787,1.117,(lo+hi)*.5]),[.150,.390,(hi-lo)*.79]);
    if(front) {
      part(car,"carTrim",asset(color+" mirror "+side,p=>sideMirror(p,m,side,pivot,paint,false),
        {ray:[m.carPaint]}),{parent:door,center:local([side*1.01,.979,.79])});
      part(car,"glass",asset("side mirror "+side,p=>sideMirror(p,m,side,pivot,paint,true),{ray:[m.carMetal]}),
        {parent:door,door,opaqueGlass:true,hp:.25,center:local([side*1.01,.979,.696])});
    }
    const switchAt=local([side*.844,shoulder(lo+.293)+.020,lo+.293]);
    const lock=part(car,"carLock",asset("door lock",p=>{
      p(m.plain).box([0,-.014,0],[.037,.046,.093],black,.012);
      p(m.carLens).box([0,.008,0],[.019,.021,.050],rgb(0x8c3f36),.006);
    }),{parent:door,pivot:switchAt,pane,door});
    handle(lock,[0,.013,0],[.148,.115,.167],{top:true,pointing:true,action:"unlock"});
    const inner=part(car,"carHandle",null,{parent:door,door,pane});
    handle(inner,local([side*.761,shoulder((lo+hi)*.5)-.151,hi-.16]),[.059,.084,.126],
      {normal:[-side,0,0],action:"door"});
  }

  function openableLid(car,asset,front) {
    const m=car.scene.material, name=front ? "hood" : "trunk", pivot=front ? [0,.968,1.053] : [0,.944,-1.360];
    const item=part(car,"carLid",asset(car.color+" "+name,p=>lid(p,m,car.paint,front,pivot),{ray:[m.carPaint],dent:true}),
      {pivot,center:[0,-.06,front ? .586 : -.453],...opening(0),pitch:front ? -1.02 : 1.07,label:name,latch:0});
    const grip=minus([0,front ? .766 : .808,front ? 2.219 : -2.218],pivot);
    handle(item,grip,[1.27,.152,.40],{top:true,action:"lid"});
    item.solid=box(car,item,[0,-.142,front ? .633 : -.434],[1.416,.238,front ? 1.18 : .865],{kind:"rock"});
  }

  function installedProp(car,asset,kind,parent,at) {
    const m=car.scene.material, ashtray=kind==="ashtray";
    const compiled=asset(kind,p=>{
      const body=p(m.plain), surface=p(m.carMetal);
      if(ashtray) {
        body.box([0,.011,0],[.154,.021,.082],rubber,.005);
        for(const side of [-1,1]) {
          surface.box([side*.074,.030,0],[.011,.032,.090],metal,.003);
          surface.box([0,.030,side*.039],[.143,.032,.013],metal,.004);
        }
        surface.box([0,.022,0],[.141,.005,.073],rgb(0x777975));
      } else {
        surface.cylinder([0,.019,-.022],[0,.019,.018],.015,.015,metal,14);
        body.cylinder([0,.019,-.038],[0,.019,-.016],.020,.020,black,16);
        surface.cylinder([0,.019,-.039],[0,.019,-.037],.008,.008,rgb(0xb8b9b0),12);
      }
    },{accessory:true});
    const sizes=ashtray ? [.081,.047,.049] : [.022,.039,.040];
    const prop=Valley.props.make(compiled.pieces,kind,0,0,0,car.yaw,...sizes);
    prop.installed={parent,at};
    prop.gripAnchors=[{side:1,at:ashtray ? [.065,.027,-.016] : [.005,.023,-.031],normal:[0,0,-1]}];
    prop.available=()=>!prop.installed || !ashtray || parent.value>.85;
    car.scene.props.push(prop);
    car.accessories.push(prop);
    syncAccessory(prop);
  }

  function syncAccessory(prop) {
    if(!prop.installed) return;
    const {parent,at}=prop.installed;
    [prop.x,prop.y,prop.z]=point(parent.matrix,at);
    prop.matrix=transform([prop.x,prop.y,prop.z],0,prop.yaw);
  }

  function build(scene,sites,signs,height) {
    const m=scene.material, asset=makeAssets(scene);
    scene.vehicles=[];
    for(const site of sites) {
      const {x,z,yaw,color}=site, at=[x,height(x,z)+(site.lot ? .030 : .014),z];
      const car={scene,yaw,color,at,matrix:transform(at,0,yaw),paint:rgb(color),parts:[],accessories:[],locked:true,moving:false};
      scene.vehicles.push(car);
      const body=part(car,"carBody",asset(color+" shell",p=>shell(p,m,car.paint,signs),{ray:[m.carPaint],dent:true}));
      box(car,body,[0,.182,-.101],[1.679,.083,2.47],{kind:"rock",follow:false});
      for(const front of [true,false]) {
        const side=front ? 1 : -1;
        box(car,body,[0,.413,side*1.804],[1.66,.55,1.028],{kind:"rock",follow:false});
        openableLid(car,asset,front);
        part(car,"glass",asset(front ? "windshield" : "rear window",p=>endGlass(p,m,front),{ray:[m.carGlass]}),
          {hp:front ? .81 : .54,transparent:true,center:[0,1.196,front ? .754 : -1.026]});
        for(const s of [-1,1]) {
          const key=Number(front)+"/"+s;
          part(car,"carTrim",asset("lamp socket "+key,p=>lamps(p,m,front,s,true)),{center:[s*.60,.662,side*2.29]});
          part(car,"glass",asset("lamp "+key,p=>lamps(p,m,front,s,false),{ray:[m.carLens]}),
            {hp:.37,opaqueGlass:true,center:[s*.60,.662,side*2.29]});
        }
      }
      const top=part(car,"carBody",asset(color+" roof",p=>roof(p,m,car.paint),{ray:[m.carPaint],dent:true}));
      box(car,top,[0,1.423,-.128],[1.255,.103,1.21],{kind:"rock",follow:false});
      part(car,"carTrim",asset("wipers",p=>wipers(p,m)),{center:[0,.97,.98]});
      for(const side of [-1,1]) {
        doorParts(car,asset,side,true);
        doorParts(car,asset,side,false);
        box(car,body,[side*.800,.071,-.103],[.226,.153,2.15],{kind:"rock",follow:false});
        for(const z of wheelStations) {
          const position=[side*wheelX,wheelHeight,z], turn=side<0 ? Math.PI : 0;
          const tire=part(car,"carTire",asset("tire",p=>wheels(p,m,true),{ray:[m.carTire]}),
            {pivot:position,turn,tire:true,air:1,wheelDrop:0,hp:.39});
          tire.hub=part(car,"carTrim",asset("alloy wheel",p=>wheels(p,m,false),{ray:[m.carMetal]}),{pivot:position,turn});
          box(car,tire,[0,.009,0],[.24,.62,.63],{kind:"rock"});
        }
      }
      const cabin=part(car,"carCabin",asset("seats",p=>seats(p,m)));
      for(const x of [-.427,.427]) box(car,cabin,[x,.401,.145],[.51,.265,.49],{kind:"rock",follow:false});
      box(car,cabin,[0,.407,-.878],[1.38,.270,.485],{kind:"rock",follow:false});
      const dash=part(car,"carCabin",asset("dash",p=>dashboard(p,m,signs)));
      box(car,dash,[0,.793,.889],[1.49,.325,.29],{follow:false});
      part(car,"carTrim",asset("rearview shell",p=>mirrorInside(p,m,false)),{center:[0,1.25,.54]});
      part(car,"glass",asset("rearview glass",p=>mirrorInside(p,m,true),{ray:[m.carMetal]}),
        {hp:.23,opaqueGlass:true,center:[0,1.25,.51]});
      part(car,"carTrim",asset("engine and trunk",p=>engineAndTrunk(p,m),{ray:[m.carMetal]}));
      const glove=part(car,"carStorage",asset("glove box",p=>compartments(p,m,"glove box"),{ray:[m.carLeather]}),
        {pivot:[-.474,.589,.841],...opening(0),pitch:-1.05,label:"glove box"});
      handle(glove,[0,.126,-.037],[.40,.175,.111],{action:"storage"});
      const console=part(car,"carStorage",asset("console lid",p=>compartments(p,m,"console"),{ray:[m.carLeather]}),
        {pivot:[0,.509,-.270],...opening(0),pitch:-1.16,label:"console"});
      handle(console,[0,.059,.243],[.252,.096,.239],{top:true,action:"storage"});
      const drawer=part(car,"carStorage",asset("ashtray drawer",p=>compartments(p,m,"drawer"),{ray:[m.carWood]}),
        {pivot:[0,.540,.626],...opening(0),move:[0,0,-.173],label:"ashtray"});
      handle(drawer,[0,.014,-.035],[.150,.075,.090],{action:"storage"});
      installedProp(car,asset,"ashtray",drawer,[0,-.014,.058]);
      installedProp(car,asset,"lighter",dash,[.095,.579,.613]);
      const well=part(car,"carTrim",asset("footwells",p=>p(m.fabric).box([0,.215,-.105],[1.555,.037,2.34],carpet,.012)));
      box(car,well,[0,.208,-.101],[1.57,.030,2.34],{kind:"rock",follow:false});
    }
  }

  function available(item) {
    if(item.action==="unlock") return item.car.locked && item.pane.broken;
    if(item.kind==="carHandle") return !item.car.locked;
    return true;
  }

  function grip(item) {
    const {matrix}=item, {at,top,pointing,normal}=item.grip;
    return {at:point(matrix,at),normal:direction(matrix,top ? [0,1,0] : normal),
      up:direction(matrix,top ? [0,0,-1] : [0,1,0]),pointing};
  }

  function prompt(item) {
    if(item.action==="unlock") return "E UNLOCK CAR";
    if(item.action==="door" && item.car.locked) return "CAR LOCKED";
    if(item.action==="lid" && item.latch<1) return item.label.toUpperCase()+" LATCHED";
    const open=(item.door??item).on;
    return "E "+(open ? "CLOSE " : "OPEN ")+(item.label??"door").toUpperCase();
  }

  function underRoof(scene,x,z,feet) {
    for(const car of scene.vehicles) {
      if(Math.abs(x-car.at[0])>1.42 || Math.abs(z-car.at[2])>1.42) continue;
      const [u,,v]=localPoint(car.matrix,[x,feet,z]);
      const y=feet-car.at[1];
      if(Math.abs(u)<.67 && v>-.75 && v<.58 && y>.13 && y<.62) return true;
    }
    return false;
  }

  function use(item) {
    if(!available(item)) return null;
    const {car,action}=item;
    if(action==="unlock") {
      car.locked=false;
      return "switch";
    }
    if((action==="door" && car.locked) || (action==="lid" && item.latch<1)) return null;
    const control=item.door??item;
    control.on=!control.on;
    car.moving=true;
    return action==="storage" && item.move ? "window" : "door";
  }

  function tick(scene,dt,player) {
    for(const car of scene.vehicles) {
      if(!car.moving) continue;
      car.moving=false;
      for(const item of car.parts) {
        if(item.tire && item.air<1 && item.air>0) {
          item.air=Math.max(0,item.air-dt*.88);
          item.hub.wheelDrop=item.wheelDrop=.082*(1-item.air);
          syncPart(item);
          syncPart(item.hub);
          car.moving ||= item.air>0;
        }
        if(item.value===undefined || item.value===Number(item.on)) continue;
        const before=item.value,target=Number(item.on);
        item.value+=Math.sign(target-before)*Math.min(Math.abs(target-before),dt*(item.label ? 2.17 : 2.42));
        syncPart(item);
        if(item.solid && item.kind==="carDoor") {
          const b=item.solid,[x,z]=Valley.roadview.local(b,player.x,player.z);
          if(b.top>player.feet+.034 && b.bottom<player.feet+player.eyeHeight
            && Math.abs(x)<b.hx+.15 && Math.abs(z)<b.hz+.15) {
            item.value=before;
            syncPart(item);
          }
        } else if(item.solid) item.solid.noWalk=item.value>.2;
        for(const child of car.parts) if(child.parent===item) syncPart(child);
        for(const prop of car.accessories) if(prop.installed?.parent===item) syncAccessory(prop);
        car.moving ||= item.value!==target;
      }
    }
  }

  function dent(item,at,normal,force) {
    const {mesh,geometry,index}=item.skin, {vertices}=geometry;
    const offsets=item.effect?.deformation.offsets??new Float32Array(vertices.length/11*3);
    const center=localPoint(item.matrix,at), inward=localVector(item.matrix,times(normal,-1));
    const radius=.16+.22*force, depth=.026+.061*force;
    for(let i=0,j=0;i<vertices.length;i+=11,j+=3) {
      const distance=Math.hypot(vertices[i]+offsets[j]-center[0],vertices[i+1]+offsets[j+1]-center[1],vertices[i+2]+offsets[j+2]-center[2]);
      if(distance>=radius) continue;
      const falloff=(1-smooth(0,radius,distance))**1.35;
      const orientation=Math.abs(dot([vertices[i+3],vertices[i+4],vertices[i+5]],inward));
      for(let k=0;k<3;k++) offsets[j+k]+=depth*falloff*mix(.24,1,orientation)*inward[k];
      const amount=Math.hypot(offsets[j],offsets[j+1],offsets[j+2]);
      if(amount>.128) for(let k=0;k<3;k++) offsets[j+k]*=.128/amount;
    }
    if(item.effect) item.effect.deformation.dirty=true;
    else item.effect={kind:4,deformation:{offsets,dirty:true}};
    item.effectMesh=mesh;
    item.shapes[index]=Valley.world.meshCollider(geometry,0,offsets);
  }

  function impact(item,at,normal,speed,strength,incidence,time) {
    if(item.kind==="glass") return {material:"glass",broken:Valley.lodging.impact(item.car.scene,item,speed,strength,incidence,time),
      pane:!item.opaqueGlass};
    const force=strength*smooth(2.3,18,speed)*mix(.21,1,incidence);
    if(item.tire) {
      item.hp-=force;
      const puncture=item.air===1 && item.hp<=0;
      if(puncture) {
        item.air=.999;
        item.car.moving=true;
      }
      return {material:"vinyl",puncture};
    }
    if(item.latch!==undefined) item.latch=Math.min(1,item.latch+force*.40);
    const bent=Boolean(item.skin && force>.12);
    if(bent) dent(item,at,normal,Math.min(force,1.14));
    return {material:"metal",bent};
  }

  Valley.vehicles={build,available,grip,prompt,use,underRoof,tick,impact};
})();
