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
    checked: initial.checked || false,
    attrs,
    dataset: {},
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
    getAttribute(k) { return attrs[k]; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    fire(type) {
      (listeners[type] || []).forEach((fn) => fn());
    },
  };
}

function loadSpecPage() {
  const rowChildren = [];
  const presetRow = fakeElement('presetRow');
  presetRow.appendChild = (child) => {
    rowChildren.push(child);
  };
  presetRow.querySelectorAll = (sel) => {
    if (sel === '.btn') return rowChildren;
    return [];
  };

  const inputs = {
    presetRow,
    massKg: fakeElement('massKg', { value: '18' }),
    cogCm: fakeElement('cogCm', { value: '8' }),
    tiltDeg: fakeElement('tiltDeg', { value: '0' }),
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

  return { inputs, buttons: rowChildren };
}

test('spec page initializes preset buttons with 55" active and aria-pressed=true', () => {
  const { buttons } = loadSpecPage();
  assert.equal(buttons.length, 4, 'should create 4 preset buttons');

  const b55 = buttons.find((b) => b.textContent.includes('55″'));
  assert.ok(b55, '55″ preset button should exist');
  assert.ok(b55.classList.contains('on'), '55″ preset button should be on initially');
  assert.equal(b55.getAttribute('aria-pressed'), 'true', '55″ button should have aria-pressed=true');

  buttons.filter((b) => b !== b55).forEach((b) => {
    assert.ok(!b.classList.contains('on'), 'non-55″ button should not be on');
    assert.equal(b.getAttribute('aria-pressed'), 'false', 'non-55″ button should have aria-pressed=false');
  });
});

test('clicking a preset button updates sliders and switches aria-pressed state', () => {
  const { inputs, buttons } = loadSpecPage();
  const b43 = buttons.find((b) => b.textContent.includes('43″'));
  const b55 = buttons.find((b) => b.textContent.includes('55″'));

  b43.fire('click');

  assert.equal(inputs.massKg.value, 8);
  assert.equal(inputs.cogCm.value, 6);
  assert.ok(b43.classList.contains('on'));
  assert.equal(b43.getAttribute('aria-pressed'), 'true');
  assert.ok(!b55.classList.contains('on'));
  assert.equal(b55.getAttribute('aria-pressed'), 'false');
});

test('moving sliders to custom values deactivates preset buttons (no false active state)', () => {
  const { inputs, buttons } = loadSpecPage();

  inputs.massKg.value = '25';
  inputs.massKg.fire('input');

  buttons.forEach((b) => {
    assert.ok(!b.classList.contains('on'), 'no button should have "on" class for custom values');
    assert.equal(b.getAttribute('aria-pressed'), 'false', 'all buttons should have aria-pressed=false');
  });

  // Restoring values to match 65" preset (mass 28, cog 10) re-activates 65"
  inputs.massKg.value = '28';
  inputs.cogCm.value = '10';
  inputs.massKg.fire('input');

  const b65 = buttons.find((b) => b.textContent.includes('65″'));
  assert.ok(b65.classList.contains('on'), '65″ button should be on when sliders match 65″ preset');
  assert.equal(b65.getAttribute('aria-pressed'), 'true', '65″ button should have aria-pressed=true');
});
