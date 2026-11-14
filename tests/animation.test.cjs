const assert = require("node:assert/strict");
const test = require("node:test");

for (const script of ["render", "animation", "character", "character-gltf", "character-fixture"]) {
  require(`../${script}.js`);
}

const V = globalThis.Valley;
const A = V.animation;
const fakeRenderer = {mesh: (builder, material, tint, uv, skin) => ({builder, skin})};
const fixture = V.characterFixture.fixture(fakeRenderer);
const distance = (a, b) => Math.hypot(...V.minus(a, b));
const near = (actual, expected, error = 1e-5) => assert.ok(Math.abs(actual - expected) <= error, `${actual} ≈ ${expected}`);

test("bind transforms, clip interpolation, additive layers and animation events", () => {
  const {skeleton} = fixture;
  const bind = skeleton.palette(skeleton.globals(skeleton.rest));
  bind.forEach((n, i) => near(n, Number(i % 16 % 5 === 0)));

  const root = new A.Skeleton([{name: "root"}, {name: "child", parent: 0}]);
  const clip = new A.Clip("Move", [
    {bone: 0, path: "translation", times: [0, 1], values: [0, 0, 0, 1, 2, 3]},
    {bone: 1, path: "translation", times: [0, 1], values: [0, 0, 0, 0, 2, 0], interpolation: "STEP"}
  ], {events: [{time: .25, name: "contact"}]});
  const add = new A.Clip("Lift", [{bone: 0, path: "translation", times: [0], values: [0, 2, 0]}]);
  const mixer = new A.Mixer(root), buffer = root.rest.slice();
  const out = mixer.evaluate([
    {clip, time: .5, weight: .5},
    {clip: add, time: 0, weight: .25, mode: "additive", mask: [1, 0]}
  ], buffer);
  assert.deepEqual([...out.slice(0, 3)], [.25, 1, .75]);
  near(out[11], 0);
  const events = [];
  clip.emit(.15, 2.25, event => events.push(event.name));
  assert.deepEqual(events, ["contact", "contact", "contact"]);

  const rotation = A.rotation([0, 1, 0], .8);
  const cubic = new A.Clip("Rotate", [{bone: 0, path: "rotation", times: [0, 1], interpolation: "CUBICSPLINE",
    values: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, ...rotation, 0, 0, 0, 0]}]);
  mixer.evaluate([{clip, time: .5}, {clip: cubic, time: .5, mode: "override", mask: [1, 0]}], buffer);
  assert.deepEqual([...buffer.slice(0, 3)], [.5, 1, 1.5]);
  near(buffer[4], Math.sin(.2));
  near(Math.hypot(...buffer.slice(3, 7)), 1);
});

function glbFixture() {
  const binary = new Uint8Array(100);
  const view = new DataView(binary.buffer);
  const floats = (at, values) => values.forEach((v, i) => view.setFloat32(at + i * 4, v, true));
  floats(0, [-.35, -.30, 0, .35, -.30, 0, 0, .35, 0]);
  for (let i = 0; i < 3; i++) binary.set([0, 1, 0, 0, 191, 64, 0, 0], 36 + i * 8);
  floats(60, [0, 1]);
  binary[68] = 0;
  binary[69] = 1;
  floats(72, [0, .15, 0, 0, .35, 0]);
  binary.set([0, 1, 2], 96);
  const asset = {
    asset: {version: "2.0"}, scene: 0, scenes: [{nodes: [0, 3]}],
    nodes: [
      {name: "parent", children: [1], translation: [0, .10, 0]},
      {name: "root", children: [2]},
      {name: "hand", translation: [0, .15, 0]},
      {name: "mesh", mesh: 0, skin: 0, translation: [10, 0, 0]}
    ],
    meshes: [{primitives: [{attributes: {POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2}, indices: 5}]}],
    skins: [{joints: [1, 2]}], buffers: [{byteLength: binary.length}],
    bufferViews: [
      {buffer: 0, byteOffset: 0, byteLength: 36},
      {buffer: 0, byteOffset: 36, byteLength: 24, byteStride: 8},
      {buffer: 0, byteOffset: 60, byteLength: 8},
      {buffer: 0, byteOffset: 68, byteLength: 2},
      {buffer: 0, byteOffset: 72, byteLength: 24},
      {buffer: 0, byteOffset: 96, byteLength: 3}
    ],
    accessors: [
      {bufferView: 0, type: "VEC3", componentType: 5126, count: 3, min: [-.35, -.30, 0], max: [.35, .35, 0]},
      {bufferView: 1, type: "VEC4", componentType: 5121, count: 3},
      {bufferView: 1, byteOffset: 4, type: "VEC4", componentType: 5121, count: 3, normalized: true},
      {bufferView: 2, type: "SCALAR", componentType: 5126, count: 2, min: [0], max: [1]},
      {type: "VEC3", componentType: 5126, count: 2, sparse: {count: 2,
        indices: {bufferView: 3, componentType: 5121}, values: {bufferView: 4}}},
      {bufferView: 5, type: "SCALAR", componentType: 5121, count: 3}
    ],
    animations: [{name: "Lift", samplers: [{input: 3, output: 4}],
      channels: [{sampler: 0, target: {node: 2, path: "translation"}}]}]
  };
  const json = Buffer.from(JSON.stringify(asset));
  const size = (json.length + 3) & ~3;
  const glb = Buffer.alloc(28 + size + binary.length);
  [0x46546c67, 2, glb.length, size, 0x4e4f534a].forEach((n, i) => glb.writeUInt32LE(n, i * 4));
  glb.fill(0x20, 20, 20 + size);
  json.copy(glb, 20);
  glb.writeUInt32LE(binary.length, 20 + size);
  glb.writeUInt32LE(0x004e4942, 24 + size);
  glb.set(binary, 28 + size);
  return {glb, asset, binary};
}

test("glTF skin joint order, ancestor transform, interleaved weights and sparse animation", async () => {
  const {glb, asset, binary} = glbFixture();
  const {skeleton, meshes, clips} = await V.characterGLTF.load(fakeRenderer, glb, {loop: false});
  assert.deepEqual(meshes[0].skin.joints.slice(0, 4), [0, 1, 0, 0]);
  near(meshes[0].skin.weights[1], 64 / 255);
  const pose = new A.Pose(skeleton);
  clips.Lift.sample(.5, skeleton.rest, pose.local);
  pose.update();
  const palette = skeleton.palette(pose.world);
  near(palette[12], 0);
  near(palette[13], .1);
  near(palette[29], .35);
  asset.buffers[0].uri = "test.bin";
  let resolved;
  await V.characterGLTF.load(fakeRenderer, JSON.stringify(asset), {resolveBuffer: uri => {
    resolved = uri;
    return binary;
  }});
  assert.equal(resolved, "test.bin");
  await assert.rejects(V.characterGLTF.load(fakeRenderer, glb.subarray(0, -1)), /binary header/);
});

function forwardInput(t) {
  if (t < .9) return {at: [0, 0, 0], yaw: 0, velocity: [0, 0, 0]};
  if (t < 2.9) return {at: [0, 0, -(t - .9) * 1.38], yaw: 0, velocity: [0, 0, -1.38]};
  if (t < 4.9) return {at: [0, 0, -2 * 1.38 - (t - 2.9) * 3.35], yaw: 0, velocity: [0, 0, -3.35]};
  return {at: [0, 0, -9.46], yaw: V.clamp(t - 5.55, 0, 1.15) * 1.34, velocity: [0, 0, 0]};
}

test("idle, walk, run, stop, turn, tool grips and recovery at 30/60/120 FPS", t => {
  let stepCount;
  for (const hz of [30, 60, 120]) {
    const {skeleton, rig, clips, meshes} = fixture;
    const events = [], states = new Set();
    const actor = new V.Character(skeleton, rig, clips, {event: e => events.push(e)});
    const tool = V.characterFixture.carryObject(fakeRenderer, clips.Carry, rig);
    let grip = 0, slip = 0, impact = 0, recovered = 0;
    actor.reset(forwardInput(0));
    for (let frame = 1; frame <= hz * 8; frame++) {
      const time = frame / hz, input = forwardInput(time);
      if (frame === hz) actor.useTool(tool);
      if (frame === hz * 3) actor.toolImpulse({pitch: 2.3, roll: .55, slide: 1.7});
      if (frame === hz * 4) actor.impulse([1, .1, -.8]);
      actor.update(1 / hz, input);
      states.add(actor.state);
      const {model, pose, parts, grips, weight} = actor.render(meshes);
      assert.ok(parts[0].palette.every(Number.isFinite));
      near(distance(actor.frame.at, input.at), 0, 1e-6);
      for (const [i, [,,ankle]] of rig.legs.entries()) {
        const foot = actor.feet[i];
        if (foot.amount === 1 && foot.previousAmount === 1 && foot.anchor) {
          slip = Math.max(slip, distance(V.point(model, pose.at(ankle)), foot.anchor.at));
        }
      }
      if (parts.length === 2 && weight === 1) for (const [i, [shoulder, elbow, wrist]] of rig.arms.entries()) {
        grip = Math.max(grip, distance(V.point(model, pose.at(wrist)), grips[i].at));
        const upper = V.unit(V.minus(pose.at(elbow), pose.at(shoulder)));
        const lower = V.unit(V.minus(pose.at(wrist), pose.at(elbow)));
        assert.ok(Math.acos(V.clamp(V.dot(upper, lower), -1, 1)) < 2.65);
      }
      if (time > 4 && time < 4.4) impact = Math.max(impact, Math.hypot(...actor.response));
      if (time > 4.8 && time < 4.86) recovered = Math.hypot(...actor.response);
    }
    assert.deepEqual([...states], ["Idle", "Walk", "Run", "Stop", "Turn"]);
    assert.ok(events.length >= 10 && events.every(e => e.name === "footstep"));
    stepCount ??= events.length;
    assert.equal(events.length, stepCount);
    assert.ok(grip < .022 && slip < .005, `${hz}: grip ${grip}, slip ${slip}`);
    assert.ok(impact > .04 && recovered < .001);
    t.diagnostic(`${hz} FPS: grip ${grip.toFixed(4)} m, locked foot ${slip.toFixed(4)} m, ${events.length} steps`);
  }
});

test("sideways, backward and sprint animation selection on a sloped ground sample", () => {
  const {skeleton, rig, clips, meshes} = fixture;
  const actor = new V.Character(skeleton, rig, clips, {ground: (x, z) => ({y: .12 * x, normal: V.unit([-.12, 1, 0])})});
  for (const [velocity, state] of [[[1.54, 0, 0], "Strafe"], [[0, 0, 1.22], "Backward"], [[0, 0, -5.45], "Sprint"]]) {
    actor.reset({at: [0, 0, 0], yaw: 0, velocity});
    for (let i = 1; i <= 120; i++) {
      const x = velocity[0] * i / 120, z = velocity[2] * i / 120;
      actor.update(1 / 120, {at: [x, .12 * x, z], yaw: 0, velocity});
      const {pose, model, parts} = actor.render(meshes);
      assert.ok(parts[0].palette.every(Number.isFinite));
      for (const [side, chain] of rig.legs.entries()) {
        const [hip, knee, ankle] = chain.map(i => pose.at(i));
        const axis = V.unit(V.minus(ankle, hip)), upper = V.minus(knee, hip);
        const bend = V.minus(upper, V.times(axis, V.dot(axis, upper)));
        assert.ok(bend[2] < 0, "knee stays on the forward side of the leg");
        const foot = actor.feet[side];
        if (foot.amount === 1 && foot.previousAmount === 1 && foot.anchor) near(distance(V.point(model, ankle), foot.anchor.at), 0, .005);
      }
    }
    assert.equal(actor.state, state);
  }
});
