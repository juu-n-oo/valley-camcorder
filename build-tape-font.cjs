"use strict";

// Rebuild the offline UI font with Node.js after adding Hangul text to the game.
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { deflateSync } = require("node:zlib");

// Dot stencils are drawn from the game references. Every Latin capital and
// digit occupies the same cell, so the date and counters do not shift.
const latin = {
  " ": ".....",
  A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
  B: "####./#...#/#...#/####./#...#/#...#/####.",
  C: ".###./#...#/#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/####.",
  E: "#####/#..../#..../####./#..../#..../#####",
  F: "#####/#..../#..../####./#..../#..../#....",
  G: ".###./#...#/#..../#.###/#...#/#...#/.###.",
  H: "#...#/#...#/#...#/#####/#...#/#...#/#...#",
  I: "#####/..#../..#../..#../..#../..#../#####",
  J: "..###/...#./...#./...#./...#./#..#./.##..",
  K: "#...#/#..#./#.#../##.../#.#../#..#./#...#",
  L: "#..../#..../#..../#..../#..../#..../#####",
  M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#",
  N: "#...#/##..#/#.#.#/#..##/#...#/#...#/#...#",
  O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  P: "####./#...#/#...#/####./#..../#..../#....",
  Q: ".###./#...#/#...#/#...#/#.#.#/#..#./.##.#",
  R: "####./#...#/#...#/####./#.#../#..#./#...#",
  S: ".###./#...#/#..../.###./....#/#...#/.###.",
  T: "#####/..#../..#../..#../..#../..#../..#..",
  U: "#...#/#...#/#...#/#...#/#...#/#...#/.###.",
  V: "#...#/#...#/#...#/#...#/.#.#./.#.#./..#..",
  W: "#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#",
  X: "#...#/#...#/.#.#./..#../.#.#./#...#/#...#",
  Y: "#...#/#...#/.#.#./..#../..#../..#../..#..",
  Z: "#####/...##/..##./.##../##.../#..../#####",
  a: "...../...../.###./....#/.####/#...#/.####",
  b: "#..../#..../####./#...#/#...#/#...#/####.",
  c: "...../...../.###./#..../#..../#..../.###.",
  d: "....#/....#/.####/#...#/#...#/#...#/.####",
  e: "...../...../.###./#...#/#####/#..../.###.",
  f: "..##./.#.../####./.#.../.#.../.#.../.#...",
  g: "...../...../.####/#...#/#...#/#...#/.####/....#/.###.",
  h: "#..../#..../####./#...#/#...#/#...#/#...#",
  i: "..#../...../.##../..#../..#../..#../.###.",
  j: "...#./...../..##./...#./...#./...#./...#./#..#./.##..",
  k: "#..../#..../#..#./#.#../##.../#.#../#..#.",
  l: ".##../..#../..#../..#../..#../..#../.###.",
  m: "...../...../##.#./#.#.#/#.#.#/#.#.#/#...#",
  n: "...../...../####./#...#/#...#/#...#/#...#",
  o: "...../...../.###./#...#/#...#/#...#/.###.",
  p: "...../...../####./#...#/#...#/#...#/####./#..../#....",
  q: "...../...../.####/#...#/#...#/#...#/.####/....#/....#",
  r: "...../...../#.##./##..#/#..../#..../#....",
  s: "...../...../.####/#..../.###./....#/####.",
  t: ".#.../.#.../####./.#.../.#.../.#.../..##.",
  u: "...../...../#...#/#...#/#...#/#...#/.####",
  v: "...../...../#...#/#...#/#...#/.#.#./..#..",
  w: "...../...../#...#/#...#/#.#.#/#.#.#/.#.#.",
  x: "...../...../#...#/.#.#./..#../.#.#./#...#",
  y: "...../...../#...#/#...#/#...#/.####/....#/....#/.###.",
  z: "...../...../#####/...#./..#../.#.../#####",
  0: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  1: "..#../.##../#.#../..#../..#../..#../..#..",
  2: ".###./#...#/....#/...#./..#../.#.../#####",
  3: "####./....#/....#/.###./....#/....#/####.",
  4: "...#./..##./.#.#./#..#./#####/...#./...#.",
  5: "#####/#..../#..../####./....#/#...#/.###.",
  6: ".###./#..../#..../####./#...#/#...#/.###.",
  7: "#####/....#/...#./..#../..#../.#.../.#...",
  8: ".###./#...#/#...#/.###./#...#/#...#/.###.",
  9: ".###./#...#/#...#/.####/....#/....#/.###.",
  "'": ".##/.##/..#/...../...../...../.....",
  ":": "...../...../..#../...../...../..#../.....",
  ".": "...../...../...../...../...../...../..#..",
  ",": "...../...../...../...../...../...../..#../.#...",
  "/": "....#/....#/...#./..#../.#.../#..../#....",
  "%": "##..#/##..#/...#./..#../.#.../#..##/#..##",
  "-": "...../...../...../.###./...../...../.....",
  "·": "...../...../...../..#../...../...../.....",
};

const consonants = {
  g: [[[0,0],[6,0],[6,6]]],
  n: [[[0,0],[0,6],[6,6]]],
  d: [[[6,0],[0,0],[0,6],[6,6]]],
  r: [[[0,0],[6,0],[6,3],[0,3],[0,6],[6,6]]],
  m: [[[0,0],[6,0],[6,6],[0,6],[0,0]]],
  b: [[[0,0],[0,6],[6,6],[6,0]],[[0,3],[6,3]]],
  s: [[[0,6],[3,0],[6,6]]],
  o: [[[2,0],[4,0],[6,2],[6,4],[4,6],[2,6],[0,4],[0,2],[2,0]]],
  j: [[[0,0],[6,0]],[[0,6],[3,1],[6,6]]],
  c: [[[2,0],[4,0]],[[0,2],[6,2]],[[0,6],[3,2],[6,6]]],
  k: [[[0,0],[6,0],[6,6]],[[0,3],[6,3]]],
  t: [[[6,0],[0,0],[0,6],[6,6]],[[0,3],[6,3]]],
  p: [[[0,0],[6,0]],[[0,6],[6,6]],[[2,0],[2,6]],[[4,0],[4,6]]],
  h: [[[2,0],[4,0]],[[0,2],[6,2]],[[2,4],[4,4],[5,5],[4,6],[2,6],[1,5],[2,4]]],
};
const initials = "g gg n d dd r m b bb s ss o j jj c k t p h".split(" ");
const finals = " g gg gs n nj nh d r rg rm rb rs rt rp rh m b bs s ss o j c k t p h".split(" ");
const vowels = "a ae ya yae eo e yeo ye o wa wae oe yo u wo we wi yu eu ui i".split(" ");
const vertical = {
  a: [[[1,0],[1,6]],[[1,3],[6,3]]],
  ae: [[[0,0],[0,6]],[[0,3],[5,3]],[[5,0],[5,6]]],
  ya: [[[1,0],[1,6]],[[1,2],[6,2]],[[1,4],[6,4]]],
  yae: [[[0,0],[0,6]],[[0,2],[5,2]],[[0,4],[5,4]],[[5,0],[5,6]]],
  eo: [[[5,0],[5,6]],[[0,3],[5,3]]],
  e: [[[3,0],[3,6]],[[0,3],[3,3]],[[6,0],[6,6]]],
  yeo: [[[5,0],[5,6]],[[0,2],[5,2]],[[0,4],[5,4]]],
  ye: [[[3,0],[3,6]],[[0,2],[3,2]],[[0,4],[3,4]],[[6,0],[6,6]]],
  i: [[[3,0],[3,6]]],
};
const mixed = { wa:["o","a"], wae:["o","ae"], oe:["o","i"],
  wo:["u","eo"], we:["u","e"], wi:["u","i"], ui:["eu","i"] };

function draw(grid, stroke) {
  for (let i = 1; i < stroke.length; i++) {
    const [x, y] = stroke[i - 1];
    const dx = stroke[i][0] - x, dy = stroke[i][1] - y;
    const steps = Math.max(1, Math.abs(dx), Math.abs(dy));
    for (let s = 0; s <= steps; s++) {
      grid[y + Math.round(dy * s / steps)][x + Math.round(dx * s / steps)] = true;
    }
  }
}

function stamp(grid, stencil, left, top, right, bottom) {
  for (const stroke of stencil) {
    draw(grid, stroke.map(([x,y])=>[
      left + Math.round(x * (right - left) / 6),
      top + Math.round(y * (bottom - top) / 6),
    ]));
  }
}

function consonant(grid, key, left, top, right, bottom) {
  if (key.length === 1) {
    stamp(grid, consonants[key], left, top, right, bottom);
  } else {
    const mid = Math.floor((left + right) / 2);
    stamp(grid, consonants[key[0]], left, top, mid - 1, bottom);
    stamp(grid, consonants[key[1]], mid + 1, top, right, bottom);
  }
}

function horizontal(grid, key, left, right, bottom) {
  const down = key.startsWith("u") || key === "yu";
  const y = down ? bottom - 2 : bottom;
  draw(grid, [[left,y],[right,y]]);
  if (key === "eu") return;
  const center = Math.round((left + right) / 2);
  for (const x of key.startsWith("y") ? [center - 2, center + 2] : [center]) {
    draw(grid, [[x,y],[x,y + (down ? 2 : -2)]]);
  }
}

function syllable(char) {
  const code = char.charCodeAt(0) - 0xac00;
  const leading = initials[Math.floor(code / 588)];
  const vowel = vowels[Math.floor(code / 28) % 21];
  const trailing = finals[code % 28];
  const grid = Array.from({length:14},()=>Array(14).fill(false));
  const end = trailing ? 8 : 13;
  if (vertical[vowel]) {
    consonant(grid, leading, 0, 1, 6, end - 1);
    stamp(grid, vertical[vowel], 8, 0, 13, end);
  } else if (mixed[vowel]) {
    const [below, beside] = mixed[vowel];
    consonant(grid, leading, 0, 0, 6, end - 4);
    horizontal(grid, below, 0, 7, end);
    stamp(grid, vertical[beside], 8, 0, 13, end);
  } else {
    consonant(grid, leading, 2, 0, 11, end - 4);
    horizontal(grid, vowel, 1, 12, end);
  }
  if (trailing) {
    const [left, right] = trailing.length === 1 ? [3,10] : [0,13];
    consonant(grid, trailing, left, 10, right, 13);
  }
  return grid;
}

// Pack the pixel outlines into a simple, unhinted TrueType face.
const shorts = (...values) => {
  const buffer = Buffer.alloc(2 * values.length);
  values.forEach((value,i)=>buffer.writeUInt16BE(value & 0xffff,2 * i));
  return buffer;
};
const longs = (...values) => {
  const buffer = Buffer.alloc(4 * values.length);
  values.forEach((value,i)=>buffer.writeUInt32BE(value >>> 0,4 * i));
  return buffer;
};
const concat = parts => Buffer.concat(parts);
const align4 = bytes => (bytes + 3) & ~3;
const padded = buffer => concat([buffer,Buffer.alloc(align4(buffer.length) - buffer.length)]);
function checksum(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 4) sum = (sum + buffer.readUInt32BE(i)) >>> 0;
  return sum;
}

function outline(rows, dx, dy, baseline, advance) {
  const rects = [];
  for (const [y,row] of rows.entries()) {
    for (let x = 0; x < row.length;) {
      if (!row[x]) { x++; continue; }
      const left = x;
      while (row[x]) x++;
      rects.push([left*dx,(baseline-y-1)*dy,x*dx,(baseline-y)*dy]);
    }
  }
  if (!rects.length) return { data:Buffer.alloc(0), box:[0,0,0,0], contours:0, advance };
  const box = [Math.min(...rects.map(r=>r[0])), Math.min(...rects.map(r=>r[1])),
    Math.max(...rects.map(r=>r[2])), Math.max(...rects.map(r=>r[3]))];
  const points = rects.flatMap(([l,b,r,t])=>[[l,b],[l,t],[r,t],[r,b]]);
  const deltas = axis => points.map((p,i)=>p[axis] - (i ? points[i-1][axis] : 0));
  const data = concat([shorts(rects.length,...box),shorts(...rects.map((_,i)=>4*i+3),0),
    Buffer.alloc(points.length,1),shorts(...deltas(0)),shorts(...deltas(1))]);
  return { data, box, contours:rects.length, advance };
}

function characterMap(chars) {
  const segments = [];
  chars.forEach((char,i)=>{
    const code = char.charCodeAt(0), previous = segments.at(-1);
    if (previous && code === previous.end+1) previous.end = code;
    else segments.push({ start:code, end:code, delta:i+1-code });
  });
  segments.push({ start:0xffff, end:0xffff, delta:1 });
  const count = segments.length, power = Math.floor(Math.log2(count)), search = 2 << power;
  return concat([shorts(0,1,3,1),longs(12),
    shorts(4,16+8*count,0,2*count,search,power,2*count-search,
      ...segments.map(s=>s.end),0,...segments.map(s=>s.start),
      ...segments.map(s=>s.delta),...segments.map(()=>0))]);
}

function fontNames() {
  const values = {1:"Valley Tape",2:"Regular",4:"Valley Tape",5:"Version 1.0",6:"ValleyTape-Regular"};
  const records = [], strings = [];
  let offset = 0;
  for (const [id,value] of Object.entries(values)) {
    const name = Buffer.from(value,"utf16le").swap16();
    records.push(shorts(3,1,0x409,Number(id),name.length,offset));
    strings.push(name);
    offset += name.length;
  }
  return concat([shorts(0,records.length,6+12*records.length),...records,...strings]);
}

function fontTables(chars, glyphs) {
  const head = Buffer.alloc(54), os2 = Buffer.alloc(78);
  const box = [Math.min(...glyphs.map(g=>g.box[0])),Math.min(...glyphs.map(g=>g.box[1])),
    Math.max(...glyphs.map(g=>g.box[2])),Math.max(...glyphs.map(g=>g.box[3]))];
  longs(0x10000,0x10000,0,0x5f0f3cf5).copy(head);
  shorts(3,1000).copy(head,16);
  shorts(...box,0,8,2,1,0).copy(head,36);

  const ascender = 858, descender = -218;
  const hhea = concat([longs(0x10000),shorts(ascender,descender,0,
    Math.max(...glyphs.map(g=>g.advance)),box[0],Math.min(...glyphs.map(g=>g.advance-g.box[2])),
    box[2],1,0,0,0,0,0,0,0,glyphs.length)]);
  const maxContours = Math.max(...glyphs.map(g=>g.contours));
  const maxp = concat([longs(0x10000),shorts(glyphs.length,maxContours*4,maxContours,0,0,1,0,0,0,0,0,0,0,0)]);
  shorts(0,680,400,5).copy(os2);
  longs(1,1 << 24).copy(os2,42);
  os2.write("VLY ",58,"ascii");
  shorts(1 << 6,chars[0].charCodeAt(0),chars.at(-1).charCodeAt(0),
    ascender,descender,0,ascender,-descender).copy(os2,62);

  const shapes = glyphs.map(g=>padded(g.data)), offsets = [0];
  for (const shape of shapes) offsets.push(offsets.at(-1) + shape.length);
  return {
    "OS/2":os2, cmap:characterMap(chars), glyf:concat(shapes), head, hhea,
    hmtx:shorts(...glyphs.flatMap(g=>[g.advance,g.box[0]])), loca:longs(...offsets),
    maxp, name:fontNames(), post:concat([longs(0x30000),Buffer.alloc(28)]),
  };
}

function makeWoff(tables) {
  const tags = Object.keys(tables).sort(), n = tags.length;
  const exponent = Math.floor(Math.log2(n)), search = 16 << exponent;
  const sfntHeader = concat([longs(0x10000),shorts(n,search,exponent,16*n-search)]);
  const records = [];
  let sfntLength = 12 + 16*n;
  for (const tag of tags) {
    const table = tables[tag], sum = checksum(padded(table));
    records.push(concat([Buffer.from(tag),longs(sum,sfntLength,table.length)]));
    sfntLength += align4(table.length);
  }
  const total = checksum(concat([sfntHeader,...records,...tags.map(tag=>padded(tables[tag]))]));
  tables.head.writeUInt32BE((0xb1b0afba - total) >>> 0,8);

  const contents = [], directory = [];
  let offset = 44 + 20*n;
  for (const [i,tag] of tags.entries()) {
    const raw = tables[tag], compressed = deflateSync(raw,{level:9});
    const table = compressed.length < raw.length ? compressed : raw;
    directory.push(concat([Buffer.from(tag),longs(offset,table.length,raw.length,records[i].readUInt32BE(4))]));
    contents.push(padded(table));
    offset += align4(table.length);
  }
  const header = concat([Buffer.from("wOFF"),longs(0x10000,offset),shorts(n,0),
    longs(sfntLength),shorts(1,0),Buffer.alloc(20)]);
  return concat([header,...directory,...contents]);
}

function latinGlyph(pattern, advance = 648) {
  return outline(pattern.split("/").map(row=>Array.from(row,pixel=>pixel==="#")),108,106,7,advance);
}
const directory = __dirname;
const text = ["index.html","game.js"].map(file=>readFileSync(join(directory,file),"utf8")).join("\n");
const korean = new Set(text.match(/[가-힣]/g));
const chars = [...Object.keys(latin),...korean].sort();
const glyphs = [latinGlyph("#####/#...#/#...#/#...#/#...#/#...#/#####"),
  ...chars.map(char=>korean.has(char) ? outline(syllable(char),56,56,14,880)
    : latinGlyph(latin[char],char===" " ? 324 : undefined))];
const woff = makeWoff(fontTables(chars,glyphs));
writeFileSync(join(directory,"tape-font.css"),[
  "/* Generated by build-tape-font.cjs. The embedded font works from a local file. */",
  "@font-face {",
  '  font-family: "Valley Tape";',
  '  src: url("data:font/woff;base64,' + woff.toString("base64") + '") format("woff");',
  "  font-weight: 400;",
  "  font-style: normal;",
  "  font-display: swap;",
  "}",
  "",
].join("\n"));
console.log("Valley Tape",chars.length,"glyphs,",woff.length,"bytes");
