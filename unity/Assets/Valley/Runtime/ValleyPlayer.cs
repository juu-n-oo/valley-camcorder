using UnityEngine;
using UnityEngine.Rendering;

namespace ValleyCamcorder
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class ValleyPlayer : MonoBehaviour
    {
        enum Gesture { Idle, Reach, Carry, Use, Lower }

        public ValleyWorld world;
        public Camera view;
        public ValleyHands hands;
        public ValleyAudio sound;
        public GameObject toy;
        public GameObject minicar;
        public ValleyTarget[] targets;
        public LayerMask interactionMask = Physics.DefaultRaycastLayers;
        public string Prompt { get; private set; } = "";
        public bool InRange => world.Map != null && world.Map.InRange(transform.position);
        public int Ammo { get; private set; } = 5;
        public bool ToyVisible => toy && toy.activeSelf;
        public bool Underwater { get; private set; }
        public ValleyFixture Held => held;
        public int MarkedCount { get { int count=0; foreach(var target in targets) if(target.Marked) count++; return count; } }

        CharacterController body;
        Gesture gesture;
        ValleyFixture focus, held, task;
        Vector3 setDown, setDownFrom, siteReturn, carryVelocity;
        Quaternion carryRotation, setDownTurn;
        Vector3 last;
        float pitch, yaw, previousYaw, vertical, stance=1.62f, moment, life, gait, weaponLag, nextShot,
            draw, siteYaw, sitePitch, swimDepth;
        bool diving, used, toyDrawn=true;

        void Start()
        {
            body=GetComponent<CharacterController>();
            foreach(var surface in toy.GetComponentsInChildren<Renderer>(true))
                surface.shadowCastingMode=ShadowCastingMode.Off;
            var spawn=world.Map.spawn;
            Warp(ValleyManifest.Point(spawn),spawn[3]*Mathf.Rad2Deg,-spawn[4]*Mathf.Rad2Deg);
        }

        public void Warp(Vector3 at,float heading,float elevation=0)
        {
            body??=GetComponent<CharacterController>();
            body.enabled=false;
            transform.position=at+Vector3.up*.025f;
            body.enabled=true;
            yaw=previousYaw=heading; pitch=elevation;
            transform.rotation=Quaternion.Euler(0,yaw,0);
            view.transform.localRotation=Quaternion.Euler(pitch,0,0);
            last=transform.position;
            vertical=0;
            diving=false;
            swimDepth=0;
        }

        void Update()
        {
            var dt=Mathf.Min(Time.deltaTime,.045f);
            if (dt<=0) return;
            life+=dt;
            if(Input.GetKeyDown(KeyCode.Escape)) Cursor.lockState=CursorLockMode.None;
            var click=Input.GetMouseButtonDown(0);
            var captured=click && Cursor.lockState!=CursorLockMode.Locked;
            if(captured)
            {
                Cursor.lockState=CursorLockMode.Locked;
                Cursor.visible=false;
            }
            else if(Cursor.lockState==CursorLockMode.Locked)
            {
                yaw+=Input.GetAxisRaw("Mouse X")*2.14f;
                pitch=Mathf.Clamp(pitch-Input.GetAxisRaw("Mouse Y")*2.07f,-87,87);
            }
            transform.rotation=Quaternion.Euler(0,yaw,0);
            view.transform.localRotation=Quaternion.Euler(pitch,0,0);
            Move(dt);
            if(Input.GetKeyDown(KeyCode.F) && gesture==Gesture.Idle)
            {
                if(InRange) Warp(siteReturn,siteYaw,sitePitch);
                else
                {
                    siteReturn=transform.position; siteYaw=yaw; sitePitch=pitch;
                    foreach(var target in targets)target.ResetMark();
                    Warp(ValleyManifest.Point(world.Map.rangeSpawn),0);
                }
            }
            FindTarget();
            if(Input.GetKeyDown(KeyCode.H))
            {
                if(held != null) BeginPlacement();
                else if(gesture==Gesture.Idle && focus != null && focus.portable) BeginPickup(focus);
                else if(gesture==Gesture.Idle) toyDrawn=!toyDrawn;
            }
            if(Input.GetKeyDown(KeyCode.E) && gesture==Gesture.Idle && focus != null && focus.CanUse)
            {
                task=focus; moment=0; used=false; gesture=Gesture.Use;
            }
            if(Input.GetKeyDown(KeyCode.T) && held != null)
            {
                held.Toss(view.transform.forward*4.4f+Vector3.up*1.1f);
                held=task=null;
                gesture=Gesture.Idle;
            }
            if(Input.GetKeyDown(KeyCode.R) && (InRange || focus?.kind=="supply"))
            {
                Ammo=5;
                sound.Search(InRange ? "crate" : "duffel");
            }
            Animate(dt);
            if(click && !captured && Cursor.lockState==CursorLockMode.Locked && ToyVisible && life>nextShot && Ammo>0)
                RollToyCar();
        }

        void Move(float dt)
        {
            var input=new Vector2((Input.GetKey(KeyCode.D)?1:0)-(Input.GetKey(KeyCode.A)?1:0),
                (Input.GetKey(KeyCode.W)?1:0)-(Input.GetKey(KeyCode.S)?1:0));
            input=Vector2.ClampMagnitude(input,1);
            var at=transform.position;
            bool swimming=world.Map.RiverAbove(at+Vector3.up*.62f);
            if(!swimming) diving=false;
            else if(Input.GetKeyDown(KeyCode.Z)) diving=!diving;
            var crouch=Input.GetKey(KeyCode.LeftControl);
            var height=crouch ? 1.14f : 1.72f;
            if(height>body.height &&
                Physics.CheckCapsule(at+Vector3.up*(body.height-body.radius),
                    at+Vector3.up*(height-body.radius),body.radius*.94f,interactionMask,QueryTriggerInteraction.Ignore))
                height=body.height;
            body.height=Mathf.MoveTowards(body.height,height,dt*5.3f);
            body.center=Vector3.up*(body.height*.5f+.02f);
            var run=!swimming && !crouch && input.y>.15f && Input.GetKey(KeyCode.LeftShift);
            var speed=swimming ? 1.55f : run ? 4.72f : crouch ? 1.58f : 2.72f;
            var motion=(transform.right*input.x+transform.forward*input.y)*(speed*dt);
            if(!world.Map.Walkable(at+motion))
            {
                if(!world.Map.Walkable(at+Vector3.right*motion.x)) motion.x=0;
                if(!world.Map.Walkable(at+Vector3.forward*motion.z)) motion.z=0;
                if(!world.Map.Walkable(at+motion)) motion=Vector3.zero;
            }
            if(swimming)
            {
                swimDepth=Mathf.MoveTowards(swimDepth,diving ? .92f : 0,dt*.74f);
                if(Input.GetKey(KeyCode.Space)) swimDepth=Mathf.Max(0,swimDepth-dt*1.7f);
                var level=world.Map.WaterLevel(at)-.87f-swimDepth;
                vertical=Mathf.Clamp((level-at.y)*3.45f,-1.32f,1.38f);
            }
            else
            {
                if(body.isGrounded && vertical<0) vertical=-2.1f;
                if(body.isGrounded && Input.GetKeyDown(KeyCode.Space)) vertical=4.63f;
                vertical=Mathf.Max(-34,vertical-13.1f*dt);
            }
            body.Move(motion+Vector3.up*(vertical*dt));
            var now=transform.position;
            var travel=Vector2.Distance(new Vector2(now.x,now.z),new Vector2(last.x,last.z));
            Physics.Raycast(now+Vector3.up*.5f,Vector3.down,out var floor,1.3f,interactionMask,QueryTriggerInteraction.Ignore);
            var raise=now.y-last.y;
            sound.Move(travel,raise,run,body.isGrounded,swimming,floor);
            last=now;
            gait+=travel*(run ? 7 : 5.5f);
            stance=Mathf.Lerp(stance,swimming ? 1.18f : body.height-.10f,1-Mathf.Exp(-dt*11));
            var bob=body.isGrounded && travel>.004f ? Mathf.Sin(gait)*Mathf.Min(.024f,travel*.22f) : 0;
            view.transform.localPosition=Vector3.up*(stance+bob);
            Underwater=world.Map.RiverAbove(view.transform.position-Vector3.up*.014f);
            if(now.y < -27) Warp(ValleyManifest.Point(world.Map.spawn),world.Map.spawn[3]*Mathf.Rad2Deg);
        }

        void FindTarget()
        {
            focus=null;
            Prompt="";
            if(held != null) { Prompt="H  SET DOWN     T  TOSS"; return; }
            if(!Physics.Raycast(view.transform.position,view.transform.forward,out var hit,2.26f,interactionMask,QueryTriggerInteraction.Collide)) return;
            focus=hit.collider.GetComponentInParent<ValleyFixture>();
            if(!focus) return;
            if(focus.portable) Prompt="H  PICK UP";
            else if(focus.CanUse) Prompt=focus.IsLocked ? "LOCKED" : focus.kind=="carLock" ? "E  UNLOCK CAR"
                : focus.opened ? "E  CLOSE" : "E  OPEN";
            else if(focus.kind=="supply") Prompt="R  RESUPPLY";
        }

        public void BeginPickup(ValleyFixture target)
        {
            if (!target || !target.portable || gesture!=Gesture.Idle) return;
            gesture=Gesture.Reach;
            task=target;
            moment=0;
        }

        public bool BeginPlacement()
        {
            if(!held || gesture!=Gesture.Carry)return false;
            var head=view.transform;
            var forward=Vector3.ProjectOnPlane(head.forward,Vector3.up).normalized;
            var from=transform.position+forward*(held.small ? .72f : 1.02f)+Vector3.up*1.66f;
            if(!Physics.Raycast(from,Vector3.down,out var surface,2.4f,interactionMask,QueryTriggerInteraction.Ignore) ||
                Vector3.Dot(surface.normal,Vector3.up)<.55f || !world.Map.Walkable(surface.point)) return false;
            var itemRadius=Mathf.Max(.04f,Mathf.Min(held.size.x,held.size.z)*.43f);
            if(Physics.CheckSphere(surface.point+Vector3.up*(itemRadius+.045f),itemRadius,interactionMask,QueryTriggerInteraction.Ignore))
                return false;
            setDown=surface.point+Vector3.up*.012f;
            setDownFrom=held.transform.position;
            setDownTurn=held.transform.rotation;
            gesture=Gesture.Lower; moment=0;
            return true;
        }

        void Animate(float dt)
        {
            moment+=dt;
            float blend=0, grasp=0;
            switch(gesture)
            {
                case Gesture.Reach:
                    blend=Ease(moment/.33f);
                    grasp=Ease((moment-.18f)/.22f)*.87f;
                    if(moment>=.43f) { held=task; held.Pickup(); carryRotation=held.transform.rotation; gesture=Gesture.Carry; moment=0; }
                    break;
                case Gesture.Carry:
                    blend=1; grasp=held.kind is "cup" or "flask" or "tumbler" ? .62f : .88f;
                    var depth=held.small ? .46f : Mathf.Clamp(.48f+held.size.z*.24f,.50f,.70f);
                    var shift=new Vector3(held.small ? .19f : 0,held.small ? -.19f : -.32f,depth);
                    shift.y+=Mathf.Sin(gait)*Mathf.Min(.024f,carryVelocity.magnitude*.015f);
                    var localTarget=view.transform.TransformPoint(shift);
                    var from=view.transform.position;
                    var span=localTarget-from;
                    if(Physics.SphereCast(from,.048f,span.normalized,out var obstacle,span.magnitude,interactionMask,QueryTriggerInteraction.Ignore))
                        localTarget=from+span.normalized*Mathf.Max(.10f,obstacle.distance-.095f);
                    var origin=localTarget-held.transform.TransformVector(held.LocalContact);
                    held.transform.position=Vector3.SmoothDamp(held.transform.position,origin,ref carryVelocity,
                        .07f+Mathf.Clamp01(held.mass*.10f)*.12f,10,dt);
                    carryRotation=Quaternion.Slerp(carryRotation,transform.rotation,1-Mathf.Exp(-dt*(held.small?12:6)));
                    held.transform.rotation=carryRotation;
                    break;
                case Gesture.Use:
                    blend=Ease(moment/.26f)*(1-Ease((moment-.57f)/.27f));
                    grasp=Ease((moment-.13f)/.18f)*.64f;
                    if(moment>=.28f && !used) { used=true; task.Use(); }
                    if(moment>=.85f) { gesture=Gesture.Idle; task=null; }
                    break;
                case Gesture.Lower:
                    var lowering=Ease(moment/.38f);
                    held.transform.position=Vector3.Lerp(setDownFrom,setDown,lowering);
                    held.transform.rotation=Quaternion.Slerp(setDownTurn,transform.rotation,lowering);
                    blend=1-Ease((moment-.33f)/.29f); grasp=.86f*(1-Ease((moment-.32f)/.19f));
                    if(moment>=.40f && held.IsCarried) held.SetDown(setDown);
                    if(moment>=.63f) { held=task=null; gesture=Gesture.Idle; }
                    break;
            }
            draw=Mathf.MoveTowards(draw,toyDrawn && gesture==Gesture.Idle ? 1 : 0,dt*4.5f);
            weaponLag=Mathf.Lerp(weaponLag,Mathf.Clamp((yaw-previousYaw)*.014f,-.083f,.083f),1-Mathf.Exp(-dt*13));
            previousYaw=yaw;
            toy.SetActive(draw>.025f);
            toy.transform.localPosition=new Vector3(.30f-weaponLag,-.21f-(1-draw)*.57f,.44f);
            toy.transform.localRotation=Quaternion.Euler(-4f+(1-draw)*24,weaponLag*52,1.9f);
            hands.Drive(task,blend,grasp,toy.transform,draw);
        }

        static float Ease(float t) { t=Mathf.Clamp01(t); return t*t*(3-2*t); }

        void RollToyCar()
        {
            Ammo--;
            nextShot=life+.23f;
            var emitted=Instantiate(minicar,view.transform.position+view.transform.forward*.90f+view.transform.right*.12f-Vector3.up*.098f,
                Quaternion.LookRotation(view.transform.forward));
            emitted.SetActive(true);
            var mover=emitted.AddComponent<Rigidbody>();
            mover.mass=.05f;
            mover.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;
            mover.linearVelocity=view.transform.forward*18.5f;
            emitted.AddComponent<ValleyToyCar>();
            Destroy(emitted,10);
        }
    }
}
