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

test('disagreement returns unknown for non-finite highlight values', () => {
  assert.equal(O.disagreement({ luxTop: 40, luxBot: 80, highlight: NaN }), 'unknown');
});

// ── unknown, not a guess ───────────────────────────────────────────────────
// Round-2 backlog item 4. Master already returned 'unknown' for a non-finite
// highlight (commit 1cdee92). What it did not cover: the sensor half. A
// failed BH1750 read is a negative lux, and sensorRatio() turns that into
// null; the old code folded null into "the law is quiet", so an unreadable
// sensor pair was reported as agreement between the law and the viewer.
// These tests pin the whole domain, not just the half that was already fixed.

test('a failed or out-of-domain sensor pair is unknown, not agreement', () => {
  // Negative lux is the BH1750 failed-read signature.
  assert.equal(O.disagreement({ luxTop: -1, luxBot: 80, highlight: 0 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 40, luxBot: -2, highlight: 0 }), 'unknown');
  // ...and it must not become 'blind-but-quiet' just because the eye is hit.
  assert.equal(O.disagreement({ luxTop: -1, luxBot: 80, highlight: 1200 }), 'unknown');
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, 'x']) {
    assert.equal(
      O.disagreement({ luxTop: bad, luxBot: 80, highlight: 0 }), 'unknown',
      'luxTop ' + String(bad)
    );
    assert.equal(
      O.disagreement({ luxTop: 40, luxBot: bad, highlight: 0 }), 'unknown',
      'luxBot ' + String(bad)
    );
  }
});

test('an out-of-domain threshold or content luminance is unknown too', () => {
  // threshold <= 0 would make every reading glare; contentNits <= 0 would make
  // every highlight infinitely dominant. Neither is a classification.
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0, threshold: 0 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0, threshold: -1 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0, threshold: NaN }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0, contentNits: 0 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0, contentNits: NaN }), 'unknown');
  // A negative luminance is not a dim highlight, it is a broken input.
  assert.equal(O.disagreement({ luxTop: 40, luxBot: 80, highlight: -1 }), 'unknown');
});

test('the four real cases are untouched by the domain guards', () => {
  assert.equal(O.disagreement({ luxTop: 40, luxBot: 80, highlight: 1200 }), 'blind-but-quiet');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0 }), 'tilts-for-nothing');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 1200 }), 'agrees-glare');
  assert.equal(O.disagreement({ luxTop: 40, luxBot: 80, highlight: 0 }), 'agrees-clear');
  // luxBot 0 is in domain: the law clamps it to minLux rather than dividing
  // by zero, so this is a real 40x ratio, not an unknown.
  assert.equal(O.disagreement({ luxTop: 40, luxBot: 0, highlight: 0 }), 'tilts-for-nothing');
});

test('KINDS is the complete, frozen set every caller has to handle', () => {
  assert.deepEqual(O.KINDS, [
    'agrees-clear', 'agrees-glare', 'blind-but-quiet', 'tilts-for-nothing', 'unknown',
  ]);
  assert.equal(Object.isFrozen(O.KINDS), true);
  const seen = new Set([
    O.disagreement({ luxTop: 40, luxBot: 80, highlight: 0 }),
    O.disagreement({ luxTop: 800, luxBot: 80, highlight: 1200 }),
    O.disagreement({ luxTop: 40, luxBot: 80, highlight: 1200 }),
    O.disagreement({ luxTop: 800, luxBot: 80, highlight: 0 }),
    O.disagreement({ luxTop: -1, luxBot: 80, highlight: 0 }),
  ]);
  assert.deepEqual([...seen].sort(), [...O.KINDS]);
});

test('sampleScene rejects an out-of-domain scene instead of scoring it', () => {
  assert.throws(() => O.sampleScene({
    sourceNits: NaN, sourceAreaM2: 0.0004, distanceTopM: 2, distanceBotM: 2,
    ambientTop: 40, ambientBot: 80, reflectance: 0.06, rayHitsEye: true,
  }), /invalid source/);
  assert.throws(() => O.sampleScene({
    sourceNits: 20000, sourceAreaM2: 0.0004, distanceTopM: 0, distanceBotM: 2,
    ambientTop: 40, ambientBot: 80, reflectance: 0.06, rayHitsEye: true,
  }), /invalid illuminance inputs/);
  assert.throws(() => O.sampleScene({
    sourceNits: 20000, sourceAreaM2: 0.0004, distanceTopM: 2, distanceBotM: 2,
    ambientTop: 40, ambientBot: 80, reflectance: 1.4, rayHitsEye: true,
  }), /invalid highlight inputs/);
});
