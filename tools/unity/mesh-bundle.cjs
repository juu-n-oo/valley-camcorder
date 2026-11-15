"use strict";

const zlib = require("node:zlib");

function encodedMesh(mesh, id) {
  const {material,shape:{vertices,indices}}=mesh;
  const count=vertices.length/11, width=count>65535 ? 4 : 2;
  const buffer=Buffer.allocUnsafe(20+count*29+indices.length*width);
  buffer.writeInt32LE(id,0); buffer.writeInt32LE(material,4); buffer.writeInt32LE(count,8);
  buffer.writeInt32LE(indices.length,12); buffer.writeInt32LE(width,16);
  let at=20;
  for(let i=0;i<vertices.length;i+=11) {
    for(let j=0;j<3;j++) at=buffer.writeFloatLE(vertices[i+j],at);
    for(let j=3;j<6;j++) at=buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,vertices[i+j]))*32767),at);
    for(let j=6;j<8;j++) at=buffer.writeFloatLE(vertices[i+j],at);
    for(let j=8;j<11;j++) at=buffer.writeUInt8(Math.round(Math.max(0,Math.min(1.35,vertices[i+j]))*180),at);
  }
  for(const index of indices) at=width===4 ? buffer.writeUInt32LE(index,at) : buffer.writeUInt16LE(index,at);
  return buffer;
}

function meshBundle(meshes, ids) {
  const header=Buffer.alloc(8);
  header.write("VCM1");
  header.writeUInt32LE(ids.length,4);
  return zlib.gzipSync(Buffer.concat([header,...ids.map(id=>encodedMesh(meshes[id],id))]),{level:6});
}

module.exports = meshBundle;
