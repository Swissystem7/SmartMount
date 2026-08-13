const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/lib/torque');

test('32 kg at 8 cm, vertical, is ~25 N·m — far above a NEMA17', () => {
  const tau = T.gravityTorqueNm({ massKg: 32, cogOffsetM: 0.08, tiltFromVerticalDeg: 0 });
  assert.ok(Math.abs(tau - 32 * T.G * 0.08) < 1e-9);
  assert.ok(tau > 25);
  const hold = T.gearedHoldingNm({
    motorHoldingNm: T.NEMA17_HOLD_NM,
    gearRatio: T.DEFAULT_GEAR,
    efficiency: T.DEFAULT_EFFICIENCY,
  });
  assert.equal(hold, 0.45 * 5 * 0.85);
  assert.ok(T.safetyFactor(hold, tau) < 0.1);
});

test('firmware 1:5 + typical NEMA17 cannot hold a 55″ preset', () => {
  const p = T.PRESETS.find((x) => x.id === '55');
  const r = T.sizeMount({
    massKg: p.massKg,
    cogOffsetM: p.cogCm / 100,
    tiltFromVerticalDeg: 0,
  });
  assert.equal(r.powered, 'cannot-hold');
  assert.equal(r.unpowered, 'drop-on-power-loss');
});

test('a self-locking worm still drops the unpowered verdict only if it can hold', () => {
  const light = T.sizeMount({
    massKg: 2,
    cogOffsetM: 0.04,
    motorHoldingNm: 0.45,
    gearRatio: 40,
    efficiency: 0.5,
    selfLocking: true,
  });
  assert.ok(light.safetyFactor > 2);
  assert.equal(light.powered, 'holds');
  assert.equal(light.unpowered, 'holds');

  const heavy = T.sizeMount({
    massKg: 32,
    cogOffsetM: 0.08,
    motorHoldingNm: 0.45,
    gearRatio: 5,
    selfLocking: true,
  });
  assert.equal(heavy.powered, 'cannot-hold');
  assert.equal(heavy.unpowered, 'cannot-hold');
});

test('without a worm, unpowered is always drop — even if the motor could hold when energized', () => {
  const r = T.sizeMount({
    massKg: 1,
    cogOffsetM: 0.02,
    motorHoldingNm: 0.45,
    gearRatio: 5,
    selfLocking: false,
  });
  assert.equal(r.powered, 'holds');
  assert.equal(r.unpowered, 'drop-on-power-loss');
});

test('tilt toward horizontal shrinks the gravity moment by cos(θ)', () => {
  const upright = T.gravityTorqueNm({ massKg: 10, cogOffsetM: 0.1, tiltFromVerticalDeg: 0 });
  const tilted = T.gravityTorqueNm({ massKg: 10, cogOffsetM: 0.1, tiltFromVerticalDeg: 60 });
  assert.ok(Math.abs(tilted - upright * 0.5) < 1e-9);
});

test('bad inputs are rejected rather than returning NaN', () => {
  assert.throws(() => T.gravityTorqueNm({ massKg: -1, cogOffsetM: 0.1, tiltFromVerticalDeg: 0 }));
  assert.throws(() => T.gearedHoldingNm({ motorHoldingNm: 0.4, gearRatio: 0, efficiency: 0.8 }));
});
