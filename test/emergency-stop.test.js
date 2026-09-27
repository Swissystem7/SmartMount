const test = require('node:test');
const assert = require('node:assert');
const protocol = require('../src/lib/protocol');

test('dispatching POST to /stop halts movement, disables autoMode, and updates /status', () => {
  const state = {
    angle: 15,
    target: 25,
    auto: true,
    panel: 1,
    lux_top: 400,
    lux_bot: 100,
  };

  const stopRes = protocol.dispatch('POST', '/stop', null, state);
  assert.strictEqual(stopRes.status, 200);
  assert.strictEqual(stopRes.body.ok, true);
  assert.strictEqual(stopRes.effect.stop, true);
  assert.strictEqual(stopRes.effect.autoMode, false);

  const updatedState = Object.assign({}, state, stopRes.effect, {
    auto: stopRes.effect.autoMode,
  });

  const statusRes = protocol.dispatch('GET', '/status', null, updatedState);
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusRes.body.auto, false);
});
