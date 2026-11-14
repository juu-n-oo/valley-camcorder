"use strict";

(() => {
  const { clamp, mix, smooth, plus, minus, times, dot, cross, unit, rgb, random, transform, point, direction, Builder, waterRipples, cutoutLayout } = Valley;
  const rng = random(82318);
  const weights = {tube:.82,chair:2.35,table:5.9,cup:.16,box:.47,flask:.71,launcher:1.16,rifle:2.10,spiral:2.45,
    desk:7.1,crt:4.3,phone:.62,bell:.22,pamphlet:.055,document:.029,ledger:.31,key:.047,plate:.19,
    cushion:.46,bowl:.20,tumbler:.15,jar:.29,pitcher:.53,tray:.34,pot:.59,utensils:.09,ashtray:.092,lighter:.044};
  const paperItems = new Set(["pamphlet","document","ledger"]);
  const kitchenMetal = new Set(["tray","pot","utensils","ashtray","lighter"]);
  const tableItems = new Set(["cup","box","flask","crt","phone","bell","key","plate","bowl","tumbler","jar","pitcher",
    ...kitchenMetal,...paperItems]);
  const handheld = new Set([...tableItems,"launcher","rifle","spiral"]);
  const launcherRest = {launcher:.088,rifle:.104,spiral:.117};
  const launcherRoll = {launcher:1.49,rifle:1.49,spiral:Math.PI*.5};
  const damageReach=1.28, damageRange=4.6*damageReach, tableStrength=2.38;
  const structures = {
    chair:{reach:.39,flex:.245,maxShift:.32,collapse:.98},
    table:{reach:.43,flex:.250,maxShift:.39},
    umbrella:{reach:.38,flex:.420,maxShift:.57,collapse:.88},
    tent:{reach:.48,flex:.139,maxShift:.49}
  };
  const tearProfiles=[
    [[-1,.03],[-.77,-.17],[-.49,-.09],[-.18,-.44],[.10,-.22],[.43,-.48],[1,-.24],
      [.79,.06],[.34,.11],[.08,.36],[-.41,.20],[-.75,.14]],
    [[-.98,-.23],[-.66,-.61],[-.35,-.40],[-.13,-.30],[.21,-.71],[.46,-.33],[.98,-.16],
      [.60,.17],[.72,.62],[.18,.40],[-.27,.68],[-.56,.22]],
    [[-.93,-.02],[-.65,-.60],[-.38,-.34],[-.13,-.88],[.23,-.59],[.57,-.73],[.95,-.23],
      [.56,.14],[.71,.61],[.28,.81],[-.17,.49],[-.58,.69]],
    [[-.98,-.27],[-.56,-.53],[-.31,-.42],[.01,-.70],[.38,-.45],[.59,-.33],[.97,.08],
      [.69,.24],[.28,.54],[.04,.83],[-.25,.38],[-.75,.20]]
  ];
  const {bounds:limits,within:valid}=Valley.roadLayout;
  const boundsAt=(x,z)=>Valley.practice.inScene(x,z) ? Valley.practice.bounds : limits;
  const center = p => [p.x,p.y,p.z];
  const limpTube = prop => prop.kind==="tube" && prop.air<.34;
  const canSit = prop => (prop.kind==="chair" || prop.kind==="cushion") && !prop.tipped;

  function clothAtlas(shape) {
    const charts=shape.clothCharts;
    if(!charts?.length) return null;
    const tile=192, columns=Math.ceil(Math.sqrt(charts.length));
    const width=columns*tile, height=Math.ceil(charts.length/columns)*tile;
    const uv=new Float32Array(shape.vertices.length/11*2).fill(-1);
    // Each panel has its own damage coordinates, independent of the fabric texture.
    for(const [chart,{start,width:nx,height:ny}] of charts.entries()) {
      const x=(chart%columns)*tile+2.5, y=Math.floor(chart/columns)*tile+2.5;
      for(let row=0;row<=ny;row++) for(let column=0;column<=nx;column++) {
        const i=2*(start+row*(nx+1)+column);
        uv[i]=(x+(tile-5)*column/nx)/width;
        uv[i+1]=(y+(tile-5)*row/ny)/height;
      }
    }
    return {width,height,uv};
  }

  function compile(renderer, model) {
    return model.map(({shape,material,name,group})=>{
      const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<shape.vertices.length;i+=11) {
        for(let j=0;j<3;j++) {
          min[j]=Math.min(min[j],shape.vertices[i+j]);
          max[j]=Math.max(max[j],shape.vertices[i+j]);
        }
      }
      const cloth=clothAtlas(shape);
      return {mesh:renderer.mesh(shape,material,undefined,cloth?.uv),material,name,group,min,max,cloth,
        vertices:new Float32Array(shape.vertices),indices:new Uint32Array(shape.indices)};
    });
  }

  function make(parts,kind,x,y,z,yaw,rx,rz,height,phase=0) {
    return {parts,kind,x,y,z,yaw,rx,rz,height,phase,mass:weights[kind]??0,small:handheld.has(kind),air:1,leaking:false,
      vx:0,vz:0,spin:0,tilt:0,tipped:false,tipX:0,tipZ:1,picked:false,occupied:false,
      support:null,flight:null,restRoll:0,
      matrix:transform([x,y,z],0,yaw),damage:new Map(),wakeX:x,wakeZ:z,
      surface:kind==="table" ? {top:.699,rx:.56,rz:.34} : null};
  }

  function pieceState(prop,piece) {
    if (!prop.damage.has(piece)) prop.damage.set(piece,{
      holes:new Float32Array(cutoutLayout.slots*4),anchors:new Float32Array(8),pressure:new Float32Array(8),holeAt:0,tapAge:1,tapDepth:0
    });
    return prop.damage.get(piece);
  }

  function matrixAt(prop,at,pitch,yaw,roll) {
    const air=prop.kind==="tube" ? prop.air : 1, previous=prop.poseCache;
    if(previous && previous.x===at[0] && previous.y===at[1] && previous.z===at[2]
      && previous.pitch===pitch && previous.yaw===yaw && previous.roll===roll && previous.air===air) return previous.matrix;
    const matrix=transform(at,pitch,yaw,roll);
    if (prop.kind==="tube" && prop.air<1) {
      const flat=mix(.115,1,prop.air), width=mix(.86,1,prop.air);
      for(let i=0;i<3;i++) {
        matrix[i]*=width;
        matrix[4+i]*=flat;
        matrix[8+i]*=width;
      }
    }
    prop.poseCache={x:at[0],y:at[1],z:at[2],pitch,yaw,roll,air,matrix};
    return matrix;
  }

  function local(matrix,p) {
    const q=[p[0]-matrix[12],p[1]-matrix[13],p[2]-matrix[14]];
    return [0,4,8].map(i=>{
      const a=matrix[i],b=matrix[i+1],c=matrix[i+2];
      return (a*q[0]+b*q[1]+c*q[2])/(a*a+b*b+c*c);
    });
  }

  function normalAt(matrix,n) {
    const q=n.map((value,j)=>{
      const i=j*4;
      return value/(matrix[i]**2+matrix[i+1]**2+matrix[i+2]**2);
    });
    return unit(direction(matrix,q));
  }

  function pose(prop,time,ripples) {
    if(prop.debris) {
      const {pivot,pitch,roll}=prop.debris, at=center(prop);
      const matrix=transform(at,prop.flight?.pitch??pitch,prop.yaw,prop.flight?.roll??roll);
      matrix.set(minus(at,direction(matrix,pivot)),12);
      return matrix;
    }
    if (prop.flight) return matrixAt(prop,center(prop),prop.flight.pitch,prop.yaw,prop.flight.roll);
    const tube=prop.kind==="tube", floating=tube && prop.bed<Valley.world.waterLevel(prop.x,prop.z)-.025;
    let swell=0;
    if(floating) {
      for(let i=0;i<ripples.length;i+=4) {
        const power=ripples[i+3], age=time-ripples[i+2];
        const radius=waterRipples.origin+age*(waterRipples.speed+waterRipples.boost*Math.min(power,1.6));
        const front=Math.hypot(prop.x-ripples[i],prop.z-ripples[i+1])-radius;
        if(front > -1.65 && front < .54) {
          const band=smooth(-1.65,-.76,front)*(1-smooth(.12,.54,front));
          const fade=Math.exp(-age*mix(1.22,.71,Math.min(power,1)))*(1-smooth(2.8,waterRipples.life,age));
          swell+=.09*power*band*fade*Math.sin(front*4.8);
        }
      }
    }
    const wave=time*1.43+prop.phase;
    const at=center(prop);
    if (floating) at[1]+=(.017*Math.sin(wave)+clamp(swell,-.17,.19))*mix(.34,1,prop.air);
    const pitch=prop.tilt*prop.tipZ+(prop.support?.pitch??0)+(floating ? .041*Math.sin(wave)*prop.air : 0);
    const roll=prop.restRoll-prop.tilt*prop.tipX+(floating ? (.045*Math.cos(wave+.7)+swell*.60)*prop.air : 0);
    return matrixAt(prop,at,pitch,prop.yaw,roll);
  }

  function tubeShape(prop,heldDrape) {
    if(prop.kind!=="tube") return null;
    const slack=1-smooth(.14,.58,prop.air), {flight,flop}=prop;
    let drape=heldDrape??Number(prop.picked);
    if(flight) {
      const settling=smooth(0,.30,flight.age);
      drape=flight.lowered ? mix(.31,.10,settling) : mix(.93,.24,settling);
    }
    const impact=flop ? flop.power*(1-smooth(0,.49,flop.age))*(.49+.51*Math.abs(Math.cos(flop.age*15))) : 0;
    return [prop.rz,drape*slack,impact,slack];
  }

  function effectFor(prop,piece,tube) {
    const state=prop.damage.get(piece);
    const deformation=prop.deformed?.get(piece);
    let kind=0;
    if(piece.name==="interior") kind=5;
    else if(piece.material===10 && prop.kind==="tent") kind=1;
    if(piece.material===10 && prop.kind==="umbrella") kind=2;
    if(tube) kind=3;
    if((state || deformation) && !kind) kind=4;
    const air=prop.collapse ? 1-prop.collapse.amount : prop.air;
    return kind || prop.charred ? {kind,phase:prop.phase,air,state,deformation,tube,charred:prop.charred} : null;
  }

  function partsAt(prop,matrix,heldDrape) {
    const tube=tubeShape(prop,heldDrape);
    const parts=prop.powerLost ? prop.parts.filter(piece=>piece.material!==30) : prop.parts;
    return parts.map(piece=>({mesh:piece.mesh,matrix,
      effect:piece.material===33 ? {monitor:prop,charred:prop.charred} : effectFor(prop,piece,tube)}));
  }

  function objects(world,at) {
    const out=[];
    for(const prop of world.props) {
      if(prop.picked || prop.broken || (at && (Math.abs(prop.x-at[0])>105 || Math.abs(prop.z-at[2])>105))) continue;
      out.push(...partsAt(prop,prop.matrix));
    }
    for(const chip of world.chips) out.push({mesh:chip.mesh,matrix:transform(chip.at,chip.angle,chip.spin,chip.angle*.64,chip.scale)});
    return out;
  }

  function boxHit(piece,origin,delta,limit) {
    let enter=0, exit=limit;
    for(let axis=0;axis<3;axis++) {
      const a=origin[axis], d=delta[axis], lo=piece.min[axis]-.012, hi=piece.max[axis]+.012;
      if(Math.abs(d)<1e-8) {
        if(a<lo || a>hi) return false;
      } else {
        const p=(lo-a)/d, q=(hi-a)/d;
        enter=Math.max(enter,Math.min(p,q));
        exit=Math.min(exit,Math.max(p,q));
        if(enter>exit) return false;
      }
    }
    return true;
  }

  function bentPoint(prop,at) {
    if(!prop.bends) return at;
    let x=0,y=0,z=0;
    for(const bend of prop.bends) {
      const dx=at[0]-bend.at[0], dy=at[1]-bend.at[1], dz=at[2]-bend.at[2];
      const distance=Math.hypot(dx,dy*bend.heightScale,dz)/bend.radius;
      const core=1-smooth(0,1,distance);
      const pinch=core*core;
      const wave=Math.sin(dx*14.7+dy*17.3-dz*12.5+bend.phase)*core*(1-core)*.92;
      const hinge=bend.hinge ? smooth(-.17,.58,dy)*mix(.61,.85,smooth(.30,1.38,dy)) : 0;
      const bow=bend.hinge ? hinge+.39*pinch : core*.67+pinch*.36;
      const sag=bend.sag*(1-smooth(.07,bend.radius*1.34,Math.hypot(dx,dz)))*smooth(.19,.68,at[1]);
      x+=bend.offset[0]*bow+bend.ridge[0]*wave;
      y+=bend.offset[1]*bow+bend.ridge[1]*wave-sag;
      z+=bend.offset[2]*bow+bend.ridge[2]*wave;
    }
    const scale=Math.min(1,structures[prop.debris ? "table" : prop.kind].maxShift/(Math.hypot(x,y,z)||1));
    return [at[0]+x*scale,at[1]+y*scale,at[2]+z*scale];
  }

  function foldedTentPoint(prop,[x,y,z]) {
    const loose=smooth(.055,.39,y);
    const height=clamp(y/prop.height,0,1), drift=loose*(.12+.45*height);
    const fold=.069+.146*height+.040*Math.sin(x*7.8+z*6.6+y*4.1)+.021*Math.cos(z*12.8-x*8.7);
    const [dx,,dz]=prop.collapse.direction;
    return [x*(1+.086*loose)+dx*drift+.048*loose*Math.sin(z*6.3+y*6.2),
      mix(y,Math.max(.036,fold),loose),
      z*(1+.103*loose)+dz*drift+.045*loose*Math.cos(x*6.4+y*5.7)];
  }

  function bendPoint(prop,at,piece) {
    if(prop.kind==="tent" && piece?.name==="interior") return at;
    const bent=bentPoint(prop,at), amount=prop.collapse?.amount??0;
    if(!amount) return bent;
    const folded=foldedTentPoint(prop,bent);
    return bent.map((v,i)=>mix(v,folded[i],amount));
  }

  function tablePoint(table,[x,y,z]) {
    if(table.kind!=="table") return point(table.matrix,[x,y,z]);
    const top=table.surface.top, at=bendPoint(table,[x,top,z]);
    return point(table.matrix,[at[0],at[1]+y-top,at[2]]);
  }

  function rebuildBends(prop) {
    prop.shapeVersion=(prop.shapeVersion??0)+1;
    const deformed=prop.deformed??=new Map();
    const collapse=prop.collapse;
    for(const piece of prop.parts) {
      if(prop.kind==="tent" && piece.name==="interior") continue;
      const v=piece.vertices;
      if(!deformed.has(piece)) deformed.set(piece,{offsets:new Float32Array(v.length/11*3),min:[0,0,0],max:[0,0,0]});
      const mesh=deformed.get(piece), {offsets,min,max}=mesh;
      if(collapse) {
        mesh.raised=new Float32Array(offsets.length);
        mesh.folded=new Float32Array(offsets.length);
      }
      min.fill(Infinity);
      max.fill(-Infinity);
      // The draw buffer and the collision triangles use the same vertex offsets.
      for(let i=0,j=0;i<v.length;i+=11,j+=3) {
        const bent=bentPoint(prop,[v[i],v[i+1],v[i+2]]);
        const folded=collapse ? foldedTentPoint(prop,bent) : bent;
        for(let axis=0;axis<3;axis++) {
          const from=bent[axis]-v[i+axis], to=folded[axis]-v[i+axis];
          offsets[j+axis]=collapse ? mix(from,to,collapse.amount) : from;
          if(collapse) {
            mesh.raised[j+axis]=from;
            mesh.folded[j+axis]=to;
          }
          min[axis]=Math.min(min[axis],bent[axis],folded[axis]);
          max[axis]=Math.max(max[axis],bent[axis],folded[axis]);
        }
      }
      mesh.dirty=true;
    }
    prop.groundContact=null;
  }

  function updateTentCollapse(prop,dt,impact) {
    const collapse=prop.collapse;
    if(!collapse || !dt || collapse.amount===1) return;
    collapse.age+=dt;
    collapse.amount=smooth(.025,.91,collapse.age);
    for(const mesh of prop.deformed.values()) {
      const {offsets,raised,folded}=mesh;
      for(let i=0;i<offsets.length;i++) offsets[i]=mix(raised[i],folded[i],collapse.amount);
      mesh.dirty=true;
      if(collapse.amount===1) {
        delete mesh.raised;
        delete mesh.folded;
      }
    }
    if(collapse.amount===1) impact?.(prop,center(prop),[0,-2.4,0],"sand");
  }

  function insideOutline(points,x,y) {
    let inside=false;
    for(let a=points.length-2,b=0;b<points.length;a=b,b+=2) {
      const ay=points[a+1], by=points[b+1];
      if((ay>y)!==(by>y) && x<points[a]+(points[b]-points[a])*(y-ay)/(by-ay)) inside=!inside;
    }
    return inside;
  }

  function throughPuncture(state,x,y,z) {
    if (!state?.holeAt) return false;
    const {holes}=state;
    for(let i=0;i<holes.length;i+=4) {
      const radius=holes[i+3]*.80;
      if(radius && (x-holes[i])**2+(y-holes[i+1])**2+(z-holes[i+2])**2<radius*radius) return true;
    }
    return false;
  }

  function rasterTear(piece,mask,at,axis,side,normal,outline,extent,thickness) {
    const {uv,width,height}=piece.cloth, {vertices,indices}=piece, {pixels}=mask;
    const projected=new Float32Array(vertices.length/11*3);
    for(let i=0,j=0;i<vertices.length;i+=11,j+=3) {
      const offset=[vertices[i]-at[0],vertices[i+1]-at[1],vertices[i+2]-at[2]];
      projected[j]=dot(offset,axis);
      projected[j+1]=dot(offset,side);
      projected[j+2]=dot(offset,normal);
    }
    const outside=(a,b,c,range)=>Math.min(a,b,c)>range || Math.max(a,b,c)<-range;
    for(let i=0;i<indices.length;i+=3) {
      const ia=indices[i], ib=indices[i+1], ic=indices[i+2];
      const a=3*ia, b=3*ib, c=3*ic;
      const ax=uv[ia*2]*width;
      if(ax<0 || outside(projected[a],projected[b],projected[c],extent)
        || outside(projected[a+1],projected[b+1],projected[c+1],extent)
        || outside(projected[a+2],projected[b+2],projected[c+2],thickness)) continue;
      const ay=uv[ia*2+1]*height, bx=uv[ib*2]*width, by=uv[ib*2+1]*height;
      const cx=uv[ic*2]*width, cy=uv[ic*2+1]*height;
      const dx=bx-ax, dy=by-ay, ex=cx-ax, ey=cy-ay, det=dx*ey-dy*ex;
      if(Math.abs(det)<1e-8) continue;
      const left=Math.floor(Math.min(ax,bx,cx)), right=Math.floor(Math.max(ax,bx,cx));
      const top=Math.floor(Math.min(ay,by,cy)), bottom=Math.floor(Math.max(ay,by,cy));
      for(let y=top;y<=bottom;y++) for(let x=left;x<=right;x++) {
        const index=y*width+x;
        if(pixels[index]) continue;
        const sx=x+.5-ax, sy=y+.5-ay;
        const u=(sx*ey-sy*ex)/det, v=(dx*sy-dy*sx)/det, w=1-u-v;
        if(Math.min(u,v,w)<-.0001) continue;
        const depth=projected[a+2]*w+projected[b+2]*u+projected[c+2]*v;
        if(Math.abs(depth)>thickness) continue;
        const along=projected[a]*w+projected[b]*u+projected[c]*v;
        const across=projected[a+1]*w+projected[b+1]*u+projected[c+1]*v;
        if(insideOutline(outline,along,across)) pixels[index]=255;
      }
    }
  }

  function cutCloth(state,hit,velocity,distance) {
    const {prop,piece,local:at,clothNormal:normal,clothTexel}=hit;
    const {width:maskWidth,height:maskHeight}=piece.cloth;
    const mask=state.mask??={width:maskWidth,height:maskHeight,pixels:new Uint8Array(maskWidth*maskHeight)};
    const travel=unit(minus(local(prop.matrix,plus(hit.at,velocity)),local(prop.matrix,hit.at)));
    const shear=minus(travel,times(normal,dot(travel,normal)));
    const slant=clamp(Math.hypot(...shear),0,1), range=clamp(distance/damageRange,0,1);
    const along=slant>.07 ? unit(shear) : unit(cross(Math.abs(normal[1])>.88 ? [0,0,1] : [0,1,0],normal));
    const twist=(rng()-.5)*mix(1.65,.20,slant);
    const axis=plus(times(along,Math.cos(twist)),times(cross(normal,along),Math.sin(twist)));
    const side=cross(normal,axis);
    const size=mix(.263,.128,range)*(prop.kind==="chair" ? .69 : 1);
    const length=size*mix(.97,1.67,slant), width=size*mix(.96,.46,slant)*(rng()<.5 ? -1 : 1);
    const profile=tearProfiles[slant>.73 ? 0 : slant>.35 ? 1 : range<.52 ? 2 : 3];
    const outline=new Float32Array(profile.length*2);
    let extent=0;
    for(const [j,[x,y]] of profile.entries()) {
      const u=length*(x*mix(.90,1.13,rng())+.18*slant);
      const v=width*y*mix(.87,1.16,rng());
      outline.set([u,v],j*2);
      extent=Math.max(extent,Math.hypot(u,v));
    }
    const thickness=clamp(extent*.43,.058,.16);
    rasterTear(piece,mask,at,axis,side,normal,outline,extent,thickness);
    mask.pixels[clothTexel]=255;
    mask.dirty=true;
  }

  function clothTexelAt(cloth,a,b,c,u,v) {
    if(!cloth || cloth.uv[a*2]<0) return -1;
    const {uv,width,height}=cloth, w=1-u-v;
    const x=uv[a*2]*w+uv[b*2]*u+uv[c*2]*v;
    const y=uv[a*2+1]*w+uv[b*2+1]*u+uv[c*2+1]*v;
    return Math.floor(y*height)*width+Math.floor(x*width);
  }

  function trace(world,from,to,limit=1,exclude=null) {
    let hit=null;
    const minX=Math.min(from[0],to[0]),maxX=Math.max(from[0],to[0]);
    const minZ=Math.min(from[2],to[2]),maxZ=Math.max(from[2],to[2]);
    for(const prop of world.props) {
      if(prop===exclude || prop.picked || prop.broken) continue;
      const leaning=prop.tilt>.12 || prop.flight;
      const reach=prop.debris ? prop.debris.radius+.12
        : Math.max(prop.rx,prop.rz,leaning ? prop.height : 0)+(prop.collapse ? 1.24 : prop.deformed ? .64 : .26);
      if(prop.x<minX-reach || prop.x>maxX+reach || prop.z<minZ-reach || prop.z>maxZ+reach) continue;
      const heightPad=prop.debris ? prop.debris.radius+.12 : leaning ? Math.max(prop.rx,prop.rz)+.29 : prop.deformed ? .69 : .40;
      if (Math.max(from[1],to[1])<prop.y-heightPad || Math.min(from[1],to[1])>prop.y+prop.height+heightPad) continue;
      const matrix=prop.matrix, origin=local(matrix,from), delta=minus(local(matrix,to),origin);
      const [dx,dy,dz]=delta, [ox,oy,oz]=origin;
      for(const piece of prop.parts) {
        const deformation=prop.deformed?.get(piece), offsets=deformation?.offsets;
        if(!boxHit(deformation??piece,origin,delta,limit)) continue;
        const {vertices:v,indices}=piece, state=prop.damage.get(piece);
        for(let i=0;i<indices.length;i+=3) {
          const a=indices[i]*11,b=indices[i+1]*11,c=indices[i+2]*11;
          const da=indices[i]*3,db=indices[i+1]*3,dc=indices[i+2]*3;
          const ax=v[a]+(offsets?.[da]??0),ay=v[a+1]+(offsets?.[da+1]??0),az=v[a+2]+(offsets?.[da+2]??0);
          const bx=v[b]+(offsets?.[db]??0)-ax,by=v[b+1]+(offsets?.[db+1]??0)-ay,bz=v[b+2]+(offsets?.[db+2]??0)-az;
          const cx=v[c]+(offsets?.[dc]??0)-ax,cy=v[c+1]+(offsets?.[dc+1]??0)-ay,cz=v[c+2]+(offsets?.[dc+2]??0)-az;
          const px=dy*cz-dz*cy,py=dz*cx-dx*cz,pz=dx*cy-dy*cx;
          const determinant=bx*px+by*py+bz*pz;
          if(Math.abs(determinant)<1e-9) continue;
          const rx=ox-ax,ry=oy-ay,rz=oz-az;
          const u=(rx*px+ry*py+rz*pz)/determinant;
          if(u<0 || u>1) continue;
          const qx=ry*bz-rz*by,qy=rz*bx-rx*bz,qz=rx*by-ry*bx;
          const w=(dx*qx+dy*qy+dz*qz)/determinant;
          if(w<0 || u+w>1) continue;
          const fraction=(cx*qx+cy*qy+cz*qz)/determinant;
          if(fraction<0 || fraction>limit) continue;
          const clothTexel=clothTexelAt(piece.cloth,indices[i],indices[i+1],indices[i+2],u,w);
          if(clothTexel>=0 && state?.mask?.pixels[clothTexel]) continue;
          const contact=[ox+dx*fraction,oy+dy*fraction,oz+dz*fraction];
          const rest=offsets ? [0,1,2].map(j=>v[a+j]*(1-u-w)+v[b+j]*u+v[c+j]*w) : contact;
          if(throughPuncture(state,...rest)) continue;
          const n=unit(cross([bx,by,bz],[cx,cy,cz]));
          const localNormal=dot(n,delta)>0 ? times(n,-1) : n;
          let clothNormal=localNormal;
          if(clothTexel>=0 && offsets) {
            const restB=[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]];
            const restC=[v[c]-v[a],v[c+1]-v[a+1],v[c+2]-v[a+2]];
            const base=unit(cross(restB,restC));
            clothNormal=dot(base,localNormal)<0 ? times(base,-1) : base;
          }
          limit=fraction;
          hit={type:"prop",prop,piece,fraction,local:rest,localNormal,clothTexel,clothNormal,
            at:point(matrix,contact),normal:normalAt(matrix,localNormal)};
        }
      }
    }
    return hit;
  }

  function woodOrBed(world,x,z,reach) {
    return Valley.world.solidHeight(world,x,z,undefined,reach);
  }

  function overlap(p,x,z,pad) {
    if(p.broken) return Infinity;
    const dx=x-p.x,dz=z-p.z, cos=Math.cos(p.yaw), sin=Math.sin(p.yaw);
    const width=p.kind==="umbrella" ? .055 : p.rx, depth=p.kind==="umbrella" ? .055 : p.rz;
    return ((cos*dx-sin*dz)/(width+pad))**2+((sin*dx+cos*dz)/(depth+pad))**2;
  }

  function fits(world,prop,x,z,escapeOverlap=false,reach=(prop.bed??prop.y)+.48) {
    if(!valid(x,z)) return false;
    const bed=woodOrBed(world,x,z,reach);
    if(bed>reach) return false;
    if(!prop.picked && Math.abs(bed-(prop.bed??prop.y))>(escapeOverlap ? .46 : 2.2)) return false;
    if(!Valley.roadview.walkable(world.road,x,z,bed,.03,prop.height)) return false;
    const pad=Math.min(prop.rx,prop.rz)*.72;
    return !world.obstacles.some(b=>{
      if(b.owner?.tipped) return false;
      const next=((x-b.x)/(b.rx+pad))**2+((z-b.z)/(b.rz+pad))**2;
      if(next>=1) return false;
      const old=((prop.x-b.x)/(b.rx+pad))**2+((prop.z-b.z)/(b.rz+pad))**2;
      return !escapeOverlap || next<old-.001;
    }) && !world.props.some(other=>{
      if(other===prop || other.picked || other.support || other.flight ||
        (other.kind==="tube" && other.air<.28) || (other.kind==="umbrella" && other.tipped)) return false;
      const next=overlap(other,x,z,pad);
      return next<1 && (!escapeOverlap || next<overlap(other,prop.x,prop.z,pad)-.001);
    });
  }

  function shift(world,prop,x,z) {
    if(!fits(world,prop,x,z,true)) return false;
    prop.x=x;
    prop.z=z;
    return true;
  }

  function knock(prop,x,z,pace) {
    if(prop.occupied || prop.kind==="tube" || prop.kind==="cushion" || prop.tipped) return;
    const table=prop.kind==="table", threshold=table ? 2.95 : 1.94+prop.mass*.47;
    if(pace<threshold) return;
    const c=Math.cos(prop.yaw),s=Math.sin(prop.yaw);
    const heading=Math.atan2(s*x+c*z,c*x-s*z)+(table ? mix(-.39,.39,rng()) : 0);
    prop.tipX=Math.cos(heading);
    prop.tipZ=Math.sin(heading);
    if(table) {
      prop.tipTarget=mix(.99,2.37,rng())+.12*smooth(2.95,5.2,pace);
      prop.tipRate=mix(4.65,8.50,rng());
      prop.spin+=mix(-1.35,1.35,rng());
    }
    prop.tipped=true;
    prop.groundContact=null;
  }

  function fallIfBent(prop) {
    if(prop.kind==="table" || !prop.balance || prop.tipped || prop.occupied) return;
    const [x,z]=prop.balance, load=Math.hypot(x,z);
    if(load<structures[prop.kind].collapse) return;
    prop.tipX=x/load;
    prop.tipZ=z/load;
    prop.tipped=true;
    prop.groundContact=null;
  }

  function scatterTable(world,table,away,strength) {
    for(const item of world.props) {
      if(item.picked || item.support?.table!==table) continue;
      const at=tablePoint(table,item.support.local);
      const outward=unit([at[0]-table.x,0,at[2]-table.z]);
      const travel=unit(plus(times(away,.42),times(outward,mix(.91,1.19,rng()))));
      const speed=strength*mix(.86,1.18,rng())/(.60+Math.sqrt(item.mass));
      toss(item,plus(at,[0,.046,0]),[table.vx+travel[0]*speed,.26+speed*.42,table.vz+travel[2]*speed],item.yaw,.63);
    }
  }

  function push(world,x,z,feet,vx,vz,dt) {
    let clear=true;
    const speed=Math.hypot(vx,vz);
    if(speed<.02) return clear;
    for(const prop of world.props) {
      if(!prop.mass || prop.picked || prop.support || prop.flight || prop.small || feet>prop.y+prop.height*(prop.tipped ? .44 : prop.kind==="tube" ? prop.air*.69+.18 : .78) ||
        feet+1.25<prop.y-.18 || overlap(prop,x,z,.23)>=1) continue;
      const away=unit([prop.x-x,0,prop.z-z]), motion=dot([vx,0,vz],away);
      if(motion<=0) continue;
      if(prop.occupied) {
        clear=false;
        continue;
      }
      if(prop.surface && motion>2.38) {
        scatterTable(world,prop,away,Math.min(2.9,(motion-1.40)*.79));
      }
      const pace=speed*1.86/(.72+prop.mass);
      const move=pace*dt;
      const shifted=shift(world,prop,prop.x+away[0]*move,prop.z+away[2]*move);
      if(shifted) {
        prop.vx=mix(prop.vx,away[0]*pace*.92,.34);
        prop.vz=mix(prop.vz,away[2]*pace*.92,.34);
        prop.spin=clamp(prop.spin+(vx*away[2]-vz*away[0])*dt*.66/prop.mass,-2,2);
      }
      if(shifted || prop.kind==="table") knock(prop,away[0],away[2],prop.kind==="table" ? motion : speed);
      if(overlap(prop,x,z,.23)<.998) clear=false;
    }
    return clear;
  }

  function tiltLift(prop) {
    if(prop.tilt===0) return 0;
    if(!structures[prop.kind] && prop.kind!=="desk") return Math.sin(prop.tilt)*Math.min(prop.rx,prop.rz)*.82;
    if(prop.groundContact?.tilt===prop.tilt) return prop.groundContact.lift;
    const pitch=prop.tilt*prop.tipZ, roll=-prop.tilt*prop.tipX;
    const axis=[Math.cos(pitch)*Math.sin(roll),Math.cos(pitch)*Math.cos(roll),-Math.sin(pitch)];
    let lowest=0;
    for(const piece of prop.parts) {
      const v=piece.vertices, offset=prop.deformed?.get(piece)?.offsets;
      for(let i=0,j=0;i<v.length;i+=11,j+=3) {
        const y=(v[i]+(offset?.[j]??0))*axis[0]+(v[i+1]+(offset?.[j+1]??0))*axis[1]
          +(v[i+2]+(offset?.[j+2]??0))*axis[2];
        lowest=Math.min(lowest,y);
      }
    }
    const lift=Math.max(0,-lowest-.039);
    prop.groundContact={tilt:prop.tilt,lift};
    return lift;
  }

  function restHeight(prop,bed,x,z) {
    const level=Valley.world.waterLevel(x,z);
    if(prop.kind==="tube") return bed<level-.025 ? level+mix(.016,.046,prop.air) : bed+mix(.022,.120,prop.air);
    if(launcherRest[prop.kind]) return bed+launcherRest[prop.kind];
    if(prop.small) return bed+(prop.restRoll ? Math.min(prop.height*.37,prop.rx) : .005);
    return bed+tiltLift(prop)+(prop.hop??0);
  }

  function settle(world,prop) {
    if(prop.x!==prop.bedX || prop.z!==prop.bedZ) {
      prop.bed=woodOrBed(world,prop.x,prop.z,prop.y+.52);
      prop.bedX=prop.x;
      prop.bedZ=prop.z;
    }
    prop.y=restHeight(prop,prop.bed,prop.x,prop.z);
  }

  function toss(prop,at,velocity,yaw,force=1) {
    const [x,y,z]=at;
    const bounds=boundsAt(x,z);
    Object.assign(prop,{x:clamp(x,bounds.left,bounds.right),y,z:clamp(z,bounds.far,bounds.near),yaw,
      picked:false,support:null,installed:null,tipped:false,tilt:0,restRoll:0,vx:0,vz:0,spin:0,hop:0,hopVelocity:0,groundContact:null,flop:null,
      flight:{velocity,pitch:.11,roll:0,spin:[mix(-6,6,rng()),mix(-3.4,3.4,rng()),mix(-6,6,rng())].map(v=>v*force),bounces:0,age:0}});
    prop.matrix=pose(prop,0,[]);
  }

  function fragment(table,pieces,away) {
    const damage=new Map(), deformed=new Map();
    const min=[Infinity,Infinity,Infinity], max=[-Infinity,-Infinity,-Infinity];
    const scores=Array(8).fill(-Infinity), samples=Array(8);
    let bottom;
    for(const piece of pieces) {
      const shape=table.deformed?.get(piece), state=table.damage.get(piece);
      if(shape) deformed.set(piece,shape);
      if(state) damage.set(piece,state);
      const bounds=shape??piece, v=piece.vertices, offset=shape?.offsets;
      for(let axis=0;axis<3;axis++) {
        min[axis]=Math.min(min[axis],bounds.min[axis]);
        max[axis]=Math.max(max[axis],bounds.max[axis]);
      }
      for(let i=0,j=0;i<v.length;i+=11,j+=3) {
        const x=v[i]+(offset?.[j]??0), y=v[i+1]+(offset?.[j+1]??0), z=v[i+2]+(offset?.[j+2]??0);
        if(!bottom || y<bottom[1]) bottom=[x,y,z];
        for(let k=0;k<8;k++) {
          const score=(k&1 ? x : -x)+(k&2 ? y : -y)+(k&4 ? z : -z);
          if(score>scores[k]) {
            scores[k]=score;
            samples[k]=[x,y,z];
          }
        }
      }
    }
    samples.push(bottom);
    const pivot=times(plus(min,max),.5), half=times(minus(max,min),.5);
    const at=point(table.matrix,pivot);
    const frame=pieces.some(p=>p.material===0 || p.group==="legs" || (typeof p.group==="string" && p.group.startsWith("frame")));
    const yaw=Math.atan2(table.matrix[8],table.matrix[10]);
    const prop=make(pieces,frame ? "tableFrame" : "tablePanel",...at,yaw,half[0],half[2],half[1]);
    const outward=unit([at[0]-table.x,0,at[2]-table.z]), side=Math.sign(pivot[2])||1;
    const drift=plus(times(away,frame ? .27 : .51),times(outward,frame ? 1.13 : .82));
    const pitch=Math.asin(clamp(-table.matrix[9],-1,1)), roll=Math.atan2(table.matrix[1],table.matrix[5]);
    const restPitch=frame && half[1]>.10 ? side*mix(1.04,1.63,rng()) : 0;
    prop.damage=damage;
    prop.deformed=deformed;
    prop.bends=table.bends;
    prop.charred=table.charred;
    prop.debris={pivot,samples,radius:Math.hypot(...half),pitch,roll,restPitch,settle:0};
    const carry=table.flight?.velocity??[table.vx,0,table.vz];
    prop.flight={velocity:plus(carry,[drift[0],mix(.13,.39,rng()),drift[2]]),pitch,roll,
      spin:[restPitch*1.55+mix(-.78,.78,rng()),mix(-.89,.89,rng()),mix(-1.14,1.14,rng())],bounces:0};
    prop.matrix=pose(prop,0,[]);
    return prop;
  }

  function breakTable(world,table,velocity) {
    const index=world.props.indexOf(table);
    if(index<0) return false;
    const away=unit([velocity[0],0,velocity[2]]);
    scatterTable(world,table,away,2.25);
    const groups=new Map();
    for(const piece of table.parts) {
      const key=piece.group??piece;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(piece);
    }
    const parts=[...groups.values()].map(pieces=>fragment(table,pieces,away));
    table.picked=true;
    world.props.splice(index,1,...parts);
    return true;
  }

  function blast(world,at,radius) {
    for(const prop of world.props.slice()) {
      if(!prop.mass || prop.picked || prop.occupied || prop.broken) continue;
      const [dx,dy,dz]=minus(center(prop),at);
      const power=1-smooth(.7,radius,Math.hypot(dx,dy*1.2,dz));
      if(power<.05) continue;
      const away=unit([dx+(rng()-.5)*.71,0,dz+(rng()-.5)*.71]);
      const force=power*12.8/(.72+Math.sqrt(prop.mass)*.47);
      const velocity=[away[0]*force,.42+power*mix(2.3,4.9,rng()),away[2]*force];
      if(prop.kind==="table" && power>.53) {
        prop.vx=velocity[0]*.56;
        prop.vz=velocity[2]*.56;
        breakTable(world,prop,velocity);
      } else {
        toss(prop,plus(center(prop),[0,.070,0]),velocity,prop.yaw,mix(.36,1.28,power));
      }
    }
  }

  function debrisContact(world,prop) {
    let depth=-Infinity, at;
    for(const sample of prop.debris.samples) {
      const [x,y,z]=point(prop.matrix,sample), bed=woodOrBed(world,x,z,y+.46);
      if(bed+.005-y>depth) {
        depth=bed+.005-y;
        at=[x,bed,z];
      }
    }
    return {depth,at};
  }

  function stepDebris(world,prop,dt,impact) {
    if(!dt) return;
    const {debris,flight}=prop;
    if(!flight) {
      if(!debris.settle) return;
      debris.settle=Math.max(0,debris.settle-dt);
      const ease=debris.settle ? 1-Math.exp(-dt*12) : 1;
      debris.pitch=mix(debris.pitch,debris.restPitch,ease);
      debris.roll=mix(debris.roll,0,ease);
      prop.matrix=pose(prop,0,[]);
      prop.y+=debrisContact(world,prop).depth;
      prop.matrix=pose(prop,0,[]);
      return;
    }
    const terrain=Valley.world, bounds=boundsAt(prop.x,prop.z), steps=Math.ceil(dt/.024), step=dt/steps;
    for(let i=0;i<steps && prop.flight;i++) {
      const y=prop.y, wet=terrain.wetAt(prop.x,prop.z,y);
      const v=times(flight.velocity,Math.exp(-step*(wet ? 2.65 : .29)));
      v[1]-=step*(wet ? 3.35 : 9.45);
      prop.x=clamp(prop.x+v[0]*step,bounds.left,bounds.right);
      prop.y+=v[1]*step;
      prop.z=clamp(prop.z+v[2]*step,bounds.far,bounds.near);
      const level=terrain.waterLevel(prop.x,prop.z);
      if(y>level && prop.y<=level && terrain.height(prop.x,prop.z)<level-.025) {
        impact?.(prop,[prop.x,level,prop.z],v,"water");
      }
      flight.pitch+=flight.spin[0]*step;
      prop.yaw+=flight.spin[1]*step;
      flight.roll+=flight.spin[2]*step;
      prop.matrix=pose(prop,0,[]);
      const {depth,at}=debrisContact(world,prop);
      flight.velocity=v;
      if(depth<0) continue;
      prop.y+=depth;
      if(v[1]<0) {
        if(!flight.bounces || v[1]<-.85) {
          const surface=terrain.surfaceKind(world,at[0],at[2],at[1]);
          impact?.(prop,at,v,surface==="water" ? "sand" : surface);
        }
        flight.bounces++;
        if(flight.bounces>=3 || v[1]>-.72) {
          Object.assign(debris,{pitch:flight.pitch,roll:flight.roll,settle:.34});
          prop.flight=null;
        } else {
          flight.velocity=[v[0]*.52,-v[1]*.18,v[2]*.52];
          flight.spin=times(flight.spin,.53);
        }
      }
      prop.matrix=pose(prop,0,[]);
    }
  }

  function damageFragile(prop,damage) {
    prop.hp=Math.max(0,prop.hp-damage);
    if(prop.hp>0) return false;
    Object.assign(prop,{broken:true,flight:null,support:null});
    return true;
  }

  function stableSupport(support,prop) {
    for(let body=support;body;body=body.support?.table) {
      if(body===prop || body.flight || body.picked || body.broken || body.debris?.settle) return false;
    }
    return true;
  }

  function thrownStep(world,prop,dt,impact) {
    const flight=prop.flight, floor=Valley.world, limp=limpTube(prop);
    const loosePaper=paperItems.has(prop.kind) && prop.kind!=="ledger";
    const bounds=boundsAt(prop.x,prop.z);
    const n=Math.max(1,Math.ceil(dt/.024)), step=dt/n;
    for(let i=0;i<n && prop.flight;i++) {
      const at=center(prop), wet=floor.wetAt(at[0],at[2],at[1]);
      flight.age+=step;
      const velocity=times(flight.velocity,Math.exp(-step*(wet ? 2.65 : loosePaper ? 1.25 : limp ? .66 : .12)));
      velocity[1]-=step*(wet ? 3.35 : loosePaper ? 4.3 : 9.45);
      const next=plus(at,times(velocity,step));
      next[0]=clamp(next[0],bounds.left,bounds.right);
      next[2]=clamp(next[2],bounds.far,bounds.near);
      for(const axis of [0,2]) if(next[axis]!==at[axis]+velocity[axis]*step) velocity[axis]*=-.39;
      const bed=floor.height(next[0],next[2]),level=floor.waterLevel(next[0],next[2]);
      if(next[1]<=level+.001 && bed<level-.026 && (at[1]>level+.001 || prop.kind==="tube")) {
        impact?.(prop,[next[0],level,next[2]],velocity,"water",limp);
        if(prop.kind==="tube") {
          const drift=limp ? .24 : .42;
          Object.assign(prop,{x:next[0],z:next[2],flight:null,vx:velocity[0]*drift,vz:velocity[2]*drift,spin:flight.spin[1]*.37});
          if(limp) prop.flop={age:0,power:clamp(.16-velocity[1]*.14,.22,.73)};
          settle(world,prop);
          break;
        }
        for(let axis=0;axis<3;axis++) velocity[axis]*=.36;
      }
      const solid=floor.traceShot(world,at,next,false);
      const hit=trace(world,at,next,solid?.fraction??1,prop) || solid;
      if(hit) {
        const approach=dot(velocity,hit.normal), speed=Math.hypot(...velocity);
        const supported=hit.prop?.surface && hit.normal[1]>.63;
        const force=Math.max(0,-approach-1.25);
        if(force>0 && prop.fragile && hit.type!=="sand" && hit.prop?.kind!=="cushion" && hit.prop?.kind!=="tube"
          && damageFragile(prop,force*.28)) {
           impact?.(prop,hit.at,velocity,hit.type,false,hit.normal,hit);
          break;
        }
        if(force>0 && hit.prop?.fragile && damageFragile(hit.prop,force*.26*Math.min(1,Math.sqrt(prop.mass)*2))) {
          impact?.(hit.prop,hit.at,velocity,hit.type,false,hit.normal);
        }
        if(limp && hit.type!=="prop" && hit.normal[1]>.40) {
          Object.assign(prop,{x:hit.at[0],z:hit.at[2],flight:null,vx:velocity[0]*.12,vz:velocity[2]*.12,spin:flight.spin[1]*.14,
            flop:{age:0,power:clamp(.18-approach*.23,.27,1.14)}});
          settle(world,prop);
          impact?.(prop,hit.at,velocity,hit.type,true);
          break;
        }
         if(approach<-.38) impact?.(prop,hit.at,velocity,hit.type,false,hit.normal,hit);
        if(supported && speed<2.1 && placeOnSurface(world,prop,hit.prop,hit.at,prop.yaw)) break;
        const support=hit.prop;
        if(support && hit.normal[1]>.63 && speed<1.7 && stableSupport(support,prop)) {
          const at=plus(hit.at,[0,.007+(launcherRest[prop.kind]??0),0]);
          Object.assign(prop,{x:at[0],y:at[1],z:at[2],flight:null,restRoll:launcherRoll[prop.kind]??0,
            support:{table:support,local:local(support.matrix,at),yaw:prop.yaw-support.yaw,tilt:support.tilt}});
          break;
        }
        if(!supported && hit.type!=="prop" && hit.normal[1]>.40 && (flight.bounces>1 || speed<1.16)) {
          Object.assign(prop,{x:hit.at[0],z:hit.at[2],flight:null,
            restRoll:paperItems.has(prop.kind) || prop.kind==="key" ? 0 : prop.small ? (launcherRoll[prop.kind]??1.13) : 0});
          if(!prop.small) knock(prop,Math.sin(prop.yaw),-Math.cos(prop.yaw),5.25);
          settle(world,prop);
          break;
        }
        const restitution=wet ? .19 : limp ? .18 : .41;
        flight.velocity=times(minus(velocity,times(hit.normal,1.53*Math.min(0,approach))),restitution);
        const leave=dot(flight.velocity,hit.normal);
        const separation=limp ? .20 : .36;
        if(leave<separation) flight.velocity=plus(flight.velocity,times(hit.normal,separation-leave));
        [prop.x,prop.y,prop.z]=plus(hit.at,times(hit.normal,.032));
        flight.bounces++;
      } else {
        [prop.x,prop.y,prop.z]=next;
        flight.velocity=velocity;
      }
      flight.pitch+=flight.spin[0]*step;
      prop.yaw+=flight.spin[1]*step;
      flight.roll+=flight.spin[2]*step;
      flight.spin=times(flight.spin,Math.exp(-step*(wet ? 2.3 : .29)));
    }
  }

  function tick(world,dt,time,ripples,wake,impact) {
    for(const prop of world.props) {
      if(prop.broken || prop.installed) continue;
      if(prop.leaking) prop.air=Math.max(.05,prop.air-dt*(.27+.38*prop.air));
      if(prop.flop) {
        prop.flop.age+=dt;
        if(prop.flop.age>=.49) prop.flop=null;
      }
      for(const state of prop.damage.values()) {
        state.tapAge+=dt;
        const t=clamp(state.tapAge/.58,0,1);
        state.pressure[7]=state.tapDepth*(1-t)**2*Math.sin(t*6.5);
      }
      if(prop.debris) {
        stepDebris(world,prop,dt,impact);
        continue;
      }
      updateTentCollapse(prop,dt,impact);
      if(!prop.picked && (prop.mass || prop.kind==="umbrella")) {
        if(prop.support) {
          const {table,local,yaw}=prop.support;
          if(!table.picked && !table.flight && !table.broken && Math.abs(table.tilt-(prop.support.tilt??0))<.24) {
            if(prop.support.matrix===table.matrix && prop.support.shapeVersion===table.shapeVersion) continue;
            [prop.x,prop.y,prop.z]=table.debris ? point(table.matrix,local) : tablePoint(table,local);
            prop.yaw=table.yaw+yaw;
            prop.matrix=pose(prop,time,ripples);
            prop.support.matrix=table.matrix;
            prop.support.shapeVersion=table.shapeVersion;
            continue;
          }
          toss(prop,center(prop),[table.vx,-.17,table.vz],prop.yaw,.45);
        }
        if(prop.flight) {
          thrownStep(world,prop,dt,impact);
          prop.matrix=pose(prop,time,ripples);
          continue;
        }
        if(!prop.occupied && dt>0) {
          fallIfBent(prop);
          if(Math.hypot(prop.vx,prop.vz)>.016 && !shift(world,prop,prop.x+prop.vx*dt,prop.z+prop.vz*dt)) {
            prop.vx*=-.23;
            prop.vz*=-.23;
          }
          const drag=Math.exp(-dt*(prop.kind==="tube" && prop.bed<Valley.world.waterLevel(prop.x,prop.z)-.025 ? 1.8 : prop.tipped ? 6.5 : 5.8));
          prop.vx*=drag;
          prop.vz*=drag;
          prop.yaw+=prop.spin*dt;
          prop.spin*=drag;
          if(Math.abs(prop.vx)<.001) prop.vx=0;
          if(Math.abs(prop.vz)<.001) prop.vz=0;
          if(Math.abs(prop.spin)<.001) prop.spin=0;
          const target=prop.tipped ? (prop.kind==="table" ? prop.tipTarget??1.42 : prop.kind==="umbrella" ? 1.16 : 1.42) : 0;
          const previous=prop.tilt;
          prop.tilt=mix(previous,target,1-Math.exp(-dt*(prop.tipped && prop.kind==="table" ? prop.tipRate??7.9 : 7.9)));
          if(Math.abs(prop.tilt-target)<.001) prop.tilt=target;
          if(prop.tipped && previous<target-.115 && prop.tilt>=target-.115) {
            impact?.(prop,[prop.x,prop.bed,prop.z],[prop.vx,-2.9,prop.vz],"sand");
          }
          if(prop.hop || prop.hopVelocity) {
            prop.hop=Math.max(0,(prop.hop??0)+dt*(prop.hopVelocity-4.75*dt));
            prop.hopVelocity=prop.hop>0 ? prop.hopVelocity-9.5*dt : 0;
          }
        }
        settle(world,prop);
        if(prop.kind==="tube" && prop.bed<Valley.world.waterLevel(prop.x,prop.z)-.025 && Math.hypot(prop.x-prop.wakeX,prop.z-prop.wakeZ)>.34) {
          wake?.(prop.x,prop.z,.23+prop.air*.13);
          prop.wakeX=prop.x;
          prop.wakeZ=prop.z;
        }
      }
      if(!prop.picked && (prop.mass || prop.kind==="umbrella")) prop.matrix=pose(prop,time,ripples);
    }
    for(const chip of world.chips) {
      if(!chip.velocity) continue;
      chip.velocity[1]-=dt*8.6;
      chip.at=plus(chip.at,times(chip.velocity,dt));
      chip.angle+=dt*chip.turn;
      chip.spin+=dt*chip.turn*.44;
      const floor=Math.max(Valley.world.waterLevel(chip.at[0],chip.at[2])-.04,woodOrBed(world,chip.at[0],chip.at[2],chip.at[1]+.32))+.018;
      if(chip.at[1]<=floor) {
        chip.at[1]=floor;
        chip.velocity=null;
      }
    }
  }

  function chips(renderer,material="plastic") {
    const wooden=material==="wood";
    const colors=wooden ? [0xd7ad78,0xba9262,0xe7c794] : [0x25628c,0x3a88bb,0x71a9c2];
    return colors.map((color,i)=>{
      const shape=new Builder();
      const width=wooden ? .54+i*.16 : 1;
      const a=[-.044,-.006,-.021*width],b=[.022+i*.008,-.004,-.034*width],c=[.037,.002,.024*width],
        d=[-.028,.019,.036*width],e=[.001,.017,-.007*width];
      const tint=rgb(color);
      shape.triangle(a,b,e,tint);
      shape.triangle(b,c,e,tint);
      shape.triangle(c,d,e,tint);
      shape.triangle(d,a,e,tint);
      shape.quad([a,d,c,b],times(tint,wooden ? .56 : .76));
      return renderer.mesh(shape,wooden ? 13 : 12);
    });
  }

  function bendStructure(hit,velocity,power,frame) {
    const {prop,piece,local:at,localNormal}=hit;
    const profile=structures[prop.kind], hinge=prop.kind==="umbrella" && piece.name==="pole";
    const travel=unit(minus(local(prop.matrix,plus(hit.at,velocity)),local(prop.matrix,hit.at)));
    const inward=plus(times(localNormal,-.73),times(travel,.56));
    const along=hinge ? unit([inward[0],-.09,inward[2]])
      : unit(frame ? inward : plus(inward,[0,localNormal[1]<-.58 ? .27 : -.39,0]));
    const sideways=unit(cross(along,Math.abs(along[1])>.84 ? [1,0,0] : [0,1,0]));
    const radius=(frame ? profile.reach : .51)*mix(.72,1.28,Math.sqrt(power));
    const amount=(frame ? profile.flex : .251)*power**.86*(prop.kind==="umbrella" && !hinge ? .57 : 1);
    const bends=prop.bends??=[];
    const offset=times(along,amount);
    const ridge=times(sideways,amount*mix(.49,.94,rng())*(rng()<.5 ? -1 : 1));
    const sag=prop.kind==="umbrella" ? 0 : (frame ? .074 : .045)*power;
    const joint=bends.find(b=>b.hinge===hinge && Math.hypot(...minus(b.at,at))<.15);
    if(joint) {
      const sum=plus(joint.offset,times(offset,.73));
      joint.offset=times(sum,Math.min(1,profile.maxShift/(Math.hypot(...sum)||1)));
      joint.radius=Math.max(joint.radius,radius);
      joint.sag=Math.min(.23,joint.sag+sag*.66);
      joint.ridge=times(plus(joint.ridge,ridge),.73);
    } else {
      if(bends.length===8) bends.shift();
      bends.push({at,offset,ridge,radius,sag,hinge,heightScale:frame ? .83 : .69,phase:rng()*6.283});
    }
    rebuildBends(prop);

    const radial=[at[0]/prop.rx,0,at[2]/prop.rz], span=Math.hypot(...radial);
    const sidewaysHit=unit([inward[0],0,inward[2]]);
    const side=hinge || span<.14 ? sidewaysHit : times(radial,1/span);
    const leverage=hinge ? mix(.70,1.34,smooth(.26,1.80,at[1])) : mix(.39,1.23,clamp(span,0,1));
    const load=power*leverage*(frame ? 1 : .74);
    const balance=prop.balance??=[0,0];
    balance[0]=clamp(balance[0]+side[0]*load,-2.6,2.6);
    balance[1]=clamp(balance[1]+side[2]*load,-2.6,2.6);
    fallIfBent(prop);
    if(!prop.tipped && !prop.occupied && Math.hypot(side[0],side[2])>.1) {
      prop.tipX=side[0];
      prop.tipZ=side[2];
      prop.tilt=Math.max(prop.tilt,power*(hinge ? .145 : .105));
    }
  }

  function damageTentFrame(hit,velocity,power) {
    const {prop,local:at,localNormal}=hit, profile=structures.tent;
    const bends=prop.bends??=[];
    let joint=bends.find(b=>Math.hypot(...minus(b.at,at))<.26);
    if(!joint) {
      const travel=unit(minus(local(prop.matrix,plus(hit.at,velocity)),local(prop.matrix,hit.at)));
      const direction=unit(plus(times(localNormal,-.70),times(travel,.54)));
      const ridgeAxis=unit(cross(direction,Math.abs(direction[1])>.84 ? [1,0,0] : [0,1,0]));
      joint={at,direction,ridgeAxis,hits:0,damage:0,heightScale:.82,phase:rng()*6.283};
      bends.push(joint);
    }
    joint.hits++;
    joint.damage+=power;
    const fatigue=smooth(2,4,joint.hits);
    const bend=Math.min(profile.maxShift,profile.flex*joint.damage**.89*mix(1,1.65,fatigue));
    joint.offset=times(joint.direction,bend);
    joint.ridge=times(joint.ridgeAxis,bend*.54);
    joint.radius=profile.reach*mix(.69,1.16,smooth(.20,2.8,joint.damage));
    joint.sag=Math.min(.235,.056*joint.damage*mix(1,1.49,fatigue));

    const weakened=bends.filter(b=>b.damage>=.58);
    const load=weakened.reduce((total,b)=>total+Math.min(b.damage,1.64),0);
    if(weakened.length>=3 && load>=4.10) {
      // Limit each site's contribution so repeated hits on a single rod cannot drop the entire tent.
      const side=weakened.reduce((sum,b)=>plus(sum,times([b.direction[0],0,b.direction[2]],Math.min(b.damage,1.64))),[0,0,0]);
      const direction=unit(Math.hypot(...side)>.16 ? side : [joint.direction[0],0,joint.direction[2]]);
      prop.collapse={age:0,amount:0,direction};
    }
    rebuildBends(prop);
  }

  function kickSmall(hit,velocity,speed,incidence) {
    const {prop,normal}=hit;
    const drift=[velocity[0]-normal[0]*speed*.24,0,velocity[2]-normal[2]*speed*.24];
    const travel=Math.hypot(drift[0],drift[2])>.08 ? unit(drift) : unit([hit.at[0]-prop.x+.074,0,hit.at[2]-prop.z]);
    const kick=clamp(speed*.087,.33,3.65)*mix(.52,1,incidence)/(.52+Math.sqrt(prop.mass));
    const impulse=[travel[0]*kick,.25+kick*.49,travel[2]*kick];
    if(prop.flight) {
      prop.flight.velocity=plus(prop.flight.velocity,impulse);
      prop.flight.spin[1]+=kick*.48;
      return;
    }
    const base=prop.support?.table??prop;
    toss(prop,[prop.x,prop.y+.041,prop.z],plus(impulse,[base.vx,0,base.vz]),prop.yaw,mix(.39,.98,smooth(.4,3.5,kick)));
  }

  function strike(world,hit,velocity,distance,strength) {
    const {prop,piece,local:at,localNormal,normal}=hit;
    const speed=Math.hypot(...velocity), incidence=clamp(-dot(velocity,normal)/(speed||1),0,1);
    if(prop.fragile) {
      const broken=damageFragile(prop,strength*smooth(3,29,speed)*mix(.23,1,incidence));
      if(!broken && speed>2.35) kickSmall(hit,velocity,speed,incidence);
      return {material:prop.fragile,fragile:true,broken};
    }
    const material=paperItems.has(prop.kind) ? "paper" : piece.material===10 ? "cloth" : piece.material===11 ? "vinyl"
      : piece.material===12 ? "plastic" : piece.material===13 ? "wood" : "frame";
    const near=distance<=damageRange && speed>4.6;
    const flexible=material==="cloth" || material==="vinyl";
    const fabric=material==="cloth" && hit.clothTexel>=0;
    const puncture=material==="vinyl" && !prop.leaking && near;
    const torn=fabric && near;
    const tentFrame=prop.kind==="tent" && piece.name==="frame";
    const frame=material==="frame" && Boolean(structures[prop.kind]) && (prop.kind!=="tent" || tentFrame);
    const plastic=material==="plastic" && prop.kind==="table";
    const proximity=1-smooth(.76,6.65,distance/damageReach);
    const power=(tentFrame ? mix(.22,1,proximity) : proximity)*clamp((speed-3.4)/9.8,0,1)*mix(.48,1,incidence);
    const tableLoad=prop.kind==="table" ? mix(.19,1,proximity)*smooth(4.6,23,speed)*mix(.41,1,incidence) : 0;
    const tableFrame=material==="frame" && prop.kind==="tableFrame";
    const metal=(piece.material===0 && (frame || tableFrame || prop.kind==="flask"))
      || (piece.material===15 && (frame || prop.kind==="key" || prop.kind==="bell" || kitchenMetal.has(prop.kind)));
    const sparks=(frame || tableFrame) && speed>2.0
      ? mix(.27,1.12,proximity)*clamp(speed/11,.15,1)*mix(.57,1,incidence) : 0;
    const bent=(frame || plastic) && power>.095 && (!tentFrame || !prop.collapse);
    const broken=plastic && near && power>.53;
    if(flexible || broken) {
      const state=pieceState(prop,piece), radius=material==="vinyl" ? .33 : material==="cloth" ? .42 : .31;
      state.anchors.set([...at,radius],4);
      state.pressure.set([...localNormal,0],4);
      state.tapAge=0;
      state.tapDepth=material==="vinyl" ? .17 : material==="cloth" ? .19 : .028;
      if(torn) cutCloth(state,hit,velocity,distance);
      if(puncture || broken) {
        state.holes.set([...at,puncture ? .104 : mix(.075,.133,power)],4*(state.holeAt++%cutoutLayout.slots));
      }
    }
    if(puncture) prop.leaking=true;
    if(prop.small && (prop.support || tableItems.has(prop.kind)) && speed>2.35) kickSmall(hit,velocity,speed,incidence);
    if(prop.kind==="desk" && !prop.flight && speed>3.2) {
      const away=unit([velocity[0],0,velocity[2]]), pace=mix(.25,2.8,power);
      prop.vx+=away[0]*pace;
      prop.vz+=away[2]*pace;
      scatterTable(world,prop,away,.38+pace*.84);
      knock(prop,away[0],away[2],speed*.28);
    }
    if(bent) {
      if(tentFrame) damageTentFrame(hit,velocity,power);
      else bendStructure(hit,velocity,power,frame);
    }
    if(prop.mass && !prop.occupied && (prop.kind==="tube" || sparks || bent || tableLoad || (near && prop.kind==="chair"))) {
      const slide=[velocity[0]-normal[0]*.75,0,velocity[2]-normal[2]*.75];
      const away=unit(Math.hypot(slide[0],slide[2])>.06 ? slide : [hit.at[0]-prop.x,0,hit.at[2]-prop.z]);
      const push=prop.kind==="tube" ? (puncture ? 1.05 : 1.65)
        : tableLoad ? .11+tableLoad*.93
        : frame ? (prop.kind==="chair" ? mix(.17,2.25,power) : mix(.06,.88,power))
        : prop.kind==="chair" ? .47 : .19+power*.44;
      prop.vx=clamp(prop.vx+away[0]*push,-2.4,2.4);
      prop.vz=clamp(prop.vz+away[2]*push,-2.4,2.4);
      prop.spin+=clamp((hit.at[0]-prop.x)*away[2]-(hit.at[2]-prop.z)*away[0],-.7,.7)*push;
      if(frame && prop.kind==="chair" && power>.44) prop.hopVelocity=Math.max(prop.hopVelocity??0,.56+.85*power);
      if(tableLoad>.41) {
        scatterTable(world,prop,away,.46+tableLoad*.92);
        knock(prop,away[0],away[2],2.09+2.55*tableLoad);
      }
    }
    if(broken) {
      for(let i=0;i<8;i++) {
        const a=rng()*Math.PI*2, speed=mix(.41,2.5,rng());
        world.chips.push({mesh:world.chipMeshes[i%world.chipMeshes.length],at:plus(hit.at,times(normal,.036)),
          velocity:[Math.cos(a)*speed+normal[0]*.6,mix(.56,2.27,rng()),Math.sin(a)*speed+normal[2]*.6],
          scale:mix(.53,1.17,rng()),angle:rng(),spin:a,turn:mix(4.6,15.9,rng())});
      }
      if(world.chips.length>60) world.chips.splice(0,world.chips.length-60);
    }
    let fractured=false;
    if(tableLoad) {
      prop.stress=(prop.stress??0)+tableLoad*(piece.group==="top" ? .79 : 1.13);
      if(prop.stress>=tableStrength) {
        fractured=breakTable(world,prop,velocity);
      }
    }
    return {material,metal,puncture,torn,broken:broken || fractured,bent,sparks};
  }

  function target(world,player,cam,chairOnly=false) {
    let best=null, score=-Infinity;
    for(const prop of world.props) {
      if(!prop.mass || prop.picked || prop.broken || prop.flight || prop.occupied
        || (chairOnly && !canSit(prop)) || (prop.available && !prop.available())) continue;
      const dx=prop.x-player.x,dz=prop.z-player.z, dist=Math.hypot(dx,dz);
      if(prop.small) {
        const to=minus([prop.x,prop.y+(prop.restRoll ? .025 : prop.height*.44),prop.z],cam.at);
        const length=Math.hypot(...to), gaze=dot(cam.forward,unit(to));
        if(length>2.26 || gaze<.935) continue;
        const limit=launcherRest[prop.kind] ? prop.rz*.77 : Math.max(.12,prop.rx*.94)+length*.042;
        if(length*Math.sqrt(Math.max(0,1-gaze*gaze))>limit) continue;
        const rank=gaze*1.25-length*.31+.68;
        if(rank>score && !Valley.roadview.trace(world.road,cam.at,plus(cam.at,to),.99)) { best=prop;score=rank; }
        continue;
      }
      if(dist>2.15 || prop.y>player.feet+.78 || prop.y<player.feet-1.04) continue;
      const aim=dot(unit([dx,0,dz]),unit([cam.forward[0],0,cam.forward[2]]));
      const mid=prop.kind==="tube" ? point(prop.matrix,[0,prop.height*.5,0]) : [prop.x,prop.y+prop.height*.5,prop.z];
      const gaze=dot(cam.forward,unit(minus(mid,cam.at)));
      if(dist>.72 && (aim<.57 || gaze<.35)) continue;
      const rank=gaze*1.25-dist*.31;
      if(rank>score && !Valley.roadview.trace(world.road,cam.at,mid,.99)) { best=prop;score=rank; }
    }
    return best;
  }

  function supportOn(prop,table,localAt,yaw,pitch=0) {
    const [x,y,z]=tablePoint(table,localAt);
    Object.assign(prop,{x,y,z,yaw,picked:false,flight:null,tipped:false,tilt:0,vx:0,vz:0,spin:0,
      restRoll:launcherRoll[prop.kind]??0,support:{table,local:localAt,yaw:yaw-table.yaw,pitch}});
    prop.matrix=pose(prop,0,[]);
  }

  function surfacePlacement(world,prop,table,at,yaw) {
    const surface=table.surface;
    if(!surface || !prop.small || table===prop) return null;
    const [px,,pz]=local(table.matrix,at);
    const bend=bendPoint(table,[px,surface.top,pz]), x=2*px-bend[0], z=2*pz-bend[2];
    const plan={table,local:[x,surface.top+(launcherRest[prop.kind]??0),z],yaw:yaw-table.yaw};
    return surfaceAvailable(world,prop,plan) ? plan : null;
  }

  function surfaceAvailable(world,prop,{table,local:[x,,z]}) {
    const surface=table.surface;
    if(!surface || table.picked || table.broken || table.flight || table.tipped || table.tilt>.1) return false;
    if(Math.abs(x)+prop.rx*.83>surface.rx || Math.abs(z)+prop.rz*.83>surface.rz) return false;
    if(world.props.some(other=>{
      if(other===prop || other.support?.table!==table) return false;
      const [ox,,oz]=other.support.local;
      return Math.abs(ox-x)<other.rx+prop.rx && Math.abs(oz-z)<other.rz+prop.rz;
    })) return false;
    return true;
  }

  function placement(world,prop,plan,time=0,ripples=[]) {
    const preview={kind:prop.kind,air:prop.air,small:prop.small,phase:prop.phase,tilt:0,tipX:0,tipZ:1,
      restRoll:launcherRoll[prop.kind]??0};
    if(plan.table) {
      if(!surfaceAvailable(world,prop,plan)) return null;
      [preview.x,preview.y,preview.z]=tablePoint(plan.table,plan.local);
      preview.yaw=plan.table.yaw+plan.yaw;
      preview.bed=preview.y;
    } else {
      const {x,z,yaw,reach}=plan;
      if(!fits(world,prop,x,z,false,reach)) return null;
      Object.assign(preview,{x,z,yaw,bed:woodOrBed(world,x,z,reach)});
      preview.y=restHeight(preview,preview.bed,preview.x,preview.z);
    }
    return {x:preview.x,y:preview.y,z:preview.z,yaw:preview.yaw,bed:preview.bed,restRoll:preview.restRoll,matrix:pose(preview,time,ripples)};
  }

  function commitPlacement(prop,plan,rest,lowered=false) {
    if(!rest) return false;
    if(plan.table) {
      supportOn(prop,plan.table,plan.local,rest.yaw);
      prop.matrix=rest.matrix;
    } else {
      const {x,y,z,yaw}=rest;
      Object.assign(prop,rest,{bedX:x,bedZ:z,picked:false,tipped:false,tilt:0,vx:0,vz:0,spin:0,
        support:null,flight:null,hop:0,hopVelocity:0,groundContact:null});
      fallIfBent(prop);
      if(limpTube(prop)) {
        toss(prop,[x,y+(lowered ? .026 : .29),z],[0,-.46,0],yaw,.16);
        prop.flight.lowered=true;
        if(lowered) prop.matrix=rest.matrix;
      }
    }
    return true;
  }

  function place(world,prop,x,z,yaw,reach) {
    const plan={x,z,yaw,reach}, rest=placement(world,prop,plan);
    return Boolean(rest && commitPlacement(prop,plan,rest));
  }

  function placeOnSurface(world,prop,table,at,yaw) {
    const plan=surfacePlacement(world,prop,table,at,yaw);
    return Boolean(plan && commitPlacement(prop,plan,placement(world,prop,plan)));
  }

  Valley.props={compile,make,chips,partsAt,matrixAt,bendPoint,objects,trace,push,tick,strike,target,place,placeOnSurface,
    surfacePlacement,placement,commitPlacement,supportOn,toss,overlap,settle,blast,canSit};
})();
