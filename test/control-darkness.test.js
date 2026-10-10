const test = require('node:test');
const assert = require('node:assert/strict');
const { glareRatio, calcOptimalAngle } = require('../src/lib/control');

test('absolute darkness has no glare ratio — do not compensate from zero lux', () => {
  assert.equal(glareRatio(0, 0), null);
});

test('absolute darkness does not command tilt from a bogus ratio', () => {
  assert.equal(calcOptimalAngle(0, 0), 0);
});
