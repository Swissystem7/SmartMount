// lab/index.html is the only host page whose stepper takes time to arrive
// (4 steps per 80 ms tick), so it is the one place where the firmware's three
// targetAngle fixes can be seen — or quietly undone:
//   #40 set-panel re-clamps targetAngle, not the lagging currentAngle;
//   #41 the auto deadband is |next - targetAngle|, hold returns targetAngle,
//       and a sample inside the deadband never rewrites targetAngle;
//   #42 targetAngle is the commanded step / STEPS_PER_DEGREE, so angle == target
//       once the move ends.
// The lab kept running the pre-#40 loop. Run its inline script in node:vm with
// a fake DOM and drive it over HTTP + ticks, the way a visitor clicks it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const control = require('../src/lib/control');
const P = require('../src/lib/control-params');

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

// Three src= script tags (params, control, protocol) and one inline block.
// indexOf, not a tag regexp, so CodeQL does not flag it.
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
  const get = (expr) => vm.runInContext(expr, ctx);
  const settle = () => {
    for (let i = 0; i < 60 && get('currentSteps') !== get('targetSteps'); i++) get('tick()');
  };
  return { ctx, get, settle };
}

test('lab tick(): hold and deadband are measured against targetAngle, and nothing rewrites it inside the deadband', () => {
  const src = inlineScript();
  const tick = src.slice(src.indexOf('function tick()'), src.indexOf('const svg = '));
  assert.ok(tick.length > 0);
  assert.match(tick, /decide\(luxTop, luxBot, targetAngle, panel\)/);
  assert.match(tick, /Math\.abs\(next - targetAngle\) > DEADBAND_DEG/);
  assert.doesNotMatch(tick, /Math\.abs\(next - currentAngle\)/);
  assert.doesNotMatch(tick, /targetAngle = next/);
  // set-panel is moveToAngle(targetAngle) on the board, never currentAngle.
  assert.match(src, /commandMoveTo\(targetAngle, panel\)/);
  assert.doesNotMatch(src, /commandMoveTo\(currentAngle, panel\)/);
  // commandMoveTo stores the quantised step, not the raw clamped request.
  assert.match(src, /targetAngle = r\.target;/);
  assert.doesNotMatch(src, /targetAngle = r\.clamped;/);
});

test('lab /set-angle: target is the quantised step like the board, and angle == target on arrival', () => {
  const lab = loadLab();
  const res = lab.get("httpCall('POST', '/set-angle', { deg: '12.3' })");
  assert.equal(res.status, 200);
  assert.equal(lab.get('autoMode'), false);
  const want = control.moveToAngle(12.3, 'OLED');
  assert.equal(lab.get('targetSteps'), want.steps);
  assert.equal(lab.get('targetAngle'), want.target);
  assert.notEqual(lab.get('targetAngle'), 12.3, 'the raw request is not what the board stores');
  lab.settle();
  assert.equal(lab.get('currentSteps'), want.steps);
  assert.equal(lab.get('currentAngle'), lab.get('targetAngle'), '/status angle == target once the move ends');
});

test('lab /set-panel mid-move: re-clamps the commanded target, never the lagging angle', () => {
  const lab = loadLab();
  // Boot panel is OLED (0, 40°). Two ticks = 8 steps ≈ 2.9° of a 35° move.
  lab.get("httpCall('POST', '/set-angle', { deg: '35' })");
  lab.get('tick()');
  lab.get('tick()');
  const midAngle = lab.get('currentAngle');
  assert.ok(midAngle > 0 && midAngle < 5, 'mid-move angle: ' + midAngle);
  // A ceiling the target still fits under leaves it alone.
  lab.get("httpCall('POST', '/set-panel', { type: '0' })");
  const oled = control.moveToAngle(35, 'OLED');
  assert.equal(lab.get('targetSteps'), oled.steps);
  assert.equal(lab.get('targetAngle'), oled.target);
  // QLED (30°) shortens the move to the new limit — not to where the arm is.
  lab.get("httpCall('POST', '/set-panel', { type: '1' })");
  const qled = control.moveToAngle(35, 'QLED');
  assert.equal(lab.get('panel'), 1);
  assert.equal(lab.get('targetSteps'), qled.steps);
  assert.equal(lab.get('targetAngle'), qled.target);
  assert.ok(lab.get('targetAngle') > midAngle, 'the move keeps going forward instead of reversing');
});

test('lab auto loop: a sample inside the deadband of the target leaves targetAngle as the stepper goal', () => {
  const lab = loadLab();
  lab.get("httpCall('POST', '/set-angle', { deg: '10' })");
  lab.settle();
  const at = control.moveToAngle(10, 'OLED');
  assert.equal(lab.get('targetAngle'), at.target);
  // Pin the law 0.4° above the target, inside DEADBAND_DEG. The real law reads
  // the room geometry; the loop around it, not the law, is under test here.
  const inside = at.target + P.deadbandDeg * 0.4;
  lab.get('calcOptimalAngle = function () { return ' + inside + '; }');
  lab.get("httpCall('POST', '/set-mode', { auto: '1' })");
  assert.equal(lab.get('autoMode'), true);
  lab.get('tick()');
  lab.get('tick()');
  assert.equal(lab.get('targetAngle'), at.target, 'targetAngle must stay what the stepper is heading to');
  assert.equal(lab.get('targetSteps'), at.steps);
  assert.equal(lab.get('currentAngle'), at.target, 'no move inside the deadband');
  // Past the deadband the loop does command a new moveTo, quantised.
  const outside = at.target + P.deadbandDeg * 1.5;
  lab.get('calcOptimalAngle = function () { return ' + outside + '; }');
  lab.get('tick()');
  const moved = control.moveToAngle(outside, 'OLED');
  assert.equal(lab.get('targetSteps'), moved.steps);
  assert.equal(lab.get('targetAngle'), moved.target);
});

test('lab auto loop mid-move: a failed read holds the commanded target while the arm keeps walking', () => {
  const lab = loadLab();
  lab.get("httpCall('POST', '/set-angle', { deg: '30' })");
  lab.get("httpCall('POST', '/set-mode', { auto: '1' })");
  lab.get('failTop = true');
  const want = control.moveToAngle(30, 'OLED');
  const before = lab.get('currentSteps');
  lab.get('tick()');
  lab.get('tick()');
  assert.equal(lab.get('targetSteps'), want.steps, 'hold keeps the stepper goal');
  assert.equal(lab.get('targetAngle'), want.target);
  assert.ok(lab.get('currentSteps') > before, 'the move in flight continues');
});
