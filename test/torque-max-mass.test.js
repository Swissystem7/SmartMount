const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/lib/torque');

test('55″ preset exposes maxMassKg the NEMA17 + 1:5 stack can hold at the CoG offset', () => {
  const r = T.sizeMount({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: 0 });

  assert.equal(Math.round(r.maxMassKg * 1000) / 1000, 2.438);
  assert.equal(r.powered, 'cannot-hold');

  assert.equal(r.requiredNm, 14.121576000000001);
  assert.equal(r.availableNm, 1.9124999999999999);
  assert.equal(r.safetyFactor, 0.13543105953613108);
  assert.equal(r.unpowered, 'drop-on-power-loss');
  assert.equal(r.selfLocking, false);
});

test('maxMassKg is Infinity when cogOffsetM × cos(tilt) is zero', () => {
  const r = T.sizeMount({ massKg: 5, cogOffsetM: 0, tiltFromVerticalDeg: 0 });
  assert.equal(r.maxMassKg, Infinity);
});
