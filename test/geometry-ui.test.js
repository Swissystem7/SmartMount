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
    light: fakeElement('light', {
      attrs: {
        tabindex: '0',
        role: 'slider',
        'aria-label': 'מקור אור — הזזה במקשי חצים',
        'aria-valuemin': '40',
        'aria-valuemax': '780',
        'aria-valuenow': '280',
        'aria-valuetext': 'אופקי 280, אנכי 36',
      },
    }),
    eye: fakeElement('eye', {
      attrs: {
        tabindex: '0',
        role: 'slider',
        'aria-label': 'עין הצופה — הזזה במקשי חצים',
        'aria-valuemin': '40',
        'aria-valuemax': '780',
        'aria-valuenow': '560',
        'aria-valuetext': 'אופקי 560, אנכי 268',
      },
    }),
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

  return { scenarioButtons, opticsButtons, sliders, elements, ctx };
}

test('geometry page HTML contains scenario and optics buttons with initial role="group", aria-label and aria-pressed attributes', () => {
  const html = read('geometry/index.html');
  for (const label of ['תרחיש גאומטריה', 'סוג מקור בוהק']) {
    assert.ok(html.includes(`<div class="row" role="group" aria-label="${label}">`), label + ' row must be a labelled group');
  }
  const initial = { scOver: true, scFace: false, scLow: false, optGlint: true, optWindow: false, optMatte: false };
  for (const [id, on] of Object.entries(initial)) {
    const tag = `<button type="button" class="btn${on ? ' on' : ''}" id="${id}" aria-pressed="${on}">`;
    assert.ok(html.includes(tag), id + ' must start with ' + tag);
  }
});

test('geometry page initializes scenario buttons with scOver active and optics buttons with optGlint active', () => {
  const { scenarioButtons, opticsButtons } = loadGeometryPage();
  assertPressed(scenarioButtons.scOver, true);
  assertPressed(scenarioButtons.scFace, false);
  assertPressed(scenarioButtons.scLow, false);

  assertPressed(opticsButtons.optGlint, true);
  assertPressed(opticsButtons.optWindow, false);
  assertPressed(opticsButtons.optMatte, false);
});

test('clicking scenario buttons updates active and aria-pressed states and sliders', () => {
  const { scenarioButtons, sliders } = loadGeometryPage();

  scenarioButtons.scFace.fire('click');
  assertPressed(scenarioButtons.scFace, true);
  assertPressed(scenarioButtons.scOver, false);
  assert.equal(sliders.lightX.value, '760');
  assert.equal(sliders.lightY.value, '140');
  assert.equal(sliders.eyeX.value, '520');
  assert.equal(sliders.eyeY.value, '250');
  assert.equal(sliders.tilt.value, '0');

  scenarioButtons.scLow.fire('click');
  assertPressed(scenarioButtons.scLow, true);
  assertPressed(scenarioButtons.scFace, false);
  assert.equal(sliders.lightX.value, '240');
  assert.equal(sliders.lightY.value, '370');
  assert.equal(sliders.eyeX.value, '560');
  assert.equal(sliders.eyeY.value, '230');

  scenarioButtons.scOver.fire('click');
  assertPressed(scenarioButtons.scOver, true);
  assertPressed(scenarioButtons.scLow, false);
  assert.equal(sliders.lightX.value, '280');
  assert.equal(sliders.lightY.value, '36');
});

test('moving geometry sliders deactivates scenario buttons (no false active state)', () => {
  const { scenarioButtons, sliders } = loadGeometryPage();

  assertPressed(scenarioButtons.scOver, true);

  sliders.lightX.value = '500';
  sliders.lightX.fire('input');
  for (const b of Object.values(scenarioButtons)) {
    assertPressed(b, false);
  }

  // Restoring coordinates reactivates the preset button
  sliders.lightX.value = '280';
  sliders.lightX.fire('input');
  assertPressed(scenarioButtons.scOver, true);

  sliders.eyeY.value = '100';
  sliders.eyeY.fire('input');
  for (const b of Object.values(scenarioButtons)) {
    assertPressed(b, false);
  }
});

test('clicking optics preset buttons updates active and aria-pressed states and sliders', () => {
  const { opticsButtons, sliders } = loadGeometryPage();

  opticsButtons.optWindow.fire('click');
  assertPressed(opticsButtons.optWindow, true);
  assertPressed(opticsButtons.optGlint, false);
  assert.equal(sliders.srcNits.value, '4000');
  assert.equal(sliders.srcArea.value, '12000');
  assert.equal(sliders.srcDist.value, '1.4');
  assert.equal(sliders.refl.value, '0.06');

  opticsButtons.optMatte.fire('click');
  assertPressed(opticsButtons.optMatte, true);
  assertPressed(opticsButtons.optWindow, false);
  assert.equal(sliders.refl.value, '0.015');

  opticsButtons.optGlint.fire('click');
  assertPressed(opticsButtons.optGlint, true);
  assertPressed(opticsButtons.optMatte, false);
  assert.equal(sliders.srcNits.value, '20000');
  assert.equal(sliders.srcArea.value, '4');
  assert.equal(sliders.srcDist.value, '2');
  assert.equal(sliders.refl.value, '0.06');
});

test('moving optics sliders deactivates optics preset buttons (no false active state)', () => {
  const { opticsButtons, sliders } = loadGeometryPage();

  assertPressed(opticsButtons.optGlint, true);

  sliders.srcNits.value = '15000';
  sliders.srcNits.fire('input');
  for (const b of Object.values(opticsButtons)) {
    assertPressed(b, false);
  }

  // Restoring preset value reactivates the preset button
  sliders.srcNits.value = '20000';
  sliders.srcNits.fire('input');
  assertPressed(opticsButtons.optGlint, true);

  sliders.refl.value = '0.09';
  sliders.refl.fire('input');
  for (const b of Object.values(opticsButtons)) {
    assertPressed(b, false);
  }
});

test('nudging geometry after a scenario keeps that scenario model (button clears, scene stays)', () => {
  const { scenarioButtons, sliders, ctx } = loadGeometryPage();

  scenarioButtons.scFace.fire('click');
  sliders.lightX.value = '750';
  sliders.lightX.fire('input');
  assert.equal(scenarioButtons.scFace.getAttribute('aria-pressed'), 'false');
  assert.equal(vm.runInContext('scene', ctx), 'face',
    'the window stays an extended source after a nudge; only the preset highlight clears');

  scenarioButtons.scLow.fire('click');
  sliders.eyeY.value = '240';
  sliders.eyeY.fire('input');
  assert.equal(vm.runInContext('scene', ctx), 'low');
});

test('geometry page HTML includes focus styling and slider accessibility attributes for light and eye', () => {
  const html = read('geometry/index.html');
  assert.ok(html.includes('#light:focus-visible,#eye:focus-visible'), 'CSS must include focus-visible styles for scene targets');
  assert.ok(html.includes('input[type=range]{width:100%;accent-color:#58a6ff;direction:ltr}'), 'CSS must specify direction:ltr on range inputs');
  assert.ok(html.includes('id="light" tabindex="0" role="slider"'), 'light must have tabindex 0 and slider role');
  assert.ok(html.includes('id="eye" tabindex="0" role="slider"'), 'eye must have tabindex 0 and slider role');
  assert.ok(html.includes('aria-label="מקור אור — הזזה במקשי חצים"'), 'light must have accessible label mentioning arrow navigation');
  assert.ok(html.includes('aria-label="עין הצופה — הזזה במקשי חצים"'), 'eye must have accessible label mentioning arrow navigation');
});

test('keyboard arrow navigation on light element moves coordinates, calls preventDefault, clamps bounds, and updates sliders', () => {
  const { elements, sliders } = loadGeometryPage();
  const light = elements.light;

  let prevented = false;
  const preventDefault = () => { prevented = true; };

  // Initial: light is at (280, 36)
  assert.equal(light.getAttribute('aria-valuenow'), '280');
  assert.equal(light.getAttribute('aria-valuetext'), 'אופקי 280, אנכי 36');

  // ArrowLeft decreases x by 12 (to 268)
  prevented = false;
  light.fire('keydown', { key: 'ArrowLeft', preventDefault });
  assert.ok(prevented, 'ArrowLeft must call preventDefault');
  assert.equal(sliders.lightX.value, '268');
  assert.equal(light.getAttribute('aria-valuenow'), '268');
  assert.equal(light.getAttribute('aria-valuetext'), 'אופקי 268, אנכי 36');

  // ArrowRight increases x by 12 (back to 280)
  prevented = false;
  light.fire('keydown', { key: 'ArrowRight', preventDefault });
  assert.ok(prevented);
  assert.equal(sliders.lightX.value, '280');

  // ArrowDown increases y by 12 (to 48)
  prevented = false;
  light.fire('keydown', { key: 'ArrowDown', preventDefault });
  assert.ok(prevented);
  assert.equal(sliders.lightY.value, '48');
  assert.equal(light.getAttribute('aria-valuetext'), 'אופקי 280, אנכי 48');

  // ArrowUp decreases y by 12 (back to 36)
  prevented = false;
  light.fire('keydown', { key: 'ArrowUp', preventDefault });
  assert.ok(prevented);
  assert.equal(sliders.lightY.value, '36');

  // Shift+ArrowRight steps by 24 (to 304)
  light.fire('keydown', { key: 'ArrowRight', shiftKey: true, preventDefault });
  assert.equal(sliders.lightX.value, '304');

  // Clamping: cannot move below min x (40)
  for (let i = 0; i < 30; i++) {
    light.fire('keydown', { key: 'ArrowLeft', shiftKey: true, preventDefault });
  }
  assert.equal(sliders.lightX.value, '40');
  assert.equal(light.getAttribute('aria-valuenow'), '40');
});

test('keyboard arrow navigation on eye element moves coordinates, updates sliders and ARIA labels', () => {
  const { elements, sliders } = loadGeometryPage();
  const eye = elements.eye;

  let prevented = false;
  const preventDefault = () => { prevented = true; };

  // Initial: eye is at (560, 268)
  assert.equal(eye.getAttribute('aria-valuenow'), '560');
  assert.equal(eye.getAttribute('aria-valuetext'), 'אופקי 560, אנכי 268');

  // ArrowRight increases x by 12 (to 572)
  eye.fire('keydown', { key: 'ArrowRight', preventDefault });
  assert.ok(prevented);
  assert.equal(sliders.eyeX.value, '572');
  assert.equal(eye.getAttribute('aria-valuenow'), '572');
  assert.equal(eye.getAttribute('aria-valuetext'), 'אופקי 572, אנכי 268');

  // ArrowUp decreases y by 12 (to 256)
  eye.fire('keydown', { key: 'ArrowUp', preventDefault });
  assert.ok(prevented);
  assert.equal(sliders.eyeY.value, '256');
  assert.equal(eye.getAttribute('aria-valuetext'), 'אופקי 572, אנכי 256');
});

test('keyboard navigation on light element deactivates active scenario preset (no false active state)', () => {
  const { elements, scenarioButtons } = loadGeometryPage();
  assertPressed(scenarioButtons.scOver, true);

  elements.light.fire('keydown', { key: 'ArrowRight', preventDefault() {} });
  assertPressed(scenarioButtons.scOver, false);

  elements.light.fire('keydown', { key: 'ArrowLeft', preventDefault() {} });
  assertPressed(scenarioButtons.scOver, true);
});


function assertRangeAria(el, now, text) {
  assert.equal(el.getAttribute('aria-valuenow'), now, el.id + ' aria-valuenow');
  assert.equal(el.getAttribute('aria-valuetext'), text, el.id + ' aria-valuetext');
}

test('geometry and optics range inputs carry static aria-valuemin/max/now/valuetext matching min/max/value', () => {
  const html = read('geometry/index.html');
  const ids = ['lightX', 'lightY', 'eyeX', 'eyeY', 'tilt', 'srcNits', 'srcArea', 'srcDist', 'refl'];
  for (const id of ids) {
    const m = html.match(new RegExp('<input type="range" id="' + id + '"[^>]*>'));
    assert.ok(m, id + ' range input must exist');
    const attr = (name) => {
      const a = m[0].match(new RegExp('\\s' + name + '="([^"]*)"'));
      return a ? a[1] : null;
    };
    assert.equal(attr('aria-valuemin'), attr('min'), id + ' aria-valuemin');
    assert.equal(attr('aria-valuemax'), attr('max'), id + ' aria-valuemax');
    assert.equal(attr('aria-valuenow'), attr('value'), id + ' aria-valuenow');
    assert.ok(attr('aria-valuetext'), id + ' aria-valuetext');
  }
});

test('page load syncs aria-valuenow/valuetext on every geometry and optics range input', () => {
  const { sliders } = loadGeometryPage();
  assertRangeAria(sliders.lightX, '280', '280');
  assertRangeAria(sliders.lightY, '36', '36');
  assertRangeAria(sliders.eyeX, '560', '560');
  assertRangeAria(sliders.eyeY, '268', '268');
  assertRangeAria(sliders.tilt, '0', '0°');
  assertRangeAria(sliders.srcNits, '20000', '20000 cd/m²');
  assertRangeAria(sliders.srcArea, '4', '4 סמ״ר');
  assertRangeAria(sliders.srcDist, '2', '2.0 מ׳');
  assertRangeAria(sliders.refl, '0.06', '0.060');
});

test('slider input, scenario buttons and keyboard nudges keep geometry range ARIA in sync', () => {
  const { scenarioButtons, sliders, elements } = loadGeometryPage();

  sliders.tilt.value = '15';
  sliders.tilt.fire('input', { target: sliders.tilt });
  assertRangeAria(sliders.tilt, '15', '15°');

  sliders.lightX.value = '400';
  sliders.lightX.fire('input');
  assertRangeAria(sliders.lightX, '400', '400');

  elements.eye.fire('keydown', { key: 'ArrowUp', preventDefault() {} });
  assertRangeAria(sliders.eyeY, '256', '256');

  scenarioButtons.scFace.fire('click');
  assertRangeAria(sliders.lightX, '760', '760');
  assertRangeAria(sliders.lightY, '140', '140');
  assertRangeAria(sliders.eyeX, '520', '520');
  assertRangeAria(sliders.eyeY, '250', '250');
  assertRangeAria(sliders.tilt, '0', '0°');
});

test('optics presets and optics slider input keep optics range ARIA in sync', () => {
  const { opticsButtons, sliders } = loadGeometryPage();

  opticsButtons.optMatte.fire('click');
  assertRangeAria(sliders.srcNits, '4000', '4000 cd/m²');
  assertRangeAria(sliders.srcArea, '12000', '12000 סמ״ר');
  assertRangeAria(sliders.srcDist, '1.4', '1.4 מ׳');
  assertRangeAria(sliders.refl, '0.015', '0.015');

  sliders.srcDist.value = '3.5';
  sliders.srcDist.fire('input');
  assertRangeAria(sliders.srcDist, '3.5', '3.5 מ׳');
});
