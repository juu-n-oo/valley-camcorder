using UnityEngine;

namespace ValleyCamcorder
{
    public sealed class ValleyTarget : MonoBehaviour
    {
        public MeshFilter face;
        public Mesh ready, hit;
        public Vector3 start;
        public float travel, phase;
        public bool Marked { get; private set; }

        void Update()
        {
            if(!Marked && travel>0)
                transform.position=start+transform.right*(travel*Mathf.Sin(Time.time*1.21f+phase));
        }

        public void Mark()
        {
            Marked=true;
            face.sharedMesh=hit;
        }

        public void ResetMark()
        {
            Marked=false;
            face.sharedMesh=ready;
            transform.position=start;
        }
    }
}
