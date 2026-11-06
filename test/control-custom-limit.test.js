const test = require('node:test');
const assert = require('node:assert/strict');
const { calcOptimalAngle, clampToPanel, moveToAngle, PANEL_LIMITS } = require('../src/lib/control.js');

// A CUSTOM panel used to accept any non-undefined limit as-is (CT-001):
// NaN or 'abc' gave a NaN angle and NaN steps, Infinity let the law ask for
// 235°, and a negative cap pinned every angle to that negative value.
for (const bad of [NaN, 'abc', null, Infinity, -Infinity, -10]) {
  test(`CUSTOM panel rejects limit ${String(bad)}`, () => {
    assert.throws(() => calcOptimalAngle(500, 10, 'CUSTOM', 0, bad), /unknown panel type/);
    assert.throws(() => clampToPanel(5, 'CUSTOM', bad), /unknown panel type/);
    assert.throws(() => moveToAngle(5, 'CUSTOM', bad), /unknown panel type/);
  });
}

test('a finite, non-negative custom limit still caps the angle', () => {
  assert.equal(clampToPanel(50, 'CUSTOM', 45), 45);
  assert.equal(clampToPanel(-50, 'CUSTOM', 45), -45);
  assert.equal(clampToPanel(5, 'CUSTOM', 0), 0);
  assert.equal(calcOptimalAngle(500, 10, 'CUSTOM', 0, 25), 25);
  assert.ok(Number.isInteger(moveToAngle(50, 'CUSTOM', 45).steps));
});

test('named panels without a custom limit are unchanged', () => {
  assert.equal(clampToPanel(99, 'OLED'), PANEL_LIMITS.OLED);
  assert.equal(clampToPanel(99, { type: 'LED' }), PANEL_LIMITS.LED);
  assert.equal(clampToPanel(99, { type: 'CUSTOM', limit: 12 }), 12);
});
