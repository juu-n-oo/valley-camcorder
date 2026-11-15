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

            var lodge=map.landmarks.First(site=>site.id=="muljon");
            var lodgeAt=ValleyManifest.Point(lodge.at);
            var facing=ValleyManifest.Turn(lodge.yaw);
            var porch=lodgeAt+facing*new Vector3(6.5f,0,-11.5f);
            LookFrom(player,porch,lodgeAt+Vector3.up*3);
            yield return null;
            Capture(player.view,"valley-lodge.png");
            var car=latch.vehicleDoors[0].transform;
            var outside=car.position+car.rotation*new Vector3(3.5f,0,-3.9f);
            LookFrom(player,outside,car.position+Vector3.up*.35f);
            yield return null;
            Capture(player.view,"valley-car.png");
            var line="PASS: Unity spawn, 16-joint FBX, pickup and placement, lodge door, car glass and unlock, eight-disc range.";
            Debug.Log(line);
            File.WriteAllText(Path.Combine(folder,"play-mode.txt"),line);
            Exit(0);
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
