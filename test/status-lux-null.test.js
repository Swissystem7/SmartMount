const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const protocol = require('../src/lib/protocol');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

function status(lux_top, lux_bot) {
  return protocol.dispatch('GET', '/status', null, {
    angle: 0, target: 0, auto: true, panel: 2, lux_top, lux_bot,
  }).body;
}

test('/status reports a failed BH1750 read as null, not as negative lux', () => {
  for (const bad of [-1, -2, NaN, Infinity, -Infinity, undefined, null]) {
    const body = status(bad, 80);
    assert.strictEqual(body.lux_top, null, `lux_top ${bad}`);
    assert.strictEqual(body.lux_bot, 80);
    assert.strictEqual(status(400, bad).lux_bot, null, `lux_bot ${bad}`);
  }
});

test('/status passes real readings through, including 0 lux (dark room)', () => {
  const body = status(0, 412.5);
  assert.strictEqual(body.lux_top, 0);
  assert.strictEqual(body.lux_bot, 412.5);
});

test('firmware routes both lux fields through setLux, which nulls the same reads calcOptimalAngle holds on', () => {
  const fn = ino.match(/void setLux\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(fn, 'setLux() must exist');
  assert.match(fn[1], /isnan\(lux\)\s*\|\|\s*isinf\(lux\)\s*\|\|\s*lux < 0\.0f\)\s*doc\[key\] = nullptr/);
  const status = ino.match(/void handleStatus\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(status, /setLux\(doc, "lux_top", sensorTop\.readLightLevel\(\)\)/);
  assert.match(status, /setLux\(doc, "lux_bot", sensorBot\.readLightLevel\(\)\)/);
  assert.doesNotMatch(status, /doc\["lux_(top|bot)"\]\s*=/);
});
