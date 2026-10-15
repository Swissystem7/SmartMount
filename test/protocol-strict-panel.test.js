const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/protocol');

test('handleSetPanel rejects unknown panel type foo with HTTP 400', () => {
  const r = P.handleSetPanel({ type: 'foo' });
  assert.equal(r.status, 400);
});
