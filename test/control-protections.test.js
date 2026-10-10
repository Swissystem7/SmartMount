const test = require('node:test');
const assert = require('node:assert/strict');
const { compute } = require('../src/lib/control');

function assertSafeFallback(result, label) {
  assert.equal(result.error, true, `${label}: error flag`);
  assert.equal(result.move, false, `${label}: no movement`);
  assert.equal(result.steps, 0, `${label}: zero steps`);
  assert.equal(result.angle, 0, `${label}: zero commanded angle`);
}

for (const bad of [NaN, Infinity, -Infinity]) {
  test(`compute rejects non-finite luxTop (${String(bad)})`, () => {
    assertSafeFallback(compute({ luxTop: bad, luxBot: 200 }), 'luxTop');
  });
  test(`compute rejects non-finite luxBot (${String(bad)})`, () => {
    assertSafeFallback(compute({ luxTop: 400, luxBot: bad }), 'luxBot');
  });
}

test('compute accepts finite glare and does not set the error flag', () => {
  const result = compute({ luxTop: 800, luxBot: 80, targetAngle: 0 });
  assert.equal(result.error, false);
  assert.ok(Number.isFinite(result.angle));
});
