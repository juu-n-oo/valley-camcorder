"use strict";

(() => {
  const { Builder, random, smooth, mix, unit, rgb, plus, minus, times, cross, dot } = Valley;
  const gaussian = (x, z, cx, cz, sx, sz) => Math.exp(-(((x-cx)/sx)**2 + ((z-cz)/sz)**2));
  const { within, waterLevel, waterStation, weir, layout, bank, center, width, shoreDistance, mapScale } = Valley.roadLayout;
  const shore = (x, z) => shoreDistance(x,z)
    + .41*Math.sin(z*.258+x*.22) + .18*Math.sin(z*.81-x*.26);
  const trail = layout();

  function naturalHeight(x, z, s) {
    const u=(x-center(z))/mapScale;
    x/=mapScale;
    z/=mapScale;
    s/=mapScale;
    const divide = 55*gaussian(u,z,1,-455,100,75)*smooth(367,442,-z)
      + 63*gaussian(u,z,-15,624,105,82)*smooth(501,607,z);
    if (s < 0) {
      const depth = -s;
      const ford = .84*Math.exp(-(((z-36)/10.5)**2));
      const riffles = Math.sin(x*.96+z*.53)*Math.cos(z*.38-x*.26)*.095;
      const pool = (1.82*gaussian(u,z,-2,-15,15,49)+.67*gaussian(u,z,5,-62,12,37))
        *smooth(2.7,9,depth)*(1-smooth(15,28,z));
      return -.033 - .30*(1-Math.exp(-depth*.72))
        - (1.30-ford)*(1-Math.exp(-depth*depth*.033))
        + riffles * smooth(0,2.5,depth) - pool + divide;
    }
    const swell = .08*Math.sin(x*.85+z*.36) + .065*Math.cos(z*.91-x*.32);
    const beach = .035 + .215*(1-Math.exp(-s*.64)) + .034*s + swell*smooth(0,2,s);
    const ridge = 64*gaussian(u,z,-103,-90,70,136) + 99*gaussian(u,z,-151,-243,97,123)
      + 68*gaussian(u,z,102,-67,76,121) + 94*gaussian(u,z,151,-236,93,132)
      + 60*gaussian(u,z,-109,108,78,103)+49*gaussian(u,z,94,134,66,119)
      + 81*gaussian(u,z,-122,324,89,104)+92*gaussian(u,z,119,338,92,126)
      + 71*gaussian(u,z,-128,502,96,114)+78*gaussian(u,z,102,491,75,117);
    const folds = 3.9*Math.sin(u*.161+z*.068) + 2.3*Math.cos(z*.148-u*.103)
      + .66*Math.sin(z*.81+x*.58) + .51*Math.cos(x*.73-z*1.01);
    const shoulders = 21*gaussian(u,z,-52,-175,34,61)+37*gaussian(u,z,42,-158,40,71)
      + 23*gaussian(u,z,51,225,43,86)+25*gaussian(u,z,-59,273,39,87);
    const ravines = 4.2*Math.sin(z*.069+u*.105)+3.0*Math.sin(z*.151-u*.058)+1.18*Math.cos(z*.34+u*.20);
    const foothills=(ridge+folds*.27)*mix(.22,.53,smooth(72,184,s))*smooth(12,100,s);
    const rolls=(shoulders*.24+ravines*.14)*smooth(6,42,s);
    return beach+foothills+rolls+divide;
  }

  function height(x,z) {
    if(Valley.practice.inScene(x,z)) return Valley.practice.height(x,z);
    const s=shore(x,z),station=waterStation(x,z);
    let ground=naturalHeight(x,z,s);
    if(station<weir.crest) ground+=waterLevel(x,z)*(1-smooth(-.2,1.55,s));
    if(station>weir.toe-.42 && station<weir.crest+.38 && s<.3) {
      const apron=smooth(weir.toe-.42,weir.toe+.12,station)*(1-smooth(weir.crest-.1,weir.crest+.38,station));
      ground=mix(ground,Math.max(ground,waterLevel(x,z)-.115),apron);
    }
    return trail.grade(x,z,ground);
  }

  function wetAt(x,z,y) {
    const level=waterLevel(x,z);
    return y<level-.025 && height(x,z)<level-.022;
  }

  function grid(min, lo, hi, max, fine, coarse) {
    const axis = [];
    for (let v = lo-coarse; v >= min; v -= coarse) axis.unshift(v);
    const count = Math.ceil((hi-lo)/fine);
    for (let i = 0; i <= count; i++) axis.push(mix(lo,hi,i/count));
    for (let v = hi+coarse; v <= max; v += coarse) axis.push(v);
    return axis.map(v=>v*mapScale);
  }

  function shadeTerrain(builder, xs, zs, blocks, campsite) {
    const light = new Float32Array(xs.length*zs.length).fill(1);
    function shade(x,z,rx,rz,strength) {
      const startX = xs.findIndex(v=>v>=x-rx), startZ = zs.findIndex(v=>v>=z-rz);
      if (startX < 0 || startZ < 0) return;
      for (let j=startZ; j<zs.length && zs[j]<z+rz; j++) {
        for (let i=startX; i<xs.length && xs[i]<x+rx; i++) {
          const r = Math.hypot((xs[i]-x)/rx,(zs[j]-z)/rz);
          const at = j*xs.length+i;
          light[at] = Math.min(light[at],1-strength*(1-smooth(.23,1,r)));
        }
      }
    }
    for (const b of blocks) {
      const tree = b.tree, top = b.top-height(b.x,b.z);
      if (top <= 0) continue;
      const h = Math.min(top,tree ? 8 : 11);
      if (tree) {
        shade(b.x+h*.58,b.z+h*.46,1.23+h*.24,1.18+h*.24,.28);
      } else {
        shade(b.x+h*.25,b.z+h*.28,b.rx*1.13+h*.56,b.rz*1.13+h*.50,.32);
      }
    }
    for (const {x,z,rx,rz,strength} of campsite) shade(x,z,rx,rz,strength);
    for (let i=0; i<light.length; i++) {
      const p = i*11, value = light[i];
      const ground = builder.vertices[p+1];
      const shade = mix(1,value,smooth(-.45,.28,ground));
      for (let c=8; c<11; c++) builder.vertices[p+c] *= shade;
    }
  }

  function landscape(blocks, campsite) {
    const terrain = new Builder();
    const xs = grid(-630,-372,76,455,1.24,7.0);
    const zs = grid(-510,-310,519,665,1.25,7.0);
    const levels=new Float32Array(xs.length*zs.length);
    for(let j=0;j<zs.length;j++) for(let i=0;i<xs.length;i++) levels[j*xs.length+i]=height(xs[i],zs[j]);
    for (let j = 0; j < zs.length; j++) {
      const z=zs[j], back=Math.max(0,j-1), ahead=Math.min(zs.length-1,j+1);
      for (let i = 0; i < xs.length; i++) {
        const x=xs[i], y=levels[j*xs.length+i], s=shore(x,z);
        const left=Math.max(0,i-1),right=Math.min(xs.length-1,i+1);
        const n=unit([(levels[j*xs.length+left]-levels[j*xs.length+right])/(xs[right]-xs[left]),1,
          (levels[back*xs.length+i]-levels[ahead*xs.length+i])/(zs[ahead]-zs[back])]);
        const outer = smooth(92,130,-z)+smooth(79,119,z);
        const woods=Math.max(smooth(4.1,9.1,s + .76*Math.sin(x*.81+z*.48)),smooth(1.0,4.0,y)*outer);
        const woodland=mix(woods,Math.min(woods,.16),trail.courtyard(x,z));
        const tint = .94 + .07*Math.cos(x*.125+z*.19)*Math.sin(z*.071-x*.16);
        terrain.vertex([x,y,z],n,[woodland,0],[tint,tint,tint]);
      }
    }
    shadeTerrain(terrain,xs,zs,blocks,campsite);
    return {terrain,columns:xs.length,rows:zs.length};
  }

  function boundedMesh(renderer,shape,material,margin=0) {
    const mesh=renderer.mesh(shape,material);
    if(margin) {
      const {min,max}=mesh.bounds;
      mesh.bounds={min:min.map(value=>value-margin),max:max.map(value=>value+margin)};
    }
    return mesh;
  }

  function waterMeshes(renderer) {
    const xs=grid(-426,-337,64,78,1.12,2.4);
    const stations=grid(-470,-344,531,615,1.19,2.4).concat(weir.toe,weir.crest).sort((a,b)=>a-b);
    const columns=xs.length, rows=stations.length, span=16, meshes=[];
    const depths=new Float64Array(columns*rows);
    for(let j=0;j<rows;j++) for(let i=0;i<columns;i++) {
      const x=xs[i], z=stations[j]+(x-weir.x)*weir.skew;
      depths[j*columns+i]=height(x,z)-waterLevel(x,z);
    }
    for(let row=0;row<rows-1;row+=span) for(let column=0;column<columns-1;column+=span) {
      const width=Math.min(span+1,columns-column), length=Math.min(span+1,rows-row);
      const shape=new Builder(), corners=new Int32Array(width*length).fill(-1);
      function vertex(i,j) {
        const corner=(j-row)*width+i-column;
        if(corners[corner]===-1) {
          const x=xs[i], z=stations[j]+(x-weir.x)*weir.skew;
          corners[corner]=shape.vertex([x,waterLevel(x,z),z],[0,1,0],[depths[j*columns+i],0]);
        }
        return corners[corner];
      }
      for(let j=row+1;j<row+length;j++) {
        if(stations[j-1]>=weir.toe && stations[j]<=weir.crest) continue;
        for(let i=column+1;i<column+width;i++) {
          const index=j*columns+i;
          if(Math.min(depths[index-columns-1],depths[index-columns],depths[index-1],depths[index])>=.14) continue;
          const a=vertex(i-1,j-1), b=vertex(i,j-1), c=vertex(i-1,j), d=vertex(i,j);
          shape.indices.push(a,c,b,b,c,d);
        }
      }
      if(shape.indices.length) meshes.push(boundedMesh(renderer,shape,0,.25));
    }
    return meshes;
  }

  function terrainMeshes(renderer,land) {
    const {terrain,columns,rows}=land, meshes=[], span=32;
    for(let z=0;z<rows-1;z+=span) for(let x=0;x<columns-1;x+=span) {
      const tile=new Builder(), width=Math.min(span+1,columns-x), length=Math.min(span+1,rows-z);
      for(let j=0;j<length;j++) {
        const start=((z+j)*columns+x)*11;
        tile.vertices.push(...terrain.vertices.slice(start,start+width*11));
        if(j===0) continue;
        for(let i=1;i<width;i++) {
          const d=j*width+i, c=d-1, b=d-width, a=b-1;
          tile.indices.push(a,c,b,b,c,d);
        }
      }
      meshes.push(boundedMesh(renderer,tile,1));
    }
    return meshes;
  }

  function boulder(builder, rng, at, dims, angle, color, shear = .12, colliders) {
    const [rx,ry,rz] = dims;
    const choice=rng(), tilt=(rng()-.5)*.19;
    // Preserve the terrain generator's seeded placements when swapping the mesh.
    for(let i=0;i<55;i++) rng();
    const variety=ry<Math.min(rx,rz)*.59 && choice<.64 ? "river" : ["ledge","weathered","cleft"][Math.floor(choice*3)];
    const name="granite_"+variety;
    const co = Math.cos(angle), si = Math.sin(angle);
    const matrix=[rx*co,ry*tilt,rx*si,0, rx*shear*co-rz*.055*si,ry,rx*shear*si+rz*.055*co,0,
      -rz*si,0,rz*co,0,...at,1];
    stampStone(builder,name,matrix,color,colliders,Math.max(rx,rz)<.44);
  }

  function stampStone(builder,name,matrix,color,colliders,small=false) {
    const {get,append}=Valley.blenderAssets;
    const proxy=name+"_collision";
    append(builder,get(small ? proxy : name).parts[0].shape,matrix,color);
    if(!colliders) return null;
    const simplified=new Builder();
    append(simplified,get(proxy).parts[0].shape,matrix);
    const collision=meshCollider(simplified,0);
    colliders.push(collision);
    return collision;
  }

  function meshCollider(builder, first, offsets) {
    const faces = [];
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    const vertex = i => {
      const index=builder.indices[i], start=index*11;
      const p=Array.from(builder.vertices.slice(start,start+3));
      if(offsets) for(let axis=0;axis<3;axis++) p[axis]+=offsets[index*3+axis];
      return p;
    };
    for (let i=first; i<builder.indices.length; i+=3) {
      const a = vertex(i), b = vertex(i+1), c = vertex(i+2);
      const ab = minus(b,a), ac = minus(c,a);
      faces.push({a,ab,ac,normal:unit(cross(ab,ac))});
      for (let axis=0; axis<3; axis++) {
        min[axis] = Math.min(min[axis],a[axis],b[axis],c[axis]);
        max[axis] = Math.max(max[axis],a[axis],b[axis],c[axis]);
      }
    }
    return {min,max,faces};
  }

  function rocks(rng, tileAt, blocks, colliders) {
    const pink = rgb(0xd1bdb0), gray = rgb(0xd6d6ce), cool = rgb(0xb8c0b7);
    const palette = [pink, gray, cool, [1,1,1], [1,1,.99]];
    // The joints follow the right bank, with a few detached towers in front.
    const pillars = [
      [-46,4.1,2.6,3.9,9.6], [-43,2.6,1.9,2.7,7.5], [-39,4.4,2.3,3.1,13.2],
      [-36.6,2.55,1.7,2.2,11.7], [-33.9,2.9,1.62,2.2,19.9], [-31.1,2.3,1.41,2.1,18.4],
      [-28.3,2.45,1.30,2.0,15.7], [-25,4.7,2.5,3.4,10.2], [-20,3.9,2.0,2.5,7.7],
      [-17,1.8,1.5,2.1,4.3], [-13,3.2,2.8,2.8,5.7], [-37,7.9,4.1,5.5,17.3],
      [-29,8.1,3.6,4.6,15.4], [-22,7.3,3.9,3.7,11.0]
    ];
    const ledges = [];
    for(const [pick,[station,offset,rx,rz,peak]] of pillars.entries()) {
      const z=station*mapScale;
      const x = center(z)+width(z)+offset, base = -.38;
      const {stone}=tileAt(x,z);
      const count = Math.max(2,Math.ceil(peak / (peak > 12 ? 4.05 : 2.6)));
      const rotation = (rng()-.5)*1.05;
      let y = base;
      for (let i = 0; i < count; i++) {
        const layer = (peak/count)*(.69 + rng()*.64);
        for(let sample=0;sample<62;sample++) rng();
        y += layer*.963;
      }
      const half=(y-base)*.5,s=Math.sin(rotation),c=Math.cos(rotation);
      const matrix=[rx*c,0,rx*s,0,0,half,0,0,-rz*s,0,rz*c,0,x,base+half,z,1];
      const tint=pick%3===0 ? [1.16,1.10,1.03] : pick%3===1 ? [1.12,1.12,1.08] : [1.07,1.10,1.09];
      const collision=stampStone(stone,"cliff_face_"+pick%3,matrix,tint,colliders);
      const tx=x+rx*.1, start=collision.max[1]+1, end=collision.min[1]-.1;
      const safeTop=meshHit([collision],[tx,start,z],[tx,end,z],[0,end-start,0],1,"rock")?.at[1]??y;
      blocks.push({ x,z,rx:rx*.91,rz:rz*.93,top:y });
      ledges.push([tx,safeTop-.13,z,rx]);
    }
    const near = [
      [-1,15,6.4,1.38,.65,1.07], [-1,11,2.1,1.07,.43,.79], [-1,-6,1.1,1.59,.74,1.23],
      [-1,-9,1.8,1.3,.57,1.02], [-1,-21,.6,1.9,.7,1.55], [1,8,2.1,1.56,.96,1.31],
      [-1,28,2.9,1.43,.52,.87], [1,-8,0,2.2,.74,1.48], [1,-52,.7,2.8,1.19,2.2],
      [-1,-51,.2,2.9,1.18,2.6], [-1,-53,1.5,1.75,.83,2.25], [1,27,4.1,1.6,.53,1.03]
    ];
    for (const [side,z,s,rx,ry,rz] of near) {
      const x = center(z) + side*(width(z)+s);
      const y = height(x,z)+ry*.32;
      const {stone}=tileAt(x,z);
      boulder(stone,rng,[x,y,z],[rx,ry,rz],rng()*Math.PI,palette[Math.floor(rng()*palette.length)],.12,colliders);
      blocks.push({x,z,rx:rx*.83,rz:rz*.84,top:y+ry*.93});
    }
    for (let i = 0; i < 550; i++) {
      const side = rng() < .71 ? -1 : 1, z = mix(-89,53,rng());
      const x = center(z) + side*(width(z)+mix(-2.6,9.5,rng()));
      const large = rng() < .16;
      const size = large ? .19+rng()*.35 : .033+rng()*.12;
      if(trail.clear(x,z,size+.28)) continue;
      const y = height(x,z)+size*.14;
      const {stone}=tileAt(x,z);
      boulder(stone,rng,[x,y,z],[size,size*(.27+rng()*.39),size*(.66+rng()*.64)],
        rng()*6.283, times(palette[Math.floor(rng()*palette.length)],.79+rng()*.38),.12,large ? colliders : null);
    }
    return ledges;
  }

  function canopy(builder, at, wide, high, angle, tint, lean) {
    const u = [Math.cos(angle)*wide*.5,0,Math.sin(angle)*wide*.5];
    const v = [-Math.sin(angle)*lean,high*.5,Math.cos(angle)*lean];
    builder.quad([plus(plus(at,times(u,-1)),times(v,-1)),plus(plus(at,u),times(v,-1)),
      plus(plus(at,u),v),plus(plus(at,times(u,-1)),v)],tint);
  }

  function tree(rng, bark, leaves, x, z, y, h, dense, woodColliders, recordTree) {
    const first=bark.indices.length;
    const radius = h*(.013+rng()*.010);
    const leanX = (rng()-.5)*h*.19, leanZ = (rng()-.5)*h*.16;
    const trunk = rgb(rng()<.5 ? 0xadad9d : 0xbab6a7);
    const hue = [.74+rng()*.28,.83+rng()*.18,.69+rng()*.26];
    const top = [x+leanX,y+h*.90,z+leanZ];
    const fork = [x+leanX*.52,y+h*.47,z+leanZ*.51];
    const root=[x,y-.27,z];
    bark.cylinder(root,fork,radius,radius*.70,trunk,7,false);
    bark.cylinder(fork,top,radius*.70,radius*.16,trunk,6,false);
    const angle = rng()*6.283;
    for (let i = 0; i < (dense ? 5 : 3); i++) {
      const p = angle + i*2.4;
      const spread = i===0 ? .06 : .17 + rng()*.21;
      const topY = i===0 ? h*.94 : h*(.49+rng()*.35);
      const at = [x+leanX*.75+Math.cos(p)*h*spread,y+topY,z+leanZ*.75+Math.sin(p)*h*spread];
      const wide = h*(.47+rng()*.30), high = wide*(.46+rng()*.22);
      if (i) bark.cylinder(fork,[at[0],at[1]-.07*h,at[2]],radius*.48,radius*.07,trunk,5,false);
      const tint = times(hue,(i===0 ? 1.07 : .87)+rng()*.17);
      canopy(leaves,at,wide,high,p,tint,high*.10);
      canopy(leaves,at,wide*.92,high*.95,p+Math.PI*.48,tint,high*-.16);
      if (dense) canopy(leaves,[at[0],at[1]+high*.13,at[2]],wide*.94,high*.70,p+.77,tint,high*.44);
    }
    if (woodColliders) woodColliders.push(meshCollider(bark,first));
    recordTree(x,y,z,h,leanX,leanZ,{root,tip:fork,base:radius,end:radius*.70,sides:7});
    return radius;
  }

  function sceneryTiles() {
    const tiles=new Map();
    function tileAt(x,z) {
      const key=`${Math.floor(x/28)},${Math.floor(z/28)}`;
      if(!tiles.has(key)) tiles.set(key,{stems:new Builder(),crowns:new Builder(),grass:new Builder(),litter:new Builder(),stone:new Builder()});
      return tiles.get(key);
    }
    function buildMeshes(renderer) {
      const meshes=[];
      for(const {stems,crowns,grass,litter,stone} of tiles.values()) {
        for(const [shape,material] of [[stems,3],[crowns,4],[grass,5],[litter,14],[stone,2]]) {
          if(shape.indices.length) meshes.push(boundedMesh(renderer,shape,material));
        }
      }
      tiles.clear();
      return meshes;
    }
    return {tileAt,buildMeshes};
  }

  function upland(renderer,rng,patches,recordTree) {
    const {tileAt,buildMeshes}=sceneryTiles();
    for (const [x0,x1,z0,z1,step] of [
      [-80,80,-327,-76,3.4],[-166,170,-428,-327,5.8],[-206,214,-501,-428,7.0],
      [-184,-80,-327,122,5.3],[80,189,-327,122,5.3],
      [-91,89,52,260,3.4],[-105,102,260,485,3.9],[-184,189,485,633,5.7],
      [-167,-91,122,485,5.7],[89,169,122,485,5.7]
    ]) {
      for (let z=z0;z<z1;z+=step) for (let x=x0;x<x1;x+=step) {
        const pz=(z+rng()*step)*mapScale,px=center(pz)+(x+rng()*step)*mapScale;
        const y=height(px,pz),s=shore(px,pz);
        if (y<.14 || (s<1.28 && y<.92) || trail.clear(px,pz,.98)) continue;
        const downstream = pz >= 52;
        const patch = (downstream ? .76 : .65)+.17*Math.sin(px*.13+pz*.065)+.13*Math.cos(pz*.28-px*.09);
        if (rng()>patch+.21) continue;
        const {stems,crowns}=tileAt(px,pz);
        const h=mix(3.05,9.3,rng()**.75)*mix(1,.81,smooth(50,126,y));
        if (step<3.8 && y<(downstream ? 5 : 13)) {
          tree(rng,stems,crowns,px,pz,y-.18,h,false,null,recordTree);
        } else {
          const wide=h*mix(.88,downstream ? 1.39 : 1.22,rng()), angle=rng()*6.283;
          const warmth=.5+.5*Math.sin(px*.23+pz*.17);
          const tint=times([mix(.69,.92,warmth),.94,mix(.84,.65,warmth)],mix(.78,1.18,rng()));
          if(pz>-356*mapScale && pz<546) {
            const root=[px,y-.75,pz], tip=[px+.15,y+h*.78,pz], base=h*.018, end=h*.008;
            stems.cylinder(root,tip,base,end,rgb(0xa39b86),4,false);
            recordTree(px,y,pz,h,.15,0,{root,tip,base,end,sides:4});
          }
          const at=[px,y+h*.63-.38,pz];
          canopy(crowns,at,wide,h*.81,angle,tint,h*.09);
          canopy(crowns,at,wide*.95,h*.78,angle+1.57,tint,-h*.09);
          canopy(crowns,[px+.33,y+h*.91-.38,pz-.25],wide*.74,h*.57,angle+.78,times(tint,1.12),h*.20);
        }
      }
    }

    for(let i=0;i<386;i++) {
      const z=mix(43*mapScale,552,rng()), side=rng()<.5 ? -1 : 1;
      const x=center(z)+side*(width(z)+mix(.34,10.1,rng()**1.8));
      const y=height(x,z);
      if(y<.06 || y>5.5 || shore(x,z)<.24 || trail.clear(x,z,.69)) continue;
      const {crowns}=tileAt(x,z);
      const angle=rng()*6.283, h=mix(.53,2.2,rng()**1.24), w=h*mix(1.8,2.6,rng());
      const tint=times([.77,.88,.66],mix(.73,1.04,rng()));
      canopy(crowns,[x,y+h*.46,z],w,h,angle,tint,.14*h);
      canopy(crowns,[x+.18,y+h*.53,z+.21],w*.82,h*1.02,angle+1.57,tint,-.18*h);
    }

    function grassTuft(x,z,y,rng) {
      const {grass}=tileAt(x,z);
      const dry=rng()<.33+.15*Math.sin(x*.27+z*.32);
      const color=rgb(dry ? (rng()<.5 ? 0x938051 : 0xaf9b64) : (rng()<.5 ? 0x4f602e : 0x65743a));
      const scale=mix(.30,.94,rng())*(z<-70 ? 1.35 : 1);
      const blades=z<-66 || z>59 || y>13 ? 4 : 7;
      let tallest=0;
      for (let j=0;j<blades;j++) {
        const px=x+(rng()-.5)*.49,pz=z+(rng()-.5)*.49, py=height(px,pz)-.025;
        const a=rng()*6.283, vx=Math.cos(a), vz=Math.sin(a), h=scale*mix(.41,1.07,rng());
        tallest=Math.max(tallest,h);
        const w=scale*mix(.009,.046,rng()), lean=h*mix(.20,.55,rng()), tint=times(color,mix(.64,1.23,rng()));
        const lo=[px-vz*w,py,pz+vx*w], ro=[px+vz*w,py,pz-vx*w];
        const l=[px+vx*lean*.33-vz*w*.62,py+h*.61,pz+vz*lean*.33+vx*w*.62];
        const r=[px+vx*lean*.33+vz*w*.62,py+h*.61,pz+vz*lean*.33-vx*w*.62];
        const n=unit([vx,.07,vz]);
        grass.quad([lo,ro,r,l],tint,n,[[0,0],[1,0],[1,.61],[0,.61]]);
        const v=grass.vertices.length/11;
        grass.vertex(l,n,[0,.61],tint);
        grass.vertex(r,n,[1,.61],tint);
        grass.vertex([px+vx*lean,py+h,pz+vz*lean],n,[.5,1],times(tint,1.13));
        grass.indices.push(v,v+1,v+2);
      }
      return tallest;
    }

    for (let i=0;i<4940;i++) {
      const downstream=i>=3700;
      const z=downstream ? mix(54*mapScale,552,rng()) : mapScale*mix(-343,63,rng()), side=rng()<.5 ? -1 : 1;
      const x=center(z)+side*(width(z)+mix(downstream ? 1.8 : 4.0,downstream ? 29 : 44,rng()**1.56));
      const y=height(x,z);
      if(y>=.17 && y<=39 && !trail.clear(x,z,.22)) {
        const h=grassTuft(x,z,y,rng);
        addGrassContact(patches,x,z,.45,h);
      }
    }

    const siteRandom=random(82149);
    for(const site of [trail.sites.pension,trail.sites.diner,trail.sites.info,trail.sites.shrine,
      trail.sites.deckInn,trail.sites.pavilion,trail.sites.amseo,trail.temple]) {
      for(let i=0;i<260;i++) {
        const a=siteRandom()*Math.PI*2,r=mix(6,28,siteRandom()**1.2);
        const x=site.x+Math.cos(a)*r,z=site.z+Math.sin(a)*r;
        if(shore(x,z)<.68 || trail.clear(x,z,.48)) continue;
        const h=grassTuft(x,z,height(x,z),siteRandom);
        addGrassContact(patches,x,z,.49,h);
      }
    }

    const leaves = [0x644b33,0x8f714c,0xa1885e,0x5a4433,0x7a5537,0xb0a078].map(rgb);
    for (let i=0;i<11600;i++) {
      const z=mix(-89,56,rng()), side=rng()<.5 ? -1 : 1;
      const x=center(z)+side*(width(z)+mix(3.9,30,rng()**1.75));
      if (height(x,z)<.17 || trail.clear(x,z,.14)) continue;
      const {litter}=tileAt(x,z);
      const a=rng()*6.283,u=Math.cos(a),v=Math.sin(a);
      const l=mix(.034,.137,rng()), w=l*mix(.15,.49,rng());
      const tint=leaves[Math.floor(rng()*leaves.length)], crest=.017+rng()*.025;
      const at=(along,across,lift)=>{
        const px=x+u*along+v*across,pz=z+v*along-u*across;
        return [px,height(px,pz)+lift,pz];
      };
      const tip=at(l,0,.015), stem=at(-l,0,.021), mid=at(0,0,crest);
      litter.triangle(stem,at(0,-w,.009),mid,tint);
      litter.triangle(at(0,-w,.009),tip,mid,tint);
      litter.triangle(stem,mid,at(0,w,.010),times(tint,.79));
      litter.triangle(mid,tip,at(0,w,.010),times(tint,.82));
    }

    for(let i=0;i<510;i++) {
      const z=mix(-77,53,rng()), side=rng()<.5 ? -1 : 1;
      const x=center(z)+side*(width(z)+mix(5.0,23,rng()**1.34));
      const y=height(x,z);
      if(y<.18 || y>9 || trail.clear(x,z,.56)) continue;
      const {grass}=tileAt(x,z);
      const scale=mix(.27,.71,rng()), start=rng()*6.283, green=rgb(rng()<.65 ? 0x5c7037 : 0x697943);
      for(let leaf=0;leaf<5;leaf++) {
        const a=start+leaf*1.256, dx=Math.cos(a), dz=Math.sin(a), length=scale*mix(.62,1.15,rng());
        const at=t=>[x+dx*length*t,y+scale*(.08+.76*Math.sin(t*2.08)),z+dz*length*t];
        const a0=at(0), a1=at(.56), a2=at(1), rib=.011*scale;
        grass.quad([plus(a0,[dz*rib,0,-dx*rib]),plus(a0,[-dz*rib,0,dx*rib]),
          plus(a1,[-dz*rib,0,dx*rib]),plus(a1,[dz*rib,0,-dx*rib])],times(green,.83));
        grass.triangle(plus(a1,[dz*rib,0,-dx*rib]),plus(a1,[-dz*rib,0,dx*rib]),a2,green);
        for(let j=0;j<5;j++) {
          const t=.24+j*.136, origin=at(t), reach=scale*.25*(1-t*.84);
          const mid=plus(origin,[dx*reach*.45,-.015,dz*reach*.45]);
          for(const wing of [-1,1]) {
            const tip=plus(origin,[reach*(dx*.83-dz*wing),-.018,reach*(dz*.83+dx*wing)]);
            grass.triangle(origin,mid,tip,times(green,mix(.79,1.14,rng())));
          }
        }
      }
    }
    return buildMeshes(renderer);
  }

  function upstreamRocks(rng, tileAt) {
    for (let i=0;i<91;i++) {
      const z=mapScale*mix(-355,-116,rng()), side=rng()<.60 ? -1 : 1;
      const x=center(z)+side*(width(z)+mix(-.92,4.8,rng()**1.56));
      const h=mix(.08,.86,rng()**2), y=height(x,z)+h*.21;
      boulder(tileAt(x,z).stone,rng,[x,y,z],[h*mix(1.15,2.55,rng()),h,h*mix(.93,2.42,rng())],rng()*6.283,
        rgb(i%3===0 ? 0xc1b5a0 : 0xaaa99b),.10);
    }
  }

  function streamBed(rng,tileAt) {
    const silt=[0x8c8772,0xa29c80,0x65675a,0xb2a78f].map(rgb);
    for(let i=0;i<510;i++) {
      const z=mix(-84,112,rng()), side=rng()<.5 ? -1 : 1;
      const x=center(z)+side*width(z)*mix(.16,.96,rng()**.43);
      const bed=height(x,z);
      if(bed>-.10) continue;
      const h=mix(.022,.19,rng()**2);
      boulder(tileAt(x,z).stone,rng,[x,bed-h*.20,z],[h*mix(1.4,3.7,rng()),h,h*mix(1.4,3.1,rng())],rng()*6.283,
        silt[Math.floor(rng()*silt.length)],.09);
    }
  }

  function riverLedges(rng,tileAt,blocks,colliders,campsite,boards) {
    const granite=[0xbfbab1,0xc6bca9,0x96988d,0xd2c7bb,0xa3a79b].map(rgb);
    const open=(x,z,r)=>!trail.clear(x,z,r*.81) && !campsite.some(p=>Math.hypot(x-p.x,z-p.z)<r+Math.min(1.4,Math.max(p.rx,p.rz))+.22)
      && !boards.some(p=>Math.hypot(x-p.x,z-p.z)<r+.46)
      && !blocks.some(b=>Math.hypot((x-b.x)/(b.rx+r+.14),(z-b.z)/(b.rz+r+.14))<1);
    const reachable=within;
    const shelves=[
      [-44,-1,-.51,2.0,.64,1.04],[-30,1,-1.0,2.36,.67,1.43],[-22,-1,-.28,2.18,.51,1.16],
      [-10,1,-.98,2.18,.61,1.30],[8,1,-.96,2.29,.68,1.35],[22,1,-.42,2.52,.78,1.46],
      [30,-1,-1.40,2.25,.52,1.16],[35,1,-.34,2.95,.73,1.55],[39,-1,-.30,2.48,.68,1.12],
      [45,1,-.48,3.4,.94,2.3],[52,-1,.38,2.7,.78,1.47],[55,1,.34,4.12,1.26,2.75],
      [62,-1,-.22,3.2,1.02,1.61],[68,1,-.25,4.4,1.38,3.36],[77,-1,.42,4.13,1.25,2.5],
      [86,1,-.04,5.06,1.54,2.72],[96,-1,.27,3.46,1.17,2.32],[103,1,-.18,3.9,1.44,2.65]
    ];
    for(const [z,side,s,rx,ry,rz] of shelves) {
      const x=center(z)+side*(width(z)+s), bed=height(x,z), y=bed+.12*ry;
      if(reachable(x,z) && !open(x,z,Math.min(rx,rz)*.68)) continue;
      const angle=mix(-.66,.66,rng()), collision=reachable(x,z) ? colliders : undefined;
      const {stone}=tileAt(x,z);
      boulder(stone,rng,[x,y,z],[rx,ry*.62,rz],angle,granite[2],.17,collision);
      boulder(stone,rng,[x+side*rx*.13,y+ry*.61,z-rz*.16],[rx*.80,ry*.37,rz*.79],angle+.22,granite[1],-.13,collision);
      if(z>44) boulder(stone,rng,[x+side*rx*.32,y+ry*.92,z+rz*.10],[rx*.49,ry*.24,rz*.58],angle-.18,granite[0],.07);
      blocks.push({x,z,rx:rx*.75,rz:rz*.75,top:y+ry});
    }
    for(let i=0;i<194;i++) {
      const z=mix(-64,119,rng()), side=rng()<.48 ? -1 : 1, s=mix(-2.8,6.1,rng());
      if(side<0 && z>10 && z<24 && s>-.50 && s<4.1) continue;
      const x=center(z)+side*(width(z)+s), bed=height(x,z), h=mix(.083,.71,rng()**1.9);
      if(bed+h<-.23 || !open(x,z,h*.66)) continue;
      const collision=reachable(x,z) && h>.27 ? colliders : undefined;
      boulder(tileAt(x,z).stone,rng,[x,bed+h*.16,z],[h*mix(1.16,2.12,rng()),h,h*mix(.98,1.87,rng())],rng()*6.283,
        granite[i%granite.length],(rng()-.5)*.30,collision);
    }
  }

  function forest(rng, tileAt, blocks, ledges, patches, campsite, woodColliders, recordTree) {
    const intersects = (x,z) => blocks.some(b => Math.hypot((x-b.x)/(b.rx+.64),(z-b.z)/(b.rz+.64)) < 1);
    const campsiteNear=(x,z,pad)=>campsite.some(p=>Math.hypot(x-p.x,z-p.z)<Math.min(1.6,Math.max(p.rx,p.rz))+pad);
    for (let i = 0; i < 575; i++) {
      const z = mix(-127,81,rng()), side = rng()<.52 ? -1 : 1;
      const edge = side === -1 ? 7.8 : 4.3;
      const x = center(z)+side*(width(z)+edge+Math.pow(rng(),1.6)*54);
      if (intersects(x,z) || trail.clear(x,z,1.0)) continue;
      const y = height(x,z);
      const h = 3.7 + Math.pow(rng(),.83)*7.8;
      const {stems,crowns}=tileAt(x,z);
      const r = tree(rng,stems,crowns,x,z,y,h,z>-80 && z<46 && Math.abs(x)<44,woodColliders,recordTree);
      if (y < 14 && within(x,z)) blocks.push({x,z,rx:r*1.17,rz:r*1.17,top:y+h*.74,tree:true});
    }
    for (let i = 0; i < ledges.length; i++) {
      const [x,y,z,radius] = ledges[i];
      const {stems,crowns}=tileAt(x,z);
      if (i%3 !== 1) tree(rng,stems,crowns,x,z,y,2.8+radius*.61,true,woodColliders,recordTree);
    }
    for(let i=0;i<158;i++) {
      const z=mix(-72,81,rng()), side=rng()<.43 ? -1 : 1;
      if(side<0 && z>-7 && z<24) continue;
      const x=center(z)+side*(width(z)+mix(3.3,17.8,rng()**1.45));
      const y=height(x,z);
      if(y<.21 || intersects(x,z) || campsiteNear(x,z,.77) || trail.clear(x,z,.84)) continue;
      const h=mix(3.12,7.05,rng()), playable=z<44 && z>-66 && Math.abs(x)<43;
      const {stems,crowns}=tileAt(x,z);
      const radius=tree(rng,stems,crowns,x,z,y,h,playable,playable ? woodColliders : null,recordTree);
      if(playable && y<7) blocks.push({x,z,rx:radius*1.2,rz:radius*1.2,top:y+h*.74,tree:true});
    }
    for (let i = 0; i < 496; i++) {
      const z = mix(-96,57,rng()), side = rng() < .44 ? -1 : 1;
      const x = center(z) + side*(width(z) + mix(side < 0 ? 5.6 : 1.55,22,Math.pow(rng(),1.8)));
      if (intersects(x,z) || campsiteNear(x,z,.28) || trail.clear(x,z,.56)) continue;
      const y = height(x,z), size = .61+Math.pow(rng(),1.6)*2.3;
      const tint = [.82+rng()*.17,.87+rng()*.19,.71+rng()*.19];
      const a = rng()*6.283;
      const {crowns}=tileAt(x,z);
      canopy(crowns,[x,y+size*.22,z],size,size*.56,a,tint,size*.13);
      canopy(crowns,[x,y+size*.26,z],size*.96,size*.56,a+1.54,tint,size*-.10);
    }
    for (let i = 0; i < 2020; i++) {
      const bankReeds=i>=1410;
      const z = bankReeds ? mix(-56,58,rng()) : mix(-88,56,rng()), side = rng()<.58 ? -1 : 1;
      const verge = rng()<(bankReeds ? .69 : .29);
      const s = verge ? mix(.24,3.2,rng()) : mix(3.3,15,rng());
      if (verge && side < 0 && Math.sin(z*.41) < .21) continue;
      const x = center(z) + side*(width(z)+s);
      const y = height(x,z);
      if (y <= 0 || y > 8 || trail.clear(x,z,.22) || campsite.some(p=>Math.hypot(x-p.x,z-p.z)<(p.entry ? Math.max(p.rx,p.rz)+.21 : Math.min(.88,p.rx+.21)))) continue;
      const {grass}=tileAt(x,z);
      const count = verge ? 7 : 9;
      let tallest=.18;
      for (let j=0; j<count; j++) {
        const angle = rng()*6.283;
        const xx = x+(rng()-.5)*.51, zz = z+(rng()-.5)*.51;
        const yy = height(xx,zz)-.028, h = .17+rng()*(bankReeds && verge ? .79 : verge ? .56 : .60);
        const dx = Math.cos(angle)*.027, dz = Math.sin(angle)*.027;
        tallest=Math.max(tallest,h);
        const f = rng();
        const tint = f<.16 ? [.43+f*.40,.37+f*.42,.188+f*.23] : [.21+f*.22,.30+f*.24,.116+f*.18];
        const normal=unit([-dz,.042,dx]);
        const a=grass.vertices.length/11;
        grass.vertex([xx-dx,yy,zz-dz],normal,[0,0],times(tint,.57));
        grass.vertex([xx+dx,yy,zz+dz],normal,[1,0],times(tint,.62));
        grass.vertex([xx+dz*h*8+dx*.46,yy+h*.55,zz-dx*h*8+dz*.46],normal,[1,.55],tint);
        grass.vertex([xx+dz*h*8-dx*.46,yy+h*.55,zz-dx*h*8-dz*.46],normal,[0,.55],times(tint,.91));
        grass.vertex([xx+dz*h*18,yy+h,zz-dx*h*18],normal,[.5,1],times(tint,1.13));
        grass.indices.push(a,a+1,a+2,a,a+2,a+3,a+3,a+2,a+4);
      }
      addGrassContact(patches,x,z,verge ? .56 : .49,tallest);
    }
    for (const [z,side,offset,length] of [[12,-1,3.2,.92],[24,-1,3.4,.68],[-18,-1,5.2,1.56],[-5,1,.9,1.4]]) {
      const x = center(z)+side*(width(z)+offset);
      const {stems:bark}=tileAt(x,z), first=bark.indices.length;
      const a = [x,height(x,z)+.046,z], b = [x+length,height(x+length,z+.55)+.038,z+.55];
      const wood = rgb(0xe3d7ba);
      bark.cylinder(a,b,.050,.025,wood,7);
      bark.cylinder(plus(times(a,.43),times(b,.57)),[x+length*.45,a[1]+.06,z+.72],.022,.009,wood,6);
      woodColliders.push(meshCollider(bark,first));
    }
  }

  function addGrassContact(patches,x,z,r,height) {
    const key=`${Math.floor(x/2)},${Math.floor(z/2)}`;
    if(!patches.has(key)) patches.set(key,[]);
    patches.get(key).push({x,z,r,height});
  }

  function woodLanding(shape, woodColliders) {
    const boards=[];
    for(const [z,side,offset] of [[17.70,-1,2.36],[-3.62,1,2.37]]) {
      const x=center(z)+side*(width(z)+offset);
      for(let i=0;i<8;i++) {
        const pz=z+(i-3.5)*.288;
        const y=Math.max(height(x-.39,pz),height(x+.39,pz),height(x,pz))+.046;
        const first=shape.indices.length;
        shape.box([x,y-.036,pz],[.80,.072,.276],rgb(i%3===1 ? 0x91806a : 0xa39379),.009);
        woodColliders.push(meshCollider(shape,first));
        for(const sx of [-.32,.32]) shape.ellipsoid([x+sx,y+.001,pz],[.009,.003,.009],rgb(0x534c41),null,8,5);
        boards.push({x,z:pz,y,hx:.404,hz:.147});
      }
    }
    return boards;
  }

  function build(renderer) {
    const rng = random(180801);
    const concrete = new Builder(), wood = new Builder();
    const {tileAt,buildMeshes}=sceneryTiles();
    const blocks = [], colliders = [], woodColliders = [], patches=new Map();
    const fireTrees=[], buildingAreas=trail.buildings.map(({x,z,w,d})=>[x,z,(Math.hypot(w,d)*.5+21)**2]);
    function recordTree(x,y,z,height,leanX,leanZ,trunk) {
      if(buildingAreas.some(([cx,cz,radius])=>(x-cx)**2+(z-cz)**2<radius)) fireTrees.push({at:[x,y,z],height,leanX,leanZ,trunk});
    }
    const ledges = rocks(rng,tileAt,blocks,colliders);
    const camp = Valley.camp.build(renderer,height,bank);
    forest(rng,tileAt,blocks,ledges,patches,camp.props,woodColliders,recordTree);
    const boards=woodLanding(wood,woodColliders);
    const shoreRng=random(180826);
    riverLedges(shoreRng,tileAt,blocks,colliders,camp.props,boards);
    const road=Valley.roadview.build(renderer,trail,{height,bank,boundedMesh,boulder,stoneColliders:colliders,
      trees(x,z,h,treeRng) {
        if(blocks.some(b=>Math.hypot((x-b.x)/(b.rx+.63),(z-b.z)/(b.rz+.63))<1)) return;
        const y=height(x,z), {stems,crowns}=tileAt(x,z);
        const r=tree(treeRng,stems,crowns,x,z,y,h,true,woodColliders,recordTree);
        blocks.push({x,z,rx:r*1.18,rz:r*1.18,top:y+h*.77,tree:true});
      }
    });
    const land=landscape(blocks,camp.shadows);
    const distantRng=random(814032);
    const uplandMeshes=upland(renderer,distantRng,patches,recordTree);
    upstreamRocks(distantRng,tileAt);
    streamBed(shoreRng,tileAt);
    for (const [z,offset] of [[-5,-2.8],[-15,-3.9],[-24,-2.3],[-38,-3.1],[-53,-1.7]]) {
      const x = center(z)+width(z)+offset;
      concrete.ellipsoid([x,.055,z],[.127,.156,.124],rgb(0xf3f1e2),null,16,10);
      concrete.cylinder([x,-.022,z],[x,.024,z],.094,.096,rgb(0x909da0),12,false);
    }
    return {
      solid: [...terrainMeshes(renderer,land),...buildMeshes(renderer),boundedMesh(renderer,concrete,0),boundedMesh(renderer,wood,13),
        ...uplandMeshes,...road.solid],
      water:waterMeshes(renderer),
      road, colliders, woodColliders, patches, boards, fireTrees, props:[...camp.props,...road.interior.props],
      tents:camp.tents, supplyBag:camp.supplyBag, chips:[],
      chipMeshes:Valley.props.chips(renderer), woodChipMeshes:Valley.props.chips(renderer,"wood"),
      obstacles: blocks.filter(b=>b.tree).concat(camp.blocks),
      rockCeiling: Math.max(...colliders.map(c=>c.max[1]))+.15
    };
  }

  function woodTop(world,x,z) {
    let top=-Infinity;
    for(const b of world.boards) {
      if(Math.abs(x-b.x)<=b.hx && Math.abs(z-b.z)<=b.hz) top=Math.max(top,b.y);
    }
    return top;
  }

  function footing(world,x,z,feet) {
    if(wetAt(x,z,feet+.04)) return {kind:"water"};
    if(Math.abs(Valley.camp.floorHeight(world.tents,x,z)-feet)<.047) return {kind:"mat"};
    if(Math.abs(woodTop(world,x,z)-feet)<.044) return {kind:"wood",stepBank:"outdoorWood"};
    const floor=Valley.roadview.floor(world.road,x,z,feet+.041);
    if(Math.abs(floor.top-feet)<.041) return floor;
    if(Valley.practice.paved(x,z) || feet>height(x,z)+.030) return {kind:"rock",stepBank:"outdoorStone"};
    if(Valley.practice.contains(x,z)) return {kind:"sand",stepBank:"dirtLeaf"};
    const {routes,links}=world.road.layout;
    for(const route of routes) {
      if((route.closest(x,z)?.distance??Infinity)<route.half) {
        return {kind:"rock",stepBank:world.road.routeStepBanks.get(route)};
      }
    }
    let stepBank;
    for(const link of links) {
      if(link.kind!=="stone" && link.kind!=="asphalt" && link.kind!=="gravel") continue;
      if(Math.abs(x-link.x)>link.len*.5+link.half || Math.abs(z-link.z)>link.len*.5+link.half) continue;
      const [across,along]=Valley.roadview.local(link,x,z);
      if(Math.abs(across)>=link.half || Math.abs(along)>=link.len*.5) continue;
      if(link.kind==="stone") return {kind:"rock",stepBank:"outdoorStone"};
      if(link.kind==="asphalt") return {kind:"rock",stepBank:"asphalt"};
      stepBank="dirtLeaf";
    }
    return {kind:"sand",stepBank};
  }

  const surfaceKind=(world,x,z,feet)=>footing(world,x,z,feet).kind;

  function grassContact(world,x,z) {
    const ix=Math.floor(x/2), iz=Math.floor(z/2);
    let touch=0, tall=0;
    for(let dz=-1;dz<=1;dz++) for(let dx=-1;dx<=1;dx++) {
      const clumps=world.patches.get(`${ix+dx},${iz+dz}`);
      if(!clumps) continue;
      for(const p of clumps) {
        const strength=p.height*(1-smooth(.12,p.r,Math.hypot(x-p.x,z-p.z)));
        touch=Math.max(touch,strength);
        if(p.height>.38) tall=Math.max(tall,strength);
      }
    }
    return {touch,tall};
  }

  function solidHeight(world, x, z, bed = height(x,z), reach = Infinity) {
    bed=Math.max(bed,woodTop(world,x,z),Valley.camp.floorHeight(world.tents,x,z),Valley.roadview.floor(world.road,x,z,reach).top);
    const top = world.rockCeiling;
    if (bed >= top) return bed;
    const hit = meshHit(world.colliders,[x,top,z],[x,bed,z],[0,bed-top,0],1,"rock");
    return hit ? Math.max(bed,hit.at[1]) : bed;
  }

  function walkFloor(world, x, z, feet, rise, clearance = 1.63) {
    if (!within(x,z) || !Valley.roadview.walkable(world.road,x,z,feet,rise,clearance)) return null;
    const bed = height(x,z), reach = feet+rise;
    if (bed > 25 || bed > reach) return null;
    if (world.obstacles.some(b => !b.owner?.tipped && feet < b.top-.14 &&
      ((x-b.x)/(b.rx+.24))**2+((z-b.z)/(b.rz+.24))**2 < 1)) return null;
    const floor = solidHeight(world,x,z,bed,reach);
    return floor > reach ? null : floor;
  }

  function meshHit(colliders, from, to, delta, limit, type, doubleSided=type==="wood") {
    const lo = from.map((v,i)=>Math.min(v,to[i]));
    const hi = from.map((v,i)=>Math.max(v,to[i]));
    let hit = null;
    for (const {min,max,faces} of colliders) {
      if (lo[0]>max[0] || hi[0]<min[0] || lo[1]>max[1] || hi[1]<min[1] || lo[2]>max[2] || hi[2]<min[2]) continue;
      for (const face of faces) {
        const p = cross(delta,face.ac);
        const det = dot(face.ab,p);
        if ((doubleSided ? Math.abs(det) : det)<=1e-8) continue;
        const offset = minus(from,face.a);
        const u = dot(offset,p)/det;
        if (u < -1e-6 || u > 1.000001) continue;
        const q = cross(offset,face.ab);
        const v = dot(delta,q)/det;
        if (v < -1e-6 || u+v > 1.000001) continue;
        const fraction = dot(face.ac,q)/det;
        if (fraction < 0 || fraction > limit) continue;
        limit = fraction;
        hit = {type,fraction,at:plus(from,times(delta,fraction)),normal:det>0 ? face.normal : times(face.normal,-1)};
      }
    }
    return hit;
  }

  function floorAt([x,,z], stopAtWater) {
    const bed = height(x,z);
    const level=waterLevel(x,z);
    return stopAtWater && bed<level-.022 ? level : bed;
  }

  function traceShot(world, from, to, stopAtWater = true) {
    const delta = minus(to,from);
    let floorHit = null;
    if (to[1] <= floorAt(to,stopAtWater)+.007) {
      let lo = 0, hi = 1;
      if (from[1] <= floorAt(from,stopAtWater)+.007) hi = 0;
      for (let i=0; i<5; i++) {
        const mid = (lo+hi)*.5;
        const at = plus(from,times(delta,mid));
        if (at[1] > floorAt(at,stopAtWater)+.007) lo = mid;
        else hi = mid;
      }
      const at = plus(from,times(delta,hi));
      const [x,,z] = at, bed = height(x,z);
      const level=waterLevel(x,z), water=stopAtWater && bed<level-.022;
      at[1] = water ? level : bed;
      const normal = water ? [0,1,0] : unit([height(x-.14,z)-height(x+.14,z),.28,height(x,z-.14)-height(x,z+.14)]);
      floorHit = {type:water ? "water" : "sand",fraction:hi,at,normal};
    }
    const ground = meshHit(world.colliders,from,to,delta,floorHit?.fraction??1,"rock") || floorHit;
    const wood=meshHit(world.woodColliders,from,to,delta,ground?.fraction??1,"wood") || ground;
    return Valley.roadview.trace(world.road,from,to,wood?.fraction??1) || wood;
  }

  Valley.world = { build, height, bank, shore, waterLevel, wetAt, solidHeight, walkFloor, traceShot, footing, surfaceKind, grassContact,
    meshCollider,meshHit };
})();
