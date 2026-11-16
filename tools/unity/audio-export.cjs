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

const drives={
  "motor-pistol":[164,31,1],
  "motor-rifle":[126,24,.92],
  "motor-smg":[210,36,.82],
  "motor-smg-test":[171,29,.75]
};
const strikes={
  "shot-pistol":[1.08,.19],
  "shot-rifle":[.83,.29],
  "shot-smg":[1.19,.23]
};

const tau=Math.PI*2;
function motorLoop(rate, drive) {
  const samples=new Float64Array(rate);
  for(let i=0;i<samples.length;i++) {
    const t=i/rate;
    const sine=(hz,phase=0)=>Math.sin(tau*hz*t+phase);
    if(!drive) {
      // A light modulation makes the high harmonics sound like a spinning
      // rotor. Unity drives the pitch and volume throughout the spin-up.
      const modulation=.23*sine(71)+.09*sine(131);
      samples[i]=(.83+.12*sine(155))*(.53*sine(1156,modulation)+
        .23*sine(2312,modulation*2)+.12*sine(3468)+.062*sine(4660)+.035*sine(5750));
    } else {
      const [gear,rollers,body]=drive;
      const phase=(t*rollers)%1;
      const tooth=(1-Math.exp(-phase*140))*Math.exp(-phase*9);
      samples[i]=(.66+.28*sine(rollers))*(body*.54*sine(gear)+.18*sine(gear*2)+.092*sine(gear*3))+
        tooth*(.23*sine(gear*4)+.15*sine(1724)+.065*sine(2827));
    }
  }
  return samples;
}

function metalRelease(rate,[pitch,duration]) {
  const samples=new Float64Array(Math.round(rate*duration));
  let seed=827461, low=0,mid=0;
  const bodies=[[117,.43,23],[346,.23,31],[728,.14,34],[1428,.16,48],[2624,.093,62],[3546,.071,54]];
  for(let i=0;i<samples.length;i++) {
    const t=i/rate;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=seed/2147483648-1;
    low+=.059*(noise-low);
    mid+=.47*(noise-mid);
    for(const [at,weight] of [[0,1],[.012,.62],[.029,.39]]) {
      const age=t-at;
      if(age<0) continue;
      const transient=(.58*(mid-low)+.24*(noise-mid))*Math.exp(-age*84);
      let ring=0;
      for(const [frequency,strength,decay] of bodies)
        ring+=strength*Math.sin(tau*frequency*pitch*age)*Math.exp(-age*decay);
      samples[i]+=weight*(transient+ring)*Math.min(1,age*1420);
    }
    samples[i]=Math.tanh(samples[i]*1.56)*(1-Math.pow(t/duration,7));
  }
  return samples;
}

function writeCrafted(name,samples,rate,ceiling) {
  let peak=0;
  for(const sample of samples) peak=Math.max(peak,Math.abs(sample));
  for(let i=0;i<samples.length;i++) samples[i]*=ceiling/peak;
  fs.writeFileSync(path.join(folder,name+".wav"),wav(samples,rate));
}

async function exportSounds() {
  const requested=new Set(process.argv.slice(2));
  const selected=name=>!requested.size || requested.has(name);
  const rate=24000;
  fs.mkdirSync(folder,{recursive:true});
  if(selected("booster")) writeCrafted("booster",motorLoop(rate),rate,.69);
  for(const [name,drive] of Object.entries(drives))
    if(selected(name)) writeCrafted(name,motorLoop(rate,drive),rate,.62);
  for(const [name,strike] of Object.entries(strikes))
    if(selected(name)) writeCrafted(name,metalRelease(rate,strike),rate,.82);
  const selection=clips.filter(([name])=>selected(name));
  if(!selection.length) return;
  const executablePath=process.env.VALLEY_CHROMIUM;
  const browser=await chromium.launch({headless:true,executablePath});
  try {
    const page=await browser.newPage();
    await page.addScriptTag({content:read("render.js")+"\nglobalThis.Valley = Valley;"});
    await page.addScriptTag({content:"const {random,clamp,mix,smooth}=Valley;\n"+synth+"\nglobalThis.ValleySound=Sound;"});
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
