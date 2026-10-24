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
  let inner = initial.innerHTML || '';
  const children = [];
  return {
    id,
    value: initial.value || '0',
    checked: initial.checked !== undefined ? initial.checked : false,
    attrs,
    dataset: initial.dataset || {},
    style: {},
    children,
    get textContent() { return text; },
    set textContent(v) {
      text = String(v);
      if (v === '') children.length = 0;
    },
    get innerHTML() { return inner; },
    set innerHTML(v) { inner = String(v); },
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
    get lastChild() {
      return this.children[this.children.length - 1];
    },
    prepend(child) {
      child.parent = this;
      this.children.unshift(child);
    },
    remove() {
      if (this.parent) {
        const idx = this.parent.children.indexOf(this);
        if (idx !== -1) this.parent.children.splice(idx, 1);
      }
    },
    querySelectorAll() {
      return [];
    },
  };
}

function loadFsmEventsPage() {
  const scenarioButtons = {
    scReset: fakeElement('scReset', { attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] }),
    scLie: fakeElement('scLie', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    scSensor: fakeElement('scSensor', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    scHome: fakeElement('scHome', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    scStall: fakeElement('scStall', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
  };

  const matrixButtons = {
    mxFw: fakeElement('mxFw', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    mxSf: fakeElement('mxSf', { attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] }),
  };

  const eventKeys = [
    'BOOT_OK', 'BOOT_TO',
    'GLARE', 'CLEAR_ROOM', 'DEG12', 'DEG99', 'AUTO', 'MANUAL', 'PANEL0', 'STOP',
    'ARRIVE', 'TICK', 'HOME_START', 'HOME_FOUND',
    'SENSOR_FAIL', 'SENSOR_OK', 'STALL', 'LIMIT', 'POWER', 'CLEAR',
  ];
  const eventButtons = eventKeys.map((k) => fakeElement('ev-' + k, {
    dataset: { ev: k },
    classes: ['btn'],
    attrs: { 'aria-pressed': 'false' },
  }));

  const elements = {
    ...scenarioButtons,
    ...matrixButtons,
    hasEndstop: fakeElement('hasEndstop', { checked: false }),
    selfLock: fakeElement('selfLock', { checked: false }),
    clearLog: fakeElement('clearLog'),
    logCount: fakeElement('logCount', { text: '0 אירועים ביומן' }),
    log: fakeElement('log'),
    fwState: fakeElement('fwState'),
    sfState: fakeElement('sfState'),
    fwAng: fakeElement('fwAng'),
    fwMech: fakeElement('fwMech'),
    fwTgt: fakeElement('fwTgt'),
    fwFlags: fakeElement('fwFlags'),
    fwWhy: fakeElement('fwWhy'),
    sfAng: fakeElement('sfAng'),
    sfMech: fakeElement('sfMech'),
    sfTgt: fakeElement('sfTgt'),
    sfFlags: fakeElement('sfFlags'),
    sfWhy: fakeElement('sfWhy'),
    matrix: fakeElement('matrix'),
    mxCounts: fakeElement('mxCounts'),
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '[data-ev]') return eventButtons;
      return [];
    },
    createElement: (tag) => fakeElement(tag),
  };

  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/control.js'), ctx);
  vm.runInContext(read('src/lib/fsm.js'), ctx);
  vm.runInContext(read('src/lib/fsm-table.js'), ctx);

  const html = read('fsm/index.html');
  const anchor = html.indexOf('src="../src/lib/fsm-table.js"');
  assert.ok(anchor > 0, 'fsm page must load fsm-table.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { scenarioButtons, matrixButtons, eventButtons, elements };
}

test('fsm page HTML contains event button groups with role="group" and aria-label', () => {
  const html = read('fsm/index.html');
  assert.match(
    html,
    /<div class="row" role="group" aria-label="אתחול">/,
    'boot row must have role="group" and aria-label'
  );
  assert.match(
    html,
    /<div class="row" role="group" aria-label="דגימה ופקודות">/,
    'sampling and commands row must have role="group" and aria-label'
  );
  assert.match(
    html,
    /<div class="row" role="group" aria-label="תנועה והומינג">/,
    'motion and homing row must have role="group" and aria-label'
  );
  assert.match(
    html,
    /<div class="row" role="group" aria-label="כשלים">/,
    'faults row must have role="group" and aria-label'
  );
});

test('fsm page HTML initializes all 20 event buttons with aria-pressed="false"', () => {
  const html = read('fsm/index.html');
  const evKeys = [
    'BOOT_OK', 'BOOT_TO',
    'GLARE', 'CLEAR_ROOM', 'DEG12', 'DEG99', 'AUTO', 'MANUAL', 'PANEL0', 'STOP',
    'ARRIVE', 'TICK', 'HOME_START', 'HOME_FOUND',
    'SENSOR_FAIL', 'SENSOR_OK', 'STALL', 'LIMIT', 'POWER', 'CLEAR',
  ];
  evKeys.forEach((key) => {
    const rx = new RegExp('data-ev="' + key + '"[^>]*aria-pressed="false"');
    assert.match(html, rx, 'button data-ev="' + key + '" must have aria-pressed="false"');
  });
});

test('fsm page HTML contains log bar with clearLog button and logCount element', () => {
  const html = read('fsm/index.html');
  assert.match(html, /id="clearLog"/);
  assert.match(html, /id="logCount"/);
  assert.match(html, /נקה יומן/);
});

test('fsm page initializes with 1 reset event in log and logCount updated', () => {
  const { elements } = loadFsmEventsPage();
  assert.equal(elements.log.children.length, 1);
  assert.equal(elements.logCount.textContent, 'אירוע 1 ביומן');
});

test('clicking an event button activates it with .on and aria-pressed=true, keeping others false', () => {
  const { eventButtons, scenarioButtons, elements } = loadFsmEventsPage();

  const glareBtn = eventButtons.find((b) => b.dataset.ev === 'GLARE');
  const stopBtn = eventButtons.find((b) => b.dataset.ev === 'STOP');

  assert.equal(glareBtn.classList.contains('on'), false);
  assert.equal(glareBtn.getAttribute('aria-pressed'), 'false');

  glareBtn.fire('click');

  assert.equal(glareBtn.classList.contains('on'), true);
  assert.equal(glareBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(stopBtn.classList.contains('on'), false);
  assert.equal(stopBtn.getAttribute('aria-pressed'), 'false');

  // Scenario buttons are deactivated
  assert.equal(scenarioButtons.scReset.classList.contains('on'), false);
  assert.equal(scenarioButtons.scReset.getAttribute('aria-pressed'), 'false');

  // Log count incremented (initial 1 + this event = 2)
  assert.equal(elements.log.children.length, 2);
  assert.equal(elements.logCount.textContent, '2 אירועים ביומן');

  // Clicking another event button switches active event
  stopBtn.fire('click');
  assert.equal(stopBtn.classList.contains('on'), true);
  assert.equal(stopBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(glareBtn.classList.contains('on'), false);
  assert.equal(glareBtn.getAttribute('aria-pressed'), 'false');
  assert.equal(elements.log.children.length, 3);
  assert.equal(elements.logCount.textContent, '3 אירועים ביומן');
});

test('selecting a scenario button clears active event button state', () => {
  const { eventButtons, scenarioButtons } = loadFsmEventsPage();

  const stopBtn = eventButtons.find((b) => b.dataset.ev === 'STOP');
  stopBtn.fire('click');
  assert.equal(stopBtn.classList.contains('on'), true);
  assert.equal(stopBtn.getAttribute('aria-pressed'), 'true');

  scenarioButtons.scLie.fire('click');
  assert.equal(scenarioButtons.scLie.classList.contains('on'), true);
  assert.equal(scenarioButtons.scLie.getAttribute('aria-pressed'), 'true');
  assert.equal(stopBtn.classList.contains('on'), false);
  assert.equal(stopBtn.getAttribute('aria-pressed'), 'false');
});

test('clicking clearLog button clears log entries and resets log count', () => {
  const { eventButtons, elements } = loadFsmEventsPage();

  const glareBtn = eventButtons.find((b) => b.dataset.ev === 'GLARE');
  glareBtn.fire('click');
  assert.equal(elements.log.children.length, 2);

  elements.clearLog.fire('click');

  assert.equal(elements.log.children.length, 0);
  assert.equal(elements.logCount.textContent, 'אין אירועים ביומן');
  assert.equal(glareBtn.classList.contains('on'), false);
  assert.equal(glareBtn.getAttribute('aria-pressed'), 'false');
});

test('clicking boot event button activates it with .on and aria-pressed=true and logs transition', () => {
  const { eventButtons, scenarioButtons, elements } = loadFsmEventsPage();

  const bootOkBtn = eventButtons.find((b) => b.dataset.ev === 'BOOT_OK');
  const bootToBtn = eventButtons.find((b) => b.dataset.ev === 'BOOT_TO');

  assert.equal(bootOkBtn.classList.contains('on'), false);
  assert.equal(bootOkBtn.getAttribute('aria-pressed'), 'false');

  bootOkBtn.fire('click');

  assert.equal(bootOkBtn.classList.contains('on'), true);
  assert.equal(bootOkBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(bootToBtn.classList.contains('on'), false);
  assert.equal(bootToBtn.getAttribute('aria-pressed'), 'false');

  assert.equal(elements.log.children.length, 2);
  assert.equal(elements.logCount.textContent, '2 אירועים ביומן');

  // Scenario buttons are deactivated
  assert.equal(scenarioButtons.scReset.classList.contains('on'), false);
  assert.equal(scenarioButtons.scReset.getAttribute('aria-pressed'), 'false');

  // Clicking another boot event button switches active event
  bootToBtn.fire('click');
  assert.equal(bootToBtn.classList.contains('on'), true);
  assert.equal(bootToBtn.getAttribute('aria-pressed'), 'true');
  assert.equal(bootOkBtn.classList.contains('on'), false);
  assert.equal(bootOkBtn.getAttribute('aria-pressed'), 'false');
  assert.equal(elements.log.children.length, 3);
  assert.equal(elements.logCount.textContent, '3 אירועים ביומן');
});

