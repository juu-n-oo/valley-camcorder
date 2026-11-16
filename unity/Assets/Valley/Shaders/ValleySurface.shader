Shader "Valley/Weathered Surface"
{
    Properties
    {
        _BaseMap("Albedo", 2D) = "white" {}
        _GroundCover("Leaf litter", 2D) = "white" {}
        _BaseColor("Tint", Color) = (1,1,1,1)
        _Kind("Surface class", Float) = 0
        _Opacity("Opacity", Range(0,1)) = 1
        _Smoothness("Smoothness", Range(0,1)) = .20
        _Metallic("Metallic", Range(0,1)) = 0
        _Cutoff("Cutout", Range(0,1)) = .43
        [HideInInspector] _FabricWind("Fabric wind", Vector) = (0,0,0,0)
        [HideInInspector] _FabricTouch("Fabric contact", Vector) = (0,0,0,-2)
        [HideInInspector] _FabricPush("Fabric contact direction", Vector) = (0,0,0,0)
        [HideInInspector] _Cull("Cull", Float) = 0
        [HideInInspector] _SrcBlend("Source blend", Float) = 1
        [HideInInspector] _DstBlend("Destination blend", Float) = 0
        [HideInInspector] _ZWrite("Depth write", Float) = 1
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" }
        Pass
        {
            Name "Weathered surface"
            Tags { "LightMode"="UniversalForward" }
            Blend [_SrcBlend] [_DstBlend]
            Cull [_Cull]
            ZWrite [_ZWrite]
            HLSLPROGRAM
            #pragma target 3.5
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #pragma multi_compile_instancing
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #pragma multi_compile _ _ADDITIONAL_LIGHTS
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            TEXTURE2D(_GroundCover); SAMPLER(sampler_GroundCover);
            CBUFFER_START(UnityPerMaterial)
                float4 _BaseColor;
                float4 _FabricWind, _FabricTouch, _FabricPush;
                float _Kind, _Opacity, _Smoothness, _Metallic, _Cutoff, _Cull, _SrcBlend, _DstBlend, _ZWrite;
            CBUFFER_END

            struct Attributes
            {
                float4 positionOS:POSITION;
                float3 normalOS:NORMAL;
                float2 uv:TEXCOORD0;
                float4 color:COLOR;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };
            struct Varyings
            {
                float4 positionCS:SV_POSITION;
                float3 positionWS:TEXCOORD0;
                half3 normalWS:TEXCOORD1;
                float2 uv:TEXCOORD2;
                half3 color:TEXCOORD3;
                half fog:TEXCOORD4;
            };

            Varyings Vert(Attributes input)
            {
                UNITY_SETUP_INSTANCE_ID(input);
                Varyings output;
                float3 local=input.positionOS.xyz;
                if (_FabricWind.x>0)
                {
                    float drape=saturate((local.y-_FabricWind.y)*_FabricWind.z);
                    float phase=dot(local.xz,float2(4.1,3.6))+_Time.y*3.7+_FabricWind.w;
                    local+=input.normalOS*_FabricWind.x*drape*(sin(phase)*.64+sin(phase*1.57)*.36);
                    float age=_Time.y-_FabricTouch.w;
                    float proximity=1-saturate(distance(input.positionOS.xyz,_FabricTouch.xyz)*5);
                    local+=_FabricPush.xyz*proximity*proximity*sin(age*22)*saturate(1-age*3.3);
                }
                output.positionWS=TransformObjectToWorld(local);
                if (_Kind==4)
                {
                    float w=sin(dot(output.positionWS.xz,float2(.11,.085))+_Time.y*1.15);
                    output.positionWS.xz+=float2(.148,.077)*w*input.uv.y*input.uv.y;
                }
                output.positionCS=TransformWorldToHClip(output.positionWS);
                output.normalWS=TransformObjectToWorldNormal(input.normalOS);
                output.uv=input.uv;
                output.color=SRGBToLinear(input.color.rgb);
                output.fog=ComputeFogFactor(output.positionCS.z);
                return output;
            }

            float Hash(float2 p)
            {
                float3 q=frac(float3(p.xyx)*.1031);
                q+=dot(q,q.yzx+33.33);
                return frac((q.x+q.y)*q.z);
            }

            float Noise(float2 p)
            {
                float2 i=floor(p),f=frac(p);
                f=f*f*(3-2*f);
                return lerp(lerp(Hash(i),Hash(i+float2(1,0)),f.x),
                            lerp(Hash(i+float2(0,1)),Hash(i+1),f.x),f.y);
            }

            half3 Stone(float3 p, half3 n)
            {
                half3 w=pow(abs(n),3);
                w/=max(.005,w.x+w.y+w.z);
                p.y+=p.x*.15-p.z*.092;
                return SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,p.zy*float2(.45,.29)).rgb*w.x+
                    SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,p.xz*.51).rgb*w.y+
                    SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,p.xy*float2(.45,.29)).rgb*w.z;
            }

            half4 Frag(Varyings input, FRONT_FACE_TYPE front:FRONT_FACE_SEMANTIC):SV_Target
            {
                float3 p=input.positionWS;
                half3 n=normalize(input.normalWS);
                float2 plane = abs(n.y)>.64 ? p.xz : float2(abs(n.x)>abs(n.z) ? -p.z : p.x,p.y);
                half3 albedo=input.color*_BaseColor.rgb;
                half rough=_Smoothness;
                half alpha=_Opacity;
                half3 emissions=0;
                half occlusion=1;
                float relief=0;
                if (_Kind==1)
                {
                    half3 gravel=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,p.xz*.76).rgb;
                    half3 litter=SAMPLE_TEXTURE2D(_GroundCover,sampler_GroundCover,p.xz*.83).rgb;
                    half stain=Noise(p.xz*.44);
                    half wet=1-smoothstep(-.17,.25,p.y);
                    albedo*=lerp(gravel,litter,saturate(input.uv.x))*lerp(.60,1.14,stain)*lerp(1,.64,wet);
                    rough=lerp(.22,.48,wet);
                    relief=dot(gravel,half3(.3,.59,.11))*.030;
                }
                else if (_Kind==2)
                {
                    half3 stone=Stone(p,n);
                    half moss=smoothstep(.56,.77,Noise(p.xz*.57+p.y*.233));
                    half wet=lerp(.38,1,smoothstep(-.15,.52,p.y));
                    albedo*=stone*lerp(half3(1.13,1.07,1.05),half3(.49,.64,.39),moss*.55)*wet;
                    relief=dot(stone,half3(.30,.58,.12))*.046;
                }
                else if (_Kind==4)
                {
                    half4 leaf=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,input.uv);
                    clip(leaf.a-_Cutoff);
                    n*=IS_FRONT_VFACE(front,1,-1);
                    albedo*=leaf.rgb*lerp(.66,1.13,input.uv.y);
                    emissions=albedo*.10;
                    occlusion=lerp(.63,1,input.uv.y);
                }
                else if (_Kind==3)
                {
                    half3 bark=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,float2(input.uv.x,p.y*.63)).rgb;
                    albedo*=bark;
                    relief=dot(bark,half3(.3,.57,.13))*.026;
                }
                else if (_Kind==17 || _Kind==18)
                {
                    float2 cell=_Kind==18 ? plane*float2(5.0,13.5) : input.uv*float2(7.1,9.4);
                    cell.x+=frac(floor(cell.y)*.5);
                    float2 edge=.5-abs(frac(cell)-.5);
                    float mortar=1-smoothstep(.023,.050+max(fwidth(cell.x),fwidth(cell.y))*.64,min(edge.x,edge.y));
                    half3 fired=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,plane*3.9).rgb;
                    albedo=lerp(albedo*(.52+fired*.76)*(.73+Hash(floor(cell))*.27),_Kind==18 ? half3(.15,.135,.111):half3(.17,.15,.12),mortar*.66);
                    relief=.002*(1-mortar);
                }
                else if (_Kind==21)
                {
                    float2 q=input.uv;
                    half currents=Noise(float2(q.x*64,q.y*13-_Time.y*8.4))*.53+Noise(float2(q.x*26,q.y*23-_Time.y*11))*.47;
                    half foam=smoothstep(.23,.84,currents);
                    if(q.y>1.16) clip((1-smoothstep(1.22,1.94,q.y))*foam-.075);
                    albedo=lerp(half3(.069,.115,.095),half3(.79,.85,.82),foam);
                    emissions=albedo*.20;
                }
                else if (_Kind==6 || _Kind==24 || _Kind==32 || _Kind==41)
                {
                    half grazing=pow(1-abs(dot(n,GetWorldSpaceNormalizeViewDir(p))),3);
                    alpha*=.26+grazing*.65;
                    albedo=lerp(albedo,half3(.44,.57,.58),grazing);
                }
                else if (_Kind==23) albedo*=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,input.uv).rgb;
                else if (_Kind==33)
                {
                    half3 frame=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,input.uv).rgb;
                    half scan=.87h+.13h*sin(input.uv.y*750);
                    albedo=frame*half3(.71h,.86h,.81h)*scan;
                }
                else if (_Kind==37)
                {
                    float2 sootUV=(input.uv-.5)*2;
                    float uneven=Noise(input.uv*16)*.30+Noise(input.uv*49)*.15;
                    alpha*=1-smoothstep(.20,.91,length(sootUV)+uneven);
                    albedo=half3(.020h,.017h,.014h)*(1+uneven);
                    rough=.09h;
                }
                else if (_Kind==10 || _Kind==11 || _Kind==12 || _Kind==16 || _Kind==7 || _Kind==14 ||
                         _Kind==13 || _Kind==19 || _Kind==20 || _Kind==22 || _Kind==25 || _Kind==26 ||
                         _Kind==27 || _Kind==28 || _Kind==35 || _Kind==36 || _Kind==42 || _Kind==43 || _Kind==46)
                {
                    float2 surfaceUV=(_Kind==13 || _Kind==26 || _Kind==42) ? plane*float2(2.8,.64) :
                        _Kind==19 || _Kind==20 || _Kind==22 || _Kind==25 || _Kind==27 ? plane*1.55 : input.uv;
                    half3 tex=SAMPLE_TEXTURE2D(_BaseMap,sampler_BaseMap,surfaceUV).rgb;
                    albedo*=.63+tex*.46;
                    relief=dot(tex,half3(.3,.59,.11))*.011;
                    if(_Kind==26 || _Kind==28 || _Kind==35 || _Kind==36)
                    {
                        float2 q=_Kind==26 ? input.uv*float2(6.9,1.35) : input.uv*4.8;
                        q.y+=_Kind==26 ? Hash(float2(floor(q.x),3)) : 0;
                        float2 edge=.5-abs(frac(q)-.5);
                        float joint=smoothstep(.016,.038,min(edge.x,edge.y));
                        albedo*=lerp(.74,1,joint);
                    }
                }

                if(relief>0)
                {
                    float3 dx=ddx(p),dy=ddy(p),a=cross(dy,n),b=cross(n,dx);
                    float determinant=dot(dx,a);
                    n=normalize(n-
                        sign(determinant)*(ddx(relief)*a+ddy(relief)*b)/max(abs(determinant),.0003));
                }

                InputData lighting=(InputData)0;
                lighting.positionWS=p;
                lighting.positionCS=input.positionCS;
                lighting.normalWS=n;
                lighting.viewDirectionWS=GetWorldSpaceNormalizeViewDir(p);
                lighting.shadowCoord=TransformWorldToShadowCoord(p);
                lighting.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(input.positionCS);
                lighting.bakedGI=SampleSH(n);
                lighting.shadowMask=half4(1,1,1,1);
                SurfaceData material=(SurfaceData)0;
                material.albedo=albedo;
                material.normalTS=half3(0,0,1);
                material.smoothness=rough;
                material.metallic=_Metallic;
                material.occlusion=occlusion;
                material.alpha=alpha;
                material.emission=emissions+(_Kind==30 || _Kind==33 ? albedo*.83 : 0);
                half4 color=UniversalFragmentPBR(lighting,material);
                return half4(MixFog(color.rgb,input.fog),alpha);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
    }
}
