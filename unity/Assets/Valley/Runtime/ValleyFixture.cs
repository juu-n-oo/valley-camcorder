using UnityEngine;

namespace ValleyCamcorder
{
    public sealed class ValleyFixture : MonoBehaviour
    {
        public string kind;
        public bool portable, small, locked, opened, enabledState;
        public Vector3 grip, size;
        public Vector3 closedAt;
        public Quaternion closedRotation = Quaternion.identity;
        public float swing, pitch, mass = 1, durability;
        public Vector3 travel;
        public ValleyFixture relatedDoor, window;
        public ValleyFixture[] vehicleDoors;
        float opening;
        Rigidbody body;
        Collider[] hitboxes;

        public bool CanUse => kind is "door" or "fridge" or "carDoor" or "carLid" or "carStorage" or "carLock" or "carHandle";
        public bool IsLocked => locked || relatedDoor && relatedDoor.locked ||
            kind=="carLock" && window && window.gameObject.activeSelf;
        public Vector3 LocalContact => kind is "cup" or "tumbler" or "flask"
            ? new Vector3(size.x*.46f,size.y*.56f,0) : grip;
        public Vector3 Contact => transform.TransformPoint(LocalContact);
        public bool IsCarried { get; private set; }

        void Awake()
        {
            opening = opened ? 1 : 0;
            hitboxes = GetComponentsInChildren<Collider>(true);
        }

        public bool Use()
        {
            if (!CanUse || IsLocked) return false;
            if (kind=="carLock")
            {
                foreach(var door in vehicleDoors)door.locked=false;
            }
            else if (kind=="carHandle" && relatedDoor) relatedDoor.opened=!relatedDoor.opened;
            else opened=!opened;
            return true;
        }

        void Update()
        {
            if (!CanUse || Mathf.Abs(swing)+Mathf.Abs(pitch)+travel.sqrMagnitude < .0001f) return;
            float target = opened ? 1 : 0;
            if (opening == target) return;
            opening = Mathf.MoveTowards(opening,target,Time.deltaTime*2.05f);
            var ease = opening*opening*(3-2*opening);
            transform.localPosition = closedAt + closedRotation*(travel*ease);
            transform.localRotation = closedRotation*Quaternion.Euler(pitch*ease,swing*ease,0);
        }

        public void ToyImpact(float impulse)
        {
            if (kind=="carLid" && impulse>.10f)
                locked=false;
            if (kind!="glass" || durability<=0) return;
            durability-=impulse;
            if(durability<=0)gameObject.SetActive(false);
        }

        public void Pickup()
        {
            IsCarried=true;
            transform.SetParent(null,true);
            if (body != null) body.isKinematic=true;
            foreach (var hit in hitboxes) hit.enabled=false;
        }

        public void SetDown(Vector3 at)
        {
            transform.position=at;
            IsCarried=false;
            foreach (var hit in hitboxes) hit.enabled=true;
        }

        public void Toss(Vector3 velocity)
        {
            SetDown(transform.position);
            if (body == null) body=gameObject.AddComponent<Rigidbody>();
            body.mass=Mathf.Clamp(mass,.12f,32f);
            body.isKinematic=false;
            body.linearVelocity=velocity;
            body.angularVelocity=transform.right*2.3f;
        }
    }
}
