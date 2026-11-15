using UnityEngine;

namespace ValleyCamcorder
{
    public sealed class ValleyTape : MonoBehaviour
    {
        public Camera view;
        public ValleyPlayer player;
        public GameObject exterior;
        GUIStyle text, stamp;
        readonly Color navy = new(.048f,.035f,.41f,.88f);

        void LateUpdate()
        {
            var aspect=Screen.width/(float)Mathf.Max(1,Screen.height);
            const float tape=4f/3f;
            view.rect=aspect>tape ? new Rect((1-tape/aspect)*.5f,0,tape/aspect,1) :
                new Rect(0,(1-aspect/tape)*.5f,1,aspect/tape);
            if (exterior) exterior.SetActive(!player.InRange);
        }

        void OnGUI()
        {
            if (Event.current.type!=EventType.Repaint) return;
            var frame=view.pixelRect;
            float left=frame.xMin, top=Screen.height-frame.yMax, width=frame.width,height=frame.height;
            if (width<10 || height<10) return;
            GUI.color=Color.black;
            GUI.DrawTexture(new Rect(0,0,left,Screen.height),Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(frame.xMax,0,Screen.width-frame.xMax,Screen.height),Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(left,0,width,top),Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(left,top+height,width,Screen.height-top-height),Texture2D.whiteTexture);
            if(player.Underwater || player.Paused || player.Rewinding)
            {
                GUI.color=player.Rewinding ? new Color(.095f,.042f,.51f,.83f) :
                    player.Paused ? new Color(.025f,.025f,.035f,.53f) : new Color(.13f,.38f,.26f,.22f);
                GUI.DrawTexture(new Rect(left,top,width,height),Texture2D.whiteTexture);
            }
            text??=new GUIStyle(GUI.skin.label) { fontStyle=FontStyle.Bold, alignment=TextAnchor.MiddleLeft };
            stamp??=new GUIStyle(text) { alignment=TextAnchor.MiddleRight };
            text.normal.textColor=stamp.normal.textColor=Color.white;
            text.fontSize=Mathf.RoundToInt(Mathf.Clamp(height*.025f,12,26));
            stamp.fontSize=Mathf.RoundToInt(Mathf.Clamp(height*.041f,17,47));
            var seconds=Mathf.FloorToInt(Time.timeSinceLevelLoad);
            var inset=height*.08f;
            Tag(left+inset,top+height*.06f,$"●  REC   {seconds/3600:00}:{seconds/60%60:00}:{seconds%60:00}");
            var rangeSeconds=Mathf.FloorToInt(player.RangeTime);
            Tag(left+inset,top+height*.11f,player.InRange ?
                $"TARGET RANGE    {player.MarkedCount:00}/{player.targets.Length:00}    {rangeSeconds/60:00}:{rangeSeconds%60:00}" :
                player.Underwater ? "SUBMERGED" : "HWAYANG VALLEY");
            var gear=player.Equipment;
            if(player.Underwater) Tag(left+inset,top+height*.16f,$"BREATH  {Mathf.CeilToInt(player.Air):00} / 20");
            Tag(left+inset,top+height*.77f,$"HP  {player.Health:00} / 100");
            if(gear!=null && gear.Visible)
            {
                Tag(left+inset,top+height*.815f,$"{gear.Label}    {gear.Ammo:00} / {gear.Capacity:00}");
                var reserve=gear.Selected==1 ? "RESERVE" : "CARTS LEFT";
                Tag(left+inset,top+height*.86f,$"TOTAL {gear.Total:00}    {reserve} {gear.Reserve:00}");
                if(gear.Selected==2) Tag(left+inset,top+height*.905f,gear.Powered ? "M  MOTOR  ON" : "M  MOTOR  OFF");
            }
            var supply=player.Resupply;
            var caption=player.Paused ? "PLAYBACK PAUSED" : player.Rewinding ? "◀◀  REWIND" : supply!=null && supply.Active ?
                supply.Busy ? $"RESUPPLYING    {Mathf.FloorToInt(supply.Progress*100):00}%" :
                gear.Selected==1 ? "+12 MINICARS" : "+2 CARTRIDGES" : player.Prompt;
            if (!string.IsNullOrEmpty(caption))
            {
                var w=text.CalcSize(new GUIContent(caption)).x+22;
                Tag(left+width*.5f-w*.5f,top+height*.89f,caption);
            }
            var d=new Rect(left+width*.69f,top+height*.83f,width*.245f,height*.062f);
            Label(d,"AUG 18 '01",stamp);
            d.y+=height*.049f;
            Label(d,"PM 2:41",stamp);
            if (Cursor.lockState!=CursorLockMode.Locked)
            {
                const string controls="CLICK TO PLAY    WASD MOVE    1–3 EQUIP    R RELOAD    Z DIVE    F RANGE";
                var strip=text.CalcSize(new GUIContent(controls)).x+22;
                Tag(left+width*.5f-strip*.5f,top+height*.94f,controls);
            }
            if(gear==null || !gear.Visible || gear.Aiming || gear.Busy || player.Paused || player.Rewinding) {GUI.color=Color.white; return;}
            GUI.color=new Color(.99f,.99f,.87f,.67f);
            var x=left+width*.50f;
            var y=top+height*.50f;
            GUI.DrawTexture(new Rect(x-6,y,4,1),Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(x+3,y,4,1),Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(x,y-6,1,4),Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(x,y+3,1,4),Texture2D.whiteTexture);
            GUI.color=Color.white;
        }

        void Tag(float x,float y,string value)
        {
            var size=text.CalcSize(new GUIContent(value));
            var bg=new Rect(x,y,size.x+19,size.y+4);
            GUI.color=navy;
            GUI.DrawTexture(bg,Texture2D.whiteTexture);
            bg.x+=9;
            Label(bg,value,text);
        }

        static void Label(Rect rect,string value,GUIStyle style)
        {
            GUI.color=new Color(.035f,.04f,.053f,.91f);
            var shadow=rect; shadow.position+=new Vector2(1.5f,2);
            GUI.Label(shadow,value,style);
            GUI.color=Color.white;
            GUI.Label(rect,value,style);
        }
    }
}
