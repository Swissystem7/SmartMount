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
  let val = initial.value !== undefined ? String(initial.value) : '0';
  return {
    id,
    get value() { return val; },
    set value(v) { val = String(v); },
    checked: initial.checked || false,
    attrs,
    dataset: initial.dataset || {},
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

function loadSpecTorquePage() {
  const presetRowChildren = [];
  const presetRow = fakeElement('presetRow');
  presetRow.appendChild = (child) => {
    presetRowChildren.push(child);
  };
  presetRow.querySelectorAll = (sel) => {
    if (sel === '.btn') return presetRowChildren;
    return [];
  };

  const tiltButtons = [
    fakeElement('btn-tilt-0', { dataset: { tilt: '0' }, classes: ['btn', 'on'], attrs: { 'aria-pressed': 'true' } }),
    fakeElement('btn-tilt-20', { dataset: { tilt: '20' }, classes: ['btn'], attrs: { 'aria-pressed': 'false' } }),
    fakeElement('btn-tilt-30', { dataset: { tilt: '30' }, classes: ['btn'], attrs: { 'aria-pressed': 'false' } }),
    fakeElement('btn-tilt-40', { dataset: { tilt: '40' }, classes: ['btn'], attrs: { 'aria-pressed': 'false' } }),
  ];

  const btnResetDrivetrain = fakeElement('btnResetDrivetrain', { classes: ['btn'] });

  const inputs = {
    presetRow,
    btnResetDrivetrain,
    massKg: fakeElement('massKg', { value: '18', attrs: { 'aria-valuemin': '4', 'aria-valuemax': '45', 'aria-valuenow': '18', 'aria-valuetext': '18 ק״ג', dir: 'ltr' } }),
    cogCm: fakeElement('cogCm', { value: '8', attrs: { 'aria-valuemin': '3', 'aria-valuemax': '18', 'aria-valuenow': '8', 'aria-valuetext': '8 ס״מ', dir: 'ltr' } }),
    tiltDeg: fakeElement('tiltDeg', { value: '0', attrs: { 'aria-valuemin': '0', 'aria-valuemax': '40', 'aria-valuenow': '0', 'aria-valuetext': '0°', dir: 'ltr' } }),
    gearRatio: fakeElement('gearRatio', { value: '5' }),
    motorNm: fakeElement('motorNm', { value: '0.45' }),
    eff: fakeElement('eff', { value: '0.85' }),
    selfLock: fakeElement('selfLock', { checked: false }),
    massLbl: fakeElement('massLbl'),
    cogLbl: fakeElement('cogLbl'),
    tiltLbl: fakeElement('tiltLbl'),
    tReq: fakeElement('tReq'),
    tHave: fakeElement('tHave'),
    tSf: fakeElement('tSf'),
    tOff: fakeElement('tOff'),
    tVerdict: fakeElement('tVerdict'),
  };

  const document = {
    getElementById: (id) => inputs[id] || (inputs[id] = fakeElement(id)),
    createElement: (tag) => {
      if (tag === 'button') {
        const btn = fakeElement('btn-' + Math.random());
        btn.type = 'button';
        return btn;
      }
      return fakeElement(tag);
    },
    querySelectorAll: (sel) => {
      if (sel === '#tiltPresetRow [data-tilt]') return tiltButtons;
      return [];
    },
  };

  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/torque.js'), ctx);

  const html = read('spec/index.html');
  const anchor = html.indexOf('src="../src/lib/torque.js"');
  assert.ok(anchor > 0, 'spec page must load src/lib/torque.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { inputs, presetRowChildren, tiltButtons, btnResetDrivetrain };
}

test('spec page HTML contains tilt preset buttons and LTR slider attributes', () => {
  const html = read('spec/index.html');
  assert.match(html, /id="tiltPresetRow"/);
  assert.match(html, /data-tilt="0"/);
  assert.match(html, /data-tilt="20"/);
  assert.match(html, /data-tilt="30"/);
  assert.match(html, /data-tilt="40"/);
  assert.match(html, /id="btnResetDrivetrain"/);
  assert.match(html, /id="tiltDeg"[^>]*dir="ltr"/);
  assert.match(html, /id="massKg"[^>]*dir="ltr"/);
  assert.match(html, /id="cogCm"[^>]*dir="ltr"/);
  assert.match(html, /id="massKg"[^>]*aria-valuemin="4"[^>]*aria-valuemax="45"[^>]*aria-valuenow="18"[^>]*aria-valuetext="18 ק״ג"/);
  assert.match(html, /id="cogCm"[^>]*aria-valuemin="3"[^>]*aria-valuemax="18"[^>]*aria-valuenow="8"[^>]*aria-valuetext="8 ס״מ"/);
  assert.match(html, /id="tiltDeg"[^>]*aria-valuemin="0"[^>]*aria-valuemax="40"[^>]*aria-valuenow="0"[^>]*aria-valuetext="0°"/);
});

test('spec page initializes tilt preset buttons with 0° active and aria-pressed=true', () => {
  const { tiltButtons } = loadSpecTorquePage();
  const b0 = tiltButtons.find((b) => b.dataset.tilt === '0');
  assert.ok(b0);
  assert.ok(b0.classList.contains('on'), '0° button should have class "on" initially');
  assert.equal(b0.getAttribute('aria-pressed'), 'true');

  tiltButtons.filter((b) => b !== b0).forEach((b) => {
    assert.ok(!b.classList.contains('on'), `button ${b.dataset.tilt}° should not have class "on"`);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  });
});

test('clicking tilt preset button updates tiltDeg slider, aria-pressed, and verdict', () => {
  const { inputs, tiltButtons } = loadSpecTorquePage();
  const b0 = tiltButtons.find((b) => b.dataset.tilt === '0');
  const b20 = tiltButtons.find((b) => b.dataset.tilt === '20');

  b20.fire('click');

  assert.equal(inputs.tiltDeg.value, '20');
  assert.equal(inputs.tiltLbl.textContent, '20');
  assert.equal(inputs.tiltDeg.getAttribute('aria-valuenow'), '20');
  assert.equal(inputs.tiltDeg.getAttribute('aria-valuetext'), '20°');
  assert.ok(b20.classList.contains('on'));
  assert.equal(b20.getAttribute('aria-pressed'), 'true');
  assert.ok(!b0.classList.contains('on'));
  assert.equal(b0.getAttribute('aria-pressed'), 'false');
});

test('moving tilt slider to custom angle deactivates all tilt presets', () => {
  const { inputs, tiltButtons } = loadSpecTorquePage();

  inputs.tiltDeg.value = '15';
  inputs.tiltDeg.fire('input');

  assert.equal(inputs.tiltLbl.textContent, '15');
  assert.equal(inputs.tiltDeg.getAttribute('aria-valuenow'), '15');
  assert.equal(inputs.tiltDeg.getAttribute('aria-valuetext'), '15°');
  tiltButtons.forEach((b) => {
    assert.ok(!b.classList.contains('on'), `button ${b.dataset.tilt}° must not be on for custom angle`);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  });

  // Restoring to 30° re-activates 30° preset
  inputs.tiltDeg.value = '30';
  inputs.tiltDeg.fire('input');

  const b30 = tiltButtons.find((b) => b.dataset.tilt === '30');
  assert.ok(b30.classList.contains('on'));
  assert.equal(b30.getAttribute('aria-pressed'), 'true');
  assert.equal(inputs.tiltDeg.getAttribute('aria-valuetext'), '30°');
});

test('clicking reset drivetrain restores firmware defaults and triggers recalculation', () => {
  const { inputs, tiltButtons, btnResetDrivetrain } = loadSpecTorquePage();

  // Change parameters
  inputs.gearRatio.value = '20';
  inputs.motorNm.value = '1.2';
  inputs.eff.value = '0.7';
  inputs.selfLock.checked = true;
  inputs.tiltDeg.value = '40';
  inputs.tiltDeg.fire('input');

  assert.equal(inputs.gearRatio.value, '20');
  assert.equal(inputs.motorNm.value, '1.2');

  // Click reset
  btnResetDrivetrain.fire('click');

  assert.equal(inputs.massKg.value, '18');
  assert.equal(inputs.cogCm.value, '8');
  assert.equal(inputs.tiltDeg.value, '0');
  assert.equal(inputs.massKg.getAttribute('aria-valuenow'), '18');
  assert.equal(inputs.massKg.getAttribute('aria-valuetext'), '18 ק״ג');
  assert.equal(inputs.cogCm.getAttribute('aria-valuenow'), '8');
  assert.equal(inputs.cogCm.getAttribute('aria-valuetext'), '8 ס״מ');
  assert.equal(inputs.tiltDeg.getAttribute('aria-valuenow'), '0');
  assert.equal(inputs.tiltDeg.getAttribute('aria-valuetext'), '0°');
  assert.equal(inputs.gearRatio.value, '5');
  assert.equal(inputs.motorNm.value, '0.45');
  assert.equal(inputs.eff.value, '0.85');
  assert.equal(inputs.selfLock.checked, false);

  const b0 = tiltButtons.find((b) => b.dataset.tilt === '0');
  assert.ok(b0.classList.contains('on'));
  assert.equal(b0.getAttribute('aria-pressed'), 'true');
});

test('screen size preset buttons update massKg and cogCm aria-valuenow and aria-valuetext', () => {
  const { inputs, presetRowChildren } = loadSpecTorquePage();
  const b65 = presetRowChildren.find((b) => b.textContent && b.textContent.includes('65″'));
  assert.ok(b65, '65″ preset button should exist');

  b65.fire('click');

  assert.equal(inputs.massKg.value, '28');
  assert.equal(inputs.massKg.getAttribute('aria-valuenow'), '28');
  assert.equal(inputs.massKg.getAttribute('aria-valuetext'), '28 ק״ג');
  assert.equal(inputs.cogCm.value, '10');
  assert.equal(inputs.cogCm.getAttribute('aria-valuenow'), '10');
  assert.equal(inputs.cogCm.getAttribute('aria-valuetext'), '10 ס״מ');

  const b43 = presetRowChildren.find((b) => b.textContent && b.textContent.includes('43″'));
  assert.ok(b43, '43″ preset button should exist');

  b43.fire('click');

  assert.equal(inputs.massKg.value, '8');
  assert.equal(inputs.massKg.getAttribute('aria-valuenow'), '8');
  assert.equal(inputs.massKg.getAttribute('aria-valuetext'), '8 ק״ג');
  assert.equal(inputs.cogCm.value, '6');
  assert.equal(inputs.cogCm.getAttribute('aria-valuenow'), '6');
  assert.equal(inputs.cogCm.getAttribute('aria-valuetext'), '6 ס״מ');
});

test('selfLock change event triggers recalculation and updates verdict', () => {
  const { inputs } = loadSpecTorquePage();

  assert.equal(inputs.tOff.textContent, 'נופל');

  // Toggle selfLock on with change event
  inputs.selfLock.checked = true;
  inputs.selfLock.fire('change');

  assert.equal(inputs.tOff.textContent, 'לא מחזיק');
});
