using UnityEngine;

namespace ValleyCamcorder
{
    [RequireComponent(typeof(CharacterController))]
    public sealed partial class ValleyPlayer : MonoBehaviour
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
        [Tooltip("Show the legacy full-body animation demonstration in the target range.")]
        public bool animationTest;
        public LayerMask interactionMask = Physics.DefaultRaycastLayers;
        public string Prompt { get; private set; } = "";
        public bool InRange => world.Map != null && world.Map.InRange(transform.position);
        public ValleyEquipment Equipment { get; private set; }
        public ValleyResupply Resupply { get; private set; }
        internal ValleyMapInteractions Facilities { get; private set; }
        internal ValleyWater Water { get; private set; }
        public bool Underwater { get; private set; }
        public bool Swimming { get; private set; }
        public bool Diving { get; private set; }
        public bool Prone { get; private set; }
        public bool Paused { get; private set; }
        public bool PlaybackStarted { get; private set; }
        public float TapeTime => life;
        public string Location { get; private set; }="SANDBAR";
        public float DoorProgress => gesture==Gesture.Use && task && task.kind=="door" && !releaseUse
            ? Mathf.Clamp01(moment/.48f) : 0;
        public float DamageTint => Mathf.SmoothStep(0,1,Mathf.Clamp01((flashUntil-life)/.47f));
        public bool Rewinding => rewindTime>0;
        public float Air { get; private set; }=20;
        public int Health { get; private set; }=100;
        public float RangeTime => rangeEnd>0 ? rangeEnd : Mathf.Max(0,life-rangeStart);
        public ValleyFixture Held => held;
        public int MarkedCount { get { int count=0; foreach(var target in targets) if(target.Marked) count++; return count; } }

        CharacterController body;
        Gesture gesture;
        ValleyFixture focus, held, task, seated, placementSupport;
        Vector3 setDown, setDownFrom, siteReturn, carryVelocity, standAt, moveVelocity, placementLocal;
        Quaternion carryRotation, setDownTurn;
        Vector3 last;
        float pitch, yaw, vertical, stance=1.62f, moment, life, gait, siteYaw, sitePitch, swimDepth,
            targetDepth, swimVelocity, bubbleAt, breathTick, recoverAt, rangeStart, rangeEnd, footHeight, rewindTime,
            wakeDistance,wadeSteps,swimPhase;
        bool used, toyDrawn=true, nearSupply, drawAfterPlacement, releaseUse,wasWet,throwLauncher;
        bool fullscreenPlayback, hadCursor;
        float placeCheck, flashUntil;
        string interactionNotice="";
        float noticeUntil;
        static readonly float[] StandRadii={.81f,1.14f,1.49f,1.91f};
        static readonly Vector2[] PlacementOffsets={new(0,0),new(0,.38f),new(.65f,0),new(-.65f,0),
            new(.94f,.30f),new(-.94f,.30f)};
        FullScreenMode previousWindowMode;
        int pendingSlot;
        ValleyCharacterDemo characterDemo;

        void Start()
        {
            body=GetComponent<CharacterController>();
            Equipment=new ValleyEquipment(view,toy,body,sound,this);
            Resupply=new ValleyResupply(sound,Equipment,world.Map,world.transform);
            Facilities=world.gameObject.AddComponent<ValleyMapInteractions>();
            Facilities.Bind(world.Map,this,sound);
            Water=world.gameObject.AddComponent<ValleyWater>();
            Water.Bind(world.Map,Facilities,sound);
            var spawn=world.Map.spawn;
            Warp(ValleyManifest.Point(spawn),spawn[3]*Mathf.Rad2Deg,-spawn[4]*Mathf.Rad2Deg);
            var launchArguments=System.Environment.GetCommandLineArgs();
            animationTest|=System.Array.IndexOf(launchArguments,"--valley-animation-test")>=0;
            if(System.Array.IndexOf(launchArguments,"--valley-smoke")>=0) PlaybackStarted=true;
            else Pause(true);
        }

        public void Warp(Vector3 at,float heading,float elevation=0)
        {
            body??=GetComponent<CharacterController>();
            body.enabled=false;
            transform.position=at+Vector3.up*.025f;
            body.enabled=true;
            if(seated) seated.Occupy(false);
            seated=null;
            yaw=heading; pitch=elevation;
            transform.rotation=Quaternion.Euler(0,yaw,0);
            view.transform.localRotation=Quaternion.Euler(pitch,0,0);
            last=transform.position;
            vertical=swimDepth=targetDepth=swimVelocity=0;
            moveVelocity=Vector3.zero;
            Swimming=Diving=Prone=Underwater=false;
            wakeDistance=wadeSteps=swimPhase=0;
            wasWet=false;
            sound.WaterDepth(0);
        }

        void Update()
        {
            var click=Input.GetMouseButtonDown(0);
            if(!Paused && (Input.GetKeyDown(KeyCode.Escape) || hadCursor && Cursor.lockState!=CursorLockMode.Locked))
            {
                Pause(true);
                return;
            }
            if(Paused || Time.deltaTime<=0) return;
            var locked=Cursor.lockState==CursorLockMode.Locked;
            hadCursor|=locked;
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

        internal void PlayTape(bool fullscreen)
        {
            if(!Paused || Equipment==null) return;
            PlaybackStarted=true;
            previousWindowMode=Screen.fullScreenMode;
            fullscreenPlayback=fullscreen && !Application.isEditor;
            if(fullscreenPlayback) Screen.fullScreenMode=FullScreenMode.FullScreenWindow;
            Pause(false);
            Cursor.lockState=CursorLockMode.Locked;
            Cursor.visible=false;
        }

        internal void Pause(bool pause)
        {
            if(Paused==pause) return;
            Paused=pause;
            Time.timeScale=pause ? 0 : 1;
            AudioListener.pause=pause;
            if(!pause) return;
            hadCursor=false;
            Cursor.lockState=CursorLockMode.None;
            Cursor.visible=true;
            if(fullscreenPlayback) Screen.fullScreenMode=previousWindowMode;
            fullscreenPlayback=false;
            moveVelocity=Vector3.zero;
            Resupply?.Cancel();
            if(gesture==Gesture.Use && task)
            {
                task.Release();
                releaseUse=true;
                moment=Mathf.Max(moment,.51f);
            }
        }

        void OnApplicationFocus(bool focused)
        {
            if(!focused && PlaybackStarted && !Application.isBatchMode) Pause(true);
        }

        void OnDisable() {if(Paused) Pause(false);}

        internal void Step(float dt,Controls input)
        {
            life+=dt;
            if(AdvanceRecovery(dt)) return;
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
                if(InRange)
                {
                    Warp(siteReturn,siteYaw,sitePitch);
                    SetAnimationDemo(false);
                }
                else
                {
                    siteReturn=transform.position; siteYaw=yaw; sitePitch=pitch;
                    foreach(var target in targets)target.ResetMark();
                    Warp(ValleyManifest.Point(world.Map.rangeSpawn),0,2.4f);
                    if(animationTest) SetAnimationDemo(true);
                    rangeStart=life;
                    rangeEnd=0;
                }
            }
            if(InRange && rangeEnd==0 && MarkedCount==targets.Length) rangeEnd=life-rangeStart;
            if(life>=placeCheck)
            {
                Location=Facilities.PlaceName(transform.position,Underwater,Swimming,wasWet);
                placeCheck=life+.18f;
            }
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
            var casting=gesture==Gesture.Throw && throwLauncher && toyDrawn;
            Equipment.CastSwing=casting ? Ease(Mathf.InverseLerp(.081f,.198f,moment+dt))-
                .45f*Mathf.Sin(Mathf.PI*Ease((moment+dt)/.102f))*(moment+dt<.102f ? 1 : 0) : 0;
            Equipment.Advance(dt,ready || casting,ready && input.trigger,ready && input.triggerHeld,
                ready && input.aim,input.look.x*.014f,-input.look.y*.012f,gait);
            Animate(dt,input);
        }

        void Interact(Controls input)
        {
            if(input.hand || input.trigger && !toyDrawn && !held)
            {
                if(held != null) BeginPlacement();
                else if(gesture==Gesture.Idle && focus && Equipment.Take(focus)) SetDrawn(true,true);
                else if(gesture==Gesture.Idle && !seated && !Prone && (body.isGrounded || Swimming) && focus && focus.CanPickup)
                    BeginPickup(focus);
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
                throwLauncher=false;
                sound.Cue("cast");
                gesture=Gesture.Throw;
            }
            else if(input.toss && gesture==Gesture.Idle && toyDrawn && Equipment.Visible && Equipment.CanAct && !Equipment.Busy)
            {
                Equipment.Cancel();
                throwLauncher=true;
                moment=0;
                sound.Cue("cast");
                gesture=Gesture.Throw;
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
            seat.Occupy(true);
            standAt=transform.position;
            Prone=false;
            body.enabled=false;
            moveVelocity=Vector3.zero;
            Equipment.Cancel();
        }

        void Stand()
        {
            if(TryStand(standAt)) return;
            foreach(var reach in StandRadii)
                for(int i=0;i<8;i++)
                {
                    var angle=i*Mathf.PI*.25f;
                    var at=seated.transform.position+new Vector3(Mathf.Cos(angle),0,Mathf.Sin(angle))*reach;
                    if(TryStand(at)) return;
                }
            ShowInteractionNotice("NEED ROOM TO STAND");
        }

        bool TryStand(Vector3 at)
        {
            if(!world.Map.Walkable(at) || !Physics.Raycast(at+Vector3.up*.48f,Vector3.down,out var floor,1.12f,
                interactionMask,QueryTriggerInteraction.Ignore)) return false;
            at=floor.point;
            if(world.Map.RiverAbove(at+Vector3.up*.30f) ||
                !Facilities.CanEnterTent(transform.position,at,1.62f,false) ||
                Physics.CheckCapsule(at+Vector3.up*.29f,at+Vector3.up*1.50f,.225f,
                    interactionMask,QueryTriggerInteraction.Ignore)) return false;
            Warp(at,yaw,pitch);
            return true;
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
            var wasSwimming=Swimming;
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
            var crouch=controls.crouch || Prone || Facilities.InsideTent(at) || Facilities.UnderCarRoof(at);
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
            wet=Swimming || world.Map.RiverAbove(now+Vector3.up*.065f);
            sound.Move(travel,raise,run,body.isGrounded,wet,floor,Facilities.GroundBank(now));
            if(!wasGrounded && body.isGrounded && !Swimming && vertical<-4.1f)
            {
                if(!wet) sound.Land(floor,-vertical);
                if(vertical<-8.5f) Damage(Mathf.RoundToInt((-vertical-8.5f)*5));
            }
            RiverMovement(dt,now,now-last,travel,wet,wasSwimming,run,!wasGrounded && body.isGrounded);
            last=now;
            gait+=travel*(run ? 7 : 5.5f);
            stance=Mathf.Lerp(stance,Swimming ? .98f : body.height-.10f,1-Mathf.Exp(-dt*11));
            var bob=Swimming ? Mathf.Sin(swimPhase+.42f)*(.016f+Mathf.Clamp01(travel/dt/2.4f)*.028f) :
                body.isGrounded && travel>.004f ? Mathf.Sin(gait)*Mathf.Min(.024f,travel*.22f)*(wet ? .49f : 1) : 0;
            view.transform.localPosition=Vector3.up*(stance+bob);
            UpdateBreath(dt);
            if(now.y < -27) Damage(100);
        }

        void RiverMovement(float dt,Vector3 at,Vector3 movement,float distance,bool wet,bool oldSwimming,bool running,bool landed)
        {
            if(!wet)
            {
                wasWet=false;
                wakeDistance=wadeSteps=0;
                return;
            }
            var direction=distance>.003f ? Vector3.ProjectOnPlane(movement,Vector3.up).normalized : transform.forward;
            var below=Swimming && swimDepth>.38f;
            if(!below)
            {
                wakeDistance+=distance;
                if(wakeDistance>=.38f)
                {
                    wakeDistance%=.38f;
                    Water.Ripple(at-direction*.28f,Swimming ? .47f : .36f);
                }
            }
            if(Swimming)
            {
                if(!oldSwimming) Water.Splash(at+direction*.38f,direction,1.07f,"stroke");
                var next=swimPhase+dt*Mathf.Lerp(2.15f,10.1f,Mathf.Clamp01(distance/dt/2.4f));
                if(!below && distance>.005f && swimPhase<Mathf.PI && next>=Mathf.PI)
                    Water.Splash(at+direction*.57f,direction,.82f,"stroke");
                swimPhase=next%(2*Mathf.PI);
                wadeSteps=0;
            }
            else if(body.isGrounded)
            {
                wadeSteps+=distance;
                if(!wasWet || landed || wadeSteps>=(running ? .92f : .72f))
                {
                    Water.Splash(at+direction*.28f,direction,landed ? 1.04f : running ? .81f : .63f,"wade");
                    wadeSteps=0;
                }
            }
            wasWet=true;
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
                    Water.Bubbles(view.transform.position+view.transform.forward*.42f-Vector3.up*.15f,Air<4 ? 11 : 5);
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
                recoverAt=life+Mathf.Lerp(.9f,.2f,Mathf.SmoothStep(0,1,Mathf.InverseLerp(5,10,life-recoverStart)));
            }
        }

        void Damage(int points)
        {
            Health=Mathf.Max(0,Health-points);
            flashUntil=life+.47f;
            recoverAt=recoverStart=life+4;
        }

        internal void FireDamage(int points) => Damage(points);
        internal ValleyCharacterDemo SetAnimationDemo(bool present)
        {
            if(present && !characterDemo) characterDemo=Facilities.CreateAnimationDemo();
            if(characterDemo) characterDemo.gameObject.SetActive(present);
            return characterDemo;
        }

        internal void ScoreTarget()
        {
            if(!InRange) return;
            if(MarkedCount>=targets.Length)
            {
                rangeEnd=life-rangeStart;
                sound.Cue("target-finish");
            }
            else sound.Cue("target-mark");
        }

        void OnControllerColliderHit(ControllerColliderHit contact)
        {
            if(held || moveVelocity.sqrMagnitude<.9f) return;
            var item=contact.collider.GetComponentInParent<ValleyFixture>();
            if(!item || item.kind is not ("table" or "chair" or "tube")) return;
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
            rewindTime=stumbleTime=drowningTime=0;
            fallenTime=-1;
            recoveryReleased=false;
            var spawn=world.Map.spawn;
            Warp(ValleyManifest.Point(spawn),spawn[3]*Mathf.Rad2Deg,-spawn[4]*Mathf.Rad2Deg);
        }

        void FindTarget()
        {
            focus=null;
            Prompt=life<noticeUntil ? interactionNotice : Equipment.Notice;
            if(Paused) return;
            if(seated) {if(Prompt.Length==0) Prompt="E  STAND"; return;}
            if(held != null) {if(Prompt.Length==0) Prompt="H  SET DOWN     T  TOSS"; return;}
            if(Resupply.Active || Equipment.Busy || gesture==Gesture.Throw) return;
            if(nearSupply) {Prompt="HOLD R  RESUPPLY"; return;}
            if(!Physics.Raycast(view.transform.position,view.transform.forward,out var hit,2.26f,interactionMask,QueryTriggerInteraction.Collide))
            {
                if(Facilities.NearTentDoor(transform.position)) Prompt="CTRL  CROUCH TO ENTER";
                else if(!toyDrawn && Equipment.OwnsSelection) Prompt="H  DRAW";
                return;
            }
            focus=hit.collider.GetComponentInParent<ValleyFixture>();
            if(!focus) return;
            if(!Swimming && focus.CanUse) Prompt=focus.UsePrompt;
            else if(!Swimming && focus.IsSeat) Prompt="H  PICK UP     E  SIT";
            else if(focus.equipmentSlot>0) Prompt="H  PICK UP MINICAR LAUNCHER";
            else if(focus.CanPickup) Prompt="H  PICK UP";
        }

        public void BeginPickup(ValleyFixture target)
        {
            if (!target || !target.CanPickup || gesture!=Gesture.Idle) return;
            SetDrawn(false,true);
            gesture=Gesture.Reach;
            task=target;
            moment=0;
        }

        public bool BeginPlacement()
        {
            if(!held || gesture!=Gesture.Carry)return false;
            var head=view.transform;
            placementSupport=null;
            if(held.small && Physics.Raycast(head.position,head.forward,out var aimed,2.15f,interactionMask,QueryTriggerInteraction.Ignore) &&
                aimed.normal.y>.60f)
            {
                var furniture=aimed.collider.GetComponentInParent<ValleyFixture>();
                if(furniture && furniture.TrySurface(held,aimed.point,out var resting))
                {
                    placementSupport=furniture;
                    placementLocal=furniture.transform.InverseTransformPoint(resting);
                    BeginLowering(resting);
                    return true;
                }
            }
            var front=Mathf.Max(.20f,Mathf.Max(held.size.x,held.size.z)*.5f)+(held.small ? .49f : .69f);
            foreach(var offset in PlacementOffsets)
            {
                var point=transform.position+transform.forward*(front+offset.y)+transform.right*offset.x;
                if(TryFloorPlacement(point)) return true;
            }
            ShowInteractionNotice("NEED ROOM TO SET DOWN");
            return false;
        }

        bool TryFloorPlacement(Vector3 point)
        {
            var from=point+Vector3.up*1.66f;
            if(!Physics.Raycast(from,Vector3.down,out var surface,2.4f,interactionMask,QueryTriggerInteraction.Ignore) ||
                Vector3.Dot(surface.normal,Vector3.up)<.55f || !world.Map.Walkable(surface.point) ||
                surface.point.y-transform.position.y>.94f) return false;
            var approach=surface.point+Vector3.up*.13f-view.transform.position;
            if(Physics.SphereCast(view.transform.position,.035f,approach.normalized,out _,
                Mathf.Max(0,approach.magnitude-.095f),interactionMask,QueryTriggerInteraction.Ignore)) return false;
            var itemRadius=Mathf.Max(.04f,Mathf.Min(held.size.x,held.size.z)*.43f);
            if(Physics.CheckSphere(surface.point+Vector3.up*(itemRadius+.045f),itemRadius,interactionMask,QueryTriggerInteraction.Ignore))
                return false;
            var supportItem=surface.collider.GetComponentInParent<ValleyFixture>();
            if(supportItem && supportItem.TrySurface(held,surface.point,out var top))
            {
                placementSupport=supportItem;
                placementLocal=supportItem.transform.InverseTransformPoint(top);
                BeginLowering(top);
            }
            else BeginLowering(surface.point+Vector3.up*.012f);
            return true;
        }

        void ShowInteractionNotice(string message)
        {
            interactionNotice=Prompt=message;
            noticeUntil=life+1.18f;
        }

        void BeginLowering(Vector3 destination)
        {
            setDown=destination;
            setDownFrom=held.transform.position;
            setDownTurn=held.transform.rotation;
            gesture=Gesture.Lower; moment=0;
        }

        void Animate(float dt,Controls controls)
        {
            moment+=dt;
            float blend=0, grasp=0;
            switch(gesture)
            {
                case Gesture.Reach:
                    if(!task || !task.CanPickup) {task=null;gesture=Gesture.Idle;break;}
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
                    if(!task || task.Broken || !task.gameObject.activeInHierarchy) {task=null;gesture=Gesture.Idle;break;}
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
                    if(placementSupport && held.IsCarried)
                    {
                        var hint=placementSupport.transform.TransformPoint(placementLocal);
                        if(!placementSupport.TrySurface(held,hint,out setDown))
                        {
                            placementSupport=null;
                            gesture=Gesture.Carry;
                            drawAfterPlacement=false;
                            blend=1;grasp=.84f;
                            break;
                        }
                    }
                    var lowering=Ease(moment/.38f);
                    if(held.IsCarried)
                    {
                        held.transform.position=Vector3.Lerp(setDownFrom,setDown,lowering);
                        held.transform.rotation=Quaternion.Slerp(setDownTurn,transform.rotation,lowering);
                    }
                    blend=1-Ease((moment-.33f)/.29f); grasp=.86f*(1-Ease((moment-.32f)/.19f));
                    if(moment>=.40f && held.IsCarried) held.SetDown(setDown,placementSupport);
                    if(moment>=.63f)
                    {
                        held=task=placementSupport=null; gesture=Gesture.Idle;
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
                            held.transform.position=Equipment.ClearCastPoint(held.transform.position);
                            held.Toss(view.transform.forward*(7.9f/(1+held.mass*.1f))+Vector3.up+moveVelocity*.44f);
                            held=null;
                        }
                    }
                    else if(throwLauncher && toyDrawn && moment>=.19f)
                    {
                        if(Equipment.Toss(view.transform.forward*6.6f+Vector3.up*.96f+moveVelocity*.44f))
                            SetDrawn(false,false);
                    }
                    if(moment>=.49f) {task=null;gesture=Gesture.Idle;throwLauncher=false;}
                    break;
            }
            hands.Drive(task,blend,grasp,Equipment,Swimming,Swimming ? swimPhase : gait,dt);
        }

        static float Ease(float t) { t=Mathf.Clamp01(t); return t*t*(3-2*t); }

    }
}
