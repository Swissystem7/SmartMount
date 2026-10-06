const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../src/lib/control-params');
const { moveToAngle, PANEL_LIMITS, DEADBAND_DEG } = require('../src/lib/control');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

function slice(from, to) {
  const start = ino.indexOf(from);
  const end = ino.indexOf(to, start);
  assert.ok(start >= 0 && end > start, from + ' .. ' + to + ' must exist in that order');
  return ino.slice(start, end).replace(/\/\/[^\n]*/g, '');
}

// The stepper only knows whole steps. If targetAngle keeps the unquantised
// request, /status reports angle = steps / STEPS_PER_DEGREE next to a target
// the arm can never reach, so a client polling for angle == target waits
// forever. The board must store the step it actually commanded, converted
// back the same way syncAngleFromStepper() converts the position.
test('firmware moveToAngle: targetAngle is the commanded step, set after moveTo', () => {
  const body = slice('void moveToAngle(', 'void handleStatus()');
  assert.match(body, /targetAngle = stepper\.targetPosition\(\) \/ STEPS_PER_DEGREE;/);
  assert.doesNotMatch(body, /targetAngle\s*=\s*clamped/);
  assert.ok(
    body.indexOf('stepper.moveTo(steps)') < body.indexOf('targetAngle = stepper.targetPosition()'),
    'read the target back from the stepper after moveTo'
  );
  // currentAngle is derived with the very same expression, so the two agree.
  assert.match(ino, /currentAngle = stepper\.currentPosition\(\) \/ STEPS_PER_DEGREE;/);
  // handleStop already did this — three places, one convention.
  const stop = slice('void handleStop()', 'void setup()');
  assert.match(stop, /targetAngle = stepper\.targetPosition\(\) \/ STEPS_PER_DEGREE;/);
});

test('host moveToAngle.target is the rounded step back in degrees', () => {
  const r = moveToAngle(12.3, 'OLED');
  assert.equal(r.steps, 34);
  assert.equal(r.target, 34 / P.stepsPerDegree);
  assert.ok(Math.abs(r.target - 12.24) < 1e-9);
  // After the move the position is that same step, so angle == target exactly.
  const angleOnArrival = r.steps / P.stepsPerDegree;
  assert.equal(angleOnArrival, r.target);
});

test('quantisation error is under half a step and far inside the deadband', () => {
  const halfStep = 0.5 / P.stepsPerDegree;
  assert.ok(halfStep < DEADBAND_DEG / 2, 'a deadband narrower than a step would never settle');
  for (const panel of Object.keys(PANEL_LIMITS)) {
    for (let deg = -PANEL_LIMITS[panel] - 5; deg <= PANEL_LIMITS[panel] + 5; deg += 0.37) {
      const r = moveToAngle(deg, panel);
      assert.ok(Math.abs(r.target - r.clamped) <= halfStep + 1e-9, panel + ' ' + deg);
      // Re-issuing the reported target (what /set-panel does with
      // moveToAngle(targetAngle)) lands on the same step: no drift.
      assert.equal(moveToAngle(r.target, panel).steps, r.steps, panel + ' ' + deg);
    }
  }
});

test('the reported target at a panel limit is the nearest step, which may sit just past it', () => {
  // 20° * 2.777… = 55.56 → 56 steps → 20.16°. The arm has always gone there;
  // now /status says so instead of claiming exactly 20.
  const r = moveToAngle(99, 'LED');
  assert.equal(r.clamped, PANEL_LIMITS.LED);
  assert.equal(r.steps, 56);
  assert.ok(r.target > PANEL_LIMITS.LED && r.target - PANEL_LIMITS.LED < 0.5 / P.stepsPerDegree);
});
