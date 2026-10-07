// dashboard/ runs its inline script in node:vm against a fake DOM, so the
// angle it shows is checked against what the board reports in /status: the
// rounded step from moveToAngle (#42), not the unquantised request.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { moveToAngle } = require('../src/lib/control');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function fakeEl(id, attrs = {}) {
  const listeners = {};
  const b = { textContent: '' };
  return {
    id,
    value: attrs.value || '0',
    min: '',
    max: '',
    disabled: false,
    textContent: '',
    className: '',
    style: {},
    attrs,
    classList: { toggle() {} },
    setAttribute(k, v) { attrs[k] = v; },
    getAttribute(k) { return attrs[k]; },
    addEventListener(type, fn) { listeners[type] = fn; },
    querySelector() { return b; },
    fire(type) { listeners[type](); },
    b,
  };
}

function loadDashboard() {
  const els = {};
  const get = (id) => (els[id] = els[id] || fakeEl(id));
  const panels = ['OLED', 'QLED', 'LED'].map((p) => fakeEl('panel-' + p, { 'data-panel': p }));
  const document = {
    getElementById: get,
    querySelectorAll: (sel) => (sel === '[data-panel]' ? panels : []),
  };
  const ctx = vm.createContext({ document });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/control.js'), ctx);
  const html = read('dashboard/index.html');
  // The page's own file, not untrusted input: slice the one bare <script>.
  const open = html.indexOf('<script>');
  assert.ok(open >= 0 && html.indexOf('<script>', open + 1) < 0, 'dashboard has one inline script');
  const body = html.slice(open + '<script>'.length, html.indexOf('</script>', open));
  vm.runInContext(body, ctx);

  const ui = {
    setLux(top, bot) {
      get('luxTop').value = String(top);
      get('luxBot').value = String(bot);
      get('luxTop').fire('input');
    },
    panel(name) { panels.find((p) => p.attrs['data-panel'] === name).fire('click'); },
    toggleMode() { get('modeBtn').fire('click'); },
    manual(deg) { get('manual').value = String(deg); get('manual').fire('input'); },
    angle() { return get('angleVal').textContent; },
    rotate() { return get('tvWrap').style.transform; },
    decision() { return get('mDec').b.textContent; },
  };
  return ui;
}

const shown = (deg) => deg.toFixed(1) + '°';

test('manual 12.3° shows the 34-step target 12.24°, like /status', () => {
  const ui = loadDashboard();
  ui.toggleMode();
  ui.manual(12.3);
  const t = moveToAngle(12.3, 'LED').target;
  assert.equal(ui.angle(), shown(t));
  assert.equal(ui.rotate(), 'rotate(' + t + 'deg)');
  assert.notEqual(t, 12.3);
});

test('auto tilt is the rounded step of the law output', () => {
  const ui = loadDashboard();
  // ratio 5.46 -> (5.46 - 3) * 5 = 12.3° -> 34 steps
  ui.setLux(546, 100);
  assert.equal(ui.rotate(), 'rotate(' + moveToAngle(12.3, 'LED').target + 'deg)');
});

test('QLED cap is 83 steps = 29.88°, and the dashboard still says CLAMP', () => {
  const ui = loadDashboard();
  ui.panel('QLED');
  ui.setLux(100000, 100);
  const cap = moveToAngle(30, 'QLED').target;
  assert.ok(cap < 30, 'the quantised cap sits under the limit');
  assert.equal(ui.angle(), shown(cap));
  assert.equal(ui.decision(), 'CLAMP 30°');
});

test('panel switch re-clamps to the new cap through moveToAngle', () => {
  const ui = loadDashboard();
  ui.panel('OLED');
  ui.setLux(100000, 100);
  assert.equal(ui.angle(), shown(moveToAngle(40, 'OLED').target));
  ui.panel('QLED');
  assert.equal(ui.angle(), shown(moveToAngle(30, 'QLED').target));
});

test('failed read holds the shown target', () => {
  const ui = loadDashboard();
  ui.setLux(546, 100);
  const before = ui.angle();
  ui.setLux(-1, 100);
  assert.equal(ui.angle(), before);
  assert.equal(ui.decision(), 'HOLD');
});
