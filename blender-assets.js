"use strict";

(() => {
  const {cross,dot,direction,minus,multiply,transform}=Valley;
  const models=globalThis.ValleyBlenderModels, decoded=new Map(), meshCache=new WeakMap();
  const defaultMaterials={body:0,skin:7,gloss:15,sleeve:16};

  function decode(encoded,Type) {
    const bytes=Uint8Array.from(atob(encoded),letter=>letter.charCodeAt(0));
    return new Type(bytes.buffer);
  }

  function get(name) {
    if(decoded.has(name)) return decoded.get(name);
    const definition=models[name];
    if(!definition) throw new Error("Missing Blender model "+name);
    const parts=definition.parts.map(({slot,vertices,indices,joints,weights})=>({
      slot,shape:{vertices:decode(vertices,Float32Array),indices:decode(indices,Uint32Array)},
      joints:joints ? decode(joints,Uint16Array) : null,
      weights:weights ? decode(weights,Float32Array) : null
    }));
    const model={parts,pivots:definition.pivots,jointCount:definition.jointCount??3};
    decoded.set(name,model);
    return model;
  }

  function materialFor(materials,slot) {
    const material=materials?.[slot]??defaultMaterials[slot];
    if(material===undefined) throw new Error("Missing Blender material "+slot);
    return material;
  }

  function shapes(name,materials) {
    return get(name).parts.map(({slot,shape})=>({slot,shape,material:materialFor(materials,slot)}));
  }

  function meshes(renderer,name,materials) {
    if(!meshCache.has(renderer)) meshCache.set(renderer,new Map());
    const cache=meshCache.get(renderer);
    if(cache.has(name)) return cache.get(name);
    const model=get(name);
    cache.set(name,model.parts.map(({slot,shape,joints,weights})=>{
      let skin=null;
      if(weights) {
        if(!joints) {
          joints=new Uint16Array(weights.length);
          for(let i=0;i<joints.length;i+=4) {
            joints[i+1]=1;
            joints[i+2]=2;
          }
        }
        skin={count:model.jointCount,joints,weights};
      }
      return renderer.mesh(shape,materialFor(materials,slot),undefined,null,skin);
    }));
    return cache.get(name);
  }

  function append(target,shape,matrix,tint=[1,1,1]) {
    const {vertices,indices}=shape, offset=target.vertices.length/11;
    const x=[matrix[0],matrix[1],matrix[2]],y=[matrix[4],matrix[5],matrix[6]],z=[matrix[8],matrix[9],matrix[10]];
    const xn=cross(y,z),yn=cross(z,x),zn=cross(x,y);
    const sign=Math.sign(dot(x,xn));
    for(let i=0;i<vertices.length;i+=11) {
      const u=vertices[i],v=vertices[i+1],w=vertices[i+2];
      const a=vertices[i+3],b=vertices[i+4],c=vertices[i+5];
      const nx=a*xn[0]+b*yn[0]+c*zn[0],ny=a*xn[1]+b*yn[1]+c*zn[1],nz=a*xn[2]+b*yn[2]+c*zn[2];
      const normalize=sign/(Math.hypot(nx,ny,nz)||1);
      target.vertices.push(
        matrix[12]+u*x[0]+v*y[0]+w*z[0],matrix[13]+u*x[1]+v*y[1]+w*z[1],matrix[14]+u*x[2]+v*y[2]+w*z[2],
        nx*normalize,ny*normalize,nz*normalize,vertices[i+6],vertices[i+7],
        vertices[i+8]*tint[0],vertices[i+9]*tint[1],vertices[i+10]*tint[2]
      );
    }
    for(let i=0;i<indices.length;i+=3) {
      target.indices.push(indices[i]+offset,indices[i+(sign<0 ? 2 : 1)]+offset,indices[i+(sign<0 ? 1 : 2)]+offset);
    }
  }

  function turnAt(pivot,angle) {
    const matrix=transform([0,0,0],0,0,angle);
    matrix.set(minus(pivot,direction(matrix,pivot)),12);
    return matrix;
  }

  function fingerPalette(pivots,bend) {
    const middle=turnAt(pivots[0],-bend*.53), end=turnAt(pivots[1],-bend*.81);
    const palette=new Float32Array(48);
    palette.set(transform([0,0,0]),0);
    palette.set(middle,16);
    palette.set(multiply(middle,end),32);
    return palette;
  }

  Valley.blenderAssets={get,shapes,meshes,append,fingerPalette};
})();
