const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runSmokeTest, resolvePlaywright } = require('../scripts/smoke');

test('smoke runner exports resolvePlaywright and runSmokeTest', () => {
  assert.equal(typeof runSmokeTest, 'function');
  assert.equal(typeof resolvePlaywright, 'function');
});

test('main page declares mobile viewport, Hebrew language and RTL direction', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(indexHtml, /<html\s+[^>]*lang=["']he["']/i);
  assert.match(indexHtml, /<html\s+[^>]*dir=["']rtl["']/i);
  assert.match(indexHtml, /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width/i);
});

test('runSmokeTest executes without errors when playwright is present', async () => {
  // Executes smoke check against the local files
  await runSmokeTest();
  assert.ok(true);
});
