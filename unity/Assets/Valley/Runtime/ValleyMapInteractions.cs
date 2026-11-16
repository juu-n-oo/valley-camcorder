using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;
using Random=UnityEngine.Random;

namespace ValleyCamcorder
{
    internal sealed partial class ValleyMapInteractions : MonoBehaviour
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
            public int[] collapse,fixtures,lights,monitors,reception,fragments;
            public Breach[] breaches;
            public Alarm[] alarms;
            public Sprinkler[] sprinklers;
            public FireSurface[] surfaces;
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
            public float[] ramp;
        }
        [Serializable] sealed class Prop
        {
            public int id,parent;
            public bool mounted,fragile;
            public float health,air;
            public float[] surface;
        }
        [Serializable] sealed class Wheel {public int id,hub;}
        [Serializable] sealed class Vehicle {public float[] at;public float yaw;}
        [Serializable] sealed class Data
        {
            public Part[] fixtures;
            public Site[] services;
            public Debris debris;
            public Floor floor;
            public ValleyMonitor.Recipe[] monitors;
            public Tent[] tents;
            public Prop[] props;
            public Wheel[] wheels;
            public Vehicle[] vehicles;
            public Tree[] trees;
            public ValleyLocation places;
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
        Vehicle[] vehicles=Array.Empty<Vehicle>();
        ValleyLocation places;
        Material tint, painted, particles;
        const int EffectBudget=22;
        float nextLampCheck, nextFireDamage;
        int leakyPipes;
        int timberFragment=-1;
        internal int Leaks => leakyPipes;
        internal Material ParticleMaterial => particles;
        internal ValleyPlayer Operator => player;

        public void Bind(ValleyManifest manifest,ValleyPlayer owner,ValleyAudio sound)
        {
            player=owner; audio=sound;
            var file=Resources.Load<TextAsset>("ValleyMap/Fixtures");
            if(!file) return;
            var recipe=JsonUtility.FromJson<Data>(file.text);
            debris=recipe.debris;
            if(recipe.tents!=null) tents=recipe.tents;
            if(recipe.vehicles!=null) vehicles=recipe.vehicles;
            if(recipe.trees!=null) nearbyTrees=recipe.trees;
            if(recipe.services is {Length:>0} && recipe.services[0].fragments is {Length:>0})
                timberFragment=recipe.services[0].fragments[^1];
            places=recipe.places;
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
            foreach(var part in FindObjectsByType<MeshRenderer>())
            {
                var mat=part.sharedMaterial;
                if(mat && mat.HasProperty("_Kind")) materials.TryAdd(mat.GetInt("_Kind"),mat);
            }
            painted=materials[12];
            tint=new Material(painted) {name="Tinted Valley effects"};
            tint.SetFloat("_Kind",30);
            particles=new Material(tint) {name="Translucent Valley effects",renderQueue=(int)RenderQueue.Transparent};
            particles.SetFloat("_ZWrite",0);
            particles.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);
            particles.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);
            particles.SetFloat("_Opacity",.67f);
            foreach(var mesh in Resources.LoadAll<Mesh>("ValleyMap/Parts"))
            {
                var fields=mesh.name.Split('-');
                var kind=int.Parse(fields[2]);
                meshes[int.Parse(fields[1])]=(mesh,materials.GetValueOrDefault(kind,kind==30 ? tint :
                    kind==38 ? materials.GetValueOrDefault(3,painted) : painted));
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
            if(recipe.props!=null)
                foreach(var prop in recipe.props)
                {
                    var item=indexed[prop.id];
                    if(item) item.ConfigureProp(prop.parent>=0 ? indexed[prop.parent] : null,
                        prop.mounted,prop.surface,prop.fragile,prop.health,prop.air);
                }
            if(recipe.wheels!=null)
                foreach(var wheel in recipe.wheels)
                    if(indexed[wheel.id]) indexed[wheel.id].SetWheelHub(indexed[wheel.hub]);
            foreach(var tent in tents)
                if(indexed[tent.id] && tent.ramp?.Length==5) TentColliders(indexed[tent.id],tent);
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

        void TentColliders(ValleyFixture item,Tent tent)
        {
            var platform=Create("Tent mat collision",item.transform.position,item.transform);
            platform.localPosition=new Vector3(0,tent.floor-.022f,0);
            platform.localRotation=Quaternion.identity;
            platform.gameObject.AddComponent<BoxCollider>().size=new Vector3(tent.wide*1.43f,.044f,tent.@long*1.51f);
            platform.gameObject.AddComponent<ValleySurface>().bank="mat";
            var path=tent.ramp;
            var a=new Vector3(0,path[4]-item.transform.position.y,-path[0]);
            var b=new Vector3(0,tent.floor,-path[2]);
            var ramp=Create("Tent entrance collision",item.transform.position,item.transform);
            ramp.SetLocalPositionAndRotation((a+b)*.5f-Vector3.up*.017f,Quaternion.LookRotation(b-a));
            ramp.gameObject.AddComponent<BoxCollider>().size=new Vector3(path[3]*2,.034f,Vector3.Distance(a,b));
            ramp.gameObject.AddComponent<ValleySurface>().bank="mat";
        }

        internal bool UnderCarRoof(Vector3 at)
        {
            foreach(var car in vehicles)
            {
                var offset=at-ValleyManifest.Point(car.at);
                if(Mathf.Abs(offset.x)>1.42f || Mathf.Abs(offset.z)>1.42f || offset.y<=.13f || offset.y>=.62f) continue;
                var local=Quaternion.Inverse(ValleyManifest.Turn(car.yaw))*offset;
                if(Mathf.Abs(local.x)<.67f && local.z>-.58f && local.z<.75f) return true;
            }
            return false;
        }

        internal string PlaceName(Vector3 at,bool submerged,bool swimming,bool wading)
        {
            if(player.world.Map.InRange(at)) return "TARGET RANGE";
            if(InsideTent(at)) return "TENT";
            if(submerged) return "UNDERWATER";
            if(swimming) return "DEEP WATER";
            if(wading) return "SHALLOWS";
            var name=places?.At(at);
            if(!string.IsNullOrEmpty(name)) return name;
            return GroundBank(at) switch
            {
                "outdoorWood"=>"DECK",
                "outdoorStone"=>"ROCKS",
                "grass" or "lawn"=>"FOREST EDGE",
                _=>"SANDBAR"
            };
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

        internal bool NearTentDoor(Vector3 at)
        {
            foreach(var tent in tents)
            {
                var item=indexed[tent.id];
                if(!item || item.Broken || item.CollapsedFabric) continue;
                var local=item.transform.InverseTransformPoint(at);
                if(local.y<-.48f || local.y>tent.tall || Ellipse(local,tent.wide,tent.@long)<1) continue;
                if(Mathf.Abs(local.x)<tent.width+.31f && local.z>.81f*tent.@long && local.z<tent.@long+1.02f) return true;
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
            UpdateFireResponse(Time.time);
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
            StartFireResponse(site);
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
            int shards=0;
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
                else if(distance<radius*.43f && (item.kind is "wallPanel" or "detail" or "serviceFittings"))
                    Scorch(item.gameObject,new Color(.41f,.34f,.28f));
            }
            SpreadFromBlast(site,at);
            var rangeToPlayer=Vector3.Distance(player.transform.position,at);
            var exposure=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(1.35f,radius,rangeToPlayer));
            if(exposure>.034f) player.HitByBlast(at,exposure,rangeToPlayer<2.33f);
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
            var delay=item.kind=="woodStair" ? Random.Range(8.0f,11.0f) : Random.Range(10.0f,14.0f);
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
                if(item.Burning)
                {
                    Cue("structure-collapse",p,.68f);
                    SpillFloorContents(item);
                    TossTimberFragments(item);
                }
            }
            item.Disable();
        }

        void SpillFloorContents(ValleyFixture floor)
        {
            var shape=floor.GetComponentInChildren<Collider>();
            if(!shape) return;
            var bounds=shape.bounds;
            foreach(var item in all)
            {
                if(!item || !item.portable || item.IsCarried || item.Support || item.Broken) continue;
                var p=item.transform.position;
                if(p.x>=bounds.min.x && p.x<=bounds.max.x && p.z>=bounds.min.z && p.z<=bounds.max.z &&
                    p.y>=bounds.max.y-.023f && p.y<=bounds.max.y+.36f) item.Toss(Vector3.down*.39f);
            }
        }

        void TossTimberFragments(ValleyFixture item)
        {
            if(!meshes.TryGetValue(timberFragment,out var timber)) return;
            var center=item.transform.position;
            var collision=item.GetComponentInChildren<Collider>();
            var width=collision ? collision.bounds.extents : Vector3.one*.28f;
            for(int i=0;i<4;i++)
            {
                var at=center+new Vector3(Random.Range(-width.x,width.x),.12f,Random.Range(-width.z,width.z));
                Fragment(timber.mesh,timber.material,at,item.transform.rotation*Random.rotation,
                    Vector3.one*Random.Range(.54f,1.7f),Random.insideUnitSphere*.83f+Vector3.down*.60f);
            }
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

        internal ValleyCharacterDemo CreateAnimationDemo()
        {
            var demo=new GameObject("Valley character animation test").AddComponent<ValleyCharacterDemo>();
            demo.Bind(transform,tint,audio);
            return demo;
        }

        internal ParticleSystem Particles(Vector3 at,string name,Material material,bool loop,float shortLife,float longLife,
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

        internal void Contact(Vector3 at,Vector3 normal,Vector3 direction,string surface,float energy,bool small=false)
        {
            if(energy<.10f || (audio.listener.position-at).sqrMagnitude>52*52) return;
            var bank=surface switch
            {
                "wood"=>"wood-splinter","metal"=>"metal-ricochet","sand"=>"sand-contact",
                "paper"=>"paper-contact","cloth"=>"cloth-contact","vinyl"=>"vinyl-contact",
                "plastic"=>"plastic-contact",_=>"rock-contact"
            };
            Cue(bank,at,Mathf.Min(.98f,energy*(small ? .43f : .74f)));
            if(energy<.28f || surface is "paper" or "cloth" or "vinyl") return;
            bool spark=surface is "metal" or "rock";
            var colour=spark ? new Color(1,.68f,.27f) : surface=="wood" ?
                new Color(.64f,.43f,.27f) : new Color(.58f,.49f,.37f);
            var dust=Particles(at+normal*.023f,spark ? "Impact sparks" : "Impact chips",
                spark ? tint : particles,false,.11f,spark ? .40f : .63f,spark ? .013f : .030f,.051f,.4f,3.5f,.72f,colour);
            var tangent=Vector3.ProjectOnPlane(direction,normal).normalized;
            int count=Mathf.Clamp(Mathf.RoundToInt(7+energy*15),7,30);
            for(int i=0;i<count;i++)
            {
                var fan=normal*.74f+tangent*.42f+Random.insideUnitSphere*.63f;
                dust.Emit(new ParticleSystem.EmitParams {position=at+normal*.023f,
                    velocity=fan.normalized*Random.Range(.83f,3.9f)*Mathf.Min(1.28f,energy)},1);
            }
        }

        internal void BreakFurniture(ValleyFixture item,Vector3 point,Vector3 direction)
        {
            Cue("plastic-break",point,.73f);
            foreach(var source in item.GetComponentsInChildren<MeshFilter>())
            {
                if(source.GetComponentInParent<ValleyFixture>()!=item || !source.sharedMesh) continue;
                var original=source.GetComponent<MeshRenderer>();
                Fragment(source.sharedMesh,original.sharedMaterial,source.transform.position,source.transform.rotation,
                    source.transform.lossyScale,direction.normalized*2.3f+Vector3.up*1.15f+Random.insideUnitSphere*.72f);
            }
            item.Disable();
        }

        void Fragment(Mesh mesh,Material material,Vector3 at,Quaternion turn,Vector3 scale,Vector3 force)
        {
            var part=Create("Loose fragment",at);
            part.SetPositionAndRotation(at,turn);
            part.localScale=scale;
            part.gameObject.AddComponent<MeshFilter>().sharedMesh=mesh;
            part.gameObject.AddComponent<MeshRenderer>().sharedMaterial=material;
            var collider=part.gameObject.AddComponent<BoxCollider>();
            collider.center=mesh.bounds.center;
            collider.size=Vector3.Max(Vector3.one*.024f,mesh.bounds.size);
            var body=part.gameObject.AddComponent<Rigidbody>();
            body.mass=.62f;
            body.linearVelocity=force;
            body.angularVelocity=Random.insideUnitSphere*6.9f;
            part.gameObject.AddComponent<ValleyFragmentSound>().Bind(audio,material.GetInt("_Kind") is 40 or 47 ? "metal-land" : "floor-land");
            Destroy(part.gameObject,30);
        }
    }
}
