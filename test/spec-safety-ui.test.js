const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assertPressed(el, expected) {
  assert.equal(
    el.getAttribute('aria-pressed'),
    expected ? 'true' : 'false',
    `expected aria-pressed="${expected}" on #${el.id || el.getAttribute('data-category')}`
  );
  assert.equal(
    el.classList.contains('on'),
    expected,
    `expected class "on"=${expected} on #${el.id || el.getAttribute('data-category')}`
  );
}

function fakeElement(id, initial = {}) {
  const listeners = {};
  const attrs = { ...initial.attrs };
  const classes = new Set(initial.classes || []);
  const children = [];
  let text = initial.text || '';
  let html = '';
  return {
    id,
    attrs,
    style: {},
    dataset: {},
    children,
    get textContent() { return text; },
    set textContent(v) {
      text = String(v);
      if (v === '') children.length = 0;
    },
    get innerHTML() { return html || text; },
    set innerHTML(v) {
      html = String(v);
      text = String(v).replace(/<[^>]+>/g, '');
    },
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
      if (sel === '[data-category]' || sel === '#safetyFilterRow [data-category]') {
        return children.filter((c) => c.getAttribute('data-category') !== null);
      }
      return children;
    },
  };
}

function loadSpecSafetyUI() {
  const filterBtns = [
    fakeElement('sfAll', { attrs: { 'data-category': 'all', 'aria-pressed': 'true' }, classes: ['btn', 'on'], text: 'הכול 8' }),
    fakeElement('sfElec', { attrs: { 'data-category': 'electrical', 'aria-pressed': 'false' }, classes: ['btn'], text: 'חשמל וחיווט 4' }),
    fakeElement('sfMech', { attrs: { 'data-category': 'mechanical', 'aria-pressed': 'false' }, classes: ['btn'], text: 'מכניקה והרכבה 4' }),
  ];

  const filterRow = fakeElement('safetyFilterRow');
  filterBtns.forEach((b) => filterRow.appendChild(b));

  const safetyList = fakeElement('safetyList');
  const safetyCount = fakeElement('safetyCount');

  const elements = {
    safetyFilterRow: filterRow,
    safetyList,
    safetyCount,
    sfAll: filterBtns[0],
    sfElec: filterBtns[1],
    sfMech: filterBtns[2],
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel.includes('data-category')) return filterBtns;
      return [];
    },
    createElement: (tag) => {
      const el = fakeElement('el-' + Math.random());
      el.tag = tag;
      return el;
    },
  };

  const window = {};
  const ctx = vm.createContext({ document, window, console });
  ctx.window = window;
  ctx.globalThis = ctx;

  vm.runInContext(read('src/lib/safety.js'), ctx);
  if (!window.SM_SAFETY && ctx.SM_SAFETY) window.SM_SAFETY = ctx.SM_SAFETY;

  const html = read('spec/index.html');
  const anchor = html.indexOf('src="../src/lib/safety.js"');
  assert.ok(anchor > 0, 'spec page must include safety.js script tag');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return {
    filterBtns,
    filterRow,
    safetyList,
    safetyCount,
    getBtn: (cat) => filterBtns.find((b) => b.getAttribute('data-category') === cat),
  };
}

test('spec/index.html markup includes safety guidelines section, ARIA roles, and RTL styles', () => {
  const html = read('spec/index.html');

  assert.ok(html.includes('<h2>הנחיות בטיחות והרכבה</h2>'));
  assert.ok(html.includes('id="safetyCard"'));
  assert.ok(html.includes('<div class="row" role="group" aria-label="סינון הנחיות בטיחות" id="safetyFilterRow">'));
  assert.ok(html.includes('data-category="all"'));
  assert.ok(html.includes('data-category="electrical"'));
  assert.ok(html.includes('data-category="mechanical"'));
  assert.ok(html.includes('<p id="safetyCount" class="note" aria-live="polite"'));
  assert.ok(html.includes('<div id="safetyList" class="safety-grid"></div>'));
  assert.ok(html.includes('<script src="../src/lib/safety.js"></script>'));

  // RTL slider fixes
  assert.match(html, /input\[type=range\],input\[type=number\]\{[^}]*direction:ltr/, 'CSS has direction:ltr for range/number inputs');
  assert.match(html, /id="massKg"[^>]*dir="ltr"/, 'massKg has dir=ltr');
  assert.match(html, /id="cogCm"[^>]*dir="ltr"/, 'cogCm has dir=ltr');
  assert.match(html, /id="tiltDeg"[^>]*dir="ltr"/, 'tiltDeg has dir=ltr');
});

test('spec safety guidelines initialize with "all" active and render 8 guidelines', () => {
  const ui = loadSpecSafetyUI();

  assertPressed(ui.getBtn('all'), true);
  assertPressed(ui.getBtn('electrical'), false);
  assertPressed(ui.getBtn('mechanical'), false);

  assert.equal(ui.safetyList.children.length, 8, 'should render 8 safety items initially');
  assert.equal(ui.safetyCount.textContent, 'מציג 8 מתוך 8 הנחיות בטיחות');

  const categories = ui.safetyList.children.map((c) => c.getAttribute('data-category'));
  assert.equal(categories.filter((c) => c === 'electrical').length, 4);
  assert.equal(categories.filter((c) => c === 'mechanical').length, 4);
});

test('filtering by electrical guidelines updates aria-pressed and shows 4 electrical items', () => {
  const ui = loadSpecSafetyUI();

  ui.getBtn('electrical').fire('click');

  assertPressed(ui.getBtn('electrical'), true);
  assertPressed(ui.getBtn('all'), false);
  assertPressed(ui.getBtn('mechanical'), false);

  assert.equal(ui.safetyList.children.length, 4);
  assert.ok(ui.safetyCount.textContent.includes('חשמל וחיווט'));
  assert.ok(ui.safetyCount.textContent.includes('4 מתוך 8'));

  ui.safetyList.children.forEach((card) => {
    assert.equal(card.getAttribute('data-category'), 'electrical');
  });
});

test('filtering by mechanical guidelines updates aria-pressed and shows 4 mechanical items', () => {
  const ui = loadSpecSafetyUI();

  ui.getBtn('mechanical').fire('click');

  assertPressed(ui.getBtn('mechanical'), true);
  assertPressed(ui.getBtn('all'), false);
  assertPressed(ui.getBtn('electrical'), false);

  assert.equal(ui.safetyList.children.length, 4);
  assert.ok(ui.safetyCount.textContent.includes('מכניקה והרכבה'));
  assert.ok(ui.safetyCount.textContent.includes('4 מתוך 8'));

  ui.safetyList.children.forEach((card) => {
    assert.equal(card.getAttribute('data-category'), 'mechanical');
  });
});

test('restoring "all" filter re-renders all 8 safety guidelines', () => {
  const ui = loadSpecSafetyUI();

  ui.getBtn('electrical').fire('click');
  assert.equal(ui.safetyList.children.length, 4);

  ui.getBtn('all').fire('click');
  assertPressed(ui.getBtn('all'), true);
  assertPressed(ui.getBtn('electrical'), false);
  assert.equal(ui.safetyList.children.length, 8);
  assert.equal(ui.safetyCount.textContent, 'מציג 8 מתוך 8 הנחיות בטיחות');
});
