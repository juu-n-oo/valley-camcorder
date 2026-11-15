using UnityEngine;

namespace ValleyCamcorder
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class ValleyPlayer : MonoBehaviour
    {
        enum Gesture { Idle, Reach, Carry, Use, Lower, Throw }

        internal struct Controls
        {
            public Vector2 move, look;
            public bool run, crouch, jump, jumpHeld, z, range, hand, interact, interactHeld, toss,
                reload, reloadHeld, inspect, motor, trigger, triggerHeld, aim;
            public int slot;
        }

        public ValleyWorld world;
        public Camera view;
        public ValleyHands hands;
        public ValleyAudio sound;
        public GameObject toy;
        public ValleyTarget[] targets;
        public LayerMask interactionMask = Physics.DefaultRaycastLayers;
        public string Prompt { get; private set; } = "";
        public bool InRange => world.Map != null && world.Map.InRange(transform.position);
        public ValleyEquipment Equipment { get; private set; }
        public ValleyResupply Resupply { get; private set; }
        internal ValleyMapInteractions Facilities { get; private set; }
        public bool Underwater { get; private set; }
        public bool Swimming { get; private set; }
        public bool Diving { get; private set; }
        public bool Prone { get; private set; }
        public bool Paused { get; private set; }
        public bool Rewinding => rewindTime>0;
        public float Air { get; private set; }=20;
        public int Health { get; private set; }=100;
        public float RangeTime => rangeEnd>0 ? rangeEnd : Mathf.Max(0,life-rangeStart);
        public ValleyFixture Held => held;
        public int MarkedCount { get { int count=0; foreach(var target in targets) if(target.Marked) count++; return count; } }

        CharacterController body;
        Gesture gesture;
        ValleyFixture focus, held, task, seated;
        Vector3 setDown, setDownFrom, siteReturn, carryVelocity, standAt, moveVelocity;
        Quaternion carryRotation, setDownTurn;
        Vector3 last;
        float pitch, yaw, vertical, stance=1.62f, moment, life, gait, siteYaw, sitePitch, swimDepth,
            targetDepth, swimVelocity, bubbleAt, breathTick, recoverAt, rangeStart, rangeEnd, footHeight, rewindTime;
        bool used, toyDrawn=true, nearSupply, drawAfterPlacement, releaseUse;
        int pendingSlot;

        void Start()
        {
            body=GetComponent<CharacterController>();
            Equipment=new ValleyEquipment(view,toy,body,sound);
            Resupply=new ValleyResupply(sound,Equipment,world.Map,world.transform);
            Facilities=world.gameObject.AddComponent<ValleyMapInteractions>();
            Facilities.Bind(world.Map,this,sound);
            var spawn=world.Map.spawn;
            Warp(ValleyManifest.Point(spawn),spawn[3]*Mathf.Rad2Deg,-spawn[4]*Mathf.Rad2Deg);
        }

        public void Warp(Vector3 at,float heading,float elevation=0)
        {
            body??=GetComponent<CharacterController>();
            body.enabled=false;
            transform.position=at+Vector3.up*.025f;
            body.enabled=true;
            seated=null;
            yaw=heading; pitch=elevation;
            transform.rotation=Quaternion.Euler(0,yaw,0);
            view.transform.localRotation=Quaternion.Euler(pitch,0,0);
            last=transform.position;
            vertical=swimDepth=targetDepth=swimVelocity=0;
            moveVelocity=Vector3.zero;
            Swimming=Diving=Prone=Underwater=false;
            sound.WaterDepth(0);
        }

        void Update()
        {
            var click=Input.GetMouseButtonDown(0);
            if(Input.GetKeyDown(KeyCode.Escape) && !Paused)
            {
                Pause(true);
                return;
            }
            var captured=click && Cursor.lockState!=CursorLockMode.Locked;
            if(captured)
            {
                Pause(false);
                Cursor.lockState=CursorLockMode.Locked;
                Cursor.visible=false;
            }
            if(Paused || Time.deltaTime<=0) return;
            var locked=!captured && Cursor.lockState==CursorLockMode.Locked;
            var controls=new Controls
            {
                look=locked ? new Vector2(Input.GetAxisRaw("Mouse X"),Input.GetAxisRaw("Mouse Y")) : Vector2.zero,
                move=new Vector2((Input.GetKey(KeyCode.D)?1:0)-(Input.GetKey(KeyCode.A)?1:0),
                    (Input.GetKey(KeyCode.W)?1:0)-(Input.GetKey(KeyCode.S)?1:0)),
                run=Input.GetKey(KeyCode.LeftShift)||Input.GetKey(KeyCode.RightShift),
                crouch=Input.GetKey(KeyCode.LeftControl)||Input.GetKey(KeyCode.RightControl),
                jump=Input.GetKeyDown(KeyCode.Space),jumpHeld=Input.GetKey(KeyCode.Space),z=Input.GetKeyDown(KeyCode.Z),
                range=Input.GetKeyDown(KeyCode.F),hand=Input.GetKeyDown(KeyCode.H),interact=Input.GetKeyDown(KeyCode.E),
                interactHeld=Input.GetKey(KeyCode.E),toss=Input.GetKeyDown(KeyCode.T),
                reload=Input.GetKeyDown(KeyCode.R),reloadHeld=Input.GetKey(KeyCode.R),
                inspect=Input.GetKeyDown(KeyCode.C),motor=Input.GetKeyDown(KeyCode.M),
                trigger=locked && click,triggerHeld=locked && Input.GetMouseButton(0),
                aim=locked && Input.GetMouseButtonDown(1),
                slot=Pressed(KeyCode.Alpha1,KeyCode.Keypad1) ? 1 : Pressed(KeyCode.Alpha2,KeyCode.Keypad2) ? 2 :
                    Pressed(KeyCode.Alpha3,KeyCode.Keypad3) ? 3 : 0
            };
            Step(Mathf.Min(Time.deltaTime,.045f),controls);
        }

        static bool Pressed(KeyCode key,KeyCode alternate) => Input.GetKeyDown(key)||Input.GetKeyDown(alternate);

        void Pause(bool pause)
        {
            if(Paused==pause) return;
            Paused=pause;
            Time.timeScale=pause ? 0 : 1;
            AudioListener.pause=pause;
            if(pause) {Cursor.lockState=CursorLockMode.None; Cursor.visible=true;}
        }

        void OnDisable() {if(Paused) Pause(false);}

        internal void Step(float dt,Controls input)
        {
            life+=dt;
            if(Health<=0)
            {
                if(rewindTime==0)
                {
                    Equipment.Cancel();
                    Resupply.Cancel();
                    sound.WaterDepth(0);
                    sound.Cue("rewind");
                }
                rewindTime+=dt;
                if(rewindTime>=1.24f) Respawn();
                return;
            }
            var sensitivity=Mathf.Lerp(1,.71f,Equipment.Aim);
            yaw+=Mathf.Clamp(input.look.x,-40,40)*2.14f*sensitivity;
            pitch=Mathf.Clamp(pitch-Mathf.Clamp(input.look.y,-40,40)*2.07f*sensitivity,-68,78);
            transform.rotation=Quaternion.Euler(0,yaw,0);
            view.transform.localRotation=Quaternion.Euler(pitch,0,0);
            Move(dt,input);
            if(Health<=0) return;
            if(input.range && gesture==Gesture.Idle && !seated && !Swimming && body.isGrounded && !Equipment.Busy)
            {
                Equipment.Cancel();
                Equipment.ClearProjectiles();
                Resupply.Cancel();
                if(InRange) Warp(siteReturn,siteYaw,sitePitch);
                else
                {
                    siteReturn=transform.position; siteYaw=yaw; sitePitch=pitch;
                    foreach(var target in targets)target.ResetMark();
                    Warp(ValleyManifest.Point(world.Map.rangeSpawn),0,2.4f);
                    rangeStart=life;
                    rangeEnd=0;
                }
            }
            if(InRange && rangeEnd==0 && MarkedCount==targets.Length) rangeEnd=life-rangeStart;
            nearSupply=body.enabled && body.isGrounded && !Swimming && footHeight>=-.065f &&
                !seated && gesture==Gesture.Idle && Resupply.Near(transform.position,InRange);
            Resupply.Advance(dt,nearSupply,input.reload,input.reloadHeld,InRange);
            FindTarget();
            if(input.slot>0 && Equipment.Action!="inspect")
            {
                if(held && BeginPlacement()) {pendingSlot=input.slot; drawAfterPlacement=true;}
                else if(gesture==Gesture.Idle)
                {
                    Resupply.Cancel();
                    SetDrawn(true,false);
                    Equipment.Select(input.slot);
                }
            }
            if(!Resupply.Busy && Equipment.Action!="inspect") Interact(input);
            if(gesture==Gesture.Idle && !seated && !Resupply.Active)
            {
                if(input.reload && !nearSupply && toyDrawn) Equipment.Reload();
                if(input.inspect && toyDrawn) Equipment.Inspect();
                if(input.motor && toyDrawn) Equipment.ToggleMotor();
            }
            var ready=toyDrawn && gesture==Gesture.Idle && !Resupply.Busy;
            Equipment.Advance(dt,ready,input.trigger,input.triggerHeld,input.aim,input.look.x*.014f,-input.look.y*.012f,gait);
            Animate(dt,input);
        }

        void Interact(Controls input)
        {
            if(input.hand || input.trigger && !toyDrawn && !held)
            {
                if(held != null) BeginPlacement();
                else if(gesture==Gesture.Idle && focus && Equipment.Take(focus)) SetDrawn(true,true);
                else if(gesture==Gesture.Idle && !seated && !Prone && focus && focus.portable) BeginPickup(focus);
                else if(gesture==Gesture.Idle && input.hand && Equipment.OwnsSelection)
                {
                    if(toyDrawn && !Swimming && !seated && pitch>42 && Physics.Raycast(view.transform.position,
                        view.transform.forward,out var floor,2.25f,interactionMask,QueryTriggerInteraction.Ignore) &&
                        floor.normal.y>.62f && Equipment.SetOnGround(floor.point,Quaternion.Euler(0,yaw,92)))
                        SetDrawn(false,false);
                    else SetDrawn(!toyDrawn,true);
                }
            }
            if(input.interact && gesture==Gesture.Idle && !Swimming)
            {
                if(seated) Stand();
                else if(focus && focus.CanUse)
                {
                    task=focus; moment=0; used=releaseUse=false; gesture=Gesture.Use;
                    Equipment.Cancel();
                }
                else if(focus && focus.IsSeat && body.isGrounded) Sit(focus);
            }
            if(input.toss && held && gesture==Gesture.Carry)
            {
                moment=0;
                sound.Cue("cast");
                gesture=Gesture.Throw;
            }
            else if(input.toss && gesture==Gesture.Idle && toyDrawn &&
                Equipment.Toss(view.transform.forward*6.6f+Vector3.up*.96f+moveVelocity*.44f))
            {
                sound.Cue("cast");
                SetDrawn(false,false);
            }
        }

        void SetDrawn(bool value,bool cue)
        {
            if(toyDrawn==value) return;
            toyDrawn=value;
            if(cue) sound.Cue((Equipment.Selected==1 ? "rifle-" : "")+(value ? "draw" : "stow"));
            if(!value) Equipment.Cancel();
        }

        void Sit(ValleyFixture seat)
        {
            seated=seat;
            standAt=transform.position;
            Prone=false;
            body.enabled=false;
            moveVelocity=Vector3.zero;
            Equipment.Cancel();
        }

        void Stand()
        {
            var seat=seated;
            for(int i=0;i<9;i++)
            {
                var angle=(i-1)*Mathf.PI*.25f;
                var at=i==0 ? standAt : seat.transform.position+new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle))*.96f;
                if(!world.Map.Walkable(at) || !Physics.Raycast(at+Vector3.up*.48f,Vector3.down,out var floor,1.12f,
                    interactionMask,QueryTriggerInteraction.Ignore)) continue;
                at=floor.point;
                if(Physics.CheckCapsule(at+Vector3.up*.29f,at+Vector3.up*1.50f,.225f,
                    interactionMask,QueryTriggerInteraction.Ignore)) continue;
                Warp(at,yaw,pitch);
                return;
            }
        }

        void Move(float dt,Controls controls)
        {
            if(seated)
            {
                transform.position=Vector3.Lerp(transform.position,seated.transform.position,1-Mathf.Exp(-dt*11));
                stance=Mathf.Lerp(stance,seated.kind=="cushion" ? .70f : 1.13f,1-Mathf.Exp(-dt*11));
                view.transform.localPosition=Vector3.up*stance;
                return;
            }
            var input=Vector2.ClampMagnitude(controls.move,1);
            var at=transform.position;
            var level=world.Map.WaterLevel(at);
            var wet=world.Map.RiverAbove(at+Vector3.up*.065f);
            RaycastHit riverbed=default;
            var deep=wet && (Swimming || at.y<level-.58f) && Physics.Raycast(at+Vector3.up*.27f,Vector3.down,
                out riverbed,15,interactionMask,QueryTriggerInteraction.Ignore) &&
                riverbed.point.y<level-(Swimming ? .73f : .94f);
            if(!deep)
            {
                Swimming=Diving=false;
                swimDepth=targetDepth=swimVelocity=0;
                if(controls.z && !held) Prone=!Prone;
            }
            else
            {
                Swimming=true;
                Prone=false;
                if(controls.z) {Diving=!Diving; targetDepth=Diving ? Mathf.Max(.77f,swimDepth) : 0; swimVelocity=0;}
                if(controls.jumpHeld) {Diving=false; targetDepth=0;}
            }
            var crouch=controls.crouch || Prone || Facilities.InsideTent(at);
            var height=Swimming ? .89f : Prone ? .49f : crouch ? .85f : 1.73f;
            if(height>body.height &&
                Physics.CheckCapsule(at+Vector3.up*(body.height-body.radius),
                    at+Vector3.up*(height-body.radius),body.radius*.94f,interactionMask,QueryTriggerInteraction.Ignore))
                height=body.height;
            body.radius=Mathf.MoveTowards(body.radius,Prone ? .17f : .24f,dt*2);
            body.height=Mathf.MoveTowards(body.height,height,dt*5.3f);
            body.center=Vector3.up*(body.height*.5f+.02f);
            body.stepOffset=Swimming ? .30f : Prone ? .14f : .32f;
            var run=!Swimming && !crouch && !held && controls.run;
            var speed=Swimming ? Diving ? 2.13f : 2.47f : (run ? 5.05f : Prone ? .82f : crouch ? 1.44f : 2.75f)*(wet ? .64f : 1);
            speed*=held ? held.kind=="table" ? .66f : .79f : Equipment.Aiming ? .79f : 1;
            var forward=input.y*(Diving ? Mathf.Cos(pitch*Mathf.Deg2Rad) : 1);
            var wanted=(transform.right*input.x+transform.forward*forward)*speed;
            moveVelocity=Vector3.Lerp(moveVelocity,wanted,1-Mathf.Exp(-dt*(Swimming ? 8.1f : body.isGrounded ? 13.5f : 4.7f)));
            var motion=moveVelocity*dt;
            if(!world.Map.Walkable(at+motion))
            {
                if(!world.Map.Walkable(at+Vector3.right*motion.x)) motion.x=0;
                if(!world.Map.Walkable(at+Vector3.forward*motion.z)) motion.z=0;
                if(!world.Map.Walkable(at+motion)) motion=Vector3.zero;
            }
            if(!Facilities.CanEnterTent(at,at+motion,height-.10f,crouch))
            {
                if(!Facilities.CanEnterTent(at,at+Vector3.right*motion.x,height-.10f,crouch)) motion.x=0;
                if(!Facilities.CanEnterTent(at,at+Vector3.forward*motion.z,height-.10f,crouch)) motion.z=0;
                if(!Facilities.CanEnterTent(at,at+motion,height-.10f,crouch)) motion=Vector3.zero;
            }
            if(Swimming)
            {
                swimVelocity=Mathf.Lerp(swimVelocity,Diving ? Mathf.Sin(pitch*Mathf.Deg2Rad)*input.y*speed : 0,1-Mathf.Exp(-dt*7.6f));
                var maxDepth=Mathf.Max(.44f,level-riverbed.point.y);
                targetDepth=Diving ? Mathf.Clamp(targetDepth+swimVelocity*dt,0,maxDepth) : 0;
                if(Diving && targetDepth<=.035f && swimVelocity<0) Diving=false;
                swimDepth=Mathf.Lerp(swimDepth,targetDepth,1-Mathf.Exp(-dt*7.9f));
                vertical=Mathf.Clamp((level-.64f-swimDepth-at.y)*8,-2.8f,2.8f);
            }
            else
            {
                if(body.isGrounded && vertical<0) vertical=-2.1f;
                if(body.isGrounded && controls.jump && !held && !crouch) vertical=wet ? 4.15f : 4.93f;
                vertical=Mathf.Max(-34,vertical-11.45f*dt);
            }
            var wasGrounded=body.isGrounded;
            body.Move(motion+Vector3.up*(vertical*dt));
            var now=transform.position;
            var travel=Vector2.Distance(new Vector2(now.x,now.z),new Vector2(last.x,last.z));
            Physics.Raycast(now+Vector3.up*.5f,Vector3.down,out var floor,1.3f,interactionMask,QueryTriggerInteraction.Ignore);
            var raise=now.y-last.y;
            if(floor.collider) footHeight=floor.point.y;
            sound.Move(travel,raise,run,body.isGrounded,Swimming,floor,Facilities.GroundBank(now));
            if(!wasGrounded && body.isGrounded && !Swimming && vertical<-4.1f)
            {
                sound.Land(floor,-vertical);
                if(vertical<-8.5f) Damage(Mathf.RoundToInt((-vertical-8.5f)*5));
            }
            last=now;
            gait+=travel*(run ? 7 : 5.5f);
            stance=Mathf.Lerp(stance,Swimming ? .98f : body.height-.10f,1-Mathf.Exp(-dt*11));
            var bob=body.isGrounded && travel>.004f ? Mathf.Sin(gait)*Mathf.Min(.024f,travel*.22f) : 0;
            view.transform.localPosition=Vector3.up*(stance+bob);
            UpdateBreath(dt);
            if(now.y < -27) Damage(100);
        }

        void UpdateBreath(float dt)
        {
            var depth=Swimming ? world.Map.WaterLevel(view.transform.position)-view.transform.position.y : 0;
            var below=depth>.036f && world.Map.RiverAbove(view.transform.position);
            sound.WaterDepth(below ? depth : 0);
            if(below)
            {
                Air=Mathf.Max(0,Air-dt);
                bubbleAt-=dt;
                if(bubbleAt<=0)
                {
                    sound.Cue("bubbles",Air<4 ? .9f : .53f);
                    bubbleAt=Air<4 ? .82f : 2.4f;
                }
                if(Air<=0 && (breathTick+=dt)>=.93f)
                {
                    breathTick-=.93f;
                    Damage(12);
                    sound.Cue("drown");
                }
            }
            else
            {
                if(Underwater && Air<17) sound.Cue("gasp");
                Air=Mathf.Min(20,Air+6.5f*dt);
                bubbleAt=.15f;
                breathTick=0;
            }
            Underwater=below;
            if(Health>0 && Health<100 && life>=recoverAt && Air>0)
            {
                Health++;
                recoverAt=life+.48f;
            }
        }

        void Damage(int points)
        {
            Health=Mathf.Max(0,Health-points);
            recoverAt=life+4;
        }

        internal void FireDamage(int points) => Damage(points);

        internal void HitByBlast(Vector3 at,float exposure)
        {
            Damage(Mathf.RoundToInt(exposure*100));
            if(seated) Stand();
            moveVelocity+=Vector3.ProjectOnPlane(transform.position-at,Vector3.up).normalized*exposure*6.5f;
            vertical=Mathf.Max(vertical,exposure*3.1f);
            Equipment.Cancel();
        }

        void OnControllerColliderHit(ControllerColliderHit contact)
        {
            if(held || moveVelocity.sqrMagnitude<.9f) return;
            var item=contact.collider.GetComponentInParent<ValleyFixture>();
            if(!item || item.kind is not ("table" or "chair")) return;
            var push=Vector3.ProjectOnPlane(moveVelocity,Vector3.up)*.085f;
            item.Nudge(push,contact.point+Vector3.up*.2f,.05f);
        }

        void Respawn()
        {
            if(held) held.Toss(Vector3.zero);
            held=task=null;
            gesture=Gesture.Idle;
            Equipment.Cancel();
            Resupply.Cancel();
            Equipment.RecoverLaunchers();
            toyDrawn=true;
            Air=20;
            Health=100;
            rewindTime=0;
            var spawn=world.Map.spawn;
            Warp(ValleyManifest.Point(spawn),spawn[3]*Mathf.Rad2Deg,-spawn[4]*Mathf.Rad2Deg);
        }

        void FindTarget()
        {
            focus=null;
            Prompt=Equipment.Notice;
            if(Paused) return;
            if(seated) {Prompt="E  STAND"; return;}
            if(held != null) { Prompt="H  SET DOWN     T  TOSS"; return; }
            if(Resupply.Active || Swimming || Equipment.Busy) return;
            if(nearSupply) {Prompt="HOLD R  RESUPPLY"; return;}
            if(!Physics.Raycast(view.transform.position,view.transform.forward,out var hit,2.26f,interactionMask,QueryTriggerInteraction.Collide))
            {
                if(!toyDrawn) Prompt="H  DRAW";
                return;
            }
            focus=hit.collider.GetComponentInParent<ValleyFixture>();
            if(!focus) return;
            if(focus.CanUse) Prompt=focus.UsePrompt;
            else if(focus.IsSeat) Prompt="H  PICK UP     E  SIT";
            else if(focus.equipmentSlot>0) Prompt="H  PICK UP MINICAR LAUNCHER";
            else if(focus.portable) Prompt="H  PICK UP";
        }

        public void BeginPickup(ValleyFixture target)
        {
            if (!target || !target.portable || gesture!=Gesture.Idle) return;
            SetDrawn(false,true);
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

        void Animate(float dt,Controls controls)
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
                    var hold=task.kind is "door" or "burner";
                    var activation=task.kind=="door" ? .48f : .26f;
                    if(hold && (!controls.interactHeld || task.kind=="burner" &&
                        Vector3.Distance(view.transform.position,task.Contact)>2.48f) && !releaseUse)
                    {
                        task.Release();
                        releaseUse=true;
                        moment=Mathf.Max(moment,.51f);
                    }
                    if(task.kind=="door" && !used && focus!=task)
                    {
                        releaseUse=true;
                        moment=Mathf.Max(moment,.51f);
                    }
                    var finishing=task.kind!="burner" || releaseUse || !task.Igniting;
                    blend=Ease(moment/.26f)*(finishing ? 1-Ease((moment-.57f)/.27f) : 1);
                    grasp=Ease((moment-.13f)/.18f)*.64f;
                    if(moment>=activation && !used && !releaseUse)
                    {
                        used=true;
                        if(task.Use()) sound.Cue("use-"+task.kind);
                        else sound.Cue("power",.72f);
                    }
                    if(moment>=.85f && finishing) { gesture=Gesture.Idle; task=null; }
                    break;
                case Gesture.Lower:
                    var lowering=Ease(moment/.38f);
                    held.transform.position=Vector3.Lerp(setDownFrom,setDown,lowering);
                    held.transform.rotation=Quaternion.Slerp(setDownTurn,transform.rotation,lowering);
                    blend=1-Ease((moment-.33f)/.29f); grasp=.86f*(1-Ease((moment-.32f)/.19f));
                    if(moment>=.40f && held.IsCarried) held.SetDown(setDown);
                    if(moment>=.63f)
                    {
                        held=task=null; gesture=Gesture.Idle;
                        if(drawAfterPlacement)
                        {
                            SetDrawn(true,false);
                            Equipment.Select(pendingSlot);
                            drawAfterPlacement=false;
                        }
                    }
                    break;
                case Gesture.Throw:
                    blend=1-Ease((moment-.18f)/.29f);
                    grasp=.88f*(1-Ease((moment-.13f)/.09f));
                    if(held)
                    {
                        var local=new Vector3(.23f,-.23f+.18f*Ease(moment/.18f),.39f+.29f*Ease(moment/.18f));
                        held.transform.position=Vector3.Lerp(held.transform.position,
                            view.transform.TransformPoint(local)-held.transform.TransformVector(held.LocalContact),Ease(dt*26));
                        if(moment>=.19f)
                        {
                            held.Toss(view.transform.forward*(7.9f/(1+held.mass*.1f))+Vector3.up+moveVelocity*.44f);
                            held=null;
                        }
                    }
                    if(moment>=.49f) {task=null;gesture=Gesture.Idle;}
                    break;
            }
            hands.Drive(task,blend,grasp,Equipment,Swimming,gait,dt);
        }

        static float Ease(float t) { t=Mathf.Clamp01(t); return t*t*(3-2*t); }

    }
}
