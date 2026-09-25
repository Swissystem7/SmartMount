const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const params = require('../src/lib/control-params');
const {
  calcOptimalAngle, glareRatio, shouldMove, clampToPanel, moveToAngle,
  PANEL_LIMITS, GLARE_THRESHOLD, DEADBAND_DEG, GAIN_DEG_PER_RATIO,
} = require('../src/lib/control');
const sync = require('../scripts/sync-control-params');

const spec = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/control-params.json'), 'utf8')
);
const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

test('generated JS matches config/control-params.json', () => {
  assert.deepEqual([...params.limitsArray], spec.panels.map((p) => p.limitDeg));
  assert.equal(params.glareThreshold, spec.glareThreshold);
  assert.equal(params.gainDegPerRatio, spec.gainDegPerRatio);
  assert.equal(params.minLux, spec.minLux);
  assert.equal(params.deadbandDeg, spec.deadbandDeg);
  assert.equal(params.stepsPerRev, spec.stepper.stepsPerRev);
  assert.equal(params.gearRatio, spec.stepper.gearRatio);
  assert.equal(
    params.stepsPerDegree,
    (spec.stepper.stepsPerRev * spec.stepper.gearRatio) / 360
  );
});

test('control.js reads the same generated params', () => {
  assert.equal(GLARE_THRESHOLD, spec.glareThreshold);
  assert.equal(DEADBAND_DEG, spec.deadbandDeg);
  assert.equal(GAIN_DEG_PER_RATIO, spec.gainDegPerRatio);
  assert.equal(PANEL_LIMITS.OLED, spec.panels[0].limitDeg);
});

test('firmware marked block matches the JSON limits', () => {
  const limits = (ino.match(/PANEL_LIMITS\[\] = \{([^}]*)\}/) || [])[1];
  assert.ok(limits, 'generated PANEL_LIMITS missing from .ino');
  const fromIno = limits.split(',').map((s) => parseFloat(s.trim()));
  assert.deepEqual(fromIno, spec.panels.map((p) => p.limitDeg));
  assert.match(ino, />>> BEGIN GENERATED control-params/);
  assert.match(ino, /<<< END GENERATED control-params/);
});

// ── tilt law locked to SSOT numbers ───────────────────────────────────────
// angle = 0 when ratio <= glareThreshold
//       = min((ratio - glareThreshold) * gainDegPerRatio, panelLimit) otherwise
// ratio = luxTop / max(luxBot, minLux)

test('tilt law: exact degrees at threshold, gain, and panel caps', () => {
  assert.equal(params.glareThreshold, 3);
  assert.equal(params.gainDegPerRatio, 5);
  assert.equal(params.minLux, 1);
  assert.deepEqual([...params.limitsArray], [40, 30, 20]);

  // Exactly at threshold → no tilt.
  assert.equal(calcOptimalAngle(300, 100, 'LED'), 0);
  assert.equal(glareRatio(300, 100), 3);

  // One unit of excess ratio → exactly gainDegPerRatio degrees.
  // luxTop=400, luxBot=100 → ratio 4 → (4-3)*5 = 5
  assert.equal(calcOptimalAngle(400, 100, 'LED'), 5);
  assert.equal(calcOptimalAngle(400, 100, 'OLED'), 5);

  // luxTop=700, luxBot=100 → ratio 7 → (7-3)*5 = 20 (LED cap)
  assert.equal(calcOptimalAngle(700, 100, 'LED'), 20);
  assert.equal(calcOptimalAngle(700, 100, 'OLED'), 20);

  // luxTop=1000 → ratio 10 → 35; LED caps at 20, OLED keeps 35
  assert.equal(calcOptimalAngle(1000, 100, 'LED'), 20);
  assert.equal(calcOptimalAngle(1000, 100, 'OLED'), 35);

  // luxTop=1100 → ratio 11 → 40 = OLED cap
  assert.equal(calcOptimalAngle(1100, 100, 'OLED'), 40);

  // Half-step gain on QLED: ratio 3.5 → 2.5°; ratio 9 → 30° cap
  assert.equal(calcOptimalAngle(350, 100, 'QLED'), 2.5);
  assert.equal(calcOptimalAngle(900, 100, 'QLED'), 30);
});

test('tilt law: minLux floor and failed-read hold use SSOT values', () => {
  // luxBot below minLux is floored to minLux=1 → same as luxBot=1
  assert.equal(glareRatio(500, 0), 500);
  assert.equal(calcOptimalAngle(500, 0, 'LED'), 20);
  assert.equal(calcOptimalAngle(500, 1, 'LED'), 20);

  // Failed BH1750 (negative) holds currentAngle — never slams to panel limit.
  assert.equal(glareRatio(-1, 100), null);
  assert.equal(calcOptimalAngle(-1, 100, 'OLED', 12.5), 12.5);
  assert.equal(calcOptimalAngle(500, -2, 'LED', 8), 8);
});

test('tilt law: deadband and stepsPerDegree match measured SSOT math', () => {
  assert.equal(params.deadbandDeg, 1);
  // From 0°, which is a whole step, so the deadband reads the same whether
  // shouldMove compares against the commanded angle or the step-quantized one.
  assert.equal(shouldMove(0, 1), false); // |Δ| == deadband → stay
  assert.equal(shouldMove(0, 1.01), true);

  // 20° · (200·5/360) = 55.555… → Math.round → 56 (mirrors firmware lroundf)
  assert.equal(params.stepsPerDegree, (200 * 5) / 360);
  const led20 = moveToAngle(20, 'LED');
  assert.equal(led20.clamped, 20);
  assert.equal(led20.steps, 56);

  const oled40 = moveToAngle(40, 'OLED');
  assert.equal(oled40.clamped, 40);
  assert.equal(oled40.steps, 111);

  assert.equal(clampToPanel(999, 'LED'), 20);
  assert.equal(clampToPanel(-999, 'QLED'), -30);
});

test('panel entries are deep-frozen so limitDeg cannot drift from limits{}', () => {
  assert.ok(Object.isFrozen(params));
  assert.ok(Object.isFrozen(params.panels));
  assert.ok(Object.isFrozen(params.limits));
  for (const panel of params.panels) {
    assert.ok(Object.isFrozen(panel), panel.id + ' entry must be frozen');
    const before = panel.limitDeg;
    panel.limitDeg = before + 1; // no-op when frozen (sloppy); TypeError if strict
    assert.equal(panel.limitDeg, before);
    assert.equal(params.limits[panel.id], before);
  }
});

test('cFloatLiteral keeps integers as N.0 and does not round 2.75 to 2.8', () => {
  // The old sync path used Number#toFixed(1): (2.75).toFixed(1) === "2.8".
  assert.equal((2.75).toFixed(1), '2.8');
  assert.equal(sync.cFloatLiteral(2.75), '2.75');
  assert.equal(sync.cFloatLiteral(3), '3.0');
  assert.equal(sync.cFloatLiteral(40), '40.0');
  assert.equal(sync.cFloatLiteral(5.25), '5.25');
});

test('fractional SSOT: generated .ino scalars match JS (no toFixed(1) desync)', () => {
  // Concrete case: glareThreshold 2.75 / gain 5.25 / gear 2.75 / OLED 40.25.
  // With toFixed(1) the .ino would see 2.8 / 5.3 / 2.8 / 40.3 while JS kept
  // the JSON values — host and firmware control laws then diverge.
  const fractional = {
    comment: 'fixture for sync precision',
    panels: [
      { id: 'OLED', limitDeg: 40.25 },
      { id: 'QLED', limitDeg: 30 },
      { id: 'LED', limitDeg: 20 },
    ],
    glareThreshold: 2.75,
    gainDegPerRatio: 5.25,
    minLux: 1,
    deadbandDeg: 1,
    stepper: { stepsPerRev: 200, gearRatio: 2.75 },
  };

  const block = sync.buildInoBlock(fractional);
  const parsed = sync.parseInoScalars(block);

  assert.equal(parsed.glareThreshold, 2.75);
  assert.equal(parsed.gainDegPerRatio, 5.25);
  assert.equal(parsed.gearRatio, 2.75);
  assert.deepEqual(parsed.limits, [40.25, 30, 20]);
  assert.notEqual(parsed.glareThreshold, parseFloat((2.75).toFixed(1))); // 2.8

  // Law desync the old emitter caused: ratio 2.76 tilts with threshold 2.75
  // but holds with rounded 2.8.
  const ratio = 276 / 100; // 2.76
  const jsAngle = ratio > 2.75 ? Math.min((ratio - 2.75) * 5.25, 20) : 0;
  const oldInoAngle = ratio > 2.8 ? Math.min((ratio - 2.8) * 5.3, 20) : 0;
  assert.ok(jsAngle > 0);
  assert.equal(oldInoAngle, 0);
  assert.equal(jsAngle, (2.76 - 2.75) * 5.25);

  // After the fix, .ino threshold matches JS — both tilt the same.
  const newInoAngle =
    ratio > parsed.glareThreshold
      ? Math.min((ratio - parsed.glareThreshold) * parsed.gainDegPerRatio, 20)
      : 0;
  assert.equal(newInoAngle, jsAngle);

  // Gear / steps: old toFixed(1) made STEPS_PER_DEGREE from 2.8, not 2.75.
  const spdJs = (200 * 2.75) / 360;
  const spdOldIno = (200 * 2.8) / 360;
  const spdNewIno = (200 * parsed.gearRatio) / 360;
  assert.equal(spdNewIno, spdJs);
  assert.notEqual(spdOldIno, spdJs);

  // Deep-freeze still present in buildJsModule output.
  const js = sync.buildJsModule(fractional);
  assert.match(js, /Object\.freeze\(\{"id":"OLED"/);
});

test('current committed .ino block still matches live JSON after cFloatLiteral', () => {
  const block = sync.buildInoBlock(spec);
  const parsed = sync.parseInoScalars(block);
  assert.deepEqual(parsed.limits, spec.panels.map((p) => p.limitDeg));
  assert.equal(parsed.glareThreshold, spec.glareThreshold);
  assert.equal(parsed.gainDegPerRatio, spec.gainDegPerRatio);
  assert.equal(parsed.gearRatio, spec.stepper.gearRatio);
  assert.equal(parsed.stepsPerRev, spec.stepper.stepsPerRev);
  // Idempotent with the file on disk for the current all-x.0 network.
  assert.match(ino, /GLARE_THRESHOLD = 3\.0f/);
  assert.match(block, /GLARE_THRESHOLD = 3\.0f/);
});
