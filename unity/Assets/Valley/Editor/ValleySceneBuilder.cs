using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace ValleyCamcorder.Editor
{
    public static class ValleySceneBuilder
    {
        const string Root="Assets/Valley";
        const string Source=Root+"/Source";
        const string Generated=Root+"/Generated";
        const string ScenePath=Root+"/Scenes/HwayangValley.unity";
        const int PlayerLayer=2;

        sealed class Assembly
        {
            public ValleyManifest map;
            public readonly Dictionary<int,(Mesh mesh, int style)> meshes=new();
            public readonly Dictionary<int,Material> materials=new();
            public Material water;
        }

        [MenuItem("Valley/Rebuild Imported Valley Scene")]
        public static void Create()
        {
            var worldAsset=AssetDatabase.LoadAssetAtPath<TextAsset>(Source+"/World.json");
            var handAsset=AssetDatabase.LoadAssetAtPath<GameObject>(Root+"/Blender/Support Hand.fbx");
            if (!worldAsset || !handAsset) throw new InvalidOperationException("The valley source bundle or Blender hand is missing");
            var map=JsonUtility.FromJson<ValleyManifest>(worldAsset.text);
            if (map.format!=1) throw new InvalidOperationException("The Valley importer needs a matching source bundle");
            Directory.CreateDirectory(Generated);
            Directory.CreateDirectory(Root+"/Scenes");
            AssetDatabase.Refresh();

            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var assembly=new Assembly { map=map };
            LoadMeshes(assembly);
            ConfigurePipeline();
            Environment(assembly);
            var landscape=Folder("01  Hwayang Valley");
            var ground=Folder("Terrain",landscape);
            var vegetation=Folder("Forest and riverbanks",landscape);
            var road=Folder("Roads, buildings and structures",landscape);
            var water=Folder("River and waterfall",landscape);
            var collisions=Folder("Terrain and structure physics",landscape);
            var fixtures=Folder("02  Facilities and props");
            var native=Folder("03  First person");
            var horizon=BuildHorizon(assembly,landscape);

            foreach(var id in map.solids)
            {
                var (mesh, style)=assembly.meshes[id];
                var group=style==1 ? ground : style is 2 or 3 or 4 or 5 or 14 ? vegetation : style==21 ? water : road;
                var item=Draw(assembly,id,group);
                if (style==1 && IsWalkZone(map,mesh.bounds))
                    ShapeCollider(item,mesh,"terrain");
            }
            foreach(var id in map.water) Draw(assembly,id,water,true);
            foreach(var id in map.glass) Draw(assembly,id,road);
            foreach(var id in map.stone) InvisibleProxy(assembly,id,collisions,"outdoorStone");
            foreach(var id in map.trunks) InvisibleProxy(assembly,id,collisions,"outdoorWood");

            var items=CreateFixtures(assembly,fixtures);
            foreach(var box in map.boxes)
            {
                var owner=box.owner<0 ? collisions : items[box.owner].transform;
                var proxy=Folder(box.bank+" collision",owner);
                proxy.SetPositionAndRotation(ValleyManifest.Point(box.at),ValleyManifest.Turn(box.yaw));
                proxy.gameObject.AddComponent<BoxCollider>().size=ValleyManifest.Size(box.size);
                var foot=proxy.gameObject.AddComponent<ValleySurface>();
                foot.bank=box.bank;
                foot.stair=box.stair>0;
            }

            var world=scene.GetRootGameObjects().First(go=>go.name=="01  Hwayang Valley").AddComponent<ValleyWorld>();
            world.manifest=worldAsset;
            CreatePlayer(assembly,world,handAsset,native,horizon.gameObject);
            PlayerSettings.productName="Valley Camcorder";
            PlayerSettings.companyName="Valley Camcorder";
            PlayerSettings.colorSpace=ColorSpace.Linear;
            PlayerSettings.defaultScreenWidth=1280;
            PlayerSettings.defaultScreenHeight=960;
            PlayerSettings.defaultIsNativeResolution=false;
            PlayerSettings.fullScreenMode=FullScreenMode.Windowed;
            PlayerSettings.runInBackground=true;
            EditorSceneManager.SaveScene(scene,ScenePath);
            EditorBuildSettings.scenes=new[] { new EditorBuildSettingsScene(ScenePath,true) };
            AssetDatabase.SaveAssets();
            Debug.Log($"Valley imported {assembly.meshes.Count} source meshes, {items.Length} fixtures and {map.boxes.Length} structure colliders.");
        }

        static bool IsWalkZone(ValleyManifest map,Bounds b)
        {
            var min=b.min;
            var max=b.max;
            return max.x>=map.fieldBounds[0] && min.x<=map.fieldBounds[1] &&
                   -min.z>=map.fieldBounds[2] && -max.z<=map.fieldBounds[3] ||
                   max.x>=map.rangeBounds[0] && min.x<=map.rangeBounds[1] &&
                   -min.z>=map.rangeBounds[2] && -max.z<=map.rangeBounds[3];
        }

        static Transform Folder(string name, Transform parent=null)
        {
            var node=new GameObject(name).transform;
            node.SetParent(parent,false);
            return node;
        }

        static T Asset<T>(string file,T value) where T : UnityEngine.Object
        {
            var path=Generated+"/"+file+".asset";
            var existing=AssetDatabase.LoadAssetAtPath<T>(path);
            if (!existing)
            {
                AssetDatabase.CreateAsset(value,path);
                return value;
            }
            EditorUtility.CopySerialized(value,existing);
            UnityEngine.Object.DestroyImmediate(value);
            return existing;
        }

        static void ConfigurePipeline()
        {
            var renderer=AssetDatabase.LoadAssetAtPath<UniversalRendererData>(Generated+"/Valley Renderer.asset");
            if(!renderer)renderer=Asset("Valley Renderer",ScriptableObject.CreateInstance<UniversalRendererData>());
            renderer.postProcessData=AssetDatabase.LoadAssetAtPath<PostProcessData>(
                "Packages/com.unity.render-pipelines.universal/Runtime/Data/PostProcessData.asset");
            EditorUtility.SetDirty(renderer);
            var urp=UniversalRenderPipelineAsset.Create(renderer);
            urp.supportsCameraDepthTexture=true;
            urp.supportsCameraOpaqueTexture=true;
            urp.supportsHDR=true;
            urp.msaaSampleCount=1;
            urp.shadowDistance=115;
            urp.shadowCascadeCount=3;
            var pipeline=Asset("Valley URP",urp);
            GraphicsSettings.defaultRenderPipeline=pipeline;
            QualitySettings.renderPipeline=pipeline;
        }

        static void Environment(Assembly a)
        {
            var sun=Folder("Afternoon light").gameObject.AddComponent<Light>();
            sun.type=LightType.Directional;
            sun.color=new Color(1,.927f,.789f);
            sun.intensity=1.18f;
            sun.shadows=LightShadows.Soft;
            sun.transform.rotation=Quaternion.Euler(43,-33,0);
            RenderSettings.sun=sun;
            RenderSettings.ambientMode=AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=new Color(.49f,.56f,.54f);
            RenderSettings.ambientEquatorColor=new Color(.36f,.39f,.34f);
            RenderSettings.ambientGroundColor=new Color(.25f,.245f,.185f);
            RenderSettings.ambientIntensity=1;
            var sky=new Material(Shader.Find("Skybox/Procedural")) { name="Humid summer sky" };
            sky.SetColor("_SkyTint",new Color(.60f,.66f,.65f));
            sky.SetColor("_GroundColor",new Color(.42f,.45f,.38f));
            sky.SetFloat("_AtmosphereThickness",1.27f);
            sky.SetFloat("_SunSize",.045f);
            sky.SetFloat("_Exposure",.93f);
            RenderSettings.skybox=Asset("Summer sky",sky);
            RenderSettings.fog=true;
            RenderSettings.fogMode=FogMode.ExponentialSquared;
            RenderSettings.fogColor=new Color(.60f,.665f,.639f);
            RenderSettings.fogDensity=.00175f;
            RenderSettings.reflectionIntensity=.72f;

            var profile=ScriptableObject.CreateInstance<VolumeProfile>();
            var grade=profile.Add<ColorAdjustments>();
            grade.postExposure.Override(.13f);
            grade.contrast.Override(3.5f);
            grade.saturation.Override(-8);
            grade.colorFilter.Override(new Color(1,.985f,.944f));
            var grain=profile.Add<FilmGrain>();
            grain.type.Override(FilmGrainLookup.Thin1);
            grain.intensity.Override(.29f);
            grain.response.Override(.79f);
            var vignette=profile.Add<Vignette>();
            vignette.intensity.Override(.14f);
            vignette.smoothness.Override(.79f);
            var bloom=profile.Add<Bloom>();
            bloom.threshold.Override(1.15f);
            bloom.intensity.Override(.16f);
            var volume=Folder("2001 camcorder exposure and grain").gameObject.AddComponent<Volume>();
            // Volume components need serialized subassets to survive Editor restart.
            var lookPath=Generated+"/Tape color.asset";
            var saved=AssetDatabase.LoadAssetAtPath<VolumeProfile>(lookPath);
            if(saved)AssetDatabase.DeleteAsset(lookPath);
            AssetDatabase.CreateAsset(profile,lookPath);
            foreach(var component in profile.components) AssetDatabase.AddObjectToAsset(component,profile);
            volume.sharedProfile=profile;
            volume.isGlobal=true;
            a.water=Asset("River",new Material(Shader.Find("Valley/River")) { name="Olive shallows and riffles" });
        }

        static void LoadMeshes(Assembly a)
        {
            var directory=Source+"/Meshes";
            foreach(var file in Directory.EnumerateFiles(directory,"*.valleymesh").OrderBy(x=>x,StringComparer.Ordinal))
                foreach (var mesh in AssetDatabase.LoadAllAssetsAtPath(file.Replace('\\','/')).OfType<Mesh>())
                {
                    var values=mesh.name.Split('-');
                    var id=int.Parse(values[1]);
                    a.meshes.Add(id,(mesh,int.Parse(values[2])));
                }
            if(a.meshes.Count<100)throw new InvalidOperationException("Valley geometry bundles were not imported");
        }

        static Material Surface(Assembly a,int style)
        {
            if (a.materials.TryGetValue(style,out var existing)) return existing;
            var shader=Shader.Find("Valley/Weathered Surface");
            if (!shader) throw new InvalidOperationException("Missing Valley surface shader");
            var material=new Material(shader) { name=SurfaceName(style), enableInstancing=true };
            string texture=style switch
            {
                1=>"Gravel",2=>"Granite",3=>"Bark",4=>"Leaves",7=>"Skin",
                10 or 14 or 16 or 43=>"Canvas",11=>"Vinyl",12 or 46=>"Plastic",
                13 or 26 or 42=>"Timber",17 or 18=>"Brick",19 or 22 or 25 or 27=>"Plaster",
                20 or 28 or 35 or 36=>"Ceramic",23=>"RoadSigns",_=>null
            };
            if(texture!=null) material.SetTexture("_BaseMap",Texture(texture));
            if(style==1)material.SetTexture("_GroundCover",Texture("ForestFloor"));
            material.SetFloat("_Kind",style);
            material.SetFloat("_Smoothness",style switch
            {
                6 or 24 or 32 or 41=>.91f,39=>.74f,45=>.78f,40 or 47=>.65f,
                11 or 15 or 29 or 42=>.52f,26=>.43f,7=>.34f,_=>.17f
            });
            material.SetFloat("_Metallic",style is 40 or 47 ? .69f : style==39 ? .24f : 0);
            if(style is 6 or 24 or 32 or 41)
            {
                material.renderQueue=(int)RenderQueue.Transparent;
                material.SetOverrideTag("RenderType","Transparent");
                material.SetFloat("_ZWrite",0);
                material.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);
                material.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);
                material.SetFloat("_Opacity",style==32 ? .82f : .59f);
            }
            if(style==4)
            {
                material.renderQueue=(int)RenderQueue.AlphaTest;
                material.SetOverrideTag("RenderType","TransparentCutout");
            }
            material=Asset($"Surface {style:00} {SurfaceName(style)}",material);
            a.materials.Add(style,material);
            return material;
        }

        static Texture2D Texture(string name)
        {
            var path=Source+"/Textures/"+name+".png";
            if(AssetImporter.GetAtPath(path) is TextureImporter import)
            {
                var wrap=name is "Leaves" or "RoadSigns" ? TextureWrapMode.Clamp : TextureWrapMode.Mirror;
                if(import.wrapMode!=wrap || import.anisoLevel!=4)
                {
                    import.wrapMode=wrap;
                    import.anisoLevel=4;
                    import.SaveAndReimport();
                }
            }
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }

        static string SurfaceName(int style) => style switch
        {
            1=>"Gravel and ground cover",2=>"Granite",3=>"Pine bark",4=>"Summer canopy",
            5=>"Grasses",6 or 24 or 32 or 41=>"Glazing",7=>"Skin",10 or 14 or 16 or 43=>"Textile",
            11=>"Vinyl",12=>"Molded plastic",13 or 26=>"Wood",17=>"Paving",18=>"Brick",
            19 or 25 or 27=>"Wall finish",20 or 28 or 29 or 35 or 36=>"Ceramic",21=>"Cascade foam",22=>"Asphalt",
            23=>"Korean signs and plates",39=>"Automotive lacquer",40 or 47=>"Finished metal",42=>"Walnut",44=>"Rubber",
            45=>"Lamp lens",46=>"Paperboard",_=>"Solid"
        };

        static GameObject Draw(Assembly a,int id,Transform parent,bool liquid=false)
        {
            var (mesh,style)=a.meshes[id];
            var node=Folder(liquid ? "Water tile" : SurfaceName(style),parent).gameObject;
            node.AddComponent<MeshFilter>().sharedMesh=mesh;
            var renderer=node.AddComponent<MeshRenderer>();
            renderer.sharedMaterial=liquid ? a.water : Surface(a,style);
            if(liquid || style is 4 or 5 or 6 or 21 or 24 or 32 or 41)
                renderer.shadowCastingMode=ShadowCastingMode.Off;
            return node;
        }

        static void ShapeCollider(GameObject node,Mesh mesh,string bank)
        {
            node.AddComponent<MeshCollider>().sharedMesh=mesh;
            node.AddComponent<ValleySurface>().bank=bank;
        }
        static void InvisibleProxy(Assembly a,int id,Transform parent,string bank) =>
            ShapeCollider(Folder(bank+" mesh collision",parent).gameObject,a.meshes[id].mesh,bank);

        static ValleyFixture[] CreateFixtures(Assembly a,Transform parent)
        {
            var fixtures=a.map.objects.Select(recipe=>
            {
                var node=Folder(recipe.label,parent);
                ValleyManifest.ApplyMatrix(node,recipe.matrix);
                foreach(var id in recipe.meshes)
                {
                    var visual=Draw(a,id,node);
                    if(recipe.kind=="glass" && recipe.hp>0)
                        visual.AddComponent<MeshCollider>().sharedMesh=a.meshes[id].mesh;
                }
                var fixture=node.gameObject.AddComponent<ValleyFixture>();
                fixture.kind=recipe.kind;
                fixture.portable=recipe.portable;
                fixture.small=recipe.small;
                fixture.mass=Mathf.Max(.15f,recipe.mass);
                fixture.enabledState=recipe.on;
                fixture.locked=recipe.locked;
                fixture.opened=recipe.open;
                fixture.swing=-recipe.swing*Mathf.Rad2Deg;
                fixture.pitch=-recipe.pitch*Mathf.Rad2Deg;
                fixture.travel=recipe.travel?.Length==3 ? ValleyManifest.Point(recipe.travel) : Vector3.right*recipe.slide;
                fixture.durability=recipe.hp;
                if (recipe.closed?.Length==16)
                {
                    var current=node.localPosition;
                    var rotation=node.localRotation;
                    ValleyManifest.ApplyMatrix(node,recipe.closed);
                    fixture.closedAt=node.localPosition;
                    fixture.closedRotation=node.localRotation;
                    node.localPosition=current;
                    node.localRotation=rotation;
                }
                else
                {
                    fixture.closedAt=node.localPosition;
                    fixture.closedRotation=node.localRotation;
                }
                if(recipe.size?.Length==3)
                {
                    var size=ValleyManifest.Size(recipe.size);
                    fixture.size=size;
                    fixture.grip=new Vector3(0,size.y*.48f,-size.z*.31f);
                    if(fixture.portable || fixture.kind=="supply")
                    {
                        var body=node.gameObject.AddComponent<BoxCollider>();
                        body.size=size;
                        body.center=Vector3.up*size.y*.49f;
                    }
                }
                if(recipe.grip?.Length==3) fixture.grip=ValleyManifest.Point(recipe.grip);
                if(fixture.CanUse && recipe.useSize?.Length==3)
                {
                    var handle=Folder("Handle interaction",node);
                    handle.localPosition=fixture.grip;
                    var reach=handle.gameObject.AddComponent<BoxCollider>();
                    reach.size=Vector3.Max(ValleyManifest.Size(recipe.useSize),Vector3.one*.045f);
                    reach.isTrigger=true;
                }
                return fixture;
            }).ToArray();
            var doors=a.map.objects.Select((part,index)=>(part,index)).Where(pair=>pair.part.kind=="carDoor")
                .GroupBy(pair=>pair.part.car).ToDictionary(group=>group.Key,group=>group.Select(pair=>fixtures[pair.index]).ToArray());
            for(int i=0;i<fixtures.Length;i++)
            {
                var item=fixtures[i];
                var recipe=a.map.objects[i];
                if(recipe.parent>=0)
                {
                    var moving=fixtures[recipe.parent].transform;
                    item.transform.SetParent(moving,true);
                    item.closedAt=moving.InverseTransformPoint(item.closedAt);
                    item.closedRotation=Quaternion.Inverse(moving.rotation)*item.closedRotation;
                }
                if(recipe.door>=0 && item.kind=="carHandle") item.relatedDoor=fixtures[recipe.door];
                if(recipe.pane>=0) item.window=fixtures[recipe.pane];
                if(item.kind=="carLock" && doors.TryGetValue(recipe.car,out var vehicleDoors)) item.vehicleDoors=vehicleDoors;
            }
            return fixtures;
        }

        static void CreatePlayer(Assembly a,ValleyWorld world,GameObject hand,Transform parent,GameObject horizon)
        {
            var pivot=Folder("Camera operator",parent);
            pivot.position=ValleyManifest.Point(a.map.spawn);
            pivot.rotation=Quaternion.Euler(0,a.map.spawn[3]*Mathf.Rad2Deg,0);
            pivot.gameObject.layer=PlayerLayer;
            var capsule=pivot.gameObject.AddComponent<CharacterController>();
            capsule.height=1.72f;
            capsule.center=Vector3.up*.88f;
            capsule.radius=.24f;
            capsule.stepOffset=.32f;
            capsule.slopeLimit=47;
            capsule.skinWidth=.035f;
            var head=Folder("Camcorder camera",pivot);
            head.localPosition=Vector3.up*1.62f;
            head.localRotation=Quaternion.Euler(-a.map.spawn[4]*Mathf.Rad2Deg,0,0);
            var camera=head.gameObject.AddComponent<Camera>();
            camera.tag="MainCamera";
            camera.fieldOfView=57;
            camera.nearClipPlane=.038f;
            camera.farClipPlane=2900;
            camera.allowHDR=true;
            camera.allowMSAA=false;
            camera.GetUniversalAdditionalCameraData().renderPostProcessing=true;
            head.gameObject.AddComponent<AudioListener>();
            var motion=parent.gameObject.AddComponent<ValleyHands>();
            motion.view=head;
            motion.left=MakeHand(a,hand,parent,-1);
            motion.right=MakeHand(a,hand,parent,1);
            var sound=parent.gameObject.AddComponent<ValleyAudio>();
            sound.world=world;
            sound.listener=head;
            sound.recordings=Directory.EnumerateFiles(Source+"/Recorded","*.wav")
                .Select(path=>AssetDatabase.LoadAssetAtPath<AudioClip>(path.Replace('\\','/'))).Where(clip=>clip).ToArray();
            var player=pivot.gameObject.AddComponent<ValleyPlayer>();
            player.world=world; player.view=camera; player.hands=motion; player.sound=sound;
            var toy=Folder("Mini-car toy launcher",head);
            foreach(var shape in a.map.launcher.parts.Concat(a.map.launcher.glass))
                ValleyManifest.ApplyMatrix(Draw(a,shape.mesh,toy).transform,shape.matrix);
            player.toy=toy.gameObject;
            var car=Draw(a,a.map.launcher.cars[0],parent);
            car.name="Mini-car model";
            var chassis=car.AddComponent<BoxCollider>();
            chassis.size=car.GetComponent<MeshFilter>().sharedMesh.bounds.size;
            chassis.center=car.GetComponent<MeshFilter>().sharedMesh.bounds.center;
            car.SetActive(false);
            player.minicar=car;
            player.targets=BuildRangeTargets(a,world.transform);
            var hud=head.gameObject.AddComponent<ValleyTape>();
            hud.view=camera; hud.player=player; hud.exterior=horizon;
        }

        static ValleyTarget[] BuildRangeTargets(Assembly a,Transform parent)
        {
            var range=Folder("Target range discs",parent);
            return a.map.rangeTargets.Select((recipe,index)=>
            {
                var node=Folder("Target "+(index+1),range);
                node.SetPositionAndRotation(ValleyManifest.Point(recipe.at),ValleyManifest.Turn(recipe.yaw));
                node.localScale=Vector3.one*recipe.radius;
                var target=node.gameObject.AddComponent<ValleyTarget>();
                var render=Draw(a,a.map.targetFaces[0],node);
                target.face=render.GetComponent<MeshFilter>();
                target.ready=target.face.sharedMesh;
                target.hit=a.meshes[a.map.targetFaces[1]].mesh;
                target.start=node.position;
                target.travel=recipe.travel;
                target.phase=index*.82f;
                var collider=node.gameObject.AddComponent<BoxCollider>();
                collider.size=new Vector3(1.82f,1.82f,.10f);
                return target;
            }).ToArray();
        }

        static ValleyHands.Chain MakeHand(Assembly a,GameObject model,Transform parent,float side)
        {
            var hand=Folder(side<0 ? "Left hand contact" : "Right hand contact",parent);
            var rig=((GameObject)PrefabUtility.InstantiatePrefab(model,hand)).transform;
            rig.localPosition=Vector3.zero; rig.localRotation=Quaternion.identity; rig.localScale=Vector3.one;
            foreach(var renderer in rig.GetComponentsInChildren<SkinnedMeshRenderer>())
            {
                var slots=renderer.sharedMaterials;
                for(int i=0;i<slots.Length;i++) slots[i]=Surface(a,slots[i] && slots[i].name.Contains("nail",StringComparison.OrdinalIgnoreCase) ? 15 : 7);
                renderer.sharedMaterials=slots;
                renderer.updateWhenOffscreen=true;
            }
            var upper=Draw(a,a.map.sleeve,parent).transform;
            upper.name=side<0 ? "Left upper sleeve" : "Right upper sleeve";
            var forearm=Draw(a,a.map.sleeve,parent).transform;
            forearm.name=side<0 ? "Left forearm sleeve" : "Right forearm sleeve";
            hand.gameObject.SetActive(false); upper.gameObject.SetActive(false); forearm.gameObject.SetActive(false);
            return new ValleyHands.Chain { frame=hand,model=rig,upper=upper,forearm=forearm,side=side };
        }

        static Transform BuildHorizon(Assembly a,Transform landscape)
        {
            var horizon=Folder("Scenery beyond the walkable boundary",landscape);
            var mesh=ValleyHorizon.Build(a.map);
            var node=Folder("Interlocking ridges",horizon).gameObject;
            node.AddComponent<MeshFilter>().sharedMesh=Asset("Distant ridges",mesh);
            var renderer=node.AddComponent<MeshRenderer>();
            renderer.sharedMaterial=Surface(a,1);
            renderer.shadowCastingMode=ShadowCastingMode.Off;
            var series=ValleyHorizon.Water(a.map);
            for(int i=0;i<series.Length;i++)
            {
                var tail=Folder("River continuation",horizon).gameObject;
                tail.AddComponent<MeshFilter>().sharedMesh=Asset("River tail "+i,series[i]);
                tail.AddComponent<MeshRenderer>().sharedMaterial=a.water;
            }
            return horizon;
        }

        public static void BuildWindows()
        {
            Directory.CreateDirectory("Builds/Windows");
            var development=EnvironmentArgs.Contains("-valley-test-build") ? BuildOptions.Development : BuildOptions.None;
            var report=BuildPipeline.BuildPlayer(new[] {ScenePath},"Builds/Windows/Valley Camcorder.exe",
                BuildTarget.StandaloneWindows64,BuildOptions.StrictMode | development);
            if(report.summary.result!=BuildResult.Succeeded)
                throw new InvalidOperationException($"Player build ended with {report.summary.result}");
        }

        static string[] EnvironmentArgs => System.Environment.GetCommandLineArgs();

        public static void PlaySmoke()
        {
            EditorSceneManager.OpenScene(ScenePath);
            EditorApplication.EnterPlaymode();
        }

        public static void Verify()
        {
            var scene=EditorSceneManager.OpenScene(ScenePath);
            var player=scene.GetRootGameObjects().SelectMany(root=>root.GetComponentsInChildren<ValleyPlayer>()).Single();
            var map=JsonUtility.FromJson<ValleyManifest>(player.world.manifest.text);
            var spawn=ValleyManifest.Point(map.spawn);
            if(!map.Walkable(spawn) || map.Walkable(new Vector3(map.fieldBounds[1]+50,0,-15)) ||
                !map.InRange(ValleyManifest.Point(map.rangeSpawn)))
                throw new InvalidOperationException("The source map boundaries were lost");
            if(map.landmarks.Length<10 || player.targets.Length!=8 || player.sound.recordings.Length<60)
                throw new InvalidOperationException("The imported facilities, range, or recordings are missing");
            var colliders=scene.GetRootGameObjects().Sum(root=>root.GetComponentsInChildren<Collider>(true).Length);
            if(colliders<4000)throw new InvalidOperationException("Too few imported collision volumes");
            if(player.hands.right.model.GetComponentsInChildren<Transform>(true).Count(t=>
                t.name=="Wrist" || t.name.EndsWith("01") || t.name.EndsWith("02") || t.name.EndsWith("03"))!=16)
                throw new InvalidOperationException("Unexpected FBX hand rig");
            Physics.SyncTransforms();
            var start=spawn+Vector3.up*2;
            bool found=Physics.Raycast(start,Vector3.down,out var ground,4,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
            if(!found || Mathf.Abs(ground.point.y-spawn.y)>.28f)
            {
                var original=Physics.queriesHitBackfaces;
                Physics.queriesHitBackfaces=true;
                bool back=Physics.Raycast(start,Vector3.down,out var reverse,4,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
                Physics.queriesHitBackfaces=original;
                throw new InvalidOperationException($"The spawn {spawn} has no matching collision surface: {found} {ground.collider?.name} {ground.point}, back-face test {back} {reverse.collider?.name} {reverse.point}.");
            }
            if(ShaderUtil.ShaderHasError(Shader.Find("Valley/Weathered Surface")) ||
               ShaderUtil.ShaderHasError(Shader.Find("Valley/River")))
                throw new InvalidOperationException("A Valley shader failed to compile");
            Debug.Log($"VALLEY EDITOR VERIFIED {colliders} colliders, {player.sound.recordings.Length} recordings and a 16-joint Blender hand.");
        }
    }
}
