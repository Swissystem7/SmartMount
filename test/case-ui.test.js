const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assertPressed(btn, on) {
  assert.equal(btn.classList.contains('on'), on);
  assert.equal(btn.getAttribute('aria-pressed'), String(on));
}

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  let text = initial.text || '';
  const children = [];
  return {
    id,
    tagName: initial.tagName || 'DIV',
    attrs,
    dataset: initial.dataset || {},
    children,
    innerHTML: '',
    get textContent() { return text; },
    set textContent(v) { text = String(v); if (!v) children.length = 0; },
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
    appendChild(child) { children.push(child); return child; },
    querySelectorAll(sel) {
      if (sel === 'article' || sel === '.card') {
        return children.filter((c) => c.className && c.className.includes('card'));
      }
      return [];
    },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    fire(type) {
      (listeners[type] || []).forEach((fn) => fn());
    },
  };
}

test('case page HTML defines accessible bug severity filters and table scroll', () => {
  const html = read('case/index.html');
  assert.match(html, /<div class="row" id="bugFilters" role="group" aria-label="סינון באגים לפי חומרה">/);
  assert.match(html, /<button[^>]*class="btn on"[^>]*data-severity="all"[^>]*aria-pressed="true"/);
  assert.match(html, /data-severity="safety"[^>]*aria-pressed="false"/);
  assert.match(html, /data-severity="contract"[^>]*aria-pressed="false"/);
  assert.match(html, /data-severity="availability"[^>]*aria-pressed="false"/);
  assert.match(html, /data-severity="honesty"[^>]*aria-pressed="false"/);
  assert.match(html, /data-severity="build"[^>]*aria-pressed="false"/);
  assert.match(html, /<p id="bugFilterCount" class="fine" aria-live="polite"/);
  assert.match(html, /<div class="table-scroll">\s*<table>/);
});

test('case page script filters bugs, updates aria-pressed and live announcement', () => {
  const html = read('case/index.html');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  assert.ok(scriptMatch, 'missing inline script in case/index.html');
  const scriptCode = scriptMatch[1];

  const btnAll = fakeElement('btn-all', {
    attrs: { 'data-severity': 'all', 'aria-pressed': 'true' },
    classes: ['btn', 'on'],
  });
  const btnSafety = fakeElement('btn-safety', {
    attrs: { 'data-severity': 'safety', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const btnContract = fakeElement('btn-contract', {
    attrs: { 'data-severity': 'contract', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const btnAvailability = fakeElement('btn-availability', {
    attrs: { 'data-severity': 'availability', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const btnHonesty = fakeElement('btn-honesty', {
    attrs: { 'data-severity': 'honesty', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const btnBuild = fakeElement('btn-build', {
    attrs: { 'data-severity': 'build', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const filterBtns = [btnAll, btnSafety, btnContract, btnAvailability, btnHonesty, btnBuild];

  const bugsList = fakeElement('bugsList');
  const bugFilterCount = fakeElement('bugFilterCount');
  const elements = {
    verdictBox: fakeElement('verdictBox'),
    buildBox: fakeElement('buildBox'),
    bugsList,
    bugFilterCount,
    openList: fakeElement('openList'),
    fwStates: fakeElement('fwStates'),
    fwNote: fakeElement('fwNote'),
    safeStates: fakeElement('safeStates'),
    safeNote: fakeElement('safeNote'),
    tradeBody: fakeElement('tradeBody'),
    shownList: fakeElement('shownList'),
    notShownList: fakeElement('notShownList'),
    'btn-all': btnAll,
    'btn-safety': btnSafety,
    'btn-contract': btnContract,
    'btn-availability': btnAvailability,
    'btn-honesty': btnHonesty,
    'btn-build': btnBuild,
  };

  const fakeDocument = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '#bugFilters [data-severity]') return filterBtns;
      return [];
    },
    createElement: (tag) => fakeElement(tag, { tagName: tag.toUpperCase() }),
  };

  const sandbox = {
    window: { SM_CASE: require('../src/lib/case') },
    document: fakeDocument,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox);

  // Initial render: all 6 bugs rendered, all button pressed
  assertPressed(btnAll, true);
  assertPressed(btnSafety, false);
  assert.equal(bugsList.children.length, 6);
  assert.match(bugFilterCount.textContent, /מציג 6 מתוך 6 ממצאי סקירה/);

  // Click safety filter: 2 bugs
  btnSafety.fire('click');
  assertPressed(btnAll, false);
  assertPressed(btnSafety, true);
  assertPressed(btnBuild, false);
  assert.equal(bugsList.children.length, 2);
  bugsList.children.forEach((c) => assert.equal(c.getAttribute('data-bug-severity'), 'safety'));
  assert.match(bugFilterCount.textContent, /מציג 2 מתוך 6 ממצאי סקירה \(בטיחות\)/);

  // Click build filter: 1 bug
  btnBuild.fire('click');
  assertPressed(btnSafety, false);
  assertPressed(btnBuild, true);
  assert.equal(bugsList.children.length, 1);
  assert.equal(bugsList.children[0].getAttribute('data-bug-severity'), 'build');
  assert.match(bugFilterCount.textContent, /מציג 1 מתוך 6 ממצאי סקירה \(הידור\)/);

  // Click all filter: back to 6 bugs
  btnAll.fire('click');
  assertPressed(btnAll, true);
  assertPressed(btnBuild, false);
  assert.equal(bugsList.children.length, 6);
  assert.match(bugFilterCount.textContent, /מציג 6 מתוך 6 ממצאי סקירה/);
});
