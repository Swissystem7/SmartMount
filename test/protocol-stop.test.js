const test = require('node:test');
const assert = require('node:assert');
const { dispatch } = require('../src/lib/protocol.js');

test('dispatch POST /stop returns status 200', () => {
  const result = dispatch('POST', '/stop', null, {});
  assert.strictEqual(result.status, 200);
});
