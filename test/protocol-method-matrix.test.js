const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/protocol');

// The 405 rule used to be checked ahead of the handlers, which left the cases
// below undecided — two independent fixes for #96 picked opposite answers for
// PUT /set-angle and DELETE /status. Pin the whole matrix so the next edit to
// dispatch has to state which behaviour it is changing.

test('PUT on any registered path is 405, whatever method the route declares', () => {
  for (const r of P.ROUTES) {
    const res = P.dispatch('PUT', r.path, {}, {});
    assert.equal(res.status, 405, 'PUT ' + r.path);
    assert.deepEqual(res.body, { ok: false, error: 'method not allowed' }, 'PUT ' + r.path);
  }
});

test('every other wrong method on a registered path is 404, like onNotFound', () => {
  const cases = [
    ['DELETE', '/status'],
    ['DELETE', '/set-angle'],
    ['PATCH', '/status'],
    ['HEAD', '/stop'],
    ['POST', '/status'],
    ['GET', '/set-panel'],
  ];
  for (const [m, p] of cases) {
    const res = P.dispatch(m, p, {}, {});
    assert.equal(res.status, 404, m + ' ' + p);
    assert.deepEqual(res.body, { ok: false, error: 'not found' }, m + ' ' + p);
  }
});

test('PUT on an unregistered path is 404, not 405', () => {
  const res = P.dispatch('PUT', '/reboot', {}, {});
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { ok: false, error: 'not found' });
});

test('each route still reaches its handler with its declared method', () => {
  assert.equal(P.dispatch('GET', '/status', {}, {}).status, 200);
  assert.equal(P.dispatch('POST', '/set-angle', { deg: 10 }, {}).status, 200);
  assert.equal(P.dispatch('POST', '/set-panel', { type: 0 }, {}).status, 200);
  assert.equal(P.dispatch('POST', '/set-mode', { auto: '1' }, {}).status, 200);
  assert.equal(P.dispatch('POST', '/stop', {}, {}).status, 200);
});
