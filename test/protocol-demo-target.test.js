// protocol/index.html is the browser demo of the HTTP contract. After
// /set-angle it used to show the raw deg from the request as target, while the
// board (moveToAngle, PR #40/#42) clamps to the panel limit and rounds to a
// step before storing targetAngle. The page text promises "angle == target
// when the move ends", so the demo has to report the same target the board
// would. This drives the inline script under node:vm with a stub DOM.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const spec = require('../config/control-params.json');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'protocol/index.html'), 'utf8');

function inlineScript() {
  const anchor = html.indexOf('src="../src/lib/protocol.js"');
  assert.ok(anchor > 0, 'protocol page must load src/lib/protocol.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</' + 'script>', open);
  assert.ok(open > anchor && close > open, 'inline script after the lib tags');
  return html.slice(open + '<script>'.length, close);
}

// textContent coerces to a string like a real DOM node, so the test sees
// what the page shows, not the number the script assigned.
function element() {
  const handlers = {};
  let text = '';
  return {
    value: '', disabled: false, placeholder: '', className: '',
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
    addEventListener(ev, fn) { handlers[ev] = fn; },
    fire(ev) { handlers[ev](); },
  };
}

function boot() {
  const byId = {};
  for (const id of ['argVal', 'reqLine', 'resCode', 'resBody', 'effectNote', 'sendBtn', 'exBad', 'exQuirk']) {
    byId[id] = element();
  }
  const buttons = ['status', 'angle', 'panel', 'mode', 'stop'].map((r) => {
    const b = element();
    b.dataset = { route: r };
    b.classList = { toggle() {} };
    b.setAttribute = function() {};
    return b;
  });
  const document = {
    getElementById: (id) => byId[id],
    querySelectorAll: () => buttons,
  };
  const ctx = vm.createContext({ document, console });
  for (const lib of ['control-params.js', 'control.js', 'protocol.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src/lib', lib), 'utf8'), ctx, { filename: lib });
  }
  vm.runInContext(inlineScript(), ctx, { filename: 'protocol/index.html' });

  function send(route, arg) {
    buttons.find((b) => b.dataset.route === route).fire('click');
    if (arg !== undefined) byId.argVal.value = arg;
    byId.sendBtn.fire('click');
    return { code: byId.resCode.textContent, body: JSON.parse(byId.resBody.textContent), note: byId.effectNote.textContent };
  }
  function status() {
    return send('status').body;
  }
  return { send, status, byId };
}

const stepsPerDegree = spec.stepper.stepsPerRev * spec.stepper.gearRatio / 360;
// The board's arithmetic: float32 product, lroundf (half away from zero), then
// long / float back to degrees, so the reported target is a float32.
const K_F32 = Math.fround(stepsPerDegree);
const lroundf = (x) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
const quantise = (deg) => Math.fround(lroundf(Math.fround(Math.fround(deg) * K_F32)) / K_F32);
// lroundf(limit * STEPS_PER_DEGREE) can land half a step past the limit:
// 20° on a 1000-step rev is 55.6 steps, so the board heads for 56 = 20.16°.
// The demo has to report that step (20.16 as a float32) because the board does.
const limit = (id) => quantise(spec.panels.find((p) => p.id === id).limitDeg);

test('protocol page loads the shared control law instead of echoing the request', () => {
  assert.match(html, /src\/lib\/control-params\.js/);
  assert.match(html, /src\/lib\/control\.js/);
  assert.doesNotMatch(html, /state\.target = res\.effect\.requestedDeg/);
  assert.doesNotMatch(html, /function moveToAngle|function clampToPanel/);
});

test('set-angle past the LED limit reports the clamped step as target, not the request', () => {
  const page = boot();
  assert.equal(page.status().panel, 2, 'demo boots as LED');
  const r = page.send('angle', '99');
  assert.equal(r.code, '200');
  assert.equal(r.body.ok, true);
  const st = page.status();
  assert.equal(st.target, limit('LED'));
  assert.equal(st.auto, false);
  assert.match(r.note, /99/);
  assert.match(r.note, new RegExp('target=' + limit('LED')));
  assert.match(r.note, /\(20°\)/, 'the note names the clamp before the step rounding');
});

test('set-angle inside the limit reports the step-quantised target the board stores', () => {
  const page = boot();
  page.send('angle', '12.3');
  const st = page.status();
  assert.equal(st.target, quantise(12.3));
  assert.notEqual(st.target, 12.3);
  assert.equal(Math.round(st.target * stepsPerDegree), 34);
});

test('set-angle accepts the same strtof spellings as the board and still clamps', () => {
  const page = boot();
  page.send('angle', ' -0x1.8p1');
  assert.equal(page.status().target, quantise(-3));
  page.send('angle', '-500');
  assert.equal(page.status().target, -limit('LED'));
  const bad = page.send('angle', '12deg');
  assert.equal(bad.code, '400');
  assert.equal(page.status().target, -limit('LED'), 'a 400 leaves the target alone');
});

test('set-panel re-clamps the commanded target like handleSetPanel, and keeps one that fits', () => {
  const page = boot();
  page.send('panel', '0');
  page.send('angle', '35');
  assert.equal(page.status().target, quantise(35), 'OLED allows 35');
  const kept = page.send('panel', '1');
  assert.equal(page.status().target, limit('QLED'), 'QLED ceiling shortens the target');
  assert.match(kept.note, /קוצר/);
  page.send('angle', '10');
  const same = page.send('panel', '2');
  assert.equal(page.status().target, quantise(10), '10 still fits LED, the move continues');
  assert.match(same.note, /ממשיכה/);
  assert.equal(page.status().panel, 2);
});

test('a rejected panel type changes neither panel nor target', () => {
  const page = boot();
  page.send('angle', '15');
  const r = page.send('panel', 'foo');
  assert.equal(r.code, '400');
  const st = page.status();
  assert.equal(st.panel, 2);
  assert.equal(st.target, quantise(15));
});
