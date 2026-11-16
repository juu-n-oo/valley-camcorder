Shader "Hidden/Valley/Tape Signal"
{
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Name "DV tape signal"
            ZWrite Off
            ZTest Always
            Cull Off
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Tape
            #pragma target 3.5
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.core/Runtime/Utilities/Blit.hlsl"

            float4 _ValleyTapeSignal;
            float _ValleyBlastExposure;

            float Hash(float2 p)
            {
                float3 q=frac(float3(p.xyx)*.1031);
                q+=dot(q,q.yzx+33.33);
                return frac((q.x+q.y)*q.z);
            }

            float3 SampleSignal(float2 uv)
            {
                float3 color=SAMPLE_TEXTURE2D_X_LOD(_BlitTexture,sampler_LinearClamp,uv,0).rgb;
                #ifndef UNITY_COLORSPACE_GAMMA
                color=LinearToSRGB(saturate(color));
                #endif
                return color;
            }

            float4 Tape(Varyings input):SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(input);
                const float3 weights=float3(.299,.587,.114);
                float2 uv=input.texcoord;
                float frame=floor(_ValleyTapeSignal.x*29.97);
                float2 tape=max(1,min(_BlitTexture_TexelSize.zw,float2(650,436)));
                float2 viewUV=(uv-.5)/max(_ValleyTapeSignal.yz,.1)+.5;
                float scanline=floor(viewUV.y*tape.y);
                float jog=(Hash(float2(floor(scanline*.48),frame))-.5)*.40/tape.x;
                float track=smoothstep(.999,1,Hash(float2(floor(scanline*.31),floor(frame*.15))));
                float2 p=uv+float2(jog+track*.0025,0);
                float2 dx=float2(1/tape.x,0),dy=float2(0,.83/tape.y);
                float3 middle=SampleSignal(p);
                float3 left=SampleSignal(p-dx*1.24),right=SampleSignal(p+dx*1.24);
                float3 vertical=(SampleSignal(p+dy)+SampleSignal(p-dy))*.5;
                float3 signal=middle*.61+(left+right)*.147+vertical*.096;
                float3 colors=signal*.44+SampleSignal(p-dx*2.7+dy*.28)*.32+SampleSignal(p+dx*2.05)*.24;
                float luma=dot(signal,weights);
                float contrast=lerp(luma,smoothstep(.038,.929,luma),.39);
                float3 c=contrast+(colors-dot(colors,weights))*.91;
                float nearbyLight=dot(vertical*.60+(left+right)*.20,weights);
                c+=float3(.118,.105,.082)*max(nearbyLight-luma,0)*smoothstep(.69,.98,nearbyLight);
                c.r+=(right.r-left.r)*.073;
                c.b-=(right.b-left.b)*.077;
                c*=lerp(float3(.979,1.012,.982),float3(1.021,1.014,.995),smoothstep(.22,.60,luma));
                float fine=Hash(float2(floor(viewUV.x*tape.x),scanline)+float2(frame*7.17,frame*.37))-.5;
                float chroma=Hash(float2(floor(viewUV.x*tape.x*.44),floor(scanline*.5))+frame*.63)-.5;
                float raster=(fmod(scanline+fmod(frame,2),2)-.5)*.007;
                float vignette=1-.102*pow(length((viewUV-.5)*float2(1.20,1.09)),1.7);
                c+=fine*lerp(.026,.012,luma)+chroma*float3(.008,-.004,.010)+raster;
                c=saturate(lerp(c,float3(1,.928,.79),_ValleyBlastExposure*.73)*vignette);
                #ifndef UNITY_COLORSPACE_GAMMA
                c=SRGBToLinear(c);
                #endif
                return float4(c,1);
            }
            ENDHLSL
        }
    }
}
