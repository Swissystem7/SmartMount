// torque.js models a screen whose centre of gravity sits in front of the
// pivot: τ = m·g·d·cos(θ), θ from vertical. Beyond ±90° cos(θ) is negative,
// requiredNm is negative and sizeMount() returned a verdict ('holds' before
// #35, 'cannot-hold' after) for a load the model does not describe. The spec/ slider
// stops at 40°, but the lib is also loaded by hand — the lib must refuse.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/lib/torque');

test('tilt past ±90° from vertical is rejected, not reported as negative torque', () => {
  assert.throws(
    () => T.gravityTorqueNm({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: 120 }),
    /tilt beyond/
  );
  assert.throws(
    () => T.gravityTorqueNm({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: -91 }),
    /tilt beyond/
  );
});

test('exactly ±90° is the horizontal edge of the domain and yields ~0 N·m', () => {
  const flat = T.gravityTorqueNm({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: 90 });
  assert.ok(Math.abs(flat) < 1e-12);
  const back = T.gravityTorqueNm({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: -90 });
  assert.ok(Math.abs(back) < 1e-12);
  // Tilting back toward the wall mirrors tilting forward: cos is even.
  const fwd = T.gravityTorqueNm({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: 30 });
  const rev = T.gravityTorqueNm({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: -30 });
  assert.ok(Math.abs(fwd - rev) < 1e-12);
});

test('sizeMount no longer turns a 55″ at 120° into a holds verdict', () => {
  // Before the guard: requiredNm < 0 → a verdict for a CoG behind the pivot.
  assert.throws(() =>
    T.sizeMount({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: 120 })
  );
  // Inside the domain the 55″ preset still fails on the firmware drivetrain.
  const r = T.sizeMount({ massKg: 18, cogOffsetM: 0.08, tiltFromVerticalDeg: 40 });
  assert.equal(r.powered, 'cannot-hold');
  assert.ok(r.requiredNm > 0);
});

test('verdict refuses NaN instead of falling through every comparison to holds', () => {
  assert.throws(() => T.verdict({ factor: NaN, selfLocking: true, unpowered: false }), /invalid verdict/);
  assert.throws(() => T.verdict({ factor: undefined, selfLocking: true, unpowered: false }), /invalid verdict/);
  assert.throws(() => T.verdict({ factor: '3', selfLocking: true, unpowered: false }), /invalid verdict/);
  // Infinity (a direct caller's huge factor) is a number and still holds.
  assert.equal(T.verdict({ factor: Infinity, selfLocking: true, unpowered: true }), 'holds');
  // Power loss without a worm is still reported before the factor matters.
  assert.equal(T.verdict({ factor: 5, selfLocking: false, unpowered: true }), 'drop-on-power-loss');
});
