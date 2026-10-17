const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  let text = initial.text || '';
  return {
    id,
    value: initial.value || '0',
    checked: initial.checked !== undefined ? initial.checked : false,
    attrs,
    dataset: initial.dataset || {},
    style: {},
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
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    fire(type) {
      (listeners[type] || []).forEach((fn) => fn());
    },
  };
}

function loadRuntimeUi() {
  const degButtons = [
    fakeElement('btn-20', { text: 'LED 20°', attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { deg: '20' } }),
    fakeElement('btn-30', { text: 'QLED 30°', attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { deg: '30' } }),
    fakeElement('btn-40', { text: 'OLED 40°', attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'], dataset: { deg: '40' } }),
  ];

  const loopButtons = [
    fakeElement('btn-loop-typical', { text: 'טיפוסי', attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'], dataset: { loopPreset: 'typical' } }),
    fakeElement('btn-loop-starve', { text: 'הרעבת פולסים', attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { loopPreset: 'starve' } }),
    fakeElement('btn-loop-wire', { text: 'תקיעת I²C', attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { loopPreset: 'wire' } }),
  ];

  const wifiButtons = [
    fakeElement('btn-wifi-instant', { text: 'חיבור מיידי', attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { wifiPreset: 'instant' } }),
    fakeElement('btn-wifi-typical', { text: 'חיבור טיפוסי', attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { wifiPreset: 'typical' } }),
    fakeElement('btn-wifi-timeout', { text: 'Timeout', attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'], dataset: { wifiPreset: 'timeout' } }),
  ];

  const inputs = {
    leadVmax: fakeElement('leadVmax'),
    leadVmax2: fakeElement('leadVmax2'),
    leadAccel: fakeElement('leadAccel'),
    leadSample: fakeElement('leadSample'),
    vel: fakeElement('vel'),
    vmaxLine: fakeElement('vmaxLine'),
    sampleMark: fakeElement('sampleMark'),
    sampleLbl: fakeElement('sampleLbl'),
    fromDeg: fakeElement('fromDeg', { value: '0' }),
    toDeg: fakeElement('toDeg', { value: '40' }),
    fromLbl: fakeElement('fromLbl', { text: '0' }),
    toLbl: fakeElement('toLbl', { text: '40' }),
    kKind: fakeElement('kKind'),
    kSteps: fakeElement('kSteps'),
    kPeak: fakeElement('kPeak'),
    kMove: fakeElement('kMove'),
    kBest: fakeElement('kBest'),
    kWorst: fakeElement('kWorst'),
    profileNote: fakeElement('profileNote'),
    tVerdict: fakeElement('tVerdict'),
    httpMs: fakeElement('httpMs', { value: '8' }),
    i2cMs: fakeElement('i2cMs', { value: '2' }),
    httpLbl: fakeElement('httpLbl'),
    i2cLbl: fakeElement('i2cLbl'),
    kInterval: fakeElement('kInterval'),
    kSlack: fakeElement('kSlack'),
    kStarve: fakeElement('kStarve'),
    kWdt: fakeElement('kWdt'),
    lVerdict: fakeElement('lVerdict'),
    wifiMs: fakeElement('wifiMs', { value: '10000' }),
    wifiLbl: fakeElement('wifiLbl'),
    kBlock: fakeElement('kBlock'),
    kPolls: fakeElement('kPolls'),
    wifiNote: fakeElement('wifiNote'),
    bars: fakeElement('bars'),
    moves: fakeElement('moves', { value: '24' }),
    movesLbl: fakeElement('movesLbl'),
    worm: fakeElement('worm', { checked: false }),
    wifiOn: fakeElement('wifiOn', { checked: true }),
    pHold: fakeElement('pHold'),
    pLogic: fakeElement('pLogic'),
    pDay: fakeElement('pDay'),
    pUsb: fakeElement('pUsb'),
    pVerdict: fakeElement('pVerdict'),
    thisSample: fakeElement('thisSample', { checked: true }),
    kBusy: fakeElement('kBusy'),
    kIdle: fakeElement('kIdle'),
    gantt: fakeElement('gantt'),
    phase: fakeElement('phase', { value: '0' }),
    flash: fakeElement('flash', { value: '400' }),
    phaseLbl: fakeElement('phaseLbl'),
    flashLbl: fakeElement('flashLbl'),
    kChain: fakeElement('kChain'),
    kMiss: fakeElement('kMiss'),
    kNeck: fakeElement('kNeck'),
    kWait: fakeElement('kWait'),
    cVerdict: fakeElement('cVerdict'),
  };

  const document = {
    getElementById: (id) => inputs[id] || (inputs[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '[data-deg]') return degButtons;
      if (sel === '[data-loop-preset]') return loopButtons;
      if (sel === '[data-wifi-preset]') return wifiButtons;
      return [];
    },
    createElement: (tag) => fakeElement(tag),
  };

  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/timing.js'), ctx);
  vm.runInContext(read('src/lib/power.js'), ctx);

  const html = read('runtime/index.html');
  const anchor = html.indexOf('src="../src/lib/power.js"');
  assert.ok(anchor > 0, 'runtime page must load power.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { inputs, degButtons, loopButtons, wifiButtons };
}

test('runtime page CSS configures direction:ltr on range sliders', () => {
  const html = read('runtime/index.html');
  assert.match(html, /input\[type=range\]\{accent-color:#58a6ff;direction:ltr\}/);
});

test('runtime page HTML sliders have dir=ltr and ARIA range attributes', () => {
  const html = read('runtime/index.html');
  const sliders = ['fromDeg', 'toDeg', 'httpMs', 'i2cMs', 'wifiMs', 'phase', 'flash', 'moves'];
  for (const id of sliders) {
    const pattern = new RegExp('<input[^>]+id="' + id + '"[^>]*dir="ltr"[^>]*aria-valuemin="[^"]+"');
    assert.match(html, pattern, id + ' slider should have dir=ltr and aria-valuemin');
  }
});

test('runtime page HTML includes accessible loop and wifi preset button rows', () => {
  const html = read('runtime/index.html');
  assert.match(html, /<div class="row" role="group" aria-label="תרחישי לולאה" id="loopPresets">/);
  assert.match(html, /data-loop-preset="typical"/);
  assert.match(html, /data-loop-preset="starve"/);
  assert.match(html, /data-loop-preset="wire"/);

  assert.match(html, /<div class="row" role="group" aria-label="תרחישי חיבור WiFi" id="wifiPresets">/);
  assert.match(html, /data-wifi-preset="instant"/);
  assert.match(html, /data-wifi-preset="typical"/);
  assert.match(html, /data-wifi-preset="timeout"/);
});

test('loop presets initialize with typical active and aria-pressed=true', () => {
  const { loopButtons, inputs } = loadRuntimeUi();
  const typical = loopButtons.find((b) => b.dataset.loopPreset === 'typical');
  const starve = loopButtons.find((b) => b.dataset.loopPreset === 'starve');
  const wire = loopButtons.find((b) => b.dataset.loopPreset === 'wire');

  assert.ok(typical.classList.contains('on'), 'typical should be on initially');
  assert.equal(typical.getAttribute('aria-pressed'), 'true');
  assert.ok(!starve.classList.contains('on'), 'starve should not be on');
  assert.equal(starve.getAttribute('aria-pressed'), 'false');
  assert.ok(!wire.classList.contains('on'), 'wire should not be on');
  assert.equal(wire.getAttribute('aria-pressed'), 'false');

  assert.equal(inputs.httpMs.getAttribute('aria-valuenow'), '8');
  assert.equal(inputs.i2cMs.getAttribute('aria-valuenow'), '2');
});

test('clicking starve loop preset updates inputs, verdicts, and aria-pressed states', () => {
  const { loopButtons, inputs } = loadRuntimeUi();
  const typical = loopButtons.find((b) => b.dataset.loopPreset === 'typical');
  const starve = loopButtons.find((b) => b.dataset.loopPreset === 'starve');

  starve.fire('click');

  assert.equal(inputs.httpMs.value, '18');
  assert.equal(inputs.i2cMs.value, '2');
  assert.ok(starve.classList.contains('on'));
  assert.equal(starve.getAttribute('aria-pressed'), 'true');
  assert.ok(!typical.classList.contains('on'));
  assert.equal(typical.getAttribute('aria-pressed'), 'false');

  assert.equal(inputs.kStarve.textContent, 'מורעבים');
  assert.ok(inputs.lVerdict.className.includes('bad'));
});

test('clicking wire loop preset updates inputs and synchronizes active preset', () => {
  const { loopButtons, inputs } = loadRuntimeUi();
  const wire = loopButtons.find((b) => b.dataset.loopPreset === 'wire');
  const starve = loopButtons.find((b) => b.dataset.loopPreset === 'starve');

  wire.fire('click');

  assert.equal(inputs.httpMs.value, '8');
  assert.equal(inputs.i2cMs.value, '25');
  assert.ok(wire.classList.contains('on'));
  assert.equal(wire.getAttribute('aria-pressed'), 'true');
  assert.ok(!starve.classList.contains('on'));
  assert.equal(starve.getAttribute('aria-pressed'), 'false');
});

test('custom loop slider values deactivate loop presets', () => {
  const { loopButtons, inputs } = loadRuntimeUi();
  inputs.httpMs.value = '14';
  inputs.i2cMs.value = '5';
  inputs.httpMs.fire('input');

  for (const b of loopButtons) {
    assert.ok(!b.classList.contains('on'), b.dataset.loopPreset + ' should not be on');
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }
});

test('wifi presets initialize with timeout active and update upon click', () => {
  const { wifiButtons, inputs } = loadRuntimeUi();
  const instant = wifiButtons.find((b) => b.dataset.wifiPreset === 'instant');
  const typical = wifiButtons.find((b) => b.dataset.wifiPreset === 'typical');
  const timeout = wifiButtons.find((b) => b.dataset.wifiPreset === 'timeout');

  assert.ok(timeout.classList.contains('on'), 'timeout should be on initially');
  assert.equal(timeout.getAttribute('aria-pressed'), 'true');
  assert.ok(!instant.classList.contains('on'));
  assert.equal(instant.getAttribute('aria-pressed'), 'false');
  assert.ok(!typical.classList.contains('on'));
  assert.equal(typical.getAttribute('aria-pressed'), 'false');

  instant.fire('click');
  assert.equal(inputs.wifiMs.value, '0');
  assert.ok(instant.classList.contains('on'));
  assert.equal(instant.getAttribute('aria-pressed'), 'true');
  assert.ok(!timeout.classList.contains('on'));
  assert.equal(timeout.getAttribute('aria-pressed'), 'false');

  typical.fire('click');
  assert.equal(inputs.wifiMs.value, '1600');
  assert.ok(typical.classList.contains('on'));
  assert.equal(typical.getAttribute('aria-pressed'), 'true');
  assert.ok(!instant.classList.contains('on'));
});

test('custom wifi slider value deactivates wifi presets', () => {
  const { wifiButtons, inputs } = loadRuntimeUi();
  inputs.wifiMs.value = '3200';
  inputs.wifiMs.fire('input');

  for (const b of wifiButtons) {
    assert.ok(!b.classList.contains('on'), b.dataset.wifiPreset + ' should not be on');
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }
});
