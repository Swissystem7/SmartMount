const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('docs/PARAMS_SSOT.md exists and points at config + sync script', () => {
  const p = path.join(ROOT, 'docs/PARAMS_SSOT.md');
  assert.ok(fs.existsSync(p), 'PARAMS_SSOT.md missing');
  const md = read('docs/PARAMS_SSOT.md');
  assert.match(md, /config\/control-params\.json/);
  assert.match(md, /scripts\/sync-control-params\.js|sync-params|sync-control-params/);
  assert.match(md, /SSOT|single source/i);
});

test('SSOT targets exist on disk', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'config/control-params.json')));
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/sync-control-params.js')));
});
