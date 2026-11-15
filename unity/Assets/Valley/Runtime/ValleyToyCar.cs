using UnityEngine;

namespace ValleyCamcorder
{
    public sealed class ValleyToyCar : MonoBehaviour
    {
        public void Begin(Collider player,Vector3 velocity,float drag)
        {
            var bounds=GetComponent<MeshFilter>().sharedMesh.bounds;
            var shell=gameObject.AddComponent<BoxCollider>();
            shell.center=bounds.center;
            shell.size=Vector3.Max(bounds.size,Vector3.one*.008f);
            Physics.IgnoreCollision(player,shell);
            var body=gameObject.AddComponent<Rigidbody>();
            body.mass=.05f;
            body.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;
            body.interpolation=RigidbodyInterpolation.Interpolate;
            body.linearDamping=velocity.magnitude*drag;
            body.linearVelocity=velocity;
        }

        void OnCollisionEnter(Collision hit)
        {
            if(hit.contactCount==0) return;
            var contact=hit.GetContact(0);
            Impact(hit.collider,contact.point,hit.relativeVelocity.magnitude,-contact.normal);
        }

        public void Impact(Collider collider,Vector3 point,float speed,Vector3 direction)
        {
            if(collider.TryGetComponent<ValleyFabric>(out var cloth)) cloth.Hit(point,direction,speed);
            else
            {
                var fixture=collider.GetComponentInParent<ValleyFixture>();
                if(fixture && speed>.6f) fixture.ToyImpact(speed*.052f,point,direction);
            }
            var target=collider.GetComponentInParent<ValleyTarget>();
            if(target)target.Mark();
        }
    }
}
