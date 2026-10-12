const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/lib/torque');

test('sizeMount exposes maxMassKg from available hold torque and CoG lever arm', () => {
  const r = T.sizeMount({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: 0 });
  assert.equal(Math.round(r.maxMassKg * 1000) / 1000, 2.438);
});
