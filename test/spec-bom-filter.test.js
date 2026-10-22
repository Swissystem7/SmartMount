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
  let isHidden = initial.hidden !== undefined ? initial.hidden : false;
  let val = initial.value !== undefined ? String(initial.value) : '0';
  let isChecked = initial.checked !== undefined ? Boolean(initial.checked) : false;
  return {
    id,
    tagName: initial.tagName || 'DIV',
    attrs,
    dataset: initial.dataset || {},
    children,
    innerHTML: '',
    get value() { return val; },
    set value(v) { val = String(v); },
    get checked() { return isChecked; },
    set checked(v) { isChecked = Boolean(v); },
    get hidden() { return isHidden; },
    set hidden(v) { isHidden = Boolean(v); },
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
    appendChild(child) { children.push(child); return child; },
    querySelectorAll(sel) {
      if (sel === '.btn') {
        return children.filter((c) => c.className && c.className.includes('btn'));
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

test('spec page HTML defines accessible BOM filter toolbar and data-status attributes', () => {
  const html = read('spec/index.html');
  assert.match(html, /<div class="row" id="bomFilters" role="group" aria-label="סינון פריטי חומרים לפי מצב">/);
  assert.match(html, /<button[^>]*class="btn on"[^>]*data-bom="all"[^>]*aria-pressed="true"/);
  assert.match(html, /data-bom="ok"[^>]*aria-pressed="false"/);
  assert.match(html, /data-bom="warn"[^>]*aria-pressed="false"/);
  assert.match(html, /data-bom="miss"[^>]*aria-pressed="false"/);
  assert.match(html, /<p id="bomFilterCount" class="fine" aria-live="polite"/);
  assert.match(html, /<tr id="bomEmptyRow" hidden>/);

  const okCount = (html.match(/<tr data-status="ok">/g) || []).length;
  const warnCount = (html.match(/<tr data-status="warn">/g) || []).length;
  const missCount = (html.match(/<tr data-status="miss">/g) || []).length;

  assert.equal(okCount, 4, 'BOM table should have 4 ok items');
  assert.equal(warnCount, 1, 'BOM table should have 1 warn item');
  assert.equal(missCount, 5, 'BOM table should have 5 miss items');
});

test('spec page script filters BOM table rows and updates aria-pressed and live announcement', () => {
  const html = read('spec/index.html');
  const anchor = html.indexOf('src="../src/lib/torque.js"');
  assert.ok(anchor > 0, 'spec page must load src/lib/torque.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);

  const btnAll = fakeElement('btn-bom-all', {
    attrs: { 'data-bom': 'all', 'aria-pressed': 'true' },
    classes: ['btn', 'on'],
  });
  const btnOk = fakeElement('btn-bom-ok', {
    attrs: { 'data-bom': 'ok', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const btnWarn = fakeElement('btn-bom-warn', {
    attrs: { 'data-bom': 'warn', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const btnMiss = fakeElement('btn-bom-miss', {
    attrs: { 'data-bom': 'miss', 'aria-pressed': 'false' },
    classes: ['btn'],
  });
  const filterBtns = [btnAll, btnOk, btnWarn, btnMiss];

  const rows = [
    fakeElement('r1', { attrs: { 'data-status': 'ok' } }),
    fakeElement('r2', { attrs: { 'data-status': 'ok' } }),
    fakeElement('r3', { attrs: { 'data-status': 'ok' } }),
    fakeElement('r4', { attrs: { 'data-status': 'warn' } }),
    fakeElement('r5', { attrs: { 'data-status': 'ok' } }),
    fakeElement('r6', { attrs: { 'data-status': 'miss' } }),
    fakeElement('r7', { attrs: { 'data-status': 'miss' } }),
    fakeElement('r8', { attrs: { 'data-status': 'miss' } }),
    fakeElement('r9', { attrs: { 'data-status': 'miss' } }),
    fakeElement('r10', { attrs: { 'data-status': 'miss' } }),
  ];

  const emptyRow = fakeElement('bomEmptyRow', { hidden: true });
  const countEl = fakeElement('bomFilterCount');
  const presetRow = fakeElement('presetRow');

  const elements = {
    presetRow,
    bomEmptyRow: emptyRow,
    bomFilterCount: countEl,
    'btn-bom-all': btnAll,
    'btn-bom-ok': btnOk,
    'btn-bom-warn': btnWarn,
    'btn-bom-miss': btnMiss,
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

  const fakeDocument = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '#bomFilters [data-bom]') return filterBtns;
      if (sel === '#bomBody tr[data-status]') return rows;
      return [];
    },
    createElement: (tag) => fakeElement(tag, { tagName: tag.toUpperCase() }),
  };

  const sandbox = {
    window: {},
    document: fakeDocument,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(read('src/lib/torque.js'), sandbox);
  vm.runInContext(scriptContent, sandbox);

  // Initial state: all button on, all rows visible
  assertPressed(btnAll, true);
  assertPressed(btnOk, false);
  assertPressed(btnWarn, false);
  assertPressed(btnMiss, false);
  assert.equal(rows.filter((r) => !r.hidden).length, 10);
  assert.equal(emptyRow.hidden, true);

  // Click ok filter (4 items)
  btnOk.fire('click');
  assertPressed(btnAll, false);
  assertPressed(btnOk, true);
  assertPressed(btnWarn, false);
  assertPressed(btnMiss, false);
  assert.equal(rows.filter((r) => !r.hidden).length, 4);
  assert.match(countEl.textContent, /מציג 4 מתוך 10 פריטי חומרים \(בקושחה \/ נדרש\)/);
  assert.equal(emptyRow.hidden, true);

  // Click warn filter (1 item)
  btnWarn.fire('click');
  assertPressed(btnOk, false);
  assertPressed(btnWarn, true);
  assert.equal(rows.filter((r) => !r.hidden).length, 1);
  assert.match(countEl.textContent, /מציג 1 מתוך 10 פריטי חומרים \(אזהרה\)/);
  assert.equal(emptyRow.hidden, true);

  // Click miss filter (5 items)
  btnMiss.fire('click');
  assertPressed(btnWarn, false);
  assertPressed(btnMiss, true);
  assert.equal(rows.filter((r) => !r.hidden).length, 5);
  assert.match(countEl.textContent, /מציג 5 מתוך 10 פריטי חומרים \(חסר \/ לא פתור\)/);
  assert.equal(emptyRow.hidden, true);

  // Click all filter (back to 10 items)
  btnAll.fire('click');
  assertPressed(btnMiss, false);
  assertPressed(btnAll, true);
  assert.equal(rows.filter((r) => !r.hidden).length, 10);
  assert.match(countEl.textContent, /מציג 10 מתוך 10 פריטי חומרים/);
  assert.equal(emptyRow.hidden, true);
});
