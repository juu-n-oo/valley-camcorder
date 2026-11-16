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
        Quaternion rest;
        Collider hitbox;
        float hitAt;

        void Awake()
        {
            rest=transform.localRotation;
            hitbox=GetComponent<Collider>();
        }

        void Update()
        {
            if(Marked)
                transform.localRotation=rest*Quaternion.Euler(-.83f*Mathf.Rad2Deg*
                    Mathf.SmoothStep(0,1,(Time.time-hitAt)/.32f),0,0);
            else if(travel>0)
                transform.position=start+transform.right*(travel*Mathf.Sin(Time.time*1.21f+phase));
        }

        public void Mark()
        {
            Marked=true;
            hitAt=Time.time;
            if(hitbox) hitbox.enabled=false;
            face.sharedMesh=hit;
        }

        public void ResetMark()
        {
            Marked=false;
            face.sharedMesh=ready;
            transform.position=start;
            transform.localRotation=rest;
            if(hitbox) hitbox.enabled=true;
        }
    }
}
