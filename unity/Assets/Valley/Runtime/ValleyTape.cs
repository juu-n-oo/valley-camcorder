using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace ValleyCamcorder
{
    public sealed class ValleyTape : MonoBehaviour
    {
        public Camera view;
        public ValleyPlayer player;
        public GameObject exterior;
        GUIStyle text,stamp,title,button;
        Font tapeFont;
        UniversalRenderPipelineAsset pipeline;
        float baseScale,measured,recovery;
        int slowFrames,frames,scaleLevel;
        static readonly float[] ScaleLevels={1,.89f,.78f,.68f,.58f};
        readonly Color navy = new(.048f,.035f,.41f,.88f);
        readonly Color paper=new(.99f,.99f,.88f,1);
        static readonly Color[] MiniCars={new(.94f,.83f,.56f),new(.96f,.68f,.27f),new(.80f,.35f,.23f),
            new(.70f,.76f,.73f),new(.44f,.70f,.67f),new(.66f,.43f,.65f)};
        static readonly string[] Controls=
        {
            "WASD MOVE","SHIFT RUN","SPACE JUMP","CTRL CROUCH","Z PRONE / DIVE","C INSPECT",
            "MOUSE LOOK","LMB FIRE","RMB AIM","1-3 EQUIP","R RELOAD / RESUPPLY","M PISTOL MOTOR",
            "H PICK UP / SET DOWN","E USE / SIT","T THROW","F RANGE / VALLEY","ESC PAUSE"
        };

        void LateUpdate()
        {
            var aspect=Screen.width/(float)Mathf.Max(1,Screen.height);
            const float tape=4f/3f;
            view.rect=aspect>tape ? new Rect((1-tape/aspect)*.5f,0,tape/aspect,1) :
                new Rect(0,(1-aspect/tape)*.5f,1,aspect/tape);
            if (exterior) exterior.SetActive(!player.InRange);
            SampleRenderTime();
        }

        void SampleRenderTime()
        {
            if(Application.isBatchMode || !player.PlaybackStarted || player.Paused) return;
            if(!pipeline)
            {
                pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
                if(!pipeline) return;
                baseScale=pipeline.renderScale;
            }
            var wall=Time.unscaledDeltaTime;
            if(wall<=0) return;
            measured+=Mathf.Min(wall,.15f);
            frames++;
            if(wall>.026f) slowFrames++;
            if(measured<1.5f || frames<5) return;
            var before=scaleLevel;
            var slower=slowFrames/(float)frames;
            if(slower>.35f)
            {
                scaleLevel=Mathf.Min(ScaleLevels.Length-1,scaleLevel+1);
                recovery=0;
            }
            else if(slower<.09f && measured/frames<.021f)
            {
                recovery+=measured;
                if(recovery>=6)
                {
                    scaleLevel=Mathf.Max(0,scaleLevel-1);
                    recovery=0;
                }
            }
            else recovery=0;
            if(before!=scaleLevel) pipeline.renderScale=baseScale*ScaleLevels[scaleLevel];
            frames=slowFrames=0;
            measured=0;
        }

        void OnDisable()
        {
            if(pipeline) pipeline.renderScale=baseScale;
            pipeline=null;
            frames=slowFrames=scaleLevel=0;
            measured=recovery=0;
        }

        void OnGUI()
        {
            if(!player || player.Equipment==null) return;
            var viewport=view.pixelRect;
            var frame=new Rect(viewport.xMin,Screen.height-viewport.yMax,viewport.width,viewport.height);
            float left=frame.xMin,top=frame.yMin,width=frame.width,height=frame.height;
            if (width<10 || height<10) return;
            Styles(height);
            Fill(new Rect(0,0,left,Screen.height),Color.black);
            Fill(new Rect(frame.xMax,0,Screen.width-frame.xMax,Screen.height),Color.black);
            Fill(new Rect(left,0,width,top),Color.black);
            Fill(new Rect(left,frame.yMax,width,Screen.height-frame.yMax),Color.black);
            if(player.Underwater || player.Paused || player.Rewinding)
                Fill(frame,player.Rewinding ? new Color(.095f,.042f,.51f,.92f) :
                    player.Paused ? new Color(.024f,.025f,.046f,.63f) : new Color(.13f,.38f,.26f,.18f));
            if(player.DamageTint>0 && !player.Rewinding)
                Fill(frame,new Color(.42f,.041f,.029f,player.DamageTint*.44f));
            Corners(frame);

            var seconds=Mathf.FloorToInt(player.TapeTime);
            var inset=height*.08f;
            var state=player.Rewinding ? "REW" : !player.PlaybackStarted ? "STBY" : player.Paused ? "PAUSE" : "REC";
            var pad=height*.013f;
            Tag(left+inset,top+height*.055f,$"   {state}  {seconds/3600:00}:{seconds/60%60:00}:{seconds%60:00}");
            var light=state=="REC" && seconds%2==0 ? new Color(.94f,.32f,.21f) : new Color(.63f,.56f,.79f);
            Fill(new Rect(left+inset+pad*.95f,top+height*.072f,pad*.76f,pad*.76f),light);
            var monitor=Tag(frame.xMax-inset-height*.115f,top+height*.055f,"SP      ");
            var battery=new Rect(monitor.xMax-height*.064f,monitor.y+monitor.height*.29f,height*.045f,monitor.height*.43f);
            Fill(battery,paper);
            Fill(new Rect(battery.x+1,battery.y+1,battery.width-2,battery.height-2),navy);
            for(int i=0;i<3;i++) Fill(new Rect(battery.x+2+i*battery.width*.29f,battery.y+2,battery.width*.22f,battery.height-4),paper);
            if(player.Paused)
            {
                Menu(frame);
                return;
            }

            Tag(left+inset,top+height*.103f,player.Location);
            RightTag(frame,top+height*.103f,"ESC  PAUSE");
            RightTag(frame,top+height*.147f,player.InRange ? "F  VALLEY" : "F  TARGET RANGE");
            var rangeSeconds=Mathf.FloorToInt(player.RangeTime);
            if(player.InRange)
            {
                var score=player.MarkedCount;
                Tag(left+inset,top+height*.153f,
                    $"{(score==player.targets.Length ? "RANGE COMPLETE" : "SCORE")}   {score:00}/{player.targets.Length:00}   {rangeSeconds/60:00}:{rangeSeconds%60:00}");
            }
            var gear=player.Equipment;
            if(player.Underwater)
            {
                var breath=Tag(left+inset,top+height*.705f,$"BREATH   {Mathf.CeilToInt(player.Air):00} / 20",pad);
                Meter(breath,player.Air/20,new Color(.63f,.86f,.95f));
            }
            var health=Tag(left+inset,top+height*.762f,$"HP        {player.Health:00} / 100",pad);
            Meter(health,player.Health/100f,new Color(1,.95f,.57f));
            if(gear.Visible)
            {
                var ammo=Tag(left+inset,top+height*.819f,$"{gear.Label}   {gear.Ammo:00} / {gear.Capacity:00}",pad);
                MiniCarStrip(ammo,gear,pad);
                Tag(left+inset,top+height*.877f,$"TOTAL {gear.Total:00}  {(gear.Selected==1 ? "RESERVE" : "CARTS LEFT")} {gear.Reserve:00}");
                if(gear.Selected==2) Tag(left+inset,top+height*.921f,gear.Powered ? "M  MOTOR  ON" : "M  MOTOR  OFF");
            }
            var supply=player.Resupply;
            var caption=player.Rewinding ? "<<  REWIND" : supply!=null && supply.Active ?
                supply.Busy ? $"RESUPPLYING    {Mathf.FloorToInt(supply.Progress*100):00}%" :
                gear.Selected==1 ? "+12 MINICARS" : "+2 CARTRIDGES" : player.Prompt;
            if (!string.IsNullOrEmpty(caption))
            {
                var progress=supply!=null && supply.Active ? supply.Progress : player.DoorProgress;
                var box=Tag(frame.center.x-TextWidth(caption)*.5f,top+height*.942f,caption,progress>0 ? pad : 0);
                if(progress>0) Meter(box,progress,new Color(.87f,.87f,.67f));
            }
            var d=new Rect(left+width*.69f,top+height*.817f,width*.245f,height*.057f);
            Label(d,"AUG 18 '01",stamp);
            d.y+=height*.051f;
            Label(d,TapeClock(seconds),stamp);
            if(gear.Visible && !gear.Aiming && !gear.Busy && !player.Rewinding && !player.Incapacitated)
                Reticle(frame.center,height);
        }

        internal static string TapeClock(int seconds)
        {
            var minute=14*60+41+seconds/60;
            var hour=minute/60%24;
            return $"{(hour<12 ? "AM" : "PM")} {(hour%12==0 ? 12 : hour%12)}:{minute%60:00}";
        }

        void Styles(float height)
        {
            if(text==null)
            {
                tapeFont=Resources.Load<Font>("ValleyTape/Tape");
                text=new GUIStyle(GUI.skin.label) {font=tapeFont,alignment=TextAnchor.MiddleLeft};
                stamp=new GUIStyle(text) {alignment=TextAnchor.MiddleRight};
                title=new GUIStyle(text);
                button=new GUIStyle(GUI.skin.button) {font=tapeFont};
            }
            text.normal.textColor=stamp.normal.textColor=title.normal.textColor=paper;
            text.fontSize=Mathf.Max(10,Mathf.RoundToInt(height*.022f));
            button.fontSize=Mathf.RoundToInt(height*.024f);
            stamp.fontSize=Mathf.RoundToInt(height*.040f);
            title.fontSize=Mathf.RoundToInt(height*.102f);
        }

        void Menu(Rect frame)
        {
            var x=frame.x+frame.width*.086f;
            var y=frame.y+frame.height*.193f;
            Tag(x,y,"FIELD TAPE 01");
            var heading=new Rect(x,y+frame.height*.058f,frame.width*.73f,frame.height*.251f);
            Fill(heading,navy);
            heading.x+=frame.width*.036f;
            Label(heading,"VALLEY\nCAMCORDER",title);
            Tag(x,y+frame.height*.340f,"HWAYANG VALLEY, AUGUST 18, 2001");
            var play=new Rect(x,y+frame.height*.405f,frame.width*.235f,frame.height*.068f);
            Fill(play,new Color(.18f,.105f,.72f,.98f));
            var resume=player.PlaybackStarted ? "RESUME" : "PLAY TAPE";
            if(GUI.Button(play,resume,button)) player.PlayTape(true);
            play.x+=play.width+frame.width*.021f;
            play.width=frame.width*.169f;
            Fill(play,navy);
            if(GUI.Button(play,"WINDOWED",button)) player.PlayTape(false);
            var legend=new Rect(x,y+frame.height*.521f,frame.width*.83f,frame.height*.232f);
            Fill(legend,navy);
            for(int i=0;i<Controls.Length;i++)
            {
                var cell=new Rect(legend.x+frame.width*.014f+i%3*legend.width/3,
                    legend.y+frame.height*.008f+i/3*legend.height/6,legend.width/3,legend.height/6);
                Label(cell,Controls[i],text);
            }
        }

        void Corners(Rect frame)
        {
            var inset=frame.height*.026f;
            var length=frame.height*.026f;
            var line=new Color(.92f,.91f,.72f,.62f);
            for(int i=0;i<4;i++)
            {
                var right=(i&1)!=0;
                var bottom=(i&2)!=0;
                var x=right ? frame.xMax-inset : frame.xMin+inset;
                var y=bottom ? frame.yMax-inset : frame.yMin+inset;
                Fill(new Rect(right ? x-length : x,y,length,1),line);
                Fill(new Rect(x,bottom ? y-length : y,1,length),line);
            }
        }

        void Reticle(Vector2 center,float height)
        {
            var radius=height*.026f;
            var pixel=Mathf.Max(1,height*.0018f);
            for(int i=-1;i<=1;i+=2)
            {
                var x=center.x+i*radius;
                Fill(new Rect(center.x+i*radius*.48f-pixel*2,center.y-pixel,pixel*4,pixel*2),paper);
                Fill(new Rect(center.x-pixel,center.y+i*radius*.48f-pixel*2,pixel*2,pixel*4),paper);
                for(int j=-1;j<=1;j+=2)
                {
                    var y=center.y+j*radius;
                    Fill(new Rect(i<0 ? x : x-radius*.38f,y,radius*.38f,pixel),paper);
                    Fill(new Rect(x,j<0 ? y : y-radius*.38f,pixel,radius*.38f),paper);
                }
            }
        }

        void RightTag(Rect frame,float y,string value)=>Tag(frame.xMax-frame.height*.08f-TextWidth(value),y,value);

        float TextWidth(string value)=>text.CalcSize(new GUIContent(value)).x+22;
        Rect Tag(float x,float y,string value,float extra=0)
        {
            var size=text.CalcSize(new GUIContent(value));
            var bg=new Rect(x,y,TextWidth(value),size.y+4+extra);
            Fill(bg,navy);
            Label(new Rect(x+9,y,bg.width-12,size.y+4),value,text);
            return bg;
        }

        static void Meter(Rect rect,float fill,Color colour)
        {
            var bar=new Rect(rect.x+8,rect.yMax-10,rect.width-16,6);
            Fill(bar,new Color(.18f,.15f,.24f));
            bar.width*=Mathf.Clamp01(fill);
            Fill(bar,colour);
        }

        static void MiniCarStrip(Rect rect,ValleyEquipment gear,float pad)
        {
            var w=(rect.width-16)/gear.Capacity;
            for(int i=0;i<gear.Capacity;i++)
            {
                var color=gear.SlotColor(i);
                var stripe=new Rect(rect.x+8+w*i,rect.yMax-pad*.73f,w-1,Mathf.Max(2,pad*.49f));
                Fill(stripe,color>=0 ? MiniCars[color%MiniCars.Length] : new Color(.21f,.18f,.37f));
            }
        }

        static void Fill(Rect rect,Color colour)
        {
            GUI.color=colour;
            GUI.DrawTexture(rect,Texture2D.whiteTexture);
            GUI.color=Color.white;
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
