"use strict";

const fs=require("node:fs");
const path=require("node:path");
const {inflateSync}=require("node:zlib");
const root=path.resolve(__dirname,"../..");
const web=fs.readFileSync(path.join(root,"tape-font.css"),"utf8");
const woff=Buffer.from(web.match(/data:font\/woff;base64,([^"]+)/)[1],"base64");
const count=woff.readUInt16BE(12), size=woff.readUInt32BE(16);
const font=Buffer.alloc(size);
const search=2**Math.floor(Math.log2(count));
font.writeUInt32BE(woff.readUInt32BE(4),0);
font.writeUInt16BE(count,4);
font.writeUInt16BE(search*16,6);
font.writeUInt16BE(Math.log2(search),8);
font.writeUInt16BE(count*16-search*16,10);
let offset=12+count*16;
for(let i=0;i<count;i++) {
  const directory=44+i*20, row=12+i*16;
  const start=woff.readUInt32BE(directory+4), packed=woff.readUInt32BE(directory+8);
  const bytes=woff.readUInt32BE(directory+12), checksum=woff.readUInt32BE(directory+16);
  const contents=woff.subarray(start,start+packed);
  const table=packed===bytes ? contents : inflateSync(contents);
  if(table.length!==bytes) throw new Error("Invalid font table");
  woff.copy(font,row,directory,directory+4);
  font.writeUInt32BE(checksum,row+4);
  font.writeUInt32BE(offset,row+8);
  font.writeUInt32BE(bytes,row+12);
  table.copy(font,offset);
  offset+=Math.ceil(bytes/4)*4;
}
if(offset!==font.length) throw Error("Wrong length for the Valley Tape TrueType file");
const folder=path.join(root,"unity/Assets/Valley/Resources/ValleyTape");
fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(path.join(folder,"Tape.ttf"),font);
console.log("Converted the original Valley Tape font to TrueType.");
