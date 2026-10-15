

const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/lib/fsm');

test('angle error is tracked and exposed correctly', () => {
  // Test case (1): fresh firmware state with mechanicalAngle set to 15 should have angleErrorDeg === 15
  const freshState = F.fresh('firmware', { mechanicalAngle: 15 });
  assert.strictEqual(freshState.angleErrorDeg, 15);

  // Test case (2): sequence of steps ending with ARRIVE should compute angle error correctly
  let s = F.fresh('firmware', { mechanicalAngle: 15 });
  s = F.step(s, {type:'BOOT_DONE', wifiOk:true});
  s = F.step(s, {type:'SET_ANGLE', deg:15});
  s = F.step(s, {type:'ARRIVE'});
  assert.strictEqual(s.believedAngle, 15);
  assert.strictEqual(s.mechanicalAngle, 30);
  assert.strictEqual(s.angleErrorDeg, 15);

  // Test case (3): safe boot sequence should result in angleErrorDeg === 0 after homing
  let q = F.safeBoot(true, true);
  q.mechanicalAngle = 15;
  q = F.step(q, {type:'HOME_START'});
  q = F.step(q, {type:'HOME_FOUND'});
  assert.strictEqual(q.state, 'IDLE_AUTO');
  assert.strictEqual(q.angleErrorDeg, 0);

  // Test case (4): firmwareBoot should produce a state with angleErrorDeg as a number
  const firmwareBootState = F.firmwareBoot(true);
  assert.strictEqual(typeof firmwareBootState.angleErrorDeg, 'number');
});

test('computeAngleErrorDeg returns mechanicalAngle - believedAngle', () => {
  assert.strictEqual(F.computeAngleErrorDeg(10, 4), 6);
  assert.strictEqual(F.computeAngleErrorDeg(-5, 5), -10);
});

test('transitions that end in go() keep the computeAngleErrorDeg sign (regression for #111)', () => {
  // BOOT_DONE on the as-written firmware model ends in go(s, 'RUN', ...)
  let s = F.fresh('firmware', { mechanicalAngle: 15 });
  s = F.step(s, {type:'BOOT_DONE', wifiOk:true});
  assert.strictEqual(s.state, 'RUN');
  assert.strictEqual(s.angleErrorDeg, F.computeAngleErrorDeg(s.mechanicalAngle, s.believedAngle));
  assert.strictEqual(s.angleErrorDeg, 15);

  // HOME_START on the safe model ends in go(s, 'HOMING', ...)
  let q = F.safeBoot(true, true);
  q.mechanicalAngle = 15;
  q = F.step(q, {type:'HOME_START'});
  assert.strictEqual(q.state, 'HOMING');
  assert.strictEqual(q.angleErrorDeg, F.computeAngleErrorDeg(q.mechanicalAngle, q.believedAngle));
  assert.strictEqual(q.angleErrorDeg, 15);
});
