const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const ino = fs.readFileSync(path.join(root, 'firmware/smart_mount.ino'), 'utf8');

// The README API bullet is what a recruiter reads instead of the .ino. #44
// (JSON 404) and #58 (null lux) changed what the board answers; the bullet
// kept describing the older board until this test pinned it.
const apiLine = readme.split('\n').find((l) => l.startsWith('- **API:**'));

test('README has one API bullet', () => {
  assert.ok(apiLine, 'no "- **API:**" line in README.md');
});

test('README API bullet: a failed BH1750 read is null in /status, like setLux()', () => {
  assert.match(ino, /doc\[key\] = nullptr/);
  assert.match(apiLine, /`\/status`/);
  assert.match(apiLine, /lux_top: null/);
  assert.match(apiLine, /lux_bot: null/);
});

test('README API bullet: unknown path is a JSON 404, like handleNotFound()', () => {
  assert.match(ino, /sendError\(404, "not found"\)/);
  assert.match(apiLine, /404/);
  assert.ok(apiLine.includes('{"ok":false,"error":"not found"}'), apiLine);
});
