const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DOC = fs.readFileSync(path.join(__dirname, '..', 'docs', 'TESTING.md'), 'utf8');

// The table names a file as `test/x.test.js` or, after the first one in a
// cell, as bare `x.test.js`. Both resolve under test/.
function namedTestFiles(md) {
  const names = new Set();
  for (const m of md.matchAll(/`(?:test\/)?([\w.-]+\.test\.js)`/g)) names.add(m[1]);
  return [...names];
}

test('TESTING.md names test files', () => {
  assert.ok(namedTestFiles(DOC).length >= 20);
});

test('every test file TESTING.md names exists under test/', () => {
  const missing = namedTestFiles(DOC).filter(
    (f) => !fs.existsSync(path.join(__dirname, f)),
  );
  assert.deepEqual(missing, []);
});
