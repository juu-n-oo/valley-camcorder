using System;
using System.IO;
using System.IO.Compression;
using UnityEditor.AssetImporters;
using UnityEngine;
using UnityEngine.Rendering;

namespace ValleyCamcorder.Editor
{
    [ScriptedImporter(2, "valleymesh")]
    public sealed class ValleyMeshImporter : ScriptedImporter
    {
        public override void OnImportAsset(AssetImportContext context)
        {
            using var file = File.OpenRead(context.assetPath);
            using var zip = new GZipStream(file, CompressionMode.Decompress);
            using var data = new BinaryReader(zip);
            if (new string(data.ReadChars(4)) != "VCM1") throw new InvalidDataException("Invalid Valley mesh header");
            var count = data.ReadInt32();
            if (count < 1 || count > 10000) throw new InvalidDataException("Invalid Valley mesh count");

            var index = new TextAsset(count.ToString()) { name = "Valley mesh bundle" };
            context.AddObjectToAsset("index", index);
            context.SetMainObject(index);
            for (var i = 0; i < count; i++)
            {
                int id = data.ReadInt32(), material = data.ReadInt32(), vertices = data.ReadInt32(),
                    indices = data.ReadInt32(), width = data.ReadInt32();
                if (id < 0 || vertices < 3 || vertices > 2000000 || indices < 3 || indices > 6000000 ||
                    indices % 3 != 0 || (width != 2 && width != 4))
                    throw new InvalidDataException("Invalid Valley mesh dimensions");

                var positions = new Vector3[vertices];
                var normals = new Vector3[vertices];
                var uv = new Vector2[vertices];
                var colors = new Color[vertices];
                for (var j = 0; j < vertices; j++)
                {
                    positions[j] = new Vector3(data.ReadSingle(), data.ReadSingle(), -data.ReadSingle());
                    normals[j] = new Vector3(data.ReadInt16(), data.ReadInt16(), -data.ReadInt16()).normalized;
                    uv[j] = new Vector2(data.ReadSingle(), data.ReadSingle());
                    colors[j] = new Color(data.ReadByte()/180f, data.ReadByte()/180f, data.ReadByte()/180f);
                }
                var triangles = new int[indices];
                for (var j = 0; j < indices; j++)
                {
                    var element = width == 2 ? data.ReadUInt16() : data.ReadInt32();
                    if (element < 0 || element >= vertices) throw new InvalidDataException("Valley index exceeds its vertex table");
                    triangles[j] = element;
                }
                // Keep the front-face normals and physics hits aligned after reflecting across Z.
                for (var j = 0; j < indices; j += 3)
                    (triangles[j + 1], triangles[j + 2]) = (triangles[j + 2], triangles[j + 1]);
                var mesh = new Mesh
                {
                    name = $"ValleyMesh-{id}-{material}",
                    indexFormat = vertices > 65535 ? IndexFormat.UInt32 : IndexFormat.UInt16,
                    vertices = positions, normals = normals, uv = uv, colors = colors
                };
                mesh.SetTriangles(triangles, 0, true);
                context.AddObjectToAsset("mesh-" + id, mesh);
            }
            if (zip.ReadByte() != -1) throw new InvalidDataException("Unexpected data after the Valley mesh table");
        }
    }
}
