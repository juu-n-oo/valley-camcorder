using System;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace ValleyCamcorder
{
    public sealed class ValleyHands : MonoBehaviour
    {
        [Serializable]
        public sealed class Chain
        {
            public Transform frame, model, upper, forearm;
            public float side;
            Transform[] digits;
            Quaternion[] rest;
            Vector3 damp;
            Vector3 palmOffset=new(0,0,.122f);
            float closing, closingSpeed;

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
                digits=nodes.Where(t=>t.name.StartsWith("Thumb",StringComparison.OrdinalIgnoreCase)
                  || t.name.StartsWith("Index",StringComparison.OrdinalIgnoreCase)
                  || t.name.StartsWith("Middle",StringComparison.OrdinalIgnoreCase)
                  || t.name.StartsWith("Ring",StringComparison.OrdinalIgnoreCase)
                  || t.name.StartsWith("Little",StringComparison.OrdinalIgnoreCase)).ToArray();
                rest=digits.Select(t=>t.localRotation).ToArray();
                foreach(var part in model.GetComponentsInChildren<Renderer>(true)) part.shadowCastingMode=ShadowCastingMode.Off;
                upper.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;
                forearm.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;
                if (side<0) frame.localScale=new Vector3(-1,1,1);
            }

            public void Drive(Transform view, Vector3 contact, float grasp, float blend, float dt, bool active)
            {
                var localIdle = new Vector3(side*.29f,-.47f,.33f);
                var shoulder=view.TransformPoint(new Vector3(side*.22f,-.303f,-.077f));
                const float above=.29f, below=.28f;
                var goal=Vector3.Lerp(view.TransformPoint(localIdle),contact,blend);
                var approach=(goal-shoulder).normalized;
                var controlUp=Vector3.ProjectOnPlane(view.up*.28f-view.right*side*.93f,approach);
                var desiredRotation=Quaternion.LookRotation(approach,controlUp);
                bool reset=active && !frame.gameObject.activeSelf || Vector3.Distance(frame.position,goal)>1.1f;
                frame.rotation=reset ? desiredRotation : Quaternion.Slerp(frame.rotation,desiredRotation,1-Mathf.Exp(-dt*19));
                var palm=frame.TransformVector(palmOffset);
                var reach=goal-palm-shoulder;
                var target=shoulder+Vector3.ClampMagnitude(reach,above+below-.004f);
                if(reset || active && blend>.99f)
                {
                    frame.position=target;
                    damp=Vector3.zero;
                }
                else frame.position=Vector3.SmoothDamp(frame.position,target,ref damp,.055f,15,dt);
                var axis=frame.position-shoulder;
                var length=Mathf.Clamp(axis.magnitude,.101f,above+below-.003f);
                axis=axis.normalized;
                var projection=(above*above-below*below+length*length)/(2*length);
                var pole=Vector3.ProjectOnPlane(-view.up+view.right*side*.54f,axis).normalized;
                var elbow=shoulder+axis*projection+pole*Mathf.Sqrt(Mathf.Max(.0001f,above*above-projection*projection));
                Segment(upper,shoulder,elbow,.53f);
                Segment(forearm,elbow,frame.position,.67f);
                closing=Mathf.SmoothDamp(closing,grasp,ref closingSpeed,.064f,15,dt);
                for(var i=0;i<digits.Length;i++)
                {
                    var bone=digits[i];
                    var thumb=bone.name.StartsWith("Thumb",StringComparison.OrdinalIgnoreCase);
                    var degree=bone.name.EndsWith("01",StringComparison.Ordinal) ? 41 : 60;
                    bone.localRotation=rest[i]*Quaternion.AngleAxis(closing*(thumb ? degree*.62f : degree),Vector3.right);
                }
                frame.gameObject.SetActive(active);
                upper.gameObject.SetActive(active);
                forearm.gameObject.SetActive(active);
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

        public void Drive(ValleyFixture item,float progress,float grasp,Transform tool,float draw)
        {
            bool enabled = item != null && progress>.03f;
            bool handle=!enabled && tool && draw>.12f;
            var anchor=enabled ? item.Contact : handle ? tool.TransformPoint(new Vector3(.029f,-.135f,-.029f)) :
                view.TransformPoint(new Vector3(.20f,-.42f,.32f));
            var wide=enabled && item.portable && !item.small ? Mathf.Clamp(item.size.x*.30f,.16f,.31f) : 0;
            var across=enabled ? item.transform.right : view.right;
            var dt=Mathf.Clamp(Time.deltaTime,.001f,.04f);
            right.Drive(view,anchor+across*wide,handle ? .86f : grasp,handle ? draw : progress,dt,enabled || handle);
            left.Drive(view,anchor-across*wide,grasp,progress,dt,enabled && wide>0);
        }
    }
}
