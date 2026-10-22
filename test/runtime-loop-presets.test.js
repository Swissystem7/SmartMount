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

function loadRuntimeLoopPage() {
  const bTypical = fakeElement('btn-typical', {
    text: 'טיפוסי (8 / 2 ms)',
    attrs: { 'aria-pressed': 'true' },
    classes: ['btn', 'on'],
    dataset: { loopPreset: 'typical' },
  });
  const bStarve = fakeElement('btn-starve', {
    text: 'הרעבת פולסים (18 / 2 ms)',
    attrs: { 'aria-pressed': 'false' },
    classes: ['btn'],
    dataset: { loopPreset: 'starve' },
  });
  const bWire = fakeElement('btn-wire', {
    text: 'תקיעת I²C (8 / 25 ms)',
    attrs: { 'aria-pressed': 'false' },
    classes: ['btn'],
    dataset: { loopPreset: 'wire' },
  });
  const loopButtons = [bTypical, bStarve, bWire];

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
      if (sel === '[data-loop-preset]') return loopButtons;
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

  return { inputs, loopButtons };
}

const byKey = (buttons, key) => buttons.find((b) => b.dataset.loopPreset === key);

test('runtime page HTML contains loop preset buttons with initial aria-pressed attributes', () => {
  const html = read('runtime/index.html');
  assert.match(html, /<button type="button" class="btn on" data-loop-preset="typical" aria-pressed="true">/);
  assert.match(html, /<button type="button" class="btn" data-loop-preset="starve" aria-pressed="false">/);
  assert.match(html, /<button type="button" class="btn" data-loop-preset="wire" aria-pressed="false">/);
});

test('runtime page initializes loop preset buttons with typical active and aria-pressed=true', () => {
  const { loopButtons, inputs } = loadRuntimeLoopPage();
  const bTypical = byKey(loopButtons, 'typical');
  const bStarve = byKey(loopButtons, 'starve');
  const bWire = byKey(loopButtons, 'wire');

  assert.ok(bTypical.classList.contains('on'), 'typical button should have "on" class initially');
  assert.equal(bTypical.getAttribute('aria-pressed'), 'true', 'typical should have aria-pressed=true');

  assert.ok(!bStarve.classList.contains('on'), 'starve button should not be on');
  assert.equal(bStarve.getAttribute('aria-pressed'), 'false', 'starve should have aria-pressed=false');

  assert.ok(!bWire.classList.contains('on'), 'wire button should not be on');
  assert.equal(bWire.getAttribute('aria-pressed'), 'false', 'wire should have aria-pressed=false');

  assert.equal(inputs.httpMs.getAttribute('aria-valuenow'), '8');
  assert.equal(inputs.i2cMs.getAttribute('aria-valuenow'), '2');
});

test('clicking starve preset updates sliders, verdict, and switches active and aria-pressed state', () => {
  const { inputs, loopButtons } = loadRuntimeLoopPage();
  const bTypical = byKey(loopButtons, 'typical');
  const bStarve = byKey(loopButtons, 'starve');

  bStarve.fire('click');

  assert.equal(inputs.httpMs.value, '18');
  assert.equal(inputs.i2cMs.value, '2');
  assert.ok(bStarve.classList.contains('on'), 'starve button should have "on" class');
  assert.equal(bStarve.getAttribute('aria-pressed'), 'true', 'starve button should have aria-pressed=true');
  assert.ok(!bTypical.classList.contains('on'), 'typical button should lose "on" class');
  assert.equal(bTypical.getAttribute('aria-pressed'), 'false', 'typical button should have aria-pressed=false');

  assert.equal(inputs.kStarve.textContent, 'מורעבים');
  assert.ok(inputs.lVerdict.className.includes('bad'));
});

test('clicking wire preset updates sliders and switches active and aria-pressed state', () => {
  const { inputs, loopButtons } = loadRuntimeLoopPage();
  const bTypical = byKey(loopButtons, 'typical');
  const bWire = byKey(loopButtons, 'wire');

  bWire.fire('click');

  assert.equal(inputs.httpMs.value, '8');
  assert.equal(inputs.i2cMs.value, '25');
  assert.ok(bWire.classList.contains('on'), 'wire button should have "on" class');
  assert.equal(bWire.getAttribute('aria-pressed'), 'true', 'wire button should have aria-pressed=true');
  assert.ok(!bTypical.classList.contains('on'), 'typical button should lose "on" class');
  assert.equal(bTypical.getAttribute('aria-pressed'), 'false', 'typical button should have aria-pressed=false');
});

test('moving sliders to custom values deactivates loop preset buttons', () => {
  const { inputs, loopButtons } = loadRuntimeLoopPage();

  inputs.httpMs.value = '14';
  inputs.i2cMs.value = '5';
  inputs.httpMs.fire('input');

  loopButtons.forEach((b) => {
    assert.ok(!b.classList.contains('on'), 'no button should have "on" class for custom values');
    assert.equal(b.getAttribute('aria-pressed'), 'false', 'all buttons should have aria-pressed=false');
  });

  // Setting sliders back to typical (8ms, 2ms) re-activates typical button
  inputs.httpMs.value = '8';
  inputs.i2cMs.value = '2';
  inputs.httpMs.fire('input');

  const bTypical = byKey(loopButtons, 'typical');
  assert.ok(bTypical.classList.contains('on'), 'typical button should re-activate when sliders match');
  assert.equal(bTypical.getAttribute('aria-pressed'), 'true', 'typical button should have aria-pressed=true');
});

test('sliders have dir=ltr and direction:ltr style for correct RTL scrubbing', () => {
  const html = read('runtime/index.html');
  assert.match(html, /direction:ltr/);
  assert.match(html, /id="httpMs"[^>]*dir="ltr"/);
  assert.match(html, /id="i2cMs"[^>]*dir="ltr"/);
});
