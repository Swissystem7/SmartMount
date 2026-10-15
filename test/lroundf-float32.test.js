const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const spec = require('../config/control-params.json');
const C = require('../src/lib/control');
const T = require('../src/lib/timing');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

// Independent emulation of the board's arithmetic, written from the .ino and
// not from control.js: clamped is a float, STEPS_PER_DEGREE is `const float`,
// float * float is a float, lroundf rounds half away from zero.
const K_F32 = Math.fround((spec.stepper.stepsPerRev * spec.stepper.gearRatio) / 360);
function boardLroundf(x) {
  const a = Math.abs(x);
  const r = Math.floor(a + 0.5);
  return x < 0 ? -r : r;
}
function boardSteps(deg) {
  return boardLroundf(Math.fround(Math.fround(deg) * K_F32));
}

test('firmware does the step arithmetic in float: const float STEPS_PER_DEGREE, lroundf on the product', () => {
  assert.match(ino, /const float STEPS_PER_DEGREE = \(STEPS_PER_REV \* GEAR_RATIO\) \/ 360\.0f;/);
  assert.match(ino, /const float STEPS_PER_REV = /);
  assert.match(ino, /const float GEAR_RATIO = /);
  assert.match(ino, /float clamped = constrain\(deg, -limit, limit\);/);
  assert.match(ino, /long steps = \(long\)lroundf\(clamped \* STEPS_PER_DEGREE\);/);
  // No double anywhere in the step path: no lround, no (double) on the product.
  assert.doesNotMatch(ino, /lround\(/);
  assert.doesNotMatch(ino, /\(double\)\s*clamped/);
});

test('lroundf rounds half away from zero; Math.round does not', () => {
  assert.equal(C.lroundf(-4.5), -5);
  assert.equal(Math.round(-4.5), -4, 'the JS builtin this replaces');
  assert.equal(C.lroundf(4.5), 5);
  assert.equal(C.lroundf(-0.5), -1);
  assert.equal(C.lroundf(0.5), 1);
  assert.equal(C.lroundf(-2.4), -2);
  assert.equal(C.lroundf(2.4), 2);
  assert.equal(C.lroundf(0), 0);
});

test('-1.62 degrees is -4.5 steps: the board commands -5, a Math.round mirror said -4', () => {
  assert.equal(C.moveToAngle(-1.62, 'OLED').steps, -5);
  assert.equal(C.moveToAngle(1.62, 'OLED').steps, 5, 'positive half was already right');
  assert.equal(Math.round(-1.62 * spec.stepper.stepsPerRev * spec.stepper.gearRatio / 360), -4,
    'documenting the old divergence');
});

test('0.9 degrees is 2.5 steps in double but 2.4999998 in float32: the board commands 2, not 3', () => {
  const kDouble = (spec.stepper.stepsPerRev * spec.stepper.gearRatio) / 360;
  assert.equal(Math.round(0.9 * kDouble), 3, 'documenting the old divergence');
  assert.ok(Math.fround(Math.fround(0.9) * K_F32) < 2.5);
  assert.equal(C.moveToAngle(0.9, 'OLED').steps, 2);
  assert.equal(C.moveToAngle(-0.9, 'OLED').steps, -2);
});

test('host steps equal the emulated board on every 0.01 degree across every panel', () => {
  let diverged = 0;
  for (const p of spec.panels) {
    for (let i = -(p.limitDeg * 100); i <= p.limitDeg * 100; i++) {
      const deg = i / 100;
      const host = C.moveToAngle(deg, p.id).steps;
      const board = boardSteps(deg);
      if (host !== board) diverged++;
      assert.equal(host, board, p.id + ' ' + deg);
      assert.equal(C.stepsFor(deg), board, 'stepsFor ' + deg);
    }
  }
  assert.equal(diverged, 0);
});

test('a Math.round double mirror disagrees with the board on about 1 in 80 requests', () => {
  const kDouble = (spec.stepper.stepsPerRev * spec.stepper.gearRatio) / 360;
  let diverged = 0;
  let total = 0;
  for (let i = -4000; i <= 4000; i++) {
    const deg = i / 100;
    total++;
    if (Math.round(deg * kDouble) !== boardSteps(deg)) diverged++;
  }
  assert.ok(diverged > 50, 'the divergence is real, not a rounding curiosity: ' + diverged);
  assert.ok(diverged < total / 40, 'but still a minority: ' + diverged + ' of ' + total);
});

test('target is the float32 the board stores, and re-issuing it lands on the same step', () => {
  assert.equal(C.STEPS_PER_DEGREE_F32, K_F32);
  for (const p of spec.panels) {
    for (let i = -(p.limitDeg * 100); i <= p.limitDeg * 100; i += 7) {
      const r = C.moveToAngle(i / 100, p.id);
      assert.equal(r.target, Math.fround(r.target), 'float32 target ' + i);
      assert.equal(r.target, Math.fround(r.steps / K_F32), 'long / float ' + i);
      // /set-panel does moveToAngle(targetAngle): the float32 round trip must
      // not drift, or every panel change would walk the arm one step.
      assert.equal(C.moveToAngle(r.target, p.id).steps, r.steps, 'no drift ' + i);
    }
  }
});

test('timing.stepsForDeg and moveProfile count the pulses the board will actually emit', () => {
  assert.equal(T.stepsForDeg(-1.62), 5);
  assert.equal(T.stepsForDeg(0.9), 2);
  assert.equal(T.stepsForDeg(-1.62), Math.abs(C.moveToAngle(-1.62, 'OLED').steps));
  // 0.9° → 1.62°: board steps 2 → 5, distance 3. Double rounding said 3 → 5 = 2.
  assert.equal(T.moveProfile({ fromDeg: 0.9, toDeg: 1.62 }).distanceSteps, 3);
  // -1.62° → 0°: board -5 → 0, distance 5. Double rounding said -4 → 0 = 4.
  assert.equal(T.moveProfile({ fromDeg: -1.62, toDeg: 0 }).distanceSteps, 5);
  for (let i = -2000; i <= 2000; i += 13) {
    const deg = i / 100;
    assert.equal(T.stepsForDeg(deg), Math.abs(boardSteps(deg)), 'stepsForDeg ' + deg);
  }
});
