const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

// On ESP32, Arduino.h does `using std::min; using std::max;` — there is no
// min()/max() macro like on AVR. std::min<T>(const T&, const T&) needs both
// operands to be the same type, so min(float, double) is a template deduction
// failure and the sketch does not compile. The control constants are emitted
// with an f suffix by scripts/sync-control-params.js, so every operand that
// reaches min/max is a float; a (double) cast on one side breaks the build.
test('min/max operands in the .ino are all float — no (double) cast, no bare double literal', () => {
  assert.doesNotMatch(ino, /\(double\)/, 'a (double) cast makes std::min/std::max mixed-type');
  // Code only: drop // comment lines so prose about min() is not matched.
  const code = ino.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const calls = code.match(/\b(?:min|max)\(([^;]*)\);/g) || [];
  assert.ok(calls.length >= 2, 'expected the glare ratio max() and the tilt cap min()');
  for (const call of calls) {
    assert.doesNotMatch(call, /\(double\)/, call);
    // A double literal (3.0, 5.0) without the f suffix would widen the operand.
    assert.doesNotMatch(call, /\d\.\d+(?![\dfF])/, call);
  }
});

test('the tilt cap is min(float expression, limit) where limit is a float', () => {
  assert.match(ino, /float limit\s*=\s*panelLimit\(\);/);
  assert.match(ino, /min\(\(glareRatio - GLARE_THRESHOLD\) \* GAIN_DEG_PER_RATIO, limit\)/);
  assert.match(ino, /float panelLimit\(\)/);
  assert.match(ino, /float glareRatio = luxTop \/ max\(luxBot, MIN_LUX\);/);
  // The generated constants carry the f suffix the sketch relies on.
  assert.match(ino, /const float GLARE_THRESHOLD = \d+\.\d+f;/);
  assert.match(ino, /const float GAIN_DEG_PER_RATIO = \d+\.\d+f;/);
  assert.match(ino, /const float MIN_LUX = \d+\.\d+f;/);
});
