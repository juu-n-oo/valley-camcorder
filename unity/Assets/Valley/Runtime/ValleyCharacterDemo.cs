using System;
using System.IO;
using System.IO.Compression;
using UnityEngine;
using Object=UnityEngine.Object;

namespace ValleyCamcorder
{
    internal sealed class ValleyCharacterDemo : MonoBehaviour
    {
        [Serializable] sealed class Bone {public string name; public int parent; public float[] rest;}
        [Serializable] sealed class Foot {public int frame; public bool run; public string bank; public float[] at;}
        [Serializable] sealed class Recipe {public Bone[] bones;public int frames,rate;public Foot[] events;}
        const int PoseWidth=10;
        Recipe recipe;
        ValleyAudio audio;
        Transform body,cargo;
        Transform[] joints;
        float[] poses;
        float elapsed;
        int lastFrame;
        internal bool Holding => cargo && cargo.gameObject.activeSelf;
        internal int BoneCount => joints?.Length??0;
        internal Vector3 Position => body.position;

        public void Bind(Transform map,Material material,ValleyAudio sound)
        {
            const string folder="ValleyDemo/";
            audio=sound;
            recipe=JsonUtility.FromJson<Recipe>(Resources.Load<TextAsset>(folder+"Rig").text);
            var models=Resources.LoadAll<Mesh>(folder+"Models");
            var bind=Array.Find(models,mesh=>mesh.name.StartsWith("ValleyMesh-0-",StringComparison.Ordinal));
            var box=Array.Find(models,mesh=>mesh.name.StartsWith("ValleyMesh-1-",StringComparison.Ordinal));
            transform.SetParent(map,false);
            body=Node(transform,"Procedural character");
            cargo=Node(transform,"Two-hand box");
            joints=new Transform[recipe.bones.Length];
            for(int i=0;i<joints.Length;i++)
            {
                var bone=recipe.bones[i];
                joints[i]=Node(bone.parent<0 ? body : joints[bone.parent],bone.name);
                Apply(joints[i],bone.rest,0);
            }
            var mesh=Object.Instantiate(bind);
            mesh.name="Skinned Valley character demo";
            var matrices=new Matrix4x4[joints.Length];
            for(int i=0;i<joints.Length;i++) matrices[i]=joints[i].worldToLocalMatrix*body.localToWorldMatrix;
            mesh.bindposes=matrices;
            var weights=new BoneWeight[mesh.vertexCount];
            var data=Resources.Load<TextAsset>(folder+"Motion");
            using var file=new MemoryStream(data.bytes);
            using var gzip=new GZipStream(file,CompressionMode.Decompress);
            using var reader=new BinaryReader(gzip);
            for(int i=0;i<weights.Length;i++)
            {
                weights[i].boneIndex0=reader.ReadUInt16();weights[i].weight0=reader.ReadSingle();
                weights[i].boneIndex1=reader.ReadUInt16();weights[i].weight1=reader.ReadSingle();
                weights[i].boneIndex2=reader.ReadUInt16();weights[i].weight2=reader.ReadSingle();
                weights[i].boneIndex3=reader.ReadUInt16();weights[i].weight3=reader.ReadSingle();
            }
            mesh.boneWeights=weights;
            poses=new float[recipe.frames*(joints.Length+2)*PoseWidth];
            for(int i=0;i<poses.Length;i++) poses[i]=reader.ReadSingle();
            var skin=body.gameObject.AddComponent<SkinnedMeshRenderer>();
            skin.sharedMesh=mesh;
            skin.bones=joints;
            skin.rootBone=joints[0];
            skin.sharedMaterial=material;
            skin.localBounds=new Bounds(new Vector3(0,.92f,0),new Vector3(1.9f,2.9f,1.6f));
            cargo.gameObject.AddComponent<MeshFilter>().sharedMesh=box;
            cargo.gameObject.AddComponent<MeshRenderer>().sharedMaterial=material;
            Present(0);
        }

        static Transform Node(Transform parent,string name)
        {
            var node=new GameObject(name).transform;
            node.SetParent(parent,false);
            return node;
        }

        void Update()
        {
            elapsed=(elapsed+Time.deltaTime)%(recipe.frames/(float)recipe.rate);
            var frame=elapsed*recipe.rate;
            Present(frame);
            var whole=(int)frame;
            if(whole==lastFrame) return;
            foreach(var foot in recipe.events)
                if(lastFrame<whole ? foot.frame>lastFrame && foot.frame<=whole : foot.frame>lastFrame || foot.frame<=whole)
                    audio.DemoFoot(foot.bank,foot.run,new Vector3(foot.at[0],foot.at[1],foot.at[2]));
            lastFrame=whole;
        }

        internal void Present(float frame)
        {
            var a=(int)frame;
            var b=(a+1)%recipe.frames;
            var stride=(2+joints.Length)*PoseWidth;
            Blend(body,a*stride,b*stride,frame-a);
            int box=a*stride+PoseWidth;
            cargo.gameObject.SetActive(poses[box+7]>.1f);
            if(Holding) Blend(cargo,box,b*stride+PoseWidth,frame-a);
            for(int i=0;i<joints.Length;i++)
            {
                var address=(i+2)*PoseWidth;
                Blend(joints[i],a*stride+address,b*stride+address,frame-a);
            }
        }

        static Vector3 Point(float[] values,int at) => new(values[at],values[at+1],values[at+2]);
        static Quaternion Turn(float[] values,int at) => new(values[at+3],values[at+4],values[at+5],values[at+6]);
        static void Apply(Transform joint,float[] data,int at)
        {
            joint.SetLocalPositionAndRotation(Point(data,at),Turn(data,at));
            joint.localScale=Point(data,at+7);
        }

        void Blend(Transform joint,int a,int b,float blend)
        {
            joint.SetLocalPositionAndRotation(Vector3.Lerp(Point(poses,a),Point(poses,b),blend),
                Quaternion.Slerp(Turn(poses,a),Turn(poses,b),blend));
            joint.localScale=Vector3.Lerp(Point(poses,a+7),Point(poses,b+7),blend);
        }
    }
}
