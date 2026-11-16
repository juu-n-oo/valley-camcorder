Shader "Valley/Atmosphere"
{
    Properties
    {
        _Mode("Particle type", Float) = 0
        _Softness("Depth fade distance", Float) = 0.2
    }
    SubShader
    {
        Tags {"Queue"="Transparent" "RenderType"="Transparent" "RenderPipeline"="UniversalPipeline"}
        Pass
        {
            Tags {"LightMode"="UniversalForward"}
            Cull Off
            ZWrite Off
            Blend SrcAlpha OneMinusSrcAlpha

            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float _Mode;
                float _Softness;
            CBUFFER_END

            struct Attributes
            {
                float3 positionOS:POSITION;
                half4 color:COLOR;
                float2 uv:TEXCOORD0;
            };
            struct Varyings
            {
                float4 positionCS:SV_POSITION;
                float2 uv:TEXCOORD0;
                float3 world:TEXCOORD1;
                float depth:TEXCOORD2;
                half fog:TEXCOORD3;
                half4 color:COLOR;
            };
            Varyings Vert(Attributes v)
            {
                Varyings o;
                o.world=TransformObjectToWorld(v.positionOS);
                o.positionCS=TransformWorldToHClip(o.world);
                o.depth=-TransformWorldToView(o.world).z;
                o.fog=ComputeFogFactor(o.positionCS.z);
                o.uv=v.uv;
                o.color=v.color;
                return o;
            }
            float Noise(float2 p)
            {
                float2 cell=floor(p), g=frac(p);
                g=g*g*(3-2*g);
                float4 n=frac(sin(dot(cell,float2(11.81,35.13))+float4(0,11.81,35.13,46.94))*43758.54);
                return lerp(lerp(n.x,n.y,g.x),lerp(n.z,n.w,g.x),g.y);
            }
            half4 Frag(Varyings input):SV_Target
            {
                float2 uv=input.uv;
                float2 p=uv*2-1;
                float radial=length(p);
                float opacity=0;
                half3 color=input.color.rgb;
                if(_Mode<2.5)
                {
                    float2 q=p*3.5+input.world.xz*.31+float2(.0,-_Time.y*(_Mode<1.5 ? 3.9 : .36));
                    float curl=Noise(q*.71+float2(3.7,9.1));
                    float billow=.55*Noise(q+curl*.72)+.32*Noise(q*2.2)+.13*Noise(q*4.7);
                    float edge=radial+(.52-billow)*.77;
                    float bounds=1-smoothstep(.86,1,max(abs(p.x),abs(p.y)));
                    if(_Mode<.5)
                    {
                        float heat=(1-smoothstep(.06,.97,edge))*(.64+.55*curl);
                        opacity=(1-smoothstep(.32,1,edge))*(.71+.29*billow)*bounds;
                        color=lerp(half3(.84,.105,.013),half3(1.82,1.39,.63),smoothstep(.1,.81,heat));
                    }
                    else if(_Mode<1.5)
                    {
                        float spine=(curl-.5)*.59*uv.y;
                        float width=lerp(.84,.08,pow(uv.y,.82))*(.63+.68*billow);
                        float tongue=abs(p.x-spine)+(.47-billow)*.32;
                        float tip=.76+.22*curl;
                        opacity=(1-smoothstep(width*.52,width,tongue))*smoothstep(0,.18,uv.y)
                            *(1-smoothstep(tip-.17,tip,uv.y))*bounds;
                        float heat=(1-smoothstep(width*.06,width*.77,tongue))*(1-smoothstep(.22,.88,uv.y));
                        color=lerp(half3(.77,.068,.011),half3(1.76,1.20,.45),smoothstep(.03,.89,heat));
                    }
                    else
                    {
                        opacity=(1-smoothstep(.14,1,edge))*(.37+.63*billow)*bounds;
                        color*=.38+billow*.91+uv.y*.20;
                    }
                }
                else if(_Mode<3.5)
                {
                    float drop=length(float2(p.x/lerp(.67,1,smoothstep(-.83,.46,p.y)),p.y));
                    float light=1-smoothstep(.08,.57,length(p-float2(-.28,.26)));
                    opacity=(1-smoothstep(.57,1,drop))*(.48+.52*light);
                    color=lerp(color*.76,half3(.92,.98,1),.24+.70*light);
                }
                else if(_Mode<4.5)
                {
                    float mist=1-saturate(dot(p,p));
                    opacity=mist*mist;
                }
                else
                {
                    opacity=1-smoothstep(.07,.96,radial);
                    color=lerp(color*.76,half3(1.64,1.11,.43),opacity);
                }
                float2 screen=GetNormalizedScreenSpaceUV(input.positionCS);
                float scene=LinearEyeDepth(SampleSceneDepth(screen),_ZBufferParams);
                float fade=saturate((scene-input.depth)/_Softness);
                opacity*=input.color.a*fade;
                if(_Mode>2.5 && _Mode<4.5) opacity*=smoothstep(.14,.49,input.depth);
                clip(opacity-.006);
                return half4(MixFog(color,input.fog),opacity);
            }
            ENDHLSL
        }
    }
}
