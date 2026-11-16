using System;
using UnityEngine;

namespace ValleyCamcorder
{
    [Serializable] internal sealed class ValleyLocation
    {
        [Serializable] sealed class Place
        {
            public string name;
            public float[] at;
            public float yaw,width,depth;
            public int storeys;
            public Vector3 Local(Vector3 point)
                => Quaternion.Inverse(ValleyManifest.Turn(yaw))*(point-ValleyManifest.Point(at));
        }

        [Serializable] sealed class Route
        {
            public string name;
            public float radius;
            public float[] points;
            public bool Near(Vector2 p)
            {
                var limit=radius*radius;
                for(int i=2;i<points.Length;i+=2)
                {
                    var a=new Vector2(points[i-2],points[i-1]);
                    var b=new Vector2(points[i],points[i+1]);
                    if(p.x<Mathf.Min(a.x,b.x)-radius || p.x>Mathf.Max(a.x,b.x)+radius ||
                       p.y<Mathf.Min(a.y,b.y)-radius || p.y>Mathf.Max(a.y,b.y)+radius) continue;
                    var line=b-a;
                    var t=Mathf.Clamp01(Vector2.Dot(p-a,line)/Mathf.Max(.00001f,line.sqrMagnitude));
                    if((p-a-line*t).sqrMagnitude<limit) return true;
                }
                return false;
            }
        }

        [SerializeField] float level;
        [SerializeField] Place[] rooms,bridges,zones;
        [SerializeField] Route[] routes;
        public string At(Vector3 point)
        {
            if(rooms==null || level<.1f) return "";
            foreach(var room in rooms)
            {
                var p=room.Local(point);
                if(Mathf.Abs(p.x)>=room.width*.5f-.12f || Mathf.Abs(p.z)>=room.depth*.5f-.12f) continue;
                var floor=Mathf.RoundToInt(p.y/level);
                if(floor>=0 && floor<room.storeys && Mathf.Abs(p.y-floor*level)<.46f)
                    return room.storeys>1 ? room.name+" "+(floor+1)+"F" : room.name;
            }
            foreach(var bridge in bridges)
            {
                var p=bridge.Local(point);
                if(Mathf.Abs(p.x)<bridge.width*.5f && Mathf.Abs(p.z)<bridge.depth*.5f && p.y>=-.08f) return bridge.name;
            }
            foreach(var zone in zones)
            {
                var p=zone.Local(point);
                if(Mathf.Abs(p.x)<zone.width*.5f && Mathf.Abs(p.z)<zone.depth*.5f) return zone.name;
            }
            foreach(var route in routes)
                if(route.Near(new Vector2(point.x,point.z))) return route.name;
            return "";
        }
    }
}
