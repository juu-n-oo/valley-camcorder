"use strict";

(() => {
  const { clamp, mix, smooth } = Valley;
  // The 50 m ruler spans 94 pixels in the newer image, which is 1.13663 times larger than the traced image.
  const imageRatio=1.13663;
  const metresPerPixel=50*imageRatio/94;
  const mapScale=metresPerPixel/.537;
  const angle=8*Math.PI/180, c=Math.cos(angle), s=Math.sin(angle);
  const point=(u,v)=>{
    const dx=(u-560)*metresPerPixel,dy=(v-332)*metresPerPixel;
    return {x:-s*dx-c*dy,z:c*dx-s*dy};
  };
  // Register the wider photograph to the original trace before projecting its new landmarks.
  const oldPixels=(u,v)=>[(u+56.597)/imageRatio,(v+142.719)/imageRatio];
  const photoPoint=(u,v)=>point(...oldPixels(u,v));
  const photoEdges=points=>points.map(([u,v])=>oldPixels(u,v));
  const photoTrace=nodes=>nodes.map(([t,u,v,y])=>[t,...oldPixels(u,v),y]);

  // Pixel coordinates are traced from the supplied north-up satellite view.
  function edgeProfile(pixels) {
    const points=pixels.map(([u,v])=>point(u,v));
    const segments=points.slice(1).map((b,i)=>{
      const a=points[i],dx=b.x-a.x,dz=b.z-a.z;
      return {a,b,dx,dz,len2:dx*dx+dz*dz};
    });
    function interval(z) {
      let i=0,j=points.length-1;
      while(j-i>1) {
        const k=(i+j)>>1;
        if(points[k].z>z) j=k; else i=k;
      }
      return i;
    }
    function at(z,i=interval(z)) {
      const {a,b,dz}=segments[i];
      return mix(a.x,b.x,clamp((z-a.z)/dz,0,1));
    }
    function distance(x,z) {
      const i=interval(z), delta=x-at(z,i);
      let best=delta*delta;
      function check({a,dx,dz,len2}) {
        const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/len2,0,1);
        const u=x-a.x-t*dx,v=z-a.z-t*dz;
        best=Math.min(best,u*u+v*v);
      }
      check(segments[i]);
      for(let j=i-1;j>=0 && (z-segments[j].b.z)**2<best;j--) check(segments[j]);
      for(let j=i+1;j<segments.length && (segments[j].a.z-z)**2<best;j++) check(segments[j]);
      return Math.sign(delta)*Math.sqrt(best);
    }
    return {at,distance};
  }
  const south=edgeProfile([
    [-130,458],[-55,473],[0,475],[58,482],[123,476],[175,480],[231,472],[278,463],
    [318,465],[346,455],[375,448],[411,438],[451,417],[484,398],[524,382],
    [552,363],[582,354],[606,340],[646,325],[678,308],[711,295],[752,284],
    [793,277],[827,275],[868,280],[905,295],[942,319],[977,347],[1013,375],
    [1048,407],[1080,434],[1116,469],[1144,502],
    ...photoEdges([[1260,456],[1271,484],[1284,535],[1301,577],[1315,610],[1328,645],
      [1343,671],[1360,700],[1375,733],[1393,768],[1413,813],[1443,858],[1480,896]])
  ]);
  const north=edgeProfile([
    [-129,413],[-49,433],[0,440],[59,444],[111,441],[160,438],[201,426],[242,410],
    [277,393],[310,381],[344,366],[380,358],[422,343],[465,318],[512,294],
    [558,274],[605,254],[651,239],[692,229],[730,215],[773,201],[814,207],
    [855,221],[900,239],[940,258],[982,280],[1026,317],[1065,354],[1099,384],
    [1136,416],[1170,451],
    ...photoEdges([[1298,400],[1319,438],[1340,484],[1360,532],[1381,575],[1402,615],
      [1428,665],[1457,715],[1485,750],[1517,792],[1553,838],[1606,872]])
  ]);
  const center=z=>(south.at(z)+north.at(z))*.5;
  const width=z=>Math.max(3.8,(north.at(z)-south.at(z))*.5);
  const bank=(z,side)=>center(z)+side*width(z);
  const shoreDistance=(x,z)=>Math.max(-south.distance(x,z),north.distance(x,z));

  const spillNorth=point(343,366),spillSouth=point(373,452);
  const weir={
    x:(spillSouth.x+spillNorth.x)*.5,
    crest:(spillSouth.z+spillNorth.z)*.5,
    toe:(spillSouth.z+spillNorth.z)*.5-2.8,
    left:spillSouth.x,right:spillNorth.x,lower:-1.38,
    skew:(spillNorth.z-spillSouth.z)/(spillNorth.x-spillSouth.x)
  };
  const waterStation=(x,z)=>z-(x-weir.x)*weir.skew;
  const waterLevel=(x,z)=>mix(weir.lower,0,clamp((waterStation(x,z)-weir.toe)/(weir.crest-weir.toe),0,1));

  // Stations retain IDs for the landmarks. All geometry and travel use projected metres.
  const roadTrace=[
    [-81,328,479,2.23],[-78,339,485,2.24],[-72,355,488,2.25],[-67,371,485,2.27],
    [-61,393,476,2.29],[-49,439,454,2.26],[-37,487,431,2.22],[-27,520,415,2.17],
    [-13,550,401,2.12],[5,577,389,2.08],[22,604,376,2.02],[35,640,361,2.07],
    [48,679,353,2.18],[56,705,354,2.25],[66,754,361,2.37],[74,794,366,2.43],
    [82,831,367,2.52],[94,879,370,2.54],[106,923,373,2.56],[115,949,379,2.59],
    [123,978,391,2.66],[135,1019,421,2.78],[147,1061,455,2.89],[157,1104,492,3.01],
    [162,1127,515,3.15],[167,1140,535,3.28],[174,1148,559,3.41],[184,1154,590,3.57],
    ...photoTrace([[195,1263,568,3.73],[210,1270,602,3.84],[224,1283,639,4.01],
      [242,1301,681,4.08],[260,1320,721,4.16],[273,1333,751,4.23],[281,1352,762,4.26],[292,1378,756,4.26]])
  ];
  const approachTrace=[
    [-169,-75,343,3.64],[-151,-16,354,3.48],[-137,41,366,3.32],
    [-127,91,374,3.15],[-118,143,376,2.99],[-108,196,376,2.82],[-99,233,376,2.65],
    [-93,251,379,2.50],[-86,264,390,2.35],[-81,270,399,2.23]
  ];
  const footTrace=[
    [130,1107,401,.91],[137,1127,420,1.02],[145,1149,441,1.45],[152,1159,448,2.16],
    [161,1174,466,1.67],[169,1190,482,.48],[177,1204,499,1.09],[191,1220,516,1.46],
    ...photoTrace([[205,1354,441,2.23],[224,1388,428,3.22],[244,1428,422,4.62],
      [265,1471,412,5.77],[284,1508,407,6.67]])
  ];

  function section(trace,half,search=half+9.5) {
    const nodes=trace.map(([t,u,v,y])=>({...point(u,v),y,t}));
    const min=nodes[0].t,max=nodes.at(-1).t,cellSize=12,cells=new Map();
    const cell=(x,z)=>`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`;
    function sample(t) {
      t=clamp(t,min,max);
      let i=0,j=nodes.length-1;
      while(j-i>1) {
        const k=(i+j)>>1;
        if(nodes[k].t>t) j=k; else i=k;
      }
      const a=nodes[i],b=nodes[j],f=(t-a.t)/(b.t-a.t);
      return {t,x:mix(a.x,b.x,f),y:mix(a.y,b.y,f),z:mix(a.z,b.z,f)};
    }
    function at(t) {
      const q=sample(t),a=sample(t-.64),b=sample(t+.64);
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
      return {...q,nx:dz/len,nz:-dx/len,half};
    }
    for(let i=1;i<nodes.length;i++) {
      const a=nodes[i-1],b=nodes[i],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;
      const seg={a,b,dx,dz,len2},pad=search;
      for(let iz=Math.floor((Math.min(a.z,b.z)-pad)/cellSize);iz<=Math.floor((Math.max(a.z,b.z)+pad)/cellSize);iz++) {
        for(let ix=Math.floor((Math.min(a.x,b.x)-pad)/cellSize);ix<=Math.floor((Math.max(a.x,b.x)+pad)/cellSize);ix++) {
          const key=`${ix},${iz}`;
          if(!cells.has(key)) cells.set(key,[]);
          cells.get(key).push(seg);
        }
      }
    }
    function closest(x,z) {
      let best=null,bestDistance=Infinity;
      for(const {a,b,dx,dz,len2} of cells.get(cell(x,z))||[]) {
        const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/len2,0,1);
        const px=a.x+t*dx,pz=a.z+t*dz,u=x-px,v=z-pz,distance=u*u+v*v;
        if(distance<bestDistance) {
          best={x:px,z:pz,y:mix(a.y,b.y,t),side:u*dz-v*dx,t:mix(a.t,b.t,t)};
          bestDistance=distance;
        }
      }
      if(best) best.distance=Math.sqrt(bestDistance);
      return best;
    }
    return {min,max,half,at,closest};
  }

  const main=section(roadTrace,2.05,51),approach=section(approachTrace,2.20),foot=section(footTrace,.91);
  const drive=section([[0,604,376,2.02],[8,615,395,2.16],[15,630,421,2.41],
    [24,651,439,2.58],[34,671,450,2.73]],1.48);
  const beyond=section(photoTrace([
    [0,1485,733,4.26],[8,1508,735,4.33],[18,1526,752,4.59],[31,1549,780,4.94],
    [48,1578,813,5.35],[64,1601,842,5.71],[84,1620,880,6.30]
  ]),2.04);
  const templeRoad=section(photoTrace([
    [0,1683,789,8.35],[17,1658,742,7.94],[34,1652,707,7.60],[50,1646,671,7.18],
    [66,1626,627,6.90],[84,1613,586,6.63],[102,1587,545,6.42],[120,1578,503,6.22],
    [138,1566,446,6.06],[151,1577,424,6.25],[163,1559,420,6.46],[178,1529,409,6.67]
  ]),1.78);
  const crossTrail=section(photoTrace([
    [0,1508,735,4.33],[16,1538,717,4.91],[34,1565,693,5.72],
    [48,1590,664,6.22],[61,1610,649,6.64],[76,1626,627,6.90]
  ]),1.05);
  const routes=[main,approach,foot,drive,beyond,templeRoad,crossTrail];
  const bounds={left:-454,right:102*mapScale,far:-333*mapScale,near:616};
  const offset=(q,d)=>({...q,x:q.x+q.nx*d,z:q.z+q.nz*d});
  const barriers=[
    {route:approach,t:-141,side:-1,wide:2.86},
    {route:beyond,t:48,side:1,wide:2.93},
    {route:templeRoad,t:48,side:-1,wide:2.62,minimumZ:495}
  ].map(end=>({...end,q:end.route.at(end.t)}));
  function within(x,z) {
    if(Valley.practice?.contains(x,z)) return true;
    if(x<bounds.left || x>bounds.right || z<bounds.far || z>bounds.near) return false;
    return barriers.every(({q,side,minimumZ})=>(minimumZ!==undefined && z<minimumZ)
      || side*((z-q.z)*q.nx-(x-q.x)*q.nz)<=.13);
  }

  function crossing(a,b,half,name) {
    const yaw=Math.atan2(a.z-b.z,b.x-a.x);
    return {x:(a.x+b.x)*.5,z:(a.z+b.z)*.5,y:a.y,half,yaw,name,c:Math.cos(yaw),s:Math.sin(yaw),
      span:Math.hypot(b.x-a.x,b.z-a.z)+.56};
  }

  function layout() {
    const bridge=crossing(main.at(main.min),approach.at(approach.max),2.30,"HWAYANG BRIDGE 2");
    const lowerBridge=crossing(main.at(main.max),beyond.at(beyond.min),2.22,"HWAYANG BRIDGE 3");
    const grades=[],clearances=[],buildings=[],links=[];
    function flat(x,z,hx,hz,y,blend=2.5,yaw=0) {
      const area={x,z,hx,hz,y,blend,slopeReach:Math.hypot(hx,hz)+56,c:Math.cos(yaw),s:Math.sin(yaw)};
      grades.push(area);
      return area;
    }
    function link(a,b,half,kind) {
      const len=Math.hypot(b.x-a.x,b.z-a.z);
      const connection={x:(a.x+b.x)*.5,z:(a.z+b.z)*.5,c:(b.z-a.z)/len,s:(b.x-a.x)/len,len,half,y0:a.y,y1:b.y,kind};
      links.push(connection);
      return connection;
    }
    function building(id,name,x,z,y,w,d,yaw,style,storeys=1) {
      const b={id,name,x,z,y,w,d,yaw,style,storeys,c:Math.cos(yaw),s:Math.sin(yaw)};
      buildings.push(b);
      clearances.push({...b,hx:w/2+1.25,hz:d/2+1.25});
      return b;
    }
    function shop(id,name,u,v,w,d,style,station,storeys=1) {
      const p=point(u,v), road=main.closest(p.x,p.z)||main.at(station);
      const yaw=Math.atan2(road.x-p.x,road.z-p.z),level=road.y+.14;
      const b=building(id,name,p.x,p.z,level+.22,w,d,yaw,style,storeys);
      const yard=flat(b.x+b.s*1.28,b.z+b.c*1.28,w/2+2.45,d/2+3.80,level,4.4,yaw);
      clearances.push(yard);
      const entry={x:b.x+b.s*(d/2+2.60),z:b.z+b.c*(d/2+2.60),y:level+.035};
      link(road,entry,Math.min(2.20,w*.24),"gravel");
      return b;
    }
    const pension=shop("muljon","MULJON LODGE",646,381,22.4,14.2,"brick",37,3);
    const diner=shop("geumseong","GEUMSEONG INN",756,390,23.2,14.8,"diner",67,3);
    const service=shop("toilet","RESTROOMS",807,381,6.1,4.8,"toilet",77);
    const info=shop("info","VISITOR CENTER",826,403,8.7,5.5,"info",81);
    const deckInn=shop("geumsadam","GEUMSADAM LODGE",1037,474,22.0,14.2,"inn",145,3);
    const kiosk=shop("store","VALLEY STORE",1087,511,7.4,5.6,"shop",157);
    const pavilion=shop("shelter","RIVERSIDE SHELTER",1113,536,11.0,6.5,"shelter",163);
    const carPark=main.at(163.1),park=offset(carPark,-6.95),parkYaw=Math.atan2(-park.nz,park.nx);
    const parking=flat(park.x,park.z,4.29,4.88,carPark.y-.037,2.5,parkYaw);
    clearances.push(parking);
    const parkedCars=[];
    for(const [station,color,reverse] of [[9,0x21272b,false],[50,0xe4e2d7,true],[122,0x878d90,false]]) {
      const q=main.at(station), spot=offset(q,-3.68), yaw=Math.atan2(-q.nz,q.nx);
      clearances.push(flat(spot.x,spot.z,1.55,2.80,q.y-.045,1.7,yaw));
      parkedCars.push({x:spot.x,z:spot.z,yaw:yaw+(reverse ? Math.PI : 0),color});
    }
    for(const [lane,color] of [[-1.60,0x878d90],[1.60,0x21272b]]) {
      parkedCars.push({x:park.x+parking.s*lane,z:park.z+parking.c*lane,yaw:parkYaw+Math.PI/2,color,lot:true});
    }

    const courtRoad=main.at(94), courtX=courtRoad.x,courtZ=courtRoad.z, base=courtRoad.y-.03;
    const topSite=point(843,462);
    const yaw=Math.atan2(topSite.z-courtZ,courtX-topSite.x);
    const hc=Math.cos(yaw),hs=Math.sin(yaw), depth=1.46*mapScale;
    const courtAt=(x,z,y=0)=>({x:courtX+hc*x*depth+hs*z,z:courtZ-hs*x*depth+hc*z,y:base+y});
    const heritage={x:courtX,z:courtZ,y:base,yaw,c:hc,s:hs,depth,at:courtAt};
    function terrace(dx,dz,hx,hz,y,blend) {
      const p=courtAt(dx,dz,y);
      clearances.push(flat(p.x,p.z,hx*depth,hz,p.y,blend,yaw));
    }
    terrace(-4.55,0,2.6,15.1,0,3.0);
    terrace(-13.85,0,6.35,14.4,.54,2.8);
    terrace(-23.8,0,4.15,9.1,.67,2.3);
    terrace(-32.7,0,4.75,8.9,3.35,2.8);
    terrace(-9.0,0,2.1,5.8,.42,1.6);
    function hall(id,name,x,z,y,w,d,style) {
      const p=courtAt(x,z,y);
      return building(id,name,p.x,p.z,p.y,w,d,yaw+Math.PI/2,style);
    }
    const gate=hall("gate","SEOWON GATE",-8.1,0,.56,7.6,3.25,"gate");
    const eastRoom=hall("annex-east","EXHIBIT HALL",-13.1,9.5,.73,6.3,5.2,"exhibit");
    const westRoom=hall("annex-west","WEST ANNEX",-13.8,-9.5,.73,5.9,5.0,"annex");
    const lecture=hall("lecture","HWAYANG SEOWON",-21.0,9.0,.88,9.1,6.0,"lecture");
    const shrine=hall("shrine","MANDONGMYO",-33.3,0,3.55,11.3,6.5,"shrine");
    const monument=hall("monument","EUPGUNGAM",-4.15,18.8,.40,3.0,2.8,"monument");
    terrace(-4.15,18.8,3.8,4.05,.18,4.0);
    link(courtRoad,courtAt(-4.52,0,0),2.36,"stone");
    const markerRoad=main.at(101);
    const markerEntry={x:monument.x+monument.s*1.97,z:monument.z+monument.c*1.97,y:base+.18};
    link(markerRoad,markerEntry,1.34,"stone");
    link(courtAt(-19.25,0,.54),courtAt(-30.7,0,3.50),3.26,"foundation");

    const studyPoint=point(1161,435);
    const amseo=building("amseojae","AMSEOJAE",studyPoint.x,studyPoint.z,2.50,5.5,4.3,-.94,"study");
    clearances.push(flat(amseo.x,amseo.z,3.45,3.8,2.24,3.0,amseo.yaw));
    link(foot.at(150),{x:amseo.x+amseo.s*2.8,z:amseo.z+amseo.c*2.8,y:2.26},1.12,"stone");

    const court=photoPoint(1517,400),templeY=6.66;
    const temple={...court,y:templeY};
    const templeTurn=1.21;
    const templeYard=flat(court.x,court.z,18.4,14.5,templeY,5.5,templeTurn);
    clearances.push(templeYard);
    function templeHall(id,name,u,v,w,d,style) {
      const p=photoPoint(u,v),face=Math.atan2(court.x-p.x,court.z-p.z);
      const b=building(id,name,p.x,p.z,templeY+(style==="temple" ? 1.43 : .25),w,d,face,style);
      clearances.push(flat(p.x,p.z,w/2+1.65,d/2+2.7,templeY,3.4,face));
      return b;
    }
    const mainHall=templeHall("chaeun-hall","CHAEUNAM MAIN HALL",1505,370,9.4,5.8,"temple");
    const annex=templeHall("chaeun-annex","CHAEUNAM ANNEX",1481,391,8.0,5.5,"annex");
    link(foot.at(foot.max),temple,1.20,"stone");
    link(templeRoad.at(templeRoad.max),temple,1.46,"gravel");
    const annexDoor=annex.d/2+.68;
    link(temple,{x:annex.x+annex.s*annexDoor,z:annex.z+annex.c*annexDoor,y:templeY+.026},1.11,"stone");

    const crossingEnd=beyond.at(0),turnout=offset(crossingEnd,-.87);
    const turnoutYaw=Math.atan2(-crossingEnd.nz,crossingEnd.nx);
    clearances.push(flat(turnout.x,turnout.z,5.7,5.9,crossingEnd.y-.045,4.65,turnoutYaw));

    const landing=main.at(25),campTrail={x:bank(22,-1)-2.65,z:22,y:.47};
    link(campTrail,landing,1.05,"gravel");
    const fordLow=point(1169,535),fordHigh=point(1187,480);
    const ford={...link({...fordLow,y:-.31},{...fordHigh,y:-.21},1.55,"ford"),from:fordLow,to:fordHigh};
    link(main.at(168),{...fordLow,y:.12},1.17,"stone");
    link({...fordHigh,y:.05},foot.at(167),1.08,"stone");
    link(main.at(149),{...point(1090,451),y:.21},1.06,"stone");

    function zone(q,rx,rz,label) {return [q.x,q.z,rx,rz,label];}
    const zones=[
      zone(bridge,7.7,12,"WATERFALL"),
      zone(main.at(-37),8.2,12,"UNYEONGDAM"),
      zone(pension,10.7,8.9,pension.name),zone(diner,11.8,10,diner.name),
      zone(monument,6.3,5.3,monument.name),zone(courtAt(-18,0),19,22,lecture.name),
      zone(main.at(145),13,18,"GEUMSADAM"),zone(amseo,8,9,amseo.name),
      zone(main.at(185),7.4,13,"RIVERSIDE ROAD"),zone(main.at(265),11,18,"SOUTH BEND"),
      zone(temple,21,20,"CHAEUNAM COURTYARD"),zone(info,6.6,5.5,info.name)
    ];

    function local(area,x,z) {
      const dx=x-area.x,dz=z-area.z;
      return [area.c*dx-area.s*dz,area.s*dx+area.c*dz];
    }
    function near(area,x,z,r) {
      return Math.abs(x-area.x)<r && Math.abs(z-area.z)<r;
    }
    function grade(x,z,baseHeight) {
      if(x<bounds.left-18 || x>bounds.right+15 || z<bounds.far-22 || z>bounds.near+12) return baseHeight;
      let y=baseHeight;
      const road=main.closest(x,z);
      if(road?.side>0 && road.distance<52 && x<south.at(z)+.15) {
        // The river-facing strip is a low floodplain even where the road swings around the hillside.
        const bench=Math.max(.38,road.y-.08-road.distance*.084+.18*Math.sin(z*.39+x*.37));
        y=mix(y,Math.min(y,bench),1-smooth(42,52,road.distance));
      }
      if(road?.side<0 && road.distance<45) {
        const run=Math.max(0,road.distance-main.half);
        const shoulder=road.y+.14*run+.0017*run*run;
        y=mix(y,Math.min(y,shoulder),1-smooth(22,45,road.distance));
      }
      if(near(heritage,x,z,81)) {
        const [u,v]=local(heritage,x,z),uphill=-u/depth,across=Math.abs(v);
        if(uphill>2 && uphill<51 && across<35) {
          const terrace=base+.54+2.77*smooth(21,32,uphill)+.24*Math.max(0,uphill-39);
          const blend=smooth(2,8,uphill)*(1-smooth(15,35,across))*(1-smooth(41,51,uphill));
          y=mix(y,terrace,blend);
        }
      }
      // Spread the rise out past the courtyards before setting the finished pads.
      for(const g of grades) {
        if(!near(g,x,z,g.slopeReach)) continue;
        const [u,v]=local(g,x,z), edge=Math.max(0,Math.abs(u)-g.hx,Math.abs(v)-g.hz);
        const shoulder=g.y+.16+.115*edge+.0010*edge*edge;
        if(edge<56) y=mix(y,Math.min(y,shoulder),1-smooth(19,56,edge));
      }
      for(const g of grades) {
        if(!near(g,x,z,g.hx+g.hz+g.blend)) continue;
        const [u,v]=local(g,x,z),edge=Math.max(Math.abs(u)-g.hx,Math.abs(v)-g.hz);
        if(edge<g.blend) y=mix(y,g.y,1-smooth(0,g.blend,edge));
      }
      for(const l of links) {
        if(!near(l,x,z,l.len*.5+5)) continue;
        const [u,v]=local(l,x,z),edge=Math.max(Math.abs(u)-l.half,Math.abs(v)-l.len*.5);
        if(edge<2.5) {
          const level=mix(l.y0,l.y1,clamp(.5+v/l.len,0,1))-.040;
          y=mix(y,level,1-smooth(0,2.5,edge));
        }
      }
      for(const route of routes) {
        const q=route===main ? road : route.closest(x,z);
        if(!q) continue;
        const blend=route===foot || route===crossTrail ? 3.35 : route===main && q.side<0 ? 7.3 : 4.2;
        if(q.distance<route.half+blend) y=mix(y,q.y-.045,1-smooth(route.half+.16,route.half+blend,q.distance));
      }
      if(near(parking,x,z,parking.hx+parking.hz+1.6)) {
        const [u,v]=local(parking,x,z),edge=Math.max(Math.abs(u)-parking.hx,Math.abs(v)-parking.hz);
        if(edge<1.6) y=mix(y,parking.y,1-smooth(0,1.6,edge));
      }
      return y;
    }

    function clear(x,z,pad=0) {
      for(const route of routes) {
        if((route.closest(x,z)?.distance??Infinity)<route.half+.31+pad) return true;
      }
      for(const span of [bridge,lowerBridge]) {
        const vista=span===lowerBridge ? 5.4 : 0;
        if(!near(span,x,z,span.span*.5+4+vista+pad)) continue;
        const [u,v]=local(span,x,z);
        if(Math.abs(u)<span.span*.5+vista+pad && Math.abs(v)<span.half+.28+vista+pad) return true;
      }
      for(const g of clearances) {
        if(!near(g,x,z,g.hx+g.hz+pad)) continue;
        const [u,v]=local(g,x,z);
        if(Math.abs(u)<g.hx+pad && Math.abs(v)<g.hz+pad) return true;
      }
      return links.some(l=>{
        if(!near(l,x,z,l.len*.5+5)) return false;
        const [u,v]=local(l,x,z);
        return Math.abs(u)<l.half+.33+pad && Math.abs(v)<l.len*.5+.38+pad;
      });
    }

    function courtyard(x,z) {
      let amount=0;
      for(const g of grades) {
        if(!near(g,x,z,g.hx+g.hz+2)) continue;
        const [u,v]=local(g,x,z);
        amount=Math.max(amount,1-smooth(-.28,1.48,Math.max(Math.abs(u)-g.hx,Math.abs(v)-g.hz)));
      }
      return amount;
    }
    return {main,approach,foot,drive,beyond,templeRoad,crossTrail,routes,bridge,lowerBridge,buildings,heritage,temple,parking,parkedCars,
      links,zones,grade,clear,courtyard,barriers,ford,campTrail,
      sites:{pension,diner,service,info,deckInn,kiosk,pavilion,amseo,gate,eastRoom,westRoom,lecture,shrine,monument,mainHall,annex}};
  }

  const storeyHeight=2.76;
  Valley.roadLayout={bounds,within,barriers,weir,waterStation,waterLevel,layout,point,photoPoint,bank,center,width,shoreDistance,offset,storeyHeight,mapScale};
})();
