const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assertPressed(btn, on) {
  assert.equal(btn.classList.contains('on'), on, `expected button ${btn.id || btn.attrs['data-preset'] || btn.attrs['data-panel']} class .on to be ${on}`);
  assert.equal(btn.getAttribute('aria-pressed'), String(on), `expected button ${btn.id || btn.attrs['data-preset'] || btn.attrs['data-panel']} aria-pressed to be ${on}`);
}

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  let text = initial.text || '';
  let val = initial.value !== undefined ? String(initial.value) : '0';
  const children = [];
  const b = { textContent: '' };
  return {
    id,
    get value() { return val; },
    set value(v) { val = String(v); },
    min: initial.min || '',
    max: initial.max || '',
    disabled: initial.disabled !== undefined ? initial.disabled : false,
    checked: initial.checked || false,
    attrs,
    dataset: initial.dataset || {},
    style: {},
    children,
    innerHTML: '',
    b,
    querySelector(sel) {
      if (sel === 'b') return b;
      return null;
    },
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
      (listeners[type] || []).forEach((fn) => fn.call(this, eventObj));
    },
  };
}

function loadDashboardUI() {
  const panels = [
    fakeElement('p-OLED', { attrs: { 'data-panel': 'OLED', 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('p-QLED', { attrs: { 'data-panel': 'QLED', 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('p-LED', { attrs: { 'data-panel': 'LED', 'aria-pressed': 'true' }, classes: ['btn', 'on'] }),
  ];

  const presets = [
    fakeElement('pre-glare', { attrs: { 'data-preset': 'glare', 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('pre-balance', { attrs: { 'data-preset': 'balance', 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('pre-fault', { attrs: { 'data-preset': 'fault', 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('pre-dark', { attrs: { 'data-preset': 'dark', 'aria-pressed': 'false' }, classes: ['btn'] }),
  ];

  const topEl = fakeElement('luxTop', { value: '400', attrs: { dir: 'ltr' } });
  const botEl = fakeElement('luxBot', { value: '200', attrs: { dir: 'ltr' } });
  const manEl = fakeElement('manual', { value: '0', disabled: true, attrs: { dir: 'ltr' } });
  const modeBtn = fakeElement('modeBtn', { text: 'אוטומטי', attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] });
  const tvWrap = fakeElement('tvWrap');
  const angleVal = fakeElement('angleVal', { text: '0°' });
  const mRatio = fakeElement('mRatio');
  const mDec = fakeElement('mDec');
  const luxTopVal = fakeElement('luxTopVal', { text: '400' });
  const luxBotVal = fakeElement('luxBotVal', { text: '200' });
  const manualVal = fakeElement('manualVal', { text: '0' });

  const elements = {
    luxTop: topEl,
    luxBot: botEl,
    manual: manEl,
    modeBtn,
    tvWrap,
    angleVal,
    mRatio,
    mDec,
    luxTopVal,
    luxBotVal,
    manualVal,
  };

  const document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '[data-panel]') return panels;
      if (sel === '[data-preset]') return presets;
      return [];
    },
  };

  const ctx = vm.createContext({ document });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/control.js'), ctx);

  const html = read('dashboard/index.html');
  const open = html.indexOf('<script>');
  assert.ok(open >= 0 && html.indexOf('<script>', open + 1) < 0, 'dashboard has one inline script');
  const body = html.slice(open + '<script>'.length, html.indexOf('</script>', open));
  vm.runInContext(body, ctx);

  return {
    panels,
    presets,
    elements,
    getPanel: (name) => panels.find((p) => p.attrs['data-panel'] === name),
    getPreset: (key) => presets.find((p) => p.attrs['data-preset'] === key),
  };
}

test('dashboard/index.html includes RTL range slider fixes and ARIA structure', () => {
  const html = read('dashboard/index.html');

  // RTL slider fixes
  assert.match(html, /input\[type=range\]\{[^}]*direction:ltr/, 'CSS contains direction:ltr for range inputs');
  assert.match(html, /id="luxTop"[^>]*dir="ltr"/, 'luxTop slider has dir=ltr');
  assert.match(html, /id="luxBot"[^>]*dir="ltr"/, 'luxBot slider has dir=ltr');
  assert.match(html, /id="manual"[^>]*dir="ltr"/, 'manual slider has dir=ltr');

  // Groups and toolbars
  assert.match(html, /role="group"\s+aria-label="סוג פאנל"/, 'panel buttons grouped with aria-label');
  assert.match(html, /role="group"\s+aria-label="תרחישים מהירים"/, 'preset buttons grouped with aria-label');
  assert.match(html, /role="group"\s+aria-label="מצב בקרה"/, 'mode button grouped with aria-label');

  // Live regions
  assert.match(html, /id="angleVal"[^>]*aria-live="polite"/, 'angleVal has aria-live=polite');
  assert.match(html, /id="mRatio"[^>]*aria-live="polite"/, 'mRatio has aria-live=polite');
  assert.match(html, /id="mDec"[^>]*aria-live="polite"/, 'mDec has aria-live=polite');

  // Preset buttons markup
  assert.match(html, /data-preset="glare"/, 'has glare preset');
  assert.match(html, /data-preset="balance"/, 'has balance preset');
  assert.match(html, /data-preset="fault"/, 'has fault preset');
  assert.match(html, /data-preset="dark"/, 'has dark preset');
});

test('dashboard initializes with LED active, auto mode active, and preset buttons unpressed', () => {
  const ui = loadDashboardUI();

  assertPressed(ui.getPanel('LED'), true);
  assertPressed(ui.getPanel('OLED'), false);
  assertPressed(ui.getPanel('QLED'), false);

  assertPressed(ui.elements.modeBtn, true);
  assert.equal(ui.elements.modeBtn.textContent, 'אוטומטי');
  assert.equal(ui.elements.manual.disabled, true);

  ui.presets.forEach((btn) => assertPressed(btn, false));
});

test('clicking preset buttons updates slider values, ARIA state, and decision', () => {
  const ui = loadDashboardUI();

  // Glare preset
  const glareBtn = ui.getPreset('glare');
  glareBtn.fire('click');
  assertPressed(glareBtn, true);
  ui.presets.filter((b) => b !== glareBtn).forEach((b) => assertPressed(b, false));
  assert.equal(ui.elements.luxTop.value, '1200');
  assert.equal(ui.elements.luxBot.value, '200');
  assert.equal(ui.elements.luxTop.getAttribute('aria-valuenow'), '1200');
  assert.equal(ui.elements.luxTop.getAttribute('aria-valuetext'), '1200 lux');
  assert.equal(ui.elements.mRatio.b.textContent, '6.00×');

  // Fault preset
  const faultBtn = ui.getPreset('fault');
  faultBtn.fire('click');
  assertPressed(faultBtn, true);
  assertPressed(glareBtn, false);
  assert.equal(ui.elements.luxTop.value, '-1');
  assert.equal(ui.elements.luxTop.getAttribute('aria-valuetext'), 'כשל חיישן');
  assert.equal(ui.elements.mDec.b.textContent, 'HOLD');

  // Balance preset
  const balBtn = ui.getPreset('balance');
  balBtn.fire('click');
  assertPressed(balBtn, true);
  assertPressed(faultBtn, false);
  assert.equal(ui.elements.luxTop.value, '400');
  assert.equal(ui.elements.luxBot.value, '400');
  assert.equal(ui.elements.mRatio.b.textContent, '1.00×');
  assert.equal(ui.elements.mDec.b.textContent, 'שקט');
});

test('manual slider adjustments deactivate preset buttons', () => {
  const ui = loadDashboardUI();

  const glareBtn = ui.getPreset('glare');
  glareBtn.fire('click');
  assertPressed(glareBtn, true);

  // Moving top slider manually
  ui.elements.luxTop.value = '800';
  ui.elements.luxTop.fire('input');

  // Preset button should now be unpressed
  assertPressed(glareBtn, false);
  ui.presets.forEach((b) => assertPressed(b, false));
});

test('switching between auto and manual modes synchronizes mode button and manual slider', () => {
  const ui = loadDashboardUI();

  // Toggle to manual
  ui.elements.modeBtn.fire('click');
  assertPressed(ui.elements.modeBtn, false);
  assert.equal(ui.elements.modeBtn.textContent, 'ידני');
  assert.equal(ui.elements.manual.disabled, false);

  // Set manual angle
  ui.elements.manual.value = '15';
  ui.elements.manual.fire('input');
  assert.equal(ui.elements.manual.getAttribute('aria-valuenow'), '15');
  assert.equal(ui.elements.manual.getAttribute('aria-valuetext'), '15°');
  assert.equal(ui.elements.mDec.b.textContent, 'ידני');

  // Toggle back to auto
  ui.elements.modeBtn.fire('click');
  assertPressed(ui.elements.modeBtn, true);
  assert.equal(ui.elements.modeBtn.textContent, 'אוטומטי');
  assert.equal(ui.elements.manual.disabled, true);
});

test('switching panel buttons updates panel limits, ARIA states, and slider bounds', () => {
  const ui = loadDashboardUI();

  const oledBtn = ui.getPanel('OLED');
  oledBtn.fire('click');

  assertPressed(oledBtn, true);
  assertPressed(ui.getPanel('LED'), false);
  assertPressed(ui.getPanel('QLED'), false);

  assert.equal(ui.elements.manual.min, '-40');
  assert.equal(ui.elements.manual.max, '40');
  assert.equal(ui.elements.manual.getAttribute('aria-valuemin'), '-40');
  assert.equal(ui.elements.manual.getAttribute('aria-valuemax'), '40');
});
