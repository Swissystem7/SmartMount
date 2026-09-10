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

// ── regeneration drift ─────────────────────────────────────────────────────
// The bridge (config JSON -> scripts/sync-control-params.js -> generated
// module + .ino block) already existed. What was missing was a test that
// actually RUNS the generator and compares the result to what is committed,
// so a hand-edited generated file cannot drift away from the JSON.
//
// The generator writes in place, so it runs against a copy of the repo in a
// fixed temp directory: no clock, no randomness, no network.
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const REPO = path.join(__dirname, '..');
const SANDBOX = path.join(os.tmpdir(), 'smartmount-sync-check');

function sandbox() {
  fs.rmSync(SANDBOX, { recursive: true, force: true });
  for (const rel of ['config', 'scripts', 'firmware', path.join('src', 'lib')]) {
    fs.mkdirSync(path.join(SANDBOX, rel), { recursive: true });
  }
  for (const rel of [
    path.join('config', 'control-params.json'),
    path.join('scripts', 'sync-control-params.js'),
    path.join('firmware', 'smart_mount.ino'),
    path.join('src', 'lib', 'control-params.js'),
  ]) {
    fs.copyFileSync(path.join(REPO, rel), path.join(SANDBOX, rel));
  }
  execFileSync(process.execPath, [path.join(SANDBOX, 'scripts', 'sync-control-params.js')], {
    stdio: 'ignore',
  });
  return SANDBOX;
}

test('re-running sync-control-params.js reproduces the committed files byte for byte', () => {
  const out = sandbox();
  for (const rel of [
    path.join('src', 'lib', 'control-params.js'),
    path.join('firmware', 'smart_mount.ino'),
  ]) {
    assert.equal(
      fs.readFileSync(path.join(out, rel), 'utf8'),
      fs.readFileSync(path.join(REPO, rel), 'utf8'),
      rel + ' is stale — run npm run sync-params'
    );
  }
  fs.rmSync(out, { recursive: true, force: true });
});

test('the generated module exposes exactly the derived key set, values from the JSON', () => {
  assert.deepEqual(Object.keys(params).sort(), [
    'comment', 'deadbandDeg', 'gainDegPerRatio', 'gearRatio', 'glareThreshold',
    'limits', 'limitsArray', 'minLux', 'panelNames', 'panels', 'stepsPerDegree',
    'stepsPerRev',
  ]);
  assert.equal(params.comment, spec.comment);
  assert.deepEqual(params.panelNames, spec.panels.map((p) => p.id));
  assert.deepEqual(
    Object.entries(params.limits),
    spec.panels.map((p) => [p.id, p.limitDeg])
  );
  assert.equal(params.stepsPerRev, spec.stepper.stepsPerRev);
  assert.equal(params.gearRatio, spec.stepper.gearRatio);
  // Derived by hand: 200 steps/rev x 5:1 gear / 360 deg = 1000/360 = 2.7777777777777777
  assert.equal(params.stepsPerDegree, 1000 / 360);
  assert.equal(params.stepsPerDegree, 2.7777777777777777);
});

test('the generated module and the .ino block are frozen against hand edits', () => {
  assert.equal(Object.isFrozen(params), true);
  assert.equal(Object.isFrozen(params.limits), true);
  const header = fs.readFileSync(path.join(REPO, 'src', 'lib', 'control-params.js'), 'utf8');
  assert.match(header, /^\/\/ GENERATED from config\/control-params\.json/);
});
