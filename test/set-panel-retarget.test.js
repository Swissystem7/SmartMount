const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../src/lib/fsm');
const { PANEL_LIMITS } = require('../src/lib/control');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

// A panel change is a new ceiling, not a new destination. Re-clamping the
// *current* angle mid-move would call moveTo() on where the arm happens to
// be, cancelling the commanded move and turning the stepper around under
// load — the same hazard /stop avoids by using stepper.stop().
test('firmware handleSetPanel re-clamps targetAngle, never currentAngle', () => {
  const start = ino.indexOf('void handleSetPanel()');
  const end = ino.indexOf('void handleSetMode()');
  assert.ok(start > 0 && end > start, 'handleSetPanel must precede handleSetMode');
  // Strip // comments so the assertion is about code, not prose.
  const body = ino.slice(start, end).replace(/\/\/[^\n]*/g, '');
  assert.match(body, /moveToAngle\(targetAngle\);/);
  assert.doesNotMatch(body, /currentAngle/);
  assert.doesNotMatch(body, /stepper\.(moveTo|move|stop)\(/, 'goes through moveToAngle only');
});

test('fsm firmware model: mid-move set-panel keeps a target that still fits', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SET_PANEL', panel: 0 }); // OLED, ±40
  s = F.step(s, { type: 'SET_ANGLE', deg: 25 });
  assert.equal(s.targetAngle, 25);
  assert.equal(s.moving, true);
  s = F.step(s, { type: 'SET_PANEL', panel: 1 }); // QLED, ±30 — 25 still fits
  assert.equal(s.panel, 1);
  assert.equal(s.targetAngle, 25, 'target unchanged');
  assert.equal(s.moving, true, 'move continues');
  assert.equal(s.believedAngle, 0, 'arm was not re-targeted to where it is');
});

test('fsm firmware model: mid-move set-panel shortens a target past the new limit', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SET_PANEL', panel: 0 }); // OLED, ±40
  s = F.step(s, { type: 'SET_ANGLE', deg: 35 });
  s = F.step(s, { type: 'SET_PANEL', panel: 2 }); // LED, ±20
  assert.equal(s.targetAngle, PANEL_LIMITS.LED);
  assert.equal(s.moving, true);
  s = F.step(s, { type: 'ARRIVE' });
  assert.equal(s.believedAngle, PANEL_LIMITS.LED);
});

test('fsm firmware model: at rest beyond the new limit, set-panel pulls back to it', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SET_PANEL', panel: 0 });
  s = F.step(s, { type: 'SET_ANGLE', deg: 35 });
  s = F.step(s, { type: 'ARRIVE' });
  assert.equal(s.believedAngle, 35);
  s = F.step(s, { type: 'SET_PANEL', panel: 2 });
  assert.equal(s.targetAngle, PANEL_LIMITS.LED);
  assert.equal(s.moving, true);
});

test('fsm firmware model: set-panel at rest inside the new limit does not move', () => {
  let s = F.firmwareBoot(true);
  s = F.step(s, { type: 'SET_ANGLE', deg: 10 });
  s = F.step(s, { type: 'ARRIVE' });
  s = F.step(s, { type: 'SET_PANEL', panel: 0 });
  assert.equal(s.targetAngle, 10);
  assert.equal(s.moving, false);
});
