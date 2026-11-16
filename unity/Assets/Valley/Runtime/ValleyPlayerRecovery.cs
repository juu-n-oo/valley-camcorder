using UnityEngine;

namespace ValleyCamcorder
{
    public sealed partial class ValleyPlayer
    {
        float stumbleTime,drowningTime,fallenTime=-1,fallRoll,fallYaw,fallHeight,recoverStart;
        bool recoveryReleased;
        public bool Incapacitated => stumbleTime>0 || drowningTime>0 || Rewinding;
        float exposureStart,exposureEnd;
        internal float BlastExposure => exposureStart*Mathf.Clamp01((exposureEnd-life)/.34f);

        internal void HitByBlast(Vector3 at,float exposure,bool fatal=false)
        {
            if(Health<=0 || exposure<.035f) return;
            exposureStart=exposure;
            exposureEnd=life+.34f;
            if(seated)
            {
                seated.Occupy(false);
                seated=null;
                body.enabled=true;
            }
            Damage(fatal ? Health : Mathf.RoundToInt(12+45*exposure));
            if(Health<=0) ReleaseHeld(.49f);
            InterruptInteraction();
            Swimming=Diving=Prone=false;
            moveVelocity=Vector3.ProjectOnPlane(transform.position-at,Vector3.up);
            if(moveVelocity.sqrMagnitude<.01f) moveVelocity=-transform.forward;
            moveVelocity=moveVelocity.normalized*Mathf.Lerp(3.5f,10.6f,exposure);
            vertical=Mathf.Lerp(2.25f,5.5f,exposure);
            fallHeight=stance;
            fallRoll=Random.Range(51f,84f)*(Random.value<.5f ? -1 : 1);
            fallYaw=Random.Range(-76f,76f);
            fallenTime=-1;
            stumbleTime=.0001f;
        }

        bool AdvanceRecovery(float dt)
        {
            if(Rewinding)
            {
                rewindTime+=dt;
                if(rewindTime>=1.72f) Respawn();
                return true;
            }
            if(stumbleTime>0)
            {
                StepFall(dt);
                return true;
            }
            if(Health>0) return false;
            if(drowningTime>0 || Underwater) StepDrowning(dt);
            else EnterRewind();
            return true;
        }

        void StepFall(float dt)
        {
            stumbleTime+=dt;
            var position=transform.position;
            if(fallenTime<0)
            {
                body.height=Mathf.MoveTowards(body.height,.54f,dt*5.6f);
                body.center=Vector3.up*(body.height*.5f+.02f);
                body.stepOffset=.14f;
                vertical-=11.46f*dt;
                var offset=(moveVelocity+Vector3.up*vertical)*dt;
                if(!world.Map.Walkable(position+offset)) {offset.x=offset.z=0;moveVelocity=Vector3.zero;}
                var flags=body.Move(offset);
                if((flags&CollisionFlags.Sides)!=0) moveVelocity*=-.22f;
                if(vertical<0 && (flags&CollisionFlags.Below)!=0)
                {
                    var landing=-vertical;
                    fallenTime=0;
                    moveVelocity=Vector3.zero;
                    sound.WorldCue("floor-land",position,Mathf.Clamp(landing*.12f,.26f,.83f));
                    if(Health>0) Damage(Mathf.RoundToInt(Mathf.Clamp(landing*1.45f,3,13)));
                    if(Health<=0) ReleaseHeld(.46f);
                }
            }
            else fallenTime+=dt;
            var recover=fallenTime<0 || Health<=0 ? 0 : Ease(Mathf.InverseLerp(.43f,1.47f,fallenTime));
            var fall=Ease(stumbleTime/.31f)*(1-recover);
            var rest=fallenTime<0 ? Mathf.Lerp(fallHeight,.48f,Ease(stumbleTime/.38f)) : .34f;
            stance=Mathf.Lerp(rest,1.62f,recover);
            view.transform.localPosition=Vector3.up*stance;
            view.transform.localRotation=Quaternion.Euler(pitch+fall*15,fallYaw*fall,fallRoll*fall);
            Equipment.Advance(dt,false,false,false,false,0,0,0);
            hands.Brace(stumbleTime,fall,dt);
            last=transform.position;
            if(fallenTime>1.13f && Health<=0) EnterRewind();
            else if(recover>=1)
            {
                stumbleTime=0;
                recoverAt=Mathf.Max(recoverAt,life+.25f);
                vertical=-2;
                hands.Brace(stumbleTime,0,dt);
            }
        }

        void StepDrowning(float dt)
        {
            if(drowningTime==0)
            {
                InterruptInteraction();
                Water.Bubbles(view.transform.position+view.transform.forward*.38f,19);
            }
            drowningTime+=dt;
            var age=drowningTime;
            var lurch=Ease(age/.58f)*(1-.48f*Ease(Mathf.InverseLerp(1.63f,2.71f,age)));
            var head=view.transform;
            if(age>=.62f && !recoveryReleased)
            {
                ReleaseHeld(.25f);
                sound.Cue("drown");
                Water.Bubbles(head.position+head.forward*.37f-Vector3.up*.15f,22);
            }
            if(body.enabled) body.Move(Vector3.down*(.27f+.14f*Mathf.Sin(age*7.13f))*dt);
            head.localPosition=new Vector3(Mathf.Sin(age*4.9f)*.11f*lurch,.86f,Mathf.Cos(age*4.3f)*.12f*lurch);
            head.localRotation=Quaternion.Euler(pitch+lurch*(29*Mathf.Sin(age*5.7f)+12),
                lurch*(32*Mathf.Sin(age*4.1f)+8*Mathf.Sin(age*11.9f)),lurch*35*Mathf.Sin(age*5));
            sound.WaterDepth(.42f);
            if(age>.62f) Equipment.Advance(dt,false,false,false,false,0,0,0);
            hands.Brace(age,lurch,dt);
            if(age>=3.10f) EnterRewind();
        }

        void ReleaseHeld(float speed)
        {
            if(recoveryReleased) return;
            recoveryReleased=true;
            if(held) held.Toss(view.transform.forward*speed+Vector3.down*.40f);
            else if(Equipment.Visible) Equipment.Toss(view.transform.forward*speed-Vector3.right*.24f);
            held=null;
        }

        void InterruptInteraction()
        {
            if(task) task.Release();
            task=null;
            gesture=held ? Gesture.Carry : Gesture.Idle;
            Equipment.Cancel();
            Resupply.Cancel();
            Prompt="";
            drawAfterPlacement=false;
        }

        void EnterRewind()
        {
            ReleaseHeld(.30f);
            InterruptInteraction();
            stumbleTime=drowningTime=0;
            rewindTime=.0001f;
            sound.WaterDepth(0);
            sound.Cue("rewind");
        }
    }
}
