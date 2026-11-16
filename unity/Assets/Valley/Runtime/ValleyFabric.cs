using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace ValleyCamcorder
{
    internal sealed class ValleyFabric : MonoBehaviour
    {
        readonly List<Vector3> joints=new();
        ValleyFixture fixture;
        MeshCollider shape;
        Mesh mesh;
        MeshRenderer cloth;
        MaterialPropertyBlock properties;
        bool frame, falling;

        public static void Add(ValleyFixture item,Collider player)
        {
            if(item.kind is not ("tent" or "umbrella")) return;
            bool first=true;
            foreach(var branch in item.GetComponentsInChildren<MeshFilter>())
            {
                var drawing=branch.GetComponent<MeshRenderer>();
                var material=drawing.sharedMaterial;
                if(!material || !branch.sharedMesh || !branch.sharedMesh.isReadable) continue;
                var kind=material.GetInt("_Kind");
                var isFrame=kind is 15 or 40 or 47;
                if(!isFrame)
                {
                    var bounds=branch.sharedMesh.bounds;
                    var block=new MaterialPropertyBlock();
                    drawing.GetPropertyBlock(block);
                    block.SetVector("_FabricWind",new Vector4(item.kind=="tent" ? .017f : .025f,bounds.min.y,
                        1/Mathf.Max(.15f,bounds.size.y),branch.transform.position.x*.31f));
                    drawing.SetPropertyBlock(block);
                }
                if(!isFrame && !first) continue;
                var contact=branch.gameObject.AddComponent<ValleyFabric>();
                contact.frame=isFrame;
                contact.fixture=item;
                if(!isFrame)
                {
                    contact.cloth=drawing;
                    contact.properties=new MaterialPropertyBlock();
                }
                contact.shape=branch.gameObject.AddComponent<MeshCollider>();
                contact.shape.sharedMesh=branch.sharedMesh;
                Physics.IgnoreCollision(player,contact.shape);
                if(!isFrame) first=false;
            }
        }

        public bool Hit(Vector3 at,Vector3 direction,float speed)
        {
            if(falling || fixture.Broken || speed<3) return false;
            var local=transform.InverseTransformPoint(at);
            var force=transform.InverseTransformVector(direction.normalized)*Mathf.Min(.08f,speed*.0014f);
            if(cloth && speed<24)
            {
                cloth.GetPropertyBlock(properties);
                properties.SetVector("_FabricTouch",new Vector4(local.x,local.y,local.z,Time.timeSinceLevelLoad));
                properties.SetVector("_FabricPush",force);
                cloth.SetPropertyBlock(properties);
                fixture.effects?.Cue("cloth-contact",at,.35f);
                return false;
            }
            if(speed<13) return false;
            bool torn=false;
            if(!mesh) mesh=GetComponent<MeshFilter>().mesh;
            var vertices=mesh.vertices;
            var reach=frame ? .21f : .081f+speed*.0012f;
            for(int i=0;i<vertices.Length;i++)
            {
                var scale=1-Mathf.Clamp01((vertices[i]-local).magnitude/reach);
                vertices[i]+=force*scale*scale;
            }
            mesh.vertices=vertices;
            if(!frame && speed>=24)
            {
                var triangles=mesh.triangles;
                var remaining=new List<int>(triangles.Length);
                var rangeSq=reach*reach*.77f;
                for(int i=0;i<triangles.Length;i+=3)
                {
                    var a=vertices[triangles[i]];
                    var b=vertices[triangles[i+1]];
                    var c=vertices[triangles[i+2]];
                    if((ClosestPoint(local,a,b,c)-local).sqrMagnitude<rangeSq) {torn=true;continue;}
                    remaining.Add(triangles[i]);remaining.Add(triangles[i+1]);remaining.Add(triangles[i+2]);
                }
                mesh.SetTriangles(remaining,0);
            }
            if(mesh.vertexCount>0)
            {
                mesh.RecalculateBounds();
                mesh.RecalculateNormals();
                shape.sharedMesh=null;
                if(mesh.GetIndexCount(0)>0) shape.sharedMesh=mesh;
            }
            fixture.effects?.Cue(frame ? "metal-ricochet" : torn ? "cloth-tear" : "cloth-contact",at,.46f);
            if(!frame || speed<29 || joints.Exists(p=>(p-local).sqrMagnitude<.12f)) return torn;
            joints.Add(local);
            if(joints.Count>=3)
            {
                falling=true;
                StartCoroutine(Fold());
            }
            return torn;
        }

        IEnumerator Fold()
        {
            var tent=fixture.transform;
            var scale=tent.localScale;
            for(var time=0f;time<.67f;time+=Time.deltaTime)
            {
                tent.localScale=new Vector3(scale.x,scale.y*Mathf.SmoothStep(1,.13f,time/.67f),scale.z);
                yield return null;
            }
            tent.localScale=new Vector3(scale.x,scale.y*.13f,scale.z);
            fixture.CollapsedFabric=true;
        }

        static Vector3 ClosestPoint(Vector3 p,Vector3 a,Vector3 b,Vector3 c)
        {
            var ab=b-a; var ac=c-a; var ap=p-a;
            float d1=Vector3.Dot(ab,ap), d2=Vector3.Dot(ac,ap);
            if(d1<=0 && d2<=0) return a;
            var bp=p-b;
            float d3=Vector3.Dot(ab,bp), d4=Vector3.Dot(ac,bp);
            if(d3>=0 && d4<=d3) return b;
            var vc=d1*d4-d3*d2;
            if(vc<=0 && d1>=0 && d3<=0) return a+ab*(d1/(d1-d3));
            var cp=p-c;
            float d5=Vector3.Dot(ab,cp), d6=Vector3.Dot(ac,cp);
            if(d6>=0 && d5<=d6) return c;
            var vb=d5*d2-d1*d6;
            if(vb<=0 && d2>=0 && d6<=0) return a+ac*(d2/(d2-d6));
            var va=d3*d6-d5*d4;
            if(va<=0 && d4-d3>=0 && d5-d6>=0) return b+(c-b)*((d4-d3)/(d4-d3+d5-d6));
            var rest=va+vb+vc;
            return Mathf.Abs(rest)>.000000001f ? a+(ab*vb+ac*vc)/rest : a;
        }
    }
}
