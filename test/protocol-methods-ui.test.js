const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// src/lib/protocol.js decides 405 for PUT on a registered path and 404 for
// every other wrong method, and test/protocol-method-matrix.test.js pins that
// matrix — but the protocol/ page used to send ARG[route].method, so no click
// could ever produce either answer. These tests cover the method toolbar that
// makes them reachable, and the board-state readout next to the response.

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
  let val = initial.value !== undefined ? String(initial.value) : '';
  return {
    id,
    get value() { return val; },
    set value(v) { val = String(v); },
    disabled: false,
    placeholder: '',
    attrs,
    dataset: initial.dataset || {},
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
  };
}

// Seed each toolbar from the attributes the page ships, so a drift between the
// markup and the first syncPressed() call would show up as a failure.
function toolbar(name, entries) {
  const out = {};
  for (const [id, value, on] of entries) {
    out[id] = fakeElement(id, {
      attrs: { 'aria-pressed': String(on) },
      classes: on ? ['btn', 'on'] : ['btn'],
      dataset: { [name]: value },
    });
  }
  return out;
}

function loadProtocolPage() {
  const methodButtons = toolbar('method', [
    ['mGet', 'GET', true],
    ['mPost', 'POST', false],
    ['mPut', 'PUT', false],
    ['mDelete', 'DELETE', false],
  ]);
  const routeButtons = toolbar('route', [
    ['rStatus', 'status', true],
    ['rAngle', 'angle', false],
    ['rPanel', 'panel', false],
    ['rMode', 'mode', false],
    ['rStop', 'stop', false],
  ]);

  const elements = {
    ...methodButtons,
    ...routeButtons,
    argVal: fakeElement('argVal'),
    reqLine: fakeElement('reqLine'),
    resCode: fakeElement('resCode'),
    resBody: fakeElement('resBody'),
    effectNote: fakeElement('effectNote'),
    sendBtn: fakeElement('sendBtn'),
    exBad: fakeElement('exBad'),
    exQuirk: fakeElement('exQuirk'),
    ex405: fakeElement('ex405'),
    ex404: fakeElement('ex404'),
    exReset: fakeElement('exReset'),
    stAngle: fakeElement('stAngle'),
    stTarget: fakeElement('stTarget'),
    stMode: fakeElement('stMode'),
    stPanel: fakeElement('stPanel'),
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '[data-route]') return Object.values(routeButtons);
      if (sel === '[data-method]') return Object.values(methodButtons);
      return [];
    },
  };

  const ctx = vm.createContext({ document, console });
  for (const lib of ['control-params.js', 'control.js', 'protocol.js']) {
    vm.runInContext(read('src/lib/' + lib), ctx);
  }

  const html = read('protocol/index.html');
  const anchor = html.indexOf('src="../src/lib/protocol.js"');
  assert.ok(anchor > 0, 'protocol page must load protocol.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  vm.runInContext(html.slice(open + '<script>'.length, close), ctx);

  return { methodButtons, routeButtons, elements };
}

test('protocol page ships a labelled method toolbar with initial aria-pressed state', () => {
  const html = read('protocol/index.html');
  assert.match(html, /<div class="row" role="group" aria-label="שיטת HTTP">/);
  assert.match(html, /data-method="GET" id="mGet" aria-pressed="true"/);
  assert.match(html, /data-method="POST" id="mPost" aria-pressed="false"/);
  assert.match(html, /data-method="PUT" id="mPut" aria-pressed="false"/);
  assert.match(html, /data-method="DELETE" id="mDelete" aria-pressed="false"/);
  // The request line and the argument carry ASCII paths and numbers inside an
  // RTL page, so they are pinned to LTR rather than reordered by the bidi
  // algorithm (`?deg=12.5` must not render as `12.5=deg?`).
  assert.match(html, /id="argVal"[^>]*dir="ltr"/);
  assert.match(html, /id="reqLine" dir="ltr"/);
});

test('protocol page starts at GET /status with both toolbars agreeing', () => {
  const { methodButtons, routeButtons, elements } = loadProtocolPage();
  assertPressed(methodButtons.mGet, true);
  assertPressed(methodButtons.mPost, false);
  assertPressed(routeButtons.rStatus, true);
  assert.equal(elements.reqLine.textContent, 'GET /status');
  assert.equal(elements.stAngle.textContent, '0.00°');
  assert.equal(elements.stTarget.textContent, '0.00°');
  assert.equal(elements.stMode.textContent, 'אוטומטי');
  assert.equal(elements.stPanel.textContent, 'LED (2)');
});

test('clicking a method button repaints the request line and moves aria-pressed', () => {
  const { methodButtons, elements } = loadProtocolPage();

  methodButtons.mPost.fire('click');
  assertPressed(methodButtons.mPost, true);
  assertPressed(methodButtons.mGet, false);
  assert.equal(elements.reqLine.textContent, 'POST /status');

  methodButtons.mDelete.fire('click');
  assertPressed(methodButtons.mDelete, true);
  assertPressed(methodButtons.mPost, false);
  assert.equal(elements.reqLine.textContent, 'DELETE /status');
});

test('picking a route resets the method to the one that path is registered with', () => {
  const { methodButtons, routeButtons, elements } = loadProtocolPage();

  methodButtons.mPut.fire('click');
  assertPressed(methodButtons.mPut, true);

  routeButtons.rAngle.fire('click');
  assertPressed(routeButtons.rAngle, true);
  assertPressed(methodButtons.mPost, true);
  assertPressed(methodButtons.mPut, false);
  assert.equal(elements.reqLine.textContent, 'POST /set-angle?deg=12.5');

  routeButtons.rStatus.fire('click');
  assertPressed(methodButtons.mGet, true);
  assertPressed(methodButtons.mPost, false);
  assert.equal(elements.reqLine.textContent, 'GET /status');
});

test('PUT on a registered path answers 405 and names the board 404 divergence', () => {
  const { methodButtons, routeButtons, elements } = loadProtocolPage();

  elements.ex405.fire('click');

  assertPressed(routeButtons.rAngle, true);
  assertPressed(methodButtons.mPut, true);
  assert.equal(elements.reqLine.textContent, 'PUT /set-angle?deg=12.5');
  assert.equal(elements.resCode.textContent, '405');
  assert.equal(elements.resCode.className, 'bad');
  assert.deepEqual(JSON.parse(elements.resBody.textContent), { ok: false, error: 'method not allowed' });
  assert.match(elements.effectNote.textContent, /405 method not allowed/);
  assert.match(elements.effectNote.textContent, /onNotFound/);
});

test('any other wrong method answers 404 and leaves the board state alone', () => {
  const { methodButtons, routeButtons, elements } = loadProtocolPage();

  // Move the board off its boot state first, so a stray effect would show.
  routeButtons.rAngle.fire('click');
  elements.sendBtn.fire('click');
  const movedTarget = elements.stTarget.textContent;
  assert.equal(elements.stMode.textContent, 'ידני');
  assert.notEqual(movedTarget, '0.00°');

  elements.ex404.fire('click');

  assertPressed(routeButtons.rStatus, true);
  assertPressed(methodButtons.mDelete, true);
  assert.equal(elements.reqLine.textContent, 'DELETE /status');
  assert.equal(elements.resCode.textContent, '404');
  assert.equal(elements.resCode.className, 'bad');
  assert.deepEqual(JSON.parse(elements.resBody.textContent), { ok: false, error: 'not found' });
  assert.match(elements.effectNote.textContent, /404/);
  assert.equal(elements.stTarget.textContent, movedTarget);
  assert.equal(elements.stMode.textContent, 'ידני');
});

test('the readout shows the quantised target, and reset restores the boot state', () => {
  const { methodButtons, routeButtons, elements } = loadProtocolPage();

  routeButtons.rAngle.fire('click');
  elements.argVal.value = '10';
  elements.sendBtn.fire('click');
  assert.equal(elements.resCode.textContent, '200');
  assert.equal(elements.stMode.textContent, 'ידני');
  // 10° is 27.77… steps of 0.36°; the board lroundf's to 28 steps = 10.08°.
  assert.equal(elements.stTarget.textContent, '10.08°');

  routeButtons.rPanel.fire('click');
  elements.argVal.value = '0';
  elements.sendBtn.fire('click');
  assert.equal(elements.stPanel.textContent, 'OLED (0)');

  elements.exReset.fire('click');

  assertPressed(routeButtons.rStatus, true);
  assertPressed(methodButtons.mGet, true);
  assert.equal(elements.reqLine.textContent, 'GET /status');
  assert.equal(elements.resCode.textContent, '200');
  assert.equal(elements.stAngle.textContent, '0.00°');
  assert.equal(elements.stTarget.textContent, '0.00°');
  assert.equal(elements.stMode.textContent, 'אוטומטי');
  assert.equal(elements.stPanel.textContent, 'LED (2)');
});
