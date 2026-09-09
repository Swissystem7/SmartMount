const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function readIf(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

test('docs/NO_STOREFRONT.md forbids Tindie / Sponsors / kit CTA', () => {
  const md = read('docs/NO_STOREFRONT.md');
  assert.match(md, /Tindie/i);
  assert.match(md, /Sponsors/i);
  assert.match(md, /kit CTA|Kit CTA|no kit/i);
  assert.match(md, /Forbidden|forbids|must not/i);
});

test('README or NO_STOREFRONT.md contains PARK / no kit', () => {
  const blob = readIf('README.md') + '\n' + read('docs/NO_STOREFRONT.md');
  assert.match(blob, /PARK/);
  assert.match(blob, /no kit|No kit|אין ערכה|לא.*ערכה/i);
});
