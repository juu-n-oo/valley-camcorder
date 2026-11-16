using System;
using System.Collections.Generic;
using UnityEngine;
using Object=UnityEngine.Object;
using Pose=ValleyCamcorder.ValleyGearAssets.Pose;

namespace ValleyCamcorder
{
    public sealed class ValleyEquipment
    {
        const int RootPose=0, SupportPose=1, CartridgePose=2, CapPose=3, HandCarPose=4, ShellPose=5;
        const float ViewScale=.56f, PartLifetime=30, Slot=.086f, ElevatorStep=.051f;
        const float PistolExit=.33f, RifleExit=.62f, SmgExit=.70f;
        const int Rifle=0, Pistol=1, Smg=2;
        static readonly string[] Labels={"1 RIFLE","2 PISTOL","3 SMG"};
        static readonly int[] RifleOrder={5,0,1,2,3,4};
        static readonly float[] FeedTime={.105f,.115f,.081f}, StartTime={.132f,.147f,.119f};
        static readonly float[] BoosterPitch={.97f,1,1.08f};

        sealed class Cartridge
        {
            public readonly List<int> cars=new();
            public bool sealedCap,removed;
            public int Count
            {
                get
                {
                    int count=0;
                    foreach(var car in cars) if(car>=0) count++;
                    return count;
                }
            }
            public Cartridge(int capacity,bool sealedCap,bool skip=false)
            {
                this.sealedCap=sealedCap;
                for(int i=0;i<capacity;i++)
                    cars.Add(skip && i is (3 or 9 or 10 or 11) ? -1 : capacity==6 ? RifleOrder[i] : i%6);
            }
        }

        sealed class Launcher
        {
            public ValleyGearAssets.Model model;
            public ValleyGearAssets.Clip hip, sight;
            public Transform root, magazine, cap, handCar, railCar;
            public Transform[] shell, cart, slots;
            public readonly List<Cartridge> spares=new();
            public Cartridge loaded;
            public GameObject onGround;
            public int reserve, nextCar;
            public float belt,boosterAngle;
        }

        readonly Launcher[] launchers;
        readonly Camera camera;
        readonly ValleyAudio sound;
        readonly Collider player;
        readonly ValleyPlayer owner;
        readonly Transform rig;
        readonly float hipFov;
        readonly List<GameObject> launched=new();
        int selected=Pistol, pending=-1, shots, dropped, rifleBatch;
        float draw, aim, actionTime, cycleTime, cycleStart, leftInFrame, press, kick, swayX,swayY,clock;
        float boostCharge;
        Vector2 reticleOffset;
        Vector3 trackStart,trackExit,trackHeading;
        Ray sightRay;
        RaycastHit? nearObstruction;
        bool aiming, cycle, warm, queueReload, testing, power=true, jammed, emptyRifle, aimAfterClose, waitForRelease;
        string notice;
        float noticeUntil;
        ValleyGearAssets.Clip action;
        Cartridge incoming, outgoing;
        Pose[] closingFrom;

        public ValleyGearAssets Assets { get; }
        Launcher Current => launchers[selected];
        public int Selected => selected+1;
        public string Label => Labels[selected];
        public int Ammo => Current.loaded.Count;
        public int Capacity => Current.model.capacity;
        public int SlotColor(int slot) => slot<Current.loaded.cars.Count ? Current.loaded.cars[slot] : -1;
        public int Reserve => selected==Rifle ? Current.reserve : Current.spares.Count+(Ammo>0 ? 1 : 0);
        public int Total
        {
            get
            {
                var total=Ammo+Current.reserve;
                foreach(var cart in Current.spares) total+=cart.Count;
                return total;
            }
        }
        public bool Powered => power;
        public bool Aiming => aiming || aim>.12f;
        public float Aim => aim;
        public bool Busy => action!=null || cycle || pending>=0;
        public string Action => action?.name ?? "";
        public bool Visible => draw>.075f && Current.root.gameObject.activeInHierarchy;
        public Vector3 Grip => MainHand.Point;
        internal ValleyHandContact MainHand => MoldedGrip(Current,Current.model.grip,1,
            Current.root.TransformPoint(ValleyGearAssets.Point(Current.model.trigger)-Vector3.forward*(press*.0045f)));
        internal ValleyHandContact? SupportHand { get; private set; }
        internal Vector2 ReticleOffset => reticleOffset;
        internal bool ShowReticle => Visible && !Aiming && action==null && pending<0;
        public float Draw => draw;
        public string Notice => clock<noticeUntil ? notice : "";
        public int Shots => shots;
        public int Discarded => dropped;
        internal int VisibleLaunchers
        {
            get
            {
                int count=0;
                foreach(var gear in launchers) if(gear.root.gameObject.activeInHierarchy) count++;
                return count;
            }
        }
        public Vector3 LastLaunch { get; private set; }
        public Vector3 LastMuzzle { get; private set; }
        public Vector3 LastRailHeading { get; private set; }
        internal bool CarOnTrack => Current.railCar.gameObject.activeInHierarchy;
        public Transform Magazine => Current.magazine;
        public bool InspectionMotor => testing;
        public bool CanAct => draw>.68f && pending<0 && !Current.onGround;
        public bool OwnsSelection => !Current.onGround;
        public float Trigger => press;
        internal float CastSwing { private get; set; }

        public ValleyEquipment(Camera camera,GameObject original,Collider player,ValleyAudio sound,ValleyPlayer owner)
        {
            this.camera=camera;
            this.player=player;
            this.sound=sound;
            this.owner=owner;
            hipFov=camera.fieldOfView;
            Assets=new ValleyGearAssets(original);
            original.SetActive(false);
            rig=Child(camera.transform,"Mini-car equipment");
            rig.localScale=Vector3.one*ViewScale;
            launchers=Array.ConvertAll(Assets.Data.gears,Build);
            launchers[Rifle].reserve=18;
            for(int i=0;i<4;i++) launchers[Pistol].spares.Add(new Cartridge(5,true));
            launchers[Smg].spares.Add(new Cartridge(20,true,true));
            launchers[Smg].spares.Add(new Cartridge(20,true));
        }

        Launcher Build(ValleyGearAssets.Model model)
        {
            var gear=new Launcher {model=model,hip=model.Motion("hip"),sight=model.Motion("aim"),
                loaded=new Cartridge(model.capacity,false),root=Child(rig,model.kind)};
            gear.shell=Array.ConvertAll(model.shell,id=>Assets.NewPart(id,gear.root,"Launcher part"));
            gear.magazine=Child(gear.root,"Cartridge");
            gear.cart=Array.ConvertAll(model.magazine,part=>Assets.NewPart(part.mesh,gear.magazine,"Cartridge part"));
            if(model.cap>=0) gear.cap=Assets.NewPart(model.cap,gear.root,"Shipping cap");
            gear.slots=new Transform[model.capacity];
            for(int i=0;i<gear.slots.Length;i++)
                gear.slots[i]=Assets.NewPart(model.looseCars[0],gear.cart.Length>0 ? gear.magazine : gear.root,"Loaded mini-car");
            if(model.kind=="rifle")
            {
                gear.handCar=Assets.NewPart(Assets.Data.carIds[0],gear.root,"Mini-car being loaded");
                gear.handCar.gameObject.SetActive(false);
            }
            gear.railCar=Assets.NewPart(Assets.Data.carIds[0],gear.root,"Mini-car on orange track");
            gear.railCar.gameObject.SetActive(false);
            gear.root.gameObject.SetActive(false);
            return gear;
        }

        static Transform Child(Transform parent,string name)
        {
            var node=new GameObject(name).transform;
            node.SetParent(parent,false);
            return node;
        }

        public void Select(int slot)
        {
            if(slot<1 || slot>launchers.Length) return;
            if(launchers[slot-1].onGround) {Message("PICK UP THE "+launchers[slot-1].model.kind.ToUpperInvariant()+" FIRST"); return;}
            if(slot-1==selected && pending<0) return;
            Cancel();
            pending=slot-1;
            sound.Cue(selected==Rifle ? "rifle-stow" : "stow");
        }

        public void Cancel()
        {
            aiming=queueReload=cycle=testing=warm=false;
            action=null;
            leftInFrame=0;
            incoming=outgoing=null;
            closingFrom=null;
            CastSwing=0;
            boostCharge=0;
            sound.StopLauncherMotors();
        }

        public bool Take(ValleyFixture item)
        {
            if(item.equipmentSlot<=0 || item.equipmentSlot>launchers.Length) return false;
            var gear=launchers[item.equipmentSlot-1];
            if(gear.onGround!=item.gameObject) return false;
            Object.Destroy(gear.onGround);
            gear.onGround=null;
            Select(item.equipmentSlot);
            return true;
        }

        public bool SetOnGround(Vector3 at,Quaternion rotation)
            => DropLauncher(at,rotation,Vector3.zero,false);

        public bool Toss(Vector3 velocity)
            => DropLauncher(ClearCastPoint(HandleNearPlayer()+camera.transform.forward*CastSwing*.21f),
                Current.root.rotation,velocity,true);

        internal Vector3 ClearCastPoint(Vector3 requested)
        {
            var from=camera.transform.position;
            var path=requested-from;
            if(Physics.SphereCast(from,.046f,path.normalized,out var hit,path.magnitude,owner.interactionMask,QueryTriggerInteraction.Ignore))
                return from+path.normalized*Mathf.Max(.07f,hit.distance-.065f);
            return requested;
        }

        Vector3 HandleNearPlayer()
        {
            var head=camera.transform;
            return head.position+head.forward*.45f-head.up*.29f+head.right*.15f;
        }

        bool DropLauncher(Vector3 at,Quaternion rotation,Vector3 velocity,bool tossing)
        {
            if(!CanAct || !Visible) return false;
            var gear=Current;
            Cancel();
            var copy=Object.Instantiate(gear.root.gameObject);
            copy.name=gear.model.kind+" on the ground";
            var droppedTool=copy.transform;
            droppedTool.SetPositionAndRotation(at,rotation);
            droppedTool.localScale=Vector3.one*ViewScale;
            var bounds=LocalBounds(droppedTool);
            if(!tossing)
            {
                var lowest=float.PositiveInfinity;
                foreach(var visual in copy.GetComponentsInChildren<MeshRenderer>())
                    lowest=Mathf.Min(lowest,visual.bounds.min.y);
                droppedTool.position+=Vector3.up*(at.y-lowest+.018f);
            }
            var shell=copy.AddComponent<BoxCollider>();
            shell.center=bounds.center;
            shell.size=bounds.size;
            var fixture=copy.AddComponent<ValleyFixture>();
            fixture.kind="equipment";
            fixture.equipmentSlot=Selected;
            gear.onGround=copy;
            if(tossing)
            {
                Physics.IgnoreCollision(player,shell);
                var body=copy.AddComponent<Rigidbody>();
                body.mass=.68f;
                body.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;
                body.linearVelocity=velocity;
                body.angularVelocity=camera.transform.right*3.3f;
            }
            return true;
        }

        public void RecoverLaunchers()
        {
            foreach(var gear in launchers)
            {
                if(gear.onGround) Object.Destroy(gear.onGround);
                gear.onGround=null;
            }
        }

        public void Replenish()
        {
            if(selected==Rifle) Current.reserve+=12;
            else for(int i=0;i<2;i++) Current.spares.Add(new Cartridge(Capacity,true));
        }

        public void Reload()
        {
            if(!CanAct || action!=null) return;
            if(cycle) {queueReload=true; return;}
            if(selected==Rifle)
            {
                if(Ammo>=Capacity) return;
                if(Current.reserve==0) {Message("NO SPARE MINICARS"); return;}
                emptyRifle=Ammo==0;
                StartMotion("open");
                return;
            }
            if(Current.spares.Count==0) {Message("NO SPARE CARTRIDGES"); return;}
            incoming=Current.spares[0];
            outgoing=Current.loaded;
            StartMotion((Ammo>0 ? "stow" : "discard")+(incoming.sealedCap ? "Sealed" : "Open"));
        }

        public void Inspect()
        {
            if(CanAct && !Busy && !Current.loaded.removed) StartMotion("inspect");
        }

        public void ToggleMotor()
        {
            if(selected==Pistol && CanAct && action==null)
            {
                cycle=false;
                StartMotion(power ? "powerOff" : "powerOn");
            }
        }

        void StartMotion(string name)
        {
            aiming=false;
            actionTime=0;
            action=Current.model.Motion(name);
            if(name=="gather") rifleBatch=Mathf.Min(3,Mathf.Min(Capacity-Ammo,Current.reserve));
        }

        void CloseRifle(bool aimAfter,bool early)
        {
            aimAfterClose=aimAfter;
            if(early) waitForRelease=true;
            if(Action=="close") return;
            if(early)
            {
                closingFrom=new Pose[ShellPose+Current.shell.Length];
                for(int i=0;i<closingFrom.Length;i++) closingFrom[i]=action.At(actionTime,i);
            }
            StartMotion("close");
        }

        void AdvanceMotion(float dt)
        {
            var previous=actionTime;
            actionTime=Mathf.Min(action.duration,actionTime+dt);
            foreach(var mark in action.marks)
                if(mark.time>previous && mark.time<=actionTime) RunMark(mark.sound);
            if(actionTime<action.duration) return;
            if(RifleLoading)
            {
                var clip=Action;
                if(clip=="open") StartMotion("gather");
                else if(Ammo>=Capacity || Current.reserve==0) CloseRifle(false,false);
                else if(clip=="gather" || rifleBatch>0)
                    StartMotion((emptyRifle && Ammo<2 ? "belt" : "insert")+Ammo);
                else StartMotion("gather");
                return;
            }
            aiming=Action=="close" && aimAfterClose;
            action=null;
            incoming=outgoing=null;
            testing=aimAfterClose=false;
            closingFrom=null;
        }

        void RunMark(string mark)
        {
            var cue=mark;
            switch(mark)
            {
                case "power": power=!power; if(power) jammed=false; break;
                case "motor-start": testing=true; cue="power"; break;
                case "motor-stop": testing=false; cue="power"; break;
                case "release": if(selected==Smg) cue="smg-latch"; break;
                case "discard":
                    if(!outgoing.removed)
                    {
                        DropPart(Current.magazine,new Vector3(-.81f,.56f,1.02f));
                        outgoing.removed=true;
                        dropped++;
                    }
                    cue="throw";
                    break;
                case "cap":
                    incoming.sealedCap=false;
                    DropPart(Current.cap,new Vector3(-.38f,.28f,.36f));
                    break;
                case "mount":
                    Current.spares.RemoveAt(0);
                    if(outgoing.Count>0) Current.spares.Add(outgoing);
                    Current.loaded=incoming;
                    jammed=false;
                    cue="seat";
                    break;
                case "load":
                    Current.loaded.cars.Add(RifleOrder[Current.nextCar++%6]);
                    Current.reserve--;
                    rifleBatch--;
                    cue="seat";
                    break;
            }
            sound.Cue(selected==Rifle ? "rifle-"+cue : cue);
        }

        public void Advance(float dt,bool show,bool triggerDown,bool triggerHeld,bool aimDown,float lookX,float lookY,float stride)
        {
            clock+=dt;
            show=show && OwnsSelection;
            if(!triggerHeld && !triggerDown) waitForRelease=false;
            if(!show && (Busy || aiming) && pending<0) Cancel();
            draw=Mathf.MoveTowards(draw,show && pending<0 ? 1 : 0,dt*(pending>=0 ? 6.5f : 5.5f));
            if(pending>=0 && draw<=.01f)
            {
                Current.root.gameObject.SetActive(false);
                selected=pending;
                pending=-1;
                kick=0;
                sound.Cue(selected==Rifle ? "rifle-draw" : "draw");
            }
            if(show && CanAct)
            {
                if((RifleLoading || Action=="close") && (aimDown || triggerDown)) CloseRifle(aimDown,true);
                else if(action==null && aimDown) aiming=!aiming;
            }

            if(action!=null) AdvanceMotion(dt);
            if(!cycle && action==null && show && CanAct && !waitForRelease && (triggerDown || triggerHeld || warm))
            {
                if((selected!=Pistol || !jammed) && (Ammo>0 || triggerDown))
                {
                    cycle=true;
                    cycleStart=warm || !power && selected==Pistol || Ammo==0 ? 0 : StartTime[selected];
                    cycleTime=warm ? leftInFrame : 0;
                }
                warm=false;
            }

            var jam=selected==Pistol && !power && Ammo>0;
            var duration=FeedTime[selected]*(jam ? .28f : 1);
            if(cycle) cycleTime+=dt;
            var progress=cycle ? Mathf.Clamp01((cycleTime-cycleStart)/duration) : 0;
            aim=Mathf.Lerp(aim,aiming && show && action==null ? 1 : 0,1-Mathf.Exp(-15*dt));
            camera.fieldOfView=Mathf.Lerp(hipFov,selected==Rifle ? 43 : 48,aim);
            press=Mathf.MoveTowards(press,cycle ? 1 : 0,dt*16);
            kick*=Mathf.Exp(-dt*18);
            swayX=Mathf.Lerp(swayX,Mathf.Clamp(lookX,-.085f,.085f),1-Mathf.Exp(-dt*13));
            swayY=Mathf.Lerp(swayY,Mathf.Clamp(lookY,-.07f,.07f),1-Mathf.Exp(-dt*13));
            var drift=new Vector2(Mathf.Sin(clock*2.31f)*.0015f-swayX*.019f,
                Mathf.Sin(clock*2.68f+.7f)*.0019f+Mathf.Sin(stride)*.00045f+swayY*.022f);
            reticleOffset=Vector2.Lerp(reticleOffset,Vector2.ClampMagnitude(drift,.0035f)*(1-aim*.81f),1-Mathf.Exp(-dt*23));
            var viewRay=camera.ViewportPointToRay(new Vector3(.5f+reticleOffset.x,.5f+reticleOffset.y,0));
            sightRay=new Ray(camera.transform.position,viewRay.direction);

            var whine=cycle && !jam && Ammo>0;
            var charge=whine ? cycleStart>0 ? Mathf.SmoothStep(.04f,.92f,cycleTime/cycleStart)+.08f*progress : .91f+.09f*progress : 0;
            boostCharge=whine ? Mathf.Clamp01(charge) : Mathf.MoveTowards(boostCharge,0,dt*7.5f);
            var loadingBelt=Action.StartsWith("belt",StringComparison.Ordinal) && actionTime>.185f && actionTime<.337f;
            var feeding=cycle && cycleTime>=cycleStart;
            var feeder=testing && selected==Smg ? "motor-smg-test" :
                testing || loadingBelt || feeding ? "motor-"+Current.model.kind : null;
            sound.LauncherMotors(feeder,testing || loadingBelt ? .43f : jam ? .67f : .59f,boostCharge,BoosterPitch[selected],dt);
            Current.boosterAngle=(Current.boosterAngle+dt*(620+boostCharge*3800)*boostCharge)%360;
            Render(progress,jam,stride);
            if(cycle && progress>=1)
            {
                cycle=false;
                leftInFrame=Mathf.Max(0,cycleTime-cycleStart-duration);
                if(jam)
                {
                    jammed=true;
                    sound.Cue("jam");
                }
                else if(Ammo>0)
                {
                    int car=Current.loaded.cars[0];
                    Current.loaded.cars.RemoveAt(0);
                    if(car>=0)
                    {
                        Launch(car);
                        kick=selected==Pistol ? 1 : selected==Rifle ? .45f : .25f;
                    }
                    Current.belt+=Slot;
                    Current.railCar.gameObject.SetActive(false);
                    warm=Ammo>0 && (triggerHeld || car<0);
                }
                if(Ammo==0) Message(Reserve>0 ? "R  RELOAD" : "OUT OF MINICARS");
                if(queueReload) {queueReload=false; Reload();}
            }
        }

        bool RifleLoading => selected==Rifle && (Action is "open" or "gather" ||
            Action.StartsWith("insert",StringComparison.Ordinal) || Action.StartsWith("belt",StringComparison.Ordinal));

        Pose Frame(int channel,float progress,bool jam)
        {
            var gear=Current;
            var idle=Pose.Mix(gear.hip.At(0,channel),gear.sight.At(0,channel),aim);
            if(action!=null)
            {
                var target=action.At(actionTime,channel);
                return closingFrom!=null ? Pose.Mix(closingFrom[channel],target,Mathf.SmoothStep(0,1,actionTime/.22f)) : target;
            }
            if(channel<ShellPose || press<=.001f) return idle;
            var motion=gear.model.Motion(jam ? "jam" : "fire");
            return Pose.Mix(idle,motion.At(progress,channel),press);
        }

        void Render(float progress,bool jam,float stride)
        {
            var gear=Current;
            if(draw<=.025f)
            {
                gear.root.gameObject.SetActive(false);
                SupportHand=null;
                return;
            }
            var root=Frame(RootPose,progress,jam);
            var away=1-draw;
            var quiet=action!=null ? .12f : Mathf.Lerp(1,.29f,aim);
            var shift=new Vector3((-swayX+Mathf.Sin(stride*.51f)*.016f)*quiet+away*.12f,
                (swayY+Mathf.Cos(stride)*.008f)*quiet-kick*.024f-away*.74f,-kick*.084f-away*.04f);
            shift+=new Vector3(CastSwing*.084f,CastSwing*.12f,CastSwing*.23f);
            shift.z-=gear.model.shoulderRoom*Mathf.Lerp(1,.37f,aim);
            shift.x-=gear.model.shoulderRoom*.58f*(1-aim)*(action==null ? 1 : .26f);
            new Pose(root.at+shift,root.turn*Quaternion.Euler(-kick*4.6f+away*13-CastSwing*29,
                swayX*18*quiet+CastSwing*12,CastSwing*17)).Apply(gear.root);
            if(action==null && Mathf.Abs(CastSwing)<.005f)
            {
                AlignTrack(gear);
                FitForegrip(gear);
            }
            else ReadTrack(gear);
            var palm=Frame(SupportPose,progress,jam);
            SupportHand=SupportContact(gear,palm);
            for(int i=0;i<gear.shell.Length;i++)
            {
                var frame=Frame(ShellPose+i,progress,jam);
                if(selected==Pistol && i==3 && action==null && !power)
                    frame=new Pose(new Vector3(-.026f,frame.at.y,frame.at.z),frame.turn);
                if(selected==Pistol && i==2)
                    frame=new Pose(frame.at,Quaternion.AngleAxis(-gear.boosterAngle,Vector3.right));
                if(selected==Pistol && i==4 && action==null)
                {
                    var feed=jammed ? .28f : jam ? progress*.28f : progress;
                    frame=new Pose(frame.at,PistolRoller(gear,feed));
                }
                frame.Apply(gear.shell[i]);
            }
            var showing=incoming!=null && Action!="" && actionTime>=PocketTime() ? incoming : gear.loaded;
            if(showing.removed) gear.magazine.gameObject.SetActive(false);
            else Frame(CartridgePose,progress,jam).Apply(gear.magazine);
            if(gear.cap) Frame(CapPose,progress,jam).Apply(gear.cap);
            if(selected==Rifle) RenderRifle(gear);
            else RenderCartridge(gear,showing,progress,jam);
            RenderTrackCar(gear,showing,progress,jam);
        }

        static ValleyHandContact MoldedGrip(Launcher gear,float[] local,float side,Vector3? indexPad=null)
        {
            var root=gear.root;
            return new ValleyHandContact(root.TransformPoint(ValleyGearAssets.Point(local)),
                Quaternion.LookRotation(root.forward-root.up*.13f-root.right*side*.16f,
                    -root.right*side+root.up*.055f),1,true,indexPad);
        }

        void FitForegrip(Launcher gear)
        {
            if(gear.model.supportGrip?.Length!=3) return;
            for(int i=0;i<2;i++)
            {
                var grip=MoldedGrip(gear,gear.model.supportGrip,-1);
                var shift=owner.hands.left.GripReachCorrection(camera.transform,grip);
                if(shift.sqrMagnitude<.000001f) break;
                gear.root.position+=Vector3.ClampMagnitude(shift,.085f);
                AlignTrack(gear);
            }
        }

        ValleyHandContact? SupportContact(Launcher gear,Pose palm)
        {
            var model=gear.model;
            var ready=model.supportGrip?.Length==3;
            var grip=ready ? MoldedGrip(gear,model.supportGrip,-1) : default;
            if(action==null) return ready ? grip : null;
            var root=gear.root;
            // The authored left-hand contact follows the cartridge or its latch
            // while it is moving. Blend back into the stationary foregrip at the ends.
            var authored=new ValleyHandContact(root.TransformPoint(palm.at),
                root.rotation*palm.turn*Quaternion.Euler(-12,-23,72),palm.scale,false);
            var transition=Mathf.SmoothStep(0,1,Mathf.Min(actionTime,action.duration-actionTime)/.19f);
            if(!ready) return palm.scale>.015f ? authored : null;
            if(palm.scale<=.015f) return grip;
            return new ValleyHandContact(Vector3.Lerp(grip.Point,authored.Point,transition),
                Quaternion.Slerp(grip.Rotation,authored.Rotation,transition),1,transition<.50f);
        }

        float PocketTime()
        {
            foreach(var mark in action.marks) if(mark.sound=="pocket") return mark.time;
            return float.PositiveInfinity;
        }

        void RenderRifle(Launcher gear)
        {
            var hatchOpen=gear.shell[1].localPosition.z>.006f;
            for(int i=0;i<gear.slots.Length;i++)
            {
                var node=gear.slots[i];
                node.gameObject.SetActive(hatchOpen && i<gear.loaded.cars.Count);
                if(node.gameObject.activeSelf)
                {
                    Assets.ChangeMesh(node.GetComponent<MeshFilter>(),gear.model.looseCars[gear.loaded.cars[i]]);
                    new Pose(gear.model.slots,i*Pose.Width).Apply(node);
                }
            }
            var hand=Frame(HandCarPose,0,false);
            if(hand.scale>.001f)
                Assets.ChangeMesh(gear.handCar.GetComponent<MeshFilter>(),Assets.Data.carIds[RifleOrder[gear.nextCar%6]]);
            hand.Apply(gear.handCar);
        }

        void RenderCartridge(Launcher gear,Cartridge cart,float progress,bool jam)
        {
            var lift=selected==Smg ? progress : 0;
            if(jammed) progress=.28f;
            else if(jam) progress*=.28f;
            for(int i=0;i<gear.cart.Length;i++)
            {
                var part=new Pose(gear.model.magazine[i].at);
                if(selected==Smg && i==1) part=new Pose(part.at,part.turn*Quaternion.Euler(0,lift*360,0));
                if(selected==Pistol && i>=2 && i<gear.cart.Length-1)
                    part=new Pose(part.at,part.turn*PistolRoller(gear,progress));
                part.Apply(gear.cart[i]);
            }
            for(int i=0;i<gear.slots.Length;i++)
            {
                int color=i<cart.cars.Count ? cart.cars[i] : -1;
                bool rail=i==0 && cycle && !jam && (selected==Smg ? lift>=SmgExit : progress>=PistolExit);
                var node=gear.slots[i];
                node.gameObject.SetActive(color>=0 && !rail);
                if(!node.gameObject.activeSelf) continue;
                var part=new Pose(gear.model.slots,i*Pose.Width);
                var offset=selected==Smg ? Vector3.up*lift*ElevatorStep : Vector3.forward*(progress*Slot);
                Assets.ChangeMesh(node.GetComponent<MeshFilter>(),gear.model.looseCars[color]);
                new Pose(part.at+offset,part.turn,part.scale).Apply(node);
            }
        }

        static Quaternion PistolRoller(Launcher gear,float feed)
            => Quaternion.AngleAxis((gear.belt+feed*Slot)/.0154f*Mathf.Rad2Deg,Vector3.right);

        void RenderTrackCar(Launcher gear,Cartridge cart,float progress,bool jam)
        {
            var enter=selected==Smg ? SmgExit : selected==Rifle ? RifleExit : PistolExit;
            var onRail=cycle && !jam && !jammed && progress>=enter && cart.cars.Count>0 && cart.cars[0]>=0;
            gear.railCar.gameObject.SetActive(onRail);
            if(!onRail) return;
            var travel=Mathf.InverseLerp(enter,1,progress);
            var at=Vector3.Lerp(ValleyGearAssets.Point(gear.model.railStart),ValleyGearAssets.Point(gear.model.muzzle),
                travel*travel);
            Assets.ChangeMesh(gear.railCar.GetComponent<MeshFilter>(),Assets.Data.carIds[cart.cars[0]]);
            var size=selected==Pistol ? Mathf.Lerp(1,gear.model.scale,travel) : gear.model.scale;
            new Pose(at,Quaternion.identity,size).Apply(gear.railCar);
        }

        void ReadTrack(Launcher gear)
        {
            trackStart=gear.root.TransformPoint(ValleyGearAssets.Point(gear.model.railStart));
            trackExit=gear.root.TransformPoint(ValleyGearAssets.Point(gear.model.muzzle));
            trackHeading=(trackExit-trackStart).normalized;
        }

        void AlignTrack(Launcher gear)
        {
            ReadTrack(gear);
            nearObstruction=null;
            var distance=gear.model.reach;
            var ahead=Vector3.Dot(trackExit-sightRay.origin,sightRay.direction);
            if(Physics.Raycast(sightRay,out var hit,distance,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore))
            {
                if(hit.distance<=ahead+.11f) nearObstruction=hit;
                else if(hit.distance>ahead+.50f) distance=hit.distance;
            }
            var focus=sightRay.GetPoint(distance);
            if(!owner.Underwater)
            {
                var length=Vector3.Distance(trackExit,focus);
                var drag=gear.model.drag;
                var seconds=Mathf.Min(.58f,(Mathf.Exp(drag*length)-1)/(drag*gear.model.speed));
                focus.y+=.5f*ValleyToyCar.AirGravity*seconds*seconds;
            }
            // The muzzle follows the visible track. Rotate about the rear grip so
            // the controls remain planted in the hand while convergence changes.
            var pivot=gear.root.TransformPoint(ValleyGearAssets.Point(gear.model.grip));
            for(int i=0;i<3;i++)
            {
                var direction=(focus-trackExit).normalized;
                var steer=Quaternion.FromToRotation(trackHeading,direction);
                gear.root.SetPositionAndRotation(pivot+steer*(gear.root.position-pivot),steer*gear.root.rotation);
                ReadTrack(gear);
            }
        }

        void Launch(int color)
        {
            var gear=Current;
            LastMuzzle=trackExit;
            LastLaunch=LastRailHeading=trackHeading;
            shots++;
            sound.Cue("shot-"+gear.model.kind,.89f);
            var projectile=SpawnProjectile(color,trackExit,trackHeading*gear.model.speed,gear.model.drag,
                gear.railCar.lossyScale.x,false);
            if(Line(camera.transform.position,trackStart,out var hit) || Line(trackStart,trackExit,out hit))
                projectile.Obstructed(hit);
            else if(nearObstruction is RaycastHit obstruction)
                projectile.Obstructed(obstruction);
        }

        internal ValleyToyCar SpawnProjectile(int color,Vector3 at,Vector3 velocity,float drag,float scale,bool opponent)
        {
            var car=Assets.NewPart(Assets.Data.carIds[color],null,"Launched mini-car",true);
            car.SetPositionAndRotation(at,Quaternion.LookRotation(velocity));
            car.localScale=Vector3.one*scale;
            var projectile=car.gameObject.AddComponent<ValleyToyCar>();
            projectile.Begin(owner,velocity,drag,opponent);
            launched.RemoveAll(item=>!item);
            if(launched.Count>=50) {Object.Destroy(launched[0]); launched.RemoveAt(0);}
            launched.Add(car.gameObject);
            return projectile;
        }

        static bool Line(Vector3 from,Vector3 to,out RaycastHit hit)
        {
            var direction=to-from;
            return Physics.Raycast(from,direction,out hit,direction.magnitude,Physics.DefaultRaycastLayers,QueryTriggerInteraction.Ignore);
        }

        void DropPart(Transform source,Vector3 velocity)
        {
            if(!source || !source.gameObject.activeInHierarchy) return;
            var copy=Object.Instantiate(source.gameObject);
            copy.transform.SetPositionAndRotation(source.position,source.rotation);
            copy.transform.localScale=source.lossyScale;
            var volume=LocalBounds(copy.transform);
            var collider=copy.AddComponent<BoxCollider>();
            collider.center=volume.center;
            collider.size=volume.size;
            Physics.IgnoreCollision(player,collider);
            var body=copy.AddComponent<Rigidbody>();
            body.mass=.24f;
            body.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;
            body.linearVelocity=camera.transform.TransformDirection(velocity);
            body.angularVelocity=camera.transform.right*4.2f;
            Object.Destroy(copy,PartLifetime);
        }

        static Bounds LocalBounds(Transform root)
        {
            var bounds=new Bounds(Vector3.zero,Vector3.one*.08f);
            foreach(var part in root.GetComponentsInChildren<MeshRenderer>())
            {
                var local=part.localBounds;
                for(int i=0;i<8;i++)
                {
                    var corner=new Vector3((i&1)==0 ? local.min.x : local.max.x,(i&2)==0 ? local.min.y : local.max.y,
                        (i&4)==0 ? local.min.z : local.max.z);
                    bounds.Encapsulate(root.InverseTransformPoint(part.transform.TransformPoint(corner)));
                }
            }
            return bounds;
        }

        public void ClearProjectiles()
        {
            foreach(var item in launched) if(item) {item.SetActive(false); Object.Destroy(item);}
            launched.Clear();
        }

        void Message(string value) {notice=value; noticeUntil=clock+1.7f;}
    }
}
