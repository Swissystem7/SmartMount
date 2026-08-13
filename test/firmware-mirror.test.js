const test = require('node:test');
const assert = require('node:assert/strict');
const spec = require('../config/control-params.json');
const {
  calcOptimalAngle, glareRatio, shouldMove, clampToPanel,
  isScheduleActive, resolveAutoTarget,
  PANEL_LIMITS, GLARE_THRESHOLD, GAIN_DEG_PER_RATIO, DEADBAND_DEG,
} = require('../src/lib/control');

function at(day, hm) {
  const [h, m] = hm.split(':').map(Number);
  // 2026-08-09 is a Sunday (getDay() === 0)
  const d = new Date(2026, 7, 9 + day, h, m, 0, 0);
  return d;
}

test('JSON threshold is the one the law uses', () => {
  assert.equal(GLARE_THRESHOLD, spec.glareThreshold);
  const luxBot = 100;
  assert.equal(calcOptimalAngle(spec.glareThreshold * luxBot, luxBot), 0);
  const justOver = calcOptimalAngle((spec.glareThreshold + 0.2) * luxBot, luxBot);
  assert.ok(justOver > 0);
  assert.ok(Math.abs(justOver - 0.2 * spec.gainDegPerRatio) < 1e-9);
});

test('gain comes from the JSON, not a magic 5', () => {
  assert.equal(GAIN_DEG_PER_RATIO, spec.gainDegPerRatio);
  const luxBot = 100;
  const ratio = spec.glareThreshold + 2;
  assert.equal(
    calcOptimalAngle(ratio * luxBot, luxBot, 'OLED'),
    2 * spec.gainDegPerRatio
  );
});

test('hysteresis: deadband matches JSON and blocks sub-degree chatter', () => {
  assert.equal(DEADBAND_DEG, spec.deadbandDeg);
  const settled = 10;
  assert.equal(shouldMove(settled, settled + spec.deadbandDeg), false);
  assert.ok(shouldMove(settled, settled + spec.deadbandDeg + 0.01));
});

test('panel clamp uses JSON limits on both sides', () => {
  for (const p of spec.panels) {
    assert.equal(clampToPanel(999, p.id), p.limitDeg);
    assert.equal(clampToPanel(-999, p.id), -p.limitDeg);
    assert.equal(calcOptimalAngle(1e9, 1, p.id), p.limitDeg);
  }
});

test('sensor failure holds the current angle instead of slamming to the limit', () => {
  const held = 12.5;
  assert.equal(calcOptimalAngle(-1, 80, 'OLED', held), held);
  assert.equal(calcOptimalAngle(900, -2, 'LED', held), held);
  assert.equal(calcOptimalAngle(NaN, 80, 'QLED', held), held);
  assert.equal(glareRatio(-1, 80), null);
  assert.notEqual(held, PANEL_LIMITS.OLED);
});

test('failed-read default (no currentAngle passed) is 0 — same as rest', () => {
  assert.equal(calcOptimalAngle(-1, 100), 0);
});

test('schedule window uses JS weekday + inclusive clock range', () => {
  const windows = [{ day: 4, from: '14:00', to: '17:00' }];
  assert.equal(isScheduleActive(windows, at(4, '14:00')), true);
  assert.equal(isScheduleActive(windows, at(4, '16:30')), true);
  assert.equal(isScheduleActive(windows, at(4, '17:00')), true);
  assert.equal(isScheduleActive(windows, at(4, '13:59')), false);
  assert.equal(isScheduleActive(windows, at(4, '17:01')), false);
  assert.equal(isScheduleActive(windows, at(3, '15:00')), false);
});

test('an inverted schedule window never activates', () => {
  assert.equal(isScheduleActive([{ day: 0, from: '17:00', to: '14:00' }], at(0, '15:00')), false);
});

test('scheduled hours target the panel limit, not the glare law', () => {
  const now = at(4, '15:00');
  const windows = [{ day: 4, from: '14:00', to: '17:00' }];
  // Dim room — glare law would be 0, schedule still goes to the cap.
  assert.equal(
    resolveAutoTarget({ schedules: windows, now, panel: 'LED', luxTop: 50, luxBot: 50 }),
    PANEL_LIMITS.LED
  );
  assert.equal(
    resolveAutoTarget({ schedules: windows, now, panel: 'OLED', luxTop: 50, luxBot: 50 }),
    PANEL_LIMITS.OLED
  );
});

test('outside the window the glare law runs, including hold-on-fail', () => {
  const now = at(4, '10:00');
  const windows = [{ day: 4, from: '14:00', to: '17:00' }];
  assert.equal(
    resolveAutoTarget({ schedules: windows, now, panel: 'LED', luxTop: 100, luxBot: 100 }),
    0
  );
  assert.equal(
    resolveAutoTarget({
      schedules: windows, now, panel: 'LED',
      luxTop: -1, luxBot: 40, currentAngle: 7,
    }),
    7
  );
});

test('empty schedule list is never active', () => {
  assert.equal(isScheduleActive([], at(4, '15:00')), false);
  assert.equal(isScheduleActive(undefined, at(4, '15:00')), false);
});
