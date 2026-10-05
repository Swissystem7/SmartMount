const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const protocol = require('../src/lib/protocol');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

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

// The host mirror must not advertise a route the board does not serve.
test('firmware registers POST /stop and the route is in the documented list', () => {
  assert.match(ino, /server\.on\("\/stop",\s*HTTP_POST,\s*handleStop\)/);
  const route = protocol.ROUTES.find((r) => r.path === '/stop');
  assert.ok(route, 'ROUTES must list /stop');
  assert.strictEqual(route.method, 'POST');
  assert.deepStrictEqual(route.args, []);
});

// Order matters: auto goes off before the stop, otherwise the next 2 s sample
// in loop() re-arms a move. The halt is a decelerating stepper.stop(), never a
// moveTo() back to the current position — that reverses under load and skips.
test('firmware handleStop: auto off first, then stepper.stop(), no moveTo', () => {
  const start = ino.indexOf('void handleStop()');
  const end = ino.indexOf('void setup()');
  assert.ok(start > 0 && end > start, 'handleStop must be defined before setup()');
  const body = ino.slice(start, end);
  assert.match(body, /autoMode = false;/);
  assert.match(body, /stepper\.stop\(\);/);
  assert.match(body, /targetAngle = stepper\.targetPosition\(\) \/ STEPS_PER_DEGREE;/);
  assert.doesNotMatch(body, /moveTo/);
  assert.ok(
    body.indexOf('autoMode = false') < body.indexOf('stepper.stop()'),
    'auto must be disabled before the stop'
  );
});
