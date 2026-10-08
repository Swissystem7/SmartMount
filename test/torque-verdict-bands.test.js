const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/lib/torque.js');

// The bands are half-open: [0,1) cannot-hold, [1,2) marginal, [2,∞) holds.
// A factor of exactly 1.0 has zero margin, so it is marginal, not holds (#36).
const v = (factor) => T.verdict({ factor, selfLocking: true, unpowered: false });

test('band edges: 1.0 is marginal and 2.0 is holds', () => {
  assert.equal(v(0.999), 'cannot-hold');
  assert.equal(v(1), 'marginal');
  assert.equal(v(1.999), 'marginal');
  assert.equal(v(2), 'holds');
});

test('verdict never gets worse as the factor grows', () => {
  const rank = { 'cannot-hold': 0, marginal: 1, holds: 2 };
  let prev = -1;
  for (let f = 0; f <= 3; f = Math.round((f + 0.05) * 100) / 100) {
    const r = rank[v(f)];
    assert.ok(r >= prev, `factor ${f} ranks below a smaller factor`);
    prev = r;
  }
});
