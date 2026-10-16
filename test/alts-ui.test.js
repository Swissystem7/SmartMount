const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SM_ALTS = require('../src/lib/alts');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'alts', 'index.html'), 'utf8');

function assertPressed(btn, on) {
  assert.equal(
    btn.classList.contains('on'),
    on,
    `expected button ${btn.getAttribute('data-term') || btn.id || 'btn'} class .on to be ${on}`
  );
  assert.equal(
    btn.getAttribute('aria-pressed'),
    String(on),
    `expected button ${btn.getAttribute('data-term') || btn.id || 'btn'} aria-pressed to be ${on}`
  );
}

function createFakeDom() {
  function makeElement(tag, initial = {}) {
    const listeners = {};
    const attrs = { ...initial.attrs };
    const classes = new Set(initial.classes || []);
    let text = initial.text || '';
    let inner = initial.innerHTML || '';
    let val = initial.value !== undefined ? String(initial.value) : '';
    const children = [];

    const el = {
      tagName: tag.toUpperCase(),
      id: initial.id || '',
      get value() { return val; },
      set value(v) { val = String(v); },
      attrs,
      style: {},
      children,
      hidden: initial.hidden !== undefined ? initial.hidden : false,
      get textContent() { return text; },
      set textContent(v) {
        text = String(v);
        children.length = 0;
      },
      get innerHTML() { return inner; },
      set innerHTML(v) {
        inner = String(v);
        if (v.includes('reset-search-btn')) {
          const btn = makeElement('button', { classes: ['btn', 'reset-search-btn'] });
          children.push(btn);
        }
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
      removeAttribute(k) { delete attrs[k]; },
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
      querySelector(sel) {
        if (sel === '.opts') {
          return makeElement('div', { classes: ['opts'] });
        }
        if (sel === '.reset-search-btn') {
          return children.find((c) => c.classList.contains('reset-search-btn')) || null;
        }
        return null;
      },
      focus() {
        el.focused = true;
      },
    };
    return el;
  }

  const q = makeElement('input', { id: 'q', value: '' });
  const count = makeElement('p', { id: 'count', attrs: { 'aria-live': 'polite' } });
  const list = makeElement('div', { id: 'list' });
  const clearBtn = makeElement('button', { id: 'clearBtn', hidden: true });

  const chipTerms = ['', 'תריס חכם', 'זרוע מוניטור', 'סרבו', 'תולעת', 'צעד'];
  const chips = chipTerms.map((term, i) =>
    makeElement('button', {
      classes: ['btn', 'chip', ...(i === 0 ? ['on'] : [])],
      attrs: { 'data-term': term, 'aria-pressed': i === 0 ? 'true' : 'false' },
    })
  );

  const byId = {
    q,
    count,
    list,
    clearBtn,
  };

  const doc = {
    getElementById(id) {
      return byId[id] || null;
    },
    querySelectorAll(sel) {
      if (sel === '.chips .chip') return chips;
      return [];
    },
    createElement(tag) {
      return makeElement(tag);
    },
  };

  return { doc, q, count, list, clearBtn, chips };
}

// indexOf, not a tag regexp, so CodeQL does not flag it (see lab-stop.test.js).
function inlineAltsScript() {
  const open = '<script>';
  const close = '</script>';
  const anchor = page.indexOf('src="../src/lib/alts.js"');
  assert.ok(anchor > 0, 'alts page must load alts.js');
  const start = page.indexOf(open, anchor);
  assert.ok(start > anchor, 'alts has an inline script');
  const end = page.indexOf(close, start);
  assert.ok(end > start);
  assert.equal(page.indexOf(open, end), -1, 'alts has exactly one inline script');
  return page.slice(start + open.length, end);
}

function runAltsScript(dom) {
  const code = inlineAltsScript();

  const sandbox = {
    document: dom.doc,
    SM_ALTS,
    Array,
    String,
    Boolean,
    console,
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
}

test('HTML structure: search row, clear button, and filter chips toolbar exist', () => {
  assert.match(page, /<div class="search-row">/);
  assert.match(page, /id="clearBtn"/);
  assert.match(page, /aria-label="נקה חיפוש"/);
  assert.match(page, /role="toolbar"/);
  assert.match(page, /aria-label="חיפושים נפוצים"/);
  assert.match(page, /class="btn chip on" data-term="" aria-pressed="true">הכל<\/button>/);
  assert.match(page, /data-term="תריס חכם" aria-pressed="false"/);
  assert.match(page, /data-term="זרוע מוניטור" aria-pressed="false"/);
  assert.match(page, /data-term="סרבו" aria-pressed="false"/);
  assert.match(page, /data-term="תולעת" aria-pressed="false"/);
  assert.match(page, /data-term="צעד" aria-pressed="false"/);
});

test('CSS classes for search-row, chips, clear-btn, and empty-state are present', () => {
  assert.match(page, /\.search-row\{/);
  assert.match(page, /\.clear-btn\{/);
  assert.match(page, /\.chips\{/);
  assert.match(page, /\.chip\{/);
  assert.match(page, /\.empty-state\{/);
});

test('initial script execution: "הכל" chip is pressed and all decisions render', () => {
  const dom = createFakeDom();
  runAltsScript(dom);

  assertPressed(dom.chips[0], true);
  for (let i = 1; i < dom.chips.length; i++) {
    assertPressed(dom.chips[i], false);
  }
  assert.equal(dom.clearBtn.hidden, true);
  assert.equal(dom.list.children.length, SM_ALTS.DECISIONS.length);
  assert.equal(dom.count.textContent, '');
});

test('clicking a chip button filters results and updates pressed state', () => {
  const dom = createFakeDom();
  runAltsScript(dom);

  const smartBlindChip = dom.chips.find((c) => c.getAttribute('data-term') === 'תריס חכם');
  assert.ok(smartBlindChip);
  smartBlindChip.fire('click');

  assert.equal(dom.q.value, 'תריס חכם');
  assertPressed(smartBlindChip, true);
  assertPressed(dom.chips[0], false);
  assert.equal(dom.clearBtn.hidden, false);
  assert.equal(dom.list.children.length, 1);
  assert.match(dom.count.textContent, /נמצאה חלופה אחת עבור «תריס חכם»/);
  assert.equal(smartBlindChip.focused, true);
});

test('switching between chip buttons updates which one is pressed', () => {
  const dom = createFakeDom();
  runAltsScript(dom);

  const smartBlindChip = dom.chips.find((c) => c.getAttribute('data-term') === 'תריס חכם');
  const monitorArmChip = dom.chips.find((c) => c.getAttribute('data-term') === 'זרוע מוניטור');

  smartBlindChip.fire('click');
  assertPressed(smartBlindChip, true);
  assertPressed(monitorArmChip, false);

  monitorArmChip.fire('click');
  assert.equal(dom.q.value, 'זרוע מוניטור');
  assertPressed(smartBlindChip, false);
  assertPressed(monitorArmChip, true);
  assert.equal(dom.list.children.length, 1);

  // Click "הכל" chip resets
  dom.chips[0].fire('click');
  assert.equal(dom.q.value, '');
  assertPressed(dom.chips[0], true);
  assertPressed(monitorArmChip, false);
  assert.equal(dom.clearBtn.hidden, true);
  assert.equal(dom.list.children.length, SM_ALTS.DECISIONS.length);
});

test('typing into search input synchronizes chips and clear button', () => {
  const dom = createFakeDom();
  runAltsScript(dom);

  const servoChip = dom.chips.find((c) => c.getAttribute('data-term') === 'סרבו');
  dom.q.value = 'סרבו';
  dom.q.fire('input');

  assertPressed(servoChip, true);
  assertPressed(dom.chips[0], false);
  assert.equal(dom.clearBtn.hidden, false);
  assert.equal(dom.list.children.length, 1);

  // Custom text that does not match a preset chip
  dom.q.value = 'חדר';
  dom.q.fire('input');
  for (const chip of dom.chips) {
    assertPressed(chip, false);
  }
  assert.equal(dom.clearBtn.hidden, false);

  // Clearing text re-activates "הכל"
  dom.q.value = '';
  dom.q.fire('input');
  assertPressed(dom.chips[0], true);
  assert.equal(dom.clearBtn.hidden, true);
  assert.equal(dom.list.children.length, SM_ALTS.DECISIONS.length);
});

test('empty search result renders empty-state card with functional reset button', () => {
  const dom = createFakeDom();
  runAltsScript(dom);

  dom.q.value = 'מונח שלא קיים';
  dom.q.fire('input');

  assert.match(dom.count.textContent, /אין חלופה שמכילה «מונח שלא קיים»/);
  assert.equal(dom.list.children.length, 1);
  const emptyCard = dom.list.children[0];
  assert.equal(emptyCard.classList.contains('empty-state'), true);

  const resetBtn = emptyCard.children.find((c) => c.classList.contains('reset-search-btn'));
  assert.ok(resetBtn, 'reset button must be rendered in empty state card');

  resetBtn.fire('click');
  assert.equal(dom.q.value, '');
  assertPressed(dom.chips[0], true);
  assert.equal(dom.clearBtn.hidden, true);
  assert.equal(dom.list.children.length, SM_ALTS.DECISIONS.length);
  assert.equal(dom.q.focused, true);
});

test('clear button resets input, reactivates "הכל", and focuses input', () => {
  const dom = createFakeDom();
  runAltsScript(dom);

  const wormChip = dom.chips.find((c) => c.getAttribute('data-term') === 'תולעת');
  wormChip.fire('click');
  assert.equal(dom.q.value, 'תולעת');
  assert.equal(dom.clearBtn.hidden, false);

  dom.clearBtn.fire('click');
  assert.equal(dom.q.value, '');
  assert.equal(dom.clearBtn.hidden, true);
  assertPressed(dom.chips[0], true);
  assertPressed(wormChip, false);
  assert.equal(dom.list.children.length, SM_ALTS.DECISIONS.length);
  assert.equal(dom.q.focused, true);
});
