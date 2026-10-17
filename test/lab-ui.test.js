const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'lab/index.html'), 'utf8');

function assertPressed(btn, on) {
  assert.equal(btn.classList.contains('on'), on, `${btn.id} class 'on' mismatch`);
  assert.equal(btn.getAttribute('aria-pressed'), String(on), `${btn.id} aria-pressed mismatch`);
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
    innerHTML: '',
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
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
    appendChild(child) { children.push(child); return child; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    fire(type, eventObj = {}) {
      if (typeof this['on' + type] === 'function') {
        this['on' + type].call(this, eventObj);
      }
      (listeners[type] || []).forEach((fn) => {
        fn.call(this, eventObj);
      });
    },
    querySelector() { return fakeElement('sub-' + Math.random()); },
    prepend() {}, remove() {}, setPointerCapture() {},
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

function loadLabUi() {
  const elements = new Map();
  function getEl(id) {
    if (!elements.has(id)) {
      elements.set(id, fakeElement(id));
    }
    return elements.get(id);
  }

  // Pre-seed known elements with initial states from HTML
  const initialButtons = {
    cmdAuto: { attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] },
    failTop: { attrs: { 'aria-pressed': 'false' }, classes: ['btn', 'danger'] },
    failBot: { attrs: { 'aria-pressed': 'false' }, classes: ['btn', 'danger'] },
    failI2c: { attrs: { 'aria-pressed': 'false' }, classes: ['btn', 'danger'] },
    cutWifi: { attrs: { 'aria-pressed': 'false' }, classes: ['btn', 'danger'] },
    showNaive: { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] },
    cmdOver: { attrs: {}, classes: ['btn'] },
    cmdStop: { attrs: {}, classes: ['btn', 'danger'] },
    bootLie: { attrs: { 'aria-pressed': 'false' }, classes: ['btn', 'danger'] },
    cmd15: { attrs: {}, classes: ['btn'] },
    p0: { attrs: { 'data-panel': '0', 'aria-pressed': 'true' }, classes: ['btn', 'on'] },
    p1: { attrs: { 'data-panel': '1', 'aria-pressed': 'false' }, classes: ['btn'] },
    p2: { attrs: { 'data-panel': '2', 'aria-pressed': 'false' }, classes: ['btn'] },
  };

  for (const [id, cfg] of Object.entries(initialButtons)) {
    elements.set(id, fakeElement(id, cfg));
  }

  const document = {
    getElementById: (id) => getEl(id),
    createElement: () => fakeElement('el-' + Math.random()),
    querySelectorAll: (sel) => {
      if (sel === '[data-panel]') {
        return [getEl('p0'), getEl('p1'), getEl('p2')];
      }
      return [];
    },
  };

  const ctx = vm.createContext({ document, setInterval() { return 0; }, console });
  for (const lib of ['src/lib/control-params.js', 'src/lib/control.js', 'src/lib/protocol.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, lib), 'utf8'), ctx, { filename: lib });
  }
  vm.runInContext(inlineScript(), ctx, { filename: 'lab/index.html' });

  return { ctx, elements, getEl, get: (expr) => vm.runInContext(expr, ctx) };
}

test('lab/index.html contains accessible toolbar role="group" with aria-labels and aria-live on httpLog', () => {
  assert.ok(html.includes('role="group" aria-label="סוג פאנל"'));
  assert.ok(html.includes('role="group" aria-label="סימולציית כשל חיישנים"'));
  assert.ok(html.includes('role="group" aria-label="בקרת רשת וחוק נאיבי"'));
  assert.ok(html.includes('role="group" aria-label="פקודות תנועה ועצירת חירום"'));
  assert.ok(html.includes('role="group" aria-label="שקר אתחול וכיול"'));
  assert.ok(html.includes('<pre class="mono" id="httpLog" aria-live="polite">'));
});

test('lab UI initializes with cmdAuto active and aria-pressed=true, fault buttons unpressed', () => {
  const { getEl, get } = loadLabUi();
  assert.equal(get('autoMode'), true);

  const cmdAuto = getEl('cmdAuto');
  assertPressed(cmdAuto, true);

  const failTop = getEl('failTop');
  const failBot = getEl('failBot');
  const failI2c = getEl('failI2c');
  const cutWifi = getEl('cutWifi');
  const bootLie = getEl('bootLie');

  assertPressed(failTop, false);
  assertPressed(failBot, false);
  assertPressed(failI2c, false);
  assertPressed(cutWifi, false);
  assertPressed(bootLie, false);

  assert.equal(getEl('badgeAuto').textContent, 'auto ON');
  assert.equal(getEl('badgeWifi').textContent, 'WiFi UP');
  assert.equal(getEl('badgeI2c').textContent, 'I²C OK');
});

test('lab UI synchronizes failTop, failBot and failI2c with badge and aria-pressed', () => {
  const { getEl, get } = loadLabUi();
  const failTop = getEl('failTop');
  const failBot = getEl('failBot');
  const failI2c = getEl('failI2c');
  const badgeI2c = getEl('badgeI2c');

  // Trigger failTop
  failTop.fire('click');
  assert.equal(get('failTop'), true);
  assert.equal(get('failBot'), false);
  assertPressed(failTop, true);
  assertPressed(failBot, false);
  assertPressed(failI2c, false);
  assert.equal(badgeI2c.textContent, 'I²C OK');

  // Trigger failBot -> now both sensors fail, I2C bus is dead
  failBot.fire('click');
  assert.equal(get('failTop'), true);
  assert.equal(get('failBot'), true);
  assertPressed(failTop, true);
  assertPressed(failBot, true);
  assertPressed(failI2c, true);
  assert.equal(badgeI2c.textContent, 'I²C FAIL');

  // Clear failTop -> I2C bus is no longer completely dead
  failTop.fire('click');
  assert.equal(get('failTop'), false);
  assert.equal(get('failBot'), true);
  assertPressed(failTop, false);
  assertPressed(failBot, true);
  assertPressed(failI2c, false);
  assert.equal(badgeI2c.textContent, 'I²C OK');

  // Click failI2c directly -> activates both sensors
  failI2c.fire('click');
  assert.equal(get('failTop'), true);
  assert.equal(get('failBot'), true);
  assertPressed(failTop, true);
  assertPressed(failBot, true);
  assertPressed(failI2c, true);
  assert.equal(badgeI2c.textContent, 'I²C FAIL');

  // Click failI2c again -> clears both sensors
  failI2c.fire('click');
  assert.equal(get('failTop'), false);
  assert.equal(get('failBot'), false);
  assertPressed(failTop, false);
  assertPressed(failBot, false);
  assertPressed(failI2c, false);
  assert.equal(badgeI2c.textContent, 'I²C OK');
});

test('lab UI synchronizes cmdAuto state with /stop, manual commands, and cmdAuto clicks', () => {
  const { getEl, get } = loadLabUi();
  const cmdAuto = getEl('cmdAuto');
  const cmdStop = getEl('cmdStop');
  const cmd15 = getEl('cmd15');
  const badgeAuto = getEl('badgeAuto');

  assertPressed(cmdAuto, true);
  assert.equal(badgeAuto.textContent, 'auto ON');

  // Click cmdStop -> /stop stops auto mode
  cmdStop.fire('click');
  assert.equal(get('autoMode'), false);
  assertPressed(cmdAuto, false);
  assert.equal(badgeAuto.textContent, 'auto OFF (ידני)');

  // Click cmdAuto -> restores auto mode
  cmdAuto.fire('click');
  assert.equal(get('autoMode'), true);
  assertPressed(cmdAuto, true);
  assert.equal(badgeAuto.textContent, 'auto ON');

  // Manual move cmd15 -> turns off auto mode
  cmd15.fire('click');
  assert.equal(get('autoMode'), false);
  assertPressed(cmdAuto, false);
  assert.equal(badgeAuto.textContent, 'auto OFF (ידני)');
});

test('lab UI synchronizes cutWifi button with wifiUp state and badge', () => {
  const { getEl, get } = loadLabUi();
  const cutWifi = getEl('cutWifi');
  const badgeWifi = getEl('badgeWifi');

  assert.equal(get('wifiUp'), true);
  assertPressed(cutWifi, false);
  assert.equal(badgeWifi.textContent, 'WiFi UP');

  // Cut WiFi
  cutWifi.fire('click');
  assert.equal(get('wifiUp'), false);
  assertPressed(cutWifi, true);
  assert.equal(badgeWifi.textContent, 'WiFi DOWN');

  // Restore WiFi
  cutWifi.fire('click');
  assert.equal(get('wifiUp'), true);
  assertPressed(cutWifi, false);
  assert.equal(badgeWifi.textContent, 'WiFi UP');
});

test('lab UI toggles bootLie zero-calibration lie on and off cleanly', () => {
  const { getEl, get } = loadLabUi();
  const bootLie = getEl('bootLie');

  assert.equal(get('lieOffset'), 0);
  assertPressed(bootLie, false);

  // Click bootLie: injects lie offset
  bootLie.fire('click');
  assert.notEqual(get('lieOffset'), 0);
  assertPressed(bootLie, true);

  // Click bootLie again: restores truthful calibration
  bootLie.fire('click');
  assert.equal(get('lieOffset'), 0);
  assertPressed(bootLie, false);
});
