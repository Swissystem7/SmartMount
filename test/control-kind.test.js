const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/lib/control');
test('panelKindOf reports an unknown panel as null', () => {
  assert.equal(c.panelKindOf('nosuchpanel'), null);
});
