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
  return {
    id,
    value: initial.value || '0',
    checked: initial.checked !== undefined ? initial.checked : false,
    attrs,
    dataset: initial.dataset || {},
    style: {},
    children: [],
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
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
    querySelectorAll(sel) {
      return [];
    },
  };
}

function loadFsmPage() {
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

  const eventButtons = [
    fakeElement('btn-glar', { dataset: { ev: 'GLARE' } }),
    fakeElement('btn-stop', { dataset: { ev: 'STOP' } }),
  ];

  const elements = {
    ...scenarioButtons,
    ...matrixButtons,
    hasEndstop: fakeElement('hasEndstop', { checked: false }),
    selfLock: fakeElement('selfLock', { checked: false }),
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

test('fsm page HTML contains scenario and matrix buttons with initial aria-pressed attributes', () => {
  const html = read('fsm/index.html');
  assert.match(
    html,
    /<button type="button" class="btn on" id="scReset" aria-pressed="true">/,
    'scReset must start with class "btn on" and aria-pressed="true"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="scLie" aria-pressed="false">/,
    'scLie must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="scSensor" aria-pressed="false">/,
    'scSensor must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="scHome" aria-pressed="false">/,
    'scHome must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="scStall" aria-pressed="false">/,
    'scStall must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="mxFw" aria-pressed="false">/,
    'mxFw must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<button type="button" class="btn on" id="mxSf" aria-pressed="true">/,
    'mxSf must start with class "btn on" and aria-pressed="true"'
  );
});

test('fsm page initializes scenario buttons with scReset active and aria-pressed=true', () => {
  const { scenarioButtons } = loadFsmPage();
  assert.equal(scenarioButtons.scReset.classList.contains('on'), true);
  assert.equal(scenarioButtons.scReset.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scLie.classList.contains('on'), false);
  assert.equal(scenarioButtons.scLie.getAttribute('aria-pressed'), 'false');
});

test('clicking scenario buttons updates active and aria-pressed states', () => {
  const { scenarioButtons } = loadFsmPage();

  scenarioButtons.scLie.fire('click');
  assert.equal(scenarioButtons.scLie.classList.contains('on'), true);
  assert.equal(scenarioButtons.scLie.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scReset.classList.contains('on'), false);
  assert.equal(scenarioButtons.scReset.getAttribute('aria-pressed'), 'false');

  scenarioButtons.scSensor.fire('click');
  assert.equal(scenarioButtons.scSensor.classList.contains('on'), true);
  assert.equal(scenarioButtons.scSensor.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scLie.classList.contains('on'), false);
  assert.equal(scenarioButtons.scLie.getAttribute('aria-pressed'), 'false');

  scenarioButtons.scHome.fire('click');
  assert.equal(scenarioButtons.scHome.classList.contains('on'), true);
  assert.equal(scenarioButtons.scHome.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scSensor.classList.contains('on'), false);
  assert.equal(scenarioButtons.scSensor.getAttribute('aria-pressed'), 'false');

  scenarioButtons.scStall.fire('click');
  assert.equal(scenarioButtons.scStall.classList.contains('on'), true);
  assert.equal(scenarioButtons.scStall.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scHome.classList.contains('on'), false);
  assert.equal(scenarioButtons.scHome.getAttribute('aria-pressed'), 'false');

  scenarioButtons.scReset.fire('click');
  assert.equal(scenarioButtons.scReset.classList.contains('on'), true);
  assert.equal(scenarioButtons.scReset.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scStall.classList.contains('on'), false);
  assert.equal(scenarioButtons.scStall.getAttribute('aria-pressed'), 'false');
});

test('triggering custom event deactivates scenario buttons', () => {
  const { scenarioButtons, eventButtons } = loadFsmPage();

  assert.equal(scenarioButtons.scReset.classList.contains('on'), true);
  assert.equal(scenarioButtons.scReset.getAttribute('aria-pressed'), 'true');

  eventButtons[0].fire('click');
  for (const b of Object.values(scenarioButtons)) {
    assert.equal(b.classList.contains('on'), false);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }
});

test('toggling options deactivates scenario buttons', () => {
  const { scenarioButtons, elements } = loadFsmPage();

  scenarioButtons.scLie.fire('click');
  assert.equal(scenarioButtons.scLie.classList.contains('on'), true);

  elements.hasEndstop.fire('change');
  for (const b of Object.values(scenarioButtons)) {
    assert.equal(b.classList.contains('on'), false);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }
});

test('matrix toggle buttons switch active and aria-pressed states', () => {
  const { matrixButtons } = loadFsmPage();

  assert.equal(matrixButtons.mxSf.classList.contains('on'), true);
  assert.equal(matrixButtons.mxSf.getAttribute('aria-pressed'), 'true');
  assert.equal(matrixButtons.mxFw.classList.contains('on'), false);
  assert.equal(matrixButtons.mxFw.getAttribute('aria-pressed'), 'false');

  matrixButtons.mxFw.fire('click');
  assert.equal(matrixButtons.mxFw.classList.contains('on'), true);
  assert.equal(matrixButtons.mxFw.getAttribute('aria-pressed'), 'true');
  assert.equal(matrixButtons.mxSf.classList.contains('on'), false);
  assert.equal(matrixButtons.mxSf.getAttribute('aria-pressed'), 'false');

  matrixButtons.mxSf.fire('click');
  assert.equal(matrixButtons.mxSf.classList.contains('on'), true);
  assert.equal(matrixButtons.mxSf.getAttribute('aria-pressed'), 'true');
  assert.equal(matrixButtons.mxFw.classList.contains('on'), false);
  assert.equal(matrixButtons.mxFw.getAttribute('aria-pressed'), 'false');
});
