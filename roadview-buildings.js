"use strict";

(() => {
  const { rgb, mix, times } = Valley;
  const { storeyHeight } = Valley.roadLayout;
  const plaster=rgb(0xc4beb0), granite=rgb(0xb0a697), wood=rgb(0xad8966);
  const beam=rgb(0x6f4935), charcoal=rgb(0x4c4942), red=rgb(0x904c3d);
  const cream=rgb(0xd2c4a3), teal=rgb(0x637360), white=rgb(0xc6c9be);
  const glass=rgb(0x718689), brass=rgb(0xa38750);
  const signNames={
    muljon:"물존펜션",geumseong:"금성식당·민박",toilet:"공중화장실",info:"화양구곡 관광안내소",
    geumsadam:"금사담펜션",store:"계곡 매점",shelter:"계곡 쉼터",gate:"화양서원 입구",
    "annex-east":"전시실","annex-west":"별채",lecture:"화양서원",shrine:"만동묘",
    monument:"읍궁암",amseojae:"암서재","chaeun-hall":"대웅전","chaeun-annex":"채운암 별채"
  };
  const storefronts={
    brick:{theme:"shop-green",sub:"객실 · 식사",blade:["물존펜션","숙박","blade-ivory"]},
    diner:{theme:"shop-ivory",sub:"식사 · 민박",blade:["금성식당","민박","blade-red"]},
    inn:{theme:"shop-blue",sub:"숙박 · 식사",blade:["금사담펜션","객실","blade-blue"]},
    shop:{theme:"shop-red",sub:"음료 · 간식",blade:["계곡매점","식품","blade-ivory"]},
    shelter:{theme:"shop-green",sub:"휴게실"},
    info:{theme:"blue",sub:"탐방 안내"},
    toilet:{theme:"blue",sub:"화양구곡"}
  };

  function build(a,b,{material:m,rng,stairs,height,interior,service}) {
    const {w,d,style}=b, front=d/2;
    const lodgings=Valley.lodging, guesthouse=b.storeys>1;
    const traditional=["gate","annex","exhibit","lecture","shrine","monument","study","temple"].includes(style);
    const h=style==="monument" ? 2.25 : style==="toilet" ? 2.47 : traditional ? 2.78 : 2.69;
    const tileTint=style==="temple" ? rgb(0x626b72) : traditional ? rgb(0x4d5051) : style==="shelter" ? rgb(0x446582) :
      style==="diner" ? rgb(0x845044) : style==="shop" || style==="toilet" ? rgb(0x646d69) : rgb(0x706052);
    const facade=style==="brick" ? m.brick : ["shelter","inn","shrine","temple"].includes(style) ? m.wood : m.plaster;
    const wallTint=style==="brick" ? rgb(0xae7f62) : style==="inn" ? rgb(0xbaa17b) :
      style==="shelter" ? rgb(0x9f856b) : ["shrine","temple"].includes(style) ? rgb(0x965747) : traditional ? rgb(0xcdc2a9) : plaster;
    const floorMaterial=traditional || style==="inn" || style==="shelter" ? m.wood : m.plaster;
    const hard={kind:"wall"};
    const soft={radius:.014};
    let level=0;
    const box=(mat,x,y,z,w,h,d,color,opts={})=>a.box(mat,[x,y+level,z],[w,h,d],color,opts);
    const block=(mat,x,y,z,w,h,d,color,opts={})=>box(mat,x,y,z,w,h,d,color,{...hard,...opts});

    function platform() {
      if(style==="temple") {
        const stone=1.48;
        box(m.rock,0,-stone*.5-.07,0,w+.79,stone-.14,d+.86,granite,{radius:.033,kind:"wall"});
        for(let row=0;row<4;row++) for(let x=-w/2-.26+row%2*.22;x<w/2+.11;x+=.51) {
          const width=Math.min(.48,w/2+.35-x);
          box(m.rock,x+width/2,-1.35+row*.327,front+.42,width,.292,.16,
            times(granite,.82+rng()*.26),{radius:.036});
        }
      } else box(m.rock,0,-.24,0,w+.24,.39,d+.25,granite,{radius:.036});
      const wooden=floorMaterial===m.wood, floorKind=wooden || guesthouse ? "wood" : "rock";
      box(floorMaterial,0,-.074,0,w,.148,d,wooden ? rgb(0xae9274) : rgb(0x9c9a8c),
        {kind:floorKind,hit:wooden ? "wood" : "rock",stepBank:floorKind==="wood" ? "indoorWood" : "indoorStone"});
      if(floorMaterial===m.wood) {
        for(let x=-w/2+.22;x<w/2-.04;x+=.223) {
          box(m.plain,x,.001,0,.005,.003,d-.024,rgb(0x796650));
        }
      }
    }

    function roof(y,wide,deep,rise,color,curved=false) {
      const half=wide/2, length=deep/2;
      const hip=style==="temple" ? .98 : .55;
      const top=(x,v,side)=>[
        x*(half-(curved ? hip*(1-v) : 0)),
        y+rise*(curved ? (1-v)**1.41 : (1-v))+
          (curved ? (style==="temple" ? .57 : .35)*Math.abs(x)**6*(.27+.73*v**2) : 0),
        side*v*length
      ];
      for(const side of [-1,1]) {
        const nx=curved ? 14 : 6,nz=curved ? 9 : 4;
        for(let i=0;i<nx;i++) for(let j=0;j<nz;j++) {
          const u=2*i/nx-1,u1=2*(i+1)/nx-1,v=j/nz,v1=(j+1)/nz;
          const points=[top(u,v,side),top(u,v1,side),top(u1,v1,side),top(u1,v,side)];
          const uv=[[u*half,v*length],[u*half,v1*length],[u1*half,v1*length],[u1*half,v*length]];
          a.quad(m.tile,side>0 ? points : points.reverse(),color,side>0 ? uv : uv.reverse());
        }
        for(let i=0;i<18;i++) {
          const q=top(2*i/18-1,1,side),p=top(2*(i+1)/18-1,1,side);
          a.beam(m.wood,[q[0],q[1]-.045,q[2]],[p[0],p[1]-.045,p[2]],.051,.051,beam,6);
        }
        for(let x=-half+.12;x<half;x+=curved ? .245 : .52) {
          const q=top(x/half,1,side),p=top(x/half,.897,side);
          a.beam(m.tile,q,p,curved ? .071 : .026,curved ? .058 : .026,times(color,.93+rng()*.24),6);
          if(curved) {
            const [xx,yy,zz]=q;
            a.oval(m.tile,[xx,yy-.006,zz+side*.024],[.077,.064,.026],times(color,1.19));
            a.beam(m.wood,[p[0],p[1]-.14,p[2]*.86],[xx,yy-.136,zz*.97],.044,.049,red,6);
          }
        }
        for(const end of [-1,1]) {
          const topPoint=top(end,0,side),edge=top(end,1,side);
          const faceX=end*(half-(curved ? .50 : .36));
          a.triangle(curved ? m.wood : facade,[faceX,y-.135,0],topPoint,edge,curved ? beam : wallTint);
          a.beam(m.tile,topPoint,edge,curved ? .076 : .037,.053,color,8);
        }
      }
      const ridge=half-(curved ? hip-.03 : .05);
      a.beam(m.tile,[-ridge,y+rise+.031,0],[ridge,y+rise+.031,0],curved ? .098 : .046,curved ? .098 : .046,color,9);
      if(curved) for(const end of [-1,1]) {
        a.beam(m.tile,[end*(ridge-.25),y+rise+.033,0],[end*(ridge+.09),y+rise+.177,0],.093,.065,times(color,1.17),9);
      }
    }

    function ceiling(open=false) {
      if(!open) block(traditional ? m.wood : m.paint,0,h-.042,0,w-.06,.084,d-.06,traditional ? rgb(0x8e6c4e) : rgb(0xc8c6ba));
      for(const side of [-1,1]) {
        box(m.wood,0,h-.138,side*front,w+.26,.16,.178,traditional ? beam : wallTint);
        box(m.wood,side*w/2,h-.138,0,.176,.16,d+.16,traditional ? beam : wallTint);
      }
      for(let x=-w/2+.20;x<w/2-.04;x+=.48) {
        box(m.wood,x,h-.195,0,.079,.125,d+.54,beam);
        if(traditional) {
          for(const dz of [-front-.01,front+.01]) {
            box(m.wood,x,h-.20,dz,.086,.098,.245,teal);
            box(m.plain,x,h-.18,dz+.11*Math.sign(dz),.054,.036,.021,red);
          }
        }
      }
    }

    function frontSegment(lo,hi,bottom,top) {
      if(hi<=lo || top<=bottom) return;
      block(facade,(lo+hi)/2,(top+bottom)/2,front,hi-lo,top-bottom,.16,wallTint);
    }

    function window(lo,hi,z=front,back=false) {
      const mid=(lo+hi)/2,side=back ? -1 : 1, low=.92,high=2.14;
      const frame=traditional ? beam : guesthouse || style==="shelter" ? wood : charcoal;
      const trim=traditional ? {} : {kind:"wall"};
      if(traditional) box(m.plaster,mid,(high+low)/2,z-side*.017,hi-lo,high-low,.032,rgb(0xb3a584),{kind:"wall"});
      else for(const [left,right] of [[lo,mid],[mid,hi]]) {
        lodgings.pane(interior,a,[(left+right)/2,level+(low+high)/2,z-side*.017],right-left-.029,high-low-.028);
      }
      for(const y of [low,high,traditional ? 1.47 : 1.62]) box(m.wood,mid,y,z+side*.053,hi-lo+.10,.053,.14,frame,trim);
      for(let i=0;i<=(traditional ? 5 : 2);i++) {
        box(m.wood,mix(lo,hi,i/(traditional ? 5 : 2)),(low+high)/2,z+side*.034,.052,high-low+.055,.138,frame,trim);
      }
      box(m.plaster,mid,low-.042,z+side*.045,hi-lo+.20,.068,.24,traditional ? granite : plaster,soft);
    }

    function doorway(center,width,z=front,wooden=traditional) {
      const jamb=wooden || guesthouse ? beam : charcoal, top=2.18;
      for(const side of [-1,1]) box(m.wood,center+side*(width/2+.033),top/2,z,.069,top,.24,jamb,{radius:.011});
      box(m.wood,center,top,z,width+.16,.083,.24,jamb);
      box(m.rock,center,.017,z,width,.037,.30,granite,{radius:.009,kind:"rock",stepBank:"outdoorStone"});
      if(guesthouse) {
        lodgings.door(interior,a,[center-width/2+.036,level+.041,z],width-.072,{swing:1.57,open:true});
        return;
      }
      const leaf=width*.46,face=style==="temple" ? rgb(0x76aba8) : wooden ? red : wood;
      for(const side of [-1,1]) {
        const x=center+side*(width/2-.048);
        block(m.wood,x,1.05,z-leaf*.49,.076,2.07,leaf,face,{radius:.014});
        for(const y of [.42,1.53]) box(m.wood,x,y,z-leaf*.43,.088,.05,leaf*.82,beam);
        a.oval(m.plain,[x-side*.051,1.01,z-leaf*.84],[.041,.061,.037],brass);
      }
    }

    function facadeWall(door) {
      const bays=[[-door/2,door/2,"door"]];
      for(const side of [-1,1]) {
        if(style==="temple") {
          const x=side*w*.315,frame=rgb(0x52988e),paper=rgb(0xd4d8b4),blue=rgb(0x4d7d90);
          for(const leaf of [-1,1]) {
            const cx=x+leaf*.51;
            box(m.wood,cx,1.115,front+.117,.98,1.91,.08,frame,{radius:.021});
            box(m.plaster,cx,1.30,front+.162,.78,1.20,.022,paper);
            for(let i=0;i<6;i++) {
              const u=cx-.34+.135*i;
              box(m.wood,u,1.30,front+.185,.024,1.19,.029,frame);
            }
            for(let j=0;j<9;j++) {
              const y=.755+.136*j;
              box(m.wood,cx,y,front+.181,.76,.022,.029,frame);
              const hue=j%3===0 ? red : j%3===1 ? blue : brass;
              a.oval(m.plain,[cx+.205*Math.sin(j*2.12),y+.05,front+.200],[.047,.040,.012],hue);
            }
            box(m.wood,cx,.36,front+.173,.70,.263,.027,blue,{radius:.016});
            a.oval(m.plain,[cx,.364,front+.192],[.174,.081,.012],brass);
          }
          continue;
        }
        if(style==="shrine") {
          for(const u of [w*.207,w*.375]) {
            const x=side*u;
            box(m.wood,x,1.14,front+.112,w*.141,1.92,.079,red,{radius:.025});
            for(const y of [.33,1.27,2.10]) box(m.wood,x,y,front+.155,w*.143,.061,.046,beam);
            a.oval(m.plain,[x-.19,1.06,front+.193],[.036,.066,.023],brass);
          }
          continue;
        }
        const start=door/2+.46, end=w/2-.47;
        if(end-start>.74) {
          if(w>=10) {
            const middle=(start+end)*.5;
            for(const [lo,hi] of [[start,middle-.135],[middle+.135,end]]) bays.push(side<0 ? [-hi,-lo,"window"] : [lo,hi,"window"]);
          } else bays.push(side<0 ? [-end,-start,"window"] : [start,end,"window"]);
        }
      }
      bays.sort((a,b)=>a[0]-b[0]);
      let x=-w/2;
      for(const [lo,hi,kind] of bays) {
        frontSegment(x,lo,0,h);
        if(kind==="window") {
          frontSegment(lo,hi,0,.92);
          frontSegment(lo,hi,2.14,h);
          window(lo,hi);
        } else {
          frontSegment(lo,hi,2.19,h);
          doorway(0,door);
        }
        x=hi;
      }
      frontSegment(x,w/2,0,h);
    }

    function shell(door) {
      facadeWall(door);
      block(facade,0,h/2,-front,w,h,.166,wallTint);
      for(const side of [-1,1]) {
        const breakable=service && side===-1;
        const spans=breakable ? [[-front,service.z-service.span/2],[service.z+service.span/2,front]] : [[-front,front]];
        const extension=breakable ? 0 : .1;
        for(const [lo,hi] of spans) {
          const mid=(lo+hi)/2,length=hi-lo,x=side*w/2;
          block(facade,x,h/2,mid,.165,h,length,wallTint);
          box(m.wood,x,.22,mid,.184,.16,length+extension,traditional ? beam : wallTint);
          box(m.wood,x,h-.21,mid,.179,.138,length+extension,traditional ? teal : wallTint);
          if(!traditional) {
            box(m.plaster,x,.11,mid,.191,.22,length+extension,granite);
            box(m.wood,x,h-.08,mid,.181,.17,length+extension,beam);
            box(m.wood,x-side*.089,.36,mid,.022,.66,length-.08,wood);
            box(m.wood,x-side*.067,.705,mid,.043,.066,length-.08,beam);
          }
        }
        if(traditional) {
          window(side*w*.28-.64,side*w*.28+.64,-front-.039,true);
          for(const dz of [-front,front]) {
            const x=side*w/2;
            box(m.rock,x,.116,dz,.42,.236,.40,granite,{radius:.037});
            a.beam(m.wood,[x,.18,dz],[x,h-.045,dz],.141,.114,red,11);
          }
        }
      }
      if(service) Valley.utilities.wall(interior,a,service,facade,wallTint,h);
      if(!traditional) {
        box(m.wood,0,.36,-front+.09,w-.20,.66,.022,wood);
        box(m.wood,0,.705,-front+.107,w-.18,.066,.043,beam);
      }
    }

    function threshold(door,depth=.94,landing=.06) {
      const xz=a.at([0,0,front+depth]);
      const y0=Math.min(-.012,height(xz[0],xz[2])-b.y);
      if(y0>=-.035) return;
      const wooden=floorMaterial===m.wood;
      const draw=target=>stairs(target,0,front+depth,0,front+landing,door+.46,y0,0,wooden ? m.wood : m.rock,
        wooden ? "outdoorWood" : "outdoorStone");
      const center=[0,y0*.5,front+(depth+landing)*.5];
      if(service && Math.hypot(w*.5,center[2]-service.z)<8.4) Valley.utilities.breakableStair(interior,a,service,center,draw);
      else draw(a);
    }

    function templeEntry() {
      const length=3.82,p=a.at([0,0,front+length]),low=height(p[0],p[2])-b.y;
      stairs(a,0,front+length,0,front+.045,2.35,low,0,m.rock);
      for(const side of [-1,1]) {
        const x=side*1.27;
        a.beam(m.plain,[x,low+.79,front+length],[x,.79,front+.24],.024,.022,granite,8);
        for(const t of [0,.48,1]) {
          const z=mix(front+length,front+.24,t),y=mix(low,0,t);
          a.beam(m.plain,[x,y-.05,z],[x,y+.79,z],.026,.025,granite,7);
        }
      }
      const green=rgb(0x3d795d),blue=rgb(0x447d8c),gold=rgb(0xb38c51);
      for(const x of [-w*.465,-w*.141,w*.141,w*.465]) {
        a.beam(m.wood,[x,.041,front+.235],[x,h-.185,front+.235],.167,.138,red,13);
        for(const [i,tint] of [green,red,blue,green].entries()) {
          const y=h-.39+i*.092, depth=.28+i*.22, wide=.30+i*.108;
          box(m.wood,x,y,front+depth*.50,wide,.116,depth,tint,{radius:.020});
          a.oval(m.plain,[x,y,front+depth+.014],[.056,.038,.015],gold);
        }
      }
      for(const [y,z,tint] of [[h-.294,.252,green],[h-.238,.316,red],[h-.158,.545,blue],[h-.073,.82,green]]) {
        box(m.wood,0,y,front+z,w+.58,.086,.203,tint,{radius:.014});
      }
      for(let x=-w/2+.17;x<w/2-.05;x+=.257) {
        a.oval(m.plain,[x,h-.238,front+.423],[.046,.037,.018],gold);
        a.oval(m.plain,[x+.125,h-.155,front+.653],[.052,.038,.018],red);
        a.beam(m.wood,[x,h-.164,front+.244],[x,h-.088,front+1.02],.054,.041,green,7);
        a.oval(m.plain,[x,h-.071,front+.929],[.047,.029,.014],gold);
      }
      for(const [x,z,w] of [[-3.18,front+1.17,1.72],[-4.31,front+.58,1.29],[3.25,front+1.57,1.92],[4.32,front+.38,1.39]]) {
        const p=a.at([x,0,z]),y=height(p[0],p[2])-b.y;
        const tint=times([.77,.96,.72],.91+rng()*.18);
        a.quad(4,[[x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+w*.77,z],[x-w/2,y+w*.77,z]],tint);
        a.quad(4,[[x,y,z-w/2],[x,y,z+w/2],[x,y+w*.71,z+w/2],[x,y+w*.71,z-w/2]],tint);
      }
    }

    function panel() {
      const name=signNames[b.id]??b.name;
      if(style==="temple") {
        box(m.wood,0,h-.321,front+.766,1.84,.422,.416,beam,{radius:.023});
        a.label(name,"",[0,h-.321,front+.977],1.69,.345,"heritage");
        return;
      }
      const face=storefronts[style];
      const panelWidth=style==="info" ? 4.31 : style==="toilet" ? 2.22 : .46*name.length+.27;
      const width=face ? Math.min(w*.61,panelWidth) : Math.min(w*.53,3.20);
      const tall=face ? .49 : .36, y=guesthouse ? storeyHeight+.472 : h-(face ? .325 : .28);
      const frame=face ? rgb(0xb5b3a1) : beam;
      for(const side of [-1,1]) box(m.wood,side*width*.31,y,front+.208,.06,.27,.25,beam);
      box(face ? m.paint : m.wood,0,y,front+.353,width+.077,tall+.066,.097,frame,{radius:.014});
      a.label(name,face?.sub??"",[0,y,front+.404],width,tall,face?.theme??"heritage");
      if(face?.blade) {
        const [title,sub,theme]=face.blade;
        const x=w/2-.29, yy=guesthouse ? storeyHeight+1.36 : h-.85, z=front+.41;
        for(const offset of [-.51,.53]) box(m.gloss,x,yy+offset,front+.25,.061,.064,.48,frame,{radius:.006});
        box(m.paint,x,yy,z,.092,1.77,.53,frame,{radius:.012});
        for(const side of [-1,1]) {
          a.label(title,sub,[x+side*.049,yy,z],.488,1.716,theme,side*Math.PI/2);
        }
      }
    }

    function light(x,z) {
      box(m.plain,x,h-.145,z,.12,.199,.12,charcoal);
      box(m.plaster,x,h-.254,z,.41,.082,.25,rgb(0xe1d2a7),{radius:.023});
    }

    function furniture(x,z,w,d,y=.72) {
      block(m.wood,x,y,z,w,.084,d,wood,{radius:.019});
      for(const s of [-1,1]) for(const t of [-1,1]) {
        box(m.wood,x+s*(w/2-.11),y*.48,z+t*(d/2-.10),.081,y*.96,.081,beam,soft);
      }
    }

    function stool(x,z,h=.44) {
      box(m.wood,x,h,z,.40,.067,.39,wood,{radius:.018,kind:"wall"});
      for(const s of [-1,1]) for(const t of [-1,1]) box(m.wood,x+s*.145,h*.48,z+t*.139,.047,h*.96,.048,beam);
    }

    function lowChest(x,z,w=1.08) {
      block(m.wood,x,.31,z,w,.62,.47,beam,{radius:.027});
      box(m.wood,x,.632,z,w+.054,.078,.51,wood,{radius:.013});
      box(m.plain,x,.39,z+.24,.17,.16,.014,brass,{radius:.01});
      for(const dx of [-.24,.24]) box(m.plain,x+dx,.32,z+.243,.051,.35,.013,brass);
    }

    function shelves(x,z,w=1.45) {
      for(const side of [-1,1]) block(m.wood,x+side*w/2,.81,z,.072,1.62,.38,beam);
      for(const y of [.21,.64,1.07,1.55]) box(m.wood,x,y,z,w,.052,.40,wood,{kind:"wall"});
      for(let i=0;i<14;i++) {
        const side=i%5, y=[.23,.67,1.10][Math.floor(i/5)], tint=[red,teal,cream,granite,charcoal][i%5];
        const x0=x+(side-2)*w*.142;
        box(m.plaster,x0,y+.084,z+.065,.123,.169+.048*rng(),.17,times(tint,.91+rng()*.19),soft);
      }
    }

    function partition(x,z0,z1) {
      block(m.wood,x,1.27,(z0+z1)/2,.105,2.54,z1-z0,wood);
    }

    function lodging() {
      const suites=Valley.roadSuites, half=w/2;
      const wing=half-3.96, shaft=half-2.14, stair=half-1.105, flight=2.76, hall=1.41;
      const last=b.storeys-1, floorTint=rgb(style==="inn" ? 0xbb936c : 0xc6a072);
      const creamWalls=rgb(0xe8dfce), paper=rgb(style==="inn" ? 0xe1e0d4 : 0xe7ddcc);
      const layout=Array.from({length:last},(_,index)=>Array.from({length:4},(_,n)=>(index+2)*100+n+1));
      const wall=(axis,at,lo,hi,options)=>suites.wall(interior,a,h,axis,at,lo,hi,options);
      const light=(rect,x,z,yaw,style)=>lodgings.roomLight(interior,a,0,rect,[x,1.27,z],yaw,style);
      const back=-front+.081, branch=-hall-.061, reception=2.32;
      const lo=back+1.28,hi=branch-.90;
      const receptionTint=style==="brick" ? rgb(0xd6b2b4) : creamWalls;

      suites.planks(a,m,-half+.058,half-.058,-front+.062,front-.062,.007,floorTint);
      wall("x",reception,back,lo,{tint:receptionTint});
      wall("x",reception,hi,branch,{tint:receptionTint});
      wall("z",branch,reception,wing,{tint:receptionTint,
        door:{center:mix(reception,wing,.56),width:1.40,swing:1.55,open:true}});
      wall("x",wing,back,branch,{tint:receptionTint,
        door:{center:mix(back,branch,.41),width:1.28,swing:-1.55,open:true}});
      const counter=Valley.reception.build(interior,a,style,{wall:reception,lo,hi,front,h,edge:wing,near:branch,rooms:layout.flat()});
      if(service) service.reception=counter;

      const dining=-1.48;
      Valley.roadDining.build(interior,a,{lo:-wing,hi:dining,near:back,far:front-.081,height:h,style});
      const receptionDoor=mix(reception,wing,.56);
      a.label("접수실","RECEPTION",[receptionDoor,2.363,branch+.082],.92,.253,"wood");
      light([reception+.121,wing-.064,back+.071,branch-.061],reception+.077,branch-.48,Math.PI/2,"strip");

      const cofferWidth=Math.min(w*.58,12.4),cofferNear=1.19,cofferFar=front-.85;
      for(const x of [-cofferWidth/2,cofferWidth/2]) box(m.wood,x,2.53,(cofferNear+cofferFar)/2,
        .098,.082,cofferFar-cofferNear+.094,beam);
      for(const z of [cofferNear,cofferFar]) box(m.wood,0,2.53,z,cofferWidth+.094,.082,.098,beam);
      suites.sofa(a,m,wing-1.31,front-.52,1.97,rgb(0x8d7970));
      suites.lowTable(a,m,wing-1.31,front-1.48,.98,.48);
      box(m.ceramicTile,wing-.10,.765,branch+.04,.305,1.53,.314,rgb(0xc4b3a5),{radius:.017});
      a.label("객실","STAIRS",[wing-.47,2.373,branch+.089],.72,.241,"wood");
      light([dining+.067,half-.085,branch+.061,front-.084],reception-.47,branch+.071,0,"cluster");
      light([dining+.064,reception-.118,back+.070,branch+.061],dining+.072,branch-.56,Math.PI/2,"strip");

      function guard(target,x0,z0,x1,z1,y0,y1) {
        target.beam(m.wood,[x0,y0+.91,z0],[x1,y1+.91,z1],.043,.042,beam,8);
        const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/.39);
        for(let i=0;i<=n;i++) {
          const t=i/n;
          target.box(m.wood,[mix(x0,x1,t),mix(y0,y1,t)+.448,mix(z0,z1,t)],[.052,.899,.052],wood,{radius:.005});
        }
      }

      for(let index=0;index<last;index++) {
        const base=index*storeyHeight;
        for(const side of [-1,1]) {
          const from=side*flight,to=-from,x=side*stair;
          const draw=target=>{
            stairs(target,x,from,x,to,1.86,base,base+storeyHeight,m.wood);
            guard(target,side*(shaft+.043),from,side*(shaft+.043),to,base,base+storeyHeight);
            guard(target,side*(half-.121),from,side*(half-.121),to,base,base+storeyHeight);
          };
          if(service && index===0 && side===-1) Valley.utilities.breakableStair(interior,a,service,[x,storeyHeight*.5,0],draw);
          else draw(a);
        }
      }

      function deck(x0,x1,z0,z1) {
        const x=(x0+x1)/2,z=(z0+z1)/2,dx=x1-x0,dz=z1-z0;
        box(m.wood,x,-.079,z,dx,.158,dz,rgb(0xa98a68),{kind:"wood",stepBank:"indoorWood"});
        box(m.paint,x,-.160,z,dx,.012,dz,rgb(0xe0ddd2));
        suites.planks(a,m,x0+.002,x1-.002,z0+.002,z1-.002,level+.007,floorTint);
      }

      const exterior={surface:facade,tint:wallTint,thickness:.166,baseboard:false};
      for(let index=1;index<=last;index++) {
        level=index*storeyHeight;
        deck(-shaft,shaft,-front,front);
        for(const side of [-1,1]) {
          const left=side<0 ? -half : shaft,right=side<0 ? -shaft : half;
          deck(left,right,-front,-flight);
          deck(left,right,flight,front);
          const x=side*shaft;
          guard(a,x,-flight,x,flight,level,level);
          block(m.wood,x,.449,0,.059,.897,flight*2,wood);
          if(index===last) {
            guard(a,left,side*flight,right,side*flight,level,level);
            block(m.wood,(left+right)/2,.45,side*flight,right-left,.90,.059,wood);
          }
        }
        for(const side of [-1,1]) box(m.wood,0,-.057,side*(front+.042),w+.25,.155,.144,wood);
        const upper=a.section([0,level,0]);
        for(const side of [-1,1]) {
          if(service && index===1 && side===-1) Valley.utilities.upperWall(interior,upper,service,h,exterior);
          else suites.wall(interior,upper,h,"x",side*half,-front,front,{...exterior,windows:[
            {center:0,width:1.90,bottom:1.17,top:2.20}
          ]});
          const left=side<0 ? -half : wing,right=side<0 ? -wing : half;
          for(const row of [-1,1]) {
            suites.wall(interior,upper,h,"z",row*front,left,right,{...exterior,windows:[
              {center:(left+right)/2,width:2.13,bottom:.92,top:2.16}
            ]});
          }
          for(const z of [-3.67,3.67]) {
            upper.label(`${index+1}F`,"STAIRS",[side*(wing+.074),1.83,z],.56,.29,"wood",side*Math.PI/2);
          }
        }
        for(const x of [-wing,0,wing]) for(const row of [-1,1]) {
          const start=row<0 ? -front : hall,end=row<0 ? -hall : front;
          suites.wall(interior,upper,h,"x",x,start,end,{surface:m.wallpaper,tint:paper});
        }
        for(const [rowIndex,row] of [1,-1].entries()) for(const [col,side] of [-1,1].entries()) {
          const room=upper.section([side*wing/2,0,row*hall],row<0 ? Math.PI : 0);
          suites.build(interior,room,{width:wing,depth:front-hall,height:h,number:layout[index-1][rowIndex*2+col],
            style,facade,facadeTint:wallTint});
          room.done();
        }
        for(const z of [-hall+.067,hall-.067]) {
          upper.box(m.wood,[0,h-.106,z],[2*wing,.053,.064],beam);
        }
        lodgings.roomLight(interior,upper,0,[-shaft,shaft,-hall+.069,hall-.069],
          [.269,1.27,hall-.069],Math.PI,"strip");
        upper.done();
      }
      block(m.paint,0,h-.044,0,w-.079,.088,d-.080,rgb(0xe1ded1));
      roof(level+h,w+.86,d+.93,style==="brick" ? .97 : .79,tileTint);
      level=0;
    }

    function verandaGlass(depth,width) {
      const half=width/2-.065, far=front+depth-.075, near=front+.068;
      const head=2.244, sill=.050, middle=(head+sill)/2, paneHeight=head-sill-.045;
      const opening=2.18, frame=rgb(0xe0dcd0), clear=rgb(0xb6cbc9);
      for(const y of [sill,head]) box(m.paint,0,y,far,width,.054,.084,frame,{radius:.005});
      box(m.gloss,opening*.49,.018,far-.076,opening*2.04,.026,.081,rgb(0xb2b7b4),{radius:.004});
      box(m.paint,opening*.49,head-.044,far-.076,opening*2.04,.049,.091,frame,{radius:.004});
      for(const side of [-1,1]) {
        const start=opening/2+.026, bays=Math.ceil((half-start)/1.52);
        for(let i=0;i<=bays;i++) {
          const x=mix(start,half,i/bays);
          block(m.paint,side*x,middle,far,.062,head-sill,.081,frame,{radius:.006});
          if(i===bays) continue;
          const next=mix(start,half,(i+1)/bays);
          lodgings.pane(interior,a,[side*(x+next)/2,middle,far],next-x-.053,paneHeight,{tint:clear});
        }
        const x=side*half, mid=(near+far)/2;
        for(const y of [sill,head]) box(m.paint,x,y,mid,.082,.056,far-near+.065,frame,{radius:.004});
        for(const z of [near,mid]) block(m.paint,x,middle,z,.082,head-sill,.063,frame,{radius:.005});
        for(const z of [mix(near,far,.25),mix(near,far,.75)]) {
          lodgings.pane(interior,a,[x,middle,z],(far-near)/2-.053,paneHeight,{yaw:Math.PI/2,tint:clear});
        }
      }
      lodgings.door(interior,a,[-opening/2+.017,.030,far-.079],opening-.034,
        {height:2.15,slide:opening-.097,panel:"glass",open:true});
    }

    function veranda(roofed) {
      const depth=roofed ? 2.06 : 2.17, z=front+depth/2, width=w+.27;
      box(m.wood,0,-.076,z,width,.151,depth,wood,{kind:"wood",stepBank:"outdoorWood"});
      for(let x=-width/2+.13;x<width/2-.06;x+=.213) {
        box(m.plain,x,.002,z,.006,.004,depth-.041,beam);
      }
      if(guesthouse) verandaGlass(depth,width);
      else for(const side of [-1,1]) {
        const end=side*(width/2-.068);
        for(let x=1.18;x<width/2-.18;x+=.63) box(m.wood,side*x,.45,front+depth-.064,.078,.93,.082,beam,soft);
        const long=width/2-1.12;
        for(const y of [.32,.88]) block(m.wood,side*(1.12+long/2),y,front+depth-.06,long,.101,.09,wood,{radius:.012});
        box(m.wood,end,.64,z,.12,.16,depth,beam);
        if(roofed) for(const p of [end,end*.43]) {
          block(m.wood,p,1.21,front+depth-.17,.202,2.42,.22,beam,{radius:.027});
          box(m.rock,p,.088,front+depth-.17,.30,.178,.31,granite,{radius:.024});
        }
      }
      if(roofed) {
        a.quad(m.tile,[[-width/2-.13,h-.37,front+depth+.30],[width/2+.13,h-.37,front+depth+.30],
          [width/2+.13,h+.10,front-.11],[-width/2-.13,h+.10,front-.11]],tileTint,[[0,0],[width,0],[width,2.3],[0,2.3]]);
        box(m.wood,0,h-.38,front+depth+.25,width+.26,.139,.17,beam);
      }
      for(const side of [-1,1]) {
        const x=side*w*.29,z=front+1.05;
        furniture(x,z,1.27,.62);
        for(const sign of [-1,1]) stool(x+sign*.83,z);
        if(!roofed) {
          const y=2.38,r=.99;
          a.beam(m.plain,[x,.76,z],[x,y+.053,z],.024,.018,granite);
          for(let i=0;i<8;i++) {
            const t=i*Math.PI/4,n=(i+1)*Math.PI/4;
            a.triangle(10,[x,y,z],[x+r*Math.cos(n),y-.26,z+r*Math.sin(n)],[x+r*Math.cos(t),y-.26,z+r*Math.sin(t)],
              rgb(i%2 ? 0x345171 : 0x283a5b));
          }
        }
      }
      threshold(guesthouse ? 2.18 : 1.68,depth+.86,depth-.045);
    }

    function pottery(x,y,z,tint=charcoal) {
      a.oval(m.plaster,[x,y+.078,z],[.112,.079,.114],tint);
      a.beam(m.plaster,[x,y+.129,z],[x,y+.165,z],.068,.078,tint,12);
      a.oval(m.plain,[x,y+.165,z],[.055,.009,.055],charcoal);
    }

    function toilet() {
      partition(0,-front,-.60);
      for(const side of [-1,1]) {
        const x=side*w*.251;
        block(m.wood,side*w*.464,1.14,-.79,.14,2.28,.71,teal);
        box(m.plaster,x,.22,-front+.75,.36,.44,.62,white,{radius:.053,kind:"wall"});
        a.oval(m.plaster,[x,.461,-front+.77],[.230,.089,.284],white);
        a.oval(m.plain,[x,.518,-front+.75],[.149,.026,.203],glass);
        box(m.plaster,x,.61,-front+.37,.449,.37,.203,white,{radius:.035});
        box(m.wood,side*.32,1.73,-.73,.54,.40,.086,teal,soft);
      }
      block(m.plaster,w/2-.30,.77,.71,.56,.22,1.23,cream,{radius:.052});
      for(const z of [.39,.99]) {
        a.oval(m.plaster,[w/2-.29,.878,z],[.172,.047,.201],white);
        a.oval(m.plain,[w/2-.29,.893,z],[.105,.015,.128],glass);
        a.beam(m.plain,[w/2-.13,.89,z],[w/2-.24,1.053,z],.02,.014,granite);
      }
    }

    function vending(x,z,color) {
      block(m.plaster,x,.87,z,.76,1.74,.63,color,{radius:.041});
      box(m.plain,x-.095,1.11,z+.325,.47,.83,.039,glass,{radius:.016});
      for(let i=0;i<3;i++) for(let j=0;j<4;j++) {
        const tone=[rgb(0x596d9c),cream,red,teal][(i+j)%4];
        box(m.plaster,x-.26+j*.113,.83+i*.227,z+.352,.074,.126,.018,tone,soft);
      }
      box(m.plain,x+.239,1.06,z+.325,.105,.50,.046,charcoal);
      a.oval(m.plain,[x+.239,1.18,z+.35],[.026,.024,.012],brass);
      box(m.plain,x-.068,.37,z+.324,.47,.176,.033,charcoal,soft);
    }

    function modernInterior() {
      if(style==="toilet") {toilet();return;}
      if(style==="info") {
        const counter=-w*.25;
        furniture(counter,-front+.90,2.66,.73,.91);
        box(m.wood,counter,.49,-front+1.13,2.63,.80,.14,beam,{kind:"wall"});
        box(m.plaster,counter-.54,.973,-front+1.00,.43,.033,.29,cream,{radius:.014});
        shelves(counter,-front+.26,2.04);
        a.label("화양구곡","운영담 · 읍궁암 · 금사담",[w*.26,1.65,-front+.101],2.27,.81,"green");
        furniture(w*.26,-.29,1.52,.66);
        for(const x of [w*.20,w*.31]) stool(x,.33);
        for(let i=0;i<5;i++) box(m.plaster,w*.20+i*.12,.771,-.33,.10,.018,.24,i%2 ? white : teal);
      } else if(style==="shop") {
        for(const side of [-1,1]) shelves(side*w*.31,-front+.28,1.64);
        shelves(-w*.33,-.54,1.37);
        furniture(w*.30,.42,1.34,.68,.84);
        box(m.plain,w*.35,.95,.40,.31,.19,.23,charcoal,{radius:.038});
        vending(-w*.29,front+.52,rgb(0x3c617c));
        vending(w*.30,front+.52,white);
      } else {
        for(const x of [-w*.29,w*.27]) {
          for(const z of [-.86,1.21]) {
            Valley.utilities.tableSet(interior,a,x,z,false);
          }
        }
        furniture(.52,-front+.47,2.42,.67,.86);
        for(let i=0;i<4;i++) pottery(-.31+i*.51,.91,-front+.47,[charcoal,cream,teal,beam][i]);
        for(const side of [-1,1]) lowChest(side*w*.35,-front+.48,1.22);
      }
    }

    function traditionalInterior() {
      if(style==="temple") {
        const brassTint=rgb(0xa78744);
        const altar=-front+.94,statueZ=altar-.075;
        furniture(0,altar,3.7,.95,.73);
        box(m.wood,0,.245,altar,3.70,.46,.94,red,{radius:.021});
        for(let x=-1.64;x<1.7;x+=.36) {
          box(m.wood,x,.39,altar+.484,.31,.155,.017,beam,{radius:.012});
          a.oval(m.plain,[x,.39,altar+.499],[.038,.033,.012],brassTint);
        }
        for(const x of [-1.42,-.93,.93,1.42]) {
          a.oval(m.plaster,[x,.87,-front+.78],[.094,.112,.099],brassTint);
          a.beam(m.plain,[x,.87,-front+.77],[x,1.12,-front+.77],.022,.019,brassTint,8);
        }
        const gilding=rgb(0xccab5c),fold=rgb(0xa98543),hair=rgb(0x333b38);
        box(m.wood,0,.836,statueZ,.94,.113,.66,beam,{radius:.039});
        a.oval(10,[0,.921,statueZ],[.425,.087,.308],rgb(0x9f4536));
        for(const side of [-1,1]) {
          a.oval(m.gloss,[side*.153,1.029,statueZ+.072],[.261,.106,.229],gilding);
          a.beam(m.gloss,[side*.057,1.085,statueZ+.259],[side*.290,1.059,statueZ+.174],.021,.011,fold,8);
          a.oval(m.gloss,[side*.107,1.664,statueZ+.021],[.027,.067,.034],gilding);
        }
        a.oval(m.gloss,[0,1.249,statueZ-.023],[.224,.284,.137],gilding);
        a.beam(m.gloss,[.164,1.428,statueZ+.022],[.107,1.112,statueZ+.143],.032,.022,fold,9);
        a.beam(m.gloss,[-.164,1.423,statueZ+.031],[-.038,1.121,statueZ+.151],.038,.023,fold,9);
        a.beam(m.gloss,[-.151,1.410,statueZ],[-.269,1.194,statueZ+.129],.076,.058,gilding,12);
        a.beam(m.gloss,[-.269,1.194,statueZ+.129],[-.298,1.405,statueZ+.201],.061,.033,gilding,12);
        a.oval(m.gloss,[-.30,1.468,statueZ+.204],[.038,.082,.025],gilding);
        a.beam(m.gloss,[.163,1.397,statueZ+.011],[.230,1.165,statueZ+.131],.080,.059,gilding,12);
        a.beam(m.gloss,[.230,1.165,statueZ+.131],[.066,1.132,statueZ+.246],.057,.031,gilding,12);
        a.oval(m.gloss,[.027,1.135,statueZ+.244],[.065,.026,.041],gilding);
        a.oval(m.gloss,[0,1.517,statueZ],[.073,.101,.069],gilding);
        a.oval(m.gloss,[0,1.666,statueZ+.025],[.110,.147,.106],gilding);
        a.oval(m.gloss,[0,1.666,statueZ+.123],[.019,.031,.024],gilding);
        a.oval(m.plain,[0,1.774,statueZ+.006],[.113,.073,.106],hair);
        a.oval(m.plain,[0,1.830,statueZ+.001],[.064,.054,.066],hair);
        for(let i=0;i<16;i++) {
          const angle=i*Math.PI/8;
          a.oval(m.plain,[.106*Math.sin(angle),1.778,statueZ+.006+.102*Math.cos(angle)],[.021,.023,.020],hair);
        }
        box(m.wood,0,1.55,-front+.13,2.76,1.44,.059,beam,{radius:.021});
        box(m.paint,0,1.55,-front+.169,2.51,1.25,.028,rgb(0x554842));
        for(const side of [-1,1]) for(let i=0;i<4;i++) {
          const x=side*(.55+i*.16),y=1.37+.17*Math.sin(i*1.6);
          a.oval(m.plain,[x,y,-front+.189],[.17,.073,.012],i%2 ? teal : red);
          a.oval(m.plain,[x,y+.015,-front+.201],[.087,.034,.010],brassTint);
        }
        for(const x of [-1.27,0,1.27]) box(10,x,.015,.31,.78,.028,.54,rgb(0x8f7356),{radius:.018});
        for(const x of [-w*.35,w*.35]) {
          a.beam(m.wood,[x,.01,-.78],[x,h-.17,-.78],.095,.090,red,10);
          lowChest(x,-front+.51,.81);
        }
      } else if(style==="shrine") {
        furniture(0,-front+.81,3.23,.74,.64);
        for(const side of [-1,1]) {
          lowChest(side*w*.33,-front+.54,1.33);
          pottery(side*.55,.687,-front+.73,red);
          box(m.wood,side*.55,1.11,-front+.13,.33,.64,.069,beam,{radius:.022});
          box(m.plain,side*.55,1.12,-front+.172,.113,.405,.020,brass);
        }
        box(m.wood,0,.032,-front+.86,4.00,.058,1.68,wood);
      } else if(style==="exhibit") {
        for(const side of [-1,1]) {
          block(m.wood,side*w*.31,.43,-front+.78,1.17,.81,.86,beam,{radius:.019});
          box(m.plaster,side*w*.31,.867,-front+.78,1.11,.054,.80,cream);
          pottery(side*w*.31,.903,-front+.82,red);
        }
        a.label("화양구곡","운영담 · 읍궁암 · 금사담",[0,1.62,-front+.093],2.44,.76,"green");
      } else {
        lowChest(-w*.33,-front+.59);
        shelves(w*.32,-front+.31,1.12);
        const z=style==="lecture" ? -.19 : -.64;
        furniture(-.34,z,1.70,.67,.32);
        box(m.plaster,-.29,.379,z,.57,.018,.32,cream);
        pottery(-.95,.372,z,teal);
        if(style==="lecture") for(const x of [-w*.31,w*.30]) furniture(x,1.24,.91,.49,.30);
      }
    }

    platform();
    if(style==="gate" || style==="monument") {
      const gap=style==="gate" ? 2.94 : 1.78;
      for(const x of [-w/2+.13,-gap/2,gap/2,w/2-.13]) {
        for(const z of [-front+.17,front-.17]) {
          box(m.rock,x,.105,z,.33,.21,.34,granite,{radius:.026});
          a.beam(m.wood,[x,.19,z],[x,h-.10,z],.127,.105,red,10);
          block(m.wood,x,.84,z,.196,1.69,.194,red);
        }
      }
      if(style==="gate") for(const side of [-1,1]) {
        const width=(w-gap)/2-.12;
        block(m.wood,side*(gap/2+width/2),1.12,front-.12,width,2.24,.147,red);
        for(const u of [.21,.45,.71,.93]) box(m.wood,side*(gap/2+u*width),1.18,front-.022,.052,2.16,.052,beam);
      } else {
        block(m.rock,0,.19,-.37,1.40,.38,.87,granite,{radius:.062});
        block(m.rock,0,.94,-.38,.75,1.28,.25,rgb(0x666961),{radius:.081});
        box(m.rock,0,1.58,-.38,.94,.177,.42,granite,{radius:.067});
        a.label("우암 송시열","유적 안내",[0,.99,-.241],.52,.46,"stone");
        threshold(1.5);
      }
      ceiling(true);roof(h,w+1.1,d+1.4,.88,tileTint,true);
      panel();
      return;
    }

    const door=guesthouse ? 2.12 : style==="shop" || style==="info" ? 1.79 : ["shrine","lecture","temple"].includes(style) ? 1.85 : 1.42;
    shell(door);
    panel();
    if(guesthouse || style==="shelter") veranda(true);
    else if(style==="temple") templeEntry();
    else threshold(door);
    if(b.storeys>1) {
      lodging();
      return;
    }
    ceiling();
    if(style==="temple") roof(h,w+2.76,d+2.32,1.34,tileTint,true);
    else roof(h,w+(traditional ? 1.28 : .79),d+(traditional ? 1.46 : .88),traditional ? 1.13 : .63,tileTint,traditional);
    if(traditional) traditionalInterior();
    else {
      if(service) {
        for(const [left,right] of [[-w/2+.10,0],[0,w/2-.10]]) {
          const x=left<0 ? left+.032 : right-.032, yaw=left<0 ? Math.PI/2 : -Math.PI/2;
          lodgings.roomLight(interior,a,0,[left,right,-front+.105,front-.105],[x,1.25,front-.79],yaw);
        }
      } else {
        light(-w*.24,-d*.18);light(w*.25,d*.15);
      }
      modernInterior();
    }
  }

  Valley.roadBuildings={build};
})();
