"use strict";

(() => {
  const { Renderer, clamp, mix, smooth, plus, minus, times, dot, unit, random, transform, multiply, point, direction, camera, waterRipples } = Valley;
  const stage = document.querySelector("#stage");
  const canvas = document.querySelector("#view");
  const play = document.querySelector("#play");
  const playWindowed = document.querySelector("#play-windowed");
  const playLabel = document.querySelector("#play-label");
  const menuNote = document.querySelector("#menu-note");
  const recordState = document.querySelector("#record-state");
  const clock = document.querySelector("#counter");
  const dateTime = document.querySelector("#date-time");
  const reticle = document.querySelector("#aim-mark");
  const count = document.querySelector("#count");
  const carsTotal = document.querySelector("#cars-total");
  const stock = document.querySelector("#cartridge-count");
  const stockLabel = document.querySelector("#stock-label");
  const launcherName = document.querySelector("#launcher-name");
  const healthValue = document.querySelector("#health-value");
  const healthMeter = document.querySelector("#health-meter");
  const breathValue = document.querySelector("#breath-value");
  const breathMeter = document.querySelector("#breath-meter");
  const breathPanel = document.querySelector("#breath");
  const damageTint = document.querySelector("#damage-tint");
  const power = document.querySelector("#motor-status");
  const carSlots = document.querySelector("#cars");
  const location = document.querySelector("#location");
  const caption = document.querySelector("#caption");
  const interaction = document.querySelector("#interaction");
  const resupply = document.querySelector("#resupply");
  const supplyStatus = document.querySelector("#resupply-status");
  const supplyPercent = document.querySelector("#resupply-percent");
  const supplyMeter = document.querySelector("#resupply-meter");
  const practiceHud = document.querySelector("#practice-hud");
  const practiceHint = document.querySelector("#practice-hint");
  const practiceTitle = document.querySelector("#practice-title");
  const practiceScore = document.querySelector("#practice-score");
  const practiceTime = document.querySelector("#practice-time");
  const { launcher, rifle, spiral, world: terrain, props, camp, practice, lodging, utilities, fire } = Valley;
  const {Hands,translation}=Valley.firstPerson;
  const hands=new Hands();
  const animationTest=new URLSearchParams(window.location.search).get("animation-test")==="1";
  while(carSlots.children.length<spiral.carCount) carSlots.append(document.createElement("i"));
  const slots=[...carSlots.children];
  const { weir } = Valley.roadLayout;
  const rng = random(2418);
  const waterRandom = random(8191), woodRandom = random(75231);
  const waterGravity = 9.2, airFall = 7.2, particleLimit = 1350;
  const blastRange=16.8, loosePartLife=30;
  const woodChipRange = 5.3;
  const startingCartridges = 5, rifleSupply = 12;
  const practiceSupplyDuration = 2.4, supplyRange = 1.6, supplyFinishLead = .2;
  const supplyRustles = [.23,.49,.78,1.05,1.36,1.61,1.91,2.16];
  const newCartridge = sealed => ({
    cars:Array.from({length:launcher.carCount},(_,i)=>i),belt:0,feed:0,sealed
  });
  const movementKeys = ["KeyW","KeyA","KeyS","KeyD"];
  const controlKeys = ["ControlLeft","ControlRight"];
  const heldKeys = new Set([...movementKeys,"ShiftLeft","ShiftRight",...controlKeys]);
  const defaultStepBanks = {rock:"outdoorStone",wood:"outdoorWood",dirt:"dirtLeaf"};
  const postures = {
    standing: {height:1.63,speed:2.75,bob:.037,step:.91,noise:1},
    crouched: {height:.75,speed:1.44,bob:.023,step:.69,noise:.64},
    prone: {height:.39,speed:.82,bob:.012,step:.52,noise:.38},
    seated: {height:1.13,bob:.007}
  };
  const swimEntry = -.94, swimExit = -.73, floatFeet = -.64;
  const swimEye = .34, maxBreath = 20;
  const spawn = {x:terrain.bank(20.6,-1)-3.2,z:20.6,yaw:.35,pitch:-.057};

  class Sound {
    random = random(8025);
    dampness = 0;
    ambientBubbleIn = .65;

    initialize(context) {
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = 0;
      this.master.connect(context.destination);

      this.effects = context.createGain();
      this.field = context.createGain();
      this.effects.connect(this.field);
      const dry = context.createGain(), wet = context.createGain(), muffler = context.createBiquadFilter();
      wet.gain.value = 0;
      muffler.type = "lowpass";
      muffler.frequency.value = 1250;
      muffler.Q.value = .53;
      this.field.connect(dry).connect(this.master);
      this.field.connect(muffler).connect(wet).connect(this.master);
      this.medium = {dry,wet,muffler};
      if(Valley.movementAudio || Valley.outdoorStoneAudio || Valley.outdoorWoodAudio || Valley.indoorStoneAudio) {
        this.movementSound=new Valley.MovementSound(context,this.effects,this.random);
      }
      if(Valley.supplyAudio) {
        this.loadingSupplyRecording=true;
        this.decodeRecordings([Valley.supplyAudio],"supply bag").then(([recording])=>{
          this.supplyRecording=recording;
          this.loadingSupplyRecording=false;
        });
      }

      this.blastPeak=context.createWaveShaper();
      this.blastPeak.curve=Float32Array.from({length:1025},(_,i)=>.94*Math.tanh((i/512-1)*2.35)/Math.tanh(2.35));
      this.blastPeak.oversample="2x";
      this.blastPeak.connect(this.field);
      if(Valley.explosionAudio?.length) {
        this.blastReady=this.decodeRecordings(Valley.explosionAudio,"explosion")
          .then(recordings=>{this.blastRecordings=recordings;});
      }
      if(Valley.brittleAudio) {
        this.brittleRecordings={};
        this.nextShatter={small:0,window:0,ceramic:0};
        for(const [kind,clips] of Object.entries(Valley.brittleAudio)) {
          this.decodeRecordings(clips,"shatter").then(recordings=>{this.brittleRecordings[kind]=recordings;});
        }
      }

      this.transients=context.createDynamicsCompressor();
      this.transients.threshold.value=-9;
      this.transients.knee.value=10;
      this.transients.ratio.value=5;
      this.transients.attack.value=.002;
      this.transients.release.value=.095;
      const transientLevel=context.createGain();
      transientLevel.gain.value=1.39;
      this.transients.connect(transientLevel).connect(this.effects);

      this.noise = context.createBuffer(1, context.sampleRate*3, context.sampleRate);
      const data = this.noise.getChannelData(0), next = random(8024);
      for (let i=0; i<data.length; i++) data[i] = next()*2-1;

      const waterfall=context.createBufferSource(), fallsFilter=context.createBiquadFilter();
      waterfall.buffer=this.noise;
      waterfall.loop=true;
      fallsFilter.type="bandpass";
      fallsFilter.frequency.value=760;
      fallsFilter.Q.value=.47;
      this.falls=context.createGain();
      this.falls.gain.value=0;
      this.fallLevel=0;
      waterfall.connect(fallsFilter).connect(this.falls).connect(this.effects);
      waterfall.start();
      this.water = this.buildUnderwater();
    }

    async decodeRecordings(clips,kind) {
      const results=await Promise.allSettled(clips.map(async clip=>{
        const recording=Uint8Array.from(atob(clip),char=>char.charCodeAt(0));
        return this.context.decodeAudioData(recording.buffer);
      }));
      const buffers=[];
      for(const result of results) {
        if(result.status==="fulfilled") buffers.push(result.value);
        else console.warn(`Unable to decode ${kind} recording.`,result.reason);
      }
      return buffers;
    }

    waterfall(x,z) {
      if(!this.falls) return;
      const dx=x-weir.x, dz=z-(weir.crest+weir.toe)*.5;
      const along=clamp((dx+dz*weir.skew)/(1+weir.skew**2),weir.left-weir.x,weir.right-weir.x);
      const distance=Math.hypot(dx-along,dz-along*weir.skew);
      const level=.31*(1-smooth(5,74,distance));
      if(level===this.fallLevel || (level>0 && Math.abs(this.fallLevel-level)<.002)) return;
      this.fallLevel=level;
      this.falls.gain.setTargetAtTime(level,this.context.currentTime,.19);
    }

    active(playing) {
      if (playing && !this.context) {
        try {
          const Context = window.AudioContext || window.webkitAudioContext;
          this.initialize(new Context());
        } catch (error) {
          console.warn("Unable to start game audio.", error);
          this.context = null;
          return;
        }
      }
      if (!this.context) return;
      if (playing) this.context.resume().catch(() => {});
      else {
        this.motor(false);
        this.beltMotor(false);
        this.spiralDrive(false);
        this.movementSound?.stopVoice();
      }
      this.master.gain.setTargetAtTime(playing ? .77 : 0, this.context.currentTime, .035);
    }

    hiss(start, length, frequency, volume, q = .7, attack = Math.min(.018,length*.30), destination = this.effects) {
      const context = this.context;
      if (!context) return;
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = this.noise;
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = q;
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(volume,start+attack);
      gain.gain.exponentialRampToValueAtTime(.0001,start+length);
      source.connect(filter).connect(gain).connect(destination);
      source.addEventListener("ended",()=>{source.disconnect();filter.disconnect();gain.disconnect();},{once:true});
      source.start(start,this.random());
      source.stop(start+length+.015);
      return source;
    }

    decayTone(start,length,frequency,endFrequency,volume,destination = this.effects) {
      const context = this.context;
      const oscillator = context.createOscillator(), gain = context.createGain();
      const attack = start+.0018;
      oscillator.frequency.setValueAtTime(frequency,start);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency,start+length*.56);
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(volume,attack);
      gain.gain.setTargetAtTime(0,attack,length*.17);
      oscillator.connect(gain).connect(destination);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      oscillator.start(start);
      oscillator.stop(start+length);
    }

    note(start, length, shape, frequencies, volume, cutoff, destination = this.effects) {
      const context = this.context;
      if (!context) return;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = shape;
      oscillator.frequency.setValueAtTime(frequencies[0],start);
      for (let i=1; i<frequencies.length; i++) {
        oscillator.frequency.exponentialRampToValueAtTime(frequencies[i],start+length*i/(frequencies.length-1));
      }
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(volume,start+Math.min(.089,length*.3));
      gain.gain.setValueAtTime(volume*.87,start+length*.70);
      gain.gain.exponentialRampToValueAtTime(.0001,start+length);
      if (cutoff) {
        const filter = context.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = cutoff;
        oscillator.connect(filter).connect(gain);
      } else {
        oscillator.connect(gain);
      }
      gain.connect(destination);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
      oscillator.start(start);
      oscillator.stop(start+length+.019);
    }

    buildMotor() {
      const context = this.context;
      const mixBus = context.createGain(), filter = context.createBiquadFilter();
      const distortion = context.createWaveShaper(), gate = context.createGain();
      mixBus.gain.value = .92;
      filter.type = "lowpass";
      filter.frequency.value = 1420;
      filter.Q.value = .72;
      distortion.curve = Float32Array.from({length:512},(_,i)=>Math.tanh((i/511*2-1)*1.82)/Math.tanh(1.82));
      distortion.oversample = "2x";
      gate.gain.value = 0;
      mixBus.connect(filter).connect(distortion).connect(gate).connect(this.effects);

      const voices = [
        ["sawtooth",104,777,.26],["sawtooth",126,829,.132],["square",257,1584,.074]
      ].map(([shape,idle,pitch,volume])=>{
        const source = context.createOscillator(), level = context.createGain();
        source.type = shape;
        source.frequency.value = idle;
        level.gain.value = volume;
        source.connect(level).connect(mixBus);
        source.start();
        return {source,idle,pitch};
      });
      const brush = context.createOscillator(), flutter = context.createGain();
      brush.type = "triangle";
      brush.frequency.value = 108;
      flutter.gain.value = .24;
      brush.connect(flutter).connect(mixBus.gain);
      brush.start();
      const scrape = context.createBufferSource(), band = context.createBiquadFilter();
      const grit = context.createGain();
      scrape.buffer = this.noise;
      scrape.loop = true;
      band.type = "bandpass";
      band.frequency.value = 3680;
      band.Q.value = 1.42;
      grit.gain.value = .19;
      scrape.connect(band).connect(grit).connect(mixBus);
      scrape.start();
      return {voices,filter,gate,grit,brush,flutter,band,running:false,loaded:false,rifleMode:false};
    }

    motor(running,loaded = false,rifleMode = false) {
      if (!this.context) return;
      if (running && !this.drill) this.drill = this.buildMotor();
      const drill = this.drill;
      if (!drill || (drill.running === running && drill.loaded === loaded && drill.rifleMode === rifleMode)) return;
      const t = this.context.currentTime;
      if (drill.running !== running || drill.rifleMode !== rifleMode) {
        drill.gate.gain.setTargetAtTime(running ? (rifleMode ? .85 : .74) : 0,t,running ? .042 : .023);
        drill.brush.frequency.setTargetAtTime(rifleMode ? 149 : 108,t,.034);
        drill.flutter.gain.setTargetAtTime(rifleMode ? .40 : .24,t,.041);
        drill.band.frequency.setTargetAtTime(rifleMode ? 4610 : 3680,t,.037);
      }
      for (const {source,idle,pitch} of drill.voices) {
        const rpm=rifleMode ? (loaded ? 1.21 : 1.40) : (loaded ? .921 : 1);
        source.frequency.setTargetAtTime(running ? pitch*rpm : idle,t,drill.running && running ? .039 : .068);
      }
      drill.filter.frequency.setTargetAtTime(running ? (loaded ? 5780 : 6850)+(rifleMode ? 1560 : 0) : 1420,t,.064);
      drill.grit.gain.setTargetAtTime(rifleMode ? (loaded ? .49 : .35) : (loaded ? .31 : .20),t,.037);
      drill.running = running;
      drill.loaded = loaded;
      drill.rifleMode = rifleMode;
    }

    buildBeltMotor() {
      const context = this.context;
      const gear = context.createOscillator(), tone = context.createBiquadFilter(), gearLevel = context.createGain();
      const tread = context.createBufferSource(), band = context.createBiquadFilter(), treadLevel = context.createGain();
      const rollers = context.createOscillator(), flutter = context.createGain(), gate = context.createGain();

      gear.type = "sawtooth";
      gear.frequency.value = 112;
      tone.type = "lowpass";
      tone.frequency.value = 760;
      tone.Q.value = .64;
      gearLevel.gain.value = .26;
      gear.connect(tone).connect(gearLevel).connect(gate);

      tread.buffer = this.noise;
      tread.loop = true;
      band.type = "bandpass";
      band.frequency.value = 1530;
      band.Q.value = .82;
      treadLevel.gain.value = .29;
      tread.connect(band).connect(treadLevel).connect(gate);

      rollers.type = "triangle";
      rollers.frequency.value = 24;
      flutter.gain.value = .157;
      rollers.connect(flutter).connect(treadLevel.gain);
      gate.gain.value = 0;
      gate.connect(this.effects);
      gear.start();
      tread.start();
      rollers.start();
      return {gear,treadLevel,gate,level:0,loaded:false,rifleMode:false};
    }

    beltMotor(moving,loaded = false,rifleMode = false,volume = 1) {
      if (!this.context) return;
      if (moving && !this.beltDrive) this.beltDrive = this.buildBeltMotor();
      const drive = this.beltDrive;
      const level=moving ? (rifleMode ? .63 : .79)*volume : 0;
      if (!drive || (drive.level === level && drive.loaded === loaded && drive.rifleMode === rifleMode)) return;
      const t = this.context.currentTime;
      if (drive.level !== level) {
        drive.gate.gain.setTargetAtTime(level,t,moving ? .013 : .022);
      }
      drive.gear.frequency.setTargetAtTime(moving ? (loaded ? 196 : 219)*(rifleMode ? .85 : 1) : 112,t,.028);
      drive.treadLevel.gain.setTargetAtTime((loaded ? .38 : .29)+(rifleMode ? .05 : 0),t,.033);
      drive.level = level;
      drive.loaded = loaded;
      drive.rifleMode = rifleMode;
    }

    buildSpiralDrive() {
      const ctx=this.context;
      const rotor=ctx.createOscillator(), shimmer=ctx.createOscillator(), bend=ctx.createGain();
      const air=ctx.createBufferSource(), airBand=ctx.createBiquadFilter(), airLevel=ctx.createGain();
      const booster=ctx.createGain(), elevator=ctx.createGain();
      rotor.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(7),Float32Array.of(0,1,.49,.23,.08,.15,.035)));
      rotor.frequency.value=370;
      shimmer.frequency.value=63;
      bend.gain.value=41;
      shimmer.connect(bend).connect(rotor.frequency);
      rotor.connect(booster);
      air.buffer=this.noise;
      air.loop=true;
      airBand.type="bandpass";
      airBand.frequency.value=3400;
      airBand.Q.value=.64;
      airLevel.gain.value=.41;
      air.connect(airBand).connect(airLevel).connect(booster);

      // One second of rolling gear teeth, with a short tick and a low case resonance.
      const teeth=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
      const samples=teeth.getChannelData(0), grit=random(617);
      const tau=2*Math.PI;
      for(let i=0;i<samples.length;i++) {
        const time=i/ctx.sampleRate, phase=time*tau;
        const strike=Math.exp(-9*((time*48)%1));
        const hum=.26*Math.sin(phase*121+.46*Math.sin(phase*7))+.10*Math.sin(phase*246);
        const tick=strike*(.42*Math.sin(phase*888)+.27*Math.sin(phase*1656)+.19*(grit()*2-1));
        samples[i]=(hum+tick)*(.89+.11*Math.sin(phase*6));
      }
      const gear=ctx.createBufferSource();
      gear.buffer=teeth;
      gear.loop=true;
      gear.playbackRate.value=.47;
      gear.connect(elevator);
      for(const gate of [booster,elevator]) {
        gate.gain.value=0;
        gate.connect(this.effects);
      }
      for(const source of [rotor,shimmer,air,gear]) source.start();
      return {rotor,airBand,gear,booster,elevator,boosting:false,lifting:false,loaded:false};
    }

    spiralDrive(boosting,lifting=false,loaded=false) {
      if(!this.context) return;
      if((boosting || lifting) && !this.spiralMotor) this.spiralMotor=this.buildSpiralDrive();
      const drive=this.spiralMotor;
      if(!drive || (drive.boosting===boosting && drive.lifting===lifting && drive.loaded===loaded)) return;
      const t=this.context.currentTime;
      if(drive.boosting!==boosting) {
        drive.booster.gain.setTargetAtTime(boosting ? .29 : 0,t,boosting ? .023 : .035);
        drive.airBand.frequency.setTargetAtTime(boosting ? 4300 : 1230,t,.060);
      }
      if(drive.lifting!==lifting) drive.elevator.gain.setTargetAtTime(lifting ? .47 : 0,t,.019);
      drive.rotor.frequency.setTargetAtTime(boosting ? (loaded ? 1320 : 1510) : 370,t,
        boosting && !drive.boosting ? .049 : .035);
      drive.gear.playbackRate.setTargetAtTime(lifting ? (loaded ? .94 : 1.07) : .47,t,.032);
      Object.assign(drive,{boosting,lifting,loaded});
    }

    spiralLatch(gesture) {
      if(!this.context) return;
      const t=this.context.currentTime, fist=gesture==="fist";
      this.mechanicalContact(t,fist ? .96 : .53,gesture==="thumb" ? .92 : 1.04);
      if(fist) {
        this.decayTone(t,.092,163,67,.34);
        this.hiss(t,.083,620,.32,.8,.001);
      }
      this.hiss(t+.024,.10,1290,fist ? .16 : .085,.94,.006);
    }

    magazineTap() {
      if(!this.context) return;
      const t=this.context.currentTime;
      this.hiss(t,.079,760,.29,.72,.002);
      this.decayTone(t,.096,241,112,.28);
      this.mechanicalContact(t+.012,.45,.91);
    }

    switchClick() {
      if (!this.context) return;
      const t = this.context.currentTime;
      this.hiss(t,.057,2540,.195,1.51);
      this.note(t+.005,.063,"triangle",[433,241,139],.079,1370);
    }

    mechanicalContact(t,strength,pitch) {
      this.hiss(t,.044,3610*pitch,.32*strength,.83,.0014);
      this.hiss(t+.003,.079,891*pitch,.25*strength,.78,.0026);
      this.decayTone(t+.003,.084,262*pitch,122*pitch,.16*strength);
      this.decayTone(t+.006,.042,1830*pitch,1470*pitch,.054*strength);
    }

    release(rifleMode = false) {
      if (!this.context) return;
      const t=this.context.currentTime, pitch=mix(.95,1.055,this.random()), weight=rifleMode ? 1.20 : 1;
      this.hiss(t,.052,2850*pitch,.39*weight,.61,.0009);
      this.hiss(t+.001,.035,5330*pitch,.225*weight,.79,.0010);
      this.hiss(t+.002,rifleMode ? .164 : .122,517*pitch,.39*weight,.55,.0032);
      this.decayTone(t+.001,rifleMode ? .157 : .121,(rifleMode ? 112 : 140)*pitch,53*pitch,.37*weight);
      this.mechanicalContact(t+.027,.48*weight,pitch*.83);
      this.hiss(t+.072,.131,948*pitch,.091*weight,.63,.008);
      this.hiss(t+.146,.188,461*pitch,.051*weight,.76,.012);
    }

    spiralRelease() {
      if(!this.context) return;
      const t=this.context.currentTime, pitch=mix(.94,1.08,this.random());
      this.hiss(t,.071,782*pitch,.46,.66,.0009);
      this.hiss(t+.002,.049,2990*pitch,.29,1.14,.0015);
      this.decayTone(t,.091,158*pitch,61*pitch,.33);
      this.decayTone(t+.005,.070,1570*pitch,1210*pitch,.091);
      this.mechanicalContact(t+.017,.48,pitch*.90);
    }

    gearChange(action,rifleMode) {
      if(!this.context) return;
      const t=this.context.currentTime, pitch=(rifleMode ? .84 : 1.06)*mix(.94,1.07,this.random());
      if(action==="stow") {
        this.hiss(t,.157,1320*pitch,.171,.77,.021);
        this.hiss(t+.031,.139,540*pitch,.207,.67,.017);
        this.mechanicalContact(t+.082,.46,pitch*.84);
        this.hiss(t+.112,.090,340*pitch,.101,.73,.010);
      } else {
        this.hiss(t,.125,663*pitch,.196,.67,.012);
        this.hiss(t+.022,.117,1800*pitch,.161,.85,.014);
        this.mechanicalContact(t+.052,.52,pitch);
        this.mechanicalContact(t+.089,.26,pitch*1.17);
      }
    }

    playBagRecording() {
      const context=this.context, buffer=this.supplyRecording;
      if(!buffer || context?.state!=="running") return null;
      const source=context.createBufferSource(), gain=context.createGain();
      source.buffer=buffer;
      source.connect(gain).connect(this.effects);
      const playback={source,gain,start:context.currentTime,duration:buffer.duration};
      this.bagRecording=playback;
      source.onended=()=>{
        if(this.bagRecording===playback) this.bagRecording=null;
        source.disconnect();
        gain.disconnect();
      };
      source.start(playback.start);
      return playback;
    }

    rummageBag(opening = false) {
      if (!this.context) return;
      if (!this.bagBus) {
        this.bagBus = this.context.createGain();
        this.bagBus.gain.value = 1.31;
        this.bagBus.connect(this.effects);
      }
      const bus = this.bagBus, t = this.context.currentTime;
      const pitch = mix(.84,1.14,this.random()), level = mix(.76,1.15,this.random());
      this.hiss(t,.216,625*pitch,.152*level,.68,.021,bus);
      this.hiss(t+.023,.211,1220*pitch,.165*level,.89,.027,bus);
      for (let i=0; i<5; i++) {
        const at = t+.011+i*.035+this.random()*.021;
        this.hiss(at,mix(.045,.075,this.random()),mix(1580,3520,this.random()),.079*level,.85,.006,bus);
      }
      if (opening) {
        for (let i=0; i<11; i++) {
          const tooth = i/10;
          this.hiss(t+.008+i*.013,.022,mix(2410,3650,tooth)*pitch,.104-.036*tooth,1.37,.0018,bus);
        }
      }
    }

    stopBagRummage() {
      const recording=this.bagRecording;
      if(recording) {
        const now=this.context.currentTime;
        this.bagRecording=null;
        recording.gain.gain.setTargetAtTime(0,now,.008);
        recording.source.stop(now+.04);
      }
      const bus = this.bagBus;
      if (!bus) return;
      this.bagBus = null;
      bus.gain.setTargetAtTime(0,this.context.currentTime,.012);
      setTimeout(()=>bus.disconnect(),110);
    }

    stowSupplies() {
      if (!this.context) return;
      const t = this.context.currentTime;
      for (const [delay,tone] of [[0,1],[.245,.91]]) {
        const at = t+delay, pitch = tone*mix(.95,1.05,this.random());
        this.hiss(at,.207,810*pitch,.164,.64,.011);
        this.hiss(at+.024,.123,1730*pitch,.133,.81,.004);
        this.decayTone(at+.066,.095,181*pitch,108*pitch,.113);
        this.hiss(at+.069,.086,1070*pitch,.199,1.11,.0027);
        this.hiss(at+.123,.072,2300*pitch,.072,1.22,.010);
      }
    }

    splash(strength,kind) {
      if (!this.context) return;
      const t = this.context.currentTime;
      const stroke = kind === "stroke", impact = kind === "impact";
      const level = Math.min(1.22,Math.sqrt(strength));
      const pitch = mix(.88,1.12,this.random());
      // The surface slap leads into the heavier water and the returning wash.
      this.hiss(t,.091,1210*pitch,(impact ? .51 : .41)*level,.65,stroke ? .011 : .0028);
      this.hiss(t+.004,.119,3150*pitch,.35*level,.71,stroke ? .013 : .0038);
      this.hiss(t+.014,stroke ? .272 : .203,535*pitch,.35*level,.59,.012);
      this.decayTone(t+.009,.086,186*pitch,92*pitch,.108*level);
      const wash = t+(stroke ? .081 : .046);
      this.hiss(wash,stroke ? .289 : .181,836*pitch,(stroke ? .31 : .23)*level,.64,.014);
      this.hiss(wash+.025,.155,2340*pitch,.17*level,.85,.006);

      // Short rising bubble tones and scattered droplets break up the tail.
      const drops = impact ? 7 : stroke ? 6 : 4;
      for (let i=0; i<drops; i++) {
        const size = this.random();
        const delay = .024+(i+this.random()*.81)*(stroke || impact ? .032 : .027);
        const frequency = mix(1430,285,size)*pitch;
        const volume = mix(.050,.028,i/drops)*level;
        this.decayTone(t+delay,mix(.032,.069,size),frequency,frequency*mix(1.42,1.18,size),volume);
      }
    }

    step(material,run,softness = 1,side=0,stair=0,stepBank) {
      if (!this.context) return;
      const gait=run ? "Run" : "Walk";
      const bank=material+(stair ? "Stair" : gait);
      const recording=stepBank??defaultStepBanks[material];
      const level=(run ? .79 : .66)*softness*(stair<0 ? 1.12 : 1);
      const settings={speed:mix(.955,1.065,this.random()),pan:side*.13};
      if(stair && this.movementSound?.play(bank+(stair<0 ? "Down" : "Up"),level,settings)) return;
      if(recording && this.movementSound?.play(recording+gait,level,settings)) return;
      if(material==="grass" && this.movementSound?.play("fieldGrass"+gait,level,settings)) return;
      if(bank!=="rockRun" && this.movementSound?.play(bank,level,settings)) return;
      const t = this.context.currentTime;
      const strength=(run ? 1.24 : .87)*softness, variation=mix(.83,1.19,this.random());
      if(material==="mat") {
        this.hiss(t,.112,720*variation,.11*strength,.74,.013);
        this.hiss(t+.025,.105,1720*variation,.062*strength,.96,.012);
      } else if(material==="rock") {
        this.hiss(t,.065,2120*variation,.19*strength,.86,.002);
        this.hiss(t+.017,.098,960*variation,.10*strength,1.22,.006);
        this.decayTone(t,.049,430*variation,284*variation,.056*strength);
      } else if(material==="wood") {
        this.hiss(t,.057,1080*variation,.17*strength,.90,.0027);
        this.decayTone(t,.136,218*variation,142*variation,.122*strength);
        this.decayTone(t+.005,.089,495*variation,423*variation,.061*strength);
        this.hiss(t+.028,.102,2800*variation,.048*strength,1.3,.006);
      } else {
        this.hiss(t,.104,708*variation,.145*strength,.87,.006);
        this.hiss(t+.009,.077,2110*variation,.095*strength,1.35,.004);
        this.hiss(t+.033,.098,1520*variation,.065*strength,1.12,.007);
      }
    }

    land(material,speed,stepBank) {
      if(!this.context || speed<.4) return;
      const impact=smooth(1.5,8.8,speed);
      if(material!=="water") {
        const heavyStone=material==="rock" && stepBank!=="indoorWood" && stepBank!=="dirtLeaf" && speed>=5.6;
        const level=mix(.48,.99,impact), settings={speed:mix(1.09,.93,impact)};
        const recorded=heavyStone && this.movementSound?.play("rockHeavyLand",level,settings);
        const duration=recorded || this.movementSound?.play(material+"Land",level,settings);
        if(!duration) this.step(material,impact>.28,mix(.66,1.39,impact),0,0,material==="grass" ? stepBank : undefined);
      }
      if(speed>5.7) this.movementSound?.play("landingEffort",mix(.47,.75,impact),{voice:true});
    }

    grass(strength,pace) {
      if(!this.context) return 0;
      const speed=mix(.88,1.18,pace)*mix(.94,1.06,this.random());
      const pan=mix(-.25,.25,this.random());
      const duration=this.movementSound?.play("grassBrush",strength,{speed,pan});
      if(duration) return duration;
      const t=this.context.currentTime, pitch=mix(.81,1.20,this.random());
      this.hiss(t,.19,2380*pitch,.19*strength,1.02,.021);
      this.hiss(t+.025,.152,4960*pitch,.12*strength,1.34,.006);
      this.hiss(t+.074,.125,1570*pitch,.085*strength,.94,.014);
      return .20;
    }

    propImpact(hit,strength) {
      if(!this.context) return;
      const t=this.context.currentTime, level=clamp(strength,.12,1.26);
      if(hit.material==="paper") {
        this.hiss(t,.075,3550,.22*level,.84,.002);
        this.hiss(t+.026,.118,1920,.12*level,1.05,.011);
      } else if(hit.material==="wood") {
        this.hiss(t,.057,2180,.20*level,.94,.002);
        this.decayTone(t,.108,421,182,.14*level);
      } else if(hit.material==="plastic") {
        this.hiss(t,.079,1870,.31*level,.72,.0021);
        this.decayTone(t+.001,.096,541,388,.14*level);
        this.decayTone(t+.005,.073,972,713,.055*level);
        if(hit.broken) {
          this.hiss(t+.016,.093,4220,.26*level,1.13,.0023);
          this.hiss(t+.052,.126,2690,.16*level,.80,.006);
        } else if(hit.bent) this.hiss(t+.015,.13,1160,.11*level,.91,.004);
      } else if(hit.material==="vinyl") {
        this.hiss(t,.091,1400,.22*level,.74,.0035);
        this.decayTone(t,.145,192,90,.12*level);
        if(hit.puncture) {
          this.hiss(t+.019,1.40,2680,.27*level,1.18,.014);
          this.hiss(t+.078,.89,870,.15*level,.68,.032);
        }
      } else if(hit.material==="cloth") {
        this.hiss(t,.126,900,.24*level,.87,.004);
        this.hiss(t+.015,hit.torn ? .224 : .087,hit.torn ? 3820 : 1860,.15*level,1.04,.007);
      } else {
        this.hiss(t,.075,2110,.19*level,.82,.0027);
        this.decayTone(t,.095,660,428,.082*level);
        if(hit.sparks) {
          this.decayTone(t+.003,.145,1820,1580,.10*level);
          this.decayTone(t+.007,.104,3050,2880,.063*level);
          if(hit.bent) this.hiss(t+.025,.16,1010,.15*level,.86,.005);
        }
      }
    }

    transientPan(t,start,end=start,travel=.085) {
      const panner=this.context.createStereoPanner();
      panner.pan.setValueAtTime(clamp(start,-.95,.95),t);
      panner.pan.linearRampToValueAtTime(clamp(end,-.95,.95),t+travel);
      panner.connect(this.transients);
      return panner;
    }

    ricochet(strength,skim,speed,distance,pan,bent) {
      if(!this.context || distance>56) return;
      const t=this.context.currentTime, pitch=mix(.85,1.17,this.random());
      const energy=mix(.29,1,smooth(3,24,speed));
      const level=clamp(strength,.16,1.33)*energy*Math.exp(-distance*.044);
      const scrape=level*mix(.55,1.18,skim), out=this.transientPan(t,pan);
      this.hiss(t,.054,4810*pitch,1.29*level,.61,.0011,out);
      this.hiss(t+.001,.084,880*pitch,.96*level,.69,.0018,out);
      this.hiss(t+.007,.063,2340*pitch,.52*scrape,.89,.0018,out);
      this.decayTone(t+.002,.112,385*pitch,205*pitch,.34*level,out);
      for(const [frequency,length,volume] of [[1560,.147,.20],[2350,.207,.26],[3910,.103,.11]]) {
        this.decayTone(t+.003,length,frequency*pitch,frequency*pitch*.984,volume*level,out);
      }
      this.note(t+.010,.156,"triangle",[3070*pitch,2740*pitch,1810*pitch,1070*pitch],.15*scrape,4250,out);
      this.hiss(t+.011,.105,3340*pitch,.40*scrape,1.24,.003,out);
      if(bent) this.hiss(t+.032,.156,1120*pitch,.26*level,.91,.005,out);
      const tail=this.hiss(t+.052,.227,1730*pitch,.20*level,.69,.010,out);
      tail.onended=()=>out.disconnect();
    }

    flyby(distance,speed,side,crossing) {
      if(!this.context) return;
      const t=this.context.currentTime, fast=smooth(12,87,speed);
      const level=mix(.27,1.07,1-smooth(.16,1.18,distance));
      const pitch=mix(.86,1.29,fast)*mix(.93,1.09,this.random()), length=mix(.145,.080,fast);
      const out=this.transientPan(t,side-crossing*.68,side+crossing*.68,length*.61);
      this.hiss(t,length*.40,5100*pitch,.64*level,.63,.0012,out);
      this.hiss(t+.003,length*.69,2040*pitch,.60*level,.62,.004,out);
      this.decayTone(t+.001,length*.82,2930*pitch,970*pitch,.23*level,out);
      const tail=this.hiss(t+.023,length*.84,2170*pitch,.38*level,.83,.005,out);
      tail.onended=()=>out.disconnect();
    }

    sand(strength) {
      if (!this.context) return;
      const t = this.context.currentTime;
      this.hiss(t,.14,620,.103*strength,1.02);
      this.note(t,.074,"sine",[125,55],.042*strength);
    }

    rock(strength,glancing) {
      if (!this.context) return;
      const t = this.context.currentTime;
      const level = Math.min(1.24,strength);
      const pitch = mix(.92,1.09,this.random());
      const scrape = level*mix(.34,1,glancing);
      this.hiss(t,.048,3360*pitch,.55*level,.63,.0014);
      this.hiss(t+.002,.070,780*pitch,.36*level,.75,.0025);
      this.decayTone(t+.001,.067,271*pitch,223*pitch,.13*level);
      // Inharmonic modes give the metal a brief ring against the stone.
      for (const [frequency,length,volume] of [[1380,.105,.10],[2495,.076,.085],[4210,.058,.046]]) {
        this.decayTone(t+.002,length,frequency*pitch,frequency*pitch,volume*level);
      }
      this.hiss(t+.012,.069,3860*pitch,.26*scrape,.94,.003);
      this.hiss(t+mix(.033,.046,this.random()),.081,2180*pitch,.18*scrape,1.04,.004);
    }

    woodImpact(strength,chipping) {
      if(!this.context) return;
      const t=this.context.currentTime, level=Math.min(1.24,strength), pitch=mix(.88,1.14,this.random());
      this.hiss(t,.067,1440*pitch,.27*level,.83,.0023);
      this.decayTone(t+.001,.103,287*pitch,176*pitch,.137*level);
      if(chipping) this.hiss(t+.011,.114,3560*pitch,.24*level,1.12,.0027);
    }

    target(hitCount,complete) {
      if(this.context?.state!=="running") return;
      const t=this.context.currentTime,f=520+hitCount*31;
      this.hiss(t,.046,1280,.10,1.10,.002);
      this.decayTone(t+.012,.18,f,f*.84,.09);
      if(complete) this.decayTone(t+.14,.26,f*1.46,f*1.37,.11);
    }

    buildUnderwater() {
      const context = this.context;
      const flow = context.createBufferSource(), low = context.createBiquadFilter(), drift = context.createBiquadFilter();
      const body = context.createGain(), curl = context.createGain(), gate = context.createGain();
      const swell = context.createOscillator(), variation = context.createGain(), sweep = context.createGain();
      const bubbles = context.createStereoPanner();
      flow.buffer = this.noise;
      flow.loop = true;
      flow.playbackRate.value = .64;
      low.type = "lowpass";
      low.frequency.value = 212;
      low.Q.value = .62;
      body.gain.value = .47;
      drift.type = "bandpass";
      drift.frequency.value = 465;
      drift.Q.value = .77;
      curl.gain.value = .258;
      swell.frequency.value = .37;
      variation.gain.value = .094;
      sweep.gain.value = 82;
      gate.gain.value = 0;
      flow.connect(low).connect(body).connect(gate);
      flow.connect(drift).connect(curl).connect(gate);
      swell.connect(variation).connect(curl.gain);
      swell.connect(sweep).connect(drift.frequency);
      bubbles.connect(gate);
      gate.connect(this.master);
      flow.start(0,.73);
      swell.start();
      return {gate,bubbles};
    }

    submerged(depth,dt = 0) {
      if (!this.context) return;
      const amount = smooth(.012,.205,depth), before = this.dampness;
      if (amount !== before && (amount === 0 || amount === 1 || Math.abs(before-amount) >= .018)) {
        this.dampness = amount;
        const {dry,wet,muffler} = this.medium, t = this.context.currentTime;
        const fade = amount > before ? .063 : .094;
        dry.gain.setTargetAtTime(1-amount,t,fade);
        wet.gain.setTargetAtTime(amount*.53,t,fade);
        muffler.frequency.setTargetAtTime(mix(1250,560,amount),t,.078);
        this.water.gate.gain.setTargetAtTime(amount*.86,t,fade);
      }
      if (amount < .16) {
        this.ambientBubbleIn = .65;
        return;
      }
      this.ambientBubbleIn -= dt;
      if (this.ambientBubbleIn <= 0) {
        this.bubbles(mix(.20,.33,this.random()));
        this.ambientBubbleIn = mix(1.12,2.26,this.random());
      }
    }

    bubbles(strength) {
      if (!this.context) return;
      const t = this.context.currentTime, destination = this.water.bubbles;
      const side = mix(-.58,.58,this.random());
      destination.pan.cancelScheduledValues(t);
      destination.pan.setTargetAtTime(side,t,.037);
      destination.pan.setTargetAtTime(-side*.69,t+.11,.133);
      this.hiss(t,.293,511,.226*strength,.82,.019,destination);
      for (let i=0; i<5; i++) {
        const at = t+.010+i*.048+this.random()*.030, size = this.random();
        const pitch = mix(850,217,size);
        this.decayTone(at,mix(.061,.147,size),pitch,pitch*mix(.72,1.23,this.random()),
          mix(.165,.242,size)*strength,destination);
        this.hiss(at+.005,.053,mix(1670,720,size),.083*strength,.91,.006,destination);
      }
    }

    gasp(underwater) {
      if(!this.context) return;
      const t=this.context.currentTime;
      if(underwater) {
        this.hiss(t,.45,361,.25,.99,.06);
        this.note(t+.024,.51,"triangle",[108,147,116,76],.12,446);
        this.bubbles(.74);
      } else {
        if(this.movementSound?.play("breathHard",.62,{voice:true})) return;
        this.hiss(t,.68,1040,.24,1.01,.045);
        this.hiss(t+.25,.36,594,.083,.77);
      }
    }

    toss() {
      if(!this.context) return;
      const t=this.context.currentTime;
      this.hiss(t,.20,960,.105,.79,.029);
    }

    objectLand(kind,surface,strength) {
      if(!this.context || strength<.06) return;
      const t=this.context.currentTime;
      if(kind==="document" || kind==="pamphlet") {
        this.propImpact({material:"paper"},strength*.72);
        return;
      }
      const soft=kind==="tube" || kind==="cushion", metal=kind==="key" || kind==="bell" || kind==="flask" || kind==="chair"
        || kind==="table" || kind==="tableFrame";
      this.hiss(t,.082,soft ? 530 : surface==="sand" ? 755 : 1700,.26*strength,.87,.003);
      this.decayTone(t+.003,.093,soft ? 151 : metal ? 296 : 393,soft ? 99 : 212,.13*strength);
      if(metal && surface!=="sand") this.decayTone(t+.007,.175,1400,1250,.076*strength);
      if(!soft) this.hiss(t+.034,.069,1060,.092*strength,.96);
    }

    tubeFlop(surface,strength) {
      if(!this.context || strength<.06) return;
      const t=this.context.currentTime, level=Math.min(1.17,strength);
      const pitch=mix(.88,1.10,this.random());
      const slap=surface==="rock" || surface==="wood" ? 1540 : surface==="water" ? 982 : 1220;
      this.hiss(t,.106,568*pitch,.46*level,.68,.003);
      this.hiss(t+.003,.067,slap*pitch,.39*level,.82,.0026);
      this.decayTone(t+.004,.124,161*pitch,66*pitch,.195*level);
      this.hiss(t+.047,.107,1060*pitch,.23*level,.87,.007);
      this.hiss(t+.086,.137,496*pitch,.13*level,.73,.015);
    }

    rewind() {
      if(!this.context) return;
      const t=this.context.currentTime;
      this.hiss(t,1.18,2150,.098,.81,.05,this.master);
      this.note(t+.05,1.11,"triangle",[130,318,507,268],.030,1690,this.master);
    }

    reload(action,rifleMode = false) {
      if (!this.context) return;
      const t = this.context.currentTime;
      const pitch=(rifleMode ? .87 : 1)*mix(.94,1.075,this.random());
      if (action === "release") {
        this.mechanicalContact(t,.71,pitch*1.09);
        this.hiss(t+.031,.123,1020*pitch,.126,1.0,.007);
      } else if (action === "throw") {
        this.hiss(t,.20,710,.103,.72);
      } else if (action === "stash") {
        this.hiss(t,.21,610,.128,.77);
        this.hiss(t+.074,.12,1260,.083,1.12);
      } else if (action === "pocket") {
        this.hiss(t,.22,490,.123,.62);
        this.hiss(t+.074,.184,925,.146,.81);
        this.hiss(t+.181,.21,1410,.087,.96);
        if(rifleMode) this.mechanicalContact(t+.102,.23,pitch*1.19);
      } else if (action === "cap") {
        this.hiss(t,.065,2820,.138,1.7);
        this.note(t,.069,"triangle",[490,274,171],.046,2120);
      } else if (action === "slide") {
        this.hiss(t,.157,1370*pitch,.183,.81,.005);
        this.hiss(t+.012,.115,3150*pitch,.128,.92,.003);
        this.mechanicalContact(t+.043,.44,pitch*1.09);
        this.mechanicalContact(t+.092,.29,pitch*.93);
      } else if (action === "seat") {
        this.mechanicalContact(t,rifleMode ? .96 : 1.12,pitch);
        this.mechanicalContact(t+.033,.39,pitch*.80);
      } else if (action === "latch") {
        this.mechanicalContact(t,1.25,pitch*.91);
        this.hiss(t+.025,.099,1020*pitch,.145,.76,.004);
        this.mechanicalContact(t+.039,.45,pitch*1.12);
      } else {
        this.hiss(t,.089,1020,.098,1.1);
      }
    }

    beltStall() {
      if(!this.context) return;
      const t=this.context.currentTime;
      this.hiss(t,.09,1040,.105,.81,.006);
      this.mechanicalContact(t+.024,.63,.88);
    }

    fixture(kind,on) {
      if(!this.context) return;
      const t=this.context.currentTime;
      if(kind==="window") {
        this.hiss(t,.29,1480,.158,.73,.015);
        this.hiss(t+.043,.214,3290,.065,1.04,.012);
        this.mechanicalContact(t+.37,on ? .27 : .54,1.21);
      } else if(kind==="door" || kind==="fridge") {
        const pitch=kind==="fridge" ? 1.23 : .80;
        this.mechanicalContact(t,.46,pitch);
        this.hiss(t+.018,.295,kind==="fridge" ? 885 : 547,.116,.87,.022);
        this.mechanicalContact(t+.33,on ? .29 : .83,pitch*.84);
      } else {
        this.switchClick();
        if(kind==="faucet") this.hiss(t+.018,.134,1770,.109,.67,.008);
      }
    }

    stoveIgnition(spark,lit) {
      if(!this.context) return;
      const t=this.context.currentTime;
      if(spark) {
        const pitch=mix(.88,1.14,this.random());
        this.hiss(t,.030,4170*pitch,.21,1.41,.0008);
        this.decayTone(t+.001,.041,763*pitch,282*pitch,.13);
        this.hiss(t+.006,.016,5710*pitch,.085,1.18,.0007);
      }
      if(lit) {
        this.hiss(t,.248,803,.162,.67,.012);
        this.hiss(t+.027,.184,2160,.080,.79,.020);
      }
    }

    runningTap(volume) {
      if(!this.context || (!volume && !this.tap)) return;
      if(!this.tap) {
        const stream=this.context.createBufferSource(), filter=this.context.createBiquadFilter();
        const gain=this.context.createGain();
        stream.buffer=this.noise;
        stream.loop=true;
        filter.type="bandpass";
        filter.frequency.value=2150;
        filter.Q.value=.71;
        gain.gain.value=0;
        stream.connect(filter).connect(gain).connect(this.effects);
        stream.start();
        this.tap={gain,volume:0};
      }
      if(this.tap.volume===volume) return;
      this.tap.volume=volume;
      this.tap.gain.gain.setTargetAtTime(volume*.21,this.context.currentTime,.052);
    }

    runningLeak(level,pan) {
      const context=this.context;
      if(!context || (!level && !this.leakAudio)) return;
      if(!this.leakAudio) {
        const stream=context.createBufferSource(), gain=context.createGain(), panner=context.createStereoPanner();
        stream.buffer=this.noise;
        stream.loop=true;
        gain.gain.value=0;
        for(const [frequency,volume] of [[830,.48],[2370,.68],[4890,.30]]) {
          const filter=context.createBiquadFilter(), band=context.createGain();
          filter.type="bandpass";
          filter.frequency.value=frequency;
          filter.Q.value=.76;
          band.gain.value=volume;
          stream.connect(filter).connect(band).connect(gain);
        }
        gain.connect(panner).connect(this.effects);
        stream.start(0,.72);
        this.leakAudio={gain,panner,level:0,pan:0};
      }
      const leak=this.leakAudio, now=context.currentTime;
      if(Math.abs(leak.level-level)>.006 || (level===0 && leak.level!==0)) {
        leak.level=level;
        leak.gain.gain.setTargetAtTime(level*.61,now,.065);
      }
      if(Math.abs(leak.pan-pan)>.018) {
        leak.pan=pan;
        leak.panner.pan.setTargetAtTime(pan,now,.088);
      }
    }

    buildFireSystem() {
      const context=this.context, rate=context.sampleRate;
      const bell=context.createBuffer(1,Math.round(rate*2.45),rate), samples=bell.getChannelData(0);
      for(let i=0;i<samples.length;i++) {
        const t=i/rate, phase=t%.43;
        if(t>=1.29 || phase>=.29) continue;
        const envelope=Math.min(1,phase/.014,(.29-phase)/.051);
        const angle=2*Math.PI*892*t+.67*Math.sin(2*Math.PI*19*t);
        samples[i]=envelope*(.64*Math.sin(angle)+.23*Math.sin(angle*2+.65)+.10*Math.sin(angle*3));
      }
      const loop=buffer=>{
        const source=context.createBufferSource();
        source.buffer=buffer;
        source.loop=true;
        return source;
      };
      const channel=peak=>{
        const gain=context.createGain(), panner=context.createStereoPanner();
        gain.gain.value=0;
        gain.connect(panner).connect(this.effects);
        return {gain,panner,peak,level:0,pan:0};
      };
      const alarm=channel(.31), spray=channel(.71);
      const ringing=loop(bell), rain=loop(this.noise);
      ringing.connect(alarm.gain);
      for(const [frequency,q,volume] of [[1170,.62,.38],[3240,.67,.70]]) {
        const filter=context.createBiquadFilter(), band=context.createGain();
        filter.type="bandpass";
        filter.frequency.value=frequency;
        filter.Q.value=q;
        band.gain.value=volume;
        rain.connect(filter).connect(band).connect(spray.gain);
      }
      ringing.start();
      rain.start(0,.39);
      return {alarm,spray};
    }

    fireSystem(mix) {
      if(!this.context) return;
      if(!this.fireAudio && (mix.alarm.level || mix.spray.level)) this.fireAudio=this.buildFireSystem();
      if(!this.fireAudio) return;
      const t=this.context.currentTime;
      for(const key of ["alarm","spray"]) {
        const channel=this.fireAudio[key], {level,pan}=mix[key];
        if(Math.abs(channel.level-level)>.006 || (level===0 && channel.level!==0)) {
          channel.level=level;
          channel.gain.gain.setTargetAtTime(level*channel.peak,t,.077);
        }
        if(Math.abs(channel.pan-pan)>.024) {
          channel.pan=pan;
          channel.panner.pan.setTargetAtTime(pan,t,.085);
        }
      }
    }

    fragileImpact(kind,strength,broken,volume,pan,pane=false) {
      const context=this.context;
      if(!context || volume<=.004) return;
      const t=context.currentTime, glass=kind==="glass", level=clamp(strength,.26,1.34)*volume;
      const group=glass && pane ? "window" : "small";
      const recordings=this.brittleRecordings?.[group];
      const out=this.transientPan(t,pan);
      if(broken && recordings?.length) {
        const material=glass ? group : "ceramic";
        const index=this.nextShatter[material];
        this.nextShatter[material]=(index+1)%recordings.length;
        const source=context.createBufferSource(), gain=context.createGain();
        source.buffer=recordings[index];
        source.playbackRate.value=glass ? mix(.97,1.045,this.random()) : mix(.70,.83,this.random());
        gain.gain.value=(glass ? 1.08 : .91)*level;
        source.connect(gain).connect(out);
        source.onended=()=>{source.disconnect();gain.disconnect();out.disconnect();};
        source.start(t);
        if(!glass) {
          this.decayTone(t+.009,.21,458,177,.45*level,out);
          this.hiss(t+.013,.148,1230,.29*level,.80,.002,out);
        }
        return;
      }
      const tail=this.hiss(t,broken ? .35 : .16,glass ? 5700 : 3290,(broken ? .44 : .18)*level,.89,.001,out);
      tail.onended=()=>out.disconnect();
      this.decayTone(t+.005,glass ? .083 : .14,glass ? 1920 : 410,glass ? 1330 : 187,.20*level,out);
      if(broken) {
        this.hiss(t+.013,.27,glass ? 3770 : 1600,.29*level,.64,.006,out);
        for(let i=0;i<(glass ? 11 : 7);i++) {
          const delay=.02+i*.018+this.random()*.024;
          this.hiss(t+delay,.029+this.random()*.04,glass ? mix(3200,7200,this.random()) : mix(1380,3890,this.random()),
            level*mix(.042,.107,this.random()),1.14,.002,out);
        }
      }
    }

    blast(distance,pan) {
      if(!this.context || distance>=92) return;
      const context=this.context, t=context.currentTime;
      const volume=(1-smooth(43,92,distance))/(1+(distance/22)**1.48);
      const input=context.createGain(), panner=context.createStereoPanner();
      input.gain.value=volume;
      panner.pan.value=clamp(pan,-.83,.83);
      input.connect(panner).connect(this.blastPeak);
      const ambience=this.effects.gain;
      ambience.cancelScheduledValues(t);
      ambience.setTargetAtTime(1-.79*volume,t,.009);
      ambience.setTargetAtTime(1,t+.24,.26);

      const recordings=this.blastRecordings;
      if(recordings?.length) {
        const index=this.nextBlastRecording??0;
        this.nextBlastRecording=(index+1)%recordings.length;
        const source=context.createBufferSource();
        source.buffer=recordings[index];
        source.connect(input);
        source.start(t);
        source.onended=()=>{source.disconnect();input.disconnect();panner.disconnect();};
        return;
      }
      this.hiss(t,.075,3340,1.91,.55,.0014,input);
      this.hiss(t+.002,.16,1140,1.34,.61,.0016,input);
      this.hiss(t+.003,.65,294,1.66,.59,.003,input);
      this.decayTone(t+.004,.91,117,35,1.08,input);
      this.decayTone(t+.033,.82,78,27,.51,input);
      this.hiss(t+.019,1.72,133,1.19,.61,.009,input);
      this.hiss(t+.064,1.32,488,.78,.60,.013,input);
      for(const [delay,frequency,strength] of [[.119,1560,.51],[.234,775,.38],[.391,491,.29]]) {
        this.hiss(t+delay,.29,frequency,strength,.70,.006,input);
      }
      for(let i=0;i<12;i++) {
        this.hiss(t+.083+i*.048+this.random()*.084,.094,mix(1220,5290,this.random()),
          mix(.12,.39,this.random()),.79,.002,input);
      }
      const tail=this.hiss(t+.31,1.75,218,.46,.54,.040,input);
      tail.onended=()=>{input.disconnect();panner.disconnect();};
    }

    debrisLand(material,level,pan) {
      if(!this.context) return;
      const t=this.context.currentTime;
      if(t<(this.nextDebrisAt??0)) return;
      this.nextDebrisAt=t+.054;
      const pitch=mix(.84,1.19,this.random());
      const out=this.transientPan(t,pan);
      if(material==="metal") {
        this.hiss(t,.075,2280*pitch,.46*level,.66,.0015,out);
        this.decayTone(t+.002,.22,1130*pitch,1070*pitch,.23*level,out);
        this.decayTone(t+.005,.159,2630*pitch,2470*pitch,.12*level,out);
      } else if(material==="glass" || material==="ceramic") {
        const glass=material==="glass";
        this.hiss(t,.067,(glass ? 5440 : 3020)*pitch,.41*level,.83,.0015,out);
        this.decayTone(t+.003,.153,(glass ? 2870 : 870)*pitch,(glass ? 2620 : 570)*pitch,.20*level,out);
      } else {
        this.hiss(t,.105,1150*pitch,.56*level,.71,.0018,out);
        this.decayTone(t+.002,.143,198*pitch,98*pitch,.28*level,out);
        this.hiss(t+.029,.095,2420*pitch,.19*level,.83,.003,out);
      }
      const tail=this.hiss(t+.027,.218,(material==="metal" ? 2130 : 1390)*pitch,.115*level,.73,.009,out);
      tail.onended=()=>out.disconnect();
    }
  }

  const audio = new Sound();
  const maxHealth = 100, recoveryDelay = 4;
  const freshSwim = () => ({active:false,amount:0,phase:0,power:0,diving:false,depth:0,targetDepth:0,vertical:0});
  const player = {
    ...spawn,ground:0,feet:0,viewBase:0,eyeHeight:postures.standing.height,
    vx:0,vy:0,vz:0,grounded:true,wet:false,prone:false,
    health:maxHealth,breath:maxBreath,swim:freshSwim(),
    ownsLauncher:true,holstered:false,carried:null,seat:null,exit:null
  };
  player.feet = player.viewBase = player.ground = terrain.height(player.x,player.z);

  const keys = new Set(), shots = [], discarded = [], particles = [], ripples = [];
  const blastQueue=[], bursts=[], fires=[];
  const rippleData = new Float32Array(waterRipples.limit*4);
  let renderer, map, toy;
  let playing = false, started = false, aim = false, aimAmount = 0;
  let elapsed = 0, sceneTime = 0, captionUntil = 0, lastSecond = -1, lastMinute = -1;
  let kickAge = .7, kickSide = 0, nextRailKick = null;
  let swayX = 0, swayY = 0, phase = 0, pace = 0, foot = 0, stepDistance = 0, wakeDistance = 0;
  let stowAmount=0, brushDistance=0, nextBrushAt=0;
  let handToss=null, death=null, knockdown=null, breathTick=0, damageAge=1, bubbleAt=0, submerged=false;
  let recoveryStart=Infinity, nextRecovery=Infinity;
  const pocket = Array.from({length:startingCartridges-1},()=>newCartridge(true));
  const pistolGear = {model:launcher,loaded:newCartridge(false),center:-.26,
    motor:{powered:true,position:1,angle:0,switching:null,pending:false},
    speed:35.6,drag:.0089,reach:34,spinUp:.17,feedDuration:.49,kick:1};
  const rifleGear = {model:rifle,loaded:{cars:rifle.carOrder.slice(),belt:0},motor:null,center:rifle.center,reserve:18,nextCar:0,
    speed:90.4,drag:.0034,reach:92,spinUp:.08,feedDuration:.19,kick:.41};
  const spiralGear = {model:spiral,loaded:spiral.newMagazine(false),motor:null,center:spiral.center,
    spares:[spiral.newMagazine(true,[3,9,10,11]),spiral.newMagazine()],releaseGestures:[],
    speed:66.5,drag:.0056,spinUp:.072,feedDuration:.106,kick:.24};
  const launchers = [rifleGear,pistolGear,spiralGear];
  let equipped=pistolGear, mounted=equipped.loaded, motor=equipped.motor;
  let cycle = null, queued = null, refill = null, inspection = null, pendingDraw = null, triggerHeld = false;
  let motorPress = 0;
  let supply = null;
  let doorHold = null, burnerHold = null;
  let practiceRound = null;
  let animationDemo = null;
  const resolutionScales=[1,.89,.78,.68,.58];
  let frameAt=0, resolutionLevel=0, performanceSeconds=0, slowFrames=0, measuredFrames=0, recoverySeconds=0;

  const show = (message, seconds = 1.7) => {
    caption.textContent = message;
    captionUntil = elapsed + seconds;
  };
  const pad = number => String(number).padStart(2,"0");
  const spareCartridges = () => equipped===spiralGear ? spiralGear.spares : pocket;

  function inventory() {
    const long = equipped===rifleGear;
    const spiralMode=equipped===spiralGear;
    const between = mounted.missing || (equipped===pistolGear && refill && refill.time>=refill.timing.lifted && refill.time<refill.timing.seat);
    const visible = between ? [] : mounted.cars;
    const capacity = equipped.model.carCount;
    launcherName.textContent=spiralMode ? "3 SMG" : long ? "1 RIFLE" : "2 PISTOL";
    count.textContent = `${pad(visible.length)} / ${pad(capacity)}`;
    const spares=spareCartridges();
    carsTotal.textContent = pad(long ? mounted.cars.length+rifleGear.reserve
      : spares.reduce((total,cart)=>total+cart.cars.length,mounted.missing ? 0 : mounted.cars.length));
    const onTrack=spiralMode ? new Map(visible.map(car=>[car.slot-mounted.steps,car.index])) : null;
    carSlots.classList.toggle("spiral-slots",spiralMode);
    slots.forEach((slot,i)=>{
      slot.hidden=i>=capacity;
      slot.dataset.car=spiralMode ? (onTrack.get(i)??0) : long ? (visible[i]??0) : i;
      slot.classList.toggle("spent",spiralMode ? !onTrack.has(i) : long ? i>=visible.length : !visible.includes(i));
    });
    stockLabel.textContent=long ? "RESERVE" : "CARTS LEFT";
    stock.textContent = pad(long ? rifleGear.reserve : spares.length+Number(!mounted.missing && mounted.cars.length>0));
  }

  function nearSupply() {
    const bag=practiceRound ? practice.supply : map.supplyBag;
    return player.grounded && !player.swim.active && Math.abs(player.feet-bag.y)<.65
      && Math.hypot(player.x-bag.x,player.z-bag.z)<=supplyRange;
  }

  function stopSupply() {
    audio.stopBagRummage();
    supply=null;
    resupply.hidden=true;
  }

  function updateSupply(dt) {
    if(!supply) return;
    if(death || !nearSupply()) {
      stopSupply();
      return;
    }
    if(supply.time===supply.duration) return;
    if(supply.duration===null && !audio.loadingSupplyRecording) {
      const recording=audio.playBagRecording();
      supply.recording=recording;
      supply.duration=recording ? Math.max(.01,recording.duration-supplyFinishLead) : practiceSupplyDuration;
      if(!recording) audio.rummageBag(true);
    }
    const {duration,time:before,recording}=supply;
    if(duration!==null) {
      const time=recording ? audio.context.currentTime-recording.start : before+dt;
      supply.time=Math.min(duration,time);
    }
    const ratio=duration===null ? 0 : supply.time/duration, percent=Math.floor(ratio*100);
    supplyMeter.style.setProperty("--health-ratio",ratio);
    supplyMeter.setAttribute("aria-valuenow",percent);
    supplyPercent.textContent=`${pad(percent)}%`;
    if(supply.time===duration) {
      const long=equipped===rifleGear;
      if(long) rifleGear.reserve+=rifleSupply;
      else if(equipped===spiralGear) spiralGear.spares.push(spiral.newMagazine(),spiral.newMagazine());
      else pocket.push(newCartridge(true),newCartridge(true));
      inventory();
      supplyStatus.textContent=long ? `+${rifleSupply} MINICARS` : "+2 CARTRIDGES";
      if(!recording) {
        audio.stopBagRummage();
        audio.stowSupplies();
      }
    } else if(!recording && supplyRustles.some(at=>before<at && supply.time>=at)) audio.rummageBag();
  }

  function updateHealth() {
    healthValue.textContent = `${player.health} / ${maxHealth}`;
    healthMeter.setAttribute("aria-valuenow",player.health);
    healthMeter.style.setProperty("--health-ratio",player.health/maxHealth);
  }

  function updateBreathMeter(visible) {
    breathPanel.hidden=!visible;
    const seconds=Math.ceil(player.breath);
    const label=`${pad(seconds)} / ${maxBreath}`;
    if(breathValue.textContent!==label) {
      breathValue.textContent=label;
      breathMeter.setAttribute("aria-valuenow",seconds);
    }
    if(visible) breathMeter.style.setProperty("--health-ratio",player.breath/maxBreath);
  }

  function motorStatus() {
    power.parentElement.hidden=!motor;
    if(!motor) return;
    power.textContent = motor.powered ? "ON" : "OFF";
    power.dataset.powered = String(motor.powered);
  }

  function updateClock() {
    const second = Math.floor(elapsed);
    if (second === lastSecond) return;
    lastSecond = second;
    clock.textContent = [Math.floor(second/3600),Math.floor(second/60)%60,second%60].map(pad).join(":");
    const minute = 14*60+41+Math.floor(second/60);
    if (minute !== lastMinute) {
      lastMinute = minute;
      const hour = Math.floor(minute/60)%24;
      dateTime.textContent = `${hour<12 ? "AM" : "PM"}  ${hour%12 || 12}:${pad(minute%60)}`;
    }
  }

  function start(fullscreen) {
    if (!toy || playing) return;
    audio.active(true);
    started = true;
    playing = true;
    frameAt=performanceSeconds=slowFrames=measuredFrames=recoverySeconds=0;
    syncMotor();
    stage.dataset.mode = "play";
    recordState.textContent = "REC";
    menuNote.textContent = "";
    try {
      const lock = canvas.requestPointerLock?.();
      lock?.catch(() => {});
    } catch {
      // Relative mouse events still work inside the canvas when locking is unavailable.
    }
    if (fullscreen && document.fullscreenEnabled && navigator.keyboard?.lock) {
      document.documentElement.requestFullscreen().then(async () => {
        if (!playing) {
          if (document.fullscreenElement) await document.exitFullscreen();
          return;
        }
        await navigator.keyboard.lock([...heldKeys,"KeyC","KeyZ","KeyR","KeyM","KeyH","KeyE","KeyT","KeyF","Space",
          "Digit1","Digit2","Digit3","Numpad1","Numpad2","Numpad3"]);
        if (!playing) navigator.keyboard.unlock();
      }).catch(() => {});
    }
  }

  function pause() {
    if (!playing) return;
    playing = false;
    keys.clear();
    if(doorHold) hands.cancelUse(doorHold.item);
    doorHold=null;
    finishBurnerHold();
    stopSupply();
    queued = null;
    triggerHeld = false;
    player.vx = player.vz = 0;
    stage.dataset.mode = "pause";
    recordState.textContent = "PAUSE";
    playLabel.textContent = "RESUME";
    caption.textContent = "";
    audio.active(false);
    audio.runningTap(0);
    navigator.keyboard?.unlock?.();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (document.fullscreenElement === document.documentElement) document.exitFullscreen().catch(() => {});
  }

  let wasLocked = false, wasFullscreen = false;
  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    if (wasLocked && !locked) pause();
    wasLocked = locked;
  });
  document.addEventListener("fullscreenchange", () => {
    const fullscreen = document.fullscreenElement === document.documentElement;
    const leftFullscreen = wasFullscreen && !fullscreen;
    wasFullscreen = fullscreen;
    if (leftFullscreen) pause();
  });
  play.addEventListener("click", () => start(true));
  playWindowed.addEventListener("click", () => start(false));
  window.addEventListener("blur", pause);

  function posture() {
    if (player.seat) return postures.seated;
    if (player.swim.active) return postures.standing;
    if (player.prone) return postures.prone;
    const crouching = controlKeys.some(key=>keys.has(key)) || camp.inside(map.tents,player.x,player.z)
      || Valley.vehicles.underRoof(map.road.interior,player.x,player.z,player.feet);
    return crouching ? postures.crouched : postures.standing;
  }

  const propNames={chair:"CHAIR",table:"TABLE",tube:"FLOAT",cup:"CUP",box:"LUNCH BOX",flask:"THERMOS",launcher:"PISTOL",rifle:"RIFLE",spiral:"SMG",
    desk:"DESK",crt:"CRT TV",phone:"TELEPHONE",bell:"BELL",pamphlet:"PAMPHLET",document:"DOCUMENT",ledger:"GUEST BOOK",
    key:"ROOM KEY",plate:"PLATE",cushion:"FLOOR CUSHION",bowl:"BOWL",tumbler:"GLASS",jar:"CONDIMENT JAR",
    pitcher:"WATER PITCHER",tray:"TRAY",pot:"COOKING POT",utensils:"UTENSILS",ashtray:"ASHTRAY INSERT",lighter:"LIGHTER PLUG"};
  const look = () => currentCamera(canvas.width/Math.max(1,canvas.height));

  function stopLauncher() {
    aim=triggerHeld=false;
    cycle=queued=refill=inspection=pendingDraw=null;
    nextRailKick=null;
    motorPress=0;
    if(motor) {
      motor.switching=null;
      motor.pending=false;
      motor.position=Number(motor.powered);
    }
    stage.dataset.aim="false";
    syncMotor();
    inventory();
  }

  function updatePracticeHud() {
    if(!practiceRound) return;
    const total=map.road.practice.targets.length;
    const seconds=Math.floor((practiceRound.finished??elapsed)-practiceRound.started);
    if(practiceRound.displaySecond===seconds && practiceRound.displayHits===practiceRound.hits) return;
    practiceRound.displaySecond=seconds;
    practiceRound.displayHits=practiceRound.hits;
    practiceTitle.textContent=practiceRound.finished===null ? "TARGET RANGE" : "RANGE COMPLETE";
    practiceScore.textContent=`${pad(practiceRound.hits)} / ${pad(total)}`;
    practiceTime.textContent=`${pad(Math.floor(seconds/60))}:${pad(seconds%60)}`;
  }

  function togglePractice() {
    if(!player.grounded || player.wet || player.swim.active || player.seat || player.carried) {
      show("USE F ON DRY LAND WITH EMPTY HANDS");
      return;
    }
    if(refill || cycle || handToss || pendingDraw || hands.busy || motor?.switching) return;
    const destination=practiceRound?.returnTo??practice.spawn;
    if(practiceRound) practiceRound=null;
    else {
      const {x,z,yaw,pitch,feet}=player;
      practiceRound={returnTo:{x,z,yaw,pitch,feet},started:elapsed,finished:null,hits:0,displaySecond:-1,displayHits:-1};
      for(const target of map.road.practice.targets) target.hitAt=null;
      if(animationTest && !animationDemo) {
        animationDemo=Valley.characterFixture.demo(renderer,practice.spawn,({at,speed,surface,side,stepBank})=>{
          const distance=Math.hypot(at[0]-player.x,at[2]-player.z);
          if(distance<12) audio.step(surface,speed>=2.3,.45*(1-smooth(2,12,distance)),side ? 1 : -1,0,stepBank);
        });
      }
    }
    for(let i=shots.length-1;i>=0;i--) {
      if(practice.inScene(shots[i].pos[0],shots[i].pos[2])) shots.splice(i,1);
    }
    const bed=terrain.height(destination.x,destination.z);
    const floor=terrain.solidHeight(map,destination.x,destination.z,bed,(destination.feet??bed)+.24);
    Object.assign(player,{...destination,feet:floor,ground:floor,viewBase:floor,eyeHeight:postures.standing.height,
      vx:0,vy:0,vz:0,grounded:true,wet:false,prone:false,swim:freshSwim()});
    keys.clear();
    stopSupply();
    stopLauncher();
    hands.reset();
    aimAmount=pace=stepDistance=wakeDistance=swayX=swayY=0;
    practiceHud.hidden=!practiceRound;
    practiceHint.textContent=practiceRound ? "VALLEY" : "TARGET RANGE";
    updatePracticeHud();
  }

  function letGo(prop) {
    if(prop===equipped.prop) {
      player.ownsLauncher=false;
      player.holstered=true;
      stopLauncher();
    } else if(player.carried===prop) {
      player.carried=null;
    }
  }

  function selectLauncher(next) {
    if(handToss || (hands.busy && hands.action.kind!=="grab") || (!pendingDraw && equipped===next && !player.holstered)) return;
    if(!next.prop.picked) {
      show("PICK UP THE "+propNames[next.prop.kind]+" FIRST");
      return;
    }
    if(player.carried) {
      putDown(player.carried,look(),()=>selectLauncher(next));
      return;
    }
    stopSupply();
    if(pendingDraw) {
      pendingDraw=next;
    } else if(player.ownsLauncher && !player.holstered && stowAmount<.94) {
      stopLauncher();
      pendingDraw=next;
      audio.gearChange("stow",equipped===rifleGear);
    } else drawLauncher(next);
  }

  function drawLauncher(next) {
    stopLauncher();
    equipped=next;
    mounted=next.loaded;
    motor=next.motor;
    player.ownsLauncher=true;
    player.holstered=false;
    aimAmount=0;
    kickAge=.7;
    stowAmount=Math.max(stowAmount,.96);
    inventory();
    motorStatus();
    audio.gearChange("draw",equipped===rifleGear);
  }

  function putDown(prop=player.carried,cam=look(),after) {
    const yaw=-player.yaw, sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
    const to=plus(cam.at,times(cam.forward,2.15));
    const aimed=prop.small ? props.trace(map,cam.at,to,Valley.roadview.trace(map.road,cam.at,to)?.fraction??1) : null;
    const carrying=prop===player.carried;
    const ripples=packRipples();
    function available(plan) {
      if(!plan) return false;
      const rest=props.placement(map,prop,plan,sceneTime,ripples);
      if(!rest) return false;
      if(!carrying) return props.commitPlacement(prop,plan,rest);
      return hands.reachable(map,cam,prop,rest.matrix,true) && hands.lower(prop,plan,after);
    }
    let placed=aimed?.prop.surface && aimed.normal[1]>.6
      && available(props.surfacePlacement(map,prop,aimed.prop,aimed.at,yaw));
    if(!placed) {
      const reach=Math.max(prop.rx,prop.rz)+(prop.small ? .49 : .69);
      for(const [front,side] of [[reach,0],[reach+.38,0],[reach,.65],[reach,-.65],[reach+.30,.94],[reach+.30,-.94]]) {
        const x=player.x+sin*front+cos*side, z=player.z-cos*front+sin*side;
        if(available({x,z,yaw,reach:player.feet+.9})) {
          placed=true;
          break;
        }
      }
    }
    if(!placed) {
      show("NEED ROOM TO SET DOWN");
      return false;
    }
    if(!carrying) letGo(prop);
    return true;
  }

  function finishPlacement(prop,plan,rest) {
    props.commitPlacement(prop,plan,rest,true);
    letGo(prop);
  }

  function takeProp(prop) {
    prop.picked=true;
    prop.support=null;
    prop.installed=null;
    const found=launchers.find(gear=>gear.prop===prop);
    if(found) {
      prop.flight=null;
      selectLauncher(found);
    } else {
      player.holstered=true;
      player.carried=prop;
      stopLauncher();
    }
    return true;
  }

  function handleProp(alsoLauncher=false) {
    if(handToss || pendingDraw || (hands.busy && hands.action.kind!=="grab")) return false;
    const cam=look();
    if(player.carried) return putDown(player.carried,cam);
    if(!player.seat && (!player.prone || player.swim.active) && (player.grounded || player.swim.active)) {
      const prop=props.target(map,player,cam);
      if(prop) {
        if(launchers.some(gear=>gear.prop===prop)) return takeProp(prop);
        const stowing=player.ownsLauncher && !player.holstered;
        if(!hands.reach(map,cam,prop,stowing)) {
          show("MOVE CLOSER");
          return false;
        }
        player.holstered=true;
        stopLauncher();
        return true;
      }
    }
    if(alsoLauncher && player.ownsLauncher) {
      if(!player.holstered && player.pitch<-.73 && !player.swim.active && !player.seat) return putDown(equipped.prop,cam);
      player.holstered=!player.holstered;
      if(player.holstered) stopLauncher();
      return true;
    }
    return false;
  }

  function throwSwing() {
    if(!handToss) return 0;
    const t=handToss.age;
    return smooth(.081,.198,t)*(1-smooth(.204,.47,t))-.45*Math.sin(Math.PI*smooth(0,.102,t));
  }

  function tossFromHand(prop,cam,force,side=0) {
    const inHand=prop===equipped.prop && !player.holstered;
    const carried=prop===player.carried;
    const reach=carried && hands.matrix ? translation(hands.matrix) : point(cam.toWorld,
      inHand ? point(currentPose(),[0,0,equipped.center]) : [side,-.40,-.32]);
    const solid=terrain.traceShot(map,cam.at,reach,false);
    const hit=props.trace(map,cam.at,reach,solid?.fraction??1,prop) || solid;
    const at=hit ? plus(hit.at,times(hit.normal,.051)) : reach;
    const speed=force*(7.9/(1+prop.mass*.10));
    const velocity=plus(times(cam.forward,speed),[player.vx*.44+side*.84,force*.99,player.vz*.44]);
    if(carried) hands.detach(prop,undefined,hands.drape());
    props.toss(prop,at,velocity,-player.yaw,mix(.48,1,force));
    letGo(prop);
  }

  function requestToss() {
    if(handToss || pendingDraw || (hands.busy && hands.action.kind!=="grab")) return;
    const prop=player.carried || (player.ownsLauncher && !player.holstered ? equipped.prop : null);
    if(!prop) return;
    stopLauncher();
    handToss={prop,age:0,released:false};
    audio.toss();
  }

  function updateToss(dt,aspect) {
    if(!handToss) return;
    handToss.age+=dt;
    if(!handToss.released && handToss.age>=.191) {
      const prop=handToss.prop;
      tossFromHand(prop,currentCamera(aspect),1,prop.small ? .09 : 0);
      handToss.released=true;
    }
    if(handToss.age>=.49) handToss=null;
  }

  function chairAction() {
    if(player.seat) {
      const seat=player.seat;
      const candidates=[player.exit];
      for(const reach of [.81,1.14,1.49,1.91]) {
        for(let i=0;i<8;i++) {
          const angle=i*Math.PI/4;
          const [x,,z]=point(seat.matrix,[Math.sin(angle)*reach,0,-Math.cos(angle)*reach]);
          candidates.push([x,z]);
        }
      }
      for(const [x,z] of candidates) {
        const floor=terrain.walkFloor(map,x,z,seat.y,.62);
        if(floor===null || floor<swimExit || !camp.canStep(map.tents,seat.x,seat.z,x,z,postures.standing.height,false)
          || map.props.some(p=>p!==seat && p.mass && !p.picked && props.overlap(p,x,z,.25)<1)) continue;
        seat.occupied=false;
        player.seat=player.exit=null;
        Object.assign(player,{x,z,feet:floor,ground:floor,grounded:true,wet:floor<-.065});
        stepDistance=0;
        return;
      }
      show("NEED ROOM TO STAND");
      return;
    }
    if(player.carried || player.swim.active || !player.grounded) return;
    const chair=props.target(map,player,look(),true);
    if(!chair) return;
    player.exit=[player.x,player.z];
    player.seat=chair;
    chair.occupied=true;
    chair.vx=chair.vz=chair.spin=0;
    player.vx=player.vy=player.vz=0;
    player.prone=false;
    stepDistance=0;
  }

  function fixtureTarget(cam) {
    if(death || knockdown || player.seat || player.swim.active || handToss || inspection || refill || supply || pendingDraw) return null;
    return lodging.target(map.road,cam);
  }

  function fixtureAction(item) {
    hands.used(item);
    if(item.car) {
      const sound=Valley.vehicles.use(item);
      if(sound==="switch" || !sound) audio.switchClick();
      else audio.fixture(sound,(item.door??item).on);
      return;
    }
    if(lodging.use(item)) {
      if(item.ignition) {
        if(keys.has("KeyE")) burnerHold=item;
        else lodging.releaseBurner(item);
      }
      audio.fixture(item.window ? "window" : item.kind,item.on);
    }
    else {
      audio.switchClick();
      show("NO POWER",1.18);
    }
  }

  function finishBurnerHold() {
    if(burnerHold) lodging.releaseBurner(burnerHold);
    burnerHold=null;
  }

  function updateInterior(dt) {
    if(doorHold) {
      if(!keys.has("KeyE") || fixtureTarget(look())!==doorHold.item) {
        hands.cancelUse(doorHold.item);
        doorHold=null;
      }
      else if((doorHold.time+=dt)>=lodging.holdTime) {
        fixtureAction(doorHold.item);
        doorHold=null;
      }
    }
    const interior=map.road.interior, at=[player.x,player.feet+player.eyeHeight,player.z];
    if(burnerHold) {
      if(!keys.has("KeyE") || !burnerHold.ignition || Math.hypot(...minus(burnerHold.at,at))>2.48) finishBurnerHold();
      else {
        const {spark,lit}=lodging.igniteTick(burnerHold,dt);
        if(spark || lit) audio.stoveIgnition(spark,lit);
      }
    }
    lodging.tick(interior,dt,player);
    audio.runningTap(lodging.waterVolume(interior,at));
    if(interior.leaks.length || audio.leakAudio) {
      const {level,pan}=lodging.leakSound(interior,at,player.yaw);
      audio.runningLeak(level,pan);
    }
  }

  function updateInteraction(cam) {
    let text="";
    if(death || knockdown || handToss || inspection || refill || supply) text="";
    else if(nearSupply()) text="HOLD R TO RESUPPLY";
    else if(player.seat) text="E STAND";
    else {
      const fitting=fixtureTarget(cam);
      if(fitting) text=fitting.car ? Valley.vehicles.prompt(fitting) : lodging.prompt(fitting);
      else if(player.carried) text="H SET DOWN / T THROW";
      else {
        const near=props.target(map,player,cam);
        const chair=near && props.canSit(near);
        if(near) text="H PICK UP "+propNames[near.kind]+(chair ? " / E SIT" : "");
        else if(camp.nearDoor(map.tents,player.x,player.z) && !camp.inside(map.tents,player.x,player.z)) text="CTRL CROUCH TO ENTER";
        else if(player.ownsLauncher && player.holstered) text="H DRAW";
      }
    }
    if(interaction.textContent!==text) interaction.textContent=text;
    interaction.style.setProperty("--door-progress",doorHold ? doorHold.time/lodging.holdTime : 0);
    interaction.hidden=!playing || !text;
  }

  function inspectLauncher() {
    if(inspection || cycle || queued || refill || triggerHeld || pendingDraw || handToss || motor?.switching || motor?.pending
      || supply || !player.ownsLauncher || player.holstered || stowAmount>.34 || mounted.missing) return;
    inspection={time:0};
    caption.textContent="";
    stage.dataset.aim="false";
  }

  window.addEventListener("keydown", e => {
    if (!playing) return;
    if (e.code === "Escape") {
      pause();
      return;
    }
    if(death || knockdown) return;
    const swim=player.swim;
    if(inspection && !heldKeys.has(e.code) && !(e.code==="KeyZ" && swim.active)) {
      e.preventDefault();
    } else if(e.code==="KeyF") {
      e.preventDefault();
      if(!e.repeat) togglePractice();
    } else if (heldKeys.has(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    } else if (e.code === "KeyC") {
      e.preventDefault();
      if(!e.repeat) inspectLauncher();
    } else if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat && !player.swim.active && player.grounded && !player.carried && posture() === postures.standing) {
        player.vy = player.wet ? 4.15 : 4.93;
        player.grounded = false;
        stepDistance = 0;
      }
    } else if (e.code === "KeyZ") {
      e.preventDefault();
      if(e.repeat) return;
      if(swim.active) {
        swim.diving=!swim.diving;
        swim.targetDepth=swim.diving ? Math.max(.77,swim.depth) : 0;
        swim.vertical=0;
      } else if(!player.seat && !player.carried) player.prone=!player.prone;
    } else if (/^(Digit|Numpad)[123]$/.test(e.code)) {
      e.preventDefault();
      if(!e.repeat) selectLauncher(launchers[Number(e.code.at(-1))-1]);
    } else if (e.code === "KeyR") {
      e.preventDefault();
      if(e.repeat || keys.has(e.code)) return;
      keys.add(e.code);
      if(pendingDraw || (equipped===rifleGear && refill)) return;
      if(nearSupply()) {
        supply={time:0,duration:practiceRound ? practiceSupplyDuration : null,recording:null};
        supplyStatus.textContent="RESUPPLYING";
        resupply.hidden=false;
        if(practiceRound) audio.rummageBag(true);
        updateSupply(0);
      } else if (!handToss && player.ownsLauncher && !refill && !player.holstered) {
        const canQueue=equipped===rifleGear ? rifleGear.reserve>0 &&
          (mounted.cars.length<rifle.carCount || cycle?.feedsCar) : spareCartridges().length>0;
        if (cycle && canQueue) queued = "reload";
        else beginReload();
      }
    } else if (e.code === "KeyM") {
      e.preventDefault();
      if (motor && !e.repeat && !handToss && !pendingDraw && player.ownsLauncher && !player.holstered) motor.pending=!motor.pending;
    } else if (e.code === "KeyH" || e.code === "KeyE" || e.code === "KeyT") {
      e.preventDefault();
      if(!e.repeat && (e.code!=="KeyE" || !keys.has("KeyE"))) {
        if(e.code==="KeyH") handleProp(true);
        else if(e.code==="KeyT") requestToss();
        else if(!handToss && !hands.busy) {
          keys.add("KeyE");
          const cam=look(), item=fixtureTarget(cam);
          const launcherVisible=player.ownsLauncher && stowAmount<.97;
          const animating=item && (!launcherVisible || equipped===pistolGear) && hands.use(item,cam,player.carried,launcherVisible);
          if(item?.kind==="door") doorHold={item,time:0};
          else if(item && (!animating || item.kind==="burner")) fixtureAction(item);
          else if(!item) chairAction();
        }
      }
    }
  });
  window.addEventListener("keyup", e => {
    keys.delete(e.code);
    if(e.code==="KeyR") stopSupply();
    if(e.code==="KeyE") {
      if(doorHold) hands.cancelUse(doorHold.item);
      doorHold=null;
      finishBurnerHold();
    }
  });
  window.addEventListener("mousemove", e => {
    if (!playing || death || knockdown || (document.pointerLockElement !== canvas && !stage.contains(e.target))) return;
    const sensitivity = mix(.00242,.00172,aimAmount);
    const dx = clamp(e.movementX,-145,145), dy = clamp(e.movementY,-145,145);
    player.yaw = (player.yaw+dx*sensitivity)%(2*Math.PI);
    player.pitch = clamp(player.pitch-dy*sensitivity,-1.36,1.18);
    swayX = clamp(swayX+dx*.035,-1.65,1.65);
    swayY = clamp(swayY+dy*.025,-1.65,1.65);
  });
  stage.addEventListener("contextmenu", e => { if (playing) e.preventDefault(); });
  stage.addEventListener("mousedown", e => {
    if (!playing || death || knockdown || handToss || pendingDraw) return;
    if(inspection) {
      e.preventDefault();
      return;
    }
    if(equipped===rifleGear && refill && (e.button===0 || e.button===2)) {
      e.preventDefault();
      closeRifleReload(e.button===2);
      return;
    }
    if(equipped===spiralGear && refill) {
      e.preventDefault();
      return;
    }
    if (!player.ownsLauncher || player.holstered || stowAmount>.34) {
      if(e.button===0 && player.holstered) {
        e.preventDefault();
        handleProp();
      }
      return;
    }
    if (e.button === 2) {
      aim = !aim;
      stage.dataset.aim = String(aim && !refill);
      e.preventDefault();
    } else if (e.button === 0) {
      e.preventDefault();
      if (triggerHeld) return;
      triggerHeld = true;
      if (refill) return;
      if (!mounted.cars.length) emptyCaption();
      if (!cycle) beginCycle(false,true);
      else if (queued !== "reload") queued = "fire";
      syncMotor();
    }
  });
  window.addEventListener("mouseup", e => {
    if (e.button === 0) triggerHeld = false;
  });

  function emptyCaption() {
    const available=equipped===rifleGear ? rifleGear.reserve : spareCartridges().length;
    show(available ? "R RELOAD" : "OUT OF MINICARS",2.2);
  }

  function beginCycle(warm = false, single = false) {
    const powered = motor?.powered ?? true;
    const hasCars = mounted.cars.length>0 && !mounted.missing;
    const start = mounted.feed ?? 0;
    const end = !powered && hasCars ? launcher.jamFeed : 1;
    if(start>=end) return;
    const spiralMode=equipped===spiralGear;
    const feedsCar=powered && hasCars && (!spiralMode || mounted.cars[0].slot===mounted.steps);
    const wind=powered && !warm && (!spiralMode || hasCars) ? equipped.spinUp : 0;
    cycle = {powered,wind,start,progress:start,end,feedsCar,single};
  }

  const holdingDrive = () => triggerHeld || Boolean(cycle?.powered);

  function syncMotor(dt = 0) {
    const ready = playing && !death && player.ownsLauncher && !player.holstered && !pendingDraw;
    const rifleMode=equipped===rifleGear;
    const spinning = ready && !refill && !inspection && (motor?.powered ?? true) && holdingDrive();
    const loaded = spinning && Boolean(cycle?.feedsCar && cycle.progress>.36);
    const firingFeed=ready && !refill && cycle?.wind===0;
    if(equipped===spiralGear) {
      const testing=ready && inspection && inspection.time>=spiral.inspection.motorStart
        && inspection.time<spiral.inspection.motorStop;
      audio.motor(false);
      audio.beltMotor(false);
      audio.spiralDrive(spinning && mounted.cars.length>0,Boolean(testing) || (firingFeed && !mounted.missing),loaded);
      return;
    }
    audio.spiralDrive(false);
    if (spinning && motor) motor.angle = (motor.angle+dt*(loaded ? 71 : 84))%(2*Math.PI);
    audio.motor(spinning,loaded,rifleMode);
    const testing=ready && motor && inspection && inspection.time>=launcher.inspection.press && inspection.time<launcher.inspection.release;
    const loadingFeed=ready && rifleMode && rifle.feeding(refill);
    const beltLoaded=loadingFeed || (firingFeed && !mounted.missing && mounted.cars.length>0);
    audio.beltMotor(firingFeed || Boolean(testing) || loadingFeed,beltLoaded,rifleMode,loadingFeed ? .34 : 1);
  }

  function toggleMotor() {
    motor.powered = !motor.powered;
    if (cycle) {
      const hasCars = mounted.cars.length>0 && !mounted.missing;
      cycle.powered = motor.powered;
      cycle.feedsCar = motor.powered && hasCars;
      cycle.wind = motor.powered ? equipped.spinUp : 0;
      cycle.end = !motor.powered && hasCars ? launcher.jamFeed : 1;
    }
    motorStatus();
    audio.switchClick();
    syncMotor();
  }

  function updatePowerSwitch(dt) {
    if(!motor) return;
    if(!motor.switching && motor.pending && !refill && queued!=="reload" && stowAmount<=.34) {
      motor.switching={time:0,from:Number(motor.powered)};
      motor.pending=false;
    }
    if(!motor.switching) return;
    const motion=motor.switching, {touch,flip,end}=launcher.switchTiming;
    const before=motion.time;
    motion.time=Math.min(end,before+dt);
    motor.position=mix(motion.from,1-motion.from,smooth(touch,flip,motion.time));
    if(before<flip && motion.time>=flip) toggleMotor();
    if(motion.time>=end) motor.switching=null;
  }

  function beginReload() {
    if(equipped===spiralGear) {
      const incoming=spiralGear.spares[0];
      if(!incoming) {
        if(mounted.cars.length) show("NO SPARE CARTRIDGES");
        else emptyCaption();
        return;
      }
      triggerHeld=aim=false;
      cycle=null;
      let gesture=null;
      if(!mounted.missing) {
        const choices=spiralGear.releaseGestures;
        if(!choices.length) choices.push("thumb","index","fist");
        [gesture]=choices.splice(Math.floor(rng()*choices.length),1);
      }
      refill={time:0,outgoing:mounted,incoming,uncap:incoming.sealed,gesture,
        stashing:!mounted.missing && mounted.cars.length>0};
      stage.dataset.aim="false";
      syncMotor();
      return;
    }
    if(equipped===rifleGear) {
      if(mounted.cars.length===rifle.carCount) return;
      if(!rifleGear.reserve) {
        show("NO SPARE MINICARS");
        return;
      }
      triggerHeld=aim=false;
      cycle=null;
      refill={phase:"open",time:0,end:rifle.reload.openEnd,startedEmpty:!mounted.cars.length};
      stage.dataset.aim="false";
      syncMotor();
      return;
    }
    const incoming = pocket[0];
    if (!incoming) {
      if (mounted.cars.length) show("NO SPARE CARTRIDGES");
      else emptyCaption();
      return;
    }
    if(motor.switching) {
      queued="reload";
      return;
    }
    const uncap = incoming.sealed;
    const timing = uncap ? launcher.reload : launcher.uncappedReload;
    refill = {time:0,outgoing:mounted,incoming,uncap,timing,stashing:mounted.cars.length>0};
    stage.dataset.aim = "false";
  }

  function ripple(x,z,strength) {
    if (ripples.length === waterRipples.limit) {
      const small = ripples.findIndex(r=>r[3]<.52);
      if (small === -1 && strength < .52) return;
      ripples.splice(Math.max(0,small),1);
    }
    ripples.push([x,z,sceneTime,strength]);
  }

  function spray(x,z,strength,heading,impact = false,stroke = false) {
    ripple(x,z,strength);
    audio.splash(strength,impact ? "impact" : stroke ? "stroke" : "wade");
    const scale = Math.min(1.52,strength**.66);
    const crown = Math.round((impact ? 46 : stroke ? 37 : 30)*scale);
    const beads = Math.round((impact ? 110 : stroke ? 78 : 65)*scale);
    const haze = Math.round((impact ? 43 : stroke ? 32 : 28)*scale);
    const turn = waterRandom()*Math.PI*2, kick = impact ? 1.15 : stroke ? 1.04 : 1, surface=terrain.waterLevel(x,z);
    for (let i=0; i<crown+beads+haze; i++) {
      const rim = i<crown, mist = i>=crown+beads;
      const angle = rim ? turn+(i+waterRandom()*.92)*Math.PI*2/crown : waterRandom()*Math.PI*2;
      const dx = Math.cos(angle), dz = Math.sin(angle);
      const radius = scale*(rim ? mix(.090,.24,waterRandom()) : mix(.022,.18,waterRandom()));
      const pos = [x+dx*radius,surface+mix(.026,.085,waterRandom()),z+dz*radius];
      const radial = scale*kick*(rim ? mix(1.25,2.72,waterRandom()) : mix(.68,3.28,waterRandom()));
      const rise = rim ? mix(1.85,3.22,waterRandom()) : mist ? mix(.89,2.34,waterRandom()) : mix(1.65,4.46,waterRandom());
      const lift = Math.min(6.2,rise*scale*kick);
      const velocity = [dx*radial+heading[0]*.52,lift,dz*radial+heading[1]*.52];
      const life = mist ? mix(.29,.57,waterRandom()) : Math.max(mix(.56,1.00,waterRandom()),lift*2/waterGravity+.12);
      const size = scale*(mist ? mix(.066,.142,waterRandom()) : rim ? mix(.035,.086,waterRandom()) : mix(.017,.069,waterRandom()**1.35));
      const light = mix(.73,1,waterRandom());
      const alpha = mist ? mix(.12,.29,waterRandom()) : mix(.73,1,waterRandom());
      const landingWave = !rim && !mist && (i-crown)%(impact ? 27 : 42)===0 ? .16+.11*scale : 0;
      particles.push({pos,velocity,life,total:life,size,color:[light*.93,light*.99,light],alpha,kind:"water",drop:!mist,landingWave});
    }
  }

  function grit([x,y,z],strength) {
    audio.sand(strength);
    const count = Math.round(9+27*strength);
    for (let i=0; i<count; i++) {
      const a = rng()*Math.PI*2, r = (.18+rng()*1.03)*strength;
      const dust = i%5 === 0;
      const life = (dust ? .30 : .16)+rng()*.27+strength*.08;
      const size = (dust ? .045+rng()*.066 : .013+rng()*.028)*mix(.65,1.32,clamp(strength/1.6,0,1));
      particles.push({pos:[x,y+.018,z],velocity:[Math.cos(a)*r,(.35+rng()*1.47)*strength,Math.sin(a)*r],
        life,total:life,size,color:dust ? [.72,.63,.48] : [.66,.53,.37],alpha:dust ? .28 : .74,kind:"sand"});
    }
  }

  function sparks(at,normal,velocity,strength) {
    const speed = Math.hypot(...velocity);
    const slide = minus(velocity,times(normal,dot(velocity,normal)));
    const tangent = unit(slide);
    const glancing = Math.hypot(...slide)/Math.max(speed,.001);
    const heat = strength*mix(.73,1.16,glancing)*clamp(speed/5.6,.15,1);
    const pos = plus(at,times(normal,.018));
    const count = Math.round(6+26*heat);
    for (let i=0; i<count; i++) {
      const fan = plus(times(normal,.41+rng()*.64),times(tangent,.24+rng()*.91));
      const scatter = fan.map((v,j)=>v+(rng()-.5)*(j===1 ? 1.18 : 1.52));
      const ray = unit(plus(scatter,times(normal,Math.max(0,.18-dot(scatter,normal)))));
      const force = (1.5+rng()*5.6)*mix(.48,1.21,clamp(heat,0,1));
      const life = .125+rng()*.235;
      particles.push({pos,velocity:times(ray,force),life,total:life,size:(.015+rng()*.022)*mix(.68,1.28,clamp(heat,0,1)),
        color:[1,.55+rng()*.38,.14+rng()*.41],alpha:.74+rng()*.25,kind:"spark",streak:true});
    }
    const life = .115;
    particles.push({pos,velocity:[0,0,0],life,total:life,size:.037+heat*.046,color:[1,.90,.55],alpha:.95,kind:"spark"});
    return {heat,glancing};
  }

  function splinters(at,normal,velocity,power) {
    const slide=unit(minus(velocity,times(normal,dot(velocity,normal))));
    const origin=plus(at,times(normal,.026));
    const count=Math.round(mix(6,34,Math.sqrt(power)));
    for(let i=0;i<count;i++) {
      const fan=plus(times(normal,mix(.48,.97,woodRandom())),times(slide,mix(.04,.66,woodRandom())));
      const scatter=[fan[0]+(woodRandom()-.5)*1.61,fan[1]+mix(-.22,1.16,woodRandom()),fan[2]+(woodRandom()-.5)*1.61];
      const outward=unit(plus(scatter,times(normal,Math.max(0,.25-dot(scatter,normal)))));
      const drift=times(outward,mix(.63,4.65,woodRandom())*mix(.53,1.04,power));
      const life=mix(.26,.89,woodRandom());
      const part={pos:origin,velocity:drift,life,total:life,kind:"wood"};
      if(i%5!==4) {
        particles.push({...part,mesh:map.woodChipMeshes[i%map.woodChipMeshes.length],
          size:mix(.39,1.10,woodRandom())*mix(.65,1.24,power),
          angles:[woodRandom()*6.28,woodRandom()*6.28,woodRandom()*6.28],
          spin:[mix(-14,14,woodRandom()),mix(-20,20,woodRandom()),mix(-16,16,woodRandom())]});
      } else {
        const shade=mix(.72,1.05,woodRandom());
        particles.push({...part,size:mix(.014,.045,woodRandom()),alpha:.46,color:times([.69,.52,.33],shade)});
      }
    }
  }

  function playFragileImpact(type,at,strength,broken,pane=false) {
    const dx=at[0]-player.x, dz=at[2]-player.z;
    const distance=Math.hypot(dx,at[1]-player.viewBase-player.eyeHeight,dz);
    const volume=(1-smooth(14,34,distance))/(1+(distance/8.8)**1.44);
    const pan=(dx*Math.cos(player.yaw)+dz*Math.sin(player.yaw))/Math.max(1.8,distance);
    audio.fragileImpact(type,strength,broken,volume,pan,pane);
  }

  function brittleDebris({type,at,normal,fixture,blast=false},strength,broken,budget=Infinity,scale=1) {
    const glass=type==="glass", meshes=map.road.interior.shards[type];
    const count=Math.min(budget,broken ? (glass ? 54 : 33) : 4);
    const power=clamp(strength,.35,1.4);
    const random=Math.random, bounds=fixture?.bounds;
    for(let i=0;i<count;i++) {
      const scattered=broken && bounds && i%3!==0;
      const origin=scattered ? point(fixture.matrix,[
        (random()*2-1)*bounds.hx,
        bounds.center[1]-fixture.at[1]+(random()*2-1)*bounds.half[1]*(glass ? 1 : .75),
        glass ? 0 : (random()*2-1)*bounds.hz*.88
      ]) : at;
      const fan=times(normal,scattered && glass && i%2 ? -1 : 1);
      const direction=unit(plus(fan,[(random()-.5)*1.85,mix(-.42,1.28,random()),(random()-.5)*1.85]));
      const velocity=times(direction,power*mix(.55,broken ? 4.1 : 2.1,random()));
      const pos=plus(origin,times(fan,.029));
      const life=mix(.70,broken ? 3.3 : 1.25,random());
      const floor=fixture?.plumbing?.floor
        ?? Math.max(terrain.height(pos[0],pos[2]),Valley.roadview.floor(map.road,pos[0],pos[2],pos[1]+.016).top);
      const size=mix(.018,glass ? .089 : fixture?.plumbing ? .177 : .124,random())*scale*(broken ? 1 : .52);
      particles.push({pos,velocity,life,total:life,kind:"fragment",floor,size,mesh:meshes[i%meshes.length],
        impactMaterial:broken && (blast || i%3===0) ? type : null,
        angles:[random()*6.28,random()*6.28,random()*6.28],
        spin:[mix(-15,15,random()),mix(-17,17,random()),mix(-20,20,random())]});
    }
  }

  function bubbleCloud(at,amount) {
    for(let i=0;i<amount;i++) {
      const life=mix(.46,1.58,waterRandom()), size=mix(.019,.067,waterRandom());
      particles.push({pos:plus(at,[(waterRandom()-.5)*.26,(waterRandom()-.5)*.13,(waterRandom()-.5)*.25]),
        velocity:[(waterRandom()-.5)*.38,mix(.32,1.10,waterRandom()),(waterRandom()-.5)*.36],
        life,total:life,size,color:[.74,.83,.69],alpha:mix(.22,.58,waterRandom()),kind:"bubble"});
    }
  }

  function throwImpact(prop,at,velocity,surface,flop=false,normal=[0,1,0],hit=null) {
    const speed=Math.hypot(...velocity), distance=Math.hypot(at[0]-player.x,at[2]-player.z);
    const strength=clamp((speed*.16+.075)*(.72+Math.sqrt(prop.mass)*.24),.14,1.38);
    const level=strength*Math.exp(-distance*.10);
    if(hit?.fixture?.car) vehicleImpact(hit,velocity,speed,strength,clamp(-dot(velocity,normal)/(speed||1),0,1));
    if(prop.broken && prop.fragile) {
      playFragileImpact(prop.fragile,at,strength,true);
      brittleDebris({type:prop.fragile,at,normal},strength,true,15,.54);
      return;
    }
    if(surface==="water") {
      spray(at[0],at[2],strength,[velocity[0]*.19,velocity[2]*.19],speed>2.8);
      bubbleCloud([at[0],at[1]-.12,at[2]],Math.round(4+strength*8));
      if(flop) audio.tubeFlop(surface,level*.60);
    } else {
      const submerged=terrain.wetAt(at[0],at[2],at[1]);
      if(submerged && speed>1.1) bubbleCloud(at,5);
      const loudness=level*(submerged ? .42 : 1);
      if(flop) audio.tubeFlop(surface,loudness);
      else audio.objectLand(prop.kind,surface,loudness);
    }
  }

  function movement(dt) {
    if(player.seat) {
      const seat=player.seat, ease=1-Math.exp(-dt*11.0);
      player.x=mix(player.x,seat.x,ease);
      player.z=mix(player.z,seat.z,ease);
      player.feet=player.ground=seat.y;
      player.viewBase=mix(player.viewBase,seat.y,ease);
      player.eyeHeight=mix(player.eyeHeight,seat.kind==="cushion" ? .70 : postures.seated.height,ease);
      player.wet=terrain.wetAt(seat.x,seat.z,seat.y+.04);
      pace=mix(pace,0,ease);
      location.textContent=player.wet ? "SHALLOWS" : Valley.roadview.placeName(map.road,seat.x,seat.z,seat.y) || "SANDBAR";
      return 0;
    }
    const forward = Number(keys.has("KeyW"))-Number(keys.has("KeyS"));
    const side = Number(keys.has("KeyD"))-Number(keys.has("KeyA"));
    const norm = Math.hypot(forward,side)||1;
    const pose = posture(), swim = player.swim, wasSwimming = swim.active;
    let surface=terrain.waterLevel(player.x,player.z);
    const low=pose===postures.crouched || pose===postures.prone;
    const clearance=Math.max(pose.height,player.eyeHeight);
    const run = !player.carried && !swim.active && pose === postures.standing && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    const baseSpeed = swim.active ? (swim.diving ? 2.13 : 2.47) : (run ? 5.05 : pose.speed)*(player.wet ? .64 : 1);
    const speed = baseSpeed*(player.carried ? (player.carried.kind==="table" ? .66 : .79) : aim && !refill && !inspection ? .79 : 1);
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const control = swim.active ? 8.1 : player.grounded ? 13.5 : (forward || side) ? 4.7 : 0;
    const damp = 1-Math.exp(-dt*control);
    const along = forward*(swim.diving ? Math.cos(player.pitch) : 1);
    player.vx = mix(player.vx,(sy*along+cy*side)*speed/norm,damp);
    player.vz = mix(player.vz,(-cy*along+sy*side)*speed/norm,damp);
    if(swim.active) {
      const vertical=swim.diving ? -Math.sin(player.pitch)*forward*speed/norm : 0;
      swim.vertical=mix(swim.vertical,vertical,1-Math.exp(-dt*7.6));
      const maxDepth=Math.max(.44,surface+swimEye-player.ground-.34);
      swim.targetDepth=swim.diving ? clamp(swim.targetDepth+swim.vertical*dt,0,maxDepth) : 0;
      if(swim.diving && swim.targetDepth<=.035 && swim.vertical<0) {
        swim.diving=false;
        swim.targetDepth=0;
      }
      swim.depth=mix(swim.depth,swim.targetDepth,1-Math.exp(-dt*7.9));
      player.feet=Math.max(player.ground,surface+floatFeet-swim.depth);
    }
    const oldX = player.x, oldZ = player.z;
    const substeps = Math.max(1,Math.ceil(dt/.018));
    const step = dt/substeps, gravity = 11.45;
    let landed = false, landingSpeed = 0;
    for (let i=0; i<substeps; i++) {
      const x = player.x+player.vx*step, z = player.z+player.vz*step;
      const rise = swim.active ? .33 : player.grounded ? .23 : .028;
      const footLevel = player.feet+(player.grounded ? 0 : Math.max(0,player.vy*step));
      if (x !== player.x) {
        const floor = terrain.walkFloor(map,x,player.z,footLevel,rise,clearance);
        if (floor !== null && camp.canStep(map.tents,player.x,player.z,x,player.z,clearance,low)
          && props.push(map,x,player.z,footLevel,player.vx,0,step)) {
          player.x = x;
          player.ground = floor;
        }
      }
      if (z !== player.z) {
        const floor = terrain.walkFloor(map,player.x,z,footLevel,rise,clearance);
        if (floor !== null && camp.canStep(map.tents,player.x,player.z,player.x,z,clearance,low)
          && props.push(map,player.x,z,footLevel,0,player.vz,step)) {
          player.z = z;
          player.ground = floor;
        }
      }
      surface=terrain.waterLevel(player.x,player.z);
      if (swim.active) {
        if (player.ground < surface+swimExit) {
          const clearanceDepth=Math.max(.38,surface+swimEye-player.ground-.28);
          swim.depth=Math.min(swim.depth,clearanceDepth);
          swim.targetDepth=Math.min(swim.targetDepth,clearanceDepth);
          player.feet=Math.max(player.ground,surface+floatFeet-swim.depth);
          continue;
        }
        swim.active = false;
        swim.diving=false;
        swim.targetDepth=swim.depth=swim.vertical=0;
        player.grounded = true;
        player.feet = player.ground;
      }
      if (player.grounded && player.feet-player.ground > .24) player.grounded = false;
      if (!player.grounded) {
        player.feet += (player.vy-gravity*step*.5)*step;
        player.vy -= gravity*step;
        if (player.vy <= 0 && player.feet <= player.ground) {
          landingSpeed = -player.vy;
          player.grounded = true;
          player.vy = 0;
          landed = true;
        }
      }
      player.feet = player.grounded ? player.ground : Math.max(player.feet,player.ground);
      if (player.ground < surface+swimEntry && player.feet < surface-.58) {
        swim.active = true;
        player.grounded = false;
        player.feet = surface+floatFeet;
        player.vy = 0;
        player.prone=false;
      }
    }
    const movedX=player.x-oldX, movedZ=player.z-oldZ;
    const dist = Math.hypot(movedX,movedZ);
    if(!swim.active && dt>0) {
      const blockedX=player.vx-movedX/dt, blockedZ=player.vz-movedZ/dt;
      if(landed || Math.hypot(blockedX,blockedZ)>.50) {
        hands.impact((cy*blockedX+sy*blockedZ)*dt*3.6,landed ? landingSpeed*.26 : 0,
          (sy*blockedX-cy*blockedZ)*dt*4.2);
      }
    }
    const moving = dist > .002, wet = swim.active || terrain.wetAt(player.x,player.z,player.feet+.04);
    const dx = moving ? movedX/dist : sy;
    const dz = moving ? movedZ/dist : -cy;
    const gaitSpeed=dist/Math.max(.001,dt);
    const runAmount=run && player.grounded && moving
      ? (wet ? smooth(1.49,3.10,gaitSpeed) : smooth(2.44,4.72,gaitSpeed)) : 0;
    const interior=camp.inside(map.tents,player.x,player.z);
    const footing=player.grounded && !wet ? terrain.footing(map,player.x,player.z,player.feet) : null;
    const grass=!interior && footing && (moving || landed) ? terrain.grassContact(map,player.x,player.z) : null;
    const shore=terrain.shore(player.x,player.z);
    const material=footing?.kind==="sand" ? grass?.touch>.13 ? "grass" : shore>5.1 ? "dirt" : "sand" : footing?.kind;
    const stepBank=footing?.stepBank??(material==="grass" && grass.tall<=.13 ? "lawn" : undefined);
    const swimSpeed = swim.active ? clamp(dist/Math.max(.012,dt*2.4),0,1) : 0;
    swim.power = mix(swim.power,swimSpeed,1-Math.exp(-dt*7));
    swim.amount = mix(swim.amount,swim.active ? 1 : 0,1-Math.exp(-dt*8));
    const under = swim.active && swim.depth>swimEye+.036;
    if (wet && moving && !under) {
      wakeDistance += dist;
      if (wakeDistance >= .38) {
        wakeDistance %= .38;
        ripple(player.x-dx*.28,player.z-dz*.28,swim.active ? .47 : .36);
      }
    } else if (!wet) wakeDistance = 0;

    if (swim.active) {
      if (!wasSwimming) {
        swim.phase = 0;
        spray(player.x+dx*.47,player.z+dz*.47,1.07,[dx,dz],false,true);
      }
      const next = swim.phase+dt*mix(2.15,10.1,swim.power);
      if (moving && !under && swim.phase < Math.PI && next >= Math.PI) {
        spray(player.x+dx*.75-dz*.33,player.z+dz*.75+dx*.33,.76+swim.power*.22,[dx,dz],false,true);
      }
      swim.phase = next%(Math.PI*2);
      stepDistance = 0;
    } else if (player.grounded && (moving || landed)) {
      if (wet && (!player.wet || landed)) {
        const strength = landed ? 1.04 : run ? .91 : .74;
        spray(player.x+dx*.54,player.z+dz*.54,strength,[dx,dz]);
        stepDistance = 0;
      }
      if(landed) {
        audio.land(wet ? "water" : material,landingSpeed,stepBank);
        stepDistance=0;
      } else stepDistance+=dist;
      const strideLength=mix(pose.step,1.16,runAmount)*(footing?.stair ? .93 : 1);
      if (stepDistance >= strideLength) {
        stepDistance %= strideLength;
        foot = 1-foot;
        const swing = foot ? .18 : -.18;
        if (wet) spray(player.x+dx*.52+dz*swing,player.z+dz*.52-dx*swing,run ? .77 : .56,[dx,dz]);
        else {
          const stair=footing.stair;
          const alongStair=stair ? stair[0]*dx+stair[1]*dz : 0;
          const direction=Math.abs(alongStair)>.16 ? Math.sign(alongStair) : 0;
          audio.step(material,runAmount>.22,pose.noise,foot ? 1 : -1,direction,stepBank);
        }
      }
    }
    const contact=footing?.kind==="sand" && !footing.stepBank ? smooth(.17,.74,grass?.tall??0) : 0;
    if(moving && contact>0) {
      const brushPace=smooth(.65,4.9,gaitSpeed);
      const stride=mix(.74,.34,contact);
      if((brushDistance===0 || brushDistance>=stride) && sceneTime>=nextBrushAt) {
        const level=mix(.16,.71,contact)*mix(.73,1,brushPace)*(material==="grass" ? .77 : 1);
        const duration=audio.grass(level,brushPace);
        nextBrushAt=sceneTime+Math.max(.17,duration*.92);
        brushDistance=0;
      }
      brushDistance+=dist;
    } else brushDistance=0;
    player.wet = wet;
    const landmark=!wet && Valley.roadview.placeName(map.road,player.x,player.z,player.feet);
    location.textContent = interior ? "TENT" : under ? "UNDERWATER" : swim.active ? "DEEP WATER" : wet ? "SHALLOWS"
      : landmark || (footing?.kind==="wood" ? "DECK" : footing?.kind==="rock" ? "ROCKS" : shore>6.4 ? "FOREST EDGE" : "SANDBAR");
    const stride = player.grounded ? clamp(dist/Math.max(.01,dt*3.4),0,1) : 0;
    pace = mix(pace,stride,1-Math.exp(-dt*9));
    if (player.grounded) phase += dist*(run ? 5.45 : 6.65);
    player.viewBase = player.grounded || swim.active ? mix(player.viewBase,player.feet,1-Math.exp(-dt*11)) : player.feet;
    player.eyeHeight = mix(player.eyeHeight,pose.height,1-Math.exp(-dt*12));
    return forward || side ? runAmount*(wet ? .67 : 1) : 0;
  }

  function takeDamage(amount) {
    player.health=Math.max(0,player.health-amount);
    damageAge=0;
    recoveryStart=nextRecovery=elapsed+recoveryDelay;
    updateHealth();
  }

  function startDeath() {
    death={phase:"struggle",age:0,released:false};
    stage.dataset.life="struggle";
    player.swim.diving=true;
    keys.clear();
    stopSupply();
    handToss=null;
    hands.interrupt();
    stopLauncher();
    caption.textContent="";
    bubbleCloud([player.x,-player.swim.depth,player.z],19);
  }

  function releaseBlastGear(state,aspect) {
    if(state.fatal || player.health>0) return;
    state.fatal=true;
    const cam=currentCamera(aspect);
    if(player.carried) tossFromHand(player.carried,cam,.53,.21);
    if(player.ownsLauncher) tossFromHand(equipped.prop,cam,.48,-.18);
  }

  function blastPlayer(at,distance,aspect) {
    if(death || knockdown?.fatal || distance>=blastRange) return;
    const power=1-smooth(1.35,blastRange,distance);
    if(power<.034) return;
    const angle=rng()*Math.PI*2;
    const away=unit([player.x-at[0]+Math.cos(angle)*.86,0,player.z-at[2]+Math.sin(angle)*.86]);
    const fatal=distance<2.33;
    if(player.seat) player.seat.occupied=false;
    Object.assign(player,{seat:null,exit:null,prone:false,swim:freshSwim(),grounded:false});
    keys.clear();
    stopSupply();
    stopLauncher();
    handToss=doorHold=null;
    hands.interrupt();
    const speed=mix(3.5,10.6,power);
    Object.assign(player,{vx:away[0]*speed,vy:mix(2.25,5.5,power),vz:away[2]*speed});
    knockdown={age:0,landedAt:null,hit:false,fatal:false,height:player.eyeHeight,
      roll:(rng()<.5 ? -1 : 1)*mix(.86,1.52,rng()),turn:mix(-1.66,1.66,rng()),wave:rng()*6.28};
    pace=0;
    takeDamage(fatal ? player.health : Math.round(12+45*power));
    releaseBlastGear(knockdown,aspect);
  }

  function recoverFall(state) {
    return state.fatal || state.landedAt===null ? 0 : smooth(.43,1.47,state.age-state.landedAt);
  }

  function updateFall(dt,aspect) {
    const state=knockdown, stepCount=Math.max(1,Math.ceil(dt/.014)), step=dt/stepCount;
    state.age+=dt;
    function contact(speed) {
      if(state.hit || speed<2.4) return;
      state.hit=true;
      audio.objectLand("desk",terrain.surfaceKind(map,player.x,player.z,player.feet),clamp(speed*.14,.28,1.17));
      if(!state.fatal) {
        takeDamage(Math.round(clamp(speed*1.45,3,13)));
        releaseBlastGear(state,aspect);
      }
    }
    for(let i=0;i<stepCount && state.landedAt===null;i++) {
      const up=Math.max(0,player.vy*step);
      for(const axis of [0,2]) {
        const velocity=axis===0 ? "vx" : "vz", coord=axis===0 ? "x" : "z", speed=player[velocity];
        if(Math.abs(speed)<.025) continue;
        const from=[player.x,player.feet+.41,player.z], to=from.slice();
        to[axis]+=speed*step;
        const floor=terrain.walkFloor(map,to[0],to[2],player.feet+up,.115,.60);
        if(floor===null || props.trace(map,from,to)) {
          player[velocity]*=-.22;
          contact(Math.abs(speed));
        } else player[coord]=to[axis];
      }
      const next=player.feet+(player.vy-5.73*step)*step;
      player.vy-=11.46*step;
      const floor=terrain.solidHeight(map,player.x,player.z,undefined,Math.max(player.feet,next)+.062);
      player.ground=floor;
      if(player.vy<=0 && next<=floor) {
        contact(Math.abs(player.vy));
        Object.assign(player,{feet:floor,vx:0,vy:0,vz:0,grounded:true});
        state.landedAt=state.age;
      } else player.feet=next;
    }
    const recovery=recoverFall(state);
    const lower=state.landedAt===null ? mix(state.height,.48,smooth(0,.38,state.age)) : .34;
    player.viewBase=player.feet;
    player.eyeHeight=mix(lower,postures.standing.height,recovery);
    if(state.landedAt===null) return;
    if(state.fatal && state.age-state.landedAt>1.13) {
      knockdown=null;
      startRewind();
    } else if(recovery===1) {
      knockdown=null;
    }
  }

  function scatterBlast(site,collapsed) {
    const sideways=[-site.normal[2],0,site.normal[0]];
    function fragment(pos,velocity,life,size,piece) {
      const floor=Math.max(terrain.height(pos[0],pos[2]),Valley.roadview.floor(map.road,pos[0],pos[2],pos[1]+.02).top);
      particles.push({pos,velocity,life,total:life,size,kind:"fragment",floor,
        mesh:site.debris[piece],impactMaterial:piece<3 ? "masonry" : piece<5 ? "metal" : "wood",
        angles:[rng()*6.28,rng()*6.28,rng()*6.28],
        spin:[mix(-13,13,rng()),mix(-16,16,rng()),mix(-16,16,rng())]});
    }
    for(let i=0;i<105;i++) {
      const wall=i%3!==0, turn=rng()*Math.PI*2;
      const pos=plus(plus(wall ? site.breach : site.at,times(sideways,(rng()-.5)*(wall ? site.span*.91 : .91))),
        [(rng()-.5)*.33,mix(-.76,1.20,rng()),(rng()-.5)*.32]);
      const radial=[Math.cos(turn),mix(.24,1.0,rng()),Math.sin(turn)];
      const heading=unit(plus(radial,times(site.normal,wall ? (i%2 ? -.57 : .71) : .2)));
      fragment(pos,times(heading,mix(3.8,13.0,rng())),mix(2.6,6.1,rng()),
        mix(.087,.38,rng())*(i%7===0 ? 1.50 : 1),wall ? i%3 : 3+i%2);
    }
    for(const {at,kind} of collapsed) {
      const metal=kind==="metal", count=kind==="stairs" ? 10 : 6;
      const away=unit([at[0]-site.at[0],0,at[2]-site.at[2]]);
      for(let i=0;i<count;i++) {
        const pos=plus(at,[mix(-.53,.53,rng()),mix(-.18,.61,rng()),mix(-.61,.61,rng())]);
        const velocity=plus(times(away,mix(.7,2.6,rng())),[mix(-1.25,1.25,rng()),mix(-1.5,2.95,rng()),mix(-1.5,1.5,rng())]);
        fragment(pos,velocity,mix(6.5,11.2,rng()),mix(.26,metal ? .64 : 1.00,rng()),(metal ? 3 : 5)+i%2);
      }
    }
    for(let i=0;i<81;i++) {
      const turn=rng()*Math.PI*2, life=mix(.27,.93,rng());
      const direction=unit([Math.cos(turn),mix(-.09,.91,rng()),Math.sin(turn)]);
      particles.push({pos:plus(site.at,[(rng()-.5)*.28,(rng()-.5)*.48,(rng()-.5)*.40]),
        velocity:times(direction,mix(3.1,16.6,rng())),life,total:life,size:mix(.023,.082,rng()),
        color:[1,.61,.20],alpha:mix(.54,.96,rng()),kind:"spark",streak:true});
    }
  }

  function detonate(site,aspect) {
    if(site.destroyed) return;
    const collapsed=utilities.disable(site,sceneTime,blastRange);
    site.pending=false;
    bursts.push(utilities.burst(site.at,sceneTime));
    const offset=minus(site.at,[player.x,player.feet+player.eyeHeight*.47,player.z]);
    const distance=Math.hypot(...offset);
    const pan=(offset[0]*Math.cos(player.yaw)+offset[2]*Math.sin(player.yaw))/Math.max(2,distance);
    audio.blast(distance,pan);
    blastPlayer(site.at,distance,aspect);
    props.blast(map,site.at,blastRange);
    const interior=map.road.interior, shattered={};
    let shardBudget=480;
    for(const item of interior.items) {
      if(item.broken || (item.kind!=="glass" && item.kind!=="ceramic")) continue;
      const offset=minus(item.at,site.at), range=Math.hypot(...offset);
      const reach=blastRange*(item.kind==="glass" ? .76 : .44);
      if(range>reach && !item.door?.broken) continue;
      lodging.shatter(interior,item,sceneTime);
      const count=Math.min(28,shardBudget);
      if(count) {
        brittleDebris({type:item.kind,at:item.at,normal:unit(offset),fixture:item,blast:true},mix(1.43,.63,clamp(range/reach,0,1)),true,count);
        shardBudget-=count;
      }
      if(!shattered[item.kind] || range<shattered[item.kind].range) shattered[item.kind]={at:item.at,range};
    }
    for(const [kind,broken] of Object.entries(shattered)) playFragileImpact(kind,broken.at,.89,true,kind==="glass");
    fire.ignite(map,site,sceneTime,fires);
    scatterBlast(site,collapsed);
  }

  function updateVitals(dt,aspect) {
    damageAge=Math.min(1,damageAge+dt);
    const cam=currentCamera(aspect);
    const depth=terrain.waterLevel(cam.at[0],cam.at[2])-cam.at[1];
    const below=player.swim.active && depth>.036;
    audio.submerged(depth,dt);
    if(below) {
      player.breath=Math.max(0,player.breath-dt);
      bubbleAt-=dt;
      if(bubbleAt<=0) {
        const mouth=plus(cam.at,[cam.forward[0]*.46,-.19,cam.forward[2]*.46]);
        bubbleCloud(mouth,player.breath<4 ? 11 : 5);
        audio.bubbles(player.breath<4 ? .58 : .33);
        bubbleAt=player.breath<4 ? .82 : 2.4;
      }
      if(player.breath===0) {
        breathTick+=dt;
        if(breathTick>=.93) {
          breathTick-=.93;
          takeDamage(12);
          audio.gasp(true);
          if(player.health===0) startDeath();
        }
      }
    } else {
      if(submerged && player.breath<maxBreath-3) audio.gasp(false);
      player.breath=Math.min(maxBreath,player.breath+dt*6.5);
      breathTick=0;
      bubbleAt=.15;
    }
    if(player.health>0 && player.health<maxHealth && elapsed>=nextRecovery && (!below || player.breath>0)) {
      const faster=smooth(5,10,nextRecovery-recoveryStart);
      player.health++;
      nextRecovery+=mix(.9,.2,faster);
      updateHealth();
    }
    submerged=below;
    updateBreathMeter(below);
    damageTint.style.opacity=String(.53*(1-smooth(.035,.44,damageAge)));
  }

  function respawn() {
    const floor=terrain.solidHeight(map,spawn.x,spawn.z);
    for(const gear of launchers) {
      Object.assign(gear.prop,{picked:true,flight:null,support:null,vx:0,vz:0,spin:0});
    }
    Object.assign(player,{...spawn,feet:floor,ground:floor,viewBase:floor,eyeHeight:postures.standing.height,
      vx:0,vy:0,vz:0,grounded:true,wet:false,prone:false,swim:freshSwim(),health:maxHealth,breath:maxBreath,
      seat:null,exit:null,carried:null,ownsLauncher:true,holstered:false});
    death=null;
    knockdown=null;
    practiceRound=null;
    practiceHud.hidden=true;
    practiceHint.textContent="TARGET RANGE";
    delete stage.dataset.life;
    keys.clear();
    pace=phase=stepDistance=wakeDistance=brushDistance=nextBrushAt=0;
    aimAmount=swayX=swayY=breathTick=bubbleAt=0;
    stowAmount=0;
    damageAge=kickAge=1;
    recoveryStart=nextRecovery=Infinity;
    submerged=false;
    damageTint.style.opacity="0";
    audio.submerged(0);
    audio.movementSound?.reset();
    hands.reset();
    updateHealth();
    updateBreathMeter(false);
  }

  function updateDeath(dt,aspect) {
    death.age+=dt;
    if(death.phase==="rewind") {
      if(death.age>=1.72) respawn();
      return;
    }
    const t=death.age, swim=player.swim;
    swim.phase+=dt*(8.2+2.9*Math.sin(t*12.2));
    swim.power=1;
    swim.depth=Math.min(terrain.waterLevel(player.x,player.z)+swimEye-player.ground-.18,swim.depth+dt*(.31+.18*Math.sin(t*7.13)));
    const cam=currentCamera(aspect);
    audio.submerged(terrain.waterLevel(cam.at[0],cam.at[2])-cam.at[1],dt);
    damageTint.style.opacity=String((.19+.17*Math.max(0,Math.sin(t*5.7)))*(1-smooth(2.15,3.05,t)));
    if(!death.released && t>=.62) {
      if(player.carried) tossFromHand(player.carried,cam,.23,.17);
      if(player.ownsLauncher) tossFromHand(equipped.prop,cam,.19,-.21);
      death.released=true;
      audio.gasp(true);
      bubbleCloud(plus(cam.at,[cam.forward[0]*.39,-.16,cam.forward[2]*.39]),22);
    }
    if(t>=3.1) startRewind();
  }

  function startRewind() {
    death={phase:"rewind",age:0,released:true};
    stage.dataset.life="rewind";
    damageTint.style.opacity="0";
    audio.submerged(0);
    audio.rewind();
  }

  function recoil() {
    if (kickAge >= .62) return {slide:0,lift:0,twist:0};
    const punch = Math.exp(-kickAge*18);
    const bounce = Math.sin(kickAge*47)*Math.exp(-kickAge*9.5);
    const chatter = Math.sin(kickAge*103)*Math.exp(-kickAge*23);
    const strength=equipped.kick;
    return {
      slide:(punch+.28*bounce)*strength,
      lift:(punch+.68*bounce+.17*chatter)*strength,
      twist:kickSide*(.81*punch+.49*bounce+.18*chatter)*strength
    };
  }

  function currentCamera(aspect) {
    const { slide,lift,twist } = recoil();
    const swim = player.swim;
    const bob = Math.sin(phase)*pace*posture().bob*(player.wet ? .49 : 1)*(1-aimAmount*.55);
    const waterBob = Math.sin(swim.phase+.42)*mix(.016,.052,swim.power)+.008*Math.sin(sceneTime*3.5);
    const surface=terrain.waterLevel(player.x,player.z);
    const floatY = mix(player.viewBase+player.eyeHeight+bob,surface+swimEye+waterBob-swim.depth,swim.amount);
    const sway = Math.sin(swim.phase)*swim.amount*swim.power;
    const eye = (swim.active ? floatY : Math.max(surface+.17,floatY))+.018*slide;
    const drift = death?.phase==="struggle" ? death.age : 0;
    const lurch = smooth(0,.58,drift)*(1-.48*smooth(1.63,2.71,drift));
    let turn=0, dip=0, roll=0;
    if(knockdown) {
      const {age,landedAt,wave}=knockdown, fall=1-recoverFall(knockdown);
      const fling=smooth(0,.30,age)*fall;
      const wobble=fling*(landedAt===null ? 1 : 1-smooth(0,.49,age-landedAt));
      turn=knockdown.turn*fling+.29*Math.sin(age*10.4+wave)*wobble;
      dip=fling*(landedAt===null ? -.11 : -.26)+.34*Math.sin(age*12.1+wave)*wobble;
      roll=knockdown.roll*fling+.52*Math.sin(age*14.5+wave)*wobble;
    }
    return camera([player.x+Math.sin(drift*4.9)*lurch*.14,eye,player.z+Math.cos(drift*4.3)*lurch*.13],
      player.yaw+.037*twist+.019*sway+lurch*(.59*Math.sin(drift*4.1)+.16*Math.sin(drift*11.9))+turn,
      clamp(player.pitch+.071*lift+.021*sway+lurch*(.48*Math.sin(drift*5.7)+.25)+dip,-1.47,1.42),
      mix(56,45,aimAmount),aspect,lurch*(.63*Math.sin(drift*5.0)+.18*Math.sin(drift*11.7))+roll);
  }

  function currentPose() {
    const aspect = canvas.width/Math.max(1,canvas.height);
    const pose=equipped.model.pose(aimAmount,Math.cos(phase*.50)*pace,swayX,swayY,recoil(),refill,sceneTime,player.swim,aspect,motor?.switching,inspection);
    const swing=throwSwing(), struggle=death?.phase==="struggle" ? .14*Math.sin(death.age*17.1) : 0;
    return multiply(transform([.11*stowAmount+.17*swing,-.79*stowAmount+.14*swing,.15*stowAmount-.23*swing],
      -.23*stowAmount-.44*swing,struggle,swing*.21+struggle),pose);
  }

  function updateReticle() {
    reticle.hidden = !playing || aim || aimAmount>.12 || Boolean(supply || death || knockdown || refill || inspection || handToss || pendingDraw)
      || !player.ownsLauncher || player.holstered || stowAmount>.34;
  }

  function traceFlight(from,to) {
    const ground=terrain.traceShot(map,from,to,from[1]>=terrain.waterLevel(from[0],from[2])-.015);
    const hit=props.trace(map,from,to,ground?.fraction??1) || ground;
    if(practiceRound && practice.inScene(from[0],from[2])) {
      return practice.trace(map.road.practice,from,to,hit?.fraction??1,sceneTime) || hit;
    }
    return hit;
  }

  function spawnMinicar({index,pos,velocity,drag=pistolGear.drag,source="player",scale=1.47}) {
    const heading=unit(velocity);
    const shot={index,pos:pos.slice(),velocity:velocity.slice(),speed:Math.hypot(...velocity),drag,source,scale,
      state:"flight",age:0,distance:0,yaw:Math.atan2(-heading[0],-heading[2]),pitch:Math.asin(heading[1]),
      roll:0,trail:[],spin:null};
    shots.push(shot);
    if(shots.length>50) shots.shift();
    return shot;
  }

  // Opponent shots share the flight simulation and can trigger a listener flyby.
  Valley.spawnMinicar=spawnMinicar;

  function launch(cam, pose, timeAfterRelease) {
    const car = mounted.cars.shift();
    const index = equipped===spiralGear ? car.index : car;
    const {model,speed,drag,reach}=equipped;
    const worldPose=multiply(cam.toWorld,pose);
    const pos=point(worldPose,model.muzzle);
    let heading,obstruction;
    if(model.railStart) {
      const start=point(worldPose,model.railStart);
      heading=unit(minus(pos,start));
      obstruction=traceFlight(cam.at,start) || traceFlight(start,pos);
    } else {
      const sightEnd=plus(cam.at,times(cam.forward,reach));
      const sightHit=traceFlight(cam.at,sightEnd);
      const sightDepth=(sightHit?.fraction??1)*reach;
      const muzzleDepth=dot(minus(pos,cam.at),cam.forward);
      const closeHit=sightDepth<=muzzleDepth+.10 ? sightHit : null;
      const focus=closeHit ? sightEnd : plus(cam.at,times(cam.forward,sightDepth));
      heading=unit(minus(focus,pos));
      obstruction=traceFlight(cam.at,pos) || closeHit;
    }
    const shot=spawnMinicar({index,pos,velocity:times(heading,speed),drag,scale:model.carScale});
    const side=(rng()<.5 ? -1 : 1)*mix(.75,1,rng());
    if(model.railStart) {
      shot.releasedAt=sceneTime-timeAfterRelease;
      // Keep the track and its outgoing car on the same pose for the exit frame.
      nextRailKick=side;
    } else {
      kickAge=0;
      kickSide=side;
    }
    inventory();
    if(equipped===spiralGear) audio.spiralRelease();
    else audio.release(equipped===rifleGear);
    if (obstruction) hitShot(shot,obstruction);
    if (!mounted.cars.length) emptyCaption();
  }

  function dropPart(cam, view, throwVector, magazine = null, spiralPart = false) {
    const pivot=spiralPart && magazine ? -spiral.tubeLength*.5 : 0;
    const worldPose=multiply(cam.toWorld,view);
    const base=pivot ? multiply(worldPose,transform([0,pivot,0])) : worldPose;
    const pos = [base[12],base[13],base[14]];
    const velocity = direction(cam.toWorld,throwVector);
    discarded.push({base,pos,velocity,age:0,magazine,spiralPart,pivot,yaw:Math.atan2(base[8],base[10])});
    if (discarded.length > 8) discarded.shift();
  }

  function updateReload(dt, aspect) {
    const {timing,stashing,uncap,outgoing,incoming} = refill;
    const prev = refill.time;
    refill.time = Math.min(timing.end,prev+dt);
    const crossed = mark => prev < mark && refill.time >= mark;
    if (crossed(timing.grab)) audio.reload("release");
    if (crossed(timing.lifted)) inventory();
    if (stashing && crossed(timing.stow-.12)) audio.reload("stash");
    if (!stashing && !outgoing.missing && crossed(timing.toss)) {
      const view = launcher.removalPose(currentPose(),timing.toss);
      dropPart(currentCamera(aspect),view,[-2.48,.69,-.23],outgoing);
      mounted=equipped.loaded={...outgoing,missing:true};
      audio.reload("throw");
    }
    if (crossed(timing.pocket)) audio.reload("pocket");
    if (uncap && crossed(timing.capDrop)) {
      const view = launcher.capPose(currentPose(),timing.capDrop);
      dropPart(currentCamera(aspect),view,[-.61,.13,-.08]);
      incoming.sealed=false;
      audio.reload("cap");
    }
    if (crossed(timing.insert)) audio.reload("slide");
    if (crossed(timing.seat)) {
      pocket.shift();
      if (stashing) pocket.push(outgoing);
      mounted = equipped.loaded = incoming;
      mounted.sealed = false;
      inventory();
      audio.reload("seat");
    }
    if (refill.time >= timing.end) {
      refill = null;
      stage.dataset.aim = String(aim);
      if (triggerHeld) beginCycle();
    }
  }

  function updateSpiralReload(dt,aspect) {
    const timing=spiral.reload, {time:before,outgoing,incoming,uncap,gesture,stashing}=refill;
    refill.time=Math.min(timing.end,before+dt);
    const crossed=mark=>before<mark && refill.time>=mark;
    if(gesture && crossed(timing.button)) audio.spiralLatch(gesture);
    if(!outgoing.missing && crossed(stashing ? timing.stow : timing.toss)) {
      if(stashing) spiralGear.spares.push(outgoing);
      else {
        const view=spiral.removalPose(currentPose(),timing.toss);
        dropPart(currentCamera(aspect),view,[-1.80,.37,-.71],outgoing,true);
      }
      mounted=equipped.loaded={cars:[],steps:0,missing:true};
      inventory();
      audio.reload(stashing ? "stash" : "throw");
    }
    if(crossed(timing.pocket)) audio.reload("pocket");
    if(uncap && crossed(timing.capDrop)) {
      const view=spiral.capPose(currentPose(),timing.capDrop);
      dropPart(currentCamera(aspect),view,[-.91,.34,-.20],null,true);
      incoming.sealed=false;
      audio.reload("cap");
    }
    if(crossed(timing.insert)) audio.reload("slide");
    if(crossed(timing.seat)) {
      spiralGear.spares.shift();
      mounted=equipped.loaded=incoming;
      incoming.sealed=false;
      inventory();
      audio.reload("seat");
    }
    if(crossed(timing.tap)) audio.magazineTap();
    if(refill.time>=timing.end) refill=null;
  }

  function closeRifleReload(aimAfter) {
    triggerHeld=false;
    if(refill.phase==="close") {
      refill.aimAfter=aimAfter;
      return;
    }
    const from=rifle.service(refill);
    const timing=rifle.reload;
    const stash=from.batch && from.next<from.batch.length ? timing.stashEnd : 0;
    const end=from.door>0 ? stash+timing.closeEnd : timing.cancelEnd;
    refill={phase:"close",time:0,end,from,stash,aimAfter};
    syncMotor();
  }

  function gatherRifleCars(hand) {
    const count=Math.min(rifle.batchSize,rifle.carCount-mounted.cars.length,rifleGear.reserve);
    const batch=Array.from({length:count},(_,i)=>rifle.carOrder[(rifleGear.nextCar+i)%rifle.carCount]);
    Object.assign(refill,{phase:"gather",time:0,end:rifle.reload.gatherEnd,hand,batch,next:0});
  }

  function insertRifleCar() {
    const slot=mounted.cars.length;
    Object.assign(refill,{phase:"insert",time:0,end:rifle.reload.insertEnd,slot,beltLoading:refill.startedEmpty && slot<2});
  }

  function updateRifleReload(dt) {
    const timing=rifle.reload;
    while(refill && dt>0) {
      const change=refill, before=change.time;
      change.time=Math.min(change.end,before+dt);
      dt-=change.time-before;
      const finished=change.time===change.end;
      const crossed=at=>before<at && change.time>=at;
      if(change.phase==="open") {
        if(crossed(timing.slideStart)) audio.reload("slide",true);
        if(crossed(timing.slideEnd)) audio.reload("release",true);
        if(finished) gatherRifleCars(rifle.service(change).hand);
      } else if(change.phase==="gather") {
        if(crossed(timing.pickup)) audio.reload("pocket",true);
        if(finished) insertRifleCar();
      } else if(change.phase==="insert") {
        if(crossed(timing.push)) audio.reload("slide",true);
        if(change.beltLoading) mounted.belt+=rifle.loadingTravel(change,change.time)-rifle.loadingTravel(change,before);
        if(crossed(timing.seat)) {
          mounted.cars.push(change.batch[change.next++]);
          rifleGear.reserve--;
          rifleGear.nextCar=(rifleGear.nextCar+1)%rifle.carCount;
          audio.reload("seat",true);
          inventory();
        }
        if(finished) {
          if(change.next<change.batch.length) insertRifleCar();
          else if(mounted.cars.length<rifle.carCount && rifleGear.reserve) gatherRifleCars(rifle.service(change).hand);
          else closeRifleReload(false);
        }
      } else {
        if(change.from.door>0) {
          if(crossed(change.stash+timing.closeStart)) audio.reload("slide",true);
          if(crossed(change.stash+timing.latch)) audio.reload("latch",true);
        }
        if(finished) {
          aim=change.aimAfter;
          refill=null;
          stage.dataset.aim=String(aim);
        }
      }
      if(!finished) return;
    }
  }

  function updateDiscarded(dt) {
    for (const part of discarded) {
      if (!part.velocity) continue;
      part.age += dt;
      part.velocity[1] -= 7.8*dt;
      const next = plus(part.pos,times(part.velocity,dt));
      const floor = terrain.solidHeight(map,next[0],next[2],undefined,part.pos[1]+.04);
      const surface=terrain.waterLevel(next[0],next[2]);
      const base = floor+(part.magazine ? (part.spiralPart ? spiral.magazineWidth*.5 : .046) : part.spiralPart ? .011 : .008);
      if (floor < surface-.022 && part.pos[1] > surface && next[1] <= surface) {
        spray(next[0],next[2],part.magazine ? .50 : .30,[part.velocity[0]*.3,part.velocity[2]*.3]);
        part.velocity = times(part.velocity,.27);
      }
      if (next[1] <= base) {
        next[1] = base;
        part.velocity = null;
        part.removeAt=sceneTime+loosePartLife;
        if (floor >= surface-.022) audio.reload("land");
      }
      part.pos = next;
    }
    for(let i=discarded.length-1;i>=0;i--) if(sceneTime>=discarded[i].removeAt) discarded.splice(i,1);
  }

  function discardedPose(part) {
    let matrix;
    if(!part.velocity) {
      const pitch=part.spiralPart ? 0 : part.magazine ? 0 : Math.PI*.5;
      const roll=part.spiralPart && part.magazine ? Math.PI*.5 : .02;
      matrix=transform(part.pos,pitch,part.yaw+part.age*2.9,roll);
    } else {
      const rate=part.magazine ? 1 : 1.7;
      matrix=multiply(part.base,transform([0,0,0],part.age*5.7*rate,part.age*3.5,-part.age*6.2*rate));
      matrix.set(part.pos,12);
    }
    return part.pivot ? multiply(matrix,transform([0,-part.pivot,0])) : matrix;
  }

  function finishCycle(aspect,timeAfterRelease=0) {
    const {powered,feedsCar,start,end,single}=cycle;
    cycle=null;
    const spiralMode=equipped===spiralGear;
    if(spiralMode) {
      if(!mounted.missing) mounted.steps=Math.min(spiral.carCount,mounted.steps+1);
    } else {
      mounted.belt+=(end-start)*equipped.model.slot;
      if(motor) mounted.feed=end<1 ? end : 0;
    }
    if(feedsCar) launch(currentCamera(aspect),currentPose(),timeAfterRelease);
    else if(end<1) audio.beltStall();
    else if(spiralMode && mounted.cars.length) inventory();
    const action=queued;
    queued=null;
    const nextSingle=action==="fire" || (spiralMode && single && !feedsCar && mounted.cars.length>0);
    if(action==="reload") beginReload();
    else if(triggerHeld || nextSingle) {
      beginCycle(powered || triggerHeld,nextSingle);
    }
  }

  function updateSpiralFeed(dt,aspect) {
    while(cycle && dt>0) {
      const wind=Math.min(dt,cycle.wind);
      cycle.wind-=wind;
      dt-=wind;
      const remaining=(1-cycle.progress)*equipped.feedDuration;
      if(dt+1e-8<remaining) {
        cycle.progress+=dt/equipped.feedDuration;
        return;
      }
      dt-=remaining;
      finishCycle(aspect,Math.max(0,dt));
    }
  }

  function mechanism(dt, aspect) {
    if(dt>0 && nextRailKick!==null) {
      kickAge=0;
      kickSide=nextRailKick;
      nextRailKick=null;
    } else kickAge=Math.min(.7,kickAge+dt);
    stowAmount=mix(stowAmount,Number(player.holstered || Boolean(pendingDraw)),1-Math.exp(-dt*(pendingDraw ? 19 : 12)));
    if(pendingDraw && stowAmount>=.94) drawLauncher(pendingDraw);
    aimAmount = mix(aimAmount,aim && !refill && !inspection ? 1 : 0,1-Math.exp(-dt*15));
    swayX *= Math.exp(-dt*9);
    swayY *= Math.exp(-dt*9);
    updatePowerSwitch(dt);
    if (inspection) {
      const {time}=inspection, timing=equipped.model.inspection;
      inspection.time+=dt;
      const crossed=at=>time<at && inspection.time>=at;
      if(equipped===rifleGear) {
        if(crossed(timing.open) || crossed(timing.shut)) audio.reload("slide",true);
        if(crossed(timing.latched)) audio.reload("latch",true);
      } else if(equipped===spiralGear) {
        if(crossed(timing.release)) audio.spiralLatch("index");
        if(crossed(timing.clear) || crossed(timing.align)) audio.reload("slide");
        if(crossed(timing.motorStart) || crossed(timing.motorStop)) audio.switchClick();
        if(crossed(timing.seat)) audio.reload("seat");
      } else if(motor) {
        if(crossed(timing.pull)) audio.reload("release");
        if(crossed(timing.press)) audio.switchClick();
        if(crossed(timing.align)) audio.reload("slide");
        if(crossed(timing.seat)) audio.reload("seat");
      }
      if(inspection.time>=timing.end) {
        inspection=null;
        stage.dataset.aim=String(aim);
      }
    } else if (refill) {
      if(equipped===rifleGear) updateRifleReload(dt);
      else if(equipped===spiralGear) updateSpiralReload(dt,aspect);
      else updateReload(dt,aspect);
    } else if(cycle && equipped===spiralGear) {
      updateSpiralFeed(dt,aspect);
    } else if (cycle) {
      const travel = Math.max(0,dt-cycle.wind);
      cycle.wind = Math.max(0,cycle.wind-dt);
      const remaining=cycle.end-cycle.progress, step=travel/equipped.feedDuration;
      cycle.progress+=Math.sign(remaining)*Math.min(Math.abs(remaining),step);
      if(Math.abs(remaining)<=step) finishCycle(aspect);
    } else if(queued==="reload" && !motor?.switching) {
      queued=null;
      beginReload();
    } else if(triggerHeld && !queued) {
      beginCycle();
    }
    const press=!refill && !inspection && (triggerHeld || cycle);
    motorPress=clamp(motorPress+dt*(press ? 17 : -12),0,1);
    syncMotor(dt);
  }

  function playRicochet(at,strength,skim,speed,bent=false) {
    const dx=at[0]-player.x, dz=at[2]-player.z;
    const distance=Math.hypot(dx,at[1]-player.viewBase-player.eyeHeight,dz);
    const pan=(dx*Math.cos(player.yaw)+dz*Math.sin(player.yaw))/Math.max(2,distance);
    audio.ricochet(strength,skim,speed,distance,pan,bent);
  }

  function vehicleImpact({at,normal,fixture},velocity,speed,strength,incidence) {
    const result=Valley.vehicles.impact(fixture,at,normal,speed,strength,incidence,sceneTime);
    if(result.material==="glass") {
      playFragileImpact("glass",at,strength,result.broken,result.pane);
      brittleDebris({type:"glass",at,normal},strength,result.broken,result.pane ? 33 : 14,result.pane ? .88 : .49);
    } else if(result.material==="metal" && speed>2.2) {
      sparks(at,normal,velocity,strength*.58);
      playRicochet(at,strength,1-incidence,speed,result.bent);
    } else audio.propImpact(result,strength);
    return result;
  }

  function hitShot(shot,hit) {
    const {type,at,normal}=hit;
    const speed = Math.hypot(...shot.velocity);
    const approach = dot(shot.velocity,normal);
    const incidence = clamp(-approach/Math.max(speed,.001),0,1);
    const skim = 1-incidence;
    const near = Math.exp(-shot.distance*.17);
    const strength = mix(.49,1.64,near)*mix(.63,1,clamp(speed/shot.speed,0,1))*mix(.83,1.11,incidence);
    shot.trail.length = 0;

    if(type==="practice") {
      hit.target.hitAt=sceneTime;
      practiceRound.hits++;
      const complete=practiceRound.hits===map.road.practice.targets.length;
      if(complete) {
        practiceRound.finished=elapsed;
      }
      audio.target(practiceRound.hits,complete);
      updatePracticeHud();
      shot.pos=plus(at,times(normal,.045));
      shot.velocity=times(minus(shot.velocity,times(normal,2*Math.min(0,approach))),.30);
      shot.spin=[4.1,-3.4,2.9];
      return;
    }

    if(type==="tank") {
      const tank=hit.fixture, site=tank.service;
      shot.tanks??=new Set();
      if(!shot.tanks.has(tank)) {
        shot.tanks.add(tank);
        if(++tank.hits===4 && !site.pending) {
          site.pending=true;
          blastQueue.push(site);
        }
      }
      sparks(at,normal,shot.velocity,strength*.78);
      playRicochet(at,strength,skim,speed);
      shot.pos=plus(at,times(normal,.052));
      shot.velocity=times(minus(shot.velocity,times(normal,2*Math.min(0,approach))),.52);
      shot.spin=[5.1,-4.8,6.9];
      return;
    }

    if(type==="glass" || type==="ceramic") {
      const broken=lodging.impact(map.road.interior,hit.fixture,speed,strength,incidence,sceneTime);
      playFragileImpact(type,at,strength,broken,type==="glass");
      brittleDebris(hit,strength,broken);
      if(broken) {
        shot.pos=plus(at,times(unit(shot.velocity),.050));
        shot.velocity=times(shot.velocity,type==="glass" ? .77 : .39);
      } else {
        shot.pos=plus(at,times(normal,.039));
        const reflected=minus(shot.velocity,times(normal,2*Math.min(0,approach)));
        shot.velocity=times(plus(reflected,times(normal,Math.max(0,.7-dot(reflected,normal)))),.38);
      }
      shot.spin=[3.9,-5.4,4.8];
      return;
    }

    if(type==="vehicle") {
      const result=vehicleImpact(hit,shot.velocity,speed,strength,incidence);
      if(result.broken) {
        shot.pos=plus(at,times(unit(shot.velocity),.031));
        shot.velocity=times(shot.velocity,.73);
      } else {
        shot.pos=plus(at,times(normal,.035));
        shot.velocity=times(minus(shot.velocity,times(normal,2*Math.min(0,approach))),result.material==="vinyl" ? .23 : .42);
      }
      shot.spin=[4.3,-5.1,5.0];
      return;
    }

    if(type==="prop") {
      const result=props.strike(map,hit,shot.velocity,shot.distance,strength);
      if(result.fragile) {
        playFragileImpact(result.material,at,strength,result.broken);
        brittleDebris({type:result.material,at,normal},strength,result.broken,15,.54);
      } else if(result.metal && speed>2.2) playRicochet(at,strength,skim,speed,result.bent);
      else audio.propImpact(result,strength);
      if(result.sparks) sparks(at,normal,shot.velocity,strength*result.sparks);
      if(result.torn || result.puncture || (result.fragile && result.broken)) {
        shot.pos=plus(at,times(unit(shot.velocity),.056));
        shot.velocity=times(shot.velocity,result.fragile ? .67 : result.torn ? .47 : .39);
      } else {
        shot.pos=plus(at,times(normal,.039));
        if(speed<2.2 && normal[1]>.51) {
          shot.state="rest";
          shot.restOn={prop:hit.prop,piece:hit.piece,at:hit.local,offset:times(hit.localNormal,.039)};
          shot.pitch=shot.roll=0;
          return;
        }
        const reflected=minus(shot.velocity,times(normal,2*Math.min(0,approach)));
        const retained={
          cloth:.21,
          vinyl:.43,
          paper:.27,
          wood:.50,
          glass:.48,
          ceramic:.51,
          plastic:mix(.52,.71,skim),
          frame:mix(.58,.79,skim)
        }[result.material];
        shot.velocity=times(plus(reflected,times(normal,Math.max(0,.9-dot(reflected,normal)))),retained);
      }
      shot.spin=[4.9,6.2,-4.4];
      return;
    }

    if (type === "rock" || type === "wood" || type === "metal") {
      const wooden=type==="wood";
      if(wooden) {
        const power=speed>3.3 ? (1-smooth(.72,woodChipRange,shot.distance))*clamp(speed/shot.speed,.32,1) : 0;
        if(power>0) splinters(at,normal,shot.velocity,power);
        audio.woodImpact(strength,power>0);
      } else {
        const {heat,glancing}=sparks(at,normal,shot.velocity,strength);
        if(type==="metal") playRicochet(at,strength,skim,speed);
        else audio.rock(heat,glancing);
      }
      if (speed < 2.15 && normal[1] > .56) {
        shot.pos = plus(at,times(normal,.012));
        shot.state = "rest";
        shot.pitch = -.08;
        shot.roll = .11;
        return;
      }
      const reflected = minus(shot.velocity,times(normal,2*Math.min(0,approach)));
      const scatter = (wooden ? 1.56 : 1.15)*mix(.48,1,incidence);
      const rough = reflected.map(v=>v+(rng()-.5)*speed*scatter);
      const outward = plus(rough,times(normal,Math.max(0,speed*(wooden ? .19 : .24)-dot(rough,normal))));
      const retained = (wooden ? mix(.55,.74,skim) : mix(.62,.84,skim))*mix(.92,1.06,rng());
      shot.velocity = times(unit(outward),speed*retained);
      shot.pos = plus(at,times(normal,.042));
      const spin = () => (rng()<.5 ? -1 : 1)*mix(3.2,wooden ? 13.1 : 9.6,rng());
      shot.spin = [spin(),spin(),spin()];
      return;
    }

    const [x,y,z] = at;
    shot.age = 0;
    if (type === "water") {
      shot.pos = [x,y-.003,z];
      shot.state = "sink";
      shot.velocity = times(shot.velocity,.105);
      spray(x,z,strength,[shot.velocity[0],shot.velocity[2]],true);
    } else {
      shot.pos = [x,y+.003-.010*strength,z];
      shot.yaw = Math.atan2(-shot.velocity[0],-shot.velocity[2]);
      shot.pitch = -.24-.17*strength-rng()*.12;
      shot.roll = (rng()-.5)*.29;
      shot.state = "rest";
      if(terrain.wetAt(x,z,y)) {
        audio.objectLand("launcher","sand",strength*.27);
        bubbleCloud(at,5);
      } else grit(at,strength);
    }
  }

  function checkFlyby(shot,delta,limit,listener,speed) {
    const lengthSquared=dot(delta,delta);
    if(lengthSquared<1e-8) return;
    const along=dot(minus(listener.at,shot.pos),delta)/lengthSquared;
    if(along<0 || along>=limit) return;
    const closest=plus(shot.pos,times(delta,along));
    const offset=minus(closest,listener.at);
    const distance=Math.hypot(...offset);
    if(distance<.11 || distance>1.18 || terrain.traceShot(map,listener.at,closest,false)) return;
    const right=listener.axes.subarray(0,3);
    const side=dot(offset,right)/Math.max(.55,distance);
    shot.flybyPlayed=true;
    audio.flyby(distance,speed,side,dot(delta,right)/Math.sqrt(lengthSquared));
  }

  function updateShots(dt,aspect) {
    const listener=!death && shots.some(shot=>shot.state==="flight" && shot.source==="opponent" && !shot.flybyPlayed)
      ? currentCamera(aspect) : null;
    for (const shot of shots) {
      const seconds=shot.releasedAt===undefined ? dt : clamp(sceneTime-shot.releasedAt,0,dt);
      if(seconds<=0) continue;
      if (shot.state === "flight") {
        shot.age += seconds;
        shot.trail.unshift(shot.pos.slice());
        if (shot.trail.length > 4) shot.trail.pop();
        const n = Math.max(1,Math.ceil(seconds/.009));
        const step = seconds/n;
        for (let i=0; i<n && shot.state==="flight"; i++) {
          const speed = Math.hypot(...shot.velocity);
          const below = terrain.wetAt(shot.pos[0],shot.pos[2],shot.pos[1]);
          const drag = below ? speed*.036+3.95 : speed*shot.drag;
          const velocity = times(shot.velocity,Math.exp(-drag*step));
          velocity[1] -= (below ? 3.9 : airFall)*step;
          const delta = times(plus(shot.velocity,velocity),step*.5);
          const next = plus(shot.pos,delta);
          const hit = traceFlight(shot.pos,next);
          if(listener && shot.source==="opponent" && !shot.flybyPlayed && speed>10) {
            checkFlyby(shot,delta,hit?.fraction??1,listener,speed);
          }
          shot.distance += Math.hypot(...delta)*(hit?.fraction ?? 1);
          if (hit) {
            shot.velocity = shot.velocity.map((v,j)=>mix(v,velocity[j],hit.fraction));
            hitShot(shot,hit);
            continue;
          }
          shot.pos = next;
          shot.velocity = velocity;
          if (shot.spin) {
            shot.pitch += shot.spin[0]*step;
            shot.yaw += shot.spin[1]*step;
            shot.roll += shot.spin[2]*step;
          } else {
            shot.pitch = Math.atan2(velocity[1],Math.hypot(velocity[0],velocity[2]))*(shot.releasedAt===undefined ? .72 : 1);
            shot.roll = Math.sin(shot.age*6.2)*.10;
          }
        }
        if (shot.state === "flight" && shot.age > 5.5) shot.state = "gone";
      } else if (shot.state === "sink") {
        shot.age += seconds;
        shot.pos[0] += shot.velocity[0]*seconds;
        shot.pos[2] += shot.velocity[2]*seconds;
        shot.velocity[0] *= Math.exp(-seconds*6.5);
        shot.velocity[2] *= Math.exp(-seconds*6.5);
        shot.pos[1] -= seconds*(.22+shot.age*.21);
        shot.pitch -= seconds*.55;
        shot.roll += seconds*.83;
        const bed = terrain.height(shot.pos[0],shot.pos[2]);
        if (shot.pos[1] <= bed+.009) {
          shot.pos[1] = bed+.009;
          shot.state = "rest";
        }
      } else if(shot.restOn) {
        const {prop,piece,at,offset}=shot.restOn;
        if(prop.picked || prop.broken) {
          shot.restOn=null;
          shot.state="flight";
          shot.age=0;
          shot.velocity=[0,-.25,0];
        } else {
          shot.pos=point(prop.matrix,plus(props.bendPoint(prop,at,piece),offset));
        }
      }
    }
    for (let i=shots.length-1; i>=0; i--) {
      const shot=shots[i];
      if(shot.state==="rest") shot.removeAt??=sceneTime+loosePartLife;
      if(shot.state==="gone" || sceneTime>=shot.removeAt) shots.splice(i,1);
    }
  }

  function updateParticles(dt) {
    let landing=null;
    for (let i=particles.length-1; i>=0; i--) {
      const p = particles[i];
      const water = p.kind==="water";
      const wood = p.kind==="wood";
      const fragment = p.kind==="fragment";
      const {pos,velocity} = p;
      const bubble = p.kind==="bubble";
      const gravity = bubble ? -.14 : water && p.drop ? waterGravity : fragment ? 9.8 : wood ? 8.4 : 5.3;
      p.life -= dt;
      velocity[1] -= gravity*dt;
      p.pos = [pos[0]+velocity[0]*dt,pos[1]+(velocity[1]+(water ? gravity*.5*dt : 0))*dt,pos[2]+velocity[2]*dt];
      if(fragment && p.pos[1]<p.floor+p.size*.25) {
        p.pos[1]=p.floor+p.size*.25;
        const speed=-velocity[1];
        if(p.impactMaterial && p.life>0 && speed>1.12 && (p.landings??0)<2) {
          p.landings=(p.landings??0)+1;
          const dx=p.pos[0]-player.x, dz=p.pos[2]-player.z;
          const distance=Math.hypot(dx,p.pos[1]-player.viewBase-player.eyeHeight,dz);
          const strength=Math.min(1.18,Math.sqrt(p.size/.15)*speed/5.8);
          const level=strength*(1-smooth(18,55,distance))/(1+(distance/14)**1.33);
          // Keep the strongest contact when many small fragments strike in the same frame.
          if(level>Math.max(.012,landing?.level??0)) landing={material:p.impactMaterial,level,distance,dx,dz};
        }
        velocity[1]=velocity[1]<-.42 ? velocity[1]*-.26 : 0;
        velocity[0]*=.62;
        velocity[2]*=.62;
        if(!velocity[1] && p.spin.some(Boolean)) {
          p.angles=plus(p.angles,times(p.spin,p.total-p.life));
          p.spin=[0,0,0];
        }
      }
      const surface=water || bubble ? terrain.waterLevel(p.pos[0],p.pos[2]) : 0;
      const landed = water && p.pos[1]<surface+.006;
      if (landed && p.landingWave && terrain.height(p.pos[0],p.pos[2])<surface-.024) {
        ripple(p.pos[0],p.pos[2],p.landingWave);
      }
      if (p.life <= 0 || landed || (bubble && p.pos[1]>=surface-.009)
        || (wood && p.pos[1]<terrain.height(p.pos[0],p.pos[2])-.006)) particles.splice(i,1);
    }
    if(landing) {
      const {material,level,distance,dx,dz}=landing;
      const pan=(dx*Math.cos(player.yaw)+dz*Math.sin(player.yaw))/Math.max(2,distance);
      audio.debrisLand(material,level,pan);
    }
    if (particles.length > particleLimit) particles.splice(0,particles.length-particleLimit);
    while (ripples.length && sceneTime-ripples[0][2] > waterRipples.life) ripples.shift();
  }

  function packRipples() {
    ripples.forEach((r,i)=>rippleData.set(r,i*4));
    return rippleData.subarray(0,ripples.length*4);
  }

  function updateGame(dt,aspect) {
    elapsed+=dt;
    let exertion=0;
    if(!death) {
      if(knockdown) updateFall(dt,aspect);
      else exertion=movement(dt);
    }
    updateInterior(dt);
    audio.waterfall(player.x,player.z);
    updateSupply(dt);
    props.tick(map,dt,sceneTime,packRipples(),ripple,throwImpact);
    if(death) updateDeath(dt,aspect);
    else {
      if(!knockdown) mechanism(dt,aspect);
      updateVitals(dt,aspect);
    }
    audio.movementSound?.breathe(dt,exertion,submerged || Boolean(death || knockdown?.fatal));
    updateShots(dt,aspect);
    if(blastQueue.length) {
      for(const site of blastQueue) detonate(site,aspect);
      blastQueue.length=0;
    }
    if(!death && !knockdown) {
      const cam=currentCamera(aspect);
      hands.update(dt,{world:map,cam,player,keys,time:sceneTime,ripples:packRipples(),swing:throwSwing(),hand:toy.support,
        take:takeProp,place:finishPlacement,use:fixtureAction,miss:()=>show("NEED ROOM TO SET DOWN")});
      updateToss(dt,aspect);
    }
    audio.fireSystem(utilities.fireSound(map.road.services,[player.x,player.feet+player.eyeHeight,player.z],player.yaw,sceneTime));
    while(bursts.length && sceneTime-bursts[0].time>utilities.burstLife) bursts.shift();
    fire.expire(map.road.interior,fires,sceneTime);
    updateDiscarded(dt);
    updateParticles(dt);
    if(practiceRound) animationDemo?.update(dt);
    updateClock();
    updatePracticeHud();
    if(captionUntil<=elapsed && caption.textContent) caption.textContent="";
  }

  function adjustResolution(wall) {
    if(wall<=0) return;
    performanceSeconds+=Math.min(wall,.15);
    measuredFrames++;
    if(wall>.026) slowFrames++;
    if(performanceSeconds<1.5 || measuredFrames<5) return;
    const fraction=slowFrames/measuredFrames;
    if(fraction>.35) {
      resolutionLevel=Math.min(resolutionScales.length-1,resolutionLevel+1);
      recoverySeconds=0;
    } else if(fraction<.09 && performanceSeconds/measuredFrames<.021) {
      recoverySeconds+=performanceSeconds;
      if(recoverySeconds>=6) {
        resolutionLevel=Math.max(0,resolutionLevel-1);
        recoverySeconds=0;
      }
    } else recoverySeconds=0;
    renderer.quality=resolutionScales[resolutionLevel];
    measuredFrames=slowFrames=performanceSeconds=0;
  }

  function frame(now) {
    const wall = frameAt ? (now-frameAt)/1000 : 0;
    const dt = Math.min(.09,wall);
    frameAt = now;
    if(playing) adjustResolution(wall);
    const previousSurface = renderer.surface;
    const aspect = renderer.resize();
    if (!playing && started && previousSurface === renderer.surface) {
      requestAnimationFrame(frame);
      return;
    }
    // Once paused, keep the tape image and the simulation at the same instant.
    if (playing || !started) sceneTime += dt;
    if (playing) updateGame(dt,aspect);
    else props.tick(map,0,sceneTime,packRipples());
    const inWorld = shots.map(s => ({
      mesh: toy.cars[s.index],
      matrix: transform(s.pos,s.pitch,s.yaw,s.roll,s.scale)
    }));
    if(practiceRound) inWorld.push(...practice.view(map.road.practice,sceneTime));
    const glass = [];
    for(const gear of launchers) {
      if(gear.prop.picked) continue;
      const distance=gear===spiralGear ? Math.hypot(gear.prop.x-player.x,gear.prop.y-player.feet,gear.prop.z-player.z) : 0;
      if(distance>48) continue;
      const loose=gear.model.looseLauncher(toy,gear.prop.matrix,gear.loaded,gear.motor,distance>10 ? 5 : distance>4 ? 2 : 1);
      inWorld.push(...loose.opaque);
      if(loose.glass) glass.push(loose.glass);
    }
    for (const part of discarded) {
      if(part.spiralPart) {
        const distance=Math.hypot(part.pos[0]-player.x,part.pos[1]-player.feet,part.pos[2]-player.z);
        if(distance>25) continue;
        const matrix=discardedPose(part);
        if(part.magazine) {
          const parts=spiral.magazineParts(toy.spiral,matrix,part.magazine,0,distance>8 ? 5 : distance>3.5 ? 2 : 1);
          inWorld.push(...parts.opaque);
          glass.push(parts.glass);
        } else inWorld.push({mesh:toy.spiral.cap,matrix});
        continue;
      }
      const matrix = discardedPose(part);
      if (part.magazine) {
        const {cars,belt,feed} = part.magazine;
        const parts = launcher.cartridgeParts(toy,matrix,cars,belt,feed);
        inWorld.push(...parts.opaque);
        glass.push(parts.glass);
      } else {
        inWorld.push({mesh:toy.cartridge.cap,matrix});
      }
    }
    const cloud = [];
    for (const s of shots) {
      s.trail.forEach((p,i)=>{
        cloud.push(p[0],p[1]+.012,p[2],.82,.82,.72,.22-i*.045,.028+i*.006,0,0,0,0);
      });
    }
    for (const p of particles) {
      if(p.mesh) {
        const [pitch,yaw,roll]=plus(p.angles,times(p.spin,p.total-p.life));
        const scale=p.size*smooth(0,.22,p.life/p.total);
        inWorld.push({mesh:p.mesh,matrix:transform(p.pos,pitch,yaw,roll,scale)});
        continue;
      }
      const contact = p.drop && p.velocity[1]<0 ? smooth(.006,.086,p.pos[1]-terrain.waterLevel(p.pos[0],p.pos[2])) : 1;
      const fade = p.alpha*smooth(0,.17,p.life/p.total)*contact;
      if (p.streak) {
        const tail = Math.min(p.total-p.life,.047);
        for (let i=1; i<=4; i++) {
          const at = minus(p.pos,times(p.velocity,tail*i/4));
          cloud.push(...at,1,.41,.09,fade*(.76-.14*i),p.size*(1-i*.13),0,0,0,0);
        }
      }
      const drift = p.drop ? p.velocity : null;
      cloud.push(...p.pos,...p.color,fade,p.size,drift?.[0]??0,drift?.[1]??0,drift?.[2]??0,drift ? 1 : 0);
    }
    const cam = currentCamera(aspect), pose = currentPose();
    fire.scorchVisuals(map.road.interior,cam,glass);
    if(map.road.interior.leaks.length) lodging.leakVisuals(map.road.interior,sceneTime,cam,cloud);
    utilities.fireVisuals(map.road.services,sceneTime,cam,inWorld,cloud);
    updateReticle();
    updateInteraction(cam);
    const interactionParts=!death && !knockdown ? hands.render(toy,cam,player,
      !player.swim.active && !handToss && (!player.ownsLauncher || stowAmount>=.96)) : [];
    const held=knockdown ? {opaque:launcher.struggle(toy,Math.min(knockdown.age,(knockdown.landedAt??Infinity)+.37),true)}
      : player.ownsLauncher && stowAmount<.97 ? equipped.model.assemble(toy,pose,mounted,cycle,refill,player.swim,motor,motorPress,inspection,aimAmount)
        : death || handToss || player.carried ? {opaque:[]} : launcher.swimmingHands(toy,player.swim);
    if(hands.useSide && !death && !knockdown) held.opaque=held.opaque.filter(part=>part.handSide!==hands.useSide);
    if(!death && !knockdown && !player.swim.active && !refill && !inspection && !motor?.switching && !handToss) {
      hands.poseHeldArms(held.opaque,cam.frustum[1],aimAmount);
    }
    if(death?.phase==="struggle") {
      const limbs=launcher.struggle(toy,death.age,death.released);
      held.opaque.push(...limbs);
    } else if(handToss?.released && !interactionParts.length) {
      held.opaque.push(...launcher.throwingHands(toy,handToss.age,!handToss.prop.small || handToss.prop.kind==="crt"));
    }
    renderer.frame(cam,sceneTime,map,inWorld,held,new Float32Array(cloud),packRipples(),glass,
      utilities.visuals(bursts,fires,sceneTime,cam),interactionParts,practiceRound ? animationDemo?.render() : null);
    requestAnimationFrame(frame);
  }

  async function boot() {
    let failureNote = "Graphics could not initialize. Reload the page.";
    try {
      renderer = new Renderer(canvas);
      failureNote = "The valley textures could not load. Reload the page.";
      await renderer.loadTextures(ValleyTextures);
      failureNote = "The game scene could not load. Reload the page.";
      map = terrain.build(renderer);
      toy = launcher.build(renderer);
      toy.rifle=rifle.build(renderer);
      toy.spiral=spiral.build(renderer);
      pistolGear.prop=props.make([],"launcher",player.x,player.feet,player.z,0,.105,.40,.21);
      rifleGear.prop=props.make([],"rifle",player.x,player.feet,player.z,0,.107,.995,.28);
      spiralGear.prop=props.make([],"spiral",player.x,player.feet,player.z,0,.117,.812,spiral.magazineWidth);
      for(const gear of launchers) {
        gear.prop.picked=true;
        map.props.push(gear.prop);
      }
      inventory();
      motorStatus();
      updateHealth();
      updateBreathMeter(false);
      updateClock();
      requestAnimationFrame(frame);
      playLabel.textContent = "PLAY TAPE";
      play.disabled = false;
      playWindowed.disabled = false;
    } catch (error) {
      console.error(error);
      playLabel.textContent = "PLAYBACK FAILED";
      menuNote.textContent = error?.message === "WebGL 2 is unavailable."
        ? "WebGL 2 is unavailable. Enable graphics acceleration in Chrome or Edge."
        : failureNote;
    }
  }

  canvas.addEventListener("webglcontextlost", e => {
    e.preventDefault();
    pause();
    play.disabled = true;
    playWindowed.disabled = true;
    playLabel.textContent = "PLAYBACK FAILED";
    menuNote.textContent = "Graphics connection lost. Reload the page.";
  });
  boot();
})();
