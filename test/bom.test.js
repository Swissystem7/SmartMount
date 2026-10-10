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

test('every BOM item carries a non-empty, unique id and a non-empty name', () => {
  const items = getBomItems();
  const seenIds = new Set();

  for (const part of items) {
    assert.strictEqual(typeof part.id, 'string', 'each part must expose a string id');
    assert.ok(part.id.trim().length > 0, 'id must not be empty');
    assert.ok(!seenIds.has(part.id), `id must be unique across the BOM, saw "${part.id}" twice`);
    seenIds.add(part.id);

    assert.strictEqual(typeof part.name, 'string', 'each part must expose a string name');
    assert.ok(part.name.trim().length > 0, 'name must not be empty');
  }

  assert.strictEqual(seenIds.size, items.length, 'every item must have its own id');
});

test('getBomItems hands out a fresh copy that callers cannot use to corrupt the BOM', () => {
  const first = getBomItems();
  const second = getBomItems();

  assert.notStrictEqual(first, second, 'each call must return a new array, not a shared reference');
  assert.notStrictEqual(first[0], second[0], 'each call must return new item objects');
  assert.notStrictEqual(first[0].suppliers, second[0].suppliers, 'each call must return new suppliers arrays');

  const originalLength = first.length;
  const originalName = first[0].name;
  const originalSupplierCount = first[0].suppliers.length;

  first[0].name = 'MUTATED BY CALLER';
  first[0].suppliers.push('Injected Supplier');
  first.length = 0;

  const third = getBomItems();
  assert.strictEqual(third.length, originalLength, 'truncating a returned array must not shrink the canonical BOM');
  assert.strictEqual(third[0].name, originalName, 'rewriting a returned item must not rewrite the canonical BOM');
  assert.strictEqual(third[0].suppliers.length, originalSupplierCount, 'appending to a returned suppliers array must not grow the canonical BOM');
  assert.ok(!third[0].suppliers.includes('Injected Supplier'), 'an injected supplier must not leak into the canonical BOM');
});

test('the BOM is the hardware firmware/smart_mount.ino drives, not a different machine', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ino = fs.readFileSync(path.join(__dirname, '..', 'firmware', 'smart_mount.ino'), 'utf8');
  const items = getBomItems();
  const byId = Object.fromEntries(items.map((p) => [p.id, p]));

  // MCU: the firmware includes WiFi.h / WebServer.h from the ESP32 core.
  assert.match(ino, /ESP32/);
  assert.ok(byId['mcu-esp32-devkit'], 'MCU must be the ESP32 the firmware targets');
  assert.ok(!items.some((p) => /RP2040/i.test(p.name + p.specification)), 'no RP2040: the firmware is ESP32-only');

  // Sensors: one BH1750 per constructor in the firmware.
  const sensors = (ino.match(/^BH1750\s+\w+\(/gm) || []).length;
  assert.strictEqual(sensors, 2);
  assert.strictEqual(byId['light-sensor-bh1750'].quantity, sensors);

  // Motion: one AccelStepper in DRIVER mode → one STEP/DIR driver, one motor.
  const steppers = (ino.match(/^AccelStepper\s+\w+\(/gm) || []).length;
  assert.strictEqual(steppers, 1);
  assert.match(ino, /AccelStepper::DRIVER/);
  assert.strictEqual(byId['stepper-driver-a4988'].quantity, steppers);
  assert.strictEqual(byId['stepper-motor-nema17'].quantity, steppers);

  // No homing in firmware (setCurrentPosition(0) at boot), so no endstop part.
  assert.ok(!items.some((p) => /endstop/i.test(p.id + p.name)), 'endstops are an open problem, not a fitted part');
});

test('getBomItems()[0].suppliers must include Generic ESP32 Supplier', () => {
  const bom = require('../src/lib/bom.js');
  const getBomItems = bom.getBomItems || bom;
  const items = getBomItems();
  assert.deepStrictEqual(items[0].suppliers, ['Espressif', 'DOIT', 'AZ-Delivery', 'Generic ESP32 Supplier']);
});
