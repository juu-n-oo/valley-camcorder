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
        const float ViewScale=.56f, PartLifetime=30, Slot=.086f, ElevatorStep=.051f, ExitStart=.70f;
        const int Rifle=0, Pistol=1, Smg=2;
        static readonly string[] Labels={"1 RIFLE","2 PISTOL","3 SMG"};
        static readonly int[] RifleOrder={5,0,1,2,3,4};
        static readonly float[] FeedTime={.105f,.125f,.078f}, StartTime={.025f,.025f,.018f};

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
            public float belt;
        }

        readonly Launcher[] launchers;
        readonly Camera camera;
        readonly ValleyAudio sound;
        readonly Collider player;
        readonly Transform rig;
        readonly float hipFov;
        readonly List<GameObject> launched=new();
        int selected=Pistol, pending=-1, shots, dropped, rifleBatch;
        float draw, aim, actionTime, cycleTime, cycleStart, leftInFrame, press, kick, swayX,swayY,clock;
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
        public Vector3 Grip => Current.root.TransformPoint(ValleyGearAssets.Point(Current.model.grip));
        public Vector3? Support { get; private set; }
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
        public Transform Magazine => Current.magazine;
        public bool InspectionMotor => testing;
        public bool CanAct => draw>.68f && pending<0 && !Current.onGround;
        public bool OwnsSelection => !Current.onGround;
        public float Trigger => press;

        public ValleyEquipment(Camera camera,GameObject original,Collider player,ValleyAudio sound)
        {
            this.camera=camera;
            this.player=player;
            this.sound=sound;
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
            gear.handCar=Assets.NewPart(Assets.Data.carIds[0],gear.root,"Mini-car being loaded");
            gear.railCar=Assets.NewPart(Assets.Data.carIds[0],gear.root,"Mini-car on orange track");
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
            sound.Mechanism(null);
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
            => DropLauncher(HandleNearPlayer(),Current.root.rotation,velocity,true);

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
                    cycleStart=warm || !power && selected==Pistol ? 0 : StartTime[selected];
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
                        Current.belt+=Slot;
                        kick=selected==Pistol ? 1 : selected==Rifle ? .45f : .25f;
                    }
                    warm=Ammo>0 && (triggerHeld || car<0);
                }
                if(Ammo==0) Message(Reserve>0 ? "R  RELOAD" : "OUT OF MINICARS");
                if(queueReload) {queueReload=false; Reload();}
            }
            bool loadingBelt=Action.StartsWith("belt",StringComparison.Ordinal) && actionTime>.185f && actionTime<.337f;
            var loop=testing && selected==Smg ? "motor-smg-test" : loadingBelt ? "motor-rifle" :
                testing || cycle && (selected!=Pistol || power) ? "motor-"+Current.model.kind : null;
            sound.Mechanism(loop);
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
                Support=null;
                return;
            }
            var root=Frame(RootPose,progress,jam);
            var away=1-draw;
            var quiet=action!=null ? .12f : Mathf.Lerp(1,.29f,aim);
            var shift=new Vector3((-swayX+Mathf.Sin(stride*.51f)*.016f)*quiet+away*.12f,
                (swayY+Mathf.Cos(stride)*.008f)*quiet-kick*.024f-away*.74f,-kick*.084f-away*.04f);
            new Pose(root.at+shift,root.turn*Quaternion.Euler(-kick*4.6f+away*13,swayX*18*quiet,0)).Apply(gear.root);
            var palm=Frame(SupportPose,progress,jam);
            Support=palm.scale>.035f ? gear.root.TransformPoint(palm.at) : null;
            for(int i=0;i<gear.shell.Length;i++)
            {
                var frame=Frame(ShellPose+i,progress,jam);
                if(selected==Pistol && i==3 && action==null && !power)
                    frame=new Pose(new Vector3(-.026f,frame.at.y,frame.at.z),frame.turn);
                frame.Apply(gear.shell[i]);
            }
            var showing=incoming!=null && Action!="" && actionTime>=PocketTime() ? incoming : gear.loaded;
            if(showing.removed) gear.magazine.gameObject.SetActive(false);
            else Frame(CartridgePose,progress,jam).Apply(gear.magazine);
            if(gear.cap) Frame(CapPose,progress,jam).Apply(gear.cap);
            if(selected==Rifle) RenderRifle(gear,progress,jam);
            else RenderCartridge(gear,showing,progress,jam);
        }

        float PocketTime()
        {
            foreach(var mark in action.marks) if(mark.sound=="pocket") return mark.time;
            return float.PositiveInfinity;
        }

        void RenderRifle(Launcher gear,float progress,bool jam)
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
            var hand=Frame(HandCarPose,progress,jam);
            if(hand.scale>.001f)
                Assets.ChangeMesh(gear.handCar.GetComponent<MeshFilter>(),Assets.Data.carIds[RifleOrder[gear.nextCar%6]]);
            hand.Apply(gear.handCar);
            gear.railCar.gameObject.SetActive(false);
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
                    part=new Pose(part.at,part.turn*Quaternion.Euler((gear.belt+progress*Slot)/.0154f*Mathf.Rad2Deg,0,0));
                part.Apply(gear.cart[i]);
            }
            for(int i=0;i<gear.slots.Length;i++)
            {
                int color=i<cart.cars.Count ? cart.cars[i] : -1;
                bool rail=selected==Smg && i==0 && lift>=ExitStart;
                var node=gear.slots[i];
                node.gameObject.SetActive(color>=0 && !rail);
                if(!node.gameObject.activeSelf) continue;
                var part=new Pose(gear.model.slots,i*Pose.Width);
                var offset=selected==Smg ? Vector3.up*lift*ElevatorStep : Vector3.forward*(progress*Slot+
                    (i==0 && !jam && !jammed ? Mathf.SmoothStep(0,.20f,Mathf.InverseLerp(.28f,1,progress)) : 0));
                Assets.ChangeMesh(node.GetComponent<MeshFilter>(),gear.model.looseCars[color]);
                new Pose(part.at+offset,part.turn,part.scale).Apply(node);
            }
            var onRail=selected==Smg && lift>=ExitStart && cart.cars.Count>0 && cart.cars[0]>=0;
            gear.railCar.gameObject.SetActive(onRail);
            if(!onRail) return;
            var travel=Mathf.InverseLerp(ExitStart,1,lift);
            var at=Vector3.Lerp(ValleyGearAssets.Point(gear.model.railStart),ValleyGearAssets.Point(gear.model.muzzle),travel*travel);
            Assets.ChangeMesh(gear.railCar.GetComponent<MeshFilter>(),Assets.Data.carIds[cart.cars[0]]);
            new Pose(at,Quaternion.identity,gear.model.scale).Apply(gear.railCar);
        }

        void Launch(int color)
        {
            var gear=Current;
            var head=camera.transform;
            var muzzle=gear.root.TransformPoint(ValleyGearAssets.Point(gear.model.muzzle));
            var start=selected==Smg ? gear.root.TransformPoint(ValleyGearAssets.Point(gear.model.railStart)) : head.position;
            var heading=selected==Smg ? (muzzle-start).normalized : (AimPoint(gear,head,muzzle)-muzzle).normalized;
            LastMuzzle=muzzle;
            LastLaunch=heading;
            LastRailHeading=selected==Smg ? (muzzle-start).normalized : Vector3.zero;
            shots++;
            sound.Cue("shot-"+gear.model.kind);
            var car=Assets.NewPart(Assets.Data.carIds[color],null,"Launched mini-car",true);
            car.SetPositionAndRotation(muzzle,Quaternion.LookRotation(heading));
            car.localScale=Vector3.one*gear.model.scale;
            var projectile=car.gameObject.AddComponent<ValleyToyCar>();
            var velocity=heading*gear.model.speed;
            if(Line(head.position,start,out var hit) || Line(start,muzzle,out hit))
            {
                projectile.Impact(hit.collider,hit.point,gear.model.speed,heading);
                car.position=hit.point+hit.normal*.04f;
                velocity=Vector3.Reflect(velocity,hit.normal)*.19f;
            }
            projectile.Begin(player,velocity,gear.model.drag);
            launched.RemoveAll(item=>!item);
            if(launched.Count>=50) {Object.Destroy(launched[0]); launched.RemoveAt(0);}
            launched.Add(car.gameObject);
            Object.Destroy(car.gameObject,PartLifetime);
        }

        static Vector3 AimPoint(Launcher gear,Transform head,Vector3 muzzle)
        {
            var target=head.position+head.forward*gear.model.reach;
            if(Line(head.position,target,out var hit) &&
                hit.distance>Vector3.Dot(muzzle-head.position,head.forward)+.10f) target=hit.point;
            return target;
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
