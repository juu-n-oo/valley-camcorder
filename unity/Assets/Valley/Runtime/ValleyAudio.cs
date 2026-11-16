using System;
using System.Collections.Generic;
using UnityEngine;

namespace ValleyCamcorder
{
    public sealed class ValleyAudio : MonoBehaviour
    {
        public AudioClip[] recordings;
        public Transform listener;
        public ValleyWorld world;
        readonly Dictionary<string,List<AudioClip>> banks = new();
        readonly Dictionary<string,List<AudioClip>> worldCues=new();
        readonly Dictionary<string,AudioClip> effects=new();
        AudioSource steps, breath, falls, cues, mechanism, booster, resupply, depth;
        AudioLowPassFilter cueFilter, motorFilter, boosterFilter, fallsFilter;
        float mechanismTarget, boosterTarget, depthTarget;
        float fatigue, distance, nextBreath, brushDistance;
        bool hadEffort;
        AudioClip previous;
        public string LastCue { get; private set; }
        public string LastWorldCue { get; private set; }
        public string SearchBank { get; private set; }
        public bool HasCue(string name) => effects.ContainsKey(name);
        internal float BoosterCharge { get; private set; }
        internal string FeederCue { get; private set; }

        void Awake()
        {
            foreach(var clip in recordings)
            {
                var dash=clip.name.LastIndexOf('-');
                var key=dash>=0 && int.TryParse(clip.name[(dash+1)..],out _) ? clip.name[..dash] : clip.name;
                if (!banks.TryGetValue(key,out var clips)) banks[key]=clips=new List<AudioClip>();
                clips.Add(clip);
            }
            steps=gameObject.AddComponent<AudioSource>();
            breath=gameObject.AddComponent<AudioSource>();
            foreach(var clip in Resources.LoadAll<AudioClip>("ValleyEffects")) effects[clip.name]=clip;
            foreach(var clip in Resources.LoadAll<AudioClip>("ValleyFixtureAudio"))
            {
                var key=clip.name[..clip.name.LastIndexOf('-')];
                if(!worldCues.TryGetValue(key,out var clips)) worldCues[key]=clips=new List<AudioClip>();
                clips.Add(clip);
            }
            cues=Source("Toy effects");
            mechanism=Source("Toy feeder motor");
            booster=Source("Toy booster motor");
            cueFilter=cues.gameObject.AddComponent<AudioLowPassFilter>();
            motorFilter=mechanism.gameObject.AddComponent<AudioLowPassFilter>();
            boosterFilter=booster.gameObject.AddComponent<AudioLowPassFilter>();
            resupply=Source("Resupply recordings");
            depth=Source("Underwater sound");
            depth.loop=mechanism.loop=booster.loop=true;
            depth.volume=mechanism.volume=booster.volume=0;
            if(effects.TryGetValue("booster",out var rotor)) booster.clip=rotor;
            if(effects.TryGetValue("underwater",out var underwater)) depth.clip=underwater;
            falls=new GameObject("Waterfall audio").AddComponent<AudioSource>();
            falls.transform.SetParent(transform,false);
            falls.loop=true;
            falls.spatialBlend=.46f;
            falls.minDistance=32;
            falls.maxDistance=88;
            falls.clip=WaterLoop();
            fallsFilter=falls.gameObject.AddComponent<AudioLowPassFilter>();
            falls.volume=0;
            falls.Play();
        }

        void Update()
        {
            if (world.Map == null) return;
            var at=world.Map.FallPoint(listener.position);
            falls.transform.position=at;
            var range=Vector3.Distance(at,listener.position);
            falls.volume=.62f*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(5,74,range)))*(1-.82f*depthTarget);
            Fade(depth,depthTarget,Time.deltaTime);
            var cutoff=Mathf.Lerp(22000,610,Mathf.SmoothStep(0,1,depth.volume/.47f));
            cueFilter.cutoffFrequency=motorFilter.cutoffFrequency=boosterFilter.cutoffFrequency=fallsFilter.cutoffFrequency=cutoff;
        }

        AudioSource Source(string name)
        {
            var child=new GameObject(name);
            child.transform.SetParent(transform,false);
            var source=child.AddComponent<AudioSource>();
            source.playOnAwake=false;
            return source;
        }

        static void Fade(AudioSource source,float target,float dt)
        {
            source.volume=Mathf.MoveTowards(source.volume,target,dt*(target>0 ? 8 : 6));
            if(target>0 && !source.isPlaying && source.clip) source.Play();
            if(target==0 && source.volume<.001f && source.isPlaying) source.Stop();
        }

        public void Cue(string name,float volume=1)
        {
            if(!effects.TryGetValue(name,out var clip)) return;
            LastCue=name;
            cues.pitch=UnityEngine.Random.Range(.96f,1.055f);
            cues.PlayOneShot(clip,volume);
        }

        public void LauncherMotors(string feeder,float feedLevel,float charge,float pitch,float dt)
        {
            FeederCue=feeder;
            mechanismTarget=0;
            if(feeder!=null && effects.TryGetValue(feeder,out var belt))
            {
                mechanismTarget=feedLevel;
                if(mechanism.clip!=belt)
                {
                    mechanism.Stop();
                    mechanism.clip=belt;
                    mechanism.volume=0;
                }
            }
            BoosterCharge=Mathf.Clamp01(charge);
            boosterTarget=charge>0 ? Mathf.Lerp(.10f,.62f,Mathf.Pow(BoosterCharge,1.55f)) : 0;
            if(charge>0) booster.pitch=Mathf.Lerp(.40f,1.34f,BoosterCharge)*pitch;
            Fade(mechanism,mechanismTarget,dt);
            Fade(booster,boosterTarget,dt*1.65f);
        }

        public void StopLauncherMotors()
        {
            LauncherMotors(null,0,0,1,0);
            booster.Stop();
            mechanism.Stop();
            booster.volume=mechanism.volume=0;
        }

        public void WorldCue(string key,Vector3 at,float volume)
        {
            AudioClip clip;
            var recording=key=="ceramic" && !worldCues.ContainsKey(key) ? "small" : key;
            if(worldCues.TryGetValue(recording,out var choices)) clip=choices[UnityEngine.Random.Range(0,choices.Count)];
            else if(!effects.TryGetValue(key,out clip)) return;
            LastWorldCue=key;
            var source=WorldSource(key,at,transform,volume);
            source.clip=clip;
            source.pitch=UnityEngine.Random.Range(.92f,1.08f)*(key=="ceramic" ? .78f : 1);
            if(key=="blast") {source.maxDistance=105; source.minDistance=9;}
            source.Play();
            Destroy(source.gameObject,clip.length/source.pitch+.15f);
        }

        public AudioSource WorldLoop(string key,Vector3 at,Transform parent,float volume)
        {
            if(!effects.TryGetValue(key,out var clip)) return null;
            var source=WorldSource(key,at,parent,volume);
            source.clip=clip;
            source.loop=true;
            source.Play();
            return source;
        }

        internal void DemoFoot(string key,bool running,Vector3 at)
        {
            var distance=Vector2.Distance(new Vector2(at.x,at.z),new Vector2(listener.position.x,listener.position.z));
            if(distance>=12 || !banks.TryGetValue(key+(running ? "Run" : "Walk"),out var clips)) return;
            var volume=.45f*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(2,12,distance)));
            var source=WorldSource("Demo footstep",at,transform,volume);
            source.maxDistance=12;
            source.clip=clips[UnityEngine.Random.Range(0,clips.Count)];
            source.Play();
            Destroy(source.gameObject,source.clip.length+.15f);
        }

        static AudioSource WorldSource(string key,Vector3 at,Transform parent,float volume)
        {
            var node=new GameObject(key+" sound");
            node.transform.SetParent(parent);
            node.transform.position=at;
            var source=node.AddComponent<AudioSource>();
            source.spatialBlend=.87f;
            source.rolloffMode=AudioRolloffMode.Linear;
            source.minDistance=1.1f;
            source.maxDistance=14;
            source.volume=volume;
            source.playOnAwake=false;
            return source;
        }

        public void WaterDepth(float amount) => depthTarget=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.012f,.205f,amount))*.62f;

        public void Land(RaycastHit floor,float speed)
        {
            var bank=floor.collider ? floor.collider.GetComponent<ValleySurface>()?.bank : null;
            var wood=bank!=null && bank.Contains("Wood",StringComparison.OrdinalIgnoreCase);
            Play(steps,wood ? "woodLand" : speed>=5.6f ? "rockHeavyLand" : "rockLand",.50f,.94f);
            if(speed>6.15f) Play(breath,"landingEffort",.38f,.96f);
        }

        AudioClip WaterLoop()
        {
            const int rate=24000, length=rate*5;
            var rng=new System.Random(20010818);
            var values=new float[length];
            float fast=0, slow=0, drift=0;
            for(var i=0;i<length;i++)
            {
                var n=(float)rng.NextDouble()*2-1;
                fast+=.37f*(n-fast);
                slow+=.018f*(n-slow);
                drift+=.002f*(n-drift);
                var phase=i*2*Mathf.PI/length;
                var level=.85f+.095f*Mathf.Sin(phase*7)+.062f*Mathf.Sin(phase*13+1.4f);
                values[i]=level*(fast*.30f+slow*.45f+drift*1.1f-n*.066f);
            }
            for(var i=0;i<256;i++)
            {
                var end=length-256+i;
                values[end]=Mathf.Lerp(values[end],values[0],i/255f);
            }
            var loop=AudioClip.Create("Broad valley waterfall",length,1,rate,false);
            loop.SetData(values,0);
            return loop;
        }

        public void Move(float travelled,float rise,bool running,bool grounded,bool wet,RaycastHit floor,string groundBank)
        {
            var dt=Time.deltaTime;
            if (travelled>.005f && grounded && !wet)
            {
                distance+=travelled;
                var marker=floor.collider ? floor.collider.GetComponent<ValleySurface>() : null;
                var material=marker?.bank ?? "outdoorStone";
                if(material=="terrain") material=groundBank;
                if(material=="indoorWood") material="outdoorWood";
                if(material=="grass")
                {
                    brushDistance+=travelled;
                    if(brushDistance>.73f)
                    {
                        brushDistance=0;
                        Play(steps,"grassBrush",running ? .36f : .22f,1.03f);
                    }
                }
                else brushDistance=0;
                var stride=running ? .96f : .79f;
                if (marker && marker.stair) stride*=.79f;
                if (distance>=stride)
                {
                    distance-=stride;
                    var name=material+(running ? "Run" : "Walk");
                    if(marker && marker.stair)
                        name=(material.Contains("Wood",StringComparison.OrdinalIgnoreCase) ? "wood" : "rock")+
                            (rise<-.001f ? "StairDown" : "StairUp");
                    Play(steps,name,running ? .50f : .39f, .96f+UnityEngine.Random.value*.08f);
                }
            }
            else distance=Mathf.Max(0,distance-dt*.7f);

            fatigue=Mathf.Clamp01(fatigue+dt*(running && travelled>.008f ? .17f : -.13f));
            nextBreath-=dt;
            if (wet || nextBreath>0) return;
            if (fatigue>.15f)
            {
                hadEffort=true;
                var key = running ? fatigue>.65f ? "runBreathHard" : fatigue>.39f ? "runBreathMedium" : "runBreathLight" : "recoveryBreath";
                nextBreath=Play(breath,key,Mathf.Lerp(.22f,.54f,fatigue),running ? 1.05f : .90f);
            }
            else if (hadEffort)
            {
                hadEffort=false;
                nextBreath=Play(breath,"deepBreath",.24f,.92f);
            }
        }

        public void Search(string kind)
        {
            resupply.Stop();
            SearchBank=kind;
            if(kind!=null) Play(resupply,"supply-"+kind,.68f,1);
        }

        float Play(AudioSource source,string bank,float volume,float pitch)
        {
            if (!banks.TryGetValue(bank,out var clips) || clips.Count==0) return .42f;
            var clip=clips[UnityEngine.Random.Range(0,clips.Count)];
            if (clips.Count>1 && clip==previous) clip=clips[(clips.IndexOf(clip)+1)%clips.Count];
            previous=clip;
            source.pitch=pitch;
            source.PlayOneShot(clip,volume);
            return clip.length/pitch;
        }
    }
}
