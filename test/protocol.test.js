const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../src/lib/protocol');

const ino = fs.readFileSync(path.join(__dirname, '../firmware/smart_mount.ino'), 'utf8');

test('firmware still serves the five documented routes', () => {
  assert.match(ino, /server\.on\("\/status"/);
  assert.match(ino, /server\.on\("\/set-angle"/);
  assert.match(ino, /server\.on\("\/set-panel"/);
  assert.match(ino, /server\.on\("\/set-mode"/);
  assert.match(ino, /server\.on\("\/stop"/);
  assert.deepEqual(
    P.ROUTES.map((r) => r.path),
    ['/status', '/set-angle', '/set-panel', '/set-mode', '/stop']
  );
  // Every route the host mirror dispatches is one the board registers.
  for (const r of P.ROUTES) {
    assert.match(ino, new RegExp('server\\.on\\("' + r.path + '",\\s*HTTP_' + r.method), r.path);
  }
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

// The board parses with newlib strtof, not with a tidy decimal regex. The
// mirror has to say 200 exactly where the board says 200, including the
// inputs nobody would type on purpose — otherwise the host "contract" lies.
test('parseFloatArg takes what strtof takes: C whitespace and hex floats', () => {
  assert.match(ino, /strtof\(start, &end\)/);
  assert.match(ino, /end == start \|\| \*end != '\\0'/);
  // Leading C isspace is skipped; WebServer url-decodes %0A / %0D / %09.
  for (const ws of [' ', '\t', '\n', '\r', '\v', '\f', ' \r\n ']) {
    const r = P.parseFloatArg(ws + '12.5');
    assert.equal(r.ok, true, JSON.stringify(ws));
    assert.equal(r.value, 12.5);
  }
  assert.equal(P.handleSetAngle({ deg: '\n12' }).status, 200);
  // Hex floats are a strtof feature, binary exponent optional.
  assert.deepEqual(P.parseFloatArg('0x10'), { ok: true, value: 16 });
  assert.deepEqual(P.parseFloatArg('-0X10'), { ok: true, value: -16 });
  assert.deepEqual(P.parseFloatArg('0x1.8p1'), { ok: true, value: 3 });
  assert.deepEqual(P.parseFloatArg('0x.8'), { ok: true, value: 0.5 });
  assert.deepEqual(P.parseFloatArg('0x1.'), { ok: true, value: 1 });
  assert.deepEqual(P.parseFloatArg('0xAp-1'), { ok: true, value: 5 });
  assert.equal(P.handleSetAngle({ deg: '0x10' }).effect.requestedDeg, 16);
  // Still rejected: nothing parsed, or a trailing byte after the number.
  for (const bad of ['0x', '0xg', '0x1p', '1e', '0x10 ', ' ', '\n', '12\n', '+', '-', '.', 'e5']) {
    assert.equal(P.parseFloatArg(bad).ok, false, JSON.stringify(bad));
  }
});

test('parseFloatArg rejects what overflows a 32-bit float, like strtof → inf', () => {
  assert.match(ino, /isnan\(out\) \|\| isinf\(out\)/);
  // Rounds to FLT_MAX in float32; the next decimal order of magnitude does not.
  assert.equal(P.parseFloatArg('3.4028235e38').ok, true);
  assert.equal(P.parseFloatArg('3.4028235e38').value, Math.fround(3.4028235e38));
  assert.equal(P.parseFloatArg('1e39').ok, false);
  assert.equal(P.parseFloatArg('-1e39').ok, false);
  assert.equal(P.parseFloatArg('0x1p127').ok, true);
  assert.equal(P.parseFloatArg('0x1p128').ok, false);
  assert.equal(P.handleSetAngle({ deg: '1e39' }).status, 400);
  assert.equal(P.handleSetAngle({ deg: '1e39' }).body.error, 'invalid deg');
  // Underflow is not an error for strtof: the value flushes to float32 zero.
  assert.equal(P.parseFloatArg('1e-50').ok, true);
  assert.equal(P.parseFloatArg('1e-50').value, 0);
  // Plain decimals still work exactly as before.
  assert.deepEqual(P.parseFloatArg('+.5'), { ok: true, value: 0.5 });
  assert.deepEqual(P.parseFloatArg('5.'), { ok: true, value: 5 });
  assert.deepEqual(P.parseFloatArg('1E+1'), { ok: true, value: 10 });
  assert.deepEqual(P.parseFloatArg('-0'), { ok: true, value: -0 });
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

// toInt() was atoi: "foo" → 0 → OLED, the loosest tilt cap, with a 200. The
// board now parses type= with strtol and demands full consumption, exactly
// the parseFloatArg contract for deg=.
test('type is strtol base 10, fully consumed — type=foo is 400, not OLED', () => {
  assert.match(ino, /bool parseIntArg\(const String& s, long& out\)/);
  assert.match(ino, /strtol\(start, &end, 10\)/);
  assert.match(ino, /parseIntArg\(server\.arg\("type"\), type\) \|\| !isValidPanel\(type\)/);
  assert.doesNotMatch(ino, /\.toInt\(\)/);
  // A long, so an overflowed strtol (LONG_MAX) is not truncated back into 0..2.
  assert.match(ino, /bool isValidPanel\(long type\)/);
  for (const bad of ['foo', '1.9', '2abc', '2 ', '0x1', '1e0', '', ' ', '+', '-', 'two']) {
    const r = P.handleSetPanel({ type: bad });
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(r.body.error, 'invalid panel type', JSON.stringify(bad));
    assert.equal(r.effect, undefined, JSON.stringify(bad));
  }
  // What strtol takes, the board takes: leading C whitespace, a sign, leading zeros.
  assert.equal(P.handleSetPanel({ type: ' 2' }).effect.panel, 2);
  assert.equal(P.handleSetPanel({ type: '\n1' }).effect.panel, 1);
  assert.equal(P.handleSetPanel({ type: '+1' }).effect.panel, 1);
  assert.equal(P.handleSetPanel({ type: '00' }).effect.panel, 0);
  assert.equal(P.handleSetPanel({ type: '-0' }).effect.panel, 0);
  // Past a 32-bit long: the board gets LONG_MAX, the mirror a big number — both 400.
  assert.equal(P.handleSetPanel({ type: '4294967296' }).status, 400);
  assert.equal(P.parseIntArg('foo').ok, false);
  assert.deepEqual(P.parseIntArg('2'), { ok: true, value: 2 });
  assert.equal(P.arduinoToInt, undefined, 'the atoi mirror is gone with the atoi');
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

// WebServer answers an unregistered path — or a registered path with the
// wrong method — with its own 404 text/plain "Not found". That was the only
// non-JSON body the board could send, while the host mirror already said
// {ok:false,error:"not found"}. onNotFound routes it through sendError so the
// board and the mirror agree on the envelope for every error, 400 and 404.
test('unknown path or wrong method is a JSON 404 on the board, not text/plain', () => {
  assert.ok(ino.includes('server.onNotFound(handleNotFound)'), 'onNotFound must be registered');
  const start = ino.indexOf('void handleNotFound()');
  const end = ino.indexOf('void setup()');
  assert.ok(start > 0 && end > start, 'handleNotFound must be defined before setup()');
  assert.ok(ino.slice(start, end).includes('sendError(404, "not found")'));
  assert.ok(
    ino.indexOf('server.onNotFound(') < ino.indexOf('server.begin()'),
    'onNotFound must be set before server.begin()'
  );
  const cases = [
    ['POST', '/reboot'],
    ['GET', '/stop'],
    ['POST', '/status'],
    ['GET', '/set-angle'],
    ['DELETE', '/set-mode'],
  ];
  for (const [m, p] of cases) {
    const r = P.dispatch(m, p, {});
    assert.equal(r.status, 404, m + ' ' + p);
    assert.deepEqual(r.body, { ok: false, error: 'not found' }, m + ' ' + p);
  }
});

test('Serial on boot matches the two strings the firmware actually prints', () => {
  assert.match(ino, /Serial\.begin\(115200\)/);
  assert.match(ino, /WiFi timeout — continuing in local auto mode/);
  assert.equal(P.SERIAL_BAUD, 115200);
  assert.equal(P.WIFI_CONNECT_TIMEOUT_MS, 10000);
  assert.equal(P.serialOnBoot(false), P.SERIAL_WIFI_TIMEOUT);
  assert.equal(P.serialOnBoot(true, '192.168.1.8'), 'IP: 192.168.1.8');
});

test('unsupported method on existing path returns 405 Method Not Allowed', () => {
  const result = P.dispatch('PUT', '/status', {}, {});
  assert.equal(result.status, 405);
  assert.deepEqual(result.body, { ok: false, error: 'method not allowed' });
});
