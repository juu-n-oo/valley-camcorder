"""Export editable groups from the opened Blender library into the Unity project."""
import argparse
from pathlib import Path
import sys

import bpy


def export_group(name, filename):
    collection = bpy.data.collections.get(name)
    if collection is None:
        raise ValueError(f"Blender collection not found: {name}")
    objects = [obj for obj in collection.all_objects if obj.type in {"EMPTY","MESH","ARMATURE"}]
    if not any(obj.type == "MESH" for obj in objects):
        raise ValueError(f"Blender collection is empty: {name}")
    def layer_path(layer):
        if layer.collection == collection:
            return [layer]
        for child in layer.children:
            result = layer_path(child)
            if result:
                return [layer, *result]
        return []

    layers = layer_path(bpy.context.view_layer.layer_collection)
    states = [(layer,layer.exclude,layer.hide_viewport,layer.collection.hide_viewport) for layer in layers]
    for layer, *_ in states:
        layer.exclude = False
        layer.hide_viewport = False
        layer.collection.hide_viewport = False
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    hidden_states = []
    for obj in objects:
        hidden_states.append((obj,obj.hide_get(),obj.hide_viewport))
        obj.hide_viewport = False
        obj.hide_set(False)
        obj.select_set(True)
    origins = [(obj,obj.location.copy()) for obj in objects if obj.type=="EMPTY" and obj.parent not in objects]
    try:
        for obj, _ in origins:
            obj.location = (0,0,0)
        bpy.context.scene.frame_set(1)
        bpy.context.view_layer.update()
        bpy.ops.export_scene.fbx(filepath=str(filename), use_selection=True, axis_forward="-Z", axis_up="Y",
                                 add_leaf_bones=False, bake_anim=False, use_armature_deform_only=True,
                                 apply_unit_scale=True, apply_scale_options="FBX_SCALE_ALL", path_mode="STRIP")
    finally:
        for obj, location in origins:
            obj.location = location
        for obj, hide, viewport in hidden_states:
            obj.select_set(False)
            obj.hide_set(hide)
            obj.hide_viewport = viewport
        for layer, excluded, invisible, global_visibility in reversed(states):
            layer.collection.hide_viewport = global_visibility
            layer.hide_viewport = invisible
            layer.exclude = excluded


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--collection", action="append", metavar="NAME")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    root = Path(__file__).resolve().parents[1]
    destination = args.output or root/"unity"/"Assets"/"Valley"/"Blender"
    destination.mkdir(parents=True,exist_ok=True)
    for name in args.collection or ["Support Hand"]:
        filename = "".join(c for c in name if c.isalnum() or c in " _-").strip()
        if not filename:
            raise ValueError("A Blender collection name needs at least one letter or digit")
        export_group(name,destination/(filename+".fbx"))


if __name__ == "__main__":
    main()
