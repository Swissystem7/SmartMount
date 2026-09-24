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

// ── equivalence table ──────────────────────────────────────────────────────
// Round-2 backlog item 3. firmware/smart_mount.ino carries a written table of
// lux pairs -> tilt degrees per panel, hand-derived from the constants in the
// .ino. Nothing compiles it, so it can only be kept true by a test: these
// tests parse the rows straight out of the .ino text and assert that BOTH the
// host implementation (src/lib/control.js) and the transcribed firmware
// formula above return exactly those degrees. Editing a row, or changing the
// law without changing the table, fails here.
//
// A value that is not a number means "hold": the .ino returns currentAngle.
const HOLD_ANGLE = 11.25; // an angle that appears nowhere in the table

function equivalenceRows() {
  const block = ino.match(
    /\/\/ >>> BEGIN EQUIVALENCE TABLE([\s\S]*?)\/\/ <<< END EQUIVALENCE TABLE/
  );
  assert.ok(block, 'the .ino has lost its EQUIVALENCE TABLE block');
  const rows = [];
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\/\/\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const cells = m[1].split('|').map((c) => c.trim());
    assert.equal(cells.length, 5, 'malformed table row: ' + line);
    const num = (c) => {
      if (c === 'nan') return NaN;
      if (c === 'inf') return Infinity;
      const v = Number(c);
      assert.ok(Number.isFinite(v), 'unparsable input cell: ' + c);
      return v;
    };
    const deg = (c) => {
      if (c === 'hold') return 'hold';
      const v = Number(c);
      assert.ok(Number.isFinite(v), 'unparsable tilt cell: ' + c);
      return v;
    };
    rows.push({
      luxTop: num(cells[0]),
      luxBot: num(cells[1]),
      tilt: { OLED: deg(cells[2]), QLED: deg(cells[3]), LED: deg(cells[4]) },
      line: line.trim(),
    });
  }
  return rows;
}

test('the .ino equivalence table is the shape the test expects', () => {
  const rows = equivalenceRows();
  assert.equal(rows.length, 16);
  const holds = rows.filter((r) => r.tilt.LED === 'hold');
  assert.equal(holds.length, 4, 'the four failed-read rows must stay');
  // The table has to actually exercise the panel caps, or it proves nothing.
  assert.ok(
    rows.some((r) => r.tilt.OLED !== 'hold' && r.tilt.OLED > r.tilt.LED),
    'no row where the OLED cap and the LED cap diverge'
  );
  // ...and the threshold boundary itself.
  const atThreshold = rows.find((r) => r.luxTop === 300 && r.luxBot === 100);
  assert.ok(atThreshold, 'the exactly-at-threshold row is gone');
  assert.equal(atThreshold.tilt.LED, 0);
});

test('every equivalence-table row holds for the host law and the firmware formula', () => {
  const rows = equivalenceRows();
  for (const row of rows) {
    for (const p of spec.panels) {
      const cell = row.tilt[p.id];
      const expected = cell === 'hold' ? HOLD_ANGLE : cell;
      assert.equal(
        calcOptimalAngle(row.luxTop, row.luxBot, p.id, HOLD_ANGLE),
        expected,
        'src/lib/control.js disagrees with ' + row.line + ' for ' + p.id
      );
      assert.equal(
        firmwareFormula(row.luxTop, row.luxBot, p.limitDeg, HOLD_ANGLE),
        expected,
        'the .ino formula disagrees with ' + row.line + ' for ' + p.id
      );
    }
  }
});

test('the table sits outside the generated block, so the sync script cannot rewrite it', () => {
  const gen = ino.indexOf('>>> BEGIN GENERATED control-params');
  const genEnd = ino.indexOf('<<< END GENERATED control-params');
  const tbl = ino.indexOf('>>> BEGIN EQUIVALENCE TABLE');
  assert.ok(gen >= 0 && genEnd > gen && tbl > genEnd);
});
