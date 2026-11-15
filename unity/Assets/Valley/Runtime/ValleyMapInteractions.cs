using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;
using Random=UnityEngine.Random;

namespace ValleyCamcorder
{
    internal sealed class ValleyMapInteractions : MonoBehaviour
    {
        [Serializable] internal sealed class Part
        {
            public int id,valve;
            public string label;
            public float[] useAt,useSize,grip,lampAt,flameAt,sparkAt,flowAt,leakAt,leakVelocity;
            public int[] flame,spark,flow,remnant;
        }
        [Serializable] sealed class Breach {public float[] at; public int[] meshes; public ValleyManifest.Box[] boxes;}
        [Serializable] sealed class Site
        {
            public float radius;
            public float[] at;
            public int tank;
            public int[] collapse,fixtures,lights,monitors;
            public Breach[] breaches;
        }
        [Serializable] sealed class Debris {public int[] glass,ceramic;}
        [Serializable] sealed class Floor
        {
            public float left,far,step;
            public int width,height;
            public string[] labels;
            public string values;
        }
        [Serializable] sealed class Tent
        {
            public int id;
            public float wide,@long,tall,height,spring,width,floor;
        }
        [Serializable] sealed class Data
        {
            public Part[] fixtures;
            public Site[] services;
            public Debris debris;
            public Floor floor;
            public ValleyMonitor.Recipe[] monitors;
            public Tent[] tents;
        }
        readonly Dictionary<int,(Mesh mesh,Material material)> meshes=new();
        readonly Dictionary<ValleyFixture,Site> tanks=new();
        readonly List<(Light light,ValleyFixture item)> lamps=new();
        readonly List<AudioSource> flows=new();
        ValleyFixture[] indexed, all;
        ValleyPlayer player;
        ValleyAudio audio;
        Debris debris;
        Floor floor;
        byte[] footBanks;
        Tent[] tents=Array.Empty<Tent>();
        Material tint, painted;
        const int EffectBudget=22;
        float nextLampCheck, nextFireDamage;
        int leakyPipes;
        internal int Leaks => leakyPipes;

        public void Bind(ValleyManifest manifest,ValleyPlayer owner,ValleyAudio sound)
        {
            player=owner; audio=sound;
            var file=Resources.Load<TextAsset>("ValleyMap/Fixtures");
            if(!file) return;
            var recipe=JsonUtility.FromJson<Data>(file.text);
            debris=recipe.debris;
            if(recipe.tents!=null) tents=recipe.tents;
            floor=recipe.floor;
            if(!string.IsNullOrEmpty(floor?.values)) footBanks=Convert.FromBase64String(floor.values);
            all=FindObjectsByType<ValleyFixture>(FindObjectsInactive.Include,FindObjectsSortMode.None);
            var kinds=all.ToLookup(item=>item.kind);
            indexed=new ValleyFixture[manifest.objects.Length];
            var bound=new HashSet<ValleyFixture>();
            for(int i=0;i<indexed.Length;i++)
            {
                var part=manifest.objects[i];
                var p=new Vector3(part.matrix[12],part.matrix[13],-part.matrix[14]);
                var items=kinds[part.kind];
                var bestDistance=.006f*.006f;
                foreach(var item in items)
                {
                    if(bound.Contains(item)) continue;
                    var distance=(item.transform.position-p).sqrMagnitude;
                    if(distance>=bestDistance) continue;
                    indexed[i]=item;
                    bestDistance=distance;
                }
                if(indexed[i]) bound.Add(indexed[i]);
            }
            var materials=new Dictionary<int,Material>();
            foreach(var part in FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None))
            {
                var mat=part.sharedMaterial;
                if(mat && mat.HasProperty("_Kind")) materials.TryAdd(mat.GetInt("_Kind"),mat);
            }
            painted=materials[12];
            tint=new Material(painted) {name="Tinted Valley effects"};
            tint.SetFloat("_Kind",30);
            foreach(var mesh in Resources.LoadAll<Mesh>("ValleyMap/Parts"))
            {
                var fields=mesh.name.Split('-');
                var kind=int.Parse(fields[2]);
                meshes[int.Parse(fields[1])]=(mesh,materials.GetValueOrDefault(kind,kind==30 ? tint : painted));
            }
            var playerCollider=player.GetComponent<CharacterController>();
            foreach(var item in all)
            {
                item.effects=this;
                ValleyFabric.Add(item,playerCollider);
            }
            foreach(var part in recipe.fixtures)
            {
                var item=indexed[part.id];
                if(!item) continue;
                item.Link(part,this);
                if(part.valve>=0) item.gasValve=indexed[part.valve];
                if(HasPoint(part.lampAt))
                {
                    var node=Create("Room light",ValleyManifest.Point(part.lampAt),item.transform);
                    var lamp=node.gameObject.AddComponent<Light>();
                    lamp.color=new Color(1,.87f,.68f);
                    lamp.range=4.7f;
                    lamp.intensity=1.55f;
                    lamp.enabled=false;
                    lamps.Add((lamp,item));
                }
            }
            foreach(var site in recipe.services)
                if(site.tank>=0 && indexed[site.tank]) tanks[indexed[site.tank]]=site;
            if(recipe.monitors!=null)
                foreach(var monitor in recipe.monitors)
                {
                    var item=indexed[monitor.id];
                    if(!item) continue;
                    var device=item.gameObject.AddComponent<ValleyMonitor>();
                    device.listener=owner.view;
                    device.views=monitor.views;
                }
        }

        public static bool HasPoint(float[] values) => values!=null && values.Length>=3;
        internal string GroundBank(Vector3 at)
        {
            if(footBanks==null || footBanks.Length!=floor.width*floor.height) return "dirtLeaf";
            int x=Mathf.RoundToInt((at.x-floor.left)/floor.step);
            int z=Mathf.RoundToInt((-at.z-floor.far)/floor.step);
            if(x<0 || x>=floor.width || z<0 || z>=floor.height) return "dirtLeaf";
            return floor.labels[footBanks[z*floor.width+x]];
        }

        internal bool InsideTent(Vector3 at)
        {
            foreach(var tent in tents)
            {
                var item=indexed[tent.id];
                if(!item || item.Broken || item.CollapsedFabric) continue;
                var local=item.transform.InverseTransformPoint(at);
                if(local.y<-.48f || local.y>tent.tall) continue;
                if(Ellipse(local,tent.wide,tent.@long)<1) return true;
            }
            return false;
        }

        internal bool CanEnterTent(Vector3 from,Vector3 at,float eye,bool low)
        {
            foreach(var tent in tents)
            {
                var item=indexed[tent.id];
                if(!item || item.Broken || item.CollapsedFabric) continue;
                var local=item.transform.InverseTransformPoint(at);
                if(local.y<-.48f || local.y>tent.tall || Ellipse(local,tent.wide+.17f,tent.@long+.17f)>=1) continue;
                var shape=Ellipse(local,tent.wide,tent.@long);
                if(shape>=1 && shape>Ellipse(item.transform.InverseTransformPoint(from),tent.wide,tent.@long)) continue;
                if(!low) return false;
                var head=tent.floor+eye+.063f;
                var roof=.022f+tent.tall*Mathf.Sqrt(Mathf.Max(0,1-shape));
                if(head+.044f<roof) continue;
                var arch=Mathf.InverseLerp(tent.spring,tent.height,head);
                if(local.z>.13f && Mathf.Abs(local.x)<tent.width*Mathf.Sqrt(1-arch*arch)-.125f) continue;
                return false;
            }
            return true;
        }

        static float Ellipse(Vector3 at,float width,float length)
            => at.x*at.x/(width*width)+at.z*at.z/(length*length);
        internal void Cue(string name,Vector3 at,float volume=1) => audio.WorldCue(name,at,volume);

        void Update()
        {
            if(!player || Time.time<nextLampCheck) return;
            nextLampCheck=Time.time+.13f;
            foreach(var (light,item) in lamps)
            {
                if(light && light.gameObject.activeInHierarchy)
                    light.enabled=item.enabledState && (light.transform.position-player.transform.position).sqrMagnitude<14*14;
            }
            flows.RemoveAll(flow=>!flow);
        }

        Transform Create(string name,Vector3 at,Transform parent=null)
        {
            var node=new GameObject(name).transform;
            node.SetParent(parent ? parent : transform,false);
            node.position=at;
            return node;
        }

        internal GameObject Draw(int[] ids,Vector3 at,Transform parent,string name)
        {
            if(ids==null || ids.Length==0) return null;
            var node=Create(name,at,parent);
            foreach(var id in ids)
            {
                if(!meshes.TryGetValue(id,out var item)) continue;
                var part=Create("Surface",at,node);
                part.gameObject.AddComponent<MeshFilter>().sharedMesh=item.mesh;
                var renderer=part.gameObject.AddComponent<MeshRenderer>();
                renderer.sharedMaterial=item.material;
                renderer.shadowCastingMode=ShadowCastingMode.Off;
            }
            return node.gameObject;
        }

        internal AudioSource Pipe(string key,Vector3 at,Transform parent,float volume)
        {
            var source=audio.WorldLoop(key,at,parent,volume);
            if(source) flows.Add(source);
            return source;
        }

        internal void Shatter(ValleyFixture item,Vector3 at,bool sound=true,bool fragments=true)
        {
            var spec=item.Recipe;
            var ceramic=item.kind!="glass";
            var source=ceramic ? debris?.ceramic : debris?.glass;
            if(fragments && source?.Length>0)
            {
                var (mesh,material)=meshes[source[Random.Range(0,source.Length)]];
                var particles=Particles(at,"Glass and ceramic fragments",material,false,.25f,1.2f,.036f,.13f,2.2f,7,1);
                var renderer=particles.GetComponent<ParticleSystemRenderer>();
                renderer.renderMode=ParticleSystemRenderMode.Mesh;
                renderer.mesh=mesh;
                var rotation=particles.rotationOverLifetime;
                rotation.enabled=true;
                rotation.z=new ParticleSystem.MinMaxCurve(-6,8);
                particles.Emit(18);
            }
            if(sound) Cue(item.kind=="glass" ? "window" : item.kind=="ceramic" ? "ceramic" : "small",at,.94f);
            if(spec!=null && HasPoint(spec.leakAt))
            {
                leakyPipes++;
                var remnant=Draw(spec.remnant,item.transform.position,transform,"Broken fixture base");
                if(remnant) remnant.transform.rotation=item.transform.rotation;
                var outlet=ValleyManifest.Point(spec.leakAt);
                var direction=ValleyManifest.Point(spec.leakVelocity);
                var water=Particles(outlet,"Damaged pipe spray",tint,true,.47f,1.43f,.018f,.065f,
                    direction.magnitude*.79f,direction.magnitude*1.38f,1.15f,new Color(.67f,.86f,.94f,.86f),90);
                water.transform.rotation=Quaternion.LookRotation(direction);
                Pipe("pipe-water",outlet,water.transform,.71f);
            }
        }

        internal void Burst(ValleyFixture tank)
        {
            if(!tanks.Remove(tank,out var site)) return;
            var at=ValleyManifest.Point(site.at);
            var radius=site.radius;
            Cue("blast",at,1);
            var flash=Create("Blast flash",at);
            var light=flash.gameObject.AddComponent<Light>();
            light.color=new Color(1,.65f,.23f);
            light.range=radius;
            light.intensity=7.5f;
            Destroy(flash.gameObject,.24f);
            var spark=Particles(at,"Blast flash and embers",tint,false,.38f,1.45f,.09f,.54f,5,radius*.65f,.54f,
                new Color(1,.49f,.13f));
            spark.Emit(57);
            var smoke=Particles(at,"Blast smoke and dust",tint,false,2,4,.65f,2.2f,1.8f,radius*.27f,-.18f,
                new Color(.26f,.22f,.18f,.64f));
            smoke.Emit(44);
            foreach(var id in site.collapse) Collapse(indexed[id],at,9);
            foreach(var breach in site.breaches)
            {
                var wall=Draw(breach.meshes,at,transform,"Breached wall");
                if(!wall) continue;
                ValleyManifest.ApplyMatrix(wall.transform,breach.at);
                foreach(var box in breach.boxes)
                {
                    var node=Create("Remaining wall collision",ValleyManifest.Point(box.at),wall.transform);
                    node.rotation=ValleyManifest.Turn(box.yaw);
                    node.gameObject.AddComponent<BoxCollider>().size=ValleyManifest.Size(box.size);
                }
                Scorch(wall,new Color(.41f,.34f,.28f));
            }
            var fragSounds=new HashSet<string>();
            int shards=0, burning=0;
            foreach(var id in site.lights) if(indexed[id]) indexed[id].Shutdown();
            if(site.monitors!=null)
                foreach(var id in site.monitors) if(indexed[id]) indexed[id].Shutdown();
            foreach(var id in site.fixtures)
            {
                var item=indexed[id];
                if(!item || !item.gameObject.activeInHierarchy || item.Broken) continue;
                if(item.kind is "burner" or "valve") item.Shutdown();
                var range=Vector3.Distance(at,item.transform.position);
                if(item.kind=="door" && item.Recipe?.label!="WINDOW" && range<radius*.65f &&
                    (item.transform.position.y-at.y<3 || range<8.4f)) Collapse(item,at,6);
            }
            foreach(var item in all.OrderBy(item=>(item.transform.position-at).sqrMagnitude))
            {
                if(!item || !item.gameObject.activeInHierarchy || item.Broken) continue;
                var p=item.transform.position;
                var distance=Vector3.Distance(at,p);
                if(distance>radius) break;
                if((item.kind is "glass" or "ceramic") && distance<radius*(item.kind=="glass" ? .76f : .44f))
                    item.Break(p,fragSounds.Add(item.kind),shards++<EffectBudget);
                else if(item.portable && !item.IsCarried && distance<radius*.72f)
                    item.Nudge((p-at).normalized*8, p+Vector3.up*.54f,1.8f);
                else if(item.kind is "woodFloor" or "woodStair")
                {
                    if(distance<radius*.59f) Ignite(item,burning++<EffectBudget);
                }
                else if(distance<radius*.43f && (item.kind is "wallPanel" or "detail" or "serviceFittings"))
                    Scorch(item.gameObject,new Color(.41f,.34f,.28f));
            }
            var exposure=1-Mathf.InverseLerp(radius*.12f,radius,Vector3.Distance(player.transform.position,at));
            if(exposure>0) player.HitByBlast(at,exposure);
        }

        internal void Ignite(ValleyFixture item,bool visible=true)
        {
            if(item.Burning || item.Broken) return;
            item.Burning=true;
            StartCoroutine(Burn(item,visible));
        }

        IEnumerator Burn(ValleyFixture item,bool visible)
        {
            var p=item.transform.position+Vector3.up*.16f;
            ParticleSystem flame=null;
            if(visible)
                flame=Particles(p,"Burning timber",tint,true,.21f,.66f,.09f,.27f,.5f,2,-.2f,new Color(1,.31f,.065f),22);
            var delay=item.kind=="woodStair" ? Random.Range(4.0f,6.3f) : Random.Range(5.3f,9.6f);
            Scorch(item.gameObject,new Color(.49f,.34f,.21f));
            var time=Time.time+delay;
            while(item && item.gameObject.activeSelf && Time.time<time)
            {
                if(Time.time>=nextFireDamage && Vector3.Distance(item.transform.position,player.transform.position)<1.25f)
                {
                    player.FireDamage(6);
                    nextFireDamage=Time.time+.65f;
                }
                yield return null;
            }
            if(flame) {flame.Stop();Destroy(flame.gameObject,1.1f);}
            if(item && item.gameObject.activeSelf) Collapse(item,p,4,visible);
        }

        void Collapse(ValleyFixture item,Vector3 from,float force,bool visible=true)
        {
            if(!item || item.Broken || !item.gameObject.activeSelf) return;
            var p=item.transform.position;
            if(visible)
            {
                var dust=Particles(p,"Collapsing structure",tint,false,.55f,1.7f,.05f,.43f,
                    force*.31f,force,1.14f,new Color(.46f,.29f,.18f,.94f));
                var push=(p-from).normalized+Vector3.up*.23f;
                dust.transform.rotation=Quaternion.LookRotation(push);
                dust.Emit(19);
                if(item.Burning) Cue("timber",p,.38f);
            }
            item.Disable();
        }

        internal static void Scorch(GameObject item,Color color)
        {
            var block=new MaterialPropertyBlock();
            foreach(var renderer in item.GetComponentsInChildren<MeshRenderer>())
            {
                renderer.GetPropertyBlock(block);
                block.SetColor("_BaseColor",color);
                renderer.SetPropertyBlock(block);
            }
        }

        ParticleSystem Particles(Vector3 at,string name,Material material,bool loop,float shortLife,float longLife,
            float small,float large,float slow,float fast,float gravity,Color? color=null,int rate=0)
        {
            var node=Create(name,at);
            var ps=node.gameObject.AddComponent<ParticleSystem>();
            ps.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
            var main=ps.main;
            main.loop=loop;
            main.startLifetime=new ParticleSystem.MinMaxCurve(shortLife,longLife);
            main.startSpeed=new ParticleSystem.MinMaxCurve(slow,fast);
            main.startSize=new ParticleSystem.MinMaxCurve(small,large);
            main.gravityModifier=gravity;
            main.simulationSpace=ParticleSystemSimulationSpace.World;
            main.maxParticles=125;
            if(color.HasValue) main.startColor=color.Value;
            var shape=ps.shape;
            shape.shapeType=loop ? ParticleSystemShapeType.Cone : ParticleSystemShapeType.Sphere;
            shape.radius=loop ? .025f : .11f;
            shape.angle=loop ? 14 : 32;
            var emission=ps.emission;
            emission.rateOverTime=rate;
            var renderer=node.GetComponent<ParticleSystemRenderer>();
            renderer.sharedMaterial=material;
            renderer.shadowCastingMode=ShadowCastingMode.Off;
            ps.Play();
            if(!loop) Destroy(node.gameObject,longLife+.16f);
            return ps;
        }
    }
}
