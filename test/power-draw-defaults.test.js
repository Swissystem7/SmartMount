// currentDraw() with no argument has to model the firmware as it ships:
// WiFi always on, both BH1750s active. `input && input.wifiOn !== false`
// short-circuited to undefined, so a bare call reported 20 mA modem sleep
// and mode 'wifi-sleep-worm' while sensorsOn on the next line defaulted on.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/power');

test('a bare currentDraw() keeps WiFi on, like the firmware and like {}', () => {
  const bare = P.currentDraw();
  assert.equal(bare.wifiOn, true);
  assert.equal(bare.mode, 'idle-worm');
  assert.deepEqual(bare, P.currentDraw({}));
  assert.deepEqual(bare, P.drawModes()['idle-worm']);
});

test('WiFi is still off only when the caller says wifiOn: false', () => {
  assert.equal(P.currentDraw({ wifiOn: false }).wifiOn, false);
  assert.equal(P.currentDraw({ wifiOn: false }).mode, 'wifi-sleep-worm');
  assert.equal(P.currentDraw({ wifiOn: undefined }).wifiOn, true);
});
