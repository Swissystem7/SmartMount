const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../src/lib/fsm');
const { PANEL_LIMITS, DEADBAND_DEG } = require('../src/lib/control');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

function slice(from, to) {
  const start = ino.indexOf(from);
  const end = ino.indexOf(to, start);
  assert.ok(start >= 0 && end > start, from + ' .. ' + to + ' must exist in that order');
  return ino.slice(start, end);
}

// The auto loop measures the deadband against the commanded target. Measured
// against currentAngle (which lags the target by up to the whole move) a
// sample inside the deadband rewrote targetAngle while the stepper kept its
// old goal, so /status lied and the next /set-panel re-issued the stale value
// and reversed the move that #40 had just protected.
test('firmware loop(): deadband is |next - targetAngle| and never rewrites targetAngle', () => {
  const body = slice('void loop()', '\n}');
  assert.match(body, /abs\(next - targetAngle\) > DEADBAND_DEG/);
  assert.doesNotMatch(body, /abs\(next - currentAngle\)/);
  assert.doesNotMatch(body, /targetAngle\s*=\s*next/);
});

// Hold must keep the commanded target. Returning currentAngle mid-move is
// more than a deadband away from targetAngle, so the loop would moveTo() the
// lagging position and turn the stepper around under load.
test('firmware calcOptimalAngle: a failed read returns targetAngle, not currentAngle', () => {
  const body = slice('float calcOptimalAngle(', 'void moveToAngle(');
  assert.match(body, /return targetAngle;/);
  assert.doesNotMatch(body, /return currentAngle;/);
});

// 800/80 -> ratio 10 -> 35 deg, clamped to the LED limit (20).
const SUN = { type: 'SAMPLE', luxTop: 800, luxBot: 80 };

function luxFor(deg) {
  // inverse of the law: deg = (ratio - 3) * 5 with luxBot = 100
  return { type: 'SAMPLE', luxTop: (deg / 5 + 3) * 100, luxBot: 100 };
}

test('fsm firmware model: a sample inside the deadband of the target leaves targetAngle alone', () => {
  let s = F.applyAll(F.firmwareBoot(true), [
    { type: 'SET_ANGLE', deg: 12 },
    { type: 'ARRIVE' },
    { type: 'SET_MODE', auto: true },
  ]);
  assert.equal(s.targetAngle, 12);
  s = F.step(s, luxFor(12 + DEADBAND_DEG / 2));
  assert.equal(s.targetAngle, 12, 'targetAngle must stay the stepper goal');
  assert.equal(s.moving, false);
});

test('fsm firmware model: mid-move, a sample inside the deadband of the target keeps the move', () => {
  let s = F.step(F.firmwareBoot(true), SUN);
  assert.equal(s.targetAngle, PANEL_LIMITS.LED);
  assert.ok(s.moving);
  s = F.step(s, luxFor(PANEL_LIMITS.LED - DEADBAND_DEG / 2));
  assert.equal(s.targetAngle, PANEL_LIMITS.LED, 'no retarget inside the deadband');
  assert.ok(s.moving, 'the move in flight continues');
  assert.equal(s.believedAngle, 0, 'position still lags - that is why the target must be the reference');
});

test('fsm firmware model: set-panel after an in-deadband sample re-clamps the real goal, not a stale one', () => {
  let s = F.step(F.firmwareBoot(true), SUN);
  s = F.step(s, luxFor(PANEL_LIMITS.LED - DEADBAND_DEG / 2));
  s = F.step(s, { type: 'SET_PANEL', panel: 0 }); // OLED, limit 40 - target still fits
  assert.equal(s.targetAngle, PANEL_LIMITS.LED, 'the goal the stepper is actually heading to');
  assert.ok(s.moving);
});

test('fsm firmware model: a clear room mid-move retargets even though the position lags', () => {
  let s = F.step(F.firmwareBoot(true), SUN);
  assert.equal(s.targetAngle, PANEL_LIMITS.LED);
  s = F.step(s, { type: 'SAMPLE', luxTop: 100, luxBot: 100 });
  assert.equal(s.targetAngle, 0, 'law says 0, |0 - 20| > deadband -> new moveTo');
});

test('fsm firmware model: sensor failure mid-move holds the commanded target', () => {
  let s = F.step(F.firmwareBoot(true), SUN);
  s = F.step(s, { type: 'SENSOR_FAIL' });
  s = F.step(s, { type: 'SAMPLE', luxTop: 9000, luxBot: 50 });
  assert.equal(s.targetAngle, PANEL_LIMITS.LED);
  assert.ok(s.moving, 'hold does not abandon the move');
  assert.match(s.reason, /HOLD/);
  s = F.step(s, { type: 'SAMPLE', luxTop: -1, luxBot: 80 });
  assert.equal(s.targetAngle, PANEL_LIMITS.LED);
  assert.match(s.reason, /HOLD/);
});
