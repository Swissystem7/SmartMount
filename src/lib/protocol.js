// SmartMount — host mirror of the HTTP contract in firmware/smart_mount.ino.
//
// The board is Arduino WebServer: handlers read query/form args (server.arg),
// not a JSON body. Status is JSON. Errors are {"ok":false,"error":"..."}.
// Keep this file in lockstep with handleStatus / handleSetAngle /
// handleSetPanel / handleSetMode / handleStop and parseFloatArg / isValidPanel.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_PROTOCOL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ROUTES = Object.freeze([
    Object.freeze({
      method: 'GET',
      path: '/status',
      args: Object.freeze([]),
      summary: 'מצב חי: זווית, יעד, מצב, פאנל, שתי קריאות lux',
    }),
    Object.freeze({
      method: 'POST',
      path: '/set-angle',
      args: Object.freeze(['deg']),
      summary: 'כיבוי אוטו + moveTo מוחלט. deg חסר/לא-מספר → 400',
    }),
    Object.freeze({
      method: 'POST',
      path: '/set-panel',
      args: Object.freeze(['type']),
      summary: 'type הוא 0..2. Arduino toInt("foo")=0 — מתקבל כ־OLED',
    }),
    Object.freeze({
      method: 'POST',
      path: '/set-mode',
      args: Object.freeze(['auto']),
      summary: 'auto חייב להיות המחרוזת "0" או "1" בדיוק',
    }),
    Object.freeze({
      method: 'POST',
      path: '/stop',
      args: Object.freeze([]),
      summary: 'עצירת חירום: כיבוי אוטו + stepper.stop() — האטה עד עצירה, לא קפיצה',
    }),
  ]);

  const SERIAL_BAUD = 115200;
  const WIFI_CONNECT_TIMEOUT_MS = 10000;
  const SERIAL_WIFI_OK = 'IP: ';
  const SERIAL_WIFI_TIMEOUT = 'WiFi timeout — continuing in local auto mode';

  function errorBody(msg) {
    return { ok: false, error: msg };
  }

  function okBody() {
    return { ok: true };
  }

  // parseFloatArg — ino: strtof then *end=='\0'; reject NaN/Inf.
  //
  // strtof is newlib's, so the board takes exactly what newlib takes and the
  // mirror must not be tidier than the board:
  //   * any leading C isspace (space \t \n \v \f \r) — WebServer url-decodes,
  //     so deg=%0A12 reaches strtof as "\n12" and is 12°;
  //   * hex floats: "0x10" is 16°, "-0x1.8p1" is -3°, binary exponent optional;
  //   * the result is a 32-bit float, so anything that rounds past FLT_MAX
  //     ("1e39", "0x1p128") comes back as inf and is rejected, while a
  //     double would have been happy to keep it.
  // Trailing anything (even a space) is still a reject: *end != '\0'.
  const C_SPACE = /^[ \t\n\v\f\r]+/;
  const DEC = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
  const HEX = /^([+-]?)0[xX](?:([0-9a-fA-F]+)(?:\.([0-9a-fA-F]*))?|\.([0-9a-fA-F]+))(?:[pP]([+-]?\d+))?$/;

  function hexFloatValue(m) {
    const sign = m[1] === '-' ? -1 : 1;
    const intDigits = m[2] || '';
    const fracDigits = m[3] || m[4] || '';
    let mant = intDigits ? parseInt(intDigits, 16) : 0;
    if (fracDigits) mant += parseInt(fracDigits, 16) / Math.pow(16, fracDigits.length);
    const exp = m[5] ? parseInt(m[5], 10) : 0;
    return sign * mant * Math.pow(2, exp);
  }

  function parseFloatArg(s) {
    if (s == null) return { ok: false };
    const raw = String(s);
    if (raw.length === 0) return { ok: false };
    const body = raw.replace(C_SPACE, '');
    let n;
    const hex = body.match(HEX);
    if (hex) n = hexFloatValue(hex);
    else if (DEC.test(body)) n = Number(body);
    else return { ok: false };
    if (!Number.isFinite(n)) return { ok: false };
    // strtof stores a float; overflow → inf → reject. Return the rounded float
    // so the host mirror does not keep double precision the board never sees.
    const value = Math.fround(n);
    if (!Number.isFinite(value)) return { ok: false };
    return { ok: true, value };
  }

  // Arduino String::toInt() ≈ atoi: garbage becomes 0, not an error.
  function arduinoToInt(s) {
    const n = parseInt(String(s), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function isValidPanel(type) {
    return Number.isInteger(type) && type >= 0 && type < 3;
  }

  function handleStatus(state) {
    const s = state || {};
    const autoMode = s.autoMode !== undefined ? s.autoMode : s.auto;
    return {
      status: 200,
      body: {
        angle: s.angle,
        target: s.target,
        auto: autoMode,
        panel: s.panel,
        lux_top: s.lux_top,
        lux_bot: s.lux_bot,
      },
    };
  }

  function handleSetAngle(args) {
    if (args == null || !Object.prototype.hasOwnProperty.call(args, 'deg')) {
      return { status: 400, body: errorBody('missing deg') };
    }
    const parsed = parseFloatArg(args.deg);
    if (!parsed.ok) return { status: 400, body: errorBody('invalid deg') };
    return {
      status: 200,
      body: okBody(),
      effect: { autoMode: false, requestedDeg: parsed.value },
    };
  }

  function handleSetPanel(args) {
    if (args == null || !Object.prototype.hasOwnProperty.call(args, 'type')) {
      return { status: 400, body: errorBody('missing type') };
    }
    const type = arduinoToInt(args.type);
    if (!isValidPanel(type)) return { status: 400, body: errorBody('invalid panel type') };
    return { status: 200, body: okBody(), effect: { panel: type } };
  }

  function handleSetMode(args) {
    if (args == null || !Object.prototype.hasOwnProperty.call(args, 'auto')) {
      return { status: 400, body: errorBody('missing auto') };
    }
    const a = String(args.auto);
    if (a !== '0' && a !== '1') return { status: 400, body: errorBody('invalid auto') };
    return { status: 200, body: okBody(), effect: { autoMode: a === '1' } };
  }

  // handleStop — ino: autoMode=false; stepper.stop(); targetAngle follows the
  // deceleration endpoint. No args, cannot fail.
  function handleStop() {
    return {
      status: 200,
      body: okBody(),
      effect: { stop: true, autoMode: false },
    };
  }

  function dispatch(method, path, args, state) {
    const m = String(method || '').toUpperCase();
    const p = String(path || '');
    if (m === 'GET' && p === '/status') return handleStatus(state);
    if (m === 'POST' && p === '/set-angle') return handleSetAngle(args || {});
    if (m === 'POST' && p === '/set-panel') return handleSetPanel(args || {});
    if (m === 'POST' && p === '/set-mode') return handleSetMode(args || {});
    if (m === 'POST' && p === '/stop') return handleStop(args || {});
    return { status: 404, body: errorBody('not found') };
  }

  function requestLine(method, path, args) {
    const q = Object.entries(args || {})
      .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
      .join('&');
    return String(method).toUpperCase() + ' ' + path + (q ? '?' + q : '');
  }

  function serialOnBoot(wifiConnected, ip) {
    if (wifiConnected) return SERIAL_WIFI_OK + String(ip || '0.0.0.0');
    return SERIAL_WIFI_TIMEOUT;
  }

  return {
    ROUTES,
    SERIAL_BAUD,
    WIFI_CONNECT_TIMEOUT_MS,
    SERIAL_WIFI_OK,
    SERIAL_WIFI_TIMEOUT,
    parseFloatArg,
    arduinoToInt,
    isValidPanel,
    handleStatus,
    handleSetAngle,
    handleSetPanel,
    handleSetMode,
    handleStop,
    dispatch,
    requestLine,
    serialOnBoot,
  };
});
