const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../src/lib/optics');

test('a failed sensor read is unknown, not a quiet law beside a blinded eye', () => {
  // -1 is what a BH1750 returns on a failed read; the firmware holds, it does not settle at 0.
  assert.equal(O.disagreement({ luxTop: -1, luxBot: 80, highlight: 1200 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 40, luxBot: -1, highlight: 1200 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: NaN, luxBot: 80, highlight: 0 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 40, luxBot: Infinity, highlight: 0 }), 'unknown');
});

test('a non-finite threshold or content level is unknown, not a silent law or clear eye', () => {
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, threshold: NaN, highlight: 1200 }), 'unknown');
  assert.equal(O.disagreement({ luxTop: 800, luxBot: 80, highlight: 1200, contentNits: NaN }), 'unknown');
});

test('sampleScene with a non-numeric threshold reports unknown', () => {
  const scene = O.sampleScene({
    sourceNits: 20000, sourceAreaM2: 0.01, distanceTopM: 1, distanceBotM: 1.2,
    ambientTop: 40, ambientBot: 80, reflectance: O.GLOSSY_R, rayHitsEye: true,
    threshold: 'abc',
  });
  assert.equal(scene.kind, 'unknown');
});
