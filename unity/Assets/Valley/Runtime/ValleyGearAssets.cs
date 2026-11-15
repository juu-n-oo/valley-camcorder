using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace ValleyCamcorder
{
    public sealed class ValleyGearAssets
    {
        [Serializable] public sealed class Mark { public float time; public string sound; }
        [Serializable] public sealed class Clip
        {
            public string name;
            public float duration;
            public int frames;
            public Mark[] marks;
            public float[] samples;

            public Pose At(float time,int channel)
            {
                var frame=duration>0 ? Mathf.Clamp01(time/duration)*(frames-1) : 0;
                var i=(int)frame;
                var stride=samples.Length/frames;
                var a=new Pose(samples,i*stride+channel*Pose.Width);
                if(i==frames-1 || frame==i) return a;
                var b=new Pose(samples,(i+1)*stride+channel*Pose.Width);
                return Pose.Mix(a,b,frame-i);
            }
        }

        public readonly struct Pose
        {
            public const int Width=10;
            public readonly Vector3 at;
            public readonly Quaternion turn;
            public readonly float scale;
            public Pose(float[] data,int index=0) : this(new Vector3(data[index],data[index+1],data[index+2]),
                Quaternion.LookRotation(new Vector3(data[index+3],data[index+4],data[index+5]),
                    new Vector3(data[index+6],data[index+7],data[index+8])),data[index+9]) {}
            public Pose(Vector3 at,Quaternion turn,float scale=1)
            {
                this.at=at;
                this.turn=turn;
                this.scale=scale;
            }
            public static Pose Mix(Pose a,Pose b,float t)
            {
                if(a.scale==0 && b.scale>0) a=new Pose(b.at,b.turn,0);
                if(b.scale==0 && a.scale>0) b=new Pose(a.at,a.turn,0);
                return new Pose(Vector3.Lerp(a.at,b.at,t),Quaternion.Slerp(a.turn,b.turn,t),Mathf.Lerp(a.scale,b.scale,t));
            }
            public void Apply(Transform target)
            {
                target.gameObject.SetActive(scale>.001f);
                if(scale<=.001f) return;
                target.SetLocalPositionAndRotation(at,turn);
                target.localScale=Vector3.one*scale;
            }
        }

        [Serializable] public sealed class Part { public int mesh; public float[] at; }
        [Serializable] public sealed class Flap { public int mesh; public float[] at; public float angle; }
        [Serializable] public sealed class Box { public float[] at; public Flap[] sides; }
        [Serializable] public sealed class Model
        {
            public string kind;
            public int capacity,cap;
            public int[] shell,looseCars;
            public float speed,drag,reach,scale;
            public float[] grip,muzzle,railStart,slots;
            public Part[] magazine;
            public Clip[] clips;

            public Clip Motion(string name) => Array.Find(clips,clip=>clip.name==name)
                ?? throw new InvalidOperationException("Missing Valley equipment motion "+kind+"/"+name);
        }

        [Serializable] public sealed class Manifest
        {
            public int[] carIds;
            public Model[] gears;
            public Box crate;
        }

        readonly Dictionary<int,Mesh> meshes=new();
        readonly Dictionary<int,int> styles=new();
        readonly Material plastic, glass, cardboard;
        public readonly Manifest Data;

        public ValleyGearAssets(GameObject original)
        {
            const string folder="ValleyGear/";
            var source=Resources.Load<TextAsset>(folder+"Equipment");
            if(!source) throw new InvalidOperationException("Valley equipment data could not be loaded");
            Data=JsonUtility.FromJson<Manifest>(source.text);
            foreach(var mesh in Resources.LoadAll<Mesh>(folder+"Meshes"))
            {
                var fields=mesh.name.Split('-');
                int id=int.Parse(fields[1]);
                meshes[id]=mesh;
                styles[id]=int.Parse(fields[2]);
            }
            foreach(var part in original.GetComponentsInChildren<MeshRenderer>(true))
            {
                var material=part.sharedMaterial;
                if(!material) continue;
                var kind=material.GetInt("_Kind");
                if(kind==12) plastic=material;
                if(kind==6) glass=material;
            }
            if(meshes.Count<30 || !plastic || !glass)
                throw new InvalidOperationException("Valley equipment geometry or materials could not be loaded");
            cardboard=new Material(plastic) {name="Range carton paperboard"};
            cardboard.SetFloat("_Kind",46);
        }

        public static Vector3 Point(float[] data) => new(data[0],data[1],data[2]);

        public Transform NewPart(int index,Transform parent,string name,bool world=false)
        {
            var node=new GameObject(name).transform;
            if(parent) node.SetParent(parent,false);
            var filter=node.gameObject.AddComponent<MeshFilter>();
            var renderer=node.gameObject.AddComponent<MeshRenderer>();
            renderer.shadowCastingMode=world && styles[index]!=6 ? ShadowCastingMode.On : ShadowCastingMode.Off;
            ChangeMesh(filter,index);
            renderer.sharedMaterial=styles[index] switch {6=>glass,46=>cardboard,_=>plastic};
            return node;
        }

        public void ChangeMesh(MeshFilter filter,int index) => filter.sharedMesh=meshes[index];
    }
}
