"use strict";

(() => {
  const {Builder,clamp,mix,smooth,rgb,plus,minus,times,dot,unit,multiply,transform,point,direction}=Valley;
  const wheelRadius=.319, wheelHeight=.321, wheelStations=[-1.405,1.405], wheelX=.783;

  const modelOrigin=transform([0,0,0]);
  const sideName=side=>side>0 ? "left" : "right";
  const endName=front=>front ? "front" : "rear";

  function vehicleModel(part,materials,name,paint) {
    const {shapes,append}=Valley.blenderAssets;
    for(const {slot,shape,material} of shapes(name,materials)) {
      append(part(material),shape,modelOrigin,slot==="carPaint" ? paint : undefined);
    }
  }

  function plate(b,front,signs) {
    const side=front ? 1 : -1,w=.342,h=.171,z=front ? 2.233 : -2.385,y=front ? .477 : .438;
    const uv=signs.uv("대전00","가 0000",w,h,"plate");
    b.quad([[-side*w/2,y-h/2,z],[side*w/2,y-h/2,z],[side*w/2,y+h/2,z],[-side*w/2,y+h/2,z]],rgb(0xf2f0df),null,uv);
  }

  const model=(m,name,paint)=>part=>vehicleModel(part,m,"sedan_"+name,paint);

  function shell(part,m,paint,signs) {
    vehicleModel(part,m,"sedan_body_shell",paint);
    for(const front of [false,true]) plate(part(m.label),front,signs);
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
    const lo=front ? -.270 : -1.272, hi=front ? 1.011 : -.295;
    const m=car.scene.material, {paint,color}=car;
    const key=endName(front)+"_"+sideName(side);
    const {anchors}=Valley.blenderAssets.get("sedan_door_"+key);
    const pivot=anchors.hinge;
    const local=p=>minus(p,pivot);
    const door=part(car,"carDoor",asset(color+" door "+key,model(m,"door_"+key,paint),{ray:[m.carPaint],dent:true}),
      {pivot,...opening(-side*1.25),center:local([side*.882,.605,(lo+hi)*.5])});
    door.solid=box(car,door,local([side*.869,.577,(lo+hi)*.5]),[.146,.668,hi-lo]);
    handle(door,anchors.pull,[.115,.126,.236],{normal:[side,0,0],action:"door"});
    const pane=part(car,"glass",asset("side pane "+key,model(m,"side_glass_"+key),{ray:[m.carGlass]}),
      {parent:door,door,hp:.44,transparent:true,center:local([side*.775,1.080,(lo+hi)*.5])});
    box(car,pane,local([side*.787,1.117,(lo+hi)*.5]),[.150,.390,(hi-lo)*.79]);
    if(front) {
      part(car,"carTrim",asset(color+" mirror "+side,model(m,"mirror_housing_"+key,paint),
        {ray:[m.carPaint]}),{parent:door,center:local([side*1.021,.987,.76])});
      part(car,"glass",asset("side mirror "+side,model(m,"mirror_glass_"+key),{ray:[m.carMetal]}),
        {parent:door,door,opaqueGlass:true,hp:.25,center:local([side*1.021,.987,.70])});
    }
    const lock=part(car,"carLock",asset("door lock",model(m,"door_lock")),{parent:door,pivot:anchors.lock,pane,door});
    handle(lock,[0,.013,0],[.148,.115,.167],{top:true,pointing:true,action:"unlock"});
    const inner=part(car,"carHandle",null,{parent:door,door,pane});
    handle(inner,anchors.release,[.059,.084,.126],
      {normal:[-side,0,0],action:"door"});
  }

  function openableLid(car,asset,front) {
    const m=car.scene.material, name=front ? "hood" : "trunk", key=front ? "hood" : "trunk_lid";
    const {hinge:pivot,latch}=Valley.blenderAssets.get("sedan_"+key).anchors;
    const item=part(car,"carLid",asset(car.color+" "+name,model(m,key,car.paint),
      {ray:[m.carPaint],dent:true}),
      {pivot,center:[0,-.08,front ? .585 : -.237],...opening(0),pitch:front ? -1.02 : 1.07,label:name,latch:0});
    handle(item,latch,[1.27,.152,.37],{top:true,action:"lid"});
    item.solid=box(car,item,[0,-.142,front ? .60 : -.24],[1.416,.238,front ? 1.13 : .48],{kind:"rock"});
  }

  function installedProp(car,asset,kind,parent,at) {
    const m=car.scene.material, ashtray=kind==="ashtray";
    const compiled=asset(kind,model(m,kind),{accessory:true});
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
      const body=part(car,"carBody",asset(color+" shell",p=>shell(p,m,car.paint,signs),
        {ray:[m.carPaint,m.plain,m.carMetal,m.carLens],dent:true}));
      box(car,body,[0,.182,-.101],[1.679,.083,2.47],{kind:"rock",follow:false});
      for(const front of [true,false]) {
        const side=front ? 1 : -1;
        box(car,body,[0,.413,side*1.804],[1.66,.55,1.028],{kind:"rock",follow:false});
        openableLid(car,asset,front);
        part(car,"glass",asset(front ? "windshield" : "rear window",model(m,front ? "windshield" : "back_glass"),{ray:[m.carGlass]}),
          {hp:front ? .81 : .54,transparent:true,center:[0,1.167,front ? .626 : -1.295]});
        for(const s of [-1,1]) {
          const key=endName(front)+"_"+sideName(s);
          const lamp=front ? [s*.654,.659,2.040] : [s*.735,.777,-2.315];
          part(car,"carTrim",asset("lamp socket "+key,model(m,"lamp_socket_"+key)),{center:lamp});
          part(car,"glass",asset("lamp "+key,model(m,"lamp_"+key),{ray:[m.carLens]}),
            {hp:.37,opaqueGlass:true,center:lamp});
        }
      }
      const top=part(car,"carBody",asset(color+" roof",model(m,"roof",car.paint),{ray:[m.carPaint],dent:true}));
      box(car,top,[0,1.395,-.390],[1.265,.090,1.30],{kind:"rock",follow:false});
      part(car,"carTrim",asset("wipers",model(m,"wipers")),{center:[0,.97,.887]});
      for(const side of [-1,1]) {
        doorParts(car,asset,side,true);
        doorParts(car,asset,side,false);
        box(car,body,[side*.800,.071,-.103],[.226,.153,2.15],{kind:"rock",follow:false});
        for(const z of wheelStations) {
          const position=[side*wheelX,wheelHeight,z], turn=side<0 ? Math.PI : 0;
          const tire=part(car,"carTire",asset("tire",model(m,"tire"),{ray:[m.carTire]}),
            {pivot:position,turn,tire:true,air:1,wheelDrop:0,hp:.39});
          tire.hub=part(car,"carTrim",asset("alloy wheel",model(m,"hub"),{ray:[m.carMetal]}),{pivot:position,turn});
          box(car,tire,[0,.009,0],[.24,.62,.63],{kind:"rock"});
        }
      }
      const cabin=part(car,"carCabin",asset("seats",model(m,"upholstery")));
      for(const x of [-.427,.427]) box(car,cabin,[x,.401,.145],[.51,.265,.49],{kind:"rock",follow:false});
      box(car,cabin,[0,.407,-.878],[1.38,.270,.485],{kind:"rock",follow:false});
      const dash=part(car,"carCabin",asset("dash",model(m,"dashboard")));
      box(car,dash,[0,.793,.889],[1.49,.325,.29],{follow:false});
      part(car,"carTrim",asset("rearview shell",model(m,"rearview_housing")),{center:[0,1.243,.348]});
      part(car,"glass",asset("rearview glass",model(m,"rearview_glass"),{ray:[m.carMetal]}),
        {hp:.23,opaqueGlass:true,center:[0,1.201,.374]});
      part(car,"carTrim",asset("engine and trunk",model(m,"engine_and_boot"),{ray:[m.carMetal]}));
      const {anchors:gloveAnchors}=Valley.blenderAssets.get("sedan_glove_box");
      const glove=part(car,"carStorage",asset("glove box",model(m,"glove_box"),{ray:[m.carLeather]}),
        {pivot:gloveAnchors.hinge,...opening(0),pitch:-1.05,label:"glove box"});
      handle(glove,gloveAnchors.pull,[.40,.175,.111],{action:"storage"});
      const console=part(car,"carStorage",asset("console lid",model(m,"console_lid"),{ray:[m.carLeather,m.fabric]}),
        {pivot:[0,.509,-.270],...opening(0),pitch:-1.16,label:"console"});
      handle(console,[0,.059,.243],[.252,.096,.239],{top:true,action:"storage"});
      const drawer=part(car,"carStorage",asset("ashtray drawer",model(m,"ashtray_drawer"),{ray:[m.carWood]}),
        {pivot:[0,.540,.626],...opening(0),move:[0,0,-.173],label:"ashtray"});
      handle(drawer,[0,.014,-.035],[.150,.075,.090],{action:"storage"});
      installedProp(car,asset,"ashtray",drawer,[0,-.014,.058]);
      installedProp(car,asset,"lighter",dash,[-.096,.579,.613]);
      const well=part(car,"carTrim",asset("footwells",model(m,"footwells")));
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
