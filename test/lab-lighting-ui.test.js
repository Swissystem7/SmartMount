const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'lab/index.html'), 'utf8');

function assertPressed(btn, on) {
  assert.equal(btn.classList.contains('on'), on, `${btn.id || btn.dataset?.preset} class 'on' mismatch`);
  assert.equal(btn.getAttribute('aria-pressed'), String(on), `${btn.id || btn.dataset?.preset} aria-pressed mismatch`);
}

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  let text = initial.text || '';
  let val = initial.value !== undefined ? String(initial.value) : '0';
  const children = [];
  const el = {
    id,
    get value() { return val; },
    set value(v) { val = String(v); },
    checked: initial.checked || false,
    attrs,
    dataset: initial.dataset || {},
    style: {},
    children,
    get innerHTML() { return text; },
    set innerHTML(v) { text = String(v); },
    get textContent() { return text; },
    set textContent(v) {
      text = String(v);
      if (!text) children.length = 0;
    },
    get className() { return [...classes].join(' '); },
    set className(v) {
      classes.clear();
      if (v) v.trim().split(/\s+/).forEach((c) => classes.add(c));
    },
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) classes.delete(c);
          else classes.add(c);
        } else if (force) classes.add(c);
        else classes.delete(c);
      },
      contains: (c) => classes.has(c),
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] !== undefined ? attrs[k] : null; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      (listeners['click'] || []).forEach((fn) => fn.call(el, { preventDefault() {} }));
    },
    input(newVal) {
      if (newVal !== undefined) val = String(newVal);
      (listeners['input'] || []).forEach((fn) => fn.call(el, { preventDefault() {} }));
    },
    keydown(key, shiftKey = false) {
      (listeners['keydown'] || []).forEach((fn) => fn.call(el, { key, shiftKey, preventDefault() {} }));
    },
    querySelector(sel) {
      return children.find((c) => c.matches && c.matches(sel)) || fakeElement('sub');
    },
    querySelectorAll(sel) {
      return children.filter((c) => c.matches && c.matches(sel));
    },
    prepend(child) { children.unshift(child); },
    appendChild(child) { children.push(child); },
    lastChild: null,
    remove() {},
    setPointerCapture() {},
    getScreenCTM() { return null; },
    createSVGPoint() { return { matrixTransform() { return { x: 0, y: 0 }; } }; },
  };
  return el;
}

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

function loadLabPage() {
  const presetWindow = fakeElement('pWindow', {
    text: 'אור בחלון (בוהק)',
    attrs: { 'aria-pressed': 'true', 'data-preset': 'window' },
    classes: ['btn', 'on'],
    dataset: { preset: 'window' },
  });
  const presetOverhead = fakeElement('pOverhead', {
    text: 'מנורת תקרה',
    attrs: { 'aria-pressed': 'false', 'data-preset': 'overhead' },
    classes: ['btn'],
    dataset: { preset: 'overhead' },
  });
  const presetDirect = fakeElement('pDirect', {
    text: 'מול החיישן',
    attrs: { 'aria-pressed': 'false', 'data-preset': 'direct' },
    classes: ['btn'],
    dataset: { preset: 'direct' },
  });
  const presetLow = fakeElement('pLow', {
    text: 'אור צד נמוך',
    attrs: { 'aria-pressed': 'false', 'data-preset': 'low' },
    classes: ['btn'],
    dataset: { preset: 'low' },
  });

  const allPresetBtns = [presetWindow, presetOverhead, presetDirect, presetLow];

  const sunX = fakeElement('sunX', {
    value: '695',
    attrs: {
      min: '40', max: '760', dir: 'ltr',
      'aria-valuemin': '40', 'aria-valuemax': '760',
      'aria-valuenow': '695', 'aria-valuetext': 'אופקי 695 פיקסלים',
    },
  });
  const sunY = fakeElement('sunY', {
    value: '90',
    attrs: {
      min: '24', max: '300', dir: 'ltr',
      'aria-valuemin': '24', 'aria-valuemax': '300',
      'aria-valuenow': '90', 'aria-valuetext': 'אנכי 90 פיקסלים',
    },
  });
  const sunXVal = fakeElement('sunXVal', { text: '695' });
  const sunYVal = fakeElement('sunYVal', { text: '90' });
  const sun = fakeElement('sun', { attrs: { tabindex: '0', role: 'img' } });
  const room = fakeElement('room');
  const tv = fakeElement('tv');
  const naiveGhost = fakeElement('naiveGhost');
  const rayTop = fakeElement('rayTop');
  const rayBot = fakeElement('rayBot');
  const log = fakeElement('log');
  const logCount = fakeElement('logCount', { text: '0 הודעות ביומן' });
  const clearLog = fakeElement('clearLog');
  const serialLog = fakeElement('serialLog');
  const httpLog = fakeElement('httpLog');
  const badgeAuto = fakeElement('badgeAuto');
  const badgeWifi = fakeElement('badgeWifi');
  const badgeI2c = fakeElement('badgeI2c');
  const mTop = fakeElement('mTop');
  const mBot = fakeElement('mBot');
  const mRatio = fakeElement('mRatio');
  const mDec = fakeElement('mDec');
  const mCur = fakeElement('mCur');
  const mTgt = fakeElement('mTgt');

  const p0 = fakeElement('p0', { dataset: { panel: '0' }, classes: ['btn', 'on'], attrs: { 'aria-pressed': 'true' } });
  const p1 = fakeElement('p1', { dataset: { panel: '1' }, classes: ['btn'], attrs: { 'aria-pressed': 'false' } });
  const p2 = fakeElement('p2', { dataset: { panel: '2' }, classes: ['btn'], attrs: { 'aria-pressed': 'false' } });

  const failTop = fakeElement('failTop', { classes: ['btn'], attrs: { 'aria-pressed': 'false' } });
  const failBot = fakeElement('failBot', { classes: ['btn'], attrs: { 'aria-pressed': 'false' } });
  const failI2c = fakeElement('failI2c', { classes: ['btn'], attrs: { 'aria-pressed': 'false' } });
  const cutWifi = fakeElement('cutWifi', { classes: ['btn'], attrs: { 'aria-pressed': 'false' } });
  const showNaive = fakeElement('showNaive', { classes: ['btn'], attrs: { 'aria-pressed': 'false' } });
  const cmdOver = fakeElement('cmdOver');
  const cmdStop = fakeElement('cmdStop');
  const cmdAuto = fakeElement('cmdAuto');
  const bootLie = fakeElement('bootLie', { classes: ['btn'], attrs: { 'aria-pressed': 'false' } });
  const cmd15 = fakeElement('cmd15');

  const registry = new Map([
    ['room', room],
    ['tv', tv],
    ['naiveGhost', naiveGhost],
    ['rayTop', rayTop],
    ['rayBot', rayBot],
    ['sun', sun],
    ['sunX', sunX],
    ['sunY', sunY],
    ['sunXVal', sunXVal],
    ['sunYVal', sunYVal],
    ['log', log],
    ['logCount', logCount],
    ['clearLog', clearLog],
    ['serialLog', serialLog],
    ['httpLog', httpLog],
    ['badgeAuto', badgeAuto],
    ['badgeWifi', badgeWifi],
    ['badgeI2c', badgeI2c],
    ['mTop', mTop],
    ['mBot', mBot],
    ['mRatio', mRatio],
    ['mDec', mDec],
    ['mCur', mCur],
    ['mTgt', mTgt],
    ['p0', p0],
    ['p1', p1],
    ['p2', p2],
    ['failTop', failTop],
    ['failBot', failBot],
    ['failI2c', failI2c],
    ['cutWifi', cutWifi],
    ['showNaive', showNaive],
    ['cmdOver', cmdOver],
    ['cmdStop', cmdStop],
    ['cmdAuto', cmdAuto],
    ['bootLie', bootLie],
    ['cmd15', cmd15],
  ]);

  const document = {
    getElementById: (id) => registry.get(id) || fakeElement(id),
    createElement: (tag) => fakeElement(tag),
    querySelectorAll: (sel) => {
      if (sel === '#lightPresets [data-preset]') return allPresetBtns;
      if (sel === '[data-panel]') return [p0, p1, p2];
      return [];
    },
  };

  const ctx = vm.createContext({
    document,
    setInterval: () => 0,
    console,
    Math,
    Number,
    String,
    Date,
    JSON,
  });

  for (const lib of ['src/lib/control-params.js', 'src/lib/control.js', 'src/lib/protocol.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, lib), 'utf8'), ctx, { filename: lib });
  }
  vm.runInContext(inlineScript(), ctx, { filename: 'lab/index.html' });

  return {
    ctx,
    sunX,
    sunY,
    sunXVal,
    sunYVal,
    sun,
    log,
    logCount,
    clearLog,
    presets: {
      window: presetWindow,
      overhead: presetOverhead,
      direct: presetDirect,
      low: presetLow,
    },
  };
}

test('lab page HTML includes lightPresets toolbar with 4 preset buttons', () => {
  assert.match(html, /id="lightPresets"/);
  assert.match(html, /role="group"[^>]*aria-label="תרחישי תאורה בחדר"/);
  assert.match(html, /data-preset="window"[^>]*aria-pressed="true"/);
  assert.match(html, /data-preset="overhead"[^>]*aria-pressed="false"/);
  assert.match(html, /data-preset="direct"[^>]*aria-pressed="false"/);
  assert.match(html, /data-preset="low"[^>]*aria-pressed="false"/);
});

test('lab page HTML provides dir="ltr" and range accessibility attributes on sun inputs', () => {
  assert.match(html, /id="sunX"[^>]*dir="ltr"[^>]*aria-valuemin="40"[^>]*aria-valuemax="760"[^>]*aria-valuenow="695"/);
  assert.match(html, /id="sunY"[^>]*dir="ltr"[^>]*aria-valuemin="24"[^>]*aria-valuemax="300"[^>]*aria-valuenow="90"/);
});

test('lab page HTML includes accessible focus styling for SVG sun element', () => {
  assert.match(html, /#sun:focus,#sun:focus-visible\{outline:none\}/);
  assert.match(html, /#sun:focus circle:first-child,#sun:focus-visible circle:first-child\{stroke:#58a6ff/);
  assert.match(html, /id="sun"[^>]*tabindex="0"[^>]*role="img"/);
});

test('lab page HTML includes log toolbar with count and clear button', () => {
  assert.match(html, /id="logCount"/);
  assert.match(html, /id="clearLog"[^>]*aria-label="נקה יומן אירועים"/);
});

test('lab page script initializes with window preset active and correct ARIA states', () => {
  const page = loadLabPage();
  assertPressed(page.presets.window, true);
  assertPressed(page.presets.overhead, false);
  assertPressed(page.presets.direct, false);
  assertPressed(page.presets.low, false);
  assert.equal(page.sunX.value, '695');
  assert.equal(page.sunY.value, '90');
  assert.equal(page.sunX.getAttribute('aria-valuenow'), '695');
  assert.equal(page.sunY.getAttribute('aria-valuenow'), '90');
});

test('clicking an inactive lighting preset moves the light and synchronizes aria-pressed state', () => {
  const page = loadLabPage();

  page.presets.overhead.click();
  assertPressed(page.presets.window, false);
  assertPressed(page.presets.overhead, true);
  assertPressed(page.presets.direct, false);
  assertPressed(page.presets.low, false);
  assert.equal(page.sunX.value, '400');
  assert.equal(page.sunY.value, '36');
  assert.equal(page.sunX.getAttribute('aria-valuenow'), '400');
  assert.equal(page.sunY.getAttribute('aria-valuenow'), '36');
  assert.equal(page.sunXVal.textContent, '400');
  assert.equal(page.sunYVal.textContent, '36');

  page.presets.direct.click();
  assertPressed(page.presets.overhead, false);
  assertPressed(page.presets.direct, true);
  assert.equal(page.sunX.value, '520');
  assert.equal(page.sunY.value, '160');

  page.presets.low.click();
  assertPressed(page.presets.direct, false);
  assertPressed(page.presets.low, true);
  assert.equal(page.sunX.value, '160');
  assert.equal(page.sunY.value, '240');
});

test('moving sun slider to custom coordinate deactivates all lighting presets', () => {
  const page = loadLabPage();
  assertPressed(page.presets.window, true);

  // Move slider to custom position
  page.sunX.input('450');
  assertPressed(page.presets.window, false);
  assertPressed(page.presets.overhead, false);
  assertPressed(page.presets.direct, false);
  assertPressed(page.presets.low, false);
  assert.equal(page.sunX.getAttribute('aria-valuenow'), '450');
  assert.equal(page.sunXVal.textContent, '450');
});

test('clearLog button empties the log container and updates logCount', () => {
  const page = loadLabPage();
  assert.ok(page.log.children.length > 0);
  assert.match(page.logCount.textContent, /הודע/);

  page.clearLog.click();
  assert.equal(page.log.children.length, 0);
  assert.equal(page.logCount.textContent, 'אין הודעות ביומן');
});
