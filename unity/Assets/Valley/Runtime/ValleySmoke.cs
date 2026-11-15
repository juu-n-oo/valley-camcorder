using System;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace ValleyCamcorder
{
    public sealed class ValleySmoke : MonoBehaviour
    {
        string folder;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Attach()
        {
            if(!Debug.isDebugBuild) return;
            var args=Environment.GetCommandLineArgs();
            var index=Array.IndexOf(args,"--valley-smoke");
            if(index<0 || index+1>=args.Length) return;
            var run=new GameObject("Native play-mode verification").AddComponent<ValleySmoke>();
            run.folder=args[index+1];
            run.StartCoroutine(run.Check());
        }

        IEnumerator Check()
        {
            Directory.CreateDirectory(folder);
            var player=FindAnyObjectByType<ValleyPlayer>();
            yield return new WaitForSeconds(.25f);
            var map=player.world.Map;
            if(Mathf.Abs(player.transform.position.y-map.spawn[1])>.25f || player.hands.ArticulatedJoints!=16)
            {
                Fail("Spawn or Blender rig failed");
                yield break;
            }
            var riverPosition=new Vector3(map.spawn[0]-1.1f,map.spawn[1],-2);
            var lookAt=new Vector3(36,3.3f,39);
            var outline=map.river.OrderBy(item=>Mathf.Abs(item.z+39)).First();
            lookAt.x=outline.right+3.7f;
            if(Physics.Raycast(riverPosition+Vector3.up*9,Vector3.down,out var shore,15,Physics.DefaultRaycastLayers))
                riverPosition.y=shore.point.y;
            var heading=Mathf.Atan2(lookAt.x-riverPosition.x,lookAt.z-riverPosition.z)*Mathf.Rad2Deg;
            player.Warp(riverPosition,heading,-1.5f);
            yield return null;
            Capture(player.view,"valley-river.png");
            yield return new WaitForSeconds(.35f);

            var range=ValleyManifest.Point(map.rangeSpawn);
            player.Warp(range,0,38);
            var cup=FindObjectsByType<ValleyFixture>().First(item=>item.kind=="cup");
            cup.transform.position=range+new Vector3(.05f,.69f,.78f);
            player.BeginPickup(cup);
            yield return new WaitForSeconds(.79f);
            if(player.Held!=cup || !cup.IsCarried)
            {
                Fail("Pickup never reached carry");
                yield break;
            }
            Capture(player.view,"valley-hand.png");
            yield return new WaitForSeconds(.25f);
            if(!player.BeginPlacement())
            {
                Fail("Native placement refused a clear floor");
                yield break;
            }
            yield return new WaitForSeconds(.79f);
            if(player.Held || cup.IsCarried)
            {
                Fail("Placement failed to release");
                yield break;
            }

            var items=FindObjectsByType<ValleyFixture>();
            var door=items.First(item=>item.kind=="door" && Mathf.Abs(item.swing)>25 && !item.opened);
            var closed=door.transform.localRotation;
            door.Use();
            yield return new WaitForSeconds(.58f);
            if(!door.opened || Quaternion.Angle(closed,door.transform.localRotation)<10)
            {
                Fail("A lodge door did not rotate");
                yield break;
            }
            var latch=items.First(item=>item.kind=="carLock" && item.window && item.vehicleDoors?.Length==4);
            if(latch.Use()) { Fail("Car lock was exposed through intact glazing"); yield break; }
            latch.window.ToyImpact(10);
            if(!latch.Use() || latch.vehicleDoors.Any(panel=>panel.locked))
            {
                Fail("A car lock did not unlock its four doors");
                yield break;
            }
            player.targets[0].Mark();
            if(player.MarkedCount!=1) { Fail("Mini-car range scoring failed"); yield break; }

            player.enabled=false;
            string controlsError;
            try { controlsError=CheckControls(player); }
            catch(Exception error) { controlsError=error.ToString(); }
            player.enabled=true;
            if(controlsError!=null) {Fail(controlsError);yield break;}

            var target=player.targets[0];
            target.ResetMark();
            var center=target.transform.position;
            LookFrom(player,center-Vector3.forward*4.4f,center+Vector3.up*.03f);
            player.Step(1/60f,new ValleyPlayer.Controls {slot=1});
            var live=player.Equipment;
            var timeout=Time.realtimeSinceStartup+5;
            while((live.Selected!=1 || !live.CanAct) && Time.realtimeSinceStartup<timeout) yield return null;
            if(live.Selected!=1 || !live.CanAct) {Fail("The live rifle switch did not finish");yield break;}
            var previous=live.Shots;
            player.Step(1/60f,new ValleyPlayer.Controls {trigger=true});
            timeout=Time.realtimeSinceStartup+5;
            while(live.Shots==previous && Time.realtimeSinceStartup<timeout) yield return null;
            if(live.Shots==previous) {Fail("The live rifle cycle did not release a projectile");yield break;}
            yield return new WaitForSeconds(.47f);
            if(!target.Marked)
            {
                var camera=player.view.transform;
                Physics.Raycast(camera.position,camera.forward,out var hit,10,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
                Fail($"A live Unity rifle projectile missed. Muzzle {live.LastMuzzle}, heading {live.LastLaunch}, disc {target.transform.position}, view {camera.position} {camera.forward}, sight hit {hit.collider?.name}");
                yield break;
            }

            var lodge=map.landmarks.First(site=>site.id=="muljon");
            var lodgeAt=ValleyManifest.Point(lodge.at);
            var facing=ValleyManifest.Turn(lodge.yaw);
            var monitors=FindObjectsByType<ValleyMonitor>();
            if(monitors.Length!=3 || monitors.Any(item=>item.views.Length!=2))
            {Fail("Lobby monitors did not receive both camera angles");yield break;}
            var monitor=monitors.OrderBy(screen=>(screen.transform.position-lodgeAt).sqrMagnitude).First();
            var screenAt=monitor.transform.position+Vector3.up*.24f;
            LookFrom(player,monitor.transform.position+monitor.transform.forward*1.52f,screenAt);
            yield return new WaitForSeconds(.35f);
            if(!monitor.Showing) {Fail("A nearby lobby monitor did not render its native camera feed");yield break;}

            var tent=items.FirstOrDefault(item=>item.kind=="tent");
            var cloth=tent ? tent.GetComponentInChildren<ValleyFabric>() : null;
            if(!cloth || !player.Facilities.InsideTent(tent.transform.position) ||
                player.Facilities.CanEnterTent(tent.transform.position,tent.transform.position,1.62f,false) ||
                !player.Facilities.CanEnterTent(tent.transform.position,tent.transform.position,.39f,true))
            {Fail("Tent posture or impact geometry was missing");yield break;}
            var clothMesh=cloth.GetComponent<MeshFilter>();
            var vertices=clothMesh.sharedMesh.vertices;
            var faces=clothMesh.sharedMesh.triangles;
            var hitPoint=cloth.transform.TransformPoint((vertices[faces[0]]+vertices[faces[1]]+vertices[faces[2]])/3);
            cloth.Hit(hitPoint,cloth.transform.forward,38);
            if(clothMesh.sharedMesh.triangles.Length>=faces.Length)
            {Fail("An impact did not cut a hole in the tent cloth");yield break;}

            var porch=lodgeAt+facing*new Vector3(6.5f,0,-11.5f);
            LookFrom(player,porch,lodgeAt+Vector3.up*3);
            yield return null;
            Capture(player.view,"valley-lodge.png");
            var car=latch.vehicleDoors[0].transform;
            var outside=car.position+car.rotation*new Vector3(3.5f,0,-3.9f);
            LookFrom(player,outside,car.position+Vector3.up*.35f);
            yield return null;
            Capture(player.view,"valley-car.png");

            var burners=items.Where(item=>item.kind=="burner" && item.gasValve).ToArray();
            var pair=burners.GroupBy(item=>item.gasValve).FirstOrDefault(group=>group.Count()==2)?.ToArray();
            if(pair==null) {Fail("The two stove burners were not linked to the same valve");yield break;}
            var valve=pair[0].gasValve;
            if(valve.enabledState) valve.Use();
            pair[0].Use();
            yield return new WaitForSeconds(.52f);
            if(!pair[0].Igniting || pair[0].enabledState || player.sound.LastWorldCue!="stove-click")
            {Fail("A closed stove line did not produce sparks only");yield break;}
            pair[0].Release();
            valve.Use();
            foreach(var burner in pair) burner.Use();
            yield return new WaitForSeconds(.55f);
            if(pair.Any(item=>!item.enabledState)) {Fail("Both stove burners must light with the gas valve open");yield break;}
            valve.Use();
            yield return null;
            if(pair.Any(item=>item.enabledState)) {Fail("Closing the gas valve did not extinguish the burners");yield break;}
            foreach(var burner in pair) burner.Release();

            var basins=items.Where(item=>item.kind=="ceramic" && item.Recipe?.remnant?.Length>0).Take(2).ToArray();
            if(basins.Length!=2) {Fail("Bathroom plumbing data was not linked");yield break;}
            foreach(var basin in basins)
            {
                basin.ToyImpact(1.3f);
                if(basin.Broken) {Fail("Ceramic durability was skipped");yield break;}
                basin.ToyImpact(1.3f);
            }
            if(basins.Any(item=>!item.Broken) || player.Facilities.Leaks!=2 || player.sound.LastWorldCue!="ceramic")
            {Fail("Bathroom breakage did not trigger shards, jet and the recording");yield break;}
            var tank=items.Where(item=>item.kind=="tank").OrderBy(item=>(item.transform.position-lodgeAt).sqrMagnitude).First();
            tank.ToyImpact(1.1f);
            if(tank.Broken) {Fail("Tank durability was skipped");yield break;}
            tank.ToyImpact(4.5f);
            var stairs=items.Where(item=>item.kind=="woodStair" && item.Burning).ToArray();
            if(!tank.Broken || stairs.Length==0 || !GameObject.Find("Breached wall"))
            {Fail("The blast did not open the wall and ignite nearby stairs");yield break;}
            yield return new WaitForSeconds(6.55f);
            if(!stairs.Any(item=>item.Broken)) {Fail("The burning stairs did not collapse");yield break;}
            player.FireDamage(100);
            yield return new WaitForSeconds(.17f);
            if(!player.Rewinding || player.sound.LastCue!="rewind") {Fail("The death rewind and sound did not start");yield break;}
            yield return new WaitForSeconds(1.2f);
            if(player.Rewinding || player.Health!=100 || Vector3.Distance(player.transform.position,ValleyManifest.Point(map.spawn))>.25f ||
                !tank.Broken) {Fail("Respawn did not return to the valley or preserve scene damage");yield break;}

            var line="PASS: Unity spawn, 16-joint FBX, props, lodge door, car glass and unlock, live range projectile, three launchers, reload and audio, inventory, ADS, supply, diving, CCTV, tent posture and tearing, ignition, bathroom breakage, timber collapse and rewind.";
            Debug.Log(line);
            File.WriteAllText(Path.Combine(folder,"play-mode.txt"),line);
            Exit(0);
        }

        string CheckControls(ValleyPlayer player)
        {
            var map=player.world.Map;
            var gear=player.Equipment;
            var origin=ValleyManifest.Point(map.spawn);
            player.Warp(origin,0);
            player.Step(1/60f,new ValleyPlayer.Controls {slot=2});
            Advance(player,.28f);
            if(gear.Selected!=2 || gear.Ammo!=5 || !gear.Visible) return "Pistol not available after spawning";
            player.Step(1/60f,new ValleyPlayer.Controls {range=true});
            if(!player.InRange || player.MarkedCount!=0) return "F did not start a fresh range round";
            Advance(player,.28f);
            var hip=player.view.fieldOfView;
            player.Step(1/60f,new ValleyPlayer.Controls {aim=true});
            Advance(player,.31f);
            if(!gear.Aiming || gear.Aim<.94f || player.view.fieldOfView>=hip-4) return "RMB did not enter ADS";
            Capture(player.view,"valley-pistol-ads.png");
            player.Step(1/60f,new ValleyPlayer.Controls {aim=true,motor=true});
            Advance(player,.74f);
            if(gear.Powered) return "Pistol motor did not toggle";
            player.Step(1/60f,new ValleyPlayer.Controls {trigger=true});
            Advance(player,.24f);
            if(gear.Shots!=0 || gear.Ammo!=5 || player.sound.LastCue!="jam") return "Unpowered pistol launched a car";
            player.Step(1/60f,new ValleyPlayer.Controls {motor=true});
            Advance(player,.73f);
            player.Step(1/60f,new ValleyPlayer.Controls {trigger=true,triggerHeld=true});
            Advance(player,.85f,new ValleyPlayer.Controls {triggerHeld=true});
            if(gear.Ammo!=0 || gear.Shots!=5 || player.sound.LastCue!="shot-pistol") return "Pistol trigger or sound failed";
            player.Step(1/60f,new ValleyPlayer.Controls {reload=true,reloadHeld=true});
            Advance(player,3.04f);
            if(gear.Ammo!=5 || gear.Discarded!=1 || player.sound.LastCue!="seat") return "Empty pistol cartridge did not reload and eject";

            player.Step(1/60f,new ValleyPlayer.Controls {slot=1});
            Advance(player,.63f);
            if(gear.Selected!=1 || gear.Ammo!=6 || gear.Reserve!=18) return "Rifle switch or inventory failed";
            player.Step(1/60f,new ValleyPlayer.Controls {trigger=true});
            Advance(player,.25f);
            if(gear.Ammo!=5 || player.sound.LastCue!="shot-rifle") return "Rifle shot did not fire";
            gear.ClearProjectiles();
            player.Step(1/60f,new ValleyPlayer.Controls {reload=true,reloadHeld=true});
            Advance(player,.91f);
            Capture(player.view,"valley-rifle-loading.png");
            Advance(player,1.21f);
            if(gear.Ammo!=6 || gear.Reserve!=17 || gear.Busy || player.sound.LastCue!="rifle-latch")
                return "Rifle manual loading sequence or inventory failed";

            player.Step(1/60f,new ValleyPlayer.Controls {slot=3});
            Advance(player,.63f);
            if(gear.Selected!=3 || gear.Ammo!=20 || gear.Total!=56) return "SMG switch or capacity failed";
            player.Step(1/60f,new ValleyPlayer.Controls {trigger=true});
            Advance(player,.14f);
            if(gear.Ammo!=19 || player.sound.LastCue!="shot-smg" ||
                Vector3.Angle(gear.LastLaunch,gear.LastRailHeading)>.03f || Vector3.Angle(gear.LastLaunch,player.view.transform.forward)<2)
                return "SMG hip fire did not exit along its visible rail";
            var mounted=gear.Magazine.localPosition;
            player.Step(1/60f,new ValleyPlayer.Controls {inspect=true});
            Advance(player,3.37f);
            if(!gear.InspectionMotor || Vector3.Distance(mounted,gear.Magazine.localPosition)<.13f)
                return "SMG inspection did not detach the magazine and start the housing motor";
            var still=gear.Magazine.GetChild(1).localRotation;
            Advance(player,.31f);
            if(Quaternion.Angle(still,gear.Magazine.GetChild(1).localRotation)>.05f)
                return "The detached spiral elevator moved during the housing test";
            if(gear.VisibleLaunchers!=1) return "More than one launcher was visible after switching";
            gear.ClearProjectiles();
            Capture(player.view,"valley-smg-inspect.png");
            Advance(player,2.00f);
            if(gear.Busy || Vector3.Distance(mounted,gear.Magazine.localPosition)>.015f) return "SMG inspection never reseated";
            player.Step(1/60f,new ValleyPlayer.Controls {reload=true,reloadHeld=true});
            Advance(player,3.25f);
            if(gear.Ammo!=16 || gear.Total!=55 || gear.Discarded!=1) return "Partial SMG cartridge was not saved";

            var crate=player.Resupply.RangeCrate;
            player.Warp(crate+Vector3.right*1.26f,-90,31);
            Advance(player,.32f);
            player.Step(1/60f,new ValleyPlayer.Controls {reload=true,reloadHeld=true});
            Advance(player,.165f,new ValleyPlayer.Controls {reloadHeld=true});
            var flaps=GameObject.Find("Target range carton flaps").transform;
            if(flaps.GetChild(0).TransformDirection(Vector3.back).y<.3f)
                return "The carton flaps rotated through the box instead of lifting outward";
            Advance(player,.59f,new ValleyPlayer.Controls {reloadHeld=true});
            if(player.Resupply.CrateOpen<.95f || player.sound.SearchBank!="crate")
                return "Range carton did not open or play its recording";
            Capture(player.view,"valley-range-resupply.png");
            Advance(player,.53f);
            if(player.Resupply.CrateOpen>.02f || gear.Total!=55) return "Cancelled resupply changed inventory or left the carton open";
            player.Step(1/60f,new ValleyPlayer.Controls {reload=true,reloadHeld=true});
            Advance(player,2.62f,new ValleyPlayer.Controls {reloadHeld=true});
            if(gear.Total!=95 || player.Resupply.Busy) return "Holding R did not add two magazines after 2.4 seconds";
            Advance(player,.5f);
            player.Step(1/60f,new ValleyPlayer.Controls {range=true});
            if(player.InRange || Vector3.Distance(player.transform.position,origin)>.35f) return "F did not return to the valley";
            player.Step(1/60f,new ValleyPlayer.Controls {z=true});
            Advance(player,.30f);
            if(!player.Prone || player.view.transform.localPosition.y>.69f) return "Z did not toggle prone on dry land";
            player.Step(1/60f,new ValleyPlayer.Controls {z=true});

            Vector3? pool=null;
            foreach(var bank in map.river.OrderBy(bank=>Mathf.Abs(bank.z-map.spawn[2])))
            {
                var at=new Vector3((bank.left+bank.right)*.5f,0,-bank.z);
                var water=map.WaterLevel(at);
                at.y=water-.65f;
                if(!map.Walkable(at) || !Physics.Raycast(at+Vector3.up*.25f,Vector3.down,out var bottom,8,Physics.DefaultRaycastLayers) ||
                    bottom.point.y>water-1.76f) continue;
                pool=at;
                break;
            }
            if(!pool.HasValue) return "Deep-water test could not find a swimmable river bed";
            player.Warp(pool.Value,0);
            Advance(player,.73f);
            if(!player.Swimming || player.Underwater) return "Player did not float at the surface in deep water";
            player.Step(1/60f,new ValleyPlayer.Controls {z=true});
            Advance(player,1.2f);
            if(!player.Diving || !player.Underwater || player.Air>=19.7f) return "Z did not dive or consume breath";
            Capture(player.view,"valley-dive.png");
            player.Step(1/60f,new ValleyPlayer.Controls {z=true});
            Advance(player,.93f);
            if(player.Diving || player.Underwater || player.Air<19.9f) return "Z did not surface and recover breath";
            return null;
        }

        static void Advance(ValleyPlayer player,float seconds,ValleyPlayer.Controls input=default)
        {
            int steps=Mathf.CeilToInt(seconds*60);
            for(int frame=0;frame<steps;frame++) player.Step(1/60f,input);
        }

        static void LookFrom(ValleyPlayer player,Vector3 cameraFoot,Vector3 target)
        {
            if(Physics.Raycast(cameraFoot+Vector3.up*5,Vector3.down,out var terrain,10,Physics.DefaultRaycastLayers))
                cameraFoot.y=terrain.point.y;
            var ray=target-cameraFoot-Vector3.up*1.62f;
            player.Warp(cameraFoot,Mathf.Atan2(ray.x,ray.z)*Mathf.Rad2Deg,
                -Mathf.Atan2(ray.y,Mathf.Sqrt(ray.x*ray.x+ray.z*ray.z))*Mathf.Rad2Deg);
        }

        void Fail(string message)
        {
            Debug.LogError(message);
            File.WriteAllText(Path.Combine(folder,"play-mode.txt"),message);
            Exit(2);
        }

        void Capture(Camera camera,string filename)
        {
            if(SystemInfo.graphicsDeviceType==GraphicsDeviceType.Null)return;
            var previous=RenderTexture.active;
            var bounds=camera.rect;
            using var output=new RenderTextureScope(960,720);
            var pixels=new Texture2D(960,720,TextureFormat.RGBA32,false);
            try
            {
                camera.rect=new Rect(0,0,1,1);
                var request=new RenderPipeline.StandardRequest { destination=output.Target };
                RenderPipeline.SubmitRenderRequest(camera,request);
                RenderTexture.active=output.Target;
                pixels.ReadPixels(new Rect(0,0,960,720),0,0);
                pixels.Apply();
                File.WriteAllBytes(Path.Combine(folder,filename),pixels.EncodeToPNG());
            }
            finally
            {
                camera.rect=bounds;
                RenderTexture.active=previous;
                Destroy(pixels);
            }
        }

        sealed class RenderTextureScope : IDisposable
        {
            public RenderTexture Target { get; }
            public RenderTextureScope(int width,int height)
            {
                Target=RenderTexture.GetTemporary(width,height,24,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB);
            }
            public void Dispose() => RenderTexture.ReleaseTemporary(Target);
        }

        static void Exit(int code)
        {
#if UNITY_EDITOR
            UnityEditor.EditorApplication.Exit(code);
#else
            Application.Quit(code);
#endif
        }
    }
}
