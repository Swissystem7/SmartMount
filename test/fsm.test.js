const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../src/lib/fsm');
const { PANEL_LIMITS } = require('../src/lib/control');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

test('firmware .ino is still the implicit two-flag machine', () => {
  assert.match(ino, /stepper\.setCurrentPosition\(0\)/);
  assert.match(ino, /bool\s+autoMode/);
  assert.doesNotMatch(ino, /enum\s+\w*State/);
  assert.doesNotMatch(ino, /void\s+home\s*\(/);
  assert.doesNotMatch(ino, /esp_task_wdt/);
  assert.doesNotMatch(ino, /digitalRead\s*\(/);
  assert.doesNotMatch(ino, /pinMode\s*\(/);
});

test('firmware boot claims angle 0 and stays in RUN — no UNHOMED', () => {
  const s = F.firmwareBoot(false);
  assert.equal(s.state, 'RUN');
  assert.equal(s.believedAngle, 0);
  assert.equal(s.homed, false);
  assert.equal(s.autoMode, true);
  assert.equal(s.wifiUp, false);
  assert.match(s.reason, /setCurrentPosition\(0\)/);
});

test('firmware ignores HOME / STALL / CLEAR — those states do not exist', () => {
  const s = F.firmwareBoot(true);
  for (const type of ['HOME_START', 'HOME_FOUND', 'STALL', 'LIMIT', 'CLEAR']) {
    const n = F.step(s, { type });
    assert.equal(n.state, 'RUN', type);
    assert.equal(n.reject, 'no-such-state', type);
  }
});

test('firmware SAMPLE on a failed read holds instead of slamming', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SET_ANGLE', deg: 12 });
  s = F.step(s, { type: 'ARRIVE' });
  assert.equal(s.believedAngle, 12);
  s = F.step(s, { type: 'SET_MODE', auto: true });
  s = F.step(s, { type: 'SENSOR_FAIL' });
  s = F.step(s, { type: 'SAMPLE', luxTop: 9000, luxBot: 50 });
  assert.equal(s.believedAngle, 12);
  assert.equal(s.targetAngle, 12);
  assert.match(s.reason, /HOLD/);
});

test('firmware SAMPLE retargets from the lagging believed angle, even mid-move', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SAMPLE', luxTop: 800, luxBot: 80 });
  assert.equal(s.state, 'RUN');
  assert.ok(s.moving);
  const firstTarget = s.targetAngle;
  assert.ok(firstTarget > 0);
  s = F.step(s, { type: 'SAMPLE', luxTop: 100, luxBot: 100 });
  assert.equal(s.targetAngle, 0, 'a clear room mid-move retargets back to 0');
  assert.notEqual(s.targetAngle, firstTarget);
});

test('firmware set-angle turns auto off and clamps to the panel', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SET_ANGLE', deg: 99 });
  assert.equal(s.autoMode, false);
  assert.equal(s.targetAngle, PANEL_LIMITS.LED);
});

test('firmware boot mid-tilt: believed 0 + moveTo 15 drives mechanics past the lie', () => {
  let s = F.fresh('firmware', { mechanicalAngle: 12 });
  s = F.step(s, { type: 'BOOT_DONE', wifiOk: true });
  assert.equal(s.believedAngle, 0);
  assert.equal(s.mechanicalAngle, 12);
  s = F.step(s, { type: 'SET_ANGLE', deg: 15 });
  s = F.step(s, { type: 'ARRIVE' });
  assert.equal(s.believedAngle, 15);
  assert.equal(s.mechanicalAngle, 27);
});

test('firmware power loss without a worm drops; software stays RUN', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'POWER_LOSS' });
  assert.equal(s.dropped, true);
  assert.equal(s.state, 'RUN');
});

test('safe boot lands in UNHOMED and refuses to move', () => {
  let s = F.safeBoot(true, false);
  assert.equal(s.state, 'UNHOMED');
  assert.equal(s.homed, false);
  s = F.step(s, { type: 'SET_ANGLE', deg: 10 });
  assert.equal(s.state, 'UNHOMED');
  assert.equal(s.reject, 'unhomed');
  s = F.step(s, { type: 'SAMPLE', luxTop: 9000, luxBot: 40 });
  assert.equal(s.reject, 'unhomed');
  assert.equal(s.moving, false);
});

test('safe homing without an endstop is immediately FAULT_HOME', () => {
  let s = F.safeBoot(true, false);
  s = F.step(s, { type: 'HOME_START' });
  assert.equal(s.state, 'FAULT_HOME');
  assert.match(s.reason, /אין מפסק/);
});

test('safe homing with an endstop reaches IDLE_AUTO at a real zero', () => {
  let s = F.safeBoot(true, true);
  s = F.step(s, { type: 'HOME_START' });
  assert.equal(s.state, 'HOMING');
  s = F.step(s, { type: 'HOME_FOUND' });
  assert.equal(s.state, 'IDLE_AUTO');
  assert.equal(s.homed, true);
  assert.equal(s.believedAngle, 0);
  assert.equal(s.mechanicalAngle, 0);
});

test('safe homing times out into FAULT_HOME', () => {
  let s = F.safeBoot(true, true);
  s = F.step(s, { type: 'HOME_START' });
  s = F.step(s, { type: 'TICK', dtMs: s.homeTimeoutMs + 1 });
  assert.equal(s.state, 'FAULT_HOME');
});

test('safe sensor fail latches FAULT_SENSOR; SAMPLE is not a silent hold', () => {
  let s = F.applyAll(F.safeBoot(true, true), [
    { type: 'HOME_START' },
    { type: 'HOME_FOUND' },
    { type: 'SENSOR_FAIL' },
  ]);
  assert.equal(s.state, 'FAULT_SENSOR');
  s = F.step(s, { type: 'SENSOR_OK' });
  assert.equal(s.state, 'IDLE_AUTO');
});

test('safe MOVING ignores a small SAMPLE retarget and accepts a large one', () => {
  let s = F.applyAll(F.safeBoot(true, true), [
    { type: 'HOME_START' },
    { type: 'HOME_FOUND' },
    { type: 'SAMPLE', luxTop: 800, luxBot: 80 },
  ]);
  assert.equal(s.state, 'MOVING');
  const held = s.targetAngle;
  s = F.step(s, { type: 'SAMPLE', luxTop: 820, luxBot: 80 });
  assert.equal(s.state, 'MOVING');
  assert.ok(Math.abs(s.targetAngle - held) < 1e-9, 'small Δ must not retarget');
  s = F.step(s, { type: 'SAMPLE', luxTop: 100, luxBot: 100 });
  assert.equal(s.targetAngle, 0);
});

test('safe stall timeout trips when the move budget is exceeded', () => {
  let s = F.applyAll(F.safeBoot(true, true), [
    { type: 'HOME_START' },
    { type: 'HOME_FOUND' },
  ]);
  s.moveBudgetMs = 1000;
  s = F.step(s, { type: 'SET_ANGLE', deg: 12 });
  assert.equal(s.state, 'MOVING');
  s = F.step(s, { type: 'TICK', dtMs: 1600 });
  assert.equal(s.state, 'FAULT_STALL');
  s = F.step(s, { type: 'SET_ANGLE', deg: 0 });
  assert.equal(s.state, 'FAULT_STALL', 'fault is latched');
  s = F.step(s, { type: 'CLEAR' });
  assert.equal(s.state, 'UNHOMED');
});

test('safe power loss is DEAD; CLEAR returns to UNHOMED', () => {
  let s = F.applyAll(F.safeBoot(true, true), [
    { type: 'HOME_START' },
    { type: 'HOME_FOUND' },
    { type: 'POWER_LOSS' },
  ]);
  assert.equal(s.state, 'DEAD');
  assert.equal(s.dropped, true);
  s = F.step(s, { type: 'CLEAR' });
  assert.equal(s.state, 'UNHOMED');
  assert.equal(s.dropped, false);
});

test('the same SAMPLE after an unhomed boot is accepted by firmware and rejected by safe', () => {
  const ev = { type: 'SAMPLE', luxTop: 9000, luxBot: 40 };
  const fw = F.step(F.firmwareBoot(true), ev);
  const sf = F.step(F.safeBoot(true, false), ev);
  assert.ok(fw.moving);
  assert.equal(sf.moving, false);
  assert.equal(sf.reject, 'unhomed');
});

test('unknown events throw rather than being swallowed', () => {
  assert.throws(() => F.step(F.firmwareBoot(true), { type: 'EXPLODE' }), /unknown event/);
  assert.throws(() => F.step(F.firmwareBoot(true), {}), /event.type/);
});
