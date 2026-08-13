const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../src/lib/optics');

test('a tiny bright source barely moves lux but blinds if the ray hits the eye', () => {
  // 2 cm × 2 cm sun-glint at 2 m: I = 20000 × 0.0004 = 8 cd → +2 lx
  const scene = O.sampleScene({
    sourceNits: 20000,
    sourceAreaM2: 0.0004,
    distanceTopM: 2,
    distanceBotM: 2,
    ambientTop: 40,
    ambientBot: 80,
    reflectance: O.GLOSSY_R,
    rayHitsEye: true,
    botCoupling: 0.05,
  });
  assert.ok(scene.luxTop < 50, 'sensors stay near ambient');
  assert.ok(scene.ratio < O.DEFAULT_THRESHOLD, 'ratio stays under the firmware threshold');
  assert.ok(scene.highlight > 1000);
  assert.equal(scene.kind, 'blind-but-quiet');
});

test('the same source missing the eye is clear — sensors and viewer agree', () => {
  const scene = O.sampleScene({
    sourceNits: 20000,
    sourceAreaM2: 0.0004,
    distanceTopM: 2,
    distanceBotM: 2,
    ambientTop: 40,
    ambientBot: 80,
    reflectance: O.GLOSSY_R,
    rayHitsEye: false,
  });
  assert.equal(scene.highlight, 0);
  assert.equal(scene.kind, 'agrees-clear');
});

test('a large window raises both sensors and the law may tilt without a hot spot', () => {
  const scene = O.sampleScene({
    sourceNits: 4000,
    sourceAreaM2: 1.2,
    distanceTopM: 1.4,
    distanceBotM: 1.6,
    ambientTop: 80,
    ambientBot: 90,
    reflectance: O.MATTE_R,
    rayHitsEye: false,
    botCoupling: 0.02,
  });
  assert.ok(scene.luxTop > 1500);
  assert.equal(scene.highlight, 0);
  assert.equal(scene.kind, 'tilts-for-nothing');
});

test('glossy reflectance turns a 5000-nit window into a ~300-nit highlight', () => {
  assert.equal(O.highlightNits({
    sourceLuminanceNits: 5000,
    reflectance: O.GLOSSY_R,
    rayHitsEye: true,
  }), 300);
  assert.equal(O.highlightNits({
    sourceLuminanceNits: 5000,
    reflectance: O.GLOSSY_R,
    rayHitsEye: false,
  }), 0);
});

test('illuminance is inverse-square; luminance of the source is not', () => {
  const near = O.illuminanceLux({ ambientLux: 0, intensityCd: 8, distanceM: 1 });
  const far = O.illuminanceLux({ ambientLux: 0, intensityCd: 8, distanceM: 2 });
  assert.equal(near, 8);
  assert.equal(far, 2);
  // The viewer-facing highlight depends on source nits, not on 1/r² of the sensor.
  const hNear = O.highlightNits({ sourceLuminanceNits: 20000, reflectance: 0.06, rayHitsEye: true });
  const hFar = O.highlightNits({ sourceLuminanceNits: 20000, reflectance: 0.06, rayHitsEye: true });
  assert.equal(hNear, hFar);
});

test('disagreement labels are the four pedagogical cases', () => {
  assert.equal(O.disagreement({ luxTop: 40, luxBot: 80, highlight: 1200 }), 'blind-but-quiet');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0 }), 'tilts-for-nothing');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 1200 }), 'agrees-glare');
  assert.equal(O.disagreement({ luxTop: 40, luxBot: 80, highlight: 0 }), 'agrees-clear');
});
