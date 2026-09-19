const test = require('node:test');
const assert = require('node:assert/strict');
const { calcOptimalAngle, clampToPanel } = require('../src/lib/control');

// A panel type is a key of PANEL_LIMITS. Anything inherited from Object.prototype is not a panel,
// and must be refused rather than silently turned into a NaN angle.
test('an inherited Object property is not a panel type', () => {
  assert.throws(() => calcOptimalAngle(900, 100, 'toString'), /unknown panel type/);
  assert.throws(() => clampToPanel(30, 'constructor'), /unknown panel type/);
});

test('a bogus panel never yields a non-finite angle, a real one still works', () => {
  assert.throws(() => calcOptimalAngle(900, 100, 'hasOwnProperty'), /unknown panel type/);
  const led = calcOptimalAngle(900, 100, 'LED');
  assert.ok(Number.isFinite(led), 'LED must still produce a finite angle');
  assert.ok(Number.isFinite(clampToPanel(30, 'OLED')), 'OLED must still clamp to a finite angle');
});

test('calcOptimalAngle returns 0 when currentAngle is NaN or negative', () => {
  assert.equal(calcOptimalAngle(-1, 100, 'LED', NaN), 0);
  assert.equal(calcOptimalAngle(-1, 100, 'LED', -5), 0);
});
