using System.Collections.Generic;
using UnityEngine;

namespace ValleyCamcorder.Editor
{
    static class ValleyHorizon
    {
        const int bearings=256, rows=28;

        public static Mesh Build(ValleyManifest map)
        {
            var vertices=new List<Vector3>((rows+1)*(bearings+1));
            var indices=new List<int>(6*rows*bearings);
            var normals=new List<Vector3>(vertices.Capacity);
            var tint=new List<Color>(vertices.Capacity);
            var forest=new List<Vector2>(vertices.Capacity);
            for(int row=0;row<=rows;row++)
            {
                var distance=(float)row/rows;
                for(int i=0;i<=bearings;i++)
                {
                    float angle=i*Mathf.PI*2/bearings, u=Mathf.Cos(angle), v=Mathf.Sin(angle);
                    float x=-110+u*Mathf.Lerp(555,2380,distance);
                    float z=-90+v*Mathf.Lerp(669,2310,distance);
                    var band=.55f*Mathf.Sin(angle*7+.67f)+.27f*Mathf.Cos(angle*13+.37f)+.18f*Mathf.Sin(angle*23+.90f);
                    var fold=Mathf.PerlinNoise(x*.0051f+14.3f,z*.0049f+19.4f)-.52f;
                    var riverGap=RiverClearance(map,x,z);
                    var slope=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.04f,.33f,distance))*riverGap;
                    float y=-27+slope*(84+43*Mathf.Sin(distance*27+band*1.66f)+105*distance+
                        band*78+fold*67);
                    vertices.Add(new Vector3(x,y,z));
                    normals.Add(new Vector3(-u*.22f,1,-v*.22f).normalized);
                    var treeline=.48f+.15f*band+.10f*fold+.18f*distance;
                    var color=Color.Lerp(new Color(.33f,.51f,.39f),new Color(.69f,.76f,.65f),treeline);
                    tint.Add(color);
                    forest.Add(new Vector2(1,0));
                    if (row==0 || i==0) continue;
                    var d=row*(bearings+1)+i;
                    var b=d-(bearings+1);
                    indices.Add(b-1); indices.Add(b); indices.Add(d-1);
                    indices.Add(d-1); indices.Add(b); indices.Add(d);
                }
            }
            var mesh=new Mesh { name="Forested ridge lines beyond the valley path" };
            mesh.SetVertices(vertices);
            mesh.SetUVs(0,forest);
            mesh.SetNormals(normals);
            mesh.SetColors(tint);
            mesh.SetTriangles(indices,0,true);
            return mesh;
        }

        // Leave room behind both rendered river ends for the channel to bend out of view.
        static float RiverClearance(ValleyManifest map,float x,float z)
        {
            var bank=z>0 ? map.river[0] : map.river[^1];
            var center=(bank.left+bank.right)*.5f;
            return Mathf.SmoothStep(0,1,Mathf.InverseLerp(39,148,Mathf.Abs(x-center)));
        }

        public static Mesh[] Water(ValleyManifest map)
        {
            return new[] { Extension(map.river[0],map.weir.lower,-1),Extension(map.river[^1],0,1) };
        }

        static Mesh Extension(ValleyManifest.RiverBank bank,float elevation,int direction)
        {
            const int segments=42;
            var positions=new List<Vector3>();
            var triangles=new List<int>();
            var depth=new List<Vector2>();
            var normals=new List<Vector3>();
            for(int i=0;i<=segments;i++)
            {
                var t=i/(float)segments;
                var z=-bank.z-direction*780*t;
                var drift=(1-Mathf.Cos(t*3.9f))*37*direction;
                var middle=(bank.left+bank.right)*.5f+drift;
                var wide=(bank.right-bank.left)*.5f*Mathf.Lerp(1,.23f,t);
                positions.Add(new Vector3(middle-wide,elevation,z));
                positions.Add(new Vector3(middle+wide,elevation,z));
                depth.Add(new Vector2(-.83f,0)); depth.Add(new Vector2(-.83f,0));
                normals.Add(Vector3.up); normals.Add(Vector3.up);
                if(i==0)continue;
                var a=i*2-2;
                triangles.Add(a);triangles.Add(a+1);triangles.Add(a+3);
                triangles.Add(a);triangles.Add(a+3);triangles.Add(a+2);
            }
            var mesh=new Mesh { name="River after the trail boundary" };
            mesh.SetVertices(positions);
            mesh.SetUVs(0,depth);
            mesh.SetNormals(normals);
            mesh.SetTriangles(triangles,0,true);
            return mesh;
        }
    }
}
