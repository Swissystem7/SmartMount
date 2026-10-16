const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function el(value = '0') {
  const on = {};
  return {
    value, textContent: '', className: '', innerHTML: '', style: {}, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null,
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (on[t] = on[t] || []).push(fn); },
    fire(t) { if (this['on' + t]) this['on' + t](); (on[t] || []).forEach((fn) => fn.call(this)); },
    getScreenCTM: () => null,
    createSVGPoint: () => ({ matrixTransform: () => ({ x: 0, y: 0 }) }),
  };
}

function loadPage() {
  const html = read('geometry/index.html');
  const els = {};
  for (const m of html.matchAll(/<input[^>]*id="(\w+)"[^>]*value="([^"]*)"/g)) els[m[1]] = el(m[2]);
  const $ = (id) => els[id] || (els[id] = el());
  const document = { getElementById: $, querySelectorAll: () => [], createElement: () => el(), createElementNS: () => el() };
  const ctx = vm.createContext({ document, console });
  vm.runInContext(read('src/lib/control-params.js'), ctx);
  vm.runInContext(read('src/lib/optics.js'), ctx);
  const open = html.indexOf('<script>', html.indexOf('src="../src/lib/optics.js"'));
  vm.runInContext(html.slice(open + 8, html.indexOf('</script>', open)), ctx);
  return $;
}

test('geometry: a light in the room is in front of the panel and reflects', () => {
  const $ = loadPage();
  assert.match($('kInc').textContent, /^\d+°$/, 'default lamp (x=280) must get an incidence angle');
  assert.doesNotMatch($('verdict').textContent, /מאחורי הפאנל/);

  $('scFace').fire('click');
  assert.ok($('extraRays').children.length > 0, 'window scenario samples the extended source');
});

test('geometry: only a light behind the wall plane (x < pivot) is "behind the panel"', () => {
  const $ = loadPage();
  $('lightX').value = '40';
  $('lightX').fire('input');
  assert.equal($('kInc').textContent, 'מאחורי הפאנל');
  assert.match($('verdict').textContent, /מאחורי הפאנל/);
});
