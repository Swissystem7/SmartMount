const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../src/lib/protocol');
const { calcOptimalAngle } = require('../src/lib/control');
const spec = require('../config/control-params.json');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

// claws/BH1750: BH1750(byte addr = 0x23) and
// begin(Mode mode = CONTINUOUS_HIGH_RES_MODE, byte addr = 0x23, TwoWire* i2c = nullptr)
// with `if (addr) BH1750_I2CADDR = addr;` inside begin(). A bare begin() on
// the object constructed with 0x5C therefore re-points it at 0x23. These tests
// pin the shape of the sketch that cannot have that bug.

function setupBody() {
  const start = ino.indexOf('void setup()');
  const end = ino.indexOf('void loop()');
  assert.ok(start > 0 && end > start, 'setup() must be defined before loop()');
  return ino.slice(start, end);
}

test('the two BH1750 addresses are named constants, 0x23 (ADDR=GND) and 0x5C (ADDR=VCC)', () => {
  assert.match(ino, /const uint8_t SENSOR_TOP_ADDR = 0x23;/);
  assert.match(ino, /const uint8_t SENSOR_BOT_ADDR = 0x5C;/);
  assert.equal(P.SENSOR_TOP_ADDR, 0x23);
  assert.equal(P.SENSOR_BOT_ADDR, 0x5C);
  assert.notEqual(P.SENSOR_TOP_ADDR, P.SENSOR_BOT_ADDR);
});

test('each sensor is constructed with its own constant, not a literal that begin() can silently disagree with', () => {
  assert.match(ino, /BH1750 sensorTop\(SENSOR_TOP_ADDR\);/);
  assert.match(ino, /BH1750 sensorBot\(SENSOR_BOT_ADDR\);/);
  assert.doesNotMatch(ino, /BH1750 sensor\w+\(0x[0-9A-Fa-f]+\)/);
});

test('begin() is called with an explicit mode AND the same address constant; a bare begin() is the 0x23 overwrite', () => {
  const body = setupBody();
  assert.match(body, /sensorTop\.begin\(BH1750::CONTINUOUS_HIGH_RES_MODE, SENSOR_TOP_ADDR\)/);
  assert.match(body, /sensorBot\.begin\(BH1750::CONTINUOUS_HIGH_RES_MODE, SENSOR_BOT_ADDR\)/);
  assert.doesNotMatch(ino, /sensor(Top|Bot)\.begin\(\)/);
  assert.doesNotMatch(ino, /sensor(Top|Bot)\.begin\(BH1750::\w+\)/);
  // Wire.begin() first: the library expects I2C to be initialised outside it.
  assert.ok(body.indexOf('Wire.begin()') < body.indexOf('sensorTop.begin('));
});

test('a failed begin() is not swallowed: one Serial line per missing sensor, before the WiFi line', () => {
  const body = setupBody();
  assert.match(body, /if \(!sensorTop\.begin\([^)]*\)\) \{\s*Serial\.println\("BH1750 top not found at 0x23"\);/);
  assert.match(body, /if \(!sensorBot\.begin\([^)]*\)\) \{\s*Serial\.println\("BH1750 bot not found at 0x5C"\);/);
  assert.ok(body.indexOf('BH1750 top not found') < body.indexOf('WiFi.begin('));
  assert.equal(P.SERIAL_SENSOR_TOP_MISSING, 'BH1750 top not found at 0x23');
  assert.equal(P.SERIAL_SENSOR_BOT_MISSING, 'BH1750 bot not found at 0x5C');
  assert.ok(ino.includes(P.SERIAL_SENSOR_TOP_MISSING));
  assert.ok(ino.includes(P.SERIAL_SENSOR_BOT_MISSING));
});

test('host mirror serialOnSensorBegin prints the same lines in the same order, and nothing when both answer', () => {
  assert.deepEqual(P.serialOnSensorBegin(true, true), []);
  assert.deepEqual(P.serialOnSensorBegin(false, true), [P.SERIAL_SENSOR_TOP_MISSING]);
  assert.deepEqual(P.serialOnSensorBegin(true, false), [P.SERIAL_SENSOR_BOT_MISSING]);
  assert.deepEqual(P.serialOnSensorBegin(false, false), [
    P.SERIAL_SENSOR_TOP_MISSING,
    P.SERIAL_SENSOR_BOT_MISSING,
  ]);
});

// Why this mattered: with both objects on 0x23 every sample is luxTop == luxBot,
// the ratio is exactly 1 (below GLARE_THRESHOLD = 3) and the control law
// answers 0 in any light. The board looked healthy and never moved.
test('two objects on one address means glareRatio 1 and a mount that never tilts', () => {
  assert.ok(spec.glareThreshold > 1);
  for (const lux of [1, 50, 300, 900, 5000, 50000]) {
    for (const p of spec.panels) {
      assert.equal(calcOptimalAngle(lux, lux, p.id, 12), 0, p.id + ' ' + lux);
    }
  }
  // The same light on two real sensors with the top one in sun does tilt.
  assert.ok(calcOptimalAngle(900, 100, 'OLED', 0) > 0);
});
