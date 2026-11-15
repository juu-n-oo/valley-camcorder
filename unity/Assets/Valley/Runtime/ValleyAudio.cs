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
        AudioSource steps, breath, falls;
        float fatigue, distance, nextBreath;
        bool hadEffort;
        AudioClip previous;

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
            falls=new GameObject("Waterfall audio").AddComponent<AudioSource>();
            falls.transform.SetParent(transform,false);
            falls.loop=true;
            falls.spatialBlend=.46f;
            falls.minDistance=32;
            falls.maxDistance=88;
            falls.clip=WaterLoop();
            falls.volume=0;
            falls.Play();
        }

        void Update()
        {
            if (world.Map == null) return;
            var at=world.Map.FallPoint(listener.position);
            falls.transform.position=at;
            var range=Vector3.Distance(at,listener.position);
            falls.volume=.62f*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(10,62,range)));
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

        public void Move(float travelled, float rise, bool running, bool grounded, bool wet, RaycastHit floor)
        {
            var dt=Time.deltaTime;
            if (travelled>.005f && grounded && !wet)
            {
                distance+=travelled;
                var marker=floor.collider ? floor.collider.GetComponent<ValleySurface>() : null;
                var material=marker?.bank ?? "outdoorStone";
                if (material=="terrain") material=floor.textureCoord.x>.60f ? "dirtLeaf" : "outdoorStone";
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

        public void Search(string kind) => Play(steps,"supply-"+kind,.68f,1f);

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
