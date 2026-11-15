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
        float ignitionTime, nextSpark, lightAt, clickUntil, wheelDrop, appliedControl, hitCooldown;
        bool failed;
        bool pushed;
        Rigidbody body;
        Collider[] hitboxes;
        GameObject flame, spark, stream;
        AudioSource water;
        internal ValleyMapInteractions effects;
        internal ValleyMapInteractions.Part Recipe { get; private set; }
        internal bool Burning { get; set; }
        internal bool CollapsedFabric { get; set; }
        public bool Broken { get; private set; }
        internal bool HasPower => !failed && !Broken;

        public bool CanUse => !failed && !Broken && (kind is "door" or "fridge" or "carDoor" or "carLid" or "carStorage" or "carLock" or "carHandle"
            or "light" or "faucet" or "valve" or "burner");
        public bool IsSeat => kind is "chair" or "cushion";
        public bool Igniting { get; private set; }
        public string UsePrompt
        {
            get
            {
                if(IsLocked) return "LOCKED";
                if(kind=="carLock") return "E  UNLOCK CAR";
                if(kind=="burner") return enabledState ? $"E  {Recipe?.label} BURNER OFF" : $"HOLD E  LIGHT {Recipe?.label} BURNER";
                if(kind is "light" or "faucet" or "valve") return $"E  {(kind=="valve" ? "GAS VALVE" : kind.ToUpperInvariant())}  {(enabledState ? "OFF" : "ON")}";
                if(kind=="door") return $"HOLD E  {(opened ? "CLOSE" : "OPEN")}  {(Recipe?.label=="WINDOW" ? "WINDOW" : "DOOR")}";
                return opened ? "E  CLOSE" : "E  OPEN";
            }
        }
        internal ValleyFixture gasValve;
        internal int equipmentSlot;
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

        internal void Link(ValleyMapInteractions.Part part,ValleyMapInteractions map)
        {
            Recipe=part;
            if(kind is "valve" or "burner" or "faucet" or "light" && ValleyMapInteractions.HasPoint(part.useAt))
            {
                var handle=transform.Find("Handle interaction");
                if(!handle)
                {
                    handle=new GameObject("Handle interaction").transform;
                    handle.SetParent(transform,false);
                    handle.gameObject.AddComponent<BoxCollider>().isTrigger=true;
                }
                handle.position=ValleyManifest.Point(part.useAt);
                handle.GetComponent<BoxCollider>().size=ValleyManifest.Size(part.useSize);
            }
            if(ValleyMapInteractions.HasPoint(part.flameAt))
                flame=map.Draw(part.flame,ValleyManifest.Point(part.flameAt),map.transform,"Blue burner flame");
            if(ValleyMapInteractions.HasPoint(part.sparkAt))
                spark=map.Draw(part.spark,ValleyManifest.Point(part.sparkAt),map.transform,"Ignition spark");
            if(ValleyMapInteractions.HasPoint(part.flowAt))
                stream=map.Draw(part.flow,ValleyManifest.Point(part.flowAt),map.transform,"Running faucet");
            if(flame) flame.SetActive(enabledState);
            if(spark) spark.SetActive(false);
            if(stream) stream.SetActive(enabledState);
        }

        public bool Use()
        {
            if (!CanUse || IsLocked) return false;
            if (kind=="carLock")
            {
                if(vehicleDoors==null) return false;
                foreach(var door in vehicleDoors)door.locked=false;
            }
            else if (kind=="carHandle" && relatedDoor) relatedDoor.opened=!relatedDoor.opened;
            else if (kind=="burner")
            {
                if(enabledState) {enabledState=false; Igniting=false;}
                else
                {
                    Igniting=true; ignitionTime=nextSpark=0;
                    lightAt=Random.Range(.25f,.38f);
                }
            }
            else if (kind is "light" or "faucet" or "valve") enabledState=!enabledState;
            else opened=!opened;
            return true;
        }

        public void Release()
        {
            if(!Igniting) return;
            Igniting=false;
            var stable=Mathf.Pow(Mathf.SmoothStep(0,1,Mathf.InverseLerp(lightAt,2.65f,ignitionTime)),1.6f);
            if(!gasValve || !gasValve.enabledState || Random.value>Mathf.Lerp(.08f,1,stable))
                enabledState=false;
        }

        void Update()
        {
            var dt=Time.deltaTime;
            if(wheelDrop>0)
            {
                var visual=transform.GetChild(0);
                var scale=visual.localScale;
                scale.y=Mathf.MoveTowards(scale.y,.72f,dt*.75f);
                visual.localScale=scale;
                wheelDrop=Mathf.Max(0,wheelDrop-dt);
            }
            if(kind=="burner")
            {
                var gas=gasValve && gasValve.enabledState;
                if(!gas) enabledState=false;
                if(Igniting)
                {
                    ignitionTime+=dt;
                    if(ignitionTime>=nextSpark)
                    {
                        var point=spark ? spark.transform.position : transform.position;
                        effects?.Cue("stove-click",point,.66f);
                        clickUntil=Time.time+.036f;
                        nextSpark=ignitionTime+Random.Range(.105f,.151f);
                    }
                    if(gas && !enabledState && ignitionTime>=lightAt)
                    {
                        enabledState=true;
                        effects?.Cue("stove-light",flame ? flame.transform.position : transform.position,.68f);
                    }
                }
                if(flame)
                {
                    flame.SetActive(enabledState);
                    if(enabledState) flame.transform.localScale=new Vector3(1,1+.14f*Mathf.Sin(Time.time*31),1);
                }
                if(spark) spark.SetActive(Igniting && Time.time<clickUntil);
            }
            if(kind is "burner" or "valve" or "faucet" or "light")
            {
                var amount=Mathf.MoveTowards(appliedControl,enabledState || Igniting ? 1 : 0,dt*8.5f);
                if(amount!=appliedControl)
                {
                    appliedControl=amount;
                    transform.localRotation=closedRotation*Quaternion.Euler(kind=="light" ? amount*14 : 0,
                        kind=="faucet" ? amount*36 : 0,kind is "valve" or "burner" ? -amount*74 : 0);
                }
                if(stream)
                {
                    stream.SetActive(enabledState);
                    if(enabledState && !water)
                        water=effects.Pipe("tap-water",stream.transform.position,stream.transform,.63f);
                }
            }
            if(!CanUse || Mathf.Abs(swing)+Mathf.Abs(pitch)+travel.sqrMagnitude < .0001f) return;
            float target = opened ? 1 : 0;
            if(opening == target) return;
            opening = Mathf.MoveTowards(opening,target,dt*2.45f);
            var ease = opening*opening*(3-2*opening);
            transform.localPosition = closedAt + closedRotation*(travel*ease);
            transform.localRotation = closedRotation*Quaternion.Euler(pitch*ease,swing*ease,0);
        }

        internal void Shutdown()
        {
            enabledState=false;
            Igniting=false;
            failed=true;
            if(flame) flame.SetActive(false);
        }

        public void ToyImpact(float impulse) => ToyImpact(impulse,transform.position,Vector3.zero);

        internal void ToyImpact(float impulse,Vector3 at,Vector3 direction)
        {
            if(Broken) return;
            if(kind=="tank")
            {
                if(durability<=0) durability=4.6f;
                durability-=impulse;
                if(durability<=0) effects?.Burst(this);
            }
            if(kind=="carLid" && impulse>.60f)
            {
                durability-=impulse;
                if(durability<=0) locked=false;
            }
            if(kind is "carLid" or "carBody" or "carDoor" && impulse>.17f) Dent(at,direction,impulse);
            if(kind=="carTire" && wheelDrop==0 && durability>0)
            {
                durability-=impulse;
                if(durability<=0)
                {
                    wheelDrop=1;
                    effects?.Cue("tire",at,.85f);
                }
            }
            if(kind=="tube" && impulse>=1.3f && !CollapsedFabric)
            {
                CollapsedFabric=true;
                foreach(var render in GetComponentsInChildren<MeshRenderer>())
                    render.transform.localScale=Vector3.Scale(render.transform.localScale,new Vector3(1.06f,.30f,1.07f));
                effects?.Cue("tire",at,.40f);
            }
            if(kind is "glass" or "ceramic" or "carLens" || portable && Fragile)
            {
                if(!Fragile && durability<=0) return;
                if(portable && durability<=0) durability=.72f;
                durability-=impulse;
                if(durability<=0) Break(at);
            }
            if(kind=="table" || kind=="chair")
            {
                var push=direction.sqrMagnitude>.01f ? direction : transform.forward;
                Nudge(push*impulse,at,impulse*.4f);
                if(kind=="table")
                {
                    hitCooldown+=impulse;
                    if(hitCooldown>6.2f)
                    {
                        effects?.Cue("timber",at,.72f);
                        Break(at,false);
                    }
                }
            }
        }

        bool Fragile => kind is "cup" or "bowl" or "plate" or "tumbler" or "pitcher" or "jar" or "carLens";

        internal void Break(Vector3 at,bool sound=true,bool fragments=true)
        {
            if(Broken) return;
            effects?.Shatter(this,at,sound,fragments);
            Disable();
        }

        internal void Disable()
        {
            Broken=true;
            gameObject.SetActive(false);
        }

        void Dent(Vector3 at,Vector3 direction,float impulse)
        {
            var toward=direction.sqrMagnitude>.01f ? direction.normalized : (transform.position-at).normalized;
            foreach(var filter in GetComponentsInChildren<MeshFilter>())
            {
                var render=filter.GetComponent<MeshRenderer>();
                if(!render || (render.bounds.ClosestPoint(at)-at).sqrMagnitude>.29f*.29f) continue;
                var local=filter.transform.InverseTransformPoint(at);
                var dents=filter.transform.InverseTransformVector(toward)*Mathf.Min(.043f,.022f*impulse);
                var mesh=filter.mesh;
                var vertices=mesh.vertices;
                for(int i=0;i<vertices.Length;i++)
                {
                    var reach=1-Mathf.Clamp01((vertices[i]-local).sqrMagnitude/.18f);
                    vertices[i]+=dents*reach*reach;
                }
                mesh.vertices=vertices;
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();
            }
        }

        internal void Nudge(Vector3 force,Vector3 at,float lift)
        {
            if(IsCarried || Broken || !portable || force.sqrMagnitude<.03f) return;
            if(body==null) body=gameObject.AddComponent<Rigidbody>();
            body.mass=Mathf.Clamp(mass,.12f,32);
            body.isKinematic=false;
            if(!pushed)
            {
                body.linearDamping=.49f;
                body.angularDamping=1.32f;
                body.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;
                pushed=true;
            }
            body.AddForceAtPosition(force+Vector3.up*lift,at,ForceMode.VelocityChange);
        }

        void OnCollisionEnter(Collision collision)
        {
            if(body && !body.isKinematic && Fragile && collision.relativeVelocity.magnitude>2.9f)
                ToyImpact(collision.relativeVelocity.magnitude*.28f,collision.GetContact(0).point,Vector3.zero);
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
