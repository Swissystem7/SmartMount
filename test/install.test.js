const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

// `npm ci` and `npm audit` both refuse to run without a lockfile (ENOLOCK /
// "can only install with an existing package-lock.json"). CT-001.
test('package-lock.json exists and matches package.json', () => {
  assert.ok(fs.existsSync(path.join(root, 'package-lock.json')), 'npm ci needs package-lock.json');
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  assert.equal(lock.name, pkg.name);
  assert.ok(lock.lockfileVersion >= 2);
  assert.deepEqual(lock.packages[''].engines, pkg.engines);
});

// The README promises host tests "without dependencies"; the lockfile is the
// place a new one would show up first.
test('the project has no npm dependencies', () => {
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.equal(pkg[k], undefined, `package.json has ${k}`);
  }
  assert.deepEqual(Object.keys(lock.packages), ['']);
});

test('engines.node covers the Node version CI uses', () => {
  const pkg = readJson('package.json');
  const min = Number((/^>=\s*(\d+)/.exec(pkg.engines && pkg.engines.node) || [])[1]);
  assert.ok(min >= 20, 'node:test runner flags used here need Node 20+');
  assert.ok(Number(process.versions.node.split('.')[0]) >= min, `running on Node ${process.version}`);
});

// Tests hash the .ino and parse Markdown with "\n" regexes, so a CRLF
// checkout on Windows fails locally while Linux CI passes.
test('.gitattributes pins LF line endings for every file', () => {
  const ga = fs.readFileSync(path.join(root, '.gitattributes'), 'utf8');
  assert.match(ga, /^\*\s+text=auto\s+eol=lf\s*$/m);
});

test('tracked text files read on Windows have no CR', () => {
  for (const f of ['README.md', 'firmware/smart_mount.ino', 'docs/TESTING.md', 'config/control-params.json']) {
    assert.ok(!fs.readFileSync(path.join(root, f), 'utf8').includes('\r'), `${f} has CRLF`);
  }
});
