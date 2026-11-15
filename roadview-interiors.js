"use strict";

(() => {
  const {Builder,clamp,mix,smooth,rgb,plus,minus,times,unit,dot,random,transform,point,direction}=Valley;
  const {meshes:blenderMeshes,shapes:blenderShapes,append:appendBlender}=Valley.blenderAssets;
  const wood=rgb(0xa7784f), darkWood=rgb(0x765139), brass=rgb(0xb29863);
  const ivory=rgb(0xe9e9df), porcelain=rgb(0xe9f0ed), silver=rgb(0xa8b6ba), dark=rgb(0x393b38);
  const holdTime=.48, lightLimit=10;
  const charredFixture={charred:true};
  const stableIgnition=1.72, ignitionRandom=random(10484);
  const jetGravity=10.1, dropRandom=random(4781);
  const pressureDrops=Array.from({length:112},(_,i)=>({
    delay:(i+.42*dropRandom())/101, speed:mix(.80,1.07,dropRandom()),
    x:mix(-.34,.34,dropRandom()), y:mix(-.18,.24,dropRandom()), z:mix(-.37,.37,dropRandom()),
    size:mix(.014,.038,dropRandom()), alpha:mix(.45,.87,dropRandom())
  }));

  function model(scene,draw) {
    const shapes=new Map();
    draw(material=>{
      if(!shapes.has(material)) shapes.set(material,new Builder());
      return shapes.get(material);
    });
    return Array.from(shapes,([material,shape])=>scene.renderer.mesh(shape,material));
  }

  function appendModel(part,name,materials,at,{scale=[1,1,1],turn=0,pitch=0,tint}={}) {
    const matrix=transform(at,pitch,turn);
    for(let axis=0;axis<3;axis++) for(let row=0;row<3;row++) matrix[axis*4+row]*=scale[axis];
    for(const {slot,shape,material} of blenderShapes(name,materials)) {
      appendBlender(part(material),shape,matrix,Array.isArray(tint) ? tint : tint?.[slot]);
    }
  }

  function create(renderer,material,collider) {
    const scene={renderer,material,collider,items:[],zones:[],props:[],monitors:[],shards:{},leaks:[],bathRemnants:{},scorches:new Map(),
      lightData:new Float32Array(lightLimit*4),lightBounds:new Float32Array(lightLimit*4)};
    for(const kind of ["glass","ceramic"]) {
      scene.shards[kind]=Array.from({length:3},(_,i)=>{
        const b=new Builder(), color=kind==="glass" ? rgb(0xb7e0da) : porcelain;
        const a=[-.41-i*.065,-.28,-.06], d=[.46,-.20,.04], c=[.17+i*.14,.67,0];
        const back=[-.04,.12,kind==="glass" ? .026 : .29];
        b.triangle(a,d,c,color);
        b.triangle(d,a,back,times(color,.78));
        b.triangle(c,d,back,times(color,.92));
        b.triangle(a,c,back,times(color,1.05));
        return renderer.mesh(b,kind==="glass" ? material.gloss : material.porcelain);
      });
    }
    return scene;
  }

  function fixture(scene,a,kind,at,yaw,meshes) {
    const origin=a.at(at), turn=a.yaw+yaw;
    const item={kind,at:origin,yaw:turn,matrix:transform(origin,0,turn),meshes};
    scene.items.push(item);
    return item;
  }

  function body(scene,item,center,size,hit,margin=0,kind="wall") {
    const bounds=scene.collider(...point(item.matrix,center),size,item.yaw,kind,hit,margin);
    bounds.fixture=item;
    return bounds;
  }

  function doorPose(item,value) {
    const ease=smooth(0,1,value);
    const at=point(item.base,[item.slide*ease,0,0]);
    const yaw=item.yaw+item.swing*ease;
    item.matrix=transform(at,0,yaw);
    const center=point(item.matrix,item.mid);
    Valley.roadview.moveBox(item.bounds,center,yaw);
    if(item.glazing) {
      const {glass,frames}=item.glazing;
      for(const [local,box] of frames) Valley.roadview.moveBox(box,point(item.matrix,local),yaw);
      glass.at=center;
      glass.matrix=transform(center,0,yaw);
      Valley.roadview.moveBox(glass.bounds,center,yaw);
    }
  }

  function door(scene,a,hinge,width,{yaw=0,height=2.12,swing=-1.55,slide=0,panel="wood",open=false,
    color,glassTint,window=false}={}) {
    const m=scene.material, fridge=panel==="fridge", lattice=panel==="lattice", glazed=panel==="glass";
    const thickness=fridge ? .062 : .046, rim=window ? .040 : .055;
    const finish=fridge || glazed ? m.paint : m.wood, tint=color??(finish===m.paint || panel==="white" ? ivory : wood);
    const edges=glazed ? [
      [[rim/2,height/2,0],[rim,height,thickness]],[[width-rim/2,height/2,0],[rim,height,thickness]],
      [[width/2,rim/2,0],[width-2*rim,rim,thickness],"rock"],[[width/2,height-rim/2,0],[width-2*rim,rim,thickness]]
    ] : [];
    const meshes=model(scene,part=>{
      const leaf=part(finish), hardware=part(m.gloss);
      if(glazed) {
        for(const [index,[at,size]] of edges.entries()) {
          appendModel(part,index<2 ? "lodge_window_channel_upright" : "lodge_window_channel",m,at,
            {scale:size,tint:{paint:tint}});
        }
        for(const side of [-1,1]) hardware.box([rim*.53,height*.49,side*.036],[.033,Math.min(.145,height*.22),.028],silver,.008);
        return;
      }
      if(fridge) {
        leaf.box([width/2,height/2,0],[width,height,thickness],tint,.009);
        leaf.box([width/2,height*.42,.041],[width-.054,height*.60,.032],rgb(0xdfdfd5),.014);
        leaf.box([width/2,height*.23,.077],[width-.085,.09,.084],ivory,.011);
        hardware.box([width-.065,height*.79,-.045],[.032,.213,.032],rgb(0xd4d4cc),.011);
      } else {
        appendModel(part,lattice ? "lodge_lattice_door" : "lodge_panel_door",m,
          [width/2,height/2,0],{scale:[width,height,thickness],tint:{wood:tint}});
        for(const side of [-1,1]) {
          const z=side*(thickness/2+.005);
          if(lattice) {
            hardware.box([slide>0 ? .063 : width-.063,1.00,z+side*.013],[.027,.136,.019],darkWood,.005);
          } else {
            const x=width-.092;
            hardware.cylinder([x,1.01,z],[x,1.01,z+side*.021],.029,.025,brass,14);
            hardware.ellipsoid([x,1.01,z+side*.036],[.036,.034,.027],brass,null,16,9);
            for(const y of [.29,height-.27]) leaf.box([.024,y,z],[.036,.073,.015],darkWood,.004);
          }
        }
      }
    });
    const item=fixture(scene,a,fridge ? "fridge" : "door",hinge,yaw,meshes);
    Object.assign(item,{base:item.matrix,mid:[width/2,height/2,0],swing:slide ? 0 : swing,slide,
      on:open,value:Number(open),hinged:true,window});
    const size=[width,height,thickness], margin=width+Math.abs(slide)+.16;
    if(glazed) {
      const leafArea={at:local=>point(item.base,local),yaw:item.yaw};
      const glass=pane(scene,leafArea,item.mid,width-2*rim+.003,height-2*rim+.003,{margin,tint:glassTint});
      glass.door=item;
      const frames=edges.map(([at,size,kind])=>[at,body(scene,item,at,size,"metal",margin,kind)]);
      item.glazing={glass,frames};
      item.bounds=Valley.roadview.boxAt(point(item.matrix,item.mid),size,item.yaw);
    } else item.bounds=body(scene,item,item.mid,size,fridge ? "metal" : "wood",margin);
    item.use=item.bounds;
    item.grip=glazed ? {at:[rim*.53,height*.49,.050],twoSided:true}
      : fridge ? {at:[width-.065,height*.79,-.061],back:true}
        : lattice ? {at:[slide>0 ? .063 : width-.063,1,.050],twoSided:true}
          : {at:[width-.092,1.01,.080],twoSided:true};
    doorPose(item,item.value);
    return item;
  }

  function pane(scene,a,at,width,height,{yaw=0,frosted=false,tint=rgb(0x96b6bf),margin=0}={}) {
    const m=scene.material, size=[width,height,.016];
    const item=fixture(scene,a,"glass",at,yaw,model(scene,part=>{
      part(frosted ? m.frosted : m.glass).box([0,0,0],size,tint);
    }));
    item.hp=.46;
    item.bounds=body(scene,item,[0,0,0],size,"glass",margin);
    return item;
  }

  // The same open rim profile is used for the ceramic bowls and the stainless basin.
  function basin(b,center,sections,tint) {
    const count=30;
    const rings=sections.map(([y,rx,rz],i)=>{
      const before=sections[Math.max(0,i-1)], after=sections[Math.min(sections.length-1,i+1)];
      const dy=after[0]-before[0], dr=((after[1]+after[2])-(before[1]+before[2]))*.5;
      return Array.from({length:count+1},(_,j)=>{
        const t=j/count*Math.PI*2,x=Math.cos(t),z=Math.sin(t);
        const n=unit([x*dy,-dr,z*dy]);
        return b.vertex(plus(center,[rx*x,y,rz*z]),n,[j/count,i/(sections.length-1)],tint);
      });
    });
    for(let i=1;i<rings.length;i++) for(let j=1;j<=count;j++) {
      const [a,d,c,e]=[rings[i-1][j-1],rings[i][j-1],rings[i][j],rings[i-1][j]];
      b.indices.push(a,d,c,a,c,e);
    }
  }

  function connectPlumbing(scene,item,kind,outlet,velocity) {
    const m=scene.material, toilet=kind==="toilet";
    scene.bathRemnants[kind]??=model(scene,part=>{
      const ceramic=part(m.porcelain), pipe=part(m.gloss), count=18;
      const radius=toilet ? .154 : .129, depth=toilet ? .146 : .112;
      const lip=Array.from({length:count},(_,i)=>(toilet ? .083 : .121)+.041*Math.sin(i*2.87)
        +.019*Math.cos(i*1.72)+(i%5===2 ? .078 : 0));
      const wall=(i,y,scale)=>{
        const angle=i*Math.PI*2/count;
        return [Math.cos(angle)*radius*scale,y,Math.sin(angle)*depth*scale+.02];
      };
      for(let i=0;i<count;i++) {
        const j=(i+1)%count, top=wall(i,lip[i],.84), next=wall(j,lip[j],.84);
        const inner=wall(i,lip[i]-.014,.65), innerNext=wall(j,lip[j]-.014,.65);
        ceramic.quad([wall(i,.012,1),top,next,wall(j,.012,1)],porcelain);
        ceramic.quad([top,inner,innerNext,next],rgb(0xd3d2c5));
        ceramic.quad([inner,wall(i,.024,.66),wall(j,.024,.66),innerNext],rgb(0x9d9b90));
      }
      const [x,y,z]=outlet;
      pipe.cylinder([x,.012,z],[x,y-.026,z],.029,.022,silver,13);
      pipe.cylinder([x,y-.030,z],[x,y-.004,z],.031,.027,silver,13,false);
      part(m.plain).cylinder([x,y-.008,z],[x,y-.006,z],.018,.018,dark,12);
    });
    item.plumbing={kind,remnant:scene.bathRemnants[kind],at:point(item.matrix,outlet),
      floor:item.at[1]-.004,velocity:direction(item.matrix,velocity),since:null};
  }

  function bathroomFixtures(scene,a,lo,wall,front,level) {
    const toilet=fixture(scene,a,"ceramic",[lo+.48,level+.032,wall+.49],0,
      blenderMeshes(scene.renderer,"toilet",scene.material));
    toilet.hp=2.48;
    toilet.bounds=body(scene,toilet,[0,.414,-.008],[.438,.822,.629],"ceramic");
    connectPlumbing(scene,toilet,"toilet",[-.143,.218,-.266],[.91,5.05,1.54]);

    const sink=fixture(scene,a,"ceramic",[lo+.48,level+.032,front-.346],Math.PI,
      blenderMeshes(scene.renderer,"bathroom_basin",scene.material));
    sink.hp=2.2;
    sink.bounds=body(scene,sink,[0,.428,-.002],[.568,.856,.456],"ceramic");
    body(scene,sink,[.027,.894,-.112],[.151,.145,.163],"ceramic");
    connectPlumbing(scene,sink,"sink",[.071,.502,-.155],[-1.02,4.56,1.38]);
  }

  function control(scene,a,kind,at,yaw,draw,on=false) {
    const item=fixture(scene,a,kind,at,yaw,Array.isArray(draw) ? draw : model(scene,draw));
    item.on=on;
    item.value=Number(on);
    const center=kind==="light" ? point(item.matrix,[0,0,.044]) : item.at;
    item.use=Valley.roadview.boxAt(center,kind==="light" ? [.20,.25,.10] : [.19,.19,.17],item.yaw);
    item.grip={
      valve:{at:[0,0,.047]},burner:{at:[0,0,.037]},
      faucet:{at:[.025,.030,0],top:true},light:{at:[0,-.022,.017],pointing:true}
    }[kind];
    return item;
  }

  function sink(scene,a,x,z,top) {
    const m=scene.material;
    fixture(scene,a,"detail",[x,top,z],0,blenderMeshes(scene.renderer,"kitchen_sink",m));
    const tapAt=[x,top+.175,z-.18];
    a.beam(m.gloss,[x,top+.025,z-.188],tapAt,.026,.020,silver,13);
    a.beam(m.gloss,tapAt,[x,top+.172,z+.006],.018,.015,silver,13);
    a.beam(m.gloss,[x,top+.172,z+.006],[x,top+.145,z+.030],.015,.014,silver,12);
    const tap=control(scene,a,"faucet",[x+.123,top+.081,z-.151],0,part=>{
      part(m.gloss).box([0,.019,0],[.112,.025,.031],silver,.009);
      part(m.gloss).cylinder([0,-.023,0],[0,.020,0],.022,.021,silver,14);
    });
    tap.flowAt=a.at([x,top-.057,z+.030]);
    tap.flow=model(scene,part=>{
      const water=part(m.tapWater);
      water.cylinder([0,0,0],[0,.200,0],.008,.011,rgb(0xb4dfe4),10,false);
      for(let i=0;i<3;i++) {
        const t=i*2.094;
        water.ellipsoid([Math.cos(t)*.021,.009,Math.sin(t)*.021],[.011,.005,.007],rgb(0xcce4e5),null,8,5);
      }
    });
  }

  function rangeEffects(scene) {
    if(scene.rangeEffects) return scene.rangeEffects;
    const m=scene.material;
    const flames=model(scene,part=>{
      const glow=part(m.emissive);
      for(let i=0;i<19;i++) {
        const t=i*Math.PI*2/19, x=Math.cos(t), z=Math.sin(t);
        const length=.029+(i%4)*.007;
        glow.cylinder([x*.055,0,z*.055],[x*.050,length,z*.050],.010,.0006,rgb(0x356ee7),7);
        glow.cylinder([x*.057,.006,z*.057],[x*.053,length*.66,z*.053],.0056,.0004,rgb(0x79c9f9),6);
      }
    });
    const sparks=model(scene,part=>{
      const glow=part(m.emissive);
      const points=[[-.018,-.007,0],[-.011,.010,.003],[-.003,.004,-.002],[.004,.022,.004],[.013,.016,0]];
      for(let i=1;i<points.length;i++) {
        glow.cylinder(points[i-1],points[i],.0025,.002,rgb(0x7fa6fa),6);
        glow.cylinder(plus(points[i-1],[0,.0012,0]),plus(points[i],[0,.0012,0]),.0013,.0009,rgb(0xf1f9ff),6);
      }
      glow.ellipsoid(points[0],[.005,.004,.005],rgb(0xe6eaff),null,9,6);
    });
    return scene.rangeEffects={flames,sparks};
  }

  function gasRange(scene,a,x,z,top,back) {
    const m=scene.material;
    const front=z+.315, panelY=top+.097;
    a.blender("range_body",[x,top,z]);
    a.body([x,panelY,z+.011],[.732,.131,.582],"wall","metal");
    a.label("Rinnai","",[x,panelY,front],.675,.106,"range");
    const valveAt=[x+.24,top+.345,back+.06];
    a.beam(m.gloss,[valveAt[0],top+.101,valveAt[2]],[valveAt[0],top+.515,valveAt[2]],.014,.014,brass,10);
    const valve=control(scene,a,"valve",valveAt,0,part=>{
      part(m.gloss).cylinder([0,0,-.025],[0,0,.026],.028,.027,brass,12);
      part(m.gloss).box([0,0,.036],[.037,.106,.022],rgb(0xcc9a3d),.007);
    });
    const effects=rangeEffects(scene), knobs=blenderMeshes(scene.renderer,"range_knob",m);
    valve.burners=[-1,1].map(side=>{
      const u=x+side*.168, capZ=z-.021;
      a.blender("range_grate",[u,top,capZ]);
      const burner=control(scene,a,"burner",[u,panelY,front+.012],0,knobs);
      burner.use=Valley.roadview.boxAt(point(burner.matrix,[0,0,.020]),[.106,.104,.089],burner.yaw);
      Object.assign(burner,{valve,side:side<0 ? "LEFT" : "RIGHT",press:0,effects,
        flameAt:a.at([u,top+.219,capZ]),sparkAt:a.at([u+.055,top+.220,capZ-.064])});
      return burner;
    });
  }

  function kitchen(scene,a,x,z,level,palette) {
    const m=scene.material, back=z-.301, top=level+.875;
    const cabinet=palette, upper=rgb(0xe0dfd6), tile=rgb(0xddd9ce), sinkX=x-.53, stoveX=x+.63;
    a.box(m.wood,[x,level+.396,z],[2.145,.772,.598],cabinet,{radius:.013,kind:"wall"});
    for(let i=0;i<3;i++) {
      const u=x-.703+i*.704;
      a.box(m.paint,[u,level+.420,z+.311],[.675,.682,.029],times(cabinet,1.17),{radius:.009});
      a.box(m.gloss,[u,level+.660,z+.336],[.171,.026,.020],silver,{radius:.006});
    }
    for(const [u,w] of [[x-.99,.153],[x+.458,1.217]]) {
      a.box(m.gloss,[u,top,z],[w,.053,.648],silver,{radius:.013});
    }
    for(const v of [-.27,.27]) a.box(m.gloss,[sinkX,top,z+v],[.760,.053,.115],silver,{radius:.008});
    a.box(m.ceramicTile,[x,level+1.20,back],[2.16,.641,.029],tile);
    a.box(m.paint,[x-.38,level+1.87,back+.15],[1.19,.44,.34],upper,{radius:.012});
    for(const side of [-1,1]) {
      const u=x-.38+side*.287;
      a.box(m.paint,[u,level+1.87,back+.332],[.563,.39,.022],ivory,{radius:.007});
      a.box(m.gloss,[u,level+1.73,back+.354],[.115,.022,.023],silver,{radius:.006});
    }

    sink(scene,a,sinkX,z,top);

    gasRange(scene,a,stoveX,z,top,back);

    const fx=x+1.418, fw=.616, fz=z+.025, fd=.58, fh=1.57, base=level+.036;
    for(const side of [-1,1]) {
      a.box(m.paint,[fx+side*(fw/2-.025),base+fh/2,fz],[.05,fh,fd],ivory,{radius:.014,kind:"wall"});
    }
    a.box(m.paint,[fx,base+fh/2,fz-fd/2+.025],[fw,fh,.05],ivory,{kind:"wall"});
    for(const y of [.030,1.090,fh-.024]) a.box(m.paint,[fx,base+y,fz],[fw,.052,fd],ivory,{kind:"wall"});
    for(const y of [.307,.594,.868]) a.box(m.gloss,[fx,base+y,fz-.036],[fw-.10,.023,fd-.145],rgb(0xb6c6c8));
    a.box(m.paint,[fx,base+1.316,fz+fd/2],[fw-.023,.436,.063],ivory,{radius:.012});
    a.box(m.gloss,[fx-.214,base+1.253,fz+fd/2+.039],[.031,.129,.021],silver,{radius:.006});
    a.box(m.paint,[fx-.113,base+.409,fz-.117],[.084,.202,.074],rgb(0x7b9bb1),{radius:.009});
    a.beam(m.gloss,[fx+.106,base+.608,fz-.112],[fx+.106,base+.776,fz-.112],.044,.039,rgb(0xac7850),12);
    door(scene,a,[fx+(fw-.032)/2,base+.039,fz+fd/2+.031],fw-.032,
      {yaw:Math.PI,height:1.03,swing:1.56,panel:"fridge"});
  }

  function roomLight(scene,a,base,[x0,x1,z0,z1],wall,yaw,style="strip",extensions=[]) {
    const m=scene.material;
    a.box(m.paint,wall,[.103,.172,.019],ivory,{radius:.006,yaw});
    const item=control(scene,a,"light",plus(wall,[Math.sin(yaw)*.018,0,Math.cos(yaw)*.018]),yaw,part=>{
      part(m.paint).box([0,0,0],[.063,.107,.026],rgb(0xdad8cf),.005);
    },true);
    const cx=(x0+x1)/2, cz=(z0+z1)/2, top=base+2.55;
    item.lampAt=a.at([cx,top,cz]);
    const on=rgb(0xfcfff5), off=rgb(0x9b9b94);
    function lamp(tint,material) {
      return model(scene,part=>{
        const b=part(material);
        if(style==="cluster") {
          b.ellipsoid([0,-.028,0],[.10,.056,.10],tint,null,12,7);
          for(let i=0;i<5;i++) {
            const angle=i*Math.PI*2/5;
            b.ellipsoid([.18*Math.cos(angle),-.069,.18*Math.sin(angle)],[.09,.057,.09],tint,null,12,7);
          }
        } else {
          const long=style==="round" ? .38 : .75;
          b.box([0,-.025,0],[long,.055,.082],tint,.019);
          if(style==="cross") b.box([0,-.025,0],[.082,.055,long],tint,.019);
          if(style==="round") b.ellipsoid([0,-.024,0],[.192,.042,.192],tint,null,20,9);
        }
      });
    }
    item.lit=lamp(on,m.emissive);
    item.unlit=lamp(off,m.paint);
    a.box(m.paint,[cx,top+.041,cz],[style==="round" ? .399 : .215,.081,.177],ivory,{radius:.017});
    for(const [left,right,near,far] of [[x0,x1,z0,z1],...extensions]) {
      scene.zones.push({at:a.at([(left+right)/2,base+1.31,(near+far)/2]),
        size:[(right-left)/2,1.322,(far-near)/2],yaw:a.yaw,item,site:a.site});
    }
  }

  function target(road,cam) {
    const reach=2.32, from=cam.at, delta=times(cam.forward,reach);
    let nearest=null,fraction=1;
    for(const item of road.interior.items) {
      const box=item.use;
      if(item.broken || !box || Math.abs(box.x-from[0])>reach+box.hx || Math.abs(box.z-from[2])>reach+box.hx) continue;
      if(item.car && !Valley.vehicles.available(item)) continue;
      const hit=item.useTrace ? item.useTrace(from,delta,fraction)
        : Valley.roadview.hitBox(box,from,delta,fraction,item.hinged ? .058 : .014);
      if(hit) {nearest=item;fraction=hit.fraction;}
    }
    if(!nearest) return null;
    const obstruction=Valley.roadview.trace(road,from,plus(from,delta),fraction);
    return !obstruction || obstruction.fixture===nearest || obstruction.fixture?.door===nearest
      || (nearest.kind==="carHandle" && obstruction.fixture===nearest.door)
      || fraction-obstruction.fraction<.012 ? nearest : null;
  }

  const hasGas=item=>item.valve.on && !item.service?.destroyed;

  function extinguish(item) {
    item.ignition=null;
    item.on=false;
  }

  function igniteTick(item,dt) {
    const ignition=item.ignition;
    ignition.age+=dt;
    const spark=ignition.age>=ignition.nextSpark;
    if(spark) {
      ignition.lastSpark=ignition.age;
      ignition.nextSpark=ignition.age+mix(.105,.151,ignitionRandom());
    }
    const flame=hasGas(item) && ignition.age>=ignition.lightAt;
    const lit=flame && !item.on;
    item.on=flame;
    return {spark,lit};
  }

  function releaseBurner(item) {
    const {ignition}=item;
    if(!ignition) return;
    const {age,lightAt}=ignition, chance=mix(.08,1,smooth(lightAt,stableIgnition,age)**1.6);
    item.on=hasGas(item) && item.on && (age>=stableIgnition || ignitionRandom()<chance);
    item.ignition=null;
  }

  function use(item) {
    if(item.failed) return false;
    if(item.kind==="burner") {
      if(item.on) extinguish(item);
      else item.ignition={age:0,lightAt:mix(.25,.38,ignitionRandom()),nextSpark:0,lastSpark:-1};
    } else {
      item.on=!item.on;
      if(item.kind==="valve" && !item.on) for(const burner of item.burners) burner.on=false;
    }
    return true;
  }

  function prompt(item) {
    if(item.kind==="door") return `HOLD E ${item.on ? "CLOSE" : "OPEN"} ${item.window ? "WINDOW" : "DOOR"}`;
    if(item.kind==="fridge") return item.on ? "E CLOSE FRIDGE" : "E OPEN FRIDGE";
    if(item.kind==="burner") return item.on && !item.ignition ? `E ${item.side} BURNER OFF` : `HOLD E LIGHT ${item.side} BURNER`;
    const label={valve:"GAS VALVE",faucet:"FAUCET",light:"LIGHT"}[item.kind];
    return `E ${label} ${item.on ? "OFF" : "ON"}`;
  }

  function tick(scene,dt,player) {
    Valley.vehicles.tick(scene,dt,player);
    for(const item of scene.items) {
      if(item.broken || !item.use || item.car) continue;
      const pressing=Boolean(item.ignition);
      if(item.kind==="burner") item.press=clamp(item.press+(pressing ? 1 : -1)*dt*13,0,1);
      const desired=Number(item.on || pressing);
      if(item.value===desired) continue;
      const step=dt*(item.hinged ? 2.45 : 8.5);
      const next=item.value+Math.sign(desired-item.value)*Math.min(Math.abs(desired-item.value),step);
      if(item.hinged) {
        doorPose(item,next);
        const b=item.bounds,[x,z]=Valley.roadview.local(b,player.x,player.z);
        if(b.top>player.feet+.032 && b.bottom<player.feet+player.eyeHeight+.12
          && Math.abs(x)<b.hx+.18 && Math.abs(z)<b.hz+.18) {
          doorPose(item,item.value);
          continue;
        }
      }
      item.value=next;
    }
  }

  function waterVolume(scene,at) {
    let level=0;
    for(const item of scene.items) if(item.kind==="faucet" && item.on) {
      level=Math.max(level,1-smooth(.8,6.2,Math.hypot(...minus(item.at,at))));
    }
    return level;
  }

  function leakSound(scene,at,yaw) {
    let level=0, pan=0;
    const sideX=Math.cos(yaw), sideZ=Math.sin(yaw);
    for(const leak of scene.leaks) {
      const [x,y,z]=minus(leak.at,at);
      const distance=Math.hypot(x,y*2.2,z);
      const volume=1-smooth(1.1,9.1,distance);
      if(volume<=level) continue;
      level=volume;
      pan=clamp((x*sideX+z*sideZ)/Math.max(1.65,distance),-.86,.86);
    }
    return {level,pan};
  }

  function leakVisuals(scene,time,view,cloud) {
    const right=view.axes.subarray(0,3), up=view.axes.subarray(3,6);
    const [horizontal,vertical]=view.frustum;
    for(const leak of scene.leaks) {
      const [x,y,z]=leak.at, [vx,vy,vz]=leak.velocity;
      const offset=minus([x+vx*.43,y+.58,z+vz*.43],view.at);
      const distanceSquared=dot(offset,offset), depth=dot(offset,view.forward);
      if(distanceSquared>196 || Math.abs(offset[1])>3.05 || depth<-1.6
        || Math.abs(dot(offset,right))>depth*horizontal+1.85 || Math.abs(dot(offset,up))>depth*vertical+1.85) continue;
      const age=time-leak.since, floor=leak.floor;
      const pulse=.96+.067*Math.sin(age*13.3)+.025*Math.sin(age*29);
      const width=leak.kind==="toilet" ? .043 : .036;
      const stride=distanceSquared>72 ? 3 : distanceSquared>29 ? 2 : 1;
      const drift=(age*105)%1;
      for(let i=0;i<25;i+=stride) {
        const t=(i+drift)*.0086;
        if(t>age) break;
        const curl=t*.105*Math.sin(t*35-age*23);
        cloud.push(x+vx*t+curl,y+vy*t*pulse-jetGravity*t*t*.5,z+vz*t-curl*.54,
          .75,.89,.96,.84-t*.66,width+t*.065,vx,vy*pulse-jetGravity*t,vz,1);
      }
      for(let i=0;i<pressureDrops.length;i+=stride) {
        const drop=pressureDrops[i], elapsed=age-drop.delay;
        if(elapsed<0) continue;
        const t=elapsed%1.18, speed=drop.speed*pulse;
        const dx=vx*speed+drop.x, dy=vy*speed+drop.y, dz=vz*speed+drop.z;
        const fall=(dy+Math.sqrt(dy*dy+2*jetGravity*(y-floor)))/jetGravity;
        if(t<fall) {
          cloud.push(x+dx*t,y+dy*t-jetGravity*t*t*.5,z+dz*t,
            .71,.86,.94,drop.alpha,drop.size,dx,dy-jetGravity*t,dz,1);
        } else if(i%3===0 && t<fall+.13) {
          const splash=(t-fall)/.13;
          cloud.push(x+dx*fall+drop.x*splash*.42,floor+.013+.32*splash*(1-splash),z+dz*fall+drop.z*splash*.42,
            .77,.90,.96,drop.alpha*(1-splash)*.69,drop.size*1.43,0,0,0,0);
        }
      }
    }
  }

  function lights(scene,at) {
    let site=null, nearest=36;
    for(const zone of scene.zones) {
      const dist=Math.hypot(zone.site[0]-at[0],zone.site[2]-at[2]);
      if(dist<nearest) {site=zone.site;nearest=dist;}
    }
    const nearby=[];
    if(site) for(const zone of scene.zones) {
      if(zone.site!==site) continue;
      const [dx,dy,dz]=minus(at,zone.at);
      const c=Math.cos(zone.yaw),s=Math.sin(zone.yaw),[sx,sy,sz]=zone.size;
      const u=Math.max(0,Math.abs(c*dx-s*dz)-sx),v=Math.max(0,Math.abs(s*dx+c*dz)-sz);
      const vertical=Math.max(0,Math.abs(dy)-sy);
      const distance=u*u+v*v+3*vertical*vertical+.012*(dx*dx+dy*dy+dz*dz);
      nearby.push({zone,distance});
    }
    nearby.sort((a,b)=>a.distance-b.distance);
    const count=Math.min(lightLimit,nearby.length);
    for(let i=0;i<count;i++) {
      const {zone}=nearby[i];
      scene.lightData.set([...zone.at,zone.item.value],i*4);
      scene.lightBounds.set([...zone.size,zone.yaw],i*4);
    }
    return {count,data:scene.lightData,bounds:scene.lightBounds};
  }

  function fixtureMatrix(item) {
    if(item.kind==="faucet") return transform(item.at,0,item.yaw+item.value*.72);
    if(item.kind==="light") return transform(item.at,(item.value-.5)*.41,item.yaw);
    if(item.kind==="valve" || item.kind==="burner") {
      const at=item.press ? point(item.matrix,[0,0,-item.press*.013]) : item.at;
      return transform(at,0,item.yaw,item.value*(item.kind==="burner" ? 1.65 : 1.49));
    }
    return item.matrix;
  }

  function gripSide(item,eye) {
    if(item.car) return 1;
    const {grip,matrix}=item;
    return grip.back || (grip.twoSided && dot(minus(eye,item.bounds.center),direction(matrix,[0,0,1]))<0) ? -1 : 1;
  }

  function gripPose(item,side) {
    if(item.car) return Valley.vehicles.grip(item);
    const matrix=fixtureMatrix(item), {at,top,pointing}=item.grip;
    return {at:point(matrix,[at[0],at[1],at[2]*(item.grip.back ? 1 : side)]),
      normal:direction(matrix,top ? [0,1,0] : [0,0,side]),
      up:direction(matrix,top ? [0,0,1] : [0,1,0]),pointing};
  }

  function objects(scene,at,time) {
    const opaque=[],glass=[];
    for(const item of scene.items) {
      if(Math.abs(item.at[0]-at[0])>105 || Math.abs(item.at[2]-at[2])>105) continue;
      if(item.broken) {
        if(item.plumbing) for(const mesh of item.plumbing.remnant) opaque.push({mesh,matrix:item.matrix});
        continue;
      }
      const matrix=fixtureMatrix(item);
      const list=item.kind==="glass" && !item.opaqueGlass ? glass : opaque;
      for(const mesh of item.meshes) list.push({mesh,matrix,effect:item.effectMesh===mesh ? item.effect : item.charred ? charredFixture : undefined});
      if(item.kind==="light") {
        const lamp=transform(item.lampAt,0,item.yaw);
        for(const mesh of item.on ? item.lit : item.unlit) opaque.push({mesh,matrix:lamp});
      } else if(item.kind==="burner") {
        const {ignition,effects}=item;
        if(item.on) {
          const ramp=ignition ? mix(.33,1,smooth(0,.19,ignition.age-ignition.lightAt)) : 1;
          const flicker=transform(item.flameAt,.017*Math.sin(time*17),item.yaw);
          for(let i=4;i<=6;i++) flicker[i]*=ramp*(.96+.078*Math.sin(time*31+item.at[0]));
          for(const mesh of effects.flames) opaque.push({mesh,matrix:flicker});
        }
        if(ignition && ignition.age-ignition.lastSpark<.044) {
          const bolt=transform(item.sparkAt,.10*Math.sin(time*47),item.yaw+.28*Math.sin(time*32),.1);
          for(const mesh of effects.sparks) opaque.push({mesh,matrix:bolt});
        }
      } else if(item.kind==="faucet" && item.on) {
        const flow=transform(item.flowAt,0,time*7);
        for(const mesh of item.flow) glass.push({mesh,matrix:flow});
      }
    }
    return {opaque,glass};
  }

  function shatter(scene,item,time) {
    if(item.broken) return false;
    item.broken=true;
    item.hp=0;
    if(item.plumbing) {
      item.plumbing.since=time;
      scene.leaks.push(item.plumbing);
    }
    return true;
  }

  function impact(scene,item,speed,strength,incidence,time) {
    const damage=strength*smooth(3,29,speed)*mix(.23,1,incidence);
    if(item.broken) return false;
    if(damage>=item.hp) return shatter(scene,item,time);
    item.hp-=damage;
    return false;
  }

  Valley.lodging={create,model,appendModel,fixture,body,door,pane,basin,bathroomFixtures,kitchen,sink,roomLight,target,use,prompt,tick,
    waterVolume,leakSound,leakVisuals,lights,objects,impact,shatter,holdTime,igniteTick,releaseBurner,extinguish,gripSide,gripPose};
})();
