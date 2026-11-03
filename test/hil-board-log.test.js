const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../src/lib/hil.js');
const P = require('../src/lib/protocol.js');

// CT-001: validateBoardRunLog only knew invented log lines. The firmware's
// own connect line is "IP: " + WiFi.localIP(), and that read as no WiFi.
test('the firmware connect line counts as WiFi', () => {
  const ino = fs.readFileSync(path.join(__dirname, '..', 'firmware', 'smart_mount.ino'), 'utf8');
  assert.ok(ino.includes(`Serial.println("${P.SERIAL_WIFI_OK}" + WiFi.localIP().toString())`));
  const r = H.validateBoardRunLog('rst:0x1 (POWERON_RESET),boot:0x13\r\n' + P.serialOnBoot(true, '192.168.1.50') + '\r\n');
  assert.equal(r.hasBoot, true);
  assert.equal(r.hasWifi, true);
});

test('the WiFi timeout line is not WiFi', () => {
  const r = H.validateBoardRunLog('rst:0x1\n' + P.serialOnBoot(false) + '\n');
  assert.equal(r.hasWifi, false);
});

test('an IP inside some other line is not the connect line', () => {
  assert.equal(H.validateBoardRunLog('gateway IP: 10.0.0.1 unreachable').hasWifi, false);
});
