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
// fresh private temp directory (fs.mkdtempSync) per call: no clock, no network.
// A fixed /tmp path would let two suite runs at once delete each other's copy
// mid-run, and would execute whatever script sat at a predictable path.
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const REPO = path.join(__dirname, '..');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartmount-sync-check-'));
  try {
    for (const rel of ['config', 'scripts', 'firmware', path.join('src', 'lib')]) {
      fs.mkdirSync(path.join(dir, rel), { recursive: true });
    }
    for (const rel of [
      path.join('config', 'control-params.json'),
      path.join('scripts', 'sync-control-params.js'),
      path.join('firmware', 'smart_mount.ino'),
      path.join('src', 'lib', 'control-params.js'),
    ]) {
      fs.copyFileSync(path.join(REPO, rel), path.join(dir, rel));
    }
    execFileSync(process.execPath, [path.join(dir, 'scripts', 'sync-control-params.js')], {
      stdio: 'ignore',
    });
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw err;
  }
  return dir;
}

test('re-running sync-control-params.js reproduces the committed files byte for byte', () => {
  const out = sandbox();
  try {
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
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('each sandbox is a fresh private directory, so concurrent suite runs cannot collide', () => {
  const a = sandbox();
  let b;
  try {
    b = sandbox();
    assert.notEqual(a, b, 'two sandboxes share one directory');
    // Building the second sandbox must leave the first one's files in place.
    for (const rel of [
      path.join('scripts', 'sync-control-params.js'),
      path.join('src', 'lib', 'control-params.js'),
    ]) {
      assert.equal(
        fs.readFileSync(path.join(a, rel), 'utf8'),
        fs.readFileSync(path.join(REPO, rel), 'utf8')
      );
    }
  } finally {
    fs.rmSync(a, { recursive: true, force: true });
    if (b) fs.rmSync(b, { recursive: true, force: true });
  }
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
