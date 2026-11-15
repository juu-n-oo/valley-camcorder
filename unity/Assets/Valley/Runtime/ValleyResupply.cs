using UnityEngine;
using Pose=ValleyCamcorder.ValleyGearAssets.Pose;

namespace ValleyCamcorder
{
    public sealed class ValleyResupply
    {
        const float Duration=2.4f, Radius=1.6f;
        readonly ValleyAudio sound;
        readonly ValleyEquipment gear;
        readonly Vector3 bag, range;
        readonly ValleyGearAssets.Flap[] flaps;
        readonly Transform[] pieces;
        float time, opening;
        bool active;
        public bool Busy => active && time<Duration;
        public bool Active => active;
        public float Progress => time/Duration;
        public float CrateOpen => opening;
        public Vector3 RangeCrate => range;

        public ValleyResupply(ValleyAudio sound,ValleyEquipment gear,ValleyManifest map,Transform world)
        {
            this.sound=sound;
            this.gear=gear;
            var supply=System.Array.Find(map.objects,item=>item.kind=="supply");
            bag=new Vector3(supply.matrix[12],supply.matrix[13],-supply.matrix[14]);
            var crate=gear.Assets.Data.crate;
            range=ValleyGearAssets.Point(crate.at);
            flaps=crate.sides;
            var pivot=new GameObject("Target range carton flaps").transform;
            pivot.SetParent(world,true);
            pivot.position=range;
            pieces=new Transform[flaps.Length];
            for(int i=0;i<pieces.Length;i++)
            {
                pieces[i]=gear.Assets.NewPart(flaps[i].mesh,pivot,"Paperboard flap",true);
                new Pose(flaps[i].at).Apply(pieces[i]);
            }
        }

        public bool Near(Vector3 at,bool inRange)
        {
            var offset=at-(inRange ? range : bag);
            return Mathf.Abs(offset.y)<.65f && offset.x*offset.x+offset.z*offset.z<=Radius*Radius;
        }

        public void Advance(float dt,bool valid,bool freshPress,bool held,bool inRange)
        {
            if(!valid || !held) Cancel();
            else if(freshPress && !active && !gear.Busy)
            {
                active=true;
                time=0;
                sound.Search(inRange ? "crate" : "duffel");
            }
            if(Busy)
            {
                time=Mathf.Min(Duration,time+dt);
                if(time>=Duration) gear.Replenish();
            }
            var target=inRange && Busy ? 1 : 0;
            opening=Mathf.MoveTowards(opening,target,dt/(target>0 ? .61f : .43f));
            for(int i=0;i<pieces.Length;i++)
            {
                var flap=flaps[i];
                var pose=new Pose(flap.at);
                var blend=Mathf.SmoothStep(0,1,i<2 ? Mathf.InverseLerp(0,.65f,opening) : Mathf.InverseLerp(.37f,1,opening));
                pieces[i].localRotation=pose.turn*Quaternion.Euler(flap.angle*Mathf.Rad2Deg*blend,0,0);
            }
        }

        public void Cancel()
        {
            if(active) sound.Search(null);
            active=false;
            time=0;
        }
    }
}
