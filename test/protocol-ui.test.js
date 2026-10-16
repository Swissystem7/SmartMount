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

function loadProtocolPage() {
  const routeButtons = {
    rStatus: fakeElement('rStatus', { attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'], dataset: { route: 'status' } }),
    rAngle: fakeElement('rAngle', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { route: 'angle' } }),
    rPanel: fakeElement('rPanel', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { route: 'panel' } }),
    rMode: fakeElement('rMode', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { route: 'mode' } }),
    rStop: fakeElement('rStop', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'], dataset: { route: 'stop' } }),
  };
  const buttonsList = Object.values(routeButtons);

  const elements = {
    ...routeButtons,
    argVal: fakeElement('argVal'),
    reqLine: fakeElement('reqLine'),
    resCode: fakeElement('resCode'),
    resBody: fakeElement('resBody'),
    effectNote: fakeElement('effectNote'),
    sendBtn: fakeElement('sendBtn'),
    exBad: fakeElement('exBad'),
    exQuirk: fakeElement('exQuirk'),
  };

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => {
      if (sel === '[data-route]') return buttonsList;
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
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { routeButtons, elements };
}

test('protocol page HTML contains route buttons with initial group, aria-label and aria-pressed attributes', () => {
  const html = read('protocol/index.html');
  assert.ok(html.includes('<div class="row" role="group" aria-label="נתיב">'));
  assert.ok(html.includes('<button type="button" class="btn on" data-route="status" id="rStatus" aria-pressed="true">GET /status</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-route="angle" id="rAngle" aria-pressed="false">POST /set-angle</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-route="panel" id="rPanel" aria-pressed="false">POST /set-panel</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-route="mode" id="rMode" aria-pressed="false">POST /set-mode</button>'));
  assert.ok(html.includes('<button type="button" class="btn" data-route="stop" id="rStop" aria-pressed="false">POST /stop</button>'));
});

test('protocol page initializes with GET /status button active and aria-pressed=true', () => {
  const { routeButtons } = loadProtocolPage();
  assertPressed(routeButtons.rStatus, true);
  assertPressed(routeButtons.rAngle, false);
  assertPressed(routeButtons.rPanel, false);
  assertPressed(routeButtons.rMode, false);
  assertPressed(routeButtons.rStop, false);
});

test('clicking route buttons updates active class and aria-pressed attributes', () => {
  const { routeButtons, elements } = loadProtocolPage();

  routeButtons.rAngle.fire('click');
  assertPressed(routeButtons.rAngle, true);
  assertPressed(routeButtons.rStatus, false);
  assertPressed(routeButtons.rPanel, false);
  assert.equal(elements.argVal.value, '12.5');
  assert.equal(elements.argVal.disabled, false);

  routeButtons.rMode.fire('click');
  assertPressed(routeButtons.rMode, true);
  assertPressed(routeButtons.rAngle, false);
  assert.equal(elements.argVal.value, '1');

  routeButtons.rStop.fire('click');
  assertPressed(routeButtons.rStop, true);
  assertPressed(routeButtons.rMode, false);
  assert.equal(elements.argVal.disabled, true);

  routeButtons.rStatus.fire('click');
  assertPressed(routeButtons.rStatus, true);
  assertPressed(routeButtons.rStop, false);
  assert.equal(elements.argVal.disabled, true);
});

test('clicking example shortcut buttons synchronizes active route button and aria-pressed', () => {
  const { routeButtons, elements } = loadProtocolPage();

  assertPressed(routeButtons.rStatus, true);

  elements.exBad.fire('click');
  assertPressed(routeButtons.rAngle, true);
  assertPressed(routeButtons.rStatus, false);
  assert.equal(elements.argVal.value, '12deg');
  assert.equal(elements.resCode.textContent, '400');

  elements.exQuirk.fire('click');
  assertPressed(routeButtons.rPanel, true);
  assertPressed(routeButtons.rAngle, false);
  assert.equal(elements.argVal.value, 'foo');
  assert.equal(elements.resCode.textContent, '400');
});
