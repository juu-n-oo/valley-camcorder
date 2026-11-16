using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;
using Random=UnityEngine.Random;

namespace ValleyCamcorder
{
    internal sealed partial class ValleyMapInteractions
    {
        [Serializable] sealed class Alarm { public float[] at;public int mesh; }
        [Serializable] sealed class Sprinkler { public float[] at;public float bottom,spread; }
        [Serializable] sealed class FireSurface {public float[] at,normal;public float size;public string kind;public bool priority;}
        [Serializable] sealed class Tree {public float[] at,root;public float height;public int mesh;}
        sealed class Response
        {
            public float started;
            public Site site;
            public readonly List<GameObject> lamps=new();
            public readonly List<ParticleSystem> jets=new();
        }

        readonly List<Response> responses=new();
        readonly HashSet<ValleyFixture> queuedFires=new();
        readonly HashSet<int> burnedTrees=new();
        Tree[] nearbyTrees=Array.Empty<Tree>();
        AudioSource alarmSound,spraySound;
        Material scorchDecal;
        internal int ActiveAlarms => responses.Sum(item=>item.lamps.Count);
        internal int ActiveSprinklers => responses.Sum(item=>item.jets.Count);
        internal int ScorchCount {get;private set;}

        void StartFireResponse(Site site)
        {
            var response=new Response {site=site,started=Time.time};
            responses.Add(response);
            StartCoroutine(EnableSystems(response));
        }

        IEnumerator EnableSystems(Response response)
        {
            var site=response.site;
            yield return new WaitForSeconds(.56f);
            if(site.alarms!=null)
                foreach(var alarm in site.alarms)
                {
                    var lamp=Draw(new[] {alarm.mesh},ValleyManifest.Point(alarm.at),transform,"Flashing fire alarm");
                    if(lamp) response.lamps.Add(lamp);
                }
            yield return new WaitForSeconds(.56f);
            if(site.sprinklers==null) yield break;
            foreach(var sprinkler in site.sprinklers)
            {
                var at=ValleyManifest.Point(sprinkler.at);
                var height=Mathf.Max(.45f,at.y-sprinkler.bottom);
                var jet=Particles(at,"Ceiling sprinkler",particles,true,.45f,height*.31f+.28f,.012f,.031f,.8f,1.8f,
                    .98f,new Color(.64f,.82f,.94f,.74f),55);
                jet.transform.rotation=Quaternion.LookRotation(Vector3.down,Vector3.forward);
                var cone=jet.shape;
                cone.angle=Mathf.Clamp(Mathf.Atan2(sprinkler.spread,height)*Mathf.Rad2Deg,8,45);
                cone.radius=.026f;
                response.jets.Add(jet);
            }
        }

        void UpdateFireResponse(float now)
        {
            if(responses.Count==0) return;
            var listener=player.view.transform.position;
            var alarmAt=Vector3.zero;
            var sprayAt=Vector3.zero;
            var alarmGain=0f;
            var sprayGain=0f;
            foreach(var response in responses)
            {
                var elapsed=now-response.started;
                foreach(var lamp in response.lamps)
                {
                    var source=lamp.transform.position;
                    var distance=SoundDistance(listener,source);
                    var gain=.56f*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(2,37,distance)));
                    if(gain>alarmGain) {alarmAt=source; alarmGain=gain;}
                    lamp.SetActive(distance<44 && (elapsed-.56f)%1.16f<.17f);
                }
                foreach(var jet in response.jets)
                {
                    var source=jet.transform.position;
                    var distance=SoundDistance(listener,source);
                    var gain=.65f*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(1.7f,12,distance)));
                    if(gain>sprayGain) {sprayAt=source;sprayGain=gain;}
                    var emission=jet.emission;
                    emission.enabled=distance<25 && Mathf.Abs(source.y-listener.y)<4.6f;
                }
            }
            FireLoop(ref alarmSound,"venue-alarm",alarmAt,alarmGain);
            FireLoop(ref spraySound,"venue-spray",sprayAt,sprayGain);
        }

        void FireLoop(ref AudioSource source,string bank,Vector3 at,float gain)
        {
            if(!source && gain>.003f)
            {
                source=audio.WorldLoop(bank,at,transform,gain);
                if(source) source.rolloffMode=AudioRolloffMode.Custom;
                if(source) source.SetCustomCurve(AudioSourceCurveType.CustomRolloff,AnimationCurve.Constant(0,1,1));
            }
            if(!source) return;
            if(gain>.003f) source.transform.position=at;
            source.volume=Mathf.Lerp(source.volume,gain,.61f);
        }

        static float SoundDistance(Vector3 a,Vector3 b)
        {
            var separation=a-b;
            separation.y*=1.65f;
            return separation.magnitude;
        }

        void SpreadFromBlast(Site site,Vector3 at)
        {
            var surfaces=site.surfaces??Array.Empty<FireSurface>();
            foreach(var surface in surfaces.OrderByDescending(fire=>fire.priority).Take(15))
            {
                var center=ValleyManifest.Point(surface.at);
                var normal=ValleyManifest.Point(surface.normal);
                if(player.world.Map.RiverAbove(center-Vector3.up*.022f)) continue;
                StartCoroutine(BurnSpot(center,normal,surface.size, .30f+Vector3.Distance(at,center)*.14f,null));
            }
            if(site.reception!=null)
                foreach(var id in site.reception.Take(5))
                {
                    var fixture=indexed[id];
                    if(!fixture || !fixture.gameObject.activeInHierarchy || fixture.IsCarried) continue;
                    StartCoroutine(BurnSpot(fixture.transform.position+Vector3.up*Mathf.Max(.13f,fixture.size.y*.80f),
                        Vector3.up,.52f,1+Vector3.Distance(at,fixture.transform.position)*.13f,fixture));
                }
            var timbers=all.Where(item=>item && item.gameObject.activeInHierarchy && IsTimber(item) &&
                (item.transform.position-at).sqrMagnitude<(site.radius*.64f)*(site.radius*.64f))
                .OrderBy(item=>(item.transform.position-at).sqrMagnitude).ToArray();
            // Each visible breach has an initial burning stair and floor where
            // present. Subsequent pieces catch from their burning neighbours.
            var stairs=timbers.FirstOrDefault(item=>item.kind=="woodStair");
            if(stairs) QueueFire(stairs,.08f,0);
            foreach(var part in timbers.Where(item=>item.kind=="woodFloor").Take(7))
                QueueFire(part,.32f+Vector3.Distance(at,part.transform.position)*.14f,0);

            for(int i=0;i<nearbyTrees.Length;i++)
            {
                var tree=nearbyTrees[i];
                var p=ValleyManifest.Point(tree.at);
                var radius=Vector3.Distance(p,at);
                if(radius>=14.9f || !burnedTrees.Add(i)) continue;
                StartCoroutine(BurnTree(tree,.75f+radius*.28f));
                if(burnedTrees.Count>24) break;
            }
            if(site.fragments is {Length:>0})
                for(int i=0;i<Mathf.Min(22,site.fragments.Length*3);i++)
                {
                    var part=meshes[site.fragments[i%site.fragments.Length]];
                    var motion=Random.insideUnitSphere*site.radius*.22f+Vector3.up*Random.Range(1,3.9f);
                    Fragment(part.mesh,part.material,at+Random.insideUnitSphere*.42f,Random.rotation,
                        Vector3.one*Random.Range(.39f,1.08f),motion);
                }
        }

        static bool IsTimber(ValleyFixture part) => part.kind is "woodFloor" or "woodStair";

        void QueueFire(ValleyFixture item,float delay,int generation)
        {
            if(!queuedFires.Add(item)) return;
            StartCoroutine(BurnTimber(item,delay,generation));
        }

        IEnumerator BurnTimber(ValleyFixture item,float delay,int generation)
        {
            yield return new WaitForSeconds(delay);
            if(!item || item.Broken || item.Burning) yield break;
            Ignite(item,true);
            if(generation>=2) yield break;
            yield return new WaitForSeconds(1.73f);
            if(item && !item.Broken) SpreadToNeighbour(item.transform.position, generation+1);
        }

        void SpreadToNeighbour(Vector3 origin,int generation)
        {
            if(generation>2 || queuedFires.Count>105) return;
            foreach(var item in all.Where(part=>part && !part.Broken && IsTimber(part) && !queuedFires.Contains(part))
                .Where(part=>Mathf.Abs(part.transform.position.y-origin.y)<1.2f &&
                    (part.transform.position-origin).sqrMagnitude<2.5f*2.5f)
                .OrderBy(part=>(part.transform.position-origin).sqrMagnitude).Take(2))
            {
                var at=item.transform.position;
                if(player.world.Map.RiverAbove(at-Vector3.up*.022f)) continue;
                var path=at-origin;
                if(Physics.Raycast(origin+Vector3.up*.11f,path,out var separation,path.magnitude*.95f,
                    Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore) &&
                    separation.collider.GetComponentInParent<ValleyFixture>()!=item) continue;
                QueueFire(item,.23f,generation);
            }
        }

        IEnumerator BurnSpot(Vector3 at,Vector3 normal,float size,float delay,ValleyFixture target)
        {
            yield return new WaitForSeconds(delay);
            if(target && (target.Broken || target.IsCarried)) yield break;
            var flame=FireParticles(at,"Spreading fire",size,.74f);
            yield return new WaitForSeconds(.51f);
            if(target) Scorch(target.gameObject,new Color(.32f,.25f,.18f));
            else LeaveScorch(at,normal,size);
            if(target) SpreadToNeighbour(at,1);
            yield return new WaitForSeconds(target ? 8.6f : 2.8f);
            flame.Stop();
            Destroy(flame.gameObject,1.1f);
        }

        IEnumerator BurnTree(Tree tree,float delay)
        {
            yield return new WaitForSeconds(delay);
            var at=ValleyManifest.Point(tree.at)+Vector3.up*.21f;
            var flame=FireParticles(at,"Tree base fire",Mathf.Clamp(tree.height*.14f,.5f,1.2f),1.36f);
            yield return new WaitForSeconds(1.16f);
            Draw(new[] {tree.mesh},ValleyManifest.Point(tree.root),transform,"Scorched tree bark");
            LeaveScorch(at-Vector3.up*.19f,Vector3.up,.81f);
            yield return new WaitForSeconds(9.2f);
            flame.Stop();
            Destroy(flame.gameObject,1.1f);
        }

        ParticleSystem FireParticles(Vector3 at,string name,float scale,float rise)
        {
            var fire=Particles(at,name,tint,true,.27f,.78f,.11f*scale,.54f*scale,.64f*rise,2.1f*rise,-.19f,
                new Color(1,.34f,.062f,.82f),24);
            fire.transform.rotation=Quaternion.LookRotation(Vector3.up,Vector3.forward);
            return fire;
        }

        void LeaveScorch(Vector3 at,Vector3 normal,float size)
        {
            if(normal.sqrMagnitude<.5f) normal=Vector3.up;
            if(!scorchDecal)
            {
                scorchDecal=new Material(particles) {name="Persistent soot",renderQueue=(int)RenderQueue.Transparent-2};
                scorchDecal.SetFloat("_Kind",37);
                scorchDecal.SetFloat("_Opacity",.90f);
            }
            var decal=GameObject.CreatePrimitive(PrimitiveType.Quad);
            decal.name="Scorch on surface";
            var collision=decal.GetComponent<Collider>();
            collision.enabled=false;
            Destroy(collision);
            decal.transform.SetParent(transform,false);
            var up=Mathf.Abs(normal.y)>.95f ? Vector3.forward : Vector3.up;
            decal.transform.SetPositionAndRotation(at+normal*.012f,Quaternion.LookRotation(normal,up));
            decal.transform.localScale=new Vector3(size*1.54f,size*2.1f,1);
            var drawing=decal.GetComponent<MeshRenderer>();
            drawing.sharedMaterial=scorchDecal;
            drawing.shadowCastingMode=ShadowCastingMode.Off;
            ScorchCount++;
        }
    }
}
