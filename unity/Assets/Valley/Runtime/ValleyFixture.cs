using UnityEngine;

namespace ValleyCamcorder
{
    public sealed partial class ValleyFixture : MonoBehaviour
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
        int tankHits;
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
        internal string ImpactMaterial => kind switch
        {
            "glass" or "carLens"=>"glass",
            "ceramic" or "plate" or "bowl" or "cup"=>"ceramic",
            "tube" or "carTire"=>"vinyl",
            "chair" or "tent" or "umbrella" or "cushion"=>"cloth",
            "pamphlet" or "document"=>"paper",
            "door" or "woodFloor" or "woodStair" or "desk" or "rack"=>"wood",
            "table" or "phone" or "crt" or "box"=>"plastic",
            "wallPanel" or "serviceStand"=>"rock",
            _=>"metal"
        };

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
            var colliders=GetComponentsInChildren<Collider>(true);
            hitboxes=System.Array.FindAll(colliders,hit=>hit.GetComponentInParent<ValleyFixture>()==this);
            previousPosition=wakeAt=transform.position;
        }

        internal void Link(ValleyMapInteractions.Part part,ValleyMapInteractions map)
        {
            Recipe=part;
            if(kind=="carStorage" && part.grip?.Length==3)
            {
                // A storage fixture may be loaded from a scene baked before its handle was remodeled.
                grip=ValleyManifest.Point(part.grip);
                var handle=transform.Find("Handle interaction");
                if(handle) handle.localPosition=grip;
            }
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
            UpdateFlexibleProps(dt);
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
            var lastOpening=opening;
            var lastPosition=transform.localPosition;
            var lastRotation=transform.localRotation;
            opening = Mathf.MoveTowards(opening,target,dt*2.45f);
            var ease = opening*opening*(3-2*opening);
            transform.localPosition = closedAt + closedRotation*(travel*ease);
            transform.localRotation = closedRotation*Quaternion.Euler(pitch*ease,swing*ease,0);
            if((kind is "door" or "carDoor") && BlocksOperator())
            {
                opening=lastOpening;
                transform.SetLocalPositionAndRotation(lastPosition,lastRotation);
            }
        }

        bool BlocksOperator()
        {
            if(!effects || !effects.Operator) return false;
            var player=effects.Operator.GetComponent<CharacterController>();
            if(!player.enabled || (transform.position-player.transform.position).sqrMagnitude>9) return false;
            foreach(var hit in hitboxes)
                if(hit is BoxCollider && !hit.isTrigger && hit.enabled && Physics.ComputePenetration(hit,
                    hit.transform.position,hit.transform.rotation,player,player.transform.position,player.transform.rotation,
                    out _,out var distance) && distance>.015f) return true;
            return false;
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
                if(impulse>.08f && ++tankHits==4) effects?.Burst(this);
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
            if(kind=="tube" && impulse>=1.3f && !leaking)
            {
                leaking=true;
                effects?.Cue("vinyl-vent",at,.67f);
            }
            if(kind is "glass" or "ceramic" or "carLens" || portable && Fragile)
            {
                if(!Fragile && durability<=0) return;
                if(portable && durability<=0) durability=recordedHealth>0 ? recordedHealth : .72f;
                durability-=impulse;
                if(durability<=0) {Break(at);return;}
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
                        if(effects) effects.BreakFurniture(this,at,push);
                        else Disable();
                    }
                }
            }
            else if(portable && !installed && impulse>.21f)
                Nudge((direction.sqrMagnitude>.01f ? direction : transform.forward)*Mathf.Min(2.15f,impulse*.82f),
                    at,Mathf.Min(.44f,impulse*.32f));
        }

        bool Fragile => fragile || kind is "cup" or "bowl" or "plate" or "tumbler" or "pitcher" or "jar" or "carLens";

        internal void Break(Vector3 at,bool sound=true,bool fragments=true)
        {
            if(Broken) return;
            effects?.Shatter(this,at,sound,fragments);
            Disable();
        }

        internal void Disable()
        {
            ReleaseContents(Vector3.down*.26f);
            Detach();
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
            if(IsCarried || Broken || occupied || !portable || installed || force.sqrMagnitude<.03f) return;
            Detach();
            ReleaseContents(force*.74f);
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
            if(!body || body.isKinematic || collision.contactCount==0) return;
            var hit=collision.GetContact(0);
            var speed=collision.relativeVelocity.magnitude;
            if(Fragile && speed>2.9f) ToyImpact(speed*.28f,hit.point,Vector3.zero);
            if(Broken) return;
            if(speed<1.55f && hit.normal.y>.63f)
            {
                var stand=collision.collider.GetComponentInParent<ValleyFixture>();
                if(stand && stand.TrySurface(this,hit.point,out var resting))
                {
                    SetDown(resting,stand);
                    return;
                }
            }
            if(speed>.74f && effects && Time.time>=contactAt)
            {
                contactAt=Time.time+.10f;
                effects.Contact(hit.point,hit.normal,-collision.relativeVelocity.normalized,ImpactMaterial,
                    Mathf.Min(1,speed*.17f),true);
            }
        }

        public void Pickup()
        {
            ReleaseContents(Vector3.down*.12f);
            Detach();
            IsCarried=true;
            transform.SetParent(null,true);
            if (body != null) body.isKinematic=true;
            foreach (var hit in hitboxes) hit.enabled=false;
        }

        public void SetDown(Vector3 at,ValleyFixture resting=null)
        {
            transform.position=at;
            IsCarried=false;
            if(body) body.isKinematic=true;
            foreach (var hit in hitboxes) hit.enabled=true;
            if(resting) Attach(resting);
            previousPosition=at;
        }

        public void Toss(Vector3 velocity)
        {
            Detach();
            ReleaseContents(velocity*.62f);
            SetDown(transform.position);
            if (body == null) body=gameObject.AddComponent<Rigidbody>();
            body.mass=Mathf.Clamp(mass,.12f,32f);
            body.isKinematic=false;
            body.linearVelocity=velocity;
            body.angularVelocity=transform.right*2.3f;
            body.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;
        }
    }
}
