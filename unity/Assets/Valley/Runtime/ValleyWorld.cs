using System;
using UnityEngine;

namespace ValleyCamcorder
{
    [Serializable]
    public sealed class ValleyManifest
    {
        [Serializable] public sealed class Cut { public float x, z, nx, nz, side, minZ; }
        [Serializable] public sealed class RiverBank { public float z, left, right; }
        [Serializable] public sealed class Weir { public float x, crest, toe, left, right, lower, skew; }
        [Serializable] public sealed class Landmark { public string id, name; public float[] at; public float yaw; }
        [Serializable] public sealed class Box
        {
            public float[] at, size;
            public float yaw, stair;
            public string bank;
            public int owner;
        }
        [Serializable] public sealed class Part
        {
            public string kind, label;
            public int[] meshes;
            public float[] matrix, closed, grip, size, travel, useSize;
            public bool open, locked, portable, small, on;
            public float swing, slide, pitch, mass, hp;
            public int parent, car, door, pane;
        }
        [Serializable] public sealed class Draw { public int mesh; public float[] matrix; }
        [Serializable] public sealed class Toy { public Draw[] parts, glass; public int[] cars; }
        [Serializable] public sealed class Target { public float[] at; public float yaw, radius, travel; }

        public int format, sleeve;
        public int[] solids, water, glass, stone, trunks;
        public float[] spawn, rangeSpawn, rangeBounds, fieldBounds;
        public Cut[] limits;
        public RiverBank[] river;
        public Weir weir;
        public Landmark[] landmarks;
        public Part[] objects;
        public Box[] boxes;
        public Toy launcher;
        public Target[] rangeTargets;
        public int[] targetFaces;

        public static Vector3 Point(float[] point) => new(point[0], point[1], -point[2]);
        public static Vector3 Size(float[] size) => new(size[0],size[1],size[2]);
        public static Quaternion Turn(float yaw) => Quaternion.Euler(0, -yaw*Mathf.Rad2Deg, 0);

        public static void ApplyMatrix(Transform target, float[] matrix)
        {
            var right = new Vector3(matrix[0],matrix[1],-matrix[2]);
            var up = new Vector3(matrix[4],matrix[5],-matrix[6]);
            var forward = new Vector3(-matrix[8],-matrix[9],matrix[10]);
            var hand = Mathf.Sign(Vector3.Dot(Vector3.Cross(up,forward),right));
            target.localPosition = new Vector3(matrix[12],matrix[13],-matrix[14]);
            target.localRotation = Quaternion.LookRotation(forward.normalized,up.normalized);
            target.localScale = new Vector3(hand*right.magnitude,up.magnitude,forward.magnitude);
        }

        public bool InRange(Vector3 at) => Contains(rangeBounds, at.x, -at.z);

        public bool Walkable(Vector3 at)
        {
            var x = at.x;
            var z = -at.z;
            if (Contains(rangeBounds,x,z)) return true;
            if (!Contains(fieldBounds,x,z)) return false;
            foreach (var cut in limits)
                if (z >= cut.minZ && cut.side*((z-cut.z)*cut.nx-(x-cut.x)*cut.nz)>.13f) return false;
            return true;
        }

        static bool Contains(float[] bounds, float x, float z) =>
            x >= bounds[0] && x <= bounds[1] && z >= bounds[2] && z <= bounds[3];

        public float WaterLevel(Vector3 at)
        {
            float station = -at.z-(at.x-weir.x)*weir.skew;
            return Mathf.Lerp(weir.lower,0,Mathf.InverseLerp(weir.toe,weir.crest,station));
        }

        public bool RiverAbove(Vector3 at)
        {
            var z=-at.z;
            if (z < river[0].z || z > river[^1].z || at.y >= WaterLevel(at)) return false;
            int i = Mathf.Clamp(Mathf.FloorToInt((z-river[0].z)/(river[1].z-river[0].z)),0,river.Length-2);
            var a=river[i];
            var b=river[i+1];
            var t=Mathf.InverseLerp(a.z,b.z,z);
            return at.x > Mathf.Lerp(a.left,b.left,t) && at.x < Mathf.Lerp(a.right,b.right,t);
        }

        public Vector3 FallPoint(Vector3 listener)
        {
            var x=Mathf.Clamp(listener.x,weir.left,weir.right);
            return new Vector3(x,(weir.toe-weir.crest)*.23f,-(weir.crest+(x-weir.x)*weir.skew));
        }
    }

    public sealed class ValleyWorld : MonoBehaviour
    {
        public TextAsset manifest;
        [NonSerialized] public ValleyManifest Map;
        void Awake() => Map = JsonUtility.FromJson<ValleyManifest>(manifest.text);
    }
}
