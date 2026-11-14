"use strict";

(() => {
  const {clamp,mix,smooth}=Valley;

  class MovementSound {
    constructor(context,destination,random) {
      this.context=context;
      this.destination=destination;
      this.random=random;
      this.previous={};
      this.load=0;
      this.until=0;
      this.winded=false;
      this.running=false;
      this.voice=null;
      this.banks=new Map();
      const banks=[Valley.movementAudio,Valley.outdoorStoneAudio,Valley.outdoorWoodAudio,Valley.indoorStoneAudio,
        Valley.dirtLeafAudio,Valley.woodStairAudio,Valley.stoneStairAudio,Valley.breathingAudio,Valley.grassAudio,
        Valley.lawnAudio];
      this.ready=Promise.all(banks.map(bank=>this.loadBank(bank)));
    }

    async loadBank(bank) {
      if(!bank) return;
      try {
        const encoded=atob(bank.wav);
        const bytes=new Uint8Array(encoded.length);
        for(let i=0;i<bytes.length;i++) bytes[i]=encoded.charCodeAt(i);
        const buffer=await this.context.decodeAudioData(bytes.buffer);
        for(const [kind,clips] of Object.entries(bank.clips)) this.banks.set(kind,{buffer,clips,rate:bank.rate});
        for(const [alias,kind] of Object.entries(bank.aliases??{})) {
          const sample=this.banks.get(kind);
          if(sample) this.banks.set(alias,sample);
        }
      } catch(error) {
        console.warn("Unable to decode the player movement recording.",error);
      }
    }

    play(kind,volume,{speed=1,pan=0,voice=false}={}) {
      const bank=this.banks.get(kind), clips=bank?.clips;
      if(!clips?.length || volume<=0) return 0;
      const last=this.previous[kind];
      const avoidRepeat=last!==undefined && clips.length>1;
      let index=Math.floor(this.random()*(clips.length-Number(avoidRepeat)));
      if(avoidRepeat && index>=last) index++;
      this.previous[kind]=index;
      const [frame,length]=clips[index];
      const context=this.context, time=context.currentTime, duration=length/bank.rate;
      const source=context.createBufferSource(), gain=context.createGain();
      source.buffer=bank.buffer;
      source.playbackRate.value=speed;
      gain.gain.value=volume;
      source.connect(gain);
      const panner=pan ? context.createStereoPanner() : null;
      if(panner) {
        panner.pan.value=pan;
        gain.connect(panner).connect(this.destination);
      } else gain.connect(this.destination);
      if(voice) {
        this.stopVoice();
        this.voice={source,gain};
      }
      source.onended=()=>{
        if(this.voice?.source===source) this.voice=null;
        source.disconnect();
        gain.disconnect();
        panner?.disconnect();
      };
      source.start(time,frame/bank.rate,duration);
      return duration/speed;
    }

    stopVoice() {
      if(!this.voice) return;
      const {source,gain}=this.voice, time=this.context.currentTime;
      this.voice=null;
      gain.gain.setTargetAtTime(0,time,.016);
      source.stop(time+.066);
    }

    reset() {
      this.stopVoice();
      this.load=0;
      this.until=0;
      this.winded=false;
      this.running=false;
    }

    breathe(dt,effort,silent) {
      if(silent) {
        this.reset();
        return;
      }
      const running=effort>.22;
      if(this.running && !running) this.until=Math.min(this.until,.55);
      this.running=running;
      this.load=clamp(this.load+dt*(running ? effort*.10 : -.105),0,1);
      if(this.load>=.28) this.winded=true;
      if(!this.winded) return;
      this.until-=dt;
      if(this.until>0 || this.voice) return;
      if(!running && this.load<=.12) {
        if(!this.play("deepBreath",.31,{speed:.86,voice:true})) this.play("settle",.24,{speed:.92,voice:true});
        this.winded=false;
        this.until=0;
        return;
      }
      const strain=smooth(.12,1,this.load), variation=mix(.97,1.03,this.random());
      const intensity=this.load>=.68 ? "Hard" : this.load>=.42 ? "Medium" : "Light";
      const kind=running ? "runBreath"+intensity : "recoveryBreath";
      const level=running ? mix(.39,.87,strain) : mix(.26,.70,strain);
      const speed=running ? mix(.95,1.13,strain) : mix(.80,1.02,strain);
      const interval=running ? mix(1.82,.94,strain) : mix(2.38,1.24,strain);
      const settings={speed:speed*variation,voice:true};
      const duration=this.play(kind,level,settings) || this.play("breath"+intensity,level,settings);
      this.until=Math.max(duration+.085,interval*variation);
    }
  }

  Valley.MovementSound=MovementSound;
})();
