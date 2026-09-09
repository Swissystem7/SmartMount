const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('PORTFOLIO_ONE_LINER.md states never-flashed / לא רץ honesty and PARK', () => {
  const md = read('docs/PORTFOLIO_ONE_LINER.md');
  assert.match(md, /לא רץ|never/i);
  assert.match(md, /PARK/);
  assert.match(md, /swissystem7\.github\.io\/SmartMount\/case/);
});

test('README or PORTFOLIO_ONE_LINER carries Hebrew לא רץ / לא רצה honesty', () => {
  const blob = read('README.md') + '\n' + read('docs/PORTFOLIO_ONE_LINER.md');
  assert.match(blob, /לא רץ|לא רצה/);
  assert.match(blob, /PARK/);
  assert.match(blob, /never/i);
});
