const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function fakeElement(tagOrId, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  let text = initial.text || '';
  return {
    id: initial.id || tagOrId,
    tagName: tagOrId.toUpperCase(),
    type: initial.type || attrs.type || '',
    value: initial.value !== undefined ? String(initial.value) : '0',
    checked: initial.checked !== undefined ? Boolean(initial.checked) : false,
    attrs,
    dataset: initial.dataset || {},
    style: {},
    innerHTML: '',
    children: [],
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
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelectorAll(sel) {
      const results = [];
      const match = (el) => {
        if (sel === 'button' && (el.tagName === 'BUTTON' || el.type === 'button' || el.attrs?.type === 'button')) return true;
        if (sel === '[data-mode]' && el.attrs?.['data-mode']) return true;
        if (sel === '[data-pack]' && el.attrs?.['data-pack']) return true;
        if (sel === '[data-duty]' && el.attrs?.['data-duty']) return true;
        if (sel === '[data-hours]' && el.attrs?.['data-hours']) return true;
        return false;
      };
      const walk = (node) => {
        for (const child of node.children || []) {
          if (match(child)) results.push(child);
          walk(child);
        }
      };
      walk(this);
      return results;
    },
  };
}

function loadPowerPage() {
  const dutyButtons = [
    fakeElement('button', {
      id: 'btn-fw',
      attrs: { 'data-duty': 'firmware', 'aria-pressed': 'true', type: 'button' },
      classes: ['btn', 'on'],
      dataset: { duty: 'firmware' },
      text: 'קושחה (סלילים 24h)',
    }),
    fakeElement('button', {
      id: 'btn-worm',
      attrs: { 'data-duty': 'worm', 'aria-pressed': 'false', type: 'button' },
      classes: ['btn'],
      dataset: { duty: 'worm' },
      text: 'נעילה עצמית (תולעת)',
    }),
    fakeElement('button', {
      id: 'btn-eco',
      attrs: { 'data-duty': 'eco', 'aria-pressed': 'false', type: 'button' },
      classes: ['btn'],
      dataset: { duty: 'eco' },
      text: 'חיסכון (שינה)',
    }),
    fakeElement('button', {
      id: 'btn-heavy',
      attrs: { 'data-duty': 'heavy', 'aria-pressed': 'false', type: 'button' },
      classes: ['btn'],
      dataset: { duty: 'heavy' },
      text: 'עומס משרדי כבד',
    }),
  ];

  const hoursButtons = [
    fakeElement('button', {
      id: 'btn-h8',
      attrs: { 'data-hours': '8', 'aria-pressed': 'false', type: 'button' },
      classes: ['btn'],
      dataset: { hours: '8' },
      text: '8 שעות',
    }),
    fakeElement('button', {
      id: 'btn-h24',
      attrs: { 'data-hours': '24', 'aria-pressed': 'true', type: 'button' },
      classes: ['btn', 'on'],
      dataset: { hours: '24' },
      text: '24 שעות',
    }),
    fakeElement('button', {
      id: 'btn-h48',
      attrs: { 'data-hours': '48', 'aria-pressed': 'false', type: 'button' },
      classes: ['btn'],
      dataset: { hours: '48' },
      text: '48 שעות',
    }),
  ];

  const dutyPresetsBox = fakeElement('div', { id: 'dutyPresets' });
  dutyPresetsBox.children = dutyButtons;

  const hoursPresetsBox = fakeElement('div', { id: 'hoursPresets' });
  hoursPresetsBox.children = hoursButtons;

  const modesBox = fakeElement('div', { id: 'modes' });
  const packsBox = fakeElement('div', { id: 'packs' });

  const elements = {
    dutyPresets: dutyPresetsBox,
    hoursPresets: hoursPresetsBox,
    modes: modesBox,
    packs: packsBox,
    rails: fakeElement('svg', { id: 'rails' }),
    hours: fakeElement('svg', { id: 'hours' }),
    kLogic: fakeElement('b', { id: 'kLogic' }),
    kMotor: fakeElement('b', { id: 'kMotor' }),
    kPeak: fakeElement('b', { id: 'kPeak' }),
    kUsb: fakeElement('b', { id: 'kUsb' }),
    moves: fakeElement('input', { id: 'moves', value: '24' }),
    movesLbl: fakeElement('span', { id: 'movesLbl', text: '24' }),
    worm: fakeElement('input', { id: 'worm', checked: false }),
    wifiOn: fakeElement('input', { id: 'wifiOn', checked: true }),
    pHold: fakeElement('b', { id: 'pHold' }),
    pDay: fakeElement('b', { id: 'pDay' }),
    hoursWanted: fakeElement('input', { id: 'hoursWanted', value: '24' }),
    hoursLbl: fakeElement('span', { id: 'hoursLbl', text: '24' }),
    bHours: fakeElement('b', { id: 'bHours' }),
    bNeed: fakeElement('b', { id: 'bNeed' }),
    bC: fakeElement('b', { id: 'bC' }),
    bRail: fakeElement('b', { id: 'bRail' }),
    bBest: fakeElement('b', { id: 'bBest' }),
    bVerdict: fakeElement('div', { id: 'bVerdict' }),
    packNote: fakeElement('p', { id: 'packNote' }),
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '#dutyPresets [data-duty]') return dutyButtons;
      if (sel === '#hoursPresets [data-hours]') return hoursButtons;
      if (sel === '[data-duty]') return dutyButtons;
      if (sel === '[data-hours]') return hoursButtons;
      return [];
    },
    createElement: (tag) => fakeElement(tag),
  };

  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/timing.js'), ctx);
  vm.runInContext(read('src/lib/power.js'), ctx);

  const html = read('power/index.html');
  const anchor = html.indexOf('src="../src/lib/power.js"');
  assert.ok(anchor > 0, 'power page must load power.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { elements, dutyButtons, hoursButtons, modesBox, packsBox };
}

test('power page initializes with firmware baseline duty and 24h goal active', () => {
  const { elements, dutyButtons, hoursButtons, modesBox, packsBox } = loadPowerPage();

  const fwBtn = dutyButtons.find((b) => b.attrs['data-duty'] === 'firmware');
  assert.ok(fwBtn.classList.contains('on'));
  assert.equal(fwBtn.getAttribute('aria-pressed'), 'true');

  const h24Btn = hoursButtons.find((b) => b.attrs['data-hours'] === '24');
  assert.ok(h24Btn.classList.contains('on'));
  assert.equal(h24Btn.getAttribute('aria-pressed'), 'true');

  assert.equal(elements.moves.value, '24');
  assert.equal(elements.worm.checked, false);
  assert.equal(elements.wifiOn.checked, true);
  assert.equal(elements.hoursWanted.value, '24');

  const modeButtons = modesBox.children;
  assert.equal(modeButtons.length, 4);
  const idleHold = modeButtons.find((b) => b.attrs['data-mode'] === 'idle-hold');
  assert.ok(idleHold.classList.contains('on'));
  assert.equal(idleHold.getAttribute('aria-pressed'), 'true');

  const packButtons = packsBox.children;
  assert.equal(packButtons.length, 4);
  const pack3s = packButtons.find((b) => b.attrs['data-pack'] === '3s2200');
  assert.ok(pack3s.classList.contains('on'));
  assert.equal(pack3s.getAttribute('aria-pressed'), 'true');
});

test('clicking duty preset updates inputs and synchronizes aria-pressed state', () => {
  const { elements, dutyButtons } = loadPowerPage();
  const fwBtn = dutyButtons.find((b) => b.attrs['data-duty'] === 'firmware');
  const wormBtn = dutyButtons.find((b) => b.attrs['data-duty'] === 'worm');
  const ecoBtn = dutyButtons.find((b) => b.attrs['data-duty'] === 'eco');

  const initialDayWh = parseFloat(elements.pDay.textContent);
  assert.ok(initialDayWh > 150, 'firmware 24h energy should be > 150 Wh');

  wormBtn.fire('click');

  assert.equal(elements.worm.checked, true);
  assert.equal(elements.moves.value, '24');
  assert.equal(elements.wifiOn.checked, true);
  assert.ok(wormBtn.classList.contains('on'));
  assert.equal(wormBtn.getAttribute('aria-pressed'), 'true');
  assert.ok(!fwBtn.classList.contains('on'));
  assert.equal(fwBtn.getAttribute('aria-pressed'), 'false');

  const wormDayWh = parseFloat(elements.pDay.textContent);
  assert.ok(wormDayWh < 20, 'worm self-locking 24h energy should drop to < 20 Wh');

  ecoBtn.fire('click');
  assert.equal(elements.moves.value, '10');
  assert.equal(elements.worm.checked, true);
  assert.equal(elements.wifiOn.checked, false);
  assert.ok(ecoBtn.classList.contains('on'));
  assert.equal(ecoBtn.getAttribute('aria-pressed'), 'true');
  assert.ok(!wormBtn.classList.contains('on'));
});

test('adjusting duty inputs manually clears preset active state without false match', () => {
  const { elements, dutyButtons } = loadPowerPage();

  elements.moves.value = '45';
  elements.moves.fire('input');

  dutyButtons.forEach((b) => {
    assert.ok(!b.classList.contains('on'), 'button should not be on for custom moves');
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  });

  // Restoring exact matches for worm preset re-activates worm button
  elements.moves.value = '24';
  elements.worm.checked = true;
  elements.wifiOn.checked = true;
  elements.moves.fire('input');

  const wormBtn = dutyButtons.find((b) => b.attrs['data-duty'] === 'worm');
  assert.ok(wormBtn.classList.contains('on'));
  assert.equal(wormBtn.getAttribute('aria-pressed'), 'true');
});

test('clicking hours preset updates hoursWanted and synchronizes aria-pressed', () => {
  const { elements, hoursButtons } = loadPowerPage();
  const h8 = hoursButtons.find((b) => b.attrs['data-hours'] === '8');
  const h24 = hoursButtons.find((b) => b.attrs['data-hours'] === '24');

  h8.fire('click');

  assert.equal(elements.hoursWanted.value, '8');
  assert.equal(elements.hoursLbl.textContent, '8');
  assert.ok(h8.classList.contains('on'));
  assert.equal(h8.getAttribute('aria-pressed'), 'true');
  assert.ok(!h24.classList.contains('on'));
  assert.equal(h24.getAttribute('aria-pressed'), 'false');

  // Manual custom hour deselects all preset buttons
  elements.hoursWanted.value = '36';
  elements.hoursWanted.fire('input');

  hoursButtons.forEach((b) => {
    assert.ok(!b.classList.contains('on'));
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  });
});

test('selecting battery pack updates pack buttons aria-pressed and battery metrics', () => {
  const { elements, packsBox } = loadPowerPage();
  const packButtons = packsBox.children;
  const pb12 = packButtons.find((b) => b.attrs['data-pack'] === 'pb12-7ah');
  const p3s = packButtons.find((b) => b.attrs['data-pack'] === '3s2200');

  pb12.fire('click');

  assert.ok(pb12.classList.contains('on'));
  assert.equal(pb12.getAttribute('aria-pressed'), 'true');
  assert.ok(!p3s.classList.contains('on'));
  assert.equal(p3s.getAttribute('aria-pressed'), 'false');
  assert.match(elements.packNote.textContent, /גיבוי|hold/);
});

test('selecting draw mode updates mode buttons aria-pressed and rail metrics', () => {
  const { elements, modesBox } = loadPowerPage();
  const modeButtons = modesBox.children;
  const idleHold = modeButtons.find((b) => b.attrs['data-mode'] === 'idle-hold');
  const moving = modeButtons.find((b) => b.attrs['data-mode'] === 'moving');

  moving.fire('click');

  assert.ok(moving.classList.contains('on'));
  assert.equal(moving.getAttribute('aria-pressed'), 'true');
  assert.ok(!idleHold.classList.contains('on'));
  assert.equal(idleHold.getAttribute('aria-pressed'), 'false');

  assert.match(elements.kMotor.textContent, /mA/);
});
