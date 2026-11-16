using UnityEngine;
using UnityEngine.Rendering.Universal;

namespace ValleyCamcorder
{
    public sealed class ValleyTapeSignal : FullScreenPassRendererFeature
    {
        public override void AddRenderPasses(ScriptableRenderer renderer,ref RenderingData data)
        {
            var camera=data.cameraData.camera;
            if(camera.cameraType!=CameraType.Game || !camera.TryGetComponent<ValleyTape>(out var tape) || !tape.player)
                return;
            var viewport=camera.rect;
            Shader.SetGlobalVector("_ValleyTapeSignal",new Vector4(tape.player.TapeTime,viewport.width,viewport.height,0));
            Shader.SetGlobalFloat("_ValleyBlastExposure",tape.player.BlastExposure);
            base.AddRenderPasses(renderer,ref data);
        }
    }
}
