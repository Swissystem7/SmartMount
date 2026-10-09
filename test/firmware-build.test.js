// Build facts for firmware/smart_mount.ino.
//
// A real ESP32 compile needs arduino-cli + the esp32 core (several GB), so it
// does not run here. What runs here:
//   1. a static lock on the one error that the measured compile hit, and
//   2. a staleness guard: the case page may say "compiles" only for the exact
//      .ino bytes that were compiled. Edit the firmware -> this test fails
//      until someone recompiles (scripts/compile-firmware.sh) and updates
//      BUILD in src/lib/case.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../src/lib/case');

const inoPath = path.join(__dirname, '../firmware/smart_mount.ino');
const ino = fs.readFileSync(inoPath, 'utf8');

test('no min()/max() call mixes a (double) cast with float arguments', () => {
  // esp32 core 3.3.12 (GCC 14): std::min(float, double) has no match ->
  // "no matching function for call to 'min(float, double)'" at line 114.
  const calls = ino.match(/\b(?:min|max)\s*\([^;]*\)/g) || [];
  assert.ok(calls.length >= 2, 'expected the min/max calls in calcOptimalAngle');
  for (const c of calls) {
    assert.doesNotMatch(c, /\(\s*double\s*\)/, `mixed float/double in: ${c}`);
  }
});

test('BUILD record: compiled for ESP32, never flashed, with toolchain and date', () => {
  const B = C.BUILD;
  assert.ok(B, 'case.js must export BUILD');
  assert.equal(B.status, 'compiled-not-flashed');
  assert.equal(B.date, '2026-09-27');
  assert.equal(B.fqbn, 'esp32:esp32:esp32');
  assert.match(B.core, /^esp32:esp32@\d+\.\d+\.\d+$/);
  assert.match(B.cli, /^arduino-cli \d+\.\d+\.\d+$/);
  assert.ok(Array.isArray(B.libs) && B.libs.length === 3);
  assert.ok(Number.isInteger(B.flashBytes) && B.flashBytes > 0);
  assert.ok(Number.isInteger(B.ramBytes) && B.ramBytes > 0);
  assert.match(B.before, /min\(float, double\)/);
  assert.match(B.he, /מתקמפל/);
  assert.match(B.he, /לא הועלה ללוח|לא הועלתה ללוח/);
  assert.doesNotMatch(B.he, /רץ על הלוח|נבדק על חומרה|הועלה ללוח בהצלחה/);
});

test('BUILD record is not stale: it names the sha256 of the current .ino', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(inoPath)).digest('hex');
  assert.equal(
    C.BUILD.inoSha256,
    sha,
    'firmware/smart_mount.ino changed since the recorded compile. ' +
      'Run scripts/compile-firmware.sh and update BUILD in src/lib/case.js, ' +
      'or remove the "compiles" claim.'
  );
});

test('the recruiter page shows the build fact and still says never flashed', () => {
  assert.ok(C.SHOWN.some((s) => /מתקמפלת ל-ESP32/.test(s)));
  assert.match(C.openItem('never-flashed').why, /אפס פולסי/);
  const html = fs.readFileSync(path.join(__dirname, '../case/index.html'), 'utf8');
  assert.match(html, /id="buildBox"/);
});
