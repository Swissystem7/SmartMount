const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assertPressed(btn, on) {
  assert.equal(btn.classList.contains('on'), on, `expected class .on to be ${on}`);
  assert.equal(btn.getAttribute('aria-pressed'), String(on), `expected aria-pressed to be ${on}`);
}

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  const children = [];
  let text = initial.text || '';
  let innerHtml = initial.innerHTML || '';
  return {
    id,
    value: initial.value || '0',
    checked: initial.checked !== undefined ? initial.checked : false,
    attrs,
    dataset: initial.dataset || {},
    get textContent() { return text; },
    set textContent(v) {
      text = String(v);
      if (text === '') children.length = 0;
    },
    get innerHTML() { return innerHtml; },
    set innerHTML(v) { innerHtml = String(v); },
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
      children.push(child);
      return child;
    },
    querySelectorAll(sel) {
      if (sel === 'button') {
        return children.filter((c) => c.tag === 'button' || c.type === 'button');
      }
      if (sel === '.mode') {
        return children.filter((c) => c.classList.contains('mode'));
      }
      if (sel === '.btn') {
        return children.filter((c) => c.classList.contains('btn'));
      }
      return children;
    },
    get children() { return children; },
  };
}

function loadPowerPage() {
  const modesBox = fakeElement('modes');
  const packsBox = fakeElement('packs');

  const elements = {
    modes: modesBox,
    packs: packsBox,
    rails: fakeElement('rails'),
    hours: fakeElement('hours'),
    kLogic: fakeElement('kLogic'),
    kMotor: fakeElement('kMotor'),
    kPeak: fakeElement('kPeak'),
    kUsb: fakeElement('kUsb'),
    moves: fakeElement('moves', { value: '24' }),
    movesLbl: fakeElement('movesLbl'),
    worm: fakeElement('worm', { checked: false }),
    wifiOn: fakeElement('wifiOn', { checked: true }),
    pHold: fakeElement('pHold'),
    pDay: fakeElement('pDay'),
    hoursWanted: fakeElement('hoursWanted', { value: '24' }),
    hoursLbl: fakeElement('hoursLbl'),
    bHours: fakeElement('bHours'),
    bNeed: fakeElement('bNeed'),
    bC: fakeElement('bC'),
    bRail: fakeElement('bRail'),
    bBest: fakeElement('bBest'),
    packNote: fakeElement('packNote'),
    bVerdict: fakeElement('bVerdict'),
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    createElement: (tag) => {
      const el = fakeElement('el-' + Math.random());
      el.tag = tag;
      return el;
    },
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

  return { elements, modesBox, packsBox };
}

test('power page HTML contains mode and pack groups with aria-labels and group roles', () => {
  const html = read('power/index.html');
  assert.ok(html.includes('<div class="modes" id="modes" role="group" aria-label="מצבי צריכת זרם"></div>'));
  assert.ok(html.includes('<div class="row" id="packs" role="group" aria-label="חבילת סוללה"></div>'));
});

test('power page initializes mode buttons with idle-hold active and aria-pressed=true', () => {
  const { modesBox } = loadPowerPage();
  const modeButtons = modesBox.querySelectorAll('button');
  assert.equal(modeButtons.length, 4, 'should create 4 mode buttons');

  const idleHold = modeButtons.find((b) => b.getAttribute('data-mode') === 'idle-hold');
  assert.ok(idleHold, 'idle-hold mode button must exist');
  assertPressed(idleHold, true);

  modeButtons.filter((b) => b !== idleHold).forEach((b) => {
    assertPressed(b, false);
  });
});

test('power page initializes battery pack buttons with 3s2200 active and aria-pressed=true', () => {
  const { packsBox } = loadPowerPage();
  const packButtons = packsBox.querySelectorAll('button');
  assert.equal(packButtons.length, 4, 'should create 4 battery pack buttons');

  const b3s = packButtons.find((b) => b.getAttribute('data-pack') === '3s2200');
  assert.ok(b3s, '3s2200 pack button must exist');
  assertPressed(b3s, true);

  packButtons.filter((b) => b !== b3s).forEach((b) => {
    assertPressed(b, false);
  });
});

test('clicking another mode button updates active class and aria-pressed state', () => {
  const { modesBox, elements } = loadPowerPage();
  const modeButtons = modesBox.querySelectorAll('button');
  const idleHold = modeButtons.find((b) => b.getAttribute('data-mode') === 'idle-hold');
  const moving = modeButtons.find((b) => b.getAttribute('data-mode') === 'moving');

  assertPressed(idleHold, true);
  assertPressed(moving, false);

  moving.fire('click');
  assertPressed(moving, true);
  assertPressed(idleHold, false);

  assert.ok(elements.kLogic.textContent.includes('mA'));
  assert.ok(elements.kMotor.textContent.includes('mA'));
});

test('clicking another pack button updates active class, aria-pressed, and battery calculations', () => {
  const { packsBox, elements } = loadPowerPage();
  const packButtons = packsBox.querySelectorAll('button');
  const b3s = packButtons.find((b) => b.getAttribute('data-pack') === '3s2200');
  const usb = packButtons.find((b) => b.getAttribute('data-pack') === 'usb-10ah');

  assertPressed(b3s, true);
  assertPressed(usb, false);

  usb.fire('click');
  assertPressed(usb, true);
  assertPressed(b3s, false);

  assert.equal(elements.bRail.textContent, 'לא 12 V');
  assert.ok(elements.bVerdict.textContent.includes('לא מזינה 12 V'));
});

test('moving sliders updates calculations without destroying button DOM elements', () => {
  const { modesBox, packsBox, elements } = loadPowerPage();

  const originalModes = [...modesBox.children];
  const originalPacks = [...packsBox.children];

  elements.moves.value = '48';
  elements.moves.fire('input');

  assert.equal(elements.movesLbl.textContent, '48');
  assert.equal(modesBox.children.length, 4);
  assert.equal(packsBox.children.length, 4);

  // References should be identical, preserving focus and DOM identity
  modesBox.children.forEach((b, i) => {
    assert.strictEqual(b, originalModes[i], 'mode button DOM reference should not be replaced');
  });
  packsBox.children.forEach((b, i) => {
    assert.strictEqual(b, originalPacks[i], 'pack button DOM reference should not be replaced');
  });

  const b3s = packsBox.querySelectorAll('button').find((b) => b.getAttribute('data-pack') === '3s2200');
  assertPressed(b3s, true);
});
