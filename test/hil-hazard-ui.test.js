const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assertPressed(btn, on) {
  assert.equal(btn.classList.contains('on'), on, `expected class 'on' to be ${on}`);
  assert.equal(btn.getAttribute('aria-pressed'), String(on), `expected aria-pressed to be ${on}`);
}

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  let text = initial.text || '';
  let innerHtml = initial.innerHTML || '';
  const children = [];

  const el = {
    id,
    attrs,
    dataset: initial.dataset || {},
    style: {},
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
    fire(type, evt = {}) {
      (listeners[type] || []).forEach((fn) => fn.call(this, evt));
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    querySelectorAll(sel) {
      if (sel === '#filters [data-fixture]' || sel === '[data-fixture]') {
        return children.filter((c) => c.getAttribute('data-fixture') !== null);
      }
      if (sel === '#hazardFilters [data-hazard]' || sel === '[data-hazard]') {
        return children.filter((c) => c.getAttribute('data-hazard') !== null);
      }
      return children;
    },
    get children() { return children; },
  };
  return el;
}

function loadHilPage() {
  const fixtureButtons = {
    all: fakeElement('btn-fix-all', { attrs: { 'data-fixture': 'all', 'aria-pressed': 'true' }, classes: ['btn', 'on'], text: 'הכול' }),
    usb: fakeElement('btn-fix-usb', { attrs: { 'data-fixture': 'usb', 'aria-pressed': 'false' }, classes: ['btn'], text: 'ESP32 על USB-UART בלבד' }),
    sensors: fakeElement('btn-fix-sensors', { attrs: { 'data-fixture': 'sensors', 'aria-pressed': 'false' }, classes: ['btn'], text: 'ESP32 + שני BH1750' }),
    motor: fakeElement('btn-fix-motor', { attrs: { 'data-fixture': 'motor', 'aria-pressed': 'false' }, classes: ['btn'], text: 'מנוע על שולחן, בלי מסך' }),
    dummy: fakeElement('btn-fix-dummy', { attrs: { 'data-fixture': 'dummy', 'aria-pressed': 'false' }, classes: ['btn'], text: 'מסה מדומה על הזרוע — לא טלוויזיה' }),
  };

  const hazardButtons = {
    all: fakeElement('btn-haz-all', { attrs: { 'data-hazard': 'all', 'aria-pressed': 'true' }, classes: ['btn', 'on'], text: 'כל רמות הסיכון' }),
    high: fakeElement('btn-haz-high', { attrs: { 'data-hazard': 'high', 'aria-pressed': 'false' }, classes: ['btn'], text: 'סיכון גבוה' }),
    low: fakeElement('btn-haz-low', { attrs: { 'data-hazard': 'low', 'aria-pressed': 'false' }, classes: ['btn'], text: 'סיכון נמוך' }),
    none: fakeElement('btn-haz-none', { attrs: { 'data-hazard': 'none', 'aria-pressed': 'false' }, classes: ['btn'], text: 'ללא סיכון' }),
  };

  const filtersContainer = fakeElement('filters');
  Object.values(fixtureButtons).forEach((b) => filtersContainer.appendChild(b));

  const hazardContainer = fakeElement('hazardFilters');
  Object.values(hazardButtons).forEach((b) => hazardContainer.appendChild(b));

  const listBox = fakeElement('list');
  const countSummary = fakeElement('countSummary');
  const nCases = fakeElement('nCases');
  const nRun = fakeElement('nRun');
  const nHigh = fakeElement('nHigh');
  const cardHigh = fakeElement('cardHigh', { attrs: { 'aria-pressed': 'false', role: 'button', tabindex: '0' }, classes: ['clickable'] });
  const countHigh = fakeElement('countHigh');
  const countLow = fakeElement('countLow');
  const countNone = fakeElement('countNone');

  const elements = {
    filters: filtersContainer,
    hazardFilters: hazardContainer,
    list: listBox,
    countSummary,
    nCases,
    nRun,
    nHigh,
    cardHigh,
    countHigh,
    countLow,
    countNone,
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '#filters [data-fixture]' || sel === '[data-fixture]') {
        return Object.values(fixtureButtons);
      }
      if (sel === '#hazardFilters [data-hazard]' || sel === '[data-hazard]') {
        return Object.values(hazardButtons);
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

  return {
    fixtureButtons,
    hazardButtons,
    filtersContainer,
    hazardContainer,
    listBox,
    countSummary,
    elements,
    ctx,
  };
}

test('hil page HTML contains fixture and hazard filter toolbars with role="group", aria-label and aria-pressed attributes', () => {
  const html = read('hil/index.html');
  assert.ok(html.includes('<div class="row" id="filters" role="group" aria-label="סינון לפי מתקן">'));
  assert.ok(html.includes('<button type="button" class="btn on" data-fixture="all" aria-pressed="true">הכול</button>'));

  assert.ok(html.includes('<div class="row" id="hazardFilters" role="group" aria-label="סינון לפי רמת סיכון">'));
  assert.ok(html.includes('<button type="button" class="btn on" data-hazard="all" aria-pressed="true">כל רמות הסיכון</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-hazard="high" aria-pressed="false">סיכון גבוה (<span id="countHigh">1</span>)</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-hazard="low" aria-pressed="false">סיכון נמוך (<span id="countLow">5</span>)</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-hazard="none" aria-pressed="false">ללא סיכון (<span id="countNone">7</span>)</button>'));

  assert.ok(html.includes('<div id="cardHigh" class="clickable" tabindex="0" role="button" aria-pressed="false" aria-label="סינון מהיר לסיכון גבוה">'));
  assert.ok(html.includes('<p class="count-summary" id="countSummary" aria-live="polite">'));
  assert.ok(html.includes('<div id="list" role="region" aria-live="polite"></div>'));
});

test('hil page initializes with all fixtures and all hazards active, rendering all 13 cases', () => {
  const { fixtureButtons, hazardButtons, listBox, countSummary, elements } = loadHilPage();

  assertPressed(fixtureButtons.all, true);
  assertPressed(fixtureButtons.usb, false);
  assertPressed(hazardButtons.all, true);
  assertPressed(hazardButtons.high, false);
  assertPressed(hazardButtons.low, false);
  assertPressed(hazardButtons.none, false);

  assert.equal(elements.nCases.textContent, '13');
  assert.equal(elements.nRun.textContent, '0');
  assert.equal(elements.nHigh.textContent, '1');
  assert.equal(elements.countHigh.textContent, '1');
  assert.equal(elements.countLow.textContent, '5');
  assert.equal(elements.countNone.textContent, '7');

  assert.equal(listBox.children.length, 13);
  assert.equal(countSummary.textContent, 'מוצגים 13 מתוך 13 מקרי HIL');
});

test('clicking hazard filter buttons updates aria-pressed, active classes, the count summary and the cases', () => {
  const { hazardButtons, listBox, countSummary, elements } = loadHilPage();

  hazardButtons.high.fire('click');
  assertPressed(hazardButtons.high, true);
  assertPressed(hazardButtons.all, false);
  assert.equal(listBox.children.length, 1, 'high hazard has 1 case (HIL-10)');
  assert.ok(listBox.children[0].innerHTML.includes('HIL-10'));
  assert.ok(listBox.children[0].innerHTML.includes('סיכון high'));
  assert.equal(elements.cardHigh.classList.contains('on'), true);
  assert.equal(elements.cardHigh.getAttribute('aria-pressed'), 'true');
  assert.equal(countSummary.textContent, 'מוצג מקרה 1 מתוך 13 (סינון פעיל)');

  hazardButtons.low.fire('click');
  assertPressed(hazardButtons.low, true);
  assertPressed(hazardButtons.high, false);
  assert.equal(listBox.children.length, 5, 'low hazard has 5 cases');
  assert.ok(listBox.children.every((c) => c.innerHTML.includes('סיכון low')));
  assert.equal(elements.cardHigh.classList.contains('on'), false);
  assert.equal(elements.cardHigh.getAttribute('aria-pressed'), 'false');
  assert.equal(countSummary.textContent, 'מוצגים 5 מתוך 13 מקרים (סינון פעיל)');

  hazardButtons.none.fire('click');
  assertPressed(hazardButtons.none, true);
  assertPressed(hazardButtons.low, false);
  assert.equal(listBox.children.length, 7, 'none hazard has 7 cases');
  assert.ok(listBox.children.every((c) => c.innerHTML.includes('סיכון none')));
  assert.equal(countSummary.textContent, 'מוצגים 7 מתוך 13 מקרים (סינון פעיל)');

  hazardButtons.all.fire('click');
  assertPressed(hazardButtons.all, true);
  assertPressed(hazardButtons.none, false);
  assert.equal(listBox.children.length, 13);
  assert.equal(countSummary.textContent, 'מוצגים 13 מתוך 13 מקרי HIL');
});

test('the high-hazard KPI card toggles the high filter by click and by Enter / Space', () => {
  const { hazardButtons, elements, listBox } = loadHilPage();

  elements.cardHigh.fire('click');
  assertPressed(hazardButtons.high, true);
  assertPressed(hazardButtons.all, false);
  assert.equal(listBox.children.length, 1);
  assert.ok(listBox.children[0].innerHTML.includes('HIL-10'));

  elements.cardHigh.fire('click');
  assertPressed(hazardButtons.all, true);
  assertPressed(hazardButtons.high, false);
  assert.equal(listBox.children.length, 13);

  let prevented = 0;
  elements.cardHigh.fire('keydown', { key: 'Enter', preventDefault() { prevented += 1; } });
  assertPressed(hazardButtons.high, true);
  assert.equal(listBox.children.length, 1);
  assert.equal(prevented, 1, 'Enter on the card must not scroll the page');

  elements.cardHigh.fire('keydown', { key: ' ', preventDefault() { prevented += 1; } });
  assertPressed(hazardButtons.high, false);
  assert.equal(listBox.children.length, 13);
  assert.equal(prevented, 2);

  elements.cardHigh.fire('keydown', { key: 'a', preventDefault() { prevented += 1; } });
  assertPressed(hazardButtons.high, false);
  assert.equal(prevented, 2, 'other keys are ignored');
});

test('fixture and hazard filters combine', () => {
  const { fixtureButtons, hazardButtons, listBox, countSummary } = loadHilPage();

  fixtureButtons.motor.fire('click');
  hazardButtons.low.fire('click');
  assertPressed(fixtureButtons.motor, true);
  assertPressed(hazardButtons.low, true);

  // motor has 6 cases: HIL-05 HIL-07 HIL-08 HIL-09 HIL-13 (low) and HIL-12 (none)
  assert.equal(listBox.children.length, 5);
  assert.ok(listBox.children.every((c) => c.innerHTML.includes('סיכון low') && c.innerHTML.includes('מנוע על שולחן')));
  assert.equal(countSummary.textContent, 'מוצגים 5 מתוך 13 מקרים (סינון פעיל)');

  hazardButtons.none.fire('click');
  assert.equal(listBox.children.length, 1);
  assert.ok(listBox.children[0].innerHTML.includes('HIL-12'));
  assert.ok(listBox.children[0].innerHTML.includes('סיכון none'));
});

test('empty state keeps the accessible message and its reset button restores both filters', () => {
  const { fixtureButtons, hazardButtons, listBox, countSummary } = loadHilPage();

  // usb + high -> no case matches
  fixtureButtons.usb.fire('click');
  hazardButtons.high.fire('click');
  assert.equal(listBox.children.length, 1);

  const emptyCard = listBox.children[0];
  assert.equal(emptyCard.id, 'emptyMsg');
  assert.ok(emptyCard.textContent.includes('אין מקרים התואמים לסינון'));
  assert.equal(countSummary.textContent, 'מוצגים 0 מתוך 13 מקרים (סינון פעיל)');

  const resetBtn = emptyCard.children.find((c) => c.id === 'resetFilters');
  assert.ok(resetBtn, 'resetFilters button must sit inside the empty message');
  assert.equal(resetBtn.type, 'button');
  assert.equal(resetBtn.textContent, 'איפוס מסננים');
  resetBtn.fire('click');

  assertPressed(fixtureButtons.all, true);
  assertPressed(fixtureButtons.usb, false);
  assertPressed(hazardButtons.all, true);
  assertPressed(hazardButtons.high, false);
  assert.equal(listBox.children.length, 13);
  assert.equal(countSummary.textContent, 'מוצגים 13 מתוך 13 מקרי HIL');
});

test('filter buttons are preserved across clicks (no DOM wipe, focus stays)', () => {
  const { fixtureButtons, hazardButtons, filtersContainer, hazardContainer } = loadHilPage();

  const originalFixtureElements = [...filtersContainer.children];
  const originalHazardElements = [...hazardContainer.children];

  hazardButtons.low.fire('click');
  fixtureButtons.sensors.fire('click');

  assert.equal(filtersContainer.children.length, originalFixtureElements.length);
  filtersContainer.children.forEach((b, i) => {
    assert.strictEqual(b, originalFixtureElements[i], 'fixture button reference must not be destroyed');
  });

  assert.equal(hazardContainer.children.length, originalHazardElements.length);
  hazardContainer.children.forEach((b, i) => {
    assert.strictEqual(b, originalHazardElements[i], 'hazard button reference must not be destroyed');
  });
});
