using UnityEngine;

namespace ValleyCamcorder
{
    internal sealed class ValleyWater : MonoBehaviour
    {
        const int Capacity=24;
        const float RippleLife=3.8f;
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
                bool replaceable=false;
                for(int i=0;i<Capacity;i++)
                {
                    int candidate=(next+i)%Capacity;
                    if(waves[candidate].w>=.52f && Time.time-waves[candidate].z<=RippleLife) continue;
                    slot=candidate;
                    replaceable=true;
                    break;
                }
                if(!replaceable && strength<.52f) return;
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

        internal void BlastSplash(Vector3 at)
        {
            const float reach=6.6f;
            var closest=at;
            float distance=reach;
            foreach(var section in map.river)
            {
                if(Mathf.Abs(at.z+section.z)>=distance || section.right-section.left<=.72f) continue;
                var point=new Vector3(Mathf.Clamp(at.x,section.left+.36f,section.right-.36f),at.y,-section.z);
                point.y=map.WaterLevel(point);
                float range=Vector3.Distance(at,point);
                if(range>=distance || !map.RiverAbove(point-Vector3.up*.10f)) continue;
                closest=point;
                distance=range;
            }
            if(distance<reach)
                Splash(closest,closest-at,Mathf.Lerp(1.56f,.79f,distance/reach),"impact");
        }

        public void Splash(Vector3 at,Vector3 direction,float strength,string kind)
        {
            at.y=map.WaterLevel(at);
            if(!map.RiverAbove(at-Vector3.up*.075f)) return;
            Splashes++;
            Ripple(at,strength);
            audio.WorldCue("water-"+kind,at,Mathf.Clamp(Mathf.Sqrt(strength),.22f,1.17f));
            var distance=(audio.listener.position-at).sqrMagnitude;
            if(distance>41*41) return;
            var scale=Mathf.Clamp(Mathf.Pow(strength,.66f),.32f,1.52f);
            bool impact=kind=="impact";
            var spawnAt=at+Vector3.up*.052f;
            var spray=effects.AtmosphereParticles(spawnAt,"River spray",ValleyMapInteractions.ParticleLook.Drop,false,
                .36f,1.47f,.016f*scale,.106f*scale,0,0,1,new Color(.70f,.86f,.95f,.96f));
            var horizontal=Vector3.ProjectOnPlane(direction,Vector3.up).normalized*(impact ? 1.04f : .48f)*scale;
            var lod=distance<24*24 ? 1 : .48f;
            int crown=Mathf.RoundToInt((impact ? 44 : 15)*scale*lod);
            int beads=Mathf.RoundToInt((impact ? 36 : 24)*scale*lod);
            float turn=Random.Range(0,Mathf.PI*2);
            for(int i=0;i<crown+beads;i++)
            {
                bool rim=i<crown;
                float angle=turn+(rim ? (i+Random.value)*Mathf.PI*2/crown : Random.Range(0,Mathf.PI*2));
                float lobe=.81f+.19f*Mathf.Sin(angle*7+turn);
                var outward=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));
                var kick=scale*(impact ? 1.31f : .91f);
                var radial=kick*(rim ? Random.Range(1.27f,2.16f)*lobe : Random.Range(.69f,3.32f));
                var rise=Mathf.Min(6.2f,kick*(rim ? Random.Range(2.61f,4.39f)*lobe : Random.Range(1.38f,4.43f)));
                var size=scale*(rim ? Random.Range(.048f,.106f) : Random.Range(.016f,.066f));
                // End each droplet on the water plane, even if its launch speed varies.
                float gravity=Mathf.Max(.1f,-Physics.gravity.y);
                float lifetime=(rise+Mathf.Sqrt(rise*rise+2*gravity*.052f))/gravity;
                spray.Emit(new ParticleSystem.EmitParams
                {
                    position=spawnAt+outward*Random.Range(.025f,rim ? .23f : .17f)*scale,
                    velocity=outward*radial+horizontal+Vector3.up*rise,
                    startSize=size,startLifetime=Mathf.Min(1.47f,lifetime)
                },1);
            }
            if(!impact || distance>25*25) return;
            var mist=effects.AtmosphereParticles(spawnAt,"Water impact mist",ValleyMapInteractions.ParticleLook.Mist,false,
                .28f,.69f,.15f*scale,.42f*scale,0,0,.22f,new Color(.76f,.86f,.93f,.36f));
            for(int i=0;i<18;i++)
            {
                var scatter=Random.insideUnitCircle;
                var spread=new Vector3(scatter.x,0,scatter.y);
                mist.Emit(new ParticleSystem.EmitParams {position=spawnAt+spread*.11f,
                    velocity=spread*scale*1.46f+horizontal*.56f+Vector3.up*Random.Range(.57f,1.93f)*scale},1);
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
