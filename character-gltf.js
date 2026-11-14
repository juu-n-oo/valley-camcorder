"use strict";

(() => {
  const V=Valley, A=V.animation;
  const jsonChunk=0x4e4f534a, binaryChunk=0x004e4942, glbMagic=0x46546c67;
  const textDecoder=new TextDecoder();
  const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
  const components={5120:[1,"getInt8",127],5121:[1,"getUint8",255],5122:[2,"getInt16",32767],
    5123:[2,"getUint16",65535],5125:[4,"getUint32",4294967295],5126:[4,"getFloat32",1]};
  const unsigned=[5121,5123,5125];

  function bytesOf(data) {
    if(ArrayBuffer.isView(data)) return new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
    if(data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error("Expected a glTF buffer as bytes.");
  }

  function parse(source) {
    if(typeof source==="string") return {asset:JSON.parse(source)};
    if(source?.asset) return {asset:source};
    const bytes=bytesOf(source), view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(view.byteLength<4 || view.getUint32(0,true)!==glbMagic) return {asset:JSON.parse(textDecoder.decode(bytes))};
    if(view.byteLength<20 || view.getUint32(4,true)!==2 || view.getUint32(8,true)!==view.byteLength) {
      throw new Error("Invalid glTF 2.0 binary header.");
    }
    let asset, binary;
    for(let offset=12;offset<view.byteLength;) {
      if(offset+8>view.byteLength) throw new Error("Incomplete GLB chunk.");
      const length=view.getUint32(offset,true), type=view.getUint32(offset+4,true), end=offset+8+length;
      if(length%4 || end>view.byteLength || (offset===12 && type!==jsonChunk)) throw new Error("Invalid GLB chunk.");
      const chunk=bytes.subarray(offset+8,end);
      if(type===jsonChunk && !asset) asset=JSON.parse(textDecoder.decode(chunk));
      else if(type===binaryChunk && !binary) binary=chunk;
      offset=end;
    }
    return {asset,binary};
  }

  async function readBuffers(asset,binary,buffers,resolveBuffer) {
    return Promise.all((asset.buffers??[]).map(async ({uri,byteLength},i)=>{
      let source=buffers?.[i];
      if(!source && i===0 && !uri) source=binary;
      if(!source && uri?.startsWith("data:")) {
        const match=/^data:[^,]*;base64,(.*)$/s.exec(uri);
        if(!match) throw new Error("Expected a base64 glTF buffer URI.");
        source=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));
      }
      if(!source && uri && resolveBuffer) source=await resolveBuffer(uri);
      if(!source) throw new Error("Missing glTF buffer "+(uri??i)+".");
      if(typeof source.arrayBuffer==="function") source=await source.arrayBuffer();
      const data=bytesOf(source);
      if(!Number.isSafeInteger(byteLength) || byteLength<0 || data.length<byteLength) throw new Error("Invalid glTF buffer length.");
      return data.subarray(0,byteLength);
    }));
  }

  function stream(asset,buffers,viewIndex,offset,width,component,count,normalized=false) {
    const layout=asset.bufferViews?.[viewIndex], data=buffers[layout?.buffer];
    const [size,method,max]=components[component];
    const packed=width*size, stride=layout?.byteStride??packed, start=layout?.byteOffset??0;
    if(!data || !Number.isSafeInteger(offset) || offset<0 || !Number.isSafeInteger(start) || start<0
      || !Number.isSafeInteger(stride) || stride<packed || stride%size
      || !Number.isSafeInteger(layout.byteLength) || start+layout.byteLength>data.length
      || offset+(count-1)*stride+packed>layout.byteLength) throw new Error("glTF accessor exceeds its buffer view.");
    const view=new DataView(data.buffer,data.byteOffset+start,layout.byteLength);
    return (i,k)=>{
      const n=view[method](offset+i*stride+k*size,true);
      return normalized ? Math.max(-1,n/max) : n;
    };
  }

  function accessor(asset,buffers,index,types,allowed) {
    const a=asset.accessors?.[index], width=widths[a?.type], component=a?.componentType, count=a?.count;
    if(!width || !types.includes(a.type) || !allowed.includes(component)
      || !Number.isSafeInteger(count) || count<1) throw new Error("Invalid glTF accessor "+index+".");
    const data=new Float64Array(count*width);
    if(a.bufferView!==undefined) {
      const read=stream(asset,buffers,a.bufferView,a.byteOffset??0,width,component,count,a.normalized);
      for(let i=0;i<count;i++) for(let k=0;k<width;k++) data[i*width+k]=read(i,k);
    }
    if(a.sparse) {
      const {indices,values,count:changes}=a.sparse;
      if(!Number.isSafeInteger(changes) || changes<1 || changes>count || !unsigned.includes(indices?.componentType)) {
        throw new Error("Invalid glTF sparse accessor.");
      }
      const slots=stream(asset,buffers,indices.bufferView,indices.byteOffset??0,1,indices.componentType,changes);
      const read=stream(asset,buffers,values.bufferView,values.byteOffset??0,width,component,changes,a.normalized);
      let previous=-1;
      for(let i=0;i<changes;i++) {
        const at=slots(i,0);
        if(at>=count || at<=previous) throw new Error("Invalid glTF sparse index.");
        previous=at;
        for(let k=0;k<width;k++) data[at*width+k]=read(i,k);
      }
    }
    if(data.some(n=>!Number.isFinite(n))) throw new Error("Nonfinite glTF accessor values.");
    return {data,width,count};
  }

  function skinRig(asset,buffers,skin) {
    if(!skin?.joints?.length || skin.joints.length>V.maxSkinJoints) throw new Error("Unsupported glTF skin size.");
    const parents=asset.nodes.map(()=>-1), nodes=new Set();
    asset.nodes.forEach((node,parent)=>{
      for(const child of node.children??[]) {
        if(!asset.nodes[child] || parents[child]!==-1) throw new Error("Invalid glTF node hierarchy.");
        parents[child]=parent;
      }
    });
    for(const joint of skin.joints) {
      if(!asset.nodes[joint]) throw new Error("Missing glTF joint node.");
      for(let i=joint;i>=0 && !nodes.has(i);i=parents[i]) nodes.add(i);
    }
    const order=[...nodes], map=new Map(order.map((node,i)=>[node,i]));
    const bones=order.map(i=>({...asset.nodes[i],parent:map.get(parents[i])??-1}));
    const joints=skin.joints.map(i=>map.get(i));
    let inverseBinds=joints.map(()=>V.transform([0,0,0]));
    if(skin.inverseBindMatrices!==undefined) {
      const matrices=accessor(asset,buffers,skin.inverseBindMatrices,["MAT4"],[5126]);
      if(matrices.count<joints.length) throw new Error("Missing glTF inverse-bind matrices.");
      inverseBinds=joints.map((_,i)=>matrices.data.subarray(i*16,(i+1)*16));
    }
    return {skeleton:new A.Skeleton(bones,{joints,inverseBinds}),map};
  }

  function readClips(asset,buffers,map,loop) {
    const clips=Object.create(null);
    for(const [index,animation] of (asset.animations??[]).entries()) {
      const tracks=[];
      for(const {sampler,target} of animation.channels) {
        const bone=map.get(target.node), path=target.path;
        if(bone===undefined || !["translation","rotation","scale"].includes(path)) continue;
        const {input,output,interpolation}=animation.samplers[sampler];
        const times=accessor(asset,buffers,input,["SCALAR"],[5126]).data;
        const values=accessor(asset,buffers,output,[path==="rotation" ? "VEC4" : "VEC3"],[5126]).data;
        tracks.push({bone,path,times,values,interpolation});
      }
      if(tracks.length) {
        const name=animation.name||"Animation "+(index+1);
        let key=name, duplicate=2;
        while(clips[key]) key=`${name} (${duplicate++})`;
        clips[key]=new A.Clip(key,tracks,{loop});
      }
    }
    return clips;
  }

  function primitiveData(asset,buffers,primitive,jointCount) {
    const a=primitive.attributes;
    if((primitive.mode??4)!==4 || primitive.targets?.length || a.JOINTS_1!==undefined || a.WEIGHTS_1!==undefined) {
      throw new Error("Expected glTF triangles with up to four joint influences and no morph targets.");
    }
    const positions=accessor(asset,buffers,a.POSITION,["VEC3"],[5126]);
    const normals=a.NORMAL===undefined ? null : accessor(asset,buffers,a.NORMAL,["VEC3"],[5126]);
    const uv=a.TEXCOORD_0===undefined ? null : accessor(asset,buffers,a.TEXCOORD_0,["VEC2"],[5121,5123,5126]);
    const color=a.COLOR_0===undefined ? null : accessor(asset,buffers,a.COLOR_0,["VEC3","VEC4"],[5121,5123,5126]);
    const jointIndices=accessor(asset,buffers,a.JOINTS_0,["VEC4"],[5121,5123]);
    const jointWeights=accessor(asset,buffers,a.WEIGHTS_0,["VEC4"],[5121,5123,5126]);
    const {count}=positions;
    const indices=primitive.indices===undefined ? Uint32Array.from({length:count},(_,i)=>i)
      : accessor(asset,buffers,primitive.indices,["SCALAR"],unsigned).data;
    if(indices.length%3 || indices.some(i=>!Number.isInteger(i) || i<0 || i>=count)
      || [normals,uv,color,jointIndices,jointWeights].some(a=>a && a.count!==count)) throw new Error("Invalid glTF triangle data.");
    const builder=new V.Builder(), joints=[], weights=[];
    const pos=i=>positions.data.subarray(i*3,i*3+3);
    const base=asset.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor??[1,1,1,1];
    function add(i,normal) {
      const ids=jointIndices.data.subarray(i*4,i*4+4), w=jointWeights.data.subarray(i*4,i*4+4);
      const total=w[0]+w[1]+w[2]+w[3];
      if(total<=0 || w.some(n=>n<0) || ids.some(n=>!Number.isInteger(n) || n<0 || n>=jointCount)) {
        throw new Error("Invalid glTF skin weights or joint indices.");
      }
      joints.push(...ids);
      weights.push(...w.map(n=>n/total));
      const tint=base.slice(0,3).map((v,k)=>v*(color?.data[i*color.width+k]??1));
      return builder.vertex(pos(i),normal,uv?.data.subarray(i*2,i*2+2),tint);
    }
    if(normals) {
      for(let i=0;i<count;i++) add(i,normals.data.subarray(i*3,i*3+3));
      builder.indices=indices;
    } else {
      for(let i=0;i<indices.length;i+=3) {
        const ia=indices[i], ib=indices[i+1], ic=indices[i+2];
        const normal=V.unit(V.cross(V.minus(pos(ib),pos(ia)),V.minus(pos(ic),pos(ia))));
        builder.indices.push(add(ia,normal),add(ib,normal),add(ic,normal));
      }
    }
    return {builder,skin:{joints,weights,count:jointCount}};
  }

  async function load(renderer,source,{node,buffers,resolveBuffer,loop=true}={}) {
    const {asset,binary}=parse(typeof source?.arrayBuffer==="function" ? await source.arrayBuffer() : source);
    if(asset?.asset?.version!=="2.0" || asset.extensionsRequired?.length) {
      throw new Error("Expected glTF 2.0 without required extensions.");
    }
    const skinnedNode=node??asset.nodes?.findIndex(n=>n.mesh!==undefined && n.skin!==undefined);
    const selected=asset.nodes?.[skinnedNode], sourceMesh=asset.meshes?.[selected?.mesh];
    if(!sourceMesh?.primitives?.length || selected.skin===undefined) throw new Error("No skinned glTF mesh at the requested node.");
    const bytes=await readBuffers(asset,binary,buffers,resolveBuffer);
    const {skeleton,map}=skinRig(asset,bytes,asset.skins?.[selected.skin]);
    const clips=readClips(asset,bytes,map,loop);
    const parts=sourceMesh.primitives.map(p=>primitiveData(asset,bytes,p,skeleton.joints.length));
    const meshes=parts.map(({builder,skin})=>renderer.mesh(builder,0,undefined,null,skin));
    return {skeleton,meshes,clips,node:skinnedNode};
  }

  V.characterGLTF={load};
})();
