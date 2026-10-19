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

function loadRuntimePage() {
  const b20 = fakeElement('btn-20', {
    text: 'LED 20°',
    attrs: { 'aria-pressed': 'false' },
    classes: ['btn'],
    dataset: { deg: '20' },
  });
  const b30 = fakeElement('btn-30', {
    text: 'QLED 30°',
    attrs: { 'aria-pressed': 'false' },
    classes: ['btn'],
    dataset: { deg: '30' },
  });
  const b40 = fakeElement('btn-40', {
    text: 'OLED 40°',
    attrs: { 'aria-pressed': 'true' },
    classes: ['btn', 'on'],
    dataset: { deg: '40' },
  });
  const buttons = [b20, b30, b40];

  const presetRow = (attr, keys, activeKey) => keys.map((key) => fakeElement('btn-' + attr + '-' + key, {
    attrs: { 'aria-pressed': key === activeKey ? 'true' : 'false' },
    classes: key === activeKey ? ['btn', 'on'] : ['btn'],
    dataset: { [attr]: key },
  }));
  const loopButtons = presetRow('loopPreset', ['typical', 'starve', 'wire'], 'typical');
  const wifiButtons = presetRow('wifiPreset', ['instant', 'typical', 'timeout'], 'timeout');

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
      if (sel === '[data-deg]') return buttons;
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

  return { inputs, buttons, loopButtons, wifiButtons };
}

const byKey = (btns, attr, key) => btns.find((b) => b.dataset[attr] === key);
const assertPressed = (b, on) => {
  const what = JSON.stringify(b.dataset);
  assert.equal(b.classList.contains('on'), on, what + ' should' + (on ? '' : ' not') + ' have the "on" class');
  assert.equal(b.getAttribute('aria-pressed'), on ? 'true' : 'false', what + ' aria-pressed');
};

test('runtime page HTML contains preset buttons with initial aria-pressed attributes', () => {
  const html = read('runtime/index.html');
  assert.match(html, /<button type="button" class="btn" data-deg="20" aria-pressed="false">LED 20°<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-deg="30" aria-pressed="false">QLED 30°<\/button>/);
  assert.match(html, /<button type="button" class="btn on" data-deg="40" aria-pressed="true">OLED 40°<\/button>/);
});

test('runtime page initializes preset buttons with OLED 40 active and aria-pressed=true', () => {
  const { buttons } = loadRuntimePage();
  const b20 = buttons.find((b) => b.dataset.deg === '20');
  const b30 = buttons.find((b) => b.dataset.deg === '30');
  const b40 = buttons.find((b) => b.dataset.deg === '40');

  assert.ok(b40.classList.contains('on'), '40° button should have "on" class initially');
  assert.equal(b40.getAttribute('aria-pressed'), 'true', '40° button should have aria-pressed=true');

  assert.ok(!b20.classList.contains('on'), '20° button should not be on');
  assert.equal(b20.getAttribute('aria-pressed'), 'false', '20° button should have aria-pressed=false');

  assert.ok(!b30.classList.contains('on'), '30° button should not be on');
  assert.equal(b30.getAttribute('aria-pressed'), 'false', '30° button should have aria-pressed=false');
});

test('clicking a preset button updates sliders and switches active and aria-pressed state', () => {
  const { inputs, buttons } = loadRuntimePage();
  const b20 = buttons.find((b) => b.dataset.deg === '20');
  const b40 = buttons.find((b) => b.dataset.deg === '40');

  b20.fire('click');

  assert.equal(inputs.fromDeg.value, '0');
  assert.equal(inputs.toDeg.value, '20');
  assert.ok(b20.classList.contains('on'), '20° button should have "on" class after click');
  assert.equal(b20.getAttribute('aria-pressed'), 'true', '20° button should have aria-pressed=true');
  assert.ok(!b40.classList.contains('on'), '40° button should lose "on" class');
  assert.equal(b40.getAttribute('aria-pressed'), 'false', '40° button should have aria-pressed=false');
});

test('moving sliders to custom values deactivates preset buttons (no false active state)', () => {
  const { inputs, buttons } = loadRuntimePage();

  inputs.toDeg.value = '25';
  inputs.toDeg.fire('input');

  buttons.forEach((b) => {
    assert.ok(!b.classList.contains('on'), 'no button should have "on" class for custom toDeg');
    assert.equal(b.getAttribute('aria-pressed'), 'false', 'all buttons should have aria-pressed=false');
  });

  // Setting sliders to match QLED 30 (fromDeg=0, toDeg=30) re-activates 30° button
  inputs.fromDeg.value = '0';
  inputs.toDeg.value = '30';
  inputs.toDeg.fire('input');

  const b30 = buttons.find((b) => b.dataset.deg === '30');
  assert.ok(b30.classList.contains('on'), '30° button should be active for toDeg=30, fromDeg=0');
  assert.equal(b30.getAttribute('aria-pressed'), 'true', '30° button should have aria-pressed=true');

  // Moving fromDeg away from 0 deactivates preset even if toDeg is 30
  inputs.fromDeg.value = '10';
  inputs.fromDeg.fire('input');

  buttons.forEach((b) => {
    assert.ok(!b.classList.contains('on'), 'no button should have "on" class when fromDeg != 0');
    assert.equal(b.getAttribute('aria-pressed'), 'false', 'all buttons should have aria-pressed=false');
  });
});

// #140 / #139: the page is RTL, but a slider track that mirrors reads backwards
// — min on the right. Every page with sliders pins dir=ltr; so does this one.
test('runtime sliders are forced LTR and carry ARIA range attributes', () => {
  const html = read('runtime/index.html');
  assert.match(html, /input\[type=range\],input\[type=number\]\{[^}]*direction:ltr/, 'CSS needs direction:ltr');
  for (const id of ['fromDeg', 'toDeg', 'httpMs', 'i2cMs', 'wifiMs', 'phase', 'flash', 'moves']) {
    const tag = new RegExp('<input[^>]+id="' + id + '"[^>]*>');
    const match = html.match(tag);
    assert.ok(match, id + ' slider not found');
    for (const attr of ['dir="ltr"', 'aria-valuemin=', 'aria-valuemax=', 'aria-valuenow=', 'aria-valuetext=']) {
      assert.ok(match[0].includes(attr), id + ' slider is missing ' + attr);
    }
  }
});

// role="status" alone is not reliably announced on re-render; the sibling pages
// pair it with aria-live="polite", and all four verdicts here rewrite in place.
test('every runtime verdict is an aria-live region', () => {
  const html = read('runtime/index.html');
  for (const id of ['tVerdict', 'lVerdict', 'cVerdict', 'pVerdict']) {
    assert.match(html, new RegExp('id="' + id + '" role="status" aria-live="polite"'), id);
  }
});

test('runtime page HTML has accessible loop and WiFi scenario rows', () => {
  const html = read('runtime/index.html');
  assert.match(html, /<div class="row" role="group" aria-label="תרחישי לולאה" id="loopPresetRow">/);
  assert.match(html, /<div class="row" role="group" aria-label="תרחישי חיבור WiFi" id="wifiPresetRow">/);
  for (const key of ['typical', 'starve', 'wire']) {
    assert.match(html, new RegExp('data-loop-preset="' + key + '" aria-pressed="(true|false)"'), key);
  }
  for (const key of ['instant', 'typical', 'timeout']) {
    assert.match(html, new RegExp('data-wifi-preset="' + key + '" aria-pressed="(true|false)"'), key);
  }
});

test('loop scenarios start on the typical 8/2 ms pair and announce it', () => {
  const { loopButtons, inputs } = loadRuntimePage();
  assertPressed(byKey(loopButtons, 'loopPreset', 'typical'), true);
  assertPressed(byKey(loopButtons, 'loopPreset', 'starve'), false);
  assertPressed(byKey(loopButtons, 'loopPreset', 'wire'), false);
  assert.equal(inputs.httpMs.getAttribute('aria-valuetext'), '8 ms');
  assert.equal(inputs.i2cMs.getAttribute('aria-valuetext'), '2 ms');
});

test('the starve scenario drives both sliders and reaches a starved verdict', () => {
  const { loopButtons, inputs } = loadRuntimePage();
  byKey(loopButtons, 'loopPreset', 'starve').fire('click');

  assert.equal(inputs.httpMs.value, '18');
  assert.equal(inputs.i2cMs.value, '2');
  assertPressed(byKey(loopButtons, 'loopPreset', 'starve'), true);
  assertPressed(byKey(loopButtons, 'loopPreset', 'typical'), false);
  // 18 ms of handleClient is the point of the scenario: pulses go hungry.
  assert.equal(inputs.kStarve.textContent, 'מורעבים');
  assert.ok(inputs.lVerdict.className.includes('bad'), 'starved loop is a bad verdict');
});

test('the I²C-stall scenario moves only the I²C slider', () => {
  const { loopButtons, inputs } = loadRuntimePage();
  byKey(loopButtons, 'loopPreset', 'wire').fire('click');

  assert.equal(inputs.httpMs.value, '8');
  assert.equal(inputs.i2cMs.value, '25');
  assertPressed(byKey(loopButtons, 'loopPreset', 'wire'), true);
  assertPressed(byKey(loopButtons, 'loopPreset', 'typical'), false);
});

// A scenario matches only when *every* slider it drives still holds its value,
// so a half-matching pair must not leave a button claiming to be pressed.
test('hand-dragging a loop slider releases every loop scenario', () => {
  const { loopButtons, inputs } = loadRuntimePage();
  inputs.i2cMs.value = '5';
  inputs.i2cMs.fire('input');
  loopButtons.forEach((b) => assertPressed(b, false));

  // httpMs is still 8, which is the typical *and* the wire value for that one
  // slider — neither row may light up until i2cMs agrees too.
  inputs.i2cMs.value = '25';
  inputs.i2cMs.fire('input');
  assertPressed(byKey(loopButtons, 'loopPreset', 'wire'), true);
  assertPressed(byKey(loopButtons, 'loopPreset', 'typical'), false);
});

test('WiFi scenarios start on timeout and switch on click', () => {
  const { wifiButtons, inputs } = loadRuntimePage();
  assertPressed(byKey(wifiButtons, 'wifiPreset', 'timeout'), true);
  assert.equal(inputs.wifiMs.getAttribute('aria-valuetext'), 'Timeout (10,000 ms)');

  byKey(wifiButtons, 'wifiPreset', 'instant').fire('click');
  assert.equal(inputs.wifiMs.value, '0');
  assertPressed(byKey(wifiButtons, 'wifiPreset', 'instant'), true);
  assertPressed(byKey(wifiButtons, 'wifiPreset', 'timeout'), false);
  assert.equal(inputs.wifiMs.getAttribute('aria-valuetext'), '0 ms');
  assert.equal(inputs.kBlock.textContent, '0.0 s');

  byKey(wifiButtons, 'wifiPreset', 'typical').fire('click');
  assert.equal(inputs.wifiMs.value, '1600');
  assertPressed(byKey(wifiButtons, 'wifiPreset', 'typical'), true);
  assertPressed(byKey(wifiButtons, 'wifiPreset', 'instant'), false);
});

test('a custom WiFi delay releases every WiFi scenario', () => {
  const { wifiButtons, inputs } = loadRuntimePage();
  inputs.wifiMs.value = '3200';
  inputs.wifiMs.fire('input');
  wifiButtons.forEach((b) => assertPressed(b, false));
  assert.equal(inputs.wifiMs.getAttribute('aria-valuetext'), '3200 ms');
});

test('slider aria-valuetext tracks the value and keeps its unit', () => {
  const { inputs } = loadRuntimePage();
  inputs.toDeg.value = '25';
  inputs.phase.value = '50';
  inputs.flash.value = '1200';
  inputs.moves.value = '48';
  inputs.toDeg.fire('input');

  assert.equal(inputs.toDeg.getAttribute('aria-valuenow'), '25');
  assert.equal(inputs.toDeg.getAttribute('aria-valuetext'), '25°');
  // phase is a 0–100 slider the page reads as a 0–1 fraction; ARIA reports the
  // slider's own scale, not the fraction, or a reader would announce "0.5".
  assert.equal(inputs.phase.getAttribute('aria-valuenow'), '50');
  assert.equal(inputs.phase.getAttribute('aria-valuetext'), '50%');
  assert.equal(inputs.flash.getAttribute('aria-valuetext'), '1200 ms');
  assert.equal(inputs.moves.getAttribute('aria-valuetext'), '48 הטיות');
});
