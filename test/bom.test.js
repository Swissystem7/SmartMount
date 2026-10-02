'use strict';

const test = require('node:test');
const assert = require('node:assert');

let getBomItems;
try {
  const bom = require('../src/lib/bom.js');
  getBomItems = bom.getBomItems || bom;
} catch {
  // At base commit src/lib/bom.js does not exist; getBomItems will be undefined
}

test('getBomItems returns vendor-independent BOM items conforming to specification contract', () => {
  assert.strictEqual(typeof getBomItems, 'function', 'getBomItems must be exported as a function');

  const items = getBomItems();
  assert.ok(Array.isArray(items), 'getBomItems() must return an array');
  assert.ok(items.length > 0, 'getBomItems() must return a non-empty array');

  for (const part of items) {
    assert.ok(part && typeof part === 'object', 'each part in BOM must be an object');
    assert.strictEqual(typeof part.specification, 'string', 'each part must contain a generic specification string');
    assert.ok(part.specification.trim().length > 0, 'generic specification must not be empty');
    assert.strictEqual(typeof part.quantity, 'number', 'each part must contain a numeric quantity');
    assert.ok(part.quantity > 0, 'quantity must be positive');
    assert.ok(Array.isArray(part.suppliers), 'each part must contain a suppliers array');
    assert.ok(part.suppliers.length >= 2, 'each part must have at least two alternative generic suppliers');

    for (const supplier of part.suppliers) {
      assert.strictEqual(typeof supplier, 'string', 'each supplier must be a string');
      assert.ok(supplier.trim().length > 0, 'supplier name must not be empty');
    }
  }
});
