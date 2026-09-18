const test = require('node:test');
const assert = require('node:assert/strict');
const { probeAdd } = require('../src/lib/sparkprobe_030456.js');
test('probeAdd adds', () => { assert.equal(probeAdd(2, 3), 5); });
