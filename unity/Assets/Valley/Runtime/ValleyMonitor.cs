using System;
using UnityEngine;
using UnityEngine.Rendering;

namespace ValleyCamcorder
{
    internal sealed class ValleyMonitor : MonoBehaviour
    {
        [Serializable] public sealed class View {public float[] at,forward;}
        [Serializable] public sealed class Recipe {public int id; public View[] views;}
        public Camera listener;
        public View[] views;
        MeshRenderer screen;
        ValleyFixture fixture;
        Camera recording;
        RenderTexture feed;
        MaterialPropertyBlock display;
        float nextFrame;
        public bool Showing => feed && fixture.HasPower && !fixture.IsCarried;

        void Start()
        {
            fixture=GetComponent<ValleyFixture>();
            foreach(var item in GetComponentsInChildren<MeshRenderer>())
                if(item.sharedMaterial && item.sharedMaterial.GetInt("_Kind")==33) {screen=item;break;}
            display=new MaterialPropertyBlock();
            Display(Texture2D.blackTexture);
        }

        void LateUpdate()
        {
            if(!screen || views==null || views.Length==0 || Time.time<nextFrame) return;
            nextFrame=Time.time+.13f;
            if(!fixture.HasPower || fixture.IsCarried)
            {
                Display(Texture2D.blackTexture);
                return;
            }
            var offset=screen.bounds.center-listener.transform.position;
            if(offset.sqrMagnitude>48 || Vector3.Dot(offset,listener.transform.forward)<-.35f) return;
            if(!recording)
            {
                var camera=new GameObject("Lodge security camera");
                camera.transform.SetParent(transform);
                recording=camera.AddComponent<Camera>();
                recording.enabled=false;
                recording.fieldOfView=64;
                recording.aspect=4f/3;
                recording.nearClipPlane=.03f;
                recording.farClipPlane=110;
                recording.allowHDR=recording.allowMSAA=false;
                feed=new RenderTexture(320,240,24,RenderTextureFormat.ARGB32) {name="Lobby security feed"};
                feed.Create();
                Display(feed);
            }
            var view=views[Mathf.FloorToInt(Time.time/6)%views.Length];
            recording.transform.SetPositionAndRotation(ValleyManifest.Point(view.at),
                Quaternion.LookRotation(ValleyManifest.Point(view.forward)));
            screen.enabled=false;
            try {RenderPipeline.SubmitRenderRequest(recording,new RenderPipeline.StandardRequest {destination=feed});}
            finally {screen.enabled=true;}
        }

        void Display(Texture texture)
        {
            if(!screen) return;
            screen.GetPropertyBlock(display);
            display.SetTexture("_BaseMap",texture);
            screen.SetPropertyBlock(display);
        }

        void OnDestroy()
        {
            if(feed) {feed.Release();Destroy(feed);}
        }
    }
}
