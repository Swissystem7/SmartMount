const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../src/lib/protocol');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

test('firmware still serves the four documented routes', () => {
  assert.match(ino, /server\.on\("\/status"/);
  assert.match(ino, /server\.on\("\/set-angle"/);
  assert.match(ino, /server\.on\("\/set-panel"/);
  assert.match(ino, /server\.on\("\/set-mode"/);
  assert.deepEqual(P.ROUTES.map((r) => r.path), ['/status', '/set-angle', '/set-panel', '/set-mode']);
});

test('missing deg is 400, not a silent 0° move', () => {
  const r = P.handleSetAngle({});
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'missing deg');
});

test('junk deg is 400 — same reject as parseFloatArg / strtof', () => {
  assert.equal(P.handleSetAngle({ deg: '12deg' }).status, 400);
  assert.equal(P.handleSetAngle({ deg: '12deg' }).body.error, 'invalid deg');
  assert.equal(P.handleSetAngle({ deg: '' }).status, 400);
  assert.equal(P.handleSetAngle({ deg: 'inf' }).status, 400);
  assert.equal(P.parseFloatArg('12.5').value, 12.5);
  assert.equal(P.parseFloatArg('12 ').ok, false);
});

test('a valid set-angle turns auto off and keeps the requested number', () => {
  const r = P.handleSetAngle({ deg: '50' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.effect.autoMode, false);
  assert.equal(r.effect.requestedDeg, 50);
});

test('panel type 0..2 is accepted; 3 and -1 are not', () => {
  assert.equal(P.handleSetPanel({ type: '2' }).effect.panel, 2);
  assert.equal(P.handleSetPanel({ type: '3' }).status, 400);
  assert.equal(P.handleSetPanel({ type: '-1' }).status, 400);
  assert.equal(P.handleSetPanel({}).body.error, 'missing type');
});

test('Arduino toInt("foo") is 0 — type=foo becomes OLED, not 400', () => {
  assert.equal(P.arduinoToInt('foo'), 0);
  const r = P.handleSetPanel({ type: 'foo' });
  assert.equal(r.status, 200);
  assert.equal(r.effect.panel, 0);
});

test('set-mode accepts only the strings 0 and 1', () => {
  assert.equal(P.handleSetMode({ auto: '1' }).effect.autoMode, true);
  assert.equal(P.handleSetMode({ auto: '0' }).effect.autoMode, false);
  assert.equal(P.handleSetMode({ auto: '2' }).status, 400);
  assert.equal(P.handleSetMode({ auto: 'true' }).status, 400);
  assert.equal(P.handleSetMode({}).body.error, 'missing auto');
});

test('status is a JSON snapshot of the live fields the .ino writes', () => {
  const r = P.handleStatus({
    angle: 4.5, target: 8, auto: true, panel: 2, lux_top: 400, lux_bot: 80,
  });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, {
    angle: 4.5, target: 8, auto: true, panel: 2, lux_top: 400, lux_bot: 80,
  });
});

test('unknown path is 404; requestLine builds query-string POST like the board', () => {
  assert.equal(P.dispatch('POST', '/reboot', {}).status, 404);
  assert.equal(
    P.requestLine('POST', '/set-angle', { deg: 12.5 }),
    'POST /set-angle?deg=12.5'
  );
});

test('Serial on boot matches the two strings the firmware actually prints', () => {
  assert.match(ino, /Serial\.begin\(115200\)/);
  assert.match(ino, /WiFi timeout — continuing in local auto mode/);
  assert.equal(P.SERIAL_BAUD, 115200);
  assert.equal(P.WIFI_CONNECT_TIMEOUT_MS, 10000);
  assert.equal(P.serialOnBoot(false), P.SERIAL_WIFI_TIMEOUT);
  assert.equal(P.serialOnBoot(true, '192.168.1.8'), 'IP: 192.168.1.8');
});
