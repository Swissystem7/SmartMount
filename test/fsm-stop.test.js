const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../src/lib/fsm');
const T = require('../src/lib/fsm-table');
const protocol = require('../src/lib/protocol');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

// STOP is the host event for POST /stop. The route exists on the board and in
// the protocol mirror; the FSM has to know it too, or the explorer and the
// matrix describe a firmware that has no emergency stop.
test('STOP is an FSM event, and the board + protocol mirror both serve /stop', () => {
  assert.ok(F.EVENTS.includes('STOP'));
  assert.match(ino, /server\.on\("\/stop",\s*HTTP_POST,\s*handleStop\)/);
  assert.ok(protocol.ROUTES.some((r) => r.path === '/stop' && r.method === 'POST'));
});

test('firmware STOP mid-move: auto off, target collapses onto the believed angle, move ends', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SAMPLE', luxTop: 800, luxBot: 80 });
  assert.ok(s.moving);
  assert.ok(s.targetAngle > 0);
  assert.equal(s.autoMode, true);

  s = F.step(s, { type: 'STOP' });
  assert.equal(s.state, 'RUN', 'the .ino has no other state to go to');
  assert.equal(s.reject, null);
  assert.equal(s.autoMode, false);
  assert.equal(s.moving, false);
  assert.equal(s.targetAngle, s.believedAngle);
  assert.match(s.reason, /stepper\.stop\(\)/);
});

test('firmware STOP is sticky: the next SAMPLE does not re-arm the move', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SAMPLE', luxTop: 800, luxBot: 80 });
  s = F.step(s, { type: 'STOP' });
  const held = s.targetAngle;
  s = F.step(s, { type: 'SAMPLE', luxTop: 9000, luxBot: 10 });
  assert.equal(s.moving, false);
  assert.equal(s.targetAngle, held);
  assert.match(s.reason, /ידני/);
  // Only an explicit set-mode auto=1 brings the law back.
  s = F.step(s, { type: 'SET_MODE', auto: true });
  s = F.step(s, { type: 'SAMPLE', luxTop: 9000, luxBot: 10 });
  assert.ok(s.moving);
});

test('firmware STOP while idle is a harmless no-op apart from leaving auto', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'STOP' });
  assert.equal(s.state, 'RUN');
  assert.equal(s.autoMode, false);
  assert.equal(s.moving, false);
  assert.equal(s.targetAngle, 0);
  assert.equal(s.believedAngle, 0);
});

test('firmware STOP in BOOT is swallowed like every other event', () => {
  const s = F.step(F.fresh('firmware'), { type: 'STOP' });
  assert.equal(s.state, 'BOOT');
  assert.equal(s.reject, null);
});

test('safe STOP from MOVING lands in IDLE_MANUAL and never resumes auto by itself', () => {
  let s = F.applyAll(F.safeBoot(true, true), [
    { type: 'HOME_START' },
    { type: 'HOME_FOUND' },
    { type: 'SAMPLE', luxTop: 800, luxBot: 80 },
  ]);
  assert.equal(s.state, 'MOVING');
  assert.equal(s.autoMode, true);

  s = F.step(s, { type: 'STOP' });
  assert.equal(s.state, 'IDLE_MANUAL');
  assert.equal(s.reject, null);
  assert.equal(s.autoMode, false);
  assert.equal(s.moving, false);
  assert.equal(s.targetAngle, s.believedAngle);
  assert.equal(s.lastIdle, 'IDLE_MANUAL');

  s = F.step(s, { type: 'SAMPLE', luxTop: 9000, luxBot: 10 });
  assert.equal(s.state, 'IDLE_MANUAL', 'SAMPLE in manual does not move');
  assert.equal(s.moving, false);
});

test('safe STOP from IDLE_AUTO leaves auto; from IDLE_MANUAL it stays', () => {
  const idle = F.applyAll(F.safeBoot(true, true), [
    { type: 'HOME_START' },
    { type: 'HOME_FOUND' },
  ]);
  assert.equal(idle.state, 'IDLE_AUTO');
  const stopped = F.step(idle, { type: 'STOP' });
  assert.equal(stopped.state, 'IDLE_MANUAL');
  assert.equal(stopped.autoMode, false);
  const again = F.step(stopped, { type: 'STOP' });
  assert.equal(again.state, 'IDLE_MANUAL');
  assert.equal(again.reject, null);
});

test('safe STOP mid-homing aborts to UNHOMED — the zero is still unknown', () => {
  let s = F.step(F.safeBoot(true, true), { type: 'HOME_START' });
  assert.equal(s.state, 'HOMING');
  s = F.step(s, { type: 'STOP' });
  assert.equal(s.state, 'UNHOMED');
  assert.equal(s.homed, false);
  assert.equal(s.moving, false);
  // and a set-angle is still refused until homing completes
  const r = F.step(s, { type: 'SET_ANGLE', deg: 12 });
  assert.equal(r.reject, 'unhomed');
});

test('safe STOP under FAULT_SENSOR: SENSOR_OK returns to IDLE_MANUAL, not IDLE_AUTO', () => {
  let s = F.applyAll(F.safeBoot(true, true), [
    { type: 'HOME_START' },
    { type: 'HOME_FOUND' },
    { type: 'SENSOR_FAIL' },
  ]);
  assert.equal(s.state, 'FAULT_SENSOR');
  assert.equal(s.lastIdle, 'IDLE_AUTO');
  s = F.step(s, { type: 'STOP' });
  assert.equal(s.state, 'FAULT_SENSOR');
  assert.equal(s.autoMode, false);
  s = F.step(s, { type: 'SENSOR_OK' });
  assert.equal(s.state, 'IDLE_MANUAL');
  assert.equal(s.autoMode, false);
});

test('safe STOP in latched faults, UNHOMED, BOOT and DEAD changes nothing', () => {
  for (const state of ['BOOT', 'UNHOMED', 'FAULT_HOME', 'FAULT_STALL', 'FAULT_LIMIT', 'DEAD']) {
    const before = T.canonical('safe', state);
    const after = F.step(before, { type: 'STOP' });
    assert.equal(after.state, state, state);
    assert.equal(after.reject, null, state);
    assert.equal(after.moving, false, state);
  }
});

test('the table says the same: STOP never rejects, and only HOMING / IDLE_AUTO / MOVING move', () => {
  for (const kind of ['firmware', 'safe']) {
    for (const state of T.statesOf(kind)) {
      const c = T.cell(kind, state, 'STOP');
      assert.equal(c.reject, null, kind + ' ' + state);
      const expected = kind === 'safe'
        ? ({ HOMING: 'UNHOMED', IDLE_AUTO: 'IDLE_MANUAL', MOVING: 'IDLE_MANUAL' }[state] || state)
        : state;
      assert.equal(c.next, expected, kind + ' ' + state);
    }
  }
  assert.ok(T.VARIANTS.some((v) => v.id === 'firmware-stop-mid-move'));
  assert.ok(T.VARIANTS.some((v) => v.id === 'moving-stop-lands-manual'));
});
