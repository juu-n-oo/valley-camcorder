const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const project = path.resolve(__dirname, '..');
const context = vm.createContext({ atob });
for (const file of ['render.js', 'blender-models.js', 'blender-assets.js']) {
  vm.runInContext(readFileSync(path.join(project, file), 'utf8'), context, { filename: file });
}
const Valley = vm.runInContext('Valley', context);
const assets = Valley.blenderAssets;

test('Blender export has valid indices, separate materials and normalized finger weights', () => {
  for (const name of Object.keys(context.ValleyBlenderModels)) {
    for (const { slot, shape, weights } of assets.get(name).parts) {
      const count = shape.vertices.length / 11;
      assert.ok(slot && Number.isInteger(count) && count > 2, name);
      assert.equal(shape.indices.length % 3, 0, name);
      assert.ok(shape.indices.every(index => index < count), name);
      assert.ok(shape.vertices.every(Number.isFinite), name);
      if (!weights) continue;
      assert.equal(weights.length, count * 4, name);
      for (let i = 0; i < weights.length; i += 4) {
        const sum = weights[i] + weights[i+1] + weights[i+2] + weights[i+3];
        assert.ok(Math.abs(sum - 1) < 2e-6, name);
      }
    }
  }
  assert.deepEqual(Array.from(assets.get('range_body').parts, part => part.slot), ['paint', 'steel', 'plain']);
});

test('placed Blender geometry keeps outward normals and face winding under a mirrored scale', () => {
  const target = { vertices: [], indices: [] };
  const shape = {
    vertices: [
      0,0,0, 0,0,1, 0,0, 1,1,1,
      1,0,0, 0,0,1, 0,0, 1,1,1,
      0,1,0, 0,0,1, 0,0, 1,1,1
    ],
    indices: [0,1,2]
  };
  const matrix = Valley.transform([4,5,6]);
  matrix[0] = -2;
  matrix[5] = 3;
  assets.append(target, shape, matrix);
  assert.deepEqual(target.indices, [0,2,1]);
  assert.deepEqual(target.vertices.slice(0,3), [4,5,6]);
  assert.deepEqual(target.vertices.slice(11,14), [2,5,6]);
  assert.deepEqual(target.vertices.slice(22,25), [4,8,6]);
  assert.equal(target.vertices[5], 1);
});

test('finger flexion keeps its proximal and middle joint anchors in place', () => {
  const { pivots } = assets.get('finger_0');
  const rest = assets.fingerPalette(pivots, 0);
  const flexed = assets.fingerPalette(pivots, .45);
  const origin = Array.from(Valley.point(flexed.subarray(0,16), [0,0,0]));
  const middle = Valley.point(flexed.subarray(16,32), pivots[0]);
  assert.deepEqual(origin, [0,0,0]);
  assert.ok(Math.hypot(...Valley.minus(middle, pivots[0])) < 2e-7);
  assert.ok(flexed.subarray(32).some((value, index) => Math.abs(value - rest[32+index]) > .04));
});

test('Sonata lenses keep their front amber corner and separate red rear sections', () => {
  for (const side of ['left','right']) {
    const front = assets.get('sedan_lamp_front_' + side).parts.find(part => part.slot === 'carLens').shape.vertices;
    const rear = assets.get('sedan_lamp_rear_' + side).parts.find(part => part.slot === 'carLens').shape.vertices;
    let clear = 0, amber = 0, red = 0, misplaced = 0, reverse = 0, indicator = 0;
    for (let i = 0; i < front.length; i += 11) {
      const [r,g,b] = front.subarray(i+8,i+11);
      if (r > .49 && b > .56) clear++;
      if (r > .55 && g > .44 && b < .27) amber++;
    }
    let bottom=Infinity, top=-Infinity;
    for (let i = 1; i < rear.length; i += 11) {
      bottom=Math.min(bottom,rear[i]);
      top=Math.max(top,rear[i]);
    }
    for (let i = 0; i < rear.length; i += 11) {
      const height=(rear[i+1]-bottom)/(top-bottom);
      const [r,g,b] = rear.subarray(i+8,i+11);
      const isRed = r > .53 && g < .28 && b < .28;
      const isClear = r > .48 && b > .50;
      const isAmber = r > .55 && g > .42 && b < .27;
      if (height > .52) {
        if (isRed) red++;
        if (isClear || isAmber) misplaced++;
      }
      if (height < .23) {
        if (isClear) reverse++;
        if (isAmber) indicator++;
        if (isRed) misplaced++;
      }
    }
    assert.ok(clear > 100 && amber > 50, side);
    assert.ok(red > 100 && misplaced === 0, side);
    assert.ok(reverse > 30 && indicator > 50, side);
  }
});
