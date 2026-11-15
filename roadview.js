"use strict";

(() => {
  const { Builder, mix, rgb, random, plus, minus, times, transform } = Valley;
  const { weir, waterLevel, offset, point, photoPoint, storeyHeight, mapScale } = Valley.roadLayout;
  const material={plain:0,rock:2,fabric:14,wood:13,gloss:15,paving:17,brick:18,plaster:19,tile:20,flow:21,asphalt:22,
    label:23,glass:24,paint:25,laminate:26,wallpaper:27,ceramicTile:28,porcelain:29,emissive:30,tapWater:31,frosted:32,
    cctv:33,lobbyPrint:34,bathFloor:35,diningFloor:36,scorch:37,scorchedBark:38,
    carPaint:39,carMetal:40,carGlass:41,carWood:42,carLeather:43,carTire:44,carLens:45,cardboard:46,steel:47,linen:14};
  const size=12;
  const key=(x,z)=>`${Math.floor(x/size)},${Math.floor(z/size)}`;
  const cream=rgb(0xb2afa0), cutStone=rgb(0x8c8d82);
  const timber=rgb(0x9a8268), post=rgb(0x705743), iron=rgb(0x5a5c56);
  const dark=rgb(0x464944);

  function local(c,x,z) {
    const dx=x-c.x,dz=z-c.z;
    return [c.c*dx-c.s*dz,c.s*dx+c.c*dz];
  }

  function moveBox(box,center,yaw) {
    const [x,y,z]=center,[hx,hy,hz]=box.half;
    return Object.assign(box,{x,z,hx,hz,center,c:Math.cos(yaw),s:Math.sin(yaw),bottom:y-hy,top:y+hy});
  }

  function boxAt(center,size,yaw,kind="wall",hit=kind) {
    return moveBox({half:times(size,.5),kind,hit},center,yaw);
  }

  function build(renderer,layout,env) {
    const {height,bank,boundedMesh,boulder,trees,stoneColliders}=env;
    const rng=random(906143), solid=[], glass=[], cells=new Map(), routeStepBanks=new Map(), signs=Valley.roadSigns.create();
    function collider(x,y,z,dimensions,yaw,kind,hit=kind,margin=0,stair=0,stepBank) {
      const volume=boxAt([x,y,z],dimensions,yaw,kind,hit);
      const {c,s,hx,hz}=volume,rx=Math.abs(c)*hx+Math.abs(s)*hz+margin,rz=Math.abs(s)*hx+Math.abs(c)*hz+margin;
      if(stair) volume.stair=[s*stair,c*stair];
      if(stepBank) volume.stepBank=stepBank;
      for(let iz=Math.floor((z-rz-.24)/size);iz<=Math.floor((z+rz+.24)/size);iz++) {
        for(let ix=Math.floor((x-rx-.24)/size);ix<=Math.floor((x+rx+.24)/size);ix++) {
          const k=`${ix},${iz}`;
          if(!cells.has(k)) cells.set(k,[]);
          cells.get(k).push(volume);
        }
      }
      return volume;
    }
    const interior=Valley.lodging.create(renderer,material,collider);

    function area(x=0,y=0,z=0,yaw=0,site=[x,y,z]) {
      const builders=new Map(), c=Math.cos(yaw),s=Math.sin(yaw);
      const at=([u,v,w])=>[x+c*u+s*w,y+v,z-s*u+c*w];
      function mesh(mat) {
        if(!builders.has(mat)) builders.set(mat,new Builder());
        return builders.get(mat);
      }
      return {
        at,mesh,yaw,site,
        section(origin,turn=0) { return area(...at(origin),yaw+turn,site); },
        blender(name,center,{scale=[1,1,1],turn=0,pitch=0,tint}={}) {
          const matrix=transform(at(center),pitch,yaw+turn);
          for(let axis=0;axis<3;axis++) for(let row=0;row<3;row++) matrix[axis*4+row]*=scale[axis];
          for(const {slot,shape,material:mat} of Valley.blenderAssets.shapes(name,material)) {
            Valley.blenderAssets.append(mesh(mat),shape,matrix,Array.isArray(tint) ? tint : tint?.[slot]);
          }
        },
        body(center,dimensions,kind,hit=kind) { return collider(...at(center),dimensions,yaw,kind,hit); },
        box(mat,center,size,color,{yaw:turn=0,radius=0,kind,hit=mat===material.wood ? "wood" : kind,stair=0,stepBank}={}) {
          const p=at(center);
          mesh(mat).box(p,size,color,radius,yaw+turn ? [0,yaw+turn,0] : null);
          if(kind) collider(...p,size,yaw+turn,kind,hit,0,stair,stepBank);
        },
        beam(mat,a,b,ra,rb,color,sides=8) {mesh(mat).cylinder(at(a),at(b),ra,rb,color,sides);},
        oval(mat,center,radii,color) {mesh(mat).ellipsoid(at(center),radii,color,[0,yaw,0],12,7);},
        quad(mat,points,tint,uv) {mesh(mat).quad(points.map(at),tint,null,uv);},
        triangle(mat,a,b,c,tint) {mesh(mat).triangle(at(a),at(b),at(c),tint);},
        label(text,sub,center,w,h,theme="stone",turn=0,pitch=0) {
          const [px,py,pz]=center;
          const ct=Math.cos(turn),st=Math.sin(turn);
          const p=([u,v])=>[px+ct*u+st*v*Math.sin(pitch),py+v*Math.cos(pitch),pz-st*u+ct*v*Math.sin(pitch)];
          const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
          this.quad(material.label,corners.map(p),[1,1,1],signs.uv(text,sub,w,h,theme));
        },
        done() {
          for(const [mat,shape] of builders) {
            if(shape.indices.length) (mat===material.glass ? glass : solid).push(boundedMesh(renderer,shape,mat));
          }
        }
      };
    }

    function routeMesh(route,mat) {
      routeStepBanks.set(route,mat===material.paving ? "outdoorStone" : mat===material.asphalt ? "asphalt" : "dirtLeaf");
      let distance=0;
      for(let start=route.min;start<route.max;start+=20) {
        const part=area(), end=Math.min(start+20,route.max), steps=Math.ceil((end-start)/.72);
        for(let i=0;i<steps;i++) {
          const a=route.at(mix(start,end,i/steps)),b=route.at(mix(start,end,(i+1)/steps));
          const edge=(q,d,y=0)=>[q.x+q.nx*d,q.y+y,q.z+q.nz*d];
          const v=distance;
          distance+=Math.hypot(b.x-a.x,b.z-a.z);
          const uv=[[-a.half,v],[-b.half,distance],[b.half,distance],[a.half,v]];
          const tint=.96+.045*Math.cos(v*.38)*Math.sin(v*.91);
          part.quad(mat,[edge(a,-a.half),edge(b,-b.half),edge(b,b.half),edge(a,a.half)],
            times(mat===material.asphalt ? rgb(0x929187) : rgb(0xb4a899),tint),uv);
          if(mat===material.paving) for(const side of [-1,1]) {
            const v=a.half*side, w=v+side*.13;
            const a0=edge(a,v,.034),b0=edge(b,v,.034);
            const a1=edge(a,w,.034),b1=edge(b,w,.034);
            part.quad(material.plaster,side<0 ? [a1,b1,b0,a0] : [a0,b0,b1,a1],cream);
            part.quad(material.plaster,side<0 ? [a1,b1,edge(b,w,-.038),edge(a,w,-.038)]
              : [b1,a1,edge(a,w,-.038),edge(b,w,-.038)],cutStone);
          }
        }
        part.done();
      }
    }

    function linkMesh(link) {
      const a=area(link.x,0,link.z,Math.atan2(link.s,link.c));
      const count=Math.ceil(link.len/.76);
      for(let i=0;i<count;i++) {
        const p=i/count,q=(i+1)/count,h=link.half;
        const z0=(p-.5)*link.len,z1=(q-.5)*link.len;
        const y0=mix(link.y0,link.y1,p),y1=mix(link.y0,link.y1,q);
        const mat=link.kind==="asphalt" ? material.asphalt : link.kind==="stone" ? material.paving : material.plaster;
        a.quad(mat,[[-h,y0,z0],[-h,y1,z1],[h,y1,z1],[h,y0,z0]],rgb(0x9e9886),[[-h,z0],[-h,z1],[h,z1],[h,z0]]);
      }
      a.done();
    }

    function bridge({x,z,y,half,yaw,span},lower=false) {
      const a=area(x,y,z,yaw);
      a.box(material.plaster,[0,-.22,0],[span,.44,half*2],rgb(0x8b8c83),{kind:"rock",stepBank:"asphalt"});
      a.box(material.asphalt,[0,-.027,0],[span,.047,half*2-.3],rgb(0xa6a49a));
      for(const side of [-1,1]) {
        const edge=side*(half-.105);
        a.box(material.plaster,[0,.07,edge],[span,.145,.29],cutStone);
        collider(...a.at([0,.52,edge]),[span,.96,.10],yaw,"wall",lower ? "metal" : "wall");
        if(lower) {
          for(const h of [.32,.63,.94]) a.box(material.plain,[0,h,edge],[span,.052,.074],iron,{radius:.013});
          for(let x=-span/2+.42;x<span/2;x+=1.44) {
            a.box(material.plaster,[x,.047,edge],[.19,.092,.21],cream,{radius:.016});
            a.box(material.plain,[x,.52,edge],[.071,.91,.085],rgb(0x787c74),{radius:.014});
          }
        } else {
          a.box(material.plaster,[0,.91,edge],[span,.146,.252],cream,{radius:.028});
          a.box(material.plaster,[0,.21,edge],[span,.155,.244],cutStone);
          for(let x=-span/2+.18;x<span/2;x+=.51) {
            const tint=times([1,1,1],.87+rng()*.16);
            a.blender("bridge_baluster",[x,.539,edge],{scale:[.165,.645,.202],tint});
          }
        }
      }
      for(let x=-span/2+.45;x<span/2;x+=5.2) a.box(material.plain,[x,.002,0],[.017,.005,half*2-.42],rgb(0x5a5b55));
      for(let x=-span/2+1.1;x<span/2;x+=6.2) {
        const p=a.at([x,0,0]),floor=height(p[0],p[2])-.23,pier=y-.44-floor;
        if(pier>.10) a.box(material.plaster,[x,(floor-y-.44)/2,0],[.90,pier,2.49],cutStone,{radius:.068,kind:"wall"});
        a.box(material.plaster,[x,-.53,0],[1.18,.19,3.30],cutStone);
      }
      a.done();
    }

    function fenced(a,p,q,kind=material.wood,tint=post,railHeight=.88) {
      const [x,y,z]=p,[xx,yy,zz]=q;
      const span=Math.hypot(xx-x,zz-z), turn=Math.atan2(xx-x,zz-z);
      for(const h of [.38,railHeight]) {
        a.beam(kind,[x,y+h,z],[xx,yy+h,zz],.042,.041,tint,6);
      }
      a.box(kind,[x,y+railHeight*.54,z],[.109,railHeight+ .19,.109],tint,{radius:.013});
      const at=a.at([(x+xx)*.5,(y+yy)*.5+railHeight*.53,(z+zz)*.5]);
      collider(...at,[.105,railHeight+.15,span],a.yaw+turn,"wall");
    }

    function footFence(route, intervals,side) {
      for(const [lo,hi] of intervals) {
        for(let start=lo;start<hi;start+=19) {
          const a=area(),end=Math.min(start+19,hi),q0=route.at(start),q1=route.at(end);
          const count=Math.ceil(Math.hypot(q1.x-q0.x,q1.z-q0.z)/1.57);
          for(let i=0;i<count;i++) {
            const points=[route.at(mix(start,end,i/count)),route.at(mix(start,end,(i+1)/count))];
            fenced(a,...points.map(q=>{
              const p=offset(q,side*(q.half+.61));
              return [p.x,height(p.x,p.z)+.025,p.z];
            }));
          }
          a.done();
        }
      }
    }

    function stairs(a,x0,z0,x1,z1,w,y0,y1,mat=material.rock,stepBank=mat===material.rock ? "outdoorStone" : undefined) {
      const len=Math.hypot(x1-x0,z1-z0), turn=Math.atan2(x1-x0,z1-z0);
      const n=Math.ceil(Math.abs(y1-y0)/.162), dx=(x1-x0)/n,dz=(z1-z0)/n;
      for(let i=0;i<n;i++) {
        const y=mix(y0,y1,(i+1)/n);
        const center=[x0+dx*(i+.5),y-.105,z0+dz*(i+.5)];
        a.box(mat,center,[w,.21,len/n+.026],times(cream,.81+rng()*.22),
          {yaw:turn,radius:.019,kind:mat===material.wood ? "wood" : "rock",stair:Math.sign(y1-y0),stepBank});
      }
    }

    function lookDeck(z,length,name) {
      const q=layout.main.at(z),y=q.y-.05,wide=2.46,p=offset(q,q.half+wide*.5-.04);
      const a=area(p.x,y,p.z,Math.atan2(-q.nz,q.nx));
      for(let i=0;i<Math.ceil(length/.215);i++) {
        const zz=-length/2+.108+i*.215;
        a.box(material.wood,[0,-.04,zz],[wide,.08,.203],times(timber,.82+rng()*.23),{radius:.008});
      }
      a.box(material.wood,[0,-.058,0],[wide,.115,length],timber,{kind:"wood",stepBank:"outdoorWood"});
      const x=wide/2-.068;
      for(let zz=-length/2+.08;zz<length/2-.15;zz+=1.51) {
        const zz1=Math.min(zz+1.51,length/2-.08);
        fenced(a,[x,0,zz],[x,0,zz1],material.plain,dark,1.01);
        const p=a.at([x-.21,0,zz]),base=height(p[0],p[2]);
        if(base<y) a.box(material.wood,[x-.21,(base-y)/2,zz],[.14,y-base,.15],post);
      }
      for(const dz of [-length/2+.055,length/2-.055]) {
        a.box(material.wood,[.1,.46,dz],[1.9,.11,.115],timber);
        a.box(material.plain,[.81,.5,dz],[.12,1.04,.12],iron);
      }
      a.box(material.wood,[.15,.40,-length*.22],[.42,.09,1.67],timber,{kind:"wall"});
      for(const dz of [-.62,.62]) a.box(material.plain,[.15,.20,-length*.22+dz],[.045,.40,.072],iron);
      for(const dz of [-.67,.67]) a.box(material.plain,[x-.032,1.04,dz],[.047,.51,.048],iron);
      a.box(material.paint,[x-.041,1.27,0],[.053,.54,1.69],rgb(0x617267),{radius:.009});
      a.label(name,"계곡 전망대",[x-.070,1.27,0],1.64,.50,"green",-Math.PI/2);
      a.done();
    }

    function retainingWall(a,x0,z0,x1,z1,y,h,tiles=false) {
      const len=Math.hypot(x1-x0,z1-z0), turn=Math.atan2(x1-x0,z1-z0);
      const cx=(x0+x1)*.5,cz=(z0+z1)*.5;
      a.box(material.rock,[cx,y+h/2,cz],[.38,h,len],rgb(0xbcb3a0),{yaw:turn,kind:"wall"});
      const rows=Math.ceil(h/.24);
      for(let row=0;row<rows;row++) {
        for(let t=.10+(row%2)*.16;t<len-.08;) {
          const w=Math.min(len-t,mix(.26,.65,rng()));
          const shift=(t+w/2)/len;
          a.box(material.rock,[mix(x0,x1,shift),y+(row+.5)*h/rows,mix(z0,z1,shift)],
            [.435+(rng()-.5)*.054,h/rows-.023,w-.028],times(cream,.77+rng()*.35),{yaw:turn,radius:.035});
          t+=w;
        }
      }
      const top=y+h+.066,mat=tiles ? material.tile : material.plaster;
      a.box(mat,[cx,top,cz],[.59,.14,len+.18],tiles ? rgb(0x4d5151) : cutStone,{yaw:turn,radius:.027});
      if(tiles) for(let t=0;t<len;t+=.27) {
        const ux=(x1-x0)/len,uz=(z1-z0)/len,xx=x0+ux*t,zz=z0+uz*t;
        a.beam(mat,[xx-uz*.29,top+.08,zz+ux*.29],[xx+uz*.29,top+.08,zz-ux*.29],.047,.047,rgb(0x5c6060),6);
      }
    }

    function compound() {
      const {x,z,y,yaw,depth,at}=layout.heritage,a=area(x,y,z,yaw),u=t=>t*depth;
      stairs(a,u(-4.52),0,u(-6.98),0,6.18,0,.56);
      stairs(a,u(-19.25),0,u(-30.7),0,6.14,.54,3.50);
      for(const side of [-1,1]) {
        retainingWall(a,u(-7.9),side*3.5,u(-7.9),side*14.15,.20,.92,true);
        retainingWall(a,u(-7.9),side*14.15,u(-23.7),side*14.15,.40,1.04,true);
        retainingWall(a,u(-23.7),side*14.15,u(-23.7),side*7.8,.45,.87,true);
        retainingWall(a,u(-29.95),side*3.40,u(-29.95),side*8.65,1.19,1.91,true);
        retainingWall(a,u(-29.95),side*8.65,u(-37.8),side*8.65,2.89,.89,true);
        retainingWall(a,u(-38.4),0,u(-38.4),side*8.65,3.12,.70,true);
        for(let i=0;i<9;i++) {
          const t=i/9,n=(i+1)/9;
          fenced(a,[u(-19.3-11.4*t),.54+2.96*t,side*3.10],[u(-19.3-11.4*n),.54+2.96*n,side*3.10],material.wood,post,.85);
        }
      }
      // Stone borders and a grass courtyard, clear paths between the side rooms.
      for(const side of [-1,1]) {
        a.box(material.rock,[u(-16.4),.56,side*3.85],[u(7.2),.07,.35],cream,{radius:.017});
        for(let i=0;i<7;i++) {
          const x=u(-9.2-i*1.46),zz=side*(1.53+(i%3)*.17);
          a.box(material.rock,[x,.55,zz],[.71,.063,.72],times(cream,.88+rng()*.15),{yaw:(rng()-.5)*.19,radius:.029});
        }
      }
      a.done();
      for(const [dx,dz,h] of [[-5.2,-11.5,6.9],[-5.4,11.9,7.5],[-17.3,-6.4,4.8],[-28.4,-7.1,5.6],[-37.6,6.8,6.2]]) {
        const p=at(dx,dz);
        trees(p.x,p.z,h,rng);
      }
    }

    function roadside() {
      for(let z=-72;z<181;z+=14.6) {
        const q=layout.main.at(z),p=offset(q,-q.half-.47),a=area(p.x,height(p.x,p.z),p.z,Math.atan2(-q.nz,q.nx));
        a.beam(material.plain,[0,-.03,0],[.075,3.56,.04],.066,.043,iron);
        a.beam(material.plain,[.075,3.56,.04],[.77,3.62,.04],.027,.026,iron);
        a.box(material.plain,[.76,3.55,.04],[.35,.116,.18],dark,{radius:.045});
        a.box(material.plaster,[.76,3.484,.04],[.23,.022,.131],rgb(0xd0c6a4));
        a.box(material.plaster,[0,.14,0],[.19,.29,.20],cutStone,{kind:"wall"});
        a.done();
      }
      for(const z of [-47,-20,35,59,117,144,171]) {
        const q=layout.main.at(z),p=offset(q,q.half+.52),a=area(p.x,height(p.x,p.z),p.z,Math.atan2(-q.nz,q.nx));
        a.box(material.wood,[0,.44,0],[.45,.092,1.69],timber,{radius:.012,kind:"wall"});
        a.box(material.wood,[.20,.72,0],[.067,.28,1.69],post);
        for(const dz of [-.63,.63]) a.box(material.plain,[0,.22,dz],[.27,.44,.084],iron);
        a.done();
      }
      for(const [z0,z1] of [[-149,-86],[-74,-49],[31,76],[120,161]]) {
        let last=null;
        for(let z=z0;z<=z1;z+=16.5) {
          const route=z<-81 ? layout.approach : layout.main;
          const q=route.at(z),{x,z:worldZ}=offset(q,(route===layout.approach ? 1 : -1)*(q.half+1.12)),a=area();
          const y=height(x,worldZ),top=[x,y+6.35,worldZ];
          a.beam(material.plaster,[x,y-.19,worldZ],top,.13,.080,cutStone,10);
          a.box(material.wood,[x,y+6.14,worldZ],[.99,.074,.082],timber);
          for(const dx of [-.39,.39]) a.oval(material.tile,[x+dx,y+6.21,worldZ],[.045,.056,.045],cream);
          if(last) {
            for(const dx of [-.39,.39]) {
              let p=[last[0]+dx,last[1]-.14,last[2]];
              for(let i=1;i<=7;i++) {
                const t=i/7,q=[mix(last[0],x,t)+dx,mix(last[1],top[1],t)-.14-.56*Math.sin(Math.PI*t),mix(last[2],worldZ,t)];
                a.beam(material.plain,p,q,.011,.011,dark,4);
                p=q;
              }
            }
          }
          last=top;
          a.done();
        }
      }
    }

    function construction() {
      const amber=rgb(0xc58139),paint=rgb(0xc3bcaa),mesh=rgb(0x717773);
      for(const {q,wide,side} of layout.barriers) {
        const yaw=Math.atan2(-q.nz,q.nx);
        const a=area(q.x,q.y-.033,q.z,yaw);
        collider(...a.at([0,.82,0]),[wide*2,1.62,.085],yaw,"wall");
        for(let x=-wide+.16;x<wide;x+=.22) a.beam(material.plain,[x,.22,0],[x,1.54,0],.013,.013,mesh,4);
        a.beam(material.plain,[-wide,.28,0],[wide,.28,0],.032,.032,iron);
        a.beam(material.plain,[-wide,1.54,0],[wide,1.54,0],.032,.032,iron);
        // Pale and amber panels stand on concrete feet across the full width of the road.
        for(let x=-wide+.30;x<wide;x+=.49) {
          for(const y of [.50,1.12]) {
            a.box(material.plaster,[x,y,-.057],[.478,.206,.054],Math.round((x+wide)/.49)%2 ? amber : paint,{radius:.009});
            a.box(material.plaster,[x,y,.057],[.478,.206,.054],Math.round((x+wide)/.49)%2 ? amber : paint,{radius:.009});
          }
        }
        for(const x of [-wide+.13,0,wide-.13]) {
          a.box(material.rock,[x,.10,0],[.39,.20,.84],cutStone,{radius:.052});
          a.beam(material.plain,[x,.12,0],[x,1.71,0],.057,.053,iron);
          a.oval(material.plaster,[x,1.727,0],[.059,.045,.059],amber);
        }
        for(const x of [-1.94,1.95]) {
          a.box(material.plain,[x,.027,-side*1.3],[.33,.054,.33],dark,{radius:.017});
          a.beam(material.plaster,[x,.035,-side*1.3],[x,.43,-side*1.3],.135,.036,amber,13);
          a.beam(material.plaster,[x,.193,-side*1.3],[x,.254,-side*1.3],.093,.080,paint,13);
        }
        const facing=-side;
        a.box(material.paint,[0,1.22,facing*.102],[1.13,.48,.052],cream,{radius:.008});
        a.label("공사중","통행금지",[0,1.22,facing*.131],1.09,.44,"warning",facing<0 ? Math.PI : 0);
        a.done();
      }
    }

    function waterfall() {
      const a=area(), {toe,crest,lower,left,right}=weir, segments=57;
      const yaw=Math.atan2(-weir.skew,1),span=(right-left)*Math.hypot(1,weir.skew);
      const at=(x,z)=>z+(x-weir.x)*weir.skew;
      const row=(t,z,h)=>{
        const x=mix(left,right,t);
        return [x,h,at(x,z)];
      };
      for(let i=0;i<segments;i++) {
        const u=i/segments,v=(i+1)/segments;
        const jagged=t=>.025*Math.sin(t*29)+.018*Math.cos(t*64);
        const base=lower+.015;
        for(let k=0;k<7;k++) {
          const t=k/7,n=(k+1)/7,zz=mix(crest+.13,toe-.23,t),z1=mix(crest+.13,toe-.23,n);
          const high=waterLevel(weir.x,zz)+.04,low=waterLevel(weir.x,z1)+.04;
          a.quad(material.flow,[row(u,z1,low+jagged(u)),row(v,z1,low+jagged(v)),row(v,zz,high+jagged(v)),row(u,zz,high+jagged(u))],
            [1,1,1],[[mix(left,right,u),n],[mix(left,right,v),n],[mix(left,right,v),t],[mix(left,right,u),t]]);
        }
        const start=toe-.08,end=toe-1.52-.38*Math.sin(u*22);
        a.quad(material.flow,[row(u,end,base),row(v,end,base),row(v,start,base+.032),row(u,start,base+.032)],
          [.86,.90,.86],[[mix(left,right,u),1.85],[mix(left,right,v),1.85],[mix(left,right,v),1.08],[mix(left,right,u),1.08]]);
      }
      a.box(material.plaster,[weir.x,-.116,crest+.16],[span,.21,.43],cutStone,{yaw,radius:.038});
      a.box(material.plaster,[weir.x,lower-.26,toe-.1],[span,.49,.62],cutStone,{yaw,radius:.029,kind:"rock",stepBank:"outdoorStone"});
      for(const side of [-1,1]) {
        const x=(side<0 ? left : right)+side*.33;
        a.box(material.rock,[x,-.39,at(x,(toe+crest)/2)],[1.10,2.20,3.82],cream,{yaw,radius:.18,kind:"wall"});
        for(let i=0;i<4;i++) {
          const z=at(x,toe-1.5+i*.82);
          a.box(material.plaster,[x+side*.65,waterLevel(x,z)-.31,z],[1.35,.64,.83],cutStone,{yaw,radius:.068,kind:"rock",stepBank:"outdoorStone"});
        }
      }
      a.done();
    }

    function rockGardens() {
      const faces=area();
      const group=faces.mesh(material.rock);
      function shelf(site,rx,rz) {
        const radius=Math.max(rx,rz)*1.15;
        const foot=layout.foot.closest(site.x,site.z);
        if(foot && foot.distance<layout.foot.half+radius+.46) {
          site=offset(layout.foot.at(foot.t),Math.sign(foot.side||1)*(layout.foot.half+radius+.62));
        }
        return layout.clear(site.x,site.z,radius) ? null : site;
      }
      // Pale, flat shelves interrupt the green channel around the fourth bend.
      for(const [u,v,rx,ry,rz] of [
        [304,440,3.6,.61,4.1],[346,447,4.65,1.04,5.4],[366,435,2.7,.82,3.8],
        [785,209,3.40,.66,4.3],[850,221,2.85,1.12,3.5],[899,237,3.70,.82,4.6],
        [941,269,5.45,.91,3.47],[981,311,4.20,.81,3.9],[1008,337,3.48,.70,2.7],
        [1061,374,4.48,.91,3.8],[1094,407,5.35,.84,4.7],[1134,433,3.35,1.38,4.1],
        [1149,448,4.90,1.12,4.55],[1152,500,3.8,.65,4.52],[1179,514,3.74,1.03,4.52],
        [1205,531,3.6,.82,3.6],[1219,566,4.35,.66,4.3],[1225,625,3.51,.75,4.83]
      ]) {
        const site=shelf(point(u,v),rx,rz);
        if(!site) continue;
        const {x,z}=site,y=height(x,z)+ry*.45;
        boulder(group,rng,[x,y,z],[rx,ry,rz],rng()*.9,rgb(0xd3cbbd),.12,stoneColliders);
        boulder(group,rng,[x+rx*.14,y+ry*.86,z+.29],[rx*.71,ry*.33,rz*.69],rng()*.6,rgb(0xd5d3c8),.14,stoneColliders);
      }
      for(let i=0;i<57;i++) {
        const q=layout.main.at(mix(170,277,(i+rng())/57));
        const {x,z}=offset(q,-q.half-mix(2.35,13.4,rng())), base=height(x,z);
        const h=mix(.29,.91,rng()), wide=mix(.52,1.68,rng());
        if(layout.clear(x,z,wide+.15)) continue;
        boulder(group,rng,[x,base+h*.24,z],[wide,h,wide*mix(.68,1.09,rng())],rng()*Math.PI,
          rgb(i%3 ? 0xa39d8c : 0xc6b9a8),.12,stoneColliders);
      }
      for(const [u,v,rx,ry,rz] of [
        [1309,494,3.5,.83,4.0],[1329,512,4.9,1.2,3.6],[1337,545,5.2,.98,4.6],
        [1348,570,5.4,.86,6.4],[1349,606,4.6,.91,4.4],[1383,617,6.2,1.05,4.0],
        [1371,654,5.3,.63,5.4],[1408,667,5.7,1.12,4.6],[1407,699,6.8,1.04,5.1],
        [1431,721,5.2,.74,4.8],[1457,766,4.8,.85,6.2],[1483,791,5.8,.66,5.0]
      ]) {
        const site=shelf(photoPoint(u,v),rx,rz);
        if(!site) continue;
        const {x,z}=site;
        const y=height(x,z);
        boulder(group,rng,[x,y+ry*.41,z],[rx,ry,rz],rng()*.5,rgb(0xcfc7b4),.09,stoneColliders);
        boulder(group,rng,[x-.48,y+ry*1.11,z+.36],[rx*.67,ry*.42,rz*.76],rng()*.6,rgb(0xd3cbb7),.09,stoneColliders);
      }
      const study=layout.sites.amseo;
      for(let i=0;i<6;i++) {
        const z=study.z+(i-2.5)*1.44,x=study.x-2.7+.19*Math.sin(i*1.7);
        boulder(group,rng,[x,height(x,z)-.43,z],[.85,.41,1.10],rng()*.41,rgb(0xbcb4a5),.16);
      }
      for(let i=0;i<410;i++) {
        const z=mix(-152*mapScale,544,rng()),side=rng()<.46 ? -1 : 1,x=bank(z,side)+side*mix(-4.5,1.55,rng());
        const h=mix(.12,.58,rng()**1.6);
        if(layout.clear(x,z,.36)) continue;
        const y=height(x,z);
        boulder(group,rng,[x,y+h*.27,z],[h*mix(1.2,2.6,rng()),h,h*mix(1.1,2.5,rng())],
          rng()*6.28,times(cream,.93+rng()*.27),.09,h>.39 ? stoneColliders : null);
      }
      const slopeRandom=random(14603);
      for(const site of [layout.sites.pension,layout.sites.diner,layout.sites.shrine,layout.sites.deckInn,layout.sites.pavilion,layout.temple]) {
        for(let i=0;i<17;i++) {
          const a=slopeRandom()*Math.PI*2,d=mix(9,23,slopeRandom());
          const x=site.x+Math.cos(a)*d,z=site.z+Math.sin(a)*d;
          const h=mix(.16,.47,slopeRandom()),w=h*mix(1.4,2.3,slopeRandom());
          if((x>bank(z,-1)-.8 && x<bank(z,1)+.8) || layout.clear(x,z,w+.26)) continue;
          boulder(group,slopeRandom,[x,height(x,z)+h*.29,z],[w,h,w*.78],a,
            times(cream,mix(.79,1.05,slopeRandom())),.09,h>.39 ? stoneColliders : null);
        }
      }
      faces.done();
      for(let i=0;i<166;i++) {
        const q=layout.main.at(mix(-71,288,i/165)),side=i%3===0 ? -1 : 1;
        const {x,z}=offset(q,side*(q.half+mix(1.15,4.28,rng())));
        if(layout.clear(x,z,.43) || height(x,z)<.25) continue;
        trees(x,z,mix(3.8,8.3,rng()),rng);
      }
    }

    function templeCourt() {
      const {x,y,z}=layout.temple,a=area(x,y,z,1.21);
      const fenceTint=rgb(0x978976);
      retainingWall(a,-8.5,-8.1,-8.5,-5.2,-.14,.66,true);
      retainingWall(a,-8.5,-1.54,-8.5,.75,-.14,.66,true);
      retainingWall(a,8.5,-4.68,8.5,-1.34,-.14,.66,true);
      retainingWall(a,8.5,1.70,8.5,3.57,-.14,.66,true);
      for(const z of [-1.34,1.70]) a.box(material.rock,[8.5,.32,z],[.47,.91,.45],fenceTint,{radius:.057});
      for(const side of [-1,1]) {
        a.box(material.rock,[side*4.9,.085,-.92],[1.31,.17,.66],cutStone,{radius:.027});
        a.oval(material.rock,[side*4.9,.42,-.92],[.34,.42,.33],fenceTint);
        a.box(material.tile,[side*4.9,.78,-.92],[.73,.08,.65],dark,{radius:.035});
      }
      for(let i=0;i<9;i++) {
        const x=(rng()-.5)*2.5,z=-6.6+i*.81;
        a.box(material.rock,[x,.025,z],[.66+rng()*.26,.057,.58+rng()*.19],times(cutStone,.94+rng()*.23),{radius:.036,yaw:(rng()-.5)*.23});
      }
      a.done();
      for(const [u,v,h] of [[-16,18,6.4],[-9,20,8.1],[-4,24,7.2],[2,19,7.7],[9,22,7.2],
        [14.2,19,7.5],[18.6,14,6.8],[22.1,11,7.6],[-19,9,6.2],[-17,14,8.0],[-14.8,-8.2,6.3]]) {
        const [tx,,tz]=a.at([u,0,v]);
        if(!layout.clear(tx,tz,.26)) trees(tx,tz,h,rng);
      }
    }

    function parking() {
      const {x,z,c,s,hx,hz}=layout.parking, a=area();
      const corner=(u,v,lift=.019)=>{
        const px=x+c*u+s*v,pz=z-s*u+c*v;
        return [px,height(px,pz)+lift,pz];
      };
      for(let j=0;j<16;j++) for(let i=0;i<14;i++) {
        const u=mix(-hx,hx,i/14),v=mix(-hz,hz,j/16),u1=u+hx/7,v1=v+hz/8;
        a.quad(material.asphalt,[corner(u,v),corner(u,v1),corner(u1,v1),corner(u1,v)],rgb(0x7e7b73));
      }
      for(const lane of [-3.18,0,3.18]) for(let i=0;i<12;i++) {
        const u=-2.60+i*.42,end=u+.42;
        a.quad(material.paint,[corner(u,lane-.044,.028),corner(u,lane+.044,.028),
          corner(end,lane+.044,.028),corner(end,lane-.044,.028)],times(cream,.78+.15*rng()));
      }
      a.done();
    }

    routeMesh(layout.main,material.paving);
    routeMesh(layout.approach,material.asphalt);
    routeMesh(layout.foot,material.paving);
    routeMesh(layout.drive,material.asphalt);
    routeMesh(layout.beyond,material.paving);
    routeMesh(layout.templeRoad,material.asphalt);
    routeMesh(layout.crossTrail,material.plaster);
    for(const link of layout.links) if(link.kind!=="foundation" && link.kind!=="ford") linkMesh(link);
    bridge(layout.bridge);
    bridge(layout.lowerBridge,true);
    waterfall();
    rockGardens();
    footFence(layout.main,[[-70,-62],[-59,-45],[-29,-14],[28,35],[43,65],[69,78],[84,115],[123,143],[151,155.8],[162,164.6],
      [171,222],[223,249],[253,273],[276,286]],1);
    footFence(layout.foot,[[136,145],[155,162],[211,246],[252,266]],-1);
    lookDeck(-37,11.0,"운영담");
    lookDeck(118,7.6,"화양구곡");
    lookDeck(159,7.8,"금사담");
    roadside();
    construction();
    parking();
    compound();
    templeCourt();
    const services=[];
    for(const b of layout.buildings) {
      const a=area(b.x,b.y,b.z,b.yaw);
      const first={items:interior.items.length,monitors:interior.monitors.length,zones:interior.zones.length};
      const service=Valley.utilities.build(interior,a,b,height);
      Valley.roadBuildings.build(a,b,{material,rng,stairs,height,interior,service});
      if(service) {
        Valley.utilities.bind(service,interior,a,first,{cells});
        services.push(service);
      }
      a.done();
    }
    Valley.vehicles.build(interior,layout.parkedCars,signs,height);
    const practice=Valley.practice.build(renderer,{area,material,boundedMesh,boulder,stoneColliders,trees,stairs});
    solid.push(practice.landscape);
    renderer.roadLabels=signs.texture(renderer);
    return {solid,glass,cells,layout,practice,interior,services,routeStepBanks};
  }

  function walkable(road,x,z,feet,rise,clearance) {
    for(const c of road.cells.get(key(x,z))||[]) {
      if(c.fixture?.broken || c.noWalk) continue;
      if(c.top<feet+.022 || c.bottom>feet+clearance+.12) continue;
      if(c.kind!=="wall" && c.top<=feet+rise+.021) continue;
      const [u,v]=local(c,x,z);
      const r=c.kind==="wall" ? .19 : .07;
      if(Math.abs(u)<c.hx+r && Math.abs(v)<c.hz+r) return false;
    }
    return true;
  }

  function floor(road,x,z,reach=Infinity) {
    let top=-Infinity, support=null;
    for(const c of road.cells.get(key(x,z))||[]) {
      if(c.fixture?.broken || c.noWalk || c.kind==="wall" || c.top>reach || c.top<top) continue;
      const [u,v]=local(c,x,z);
      if(Math.abs(u)<=c.hx+.01 && Math.abs(v)<=c.hz+.01) {
        top=c.top;
        support=c;
      }
    }
    return {top,kind:support?.kind??null,stair:support?.stair,stepBank:support?.stepBank};
  }

  function boxesNear(road,x,z,reach) {
    const nearby=new Set();
    for(let iz=Math.floor((z-reach)/size);iz<=Math.floor((z+reach)/size);iz++) {
      for(let ix=Math.floor((x-reach)/size);ix<=Math.floor((x+reach)/size);ix++) {
        for(const box of road.cells.get(`${ix},${iz}`)||[]) {
          if(!box.fixture?.broken && !box.noWalk) nearby.add(box);
        }
      }
    }
    return nearby;
  }

  function hitBox(c,from,delta,limit=1,padding=0) {
    const [u,v]=local(c,from[0],from[2]),start=[u,from[1]-c.center[1],v];
    const move=[c.c*delta[0]-c.s*delta[2],delta[1],c.s*delta[0]+c.c*delta[2]];
    let enter=-Infinity,leave=limit,axis=0,side=0;
    for(let i=0;i<3;i++) {
      const half=c.half[i]+padding;
      if(Math.abs(move[i])<1e-7) {
        if(Math.abs(start[i])>half) return null;
        continue;
      }
      const near=(-half-start[i])/move[i],far=(half-start[i])/move[i];
      const n=Math.min(near,far);
      if(n>enter) {enter=n;axis=i;side=near<far ? -1 : 1;}
      leave=Math.min(leave,Math.max(near,far));
    }
    if(enter<0 || enter>leave || enter>limit) return null;
    const normal=axis===0 ? [side*c.c,0,-side*c.s] : axis===1 ? [0,side,0] : [side*c.s,0,side*c.c];
    return {fraction:enter,at:plus(from,times(delta,enter)),normal};
  }

  function trace(road,from,to,limit=1) {
    const [x,,z]=from, minX=Math.floor(Math.min(x,to[0])/size),maxX=Math.floor(Math.max(x,to[0])/size);
    const minZ=Math.floor(Math.min(z,to[2])/size),maxZ=Math.floor(Math.max(z,to[2])/size);
    const checked=new Set(),delta=minus(to,from);
    let best=null;
    for(let iz=minZ;iz<=maxZ;iz++) for(let ix=minX;ix<=maxX;ix++) {
      for(const c of road.cells.get(`${ix},${iz}`)||[]) {
        if(checked.has(c) || c.fixture?.broken || c.noTrace) continue;
        checked.add(c);
        const hit=c.trace ? c.trace(from,delta,limit) : hitBox(c,from,delta,limit);
        if(!hit) continue;
        limit=hit.fraction;
        best={...hit,type:c.hit==="wall" ? "rock" : c.hit,fixture:c.fixture};
      }
    }
    return best;
  }

  function placeName(road,x,z,feet) {
    for(const b of road.layout.buildings) {
      if(Math.abs(x-b.x)>b.w+b.d || Math.abs(z-b.z)>b.w+b.d) continue;
      const [u,v]=local(b,x,z);
      const level=Math.round((feet-b.y)/storeyHeight);
      if(level>=0 && level<b.storeys && Math.abs(u)<b.w/2-.12 && Math.abs(v)<b.d/2-.12
        && Math.abs(feet-b.y-level*storeyHeight)<.46) return b.name+(b.storeys>1 ? ` ${level+1}F` : "");
    }
    if(Valley.practice.contains(x,z)) return "TARGET RANGE";
    const {main,bridge,lowerBridge,approach,foot,beyond,templeRoad,crossTrail}=road.layout;
    for(const span of [bridge,lowerBridge]) {
      const [u,v]=local(span,x,z);
      if(Math.abs(u)<span.span/2 && Math.abs(v)<span.half && feet>=span.y-.08) return span.name;
    }
    for(const [cx,cz,rx,rz,label] of road.layout.zones) {
      if(Math.abs(x-cx)<rx && Math.abs(z-cz)<rz) return label;
    }
    for(const [route,name] of [[main,"HWAYANGDONG ROAD"],[approach,"BRIDGE APPROACH"],[foot,"AMSEOJAE TRAIL"],
      [beyond,"SOUTH CROSSING"],[templeRoad,"CHAEUNAM ROAD"],[crossTrail,"FOREST TRAIL"]]) {
      if((route.closest(x,z)?.distance??Infinity)<route.half+.3) return name;
    }
    return "";
  }

  Valley.roadview={build,walkable,floor,trace,placeName,boxAt,moveBox,hitBox,local,boxesNear};
})();
