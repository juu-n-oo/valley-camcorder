Shader "Valley/River"
{
    SubShader
    {
        Tags {"Queue"="Transparent-8" "RenderType"="Transparent" "RenderPipeline"="UniversalPipeline"}
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
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareDepthTexture.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/DeclareOpaqueTexture.hlsl"

            float4 _ValleyRipples[24];
            int _ValleyRippleCount;

            struct Attributes { float4 positionOS:POSITION; float2 uv:TEXCOORD0; };
            struct Varyings
            {
                float4 positionCS:SV_POSITION;
                float3 positionWS:TEXCOORD0;
                float bed:TEXCOORD1;
                half fog:TEXCOORD2;
            };
            Varyings Vert(Attributes v)
            {
                Varyings o;
                o.positionWS=TransformObjectToWorld(v.positionOS.xyz);
                o.positionCS=TransformWorldToHClip(o.positionWS);
                o.bed=v.uv.x;
                o.fog=ComputeFogFactor(o.positionCS.z);
                return o;
            }
            float Noise(float2 p)
            {
                float2 i=floor(p),v=frac(p);
                v=v*v*(3-2*v);
                float4 j=float4(0,1,57,58)+dot(i,float2(1,57));
                float4 h=frac(sin(j*2.263)*43758.5453123);
                return lerp(lerp(h.x,h.y,v.x),lerp(h.z,h.w,v.x),v.y);
            }
            half4 Frag(Varyings input):SV_Target
            {
                float3 p=input.positionWS;
                float2 uv=GetNormalizedScreenSpaceUV(input.positionCS);
                float2 q=p.xz;
                float t=_Time.y;
                float eddy=Noise(q*.63+float2(t*.018,t*.17));
                float main=sin(dot(q,float2(.91,-4.1))+t*1.51+eddy*4.1);
                float shortWave=sin(dot(q,float2(-1.48,-9.6))+t*3.62+main*.80+eddy*2.13);
                float chop=sin(dot(q,float2(3.41,-17.31))+t*5.62+eddy*3.3);
                float2 wake=0;
                float waterRings=0, trough=0, foam=0;
                float detail=1-smoothstep(.085,.31,max(length(ddx(q)),length(ddy(q))));
                [loop] for(int i=0;i<_ValleyRippleCount;i++)
                {
                    float4 ripple=_ValleyRipples[i];
                    float age=t-ripple.z;
                    if(age<0 || age>=3.8) continue;
                    float2 offset=q-ripple.xy;
                    float front=.11+age*(1.42+.71*min(ripple.w,1.6));
                    float foamRadius=.30+.48*ripple.w+age*.58;
                    if(max(abs(offset.x),abs(offset.y))>max(front+.44,foamRadius)) continue;
                    float radius=length(offset);
                    float rim=radius-front;
                    float width=lerp(.48,1.48,smoothstep(.22,1.18,ripple.w))+age*.11;
                    float packet=smoothstep(-width,-width*.32,rim)*(1-smoothstep(.08,.44,rim));
                    float power=packet*ripple.w*exp(-age*lerp(1.40,.66,saturate(ripple.w)))*(1-smoothstep(2.72,3.8,age));
                    float crest=cos((rim+.048*main+.031*shortWave)*lerp(21.5,13,smoothstep(.25,3.3,age)));
                    float2 outward=offset/max(.06,radius);
                    float light=clamp(.65+dot(outward,float2(-.22,.19))+.13*shortWave,.22,1);
                    float breaks=lerp(.35,1,smoothstep(-.54,.80,shortWave*.62+main*.73));
                    wake+=outward*power*(crest*.17*detail+sin(rim*5.8)*.15);
                    waterRings+=power*(.021+.45*detail*light*breaks*smoothstep(.35,.93,crest));
                    trough+=power*.27*detail*smoothstep(.21,.95,-crest);
                    if(age<1.19 && radius<foamRadius)
                    {
                        float bubbles=smoothstep(.40,1.13,ripple.w)*(1-smoothstep(.24,1.19,age));
                        float ring=cos((radius-foamRadius*.34-age*.13)*15+main*.61);
                        foam=max(foam,bubbles*(.35+.65*smoothstep(-.38,.97,ring))
                            *(1-smoothstep(foamRadius*.35,foamRadius,radius)));
                    }
                }
                wake=clamp(wake,-.30,.30);
                float3 normal=normalize(float3(main*.031+shortWave*.038+chop*.018+wake.x,1,
                    main*.097+shortWave*.066+chop*.024+wake.y));
                float3 view=GetWorldSpaceNormalizeViewDir(p);
                float depth=max(.005,-input.bed);
                float eye=-TransformWorldToView(p).z;
                float scene=LinearEyeDepth(SampleSceneDepth(uv),_ZBufferParams);
                float visibleDepth=min(depth,max(0,scene-eye));
                float refraction=.0025+.010*smoothstep(.018,.80,visibleDepth);
                float2 warped=clamp(uv+normal.xz*refraction,.001,.999);
                float distorted=LinearEyeDepth(SampleSceneDepth(warped),_ZBufferParams);
                float3 bottom=SampleSceneColor(distorted+0.013>eye ? warped : uv);
                float fresnel=.021+.85*pow(1-saturate(dot(normal,view)),4.5);
                float3 reflected=reflect(-view,normal);
                float sky=smoothstep(.03,.32,reflected.y);
                float haze=Noise(reflected.xz*7.8+reflected.y*3.7);
                half3 reflection=lerp(half3(.037,.077,.031)*( .70+.67*haze),half3(.48,.58,.52),sky);
                half3 water=lerp(half3(.28,.251,.116),half3(.046,.078,.027),smoothstep(.05,1.66,depth));
                water=lerp(bottom,water,1-exp(-visibleDepth*1.55));
                float3 lightDirection=GetMainLight().direction;
                float glint=pow(max(0,dot(normal,normalize(view+lightDirection))),108);
                float glints=smoothstep(.46,.94,shortWave*.61+main*.16+chop*.26)*pow(fresnel,.64);
                float shore=exp(-abs(input.bed+.018)*27)*smoothstep(.66,.90,Noise(q*7.1+t*.118));
                half3 result=lerp(water,reflection,fresnel);
                float bubbles=foam*smoothstep(.28,.78,Noise(q*12.3+float2(t*.72,-t*.53)));
                result*=1-min(.32,trough);
                result+=half3(.86,.89,.76)*(glint*.42+glints*.15+shore*.22+min(.76,waterRings)+bubbles*.69);
                if(view.y<0) result=lerp(half3(.05,.095,.039),reflection,.38)+glints*.22;
                float alpha=saturate(.68+fresnel*.48+visibleDepth*.28+waterRings*.48+bubbles*.29);
                return half4(MixFog(result,input.fog),alpha);
            }
            ENDHLSL
        }
    }
}
