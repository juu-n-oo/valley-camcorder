using UnityEngine;

namespace ValleyCamcorder
{
    public sealed class ValleyToyCar : MonoBehaviour
    {
        void OnCollisionEnter(Collision hit)
        {
            var fixture=hit.collider.GetComponentInParent<ValleyFixture>();
            if(fixture)fixture.ToyImpact(hit.relativeVelocity.magnitude*.052f);
            var target=hit.collider.GetComponentInParent<ValleyTarget>();
            if(target)target.Mark();
        }
    }
}
