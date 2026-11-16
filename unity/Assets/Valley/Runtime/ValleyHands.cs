using System;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace ValleyCamcorder
{
    internal readonly struct ValleyHandContact
    {
        public readonly Vector3 Point;
        public readonly Quaternion Rotation;
        public readonly float Weight;
        public readonly bool Anchored;
        public readonly Vector3? IndexPad;

        public ValleyHandContact(Vector3 point,Quaternion rotation,float weight,bool anchored,Vector3? indexPad=null)
        {
            Point=point;
            Rotation=rotation;
            Weight=weight;
            Anchored=anchored;
            IndexPad=indexPad;
        }
    }

    public sealed class ValleyHands : MonoBehaviour
    {
        [Serializable]
        public sealed class Chain
        {
            public Transform frame, model, upper, forearm;
            public float side;
            const float UpperLength=.325f, LowerLength=.296f;
            static readonly string[] DigitNames={"Index","Middle","Ring","Little","Thumb"};
            static readonly Vector3[] ClosedAngles={new(43,68,35),new(51,79,44),new(57,83,47),
                new(63,85,52),new(25,37,41)};
            readonly Digit[] digits=new Digit[DigitNames.Length];
            Vector3 damp;
            Vector3 palmOffset=new(0,0,.122f);
            Vector3 contactOffset;
            float closing, closingSpeed, indexPressure;
            internal Vector3 PalmContact => frame.TransformPoint(contactOffset);
            float ShoulderTravel => side<0 ? .14f : .092f;

            Vector3 Shoulder(Transform view) => view.TransformPoint(new Vector3(side*.22f,-.303f,-.077f));

            internal Vector3 GripReachCorrection(Transform view,ValleyHandContact contact)
            {
                var wrist=contact.Point-contact.Rotation*Vector3.Scale(contactOffset,frame.localScale);
                var reach=wrist-Shoulder(view);
                return -reach.normalized*Mathf.Max(0,reach.magnitude-(UpperLength+LowerLength+ShoulderTravel-.013f));
            }

            sealed class Digit
            {
                public readonly Transform[] bones;
                public readonly Quaternion[] rest=new Quaternion[3];
                public readonly Vector3[] flex=new Vector3[3];
                public readonly Vector3[] normal=new Vector3[3];
                public readonly float[] angle=new float[3];
                public Vector3 opposition,tip;

                public Digit(Transform[] bones,Transform frame,Transform index,bool thumb)
                {
                    this.bones=bones;
                    var direction=Vector3.up;
                    for(var joint=0;joint<3;joint++)
                    {
                        var node=bones[joint];
                        rest[joint]=node.localRotation;
                        if(joint<2) direction=node.InverseTransformDirection(bones[joint+1].position-node.position).normalized;
                        normal[joint]=node.InverseTransformDirection(frame.up);
                        flex[joint]=Vector3.Cross(direction,normal[joint]).normalized;
                        if(thumb && joint==0)
                        {
                            var towardIndex=node.InverseTransformDirection(index.position-node.position);
                            opposition=Vector3.Cross(direction,towardIndex).normalized;
                        }
                    }
                    tip=direction*Vector3.Distance(bones[1].position,bones[2].position)*.78f;
                }

                public void FollowButton(Vector3 point,float pressure)
                {
                    if((point-bones[0].position).sqrMagnitude>.127f*.127f) return;
                    for(var joint=2;joint>=0;joint--)
                    {
                        var node=bones[joint];
                        var axis=node.TransformDirection(flex[joint]);
                        var current=Vector3.ProjectOnPlane(bones[2].TransformPoint(tip)-node.position,axis);
                        var goal=Vector3.ProjectOnPlane(point-node.position,axis);
                        if(current.sqrMagnitude<.000001f || goal.sqrMagnitude<.000001f) continue;
                        var delta=Mathf.Clamp(Vector3.SignedAngle(current,goal,axis),-13f,17f)*pressure;
                        node.localRotation*=Quaternion.AngleAxis(delta,flex[joint]);
                    }
                }
            }

            public void Calibrate()
            {
                var nodes=model.GetComponentsInChildren<Transform>(true);
                var wrist=nodes.FirstOrDefault(t=>t.name=="Wrist");
                var index=nodes.FirstOrDefault(t=>t.name.StartsWith("Index",StringComparison.OrdinalIgnoreCase));
                var little=nodes.FirstOrDefault(t=>t.name.StartsWith("Little",StringComparison.OrdinalIgnoreCase));
                if (wrist != null && index != null && little != null)
                {
                    var forward=model.InverseTransformDirection((index.position+little.position)*.5f-wrist.position);
                    var across=model.InverseTransformDirection(index.position-little.position);
                    if (forward.sqrMagnitude>.001f && across.sqrMagnitude>.0001f)
                        model.localRotation=Quaternion.Inverse(Quaternion.LookRotation(forward,Vector3.Cross(forward,across)));
                    model.position+=frame.position-wrist.position;
                    palmOffset=frame.InverseTransformPoint(Vector3.Lerp(wrist.position,(index.position+little.position)*.5f,.73f));
                }
                contactOffset=palmOffset+Vector3.up*.016f;
                for(var digit=0;digit<digits.Length;digit++)
                {
                    var label=DigitNames[digit];
                    var joints=new Transform[3];
                    for(var i=0;i<joints.Length;i++)
                        joints[i]=nodes.FirstOrDefault(t=>t.name.StartsWith(label,StringComparison.OrdinalIgnoreCase) &&
                            t.name.EndsWith((i+1).ToString("00"),StringComparison.Ordinal));
                    if(index && joints.All(joint=>joint)) digits[digit]=new Digit(joints,frame,index,label=="Thumb");
                }
                foreach(var part in model.GetComponentsInChildren<Renderer>(true)) part.shadowCastingMode=ShadowCastingMode.Off;
                upper.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;
                forearm.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;
                const float handSize=.84f;
                frame.localScale=new Vector3(side<0 ? -handSize : handSize,handSize,handSize);
            }

            internal void Drive(Transform view,Vector3 contact,float grasp,float blend,float dt,bool active,
                ValleyHandContact? held=null,float trigger=-1)
            {
                var localIdle = new Vector3(side*.29f,-.47f,.33f);
                var shoulder=Shoulder(view);
                var goal=Vector3.Lerp(view.TransformPoint(localIdle),contact,blend);
                var approach=(goal-shoulder).normalized;
                var controlUp=Vector3.ProjectOnPlane(view.up*.28f-view.right*side*.93f,approach);
                var desiredRotation=Quaternion.LookRotation(approach,controlUp);
                if(held.HasValue)
                    desiredRotation=Quaternion.Slerp(desiredRotation,held.Value.Rotation,blend);
                var anchored=held.HasValue && held.Value.Anchored && blend>.98f;
                bool reset=active && !frame.gameObject.activeSelf || Vector3.Distance(frame.position,goal)>1.1f;
                frame.rotation=reset || anchored ? desiredRotation :
                    Quaternion.Slerp(frame.rotation,desiredRotation,1-Mathf.Exp(-dt*19));
                var palm=frame.TransformVector(held.HasValue ? contactOffset : palmOffset);
                var reach=goal-palm-shoulder;
                if(held.HasValue)
                {
                    // A small shoulder roll preserves full palm contact at the
                    // foregrip without stretching either visible arm segment.
                    shoulder+=reach.normalized*Mathf.Clamp(reach.magnitude-(UpperLength+LowerLength-.008f),0,ShoulderTravel)*blend;
                    reach=goal-palm-shoulder;
                }
                var target=shoulder+Vector3.ClampMagnitude(reach,UpperLength+LowerLength-.004f);
                if(reset || anchored || active && blend>.99f && !held.HasValue)
                {
                    frame.position=target;
                    damp=Vector3.zero;
                }
                else frame.position=Vector3.SmoothDamp(frame.position,target,ref damp,.055f,15,dt);
                var axis=frame.position-shoulder;
                var length=Mathf.Clamp(axis.magnitude,.101f,UpperLength+LowerLength-.003f);
                axis=axis.normalized;
                var projection=(UpperLength*UpperLength-LowerLength*LowerLength+length*length)/(2*length);
                var pole=Vector3.ProjectOnPlane(-view.up+view.right*side*.54f,axis).normalized;
                var elbow=shoulder+axis*projection+pole*Mathf.Sqrt(Mathf.Max(.0001f,UpperLength*UpperLength-projection*projection));
                Segment(upper,shoulder,elbow,.53f);
                Segment(forearm,elbow,frame.position,.67f);
                BendFingers(grasp,trigger,held,dt);
                frame.gameObject.SetActive(active);
                upper.gameObject.SetActive(active);
                forearm.gameObject.SetActive(active);
            }

            void BendFingers(float grasp,float trigger,ValleyHandContact? held,float dt)
            {
                closing=Mathf.SmoothDamp(closing,grasp,ref closingSpeed,.061f,15,dt);
                indexPressure=Mathf.Lerp(indexPressure,Mathf.Max(0,trigger),1-Mathf.Exp(-dt*34));
                for(var i=0;i<digits.Length;i++)
                {
                    var digit=digits[i];
                    if(digit==null) continue;
                    // Ring and little fingers settle first. The thumb rolls in
                    // separately and the distal joints follow the knuckles.
                    var thumb=i==4;
                    var start=thumb ? .34f : .14f-i*.043f;
                    var curl=Mathf.SmoothStep(0,1,Mathf.InverseLerp(start,.90f,closing));
                    if(trigger>=0 && i==0) curl=Mathf.Lerp(.32f,.80f,indexPressure);
                    for(var joint=0;joint<3;joint++)
                    {
                        var follow=joint==0 ? curl : Mathf.SmoothStep(0,1,Mathf.InverseLerp(joint*.09f,1,curl));
                        var angle=Mathf.Lerp(joint==0 ? 4 : 7,ClosedAngles[i][joint],follow);
                        digit.angle[joint]=Mathf.Lerp(digit.angle[joint],angle,1-Mathf.Exp(-dt*(joint==0 ? 29 : 23-joint)));
                        var bend=Quaternion.AngleAxis(digit.angle[joint],digit.flex[joint]);
                        if(joint==0)
                        {
                            if(thumb) bend=Quaternion.AngleAxis(33*curl,digit.opposition)*bend;
                            else
                            {
                                var spread=(1-curl)*(1.35f-i)*4.5f;
                                bend=Quaternion.AngleAxis(spread,digit.normal[joint])*bend;
                            }
                        }
                        digit.bones[joint].localRotation=digit.rest[joint]*bend;
                    }
                    if(trigger>=0 && i==0 && held?.IndexPad is Vector3 pad)
                        digit.FollowButton(pad,Mathf.Lerp(.36f,.86f,indexPressure));
                }
            }

            static void Segment(Transform segment, Vector3 from, Vector3 to, float thickness)
            {
                var line=from-to;
                segment.SetPositionAndRotation(from,Quaternion.LookRotation(line,Vector3.up));
                segment.localScale=new Vector3(thickness,thickness,line.magnitude);
            }
        }

        public Transform view;
        public Chain left, right;
        public int ArticulatedJoints { get; private set; }

        void Awake()
        {
            left.Calibrate();
            right.Calibrate();
            ArticulatedJoints=right.model.GetComponentsInChildren<Transform>(true).Count(t=>
              t.name=="Wrist" || t.name.EndsWith("01",StringComparison.Ordinal) ||
              t.name.EndsWith("02",StringComparison.Ordinal) || t.name.EndsWith("03",StringComparison.Ordinal));
        }

        public void Drive(ValleyFixture item,float progress,float grasp,ValleyEquipment tool,bool swim,float gait,float dt)
        {
            bool enabled = item != null && progress>.03f;
            bool handle=!enabled && tool.Visible;
            ValleyHandContact? main=handle ? tool.MainHand : null;
            var anchor=enabled ? item.Contact : main?.Point ?? Stroke(1,gait);
            var wide=enabled && item.portable && !item.small ? Mathf.Clamp(item.size.x*.30f,.16f,.31f) : 0;
            var across=enabled ? item.transform.right : view.right;
            right.Drive(view,anchor+across*wide,handle ? .91f : swim && !enabled ? .40f : grasp,
                handle ? tool.Draw : swim && !enabled ? 1 : progress,dt,enabled || handle || swim,main,handle ? tool.Trigger : -1);
            if(handle && tool.SupportHand is ValleyHandContact support)
                left.Drive(view,support.Point,support.Anchored ? .91f : .76f,tool.Draw*support.Weight,dt,true,support);
            else if(!enabled && swim)
                left.Drive(view,Stroke(-1,gait),.40f,1,dt,true);
            else
                left.Drive(view,anchor-across*wide,grasp,progress,dt,enabled && wide>0);
        }

        Vector3 Stroke(float side,float phase)
        {
            var motion=phase+(side>0 ? Mathf.PI : 0);
            var swing=Mathf.Sin(motion);
            var stretch=.5f-.5f*Mathf.Cos(motion);
            return view.TransformPoint(new Vector3(side*(.26f-.08f*stretch+.05f*swing),
                -.37f+.13f*Mathf.Max(0,swing),.32f+.25f*stretch));
        }

        internal void Brace(float time,float amount,float dt)
        {
            for(int side=-1;side<=1;side+=2)
            {
                var phase=time*(side<0 ? 9.8f : 8.3f)+side;
                var reach=view.TransformPoint(new Vector3(side*(.24f+.11f*Mathf.Sin(phase)),
                    -.36f+.18f*Mathf.Cos(phase*.72f),.47f+.12f*Mathf.Sin(phase*.86f)));
                var arm=side<0 ? left : right;
                arm.Drive(view,reach,.28f+.24f*Mathf.Sin(phase),amount,dt,amount>.04f);
            }
        }
    }
}
