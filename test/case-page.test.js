const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('docs/CASE_PAGE.md links to live case URL and states firmware never flashed', () => {
  const p = path.join(ROOT, 'docs/CASE_PAGE.md');
  assert.ok(fs.existsSync(p), 'CASE_PAGE.md missing');
  const md = read('docs/CASE_PAGE.md');
  assert.match(md, /https:\/\/swissystem7\.github\.io\/SmartMount\/case\//);
  assert.match(md, /firmware never flashed|never flashed|לא הועלה/i);
});

test('CASE_PAGE.md keeps PARK / portfolio honesty', () => {
  const md = read('docs/CASE_PAGE.md');
  assert.match(md, /PARK|portfolio/i);
  assert.match(md, /not a kit|no kit|לא.*ערכה|storefront/i);
});
