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
  let val = initial.value !== undefined ? String(initial.value) : '0';
  const children = [];
  return {
    id,
    get value() { return val; },
    set value(v) { val = String(v); },
    checked: initial.checked || false,
    attrs,
    dataset: initial.dataset || {},
    style: {},
    children,
    innerHTML: '',
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
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    fire(type, eventObj = {}) {
      if (typeof this['on' + type] === 'function') {
        this['on' + type].call(this, eventObj);
      }
      (listeners[type] || []).forEach((fn) => {
        fn.call(this, eventObj);
      });
    },
  };
}

function loadGeometryPage() {
  const scenarioButtons = {
    scOver: fakeElement('scOver', { attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] }),
    scFace: fakeElement('scFace', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    scLow: fakeElement('scLow', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
  };

  const opticsButtons = {
    optGlint: fakeElement('optGlint', { attrs: { 'aria-pressed': 'true' }, classes: ['btn', 'on'] }),
    optWindow: fakeElement('optWindow', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
    optMatte: fakeElement('optMatte', { attrs: { 'aria-pressed': 'false' }, classes: ['btn'] }),
  };

  const sliders = {
    lightX: fakeElement('lightX', { value: '280' }),
    lightY: fakeElement('lightY', { value: '36' }),
    eyeX: fakeElement('eyeX', { value: '560' }),
    eyeY: fakeElement('eyeY', { value: '268' }),
    tilt: fakeElement('tilt', { value: '0' }),
    srcNits: fakeElement('srcNits', { value: '20000' }),
    srcArea: fakeElement('srcArea', { value: '4' }),
    srcDist: fakeElement('srcDist', { value: '2' }),
    refl: fakeElement('refl', { value: '0.06' }),
  };

  const elements = {
    ...scenarioButtons,
    ...opticsButtons,
    ...sliders,
    scene: fakeElement('scene'),
    screen: fakeElement('screen'),
    normal: fakeElement('normal'),
    incident: fakeElement('incident'),
    reflected: fakeElement('reflected'),
    light: fakeElement('light'),
    eye: fakeElement('eye'),
    extraRays: fakeElement('extraRays'),
    kInc: fakeElement('kInc'),
    kRef: fakeElement('kRef'),
    verdict: fakeElement('verdict'),
    tiltVal: fakeElement('tiltVal'),
    lightXVal: fakeElement('lightXVal'),
    lightYVal: fakeElement('lightYVal'),
    eyeXVal: fakeElement('eyeXVal'),
    eyeYVal: fakeElement('eyeYVal'),
    srcNitsVal: fakeElement('srcNitsVal'),
    srcAreaVal: fakeElement('srcAreaVal'),
    srcDistVal: fakeElement('srcDistVal'),
    reflVal: fakeElement('reflVal'),
    oLuxT: fakeElement('oLuxT'),
    oLuxB: fakeElement('oLuxB'),
    oRatio: fakeElement('oRatio'),
    oHigh: fakeElement('oHigh'),
    optVerdict: fakeElement('optVerdict'),
  };

  elements.scene.getScreenCTM = () => null;
  elements.scene.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform: () => ({ x: 0, y: 0 }) });

  const document = {
    getElementById: (id) => elements[id] || (elements[id] = fakeElement(id)),
    querySelectorAll: (sel) => [],
    createElement: (tag) => fakeElement(tag),
    createElementNS: (ns, tag) => fakeElement(tag),
  };

  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/optics.js'), ctx);

  const html = read('geometry/index.html');
  const anchor = html.indexOf('src="../src/lib/optics.js"');
  assert.ok(anchor > 0, 'geometry page must load optics.js');
  const open = html.indexOf('<script>', anchor);
  const close = html.indexOf('</script>', open);
  const scriptContent = html.slice(open + '<script>'.length, close);
  vm.runInContext(scriptContent, ctx);

  return { scenarioButtons, opticsButtons, sliders, elements };
}

test('geometry page HTML contains scenario and optics buttons with initial role="group", aria-label and aria-pressed attributes', () => {
  const html = read('geometry/index.html');
  assert.match(
    html,
    /<div class="row" role="group" aria-label="תרחיש גאומטריה">/,
    'scenario buttons row must have role="group" and aria-label'
  );
  assert.match(
    html,
    /<button type="button" class="btn on" id="scOver" aria-pressed="true">/,
    'scOver button must start with class "btn on" and aria-pressed="true"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="scFace" aria-pressed="false">/,
    'scFace button must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="scLow" aria-pressed="false">/,
    'scLow button must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<div class="row" role="group" aria-label="סוג מקור בוהק">/,
    'optics buttons row must have role="group" and aria-label'
  );
  assert.match(
    html,
    /<button type="button" class="btn on" id="optGlint" aria-pressed="true">/,
    'optGlint button must start with class "btn on" and aria-pressed="true"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="optWindow" aria-pressed="false">/,
    'optWindow button must start with aria-pressed="false"'
  );
  assert.match(
    html,
    /<button type="button" class="btn" id="optMatte" aria-pressed="false">/,
    'optMatte button must start with aria-pressed="false"'
  );
});

test('geometry page initializes scenario buttons with scOver active and optics buttons with optGlint active', () => {
  const { scenarioButtons, opticsButtons } = loadGeometryPage();
  assert.equal(scenarioButtons.scOver.classList.contains('on'), true);
  assert.equal(scenarioButtons.scOver.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scFace.classList.contains('on'), false);
  assert.equal(scenarioButtons.scFace.getAttribute('aria-pressed'), 'false');
  assert.equal(scenarioButtons.scLow.classList.contains('on'), false);
  assert.equal(scenarioButtons.scLow.getAttribute('aria-pressed'), 'false');

  assert.equal(opticsButtons.optGlint.classList.contains('on'), true);
  assert.equal(opticsButtons.optGlint.getAttribute('aria-pressed'), 'true');
  assert.equal(opticsButtons.optWindow.classList.contains('on'), false);
  assert.equal(opticsButtons.optWindow.getAttribute('aria-pressed'), 'false');
  assert.equal(opticsButtons.optMatte.classList.contains('on'), false);
  assert.equal(opticsButtons.optMatte.getAttribute('aria-pressed'), 'false');
});

test('clicking scenario buttons updates active and aria-pressed states and sliders', () => {
  const { scenarioButtons, sliders } = loadGeometryPage();

  scenarioButtons.scFace.fire('click');
  assert.equal(scenarioButtons.scFace.classList.contains('on'), true);
  assert.equal(scenarioButtons.scFace.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scOver.classList.contains('on'), false);
  assert.equal(scenarioButtons.scOver.getAttribute('aria-pressed'), 'false');
  assert.equal(sliders.lightX.value, '760');
  assert.equal(sliders.lightY.value, '140');
  assert.equal(sliders.eyeX.value, '520');
  assert.equal(sliders.eyeY.value, '250');
  assert.equal(sliders.tilt.value, '0');

  scenarioButtons.scLow.fire('click');
  assert.equal(scenarioButtons.scLow.classList.contains('on'), true);
  assert.equal(scenarioButtons.scLow.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scFace.classList.contains('on'), false);
  assert.equal(scenarioButtons.scFace.getAttribute('aria-pressed'), 'false');
  assert.equal(sliders.lightX.value, '240');
  assert.equal(sliders.lightY.value, '370');
  assert.equal(sliders.eyeX.value, '560');
  assert.equal(sliders.eyeY.value, '230');

  scenarioButtons.scOver.fire('click');
  assert.equal(scenarioButtons.scOver.classList.contains('on'), true);
  assert.equal(scenarioButtons.scOver.getAttribute('aria-pressed'), 'true');
  assert.equal(scenarioButtons.scLow.classList.contains('on'), false);
  assert.equal(scenarioButtons.scLow.getAttribute('aria-pressed'), 'false');
  assert.equal(sliders.lightX.value, '280');
  assert.equal(sliders.lightY.value, '36');
});

test('moving geometry sliders deactivates scenario buttons (no false active state)', () => {
  const { scenarioButtons, sliders } = loadGeometryPage();

  assert.equal(scenarioButtons.scOver.classList.contains('on'), true);
  assert.equal(scenarioButtons.scOver.getAttribute('aria-pressed'), 'true');

  sliders.lightX.value = '500';
  sliders.lightX.fire('input');
  for (const b of Object.values(scenarioButtons)) {
    assert.equal(b.classList.contains('on'), false);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }

  // Restoring coordinates reactivates the preset button
  sliders.lightX.value = '280';
  sliders.lightX.fire('input');
  assert.equal(scenarioButtons.scOver.classList.contains('on'), true);
  assert.equal(scenarioButtons.scOver.getAttribute('aria-pressed'), 'true');

  sliders.eyeY.value = '100';
  sliders.eyeY.fire('input');
  for (const b of Object.values(scenarioButtons)) {
    assert.equal(b.classList.contains('on'), false);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }
});

test('clicking optics preset buttons updates active and aria-pressed states and sliders', () => {
  const { opticsButtons, sliders } = loadGeometryPage();

  opticsButtons.optWindow.fire('click');
  assert.equal(opticsButtons.optWindow.classList.contains('on'), true);
  assert.equal(opticsButtons.optWindow.getAttribute('aria-pressed'), 'true');
  assert.equal(opticsButtons.optGlint.classList.contains('on'), false);
  assert.equal(opticsButtons.optGlint.getAttribute('aria-pressed'), 'false');
  assert.equal(sliders.srcNits.value, '4000');
  assert.equal(sliders.srcArea.value, '12000');
  assert.equal(sliders.srcDist.value, '1.4');
  assert.equal(sliders.refl.value, '0.06');

  opticsButtons.optMatte.fire('click');
  assert.equal(opticsButtons.optMatte.classList.contains('on'), true);
  assert.equal(opticsButtons.optMatte.getAttribute('aria-pressed'), 'true');
  assert.equal(opticsButtons.optWindow.classList.contains('on'), false);
  assert.equal(opticsButtons.optWindow.getAttribute('aria-pressed'), 'false');
  assert.equal(sliders.refl.value, '0.015');

  opticsButtons.optGlint.fire('click');
  assert.equal(opticsButtons.optGlint.classList.contains('on'), true);
  assert.equal(opticsButtons.optGlint.getAttribute('aria-pressed'), 'true');
  assert.equal(opticsButtons.optMatte.classList.contains('on'), false);
  assert.equal(opticsButtons.optMatte.getAttribute('aria-pressed'), 'false');
  assert.equal(sliders.srcNits.value, '20000');
  assert.equal(sliders.srcArea.value, '4');
  assert.equal(sliders.srcDist.value, '2');
  assert.equal(sliders.refl.value, '0.06');
});

test('moving optics sliders deactivates optics preset buttons (no false active state)', () => {
  const { opticsButtons, sliders } = loadGeometryPage();

  assert.equal(opticsButtons.optGlint.classList.contains('on'), true);
  assert.equal(opticsButtons.optGlint.getAttribute('aria-pressed'), 'true');

  sliders.srcNits.value = '15000';
  sliders.srcNits.fire('input');
  for (const b of Object.values(opticsButtons)) {
    assert.equal(b.classList.contains('on'), false);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }

  // Restoring preset value reactivates the preset button
  sliders.srcNits.value = '20000';
  sliders.srcNits.fire('input');
  assert.equal(opticsButtons.optGlint.classList.contains('on'), true);
  assert.equal(opticsButtons.optGlint.getAttribute('aria-pressed'), 'true');

  sliders.refl.value = '0.09';
  sliders.refl.fire('input');
  for (const b of Object.values(opticsButtons)) {
    assert.equal(b.classList.contains('on'), false);
    assert.equal(b.getAttribute('aria-pressed'), 'false');
  }
});
