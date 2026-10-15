const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/lib/power');

test('deep sleep with Wi-Fi and sensors off is 3 mW logic rail', () => {
  const w = P.logicW({ wifiOn: false, sensorsOn: false, sleepMode: true });
  assert.equal(w, 0.003);
});
