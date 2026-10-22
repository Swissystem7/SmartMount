const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assertPressed(btn, on) {
  assert.equal(btn.classList.contains('on'), on, `expected .on class to be ${on}`);
  assert.equal(btn.getAttribute('aria-pressed'), String(on), `expected aria-pressed to be "${on}"`);
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
      if (sel === '[data-fixture]' || sel === '#filters [data-fixture]') {
        return children.filter((c) => c.getAttribute('data-fixture') !== null);
      }
      return children;
    },
    get children() { return children; },
  };
}

function loadHilPage() {
  const filterButtons = {
    all: fakeElement('btn-all', { attrs: { 'data-fixture': 'all', 'aria-pressed': 'true' }, classes: ['btn', 'on'], text: 'הכול' }),
    usb: fakeElement('btn-usb', { attrs: { 'data-fixture': 'usb', 'aria-pressed': 'false' }, classes: ['btn'], text: 'ESP32 על USB-UART בלבד' }),
    sensors: fakeElement('btn-sensors', { attrs: { 'data-fixture': 'sensors', 'aria-pressed': 'false' }, classes: ['btn'], text: 'ESP32 + שני BH1750' }),
    motor: fakeElement('btn-motor', { attrs: { 'data-fixture': 'motor', 'aria-pressed': 'false' }, classes: ['btn'], text: 'מנוע על שולחן, בלי מסך' }),
    dummy: fakeElement('btn-dummy', { attrs: { 'data-fixture': 'dummy', 'aria-pressed': 'false' }, classes: ['btn'], text: 'מסה מדומה על הזרוע — לא טלוויזיה' }),
  };

  const filtersContainer = fakeElement('filters');
  Object.values(filterButtons).forEach((b) => filtersContainer.appendChild(b));

  const listBox = fakeElement('list');
  const nCases = fakeElement('nCases');
  const nRun = fakeElement('nRun');
  const nHigh = fakeElement('nHigh');

  const elements = {
    filters: filtersContainer,
    list: listBox,
    nCases,
    nRun,
    nHigh,
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '#filters [data-fixture]' || sel === '[data-fixture]') {
        return Object.values(filterButtons);
      }
      return [];
    },
    createElement: (tag) => {
      const el = fakeElement('el-' + Math.random());
      el.tag = tag;
      return el;
    },
  };

  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/hil.js'), ctx);

  const html = read('hil/index.html');
  const anchor = html.indexOf('src="../src/lib/hil.js"');
  assert.ok(anchor > 0, 'hil page must load hil.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { filterButtons, filtersContainer, listBox, elements, ctx };
}

test('hil page HTML contains filter buttons with role="group", aria-label and aria-pressed attributes', () => {
  const html = read('hil/index.html');
  assert.ok(html.includes('<div class="row" id="filters" role="group" aria-label="סינון לפי מתקן">'));
  assert.ok(html.includes('<button type="button" class="btn on" data-fixture="all" aria-pressed="true">הכול</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-fixture="usb" aria-pressed="false">ESP32 על USB-UART בלבד</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-fixture="sensors" aria-pressed="false">ESP32 + שני BH1750</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-fixture="motor" aria-pressed="false">מנוע על שולחן, בלי מסך</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-fixture="dummy" aria-pressed="false">מסה מדומה על הזרוע — לא טלוויזיה</button>'));
  assert.ok(html.includes('<div id="list" role="region" aria-live="polite"></div>'));
});

test('hil page initializes with "all" active and aria-pressed=true, rendering all 13 cases', () => {
  const { filterButtons, listBox, elements } = loadHilPage();

  assertPressed(filterButtons.all, true);
  assertPressed(filterButtons.usb, false);
  assertPressed(filterButtons.sensors, false);
  assertPressed(filterButtons.motor, false);
  assertPressed(filterButtons.dummy, false);

  assert.equal(elements.nCases.textContent, '13');
  assert.equal(elements.nRun.textContent, '0');
  assert.equal(listBox.children.length, 13, 'all 13 HIL cases should be displayed initially');
});

test('clicking fixture filter buttons updates active class and aria-pressed attributes and filters cases', () => {
  const { filterButtons, listBox } = loadHilPage();

  // Filter by USB
  filterButtons.usb.fire('click');
  assertPressed(filterButtons.usb, true);
  assertPressed(filterButtons.all, false);
  assert.equal(listBox.children.length, 3, 'USB fixture has 3 cases (HIL-01, HIL-02, HIL-06)');
  assert.ok(listBox.children.every((c) => c.innerHTML.includes('ESP32 על USB-UART בלבד')));

  // Filter by Sensors
  filterButtons.sensors.fire('click');
  assertPressed(filterButtons.sensors, true);
  assertPressed(filterButtons.usb, false);
  assert.equal(listBox.children.length, 3, 'Sensors fixture has 3 cases (HIL-03, HIL-04, HIL-11)');
  assert.ok(listBox.children.every((c) => c.innerHTML.includes('ESP32 + שני BH1750')));

  // Filter by Motor
  filterButtons.motor.fire('click');
  assertPressed(filterButtons.motor, true);
  assertPressed(filterButtons.sensors, false);
  assert.equal(listBox.children.length, 6, 'Motor fixture has 6 cases');
  assert.ok(listBox.children.every((c) => c.innerHTML.includes('מנוע על שולחן, בלי מסך')));

  // Filter by Dummy mass
  filterButtons.dummy.fire('click');
  assertPressed(filterButtons.dummy, true);
  assertPressed(filterButtons.motor, false);
  assert.equal(listBox.children.length, 1, 'Dummy fixture has 1 case (HIL-10)');
  assert.ok(listBox.children[0].innerHTML.includes('HIL-10'));
  assert.ok(listBox.children[0].innerHTML.includes('מסה מדומה על הזרוע'));

  // Restore All
  filterButtons.all.fire('click');
  assertPressed(filterButtons.all, true);
  assertPressed(filterButtons.dummy, false);
  assert.equal(listBox.children.length, 13, 'All 13 cases restored');
});

test('filter clicks preserve button DOM references (no DOM wipe, focus is maintained)', () => {
  const { filterButtons, filtersContainer } = loadHilPage();

  const originalButtons = [...filtersContainer.children];

  filterButtons.usb.fire('click');
  assert.equal(filtersContainer.children.length, 5);
  filtersContainer.children.forEach((b, i) => {
    assert.strictEqual(b, originalButtons[i], 'filter button reference must not be destroyed');
  });

  filterButtons.all.fire('click');
  filtersContainer.children.forEach((b, i) => {
    assert.strictEqual(b, originalButtons[i], 'filter button reference must not be destroyed');
  });
});

test('empty state renders accessible message if no cases match', () => {
  const { ctx, listBox } = loadHilPage();

  // Invoke setFilter with non-matching fixture
  vm.runInContext("setFilter('non-existent');", ctx);
  assert.equal(listBox.children.length, 1);
  assert.equal(listBox.children[0].id, 'emptyMsg');
  assert.ok(listBox.children[0].textContent.includes('אין מקרים התואמים לסינון'));
});
