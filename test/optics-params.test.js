const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const O = require('../src/lib/optics');

const spec = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/control-params.json'), 'utf8')
);
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('optics threshold and lux floor are the firmware params, not a second copy of 3 and 1', () => {
  assert.equal(O.DEFAULT_THRESHOLD, spec.glareThreshold);
  assert.equal(O.MIN_LUX, spec.minLux);
  // sensorRatio floors the bottom sensor at minLux exactly like calcOptimalAngle
  assert.equal(O.sensorRatio(12, 0), 12 / spec.minLux);
  assert.equal(O.sensorRatio(12, spec.minLux * 4), 3);
  const src = read('src/lib/optics.js');
  assert.doesNotMatch(src, /DEFAULT_THRESHOLD = \d/);
  assert.doesNotMatch(src, /minLux = \d/);
});

test('sampleScene reports the shared threshold and the law moves right at it', () => {
  const t = spec.glareThreshold;
  const scene = O.sampleScene({
    sourceNits: 1, sourceAreaM2: 0, distanceTopM: 1, distanceBotM: 1,
    ambientTop: 100 * t + 1, ambientBot: 100, reflectance: 0, rayHitsEye: false,
  });
  assert.equal(scene.threshold, t);
  assert.equal(scene.kind, 'tilts-for-nothing');
  const quiet = O.sampleScene({
    sourceNits: 1, sourceAreaM2: 0, distanceTopM: 1, distanceBotM: 1,
    ambientTop: 100 * t, ambientBot: 100, reflectance: 0, rayHitsEye: false,
  });
  assert.equal(quiet.kind, 'agrees-clear');
});

test('in the browser optics.js reads CONTROL_PARAMS, so the page needs control-params.js first', () => {
  const ctx = vm.createContext({});
  ctx.globalThis = ctx;
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/optics.js'), ctx);
  assert.equal(ctx.SM_OPTICS.DEFAULT_THRESHOLD, spec.glareThreshold);
  assert.equal(ctx.SM_OPTICS.MIN_LUX, spec.minLux);
  const bare = vm.createContext({});
  bare.globalThis = bare;
  assert.throws(() => vm.runInContext(read('src/lib/optics.js'), bare), /glareThreshold|undefined/);
});

test('geometry page loads control-params.js before optics.js and does not hard-code the threshold', () => {
  const html = read('geometry/index.html');
  const params = html.indexOf('src/lib/control-params.js');
  const optics = html.indexOf('src/lib/optics.js');
  assert.ok(params !== -1, 'control-params.js not loaded');
  assert.ok(optics !== -1, 'optics.js not loaded');
  assert.ok(params < optics, 'control-params.js must come before optics.js');
  assert.equal(html.indexOf('< 3)'), -1, 'threshold hard-coded in the verdict text');
  assert.ok(html.indexOf('s.threshold') !== -1);
});
