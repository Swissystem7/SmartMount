const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('docs/PARK_PRODUCT.md exists with PARK and no revenue path', () => {
  const p = path.join(ROOT, 'docs/PARK_PRODUCT.md');
  assert.ok(fs.existsSync(p), 'PARK_PRODUCT.md missing');
  const md = read('docs/PARK_PRODUCT.md');
  assert.match(md, /PARK/);
  assert.match(md, /no revenue|Revenue path:\s*\*\*none\*\*|revenue path/i);
  assert.match(md, /product/i);
});

test('PARK_PRODUCT.md keeps case page ACCEPT and product PARK', () => {
  const md = read('docs/PARK_PRODUCT.md');
  assert.match(md, /case/i);
  assert.match(md, /portfolio/i);
  assert.match(md, /not a product|PARK/i);
});
