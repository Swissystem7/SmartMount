// lab/index.html runs the HTTP contract through protocol.js. The firmware grew
// POST /stop (#39) and protocol.js reports it as effect.stop; the lab used to
// drop that effect on the floor, so the fault console could not show the halt.
// Run the page's own script in node:vm with a fake DOM and drive it like a
// click: a manual move, a /stop mid-move, and ticks that must not re-arm.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'lab/index.html'), 'utf8');

function fakeEl() {
  const e = {
    className: '', textContent: '', value: '', style: {}, dataset: {},
    children: [], lastChild: null, listeners: {},
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener(type, fn) { (e.listeners[type] = e.listeners[type] || []).push(fn); },
    querySelector() { return fakeEl(); },
    prepend() {}, remove() {}, setPointerCapture() {},
    getScreenCTM() { return null; },
    createSVGPoint() { return { matrixTransform() { return { x: 0, y: 0 }; } }; },
  };
  return e;
}

// The page has three src= script tags (params, control, protocol) and one
// inline block. indexOf, not a tag regexp, so CodeQL does not flag it.
function inlineScript() {
  const open = '<script>';
  const close = '</script>';
  const start = html.indexOf(open);
  assert.ok(start > 0, 'lab has an inline script');
  const end = html.indexOf(close, start);
  assert.ok(end > start);
  assert.equal(html.indexOf(open, end), -1, 'lab has exactly one inline script');
  return html.slice(start + open.length, end);
}

function loadLab() {
  const els = new Map();
  const document = {
    getElementById(id) {
      if (!els.has(id)) els.set(id, fakeEl());
      return els.get(id);
    },
    createElement() { return fakeEl(); },
    querySelectorAll() { return []; },
  };
  const ctx = vm.createContext({ document, setInterval() { return 0; }, console });
  for (const lib of ['src/lib/control-params.js', 'src/lib/control.js', 'src/lib/protocol.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, lib), 'utf8'), ctx, { filename: lib });
  }
  vm.runInContext(inlineScript(), ctx, { filename: 'lab/index.html' });
  return { ctx, els, get: (expr) => vm.runInContext(expr, ctx) };
}

test('lab: POST /stop button exists and goes through protocol.js like every other command', () => {
  assert.match(html, /id="cmdStop"/);
  assert.match(html, /httpCall\('POST', '\/stop'/);
  assert.match(html, /res\.effect\.stop/);
  assert.match(html, /stepper\.stop\(\)/);
});

test('lab: /stop mid-move halts the simulated stepper where it is, auto stays off', () => {
  const lab = loadLab();
  const stepsPerDeg = lab.get('STEPS_PER_DEGREE');

  lab.ctx.httpCall('POST', '/set-angle', { deg: '15' });
  assert.equal(lab.get('autoMode'), false);
  assert.equal(lab.get('targetSteps'), Math.round(15 * stepsPerDeg));
  for (let i = 0; i < 3; i++) lab.ctx.tick();
  const before = lab.get('currentSteps');
  assert.ok(before < lab.get('targetSteps'), 'still mid-move after three ticks');

  const res = lab.ctx.httpCall('POST', '/stop', {});
  assert.equal(res.status, 200);
  // res.body was built inside the vm realm, so strict deepEqual sees a foreign
  // Object prototype; compare the JSON the board would have sent instead.
  assert.equal(JSON.stringify(res.body), '{"ok":true}');
  assert.equal(lab.get('autoMode'), false);
  assert.equal(lab.get('targetSteps'), before);
  assert.equal(lab.get('targetAngle'), before / stepsPerDeg);

  for (let i = 0; i < 10; i++) lab.ctx.tick();
  assert.equal(lab.get('currentSteps'), before, 'nothing re-arms the move');
  assert.equal(lab.get('currentAngle'), lab.get('targetAngle'));

  const btn = lab.els.get('cmdStop');
  assert.ok(btn && btn.listeners.click && btn.listeners.click.length === 1, 'button wired once');
});

test('lab: /stop during auto turns auto off; set-mode auto=1 brings it back', () => {
  const lab = loadLab();
  assert.equal(lab.get('autoMode'), true);

  lab.ctx.httpCall('POST', '/stop', {});
  assert.equal(lab.get('autoMode'), false);
  const steps = lab.get('currentSteps');
  for (let i = 0; i < 10; i++) lab.ctx.tick();
  assert.equal(lab.get('currentSteps'), steps);

  lab.ctx.httpCall('POST', '/set-mode', { auto: '1' });
  assert.equal(lab.get('autoMode'), true);
});

test('lab: /stop over a cut WiFi is unreachable and changes nothing', () => {
  const lab = loadLab();
  lab.ctx.httpCall('POST', '/set-angle', { deg: '15' });
  const target = lab.get('targetSteps');
  lab.get('wifiUp = false');
  assert.equal(lab.ctx.httpCall('POST', '/stop', {}), null);
  assert.equal(lab.get('targetSteps'), target, 'the local loop keeps its goal');
});
