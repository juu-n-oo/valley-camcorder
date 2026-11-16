using System.Collections.Generic;
using UnityEngine;

namespace ValleyCamcorder
{
    public sealed class ValleyToyCar : MonoBehaviour
    {
        enum Motion { Flight, Sink, Rest }
        const int Mask=Physics.DefaultRaycastLayers;
        const float MaximumStep=.009f, RestLifetime=30;
        float drag,startSpeed,age,distance,soundAt;
        Vector3 at,previous,velocity,spin,restOffset;
        Transform support;
        ValleyFixture supportProp;
        TrailRenderer wake;
        ValleyPlayer player;
        Motion motion;
        bool incoming,whistled;
        HashSet<ValleyFixture> struckTanks;
        internal bool Sinking => motion==Motion.Sink;
        internal bool AtRest => motion==Motion.Rest;

        internal void Begin(ValleyPlayer owner,Vector3 movement,float airDrag,bool opponent=false)
        {
            player=owner;
            incoming=opponent;
            at=previous=transform.position;
            velocity=movement;
            startSpeed=movement.magnitude;
            drag=airDrag;
            wake=gameObject.AddComponent<TrailRenderer>();
            wake.sharedMaterial=player.Facilities.ParticleMaterial;
            wake.startWidth=.027f;
            wake.endWidth=.009f;
            wake.time=.061f;
            wake.minVertexDistance=.04f;
            wake.startColor=new Color(.82f,.83f,.76f,.29f);
            wake.endColor=new Color(.81f,.83f,.74f,0);
            wake.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        internal void Obstructed(RaycastHit hit)
        {
            Resolve(hit);
            transform.position=previous=at;
        }

        void FixedUpdate()
        {
            if(!player) return;
            previous=at;
            var dt=Time.fixedDeltaTime;
            if(motion==Motion.Rest)
            {
                if(support && (!supportProp || supportProp.IsCarried || supportProp.Broken))
                {
                    support=null;
                    motion=Motion.Flight;
                    velocity=Vector3.down*.25f;
                    age=0;
                }
                else if(support) at=support.TransformPoint(restOffset);
                if((age+=dt)>RestLifetime) Destroy(gameObject);
                return;
            }
            if(motion==Motion.Sink)
            {
                age+=dt;
                var drift=new Vector3(velocity.x,-(.22f+age*.21f),velocity.z);
                velocity*=Mathf.Exp(-dt*6.5f);
                var path=drift*dt;
                if(Physics.Raycast(at,path,out var bed,path.magnitude+.008f,Mask,QueryTriggerInteraction.Ignore))
                {
                    Rest(bed.point,bed.normal,bed.collider);
                    player.Water.Bubbles(bed.point+Vector3.up*.048f,4);
                }
                else at+=path;
                transform.Rotate(28*dt,0,44*dt,Space.Self);
                if(age>8) Destroy(gameObject);
                return;
            }
            age+=dt;
            var count=Mathf.CeilToInt(dt/MaximumStep);
            var step=dt/count;
            for(int i=0;i<count && motion==Motion.Flight;i++) Fly(step);
            if(age>5.5f && motion==Motion.Flight) Destroy(gameObject);
        }

        void Fly(float dt)
        {
            var speed=velocity.magnitude;
            var below=player.world.Map.RiverAbove(at);
            var resistance=below ? speed*.036f+3.95f : speed*drag;
            var nextVelocity=velocity*Mathf.Exp(-resistance*dt)-Vector3.up*(below ? 3.9f : 7.2f)*dt;
            var delta=(velocity+nextVelocity)*(.5f*dt);
            var span=delta.magnitude;
            var contact=Physics.Raycast(at,delta,out var hit,span,Mask,QueryTriggerInteraction.Ignore);
            var intoWater=player.Water.Crossing(at,at+delta,out var wet,out var fraction);
            var limit=contact ? hit.distance/span : 1;
            if(intoWater && fraction<limit) limit=fraction;
            distance+=span*limit;
            if(incoming && !whistled && speed>10 && span>.003f) Flyby(delta,limit);
            velocity=Vector3.Lerp(velocity,nextVelocity,limit);
            if(intoWater && (!contact || fraction<hit.distance/span))
            {
                player.Water.Splash(wet,velocity,Mathf.Clamp(speed/startSpeed,.44f,1.26f),"impact");
                at=wet-Vector3.up*.009f;
                motion=Motion.Sink;
                age=0;
                wake.Clear();
                wake.emitting=false;
                velocity*=.105f;
                return;
            }
            if(contact) Resolve(hit);
            else at+=delta;
            if(spin.sqrMagnitude>.01f) transform.Rotate(spin*dt,Space.Self);
            else if(velocity.sqrMagnitude>.015f)
                transform.rotation=Quaternion.LookRotation(velocity.normalized)*Quaternion.Euler(0,0,Mathf.Sin(age*6.2f)*5.2f);
        }

        void Resolve(RaycastHit hit)
        {
            wake.Clear();
            var speed=velocity.magnitude;
            var aim=velocity.normalized;
            var incidence=Mathf.Clamp01(-Vector3.Dot(aim,hit.normal));
            var energy=Mathf.Lerp(.49f,1.64f,Mathf.Exp(-distance*.17f))*
                Mathf.Lerp(.63f,1,Mathf.Clamp01(speed/Mathf.Max(startSpeed,1)))*Mathf.Lerp(.83f,1.11f,incidence);
            var fixture=hit.collider.GetComponentInParent<ValleyFixture>();
            var target=hit.collider.GetComponentInParent<ValleyTarget>();
            bool through=false;
            float retention=.65f;
            var surface=SurfaceOf(hit,fixture);
            if(target)
            {
                if(!target.Marked)
                {
                    target.Mark();
                    player.ScoreTarget();
                }
                retention=.30f;
            }
            else if(hit.collider.TryGetComponent<ValleyFabric>(out var canvas))
            {
                through=canvas.Hit(hit.point,aim,speed);
                retention=through ? .47f : .38f;
            }
            else if(fixture)
            {
                if(fixture.kind=="tank")
                {
                    struckTanks??=new HashSet<ValleyFixture>();
                    if(speed>2 && struckTanks.Add(fixture)) fixture.ToyImpact(energy,hit.point,aim);
                    retention=.52f;
                }
                else
                {
                    var brittle=fixture.kind is "glass" or "ceramic";
                    var force=energy*Mathf.SmoothStep(0,1,Mathf.InverseLerp(3,29,speed))*Mathf.Lerp(.23f,1,incidence);
                    fixture.ToyImpact(brittle ? force : energy*Mathf.Min(1.3f,speed/14),hit.point,aim);
                    through=brittle && fixture.Broken;
                    retention=through ? fixture.kind=="glass" ? .77f : .39f :
                        fixture.kind is "tube" or "carTire" ? .24f : .42f;
                }
            }
            else if(surface=="sand" || speed<2.15f && hit.normal.y>.56f)
            {
                player.Facilities.Contact(hit.point,hit.normal,aim,surface,energy);
                Rest(hit.point,hit.normal,hit.collider);
                return;
            }
            if(!target && Time.time>=soundAt && surface!="glass" && surface!="ceramic")
            {
                player.Facilities.Contact(hit.point,hit.normal,aim,surface,energy);
                soundAt=Time.time+.067f;
            }
            if(!through && speed*retention<1.86f && hit.normal.y>.54f)
            {
                Rest(hit.point,hit.normal,hit.collider);
                return;
            }
            if(through)
            {
                at=hit.point+aim*.046f;
                velocity*=retention;
            }
            else
            {
                at=hit.point+hit.normal*.028f;
                var reflected=Vector3.Reflect(aim,hit.normal)+Random.insideUnitSphere*(fixture ? .17f : .42f);
                reflected+=hit.normal*Mathf.Max(0,.12f-Vector3.Dot(reflected,hit.normal));
                velocity=reflected.normalized*(speed*retention);
            }
            spin=new Vector3(Random.Range(-470,470),Random.Range(-390,390),Random.Range(-530,530));
        }

        string SurfaceOf(RaycastHit hit,ValleyFixture fixture)
        {
            if(fixture) return fixture.ImpactMaterial;
            var bank=hit.collider.GetComponent<ValleySurface>()?.bank;
            return bank switch
            {
                "outdoorWood" or "indoorWood"=>"wood",
                "terrain"=>player.Facilities.GroundBank(hit.point) switch
                {
                    "outdoorStone" or "indoorStone" or "asphalt"=>"rock",
                    "outdoorWood"=>"wood",
                    _=>"sand"
                },
                _=>"rock"
            };
        }

        void Flyby(Vector3 delta,float limit)
        {
            var view=player.view.transform.position;
            var along=Vector3.Dot(view-at,delta)/delta.sqrMagnitude;
            if(along<0 || along>=limit) return;
            var hearing=at+delta*along;
            var offset=hearing-view;
            var span=offset.magnitude;
            if(span<.11f || span>1.18f || Physics.Raycast(view,offset,span,Mask,QueryTriggerInteraction.Ignore)) return;
            whistled=true;
            player.sound.WorldCue("flyby",hearing,Mathf.Lerp(1,.35f,span/1.18f));
        }

        void Rest(Vector3 point,Vector3 normal,Collider surface)
        {
            at=point+normal*.014f;
            motion=Motion.Rest;
            age=0;
            wake.emitting=false;
            var forward=Vector3.ProjectOnPlane(transform.forward,normal).normalized;
            transform.rotation=Quaternion.LookRotation(forward.sqrMagnitude>.01f ? forward : Vector3.Cross(normal,Vector3.right),normal);
            supportProp=surface.GetComponentInParent<ValleyFixture>();
            if(supportProp && !supportProp.Broken)
            {
                support=supportProp.transform;
                restOffset=support.InverseTransformPoint(at);
            }
        }

        void LateUpdate()
        {
            var alpha=Mathf.Clamp01((Time.time-Time.fixedTime)/Time.fixedDeltaTime);
            transform.position=Vector3.Lerp(previous,at,alpha);
        }
    }
}
