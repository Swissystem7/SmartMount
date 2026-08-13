const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const params = require('../src/lib/control-params');
const { PANEL_LIMITS, GLARE_THRESHOLD, DEADBAND_DEG } = require('../src/lib/control');

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
});

test('control.js reads the same generated params', () => {
  assert.equal(GLARE_THRESHOLD, spec.glareThreshold);
  assert.equal(DEADBAND_DEG, spec.deadbandDeg);
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
