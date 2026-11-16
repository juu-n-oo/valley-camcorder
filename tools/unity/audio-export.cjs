"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {chromium} = require("playwright");

const root=path.resolve(__dirname,"../..");
const folder=path.join(root,"unity/Assets/Valley/Resources/ValleyEffects");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const source=read("game.js");
const synth=source.slice(source.indexOf("  class Sound {"),source.indexOf("  const audio = new Sound()"));
const clips=[
  ["shot-pistol","release",[]],["shot-rifle","release",[true]],["shot-smg","spiralRelease",[]],
  ["draw","gearChange",["draw",false]],["stow","gearChange",["stow",false]],
  ["rifle-draw","gearChange",["draw",true]],["rifle-stow","gearChange",["stow",true]],
  ["tap","magazineTap",[]],["power","switchClick",[]],["smg-latch","spiralLatch",["index"]],
  ["jam","beltStall",[]],["bubbles","bubbles",[.58]],["gasp","gasp",[false]],["drown","gasp",[true]],["rewind","rewind",[]],
  ["cast","toss",[]],["stove-click","stoveIgnition",[true,false]],["stove-light","stoveIgnition",[false,true]],
  ["timber","woodImpact",[1,true]],["tire","hiss",[0,.72,1350,.21,.63,.018]],
  ["cloth-tear","hiss",[0,.19,2380,.29,.90,.004]],
  ["water-wade","splash",[.72,"wade"]],["water-stroke","splash",[.94,"stroke"]],
  ["water-impact","splash",[1.12,"impact"]],["sand-contact","sand",[1]],
  ["rock-contact","rock",[.92,.48]],["metal-ricochet","ricochet",[.92,.54,47,0,0,false]],
  ["wood-splinter","woodImpact",[1,true]],["flyby","flyby",[.51,47,0,0]],
  ["plastic-contact","propImpact",[{material:"plastic",bent:true},.9]],
  ["plastic-break","propImpact",[{material:"plastic",broken:true},1]],
  ["paper-contact","propImpact",[{material:"paper"},.8]],
  ["cloth-contact","propImpact",[{material:"cloth"},.86]],
  ["vinyl-contact","propImpact",[{material:"vinyl"},.72]],
  ["vinyl-vent","propImpact",[{material:"vinyl",puncture:true},1]],
  ["structure-collapse","woodCollapse",[.89,0]],
  ["floor-land","debrisLand",["wood",.9,0]],["metal-land","debrisLand",["metal",.6,0]],
  ["target-mark","target",[4,false]],["target-finish","target",[8,true]],
  ...["release","throw","stash","pocket","cap","slide","seat","latch"].flatMap(event=>[
    [event,"reload",[event,false]],["rifle-"+event,"reload",[event,true]]
  ]),
  ...["door","fridge","valve","faucet","light","burner","window"].map(kind=>["use-"+kind,"fixture",[kind,true]]),
  ["motor-pistol",[["motor",true,true,false],["beltMotor",true,true,false]],4.5],
  ["motor-rifle",[["motor",true,true,true],["beltMotor",true,true,true]],4.5],
  ["motor-smg",[["spiralDrive",true,true,true]],4.5],
  ["motor-smg-test",[["spiralDrive",false,true,false]],4.5],
  ["underwater",[["submerged",.35]],4.5],["tap-water",[["runningTap",1]],4.5],
  ["pipe-water",[["runningLeak",1,0]],4.5],
  ["venue-alarm",[["fireSystem",{alarm:{level:1,pan:0},spray:{level:0,pan:0}}]],6.0,2.45],
  ["venue-spray",[["fireSystem",{alarm:{level:0,pan:0},spray:{level:1,pan:0}}]],4.5,3]
].filter(([,method])=>typeof method!=="string" || synth.includes("\n    "+method+"("));

function wav(samples, rate) {
  const wav=Buffer.alloc(44+samples.length*2);
  wav.write("RIFF",0); wav.writeUInt32LE(wav.length-8,4); wav.write("WAVEfmt ",8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate*2,28); wav.writeUInt16LE(2,32);
  wav.writeUInt16LE(16,34); wav.write("data",36); wav.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++) wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);
  return wav;
}

async function exportSounds() {
  const executablePath=process.env.VALLEY_CHROMIUM;
  const browser=await chromium.launch({headless:true,executablePath});
  const rate=24000;
  const requested=new Set(process.argv.slice(2));
  const selection=clips.filter(([name])=>!requested.size || requested.has(name));
  try {
    const page=await browser.newPage();
    await page.addScriptTag({content:read("render.js")+"\nglobalThis.Valley = Valley;"});
    await page.addScriptTag({content:"const {random,clamp,mix,smooth}=Valley;\n"+synth+"\nglobalThis.ValleySound=Sound;"});
    fs.mkdirSync(folder,{recursive:true});
    for(const [name,method,args,loopSeconds=3] of selection) {
      const looping=Array.isArray(method);
      const samples=await page.evaluate(async ({method,args,looping,rate})=>{
        const context=new OfflineAudioContext(2,Math.round(rate*(looping?args:1.25)),rate);
        const audio=new globalThis.ValleySound();
        audio.initialize(context);
        audio.master.gain.value=.77;
        audio.water.bubbles.connect(audio.master);
        if(looping) for(const [name,...values] of method) audio[name](...values);
        else {
          // The game guards its score chime on the audio context state. Its
          // offline graph is already scheduled when the renderer starts below.
          Object.defineProperty(context,"state",{value:"running",configurable:true});
          audio[method](...args);
          delete context.state;
        }
        const buffer=await context.startRendering();
        const left=buffer.getChannelData(0), right=buffer.getChannelData(1);
        return Array.from(left,(value,i)=>(value+right[i])*.5);
      },{method,args,looping,rate});
      let segment=samples;
      if(looping) {
        const start=Math.round(rate*.61), fade=Math.round(rate*.045);
        segment=samples.slice(start+fade,start+Math.round(loopSeconds*rate)+fade);
        for(let i=0;i<fade;i++) {
          const at=segment.length-fade+i;
          segment[at]+=(samples[start+i]-segment[at])*i/(fade-1);
        }
      } else {
        let end=samples.length-1;
        while(end>0 && Math.abs(samples[end])<.00018) end--;
        segment=samples.slice(0,Math.min(samples.length,end+Math.round(rate*.024)));
      }
      if(!segment.some(sample=>Math.abs(sample)>.001)) throw Error("Silent sound "+name);
      fs.writeFileSync(path.join(folder,name+".wav"),wav(segment,rate));
    }
    console.log(`Rendered ${selection.length} sound effects from the web game synth.`);
  } finally {await browser.close();}
}
exportSounds().catch(error=>{console.error(error);process.exitCode=1;});
