using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace ValleyCamcorder
{
    internal sealed partial class ValleyMapInteractions
    {
        internal enum ParticleLook { Fireball, Flame, Smoke, Drop, Mist, Ember }

        readonly Material[] atmosphere=new Material[6];
        readonly List<(ParticleSystem flame,float scale)> burningEmitters=new();
        static readonly AnimationCurve Billow=AnimationCurve.EaseInOut(0,.37f,1,1.86f);
        static readonly AnimationCurve Cooling=AnimationCurve.EaseInOut(0,1,1,.42f);
        static readonly Gradient FireballAge=Opacity(.78f,.065f,.34f);
        static readonly Gradient FlameAge=Opacity(.07f,.16f,.57f);
        static readonly Gradient SmokeAge=Opacity(.04f,.18f,.49f);
        static readonly Gradient DropAge=Opacity(.81f,.057f,.77f);
        static readonly Gradient MistAge=Opacity(.03f,.21f,.40f);
        static readonly Gradient EmberAge=Opacity(1,.05f,.48f);

        static Gradient Opacity(float start,float peakTime,float decayTime)
        {
            var gradient=new Gradient();
            gradient.SetKeys(
                new[] {new GradientColorKey(Color.white,0),new GradientColorKey(Color.white,1)},
                new[] {new GradientAlphaKey(start,0),new GradientAlphaKey(1,peakTime),
                    new GradientAlphaKey(.85f,decayTime),new GradientAlphaKey(0,1)});
            return gradient;
        }

        internal ParticleSystem AtmosphereParticles(Vector3 at,string name,ParticleLook look,bool loop,
            float shortLife,float longLife,float small,float large,float slow,float fast,float gravity,Color color,int rate=0)
        {
            var index=(int)look;
            if(!atmosphere[index])
            {
                var shader=Resources.Load<Shader>("ValleyEffects/Atmosphere");
                if(shader)
                {
                    var material=new Material(shader) {name=look.ToString()};
                    material.SetFloat("_Mode",index);
                    material.SetFloat("_Softness",look switch
                    {
                        ParticleLook.Drop or ParticleLook.Ember=>.045f,ParticleLook.Flame=>.12f,
                        ParticleLook.Mist=>.26f,_=>.42f
                    });
                    atmosphere[index]=material;
                }
            }
            var ps=Particles(at,name,atmosphere[index] ? atmosphere[index] : particles,loop,
                shortLife,longLife,small,large,slow,fast,gravity,color,rate);
            var main=ps.main;
            main.cullingMode=loop ? ParticleSystemCullingMode.Pause : ParticleSystemCullingMode.AlwaysSimulate;
            var overLife=ps.colorOverLifetime;
            overLife.enabled=true;
            overLife.color=look switch
            {
                ParticleLook.Fireball=>FireballAge,ParticleLook.Flame=>FlameAge,ParticleLook.Smoke=>SmokeAge,
                ParticleLook.Drop=>DropAge,ParticleLook.Mist=>MistAge,_=>EmberAge
            };
            var renderer=ps.GetComponent<ParticleSystemRenderer>();
            if(look is ParticleLook.Drop or ParticleLook.Ember)
            {
                renderer.renderMode=ParticleSystemRenderMode.Stretch;
                renderer.velocityScale=look==ParticleLook.Drop ? .045f : .059f;
                renderer.lengthScale=look==ParticleLook.Drop ? 1.30f : 1.78f;
                renderer.freeformStretching=true;
            }
            else
            {
                renderer.sortMode=ParticleSystemSortMode.Distance;
                if(look!=ParticleLook.Flame)
                    main.startRotation=new ParticleSystem.MinMaxCurve(0,Mathf.PI*2);
            }
            if(look!=ParticleLook.Drop)
            {
                var size=ps.sizeOverLifetime;
                size.enabled=true;
                size.size=new ParticleSystem.MinMaxCurve(1,look==ParticleLook.Ember ? Cooling : Billow);
            }
            return ps;
        }

        void BlastAtmosphere(Vector3 at,float radius)
        {
            if((player.view.transform.position-at).sqrMagnitude>112*112) return;
            var light=Create("Blast flash",at).gameObject.AddComponent<Light>();
            light.type=LightType.Point;
            light.range=radius;
            light.color=new Color(1,.87f,.61f);
            light.intensity=29;
            StartCoroutine(DecayBlastLight(light));

            var hot=AtmosphereParticles(at,"Rolling fireball",ParticleLook.Fireball,false,.37f,.98f,
                1.42f,3.8f,0,0,-.12f,new Color(1,1,1,.90f));
            var soot=AtmosphereParticles(at,"Rolling blast smoke",ParticleLook.Smoke,false,2.3f,5.4f,
                1.52f,4.65f,0,0,-.17f,new Color(.34f,.31f,.29f,.83f));
            var dust=AtmosphereParticles(at-Vector3.up*.43f,"Blast dust skirt",ParticleLook.Smoke,false,1.2f,3.65f,
                1.32f,3.38f,0,0,-.026f,new Color(.50f,.43f,.33f,.47f));
            var embers=AtmosphereParticles(at,"Blast embers",ParticleLook.Ember,false,.32f,1.27f,
                .024f,.074f,0,0,.96f,new Color(1,.37f,.069f,.97f));
            for(int i=0;i<55;i++)
            {
                float angle=(i+Random.value)*Mathf.PI*2/55;
                var fan=new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle));
                var start=at+fan*Random.Range(.16f,.63f);
                if(i<34)
                {
                    hot.Emit(new ParticleSystem.EmitParams {position=start,
                        velocity=fan*Random.Range(1.6f,6.7f)+Vector3.up*Random.Range(.28f,4.1f)},1);
                    soot.Emit(new ParticleSystem.EmitParams {position=start+Vector3.up*.49f,
                        velocity=fan*Random.Range(.56f,2.46f)+Vector3.up*Random.Range(.52f,2.35f)},1);
                }
                if(i%2==0)
                    dust.Emit(new ParticleSystem.EmitParams {position=start-Vector3.up*.42f,
                        velocity=fan*Random.Range(1.6f,4.32f)+Vector3.up*Random.Range(.14f,.67f)},1);
                embers.Emit(new ParticleSystem.EmitParams {position=start,
                    velocity=fan*Random.Range(5.5f,15.2f)+Vector3.up*Random.Range(1.2f,8.8f)},1);
            }
        }

        static IEnumerator DecayBlastLight(Light light)
        {
            var start=Time.time;
            while(light)
            {
                var elapsed=Time.time-start;
                if(elapsed>=.52f) break;
                light.intensity=26*Mathf.Exp(-elapsed*26)+3.1f*(1-Mathf.SmoothStep(0,1,elapsed/.52f));
                light.color=Color.Lerp(new Color(1,.87f,.61f),new Color(1,.49f,.12f),elapsed/.28f);
                yield return null;
            }
            if(light) Destroy(light.gameObject);
        }

        ParticleSystem FireParticles(Vector3 at,string name,float scale,float rise)
        {
            var fire=AtmosphereParticles(at,name,ParticleLook.Flame,true,.36f,.86f,.31f*scale,1.29f*scale,
                .60f*rise,1.62f*rise,-.17f,new Color(1,1,1,.92f),31);
            fire.transform.rotation=Quaternion.LookRotation(Vector3.up,Vector3.forward);
            var cone=fire.shape;
            cone.radius=scale*.22f;
            cone.angle=23;
            var smoke=AtmosphereParticles(at+Vector3.up*.29f*scale,"Rising soot",ParticleLook.Smoke,true,
                .88f,2.83f,.62f*scale,1.43f*scale,.30f*rise,1.36f*rise,-.061f,new Color(.31f,.30f,.28f,.66f),8);
            smoke.transform.SetParent(fire.transform,true);
            smoke.transform.rotation=Quaternion.LookRotation(Vector3.up,Vector3.forward);
            var lift=smoke.shape;
            lift.angle=29;
            lift.radius=scale*.24f;
            var embers=AtmosphereParticles(at+Vector3.up*.24f*scale,"Fire embers",ParticleLook.Ember,true,
                .43f,1.91f,.016f,.048f,.42f,1.56f,-.07f,new Color(1,.42f,.059f,.98f),15);
            embers.transform.SetParent(fire.transform,true);
            embers.transform.rotation=Quaternion.LookRotation(Vector3.up,Vector3.forward);
            var spray=embers.shape;
            spray.radius=scale*.29f;
            spray.angle=37;
            burningEmitters.Add((fire,scale));
            return fire;
        }

        void StopFire(ParticleSystem flame)
        {
            if(!flame) return;
            burningEmitters.RemoveAll(entry=>entry.flame==flame);
            flame.Stop(true,ParticleSystemStopBehavior.StopEmitting);
            Destroy(flame.gameObject,3);
        }

        void OnDestroy()
        {
            foreach(var material in atmosphere) if(material) Destroy(material);
        }
    }
}
