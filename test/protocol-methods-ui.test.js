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
  let val = initial.value !== undefined ? String(initial.value) : '';
  const dataset = { ...initial.dataset };
  return {
    id,
    dataset,
    attrs,
    disabled: !!initial.disabled,
    placeholder: initial.placeholder || '',
    get value() { return val; },
    set value(v) { val = String(v); },
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
    removeAttribute(k) { delete attrs[k]; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    fire(type) {
      (listeners[type] || []).forEach((fn) => fn());
    },
  };
}

function loadProtocolPage() {
  const methodButtons = [
    fakeElement('mGet', { dataset: { method: 'GET' }, attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] }),
    fakeElement('mPost', { dataset: { method: 'POST' }, attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('mPut', { dataset: { method: 'PUT' }, attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('mDelete', { dataset: { method: 'DELETE' }, attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
  ];

  const routeButtons = [
    fakeElement('rStatus', { dataset: { route: 'status' }, attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] }),
    fakeElement('rAngle', { dataset: { route: 'angle' }, attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('rPanel', { dataset: { route: 'panel' }, attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('rMode', { dataset: { route: 'mode' }, attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    fakeElement('rStop', { dataset: { route: 'stop' }, attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
  ];

  const elements = {
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
    stAuto: fakeElement('stAuto'),
    stPanel: fakeElement('stPanel'),
  };

  methodButtons.forEach((b) => { elements[b.id] = b; });
  routeButtons.forEach((b) => { elements[b.id] = b; });

  const allButtons = [...routeButtons, ...methodButtons];

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '[data-route]') return routeButtons;
      if (sel === '[data-method]') return methodButtons;
      return allButtons;
    },
  };

  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/control.js'), ctx);
  vm.runInContext(read('src/lib/protocol.js'), ctx);

  const html = read('protocol/index.html');
  const anchor = html.indexOf('src="../src/lib/protocol.js"');
  assert.ok(anchor > 0, 'protocol page must load protocol.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { elements, methodButtons, routeButtons };
}

test('protocol HTML contains accessible method selector and shortcut buttons with initial ARIA attributes', () => {
  const html = read('protocol/index.html');
  assert.match(html, /role="group"\s+aria-label="שיטת HTTP"/);
  assert.match(html, /<button type="button" class="btn on" data-method="GET" id="mGet" aria-pressed="true">GET<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-method="POST" id="mPost" aria-pressed="false">POST<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-method="PUT" id="mPut" aria-pressed="false">PUT \(405\)<\/button>/);
  assert.match(html, /<button type="button" class="btn" data-method="DELETE" id="mDelete" aria-pressed="false">DELETE \(404\)<\/button>/);
  assert.match(html, /id="ex405"/);
  assert.match(html, /id="ex404"/);
  assert.match(html, /id="exReset"/);
  assert.match(html, /id="stateSummary"/);
});

test('protocol page initializes with GET /status selected and valid initial ARIA pressed state', () => {
  const { elements, methodButtons, routeButtons } = loadProtocolPage();
  const mGet = methodButtons.find((b) => b.dataset.method === 'GET');
  const rStatus = routeButtons.find((b) => b.dataset.route === 'status');

  assert.equal(mGet.classList.contains('on'), true);
  assert.equal(mGet.getAttribute('aria-pressed'), 'true');
  assert.equal(rStatus.classList.contains('on'), true);
  assert.equal(rStatus.getAttribute('aria-pressed'), 'true');

  assert.equal(elements.reqLine.textContent, 'GET /status');
  assert.equal(elements.stAuto.textContent, 'אוטומטי');
  assert.equal(elements.stPanel.textContent, 'LED (2)');
});

test('clicking method buttons updates method selection, aria-pressed, and requestLine', () => {
  const { elements, methodButtons } = loadProtocolPage();
  const mGet = methodButtons.find((b) => b.dataset.method === 'GET');
  const mPost = methodButtons.find((b) => b.dataset.method === 'POST');
  const mPut = methodButtons.find((b) => b.dataset.method === 'PUT');

  mPost.fire('click');
  assert.equal(mPost.classList.contains('on'), true);
  assert.equal(mPost.getAttribute('aria-pressed'), 'true');
  assert.equal(mGet.classList.contains('on'), false);
  assert.equal(mGet.getAttribute('aria-pressed'), 'false');
  assert.equal(elements.reqLine.textContent, 'POST /status');

  mPut.fire('click');
  assert.equal(mPut.classList.contains('on'), true);
  assert.equal(mPut.getAttribute('aria-pressed'), 'true');
  assert.equal(elements.reqLine.textContent, 'PUT /status');
});

test('switching route resets method to that route default method and updates button states', () => {
  const { elements, methodButtons, routeButtons } = loadProtocolPage();
  const mPut = methodButtons.find((b) => b.dataset.method === 'PUT');
  const mPost = methodButtons.find((b) => b.dataset.method === 'POST');
  const rAngle = routeButtons.find((b) => b.dataset.route === 'angle');

  mPut.fire('click');
  assert.equal(mPut.getAttribute('aria-pressed'), 'true');

  rAngle.fire('click');
  assert.equal(rAngle.classList.contains('on'), true);
  assert.equal(rAngle.getAttribute('aria-pressed'), 'true');
  assert.equal(mPost.classList.contains('on'), true);
  assert.equal(mPost.getAttribute('aria-pressed'), 'true');
  assert.equal(mPut.getAttribute('aria-pressed'), 'false');
  assert.equal(elements.reqLine.textContent, 'POST /set-angle?deg=12.5');
});

test('ex405 shortcut simulates PUT on registered path and returns HTTP 405 Method Not Allowed', () => {
  const { elements, methodButtons, routeButtons } = loadProtocolPage();
  const mPut = methodButtons.find((b) => b.dataset.method === 'PUT');
  const rAngle = routeButtons.find((b) => b.dataset.route === 'angle');

  elements.ex405.fire('click');

  assert.equal(rAngle.getAttribute('aria-pressed'), 'true');
  assert.equal(mPut.getAttribute('aria-pressed'), 'true');
  assert.equal(elements.reqLine.textContent, 'PUT /set-angle?deg=12.5');
  assert.equal(elements.resCode.textContent, '405');
  assert.equal(elements.resCode.className, 'bad');

  const body = JSON.parse(elements.resBody.textContent);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'method not allowed');
  assert.match(elements.effectNote.textContent, /405 Method Not Allowed/);
});

test('ex404 shortcut simulates wrong method on registered path and returns HTTP 404 Not Found', () => {
  const { elements, methodButtons, routeButtons } = loadProtocolPage();
  const mDelete = methodButtons.find((b) => b.dataset.method === 'DELETE');
  const rStatus = routeButtons.find((b) => b.dataset.route === 'status');

  elements.ex404.fire('click');

  assert.equal(rStatus.getAttribute('aria-pressed'), 'true');
  assert.equal(mDelete.getAttribute('aria-pressed'), 'true');
  assert.equal(elements.reqLine.textContent, 'DELETE /status');
  assert.equal(elements.resCode.textContent, '404');
  assert.equal(elements.resCode.className, 'bad');

  const body = JSON.parse(elements.resBody.textContent);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'not found');
  assert.match(elements.effectNote.textContent, /404 Not Found/);
});

test('exBad and exQuirk trigger 400 validation rejects and update display notes', () => {
  const { elements } = loadProtocolPage();

  elements.exBad.fire('click');
  assert.equal(elements.resCode.textContent, '400');
  const body1 = JSON.parse(elements.resBody.textContent);
  assert.equal(body1.ok, false);
  assert.equal(body1.error, 'invalid deg');
  assert.match(elements.effectNote.textContent, /400 Bad Request/);

  elements.exQuirk.fire('click');
  assert.equal(elements.resCode.textContent, '400');
  const body2 = JSON.parse(elements.resBody.textContent);
  assert.equal(body2.ok, false);
  assert.equal(body2.error, 'invalid panel type');
  assert.match(elements.effectNote.textContent, /strtol/);
});

test('exReset restores initial board state and displays updated state summary', () => {
  const { elements } = loadProtocolPage();

  // First change state by sending a valid set-angle
  elements.rAngle.fire('click');
  elements.argVal.value = '10';
  elements.sendBtn.fire('click');

  assert.equal(elements.resCode.textContent, '200');
  assert.equal(elements.stAuto.textContent, 'ידני');
  assert.equal(elements.stTarget.textContent, '10.08°'); // quantized to nearest step

  // Now trigger reset
  elements.exReset.fire('click');

  assert.equal(elements.resCode.textContent, '200');
  assert.equal(elements.reqLine.textContent, 'GET /status');
  assert.equal(elements.stAuto.textContent, 'אוטומטי');
  assert.equal(elements.stAngle.textContent, '0.00°');
  assert.equal(elements.stTarget.textContent, '0.00°');
  assert.equal(elements.stPanel.textContent, 'LED (2)');
});
