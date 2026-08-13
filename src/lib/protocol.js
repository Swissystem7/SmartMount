// SmartMount — host mirror of the HTTP contract in firmware/smart_mount.ino.
//
// The board is Arduino WebServer: handlers read query/form args (server.arg),
// not a JSON body. Status is JSON. Errors are {"ok":false,"error":"..."}.
// Keep this file in lockstep with handleStatus / handleSetAngle /
// handleSetPanel / handleSetMode and parseFloatArg / isValidPanel.
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

  // parseFloatArg — ino:83-91. strtof then *end=='\0'; reject NaN/Inf.
  function parseFloatArg(s) {
    if (s == null) return { ok: false };
    const raw = String(s);
    if (raw.length === 0) return { ok: false };
    const m = raw.match(/^[ \t]*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/);
    if (!m) return { ok: false };
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return { ok: false };
    return { ok: true, value: n };
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
    return {
      status: 200,
      body: {
        angle: s.angle,
        target: s.target,
        auto: s.auto,
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

  function dispatch(method, path, args, state) {
    const m = String(method || '').toUpperCase();
    const p = String(path || '');
    if (m === 'GET' && p === '/status') return handleStatus(state);
    if (m === 'POST' && p === '/set-angle') return handleSetAngle(args || {});
    if (m === 'POST' && p === '/set-panel') return handleSetPanel(args || {});
    if (m === 'POST' && p === '/set-mode') return handleSetMode(args || {});
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
    dispatch,
    requestLine,
    serialOnBoot,
  };
});
