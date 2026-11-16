using UnityEngine;

namespace ValleyCamcorder
{
    internal sealed class ValleyWater : MonoBehaviour
    {
        const int Capacity=24;
        const float RippleLife=3.2f;
        static readonly int Ripples=Shader.PropertyToID("_ValleyRipples");
        static readonly int RippleCount=Shader.PropertyToID("_ValleyRippleCount");
        readonly Vector4[] waves=new Vector4[Capacity];
        ValleyManifest map;
        ValleyMapInteractions effects;
        ValleyAudio audio;
        int count, next;
        internal int Splashes { get; private set; }
        internal int BubbleBursts { get; private set; }

        public void Bind(ValleyManifest manifest,ValleyMapInteractions world,ValleyAudio sound)
        {
            map=manifest;
            effects=world;
            audio=sound;
            Shader.SetGlobalInt(RippleCount,0);
        }

        public void Ripple(Vector3 at,float strength)
        {
            int slot;
            if(count<Capacity) slot=count++;
            else
            {
                slot=next;
                // Older light wakes yield to impacts near the same shore.
                for(int i=0;i<Capacity;i++)
                {
                    int candidate=(next+i)%Capacity;
                    if(waves[candidate].w<.52f || Time.time-waves[candidate].z>RippleLife) {slot=candidate;break;}
                }
                next=(slot+1)%Capacity;
            }
            waves[slot]=new Vector4(at.x,at.z,Time.time,Mathf.Clamp(strength,.05f,1.65f));
            Shader.SetGlobalVectorArray(Ripples,waves);
            Shader.SetGlobalInt(RippleCount,count);
        }

        public bool Crossing(Vector3 from,Vector3 to,out Vector3 at,out float fraction)
        {
            var above=from.y-map.WaterLevel(from);
            var below=to.y-map.WaterLevel(to);
            if(above>=-.002f && below<-.002f)
            {
                fraction=Mathf.Clamp01(above/(above-below));
                at=Vector3.Lerp(from,to,fraction);
                at.y=map.WaterLevel(at);
                return map.RiverAbove(at-Vector3.up*.045f);
            }
            at=default;
            fraction=1;
            return false;
        }

        public void Splash(Vector3 at,Vector3 direction,float strength,string kind)
        {
            at.y=map.WaterLevel(at);
            if(!map.RiverAbove(at-Vector3.up*.075f)) return;
            Splashes++;
            Ripple(at,strength);
            audio.WorldCue("water-"+kind,at,Mathf.Clamp(strength,.22f,1.15f));
            if((audio.listener.position-at).sqrMagnitude>36*36) return;
            var scale=Mathf.Clamp(Mathf.Pow(strength,.66f),.32f,1.52f);
            var burst=effects.Particles(at+Vector3.up*.035f,"River spray",effects.ParticleMaterial,false,
                .28f,.79f,.017f*scale,.063f*scale,1.48f*scale,4.4f*scale,1.05f,new Color(.72f,.88f,.96f,.86f));
            var horizontal=Vector3.ProjectOnPlane(direction,Vector3.up).normalized;
            int beads=Mathf.RoundToInt((kind=="impact" ? 46 : 29)*scale);
            for(int i=0;i<beads;i++)
            {
                var angle=(i+Random.value)*Mathf.PI*2/beads;
                var fan=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));
                burst.Emit(new ParticleSystem.EmitParams
                {
                    position=at+Vector3.up*.066f+fan*Random.Range(.025f,.12f)*scale,
                    velocity=fan*Random.Range(.60f,2.8f)*scale+horizontal*.47f+Vector3.up*Random.Range(1.1f,4.1f)*scale
                },1);
            }
        }

        public void Bubbles(Vector3 at,int amount)
        {
            BubbleBursts++;
            var rise=effects.Particles(at,"Air bubbles",effects.ParticleMaterial,false,
                .34f,1.25f,.018f,.052f,.19f,.62f,-.17f,new Color(.57f,.82f,.86f,.58f));
            for(int i=0;i<amount;i++)
            {
                var start=at+Random.insideUnitSphere*.12f;
                rise.Emit(new ParticleSystem.EmitParams
                {
                    position=start,
                    velocity=Vector3.up*Random.Range(.21f,.56f)+Random.insideUnitSphere*.11f
                },1);
            }
        }

        void OnDestroy() => Shader.SetGlobalInt(RippleCount,0);
    }
}
