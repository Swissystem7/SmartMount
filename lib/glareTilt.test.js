'use strict';
const assert = require('node:assert');
const { glareTilt } = require('./glareTilt.js');

// normal
assert.strictEqual(glareTilt(90, 45), 45);   // diff 45, at clamp edge
assert.strictEqual(glareTilt(100, 80), 20);  // diff 20
assert.strictEqual(glareTilt(45, 90), 45);   // symmetric

// wraparound (spec example: 350 vs 10 = 20)
assert.strictEqual(glareTilt(350, 10), 20);
assert.strictEqual(glareTilt(10, 350), 20);

// clamp to 45 when diff exceeds
assert.strictEqual(glareTilt(0, 100), 45);
assert.strictEqual(glareTilt(0, 180), 45);   // max possible diff -> clamped

// zero diff / same azimuth
assert.strictEqual(glareTilt(200, 200), 0);
assert.strictEqual(glareTilt(0, 360), 0);    // 360 wraps to 0

// NaN input -> 0
assert.strictEqual(glareTilt(NaN, 10), 0);
assert.strictEqual(glareTilt(10, NaN), 0);
assert.strictEqual(glareTilt(NaN, NaN), 0);

console.log('all passed');
