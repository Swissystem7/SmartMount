const test = require('node:test');
const assert = require('node:assert');
const { clampToPanel } = require('../src/lib/control');

test('calls clampToPanel with a requested angle of 50 for a CUSTOM panel constrained to 45, and asserts it returns exactly 45', () => {
  let result;
  try {
    result = clampToPanel(50, 'CUSTOM', 45);
  } catch (err) {
    result = err;
  }
  assert.strictEqual(result, 45);
});
