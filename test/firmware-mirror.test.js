const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const spec = require('../config/control-params.json');
const {
  calcOptimalAngle, glareRatio, shouldMove, clampToPanel, moveToAngle,
  PANEL_LIMITS, GLARE_THRESHOLD, GAIN_DEG_PER_RATIO, DEADBAND_DEG,
} = require('../src/lib/control');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');
const controlJs = fs.readFileSync(path.join(__dirname, '../src/lib/control.js'), 'utf8');

function firmwareFormula(luxTop, luxBot, panelLimit, currentAngle) {
  if (!Number.isFinite(luxTop) || !Number.isFinite(luxBot) || luxTop < 0 || luxBot < 0) {
    return currentAngle;
  }
  const glareRatio = luxTop / Math.max(luxBot, spec.minLux);
  let angle = 0;
  if (glareRatio > spec.glareThreshold) {
    angle = Math.min((glareRatio - spec.glareThreshold) * spec.gainDegPerRatio, panelLimit);
  }
  return angle;
}

test('firmware still contains the generated control-params block', () => {
  assert.match(ino, />>> BEGIN GENERATED control-params/);
  assert.match(ino, /<<< END GENERATED control-params/);
  const limits = (ino.match(/PANEL_LIMITS\[\] = \{([^}]*)\}/) || [])[1];
  assert.deepEqual(
    limits.split(',').map((s) => parseFloat(s.trim())),
    spec.panels.map((p) => p.limitDeg)
  );
  assert.match(ino, new RegExp('GLARE_THRESHOLD = ' + spec.glareThreshold));
  assert.match(ino, new RegExp('GAIN_DEG_PER_RATIO = ' + spec.gainDegPerRatio));
  assert.match(ino, new RegExp('MIN_LUX = ' + spec.minLux));
  assert.match(ino, new RegExp('DEADBAND_DEG = ' + spec.deadbandDeg));
});

test('failed BH1750 read returns currentAngle — the hold, not a slam', () => {
  assert.match(ino, /luxTop < 0\.0f \|\| luxBot < 0\.0f/);
  assert.match(ino, /return currentAngle/);
  assert.match(ino, /isnan\(luxTop\) \|\| isnan\(luxBot\)/);
  assert.match(ino, /isinf\(luxTop\) \|\| isinf\(luxBot\)/);
  const held = 12.5;
  assert.equal(calcOptimalAngle(-1, 80, 'OLED', held), held);
  assert.equal(calcOptimalAngle(900, -2, 'LED', held), held);
  assert.equal(calcOptimalAngle(NaN, 80, 'QLED', held), held);
  assert.equal(glareRatio(-1, 80), null);
});

test('moveToAngle is absolute moveTo from tracked zero, not relative move', () => {
  assert.match(ino, /stepper\.moveTo\(steps\)/);
  assert.doesNotMatch(ino, /stepper\.move\s*\(/);
  assert.match(ino, /void syncAngleFromStepper/);
  assert.match(ino, /stepper\.run\(\);\s*syncAngleFromStepper\(\)/s);
  assert.doesNotMatch(ino, /currentAngle\s*=\s*clamped/);
  const led = moveToAngle(99, 'LED');
  assert.equal(led.clamped, spec.panels.find((p) => p.id === 'LED').limitDeg);
  assert.equal(led.steps, Math.round(led.clamped * spec.stepper.stepsPerRev * spec.stepper.gearRatio / 360));
});

test('WiFi setup times out and continues local auto; no schedule or cloud in the .ino', () => {
  assert.match(ino, /WIFI_CONNECT_TIMEOUT_MS = 10000/);
  assert.match(ino, /WiFi timeout — continuing in local auto mode/);
  assert.doesNotMatch(ino, /schedule|cloud|Stripe|login/i);
  assert.doesNotMatch(controlJs, /isScheduleActive|resolveAutoTarget/);
});

test('host calcOptimalAngle matches the firmware formula on a grid of inputs', () => {
  const samples = [
    [0, 0], [50, 50], [300, 300], [100, 900],
    [301, 100], [400, 100], [700, 100], [1e6, 1],
    [-1, 80], [80, -1], [NaN, 40], [40, Infinity],
    [3 * 100, 100], [3.2 * 100, 100],
  ];
  for (const p of spec.panels) {
    for (const [top, bot] of samples) {
      const held = 7;
      const host = calcOptimalAngle(top, bot, p.id, held);
      const fw = firmwareFormula(top, bot, p.limitDeg, held);
      assert.equal(host, fw, p.id + ' ' + top + '/' + bot);
    }
  }
});

test('deadband and clamp in JS are the firmware numbers', () => {
  assert.equal(GLARE_THRESHOLD, spec.glareThreshold);
  assert.equal(GAIN_DEG_PER_RATIO, spec.gainDegPerRatio);
  assert.equal(DEADBAND_DEG, spec.deadbandDeg);
  assert.equal(shouldMove(10, 10 + spec.deadbandDeg), false);
  assert.ok(shouldMove(10, 10 + spec.deadbandDeg + 0.01));
  for (const p of spec.panels) {
    assert.equal(clampToPanel(999, p.id), p.limitDeg);
    assert.equal(clampToPanel(-999, p.id), -p.limitDeg);
    assert.equal(PANEL_LIMITS[p.id], p.limitDeg);
  }
});

test('firmware has no homing, no WDT, no endstop, no FAULT enum', () => {
  assert.match(ino, /stepper\.setCurrentPosition\(0\)/);
  assert.match(ino, /bool\s+autoMode/);
  assert.doesNotMatch(ino, /enum\s+\w*State/);
  assert.doesNotMatch(ino, /void\s+home\s*\(/);
  assert.doesNotMatch(ino, /esp_task_wdt/);
  assert.doesNotMatch(ino, /digitalRead\s*\(/);
});
