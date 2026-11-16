using System.Collections.Generic;
using UnityEngine;

namespace ValleyCamcorder
{
    public sealed partial class ValleyFixture
    {
        readonly HashSet<ValleyFixture> contents=new();
        ValleyFixture support,wheelHub;
        Vector3 tireAt,hubAt,tubeScale=Vector3.one,previousPosition,wakeAt,surface;
        Transform tubeVisual;
        float tubeAir=1,recordedHealth=-1,contactAt;
        bool installed,fragile,occupied,leaking,floating;
        internal ValleyFixture Support => support;
        internal float TubeAir => tubeAir;
        internal bool CanPickup => portable && !Broken && !occupied &&
            (!installed || kind!="ashtray" || !support || support.opening>.85f);
        internal bool CanSupport => surface.y>0 && !Broken && !IsCarried &&
            Vector3.Dot(transform.up,Vector3.up)>.94f && (!body || body.isKinematic || body.IsSleeping());

        internal void ConfigureProp(ValleyFixture parent,bool mount,float[] top,bool breaks,float health,float air)
        {
            if(top?.Length==3) surface=new Vector3(top[0],top[1],top[2]);
            fragile=breaks;
            if(fragile && health>0) recordedHealth=health;
            if(kind=="tube")
            {
                tubeAir=Mathf.Clamp(air,.05f,1);
                tubeVisual=GetComponentInChildren<MeshRenderer>()?.transform;
                if(tubeVisual) tubeScale=tubeVisual.localScale;
            }
            if(parent && parent!=this) Attach(parent,mount);
        }

        internal void Occupy(bool value) => occupied=value;

        internal void SetWheelHub(ValleyFixture hub)
        {
            wheelHub=hub;
            tireAt=transform.localPosition;
            if(hub) hubAt=hub.transform.localPosition;
        }

        internal bool TrySurface(ValleyFixture item,Vector3 point,out Vector3 rest)
        {
            rest=default;
            if(!CanSupport || !item.small || item==this) return false;
            var p=transform.InverseTransformPoint(point);
            if(Mathf.Abs(p.x)+item.size.x*.42f>surface.y || Mathf.Abs(p.z)+item.size.z*.42f>surface.z ||
                Mathf.Abs(p.y-surface.x)>.24f) return false;
            p.y=surface.x+.008f;
            foreach(var prop in contents)
            {
                if(!prop || prop==item || prop.Broken || prop.installed) continue;
                var other=transform.InverseTransformPoint(prop.transform.position);
                if(Mathf.Abs(other.x-p.x)<(prop.size.x+item.size.x)*.44f &&
                   Mathf.Abs(other.z-p.z)<(prop.size.z+item.size.z)*.44f) return false;
            }
            rest=transform.TransformPoint(p);
            return true;
        }

        void Attach(ValleyFixture parent,bool mount=false)
        {
            Detach();
            support=parent;
            installed=mount;
            parent.contents.Add(this);
            transform.SetParent(parent.transform,true);
        }

        void Detach()
        {
            if(!support) return;
            support.contents.Remove(this);
            support=null;
            installed=false;
            transform.SetParent(null,true);
        }

        void ReleaseContents(Vector3 movement)
        {
            if(contents.Count==0) return;
            foreach(var item in new List<ValleyFixture>(contents))
            {
                if(!item || item.IsCarried) continue;
                item.Detach();
                item.Toss(movement+Vector3.down*.16f+Random.insideUnitSphere*.19f);
            }
        }

        void UpdateFlexibleProps(float dt)
        {
            if(wheelDrop>0)
            {
                wheelDrop=Mathf.Max(0,wheelDrop-dt*.88f);
                var visual=transform.GetChild(0);
                var scale=visual.localScale;
                scale.y=Mathf.Lerp(.79f,1,wheelDrop);
                visual.localScale=scale;
                if(wheelHub)
                {
                    var drop=Vector3.up*(.082f*(1-wheelDrop));
                    transform.localPosition=tireAt-drop;
                    wheelHub.transform.localPosition=hubAt-drop;
                }
            }
            if(!leaking || !tubeVisual) return;
            tubeAir=Mathf.Max(.05f,tubeAir-dt*(.27f+.38f*tubeAir));
            var lapse=1-tubeAir;
            var droop=IsCarried ? .76f*lapse : 0;
            tubeVisual.localScale=Vector3.Scale(tubeScale,new Vector3(1+.08f*lapse,.25f+.75f*tubeAir,1+.06f*lapse));
            tubeVisual.localRotation=Quaternion.Euler(droop*67,0,droop*22);
        }

        void FixedUpdate()
        {
            if(!portable || IsCarried || Broken || support || !effects || !effects.Operator.Water) return;
            var controller=effects.Operator;
            var point=transform.position;
            var map=controller.world.Map;
            var crossing=controller.Water.Crossing(previousPosition,point,out var wet,out _);
            previousPosition=point;
            if(crossing)
            {
                var movement=body && !body.isKinematic ? body.linearVelocity : Vector3.down;
                controller.Water.Splash(wet,movement,Mathf.Clamp(movement.magnitude*.17f,.44f,1.16f),"impact");
                if(body && !body.isKinematic) body.linearVelocity*=.37f;
            }
            if(kind!="tube") return;
            var height=map.WaterLevel(point);
            if(point.y>height+.16f || !map.RiverAbove(new Vector3(point.x,height-.036f,point.z)))
            {
                if(floating && body)
                {
                    body.linearDamping=.49f;
                    floating=false;
                }
                return;
            }
            if(!body) body=gameObject.AddComponent<Rigidbody>();
            if(!floating || body.isKinematic)
            {
                body.isKinematic=false;
                body.mass=Mathf.Clamp(mass,.12f,32);
                body.linearDamping=1.8f;
                body.angularDamping=3;
                floating=true;
                wakeAt=point;
            }
            var surfaceY=height-.035f+tubeAir*.079f+Mathf.Sin(Time.time*2.3f+point.x)*.018f;
            var lift=-Physics.gravity.y+(surfaceY-point.y)*23-body.linearVelocity.y*3.4f;
            body.AddForce(Vector3.up*lift,ForceMode.Acceleration);
            body.AddTorque(Vector3.Cross(transform.up,Vector3.up)*7.3f,ForceMode.Acceleration);
            if((point-wakeAt).sqrMagnitude>.34f*.34f)
            {
                controller.Water.Ripple(point,.23f+tubeAir*.13f);
                wakeAt=point;
            }
        }
    }
}
